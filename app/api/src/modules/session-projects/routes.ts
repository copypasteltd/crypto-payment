import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createCreatorSourceRunInputSchema,
  createSessionProjectInputSchema,
  listSessionProjectsQuerySchema,
  sessionProjectIdSchema,
  updateSessionProjectInputSchema,
  type WorkspaceRole,
} from "@lingban/contracts";
import { requireCurrentWorkspaceAccess } from "../auth/request-auth.js";
import { executeIdempotent, readIdempotencyKey } from "../idempotency/service.js";
import { sessionProjectsService } from "./service.js";

const creatorRoles: WorkspaceRole[] = ["owner", "admin", "creator"];
const sessionProjectParamsSchema = z.object({ sessionProjectId: sessionProjectIdSchema });

function toActor(authContext: NonNullable<ReturnType<typeof requireCurrentWorkspaceAccess>>) {
  return {
    userId: authContext.user.userId,
    workspaceId: authContext.currentWorkspace.workspaceId,
    workspaceContextKey: authContext.currentWorkspace.contextKey,
  };
}

export async function registerSessionProjectRoutes(server: FastifyInstance) {
  server.get("/session-projects", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorRoles);
    if (!authContext) return { items: [], total: 0 };
    return sessionProjectsService.list(
      listSessionProjectsQuerySchema.parse(request.query ?? {}),
      toActor(authContext)
    );
  });

  server.post("/session-projects", async (request, reply) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorRoles);
    if (!authContext) return null;
    const body = createSessionProjectInputSchema.parse(request.body);
    const result = await executeIdempotent({
      scope: "creator.session-project.create",
      key: readIdempotencyKey(request),
      actorId: `${authContext.user.userId}:${authContext.currentWorkspace.workspaceId}`,
      request: body,
      execute: () => sessionProjectsService.create(body, toActor(authContext)),
    });
    reply.header("Idempotency-Status", result.replayed ? "replayed" : "created");
    return result.value;
  });

  server.get("/session-projects/:sessionProjectId", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorRoles);
    if (!authContext) return null;
    const params = sessionProjectParamsSchema.parse(request.params);
    return sessionProjectsService.get(params.sessionProjectId, toActor(authContext));
  });

  server.patch("/session-projects/:sessionProjectId", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorRoles);
    if (!authContext) return null;
    const params = sessionProjectParamsSchema.parse(request.params);
    return sessionProjectsService.update(
      params.sessionProjectId,
      updateSessionProjectInputSchema.parse(request.body),
      toActor(authContext)
    );
  });

  server.post("/session-projects/:sessionProjectId/archive", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorRoles);
    if (!authContext) return null;
    const params = sessionProjectParamsSchema.parse(request.params);
    return sessionProjectsService.archive(params.sessionProjectId, toActor(authContext));
  });

  server.post("/source-runs", async (request, reply) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorRoles);
    if (!authContext) return null;
    const body = createCreatorSourceRunInputSchema.parse(request.body);
    const result = await executeIdempotent({
      scope: "creator.source-run.create",
      key: readIdempotencyKey(request),
      actorId: `${authContext.user.userId}:${authContext.currentWorkspace.workspaceId}`,
      request: body,
      execute: () => sessionProjectsService.createSourceRun(body, toActor(authContext)),
    });
    reply.header("Idempotency-Status", result.replayed ? "replayed" : "created");
    return result.value;
  });
}
