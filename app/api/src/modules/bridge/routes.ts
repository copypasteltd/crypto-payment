import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  artifactSyncSchema,
  bridgeEventsIngestSchema,
  bridgeRegistrationSchema,
  runRuntimeUpdateSchema,
  runStatusUpdateSchema,
  type RunSnapshot,
  type StartRunJobPayload,
} from "@lingban/contracts";
import {
  createEmptyWorkspaceBaseArchive,
  createWorkspaceBaseArchiveFromDirectory,
  packSessionVersion,
  serializeSessionPackBundle,
  sessionPackWorkspaceBaseFileName,
} from "@lingban/session-pack";
import { buildApiMetricsText } from "../../app/ops.js";
import { buildInternalRuntimeDiagnosticsReport } from "../../app/runtime-diagnostics.js";
import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { runFileLifecycleManager } from "../runs/file-lifecycle.js";
import { runFileSecurityService } from "../uploads/file-security.js";
import { uploadRetentionManager } from "../uploads/retention.js";
import { credentialLifecycleManager } from "../credentials/lifecycle-manager.js";
import { credentialLifecycleCallbackManager } from "../credentials/callback-manager.js";
import { getCredentialBroker } from "../credentials/broker.js";
import { credentialsService } from "../credentials/service.js";
import { runIdParamsSchema } from "../runs/routes.js";
import { runsService } from "../runs/service.js";
import { sessionCatalogService, signSessionPackBundleForApiRuntime } from "../sessions/service.js";
import { bridgeRegistry } from "./registry.js";
import { withInternalIdempotency } from "./request-guard.js";
import {
  ensureSealedSessionVersionVerified,
  getSealedSessionVersion,
} from "../session-drafts/version-registry.js";
import { objectStore } from "../uploads/object-store.js";

const storageRetentionSweepBodySchema = z
  .object({
    dryRun: z.boolean().optional(),
  })
  .default({});

const runFileLifecycleSweepBodySchema = z
  .object({
    dryRun: z.boolean().optional(),
    runId: z.string().min(1).optional(),
    now: z.string().datetime({ offset: true }).optional(),
  })
  .default({});

const credentialLifecycleSweepBodySchema = z
  .object({
    dryRun: z.boolean().optional(),
    workspaceId: z.string().min(1).optional(),
    credentialId: z.string().min(1).optional(),
  })
  .default({});

const credentialCallbackSweepBodySchema = z
  .object({
    dryRun: z.boolean().optional(),
    provider: z.string().min(1).optional(),
    credentialId: z.string().min(1).optional(),
  })
  .default({});

function readHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildContentDisposition(fileName: string) {
  const fallback =
    fileName.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_").trim() ||
    "session-pack.json.gz";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function buildRuntimeFallbackSessionId(sessionVersionId: string) {
  const suffix = sessionVersionId
    .replace(/^sev_/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `ses_${suffix || "runtime_fallback"}`;
}

function buildRuntimeFallbackArchiveFileName(sessionVersionId: string) {
  return `${sessionVersionId}.session-pack.json.gz`;
}

function inferRuntimeFallbackBrowserRequirements(startJob: StartRunJobPayload) {
  const fingerprint = startJob.mcpBindings
    .map((binding) => [binding.mcpId, binding.displayName, binding.ref].join(" "))
    .join(" ")
    .toLowerCase();

  return {
    browserRequired: fingerprint.includes("browser"),
    playwrightRequired: fingerprint.includes("playwright"),
  };
}

async function buildRuntimeFallbackSessionPackArchive(
  snapshot: RunSnapshot,
  startJob: StartRunJobPayload
) {
  const sessionVersionId = snapshot.run.sessionVersionId;
  if (!sessionVersionId) {
    throw new AppError(
      409,
      "RUN_SESSION_PACK_NOT_APPLICABLE",
      `Run ${snapshot.run.runId} uses blank session bootstrap`
    );
  }
  const { browserRequired, playwrightRequired } =
    inferRuntimeFallbackBrowserRequirements(startJob);
  const connectors = startJob.mcpBindings.map((binding) => ({
    id: binding.mcpId,
    name: binding.displayName,
    protocol: binding.transport,
    risk_level: binding.riskLevel,
    required: true,
  }));
  const credentials = startJob.credentialMounts.map((mount) => ({
    id: mount.credentialId,
    placement: mount.mode,
    required: true,
  }));
  const conversationLines = snapshot.messages
    .map((message) =>
      JSON.stringify({
        role: message.role,
        kind: message.kind,
        text: message.text,
        created_at: message.createdAt,
      })
    )
    .join("\n");
  let workspaceBaseArchive: Uint8Array;
  try {
    workspaceBaseArchive = await createWorkspaceBaseArchiveFromDirectory(snapshot.run.targetPath, {
      ignoreMissingRoot: true,
      metadata: {
        source: "runtime-fallback",
        run_id: snapshot.run.runId,
        target_path: snapshot.run.targetPath,
      },
    });
  } catch (error) {
    workspaceBaseArchive = createEmptyWorkspaceBaseArchive({
      source: "runtime-fallback",
      run_id: snapshot.run.runId,
      target_path: snapshot.run.targetPath,
      capture_error: error instanceof Error ? error.message : "unknown workspace capture error",
    });
  }
  const bundle = signSessionPackBundleForApiRuntime(
    packSessionVersion({
    manifest: {
      session_id: buildRuntimeFallbackSessionId(sessionVersionId),
      session_version: sessionVersionId,
      task_family: snapshot.run.taskVersionId ?? snapshot.run.title,
      runtime_profile: {
        profile_id: `runtime-fallback:${sessionVersionId}`,
        browser_required: browserRequired || undefined,
        playwright_required: playwrightRequired || undefined,
      },
      slot_schema_version: "runtime-fallback.v1",
      required_capabilities: {
        browser: browserRequired || playwrightRequired || undefined,
        filesystem: true,
        downloads: true,
        mcps: connectors,
        credentials,
      },
      artifact_contract: {
        outputs: [
          {
            name: "output",
            kind: "directory",
            required: false,
            path_pattern: "output/**",
          },
          {
            name: "receipts",
            kind: "directory",
            required: false,
            path_pattern: "receipts/**",
          },
          {
            name: "archive",
            kind: "directory",
            required: false,
            path_pattern: "archive/**",
          },
        ],
      },
      created_by: {
        user_id: snapshot.run.requestedByUserId ?? "usr_system_runtime_fallback",
        display_name: "Runtime fallback",
      },
      created_at: snapshot.run.createdAt,
      source: {
        workspace_id: snapshot.run.workspaceId,
      },
      metadata: {
        runtime_fallback: true,
        entry_surface: snapshot.run.entrySurface,
        target_path: snapshot.run.targetPath,
      },
    },
    files: {
      "conversation.jsonl":
        conversationLines ||
        `${JSON.stringify({
          role: "system",
          kind: "prompt",
          text: startJob.initialPrompt,
          created_at: snapshot.run.createdAt,
        })}\n`,
      [sessionPackWorkspaceBaseFileName]: workspaceBaseArchive,
      "slot-schema.json": JSON.stringify(
        {
          version: "runtime-fallback.v1",
          slots: [
            {
              key: "request_context",
              title: "Request context",
              type: "string",
              required: false,
              prompt: "Describe the context and missing inputs for this run.",
            },
          ],
        },
        null,
        2
      ),
      "mcp-requirements.json": JSON.stringify(
        {
          connectors,
          credentials,
        },
        null,
        2
      ),
      "runtime-profile.json": JSON.stringify(
        {
          profile_id: `runtime-fallback:${snapshot.run.sessionVersionId}`,
          browser_required: browserRequired || undefined,
          playwright_required: playwrightRequired || undefined,
        },
        null,
        2
      ),
      "redaction-map.json": JSON.stringify(
        {
          version: "runtime-fallback.v1",
          rules: [],
        },
        null,
        2
      ),
    },
    })
  );

  return {
    content: serializeSessionPackBundle(bundle),
    fileName: buildRuntimeFallbackArchiveFileName(sessionVersionId),
    source: "runtime-fallback" as const,
  };
}

export async function registerBridgeInternalRoutes(server: FastifyInstance) {
  server.addHook("onRequest", async (request) => {
    const expectedToken = getApiRuntimeConfig().internalAuthToken;
    if (!expectedToken) {
      return;
    }

    const providedToken = readHeaderValue(request.headers["x-lingban-internal-token"]);
    if (!providedToken || providedToken !== expectedToken) {
      throw new AppError(401, "INTERNAL_AUTH_INVALID", "Internal bridge request is not authorized");
    }
  });

  server.post("/bridges/register", async (request) => {
    const body = bridgeRegistrationSchema.parse(request.body);
    runsService.getRun(body.runId);
    const registration = bridgeRegistry.register(body);
    await bridgeRegistry.flushPersistence();
    return registration;
  });

  server.post("/runs/:runId/events", async (request, reply) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = bridgeEventsIngestSchema.parse(request.body);
    return await withInternalIdempotency(
      request,
      reply,
      {
        requestKind: "runs.events",
        runId: params.runId,
      },
      async () => await runsService.ingestBridgeEvents(params.runId, body.events)
    );
  });

  server.post("/runs/:runId/status", async (request, reply) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = runStatusUpdateSchema.parse(request.body);
    return await withInternalIdempotency(
      request,
      reply,
      {
        requestKind: "runs.status",
        runId: params.runId,
      },
      async () =>
        await runsService.syncRunStatus(
          params.runId,
          body.status,
          body.reason ?? null,
          body.occurredAt
        )
    );
  });

  server.post("/runs/:runId/runtime", async (request, reply) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = runRuntimeUpdateSchema.parse(request.body);
    return await withInternalIdempotency(
      request,
      reply,
      {
        requestKind: "runs.runtime",
        runId: params.runId,
      },
      async () => await runsService.syncRunRuntime(params.runId, body)
    );
  });

  server.post("/runs/:runId/artifacts", async (request, reply) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = artifactSyncSchema.parse(request.body);
    return await withInternalIdempotency(
      request,
      reply,
      {
        requestKind: "runs.artifacts",
        runId: params.runId,
      },
      async () => await runsService.syncArtifacts(params.runId, body.artifacts)
    );
  });

  server.get("/runs/:runId/snapshot", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    return runsService.getRun(params.runId);
  });

  server.get("/runs/:runId/session-pack/archive", async (request, reply) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    if (!snapshot.run.sessionVersionId) {
      throw new AppError(
        409,
        "RUN_SESSION_PACK_NOT_APPLICABLE",
        `Run ${snapshot.run.runId} uses blank session bootstrap`
      );
    }
    const sealedVersion = getSealedSessionVersion(snapshot.run.sessionVersionId);
    if (sealedVersion) {
      await ensureSealedSessionVersionVerified(sealedVersion.sessionVersionId);
      reply.header("content-type", "application/zstd");
      reply.header(
        "content-disposition",
        buildContentDisposition(`${sealedVersion.sessionVersionId}.session-pack.tar.zst`)
      );
      reply.header("x-lingban-session-pack-source", "sealed-v2");
      reply.header(
        "x-lingban-session-pack-file-name",
        `${sealedVersion.sessionVersionId}.session-pack.tar.zst`
      );
      return reply.send(await objectStore.createReadStream(sealedVersion.packObjectKey));
    }
    let exported;
    try {
      exported = await sessionCatalogService.exportSessionPackArchiveForRun(params.runId);
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "SESSION_PACK_NOT_FOUND") {
        throw error;
      }

      exported = await buildRuntimeFallbackSessionPackArchive(
        snapshot,
        runsService.getStartRunJobPayload(params.runId)
      );
    }

    reply.header("content-type", "application/gzip");
    reply.header("content-disposition", buildContentDisposition(exported.fileName));
    reply.header("x-lingban-session-pack-source", exported.source);
    reply.header("x-lingban-session-pack-file-name", exported.fileName);
    return reply.send(Buffer.from(exported.content));
  });

  server.post("/runs/:runId/credentials/materialize", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    const startJob = runsService.getStartRunJobPayload(params.runId);

    return await credentialsService.materializeRunCredentials({
      runId: params.runId,
      workspaceId: snapshot.run.workspaceId,
      requestedByUserId: snapshot.run.requestedByUserId ?? null,
      mounts: startJob.credentialMounts,
      traceId: readHeaderValue(request.headers["x-lingban-trace-id"]) ?? null,
    });
  });

  server.get("/runtime/diagnostics", async () => {
    return await buildInternalRuntimeDiagnosticsReport();
  });

  server.get("/storage-retention", async () => {
    return uploadRetentionManager.getDiagnostics();
  });

  server.get("/run-file-lifecycle", async () => {
    return runFileLifecycleManager.getDiagnostics();
  });

  server.get("/file-security", async () => {
    return await runFileSecurityService.getDiagnostics();
  });

  server.get("/credentials/broker/health", async () => {
    const broker = getCredentialBroker();
    const readiness = await broker.checkReadiness();
    return {
      provider: broker.provider,
      activeKeyId: broker.activeKeyId,
      usesDefaultKey: broker.usesDefaultKey,
      readiness,
    };
  });

  server.get("/credentials/lifecycle", async () => {
    return credentialLifecycleManager.getDiagnostics();
  });

  server.get("/credentials/callbacks", async () => {
    return credentialLifecycleCallbackManager.getDiagnostics();
  });

  server.post("/storage-retention/sweep", async (request) => {
    const body = storageRetentionSweepBodySchema.parse(request.body ?? {});
    return await uploadRetentionManager.sweepNow({
      dryRun: body.dryRun ?? false,
    });
  });

  server.post("/run-file-lifecycle/sweep", async (request) => {
    const body = runFileLifecycleSweepBodySchema.parse(request.body ?? {});
    return await runFileLifecycleManager.sweepNow({
      dryRun: body.dryRun ?? false,
      runId: body.runId,
      now: body.now ? new Date(body.now) : undefined,
    });
  });

  server.post("/credentials/lifecycle/sweep", async (request) => {
    const body = credentialLifecycleSweepBodySchema.parse(request.body ?? {});
    return await credentialLifecycleManager.sweepNow({
      dryRun: body.dryRun ?? false,
      workspaceId: body.workspaceId,
      credentialId: body.credentialId,
    });
  });

  server.post("/credentials/callbacks/sweep", async (request) => {
    const body = credentialCallbackSweepBodySchema.parse(request.body ?? {});
    return await credentialLifecycleCallbackManager.sweepNow({
      dryRun: body.dryRun ?? false,
      provider: body.provider,
      credentialId: body.credentialId,
    });
  });

  server.get("/metrics", async (_request, reply) => {
    reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
    return await buildApiMetricsText();
  });

  server.get("/runs/recovery", async () => {
    return {
      candidates: runsService.listRuntimeRecoveryCandidates(),
    };
  });

  server.get("/runs/:runId/recovery", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    return runsService.getRuntimeRecoveryCandidate(params.runId);
  });
}
