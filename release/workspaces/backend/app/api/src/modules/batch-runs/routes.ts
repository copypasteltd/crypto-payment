import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  batchRunCancelInputSchema,
  batchRunRetryInputSchema,
  batchRunStartInputSchema,
  createBatchRunInputSchema,
  estimateBatchRunInputSchema,
  importBatchRunFileInputSchema,
  listBatchRunItemsQuerySchema,
  listBatchRunsQuerySchema,
} from "@lingban/contracts";
import { requireRequestAuth, requireWorkspaceAccess } from "../auth/request-auth.js";
import { batchRunsService } from "./service.js";

const batchJobIdParamsSchema = z.object({
  batchJobId: z.string().min(1),
});

const batchWriteRoles = ["owner", "admin", "operator", "creator"] as const;

export async function registerBatchRunRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const authContext = requireRequestAuth(request);
    const query = listBatchRunsQuerySchema.parse(request.query ?? {});
    const effectiveQuery = {
      ...query,
      workspaceId: authContext?.currentWorkspace.workspaceId ?? query.workspaceId,
      workspaceContextKey: authContext?.currentWorkspace.contextKey ?? query.workspaceContextKey,
    };

    if (effectiveQuery.workspaceId) {
      requireWorkspaceAccess(request, effectiveQuery.workspaceId);
    }

    return batchRunsService.listBatchRuns(effectiveQuery);
  });

  server.post("/", async (request) => {
    const authContext = requireRequestAuth(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const effectiveInput = {
      ...body,
      workspaceId:
        (typeof body.workspaceId === "string" ? body.workspaceId : undefined) ??
        authContext?.currentWorkspace.workspaceId,
      workspaceContextKey:
        (typeof body.workspaceContextKey === "string" ? body.workspaceContextKey : undefined) ??
        authContext?.currentWorkspace.contextKey,
    };
    const parsed = createBatchRunInputSchema.parse(effectiveInput);

    if (parsed.workspaceId) {
      requireWorkspaceAccess(request, parsed.workspaceId, [...batchWriteRoles]);
    }

    return batchRunsService.createBatchRun(parsed, {
      requestedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/import-file", async (request) => {
    const authContext = requireRequestAuth(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const effectiveInput = {
      ...body,
      workspaceId:
        (typeof body.workspaceId === "string" ? body.workspaceId : undefined) ??
        authContext?.currentWorkspace.workspaceId,
      workspaceContextKey:
        (typeof body.workspaceContextKey === "string" ? body.workspaceContextKey : undefined) ??
        authContext?.currentWorkspace.contextKey,
    };
    const parsed = importBatchRunFileInputSchema.parse(effectiveInput);

    if (parsed.workspaceId) {
      requireWorkspaceAccess(request, parsed.workspaceId, [...batchWriteRoles]);
    }

    return batchRunsService.importBatchRunFile(parsed);
  });

  server.post("/estimate", async (request) => {
    const authContext = requireRequestAuth(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const effectiveInput = {
      ...body,
      workspaceId:
        (typeof body.workspaceId === "string" ? body.workspaceId : undefined) ??
        authContext?.currentWorkspace.workspaceId,
      workspaceContextKey:
        (typeof body.workspaceContextKey === "string" ? body.workspaceContextKey : undefined) ??
        authContext?.currentWorkspace.contextKey,
    };
    const parsed = estimateBatchRunInputSchema.parse(effectiveInput);

    if (parsed.workspaceId) {
      requireWorkspaceAccess(request, parsed.workspaceId, [...batchWriteRoles]);
    }

    return batchRunsService.estimateBatchRun(parsed);
  });

  server.get("/:batchJobId", async (request) => {
    const params = batchJobIdParamsSchema.parse(request.params);
    const detail = await batchRunsService.getBatchRun(params.batchJobId);
    requireWorkspaceAccess(request, detail.job.workspaceId);
    return detail;
  });

  server.get("/:batchJobId/items", async (request) => {
    const params = batchJobIdParamsSchema.parse(request.params);
    const query = listBatchRunItemsQuerySchema.parse(request.query ?? {});
    const detail = await batchRunsService.getBatchRun(params.batchJobId);
    requireWorkspaceAccess(request, detail.job.workspaceId);
    return batchRunsService.listBatchItems(params.batchJobId, query);
  });

  server.post("/:batchJobId/validate", async (request) => {
    const params = batchJobIdParamsSchema.parse(request.params);
    const detail = await batchRunsService.getBatchRun(params.batchJobId);
    requireWorkspaceAccess(request, detail.job.workspaceId, [...batchWriteRoles]);
    return batchRunsService.validateBatchRun(params.batchJobId);
  });

  server.post("/:batchJobId/start", async (request) => {
    const params = batchJobIdParamsSchema.parse(request.params);
    const body = batchRunStartInputSchema.parse(request.body ?? {});
    const detail = await batchRunsService.getBatchRun(params.batchJobId);
    requireWorkspaceAccess(request, detail.job.workspaceId, [...batchWriteRoles]);
    return batchRunsService.startBatchRun(params.batchJobId, body);
  });

  server.post("/:batchJobId/retry", async (request) => {
    const params = batchJobIdParamsSchema.parse(request.params);
    const body = batchRunRetryInputSchema.parse(request.body ?? {});
    const detail = await batchRunsService.getBatchRun(params.batchJobId);
    requireWorkspaceAccess(request, detail.job.workspaceId, [...batchWriteRoles]);
    return batchRunsService.retryBatchRun(params.batchJobId, body);
  });

  server.post("/:batchJobId/cancel", async (request) => {
    const params = batchJobIdParamsSchema.parse(request.params);
    const body = batchRunCancelInputSchema.parse(request.body ?? {});
    const detail = await batchRunsService.getBatchRun(params.batchJobId);
    requireWorkspaceAccess(request, detail.job.workspaceId, [...batchWriteRoles]);
    return batchRunsService.cancelBatchRun(params.batchJobId, body);
  });
}
