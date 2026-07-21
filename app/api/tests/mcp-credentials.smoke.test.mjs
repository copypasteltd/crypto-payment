import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function requestError(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  assert.equal(
    response.ok,
    false,
    `${init.method ?? "GET"} ${url} unexpectedly succeeded: ${response.status} ${response.statusText} ${text}`
  );

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

test("credentials and MCP governance smoke: create metadata, bind, and resolve into run launch payload", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-mcp-credentials-"));
  const managedStdioRefSha256 = "a".repeat(64);
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_RUNS_DIR",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_API_BASE_URL",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES",
    "CODEX_BIN",
    "LINGBAN_BRIDGE_ARGS",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const targetPath = path.join(smokeRoot, "target");
    const apiDataDir = path.join(smokeRoot, "api-data");
    const runStorageDir = path.join(apiDataDir, "runs");
    const fakeCodexScriptPath = fileURLToPath(
      new URL("./support/fake-codex-governance-hold.mjs", import.meta.url)
    );

    await mkdir(targetPath, { recursive: true });

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = apiDataDir;
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES = JSON.stringify([
      "/workspace/target/tools",
    ]);
    process.env.CODEX_BIN = process.execPath;
    process.env.LINGBAN_BRIDGE_ARGS = JSON.stringify([fakeCodexScriptPath]);

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "smoke-mcp@example.com",
        password: "TestPassword123!",
        displayName: "Smoke MCP",
        workspaceName: "Smoke Governance Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const browserRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000000_missing_browser_state",
        sessionVersionId: "sev_00000000_missing_browser_state",
        title: "Credential-free isolated browser",
        targetPath: path.join(smokeRoot, "target-missing-browser-state"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: ["mcp.browser.playwright"],
          externalConnectorRefs: [],
          credentialIds: [],
        },
      }),
    });
    assert.equal(browserRun.run.status, "WAITING_APPROVAL");
    const browserAggregate = JSON.parse(
      await readFile(path.join(runStorageDir, `${browserRun.run.runId}.json`), "utf8")
    );
    assert.deepEqual(browserAggregate.startJob.bindings.credentialIds, []);
    assert.equal(browserAggregate.startJob.mcpBindings.length, 1);
    assert.equal(
      browserAggregate.startJob.mcpBindings[0].ref,
      "/usr/local/bin/lingban-playwright-mcp"
    );
    assert.equal(browserAggregate.startJob.mcpBindings[0].credentialId, null);

    const createdCredential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Seedance Production Key",
        provider: "seedance",
        secretKind: "api-key",
        secretValue: "seedance-live-key-001",
        secretRef: "vault://seedance/production",
        notes: "workspace seedance key",
      }),
    });

    assert.equal(createdCredential.scope, "workspace");
    assert.equal(createdCredential.mountMode, "env");
    assert.equal(createdCredential.brokerKind, "local-envelope");
    assert.equal(createdCredential.secretVersion, 1);
    assert.equal(createdCredential.lastMaterializedAt, null);

    const createdBinding = await requestJson(`${baseUrl}/v1/mcp-bindings`, {
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

    const visibleCredentials = await requestJson(`${baseUrl}/v1/credentials`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(visibleCredentials.length, 1);
    assert.equal(visibleCredentials[0].credentialId, createdCredential.credentialId);

    const visibleMcps = await requestJson(`${baseUrl}/v1/mcps`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      visibleMcps.some((item) => item.mcpId === "workspace:seedance-api"),
      true
    );

    const visiblePolicies = await requestJson(`${baseUrl}/v1/mcp-network-policies`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      visiblePolicies.some((item) => item.policyRef === "np_seedance_workspace"),
      true
    );

    const disallowedStdioMcp = await requestError(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:stdio-disallowed",
        displayName: "Disallowed Local MCP",
        description: "stdio helper outside the configured allowlist",
        source: "workspace-managed",
        transport: "stdio",
        ref: "/workspace/runtime/helpers/disallowed-helper.mjs",
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: null,
        approvalRequired: false,
        tags: ["test", "stdio", "disallowed"],
      }),
    });
    assert.equal(disallowedStdioMcp.status, 400);
    assert.equal(disallowedStdioMcp.body.error.code, "MCP_STDIO_PATH_NOT_ALLOWED");

    const managedStdioMcp = await requestJson(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:stdio-allowed",
        displayName: "Allowed Local MCP",
        description: "stdio helper inside the configured allowlist",
        source: "workspace-managed",
        transport: "stdio",
        ref: "/workspace/target/tools/allowed-stdio-mcp.mjs",
        stdioPolicy: {
          refSha256: managedStdioRefSha256,
        },
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: null,
        approvalRequired: false,
        tags: ["test", "stdio", "allowed"],
      }),
    });
    assert.equal(managedStdioMcp.mcpId, "workspace:stdio-allowed");

    const managedStdioProbe = await requestJson(
      `${baseUrl}/v1/mcps/${encodeURIComponent(managedStdioMcp.mcpId)}/probe`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      }
    );
    assert.equal(managedStdioProbe.status, "unsupported");

    const managedStdioDefaultPolicy = await requestError(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:stdio-with-policy",
        displayName: "Invalid Local MCP",
        description: "stdio helper cannot attach a default network policy",
        source: "workspace-managed",
        transport: "stdio",
        ref: "/workspace/target/tools/invalid-stdio-mcp.mjs",
        stdioPolicy: {
          refSha256: managedStdioRefSha256,
        },
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_seedance_workspace",
        approvalRequired: false,
        tags: ["test", "stdio", "policy"],
      }),
    });
    assert.equal(managedStdioDefaultPolicy.status, 400);
    assert.equal(
      managedStdioDefaultPolicy.body.error.code,
      "MCP_NETWORK_POLICY_UNSUPPORTED"
    );

    const managedStdioBinding = await requestJson(`${baseUrl}/v1/mcp-bindings`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:stdio-allowed",
        scope: "session-version",
        scopeRef: "sev_00000020_stdio",
        credentialId: null,
        autoAttach: true,
        approvalRequired: true,
        notes: "attach governed stdio helper by default",
      }),
    });
    assert.equal(managedStdioBinding.mcpId, "workspace:stdio-allowed");

    const managedStdioBindingPolicy = await requestError(`${baseUrl}/v1/mcp-bindings`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:stdio-allowed",
        scope: "session-version",
        scopeRef: "sev_00000020_stdio",
        credentialId: null,
        networkPolicyRef: "np_seedance_workspace",
        autoAttach: false,
        approvalRequired: false,
        notes: "stdio should reject network policy overrides",
      }),
    });
    assert.equal(managedStdioBindingPolicy.status, 400);
    assert.equal(
      managedStdioBindingPolicy.body.error.code,
      "MCP_NETWORK_POLICY_UNSUPPORTED"
    );

    const stdioApprovalRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000020_stdio",
        sessionVersionId: "sev_00000020_stdio",
        title: "Managed stdio MCP approval smoke",
        targetPath: path.join(smokeRoot, "target-stdio-approval"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
      }),
    });
    assert.equal(stdioApprovalRun.run.status, "WAITING_APPROVAL");

    const stdioAggregatePath = path.join(
      runStorageDir,
      `${stdioApprovalRun.run.runId}.json`
    );
    const stdioAggregate = JSON.parse(await readFile(stdioAggregatePath, "utf8"));
    const stdioRuntimeBinding = stdioAggregate.startJob.mcpBindings.find(
      (binding) => binding.mcpId === "workspace:stdio-allowed"
    );
    assert.equal(Boolean(stdioRuntimeBinding), true);
    assert.equal(stdioRuntimeBinding.transport, "stdio");
    assert.equal(stdioRuntimeBinding.ref, "/workspace/target/tools/allowed-stdio-mcp.mjs");
    assert.equal(stdioRuntimeBinding.stdioPolicy.refSha256, managedStdioRefSha256);
    assert.equal(stdioRuntimeBinding.networkPolicyRef, null);
    assert.equal(stdioRuntimeBinding.bindingId, managedStdioBinding.bindingId);

    const waitingStdioApprovalRun = await requestJson(
      `${baseUrl}/v1/runs/${stdioApprovalRun.run.runId}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(waitingStdioApprovalRun.approvals.length, 1);
    assert.equal(waitingStdioApprovalRun.approvals[0].kind, "mcp-access");
    assert.equal(
      waitingStdioApprovalRun.approvals[0].relatedResourceRef,
      "workspace:stdio-allowed"
    );

    const createRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000021",
        sessionVersionId: "sev_00000021",
        title: "MCP governance smoke",
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

    const runAggregatePath = path.join(runStorageDir, `${createRun.run.runId}.json`);
    const aggregate = JSON.parse(await readFile(runAggregatePath, "utf8"));

    assert.deepEqual(aggregate.startJob.bindings.firstPartyMcpIds, []);
    assert.deepEqual(aggregate.startJob.bindings.externalConnectorRefs, ["workspace:seedance-api"]);
    assert.deepEqual(aggregate.startJob.bindings.credentialIds, [createdCredential.credentialId]);
    assert.equal(aggregate.startJob.credentialMounts.length, 1);
    assert.equal(aggregate.startJob.credentialMounts[0].credentialId, createdCredential.credentialId);
    assert.equal(aggregate.startJob.credentialMounts[0].mode, "env");
    assert.equal(aggregate.startJob.mcpBindings.length, 1);
    assert.equal(aggregate.startJob.mcpBindings[0].bindingId, createdBinding.bindingId);
    assert.equal(aggregate.startJob.mcpBindings[0].ref, "https://mcp.workspace.internal/seedance");
    assert.equal(aggregate.startJob.mcpBindings[0].credentialId, createdCredential.credentialId);
    assert.equal(aggregate.startJob.mcpBindings[0].authMode, "env");

    const materializedSecrets = await requestJson(
      `${baseUrl}/internal/runs/${createRun.run.runId}/credentials/materialize`,
      {
        method: "POST",
        headers: {
          "x-lingban-internal-token": "smoke-internal-token",
          "x-lingban-trace-id": "trace_smoke_materialize_01",
        },
      }
    );
    assert.equal(materializedSecrets.lease.runId, createRun.run.runId);
    assert.equal(materializedSecrets.lease.workspaceId, register.currentWorkspace.workspaceId);
    assert.equal(materializedSecrets.lease.brokerKind, "local-envelope");
    assert.equal(
      materializedSecrets.lease.secretVersionByCredentialId[createdCredential.credentialId],
      1
    );
    assert.equal(
      materializedSecrets.secrets[createdCredential.credentialId],
      "seedance-live-key-001"
    );

    const materializedCredential = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(typeof materializedCredential.lastMaterializedAt, "string");

    const materializedCredentialAudit = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/audit-events?limit=12`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      materializedCredentialAudit.some((event) => event.action === "created"),
      true
    );
    const materializedAuditEvent = materializedCredentialAudit.find(
      (event) =>
        event.action === "materialized" &&
        event.leaseId === materializedSecrets.lease.leaseId
    );
    assert.equal(Boolean(materializedAuditEvent), true);
    assert.equal(materializedAuditEvent.runId, createRun.run.runId);
    assert.equal(materializedAuditEvent.leaseId, materializedSecrets.lease.leaseId);
    assert.equal(materializedAuditEvent.traceId, "trace_smoke_materialize_01");
    assert.equal(materializedAuditEvent.outcome, "success");

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
    assert.equal(credentialUsage.summary.totalRunCount >= 1, true);
    assert.equal(credentialUsage.summary.activeRunCount >= 1, true);
    assert.equal(
      credentialUsage.activeRuns.some((run) => run.runId === createRun.run.runId),
      true
    );
    assert.equal(
      credentialUsage.bindings.some((binding) => binding.bindingId === createdBinding.bindingId),
      true
    );

    const blockedSuspend = await requestError(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/suspend`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      }
    );
    assert.equal(blockedSuspend.status, 409);
    assert.equal(blockedSuspend.body.error.code, "CREDENTIAL_ACTIVE_USAGE_PRESENT");
    assert.equal(
      blockedSuspend.body.error.details.summary.credentialId,
      createdCredential.credentialId
    );
    assert.equal(blockedSuspend.body.error.details.summary.activeRunCount >= 1, true);

    const suspendedCredential = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/suspend`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          impactAction: "allow-active-runs",
          note: "suspend but let the current run finish",
        }),
      }
    );
    assert.equal(suspendedCredential.credential.status, "disabled");
    assert.equal(suspendedCredential.activeRunCount >= 1, true);
    assert.equal(suspendedCredential.cancelledRunIds.length, 0);

    const disabledRun = await requestError(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000021_disabled",
        sessionVersionId: "sev_00000021_disabled",
        title: "Disabled credential smoke",
        targetPath: path.join(smokeRoot, "target-disabled-credential"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
      }),
    });
    assert.equal(disabledRun.status, 409);
    assert.equal(disabledRun.body.error.code, "RUN_CREDENTIAL_DISABLED");

    const revokedCredential = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/revoke`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          impactAction: "cancel-active-runs",
          note: "revoke immediately and stop active execution",
        }),
      }
    );
    assert.equal(revokedCredential.credential.status, "revoked");
    assert.equal(
      revokedCredential.cancelledRunIds.includes(createRun.run.runId),
      true
    );

    const cancelledRun = await requestJson(`${baseUrl}/v1/runs/${createRun.run.runId}`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(cancelledRun.run.status, "CANCELLED");

    const reactivatedCredential = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/rotate`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          secretValue: "seedance-live-key-002",
          secretRef: "vault://seedance/production@reactivated",
          note: "reactivate credential for the remaining smoke chain",
        }),
      }
    );
    assert.equal(reactivatedCredential.status, "active");

    const expiringCredential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Expiring Seedance Key",
        provider: "seedance",
        secretKind: "api-key",
        secretValue: "seedance-expiring-key-001",
        secretRef: "vault://seedance/expiring",
        expiresAt: new Date(Date.now() + 900).toISOString(),
        notes: "credential that will auto-freeze on expiry",
      }),
    });
    assert.equal(expiringCredential.status, "active");

    const rotationDueCredential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Rotation Due Seedance Key",
        provider: "seedance",
        secretKind: "api-key",
        secretValue: "seedance-rotation-key-001",
        secretRef: "vault://seedance/rotation-due",
        rotationDueAt: new Date(Date.now() + 900).toISOString(),
        notes: "credential that will auto-enter needs-rotation",
      }),
    });
    assert.equal(rotationDueCredential.status, "active");

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const lifecycleSweep = await requestJson(`${baseUrl}/internal/credentials/lifecycle/sweep`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lingban-internal-token": "smoke-internal-token",
      },
      body: JSON.stringify({
        credentialId: expiringCredential.credentialId,
      }),
    });
    assert.equal(lifecycleSweep.changedCount, 1);
    assert.equal(lifecycleSweep.changes[0].credentialId, expiringCredential.credentialId);
    assert.equal(lifecycleSweep.changes[0].action, "auto-disabled-expired");

    const rotationSweep = await requestJson(`${baseUrl}/internal/credentials/lifecycle/sweep`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lingban-internal-token": "smoke-internal-token",
      },
      body: JSON.stringify({
        credentialId: rotationDueCredential.credentialId,
      }),
    });
    assert.equal(rotationSweep.changedCount, 1);
    assert.equal(rotationSweep.changes[0].credentialId, rotationDueCredential.credentialId);
    assert.equal(rotationSweep.changes[0].action, "auto-needs-rotation");

    const frozenCredential = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(expiringCredential.credentialId)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(frozenCredential.status, "disabled");

    const dueCredential = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(rotationDueCredential.credentialId)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(dueCredential.status, "needs-rotation");

    const disabledCredentials = await requestJson(
      `${baseUrl}/v1/credentials?status=disabled`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      disabledCredentials.some(
        (item) => item.credentialId === expiringCredential.credentialId
      ),
      true
    );

    const rotationDueCredentials = await requestJson(
      `${baseUrl}/v1/credentials?status=needs-rotation`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      rotationDueCredentials.some(
        (item) => item.credentialId === rotationDueCredential.credentialId
      ),
      true
    );

    const expiredRun = await requestError(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000025_expired",
        sessionVersionId: "sev_00000025_expired",
        title: "Expired credential smoke",
        targetPath: path.join(smokeRoot, "target-expired-credential"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [expiringCredential.credentialId],
        },
      }),
    });
    assert.equal(expiredRun.status, 409);
    assert.equal(expiredRun.body.error.code, "RUN_CREDENTIAL_EXPIRED");

    const expiringAudit = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(expiringCredential.credentialId)}/audit-events?limit=12`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      expiringAudit.some((event) => event.action === "auto-disabled-expired"),
      true
    );

    const rotationAudit = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(rotationDueCredential.credentialId)}/audit-events?limit=12`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      rotationAudit.some((event) => event.action === "auto-needs-rotation"),
      true
    );

    const invalidWebsocketMcp = await requestError(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "third-party:bad-websocket-ref",
        displayName: "Bad Websocket MCP",
        description: "invalid websocket endpoint shape",
        source: "third-party",
        transport: "websocket",
        ref: "https://third-party-mcp.example.org/invalid",
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_invalid_ws",
        approvalRequired: false,
        tags: ["test"],
      }),
    });
    assert.equal(invalidWebsocketMcp.status, 400);
    assert.equal(invalidWebsocketMcp.body.error.code, "MCP_REF_INVALID");

    const missingPolicyMcp = await requestError(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "third-party:missing-policy",
        displayName: "Missing Policy MCP",
        description: "references a policy that does not exist",
        source: "third-party",
        transport: "http",
        ref: "https://third-party-mcp.example.org/missing-policy",
        status: "active",
        riskLevel: "high",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_missing_policy",
        approvalRequired: true,
        tags: ["test", "missing-policy"],
      }),
    });
    assert.equal(missingPolicyMcp.status, 404);
    assert.equal(missingPolicyMcp.body.error.code, "MCP_NETWORK_POLICY_NOT_FOUND");

    await requestJson(`${baseUrl}/v1/mcp-network-policies`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        policyRef: "np_wrong_host",
        displayName: "Wrong Host Policy",
        description: "policy that intentionally does not match the third-party endpoint",
        status: "active",
        mode: "allowlist",
        allowedProtocols: ["https"],
        allowedHostPatterns: ["allowed.example.org"],
        allowedPorts: [443],
        allowedPathPrefixes: ["/governed-assets"],
        requireTls: true,
        blockPrivateNetwork: true,
        tags: ["test", "negative"],
      }),
    });

    const mismatchedPolicyMcp = await requestError(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "third-party:policy-mismatch",
        displayName: "Policy Mismatch MCP",
        description: "policy exists but does not allow the target host",
        source: "third-party",
        transport: "http",
        ref: "https://third-party-mcp.example.org/governed-assets",
        status: "active",
        riskLevel: "high",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_wrong_host",
        approvalRequired: true,
        tags: ["test", "policy-mismatch"],
      }),
    });
    assert.equal(mismatchedPolicyMcp.status, 400);
    assert.equal(mismatchedPolicyMcp.body.error.code, "MCP_NETWORK_POLICY_VIOLATION");

    const unmanagedNoPolicy = await requestJson(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "third-party:no-policy",
        displayName: "Third-party Without Policy",
        description: "remote unmanaged connector without approved network policy",
        source: "third-party",
        transport: "http",
        ref: "https://third-party-mcp.example.org/no-policy",
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: null,
        approvalRequired: false,
        tags: ["test", "no-policy"],
      }),
    });
    assert.equal(unmanagedNoPolicy.mcpId, "third-party:no-policy");

    const unregisteredRun = await requestError(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000022",
        sessionVersionId: "sev_00000022",
        title: "MCP unregistered smoke",
        targetPath: path.join(smokeRoot, "target-unregistered"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: ["third-party:not-registered"],
          credentialIds: [],
        },
      }),
    });
    assert.equal(unregisteredRun.status, 409);
    assert.equal(unregisteredRun.body.error.code, "RUN_MCP_NOT_REGISTERED");

    const noPolicyRun = await requestError(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000023",
        sessionVersionId: "sev_00000023",
        title: "MCP no policy smoke",
        targetPath: path.join(smokeRoot, "target-no-policy"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: ["third-party:no-policy"],
          credentialIds: [],
        },
      }),
    });
    assert.equal(noPolicyRun.status, 409);
    assert.equal(noPolicyRun.body.error.code, "RUN_MCP_NETWORK_POLICY_REQUIRED");

    const governedPolicy = await requestJson(`${baseUrl}/v1/mcp-network-policies`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        policyRef: "np_governed_assets",
        displayName: "Governed Asset Egress",
        description: "allow the governed asset connector endpoint only",
        status: "active",
        mode: "allowlist",
        allowedProtocols: ["https"],
        allowedHostPatterns: ["third-party-mcp.example.org"],
        allowedPorts: [443],
        allowedPathPrefixes: ["/governed-assets"],
        requireTls: true,
        blockPrivateNetwork: true,
        tags: ["test", "governed"],
      }),
    });
    assert.equal(governedPolicy.policyRef, "np_governed_assets");

    const updatedGovernedPolicy = await requestJson(
      `${baseUrl}/v1/mcp-network-policies/${encodeURIComponent("np_governed_assets")}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          displayName: "Governed Asset Egress Policy",
          allowedPathPrefixes: ["/governed-assets"],
          tags: ["test", "governed", "patched"],
        }),
      }
    );
    assert.equal(updatedGovernedPolicy.displayName, "Governed Asset Egress Policy");
    assert.equal(updatedGovernedPolicy.tags.includes("patched"), true);

    const governedThirdParty = await requestJson(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "third-party:governed-assets",
        displayName: "Governed Asset Library",
        description: "registered high-risk third-party connector",
        source: "third-party",
        transport: "http",
        ref: "https://third-party-mcp.example.org/governed-assets",
        status: "active",
        riskLevel: "high",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_governed_assets",
        approvalRequired: true,
        tags: ["test", "governed"],
      }),
    });
    assert.equal(governedThirdParty.mcpId, "third-party:governed-assets");

    const approvalRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000024",
        sessionVersionId: "sev_00000024",
        title: "MCP approval smoke",
        targetPath: path.join(smokeRoot, "target-approval"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: ["third-party:governed-assets"],
          credentialIds: [],
        },
      }),
    });
    assert.equal(approvalRun.run.status, "WAITING_APPROVAL");

    const waitingApprovalRun = await requestJson(
      `${baseUrl}/v1/runs/${approvalRun.run.runId}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(waitingApprovalRun.approvals.length, 1);
    assert.equal(waitingApprovalRun.approvals[0].kind, "mcp-access");
    assert.equal(
      waitingApprovalRun.approvals[0].relatedResourceRef,
      "third-party:governed-assets"
    );

    const approvedMcpRun = await requestJson(
      `${baseUrl}/v1/runs/${approvalRun.run.runId}/approve`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          approvalId: waitingApprovalRun.approvals[0].approvalId,
          approved: true,
          note: "approved third-party connector",
        }),
      }
    );
    assert.equal(approvedMcpRun.approvals[0].state, "approved");
    assert.equal(approvedMcpRun.run.status, "STARTING");

    await requestJson(`${baseUrl}/internal/runs/${createRun.run.runId}/events`, {
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
              callId: "mcpcall_00000001",
              runId: createRun.run.runId,
              workspaceId: register.currentWorkspace.workspaceId,
              requestedByUserId: createRun.run.requestedByUserId ?? null,
              workspaceContextKey: createRun.run.catalogMetadata?.workspaceContextKey ?? null,
              serviceId: createRun.run.catalogMetadata?.serviceId ?? null,
              taskVersionId: createRun.run.taskVersionId,
              sessionVersionId: createRun.run.sessionVersionId,
              entrySurface: createRun.run.entrySurface,
              mcpId: aggregate.startJob.mcpBindings[0].mcpId,
              bindingId: aggregate.startJob.mcpBindings[0].bindingId,
              toolName: "render_scene",
              requestId: "req_render_scene_01",
              status: "success",
              startedAt: "2026-07-09T03:00:00.000Z",
              finishedAt: "2026-07-09T03:00:01.250Z",
              durationMs: 1250,
              inputSummary: "scene=pilot",
              outputSummary: "artifact=shot-01.png",
              errorMessage: null,
              inputBytes: 128,
              outputBytes: 512,
              displayName: aggregate.startJob.mcpBindings[0].displayName,
              source: aggregate.startJob.mcpBindings[0].source,
              transport: aggregate.startJob.mcpBindings[0].transport,
              ref: aggregate.startJob.mcpBindings[0].ref,
              riskLevel: aggregate.startJob.mcpBindings[0].riskLevel,
              networkPolicyRef: aggregate.startJob.mcpBindings[0].networkPolicyRef,
              approvalRequired: aggregate.startJob.mcpBindings[0].approvalRequired,
              occurredAt: "2026-07-09T03:00:01.250Z",
              recordedAt: "2026-07-09T03:00:02.000Z",
            },
          },
        ],
      }),
    });

    const runMcpCalls = await requestJson(
      `${baseUrl}/v1/runs/${createRun.run.runId}/mcp-calls`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(runMcpCalls.length, 1);
    assert.equal(runMcpCalls[0].callId, "mcpcall_00000001");
    assert.equal(runMcpCalls[0].mcpId, "workspace:seedance-api");
    assert.equal(runMcpCalls[0].toolName, "render_scene");
    assert.equal(runMcpCalls[0].status, "success");

    const workspaceMcpCalls = await requestJson(
      `${baseUrl}/v1/mcp-calls?runId=${encodeURIComponent(createRun.run.runId)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(workspaceMcpCalls.length, 1);
    assert.equal(workspaceMcpCalls[0].callId, "mcpcall_00000001");

    const billingEntries = await requestJson(
      `${baseUrl}/v1/billing/entries?runId=${encodeURIComponent(createRun.run.runId)}&metric=mcp_calls`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(billingEntries.length, 1);
    assert.equal(billingEntries[0].source, "mcp-call");
    assert.equal(billingEntries[0].metric, "mcp_calls");
    assert.equal(billingEntries[0].costBasis, "actual");

    const governanceEvents = await requestJson(
      `${baseUrl}/v1/mcp-governance-events?limit=100`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    const connectorRegisteredEvent = governanceEvents.find(
      (event) =>
        event.action === "connector.registered" &&
        event.mcpId === managedStdioMcp.mcpId
    );
    assert.equal(Boolean(connectorRegisteredEvent), true);
    assert.equal(connectorRegisteredEvent.transport, "stdio");

    const connectorTestedEvent = governanceEvents.find(
      (event) =>
        event.action === "connector.tested" &&
        event.mcpId === managedStdioMcp.mcpId
    );
    assert.equal(Boolean(connectorTestedEvent), true);
    assert.equal(connectorTestedEvent.healthStatus, "unsupported");
    assert.equal(connectorTestedEvent.outcome, "error");

    const connectorBoundEvent = governanceEvents.find(
      (event) =>
        event.action === "connector.bound" &&
        event.bindingId === createdBinding.bindingId
    );
    assert.equal(Boolean(connectorBoundEvent), true);
    assert.equal(connectorBoundEvent.scope, "workspace");
    assert.equal(connectorBoundEvent.credentialId, createdCredential.credentialId);

    const connectorBoundToRunEvent = governanceEvents.find(
      (event) =>
        event.action === "connector.bound_to_run" &&
        event.runId === createRun.run.runId &&
        event.mcpId === "workspace:seedance-api"
    );
    assert.equal(Boolean(connectorBoundToRunEvent), true);
    assert.equal(
      connectorBoundToRunEvent.networkPolicyRef,
      aggregate.startJob.mcpBindings[0].networkPolicyRef
    );

    const blockedExternalCallEvent = governanceEvents.find(
      (event) =>
        event.action === "external_call.blocked" &&
        event.mcpId === "third-party:no-policy" &&
        event.reasonCode === "RUN_MCP_NETWORK_POLICY_REQUIRED"
    );
    assert.equal(Boolean(blockedExternalCallEvent), true);
    assert.equal(blockedExternalCallEvent.outcome, "blocked");
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
