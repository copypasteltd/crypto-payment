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

async function requestFailure(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

async function login(baseUrl, email, password) {
  return await requestJson(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

async function seedCreatorRbacState(storageRoot) {
  const { hashPassword } = await import("../dist/modules/auth/crypto.js");
  const createdAt = "2026-07-09T00:00:00.000Z";
  const workspaceId = "wsp_brand_content";
  const personalWorkspaceId = "wsp_personal_owner";

  const users = [
    ["usr_owner", "owner@example.com", "Owner User", "OwnerPass#2026"],
    ["usr_admin", "admin@example.com", "Admin User", "AdminPass#2026"],
    ["usr_creator", "creator@example.com", "Creator User", "CreatorPass#2026"],
    ["usr_operator", "operator@example.com", "Operator User", "OperatorPass#2026"],
    ["usr_viewer", "viewer@example.com", "Viewer User", "ViewerPass#2026"],
  ];

  const authState = {
    users: users.map(([userId, email, displayName, password]) => ({
      userId,
      email,
      displayName,
      passwordHash: hashPassword(password),
      createdAt,
      updatedAt: createdAt,
    })),
    workspaces: [
      {
        workspaceId,
        slug: "brand-content",
        name: "Brand Content Workspace",
        type: "enterprise",
        createdAt,
        updatedAt: createdAt,
      },
      {
        workspaceId: personalWorkspaceId,
        slug: "owner-personal",
        name: "Owner Personal Workspace",
        type: "personal",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    memberships: [
      {
        workspaceId,
        userId: "usr_owner",
        role: "owner",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
      {
        workspaceId: personalWorkspaceId,
        userId: "usr_owner",
        role: "owner",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
      {
        workspaceId,
        userId: "usr_admin",
        role: "admin",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
      {
        workspaceId,
        userId: "usr_creator",
        role: "creator",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
      {
        workspaceId,
        userId: "usr_operator",
        role: "operator",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
      {
        workspaceId,
        userId: "usr_viewer",
        role: "viewer",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    sessions: [],
  };

  const catalogState = {
    contexts: [
      {
        contextKey: "brand-lab",
        runtimeWorkspaceId: workspaceId,
        displayName: {
          zh: "品牌内容组",
          en: "Brand Content Team",
        },
        type: "enterprise",
        meta: {
          zh: "Creator / 发布 / 审计",
          en: "Creator / release / audit",
        },
        root: "/workspace/brand-content/",
        allowedEntrySurfaces: ["dashboard", "h5", "mini-program"],
      },
    ],
    workshops: [
      {
        workshopId: "drama-workshop",
        scope: "creative",
        status: "active",
        visibility: "workspace",
        displayName: {
          zh: "短剧工坊",
          en: "Drama Workshop",
        },
        ownerLabel: {
          zh: "品牌内容组",
          en: "Brand Content Team",
        },
        badge: {
          zh: "Creator",
          en: "Creator",
        },
        audience: {
          zh: "面向短剧和内容创作团队。",
          en: "Built for short-drama and content-creation teams.",
        },
        summary: {
          zh: "支持分镜、回放、审核与正式激活。",
          en: "Supports storyboards, replay, review, and formal activation.",
        },
        nextStepSummary: {
          zh: "创建 release，补齐 gate，再激活到当前工作区。",
          en: "Create a release, satisfy gates, then activate into the current workspace.",
        },
        coverAssetUrl: "/assets/workshop-drama.svg",
        tagList: ["creator", "drama", "release"],
        defaultServiceId: "drama-storyboard",
        visibleInContexts: ["brand-lab"],
      },
    ],
    services: [
      {
        serviceId: "drama-storyboard",
        workshopId: "drama-workshop",
        status: "active",
        displayName: {
          zh: "短剧分镜生成",
          en: "Drama Storyboard Builder",
        },
        summary: {
          zh: "引导用户提供设定并生成短剧分镜。",
          en: "Guides the user to provide inputs and generates storyboard drafts.",
        },
        authRequirementText: {
          zh: "Creator 包、私有能力、审核 gate",
          en: "Creator package, private capability, and review gates",
        },
        estimatedDuration: "08-16 min",
        targetPathHint: "/workspace/brand-content/drama/",
        outputContractSummary: {
          zh: "结果写回 target path 与 archive 目录。",
          en: "Outputs are written into target-path and archive directories.",
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
        packageId: "creator-drama-suite",
        title: {
          zh: "短剧构建 Session 包",
          en: "Drama session package",
        },
        source: {
          zh: "来源：短剧工坊",
          en: "Source: drama workshop",
        },
        state: "pending_release",
        statusLabel: {
          zh: "待发布",
          en: "Pending release",
        },
        tone: "warn",
        ownerLabel: {
          zh: "品牌内容组",
          en: "Brand Content Team",
        },
        updatedAt: createdAt,
        releaseChannel: {
          zh: "短剧工坊 / 预发布",
          en: "Drama workshop / staged",
        },
        workspaceContextKeys: ["brand-lab"],
        linkedWorkshopIds: ["drama-workshop"],
        linkedServiceIds: ["drama-storyboard"],
        session: {
          summary: {
            zh: "保留引导问询与分镜生成会话。",
            en: "Preserves guided intake and storyboard generation sessions.",
          },
          items: [],
        },
        runtime: {
          summary: {
            zh: "标准 Codex runtime。",
            en: "Standard Codex runtime.",
          },
          items: [],
        },
        connectors: {
          summary: {
            zh: "允许挂载私有凭证与外部连接器。",
            en: "Allows private credentials and external connectors.",
          },
          items: [],
        },
        release: {
          summary: {
            zh: "当前版本等待正式 gate 决策。",
            en: "The current version is waiting for formal gate decisions.",
          },
          items: [],
        },
        versionLine: [
          "sev_creator_drama_suite_20260709@2026.07.09",
          "tsv_drama_storyboard_20260709@2026.07.09",
          "img: lingban-runtime:2026.07",
        ],
        dependencies: [],
      },
    ],
    releases: [],
    replays: [],
    releaseGates: [],
    activations: [],
  };

  const authDir = path.join(storageRoot, "auth");
  const workshopsDir = path.join(storageRoot, "workshops");
  const creatorDir = path.join(storageRoot, "creator");
  const runsDir = path.join(storageRoot, "runs");

  await mkdir(authDir, { recursive: true });
  await mkdir(workshopsDir, { recursive: true });
  await mkdir(creatorDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });

  await writeFile(path.join(authDir, "auth-state.json"), JSON.stringify(authState, null, 2), "utf8");
  await writeFile(path.join(workshopsDir, "catalog-state.json"), JSON.stringify(catalogState, null, 2), "utf8");
  await writeFile(path.join(creatorDir, "creator-state.json"), JSON.stringify(creatorState, null, 2), "utf8");

  return {
    workspaceId,
    personalWorkspaceId,
  };
}

test("creator RBAC smoke: workspace role and context boundaries are enforced server-side", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-creator-rbac-"));
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
    const { personalWorkspaceId } = await seedCreatorRbacState(storageRoot);

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

    const ownerLogin = await login(baseUrl, "owner@example.com", "OwnerPass#2026");
    const adminLogin = await login(baseUrl, "admin@example.com", "AdminPass#2026");
    const creatorLogin = await login(baseUrl, "creator@example.com", "CreatorPass#2026");
    const operatorLogin = await login(baseUrl, "operator@example.com", "OperatorPass#2026");
    const viewerLogin = await login(baseUrl, "viewer@example.com", "ViewerPass#2026");

    const ownerHeaders = {
      authorization: `Bearer ${ownerLogin.tokens.accessToken}`,
      "content-type": "application/json",
    };
    const adminHeaders = {
      authorization: `Bearer ${adminLogin.tokens.accessToken}`,
      "content-type": "application/json",
    };
    const creatorHeaders = {
      authorization: `Bearer ${creatorLogin.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const creatorPackages = await requestJson(`${baseUrl}/v1/packages`, {
      headers: {
        authorization: creatorHeaders.authorization,
      },
    });
    assert.equal(
      creatorPackages.some((item) => item.packageId === "creator-drama-suite"),
      true
    );

    const operatorPackages = await requestFailure(`${baseUrl}/v1/packages`, {
      headers: {
        authorization: `Bearer ${operatorLogin.tokens.accessToken}`,
      },
    });
    assert.equal(operatorPackages.status, 403);
    assert.equal(operatorPackages.body.error.code, "WORKSPACE_ROLE_FORBIDDEN");

    const viewerPackage = await requestFailure(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: {
          authorization: `Bearer ${viewerLogin.tokens.accessToken}`,
        },
      }
    );
    assert.equal(viewerPackage.status, 403);
    assert.equal(viewerPackage.body.error.code, "WORKSPACE_ROLE_FORBIDDEN");

    const createdRelease = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/releases`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: JSON.stringify({
          targetWorkspaceContextKey: "brand-lab",
          state: "production",
          channelLabel: {
            zh: "短剧工坊 / 正式",
            en: "Drama workshop / production",
          },
          gateSummary: [
            {
              zh: "等待 gate 决策",
              en: "Waiting for gate decisions",
            },
          ],
        }),
      }
    );

    const gates = await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/gates`,
      {
        headers: {
          authorization: creatorHeaders.authorization,
        },
      }
    );
    assert.deepEqual(
      gates.map((item) => item.gateType),
      ["desensitization", "replay", "credential", "manual_approval"]
    );

    const desensitizationGate = gates.find((item) => item.gateType === "desensitization");
    const replayGate = gates.find((item) => item.gateType === "replay");
    const credentialGate = gates.find((item) => item.gateType === "credential");
    const manualApprovalGate = gates.find((item) => item.gateType === "manual_approval");

    assert.ok(desensitizationGate);
    assert.ok(replayGate);
    assert.ok(credentialGate);
    assert.ok(manualApprovalGate);

    await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/gates/${encodeURIComponent(desensitizationGate.gateId)}/decide`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: JSON.stringify({
          status: "passed",
          evidenceRef: "evidence://desensitization",
          checklist: desensitizationGate.checklist.map((item) => ({
            ...item,
            status: "passed",
          })),
        }),
      }
    );

    await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/gates/${encodeURIComponent(replayGate.gateId)}/decide`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: JSON.stringify({
          status: "passed",
          evidenceRef: "evidence://replay",
          checklist: replayGate.checklist.map((item) => ({
            ...item,
            status: "passed",
          })),
        }),
      }
    );

    const creatorCredentialDecision = await requestFailure(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/gates/${encodeURIComponent(credentialGate.gateId)}/decide`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: JSON.stringify({
          status: "passed",
          evidenceRef: "evidence://credential",
          checklist: credentialGate.checklist.map((item) => ({
            ...item,
            status: "passed",
          })),
        }),
      }
    );
    assert.equal(creatorCredentialDecision.status, 403);
    assert.equal(creatorCredentialDecision.body.error.code, "CREATOR_RELEASE_GATE_FORBIDDEN");

    const creatorGovernance = await requestFailure(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/governance/audit/summary?workspaceContextKey=${encodeURIComponent("brand-lab")}`,
      {
        headers: {
          authorization: creatorHeaders.authorization,
        },
      }
    );
    assert.equal(creatorGovernance.status, 403);
    assert.equal(creatorGovernance.body.error.code, "WORKSPACE_ROLE_FORBIDDEN");

    const creatorAuditExport = await requestFailure(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/audit-exports`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          format: "json",
        }),
      }
    );
    assert.equal(creatorAuditExport.status, 403);
    assert.equal(creatorAuditExport.body.error.code, "WORKSPACE_ROLE_FORBIDDEN");

    await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/gates/${encodeURIComponent(credentialGate.gateId)}/decide`,
      {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          status: "passed",
          evidenceRef: "evidence://credential-admin",
          checklist: credentialGate.checklist.map((item) => ({
            ...item,
            status: "passed",
          })),
        }),
      }
    );

    await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/gates/${encodeURIComponent(manualApprovalGate.gateId)}/decide`,
      {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          status: "passed",
          evidenceRef: "evidence://manual-approval-owner",
          checklist: manualApprovalGate.checklist.map((item) => ({
            ...item,
            status: "passed",
          })),
        }),
      }
    );

    const creatorActivate = await requestFailure(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/activate`,
      {
        method: "POST",
        headers: creatorHeaders,
        body: JSON.stringify({}),
      }
    );
    assert.equal(creatorActivate.status, 403);
    assert.equal(creatorActivate.body.error.code, "WORKSPACE_ROLE_FORBIDDEN");

    const ownerGovernance = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/governance/audit/summary?workspaceContextKey=${encodeURIComponent("brand-lab")}`,
      {
        headers: {
          authorization: ownerHeaders.authorization,
        },
      }
    );
    assert.equal(ownerGovernance.packageId, "creator-drama-suite");
    assert.equal(ownerGovernance.section, "audit");
    assert.equal(ownerGovernance.workspaceContextKey, "brand-lab");

    const crossContextGovernance = await requestFailure(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/governance/audit/summary?workspaceContextKey=${encodeURIComponent("personal")}`,
      {
        headers: {
          authorization: ownerHeaders.authorization,
        },
      }
    );
    assert.equal(crossContextGovernance.status, 403);
    assert.equal(crossContextGovernance.body.error.code, "CREATOR_CONTEXT_FORBIDDEN");

    const createdAuditExport = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/audit-exports`,
      {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          format: "json",
        }),
      }
    );
    assert.equal(createdAuditExport.export.packageId, "creator-drama-suite");
    assert.equal(createdAuditExport.export.status, "ready");

    const activation = await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/activate`,
      {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({}),
      }
    );
    assert.equal(activation.releaseId, createdRelease.releaseId);
    assert.equal(activation.state, "active");

    const switchedWorkspace = await requestJson(`${baseUrl}/v1/workspaces/switch`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        workspaceId: personalWorkspaceId,
      }),
    });

    const personalHeaders = {
      authorization: `Bearer ${switchedWorkspace.tokens.accessToken}`,
    };

    const personalPackages = await requestJson(`${baseUrl}/v1/packages`, {
      headers: personalHeaders,
    });
    assert.deepEqual(personalPackages, []);

    const hiddenPackage = await requestFailure(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: personalHeaders,
      }
    );
    assert.equal(hiddenPackage.status, 404);
    assert.equal(hiddenPackage.body.error.code, "CREATOR_PACKAGE_NOT_FOUND");
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
