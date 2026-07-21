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
    entrySurface = "h5",
    statusReason = null,
    files = [],
    approvals = [],
  } = options;

  const baseRun = {
    runId,
    workspaceId,
    taskVersionId: `tsv_${runId}`,
    sessionVersionId: `sev_${runId}`,
    requestedByUserId: "usr_me_owner",
    title,
    targetPath: `/workspace/me-suite/${runId}/`,
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
      requestedByUserId: "usr_me_owner",
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

async function seedMeState(storageRoot) {
  const { hashPassword } = await import("../dist/modules/auth/crypto.js");
  const workspaceId = "wsp_me_team";
  const createdAt = "2026-07-09T00:00:00.000Z";

  const authState = {
    users: [
      {
        userId: "usr_me_owner",
        email: "me.owner@example.com",
        displayName: "Me Owner",
        passwordHash: hashPassword("MeOwnerPass#2026"),
        createdAt,
        updatedAt: createdAt,
      },
    ],
    workspaces: [
      {
        workspaceId,
        slug: "me-suite",
        name: "Brand Content Team",
        type: "enterprise",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    memberships: [
      {
        workspaceId,
        userId: "usr_me_owner",
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
          zh: "Content editors / me suite",
          en: "Content editors / me suite",
        },
        root: "/workspace/me-suite/",
        allowedEntrySurfaces: ["dashboard", "h5", "mini-program"],
      },
    ],
    workshops: [
      {
        workshopId: "brand-poster-suite",
        scope: "creative",
        status: "active",
        visibility: "workspace",
        displayName: {
          zh: "Brand Content Workshop",
          en: "Brand Content Workshop",
        },
        ownerLabel: {
          zh: "Brand Content Team",
          en: "Brand Content Team",
        },
        badge: {
          zh: "Recommended",
          en: "Recommended",
        },
        audience: {
          zh: "Content editors",
          en: "Content editors",
        },
        summary: {
          zh: "Workspace for posters, key visuals, and prompt archives.",
          en: "Workspace for posters, key visuals, and prompt archives.",
        },
        nextStepSummary: {
          zh: "Codex continues collecting constraints after launch.",
          en: "Codex continues collecting constraints after launch.",
        },
        coverAssetUrl: "/assets/workshop-image.svg",
        tagList: ["poster", "brand"],
        defaultServiceId: "poster-batch",
        visibleInContexts: ["brand-lab"],
      },
    ],
    services: [
      {
        serviceId: "poster-batch",
        workshopId: "brand-poster-suite",
        status: "active",
        displayName: {
          zh: "Brand Poster Batch",
          en: "Brand Poster Batch",
        },
        summary: {
          zh: "Generate posters, key visuals, and archived results in batch.",
          en: "Generate posters, key visuals, and archived results in batch.",
        },
        authRequirementText: {
          zh: "Requires Seedance API credentials",
          en: "Requires Seedance API credentials",
        },
        estimatedDuration: "12-20 min",
        targetPathHint: "/workspace/me-suite/posters/",
        outputContractSummary: {
          zh: "Returns poster bundles, receipts, and archived trace material.",
          en: "Returns poster bundles, receipts, and archived trace material.",
        },
        launchMode: "instant-conversation",
        requiredBindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: ["workspace:seedance-api"],
          credentialIds: ["cred_seedance_prod"],
        },
        linkedInstanceHint: null,
        visibleInContexts: ["brand-lab"],
      },
    ],
    launchTemplates: [],
  };

  const creatorState = {
    packages: [
      {
        packageId: "brand-poster-suite-package",
        title: {
          zh: "Brand Poster Creator Suite",
          en: "Brand Poster Creator Suite",
        },
        source: {
          zh: "Brand Content Team",
          en: "Brand Content Team",
        },
        state: "pending_release",
        statusLabel: {
          zh: "Pending release",
          en: "Pending release",
        },
        tone: "warn",
        ownerLabel: {
          zh: "Brand Content Team",
          en: "Brand Content Team",
        },
        updatedAt: "2026-07-09T00:10:30.000Z",
        releaseChannel: {
          zh: "Brand Lab",
          en: "Brand Lab",
        },
        workspaceContextKeys: ["brand-lab"],
        workspaceIds: [workspaceId],
        linkedWorkshopIds: ["brand-poster-suite"],
        linkedServiceIds: ["poster-batch"],
        session: {
          summary: {
            zh: "Poster workflow conversation pack",
            en: "Poster workflow conversation pack",
          },
          items: [
            {
              zh: "Collects brand constraints before generation.",
              en: "Collects brand constraints before generation.",
            },
          ],
        },
        runtime: {
          summary: {
            zh: "Docker runtime profile",
            en: "Docker runtime profile",
          },
          items: [
            {
              zh: "Node 22 + Playwright",
              en: "Node 22 + Playwright",
            },
          ],
        },
        connectors: {
          summary: {
            zh: "Seedance binding mounted",
            en: "Seedance binding mounted",
          },
          items: [
            {
              zh: "workspace:seedance-api",
              en: "workspace:seedance-api",
            },
          ],
        },
        release: {
          summary: {
            zh: "Awaiting staged release",
            en: "Awaiting staged release",
          },
          items: [
            {
              zh: "Pending release review",
              en: "Pending release review",
            },
          ],
        },
        versionLine: ["task=tsv_brand_poster", "session=sev_brand_poster_suite"],
        dependencies: [
          {
            zh: "Seedance API key",
            en: "Seedance API key",
          },
        ],
      },
    ],
    releases: [],
    replays: [],
    releaseGates: [],
    activations: [],
    auditExports: [],
  };

  const credentialsState = {
    credentials: [
      {
        credentialId: "cred_seedance_prod",
        workspaceId,
        ownerUserId: null,
        scope: "workspace",
        displayName: "Seedance Production Key",
        provider: "seedance",
        secretKind: "api-key",
        mountMode: "env",
        status: "active",
        redactedSecretRef: "vault://seedance/***",
        secretRef: "vault://seedance/production",
        envName: "SEEDANCE_API_KEY",
        mountPathTemplate: null,
        expiresAt: null,
        lastRotatedAt: "2026-07-09T00:09:00.000Z",
        rotationDueAt: "2026-08-09T00:00:00.000Z",
        notes: "workspace seedance key",
        createdAt: "2026-07-09T00:01:00.000Z",
        updatedAt: "2026-07-09T00:09:00.000Z",
      },
    ],
  };

  const mcpState = {
    registry: [
      {
        mcpId: "workspace:seedance-api",
        workspaceId,
        displayName: "Seedance API",
        description: "Workspace Seedance connector.",
        source: "workspace-managed",
        transport: "http",
        ref: "https://mcp.workspace.internal/seedance",
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: "cred_seedance_prod",
        defaultNetworkPolicyRef: "np_seedance_egress",
        approvalRequired: false,
        tags: ["seedance", "video"],
        createdAt: "2026-07-09T00:02:00.000Z",
        updatedAt: "2026-07-09T00:10:00.000Z",
      },
    ],
    bindings: [
      {
        bindingId: "mbd_seedance_workspace",
        mcpId: "workspace:seedance-api",
        workspaceId,
        scope: "workspace",
        scopeRef: workspaceId,
        credentialId: "cred_seedance_prod",
        status: "active",
        networkPolicyRef: "np_seedance_egress",
        approvalRequired: false,
        autoAttach: true,
        notes: "Attach seedance for poster workflows.",
        createdAt: "2026-07-09T00:03:00.000Z",
        updatedAt: "2026-07-09T00:10:00.000Z",
      },
    ],
  };

  const quotaState = {
    policies: [
      {
        policyId: "qpo_daily_runs_brand_lab",
        workspaceId,
        scopeType: "workspace-context",
        scopeRefId: "brand-lab",
        metric: "daily_runs",
        windowType: "daily",
        limitValue: 20,
        softLimitValue: 10,
        hardLimitValue: 20,
        actionOnSoftLimit: "require_approval",
        actionOnHardLimit: "block",
        status: "active",
        enabled: true,
        priority: 100,
        summary: {
          zh: "Brand lab daily run guardrail",
          en: "Brand lab daily run guardrail",
        },
        notes: "Protect daily launch volume for smoke verification.",
        workspaceContextKey: "brand-lab",
        packageId: null,
        serviceId: "poster-batch",
        taskVersionId: null,
        sessionVersionId: null,
        entrySurface: null,
        createdByUserId: "usr_me_owner",
        updatedByUserId: "usr_me_owner",
        createdAt: "2026-07-09T00:04:00.000Z",
        updatedAt: "2026-07-09T00:11:00.000Z",
      },
    ],
    counters: [
      {
        counterId: "qct_daily_runs_brand_lab_20260709",
        policyId: "qpo_daily_runs_brand_lab",
        workspaceId,
        scopeType: "workspace-context",
        scopeRefId: "brand-lab",
        metric: "daily_runs",
        windowType: "daily",
        windowStartedAt: "2026-07-09T00:00:00.000Z",
        windowEndsAt: "2026-07-10T00:00:00.000Z",
        currentValue: 11,
        workspaceContextKey: "brand-lab",
        packageId: null,
        serviceId: "poster-batch",
        taskVersionId: null,
        sessionVersionId: null,
        entrySurface: null,
        updatedAt: "2026-07-09T00:11:00.000Z",
      },
    ],
    events: [
      {
        eventId: "qev_daily_runs_brand_lab_warn",
        policyId: "qpo_daily_runs_brand_lab",
        workspaceId,
        scopeType: "workspace-context",
        scopeRefId: "brand-lab",
        metric: "daily_runs",
        decision: "approval_pending",
        currentValue: 11,
        limitValue: 10,
        runId: "run_me_pending",
        approvalId: "apr_me_pending",
        overrideId: "qov_daily_runs_brand_lab",
        note: "Daily run soft limit exceeded.",
        workspaceContextKey: "brand-lab",
        packageId: null,
        serviceId: "poster-batch",
        taskVersionId: null,
        sessionVersionId: null,
        entrySurface: "h5",
        occurredAt: "2026-07-09T00:13:00.000Z",
      },
    ],
    overrides: [
      {
        overrideId: "qov_daily_runs_brand_lab",
        policyId: "qpo_daily_runs_brand_lab",
        workspaceId,
        scopeType: "workspace-context",
        scopeRefId: "brand-lab",
        metric: "daily_runs",
        status: "pending",
        requiredRole: "operator",
        currentValue: 11,
        limitValue: 10,
        requestedDelta: 1,
        reasonSummary: {
          zh: "Poster workflow needs one extra run.",
          en: "Poster workflow needs one extra run.",
        },
        runId: "run_me_pending",
        approvalId: "apr_me_pending",
        workspaceContextKey: "brand-lab",
        packageId: null,
        serviceId: "poster-batch",
        taskVersionId: null,
        sessionVersionId: null,
        entrySurface: "h5",
        requestedByUserId: "usr_me_owner",
        requestedAt: "2026-07-09T00:13:00.000Z",
        decidedByUserId: null,
        decidedAt: null,
        decisionNote: null,
        updatedAt: "2026-07-09T00:13:00.000Z",
      },
    ],
  };

  const billingState = {
    entries: [
      {
        entryId: "ble_me_preview_001",
        workspaceId,
        workspaceContextKey: "brand-lab",
        packageId: null,
        serviceId: "poster-batch",
        taskVersionId: "tsv_run_me_result",
        sessionVersionId: "sev_run_me_result",
        entrySurface: "h5",
        runId: "run_me_result",
        requestedByUserId: "usr_me_owner",
        metric: "download_bytes",
        quantity: 2048,
        unitPriceUsd: 0.0000000004,
        amountUsd: 0.0000008192,
        currency: "USD",
        source: "file-preview",
        costBasis: "estimated",
        sourceRef: "/workspace/me-suite/run_me_result/output/poster-bundle.zip",
        note: "Preview usage for me summary smoke.",
        createdAt: "2026-07-09T00:12:00.000Z",
        updatedAt: "2026-07-09T00:12:00.000Z",
        occurredAt: "2026-07-09T00:12:00.000Z",
      },
    ],
  };

  const meState = {
    workshopFavorites: [
      {
        favoriteId: "favwk_brand_poster_suite",
        userId: "usr_me_owner",
        workspaceId,
        workspaceContextKey: "brand-lab",
        workshopId: "brand-poster-suite",
        createdAt: "2026-07-09T00:14:00.000Z",
        updatedAt: "2026-07-09T00:15:00.000Z",
      },
    ],
  };

  const runsDir = path.join(storageRoot, "runs");
  const authDir = path.join(storageRoot, "auth");
  const workshopsDir = path.join(storageRoot, "workshops");
  const creatorDir = path.join(storageRoot, "creator");
  const credentialsDir = path.join(storageRoot, "credentials");
  const mcpDir = path.join(storageRoot, "mcp");
  const quotaDir = path.join(storageRoot, "quotas");
  const billingDir = path.join(storageRoot, "billing");
  const meDir = path.join(storageRoot, "me");

  await Promise.all([
    mkdir(runsDir, { recursive: true }),
    mkdir(authDir, { recursive: true }),
    mkdir(workshopsDir, { recursive: true }),
    mkdir(creatorDir, { recursive: true }),
    mkdir(credentialsDir, { recursive: true }),
    mkdir(mcpDir, { recursive: true }),
    mkdir(quotaDir, { recursive: true }),
    mkdir(billingDir, { recursive: true }),
    mkdir(meDir, { recursive: true }),
  ]);

  const pendingRun = createSeedRunAggregate({
    runId: "run_me_pending",
    workspaceId,
    title: "Poster approval pending",
    status: "WAITING_APPROVAL",
    updatedAt: "2026-07-09T00:13:00.000Z",
    approvals: [
      {
        approvalId: "apr_me_pending",
        runId: "run_me_pending",
        kind: "general",
        relatedResourceRef: null,
        prompt: "Approve the poster export batch.",
        state: "pending",
        requestedAt: "2026-07-09T00:13:00.000Z",
        decidedAt: null,
        note: null,
      },
    ],
  });

  const failedRun = createSeedRunAggregate({
    runId: "run_me_failed",
    workspaceId,
    title: "Poster export retry",
    status: "FAILED",
    updatedAt: "2026-07-09T00:12:30.000Z",
    statusReason: "Renderer exited with code 1.",
  });

  const resultRun = createSeedRunAggregate({
    runId: "run_me_result",
    workspaceId,
    title: "Poster bundle delivery",
    status: "SUCCEEDED",
    updatedAt: "2026-07-09T00:12:00.000Z",
    files: [
      {
        path: "/workspace/me-suite/run_me_result/output/",
        name: "output",
        kind: "output",
        sizeBytes: null,
        updatedAt: "2026-07-09T00:11:59.000Z",
      },
      {
        path: "/workspace/me-suite/run_me_result/output/poster-bundle.zip",
        name: "poster-bundle.zip",
        kind: "output",
        sizeBytes: 4096,
        updatedAt: "2026-07-09T00:12:00.000Z",
      },
      {
        path: "/workspace/me-suite/run_me_result/output/filing-receipt.pdf",
        name: "filing-receipt.pdf",
        kind: "receipt",
        sizeBytes: 2048,
        updatedAt: "2026-07-09T00:11:58.000Z",
      },
      {
        path: "/workspace/me-suite/run_me_result/archive/prompt-trace.json",
        name: "prompt-trace.json",
        kind: "archive",
        sizeBytes: 1024,
        updatedAt: "2026-07-09T00:11:57.000Z",
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
      path.join(credentialsDir, "credentials-state.json"),
      JSON.stringify(credentialsState, null, 2),
      "utf8"
    ),
    writeFile(path.join(mcpDir, "mcp-state.json"), JSON.stringify(mcpState, null, 2), "utf8"),
    writeFile(
      path.join(quotaDir, "quota-state.json"),
      JSON.stringify(quotaState, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(billingDir, "billing-state.json"),
      JSON.stringify(billingState, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(meDir, "favorites-state.json"),
      JSON.stringify(meState, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(runsDir, "run_me_pending.json"),
      JSON.stringify(pendingRun, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(runsDir, "run_me_failed.json"),
      JSON.stringify(failedRun, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(runsDir, "run_me_result.json"),
      JSON.stringify(resultRun, null, 2),
      "utf8"
    ),
  ]);
}

test("me summary surfaces formal profile, assets, and authorization aggregates", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-me-profile-"));
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
    await seedMeState(storageRoot);

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
        email: "me.owner@example.com",
        password: "MeOwnerPass#2026",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${login.tokens.accessToken}`,
    };

    const summary = await requestJson(`${baseUrl}/v1/me/summary`, {
      headers: authHeaders,
    });
    assert.equal(summary.user.userId, "usr_me_owner");
    assert.equal(summary.currentWorkspace.workspaceId, "wsp_me_team");
    assert.equal(summary.currentWorkspace.contextKey, "brand-lab");
    assert.equal(summary.currentWorkspace.root, "/workspace/me-suite/");
    assert.equal(summary.metrics.pendingApprovalsCount, 1);
    assert.equal(summary.metrics.recentAssetsCount, 3);
    assert.equal(summary.profileMetrics.totalAssetsCount, 3);
    assert.equal(summary.profileMetrics.receiptAssetsCount, 1);
    assert.equal(summary.profileMetrics.visibleWorkshopsCount, 1);
    assert.equal(summary.profileMetrics.favoriteWorkshopsCount, 1);
    assert.equal(summary.profileMetrics.pendingActionsCount, 2);

    const assets = await requestJson(`${baseUrl}/v1/me/assets?limit=6`, {
      headers: authHeaders,
    });
    assert.equal(assets.totalCount, 3);
    assert.equal(assets.items.length, 3);
    assert.equal(assets.byKind.find((item) => item.kind === "result_bundle")?.count, 1);
    assert.equal(assets.byKind.find((item) => item.kind === "receipt")?.count, 1);
    assert.equal(assets.byKind.find((item) => item.kind === "archive_record")?.count, 1);
    assert.equal(assets.items[0].title, "poster-bundle.zip");
    assert.equal(assets.items[0].target.view, "files");
    assert.equal(assets.items[0].target.anchorType, "file");
    assert.match(assets.items[0].target.anchorRefId, /poster-bundle\.zip$/);

    const favorites = await requestJson(`${baseUrl}/v1/me/favorites/workshops?limit=6`, {
      headers: authHeaders,
    });
    assert.equal(favorites.totalCount, 1);
    assert.equal(favorites.items.length, 1);
    assert.equal(favorites.items[0].workshopId, "brand-poster-suite");
    assert.equal(favorites.items[0].target.resource, "workshop");
    assert.equal(favorites.items[0].target.view, "detail");

    const toggledOff = await requestJson(
      `${baseUrl}/v1/me/favorites/workshops/brand-poster-suite`,
      {
        method: "PUT",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          favorited: false,
        }),
      }
    );
    assert.equal(toggledOff.favorited, false);
    assert.equal(toggledOff.favorite, null);

    const toggledOn = await requestJson(
      `${baseUrl}/v1/me/favorites/workshops/brand-poster-suite`,
      {
        method: "PUT",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          favorited: true,
        }),
      }
    );
    assert.equal(toggledOn.favorited, true);
    assert.equal(toggledOn.favorite.workshopId, "brand-poster-suite");

    const summaryAfterFavoriteToggle = await requestJson(`${baseUrl}/v1/me/summary`, {
      headers: authHeaders,
    });
    assert.equal(summaryAfterFavoriteToggle.profileMetrics.favoriteWorkshopsCount, 1);

    const recordedWorkshopRecent = await requestJson(`${baseUrl}/v1/me/recent/record`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resourceType: "workshop",
        workshopId: "brand-poster-suite",
        interaction: "open",
        sourceSurface: "h5",
      }),
    });
    assert.equal(recordedWorkshopRecent.resourceType, "workshop");
    assert.equal(recordedWorkshopRecent.target.resource, "workshop");
    assert.equal(recordedWorkshopRecent.target.view, "detail");

    const recordedServiceRecent = await requestJson(`${baseUrl}/v1/me/recent/record`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resourceType: "service",
        serviceId: "poster-batch",
        interaction: "open",
        sourceSurface: "h5",
      }),
    });
    assert.equal(recordedServiceRecent.resourceType, "service");
    assert.equal(recordedServiceRecent.target.resource, "service");
    assert.equal(recordedServiceRecent.target.view, "detail");

    const recordedRunRecent = await requestJson(`${baseUrl}/v1/me/recent/record`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resourceType: "run",
        runId: "run_me_pending",
        interaction: "resume",
        sourceSurface: "h5",
      }),
    });
    assert.equal(recordedRunRecent.resourceType, "run");
    assert.equal(recordedRunRecent.runId, "run_me_pending");
    assert.equal(recordedRunRecent.target.resource, "run");
    assert.equal(recordedRunRecent.target.view, "detail");

    const recentRuns = await requestJson(`${baseUrl}/v1/me/recent?limit=6&types=run`, {
      headers: authHeaders,
    });
    assert.equal(recentRuns.totalCount, 1);
    assert.equal(recentRuns.items.length, 1);
    assert.equal(recentRuns.items[0].resourceType, "run");
    assert.equal(recentRuns.items[0].runId, "run_me_pending");

    const recentAll = await requestJson(`${baseUrl}/v1/me/recent?limit=6`, {
      headers: authHeaders,
    });
    assert.equal(recentAll.totalCount, 3);
    assert.equal(recentAll.items.length, 3);
    assert.deepEqual(
      new Set(recentAll.items.map((item) => item.resourceType)),
      new Set(["workshop", "service", "run"])
    );

    const searchBrand = await requestJson(
      `${baseUrl}/v1/search?q=brand&limit=10&entrySurface=dashboard`,
      {
        headers: authHeaders,
      }
    );
    assert.ok(searchBrand.totalCount >= 4);
    const searchBrandByType = new Map(
      searchBrand.items.map((item) => [item.resourceType, item])
    );
    const recentRunSearchItem = searchBrand.items.find(
      (item) => item.resourceType === "run" && item.resourceId === "run_me_pending"
    );
    assert.equal(searchBrandByType.get("workshop")?.favorited, true);
    assert.equal(recentRunSearchItem?.recent, true);
    assert.equal(searchBrandByType.get("service")?.target.resource, "service");
    assert.equal(searchBrandByType.get("package")?.target.resource, "package");

    const exactRunSearch = await requestJson(
      `${baseUrl}/v1/search?q=${encodeURIComponent("Poster approval pending")}&limit=5`,
      {
        headers: authHeaders,
      }
    );
    assert.equal(exactRunSearch.items[0].resourceType, "run");
    assert.equal(exactRunSearch.items[0].resourceId, "run_me_pending");

    const searchSuggestions = await requestJson(
      `${baseUrl}/v1/search/suggestions?q=brand&limit=6`,
      {
        headers: authHeaders,
      }
    );
    assert.ok(
      searchSuggestions.items.some((item) => item.text.en === "Brand Content Workshop")
    );
    assert.ok(
      searchSuggestions.items.some((item) =>
        item.resourceTypes.includes("package")
      )
    );

    const clickedSearchResult = await requestJson(`${baseUrl}/v1/search/clicks`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: "brand",
        documentId: "search:workshop:brand-poster-suite",
        entrySurface: "dashboard",
      }),
    });
    assert.equal(clickedSearchResult.resourceType, "workshop");
    assert.equal(clickedSearchResult.resourceId, "brand-poster-suite");
    assert.equal(clickedSearchResult.history.query, "brand");
    assert.ok(clickedSearchResult.rank >= 0);

    const searchHistory = await requestJson(
      `${baseUrl}/v1/search/history?limit=6&q=brand`,
      {
        headers: authHeaders,
      }
    );
    assert.equal(searchHistory.totalCount, 1);
    assert.equal(searchHistory.items[0].query, "brand");
    assert.ok(searchHistory.items[0].resourceTypes.includes("workshop"));

    const searchSuggestionsAfterClick = await requestJson(
      `${baseUrl}/v1/search/suggestions?q=bra&limit=6`,
      {
        headers: authHeaders,
      }
    );
    assert.ok(
      searchSuggestionsAfterClick.items.some((item) => item.text.en === "brand")
    );

    const authorizations = await requestJson(`${baseUrl}/v1/me/authorizations?limit=8`, {
      headers: authHeaders,
    });
    assert.equal(authorizations.totalCount, 7);
    assert.equal(authorizations.attentionCount, 2);
    assert.equal(authorizations.entries.length, 7);

    const entryByCategory = new Map(
      authorizations.entries.map((item) => [item.category, item])
    );
    assert.equal(entryByCategory.get("account")?.statusLabel.en, "Signed in");
    assert.equal(entryByCategory.get("workspace")?.statusLabel.en, "Owner");
    assert.equal(entryByCategory.get("credential")?.title.zh, "Seedance Production Key");
    const mcpEntries = authorizations.entries.filter((item) => item.category === "mcp");
    assert.equal(mcpEntries.length, 2);
    assert.equal(
      mcpEntries.find((item) => item.provider === "workspace:seedance-api")?.statusLabel.en,
      "Bound 1"
    );
    assert.equal(
      mcpEntries.find((item) => item.provider === "mcp.browser.playwright")?.statusLabel.en,
      "Unbound"
    );
    assert.equal(entryByCategory.get("quota")?.tone, "warn");
    assert.equal(entryByCategory.get("billing")?.statusLabel.en, "Recorded");
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
