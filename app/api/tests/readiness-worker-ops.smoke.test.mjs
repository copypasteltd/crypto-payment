import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

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
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null,
  };
}

async function requestText(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text,
  };
}

async function waitForJson(url, predicate, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const intervalMs = options.intervalMs ?? 200;
  const startedAt = Date.now();
  let lastResponse = null;

  while (Date.now() - startedAt < timeoutMs) {
    const response = await requestJson(url, options.init);
    lastResponse = response;
    if (predicate(response)) {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out waiting for JSON predicate: ${JSON.stringify(lastResponse)}`
  );
}

async function startJsonServer(port, handler) {
  const server = http.createServer(async (request, response) => {
    try {
      const result = await handler(request);
      response.writeHead(result.statusCode ?? 200, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify(result.body ?? null));
    } catch (error) {
      response.writeHead(500, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
    server.once("error", reject);
  });

  return server;
}

test("readyz degrades when configured worker ops endpoint becomes unreachable", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-readiness-worker-ops-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_OBJECT_STORAGE_DRIVER",
    "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_WORKER_OPS_BASE_URL",
    "LINGBAN_WORKER_OPS_TOKEN",
    "LINGBAN_WORKER_OPS_PROBE_TIMEOUT_MS",
    "LINGBAN_BRIDGE_CONTROL_PROBE_TIMEOUT_MS",
    "LINGBAN_RUNTIME_DISPATCH_MODE",
    "LINGBAN_RUNTIME_MAX_CONCURRENT_RUNS",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;
  let workerOpsServer = null;

  try {
    const port = await allocatePort();
    const workerOpsPort = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const workerOpsBaseUrl = `http://127.0.0.1:${workerOpsPort}`;

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "readiness-worker-ops-token";
    process.env.LINGBAN_WORKER_OPS_BASE_URL = workerOpsBaseUrl;
    process.env.LINGBAN_WORKER_OPS_TOKEN = "readiness-worker-ops-shared-token";
    process.env.LINGBAN_WORKER_OPS_PROBE_TIMEOUT_MS = "1000";
    process.env.LINGBAN_BRIDGE_CONTROL_PROBE_TIMEOUT_MS = "1000";
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_RUNTIME_MAX_CONCURRENT_RUNS = "2";

    workerOpsServer = await startJsonServer(workerOpsPort, async (request) => {
      assert.equal(request.url, "/diagnostics");
      assert.equal(
        request.headers["x-lingban-worker-ops-token"],
        "readiness-worker-ops-shared-token"
      );

      return {
        body: {
          readiness: {
            status: "ready",
            checkedAt: "2026-07-09T07:10:00.000Z",
            started: true,
            stopping: false,
            activeRunsCount: 0,
            components: [],
          },
          diagnostics: {
            started: true,
            activeRunsCount: 0,
            components: {
              startQueue: true,
              cleanupQueue: true,
              startWorker: true,
              cleanupWorker: true,
              startQueueEvents: true,
              cleanupQueueEvents: true,
            },
          },
        },
      };
    });

    const [{ startApiServer }, { resetApiRuntimeConfigForTests }] = await Promise.all([
      import("../dist/index.js"),
      import("../dist/app/runtime.js"),
    ]);

    resetApiRuntimeConfigForTests();
    app = await startApiServer();

    const ready = await waitForJson(`${baseUrl}/readyz`, (response) => {
      return (
        response.status === 200 &&
        response.body?.status === "ready" &&
        response.body?.dependencies?.workerOps?.status === "ready"
      );
    });
    assert.equal(ready.status, 200);
    assert.equal(ready.body.dependencies.workerOps.status, "ready");

    await new Promise((resolve, reject) => {
      workerOpsServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    workerOpsServer = null;

    const degraded = await requestJson(`${baseUrl}/readyz`);
    assert.equal(degraded.status, 503);
    assert.equal(degraded.body.status, "not_ready");
    assert.equal(degraded.body.dependencies.workerOps.status, "not_ready");
    assert.equal(typeof degraded.body.dependencies.workerOps.detail, "string");

    const metrics = await requestText(`${baseUrl}/internal/metrics`, {
      headers: {
        "x-lingban-internal-token": "readiness-worker-ops-token",
      },
    });
    assert.equal(metrics.status, 200);
    assert.equal(metrics.body.includes("lingban_worker_ops_configured 1"), true);
    assert.equal(metrics.body.includes("lingban_worker_ops_ready 0"), true);
  } finally {
    if (app) {
      await app.close();
    }

    if (workerOpsServer) {
      await new Promise((resolve, reject) => {
        workerOpsServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
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
