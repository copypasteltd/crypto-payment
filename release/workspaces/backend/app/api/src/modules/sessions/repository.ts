import {
  PostgresSessionArchiveRecordRepository,
  importedSessionPackRecordSchema,
  sessionArchiveStateSchema,
  type ImportedSessionPackRecord,
  type SessionArchiveRecordRepository,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { objectStore } from "../uploads/object-store.js";

export interface SessionArchiveRepository {
  init(): Promise<void>;
  listImportedArchives(): ImportedSessionPackRecord[];
  getImportedArchiveBySessionVersionId(sessionVersionId: string): ImportedSessionPackRecord | null;
  saveImportedArchive(record: ImportedSessionPackRecord, archiveBytes: Uint8Array): Promise<void>;
  readImportedArchiveBytes(sessionVersionId: string): Promise<Uint8Array | null>;
}

async function readStreamToBytes(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }

  return new Uint8Array(Buffer.concat(chunks));
}

class FileBackedSessionArchiveRecordRepository implements SessionArchiveRecordRepository {
  #initialized = false;
  #statePath: string;
  #archives = sessionArchiveStateSchema.parse({ archives: [] }).archives;

  constructor(storageDir = resolveApiStorageDir("sessions")) {
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "session-archives-state.json");
  }

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#archives = (await this.loadState()).archives;
    this.#initialized = true;
  }

  listImportedArchives() {
    return [...this.#archives].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
  }

  getImportedArchiveBySessionVersionId(sessionVersionId: string) {
    return (
      this.#archives.find((item) => item.sessionVersionId === sessionVersionId) ?? null
    );
  }

  async saveImportedArchiveRecord(record: ImportedSessionPackRecord) {
    const parsedRecord = importedSessionPackRecordSchema.parse(record);
    await this.init();
    this.#archives = sessionArchiveStateSchema.parse({
      archives: upsertSessionArchiveRecord(this.#archives, parsedRecord),
    }).archives;
    await this.persistState();
    return parsedRecord;
  }

  async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return sessionArchiveStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return sessionArchiveStateSchema.parse({ archives: [] });
    }
  }

  async persistState() {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(sessionArchiveStateSchema.parse({ archives: this.#archives }), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

class ObjectBackedSessionArchiveRepository implements SessionArchiveRepository {
  #recordRepository: SessionArchiveRecordRepository;

  constructor(recordRepository: SessionArchiveRecordRepository) {
    this.#recordRepository = recordRepository;
  }

  async init() {
    await this.#recordRepository.init();
  }

  listImportedArchives() {
    return this.#recordRepository.listImportedArchives();
  }

  getImportedArchiveBySessionVersionId(sessionVersionId: string) {
    return this.#recordRepository.getImportedArchiveBySessionVersionId(sessionVersionId);
  }

  async saveImportedArchive(record: ImportedSessionPackRecord, archiveBytes: Uint8Array) {
    const parsedRecord = importedSessionPackRecordSchema.parse(record);
    await objectStore.putBuffer(resolveImportedSessionArchiveObjectKey(parsedRecord.sessionVersionId), {
      content: Buffer.from(archiveBytes),
      contentType: "application/gzip",
    });
    await this.#recordRepository.saveImportedArchiveRecord(parsedRecord);
  }

  async readImportedArchiveBytes(sessionVersionId: string) {
    await this.init();
    const record = this.getImportedArchiveBySessionVersionId(sessionVersionId);
    if (!record) {
      return null;
    }

    try {
      const stream = await objectStore.createReadStream(
        resolveImportedSessionArchiveObjectKey(record.sessionVersionId)
      );
      return await readStreamToBytes(stream);
    } catch {
      // Fall back to legacy local archive paths for pre-object-store records.
    }

    try {
      return new Uint8Array(await fs.readFile(record.archivePath));
    } catch {
      return null;
    }
  }
}

function upsertSessionArchiveRecord(
  records: ImportedSessionPackRecord[],
  nextRecord: ImportedSessionPackRecord
) {
  const nextRecords = [...records];
  const existingIndex = nextRecords.findIndex(
    (item) => item.sessionVersionId === nextRecord.sessionVersionId
  );

  if (existingIndex >= 0) {
    nextRecords[existingIndex] = nextRecord;
    return nextRecords;
  }

  nextRecords.push(nextRecord);
  return nextRecords;
}

function buildSessionArchiveRecordRepository(): SessionArchiveRecordRepository {
  const config = getApiRuntimeConfig();
  return config.sessionArchivesStore === "postgres"
    ? new PostgresSessionArchiveRecordRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new FileBackedSessionArchiveRecordRepository();
}

export function buildSessionArchiveRepository(): SessionArchiveRepository {
  return new ObjectBackedSessionArchiveRepository(buildSessionArchiveRecordRepository());
}

export function resolveImportedSessionArchivePath(sessionVersionId: string) {
  const archivesDir = resolveApiStorageDir("sessions", "archives");
  return path.join(archivesDir, `${sessionVersionId}.session-pack.json.gz`);
}

export function resolveImportedSessionArchiveObjectKey(sessionVersionId: string) {
  return `session-archives/${sessionVersionId}.session-pack.json.gz`;
}

export const sessionArchiveRepository: SessionArchiveRepository =
  buildSessionArchiveRepository();
