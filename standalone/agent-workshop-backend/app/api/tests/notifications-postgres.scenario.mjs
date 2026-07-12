import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
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

function createSeedRunAggregate(options) {
  const {
    runId,
    workspaceId,
    title,
    status,
    updatedAt,
    entrySurface = "dashboard",
    statusReason = null,
    files = [],
    approvals = [],
  } = options;

  const baseRun = {
    runId,
    workspaceId,
    taskVersionId: `tsv_${runId}`,
    sessionVersionId: `sev_${runId}`,
    requestedByUserId: "usr_notice_owner",
    title,
    targetPath: `/workspace/notice-suite/${runId}/`,
    entrySurface,
    catalogMetadata: {
      workspaceContextKey: "brand-lab",
      workspaceContextName: {
        zh: "Brand Content Team",
        en: "Brand Content Team",
      },
      workshopId: "brand-poster-suite",
      workshopName: {
        zh: "Brand Content Workshop",
        en: "Brand Content Workshop",
      },
      serviceId: "poster-batch",
      serviceName: {
        zh: "Brand Poster Batch",
        en: "Brand Poster Batch",
      },
    },
    status,
    statusReason,
    createdAt: updatedAt,
    updatedAt,
  };

  return {
    run: baseRun,
    runtime: {
      launchMode: "docker",
      containerName: `ctr_${runId}`,
      startedAt: updatedAt,
      readyAt: updatedAt,
      finishedAt: status === "SUCCEEDED" || status === "FAILED" ? updatedAt : null,
      exitCode: status === "FAILED" ? 1 : 0,
      exitSignal: null,
    },
    input: {
      workspaceId,
      taskVersionId: baseRun.taskVersionId,
      sessionVersionId: baseRun.sessionVersionId,
      requestedByUserId: "usr_notice_owner",
      title,
      targetPath: baseRun.targetPath,
      entrySurface,
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      catalogMetadata: baseRun.catalogMetadata,
    },
    startJob: {
      run: baseRun,
      initialPrompt: "Please tell me what information I need to provide to you.",
      requestedInitialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      credentialMounts: [],
      mcpBindings: [],
    },
    messages: [
      {
        messageId: `msg_${runId}`,
        runId,
        role: "agent",
        kind: "text",
        text: title,
        attachments: [],
        createdAt: updatedAt,
      },
    ],
    files,
    artifacts: [],
    approvals,
  };
}

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-api-notifications-pg-"));
const envBackup = new Map();
const envKeys = [
  "API_HOST",
  "API_PORT",
  "DATABASE_URL",
  "LINGBAN_DATA_DIR",
  "LINGBAN_CATALOG_STORE",
  "LINGBAN_WORKSHOP_CATALOG_STORE",
  "LINGBAN_CREATOR_STORE",
  "LINGBAN_RUNS_STORE",
  "LINGBAN_RUN_EVENTS_STORE",
  "LINGBAN_INTERNAL_CALLBACKS_STORE",
  "LINGBAN_AUTH_STORE",
  "LINGBAN_UPLOADS_STORE",
  "LINGBAN_RUN_FILES_STORE",
  "LINGBAN_BRIDGE_REGISTRY_STORE",
  "LINGBAN_CREDENTIALS_STORE",
  "LINGBAN_MCP_STORE",
  "LINGBAN_QUOTA_STORE",
  "LINGBAN_BILLING_STORE",
  "LINGBAN_NOTIFICATIONS_STORE",
  "LINGBAN_FAVORITES_STORE",
  "LINGBAN_RECENT_STORE",
  "LINGBAN_SEARCH_STORE",
  "LINGBAN_AUTH_MODE",
  "LINGBAN_RUNS_DIR",
  "LINGBAN_RUNTIME_LAUNCH_MODE",
  "LINGBAN_API_BASE_URL",
  "LINGBAN_INTERNAL_AUTH_TOKEN",
  "CODEX_BIN",
];

for (const key of envKeys) {
  envBackup.set(key, process.env[key]);
}

let app = null;

try {
  const port = await allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const fakePool = createFakePostgresPool();
  const storageRoot = path.join(smokeRoot, "api-data");

  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT = String(port);
  process.env.DATABASE_URL = "postgres://fake/lingban";
  process.env.LINGBAN_DATA_DIR = storageRoot;
  process.env.LINGBAN_CATALOG_STORE = "postgres";
  process.env.LINGBAN_WORKSHOP_CATALOG_STORE = "postgres";
  process.env.LINGBAN_CREATOR_STORE = "postgres";
  process.env.LINGBAN_RUNS_STORE = "postgres";
  process.env.LINGBAN_RUN_EVENTS_STORE = "postgres";
  process.env.LINGBAN_INTERNAL_CALLBACKS_STORE = "postgres";
  process.env.LINGBAN_AUTH_STORE = "postgres";
  process.env.LINGBAN_UPLOADS_STORE = "postgres";
  process.env.LINGBAN_RUN_FILES_STORE = "postgres";
  process.env.LINGBAN_BRIDGE_REGISTRY_STORE = "postgres";
  process.env.LINGBAN_CREDENTIALS_STORE = "postgres";
  process.env.LINGBAN_MCP_STORE = "postgres";
  process.env.LINGBAN_QUOTA_STORE = "postgres";
  process.env.LINGBAN_BILLING_STORE = "postgres";
  delete process.env.LINGBAN_NOTIFICATIONS_STORE;
  process.env.LINGBAN_FAVORITES_STORE = "postgres";
  process.env.LINGBAN_RECENT_STORE = "postgres";
  process.env.LINGBAN_SEARCH_STORE = "postgres";
  process.env.LINGBAN_AUTH_MODE = "required";
  process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
  process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
  process.env.LINGBAN_API_BASE_URL = baseUrl;
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
  process.env.CODEX_BIN = process.execPath;

  const [
    { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests },
    { getApiRuntimeConfig, resetApiRuntimeConfigForTests },
    { hashPassword },
    { authRepository },
    { runsRepository },
    { startApiServer },
  ] = await Promise.all([
    import("../dist/app/database.js"),
    import("../dist/app/runtime.js"),
    import("../dist/modules/auth/crypto.js"),
    import("../dist/modules/auth/repository.js"),
    import("../dist/modules/runs/repository.js"),
    import("../dist/index.js"),
  ]);

  setApiDatabasePoolFactoryForTests(() => fakePool);
  resetApiRuntimeConfigForTests();

  const runtimeConfig = getApiRuntimeConfig();
  assert.equal(runtimeConfig.notificationsStore, "postgres");

  await authRepository.init();
  await authRepository.createUser({
    userId: "usr_notice_owner",
    email: "notice.owner@example.com",
    displayName: "Notice Owner",
    passwordHash: hashPassword("NoticeOwnerPass#2026"),
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });
  await authRepository.createWorkspace({
    workspaceId: "wsp_notice_team",
    slug: "notice-suite",
    name: "Brand Content Team",
    type: "enterprise",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });
  await authRepository.addMembership({
    workspaceId: "wsp_notice_team",
    userId: "usr_notice_owner",
    role: "owner",
    status: "active",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });

  await runsRepository.init();
  await runsRepository.save(
    createSeedRunAggregate({
      runId: "run_notice_approval",
      workspaceId: "wsp_notice_team",
      title: "Poster review approval",
      status: "WAITING_APPROVAL",
      updatedAt: "2026-07-09T00:13:00.000Z",
      approvals: [
        {
          approvalId: "apr_notice_approval",
          runId: "run_notice_approval",
          kind: "general",
          relatedResourceRef: null,
          prompt: "Approve the selected poster batch.",
          state: "pending",
          requestedAt: "2026-07-09T00:13:00.000Z",
          decidedAt: null,
          note: null,
        },
      ],
    })
  );
  await runsRepository.save(
    createSeedRunAggregate({
      runId: "run_notice_failed",
      workspaceId: "wsp_notice_team",
      title: "Poster export retry",
      status: "FAILED",
      updatedAt: "2026-07-09T00:12:00.000Z",
      statusReason: "Renderer exited with code 1.",
    })
  );
  await runsRepository.save(
    createSeedRunAggregate({
      runId: "run_notice_result",
      workspaceId: "wsp_notice_team",
      title: "Poster bundle delivery",
      status: "SUCCEEDED",
      updatedAt: "2026-07-09T00:11:00.000Z",
      files: [
        {
          path: "/workspace/notice-suite/run_notice_result/output/poster-bundle.zip",
          name: "poster-bundle.zip",
          kind: "output",
          sizeBytes: 4096,
          updatedAt: "2026-07-09T00:11:00.000Z",
        },
      ],
    })
  );

  app = await startApiServer();

  const login = await requestJson(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "notice.owner@example.com",
      password: "NoticeOwnerPass#2026",
    }),
  });

  const authHeaders = {
    authorization: `Bearer ${login.tokens.accessToken}`,
  };

  const notifications = await requestJson(`${baseUrl}/v1/notifications?limit=6`, {
    headers: authHeaders,
  });
  assert.equal(notifications.length, 3);

  const marked = await requestJson(
    `${baseUrl}/v1/notifications/${encodeURIComponent(notifications[1].notificationId)}/read`,
    {
      method: "POST",
      headers: authHeaders,
    }
  );
  assert.equal(marked.isRead, true);

  const allReadSummary = await requestJson(`${baseUrl}/v1/notifications/read-all`, {
    method: "POST",
    headers: authHeaders,
  });
  assert.equal(allReadSummary.unreadCount, 0);

  const debugTables = fakePool.__debugTables();
  const notificationsStatePath = path.join(
    storageRoot,
    "notifications",
    "notifications-state.json"
  );

  assert.equal(debugTables.lingban_notification_read_receipts.length, 1);
  assert.equal(debugTables.lingban_notification_read_cursors.length, 1);
  assert.equal(existsSync(notificationsStatePath), false);

  process.stdout.write(
    `${JSON.stringify({
      storage: "postgres",
      notificationsStore: runtimeConfig.notificationsStore,
      readReceiptsCount: debugTables.lingban_notification_read_receipts.length,
      cursorsCount: debugTables.lingban_notification_read_cursors.length,
      notificationsStateFileExists: existsSync(notificationsStatePath),
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
