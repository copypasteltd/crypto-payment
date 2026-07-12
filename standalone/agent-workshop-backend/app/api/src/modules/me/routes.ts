import type { FastifyInstance } from "fastify";
import {
  listMeAssetsQuerySchema,
  listMeAuthorizationsQuerySchema,
  listMeFavoriteWorkshopsQuerySchema,
  listMeNoticesQuerySchema,
  listMeRecentActivitiesQuerySchema,
  meNoticeSummarySchema,
  recordMeRecentActivityInputSchema,
  setMeFavoriteWorkshopInputSchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { requireCurrentWorkspaceAccess } from "../auth/request-auth.js";
import { favoriteWorkshopParamsSchema } from "./storage-schema.js";
import { meService } from "./service.js";

export async function registerMeRoutes(server: FastifyInstance) {
  server.get("/summary", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);

    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    return meService.getProfileSummary({
      userId: authContext.user.userId,
      user: authContext.user,
      workspaceId: authContext.currentWorkspace.workspaceId,
      workspaceContextKey: authContext.currentWorkspace.contextKey,
      role: authContext.currentWorkspace.role,
      currentWorkspace: authContext.currentWorkspace,
    });
  });

  server.get("/assets", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);

    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const query = listMeAssetsQuerySchema.parse(request.query ?? {});
    return meService.listAssets(
      {
        userId: authContext.user.userId,
        user: authContext.user,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
        role: authContext.currentWorkspace.role,
        currentWorkspace: authContext.currentWorkspace,
      },
      query
    );
  });

  server.get("/authorizations", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);

    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const query = listMeAuthorizationsQuerySchema.parse(request.query ?? {});
    return meService.getAuthorizationSummary(
      {
        userId: authContext.user.userId,
        user: authContext.user,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
        role: authContext.currentWorkspace.role,
        currentWorkspace: authContext.currentWorkspace,
      },
      query
    );
  });

  server.get("/recent", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);

    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const query = listMeRecentActivitiesQuerySchema.parse(request.query ?? {});
    return meService.listRecentActivities(
      {
        userId: authContext.user.userId,
        user: authContext.user,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
        role: authContext.currentWorkspace.role,
        currentWorkspace: authContext.currentWorkspace,
      },
      query
    );
  });

  server.post("/recent/record", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);

    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const body = recordMeRecentActivityInputSchema.parse(request.body ?? {});
    return meService.recordRecentActivity(
      {
        userId: authContext.user.userId,
        user: authContext.user,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
        role: authContext.currentWorkspace.role,
        currentWorkspace: authContext.currentWorkspace,
      },
      body
    );
  });

  server.get("/favorites/workshops", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);

    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const query = listMeFavoriteWorkshopsQuerySchema.parse(request.query ?? {});
    return meService.listFavoriteWorkshops(
      {
        userId: authContext.user.userId,
        user: authContext.user,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
        role: authContext.currentWorkspace.role,
        currentWorkspace: authContext.currentWorkspace,
      },
      query
    );
  });

  server.put("/favorites/workshops/:workshopId", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);

    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const params = favoriteWorkshopParamsSchema.parse(request.params ?? {});
    const body = setMeFavoriteWorkshopInputSchema.parse(request.body ?? {});
    return meService.setFavoriteWorkshop(
      {
        userId: authContext.user.userId,
        user: authContext.user,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
        role: authContext.currentWorkspace.role,
        currentWorkspace: authContext.currentWorkspace,
      },
      params.workshopId,
      body
    );
  });

  server.get("/notices", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    const query = listMeNoticesQuerySchema.parse(request.query ?? {});

    if (!authContext) {
      return [];
    }

    return meService.listNotices(
      {
        userId: authContext.user.userId,
        user: authContext.user,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
        role: authContext.currentWorkspace.role,
        currentWorkspace: authContext.currentWorkspace,
      },
      query
    );
  });

  server.get("/notices/summary", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);

    if (!authContext) {
      return meNoticeSummarySchema.parse({
        totalCount: 0,
        latestOccurredAt: null,
        byType: [
          { type: "approval_pending", count: 0 },
          { type: "result_ready", count: 0 },
          { type: "run_failed", count: 0 },
          { type: "run_succeeded", count: 0 },
        ],
      });
    }

    return meService.getNoticeSummary({
      userId: authContext.user.userId,
      user: authContext.user,
      workspaceId: authContext.currentWorkspace.workspaceId,
      workspaceContextKey: authContext.currentWorkspace.contextKey,
      role: authContext.currentWorkspace.role,
      currentWorkspace: authContext.currentWorkspace,
    });
  });
}
