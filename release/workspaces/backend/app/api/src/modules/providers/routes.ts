import type { FastifyInstance } from "fastify";
import {
  createProviderInputSchema,
  createWorkspaceProviderBindingInputSchema,
  listProvidersQuerySchema,
  listWorkspaceProviderBindingsQuerySchema,
  updateProviderInputSchema,
  updateWorkspaceProviderBindingInputSchema,
} from "@lingban/contracts";
import {
  requireCurrentWorkspaceAccess,
  requirePlatformAdmin,
} from "../auth/request-auth.js";
import { providersService } from "./service.js";
import {
  providerIdParamsSchema,
  workspaceProviderBindingIdParamsSchema,
} from "./storage-schema.js";

function toActor(authContext: NonNullable<ReturnType<typeof requireCurrentWorkspaceAccess>>) {
  return {
    workspaceId: authContext.currentWorkspace.workspaceId,
    userId: authContext.user.userId,
    role: authContext.currentWorkspace.role,
    isPlatformAdmin: authContext.platformAccess.isPlatformAdmin,
  };
}

export async function registerProviderRoutes(server: FastifyInstance) {
  server.get("/providers", async (request) => {
    requireCurrentWorkspaceAccess(request);
    const query = listProvidersQuerySchema.parse(request.query);
    return providersService.listProviders(query);
  });

  server.post("/providers", async (request) => {
    const authContext = requirePlatformAdmin(request);
    if (!authContext) {
      return null;
    }

    const body = createProviderInputSchema.parse(request.body);
    return await providersService.createProvider(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
        isPlatformAdmin: authContext.platformAccess.isPlatformAdmin,
      },
      body
    );
  });

  server.patch("/providers/:providerId", async (request) => {
    const authContext = requirePlatformAdmin(request);
    if (!authContext) {
      return null;
    }

    const params = providerIdParamsSchema.parse(request.params);
    const body = updateProviderInputSchema.parse(request.body);
    return await providersService.updateProvider(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
        isPlatformAdmin: authContext.platformAccess.isPlatformAdmin,
      },
      params.providerId,
      body
    );
  });

  server.post("/providers/:providerId/healthcheck", async (request) => {
    const authContext = requirePlatformAdmin(request);
    if (!authContext) {
      return null;
    }

    const params = providerIdParamsSchema.parse(request.params);
    return await providersService.checkProviderHealth(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
        isPlatformAdmin: authContext.platformAccess.isPlatformAdmin,
      },
      params.providerId
    );
  });

  server.get("/provider-bindings", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    if (!authContext) {
      return [];
    }

    const query = listWorkspaceProviderBindingsQuerySchema.parse(request.query);
    return providersService.listWorkspaceBindings(toActor(authContext), query);
  });

  server.post("/provider-bindings", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, ["owner", "admin"]);
    if (!authContext) {
      return null;
    }

    const body = createWorkspaceProviderBindingInputSchema.parse(request.body);
    return await providersService.createWorkspaceBinding(toActor(authContext), body);
  });

  server.patch("/provider-bindings/:bindingId", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, ["owner", "admin"]);
    if (!authContext) {
      return null;
    }

    const params = workspaceProviderBindingIdParamsSchema.parse(request.params);
    const body = updateWorkspaceProviderBindingInputSchema.parse(request.body);
    return await providersService.updateWorkspaceBinding(
      toActor(authContext),
      params.bindingId,
      body
    );
  });
}
