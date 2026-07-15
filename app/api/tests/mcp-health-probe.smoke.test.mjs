import test from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
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

test("mcp health probe smoke: probe snapshots persist healthy/degraded/blocked/unsupported statuses", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-mcp-health-probe-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_RUNS_DIR",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_API_BASE_URL",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_MCP_PROBE_TIMEOUT_MS",
    "CODEX_BIN",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;
  let remoteServer = null;

  try {
    const apiPort = await allocatePort();
    const remotePort = await allocatePort();
    const baseUrl = `http://127.0.0.1:${apiPort}`;
    const apiDataDir = path.join(smokeRoot, "api-data");

    await mkdir(path.join(smokeRoot, "target"), { recursive: true });

    remoteServer = createHttpServer((request, response) => {
      if (request.url === "/health") {
        response.writeHead(200, {
          "content-type": "application/json",
        });
        response.end(
          JSON.stringify({
            tools: ["render_scene", "list_assets"],
          })
        );
        return;
      }

      if (request.url === "/unauthorized") {
        response.writeHead(401, {
          "content-type": "application/json",
        });
        response.end(JSON.stringify({ error: "auth required" }));
        return;
      }

      if (request.url === "/events") {
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        response.end("event: ready\ndata: ok\n\n");
        return;
      }

      response.writeHead(404, {
        "content-type": "application/json",
      });
      response.end(JSON.stringify({ error: "not found" }));
    });

    await new Promise((resolve, reject) => {
      remoteServer.listen(remotePort, "127.0.0.1", (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(undefined);
      });
    });

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(apiPort);
    process.env.LINGBAN_DATA_DIR = apiDataDir;
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.LINGBAN_MCP_PROBE_TIMEOUT_MS = "1500";
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "smoke-mcp-health@example.com",
        password: "TestPassword123!",
        displayName: "Smoke MCP Health",
        workspaceName: "Smoke MCP Health Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const localPolicy = await requestJson(`${baseUrl}/v1/mcp-network-policies`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        policyRef: "np_local_probe_http",
        displayName: "Local Probe HTTP Policy",
        description: "allow local probe targets for smoke tests",
        status: "active",
        mode: "allowlist",
        allowedProtocols: ["http"],
        allowedHostPatterns: ["127.0.0.1"],
        allowedPorts: [remotePort],
        allowedPathPrefixes: ["/"],
        requireTls: false,
        blockPrivateNetwork: false,
        tags: ["smoke", "probe"],
      }),
    });
    assert.equal(localPolicy.policyRef, "np_local_probe_http");

    const healthyMcp = await requestJson(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:probe-http",
        displayName: "Probe HTTP MCP",
        description: "local healthy probe endpoint",
        source: "workspace-managed",
        transport: "http",
        ref: `http://127.0.0.1:${remotePort}/health`,
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_local_probe_http",
        approvalRequired: false,
        tags: ["smoke", "probe", "healthy"],
      }),
    });
    assert.equal(healthyMcp.mcpId, "workspace:probe-http");

    const healthyBinding = await requestJson(`${baseUrl}/v1/mcp-bindings`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:probe-http",
        scope: "workspace",
        networkPolicyRef: "np_local_probe_http",
        approvalRequired: false,
        autoAttach: true,
        notes: "probe binding",
      }),
    });

    const healthyProbe = await requestJson(
      `${baseUrl}/v1/mcps/${encodeURIComponent("workspace:probe-http")}/probe`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          bindingId: healthyBinding.bindingId,
        }),
      }
    );
    assert.equal(healthyProbe.status, "healthy");
    assert.equal(healthyProbe.bindingId, healthyBinding.bindingId);
    assert.equal(healthyProbe.toolCount, 2);
    assert.deepEqual(healthyProbe.toolNames, ["render_scene", "list_assets"]);
    assert.equal(healthyProbe.policyEnforced, true);
    assert.equal(healthyProbe.httpStatus, 200);

    const latestHealthyProbe = await requestJson(
      `${baseUrl}/v1/mcps/${encodeURIComponent("workspace:probe-http")}/health?bindingId=${encodeURIComponent(healthyBinding.bindingId)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(latestHealthyProbe.snapshotId, healthyProbe.snapshotId);
    assert.deepEqual(latestHealthyProbe.toolNames, ["render_scene", "list_assets"]);

    const degradedMcp = await requestJson(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:probe-auth",
        displayName: "Probe Auth MCP",
        description: "local degraded auth endpoint",
        source: "workspace-managed",
        transport: "http",
        ref: `http://127.0.0.1:${remotePort}/unauthorized`,
        status: "active",
        riskLevel: "medium",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_local_probe_http",
        approvalRequired: false,
        tags: ["smoke", "probe", "degraded"],
      }),
    });
    assert.equal(degradedMcp.mcpId, "workspace:probe-auth");

    const degradedProbe = await requestJson(
      `${baseUrl}/v1/mcps/${encodeURIComponent("workspace:probe-auth")}/probe`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      }
    );
    assert.equal(degradedProbe.status, "degraded");
    assert.equal(degradedProbe.errorCode, "PROBE_AUTH_REQUIRED");
    assert.equal(degradedProbe.httpStatus, 401);

    const blockedPolicy = await requestJson(`${baseUrl}/v1/mcp-network-policies`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        policyRef: "np_local_probe_disabled",
        displayName: "Local Probe Disabled Policy",
        description: "created active, then disabled for blocked probe test",
        status: "active",
        mode: "allowlist",
        allowedProtocols: ["http"],
        allowedHostPatterns: ["127.0.0.1"],
        allowedPorts: [remotePort],
        allowedPathPrefixes: ["/"],
        requireTls: false,
        blockPrivateNetwork: false,
        tags: ["smoke", "probe", "blocked"],
      }),
    });
    assert.equal(blockedPolicy.policyRef, "np_local_probe_disabled");

    const blockedMcp = await requestJson(`${baseUrl}/v1/mcps`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mcpId: "workspace:probe-blocked",
        displayName: "Probe Blocked MCP",
        description: "local endpoint with disabled policy",
        source: "workspace-managed",
        transport: "http",
        ref: `http://127.0.0.1:${remotePort}/health`,
        status: "active",
        riskLevel: "high",
        defaultCredentialId: null,
        defaultNetworkPolicyRef: "np_local_probe_disabled",
        approvalRequired: false,
        tags: ["smoke", "probe", "blocked"],
      }),
    });
    assert.equal(blockedMcp.mcpId, "workspace:probe-blocked");

    await requestJson(
      `${baseUrl}/v1/mcp-network-policies/${encodeURIComponent("np_local_probe_disabled")}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          status: "disabled",
        }),
      }
    );

    const blockedProbe = await requestJson(
      `${baseUrl}/v1/mcps/${encodeURIComponent("workspace:probe-blocked")}/probe`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      }
    );
    assert.equal(blockedProbe.status, "blocked");
    assert.equal(blockedProbe.errorCode, "PROBE_NETWORK_POLICY_DISABLED");

    const unsupportedProbe = await requestJson(
      `${baseUrl}/v1/mcps/${encodeURIComponent("mcp.image.gpt-image-2")}/probe`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      }
    );
    assert.equal(unsupportedProbe.status, "unsupported");
    assert.equal(unsupportedProbe.errorCode, "PROBE_UNSUPPORTED_TRANSPORT");

    const listedSnapshots = await requestJson(
      `${baseUrl}/v1/mcp-health-snapshots?limit=10`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(listedSnapshots.length >= 4, true);

    const blockedSnapshots = await requestJson(
      `${baseUrl}/v1/mcp-health-snapshots?status=blocked&limit=10`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(blockedSnapshots.length >= 1, true);
    assert.equal(blockedSnapshots[0].status, "blocked");
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }

    if (remoteServer) {
      await new Promise((resolve) => {
        remoteServer.close(() => resolve(undefined));
      }).catch(() => undefined);
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
