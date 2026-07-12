import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createRunDownloadTicketInputSchema,
  createRunDownloadTicketResponseSchema,
  createRunUploadInputSchema,
  createRunUploadResponseSchema,
  finalizeRunUploadInputSchema,
  finalizeRunUploadResponseSchema,
  runFileEntrySchema,
  runDownloadTicketSchema,
  runUploadRecordSchema,
  type CreateRunDownloadTicketInput,
  type CreateRunUploadInput,
  type FinalizeRunUploadInput,
  type RunFileEntry,
  type RunConversationAttachment,
  type RunUploadRecord,
} from "@lingban/contracts";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { AppError } from "../../app/errors.js";
import { billingService } from "../billing/service.js";
import { quotaService } from "../quotas/service.js";
import { appendQuotaApprovalFeedback } from "../runs/approval-feedback.js";
import { runsRepository } from "../runs/repository.js";
import { runFileIndexService } from "../runs/file-index.js";
import { buildRunQuotaUsageContext } from "../runs/quota-usage.js";
import { objectStore } from "./object-store.js";
import { uploadRepository } from "./repository.js";
import { runFileAccessService } from "../runs/file-access.js";
import { runFileSecurityService } from "./file-security.js";

let uploadSequence = 1;
let downloadTicketSequence = 1;
let bootstrapped = false;

function nowIso() {
  return new Date().toISOString();
}

function parseCounter(value: string | undefined, prefix: string) {
  if (!value?.startsWith(prefix)) {
    return 0;
  }

  const suffix = value.slice(prefix.length);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureBootstrapped() {
  if (bootstrapped) {
    return;
  }

  let maxUpload = 0;
  let maxTicket = 0;

  for (const snapshot of runsRepository.list()) {
    for (const upload of uploadRepository.listUploadsByRun(snapshot.run.runId)) {
      maxUpload = Math.max(maxUpload, parseCounter(upload.uploadId, "upl_"));
    }
  }

  for (const ticket of uploadRepository.listDownloadTickets()) {
    maxTicket = Math.max(maxTicket, parseCounter(ticket.ticketId, "dlt_"));
  }

  uploadSequence = Math.max(uploadSequence, maxUpload + 1);
  downloadTicketSequence = Math.max(downloadTicketSequence, maxTicket + 1);
  bootstrapped = true;
}

function nextUploadId() {
  ensureBootstrapped();
  return `upl_${String(uploadSequence++).padStart(8, "0")}`;
}

function nextDownloadTicketId() {
  ensureBootstrapped();
  return `dlt_${String(downloadTicketSequence++).padStart(8, "0")}`;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_").replace(/\s+/g, " ").trim() || "upload.bin";
}

function normalizeAbsolutePath(value: string) {
  return path.resolve(value).replace(/\\/g, "/");
}

function upsertRunFileEntry(
  items: ReturnType<typeof getRunAggregate>["files"],
  nextEntry: ReturnType<typeof runFileEntrySchema.parse>
) {
  const index = items.findIndex((item) => item.path === nextEntry.path);
  if (index === -1) {
    return [...items, nextEntry].sort((left, right) => left.path.localeCompare(right.path));
  }

  return items.map((item, itemIndex) => (itemIndex === index ? nextEntry : item));
}

function getRunAggregate(runId: string) {
  const aggregate = runsRepository.get(runId);
  if (!aggregate) {
    throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
  }

  return aggregate;
}

function guessMimeType(fileName: string, contentType?: string | null) {
  if (contentType?.trim()) {
    return contentType.trim();
  }

  const normalized = fileName.toLowerCase();
  if (normalized.endsWith(".json")) return "application/json; charset=utf-8";
  if (normalized.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (normalized.endsWith(".html")) return "text/html; charset=utf-8";
  if (normalized.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(normalized)) return "application/octet-stream";
  return "application/octet-stream";
}

function expiresAt(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function remainingTicketTtlSeconds(ticketExpiresAt: string) {
  const remainingMs = new Date(ticketExpiresAt).getTime() - Date.now();
  return Math.max(1, Math.floor(remainingMs / 1000));
}

export async function initializeUploadInfrastructure() {
  await uploadRepository.init();
  ensureBootstrapped();
}

export class RunUploadService {
  listUploads(runId: string) {
    return uploadRepository.listUploadsByRun(runId);
  }

  async createUpload(runId: string, input: CreateRunUploadInput) {
    const aggregate = getRunAggregate(runId);
    const parsed = createRunUploadInputSchema.parse(input);
    const createdAt = nowIso();
    const upload = runUploadRecordSchema.parse({
      uploadId: nextUploadId(),
      runId,
      workspaceId: aggregate.run.workspaceId,
      fileName: sanitizeFileName(parsed.fileName),
      contentType: parsed.contentType ?? null,
      declaredSizeBytes: parsed.sizeBytes ?? null,
      storedSizeBytes: null,
      sha256: null,
      objectKey: `runs/${runId}/uploads/${randomUUID()}/${sanitizeFileName(parsed.fileName)}`,
      status: "created",
      attachedPath: null,
      attachedLabel: null,
      createdAt,
      updatedAt: createdAt,
    });

    await uploadRepository.createUpload(upload);

    return createRunUploadResponseSchema.parse({
      upload,
      uploadUrl: `/v1/runs/${encodeURIComponent(runId)}/uploads/${encodeURIComponent(upload.uploadId)}/content`,
      method: "PUT",
      maxBytes: getApiRuntimeConfig().uploadMaxBytes,
      contentType: "application/octet-stream",
    });
  }

  async putUploadContent(
    runId: string,
    uploadId: string,
    content: Buffer,
    options: { requestedByUserId?: string | null } = {}
  ) {
    const upload = uploadRepository.getUpload(uploadId);
    if (!upload || upload.runId !== runId) {
      throw new AppError(404, "UPLOAD_NOT_FOUND", `Upload not found: ${uploadId}`);
    }

    if (content.byteLength > getApiRuntimeConfig().uploadMaxBytes) {
      throw new AppError(413, "UPLOAD_TOO_LARGE", `Upload exceeds max bytes: ${content.byteLength}`);
    }

    const aggregate = getRunAggregate(runId);
    const quotaUsage = buildRunQuotaUsageContext(aggregate.run, {
      metric: "storage_bytes",
      delta: content.byteLength,
      requestedByUserId: options.requestedByUserId ?? null,
      note: `Upload content write requested for ${upload.fileName}.`,
    });
    const consumedOverride = await quotaService.consumeApprovedUsageOverride(quotaUsage);
    const quotaPreview = consumedOverride ? null : quotaService.previewUsage(quotaUsage);

    if (quotaPreview?.decision === "block") {
      await quotaService.commitUsageDecision(quotaPreview, {
        note: `Upload blocked by quota policy for ${upload.fileName}.`,
      });
      throw new AppError(
        409,
        "RUN_UPLOAD_QUOTA_BLOCKED",
        quotaPreview.summary?.en ?? "Upload blocked by quota policy.",
        quotaPreview
      );
    }

    if (quotaPreview?.decision === "require_approval") {
      const feedback = await appendQuotaApprovalFeedback({
        runId,
        prompt: quotaService.buildQuotaApprovalPrompt(quotaPreview),
        relatedResourceRef: quotaPreview.overrideId,
        messageText:
          `${quotaPreview.summary?.en ?? "Quota approval is required before uploading this file."} ` +
          `Retry the upload for ${upload.fileName} after approval.`,
      });
      await quotaService.commitUsageDecision(quotaPreview, {
        approvalId: feedback.approval.approvalId,
        note: `Upload is waiting for quota approval for ${upload.fileName}.`,
      });
      throw new AppError(
        409,
        "RUN_UPLOAD_QUOTA_APPROVAL_REQUIRED",
        quotaPreview.summary?.en ?? "Quota approval is required before uploading this file.",
        {
          ...quotaPreview,
          approvalId: feedback.approval.approvalId,
        }
      );
    }

    const scanResult = await runFileSecurityService.scanUploadBuffer(upload, content);
    if (runFileSecurityService.isBlockingResult(scanResult)) {
      const blockedUpload = runUploadRecordSchema.parse({
        ...upload,
        status: "blocked",
        storedSizeBytes: scanResult.sizeBytes,
        sha256: scanResult.sha256,
        scanStatus: scanResult.status,
        scanEngine: scanResult.engine,
        scanReasonCode: scanResult.reasonCode,
        scanDetail: scanResult.detail,
        scanSignature: scanResult.signature,
        scannedAt: scanResult.scannedAt,
        updatedAt: nowIso(),
      });

      await uploadRepository.updateUpload(blockedUpload);
      runFileSecurityService.assertAccessAllowed(
        {
          fileName: upload.fileName,
          contentType: upload.contentType,
          objectKey: upload.objectKey,
        },
        scanResult,
        "upload"
      );
    }

    const stored = await objectStore.putBuffer(upload.objectKey, {
      content,
      contentType: upload.contentType,
    });
    const next = runUploadRecordSchema.parse({
      ...upload,
      storedSizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      status: "uploaded",
      scanStatus: scanResult.status,
      scanEngine: scanResult.engine,
      scanReasonCode: scanResult.reasonCode,
      scanDetail: scanResult.detail,
      scanSignature: scanResult.signature,
      scannedAt: scanResult.scannedAt,
      updatedAt: nowIso(),
    });

    await uploadRepository.updateUpload(next);

    if (quotaPreview) {
      await quotaService.commitUsageDecision(quotaPreview, {
        note: `Upload stored for ${upload.fileName}: ${stored.sizeBytes} bytes.`,
      });
    }

    const { delta, ...billingBase } = quotaUsage;
    await billingService.recordUsage({
      ...billingBase,
      quantity: delta,
      source: "run-upload",
      sourceRef: upload.uploadId,
      costBasis: "estimated",
      note: `Estimated billing usage recorded for upload ${upload.uploadId}.`,
    });

    return next;
  }

  async finalizeUpload(runId: string, uploadId: string, input: FinalizeRunUploadInput) {
    const parsed = finalizeRunUploadInputSchema.parse(input);
    const currentUpload = uploadRepository.getUpload(uploadId);

    if (!currentUpload || currentUpload.runId !== runId) {
      throw new AppError(404, "UPLOAD_NOT_FOUND", `Upload not found: ${uploadId}`);
    }

    if (currentUpload.status !== "uploaded" && currentUpload.status !== "attached") {
      throw new AppError(409, "UPLOAD_NOT_READY", `Upload is not ready to attach: ${uploadId}`);
    }

    const upload = await runFileSecurityService.ensureUploadAllowed(currentUpload);
    const aggregate = getRunAggregate(runId);
    const relativePath = path.posix.join("uploads", upload.uploadId, sanitizeFileName(upload.fileName));
    const absolutePath = path.resolve(aggregate.run.targetPath, relativePath);
    await objectStore.copyObjectToPath(upload.objectKey, absolutePath);

    const attachment = {
      path: absolutePath.replace(/\\/g, "/"),
      label: parsed.label?.trim() || upload.fileName,
      slotKey: null,
    } satisfies RunConversationAttachment;

    const next = runUploadRecordSchema.parse({
      ...upload,
      status: "attached",
      attachedPath: attachment.path,
      attachedLabel: attachment.label,
      updatedAt: nowIso(),
    });

    await uploadRepository.updateUpload(next);
    const stats = await fs.stat(absolutePath);
    const fileEntry = runFileEntrySchema.parse({
      path: attachment.path,
      name: path.basename(absolutePath),
      kind: "input",
      sizeBytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
    await runFileIndexService.upsertFromEntry(
      {
        runId,
        workspaceId: aggregate.run.workspaceId,
        targetPath: aggregate.run.targetPath,
      },
      fileEntry
    );
    await runsRepository.update(runId, (current) => ({
      ...current,
      files: upsertRunFileEntry(current.files, fileEntry),
    }));

    return finalizeRunUploadResponseSchema.parse({
      upload: next,
      attachment,
    });
  }

  resolveAttachedUpload(runId: string, requestedPath: string) {
    const aggregate = getRunAggregate(runId);
    const rootPath = path.resolve(aggregate.run.targetPath);
    const raw = requestedPath.trim();
    const candidate = path.resolve(path.isAbsolute(raw) ? raw : path.join(rootPath, raw));
    const relative = path.relative(rootPath, candidate);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError(400, "FILE_PATH_INVALID", "请求路径超出 target path 边界");
    }

    const normalizedPath = normalizeAbsolutePath(candidate);
    return uploadRepository.findUploadByAttachedPath(runId, normalizedPath);
  }

  async createDownloadTicket(
    runId: string,
    input: CreateRunDownloadTicketInput,
    createdByUserId?: string | null,
    options: {
      purpose?: "download" | "preview";
    } = {}
  ) {
    const aggregate = getRunAggregate(runId);
    const parsed = createRunDownloadTicketInputSchema.parse(input);
    const purpose = options.purpose ?? "download";
    const isPreviewPurpose = purpose === "preview";
    let file: RunFileEntry | null = null;
    let attachedUpload: RunUploadRecord | null = null;
    let usedAttachedFallback = false;

    try {
      file = await runFileAccessService.statRunFile(runId, parsed.path);
    } catch (error) {
      attachedUpload = this.resolveAttachedUpload(runId, parsed.path);
      if (!attachedUpload?.attachedPath) {
        throw error;
      }

      attachedUpload = await runFileSecurityService.ensureUploadAllowed(attachedUpload);
      const attachedPath = attachedUpload.attachedPath;
      if (!attachedPath) {
        throw error;
      }
      usedAttachedFallback = true;
      file = {
        path: attachedPath,
        name: path.basename(attachedPath),
        kind: "input" as const,
        sizeBytes: attachedUpload.storedSizeBytes,
        updatedAt: attachedUpload.updatedAt,
      };
    }

    if (!file) {
      throw new AppError(500, "DOWNLOAD_TICKET_FILE_MISSING", "Download ticket file could not be resolved");
    }

    if (file.path.endsWith("/")) {
      throw new AppError(400, "FILE_PATH_INVALID", "Directory cannot be downloaded");
    }

    if (!usedAttachedFallback) {
      await runFileAccessService.ensureRunFileAllowed(runId, parsed.path, {
        operation: isPreviewPurpose ? "preview" : "download-ticket",
      });
    }

    const quotaUsage = buildRunQuotaUsageContext(aggregate.run, {
      metric: "download_bytes",
      delta: Math.max(1, file.sizeBytes ?? 0),
      requestedByUserId: createdByUserId ?? null,
      note: isPreviewPurpose
        ? `Preview access ticket requested for ${file.path}.`
        : `Download ticket requested for ${file.path}.`,
    });
    const consumedOverride = await quotaService.consumeApprovedUsageOverride(quotaUsage);
    const quotaPreview = consumedOverride ? null : quotaService.previewUsage(quotaUsage);

    if (quotaPreview?.decision === "block") {
      await quotaService.commitUsageDecision(quotaPreview, {
        note: isPreviewPurpose
          ? `Preview access ticket blocked by quota policy for ${file.path}.`
          : `Download ticket blocked by quota policy for ${file.path}.`,
      });
      throw new AppError(
        409,
        isPreviewPurpose ? "RUN_FILE_PREVIEW_QUOTA_BLOCKED" : "RUN_DOWNLOAD_QUOTA_BLOCKED",
        quotaPreview.summary?.en ??
          (isPreviewPurpose
            ? "File preview blocked by quota policy."
            : "Download blocked by quota policy."),
        quotaPreview
      );
    }

    if (quotaPreview?.decision === "require_approval") {
      const feedback = await appendQuotaApprovalFeedback({
        runId,
        prompt: quotaService.buildQuotaApprovalPrompt(quotaPreview),
        relatedResourceRef: quotaPreview.overrideId,
        messageText:
          isPreviewPurpose
            ? `${quotaPreview.summary?.en ?? "Quota approval is required before previewing this file."} ` +
              `Retry the preview for ${file.name} after approval.`
            : `${quotaPreview.summary?.en ?? "Quota approval is required before downloading this file."} ` +
              `Retry the download for ${file.name} after approval.`,
      });
      await quotaService.commitUsageDecision(quotaPreview, {
        approvalId: feedback.approval.approvalId,
        note: isPreviewPurpose
          ? `Preview access ticket is waiting for quota approval for ${file.path}.`
          : `Download ticket is waiting for quota approval for ${file.path}.`,
      });
      throw new AppError(
        409,
        isPreviewPurpose
          ? "RUN_FILE_PREVIEW_QUOTA_APPROVAL_REQUIRED"
          : "RUN_DOWNLOAD_QUOTA_APPROVAL_REQUIRED",
        quotaPreview.summary?.en ??
          (isPreviewPurpose
            ? "Quota approval is required before previewing this file."
            : "Quota approval is required before downloading this file."),
        {
          ...quotaPreview,
          approvalId: feedback.approval.approvalId,
        }
      );
    }

    const indexedFile = runFileIndexService.get(runId, file.path);
    const attachedUploadRecord =
      attachedUpload ?? uploadRepository.findUploadByAttachedPath(runId, file.path);
    const objectBackedFile =
      indexedFile?.objectKey && indexedFile.source !== "user-upload" ? indexedFile : null;

    const ticket = runDownloadTicketSchema.parse({
      ticketId: nextDownloadTicketId(),
      runId,
      workspaceId: aggregate.run.workspaceId,
      path: file.path,
      fileName: file.name,
      mimeType: indexedFile?.mimeType ?? guessMimeType(file.name, attachedUploadRecord?.contentType),
      sourceKind: attachedUploadRecord
        ? "uploaded-object"
        : objectBackedFile
          ? "object-store"
          : "run-target-path",
      objectKey: attachedUploadRecord?.objectKey ?? objectBackedFile?.objectKey ?? null,
      uploadId: attachedUploadRecord?.uploadId ?? objectBackedFile?.uploadId ?? null,
      checksum: attachedUploadRecord?.sha256 ?? objectBackedFile?.checksum ?? null,
      expiresAt: expiresAt(getApiRuntimeConfig().downloadTicketTtlSeconds),
      createdAt: nowIso(),
      createdByUserId: createdByUserId ?? null,
    });

    await uploadRepository.createDownloadTicket(ticket);

    if (quotaPreview) {
      await quotaService.commitUsageDecision(quotaPreview, {
        note: isPreviewPurpose
          ? `Preview access ticket created for ${file.path}.`
          : `Download ticket created for ${file.path}.`,
      });
    }

    const { delta, ...billingBase } = quotaUsage;
    await billingService.recordUsage({
      ...billingBase,
      quantity: delta,
      source: isPreviewPurpose ? "file-preview" : "download-ticket",
      sourceRef: isPreviewPurpose ? file.path : ticket.ticketId,
      costBasis: "estimated",
      note: isPreviewPurpose
        ? `Estimated billing usage recorded for preview access ${file.path}.`
        : `Estimated billing usage recorded for download ticket ${ticket.ticketId}.`,
    });

    return createRunDownloadTicketResponseSchema.parse({
      ticket,
      downloadUrl: `/v1/downloads/${encodeURIComponent(ticket.ticketId)}`,
    });
  }

  async resolveDownloadTicket(ticketId: string) {
    const ticket = uploadRepository.getDownloadTicket(ticketId);
    if (!ticket) {
      throw new AppError(404, "DOWNLOAD_TICKET_NOT_FOUND", `Download ticket not found: ${ticketId}`);
    }

    if (new Date(ticket.expiresAt).getTime() <= Date.now()) {
      throw new AppError(410, "DOWNLOAD_TICKET_EXPIRED", `Download ticket expired: ${ticketId}`);
    }

    if (ticket.sourceKind !== "run-target-path" && ticket.objectKey) {
      await runFileSecurityService.assertObjectTicketAllowed(ticket);
      const redirectUrl = await objectStore.createDownloadUrl?.({
        objectKey: ticket.objectKey,
        fileName: ticket.fileName,
        contentType: ticket.mimeType,
        expiresInSeconds: remainingTicketTtlSeconds(ticket.expiresAt),
      });

      if (redirectUrl) {
        return {
          ticket,
          redirectUrl,
        };
      }

      return {
        ticket,
        descriptor: {
          file: {
            path: ticket.path,
            name: ticket.fileName,
            kind: "input" as const,
            sizeBytes: null,
            updatedAt: ticket.createdAt,
          },
          mimeType: ticket.mimeType,
          stream: await objectStore.createReadStream(ticket.objectKey),
        },
      };
    }

    const descriptor = await runFileAccessService.createDownloadDescriptor(ticket.runId, ticket.path);
    return {
      ticket,
      descriptor,
    };
  }
}

export const runUploadService = new RunUploadService();
