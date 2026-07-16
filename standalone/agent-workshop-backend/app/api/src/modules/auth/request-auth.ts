import type { FastifyRequest } from "fastify";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { AppError } from "../../app/errors.js";
import { authService } from "./service.js";
import type { WorkspaceRole } from "@lingban/contracts";

export type AuthRequestContext = ReturnType<typeof authService.authenticateAccessToken>;

declare module "fastify" {
  interface FastifyRequest {
    authContext?: AuthRequestContext | null;
  }
}

function readHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readBearerToken(request: FastifyRequest) {
  const authorization = readHeaderValue(request.headers.authorization);
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const cookies = request.headers.cookie
    ?.split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const adminAccessCookie = cookies
    ?.find((item) => item.startsWith("lingban_admin_access="))
    ?.slice("lingban_admin_access=".length);
  if (adminAccessCookie) {
    try {
      return decodeURIComponent(adminAccessCookie);
    } catch {
      return adminAccessCookie;
    }
  }

  const query = request.query as Record<string, unknown> | undefined;
  const queryToken = query?.accessToken;
  return typeof queryToken === "string" && queryToken.trim().length > 0
    ? queryToken.trim()
    : undefined;
}

export function isAuthRequired() {
  return getApiRuntimeConfig().authMode === "required";
}

export function requireRequestAuth(request: FastifyRequest) {
  if (!isAuthRequired()) {
    request.authContext = null;
    return null;
  }

  if (request.authContext) {
    return request.authContext;
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
  }

  const authContext = authService.authenticateAccessToken(accessToken);
  request.authContext = authContext;
  return authContext;
}

export function resolveOptionalRequestAuth(request: FastifyRequest) {
  if (!isAuthRequired()) {
    request.authContext = null;
    return null;
  }

  if (request.authContext) {
    return request.authContext;
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const authContext = authService.authenticateAccessToken(accessToken);
  request.authContext = authContext;
  return authContext;
}

export function requireWorkspaceAccess(
  request: FastifyRequest,
  workspaceId: string,
  allowedRoles?: WorkspaceRole[]
) {
  const authContext = requireRequestAuth(request);
  if (!authContext) {
    return null;
  }

  const workspace = authContext.workspaces.find((item) => item.workspaceId === workspaceId);
  if (!workspace || workspace.membershipStatus !== "active") {
    throw new AppError(
      403,
      "WORKSPACE_ACCESS_DENIED",
      `Workspace access denied: ${workspaceId}`
    );
  }

  if (allowedRoles && !allowedRoles.includes(workspace.role)) {
    throw new AppError(
      403,
      "WORKSPACE_ROLE_FORBIDDEN",
      `Workspace role ${workspace.role} cannot access this action`
    );
  }

  return authContext;
}

export function requireCurrentWorkspaceAccess(
  request: FastifyRequest,
  allowedRoles?: WorkspaceRole[]
) {
  const authContext = requireRequestAuth(request);
  if (!authContext) {
    return null;
  }

  const workspace = authContext.currentWorkspace;
  if (workspace.membershipStatus !== "active") {
    throw new AppError(
      403,
      "WORKSPACE_ACCESS_DENIED",
      `Workspace access denied: ${workspace.workspaceId}`
    );
  }

  if (allowedRoles && !allowedRoles.includes(workspace.role)) {
    throw new AppError(
      403,
      "WORKSPACE_ROLE_FORBIDDEN",
      `Workspace role ${workspace.role} cannot access this action`
    );
  }

  return authContext;
}

export function requirePlatformAdmin(request: FastifyRequest) {
  const authContext = requireRequestAuth(request);
  if (!authContext) {
    return null;
  }

  if (!authContext.platformAccess.isPlatformAdmin) {
    throw new AppError(
      403,
      "PLATFORM_ADMIN_REQUIRED",
      "Platform administrator access is required"
    );
  }

  return authContext;
}
