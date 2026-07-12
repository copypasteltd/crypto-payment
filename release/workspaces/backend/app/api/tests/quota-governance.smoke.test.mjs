import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
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

test("quota governance smoke: create policy, gate run creation, and approve override", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-quota-governance-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
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
    const targetPath = path.join(smokeRoot, "target");
    const apiDataDir = path.join(smokeRoot, "api-data");

    await mkdir(targetPath, { recursive: true });

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = apiDataDir;
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "smoke-quota@example.com",
        password: "TestPassword123!",
        displayName: "Smoke Quota",
        workspaceName: "Quota Governance Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const createdPolicy = await requestJson(`${baseUrl}/v1/quotas/policies`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scopeType: "workspace",
        scopeRefId: register.currentWorkspace.workspaceId,
        metric: "daily_runs",
        windowType: "daily",
        limitValue: 100,
        softLimitValue: 0,
        hardLimitValue: 100,
        actionOnSoftLimit: "require_approval",
        actionOnHardLimit: "block",
        summary: {
          zh: "Smoke quota approval gate",
          en: "Smoke quota approval gate",
        },
        notes: "Force the first run into quota approval for smoke coverage.",
      }),
    });

    assert.equal(createdPolicy.scopeType, "workspace");
    assert.equal(createdPolicy.metric, "daily_runs");

    const visiblePolicies = await requestJson(`${baseUrl}/v1/quotas/policies`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      visiblePolicies.some((item) => item.policyId === createdPolicy.policyId),
      true
    );

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000031",
        sessionVersionId: "sev_00000031",
        title: "Quota governance smoke",
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

    assert.equal(createdRun.run.status, "WAITING_APPROVAL");
    const waitingRun = await requestJson(`${baseUrl}/v1/runs/${createdRun.run.runId}`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(waitingRun.approvals.length, 1);
    assert.equal(waitingRun.approvals[0].kind, "quota-override");
    assert.ok(waitingRun.approvals[0].relatedResourceRef);

    const visibleCounters = await requestJson(`${baseUrl}/v1/quotas/counters`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      visibleCounters.some((item) => item.policyId === createdPolicy.policyId && item.currentValue === 1),
      true
    );

    const visibleOverrides = await requestJson(`${baseUrl}/v1/quotas/overrides`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    const pendingOverride = visibleOverrides.find(
      (item) => item.overrideId === waitingRun.approvals[0].relatedResourceRef
    );
    assert.ok(pendingOverride);
    assert.equal(pendingOverride.status, "pending");

    const approvedOverride = await requestJson(
      `${baseUrl}/v1/quotas/overrides/${pendingOverride.overrideId}/approve`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          note: "smoke approval",
        }),
      }
    );

    assert.equal(approvedOverride.status, "approved");
    assert.equal(approvedOverride.decisionNote, "smoke approval");

    const approvedRun = await requestJson(`${baseUrl}/v1/runs/${createdRun.run.runId}`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });

    assert.equal(approvedRun.approvals[0].state, "approved");
    assert.ok(
      ["RUNNING", "READY", "QUEUED", "STARTING"].includes(approvedRun.run.status),
      `unexpected post-approval run status: ${approvedRun.run.status}`
    );

    const quotaEvents = await requestJson(`${baseUrl}/v1/quotas/events`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    const approvalPendingEvent = quotaEvents.find(
      (item) => item.policyId === createdPolicy.policyId && item.decision === "approval_pending"
    );
    const approvedOverrideEvent = quotaEvents.find(
      (item) => item.overrideId === pendingOverride.overrideId && item.decision === "approved_override"
    );

    assert.ok(approvalPendingEvent);
    assert.ok(approvedOverrideEvent);
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
