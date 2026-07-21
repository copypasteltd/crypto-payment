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

async function seedCreatorReleaseAuthState(storageRoot) {
  const { hashPassword } = await import("../dist/modules/auth/crypto.js");
  const createdAt = "2026-07-09T00:00:00.000Z";
  const brandWorkspaceId = "wsp_brand_content";
  const personalWorkspaceId = "wsp_release_personal";

  const authState = {
    users: [
      {
        userId: "usr_creator_release_owner",
        email: "smoke-creator-release@example.com",
        displayName: "Smoke Creator Release",
        passwordHash: hashPassword("TestPassword123!"),
        createdAt,
        updatedAt: createdAt,
      },
    ],
    workspaces: [
      {
        workspaceId: brandWorkspaceId,
        slug: "brand-content",
        name: "Brand Content Workspace",
        type: "enterprise",
        createdAt,
        updatedAt: createdAt,
      },
      {
        workspaceId: personalWorkspaceId,
        slug: "smoke-release-personal",
        name: "Smoke Creator Personal",
        type: "personal",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    memberships: [
      {
        workspaceId: brandWorkspaceId,
        userId: "usr_creator_release_owner",
        role: "owner",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
      {
        workspaceId: personalWorkspaceId,
        userId: "usr_creator_release_owner",
        role: "owner",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    sessions: [],
  };

  const authDir = path.join(storageRoot, "auth");
  await mkdir(authDir, { recursive: true });
  await writeFile(path.join(authDir, "auth-state.json"), JSON.stringify(authState, null, 2), "utf8");

  return {
    brandWorkspaceId,
    personalWorkspaceId,
  };
}

test("creator release and replay smoke: create, update, list, and project into package detail", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-creator-release-"));
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
    const { brandWorkspaceId, personalWorkspaceId } =
      await seedCreatorReleaseAuthState(storageRoot);

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
        email: "smoke-creator-release@example.com",
        password: "TestPassword123!",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${login.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const visiblePackages = await requestJson(
      `${baseUrl}/v1/packages?workspaceContextKey=${encodeURIComponent("brand-lab")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(
      visiblePackages.some((item) => item.packageId === "creator-drama-suite"),
      true
    );

    const createdRelease = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/releases`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          targetWorkspaceContextKey: "brand-lab",
          state: "production",
          channelLabel: {
            zh: "品牌内容工坊 / 正式",
            en: "Brand content workshop / production",
          },
          gateSummary: [
            {
              zh: "脱敏复核完成",
              en: "Desensitization review completed",
            },
            {
              zh: "预算阈值回写通过",
              en: "Budget-threshold callback passed",
            },
          ],
        }),
      }
    );

    assert.equal(createdRelease.packageId, "creator-drama-suite");
    assert.equal(createdRelease.state, "production");

    const packageAfterRelease = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(packageAfterRelease.state, "pending_release");
    assert.equal(packageAfterRelease.tone, "warn");
    assert.equal(
      packageAfterRelease.releaseChannel.en,
      "Brand content workshop / production"
    );
    assert.deepEqual(
      packageAfterRelease.release.items.map((item) => item.en),
      [
        "Desensitization gate: Pending",
        "Replay gate: Pending",
        "Credential gate: Pending",
        "Manual approval gate: Pending",
      ]
    );

    const initialGateBlock = await requestFailure(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/activate`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      }
    );

    assert.equal(initialGateBlock.status, 409);

    const initialGates = await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/gates`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.deepEqual(
      initialGates.map((item) => item.gateType),
      ["desensitization", "replay", "credential", "manual_approval"]
    );
    assert.equal(initialGates.every((item) => item.status === "pending"), true);
    assert.equal(initialGates.every((item) => item.checklist.length >= 3), true);
    assert.equal(initialGates.every((item) => item.recommendedActions.length >= 1), true);

    for (const gate of initialGates) {
      const decidedGate = await requestJson(
        `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/gates/${encodeURIComponent(gate.gateId)}/decide`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            status: "passed",
            evidenceRef: `evidence://${gate.gateType}`,
            note: {
              zh: `${gate.gateType} 审核已完成`,
              en: `${gate.gateType} review completed`,
            },
            checklist: gate.checklist.map((item) => ({
              ...item,
              status: "passed",
            })),
            recommendedActions: [
              {
                zh: `归档 ${gate.gateType} 审核结果`,
                en: `Archive the ${gate.gateType} review result`,
              },
            ],
          }),
        }
      );

      assert.equal(decidedGate.status, "passed");
      assert.equal(decidedGate.checklist.every((item) => item.status === "passed"), true);
      assert.equal(decidedGate.recommendedActions.length >= 1, true);
    }

    const packageAfterGatePass = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(packageAfterGatePass.state, "ready");
    assert.equal(packageAfterGatePass.tone, "active");

    const activation = await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/activate`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      }
    );

    assert.equal(activation.releaseId, createdRelease.releaseId);
    assert.equal(activation.state, "active");

    const activations = await requestJson(
      `${baseUrl}/v1/releases/${encodeURIComponent(createdRelease.releaseId)}/activations`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(activations.some((item) => item.activationId === activation.activationId), true);

    const packageAfterActivation = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(packageAfterActivation.statusLabel.zh, "已激活");

    const updatedRelease = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/releases/${encodeURIComponent(createdRelease.releaseId)}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          state: "staged",
        }),
      }
    );

    assert.equal(updatedRelease.state, "staged");

    const releases = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/releases`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(
      releases.some((item) => item.releaseId === createdRelease.releaseId && item.state === "staged"),
      true
    );

    const packageAfterReleaseUpdate = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(packageAfterReleaseUpdate.state, "ready");
    assert.equal(packageAfterReleaseUpdate.tone, "active");

    const createdReplay = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/replays`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          sourceRunId: "run_creator_debug_0001",
          state: "ready",
          summary: {
            zh: "回放已登记，准备执行差异检查",
            en: "Replay recorded and ready for diff checks",
          },
        }),
      }
    );

    assert.equal(createdReplay.packageId, "creator-drama-suite");
    assert.equal(createdReplay.state, "ready");

    const updatedReplay = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/replays/${encodeURIComponent(createdReplay.replayId)}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          state: "running",
        }),
      }
    );

    assert.equal(updatedReplay.state, "running");

    const replays = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/replays`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(
      replays.some((item) => item.replayId === createdReplay.replayId && item.state === "running"),
      true
    );

    const packageAfterReplayUpdate = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(
      packageAfterReplayUpdate.updatedAt,
      updatedReplay.updatedAt
    );

    const launchTemplate = await requestJson(
      `${baseUrl}/v1/services/${encodeURIComponent("drama-storyboard")}/launch-template`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          workspaceId: brandWorkspaceId,
          entrySurface: "dashboard",
        }),
      }
    );

    const boundCredentialIds = [];
    for (const spec of [
      {
        mcpId: "workspace:seedance-api",
        displayName: "Replay Seedance API key",
        provider: "seedance",
        approvalRequired: false,
      },
      {
        mcpId: "third-party:figma-mcp",
        displayName: "Replay Figma token",
        provider: "figma",
        approvalRequired: true,
      },
    ]) {
      const credential = await requestJson(`${baseUrl}/v1/credentials`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          scope: "workspace",
          displayName: spec.displayName,
          provider: spec.provider,
          secretKind: "api-key",
          secretValue: `smoke-${spec.provider}-key`,
          secretRef: null,
          notes: "Creator release smoke fixture",
        }),
      });
      await requestJson(`${baseUrl}/v1/mcp-bindings`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          mcpId: spec.mcpId,
          scope: "workspace",
          credentialId: credential.credentialId,
          networkPolicyRef: null,
          approvalRequired: spec.approvalRequired,
          autoAttach: false,
          notes: "Creator release smoke fixture",
        }),
      });
      boundCredentialIds.push(credential.credentialId);
    }

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        ...launchTemplate.createRunInput,
        initialMessage: "请开始整理短剧分镜并告诉我还缺什么信息。",
        bindings: {
          ...launchTemplate.createRunInput.bindings,
          firstPartyMcpIds: ["mcp.browser.playwright"],
          credentialIds: boundCredentialIds,
        },
      }),
    });

    assert.equal(createdRun.run.catalogMetadata.workspaceContextKey, "brand-lab");
    assert.equal(createdRun.run.catalogMetadata.serviceId, "drama-storyboard");

    const auditSummary = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/governance/audit/summary?workspaceContextKey=${encodeURIComponent("brand-lab")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(auditSummary.packageId, "creator-drama-suite");
    assert.equal(auditSummary.section, "audit");
    assert.equal(auditSummary.workspaceContextKey, "brand-lab");
    assert.equal(auditSummary.rows.some((row) => row.id === "audit-run-ledger"), true);
    assert.equal(
      auditSummary.rows.find((row) => row.id === "audit-run-ledger").cells[3].en.includes("artifacts"),
      true
    );

    const createdAuditExport = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/audit-exports`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          format: "json",
        }),
      }
    );

    assert.equal(createdAuditExport.export.packageId, "creator-drama-suite");
    assert.equal(createdAuditExport.export.workspaceContextKey, "brand-lab");
    assert.equal(createdAuditExport.export.format, "json");
    assert.equal(createdAuditExport.export.status, "ready");
    assert.equal(
      createdAuditExport.downloadPath,
      `/v1/packages/${encodeURIComponent("creator-drama-suite")}/audit-exports/${encodeURIComponent(createdAuditExport.export.exportId)}/content`
    );

    const auditExports = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/audit-exports?workspaceContextKey=${encodeURIComponent("brand-lab")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(
      auditExports.some((item) => item.exportId === createdAuditExport.export.exportId),
      true
    );

    const downloadedAuditExportResponse = await fetch(`${baseUrl}${createdAuditExport.downloadPath}`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    const downloadedAuditExportText = await downloadedAuditExportResponse.text();

    assert.equal(
      downloadedAuditExportResponse.ok,
      true,
      `GET ${createdAuditExport.downloadPath} failed: ${downloadedAuditExportResponse.status} ${downloadedAuditExportResponse.statusText} ${downloadedAuditExportText}`
    );
    assert.match(
      downloadedAuditExportResponse.headers.get("content-type") ?? "",
      /application\/json/
    );

    const downloadedAuditExport = JSON.parse(downloadedAuditExportText);
    assert.equal(downloadedAuditExport.package.packageId, "creator-drama-suite");
    assert.equal(downloadedAuditExport.package.workspaceContextKey, "brand-lab");
    assert.equal(downloadedAuditExport.counts.runs >= 1, true);
    assert.equal(
      downloadedAuditExport.runs.some((item) => item.runId === createdRun.run.runId),
      true
    );

    const costSummary = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/governance/cost/summary?workspaceContextKey=${encodeURIComponent("brand-lab")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(costSummary.packageId, "creator-drama-suite");
    assert.equal(costSummary.section, "cost");
    assert.equal(costSummary.workspaceContextKey, "brand-lab");
    assert.equal(costSummary.metrics[0].value.endsWith("m"), true);
    assert.equal(
      costSummary.rows.some((row) => row.id === "cost-service-drama-storyboard"),
      true
    );
    assert.equal(
      costSummary.rows
        .find((row) => row.id === "cost-service-drama-storyboard")
        .cells[2].en.includes("runs /"),
      true
    );

    const switchedWorkspace = await requestJson(`${baseUrl}/v1/workspaces/switch`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: personalWorkspaceId,
      }),
    });

    const personalHeaders = {
      authorization: `Bearer ${switchedWorkspace.tokens.accessToken}`,
    };

    const personalMembersSummary = await requestFailure(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/governance/members/summary?workspaceContextKey=${encodeURIComponent("personal")}`,
      {
        headers: {
          authorization: personalHeaders.authorization,
        },
      }
    );

    assert.equal(personalMembersSummary.status, 404);
    assert.equal(personalMembersSummary.body.error.code, "CREATOR_PACKAGE_NOT_FOUND");
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
