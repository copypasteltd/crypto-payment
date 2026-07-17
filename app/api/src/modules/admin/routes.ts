import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  adminExecuteActionInputSchema,
  adminImpactRequestSchema,
  adminListQuerySchema,
  createQuotaPolicyInputSchema,
  createCredentialInputSchema,
  createMcpInputSchema,
  createProviderInputSchema,
  loginAuthInputSchema,
  probeMcpInputSchema,
  rotateCredentialInputSchema,
  updateCredentialInputSchema,
  updateMcpInputSchema,
  updateProviderInputSchema,
  updateQuotaPolicyInputSchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { requirePlatformAdmin } from "../auth/request-auth.js";
import { authService } from "../auth/service.js";
import { credentialsService } from "../credentials/service.js";
import { mcpService } from "../mcp/service.js";
import { providersService } from "../providers/service.js";
import { quotaRepository } from "../quotas/repository.js";
import { quotaService } from "../quotas/service.js";
import { adminService } from "./service.js";
import {
  clearAdminSessionCookies,
  createAdminCsrfToken,
  readAdminCsrfToken,
  readAdminRefreshToken,
  requireAdminCsrf,
  setAdminCsrfCookie,
  setAdminSessionCookies,
  validateAdminCsrfToken,
} from "./session.js";

const idParamsSchema = z.object({ id: z.string().trim().min(1).max(240) });
const settingParamsSchema = z.object({ key: z.string().trim().min(1).max(160) });
const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(240) });
const settingBodySchema = z.object({
  value: z.record(z.string(), z.unknown()),
  expectedVersion: z.number().int().positive().nullable().default(null),
  reason: z.string().trim().min(8).max(2000),
});
const reasonSchema = z.string().trim().min(8).max(2000);
const providerCredentialSetupSchema = z.object({
  workspaceId: z.string().trim().min(1).max(160).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  apiKey: z.string().min(1).max(65_536),
  makeDefaultBinding: z.boolean().default(false),
});
const providerAuthenticationSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("none"),
  }),
  providerCredentialSetupSchema.extend({
    mode: z.literal("bearer"),
  }),
]);
const createProviderBodySchema = z.object({
  input: createProviderInputSchema,
  authentication: providerAuthenticationSchema.default({ mode: "none" }),
  reason: reasonSchema,
});
const updateProviderBodySchema = z.object({
  input: updateProviderInputSchema,
  authentication: providerCredentialSetupSchema.optional(),
  reason: reasonSchema,
});
const createProviderCredentialBodySchema = z.object({
  input: providerCredentialSetupSchema,
  reason: reasonSchema,
});
const diagnoseProviderBodySchema = z.object({
  input: z.object({ credentialId: z.string().trim().min(1).max(160).optional() }).default({}),
  reason: reasonSchema.default("Manual Admin Provider health check"),
});
const syncProviderModelsBodySchema = z.object({
  input: z.object({ credentialId: z.string().trim().min(1).max(160).optional() }).default({}),
  reason: reasonSchema.default("Manual Admin Provider model synchronization"),
});
const fetchProviderModelsFromConfigurationBodySchema = z.object({
  input: z.object({
    baseUrl: z.string().url(),
    healthcheckPath: z.string().trim().min(1).max(240).default("/models"),
    apiKey: z.string().min(1).max(65_536).optional(),
  }),
  reason: reasonSchema.default("Preview upstream Provider models before saving"),
});
const testProviderBodySchema = z.object({
  input: z.object({
    model: z.string().trim().min(1).max(160).optional(),
    endpointType: z.enum(["auto", "openai", "openai-response"]).default("auto"),
    stream: z.boolean().default(false),
  }).default({ endpointType: "auto", stream: false }),
  reason: reasonSchema.default("Test Provider model connectivity"),
});
const applyProviderModelsBodySchema = z.object({
  input: z.object({
    modelIds: z.array(z.string().trim().min(1).max(160)).min(1).max(500),
    defaultModel: z.string().trim().min(1).max(160),
  }),
  reason: reasonSchema,
});
const createMcpBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(160).optional(),
  input: createMcpInputSchema,
  reason: reasonSchema,
});
const updateMcpBodySchema = z.object({ input: updateMcpInputSchema, reason: reasonSchema });
const probeMcpBodySchema = z.object({
  input: probeMcpInputSchema.default({}),
  reason: reasonSchema.default("Manual Admin MCP health probe"),
});
const syncMcpToolsBodySchema = z.object({
  input: probeMcpInputSchema.default({}),
  reason: reasonSchema.default("Manual Admin MCP tool synchronization"),
});
const createCredentialBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(160).optional(),
  input: createCredentialInputSchema,
  reason: reasonSchema,
});
const updateCredentialBodySchema = z.object({ input: updateCredentialInputSchema, reason: reasonSchema });
const rotateCredentialBodySchema = z.object({ input: rotateCredentialInputSchema, reason: reasonSchema });
const createQuotaBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(160).optional(),
  input: createQuotaPolicyInputSchema,
  reason: reasonSchema,
});
const updateQuotaBodySchema = z.object({
  workspaceId: z.string().trim().min(1).max(160).optional(),
  input: updateQuotaPolicyInputSchema,
  reason: reasonSchema,
});

function readHeader(request: FastifyRequest, name: string) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function toActor(auth: NonNullable<ReturnType<typeof requirePlatformAdmin>>) {
  return {
    user: auth.user,
    session: auth.session,
    currentWorkspace: auth.currentWorkspace,
  };
}

function toProviderActor(auth: NonNullable<ReturnType<typeof requirePlatformAdmin>>) {
  return {
    workspaceId: auth.currentWorkspace.workspaceId,
    userId: auth.user.userId,
    role: auth.currentWorkspace.role,
    isPlatformAdmin: true,
  };
}

function toWorkspaceOwnerActor(
  auth: NonNullable<ReturnType<typeof requirePlatformAdmin>>,
  workspaceId = auth.currentWorkspace.workspaceId
) {
  return { workspaceId, userId: auth.user.userId, role: "owner" as const };
}

function requestMetadata(request: FastifyRequest) {
  return {
    requestId: request.id,
    traceId: readHeader(request, "x-trace-id") ?? null,
    sourceIp: request.ip,
    userAgent: readHeader(request, "user-agent") ?? null,
    clientRelease: readHeader(request, "x-client-release") ?? null,
  };
}

type ProviderCredentialSetup = z.infer<typeof providerCredentialSetupSchema>;

function toProviderWorkspaceActor(
  auth: NonNullable<ReturnType<typeof requirePlatformAdmin>>,
  workspaceId: string
) {
  return {
    workspaceId,
    userId: auth.user.userId,
    role: "owner" as const,
    isPlatformAdmin: true,
  };
}

function diagnosticFailure(error: unknown) {
  return {
    status: "failed" as const,
    error: {
      code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Provider diagnostic failed",
    },
  };
}

async function openProviderApiKey(
  auth: NonNullable<ReturnType<typeof requirePlatformAdmin>>,
  providerId: string,
  reason: string,
  request: FastifyRequest,
  credentialId?: string
) {
  const current = adminService.getProvider(providerId);
  const resolvedCredentialId = credentialId ?? current.bindings.find(
    (item) => item.enabled && item.workspaceId === auth.currentWorkspace.workspaceId
  )?.credentialId;
  if (!resolvedCredentialId) return null;
  return await credentialsService.openCredentialForAdminProbe({
    credentialId: resolvedCredentialId,
    actorUserId: auth.user.userId,
    isPlatformAdmin: true,
    reason,
    traceId: requestMetadata(request).traceId,
  });
}

async function createAndBindProviderCredential(params: {
  auth: NonNullable<ReturnType<typeof requirePlatformAdmin>>;
  provider: { providerId: string; displayName: string; authEnvName: string };
  input: ProviderCredentialSetup;
  reason: string;
  request: FastifyRequest;
}) {
  const workspaceId = params.input.workspaceId ?? params.auth.currentWorkspace.workspaceId;
  const credentialActor = toWorkspaceOwnerActor(params.auth, workspaceId);
  const current = adminService.getProvider(params.provider.providerId);
  const existingBinding = current.bindings.find((item) => item.workspaceId === workspaceId);
  const previousCredential = existingBinding
    ? adminService.getCredential(existingBinding.credentialId).credential
    : null;
  let credential = existingBinding
    ? await credentialsService.rotateCredential(
        existingBinding.credentialId,
        credentialActor,
        {
          secretValue: params.input.apiKey,
          secretRef: null,
          note: params.reason,
        }
      )
    : await credentialsService.createCredential(credentialActor, {
        scope: "workspace",
        displayName: params.input.displayName ?? `${params.provider.displayName} API Key`,
        provider: params.provider.providerId,
        secretKind: "api-key",
        mountMode: "env",
        secretValue: params.input.apiKey,
        secretRef: null,
        envName: params.provider.authEnvName,
        expiresAt: null,
        rotationDueAt: null,
        notes: `Provider authentication for ${params.provider.providerId}`,
      });
  if (existingBinding && params.input.displayName && params.input.displayName !== credential.displayName) {
    credential = await credentialsService.updateCredential(
      credential.credentialId,
      credentialActor,
      { displayName: params.input.displayName }
    );
  }
  await adminService.recordMutation(
    toActor(params.auth),
    {
      action: existingBinding ? "rotate" : "create",
      resourceType: "credential",
      resourceId: credential.credentialId,
      workspaceId,
      reason: params.reason,
      before: previousCredential,
      after: credential,
    },
    requestMetadata(params.request)
  );

  const providerActor = toProviderWorkspaceActor(params.auth, workspaceId);
  let binding;
  try {
    binding = await providersService.configurePlatformBinding(providerActor, {
      providerId: params.provider.providerId,
      credentialId: credential.credentialId,
      enabled: true,
      isDefault: params.input.makeDefaultBinding || existingBinding?.isDefault || false,
      priority: existingBinding?.priority ?? 100,
      allowUserOverride: existingBinding?.allowUserOverride ?? true,
      notes: "Created by the Admin Provider authentication workflow",
    });
  } catch (error) {
    if (!existingBinding) {
      await credentialsService.setCredentialLifecycleStatus(
        credential.credentialId,
        credentialActor,
        {
          status: "disabled",
          note: "Provider credential binding failed during Admin onboarding",
        }
      );
    }
    throw error;
  }
  await adminService.recordMutation(
    toActor(params.auth),
    {
      action: existingBinding ? "rotate-bound-credential" : "create-credential-binding",
      resourceType: "provider",
      resourceId: params.provider.providerId,
      workspaceId,
      reason: params.reason,
      before: existingBinding ?? null,
      after: binding,
    },
    requestMetadata(params.request)
  );

  return { credential, binding };
}

async function buildBootstrap(
  auth: {
    user: { userId: string; email: string; displayName: string };
    session: {
      sessionId: string;
      accessTokenExpiresAt: string;
      refreshTokenExpiresAt: string;
    };
  },
  csrfToken: string
) {
  const system = await adminService.getSystem();
  return {
    user: {
      userId: auth.user.userId,
      email: auth.user.email,
      displayName: auth.user.displayName,
    },
    role: "platform_admin" as const,
    session: {
      sessionId: auth.session.sessionId,
      accessTokenExpiresAt: auth.session.accessTokenExpiresAt,
      refreshTokenExpiresAt: auth.session.refreshTokenExpiresAt,
    },
    csrfToken,
    system: {
      status: system.readiness.status === "ready" ? ("ready" as const) : ("not_ready" as const),
      release: system.release,
      checkedAt: system.checkedAt,
    },
  };
}

function requireAdmin(request: FastifyRequest, csrf = false) {
  const auth = requirePlatformAdmin(request);
  if (!auth) {
    throw new AppError(401, "ADMIN_AUTH_REQUIRED", "Admin authentication is required");
  }
  if (csrf) requireAdminCsrf(request, auth.session.sessionId);
  return auth;
}

async function sessionBootstrap(request: FastifyRequest, reply: FastifyReply) {
  const auth = requireAdmin(request);
  let csrfToken = readAdminCsrfToken(request);
  if (!csrfToken || !validateAdminCsrfToken(csrfToken, auth.session.sessionId)) {
    csrfToken = createAdminCsrfToken(auth.session.sessionId);
    const maxAge = Math.max(
      1,
      Math.floor((new Date(auth.session.refreshTokenExpiresAt).getTime() - Date.now()) / 1000)
    );
    setAdminCsrfCookie(reply, csrfToken, maxAge);
  }
  return buildBootstrap(auth, csrfToken);
}

export async function registerAdminRoutes(server: FastifyInstance) {
  server.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Pragma", "no-cache");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
  });

  server.post("/auth/login", async (request, reply) => {
    const body = loginAuthInputSchema.parse(request.body);
    const session = await authService.login(body);
    if (!session.platformAccess.isPlatformAdmin) {
      await authService.logout(session.session.sessionId, session.tokens.refreshToken);
      throw new AppError(403, "PLATFORM_ADMIN_REQUIRED", "Platform administrator access is required");
    }
    const csrfToken = createAdminCsrfToken(session.session.sessionId);
    setAdminSessionCookies(reply, session, csrfToken);
    return buildBootstrap(session, csrfToken);
  });

  server.post("/auth/refresh", async (request, reply) => {
    const refreshToken = readAdminRefreshToken(request);
    if (!refreshToken) {
      throw new AppError(401, "AUTH_REFRESH_REQUIRED", "Admin refresh token is required");
    }
    const session = await authService.refresh({ refreshToken });
    if (!session.platformAccess.isPlatformAdmin) {
      await authService.logout(session.session.sessionId, session.tokens.refreshToken);
      clearAdminSessionCookies(reply);
      throw new AppError(403, "PLATFORM_ADMIN_REQUIRED", "Platform administrator access is required");
    }
    const csrfToken = createAdminCsrfToken(session.session.sessionId);
    setAdminSessionCookies(reply, session, csrfToken);
    return buildBootstrap(session, csrfToken);
  });

  server.post("/auth/logout", async (request, reply) => {
    const csrfToken = readAdminCsrfToken(request);
    if (!csrfToken || !validateAdminCsrfToken(csrfToken)) {
      throw new AppError(403, "ADMIN_CSRF_INVALID", "Admin CSRF validation failed");
    }
    requireAdminCsrf(request);
    const auth = requirePlatformAdmin(request);
    await authService.logout(auth?.session.sessionId ?? "", readAdminRefreshToken(request));
    clearAdminSessionCookies(reply);
    return { ok: true };
  });

  server.get("/auth/session", sessionBootstrap);
  server.get("/bootstrap", sessionBootstrap);
  server.get("/me", sessionBootstrap);

  server.get("/overview", async (request) => {
    requireAdmin(request);
    return adminService.getOverview();
  });
  server.get("/anomalies", async (request) => {
    requireAdmin(request);
    return (await adminService.getOverview()).anomalies;
  });
  server.get("/search", async (request) => {
    requireAdmin(request);
    return adminService.search(searchQuerySchema.parse(request.query).q);
  });

  server.get("/users", async (request) => {
    requireAdmin(request);
    return adminService.listUsers(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/users/:id", async (request) => {
    requireAdmin(request);
    return adminService.getUser(idParamsSchema.parse(request.params).id);
  });
  server.get("/workspaces", async (request) => {
    requireAdmin(request);
    return adminService.listWorkspaces(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/workspaces/:id", async (request) => {
    requireAdmin(request);
    return adminService.getWorkspace(idParamsSchema.parse(request.params).id);
  });
  server.get("/workshops", async (request) => {
    requireAdmin(request);
    return adminService.listWorkshops(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/workshops/:id", async (request) => {
    requireAdmin(request);
    return adminService.getWorkshop(idParamsSchema.parse(request.params).id);
  });
  server.get("/sessions", async (request) => {
    requireAdmin(request);
    return adminService.listSessions(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/sessions/:id", async (request) => {
    requireAdmin(request);
    return adminService.getSession(idParamsSchema.parse(request.params).id);
  });
  server.get("/runs", async (request) => {
    requireAdmin(request);
    return adminService.listRuns(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/runs/:id", async (request) => {
    requireAdmin(request);
    return adminService.getRun(idParamsSchema.parse(request.params).id);
  });
  server.get("/runtime", async (request) => {
    requireAdmin(request);
    return adminService.getRuntime();
  });
  server.get("/providers", async (request) => {
    requireAdmin(request);
    return adminService.listProviders(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/providers/:id", async (request) => {
    const auth = requireAdmin(request);
    const result = adminService.getProvider(idParamsSchema.parse(request.params).id);
    return {
      ...result,
      managementCredentialConfigured: result.bindings.some(
        (item) => item.enabled && item.workspaceId === auth.currentWorkspace.workspaceId
      ),
    };
  });
  server.post("/providers/fetch-models", async (request) => {
    const auth = requireAdmin(request, true);
    const body = fetchProviderModelsFromConfigurationBodySchema.parse(request.body ?? {});
    const result = await providersService.fetchProviderModelsFromConfiguration(
      toProviderActor(auth),
      body.input
    );
    return {
      ...result,
      addedModelIds: result.fetchedModelIds,
      existingModelIds: [],
      removedModelIds: [],
    };
  });
  server.post("/providers", async (request) => {
    const auth = requireAdmin(request, true);
    const body = createProviderBodySchema.parse(request.body);
    const createdProvider = await providersService.createProvider(toProviderActor(auth), body.input);
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "create",
        resourceType: "provider",
        resourceId: createdProvider.providerId,
        reason: body.reason,
        after: createdProvider,
      },
      requestMetadata(request)
    );

    let credentialSetup: Awaited<ReturnType<typeof createAndBindProviderCredential>> | null = null;
    if (body.authentication.mode === "bearer") {
      try {
        credentialSetup = await createAndBindProviderCredential({
          auth,
          provider: createdProvider,
          input: body.authentication,
          reason: body.reason,
          request,
        });
      } catch (error) {
        const disabledProvider = await providersService.updateProvider(
          toProviderActor(auth),
          createdProvider.providerId,
          { enabled: false }
        );
        await adminService.recordMutation(
          toActor(auth),
          {
            action: "authentication-setup-failed",
            resourceType: "provider",
            resourceId: createdProvider.providerId,
            reason: body.reason,
            before: createdProvider,
            after: {
              provider: disabledProvider,
              authentication: diagnosticFailure(error),
            },
          },
          requestMetadata(request)
        );
        throw error;
      }
    }
    return {
      ...providersService.getProvider(createdProvider.providerId),
      authentication: {
        status: body.authentication.mode === "bearer" ? "configured" : "not_configured",
        mode: body.authentication.mode,
        credentialId: credentialSetup?.credential.credentialId ?? null,
        bindingId: credentialSetup?.binding.bindingId ?? null,
        workspaceId: credentialSetup?.binding.workspaceId ?? null,
      },
    };
  });
  server.patch("/providers/:id", async (request) => {
    const auth = requireAdmin(request, true);
    const providerId = idParamsSchema.parse(request.params).id;
    const body = updateProviderBodySchema.parse(request.body);
    const before = providersService.getProvider(providerId);
    const result = await providersService.updateProvider(toProviderActor(auth), providerId, body.input);
    const credentialSetup = body.authentication
      ? await createAndBindProviderCredential({
          auth,
          provider: result,
          input: body.authentication,
          reason: body.reason,
          request,
        })
      : null;
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "update",
        resourceType: "provider",
        resourceId: providerId,
        reason: body.reason,
        before,
        after: result,
      },
      requestMetadata(request)
    );
    return {
      ...result,
      authentication: credentialSetup
        ? {
            status: "configured",
            credentialId: credentialSetup.credential.credentialId,
            bindingId: credentialSetup.binding.bindingId,
            workspaceId: credentialSetup.binding.workspaceId,
          }
        : undefined,
    };
  });
  server.post("/providers/:id/credentials", async (request) => {
    const auth = requireAdmin(request, true);
    const providerId = idParamsSchema.parse(request.params).id;
    const body = createProviderCredentialBodySchema.parse(request.body);
    const provider = providersService.getProvider(providerId);
    return await createAndBindProviderCredential({
      auth,
      provider,
      input: body.input,
      reason: body.reason,
      request,
    });
  });
  server.post("/providers/:id/fetch-models", async (request) => {
    const auth = requireAdmin(request, true);
    const providerId = idParamsSchema.parse(request.params).id;
    const body = syncProviderModelsBodySchema.parse(request.body ?? {});
    const apiKey = await openProviderApiKey(
      auth,
      providerId,
      body.reason,
      request,
      body.input.credentialId
    );
    return await providersService.fetchProviderModels(
      toProviderActor(auth),
      providerId,
      { apiKey }
    );
  });
  server.put("/providers/:id/models", async (request) => {
    const auth = requireAdmin(request, true);
    const providerId = idParamsSchema.parse(request.params).id;
    const body = applyProviderModelsBodySchema.parse(request.body ?? {});
    const before = providersService.getProvider(providerId);
    const result = await providersService.applyProviderModels(
      toProviderActor(auth),
      providerId,
      body.input
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "apply-model-catalog",
        resourceType: "provider",
        resourceId: providerId,
        reason: body.reason,
        before,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.post("/providers/:id/test", async (request) => {
    const auth = requireAdmin(request, true);
    const providerId = idParamsSchema.parse(request.params).id;
    const body = testProviderBodySchema.parse(request.body ?? {});
    const apiKey = await openProviderApiKey(auth, providerId, body.reason, request);
    const result = await providersService.testProvider(
      toProviderActor(auth),
      providerId,
      { ...body.input, apiKey }
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "test-model",
        resourceType: "provider",
        resourceId: providerId,
        reason: body.reason,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.post("/providers/:id/health-check", async (request) => {
    const auth = requireAdmin(request, true);
    const providerId = idParamsSchema.parse(request.params).id;
    const body = diagnoseProviderBodySchema.parse(request.body ?? {});
    const apiKey = await openProviderApiKey(
      auth,
      providerId,
      body.reason,
      request,
      body.input.credentialId
    );
    const result = await providersService.checkProviderHealth(
      toProviderActor(auth),
      providerId,
      { apiKey }
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "health-check",
        resourceType: "provider",
        resourceId: providerId,
        reason: body.reason,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.post("/providers/:id/model-sync", async (request) => {
    const auth = requireAdmin(request, true);
    const providerId = idParamsSchema.parse(request.params).id;
    const body = syncProviderModelsBodySchema.parse(request.body ?? {});
    const apiKey = await openProviderApiKey(
      auth,
      providerId,
      body.reason,
      request,
      body.input.credentialId
    );
    const result = await providersService.fetchProviderModels(
      toProviderActor(auth),
      providerId,
      { apiKey }
    );
    return { ...result, applied: false };
  });
  server.get("/mcps", async (request) => {
    requireAdmin(request);
    return adminService.listMcps(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/mcps/:id", async (request) => {
    requireAdmin(request);
    return adminService.getMcp(idParamsSchema.parse(request.params).id);
  });
  server.post("/mcps", async (request) => {
    const auth = requireAdmin(request, true);
    const body = createMcpBodySchema.parse(request.body);
    const actor = toWorkspaceOwnerActor(auth, body.workspaceId);
    const result = await mcpService.createMcp(actor, body.input);
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "create",
        resourceType: "mcp",
        resourceId: result.mcpId,
        workspaceId: actor.workspaceId,
        reason: body.reason,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.patch("/mcps/:id", async (request) => {
    const auth = requireAdmin(request, true);
    const mcpId = idParamsSchema.parse(request.params).id;
    const body = updateMcpBodySchema.parse(request.body);
    const current = adminService.getMcp(mcpId);
    const workspaceId = current.mcp.workspaceId ?? auth.currentWorkspace.workspaceId;
    const result = await mcpService.updateMcp(
      mcpId,
      toWorkspaceOwnerActor(auth, workspaceId),
      body.input
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "update",
        resourceType: "mcp",
        resourceId: mcpId,
        workspaceId,
        reason: body.reason,
        before: current.mcp,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.post("/mcps/:id/probe", async (request) => {
    const auth = requireAdmin(request, true);
    const mcpId = idParamsSchema.parse(request.params).id;
    const body = probeMcpBodySchema.parse(request.body ?? {});
    const current = adminService.getMcp(mcpId);
    const workspaceId = current.mcp.workspaceId ?? auth.currentWorkspace.workspaceId;
    const result = await mcpService.probeMcp(
      mcpId,
      toWorkspaceOwnerActor(auth, workspaceId),
      body.input
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "probe",
        resourceType: "mcp",
        resourceId: mcpId,
        workspaceId,
        reason: body.reason,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.post("/mcps/:id/tool-sync", async (request) => {
    const auth = requireAdmin(request, true);
    const mcpId = idParamsSchema.parse(request.params).id;
    const body = syncMcpToolsBodySchema.parse(request.body ?? {});
    const current = adminService.getMcp(mcpId);
    const workspaceId = current.mcp.workspaceId ?? auth.currentWorkspace.workspaceId;
    const result = await mcpService.probeMcp(
      mcpId,
      toWorkspaceOwnerActor(auth, workspaceId),
      body.input
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "tool-sync",
        resourceType: "mcp",
        resourceId: mcpId,
        workspaceId,
        reason: body.reason,
        before: current.mcp,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.get("/credentials", async (request) => {
    requireAdmin(request);
    return adminService.listCredentials(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/credentials/:id", async (request) => {
    requireAdmin(request);
    return adminService.getCredential(idParamsSchema.parse(request.params).id);
  });
  server.post("/credentials", async (request) => {
    const auth = requireAdmin(request, true);
    const body = createCredentialBodySchema.parse(request.body);
    const actor = toWorkspaceOwnerActor(auth, body.workspaceId);
    const result = await credentialsService.createCredential(actor, body.input);
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "create",
        resourceType: "credential",
        resourceId: result.credentialId,
        workspaceId: actor.workspaceId,
        reason: body.reason,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.patch("/credentials/:id", async (request) => {
    const auth = requireAdmin(request, true);
    const credentialId = idParamsSchema.parse(request.params).id;
    const body = updateCredentialBodySchema.parse(request.body);
    const current = adminService.getCredential(credentialId);
    const workspaceId = current.credential.workspaceId ?? auth.currentWorkspace.workspaceId;
    const result = await credentialsService.updateCredential(
      credentialId,
      toWorkspaceOwnerActor(auth, workspaceId),
      body.input
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "update",
        resourceType: "credential",
        resourceId: credentialId,
        workspaceId,
        reason: body.reason,
        before: current.credential,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.post("/credentials/:id/rotate", async (request) => {
    const auth = requireAdmin(request, true);
    const credentialId = idParamsSchema.parse(request.params).id;
    const body = rotateCredentialBodySchema.parse(request.body);
    const current = adminService.getCredential(credentialId);
    const workspaceId = current.credential.workspaceId ?? auth.currentWorkspace.workspaceId;
    const result = await credentialsService.rotateCredential(
      credentialId,
      toWorkspaceOwnerActor(auth, workspaceId),
      body.input
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "rotate",
        resourceType: "credential",
        resourceId: credentialId,
        workspaceId,
        reason: body.reason,
        before: current.credential,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.get("/quotas", async (request) => {
    requireAdmin(request);
    return adminService.listQuotas(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.post("/quotas", async (request) => {
    const auth = requireAdmin(request, true);
    const body = createQuotaBodySchema.parse(request.body);
    const actor = toWorkspaceOwnerActor(auth, body.workspaceId);
    const result = await quotaService.createPolicy(actor, body.input);
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "create",
        resourceType: "quota",
        resourceId: result.policyId,
        workspaceId: result.workspaceId,
        reason: body.reason,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.patch("/quotas/:id", async (request) => {
    const auth = requireAdmin(request, true);
    const policyId = idParamsSchema.parse(request.params).id;
    const body = updateQuotaBodySchema.parse(request.body);
    const before = quotaRepository.getPolicyById(policyId);
    if (!before) {
      throw new AppError(404, "QUOTA_POLICY_NOT_FOUND", `Quota policy not found: ${policyId}`);
    }
    const workspaceId = body.workspaceId ?? before.workspaceId;
    const result = await quotaService.updatePolicy(
      toWorkspaceOwnerActor(auth, workspaceId),
      policyId,
      body.input
    );
    await adminService.recordMutation(
      toActor(auth),
      {
        action: "update",
        resourceType: "quota",
        resourceId: policyId,
        workspaceId,
        reason: body.reason,
        before,
        after: result,
      },
      requestMetadata(request)
    );
    return result;
  });
  server.get("/ledger", async (request) => {
    requireAdmin(request);
    return adminService.listLedger(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/audit", async (request) => {
    requireAdmin(request);
    return adminService.listAudit(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/audit/events", async (request) => {
    requireAdmin(request);
    return adminService.listAudit(adminListQuerySchema.parse(request.query ?? {}));
  });
  server.get("/audit/events/:id", async (request) => {
    requireAdmin(request);
    return adminService.getAuditEvent(idParamsSchema.parse(request.params).id);
  });
  server.get("/system", async (request) => {
    requireAdmin(request);
    return adminService.getSystem();
  });
  server.get("/system/health", async (request) => {
    requireAdmin(request);
    const system = await adminService.getSystem();
    return { readiness: system.readiness, runtime: system.runtime, checkedAt: system.checkedAt };
  });

  server.post("/actions/impact", async (request) => {
    const auth = requireAdmin(request, true);
    return adminService.createImpact(toActor(auth), adminImpactRequestSchema.parse(request.body));
  });
  server.post("/actions/execute", async (request) => {
    const auth = requireAdmin(request, true);
    return adminService.executeAction(
      toActor(auth),
      adminExecuteActionInputSchema.parse(request.body),
      requestMetadata(request)
    );
  });
  server.put("/settings/:key", async (request) => {
    const auth = requireAdmin(request, true);
    const params = settingParamsSchema.parse(request.params);
    const body = settingBodySchema.parse(request.body);
    return adminService.saveSetting(
      toActor(auth),
      params.key,
      body.value,
      body.expectedVersion,
      body.reason,
      requestMetadata(request)
    );
  });
}
