import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
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

function createAggregate(runId, status) {
  const createdAt = "2026-07-09T07:00:00.000Z";
  const run = {
    runId,
    workspaceId: "wsp_readiness_metrics",
    taskVersionId: "tsv_readiness_metrics",
    sessionVersionId: "sev_readiness_metrics",
    requestedByUserId: null,
    title: `Readiness ${runId}`,
    targetPath: `C:/tmp/${runId}`,
    entrySurface: "dashboard",
    catalogMetadata: null,
    status,
    statusReason: null,
    createdAt,
    updatedAt: createdAt,
  };

  const input = {
    workspaceId: run.workspaceId,
    taskVersionId: run.taskVersionId,
    sessionVersionId: run.sessionVersionId,
    title: run.title,
    targetPath: run.targetPath,
    entrySurface: run.entrySurface,
    initialMessage: null,
    bindings: {
      firstPartyMcpIds: [],
      externalConnectorRefs: [],
      credentialIds: [],
    },
    catalogMetadata: null,
  };

  return {
    run,
    runtime: {},
    messages: [],
    files: [],
    artifacts: [],
    approvals: [],
    input,
    startJob: {
      run,
      initialPrompt: `Start ${runId}`,
      requestedInitialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      credentialMounts: [],
      mcpBindings: [],
    },
  };
}

test("readyz and internal metrics expose readiness state and runtime gauges", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-readiness-metrics-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_OBJECT_STORAGE_DRIVER",
    "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_BRIDGE_REGISTRATION_STALE_AFTER_MS",
    "LINGBAN_BRIDGE_REGISTRATION_SWEEP_INTERVAL_MS",
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

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "readiness-metrics-internal-token";
    process.env.LINGBAN_BRIDGE_REGISTRATION_STALE_AFTER_MS = "60000";
    process.env.LINGBAN_BRIDGE_REGISTRATION_SWEEP_INTERVAL_MS = "50";
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_RUNTIME_MAX_CONCURRENT_RUNS = "2";

    const [{ startApiServer }, { runsRepository }, { bridgeRegistry }] = await Promise.all([
      import("../dist/index.js"),
      import("../dist/modules/runs/repository.js"),
      import("../dist/modules/bridge/registry.js"),
    ]);

    bridgeRegistry.configure({
      staleAfterMs: 60_000,
      sweepIntervalMs: 50,
      now: () => "2026-07-09T07:00:00.500Z",
    });
    app = await startApiServer();

    await runsRepository.save(createAggregate("run_readiness_created", "CREATED"));
    await runsRepository.save(createAggregate("run_readiness_running", "RUNNING"));

    bridgeRegistry.register({
      bridgeId: "brg_readiness_running",
      runId: "run_readiness_running",
      workspaceId: "wsp_readiness_metrics",
      targetPath: "C:/tmp/run_readiness_running",
      control: {
        baseUrl: "http://127.0.0.1:39993",
        authToken: "readiness-control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T07:00:00.000Z",
      lastSeenAt: "2026-07-09T07:00:00.000Z",
    });
    await bridgeRegistry.flushPersistence();

    const queued = await bridgeRegistry.dispatch("run_readiness_pending", {
      type: "ping",
    });
    assert.deepEqual(queued, {
      ok: true,
      queued: true,
      command: "ping",
    });

    const readiness = await requestJson(`${baseUrl}/readyz`);
    assert.equal(readiness.status, 200);
    assert.equal(readiness.body.status, "ready");
    assert.equal(readiness.body.dependencies.database.status, "disabled");
    assert.equal(readiness.body.dependencies.objectStorage.status, "ready");
    assert.equal(readiness.body.dependencies.fileSecurity.status, "ready");
    assert.equal(readiness.body.dependencies.bridgeRegistry.status, "ready");
    assert.equal(readiness.body.dependencies.runtimeOrchestrator.status, "ready");
    assert.equal(readiness.body.dependencies.workerOps.status, "disabled");

    const metrics = await requestText(`${baseUrl}/internal/metrics`, {
      headers: {
        "x-lingban-internal-token": "readiness-metrics-internal-token",
      },
    });
    assert.equal(metrics.status, 200);
    assert.equal(
      metrics.headers.get("content-type")?.startsWith("text/plain"),
      true
    );
    assert.equal(metrics.body.includes("lingban_api_ready 1"), true);
    assert.equal(
      metrics.body.includes('lingban_api_dependency_enabled{dependency="database"} 0'),
      true
    );
    assert.equal(
      metrics.body.includes('lingban_api_dependency_enabled{dependency="fileSecurity"} 1'),
      true
    );
    assert.equal(
      metrics.body.includes('lingban_api_dependency_ready{dependency="fileSecurity"} 1'),
      true
    );
    assert.equal(
      metrics.body.includes('lingban_api_dependency_ready{dependency="bridgeRegistry"} 1'),
      true
    );
    assert.equal(metrics.body.includes("lingban_run_file_lifecycle_sweeper_active 1"), true);
    assert.equal(
      metrics.body.includes("lingban_run_file_lifecycle_hot_retention_seconds 86400"),
      true
    );
    assert.equal(
      metrics.body.includes('lingban_api_dependency_enabled{dependency="workerOps"} 0'),
      true
    );
    assert.equal(metrics.body.includes("lingban_bridge_registry_registered_connections 1"), true);
    assert.equal(
      metrics.body.includes('lingban_runtime_recovery_action_count{action="enqueue-start"} 1'),
      true
    );
    assert.equal(
      metrics.body.includes('lingban_runtime_recovery_action_count{action="await-bridge"} 1'),
      true
    );

    await bridgeRegistry.stopSweeper();
    const degraded = await requestJson(`${baseUrl}/readyz`);
    assert.equal(degraded.status, 503);
    assert.equal(degraded.body.status, "not_ready");
    assert.equal(degraded.body.dependencies.bridgeRegistry.status, "not_ready");

    const degradedMetrics = await requestText(`${baseUrl}/internal/metrics`, {
      headers: {
        "x-lingban-internal-token": "readiness-metrics-internal-token",
      },
    });
    assert.equal(degradedMetrics.status, 200);
    assert.equal(degradedMetrics.body.includes("lingban_api_ready 0"), true);
    assert.equal(
      degradedMetrics.body.includes('lingban_api_dependency_ready{dependency="bridgeRegistry"} 0'),
      true
    );
    assert.equal(
      degradedMetrics.body.includes("lingban_run_file_lifecycle_sweeper_active 1"),
      true
    );
    assert.equal(degradedMetrics.body.includes('lingban_file_security_mode{mode="builtin"} 1'), true);
    assert.equal(degradedMetrics.body.includes("lingban_file_security_ready 1"), true);
    assert.equal(degradedMetrics.body.includes("lingban_worker_ops_configured 0"), true);

    bridgeRegistry.unregister("run_readiness_running");
    bridgeRegistry.unregister("run_readiness_pending");
    await bridgeRegistry.flushPersistence();
  } finally {
    try {
      const { bridgeRegistry } = await import("../dist/modules/bridge/registry.js");
      bridgeRegistry.configure({
        staleAfterMs: undefined,
        sweepIntervalMs: undefined,
        now: undefined,
      });
      bridgeRegistry.startSweeper();
    } catch {
      // ignore test cleanup failures
    }

    if (app) {
      await app.close();
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
