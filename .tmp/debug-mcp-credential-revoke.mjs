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

async function requestError(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    body: text ? JSON.parse(text) : null,
  };
}

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-mcp-credential-debug-"));
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
];
const envBackup = new Map(envKeys.map((key) => [key, process.env[key]]));

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
  process.env.LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES = JSON.stringify([
    "/workspace/target/tools",
  ]);
  process.env.CODEX_BIN = process.execPath;

  const { startApiServer } = await import("../app/api/dist/index.js");
  app = await startApiServer();

  const register = await requestJson(`${baseUrl}/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "debug-mcp@example.com",
      password: "TestPassword123!",
      displayName: "Debug MCP",
      workspaceName: "Debug Governance Workspace",
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
      secretValue: "seedance-live-key-001",
      secretRef: "vault://seedance/production",
      notes: "workspace seedance key",
    }),
  });

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

  console.log("binding", createdBinding.bindingId);

  const createRun = await requestJson(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      workspaceId: register.currentWorkspace.workspaceId,
      taskVersionId: "tsv_00000020",
      sessionVersionId: "sev_00000020",
      title: "Credential Governance Smoke",
      targetPath,
      entrySurface: "dashboard",
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: ["workspace:seedance-api"],
        credentialIds: [createdCredential.credentialId],
      },
    }),
  });

  console.log("created run status", createRun.run.status, createRun.run.runId);

  const usageBeforeSuspend = await requestJson(
    `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/usages`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );

  console.log("usage before suspend", JSON.stringify(usageBeforeSuspend, null, 2));

  const suspend = await requestJson(
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

  console.log("suspend", JSON.stringify(suspend, null, 2));

  const runAfterSuspend = await requestJson(`${baseUrl}/v1/runs/${createRun.run.runId}`, {
    headers: {
      authorization: authHeaders.authorization,
    },
  });
  console.log("run after suspend", runAfterSuspend.run.status, runAfterSuspend.run.statusReason);

  const usageBeforeRevoke = await requestJson(
    `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/usages`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  console.log("usage before revoke", JSON.stringify(usageBeforeRevoke, null, 2));

  const revoke = await requestJson(
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
  console.log("revoke", JSON.stringify(revoke, null, 2));

  const runAfterRevoke = await requestJson(`${baseUrl}/v1/runs/${createRun.run.runId}`, {
    headers: {
      authorization: authHeaders.authorization,
    },
  });
  console.log("run after revoke", runAfterRevoke.run.status, runAfterRevoke.run.statusReason);

  const disabledRun = await requestError(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      workspaceId: register.currentWorkspace.workspaceId,
      taskVersionId: "tsv_debug_disabled",
      sessionVersionId: "sev_debug_disabled",
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
  console.log("disabled run result", JSON.stringify(disabledRun, null, 2));
} finally {
  if (app) {
    await app.close().catch(() => undefined);
  }

  for (const [key, value] of envBackup.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
}
