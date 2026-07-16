import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createSessionCaptureInputSchema,
  requestSessionCaptureObjectDownloadSchema,
  sessionCaptureIdSchema,
  sessionCaptureObjectTypeSchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { requireCurrentWorkspaceAccess, requireWorkspaceAccess } from "../auth/request-auth.js";
import { objectStore } from "../uploads/object-store.js";
import { runsService } from "../runs/service.js";
import { sessionCaptureService } from "./service.js";

const runParamsSchema = z.object({ runId: z.string().min(1) });
const captureParamsSchema = z.object({ captureId: sessionCaptureIdSchema });
const captureObjectParamsSchema = z.object({
  captureId: sessionCaptureIdSchema,
  objectType: sessionCaptureObjectTypeSchema,
});
const captureRoles = ["owner", "admin", "operator", "creator"] as const;
const rawObjectAccessRoles = ["owner", "admin", "creator"] as const;

function buildContentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_").trim() || "capture.bin";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function registerSessionCaptureRoutes(server: FastifyInstance) {
  server.get("/session-captures", async (request) => {
    const auth = requireCurrentWorkspaceAccess(request, [...captureRoles]);
    return { items: auth ? await sessionCaptureService.listForWorkspace(auth.currentWorkspace.workspaceId) : [] };
  });

  server.post("/runs/:runId/session-captures", async (request, reply) => {
    const { runId } = runParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(runId);
    const auth = requireWorkspaceAccess(request, snapshot.run.workspaceId, [...captureRoles]);
    const result = await sessionCaptureService.create(
      runId,
      createSessionCaptureInputSchema.parse(request.body),
      auth?.user.userId ?? null
    );
    reply.code(202);
    return result;
  });

  server.get("/runs/:runId/session-captures", async (request) => {
    const { runId } = runParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId, [...captureRoles]);
    return { items: await sessionCaptureService.listForRun(runId) };
  });

  server.get("/session-captures/:captureId", async (request) => {
    const { captureId } = captureParamsSchema.parse(request.params);
    const capture = await sessionCaptureService.get(captureId);
    requireWorkspaceAccess(request, capture.workspaceId, [...captureRoles]);
    return capture;
  });

  server.post("/session-captures/:captureId/retry", async (request) => {
    const { captureId } = captureParamsSchema.parse(request.params);
    const capture = await sessionCaptureService.get(captureId);
    requireWorkspaceAccess(request, capture.workspaceId, [...captureRoles]);
    return sessionCaptureService.retry(captureId);
  });

  server.get("/session-captures/:captureId/access-audit", async (request) => {
    const { captureId } = captureParamsSchema.parse(request.params);
    const capture = await sessionCaptureService.get(captureId);
    requireWorkspaceAccess(request, capture.workspaceId, [...rawObjectAccessRoles]);
    return { items: await sessionCaptureService.listObjectAccessAudit(captureId) };
  });

  server.post("/session-captures/:captureId/objects/:objectType/download", async (request, reply) => {
    const { captureId, objectType } = captureObjectParamsSchema.parse(request.params);
    const capture = await sessionCaptureService.get(captureId);
    const auth = requireWorkspaceAccess(request, capture.workspaceId, [...rawObjectAccessRoles]);
    if (!auth) {
      throw new AppError(401, "SESSION_CAPTURE_STRONG_AUTH_REQUIRED", "Raw Capture access requires an authenticated user");
    }
    const input = requestSessionCaptureObjectDownloadSchema.parse(request.body ?? {});
    const grant = await sessionCaptureService.authorizeObjectDownload({
      captureId,
      objectType,
      actorUserId: auth.user.userId,
      reason: input.reason,
    });
    if (grant.downloadUrl) {
      return { audit: grant.audit, downloadUrl: grant.downloadUrl, expiresAt: grant.expiresAt };
    }
    const stream = await objectStore.createReadStream(grant.object.objectKey);
    const fileName = `${grant.capture.captureId}-${grant.object.objectType}`;
    reply.header("content-type", grant.object.contentType);
    reply.header("content-length", String(grant.object.sizeBytes));
    reply.header("content-disposition", buildContentDisposition(fileName));
    reply.header("x-session-capture-audit-id", grant.audit.auditId);
    return reply.send(stream);
  });
}
