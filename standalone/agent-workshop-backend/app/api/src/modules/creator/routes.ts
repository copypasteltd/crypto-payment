import type { FastifyInstance } from "fastify";
import {
  activateCreatorReleaseInputSchema,
  createCreatorAuditExportInputSchema,
  createCreatorPackageInputSchema,
  creatorGovernanceSectionSummaryQuerySchema,
  createCreatorReleaseInputSchema,
  createCreatorReplayInputSchema,
  decideCreatorReleaseGateInputSchema,
  listCreatorAuditExportsQuerySchema,
  listCreatorPackagesQuerySchema,
  updateCreatorReleaseInputSchema,
  updateCreatorReplayInputSchema,
  putCreatorPackageSessionBindingInputSchema,
  creatorPackageSessionBindingsSchema,
  type WorkspaceRole,
} from "@lingban/contracts";
import {
  requireCurrentWorkspaceAccess,
  type AuthRequestContext,
} from "../auth/request-auth.js";
import {
  creatorAuditExportIdParamsSchema,
  creatorGovernanceSectionParamsSchema,
  creatorReleaseGateIdParamsSchema,
  creatorReleaseIdOnlyParamsSchema,
  creatorPackageIdParamsSchema,
  creatorReleaseIdParamsSchema,
  creatorReplayIdParamsSchema,
} from "./storage-schema.js";
import { creatorService } from "./service.js";
import { sessionDraftService } from "../session-drafts/service.js";
import { executeIdempotent, readOptionalIdempotencyKey } from "../idempotency/service.js";
import { AppError } from "../../app/errors.js";

const creatorAccessRoles: WorkspaceRole[] = ["owner", "admin", "creator"];
const creatorGovernanceRoles: WorkspaceRole[] = ["owner", "admin"];

function toCreatorActor(authContext: AuthRequestContext) {
  return {
    userId: authContext.user.userId,
    role: authContext.currentWorkspace.role,
    workspaceId: authContext.currentWorkspace.workspaceId,
    workspaceContextKey: authContext.currentWorkspace.contextKey,
  };
}

function toCreatorGovernanceActor(authContext: AuthRequestContext) {
  return {
    userId: authContext.user.userId,
    role: authContext.currentWorkspace.role,
    workspaceId: authContext.currentWorkspace.workspaceId,
    workspaceContextKey: authContext.currentWorkspace.contextKey,
  };
}

export async function registerCreatorRoutes(server: FastifyInstance) {
  server.get("/packages", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    const query = listCreatorPackagesQuerySchema.parse(request.query);
    return creatorService.listPackages(query, authContext ? toCreatorActor(authContext) : undefined);
  });

  server.post("/packages", async (request, reply) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    if (!authContext) return null;
    const body = createCreatorPackageInputSchema.parse(request.body);
    const idempotencyKey = readOptionalIdempotencyKey(request);
    if (!idempotencyKey) {
      return creatorService.createPackage(body, toCreatorActor(authContext));
    }
    const result = await executeIdempotent({
      scope: "creator.package.create",
      key: idempotencyKey,
      actorId: `${authContext.user.userId}:${authContext.currentWorkspace.workspaceId}`,
      request: body,
      execute: () => creatorService.createPackage(body, toCreatorActor(authContext)),
    });
    reply.header("Idempotency-Status", result.replayed ? "replayed" : "created");
    return result.value;
  });

  server.get("/packages/:packageId", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    const params = creatorPackageIdParamsSchema.parse(request.params);
    return creatorService.getPackage(
      params.packageId,
      authContext ? toCreatorActor(authContext) : undefined
    );
  });

  server.put("/packages/:packageId/session-binding", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    if (!authContext) return null;
    const params = creatorPackageIdParamsSchema.parse(request.params);
    const body = putCreatorPackageSessionBindingInputSchema.parse(request.body);
    creatorService.getPackage(params.packageId, toCreatorActor(authContext));
    const version = await sessionDraftService.getVersion(body.sessionVersionId);
    if (version.session.workspaceId !== authContext.currentWorkspace.workspaceId) {
      throw new AppError(404, "SESSION_VERSION_NOT_FOUND", `Session version not found: ${body.sessionVersionId}`);
    }
    return sessionDraftService.bindPackage(params.packageId, body);
  });

  server.get("/packages/:packageId/session-binding", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    if (!authContext) return creatorPackageSessionBindingsSchema.parse({ active: null, candidate: null });
    const params = creatorPackageIdParamsSchema.parse(request.params);
    creatorService.getPackage(params.packageId, toCreatorActor(authContext));
    return creatorPackageSessionBindingsSchema.parse(
      await sessionDraftService.getPackageBindings(params.packageId)
    );
  });

  server.get("/packages/:packageId/governance/:section/summary", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorGovernanceRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorGovernanceSectionParamsSchema.parse(request.params);
    const query = creatorGovernanceSectionSummaryQuerySchema.parse(request.query ?? {});
    return creatorService.getGovernanceSectionSummary(params.packageId, params.section, toCreatorGovernanceActor(authContext), query);
  });

  server.get("/packages/:packageId/audit-exports", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorGovernanceRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorPackageIdParamsSchema.parse(request.params);
    const query = listCreatorAuditExportsQuerySchema.parse(request.query ?? {});
    return creatorService.listPackageAuditExports(params.packageId, toCreatorGovernanceActor(authContext), query);
  });

  server.post("/packages/:packageId/audit-exports", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorGovernanceRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorPackageIdParamsSchema.parse(request.params);
    const body = createCreatorAuditExportInputSchema.parse(request.body);
    return await creatorService.createAuditExport(params.packageId, toCreatorGovernanceActor(authContext), body);
  });

  server.get("/packages/:packageId/audit-exports/:exportId/content", async (request, reply) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorGovernanceRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorAuditExportIdParamsSchema.parse(request.params);
    const resolved = await creatorService.resolveAuditExportDownload(
      params.packageId,
      params.exportId,
      toCreatorGovernanceActor(authContext)
    );

    if ("redirectUrl" in resolved && resolved.redirectUrl) {
      return reply.redirect(resolved.redirectUrl, 307);
    }

    reply.header("content-type", resolved.export.mimeType);
    reply.header(
      "content-disposition",
      `attachment; filename="${encodeURIComponent(resolved.export.fileName)}"`
    );

    return reply.send(resolved.stream);
  });

  server.get("/packages/:packageId/releases", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    const params = creatorPackageIdParamsSchema.parse(request.params);
    return creatorService.listPackageReleases(
      params.packageId,
      authContext ? toCreatorActor(authContext) : undefined
    );
  });

  server.post("/packages/:packageId/releases", async (request, reply) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorPackageIdParamsSchema.parse(request.params);
    const body = createCreatorReleaseInputSchema.parse(request.body);
    const idempotencyKey = readOptionalIdempotencyKey(request);
    if (!idempotencyKey) {
      return await creatorService.createRelease(params.packageId, toCreatorActor(authContext), body);
    }
    const result = await executeIdempotent({
      scope: "creator.release.create",
      key: idempotencyKey,
      actorId: `${authContext.user.userId}:${authContext.currentWorkspace.workspaceId}`,
      request: { packageId: params.packageId, body },
      execute: () => creatorService.createRelease(params.packageId, toCreatorActor(authContext), body),
    });
    reply.header("Idempotency-Status", result.replayed ? "replayed" : "created");
    return result.value;
  });

  server.patch("/packages/:packageId/releases/:releaseId", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorReleaseIdParamsSchema.parse(request.params);
    const body = updateCreatorReleaseInputSchema.parse(request.body);
    return await creatorService.updateRelease(params.packageId, params.releaseId, toCreatorActor(authContext), body);
  });

  server.get("/releases/:releaseId/gates", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    const params = creatorReleaseIdOnlyParamsSchema.parse(request.params);
    return await creatorService.listReleaseGates(
      params.releaseId,
      authContext ? toCreatorActor(authContext) : undefined
    );
  });

  server.post("/releases/:releaseId/gates/:gateId/decide", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorReleaseGateIdParamsSchema.parse(request.params);
    const body = decideCreatorReleaseGateInputSchema.parse(request.body);
    return await creatorService.decideReleaseGate(params.releaseId, params.gateId, toCreatorActor(authContext), body);
  });

  server.get("/releases/:releaseId/activations", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    const params = creatorReleaseIdOnlyParamsSchema.parse(request.params);
    return creatorService.listReleaseActivations(
      params.releaseId,
      authContext ? toCreatorActor(authContext) : undefined
    );
  });

  server.post("/releases/:releaseId/activate", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorGovernanceRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorReleaseIdOnlyParamsSchema.parse(request.params);
    const body = activateCreatorReleaseInputSchema.parse(request.body ?? {});
    return await creatorService.activateRelease(params.releaseId, toCreatorActor(authContext), body);
  });

  server.get("/packages/:packageId/replays", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    const params = creatorPackageIdParamsSchema.parse(request.params);
    return creatorService.listPackageReplays(
      params.packageId,
      authContext ? toCreatorActor(authContext) : undefined
    );
  });

  server.post("/packages/:packageId/replays", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorPackageIdParamsSchema.parse(request.params);
    const body = createCreatorReplayInputSchema.parse(request.body);
    return await creatorService.createReplay(params.packageId, toCreatorActor(authContext), body);
  });

  server.patch("/packages/:packageId/replays/:replayId", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, creatorAccessRoles);
    if (!authContext) {
      return null;
    }

    const params = creatorReplayIdParamsSchema.parse(request.params);
    const body = updateCreatorReplayInputSchema.parse(request.body);
    return await creatorService.updateReplay(params.packageId, params.replayId, toCreatorActor(authContext), body);
  });
}
