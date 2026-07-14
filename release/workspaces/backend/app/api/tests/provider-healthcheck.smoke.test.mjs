import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
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

test("provider healthcheck smoke: platform admin can verify reachable auth-gated provider", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-provider-healthcheck-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_PLATFORM_ADMIN_EMAILS",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;
  let upstreamServer = null;

  try {
    const apiPort = await allocatePort();
    const upstreamPort = await allocatePort();
    const baseUrl = `http://127.0.0.1:${apiPort}`;
    const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}/v1`;

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(apiPort);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_AUTH_MODE = "required";
    process.env.LINGBAN_PLATFORM_ADMIN_EMAILS = "health-admin@example.com";

    upstreamServer = http.createServer((request, response) => {
      if (request.url === "/v1/models") {
        response.writeHead(401, {
          "content-type": "application/json",
        });
        response.end(JSON.stringify({
          error: {
            message: "API key required",
          },
        }));
        return;
      }

      response.writeHead(404, {
        "content-type": "application/json",
      });
      response.end(JSON.stringify({
        error: {
          message: "not found",
        },
      }));
    });
    await new Promise((resolve, reject) => {
      upstreamServer.listen(upstreamPort, "127.0.0.1", (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(undefined);
      });
    });

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "health-admin@example.com",
        password: "HealthAdminPassword123!",
        displayName: "Health Admin",
        workspaceName: "Health Admin Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const provider = await requestJson(`${baseUrl}/v1/providers`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        displayName: "Healthcheck Provider",
        baseUrl: upstreamBaseUrl,
        defaultModel: "gpt-4.1-mini",
        healthcheckPath: "/models",
      }),
    });

    const health = await requestJson(`${baseUrl}/v1/providers/${provider.providerId}/healthcheck`, {
      method: "POST",
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    const providers = await requestJson(`${baseUrl}/v1/providers`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    const refreshedProvider = providers.find((item) => item.providerId === provider.providerId);

    assert.equal(health.providerId, provider.providerId);
    assert.equal(health.healthcheck.status, "auth_required");
    assert.equal(health.healthcheck.reachable, true);
    assert.equal(health.healthcheck.httpStatus, 401);
    assert.equal(health.healthcheck.healthcheckUrl, `${upstreamBaseUrl}/models`);
    assert.equal(typeof health.healthcheck.responseTimeMs, "number");
    assert.equal(refreshedProvider.lastHealthcheck.status, "auth_required");
    assert.equal(refreshedProvider.lastHealthcheck.httpStatus, 401);
  } finally {
    if (app) {
      await app.close();
    }

    if (upstreamServer) {
      await new Promise((resolve) => upstreamServer.close(() => resolve(undefined)));
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
