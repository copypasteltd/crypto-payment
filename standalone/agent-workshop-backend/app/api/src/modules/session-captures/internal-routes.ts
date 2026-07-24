import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  acquireSessionCaptureLeaseInputSchema,
  completeSessionCaptureInputSchema,
  failSessionCaptureInputSchema,
  heartbeatSessionCaptureInputSchema,
  sessionCaptureIdSchema,
  sessionCaptureObjectTypeSchema,
  submitSessionCaptureBarrierInputSchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { sessionCaptureService } from "./service.js";

const paramsSchema = z.object({
  runId: z.string().min(1),
  captureId: sessionCaptureIdSchema,
});
const uploadParamsSchema = paramsSchema.extend({ objectType: sessionCaptureObjectTypeSchema });
const evidenceQuerySchema = z.object({
  workerId: z.string().trim().min(1).max(240),
  leaseGeneration: z.coerce.number().int().positive(),
});
const uploadQuerySchema = evidenceQuerySchema.extend({
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  contentType: z.string().trim().min(1).max(160),
});

function readHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function registerSessionCaptureInternalRoutes(server: FastifyInstance) {
  server.addHook("onRequest", async (request) => {
    const expected = getApiRuntimeConfig().internalAuthToken;
    if (expected && readHeader(request.headers["x-lingban-internal-token"]) !== expected) {
      throw new AppError(401, "INTERNAL_AUTH_INVALID", "Internal capture request is not authorized");
    }
  });

  server.get("/runs/:runId/session-captures/claimable", async (request) => {
    const { runId } = z.object({ runId: z.string().min(1) }).parse(request.params);
    return { items: await sessionCaptureService.listClaimable(runId) };
  });

  server.get("/runs/:runId/session-captures/cleanup-gate", async (request) => {
    const { runId } = z.object({ runId: z.string().min(1) }).parse(request.params);
    return sessionCaptureService.getCleanupGate(runId);
  });

  server.post("/runs/:runId/session-captures/:captureId/lease", async (request) => {
    const params = paramsSchema.parse(request.params);
    const capture = await sessionCaptureService.get(params.captureId);
    if (capture.runId !== params.runId) throw new AppError(404, "SESSION_CAPTURE_NOT_FOUND", "Session capture not found");
    const body = acquireSessionCaptureLeaseInputSchema.parse(request.body);
    return sessionCaptureService.acquireLease(params.captureId, body.workerId, body.leaseSeconds);
  });

  server.post("/runs/:runId/session-captures/:captureId/barrier", async (request) => {
    const params = paramsSchema.parse(request.params);
    return sessionCaptureService.submitBarrier(params.captureId, submitSessionCaptureBarrierInputSchema.parse(request.body));
  });

  server.get("/runs/:runId/session-captures/:captureId/evidence", async (request) => {
    const params = paramsSchema.parse(request.params);
    const query = evidenceQuerySchema.parse(request.query);
    return sessionCaptureService.getEvidence(params.captureId, query.workerId, query.leaseGeneration);
  });

  server.post("/runs/:runId/session-captures/:captureId/heartbeat", async (request) => {
    const params = paramsSchema.parse(request.params);
    return sessionCaptureService.heartbeat(params.captureId, heartbeatSessionCaptureInputSchema.parse(request.body));
  });

  server.post("/runs/:runId/session-captures/:captureId/objects/:objectType", {
    bodyLimit: getApiRuntimeConfig().uploadMaxBytes,
  }, async (request) => {
    const params = uploadParamsSchema.parse(request.params);
    const query = uploadQuerySchema.parse(request.query);
    if (!(request.body instanceof Buffer)) {
      throw new AppError(400, "RUN_CAPTURE_OBJECT_BODY_INVALID", "Capture object body must be application/octet-stream");
    }
    return sessionCaptureService.uploadObject(params.captureId, {
      workerId: query.workerId,
      leaseGeneration: query.leaseGeneration,
      objectType: params.objectType,
      contentType: query.contentType,
      expectedSha256: query.sha256,
      content: request.body,
    });
  });

  server.post("/runs/:runId/session-captures/:captureId/complete", async (request) => {
    const params = paramsSchema.parse(request.params);
    return sessionCaptureService.complete(params.captureId, completeSessionCaptureInputSchema.parse(request.body));
  });

  server.post("/runs/:runId/session-captures/:captureId/fail", async (request) => {
    const params = paramsSchema.parse(request.params);
    return sessionCaptureService.fail(params.captureId, failSessionCaptureInputSchema.parse(request.body));
  });
}
