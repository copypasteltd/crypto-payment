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
  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText} ${text}`
  );
  return text ? JSON.parse(text) : null;
}

function createAggregate(runId, status, runtime = {}) {
  const createdAt = "2026-07-09T03:00:00.000Z";
  const run = {
    runId,
    workspaceId: "wsp_internal_recovery",
    taskVersionId: "tsv_internal_recovery",
    sessionVersionId: "sev_internal_recovery",
    requestedByUserId: null,
    title: `Recovery ${runId}`,
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
    runtime,
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

test("internal runtime recovery endpoints expose startable, active-bridge, and orphaned runs", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-runtime-recovery-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_OBJECT_STORAGE_DRIVER",
    "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
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
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "runtime-recovery-internal-token";

    const [{ startApiServer }, { runsRepository }, { bridgeRegistry }] = await Promise.all([
      import("../dist/index.js"),
      import("../dist/modules/runs/repository.js"),
      import("../dist/modules/bridge/registry.js"),
    ]);

    bridgeRegistry.configure({
      staleAfterMs: 1_000,
      now: () => "2026-07-09T03:05:00.500Z",
    });
    app = await startApiServer();

    await runsRepository.save(createAggregate("run_internal_created", "CREATED"));
    await runsRepository.save(createAggregate("run_internal_running_bridge", "RUNNING"));
    await runsRepository.save(createAggregate("run_internal_running_orphan", "RUNNING"));
    await runsRepository.save(createAggregate("run_internal_running_finished", "RUNNING", {
      launchMode: "docker",
      containerName: "lingban-run-run_internal_running_finished",
      startedAt: "2026-07-09T03:01:00.000Z",
      readyAt: "2026-07-09T03:01:05.000Z",
      finishedAt: "2026-07-09T03:04:00.000Z",
      exitCode: null,
      exitSignal: "SIGTERM",
    }));
    await runsRepository.save(createAggregate("run_internal_running_stale", "RUNNING"));

    bridgeRegistry.register({
      bridgeId: "brg_internal_running_bridge",
      runId: "run_internal_running_bridge",
      workspaceId: "wsp_internal_recovery",
      targetPath: "C:/tmp/run_internal_running_bridge",
      control: {
        baseUrl: "http://127.0.0.1:39998",
        authToken: "control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T03:05:00.000Z",
      lastSeenAt: "2026-07-09T03:05:00.000Z",
    });
    await bridgeRegistry.flushPersistence();

    bridgeRegistry.register({
      bridgeId: "brg_internal_running_stale",
      runId: "run_internal_running_stale",
      workspaceId: "wsp_internal_recovery",
      targetPath: "C:/tmp/run_internal_running_stale",
      control: {
        baseUrl: "http://127.0.0.1:39997",
        authToken: "control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T03:00:00.000Z",
      lastSeenAt: "2026-07-09T03:00:00.000Z",
    });
    await bridgeRegistry.flushPersistence();

    const headers = {
      "x-lingban-internal-token": "runtime-recovery-internal-token",
    };

    const listResponse = await requestJson(`${baseUrl}/internal/runs/recovery`, {
      headers,
    });
    assert.equal(Array.isArray(listResponse.candidates), true);

    const byRunId = new Map(
      listResponse.candidates.map((candidate) => [candidate.snapshot.run.runId, candidate])
    );

    assert.equal(byRunId.get("run_internal_created")?.action, "enqueue-start");
    assert.equal(
      byRunId.get("run_internal_created")?.startJob?.run?.runId,
      "run_internal_created"
    );
    assert.equal(byRunId.get("run_internal_running_bridge")?.action, "await-bridge");
    assert.equal(byRunId.get("run_internal_running_bridge")?.bridge?.registered, true);
    assert.equal(byRunId.get("run_internal_running_orphan")?.action, "mark-orphan-failed");
    assert.equal(byRunId.get("run_internal_running_orphan")?.bridge?.registered, false);
    assert.equal(
      byRunId.get("run_internal_running_finished")?.snapshot?.runtime?.finishedAt,
      "2026-07-09T03:04:00.000Z"
    );
    assert.equal(byRunId.get("run_internal_running_finished")?.action, "enqueue-start");
    assert.equal(
      byRunId.get("run_internal_running_finished")?.startJob?.run?.runId,
      "run_internal_running_finished"
    );
    assert.equal(byRunId.get("run_internal_running_stale")?.action, "mark-orphan-failed");
    assert.equal(byRunId.get("run_internal_running_stale")?.bridge?.registered, false);

    const singleResponse = await requestJson(
      `${baseUrl}/internal/runs/run_internal_running_orphan/recovery`,
      {
        headers,
      }
    );
    assert.equal(singleResponse.snapshot.run.runId, "run_internal_running_orphan");
    assert.equal(singleResponse.action, "mark-orphan-failed");
    assert.equal(singleResponse.reason.includes("no active bridge registration"), true);

    bridgeRegistry.unregister("run_internal_running_bridge");
    bridgeRegistry.unregister("run_internal_running_stale");
    await bridgeRegistry.flushPersistence();
  } finally {
    try {
      const { bridgeRegistry } = await import("../dist/modules/bridge/registry.js");
      bridgeRegistry.configure({
        staleAfterMs: undefined,
        now: undefined,
      });
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
