import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createFakePostgresPool } from "./support/fake-postgres-pool.mjs";

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate port"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
    server.once("error", reject);
  });
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();

  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText} ${text}`
  );

  return text ? JSON.parse(text) : null;
}

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-api-mcp-audit-pg-"));
const envBackup = new Map();
const envKeys = [
  "API_HOST",
  "API_PORT",
  "DATABASE_URL",
  "LINGBAN_DATA_DIR",
  "LINGBAN_RUNS_DIR",
  "LINGBAN_RUNTIME_LAUNCH_MODE",
  "LINGBAN_API_BASE_URL",
  "LINGBAN_INTERNAL_AUTH_TOKEN",
  "CODEX_BIN",
  "LINGBAN_AUTH_STORE",
  "LINGBAN_RUNS_STORE",
  "LINGBAN_RUN_EVENTS_STORE",
  "LINGBAN_CREDENTIALS_STORE",
  "LINGBAN_MCP_STORE",
  "LINGBAN_BILLING_STORE",
];

for (const key of envKeys) {
  envBackup.set(key, process.env[key]);
}

let app = null;

try {
  const port = await allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const fakePool = createFakePostgresPool();
  const targetPath = path.join(smokeRoot, "target");

  await mkdir(targetPath, { recursive: true });

  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT = String(port);
  process.env.DATABASE_URL = "postgres://fake/lingban";
  process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
  process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
  process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
  process.env.LINGBAN_API_BASE_URL = baseUrl;
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
  process.env.CODEX_BIN = process.execPath;
  process.env.LINGBAN_AUTH_STORE = "postgres";
  process.env.LINGBAN_RUNS_STORE = "postgres";
  process.env.LINGBAN_RUN_EVENTS_STORE = "postgres";
  process.env.LINGBAN_CREDENTIALS_STORE = "postgres";
  process.env.LINGBAN_MCP_STORE = "postgres";
  process.env.LINGBAN_BILLING_STORE = "postgres";

  const [
    { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests },
    { resetApiRuntimeConfigForTests },
    { startApiServer },
  ] = await Promise.all([
    import("../dist/app/database.js"),
    import("../dist/app/runtime.js"),
    import("../dist/index.js"),
  ]);

  setApiDatabasePoolFactoryForTests(() => fakePool);
  resetApiRuntimeConfigForTests();
  app = await startApiServer();

  const register = await requestJson(`${baseUrl}/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "smoke-postgres-mcp-audit@example.com",
      password: "TestPassword123!",
      displayName: "Smoke Postgres MCP Audit",
      workspaceName: "Postgres MCP Audit Workspace",
    }),
  });

  const authHeaders = {
    authorization: `Bearer ${register.tokens.accessToken}`,
    "content-type": "application/json",
  };

  const createdCredential = await requestJson(`${baseUrl}/v1/credentials`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      scope: "workspace",
      displayName: "Seedance Production Key",
      provider: "seedance",
      secretKind: "api-key",
      secretValue: "seedance-pg-key-001",
      secretRef: "vault://seedance/production",
      notes: "workspace seedance key",
    }),
  });

  await requestJson(`${baseUrl}/v1/mcp-bindings`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      mcpId: "workspace:seedance-api",
      scope: "workspace",
      credentialId: createdCredential.credentialId,
      autoAttach: true,
      approvalRequired: false,
      notes: "attach seedance by default",
    }),
  });

  const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      workspaceId: register.currentWorkspace.workspaceId,
      taskVersionId: "tsv_00000901",
      sessionVersionId: "sev_00000901",
      title: "Postgres MCP audit smoke",
      targetPath,
      entrySurface: "dashboard",
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
    }),
  });

  const runSnapshot = await requestJson(`${baseUrl}/v1/runs/${createdRun.run.runId}`, {
    headers: {
      authorization: authHeaders.authorization,
    },
  });
  assert.equal(runSnapshot.run.runId, createdRun.run.runId);

  const materializedSecrets = await requestJson(
    `${baseUrl}/internal/runs/${createdRun.run.runId}/credentials/materialize`,
    {
      method: "POST",
      headers: {
        "x-lingban-internal-token": "smoke-internal-token",
      },
    }
  );
  assert.equal(
    materializedSecrets.secrets[createdCredential.credentialId],
    "seedance-pg-key-001"
  );

  const materializationAuditBeforeRestart = await requestJson(
    `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/audit-events?limit=12`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  const materializedEventBeforeRestart = materializationAuditBeforeRestart.find(
    (event) => event.action === "materialized"
  );
  assert.equal(Boolean(materializedEventBeforeRestart), true);
  assert.equal(materializedEventBeforeRestart.runId, createdRun.run.runId);
  assert.equal(materializedEventBeforeRestart.leaseId, materializedSecrets.lease.leaseId);

  const credentialUsage = await requestJson(
    `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/usages`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(credentialUsage.summary.credentialId, createdCredential.credentialId);
  assert.equal(credentialUsage.summary.bindingCount, 1);
  assert.equal(credentialUsage.summary.totalRunCount, 1);
  assert.equal(credentialUsage.summary.activeRunCount, 1);

  const blockedSuspend = await fetch(
    `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/suspend`,
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    }
  );
  assert.equal(blockedSuspend.status, 409);
  const blockedSuspendBody = await blockedSuspend.json();
  assert.equal(blockedSuspendBody.error.code, "CREDENTIAL_ACTIVE_USAGE_PRESENT");

  await requestJson(`${baseUrl}/internal/runs/${createdRun.run.runId}/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-lingban-internal-token": "smoke-internal-token",
    },
    body: JSON.stringify({
      events: [
        {
          type: "mcp.call",
          call: {
            callId: "mcpcall_pg_0001",
            runId: createdRun.run.runId,
            workspaceId: register.currentWorkspace.workspaceId,
            requestedByUserId: createdRun.run.requestedByUserId ?? null,
            workspaceContextKey: createdRun.run.catalogMetadata?.workspaceContextKey ?? null,
            serviceId: createdRun.run.catalogMetadata?.serviceId ?? null,
            taskVersionId: createdRun.run.taskVersionId,
            sessionVersionId: createdRun.run.sessionVersionId,
            entrySurface: createdRun.run.entrySurface,
            mcpId: "workspace:seedance-api",
            bindingId: "mbd_00000001",
            toolName: "render_scene",
            requestId: "pg_render_scene_01",
            status: "success",
            startedAt: "2026-07-09T04:00:00.000Z",
            finishedAt: "2026-07-09T04:00:01.000Z",
            durationMs: 1000,
            inputSummary: "scene=episode-1",
            outputSummary: "artifact=shot-01.png",
            errorMessage: null,
            inputBytes: 128,
            outputBytes: 640,
            displayName: "Seedance Workspace Connector",
            source: "workspace-managed",
            transport: "http",
            ref: "https://mcp.workspace.internal/seedance",
            riskLevel: "medium",
            networkPolicyRef: "np_seedance_workspace",
            approvalRequired: false,
            occurredAt: "2026-07-09T04:00:01.000Z",
            recordedAt: "2026-07-09T04:00:02.000Z",
          },
        },
      ],
    }),
  });

  const beforeRestartCalls = await requestJson(
    `${baseUrl}/v1/mcp-calls?runId=${encodeURIComponent(createdRun.run.runId)}`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(beforeRestartCalls.length, 1);
  assert.equal(beforeRestartCalls[0].callId, "mcpcall_pg_0001");

  await app.close().catch(() => undefined);
  app = null;
  await resetApiDatabaseForTests();
  setApiDatabasePoolFactoryForTests(() => fakePool);
  resetApiRuntimeConfigForTests();
  app = await startApiServer();

  const afterRestartCalls = await requestJson(
    `${baseUrl}/v1/mcp-calls?runId=${encodeURIComponent(createdRun.run.runId)}`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(afterRestartCalls.length, 1);
  assert.equal(afterRestartCalls[0].callId, "mcpcall_pg_0001");

  const materializationAuditAfterRestart = await requestJson(
    `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/audit-events?limit=12`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(
    materializationAuditAfterRestart.some((event) => event.action === "materialized"),
    true
  );

  const billingEntries = await requestJson(
    `${baseUrl}/v1/billing/entries?runId=${encodeURIComponent(createdRun.run.runId)}&metric=mcp_calls`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(billingEntries.length, 1);
  assert.equal(billingEntries[0].source, "mcp-call");

  process.stdout.write(
    `${JSON.stringify({
      storage: "postgres",
      runId: createdRun.run.runId,
      callId: afterRestartCalls[0].callId,
      billingEntryId: billingEntries[0].entryId,
    })}\n`
  );

  await app.close().catch(() => undefined);
  app = null;
  await resetApiDatabaseForTests();
  resetApiRuntimeConfigForTests();
} finally {
  if (app) {
    await app.close().catch(() => undefined);
  }

  try {
    const [{ resetApiDatabaseForTests }, { resetApiRuntimeConfigForTests }] = await Promise.all([
      import("../dist/app/database.js"),
      import("../dist/app/runtime.js"),
    ]);
    await resetApiDatabaseForTests();
    resetApiRuntimeConfigForTests();
  } catch {
    // Ignore cleanup failures in smoke scenarios.
  }

  for (const [key, value] of envBackup) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
}
