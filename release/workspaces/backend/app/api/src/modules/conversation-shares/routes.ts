import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  conversationShareIdSchema,
  createConversationShareInputSchema,
} from "@lingban/contracts";
import {
  requireWorkspaceAccess,
  resolveOptionalRequestAuth,
} from "../auth/request-auth.js";
import { resolveByteRange } from "../uploads/byte-range.js";
import { runsService } from "../runs/service.js";
import {
  buildConversationShareFingerprint,
  conversationSharesService,
} from "./service.js";

const runParamsSchema = z.object({ runId: z.string().min(1) });
const shareParamsSchema = z.object({ shareId: conversationShareIdSchema });
const shareFileParamsSchema = z.object({
  shareId: conversationShareIdSchema,
  fileId: z.string().trim().min(1).max(120),
});
const shareFileQuerySchema = z.object({
  grant: z.string().trim().min(20).max(4096).optional(),
});
const shareRoles = ["owner", "admin", "operator", "creator"] as const;

function buildActor(request: FastifyRequest) {
  const auth = resolveOptionalRequestAuth(request);
  return auth
    ? {
        userId: auth.user.userId,
        workspaceIds: auth.workspaces
          .filter((workspace) => workspace.membershipStatus === "active")
          .map((workspace) => workspace.workspaceId),
      }
    : null;
}

function buildAccessContext(request: FastifyRequest) {
  const userAgent = typeof request.headers["user-agent"] === "string"
    ? request.headers["user-agent"]
    : "";
  return {
    actor: buildActor(request),
    clientFingerprint: buildConversationShareFingerprint(`${request.ip}|${userAgent}`),
  };
}

function buildContentDisposition(fileName: string, inline: boolean) {
  const fallback = fileName
    .replace(/[^\x20-\x7e]+/g, "_")
    .replace(/["\\]/g, "_")
    .trim() || "attachment.bin";
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function registerConversationShareRoutes(server: FastifyInstance) {
  server.post("/runs/:runId/conversation-shares", async (request, reply) => {
    const { runId } = runParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(runId);
    const auth = requireWorkspaceAccess(request, snapshot.run.workspaceId, [...shareRoles]);
    const result = await conversationSharesService.create(
      runId,
      createConversationShareInputSchema.parse(request.body),
      auth?.user.userId ?? null
    );
    reply.code(201);
    return result;
  });

  server.get("/runs/:runId/conversation-shares", async (request) => {
    const { runId } = runParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId, [...shareRoles]);
    return conversationSharesService.listForRun(runId);
  });

  server.get("/conversation-shares/:shareId", async (request) => {
    const { shareId } = shareParamsSchema.parse(request.params);
    const record = await conversationSharesService.get(shareId);
    requireWorkspaceAccess(request, record.summary.workspaceId, [...shareRoles]);
    return conversationSharesService.getOwnerView(shareId);
  });

  server.post("/conversation-shares/:shareId/revoke", async (request) => {
    const { shareId } = shareParamsSchema.parse(request.params);
    const record = await conversationSharesService.get(shareId);
    requireWorkspaceAccess(request, record.summary.workspaceId, [...shareRoles]);
    return conversationSharesService.revoke(shareId);
  });

  server.get("/conversation-shares/:shareId/access-audit", async (request) => {
    const { shareId } = shareParamsSchema.parse(request.params);
    const record = await conversationSharesService.get(shareId);
    requireWorkspaceAccess(request, record.summary.workspaceId, ["owner", "admin", "creator"]);
    return conversationSharesService.listAccess(shareId);
  });

  server.get("/conversation-shares/public/:shareId", async (request, reply) => {
    const { shareId } = shareParamsSchema.parse(request.params);
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
    return conversationSharesService.getSharedView(shareId, buildAccessContext(request));
  });

  server.get("/conversation-shares/public/:shareId/files/:fileId", async (request, reply) => {
    const { shareId, fileId } = shareFileParamsSchema.parse(request.params);
    const { grant } = shareFileQuerySchema.parse(request.query ?? {});
    const record = await conversationSharesService.get(shareId);
    const storedFile = record.files.find((item) => item.file.fileId === fileId);
    const fileSize = storedFile?.file.sizeBytes ?? null;
    const rangeHeader = typeof request.headers.range === "string" ? request.headers.range : undefined;
    const byteRange = resolveByteRange(rangeHeader, fileSize);
    const result = await conversationSharesService.openSharedFile(
      shareId,
      fileId,
      buildAccessContext(request),
      byteRange ?? undefined,
      grant
    );
    const inline = result.file.kind === "image" || result.file.kind === "video";
    reply.header("content-type", result.file.mimeType ?? "application/octet-stream");
    reply.header("content-disposition", buildContentDisposition(result.file.label, inline));
    reply.header("cache-control", "private, max-age=300");
    reply.header("x-content-type-options", "nosniff");
    reply.header("accept-ranges", "bytes");
    if (byteRange && fileSize != null) {
      reply.code(206);
      reply.header("content-range", `bytes ${byteRange.start}-${byteRange.end}/${fileSize}`);
      reply.header("content-length", String(byteRange.length));
    } else if (fileSize != null) {
      reply.header("content-length", String(fileSize));
    }
    return reply.send(result.stream);
  });
}
