import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { normalizeErrorPayload } from "./errors.js";
import { buildApiReadinessReport } from "./ops.js";
import { registerAuthRoutes, registerWorkspaceRoutes } from "../modules/auth/routes.js";
import { registerAdminRoutes } from "../modules/admin/routes.js";
import { initializeAdminInfrastructure } from "../modules/admin/service.js";
import { registerBatchRunRoutes } from "../modules/batch-runs/routes.js";
import { initializeBatchRunsInfrastructure } from "../modules/batch-runs/service.js";
import { initializeAuthInfrastructure } from "../modules/auth/service.js";
import { initializeBridgeInfrastructure } from "../modules/bridge/internal-callback-ledger.js";
import { bridgeRegistry } from "../modules/bridge/registry.js";
import { registerBridgeInternalRoutes } from "../modules/bridge/routes.js";
import { registerRealtimeSocketRoutes } from "../modules/realtime/socket-routes.js";
import { runFileLifecycleManager } from "../modules/runs/file-lifecycle.js";
import { registerRunRoutes } from "../modules/runs/routes.js";
import { initializeRunsInfrastructure, shutdownRunsRuntime } from "../modules/runs/service.js";
import { registerDownloadTicketRoutes, registerRunUploadRoutes } from "../modules/uploads/routes.js";
import { initializeUploadInfrastructure } from "../modules/uploads/service.js";
import { uploadRetentionManager } from "../modules/uploads/retention.js";
import { registerCreatorRoutes } from "../modules/creator/routes.js";
import { initializeCreatorInfrastructure } from "../modules/creator/service.js";
import { credentialLifecycleManager } from "../modules/credentials/lifecycle-manager.js";
import { credentialLifecycleCallbackManager } from "../modules/credentials/callback-manager.js";
import { registerCredentialRoutes } from "../modules/credentials/routes.js";
import { initializeCredentialsInfrastructure } from "../modules/credentials/service.js";
import { registerBillingRoutes } from "../modules/billing/routes.js";
import { initializeBillingInfrastructure } from "../modules/billing/service.js";
import { registerMeRoutes } from "../modules/me/routes.js";
import { initializeMeInfrastructure } from "../modules/me/service.js";
import { registerMcpRoutes } from "../modules/mcp/routes.js";
import { initializeMcpInfrastructure } from "../modules/mcp/service.js";
import { registerNotificationRoutes } from "../modules/notifications/routes.js";
import { initializeNotificationsInfrastructure } from "../modules/notifications/service.js";
import { registerProviderRoutes } from "../modules/providers/routes.js";
import { initializeProvidersInfrastructure } from "../modules/providers/service.js";
import { registerQuotaRoutes } from "../modules/quotas/routes.js";
import { initializeQuotaInfrastructure } from "../modules/quotas/service.js";
import { registerSearchRoutes } from "../modules/search/routes.js";
import { initializeSearchInfrastructure } from "../modules/search/service.js";
import { registerSessionRoutes } from "../modules/sessions/routes.js";
import { initializeSessionInfrastructure } from "../modules/sessions/service.js";
import { registerServiceCatalogRoutes, registerWorkshopRoutes } from "../modules/workshops/routes.js";
import { initializeWorkshopInfrastructure } from "../modules/workshops/service.js";

const defaultCorsAllowMethods = "GET,POST,PATCH,PUT,DELETE,OPTIONS";
const defaultCorsAllowHeaders =
  "Authorization,Content-Type,Accept,Origin,X-Admin-CSRF,X-Request-Id,X-Trace-Id,X-Client-Release";
const defaultCorsExposeHeaders = "Content-Disposition,Content-Length,Content-Type";

function normalizeConfiguredOrigins(rawValue: string | undefined) {
  return (rawValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveCorsAllowedOrigin(origin: string | undefined, configuredOrigins: string[]) {
  if (!origin) {
    return null;
  }

  if (configuredOrigins.length === 0) {
    return origin;
  }

  if (configuredOrigins.includes("*")) {
    return "*";
  }

  return configuredOrigins.includes(origin) ? origin : null;
}

export async function createServer() {
  await initializeAdminInfrastructure();
  await initializeAuthInfrastructure();
  await initializeBatchRunsInfrastructure();
  await initializeCredentialsInfrastructure();
  await initializeMcpInfrastructure();
  await initializeProvidersInfrastructure();
  await initializeBillingInfrastructure();
  await initializeNotificationsInfrastructure();
  await initializeMeInfrastructure();
  await initializeSearchInfrastructure();
  await initializeRunsInfrastructure();
  await initializeUploadInfrastructure();
  await initializeBridgeInfrastructure();
  await initializeWorkshopInfrastructure();
  await initializeSessionInfrastructure();
  await initializeCreatorInfrastructure();
  await initializeQuotaInfrastructure();

  const server = Fastify({
    logger: false,
  });
  const configuredCorsOrigins = normalizeConfiguredOrigins(process.env.LINGBAN_CORS_ALLOWED_ORIGINS);

  server.addContentTypeParser(
    "application/octet-stream",
    {
      parseAs: "buffer",
    },
    (_request, body, done) => {
      done(null, body);
    }
  );

  server.register(websocket);

  server.addHook("onRequest", async (request, reply) => {
    const requestOrigin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    const allowedOrigin = resolveCorsAllowedOrigin(requestOrigin, configuredCorsOrigins);

    if (allowedOrigin) {
      reply.header("Access-Control-Allow-Origin", allowedOrigin);
      reply.header("Vary", "Origin");
      if (allowedOrigin !== "*") {
        reply.header("Access-Control-Allow-Credentials", "true");
      }
      reply.header("Access-Control-Allow-Methods", defaultCorsAllowMethods);
      reply.header(
        "Access-Control-Allow-Headers",
        typeof request.headers["access-control-request-headers"] === "string" &&
          request.headers["access-control-request-headers"].trim().length > 0
          ? request.headers["access-control-request-headers"]
          : defaultCorsAllowHeaders
      );
      reply.header("Access-Control-Expose-Headers", defaultCorsExposeHeaders);
      reply.header("Access-Control-Max-Age", "600");
    }

    if (request.method === "OPTIONS") {
      reply.code(204);
      return reply.send();
    }

    return undefined;
  });

  server.setErrorHandler((error, _request, reply) => {
    const normalized = normalizeErrorPayload(error);
    reply.status(normalized.statusCode).send(normalized.payload);
  });

  server.addHook("onClose", async () => {
    await credentialLifecycleCallbackManager.stopSweeper().catch(() => undefined);
    await credentialLifecycleManager.stopSweeper().catch(() => undefined);
    await runFileLifecycleManager.stopSweeper().catch(() => undefined);
    await uploadRetentionManager.stopSweeper().catch(() => undefined);
    await bridgeRegistry.stopSweeper().catch(() => undefined);
    await bridgeRegistry.flushPersistence().catch(() => undefined);
    await shutdownRunsRuntime().catch(() => undefined);
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "api",
  }));

  server.get("/readyz", async (_request, reply) => {
    const readiness = await buildApiReadinessReport();
    reply.code(readiness.status === "ready" ? 200 : 503);
    return readiness;
  });

  server.register(registerAuthRoutes, {
    prefix: "/v1/auth",
  });

  server.register(registerAdminRoutes, {
    prefix: "/admin/v1",
  });

  server.register(registerWorkspaceRoutes, {
    prefix: "/v1/workspaces",
  });

  server.register(registerMeRoutes, {
    prefix: "/v1/me",
  });

  server.register(registerNotificationRoutes, {
    prefix: "/v1",
  });

  server.register(registerCredentialRoutes, {
    prefix: "/v1/credentials",
  });

  server.register(registerProviderRoutes, {
    prefix: "/v1",
  });

  server.register(registerWorkshopRoutes, {
    prefix: "/v1/workshops",
  });

  server.register(registerSearchRoutes, {
    prefix: "/v1/search",
  });

  server.register(registerServiceCatalogRoutes, {
    prefix: "/v1/services",
  });

  server.register(registerSessionRoutes, {
    prefix: "/v1/sessions",
  });

  server.register(registerCreatorRoutes, {
    prefix: "/v1",
  });

  server.register(registerMcpRoutes, {
    prefix: "/v1",
  });

  server.register(registerQuotaRoutes, {
    prefix: "/v1",
  });

  server.register(registerBillingRoutes, {
    prefix: "/v1",
  });

  server.register(registerBatchRunRoutes, {
    prefix: "/v1/batch-runs",
  });

  server.register(registerRunRoutes, {
    prefix: "/v1/runs",
  });

  server.register(registerRunUploadRoutes, {
    prefix: "/v1/runs",
  });

  server.register(registerDownloadTicketRoutes, {
    prefix: "/v1/downloads",
  });

  server.register(registerRealtimeSocketRoutes, {
    prefix: "/ws/runs",
  });

  server.register(registerBridgeInternalRoutes, {
    prefix: "/internal",
  });

  bridgeRegistry.startSweeper();
  credentialLifecycleCallbackManager.startSweeper();
  credentialLifecycleManager.startSweeper();
  uploadRetentionManager.startSweeper();
  runFileLifecycleManager.startSweeper();

  return server;
}
