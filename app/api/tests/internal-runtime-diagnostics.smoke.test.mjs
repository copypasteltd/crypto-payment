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
  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText} ${text}`
  );
  return text ? JSON.parse(text) : null;
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

function createAggregate(runId, status) {
  const createdAt = "2026-07-09T06:00:00.000Z";
  const run = {
    runId,
    workspaceId: "wsp_internal_diag",
    taskVersionId: "tsv_internal_diag",
    sessionVersionId: "sev_internal_diag",
    requestedByUserId: null,
    title: `Diagnostics ${runId}`,
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

test("internal runtime diagnostics expose bridge registry, orchestrator, and recovery summary", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-runtime-diagnostics-"));
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
  let workerOpsServer = null;
  let bridgeControlServer = null;

  try {
    const port = await allocatePort();
    const workerOpsPort = await allocatePort();
    const bridgeControlPort = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const workerOpsBaseUrl = `http://127.0.0.1:${workerOpsPort}`;
    const bridgeControlBaseUrl = `http://127.0.0.1:${bridgeControlPort}`;

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "runtime-diagnostics-internal-token";
    process.env.LINGBAN_BRIDGE_REGISTRATION_STALE_AFTER_MS = "60000";
    process.env.LINGBAN_BRIDGE_REGISTRATION_SWEEP_INTERVAL_MS = "50";
    process.env.LINGBAN_WORKER_OPS_BASE_URL = workerOpsBaseUrl;
    process.env.LINGBAN_WORKER_OPS_TOKEN = "runtime-diagnostics-worker-token";
    process.env.LINGBAN_WORKER_OPS_PROBE_TIMEOUT_MS = "1000";
    process.env.LINGBAN_BRIDGE_CONTROL_PROBE_TIMEOUT_MS = "1000";
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_RUNTIME_MAX_CONCURRENT_RUNS = "2";

    workerOpsServer = await startJsonServer(workerOpsPort, async (request) => {
      assert.equal(request.url, "/diagnostics");
      assert.equal(
        request.headers["x-lingban-worker-ops-token"],
        "runtime-diagnostics-worker-token"
      );

      return {
        body: {
          readiness: {
            status: "ready",
            checkedAt: "2026-07-09T06:00:00.200Z",
            started: true,
            stopping: false,
            activeRunsCount: 1,
            components: [
              {
                component: "startQueue",
                ready: true,
                detail: null,
              },
            ],
          },
          diagnostics: {
            started: true,
            activeRunsCount: 1,
            components: {
              startQueue: true,
              cleanupQueue: true,
              startWorker: true,
              cleanupWorker: true,
              startQueueEvents: true,
              cleanupQueueEvents: true,
            },
            queueEvents: {
              start: {
                queue: "start",
                counts: {
                  added: 1,
                  active: 1,
                  completed: 1,
                  failed: 0,
                  stalled: 0,
                  delayed: 0,
                  waiting: 0,
                  drained: 0,
                  error: 0,
                },
                lastEventName: "completed",
                lastEventAt: "2026-07-09T06:00:00.100Z",
              },
              cleanup: {
                queue: "cleanup",
                counts: {
                  added: 0,
                  active: 0,
                  completed: 0,
                  failed: 0,
                  stalled: 0,
                  delayed: 0,
                  waiting: 0,
                  drained: 0,
                  error: 0,
                },
                lastEventName: null,
                lastEventAt: null,
              },
            },
            lastRecoveryErrorMessage: null,
            lastErrorMessage: null,
          },
          ops: {
            started: true,
          },
        },
      };
    });

    bridgeControlServer = await startJsonServer(bridgeControlPort, async (request) => {
      assert.equal(request.url, "/diagnostics");
      assert.equal(request.headers["x-lingban-control-token"], "diag-control-token");

      return {
        body: {
          bridgeId: "brg_diag_running",
          runId: "run_diag_running",
          workspaceId: "wsp_internal_diag",
          targetPath: "C:/tmp/run_diag_running",
          runtimeDir: "C:/tmp/run_diag_running/runtime",
          outputsPath: "C:/tmp/run_diag_running/outputs",
          startedAt: "2026-07-09T06:00:00.000Z",
          shuttingDown: false,
          shutdownAt: null,
          shutdownExitCode: null,
          registrationRefreshMs: 5000,
          controlUrl: `${bridgeControlBaseUrl}/control`,
          controlAuthRequired: true,
          externalControlUrl: null,
          apiBaseUrl: baseUrl,
          apiConnectorEnabled: true,
          internalAuthConfigured: true,
          credentialMountsCount: 0,
          mcpBindingsCount: 0,
          pendingEventQueueCount: 0,
          lastRegistrationAt: "2026-07-09T06:00:00.050Z",
          lastRegistrationFailureAt: null,
          lastRegistrationFailureMessage: null,
          lastObservedEventAt: "2026-07-09T06:00:00.100Z",
          lastObservedEventType: "heartbeat",
          lastForwardedEventAt: "2026-07-09T06:00:00.100Z",
          lastForwardedEventType: "heartbeat",
          lastForwardedEventFailureAt: null,
          lastForwardedEventFailureMessage: null,
          metrics: {
            registrationAttemptsTotal: 1,
            registrationSuccessTotal: 1,
            registrationRefreshSuccessTotal: 0,
            registrationFailuresTotal: 0,
            observedEventsTotal: 2,
            forwardedEventsTotal: 2,
            forwardedEventFailuresTotal: 0,
            terminalFailureReportsTotal: 0,
            observedEventCounts: {
              heartbeat: 1,
            },
            forwardedEventCounts: {
              heartbeat: 1,
            },
          },
          controlServer: {
            commandsTotal: 2,
            commandCounts: {
              sendMessage: 1,
              approve: 0,
              cancel: 0,
              ping: 1,
              syncFiles: 0,
              flushArtifacts: 0,
            },
            commandFailureCounts: {
              sendMessage: 0,
              approve: 0,
              cancel: 0,
              ping: 0,
              syncFiles: 0,
              flushArtifacts: 0,
            },
            invalidCommandsTotal: 0,
            failuresTotal: 0,
            lastCommandType: "ping",
            lastCommandAt: "2026-07-09T06:00:00.120Z",
            lastFailureAt: null,
            lastFailureMessage: null,
            session: {
              running: true,
              status: "running",
            },
            fileWatcher: {
              running: true,
              syncCount: 3,
            },
            artifactPublisher: {
              flushCount: 2,
              publishedArtifactsTotal: 4,
            },
          },
          controlHttp: {
            started: true,
            requestsTotal: 5,
          },
        },
      };
    });

    const [{ startApiServer }, { runsRepository }, { bridgeRegistry }] = await Promise.all([
      import("../dist/index.js"),
      import("../dist/modules/runs/repository.js"),
      import("../dist/modules/bridge/registry.js"),
    ]);

    bridgeRegistry.configure({
      staleAfterMs: 60_000,
      sweepIntervalMs: 50,
      now: () => "2026-07-09T06:00:00.500Z",
    });
    app = await startApiServer();

    await runsRepository.save(createAggregate("run_diag_created", "CREATED"));
    await runsRepository.save(createAggregate("run_diag_running", "RUNNING"));

    bridgeRegistry.register({
      bridgeId: "brg_diag_running",
      runId: "run_diag_running",
      workspaceId: "wsp_internal_diag",
      targetPath: "C:/tmp/run_diag_running",
      control: {
        baseUrl: bridgeControlBaseUrl,
        authToken: "diag-control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T06:00:00.000Z",
      lastSeenAt: "2026-07-09T06:00:00.000Z",
    });
    await bridgeRegistry.flushPersistence();

    const queued = await bridgeRegistry.dispatch("run_diag_pending", {
      type: "ping",
    });
    assert.deepEqual(queued, {
      ok: true,
      queued: true,
      command: "ping",
    });

    const headers = {
      "x-lingban-internal-token": "runtime-diagnostics-internal-token",
    };

    const diagnostics = await requestJson(`${baseUrl}/internal/runtime/diagnostics`, {
      headers,
    });

    assert.equal(diagnostics.bridgeRegistry.initialized, true);
    assert.equal(diagnostics.bridgeRegistry.repositoryKind, "file");
    assert.equal(diagnostics.bridgeRegistry.sweeperActive, true);
    assert.equal(diagnostics.bridgeRegistry.registeredConnectionsCount, 1);
    assert.equal(diagnostics.bridgeRegistry.controllerAttachedCount, 1);
    assert.equal(diagnostics.bridgeRegistry.pendingRunsCount, 1);
    assert.equal(diagnostics.bridgeRegistry.pendingCommandsCount, 1);
    assert.equal(diagnostics.bridgeRegistry.staleCandidatesCount, 0);
    assert.equal(diagnostics.bridgeRegistry.metrics.registrationsTotal >= 1, true);
    assert.equal(diagnostics.bridgeRegistry.metrics.queuedCommandsTotal >= 1, true);
    assert.equal(diagnostics.bridgeRegistry.metrics.forwardedCommandsTotal >= 0, true);
    assert.equal(diagnostics.bridgeRegistry.connections[0].runId, "run_diag_running");
    assert.equal(diagnostics.bridgeRegistry.connections[0].controllerAttached, true);

    assert.equal(diagnostics.runtimeOrchestrator.dispatchMode, "embedded");
    assert.equal(diagnostics.runtimeOrchestrator.maxConcurrentRuns, 2);
    assert.equal(diagnostics.runtimeOrchestrator.activeRunsCount, 0);
    assert.equal(diagnostics.runtimeOrchestrator.launchingRunsCount, 0);
    assert.equal(diagnostics.runtimeOrchestrator.scheduledRunsCount, 0);
    assert.equal(diagnostics.runtimeOrchestrator.queueDepth, 0);
    assert.equal(diagnostics.runtimeOrchestrator.runStartQueueEnabled, false);
    assert.equal(diagnostics.runtimeOrchestrator.runCleanupQueueEnabled, false);

    assert.equal(diagnostics.recovery.candidatesCount, 2);
    assert.equal(diagnostics.recovery.actionCounts["enqueue-start"], 1);
    assert.equal(diagnostics.recovery.actionCounts["await-bridge"], 1);
    assert.equal(diagnostics.recovery.actionCounts["mark-orphan-failed"], 0);
    assert.equal(diagnostics.workerOps.configured, true);
    assert.equal(diagnostics.workerOps.status, "ready");
    assert.equal(diagnostics.workerOps.baseUrl, workerOpsBaseUrl);
    assert.equal(diagnostics.workerOps.summary.activeRunsCount, 1);
    assert.deepEqual(diagnostics.workerOps.summary.components, {
      startQueue: true,
      cleanupQueue: true,
      startWorker: true,
      cleanupWorker: true,
      startQueueEvents: true,
      cleanupQueueEvents: true,
    });
    assert.equal(diagnostics.bridgeControlProbes.configuredCount, 1);
    assert.equal(diagnostics.bridgeControlProbes.probedCount, 1);
    assert.equal(diagnostics.bridgeControlProbes.readyCount, 1);
    assert.equal(diagnostics.bridgeControlProbes.unreachableCount, 0);
    assert.equal(diagnostics.bridgeControlProbes.items[0].runId, "run_diag_running");
    assert.equal(diagnostics.bridgeControlProbes.items[0].status, "ready");
    assert.equal(diagnostics.bridgeControlProbes.items[0].summary.sessionStatus, "running");
    assert.equal(diagnostics.bridgeControlProbes.items[0].summary.fileSyncCount, 3);

    bridgeRegistry.unregister("run_diag_running");
    bridgeRegistry.unregister("run_diag_pending");
    await bridgeRegistry.flushPersistence();
  } finally {
    try {
      const { bridgeRegistry } = await import("../dist/modules/bridge/registry.js");
      bridgeRegistry.configure({
        staleAfterMs: undefined,
        sweepIntervalMs: undefined,
        now: undefined,
      });
    } catch {
      // ignore test cleanup failures
    }

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

    if (bridgeControlServer) {
      await new Promise((resolve, reject) => {
        bridgeControlServer.close((error) => {
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
