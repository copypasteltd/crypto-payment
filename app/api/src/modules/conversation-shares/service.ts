import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import {
  conversationShareAccessRecordSchema,
  conversationShareFileSchema,
  conversationShareMessageSchema,
  conversationSharePublicViewSchema,
  conversationShareSummarySchema,
  conversationShareViewSchema,
  createConversationShareInputSchema,
  type ConversationShareSummary,
  type ConversationShareView,
  type CreateConversationShareInput,
  type RunConversationMessage,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { authService } from "../auth/service.js";
import { runFileAccessService } from "../runs/file-access.js";
import { runsService } from "../runs/service.js";
import { sessionCaptureService } from "../session-captures/service.js";
import { objectStore } from "../uploads/object-store.js";
import {
  extractConversationShareContent,
  type ConversationFileReference,
} from "./content.js";
import {
  conversationSharesRepository,
  initializeConversationSharesRepository,
  storedConversationShareSchema,
  type StoredConversationShare,
  type StoredConversationShareFile,
} from "./repository.js";

type ConversationShareActor = {
  userId: string;
  workspaceIds: string[];
} | null;

type ConversationShareAccessContext = {
  actor: ConversationShareActor;
  clientFingerprint: string | null;
};

const shareGrantSecret =
  process.env.LINGBAN_CONVERSATION_SHARE_GRANT_SECRET?.trim() ||
  randomBytes(32).toString("hex");
const shareGrantTtlMs = 10 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function deriveSummaryStatus(summary: ConversationShareSummary): ConversationShareSummary {
  const status = summary.revokedAt
    ? "revoked"
    : summary.expiresAt && Date.parse(summary.expiresAt) <= Date.now()
      ? "expired"
      : "active";
  return conversationShareSummarySchema.parse({ ...summary, status });
}

function toView(record: StoredConversationShare): ConversationShareView {
  return conversationShareViewSchema.parse({
    share: deriveSummaryStatus(record.summary),
    messages: record.messages,
    files: record.files.map((item) => item.file),
  });
}

function safeObjectFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 160) || "attachment.bin";
}

function selectCapturedMessages(
  messages: RunConversationMessage[],
  input: { throughTurnId: string | null; capturedAt: string | null; messageCount: number }
) {
  if (input.throughTurnId) {
    let boundaryIndex = -1;
    messages.forEach((message, index) => {
      if (message.turnId === input.throughTurnId) boundaryIndex = index;
    });
    if (boundaryIndex >= 0) return messages.slice(0, boundaryIndex + 1);
  }

  if (input.capturedAt) {
    const capturedAt = Date.parse(input.capturedAt);
    const throughCapture = messages.filter(
      (message) => Date.parse(message.createdAt) <= capturedAt
    );
    if (throughCapture.length > 0) return throughCapture;
  }

  return input.messageCount > 0 ? messages.slice(0, input.messageCount) : [];
}

function validateExpiry(expiresAt: string | null) {
  if (!expiresAt) return;
  const value = Date.parse(expiresAt);
  if (!Number.isFinite(value) || value <= Date.now()) {
    throw new AppError(400, "CONVERSATION_SHARE_EXPIRY_INVALID", "分享有效期必须晚于当前时间");
  }
  if (value > Date.now() + 366 * 24 * 60 * 60 * 1000) {
    throw new AppError(400, "CONVERSATION_SHARE_EXPIRY_TOO_LONG", "分享有效期不能超过 366 天");
  }
}

function buildActorWorkspaceIds(actor: ConversationShareActor) {
  return new Set(actor?.workspaceIds ?? []);
}

export class ConversationSharesService {
  async create(
    runId: string,
    input: CreateConversationShareInput,
    actorUserId: string | null
  ) {
    const parsed = createConversationShareInputSchema.parse(input);
    validateExpiry(parsed.expiresAt);
    const snapshot = runsService.getRun(runId);
    const existing = (await conversationSharesRepository.listByRunId(runId)).find(
      (item) =>
        item.summary.workspaceId === snapshot.run.workspaceId &&
        item.idempotencyKey === parsed.idempotencyKey
    );
    if (existing) return { share: toView(existing).share, view: toView(existing) };

    if (parsed.accessScope === "invited_users" && actorUserId) {
      const activeUserIds = new Set(
        authService
          .listWorkspaceMembers(actorUserId, snapshot.run.workspaceId)
          .filter((item) => item.membership.status === "active")
          .map((item) => item.user.userId)
      );
      const invalidUserId = parsed.invitedUserIds.find((userId) => !activeUserIds.has(userId));
      if (invalidUserId) {
        throw new AppError(
          400,
          "CONVERSATION_SHARE_INVITEE_INVALID",
          `指定用户不属于当前工作区: ${invalidUserId}`
        );
      }
    }

    let sourceMessages = snapshot.messages;
    let boundaryTurnId = snapshot.agentThread?.currentTurnId ?? null;
    if (parsed.sourceType === "session_capture") {
      const capture = await sessionCaptureService.get(parsed.captureId!);
      if (capture.runId !== runId || capture.workspaceId !== snapshot.run.workspaceId) {
        throw new AppError(
          409,
          "CONVERSATION_SHARE_CAPTURE_MISMATCH",
          "固化记录与当前会话不匹配"
        );
      }
      if (capture.status !== "CAPTURED" || capture.securityState !== "clean") {
        throw new AppError(
          409,
          "CONVERSATION_SHARE_CAPTURE_UNAVAILABLE",
          `固化记录当前不可分享: ${capture.status}/${capture.securityState}`
        );
      }
      boundaryTurnId = capture.boundary?.throughTurnId ?? capture.requestedThroughTurnId;
      sourceMessages = selectCapturedMessages(snapshot.messages, {
        throughTurnId: boundaryTurnId,
        capturedAt: capture.capturedAt,
        messageCount: capture.messageCount,
      });
    }

    if (!parsed.includeSystemMessages) {
      sourceMessages = sourceMessages.filter((message) => message.role !== "system");
    }
    if (sourceMessages.length === 0) {
      throw new AppError(409, "CONVERSATION_SHARE_EMPTY", "当前边界内没有可分享的会话消息");
    }

    const extractedMessages = sourceMessages.map((message) => ({
      source: message,
      content: extractConversationShareContent(
        message.text,
        message.attachments,
        snapshot.run.targetPath
      ),
    }));
    const referenceByPath = new Map<string, ConversationFileReference>();
    if (parsed.includeAttachments) {
      for (const message of extractedMessages) {
        for (const reference of message.content.references) {
          if (!referenceByPath.has(reference.sourcePath)) {
            referenceByPath.set(reference.sourcePath, reference);
          }
        }
      }
    }

    const shareId = `csh_${randomUUID()}`;
    const fileIdByPath = new Map<string, string>();
    const storedFiles: StoredConversationShareFile[] = [];
    for (const reference of referenceByPath.values()) {
      const fileId = `csf_${randomUUID()}`;
      fileIdByPath.set(reference.sourcePath, fileId);
      storedFiles.push(await this.#materializeFile(shareId, fileId, runId, reference));
    }

    const messages = extractedMessages.map(({ source, content }) =>
      conversationShareMessageSchema.parse({
        messageId: source.messageId,
        role: source.role,
        kind: source.kind,
        text: content.text,
        fileIds: parsed.includeAttachments
          ? content.references
              .map((reference) => fileIdByPath.get(reference.sourcePath))
              .filter((fileId): fileId is string => Boolean(fileId))
          : [],
        createdAt: source.createdAt,
      })
    );
    const at = nowIso();
    const summary = conversationShareSummarySchema.parse({
      shareId,
      runId,
      workspaceId: snapshot.run.workspaceId,
      sourceType: parsed.sourceType,
      captureId: parsed.captureId,
      title: parsed.title,
      accessScope: parsed.accessScope,
      invitedUserIds: [...new Set(parsed.invitedUserIds)],
      status: "active",
      includeSystemMessages: parsed.includeSystemMessages,
      includeAttachments: parsed.includeAttachments,
      boundaryMessageId: sourceMessages.at(-1)?.messageId ?? null,
      boundaryTurnId,
      messageCount: messages.length,
      fileCount: storedFiles.filter((item) => item.file.available).length,
      createdByUserId: actorUserId,
      publicPath: `/pages/shares/conversation?id=${encodeURIComponent(shareId)}`,
      createdAt: at,
      expiresAt: parsed.expiresAt,
      revokedAt: null,
    });
    const created = await conversationSharesRepository.create(
      storedConversationShareSchema.parse({
        summary,
        messages,
        files: storedFiles,
        idempotencyKey: parsed.idempotencyKey,
      })
    );
    const view = toView(created);
    return { share: view.share, view };
  }

  async #materializeFile(
    shareId: string,
    fileId: string,
    runId: string,
    reference: ConversationFileReference
  ): Promise<StoredConversationShareFile> {
    const contentPath = `/v1/conversation-shares/public/${encodeURIComponent(
      shareId
    )}/files/${encodeURIComponent(fileId)}`;
    try {
      const descriptor = await runFileAccessService.createDownloadDescriptor(
        runId,
        reference.sourcePath,
        { enforceQuota: false }
      );
      const stagingRoot = resolveApiStorageDir("conversation-share-staging");
      await fs.mkdir(stagingRoot, { recursive: true });
      const stageDirectory = await fs.mkdtemp(path.join(stagingRoot, "share-"));
      const stagedPath = path.join(stageDirectory, "payload");
      try {
        await pipeline(descriptor.stream, createWriteStream(stagedPath));
        const objectKey = `conversation-shares/${shareId}/files/${fileId}/${safeObjectFileName(
          descriptor.file.name
        )}`;
        const stored = await objectStore.putPath(objectKey, {
          absolutePath: stagedPath,
          contentType: descriptor.mimeType,
        });
        return {
          file: conversationShareFileSchema.parse({
            fileId,
            label: reference.label,
            kind: reference.kind,
            mimeType: descriptor.mimeType,
            sizeBytes: stored.sizeBytes,
            available: true,
            contentPath,
          }),
          objectKey,
        };
      } finally {
        await fs.rm(stageDirectory, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(
        `[lingban-conversation-share] attachment unavailable ${runId}/${reference.sourcePath}:`,
        error
      );
      return {
        file: conversationShareFileSchema.parse({
          fileId,
          label: reference.label,
          kind: reference.kind,
          mimeType: null,
          sizeBytes: null,
          available: false,
          contentPath: null,
        }),
        objectKey: null,
      };
    }
  }

  async listForRun(runId: string) {
    runsService.getRun(runId);
    const records = await conversationSharesRepository.listByRunId(runId);
    return { items: records.map((record) => deriveSummaryStatus(record.summary)) };
  }

  async get(shareId: string) {
    const record = await conversationSharesRepository.get(shareId);
    if (!record) {
      throw new AppError(404, "CONVERSATION_SHARE_NOT_FOUND", `分享记录不存在: ${shareId}`);
    }
    return record;
  }

  async getOwnerView(shareId: string) {
    return toView(await this.get(shareId));
  }

  async getSharedView(shareId: string, context: ConversationShareAccessContext) {
    const record = await this.get(shareId);
    this.#assertReadable(record, context.actor);
    await this.#recordAccess(record, context, "view", null);
    const view = toView(record);
    return conversationSharePublicViewSchema.parse({
      share: view.share,
      messages: view.messages,
      files: view.files.map((file) => ({
        ...file,
        contentPath: file.contentPath && view.share.accessScope !== "public_link"
          ? `${file.contentPath}?grant=${encodeURIComponent(
              this.#createFileGrant(view.share.shareId, file.fileId)
            )}`
          : file.contentPath,
      })),
    });
  }

  async openSharedFile(
    shareId: string,
    fileId: string,
    context: ConversationShareAccessContext,
    byteRange?: { start: number; end: number },
    grant?: string | null
  ) {
    const record = await this.get(shareId);
    const grantAuthorized = grant ? this.#verifyFileGrant(grant, shareId, fileId) : false;
    this.#assertReadable(record, context.actor, grantAuthorized);
    const storedFile = record.files.find((item) => item.file.fileId === fileId);
    if (!storedFile?.file.available || !storedFile.objectKey) {
      throw new AppError(404, "CONVERSATION_SHARE_FILE_NOT_FOUND", `分享附件不存在: ${fileId}`);
    }
    await this.#recordAccess(record, context, "file", fileId);
    return {
      file: storedFile.file,
      stream: await objectStore.createReadStream(storedFile.objectKey, byteRange),
    };
  }

  #assertReadable(
    record: StoredConversationShare,
    actor: ConversationShareActor,
    grantAuthorized = false
  ) {
    const summary = deriveSummaryStatus(record.summary);
    if (summary.status === "revoked") {
      throw new AppError(410, "CONVERSATION_SHARE_REVOKED", "该分享已被撤销");
    }
    if (summary.status === "expired") {
      throw new AppError(410, "CONVERSATION_SHARE_EXPIRED", "该分享已过期");
    }
    if (summary.accessScope === "public_link") return;
    if (grantAuthorized) return;
    if (!actor) {
      throw new AppError(401, "CONVERSATION_SHARE_AUTH_REQUIRED", "登录后才能查看该分享");
    }
    if (summary.createdByUserId === actor.userId) return;
    if (summary.accessScope === "workspace") {
      if (buildActorWorkspaceIds(actor).has(summary.workspaceId)) return;
      throw new AppError(403, "CONVERSATION_SHARE_WORKSPACE_FORBIDDEN", "当前账号无权查看该分享");
    }
    if (summary.invitedUserIds.includes(actor.userId)) return;
    throw new AppError(403, "CONVERSATION_SHARE_INVITEE_FORBIDDEN", "当前账号不在分享名单中");
  }

  #createFileGrant(shareId: string, fileId: string) {
    const payload = Buffer.from(
      JSON.stringify({ shareId, fileId, expiresAt: Date.now() + shareGrantTtlMs }),
      "utf8"
    ).toString("base64url");
    const signature = createHmac("sha256", shareGrantSecret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  #verifyFileGrant(grant: string, shareId: string, fileId: string) {
    const [payload, signature] = grant.split(".");
    if (!payload || !signature) return false;
    const expected = createHmac("sha256", shareGrantSecret).update(payload).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, "base64url");
    } catch {
      return false;
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        shareId?: unknown;
        fileId?: unknown;
        expiresAt?: unknown;
      };
      return (
        parsed.shareId === shareId &&
        parsed.fileId === fileId &&
        typeof parsed.expiresAt === "number" &&
        parsed.expiresAt > Date.now()
      );
    } catch {
      return false;
    }
  }

  async #recordAccess(
    record: StoredConversationShare,
    context: ConversationShareAccessContext,
    accessType: "view" | "file",
    fileId: string | null
  ) {
    await conversationSharesRepository.recordAccess(
      conversationShareAccessRecordSchema.parse({
        accessId: `csa_${randomUUID()}`,
        shareId: record.summary.shareId,
        accessType,
        fileId,
        actorUserId: context.actor?.userId ?? null,
        viewerType: context.actor ? "authenticated" : "anonymous",
        clientFingerprint: context.clientFingerprint,
        accessedAt: nowIso(),
      })
    );
  }

  async revoke(shareId: string) {
    const record = await this.get(shareId);
    if (record.summary.revokedAt) return toView(record);
    const revoked = storedConversationShareSchema.parse({
      ...record,
      summary: {
        ...record.summary,
        status: "revoked",
        revokedAt: nowIso(),
      },
    });
    return toView(await conversationSharesRepository.save(revoked));
  }

  async listAccess(shareId: string) {
    await this.get(shareId);
    return { items: await conversationSharesRepository.listAccess(shareId) };
  }
}

export function buildConversationShareFingerprint(input: string) {
  return input ? createHash("sha256").update(input).digest("hex") : null;
}

export async function initializeConversationSharesInfrastructure() {
  await initializeConversationSharesRepository();
}

export const conversationSharesService = new ConversationSharesService();
