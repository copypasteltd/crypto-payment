import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-api-internal-idem-"));
const envBackup = new Map();
const envKeys = [
  "API_HOST",
  "API_PORT",
  "DATABASE_URL",
  "LINGBAN_DATA_DIR",
  "LINGBAN_RUNS_STORE",
  "LINGBAN_RUN_EVENTS_STORE",
  "LINGBAN_INTERNAL_CALLBACKS_STORE",
  "LINGBAN_AUTH_STORE",
  "LINGBAN_INTERNAL_AUTH_TOKEN",
];

for (const key of envKeys) {
  envBackup.set(key, process.env[key]);
}

let app = null;

try {
  const port = await allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT = String(port);
  process.env.DATABASE_URL = "postgres://fake/lingban";
  process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
  process.env.LINGBAN_RUNS_STORE = "postgres";
  process.env.LINGBAN_RUN_EVENTS_STORE = "postgres";
  process.env.LINGBAN_INTERNAL_CALLBACKS_STORE = "postgres";
  process.env.LINGBAN_AUTH_STORE = "postgres";
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "internal-idem-token";

  const { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests } = await import(
    "../dist/app/database.js"
  );
  setApiDatabasePoolFactoryForTests(() => createFakePostgresPool());

  const { runOrchestrator } = await import("../dist/modules/runs/service.js");
  runOrchestrator.startRun = () => Promise.resolve();

  const { runEventBus } = await import("../dist/modules/realtime/event-bus.js");
  const { startApiServer } = await import("../dist/index.js");
  app = await startApiServer();

  const register = await requestJson(`${baseUrl}/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "internal-idem@example.com",
      password: "TestPassword123!",
      displayName: "Internal Idem",
      workspaceName: "Internal Idem Workspace",
    }),
  });

  const authHeaders = {
    authorization: `Bearer ${register.tokens.accessToken}`,
    "content-type": "application/json",
  };

  const createRun = await requestJson(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      workspaceId: register.currentWorkspace.workspaceId,
      taskVersionId: "tsv_00000001",
      sessionVersionId: "sev_00000001",
      title: "Internal idempotency smoke",
      targetPath: path.join(smokeRoot, "target"),
      entrySurface: "dashboard",
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
    }),
  });

  const runId = createRun.run.runId;
  const internalHeaders = {
    "content-type": "application/json",
    "x-lingban-internal-token": "internal-idem-token",
    "x-lingban-trace-id": "trace-internal-idem",
  };

  const statusBody = {
    status: "READY",
    reason: "idempotent status sync",
    occurredAt: "2026-07-08T10:00:00.000Z",
  };
  const statusKey = "cbk-status-1";
  await requestJson(`${baseUrl}/internal/runs/${runId}/status`, {
    method: "POST",
    headers: {
      ...internalHeaders,
      "x-lingban-idempotency-key": statusKey,
    },
    body: JSON.stringify(statusBody),
  });
  await requestJson(`${baseUrl}/internal/runs/${runId}/status`, {
    method: "POST",
    headers: {
      ...internalHeaders,
      "x-lingban-idempotency-key": statusKey,
    },
    body: JSON.stringify(statusBody),
  });

  const messageId = "msg_bridge_idem_1";
  const eventsKey = "cbk-events-1";
  const messageEvent = {
    type: "conversation.message",
    message: {
      messageId,
      runId,
      role: "agent",
      kind: "text",
      text: "bridge duplicate event should only persist once",
      attachments: [],
      createdAt: "2026-07-08T10:01:00.000Z",
    },
  };
  await requestJson(`${baseUrl}/internal/runs/${runId}/events`, {
    method: "POST",
    headers: {
      ...internalHeaders,
      "x-lingban-idempotency-key": eventsKey,
    },
    body: JSON.stringify({
      events: [messageEvent],
    }),
  });
  await requestJson(`${baseUrl}/internal/runs/${runId}/events`, {
    method: "POST",
    headers: {
      ...internalHeaders,
      "x-lingban-idempotency-key": eventsKey,
    },
    body: JSON.stringify({
      events: [messageEvent],
    }),
  });

  const artifactId = "art_bridge_idem_1";
  const artifactsKey = "cbk-artifacts-1";
  const artifact = {
    artifactId,
    runId,
    label: "report.txt",
    status: "ready",
    downloadUrl: null,
    file: {
      path: "/workspace/outputs/report.txt",
      name: "report.txt",
      kind: "output",
      sizeBytes: 42,
      updatedAt: "2026-07-08T10:02:00.000Z",
    },
  };
  await requestJson(`${baseUrl}/internal/runs/${runId}/artifacts`, {
    method: "POST",
    headers: {
      ...internalHeaders,
      "x-lingban-idempotency-key": artifactsKey,
    },
    body: JSON.stringify({
      artifacts: [artifact],
    }),
  });
  await requestJson(`${baseUrl}/internal/runs/${runId}/artifacts`, {
    method: "POST",
    headers: {
      ...internalHeaders,
      "x-lingban-idempotency-key": artifactsKey,
    },
    body: JSON.stringify({
      artifacts: [artifact],
    }),
  });

  const conflict = await fetch(`${baseUrl}/internal/runs/${runId}/events`, {
    method: "POST",
    headers: {
      ...internalHeaders,
      "x-lingban-idempotency-key": statusKey,
    },
    body: JSON.stringify({
      events: [messageEvent],
    }),
  });
  assert.equal(conflict.status, 409);

  const backlog = runEventBus.list(runId);
  assert.equal(
    backlog.filter(
      (entry) =>
        entry.event.type === "run.status.changed" &&
        entry.event.reason === "idempotent status sync"
    ).length,
    1
  );
  assert.equal(
    backlog.filter(
      (entry) =>
        entry.event.type === "conversation.message" &&
        entry.event.message.messageId === messageId
    ).length,
    1
  );
  assert.equal(
    backlog.filter(
      (entry) =>
        entry.event.type === "artifact.ready" &&
        entry.event.artifact.artifactId === artifactId
    ).length,
    1
  );

  const snapshot = await requestJson(`${baseUrl}/v1/runs/${runId}`, {
    headers: {
      authorization: authHeaders.authorization,
    },
  });
  assert.equal(snapshot.run.status, "READY");

  console.log(
    JSON.stringify({
      runId,
      backlogCount: backlog.length,
      statusEvents: backlog.filter((entry) => entry.event.type === "run.status.changed").length,
      messageEvents: backlog.filter((entry) => entry.event.type === "conversation.message").length,
      artifactEvents: backlog.filter((entry) => entry.event.type === "artifact.ready").length,
    })
  );

  await resetApiDatabaseForTests();
} finally {
  if (app) {
    await app.close().catch(() => undefined);
  }

  for (const key of envKeys) {
    const previous = envBackup.get(key);
    if (previous == null) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }

  await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
}
