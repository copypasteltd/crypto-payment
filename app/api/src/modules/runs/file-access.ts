import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import type { RunAggregate } from "@lingban/db";
import {
  ensureTrailingSlash,
  resolvePathWithinRoot,
  toPosixPath,
} from "@lingban/files";
import { resolveByteRange } from "../uploads/byte-range.js";
import {
  runFileEntrySchema,
  runFilePreviewResponseSchema,
  runFileReadResponseSchema,
  type RunFileEntry,
  type RunFilePreviewResponse,
  type RunFileReadResponse,
  type RunFileRecord,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { billingService } from "../billing/service.js";
import { quotaService } from "../quotas/service.js";
import {
  appendQuotaApprovalFeedback,
  type ApprovalFeedbackDependencies,
  defaultApprovalFeedbackDependencies,
} from "./approval-feedback.js";
import {
  extractOfficePreviewFromPath,
  extractOfficePreviewFromStream,
  guessRunFileMimeType,
  isOfficePreviewMimeType,
  readTextPreviewFromPath,
  readTextPreviewFromStream,
} from "./file-preview.js";
import { runFileIndexService } from "./file-index.js";
import { buildRunQuotaUsageContext } from "./quota-usage.js";
import { runsRepository } from "./repository.js";
import { runFileSecurityService } from "../uploads/file-security.js";
import { objectStore } from "../uploads/object-store.js";
import { uploadRepository } from "../uploads/repository.js";

type ResolvedRunFile = {
  aggregate: RunAggregate;
  rootPath: string;
  file: RunFileEntry;
  indexed: RunFileRecord;
  fromIndex: boolean;
};

type RunsRepositoryLike = Pick<typeof runsRepository, "get" | "update">;

type RunFileIndexServiceLike = Pick<
  typeof runFileIndexService,
  "get" | "list" | "replaceFromEntries" | "replaceRecords" | "upsertFromEntry"
>;

export type RunFileAccessDependencies = {
  runsRepository: RunsRepositoryLike;
  runFileIndexService: RunFileIndexServiceLike;
  uploadRepository: Pick<typeof uploadRepository, "getUpload" | "findUploadByAttachedPath">;
  objectStore: Pick<typeof objectStore, "createReadStream">;
  runFileSecurityService: Pick<
    typeof runFileSecurityService,
    "ensureUploadAllowed" | "scanObjectKey" | "scanAbsolutePath" | "assertAccessAllowed"
  >;
  quotaService: Pick<
    typeof quotaService,
    | "buildQuotaApprovalPrompt"
    | "applyRunApprovalDecision"
    | "commitUsageDecision"
    | "consumeApprovedUsageOverride"
    | "previewUsage"
  >;
  billingService: Pick<typeof billingService, "recordUsage">;
  approvalFeedbackDependencies: ApprovalFeedbackDependencies;
};

export const defaultRunFileAccessDependencies: RunFileAccessDependencies = {
  runsRepository,
  runFileIndexService,
  uploadRepository,
  objectStore,
  runFileSecurityService,
  quotaService,
  billingService,
  approvalFeedbackDependencies: defaultApprovalFeedbackDependencies,
};

function inferFileKind(absolutePath: string) {
  const normalized = toPosixPath(absolutePath).toLowerCase();

  if (normalized.includes("/receipts/")) {
    return "receipt" as const;
  }

  if (normalized.includes("/archive/")) {
    return "archive" as const;
  }

  if (normalized.endsWith(".log") || normalized.includes("/logs/")) {
    return "log" as const;
  }

  if (/\.(png|jpg|jpeg|gif|webp|svg|pdf)$/i.test(normalized)) {
    return "screenshot" as const;
  }

  return "output" as const;
}

async function buildRunFileEntry(absolutePath: string): Promise<RunFileEntry> {
  const stats = await fs.stat(absolutePath);
  const isDirectory = stats.isDirectory();

  return runFileEntrySchema.parse({
    path: isDirectory
      ? ensureTrailingSlash(toPosixPath(absolutePath))
      : toPosixPath(absolutePath),
    name: path.basename(absolutePath) || path.parse(absolutePath).root,
    kind: inferFileKind(absolutePath),
    sizeBytes: isDirectory ? null : stats.size,
    updatedAt: stats.mtime.toISOString(),
  });
}

async function walkDirectory(rootPath: string): Promise<RunFileEntry[]> {
  const entries: RunFileEntry[] = [];

  async function visit(currentPath: string) {
    const stats = await fs.stat(currentPath);
    entries.push(await buildRunFileEntry(currentPath));

    if (!stats.isDirectory()) {
      return;
    }

    const children = await fs.readdir(currentPath, { withFileTypes: true });
    for (const child of children) {
      await visit(path.join(currentPath, child.name));
    }
  }

  await visit(rootPath);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function getRunRoot(runsRepositoryLike: RunsRepositoryLike, runId: string) {
  const aggregate = runsRepositoryLike.get(runId);

  if (!aggregate) {
    throw new AppError(404, "RUN_NOT_FOUND", `run ${runId} does not exist`);
  }

  return {
    aggregate,
    rootPath: path.resolve(aggregate.run.targetPath),
  };
}

function resolvePathWithinTarget(rootPath: string, requestedPath?: string) {
  const candidate = resolvePathWithinRoot(rootPath, requestedPath);

  if (!candidate) {
    throw new AppError(400, "FILE_PATH_INVALID", "Requested path escapes the target path boundary");
  }

  return candidate;
}

function toRunFileEntry(record: RunFileRecord): RunFileEntry {
  return runFileEntrySchema.parse({
    path: record.path,
    name: record.name,
    kind: record.kind,
    sizeBytes: record.sizeBytes,
    updatedAt: record.updatedAt,
  });
}

export class RunFileAccessService {
  #dependencies: RunFileAccessDependencies;

  constructor(dependencies: RunFileAccessDependencies = defaultRunFileAccessDependencies) {
    this.#dependencies = dependencies;
  }

  #getRunRoot(runId: string) {
    return getRunRoot(this.#dependencies.runsRepository, runId);
  }

  #resolveIndexedRecord(runId: string, rootPath: string, requestedPath?: string) {
    const absolutePath = resolvePathWithinTarget(rootPath, requestedPath);
    const normalizedAbsolutePath = toPosixPath(path.resolve(absolutePath));

    return (
      this.#dependencies.runFileIndexService.get(runId, normalizedAbsolutePath) ??
      this.#dependencies.runFileIndexService.get(runId, ensureTrailingSlash(normalizedAbsolutePath))
    );
  }

  async #resolveRunFile(runId: string, requestedPath?: string) {
    const { aggregate, rootPath } = this.#getRunRoot(runId);
    const absolutePath = resolvePathWithinTarget(rootPath, requestedPath);
    const indexed = this.#resolveIndexedRecord(runId, rootPath, requestedPath) ?? null;

    try {
      const file = await buildRunFileEntry(absolutePath);
      const persisted = await this.#dependencies.runFileIndexService.upsertFromEntry(
        {
          runId,
          workspaceId: aggregate.run.workspaceId,
          targetPath: rootPath,
        },
        file
      );

      return {
        aggregate,
        rootPath,
        file,
        indexed: persisted,
        fromIndex: false,
      } satisfies ResolvedRunFile;
    } catch {
      if (!indexed) {
        throw new AppError(404, "FILE_NOT_FOUND", `鏂囦欢涓嶅瓨鍦? ${requestedPath ?? "/"}`);
      }

      return {
        aggregate,
        rootPath,
        file: toRunFileEntry(indexed),
        indexed,
        fromIndex: true,
      } satisfies ResolvedRunFile;
    }
  }

  async #readIndexedTextFile(record: RunFileRecord | null, requestedPath?: string) {
    if (!record?.objectKey) {
      throw new AppError(
        409,
        "FILE_BACKING_OBJECT_MISSING",
        `文件缺少可回源的对象存储副本: ${requestedPath ?? record?.path ?? "/"}`
      );
    }

    return readTextPreviewFromStream(
      await this.#dependencies.objectStore.createReadStream(record.objectKey)
    );
  }

  async #readTextualPreview(resolved: ResolvedRunFile, requestedPath?: string) {
    const mimeType = resolved.indexed.mimeType ?? guessRunFileMimeType(resolved.file.path);

    if (isOfficePreviewMimeType(mimeType)) {
      if (resolved.fromIndex) {
        if (!resolved.indexed.objectKey) {
          throw new AppError(
            409,
            "FILE_BACKING_OBJECT_MISSING",
            `文件缺少可回源的对象存储副本: ${requestedPath ?? resolved.file.path}`
          );
        }

        return extractOfficePreviewFromStream(
          await this.#dependencies.objectStore.createReadStream(resolved.indexed.objectKey),
          mimeType
        );
      }

      return extractOfficePreviewFromPath(path.resolve(resolved.file.path), mimeType);
    }

    return resolved.fromIndex
      ? this.#readIndexedTextFile(resolved.indexed, requestedPath)
      : readTextPreviewFromPath(path.resolve(resolved.file.path));
  }

  async #ensureResolvedRunFileAllowed(
    resolved: ResolvedRunFile,
    options: {
      operation: "preview" | "read" | "download" | "download-ticket";
    }
  ) {
    const upload =
      (resolved.indexed.uploadId
        ? this.#dependencies.uploadRepository.getUpload(resolved.indexed.uploadId)
        : null) ??
      this.#dependencies.uploadRepository.findUploadByAttachedPath(
        resolved.aggregate.run.runId,
        resolved.file.path
      );

    if (upload) {
      await this.#dependencies.runFileSecurityService.ensureUploadAllowed(upload);
      return;
    }

    const subject = {
      fileName: resolved.file.name,
      contentType: resolved.indexed.mimeType,
      absolutePath: path.resolve(resolved.file.path),
      objectKey: resolved.fromIndex ? resolved.indexed.objectKey : null,
    };
    const result =
      resolved.fromIndex && resolved.indexed.objectKey
        ? await this.#dependencies.runFileSecurityService.scanObjectKey(
            {
              fileName: resolved.file.name,
              contentType: resolved.indexed.mimeType,
              objectKey: resolved.indexed.objectKey,
            },
            {
              cacheKey:
                resolved.indexed.source === "user-upload"
                  ? `upload:${resolved.indexed.objectKey}`
                  : null,
            }
          )
        : await this.#dependencies.runFileSecurityService.scanAbsolutePath(
            {
              fileName: resolved.file.name,
              contentType: resolved.indexed.mimeType,
              absolutePath: path.resolve(resolved.file.path),
            },
            {
              cacheKey: `${resolved.file.path}:${resolved.file.updatedAt}:${resolved.file.sizeBytes ?? "na"}`,
            }
          );

    if (resolved.indexed.checksum && result.sha256 && resolved.indexed.checksum !== result.sha256) {
      if (
        resolved.fromIndex &&
        resolved.indexed.objectKey &&
        resolved.indexed.source !== "user-upload"
      ) {
        const updatedIndexedRecord = {
          ...resolved.indexed,
          checksum: result.sha256,
          indexedAt: new Date().toISOString(),
        };
        const nextRecords = this.#dependencies.runFileIndexService
          .list(resolved.aggregate.run.runId)
          .map((record) =>
            record.path === resolved.indexed.path ? updatedIndexedRecord : record
          );
        await this.#dependencies.runFileIndexService.replaceRecords(
          resolved.aggregate.run.runId,
          nextRecords
        );
        return;
      }

      throw new AppError(
        409,
        "RUN_FILE_INDEX_STALE",
        `Indexed file metadata for ${resolved.file.path} no longer matches the backing content.`,
        {
          path: resolved.file.path,
          expectedChecksum: resolved.indexed.checksum,
          actualChecksum: result.sha256,
          source: resolved.indexed.source,
          objectKey: resolved.indexed.objectKey,
        }
      );
    }

    this.#dependencies.runFileSecurityService.assertAccessAllowed(
      subject,
      result,
      options.operation
    );
  }

  async listRunFiles(runId: string) {
    const { aggregate, rootPath } = this.#getRunRoot(runId);

    try {
      await fs.access(rootPath);
    } catch {
      const indexedFiles = this.#dependencies.runFileIndexService
        .list(runId)
        .map((record) => toRunFileEntry(record));
      return indexedFiles.length > 0 ? indexedFiles : aggregate.files;
    }

    const files = await walkDirectory(rootPath);
    await this.#dependencies.runFileIndexService.replaceFromEntries(
      {
        runId,
        workspaceId: aggregate.run.workspaceId,
        targetPath: rootPath,
      },
      files
    );
    await this.#dependencies.runsRepository.update(runId, (current) => ({
      ...current,
      files,
    }));
    return files;
  }

  async statRunFile(runId: string, requestedPath?: string) {
    const resolved = await this.#resolveRunFile(runId, requestedPath);
    return resolved.file;
  }

  async ensureRunFileAllowed(
    runId: string,
    requestedPath?: string,
    options: { operation?: "preview" | "read" | "download" | "download-ticket" } = {}
  ) {
    const resolved = await this.#resolveRunFile(runId, requestedPath);
    if (resolved.file.path.endsWith("/")) {
      return resolved.file;
    }

    await this.#ensureResolvedRunFileAllowed(resolved, {
      operation: options.operation ?? "download",
    });
    return resolved.file;
  }

  async readRunFile(
    runId: string,
    requestedPath?: string,
    options: { requestedByUserId?: string | null } = {}
  ): Promise<RunFileReadResponse> {
    const resolved = await this.#resolveRunFile(runId, requestedPath);
    const { file } = resolved;

    if (file.path.endsWith("/")) {
      throw new AppError(400, "FILE_PATH_INVALID", "目录不可直接读取内容");
    }

    await this.#ensureResolvedRunFileAllowed(resolved, {
      operation: "read",
    });
    const preview = await this.#readTextualPreview(resolved, requestedPath);

    const previewBytes = Math.max(1, Buffer.byteLength(preview.content, "utf8"));
    const quotaUsage = buildRunQuotaUsageContext(resolved.aggregate.run, {
      metric: "download_bytes",
      delta: previewBytes,
      requestedByUserId: options.requestedByUserId ?? null,
      note: `Text file read requested for ${file.path}.`,
    });
    const consumedOverride = await this.#dependencies.quotaService.consumeApprovedUsageOverride(
      quotaUsage
    );
    let quotaPreview = consumedOverride
      ? null
      : this.#dependencies.quotaService.previewUsage(quotaUsage);

    if (quotaPreview?.decision === "block") {
      await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
        note: `Text file read blocked by quota policy for ${file.path}.`,
      });
      throw new AppError(
        409,
        "RUN_FILE_READ_QUOTA_BLOCKED",
        quotaPreview.summary?.en ?? "File read blocked by quota policy.",
        quotaPreview
      );
    }

    if (quotaPreview?.decision === "require_approval") {
      const feedback = await appendQuotaApprovalFeedback(
        {
          runId,
          prompt: this.#dependencies.quotaService.buildQuotaApprovalPrompt(quotaPreview),
          relatedResourceRef: quotaPreview.overrideId,
          messageText:
            `${quotaPreview.summary?.en ?? "Quota approval is required before reading this file."} ` +
            `Retry the read for ${file.name} after approval.`,
        },
        this.#dependencies.approvalFeedbackDependencies
      );
      await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
        approvalId: feedback.approval.approvalId,
        note: `Text file read is waiting for quota approval for ${file.path}.`,
      });
      if (feedback.approval.state === "approved") {
        await this.#dependencies.quotaService.applyRunApprovalDecision({
          approval: feedback.approval,
          approved: true,
          decidedByUserId:
            resolved.aggregate.run.approvalModeUpdatedByUserId ??
            resolved.aggregate.run.requestedByUserId ??
            null,
          note: feedback.approval.note,
        });
        await this.#dependencies.quotaService.consumeApprovedUsageOverride(quotaUsage);
        quotaPreview = null;
      } else {
        throw new AppError(
          409,
          "RUN_FILE_READ_QUOTA_APPROVAL_REQUIRED",
          quotaPreview.summary?.en ?? "Quota approval is required before reading this file.",
          {
            ...quotaPreview,
            approvalId: feedback.approval.approvalId,
          }
        );
      }
    }

    if (quotaPreview) {
      await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
        note: `Text file read served for ${file.path}.`,
      });
    }

    const { delta, ...billingBase } = quotaUsage;
    await this.#dependencies.billingService.recordUsage({
      ...billingBase,
      quantity: delta,
      source: "file-read",
      sourceRef: file.path,
      costBasis: "estimated",
      note: `Estimated billing usage recorded for file read ${file.path}.`,
    });

    return runFileReadResponseSchema.parse({
      file,
      content: preview.content,
      encoding: "utf8",
      truncated: preview.truncated,
    });
  }

  async previewRunFile(
    runId: string,
    requestedPath?: string,
    options: { requestedByUserId?: string | null } = {}
  ): Promise<RunFilePreviewResponse> {
    const resolved = await this.#resolveRunFile(runId, requestedPath);
    const { file, indexed } = resolved;

    if (file.path.endsWith("/")) {
      throw new AppError(400, "FILE_PATH_INVALID", "目录不可直接预览");
    }

    await this.#ensureResolvedRunFileAllowed(resolved, {
      operation: "preview",
    });

    if (indexed.previewMode === "text") {
      const preview = await this.#readTextualPreview(resolved, requestedPath);

      const previewBytes = Math.max(1, Buffer.byteLength(preview.content, "utf8"));
      const quotaUsage = buildRunQuotaUsageContext(resolved.aggregate.run, {
        metric: "download_bytes",
        delta: previewBytes,
        requestedByUserId: options.requestedByUserId ?? null,
        note: `File preview requested for ${file.path}.`,
      });
      const consumedOverride = await this.#dependencies.quotaService.consumeApprovedUsageOverride(
        quotaUsage
      );
      let quotaPreview = consumedOverride
        ? null
        : this.#dependencies.quotaService.previewUsage(quotaUsage);

      if (quotaPreview?.decision === "block") {
        await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
          note: `File preview blocked by quota policy for ${file.path}.`,
        });
        throw new AppError(
          409,
          "RUN_FILE_PREVIEW_QUOTA_BLOCKED",
          quotaPreview.summary?.en ?? "File preview blocked by quota policy.",
          quotaPreview
        );
      }

      if (quotaPreview?.decision === "require_approval") {
        const feedback = await appendQuotaApprovalFeedback(
          {
            runId,
            prompt: this.#dependencies.quotaService.buildQuotaApprovalPrompt(quotaPreview),
            relatedResourceRef: quotaPreview.overrideId,
            messageText:
              `${quotaPreview.summary?.en ?? "Quota approval is required before previewing this file."} ` +
              `Retry the preview for ${file.name} after approval.`,
          },
          this.#dependencies.approvalFeedbackDependencies
        );
        await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
          approvalId: feedback.approval.approvalId,
          note: `File preview is waiting for quota approval for ${file.path}.`,
        });
        if (feedback.approval.state === "approved") {
          await this.#dependencies.quotaService.applyRunApprovalDecision({
            approval: feedback.approval,
            approved: true,
            decidedByUserId:
              resolved.aggregate.run.approvalModeUpdatedByUserId ??
              resolved.aggregate.run.requestedByUserId ??
              null,
            note: feedback.approval.note,
          });
          await this.#dependencies.quotaService.consumeApprovedUsageOverride(quotaUsage);
          quotaPreview = null;
        } else {
          throw new AppError(
            409,
            "RUN_FILE_PREVIEW_QUOTA_APPROVAL_REQUIRED",
            quotaPreview.summary?.en ?? "Quota approval is required before previewing this file.",
            {
              ...quotaPreview,
              approvalId: feedback.approval.approvalId,
            }
          );
        }
      }

      if (quotaPreview) {
        await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
          note: `File preview served for ${file.path}.`,
        });
      }

      const { delta, ...billingBase } = quotaUsage;
      await this.#dependencies.billingService.recordUsage({
        ...billingBase,
        quantity: delta,
        source: "file-preview",
        sourceRef: file.path,
        costBasis: "estimated",
        note: `Estimated billing usage recorded for file preview ${file.path}.`,
      });

      return runFilePreviewResponseSchema.parse({
        file: indexed,
        mode: indexed.previewMode,
        mimeType: indexed.mimeType,
        content: preview.content,
        encoding: "utf8",
        truncated: preview.truncated,
        downloadUrl: null,
        downloadTicketId: null,
        downloadExpiresAt: null,
      });
    }

    return runFilePreviewResponseSchema.parse({
      file: indexed,
      mode: indexed.previewMode,
      mimeType: indexed.mimeType,
      content: null,
      encoding: null,
      truncated: false,
      downloadUrl: null,
      downloadTicketId: null,
      downloadExpiresAt: null,
    });
  }

  async createDownloadDescriptor(
    runId: string,
    requestedPath?: string,
    options: {
      requestedByUserId?: string | null;
      enforceQuota?: boolean;
      rangeHeader?: string;
    } = {}
  ) {
    const resolved = await this.#resolveRunFile(runId, requestedPath);
    const { file, indexed } = resolved;
    const byteRange = resolveByteRange(options.rangeHeader, file.sizeBytes);

    if (file.path.endsWith("/")) {
      throw new AppError(400, "FILE_PATH_INVALID", "目录不可下载");
    }

    await this.#ensureResolvedRunFileAllowed(resolved, {
      operation: "download",
    });

    if (options.enforceQuota) {
      const quotaUsage = buildRunQuotaUsageContext(resolved.aggregate.run, {
        metric: "download_bytes",
        delta: Math.max(1, file.sizeBytes ?? 0),
        requestedByUserId: options.requestedByUserId ?? null,
        note: `Direct file download requested for ${file.path}.`,
      });
      const consumedOverride = await this.#dependencies.quotaService.consumeApprovedUsageOverride(
        quotaUsage
      );
      let quotaPreview = consumedOverride
        ? null
        : this.#dependencies.quotaService.previewUsage(quotaUsage);

      if (quotaPreview?.decision === "block") {
        await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
          note: `Direct file download blocked by quota policy for ${file.path}.`,
        });
        throw new AppError(
          409,
          "RUN_FILE_DOWNLOAD_QUOTA_BLOCKED",
          quotaPreview.summary?.en ?? "File download blocked by quota policy.",
          quotaPreview
        );
      }

      if (quotaPreview?.decision === "require_approval") {
        const feedback = await appendQuotaApprovalFeedback(
          {
            runId,
            prompt: this.#dependencies.quotaService.buildQuotaApprovalPrompt(quotaPreview),
            relatedResourceRef: quotaPreview.overrideId,
            messageText:
              `${quotaPreview.summary?.en ?? "Quota approval is required before downloading this file."} ` +
              `Retry the download for ${file.name} after approval.`,
          },
          this.#dependencies.approvalFeedbackDependencies
        );
        await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
          approvalId: feedback.approval.approvalId,
          note: `Direct file download is waiting for quota approval for ${file.path}.`,
        });
        if (feedback.approval.state === "approved") {
          await this.#dependencies.quotaService.applyRunApprovalDecision({
            approval: feedback.approval,
            approved: true,
            decidedByUserId:
              resolved.aggregate.run.approvalModeUpdatedByUserId ??
              resolved.aggregate.run.requestedByUserId ??
              null,
            note: feedback.approval.note,
          });
          await this.#dependencies.quotaService.consumeApprovedUsageOverride(quotaUsage);
          quotaPreview = null;
        } else {
          throw new AppError(
            409,
            "RUN_FILE_DOWNLOAD_QUOTA_APPROVAL_REQUIRED",
            quotaPreview.summary?.en ?? "Quota approval is required before downloading this file.",
            {
              ...quotaPreview,
              approvalId: feedback.approval.approvalId,
            }
          );
        }
      }

      if (quotaPreview) {
        await this.#dependencies.quotaService.commitUsageDecision(quotaPreview, {
          note: `Direct file download served for ${file.path}.`,
        });
      }

      const { delta, ...billingBase } = quotaUsage;
      await this.#dependencies.billingService.recordUsage({
        ...billingBase,
        quantity: delta,
        source: "file-download",
        sourceRef: file.path,
        costBasis: "estimated",
        note: `Estimated billing usage recorded for direct file download ${file.path}.`,
      });
    }

    if (resolved.fromIndex) {
      if (!indexed?.objectKey) {
        throw new AppError(
          409,
          "FILE_BACKING_OBJECT_MISSING",
          `文件缺少可回源的对象存储副本: ${requestedPath ?? file.path}`
        );
      }

      return {
        file,
        absolutePath: path.resolve(file.path),
        mimeType: indexed.mimeType ?? guessRunFileMimeType(file.path),
        stream: await this.#dependencies.objectStore.createReadStream(
          indexed.objectKey,
          byteRange ?? undefined
        ),
        byteRange,
      };
    }

    return {
      file,
      absolutePath: path.resolve(file.path),
      mimeType: indexed.mimeType ?? guessRunFileMimeType(file.path),
      stream: createReadStream(
        path.resolve(file.path),
        byteRange ? { start: byteRange.start, end: byteRange.end } : undefined
      ),
      byteRange,
    };
  }
}

export const runFileAccessService = new RunFileAccessService();
