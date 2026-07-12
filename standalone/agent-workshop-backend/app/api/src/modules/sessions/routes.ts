import type { FastifyInstance } from "fastify";
import { requireCurrentWorkspaceAccess, type AuthRequestContext } from "../auth/request-auth.js";
import { AppError } from "../../app/errors.js";
import {
  downloadSessionPackArchiveQuerySchema,
  inheritSessionPackInputSchema,
  importSessionPackArchiveQuerySchema,
  listSessionPacksQuerySchema,
  publishSessionPackInputSchema,
  reviewSessionPackRedactionInputSchema,
  rollbackSessionPackInputSchema,
  unpublishSessionPackInputSchema,
  updateSessionPackRedactionMapInputSchema,
  sessionVersionIdParamsSchema,
} from "./schemas.js";
import { sessionCatalogService } from "./service.js";

function toSessionActor(authContext: AuthRequestContext) {
  return {
    workspaceContextKey: authContext.currentWorkspace.contextKey,
    userId: authContext.user.userId,
  };
}

const sessionAccessRoles = ["owner", "admin", "creator"] as const;

function buildContentDisposition(fileName: string) {
  const fallback =
    fileName.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_").trim() ||
    "session-pack.json.gz";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function registerSessionRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const query = listSessionPacksQuerySchema.parse(request.query ?? {});
    return sessionCatalogService.listSessionPacks(
      query,
      authContext ? toSessionActor(authContext) : undefined
    );
  });

  server.get("/:sessionVersionId", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    return sessionCatalogService.getSessionPack(
      params.sessionVersionId,
      authContext ? toSessionActor(authContext) : undefined
    );
  });

  server.get("/:sessionVersionId/lineage", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    return sessionCatalogService.getSessionPackLineage(
      params.sessionVersionId,
      authContext ? toSessionActor(authContext) : undefined
    );
  });

  server.post("/import", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const query = importSessionPackArchiveQuerySchema.parse(request.query ?? {});
    const workspaceContextKey = authContext?.currentWorkspace.contextKey ?? query.workspaceContextKey;

    if (!workspaceContextKey) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_REQUIRED",
        "workspaceContextKey is required when auth mode is disabled"
      );
    }

    if (
      authContext?.currentWorkspace.contextKey &&
      query.workspaceContextKey &&
      query.workspaceContextKey !== authContext.currentWorkspace.contextKey
    ) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_MISMATCH",
        "workspaceContextKey does not match the authenticated current workspace"
      );
    }

    const body = request.body;
    if (!(body instanceof Buffer) && !(body instanceof Uint8Array)) {
      throw new AppError(
        400,
        "SESSION_PACK_ARCHIVE_BODY_INVALID",
        "Session pack archive body must be application/octet-stream"
      );
    }

    return sessionCatalogService.importSessionPackArchive(body, {
      workspaceContextKey,
      importedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:sessionVersionId/inherit", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    const input = inheritSessionPackInputSchema.parse(request.body ?? {});
    const workspaceContextKey = authContext?.currentWorkspace.contextKey ?? input.workspaceContextKey;

    if (!workspaceContextKey) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_REQUIRED",
        "workspaceContextKey is required when auth mode is disabled"
      );
    }

    if (
      authContext?.currentWorkspace.contextKey &&
      input.workspaceContextKey &&
      input.workspaceContextKey !== authContext.currentWorkspace.contextKey
    ) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_MISMATCH",
        "workspaceContextKey does not match the authenticated current workspace"
      );
    }

    return sessionCatalogService.inheritSessionPack(params.sessionVersionId, {
      workspaceContextKey,
      inheritedByUserId: authContext?.user.userId ?? null,
      inheritMode: input.inheritMode,
      newSessionId: input.newSessionId ?? null,
      newSessionVersionId: input.newSessionVersionId ?? null,
      reason: input.reason ?? null,
    });
  });

  server.post("/:sessionVersionId/publish", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    const input = publishSessionPackInputSchema.parse(request.body ?? {});
    const workspaceContextKey = authContext?.currentWorkspace.contextKey ?? input.workspaceContextKey;

    if (!workspaceContextKey) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_REQUIRED",
        "workspaceContextKey is required when auth mode is disabled"
      );
    }

    if (
      authContext?.currentWorkspace.contextKey &&
      input.workspaceContextKey &&
      input.workspaceContextKey !== authContext.currentWorkspace.contextKey
    ) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_MISMATCH",
        "workspaceContextKey does not match the authenticated current workspace"
      );
    }

    return sessionCatalogService.publishSessionPack(params.sessionVersionId, {
      workspaceContextKey,
      serviceId: input.serviceId,
      entrySurface: input.entrySurface ?? null,
      applyToAllEntrySurfaces: input.applyToAllEntrySurfaces,
      taskVersionId: input.taskVersionId ?? null,
      title: input.title ?? null,
      targetRoot: input.targetRoot ?? null,
      bindings: input.bindings ?? null,
      publishedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:sessionVersionId/rollback", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    const input = rollbackSessionPackInputSchema.parse(request.body ?? {});
    const workspaceContextKey = authContext?.currentWorkspace.contextKey ?? input.workspaceContextKey;

    if (!workspaceContextKey) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_REQUIRED",
        "workspaceContextKey is required when auth mode is disabled"
      );
    }

    if (
      authContext?.currentWorkspace.contextKey &&
      input.workspaceContextKey &&
      input.workspaceContextKey !== authContext.currentWorkspace.contextKey
    ) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_MISMATCH",
        "workspaceContextKey does not match the authenticated current workspace"
      );
    }

    return sessionCatalogService.rollbackSessionPack(params.sessionVersionId, {
      workspaceContextKey,
      serviceId: input.serviceId,
      rollbackToSessionVersionId: input.rollbackToSessionVersionId,
      entrySurface: input.entrySurface ?? null,
      applyToAllEntrySurfaces: input.applyToAllEntrySurfaces,
      rolledBackByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:sessionVersionId/unpublish", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    const input = unpublishSessionPackInputSchema.parse(request.body ?? {});
    const workspaceContextKey = authContext?.currentWorkspace.contextKey ?? input.workspaceContextKey;

    if (!workspaceContextKey) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_REQUIRED",
        "workspaceContextKey is required when auth mode is disabled"
      );
    }

    if (
      authContext?.currentWorkspace.contextKey &&
      input.workspaceContextKey &&
      input.workspaceContextKey !== authContext.currentWorkspace.contextKey
    ) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_MISMATCH",
        "workspaceContextKey does not match the authenticated current workspace"
      );
    }

    return sessionCatalogService.unpublishSessionPack(params.sessionVersionId, {
      workspaceContextKey,
      serviceId: input.serviceId,
      entrySurface: input.entrySurface ?? null,
      applyToAllEntrySurfaces: input.applyToAllEntrySurfaces,
      unpublishedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:sessionVersionId/redaction-map", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    const input = updateSessionPackRedactionMapInputSchema.parse(request.body ?? {});
    const workspaceContextKey = authContext?.currentWorkspace.contextKey ?? input.workspaceContextKey;

    if (!workspaceContextKey) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_REQUIRED",
        "workspaceContextKey is required when auth mode is disabled"
      );
    }

    if (
      authContext?.currentWorkspace.contextKey &&
      input.workspaceContextKey &&
      input.workspaceContextKey !== authContext.currentWorkspace.contextKey
    ) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_MISMATCH",
        "workspaceContextKey does not match the authenticated current workspace"
      );
    }

    return sessionCatalogService.updateSessionPackRedactionMap(params.sessionVersionId, {
      workspaceContextKey,
      updatedByUserId: authContext?.user.userId ?? null,
      mapVersion: input.mapVersion ?? null,
      curatedSecretSlotKeys: input.curatedSecretSlotKeys,
      rules: input.rules,
    });
  });

  server.post("/:sessionVersionId/redaction-review", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    const input = reviewSessionPackRedactionInputSchema.parse(request.body ?? {});
    const workspaceContextKey = authContext?.currentWorkspace.contextKey ?? input.workspaceContextKey;

    if (!workspaceContextKey) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_REQUIRED",
        "workspaceContextKey is required when auth mode is disabled"
      );
    }

    if (
      authContext?.currentWorkspace.contextKey &&
      input.workspaceContextKey &&
      input.workspaceContextKey !== authContext.currentWorkspace.contextKey
    ) {
      throw new AppError(
        400,
        "SESSION_PACK_WORKSPACE_CONTEXT_MISMATCH",
        "workspaceContextKey does not match the authenticated current workspace"
      );
    }

    return sessionCatalogService.reviewSessionPackRedaction(params.sessionVersionId, {
      workspaceContextKey,
      reviewedByUserId: authContext?.user.userId ?? null,
      decision: input.decision,
      note: input.note ?? null,
    });
  });

  server.get("/:sessionVersionId/archive", async (request, reply) => {
    const authContext = requireCurrentWorkspaceAccess(request, [...sessionAccessRoles]);
    const params = sessionVersionIdParamsSchema.parse(request.params);
    const query = downloadSessionPackArchiveQuerySchema.parse(request.query ?? {});
    const exported = await sessionCatalogService.exportSessionPackArchive(
      params.sessionVersionId,
      authContext ? toSessionActor(authContext) : undefined,
      {
        redact: query.redact,
      }
    );

    reply.header("content-type", "application/gzip");
    reply.header("content-disposition", buildContentDisposition(exported.fileName));
    reply.header("x-lingban-session-pack-source", exported.source);
    reply.header("x-lingban-session-pack-redacted", exported.redacted ? "true" : "false");
    return reply.send(Buffer.from(exported.content));
  });
}
