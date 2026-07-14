import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  acceptWorkspaceInvitationInputSchema,
  createWorkspaceInvitationInputSchema,
  loginAuthInputSchema,
  logoutAuthInputSchema,
  refreshAuthInputSchema,
  registerAuthInputSchema,
  switchWorkspaceInputSchema,
  updateWorkspaceMembershipInputSchema,
  userIdSchema,
  workspaceInvitationIdSchema,
  workspaceIdSchema,
} from "@lingban/contracts";
import { authService } from "./service.js";
import { requireRequestAuth, resolveOptionalRequestAuth } from "./request-auth.js";

const workspaceIdParamsSchema = z.object({
  workspaceId: workspaceIdSchema,
});

const workspaceMemberParamsSchema = z.object({
  workspaceId: workspaceIdSchema,
  userId: userIdSchema,
});

const workspaceInvitationParamsSchema = z.object({
  workspaceId: workspaceIdSchema,
  invitationId: workspaceInvitationIdSchema,
});

const authInvitationParamsSchema = z.object({
  invitationId: workspaceInvitationIdSchema,
});

export async function registerAuthRoutes(server: FastifyInstance) {
  server.post("/register", async (request) => {
    const body = registerAuthInputSchema.parse(request.body);
    return await authService.register(body);
  });

  server.post("/login", async (request) => {
    const body = loginAuthInputSchema.parse(request.body);
    return await authService.login(body);
  });

  server.post("/refresh", async (request) => {
    const body = refreshAuthInputSchema.parse(request.body);
    return await authService.refresh(body);
  });

  server.post("/logout", async (request) => {
    const body = logoutAuthInputSchema.parse(request.body ?? {});
    const authContext = resolveOptionalRequestAuth(request);
    return await authService.logout(authContext?.session.sessionId ?? "", body.refreshToken);
  });

  server.get("/session", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return authService.getDisabledSessionBootstrap();
    }

    return authService.getSessionEnvelope(authContext.session.sessionId);
  });

  server.get("/invitations", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return [];
    }

    return authService.listMyInvitations(authContext.user.userId);
  });

  server.post("/invitations/:invitationId/accept", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = authInvitationParamsSchema.parse(request.params);
    const body = acceptWorkspaceInvitationInputSchema.parse(request.body);

    if (!authContext) {
      return {
        authMode: "disabled",
      };
    }

    return await authService.acceptWorkspaceInvitation(
      authContext.session.sessionId,
      authContext.user.userId,
      params.invitationId,
      body
    );
  });
}

export async function registerWorkspaceRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const authContext = requireRequestAuth(request);
    return authContext?.workspaces ?? [];
  });

  server.get("/:workspaceId/summary", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = workspaceIdParamsSchema.parse(request.params);

    if (!authContext) {
      return {
        authMode: "disabled",
      };
    }

    return authService.getWorkspaceProfileSummary(
      authContext.user.userId,
      params.workspaceId
    );
  });

  server.post("/switch", async (request) => {
    const authContext = requireRequestAuth(request);
    const body = switchWorkspaceInputSchema.parse(request.body);

    if (!authContext) {
      return {
        authMode: "disabled",
      };
    }

    return await authService.switchWorkspace(authContext.session.sessionId, body);
  });

  server.get("/:workspaceId/members", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = workspaceIdParamsSchema.parse(request.params);

    if (!authContext) {
      return [];
    }

    return authService.listWorkspaceMembers(authContext.user.userId, params.workspaceId);
  });

  server.patch("/:workspaceId/members/:userId", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = workspaceMemberParamsSchema.parse(request.params);
    const body = updateWorkspaceMembershipInputSchema.parse(request.body);

    if (!authContext) {
      return {
        authMode: "disabled",
      };
    }

    return await authService.updateWorkspaceMembership(
      authContext.user.userId,
      params.workspaceId,
      params.userId,
      body
    );
  });

  server.get("/:workspaceId/invitations", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = workspaceIdParamsSchema.parse(request.params);

    if (!authContext) {
      return [];
    }

    return authService.listWorkspaceInvitations(authContext.user.userId, params.workspaceId);
  });

  server.post("/:workspaceId/invitations", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = workspaceIdParamsSchema.parse(request.params);
    const body = createWorkspaceInvitationInputSchema.parse(request.body);

    if (!authContext) {
      return {
        authMode: "disabled",
      };
    }

    return await authService.inviteWorkspaceMember(
      authContext.user.userId,
      params.workspaceId,
      body
    );
  });

  server.post("/:workspaceId/invitations/:invitationId/revoke", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = workspaceInvitationParamsSchema.parse(request.params);

    if (!authContext) {
      return {
        authMode: "disabled",
      };
    }

    return await authService.revokeWorkspaceInvitation(
      authContext.user.userId,
      params.workspaceId,
      params.invitationId
    );
  });
}
