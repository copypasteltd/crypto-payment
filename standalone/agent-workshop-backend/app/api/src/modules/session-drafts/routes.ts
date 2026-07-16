import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createSessionDraftInputSchema,
  createSessionDraftReplayInputSchema,
  createSessionDraftRevisionInputSchema,
  sealSessionDraftInputSchema,
  sessionCaptureIdSchema,
  sessionDraftIdSchema,
  sessionIdSchema,
  sessionVersionIdSchema,
  submitSessionRedactionReviewInputSchema,
} from "@lingban/contracts";
import { requireCurrentWorkspaceAccess, requireWorkspaceAccess } from "../auth/request-auth.js";
import { AppError } from "../../app/errors.js";
import { sessionCaptureService } from "../session-captures/service.js";
import { sessionCatalogService } from "../sessions/service.js";
import { sessionDraftService } from "./service.js";

const draftParamsSchema = z.object({ draftId: sessionDraftIdSchema });
const captureParamsSchema = z.object({ captureId: sessionCaptureIdSchema });
const sessionParamsSchema = z.object({ sessionId: sessionIdSchema });
const versionParamsSchema = z.object({ sessionVersionId: sessionVersionIdSchema });
const roles = ["owner", "admin", "creator"] as const;

export async function registerSessionDraftRoutes(server: FastifyInstance) {
  server.get("/sessions/:sessionId/versions", async (request) => {
    const { sessionId } = sessionParamsSchema.parse(request.params);
    const session = await sessionDraftService.getSession(sessionId);
    requireWorkspaceAccess(request, session.workspaceId, [...roles]);
    return { items: await sessionDraftService.listVersions(sessionId) };
  });

  server.get("/session-versions/:sessionVersionId", async (request) => {
    const { sessionVersionId } = versionParamsSchema.parse(request.params);
    try {
      const detail = await sessionDraftService.getVersion(sessionVersionId);
      requireWorkspaceAccess(request, detail.session.workspaceId, [...roles]);
      return detail.version;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "SESSION_VERSION_NOT_FOUND") throw error;
      const auth = requireCurrentWorkspaceAccess(request, [...roles]);
      const legacy = await sessionCatalogService.getSessionPack(
        sessionVersionId,
        auth
          ? {
              workspaceContextKey: auth.currentWorkspace.contextKey,
              userId: auth.user.userId,
            }
          : undefined
      );
      return {
        sessionVersionId: legacy.sessionVersionId,
        sessionId: legacy.sessionId,
        sourceType: "legacy-facade",
        legacyIncomplete: true,
        manifestVersion: "lingban.session-pack/v1",
        contentState: "sealed",
        createdAt: legacy.archiveRecordedAt ?? legacy.updatedAt,
        updatedAt: legacy.updatedAt,
        legacy,
      };
    }
  });

  server.get("/session-drafts", async (request) => {
    const auth = requireCurrentWorkspaceAccess(request, [...roles]);
    if (!auth) return { items: [] };
    return { items: await sessionDraftService.list(auth.currentWorkspace.workspaceId) };
  });

  server.post("/session-captures/:captureId/drafts", async (request) => {
    const { captureId } = captureParamsSchema.parse(request.params);
    const capture = await sessionCaptureService.get(captureId);
    const auth = requireWorkspaceAccess(request, capture.workspaceId, [...roles]);
    return sessionDraftService.createFromCapture(
      captureId,
      createSessionDraftInputSchema.parse(request.body),
      auth?.user.userId ?? null
    );
  });

  server.get("/session-drafts/:draftId", async (request) => {
    const { draftId } = draftParamsSchema.parse(request.params);
    const detail = await sessionDraftService.get(draftId);
    if (detail.session) requireWorkspaceAccess(request, detail.session.workspaceId, [...roles]);
    return detail;
  });

  server.post("/session-drafts/:draftId/revisions", async (request) => {
    const { draftId } = draftParamsSchema.parse(request.params);
    const detail = await sessionDraftService.get(draftId);
    const auth = detail.session ? requireWorkspaceAccess(request, detail.session.workspaceId, [...roles]) : null;
    return sessionDraftService.createRevision(draftId, createSessionDraftRevisionInputSchema.parse(request.body), auth?.user.userId ?? null);
  });

  server.post("/session-drafts/:draftId/redaction-review", async (request) => {
    const { draftId } = draftParamsSchema.parse(request.params);
    const detail = await sessionDraftService.get(draftId);
    const auth = detail.session ? requireWorkspaceAccess(request, detail.session.workspaceId, [...roles]) : null;
    return sessionDraftService.reviewRedaction(draftId, submitSessionRedactionReviewInputSchema.parse(request.body), auth?.user.userId ?? null);
  });

  server.post("/session-drafts/:draftId/replay", async (request) => {
    const { draftId } = draftParamsSchema.parse(request.params);
    const detail = await sessionDraftService.get(draftId);
    const auth = detail.session ? requireWorkspaceAccess(request, detail.session.workspaceId, [...roles]) : null;
    return sessionDraftService.replay(
      draftId,
      createSessionDraftReplayInputSchema.parse(request.body),
      auth?.user.userId ?? null
    );
  });

  server.post("/session-drafts/:draftId/seal", async (request) => {
    const { draftId } = draftParamsSchema.parse(request.params);
    const detail = await sessionDraftService.get(draftId);
    const auth = detail.session ? requireWorkspaceAccess(request, detail.session.workspaceId, [...roles]) : null;
    return sessionDraftService.seal(draftId, sealSessionDraftInputSchema.parse(request.body), auth?.user.userId ?? null);
  });
}
