import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

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

async function seedNoticeState(storageRoot) {
  const { hashPassword } = await import("../dist/modules/auth/crypto.js");
  const workspaceId = "wsp_notice_team";
  const createdAt = "2026-07-09T00:00:00.000Z";
  const authState = {
    users: [
      {
        userId: "usr_notice_owner",
        email: "notice.owner@example.com",
        displayName: "Notice Owner",
        passwordHash: hashPassword("NoticeOwnerPass#2026"),
        createdAt,
        updatedAt: createdAt,
      },
    ],
    workspaces: [
      {
        workspaceId,
        slug: "notice-suite",
        name: "Brand Content Team",
        type: "enterprise",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    memberships: [
      {
        workspaceId,
        userId: "usr_notice_owner",
        role: "owner",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    sessions: [],
    invitations: [],
  };

  const catalogState = {
    contexts: [
      {
        contextKey: "brand-lab",
        runtimeWorkspaceId: workspaceId,
        displayName: {
          zh: "Brand Content Team",
          en: "Brand Content Team",
        },
        type: "enterprise",
        meta: {
          zh: "Content editors / notice suite",
          en: "Content editors / notice suite",
        },
        root: "/workspace/notice-suite/",
        allowedEntrySurfaces: ["dashboard", "h5", "mini-program"],
      },
    ],
    workshops: [],
    services: [],
    launchTemplates: [],
  };

  const creatorState = {
    packages: [],
    releases: [],
    replays: [],
    releaseGates: [],
    activations: [],
    auditExports: [],
  };

  const runsDir = path.join(storageRoot, "runs");
  const authDir = path.join(storageRoot, "auth");
  const workshopsDir = path.join(storageRoot, "workshops");
  const creatorDir = path.join(storageRoot, "creator");

  await mkdir(runsDir, { recursive: true });
  await mkdir(authDir, { recursive: true });
  await mkdir(workshopsDir, { recursive: true });
  await mkdir(creatorDir, { recursive: true });

  const approvalRun = createSeedRunAggregate({
    runId: "run_notice_approval",
    workspaceId,
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
  });

  const failedRun = createSeedRunAggregate({
    runId: "run_notice_failed",
    workspaceId,
    title: "Poster export retry",
    status: "FAILED",
    updatedAt: "2026-07-09T00:12:00.000Z",
    statusReason: "Renderer exited with code 1.",
  });

  const resultRun = createSeedRunAggregate({
    runId: "run_notice_result",
    workspaceId,
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
  });

  await Promise.all([
    writeFile(path.join(authDir, "auth-state.json"), JSON.stringify(authState, null, 2), "utf8"),
    writeFile(
      path.join(workshopsDir, "catalog-state.json"),
      JSON.stringify(catalogState, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(creatorDir, "creator-state.json"),
      JSON.stringify(creatorState, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(runsDir, "run_notice_approval.json"),
      JSON.stringify(approvalRun, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(runsDir, "run_notice_failed.json"),
      JSON.stringify(failedRun, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(runsDir, "run_notice_result.json"),
      JSON.stringify(resultRun, null, 2),
      "utf8"
    ),
  ]);
}

test("me notices read model exposes approval, failure, and result-ready items", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-me-notices-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
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
    const storageRoot = path.join(smokeRoot, "api-data");

    await seedNoticeState(storageRoot);

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = storageRoot;
    process.env.LINGBAN_AUTH_MODE = "required";
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
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

    const notices = await requestJson(`${baseUrl}/v1/me/notices?limit=6`, {
      headers: authHeaders,
    });

    assert.equal(notices.length, 3);
    assert.deepEqual(
      notices.map((notice) => notice.type),
      ["approval_pending", "run_failed", "result_ready"]
    );
    assert.equal(notices[0].target.resource, "run");
    assert.equal(notices[0].target.view, "audit");
    assert.equal(notices[1].target.view, "detail");
    assert.equal(notices[2].target.view, "files");
    assert.match(notices[0].summary.en, /pending approval/i);
    assert.match(notices[1].summary.en, /Renderer exited with code 1/i);
    assert.match(notices[2].summary.en, /result file/i);

    const summary = await requestJson(`${baseUrl}/v1/me/notices/summary`, {
      headers: authHeaders,
    });

    assert.equal(summary.totalCount, 3);
    assert.equal(summary.latestOccurredAt, "2026-07-09T00:13:00.000Z");
    assert.equal(
      summary.byType.find((item) => item.type === "approval_pending")?.count,
      1
    );
    assert.equal(summary.byType.find((item) => item.type === "run_failed")?.count, 1);
    assert.equal(summary.byType.find((item) => item.type === "result_ready")?.count, 1);
    assert.equal(summary.byType.find((item) => item.type === "run_succeeded")?.count, 0);
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
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
});
