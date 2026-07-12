import type { FastifyInstance } from "fastify";
import {
  listNotificationsQuerySchema,
  notificationRecordSchema,
  notificationSummarySchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { requireCurrentWorkspaceAccess } from "../auth/request-auth.js";
import { notificationsService } from "./service.js";

function buildZeroSummary() {
  return notificationSummarySchema.parse({
    totalCount: 0,
    unreadCount: 0,
    latestOccurredAt: null,
    byType: [
      { type: "approval_pending", count: 0, unreadCount: 0 },
      { type: "result_ready", count: 0, unreadCount: 0 },
      { type: "run_failed", count: 0, unreadCount: 0 },
      { type: "run_succeeded", count: 0, unreadCount: 0 },
    ],
  });
}

export async function registerNotificationRoutes(server: FastifyInstance) {
  server.get("/notifications", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    const query = listNotificationsQuerySchema.parse(request.query ?? {});

    if (!authContext) {
      return [];
    }

    return notificationsService.listNotifications(
      {
        userId: authContext.user.userId,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
      },
      query
    );
  });

  server.get("/notifications/summary", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    if (!authContext) {
      return buildZeroSummary();
    }

    return notificationsService.getNotificationSummary({
      userId: authContext.user.userId,
      workspaceId: authContext.currentWorkspace.workspaceId,
      workspaceContextKey: authContext.currentWorkspace.contextKey,
    });
  });

  server.post("/notifications/:notificationId/read", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    if (!authContext) {
      throw new AppError(
        400,
        "NOTIFICATIONS_UNAVAILABLE",
        "Notifications are unavailable when auth mode is disabled."
      );
    }

    const params = request.params as { notificationId?: string };
    return notificationsService.markNotificationRead(
      {
        userId: authContext.user.userId,
        workspaceId: authContext.currentWorkspace.workspaceId,
        workspaceContextKey: authContext.currentWorkspace.contextKey,
      },
      notificationRecordSchema.shape.notificationId.parse(params.notificationId)
    );
  });

  server.post("/notifications/read-all", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    if (!authContext) {
      return buildZeroSummary();
    }

    return notificationsService.markAllRead({
      userId: authContext.user.userId,
      workspaceId: authContext.currentWorkspace.workspaceId,
      workspaceContextKey: authContext.currentWorkspace.contextKey,
    });
  });
}
