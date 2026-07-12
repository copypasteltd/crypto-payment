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
    taskVersionId,
    sessionVersionId,
    title,
    targetPath,
    entrySurface,
    status,
    createdAt,
    updatedAt,
    contextKey,
    contextName,
    workshopId,
    workshopName,
    serviceId,
    serviceName,
    statusReason = null,
    messageText,
    files = [],
    approvals = [],
  } = options;

  return {
    run: {
      runId,
      workspaceId,
      taskVersionId,
      sessionVersionId,
      requestedByUserId: "usr_context_owner",
      title,
      targetPath,
      entrySurface,
      catalogMetadata: {
        workspaceContextKey: contextKey ?? null,
        workspaceContextName: contextName ?? null,
        workshopId: workshopId ?? null,
        workshopName: workshopName ?? null,
        serviceId: serviceId ?? null,
        serviceName: serviceName ?? null,
      },
      status,
      statusReason,
      createdAt,
      updatedAt,
    },
    input: {
      workspaceId,
      taskVersionId,
      sessionVersionId,
      requestedByUserId: "usr_context_owner",
      title,
      targetPath,
      entrySurface,
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      catalogMetadata: {
        workspaceContextKey: contextKey ?? null,
        workspaceContextName: contextName ?? null,
        workshopId: workshopId ?? null,
        workshopName: workshopName ?? null,
        serviceId: serviceId ?? null,
        serviceName: serviceName ?? null,
      },
    },
    startJob: {
      run: {
        runId,
        workspaceId,
        taskVersionId,
        sessionVersionId,
        requestedByUserId: "usr_context_owner",
        title,
        targetPath,
        entrySurface,
        catalogMetadata: {
          workspaceContextKey: contextKey ?? null,
          workspaceContextName: contextName ?? null,
          workshopId: workshopId ?? null,
          workshopName: workshopName ?? null,
          serviceId: serviceId ?? null,
          serviceName: serviceName ?? null,
        },
        status,
        statusReason,
        createdAt,
        updatedAt,
      },
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
        text: messageText ?? title,
        attachments: [],
        createdAt: updatedAt,
      },
    ],
    files,
    artifacts: [],
    approvals,
  };
}

async function seedWorkspaceContextAuthState(storageRoot) {
  const { hashPassword } = await import("../dist/modules/auth/crypto.js");
  const createdAtEnterprise = "2026-07-08T00:00:00.000Z";
  const createdAtPersonal = "2026-07-08T00:01:00.000Z";
  const userId = "usr_context_owner";
  const enterpriseWorkspaceId = "wsp_brand_content";
  const personalWorkspaceId = "wsp_personal_fallback";

  const authState = {
    users: [
      {
        userId,
        email: "context.owner@example.com",
        displayName: "Context Owner",
        passwordHash: hashPassword("ContextOwnerPass#2026"),
        createdAt: createdAtEnterprise,
        updatedAt: createdAtEnterprise,
      },
    ],
    workspaces: [
      {
        workspaceId: enterpriseWorkspaceId,
        slug: "ops-eu",
        name: "Ops Europe",
        type: "enterprise",
        createdAt: createdAtEnterprise,
        updatedAt: createdAtEnterprise,
      },
      {
        workspaceId: personalWorkspaceId,
        slug: "alice-space",
        name: "Alice Space",
        type: "personal",
        createdAt: createdAtPersonal,
        updatedAt: createdAtPersonal,
      },
    ],
    memberships: [
      {
        workspaceId: enterpriseWorkspaceId,
        userId,
        role: "owner",
        status: "active",
        createdAt: createdAtEnterprise,
        updatedAt: createdAtEnterprise,
      },
      {
        workspaceId: personalWorkspaceId,
        userId,
        role: "owner",
        status: "active",
        createdAt: createdAtPersonal,
        updatedAt: createdAtPersonal,
      },
    ],
    sessions: [],
  };

  const catalogState = {
    contexts: [
      {
        contextKey: "brand-lab",
        runtimeWorkspaceId: enterpriseWorkspaceId,
        displayName: {
          zh: "Brand Content Team",
          en: "Brand Content Team",
        },
        type: "enterprise",
        meta: {
          zh: "Content editors / 3 mounted capabilities",
          en: "Content editors / 3 mounted capabilities",
        },
        root: "/workspace/poster-batch-17/",
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
          zh: "Creative",
          en: "Creative",
        },
        audience: {
          zh: "Built for brand teams and content editors",
          en: "Built for brand teams and content editors",
        },
        summary: {
          zh: "Supports batch image generation and result callbacks.",
          en: "Supports batch image generation and result callbacks.",
        },
        nextStepSummary: {
          zh: "Launch a service and enter the full run conversation.",
          en: "Launch a service and enter the full run conversation.",
        },
        coverAssetUrl: "/assets/workshop-image.svg",
        tagList: ["image", "brand"],
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
          zh: "Generate poster variants around brand constraints.",
          en: "Generate poster variants around brand constraints.",
        },
        authRequirementText: {
          zh: "Private image capability mount / readonly key",
          en: "Private image capability mount / readonly key",
        },
        estimatedDuration: "06-12 min",
        targetPathHint: "/workspace/poster-batch-17/",
        outputContractSummary: {
          zh: "Outputs poster bundles and archive paths.",
          en: "Outputs poster bundles and archive paths.",
        },
        launchMode: "instant-conversation",
        requiredBindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
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
        packageId: "brand-poster-suite",
        title: {
          zh: "Brand Content Package",
          en: "Brand Content Package",
        },
        source: {
          zh: "Creator / Brand Content Workshop",
          en: "Creator / Brand Content Workshop",
        },
        state: "ready",
        statusLabel: {
          zh: "Ready",
          en: "Ready",
        },
        tone: "active",
        ownerLabel: {
          zh: "Brand Content Team",
          en: "Brand Content Team",
        },
        updatedAt: createdAtEnterprise,
        releaseChannel: {
          zh: "Brand-space staged",
          en: "Brand-space staged",
        },
        workspaceContextKeys: ["brand-lab"],
        linkedWorkshopIds: ["brand-poster-suite"],
        linkedServiceIds: ["poster-batch"],
        session: {
          summary: {
            zh: "Session prompts are configured.",
            en: "Session prompts are configured.",
          },
          items: [],
        },
        runtime: {
          summary: {
            zh: "Runtime image is bound.",
            en: "Runtime image is bound.",
          },
          items: [],
        },
        connectors: {
          summary: {
            zh: "Connector mounts are configured.",
            en: "Connector mounts are configured.",
          },
          items: [],
        },
        release: {
          summary: {
            zh: "Release chain is established.",
            en: "Release chain is established.",
          },
          items: [],
        },
        versionLine: [
          "tsv_poster_batch_2026_07_08",
          "sev_poster_batch_2026_07_08",
        ],
        dependencies: [
          {
            zh: "imagegen",
            en: "imagegen",
          },
        ],
      },
    ],
    releases: [],
    replays: [],
    releaseGates: [],
    activations: [],
  };
  const runsDir = path.join(storageRoot, "runs");
  await mkdir(runsDir, { recursive: true });

  const enterpriseTaxRun = createSeedRunAggregate({
    runId: "run_00000001",
    workspaceId: enterpriseWorkspaceId,
    taskVersionId: "tsv_tax_filing_2026_07_08",
    sessionVersionId: "sev_tax_filing_2026_07_08",
    title: "Q2 tax filing",
    targetPath: "/workspace/poster-batch-17/tax-q2/",
    entrySurface: "dashboard",
    status: "RUNNING",
    createdAt: "2026-07-08T00:10:00.000Z",
    updatedAt: "2026-07-08T00:11:00.000Z",
    contextKey: "brand-lab",
    contextName: {
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
    messageText: "Waiting for additional filing information.",
    files: [
      {
        path: "/workspace/poster-batch-17/tax-q2/output/final-summary.md",
        name: "final-summary.md",
        kind: "output",
        sizeBytes: 1024,
        updatedAt: "2026-07-08T00:11:00.000Z",
      },
    ],
    approvals: [
      {
        approvalId: "apr_run_00000001",
        runId: "run_00000001",
        prompt: "Confirm the filing scope.",
        state: "approved",
        requestedAt: "2026-07-08T00:10:30.000Z",
        decidedAt: "2026-07-08T00:10:45.000Z",
        note: "approved",
      },
    ],
  });

  const enterpriseApprovalRun = createSeedRunAggregate({
    runId: "run_00000002",
    workspaceId: enterpriseWorkspaceId,
    taskVersionId: "tsv_poster_batch_2026_07_08",
    sessionVersionId: "sev_poster_batch_2026_07_08",
    title: "Poster review loop",
    targetPath: "/workspace/poster-batch-17/poster-review/",
    entrySurface: "h5",
    status: "WAITING_APPROVAL",
    createdAt: "2026-07-08T00:12:00.000Z",
    updatedAt: "2026-07-08T00:13:00.000Z",
    contextKey: "brand-lab",
    contextName: {
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
    messageText: "Approval required before publishing.",
    files: [
      {
        path: "/workspace/poster-batch-17/poster-review/archive/review-notes.md",
        name: "review-notes.md",
        kind: "archive",
        sizeBytes: 768,
        updatedAt: "2026-07-08T00:13:00.000Z",
      },
    ],
    approvals: [
      {
        approvalId: "apr_run_00000002",
        runId: "run_00000002",
        prompt: "Approve the selected poster batch.",
        state: "pending",
        requestedAt: "2026-07-08T00:12:30.000Z",
        decidedAt: null,
        note: null,
      },
    ],
  });

  const personalRun = createSeedRunAggregate({
    runId: "run_00000003",
    workspaceId: personalWorkspaceId,
    taskVersionId: "tsv_personal_drama_2026_07_08",
    sessionVersionId: "sev_personal_drama_2026_07_08",
    title: "Personal short drama draft",
    targetPath: "/workspace/alice-space/drama/",
    entrySurface: "mini-program",
    status: "SUCCEEDED",
    createdAt: "2026-07-08T00:14:00.000Z",
    updatedAt: "2026-07-08T00:15:00.000Z",
    contextKey: "personal",
    contextName: {
      zh: "Personal Workspace",
      en: "Personal Workspace",
    },
    workshopName: {
      zh: "Drama Production Suite",
      en: "Drama Production Suite",
    },
    serviceName: {
      zh: "Drama Storyboard Builder",
      en: "Drama Storyboard Builder",
    },
    messageText: "Draft package is ready.",
    files: [
      {
        path: "/workspace/alice-space/drama/output/storyboard.md",
        name: "storyboard.md",
        kind: "output",
        sizeBytes: 2048,
        updatedAt: "2026-07-08T00:15:00.000Z",
      },
    ],
    approvals: [],
  });

  await writeFile(
    path.join(runsDir, "run_00000001.json"),
    JSON.stringify(enterpriseTaxRun, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(runsDir, "run_00000002.json"),
    JSON.stringify(enterpriseApprovalRun, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(runsDir, "run_00000003.json"),
    JSON.stringify(personalRun, null, 2),
    "utf8"
  );

  const authDir = path.join(storageRoot, "auth");
  const workshopsDir = path.join(storageRoot, "workshops");
  const creatorDir = path.join(storageRoot, "creator");
  await mkdir(authDir, { recursive: true });
  await mkdir(workshopsDir, { recursive: true });
  await mkdir(creatorDir, { recursive: true });
  await writeFile(path.join(authDir, "auth-state.json"), JSON.stringify(authState, null, 2), "utf8");
  await writeFile(
    path.join(workshopsDir, "catalog-state.json"),
    JSON.stringify(catalogState, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(creatorDir, "creator-state.json"),
    JSON.stringify(creatorState, null, 2),
    "utf8"
  );

  return {
    enterpriseWorkspaceId,
    personalWorkspaceId,
  };
}

test("auth session and workspace APIs expose authoritative contextKey and root fields", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-auth-context-"));
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
    const { enterpriseWorkspaceId, personalWorkspaceId } =
      await seedWorkspaceContextAuthState(storageRoot);

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
        email: "context.owner@example.com",
        password: "ContextOwnerPass#2026",
      }),
    });

    assert.equal(login.currentWorkspace.workspaceId, enterpriseWorkspaceId);
    assert.equal(login.currentWorkspace.contextKey, "brand-lab");
    assert.equal(login.currentWorkspace.root, "/workspace/poster-batch-17/");

    const enterpriseWorkspace = login.workspaces.find(
      (workspace) => workspace.workspaceId === enterpriseWorkspaceId
    );
    assert.ok(enterpriseWorkspace);
    assert.equal(enterpriseWorkspace.contextKey, "brand-lab");
    assert.equal(enterpriseWorkspace.root, "/workspace/poster-batch-17/");

    const personalWorkspace = login.workspaces.find(
      (workspace) => workspace.workspaceId === personalWorkspaceId
    );
    assert.ok(personalWorkspace);
    assert.equal(personalWorkspace.contextKey, "personal");
    assert.equal(personalWorkspace.root, "/workspace/alice-space/");

    const authHeaders = {
      authorization: `Bearer ${login.tokens.accessToken}`,
    };

    const sessionEnvelope = await requestJson(`${baseUrl}/v1/auth/session`, {
      headers: authHeaders,
    });
    assert.equal(sessionEnvelope.currentWorkspace.contextKey, "brand-lab");
    assert.equal(sessionEnvelope.currentWorkspace.root, "/workspace/poster-batch-17/");

    const workspaces = await requestJson(`${baseUrl}/v1/workspaces`, {
      headers: authHeaders,
    });
    assert.equal(Array.isArray(workspaces), true);
    assert.equal(
      workspaces.some(
        (workspace) =>
          workspace.workspaceId === enterpriseWorkspaceId &&
          workspace.contextKey === "brand-lab" &&
          workspace.root === "/workspace/poster-batch-17/"
      ),
      true
    );
    assert.equal(
      workspaces.some(
        (workspace) =>
          workspace.workspaceId === personalWorkspaceId &&
          workspace.contextKey === "personal" &&
          workspace.root === "/workspace/alice-space/"
      ),
      true
    );

    const enterpriseSummary = await requestJson(
      `${baseUrl}/v1/workspaces/${enterpriseWorkspaceId}/summary`,
      {
        headers: authHeaders,
      }
    );
    assert.equal(enterpriseSummary.workspace.workspaceId, enterpriseWorkspaceId);
    assert.equal(enterpriseSummary.workspace.contextKey, "brand-lab");
    assert.equal(enterpriseSummary.metrics.visibleWorkshopsCount, 1);
    assert.equal(enterpriseSummary.metrics.visibleServicesCount, 1);
    assert.equal(enterpriseSummary.metrics.visiblePackagesCount, 1);
    assert.equal(enterpriseSummary.metrics.visibleRunsCount, 2);
    assert.equal(enterpriseSummary.metrics.pendingApprovalsCount, 1);
    assert.equal(enterpriseSummary.metrics.recentAssetsCount, 2);

    const enterpriseRunsSummary = await requestJson(`${baseUrl}/v1/runs/summary`, {
      headers: authHeaders,
    });
    assert.equal(enterpriseRunsSummary.total, 2);
    assert.equal(enterpriseRunsSummary.pendingApprovalsCount, 1);
    assert.equal(enterpriseRunsSummary.outputsReadyCount, 2);
    assert.equal(enterpriseRunsSummary.byViewStatus.running, 1);
    assert.equal(enterpriseRunsSummary.byViewStatus.approval, 1);
    assert.equal(enterpriseRunsSummary.byViewStatus.done, 0);
    assert.equal(enterpriseRunsSummary.byAttentionMode.running, 0);
    assert.equal(enterpriseRunsSummary.byAttentionMode.todo, 1);
    assert.equal(enterpriseRunsSummary.byAttentionMode.done, 1);
    assert.equal(enterpriseRunsSummary.byEntrySurface[0].key, "dashboard");
    assert.equal(
      enterpriseRunsSummary.byTag.some((item) => item.key === "#brand-lab" && item.count === 2),
      true
    );

    const approvalRuns = await requestJson(`${baseUrl}/v1/runs?viewStatus=approval`, {
      headers: authHeaders,
    });
    assert.equal(approvalRuns.length, 1);
    assert.equal(approvalRuns[0].run.runId, "run_00000002");

    const todoRuns = await requestJson(`${baseUrl}/v1/runs?attentionMode=todo`, {
      headers: authHeaders,
    });
    assert.equal(todoRuns.length, 1);
    assert.equal(todoRuns[0].run.runId, "run_00000002");

    const taxRuns = await requestJson(`${baseUrl}/v1/runs?tag=%23tax`, {
      headers: authHeaders,
    });
    assert.equal(taxRuns.length, 1);
    assert.equal(taxRuns[0].run.runId, "run_00000001");

    const posterRuns = await requestJson(`${baseUrl}/v1/runs?q=review`, {
      headers: authHeaders,
    });
    assert.equal(posterRuns.length, 1);
    assert.equal(posterRuns[0].run.runId, "run_00000002");

    const switched = await requestJson(`${baseUrl}/v1/workspaces/switch`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: personalWorkspaceId,
      }),
    });

    assert.equal(switched.currentWorkspace.workspaceId, personalWorkspaceId);
    assert.equal(switched.currentWorkspace.contextKey, "personal");
    assert.equal(switched.currentWorkspace.root, "/workspace/alice-space/");

    const switchedSession = await requestJson(`${baseUrl}/v1/auth/session`, {
      headers: {
        authorization: `Bearer ${switched.tokens.accessToken}`,
      },
    });
    assert.equal(switchedSession.currentWorkspace.workspaceId, personalWorkspaceId);
    assert.equal(switchedSession.currentWorkspace.contextKey, "personal");
    assert.equal(switchedSession.currentWorkspace.root, "/workspace/alice-space/");

    const personalSummary = await requestJson(
      `${baseUrl}/v1/workspaces/${personalWorkspaceId}/summary`,
      {
        headers: {
          authorization: `Bearer ${switched.tokens.accessToken}`,
        },
      }
    );
    assert.equal(personalSummary.workspace.workspaceId, personalWorkspaceId);
    assert.equal(personalSummary.workspace.contextKey, "personal");
    assert.equal(personalSummary.metrics.visibleWorkshopsCount, 0);
    assert.equal(personalSummary.metrics.visibleServicesCount, 0);
    assert.equal(personalSummary.metrics.visiblePackagesCount, 0);
    assert.equal(personalSummary.metrics.visibleRunsCount, 1);

    const personalRunsSummary = await requestJson(`${baseUrl}/v1/runs/summary`, {
      headers: {
        authorization: `Bearer ${switched.tokens.accessToken}`,
      },
    });
    assert.equal(personalRunsSummary.total, 1);
    assert.equal(personalRunsSummary.byViewStatus.done, 1);
    assert.equal(personalRunsSummary.byAttentionMode.done, 1);
    assert.equal(
      personalRunsSummary.byTag.some((item) => item.key === "#personal" && item.count === 1),
      true
    );
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


