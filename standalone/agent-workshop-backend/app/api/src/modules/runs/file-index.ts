import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import { z } from "zod";
import {
  CachedRunFilesIndexRepository,
  PostgresRunFilesIndexRepository,
  type RunFilesIndexRepository,
} from "@lingban/db";
import {
  createLogicalPath,
  ensureTrailingSlash,
  normalizeAbsoluteFilePath,
  normalizeLogicalPrefix,
  toPosixPath,
} from "@lingban/files";
import {
  listRunFileIndexResponseSchema,
  runFileRecordSchema,
  type RunFileEntry,
  type ListRunFileIndexResponse,
  type RunFileRecord,
  type RunFileSource,
  type RunFileStorageTier,
} from "@lingban/contracts";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { objectStore } from "../uploads/object-store.js";
import { uploadRepository } from "../uploads/repository.js";
import {
  guessRunFileMimeType,
  inferRunFilePreviewMode,
} from "./file-preview.js";

type RunMeta = {
  runId: string;
  workspaceId: string;
  targetPath: string;
};

export type ListIndexedRunFilesQuery = {
  prefix?: string;
  search?: string;
  source?: RunFileSource;
  kind?: RunFileEntry["kind"];
  storageTier?: RunFileStorageTier;
  previewable?: boolean;
  downloadable?: boolean;
  limit?: number;
};

const runFilesIndexStateSchema = z.object({
  files: z.array(runFileRecordSchema),
});

type RunFilesIndexState = z.infer<typeof runFilesIndexStateSchema>;

function inferRuntimeOutputByPath(filePath: string) {
  const normalized = toPosixPath(path.resolve(filePath)).toLowerCase();
  return (
    normalized.includes("/output/") ||
    normalized.includes("/outputs/") ||
    normalized.includes("/receipts/")
  );
}

function inferSource(entry: RunFileEntry, uploadMatched: boolean): RunFileSource {
  if (uploadMatched) {
    return "user-upload";
  }

  const normalized = toPosixPath(path.resolve(entry.path)).toLowerCase();

  if (normalized.includes("/archive/")) {
    return "archive";
  }

  if (entry.kind === "log" || normalized.endsWith(".log") || normalized.includes("/logs/")) {
    return "log";
  }

  if (entry.kind === "output" || entry.kind === "receipt" || inferRuntimeOutputByPath(entry.path)) {
    return "runtime-output";
  }

  return "target-scan";
}

function sortFiles(files: RunFileRecord[]) {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

function sortFacetCounts(input: Map<string, number>) {
  return [...input.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeSearchTerm(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function buildManagedObjectKey(runId: string, source: RunFileSource, logicalPath: string) {
  const normalizedLogicalPath = logicalPath.replace(/^\/+/, "");
  return `runs/${runId}/indexed/${source}/${normalizedLogicalPath}`;
}

function isManagedIndexedObject(file: Pick<RunFileRecord, "path" | "source" | "objectKey"> | null | undefined) {
  return Boolean(file && !file.path.endsWith("/") && file.source !== "user-upload" && file.objectKey);
}

class FileBackedRunFilesIndexRepository extends CachedRunFilesIndexRepository {
  #storageDir: string;

  constructor(storageDir = resolveApiStorageDir("run-files")) {
    super();
    this.#storageDir = storageDir;
    mkdirSync(this.#storageDir, { recursive: true });
  }

  #getStatePath(runId: string) {
    return path.join(this.#storageDir, `${runId}.json`);
  }

  protected async loadAll() {
    const files = readdirSync(this.#storageDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    const records: RunFileRecord[] = [];
    for (const fileName of files) {
      const raw = readFileSync(path.join(this.#storageDir, fileName), "utf8");
      const state = runFilesIndexStateSchema.parse(JSON.parse(raw) as unknown);
      records.push(...state.files);
    }

    return records;
  }

  protected async persistRun(runId: string, files: RunFileRecord[]) {
    const statePath = this.#getStatePath(runId);
    const tempPath = buildAtomicTempPath(statePath);
    const payload = JSON.stringify(runFilesIndexStateSchema.parse({ files }), null, 2);
    await fs.writeFile(tempPath, payload, "utf8");
    renameSync(tempPath, statePath);
  }

  protected async clearStorage() {
    for (const entry of readdirSync(this.#storageDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      try {
        unlinkSync(path.join(this.#storageDir, entry.name));
      } catch {
        // Ignore transient cleanup failures.
      }
    }
  }
}

function buildRunFilesIndexRepository() {
  const config = getApiRuntimeConfig();
  return config.runFilesStore === "postgres"
    ? new PostgresRunFilesIndexRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
      })
    : new FileBackedRunFilesIndexRepository();
}

export class RunFileIndexService {
  async init() {
    await runFilesIndexRepository.init();
  }

  async replaceFromEntries(run: RunMeta, entries: RunFileEntry[]) {
    const previousFiles = runFilesIndexRepository.listRunFiles(run.runId);
    const uploadsByPath = this.#buildUploadPathMap(run.runId);
    const existingByPath = new Map(
      previousFiles.map((file) => [file.path, file] as const)
    );
    const files = await Promise.all(
      entries.map((entry) => this.#buildRecord(run, entry, uploadsByPath, existingByPath.get(entry.path) ?? null))
    );
    await runFilesIndexRepository.replaceRunFiles(run.runId, files);
    await this.#cleanupStaleManagedObjects(previousFiles, files);
    return files;
  }

  async replaceRecords(runId: string, files: RunFileRecord[]) {
    const previousFiles = runFilesIndexRepository.listRunFiles(runId);
    const parsed = sortFiles(files).map((file) => runFileRecordSchema.parse(file));
    await runFilesIndexRepository.replaceRunFiles(runId, parsed);
    await this.#cleanupStaleManagedObjects(previousFiles, parsed);
    return parsed;
  }

  async upsertFromEntry(run: RunMeta, entry: RunFileEntry) {
    const existing = runFilesIndexRepository.getRunFile(run.runId, entry.path);
    const next = await runFilesIndexRepository.upsertRunFile(
      await this.#buildRecord(run, entry, this.#buildUploadPathMap(run.runId), existing)
    );
    await this.#cleanupStaleManagedObjects(existing ? [existing] : [], [next]);
    return next;
  }

  list(runId: string) {
    return runFilesIndexRepository.listRunFiles(runId);
  }

  get(runId: string, filePath: string) {
    return runFilesIndexRepository.getRunFile(runId, filePath);
  }

  listIndexed(runId: string, query: ListIndexedRunFilesQuery = {}): ListRunFileIndexResponse {
    const allFiles = sortFiles(runFilesIndexRepository.listRunFiles(runId));
    const prefix = normalizeLogicalPrefix(query.prefix);
    const search = normalizeSearchTerm(query.search);
    const limit = Math.max(1, Math.min(query.limit ?? 200, 1000));

    const filtered = allFiles.filter((file) => {
      if (prefix && !(file.logicalPath === prefix || file.logicalPath.startsWith(ensureTrailingSlash(prefix)))) {
        return false;
      }

      if (search) {
        const haystack = `${file.logicalPath}\n${file.name}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (query.source && file.source !== query.source) {
        return false;
      }

      if (query.kind && file.kind !== query.kind) {
        return false;
      }

      if (query.storageTier && file.storageTier !== query.storageTier) {
        return false;
      }

      if (typeof query.previewable === "boolean" && file.previewable !== query.previewable) {
        return false;
      }

      if (typeof query.downloadable === "boolean" && file.downloadable !== query.downloadable) {
        return false;
      }

      return true;
    });

    const items = filtered.slice(0, limit);
    return listRunFileIndexResponseSchema.parse({
      mode: "indexed",
      summary: this.#summarize(allFiles, items, filtered.length),
      items,
    });
  }

  #summarize(
    allFiles: RunFileRecord[],
    items: RunFileRecord[],
    matchedCount: number
  ): ListRunFileIndexResponse["summary"] {
    const bySource = new Map<string, number>();
    const byKind = new Map<string, number>();
    const byStorageTier = new Map<string, number>();
    let fileCount = 0;
    let directoryCount = 0;
    let previewableCount = 0;
    let downloadableCount = 0;
    let objectBackedCount = 0;
    let uploadBackedCount = 0;
    let latestUpdatedAt: string | null = null;
    let latestIndexedAt: string | null = null;

    for (const file of items) {
      bySource.set(file.source, (bySource.get(file.source) ?? 0) + 1);
      byKind.set(file.kind, (byKind.get(file.kind) ?? 0) + 1);
      byStorageTier.set(file.storageTier, (byStorageTier.get(file.storageTier) ?? 0) + 1);

      if (file.path.endsWith("/")) {
        directoryCount += 1;
      } else {
        fileCount += 1;
      }

      if (file.previewable) {
        previewableCount += 1;
      }

      if (file.downloadable) {
        downloadableCount += 1;
      }

      if (file.objectKey) {
        objectBackedCount += 1;
      }

      if (file.uploadId) {
        uploadBackedCount += 1;
      }

      if (!latestUpdatedAt || file.updatedAt > latestUpdatedAt) {
        latestUpdatedAt = file.updatedAt;
      }

      if (!latestIndexedAt || file.indexedAt > latestIndexedAt) {
        latestIndexedAt = file.indexedAt;
      }
    }

    return {
      totalIndexedCount: allFiles.length,
      matchedCount,
      returnedCount: items.length,
      fileCount,
      directoryCount,
      previewableCount,
      downloadableCount,
      objectBackedCount,
      uploadBackedCount,
      latestUpdatedAt,
      latestIndexedAt,
      bySource: sortFacetCounts(bySource),
      byKind: sortFacetCounts(byKind),
      byStorageTier: sortFacetCounts(byStorageTier),
    };
  }

  #buildUploadPathMap(runId: string) {
    const uploadsByPath = new Map<string, ReturnType<typeof uploadRepository.listUploadsByRun>[number]>();
    for (const upload of uploadRepository.listUploadsByRun(runId)) {
      if (!upload.attachedPath) {
        continue;
      }

      uploadsByPath.set(normalizeAbsoluteFilePath(upload.attachedPath), upload);
    }

    return uploadsByPath;
  }

  async #cleanupStaleManagedObjects(previousFiles: RunFileRecord[], nextFiles: RunFileRecord[]) {
    const nextObjectKeys = new Set(
      nextFiles
        .filter((file) => isManagedIndexedObject(file))
        .map((file) => file.objectKey as string)
    );

    const staleObjectKeys = new Set(
      previousFiles
        .filter((file) => isManagedIndexedObject(file))
        .map((file) => file.objectKey as string)
        .filter((objectKey) => !nextObjectKeys.has(objectKey))
    );

    await Promise.all(
      [...staleObjectKeys].map(async (objectKey) => {
        try {
          await objectStore.deleteObject(objectKey);
        } catch (error) {
          console.error(
            `[lingban-run-files] failed to cleanup stale managed object ${objectKey}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      })
    );
  }

  #buildRecord(
    run: RunMeta,
    entry: RunFileEntry,
    uploadsByPath: Map<string, ReturnType<typeof uploadRepository.listUploadsByRun>[number]>,
    existing: RunFileRecord | null
  ) {
    const matchedUpload =
      entry.path.endsWith("/")
        ? null
        : uploadsByPath.get(normalizeAbsoluteFilePath(entry.path)) ?? null;
    const mimeType = entry.path.endsWith("/")
      ? null
      : guessRunFileMimeType(entry.path, matchedUpload?.contentType);
    const previewMode = entry.path.endsWith("/")
      ? "none"
      : inferRunFilePreviewMode(entry.path, mimeType);
    const indexedAt = new Date().toISOString();
    const source = inferSource(entry, Boolean(matchedUpload));
    const logicalPath = createLogicalPath(run.targetPath, entry.path);
    const reusableManagedObject =
      !matchedUpload &&
      !entry.path.endsWith("/") &&
      existing?.objectKey &&
      existing.source === source &&
      existing.logicalPath === logicalPath &&
      existing.sizeBytes === entry.sizeBytes &&
      existing.updatedAt === entry.updatedAt
        ? {
            objectKey: existing.objectKey,
            checksum: existing.checksum,
          }
        : null;
    const objectKey =
      matchedUpload?.objectKey ??
      reusableManagedObject?.objectKey ??
      (!entry.path.endsWith("/") ? buildManagedObjectKey(run.runId, source, logicalPath) : null);
    const checksum = matchedUpload?.sha256 ?? reusableManagedObject?.checksum ?? null;

    const baseRecord = runFileRecordSchema.parse({
      ...entry,
      runId: run.runId,
      workspaceId: run.workspaceId,
      logicalPath,
      source,
      mimeType,
      objectKey,
      uploadId: matchedUpload?.uploadId ?? null,
      checksum,
      previewMode,
      previewable: previewMode === "text" || previewMode === "image" || previewMode === "pdf",
      downloadable: !entry.path.endsWith("/"),
      storageTier: existing?.storageTier ?? "hot",
      archivedAt: existing?.archivedAt ?? null,
      archivedFromObjectKey: existing?.archivedFromObjectKey ?? null,
      archiveReason: existing?.archiveReason ?? null,
      indexedAt,
    });

    return this.#materializeManagedObject(baseRecord, matchedUpload != null, reusableManagedObject != null);
  }

  async #materializeManagedObject(
    record: RunFileRecord,
    isUploadedObject: boolean,
    isReusableManagedObject: boolean
  ) {
    if (record.path.endsWith("/") || isUploadedObject || isReusableManagedObject || !record.objectKey) {
      return record;
    }

    const stored = await objectStore.putPath(record.objectKey, {
      absolutePath: path.resolve(record.path),
      contentType: record.mimeType,
    });

    return runFileRecordSchema.parse({
      ...record,
      objectKey: stored.objectKey,
      checksum: stored.sha256,
      sizeBytes: stored.sizeBytes,
    });
  }
}

export const runFilesIndexRepository = buildRunFilesIndexRepository();
export const runFileIndexService = new RunFileIndexService();
