import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function importOpsModules() {
  const opsUrl = pathToFileURL(path.resolve("dist/ops-http.js")).href;
  const observabilityUrl = pathToFileURL(path.resolve("dist/observability.js")).href;
  const [{ WorkerOpsHttpServer }, observability] = await Promise.all([
    import(opsUrl),
    import(observabilityUrl),
  ]);

  return {
    WorkerOpsHttpServer,
    ...observability,
  };
}

function createDiagnostics(overrides = {}) {
  return {
    started: true,
    startedAt: "2026-07-09T11:00:00.000Z",
    stopping: false,
    stoppedAt: null,
    dispatchMode: "bullmq",
    launchMode: "docker",
    maxConcurrentRuns: 2,
    redisConfigured: true,
    redisEndpoint: "redis://127.0.0.1:6379/0",
    runsRoot: "/tmp/lingban/runs",
    queuePrefix: "lingban",
    queueNames: {
      start: "run.start",
      cleanup: "run.cleanup",
      startDlq: "run.start.dlq",
      cleanupDlq: "run.cleanup.dlq",
    },
    ops: {
      host: "127.0.0.1",
      port: 3901,
      authRequired: true,
      probeTimeoutMs: 1000,
    },
    runtimeBackend: {
      backend: "docker",
      ready: true,
      checkedAt: "2026-07-09T11:01:50.000Z",
      detail: "server=27.1.1, api=1.47, os=linux, experimental=false",
      serverVersion: "27.1.1",
      apiVersion: "1.47",
      os: "linux",
      experimental: false,
    },
    components: {
      startQueue: true,
      cleanupQueue: true,
      startWorker: true,
      cleanupWorker: true,
      startDlqQueue: true,
      cleanupDlqQueue: true,
      startQueueEvents: true,
      cleanupQueueEvents: true,
    },
    queueEvents: {
      start: {
        queue: "start",
        counts: {
          added: 2,
          active: 1,
          completed: 1,
          failed: 0,
          stalled: 1,
          delayed: 0,
          waiting: 1,
          drained: 0,
          error: 0,
        },
        lastEventName: "stalled",
        lastEventAt: "2026-07-09T11:01:30.000Z",
        lastEventId: "evt_start_2",
        lastJobId: "run_00000123",
        lastPrev: null,
        lastDelayMs: null,
        lastFailedReason: null,
        lastErrorMessage: null,
      },
      cleanup: {
        queue: "cleanup",
        counts: {
          added: 1,
          active: 1,
          completed: 1,
          failed: 0,
          stalled: 0,
          delayed: 1,
          waiting: 0,
          drained: 1,
          error: 0,
        },
        lastEventName: "drained",
        lastEventAt: "2026-07-09T11:01:40.000Z",
        lastEventId: "evt_cleanup_1",
        lastJobId: null,
        lastPrev: null,
        lastDelayMs: null,
        lastFailedReason: null,
        lastErrorMessage: null,
      },
    },
    activeRunsCount: 1,
    activeRunIds: ["run_00000123"],
    activeRuns: [
      {
        runId: "run_00000123",
        launchMode: "docker",
        controlUrl: "http://127.0.0.1:3902",
        egressProxy: {
          started: true,
          startedAt: "2026-07-09T11:00:30.000Z",
          host: "0.0.0.0",
          port: 3903,
          requestsTotal: 4,
          connectRequestsTotal: 1,
          blockedTotal: 1,
          authFailuresTotal: 0,
          failuresTotal: 0,
          baselineUrlCount: 2,
          activeMcpPolicyCount: 1,
          lastRequestAt: "2026-07-09T11:01:20.000Z",
          lastFailureAt: null,
          lastFailureMessage: null,
        },
      },
    ],
    lastRecoveryStartedAt: "2026-07-09T11:00:01.000Z",
    lastRecoveryFinishedAt: "2026-07-09T11:00:02.000Z",
    lastRecoveryErrorAt: null,
    lastRecoveryErrorMessage: null,
    lastRecoverySummary: {
      candidates: 2,
      enqueuedStarts: 1,
      orphanFailures: 0,
      scheduledCleanups: 1,
      skipped: 1,
    },
    lastStartJobRunId: "run_00000123",
    lastStartJobStartedAt: "2026-07-09T11:01:00.000Z",
    lastStartJobFinishedAt: "2026-07-09T11:01:05.000Z",
    lastStartJobFailureAt: null,
    lastStartJobFailureMessage: null,
    lastCleanupJobRunId: null,
    lastCleanupJobStartedAt: null,
    lastCleanupJobFinishedAt: null,
    lastCleanupJobFailureAt: null,
    lastCleanupJobFailureMessage: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    metrics: {
      startJobsProcessedTotal: 3,
      startJobsSucceededTotal: 2,
      startJobsFailedTotal: 1,
      cleanupJobsProcessedTotal: 1,
      cleanupJobsSucceededTotal: 1,
      cleanupJobsFailedTotal: 0,
      startDlqWritesTotal: 1,
      cleanupDlqWritesTotal: 0,
      recoveryRunsTotal: 1,
      recoveryFailuresTotal: 0,
      recoveryCandidatesTotal: 2,
      recoveryEnqueuedStartsTotal: 1,
      recoveryOrphanFailuresTotal: 0,
      recoveryScheduledCleanupsTotal: 1,
      recoverySkippedTotal: 1,
      runtimeHandlesStartedTotal: 2,
      runtimeHandlesStoppedTotal: 1,
      workspaceCleanupScheduledTotal: 2,
      workspaceCleanupEnqueueFailuresTotal: 0,
    },
    ...overrides,
  };
}

function createReadiness(status = "ready") {
  return {
    status,
    checkedAt: "2026-07-09T11:02:00.000Z",
    started: true,
    stopping: false,
    activeRunsCount: 1,
    components: [
      { component: "runtimeBackend", ready: status === "ready", detail: status === "ready" ? "docker ready" : "docker unavailable" },
      { component: "startQueue", ready: status === "ready", detail: status === "ready" ? "ready" : "probe failed" },
      { component: "cleanupQueue", ready: status === "ready", detail: status === "ready" ? "ready" : "probe failed" },
    ],
  };
}

test("WorkerOpsHttpServer exposes health, readiness, diagnostics, and metrics", async () => {
  const { WorkerOpsHttpServer, buildRunWorkerMetricsText } = await importOpsModules();
  let currentReadiness = createReadiness("not_ready");
  const diagnostics = createDiagnostics();

  const server = new WorkerOpsHttpServer({
    host: "127.0.0.1",
    port: 0,
    authToken: "ops-secret",
    now: () => "2026-07-09T11:05:00.000Z",
    getReadiness: () => currentReadiness,
    getDiagnostics: () => diagnostics,
    getMetricsText: () => buildRunWorkerMetricsText(diagnostics, currentReadiness),
  });

  await server.start();

  try {
    assert.doesNotMatch(server.url, /:0$/);

    const health = await fetch(`${server.url}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("content-type"), "application/json; charset=utf-8");

    const readyzFail = await fetch(`${server.url}/readyz`);
    assert.equal(readyzFail.status, 503);
    assert.equal((await readyzFail.json()).status, "not_ready");

    currentReadiness = createReadiness("ready");
    const readyzOk = await fetch(`${server.url}/readyz`);
    assert.equal(readyzOk.status, 200);
    assert.equal((await readyzOk.json()).status, "ready");

    const unauthorizedDiagnostics = await fetch(`${server.url}/diagnostics`);
    assert.equal(unauthorizedDiagnostics.status, 401);

    const diagnosticsResponse = await fetch(`${server.url}/diagnostics`, {
      headers: {
        "x-lingban-worker-ops-token": "ops-secret",
      },
    });
    assert.equal(diagnosticsResponse.status, 200);
    const diagnosticsPayload = await diagnosticsResponse.json();
    assert.equal(diagnosticsPayload.diagnostics.dispatchMode, "bullmq");
    assert.equal(diagnosticsPayload.diagnostics.runtimeBackend.backend, "docker");
    assert.equal(diagnosticsPayload.diagnostics.runtimeBackend.ready, true);
    assert.equal(diagnosticsPayload.diagnostics.activeRuns[0].egressProxy.host, "0.0.0.0");
    assert.equal(diagnosticsPayload.readiness.status, "ready");
    assert.equal(diagnosticsPayload.ops.authRequired, true);

    const metricsResponse = await fetch(`${server.url}/metrics`, {
      headers: {
        "x-lingban-worker-ops-token": "ops-secret",
      },
    });
    assert.equal(metricsResponse.status, 200);
    assert.equal(
      metricsResponse.headers.get("content-type"),
      "text/plain; version=0.0.4; charset=utf-8"
    );
    const metricsText = await metricsResponse.text();
    assert.match(metricsText, /lingban_run_worker_ready 1/);
    assert.match(metricsText, /lingban_run_worker_active_runtime_egress_proxies 1/);
    assert.match(
      metricsText,
      /lingban_run_worker_runtime_backend_ready\{backend="docker"\} 1/
    );
    assert.match(
      metricsText,
      /lingban_run_worker_readiness_component_ready\{component="runtimeBackend"\} 1/
    );
    assert.match(metricsText, /lingban_run_worker_start_jobs_processed_total 3/);
    assert.match(
      metricsText,
      /lingban_run_worker_recovery_action_total\{action="schedule-cleanup"\} 1/
    );

    const opsDiagnostics = server.getDiagnostics();
    assert.equal(opsDiagnostics.authRequired, true);
    assert.ok(opsDiagnostics.requestsTotal >= 5);
    assert.ok(opsDiagnostics.routes.some((route) => route.route === "readyz"));
    assert.ok(opsDiagnostics.routes.some((route) => route.route === "diagnostics"));
  } finally {
    await server.stop();
  }
});

test("WorkerOpsHttpServer forwards stop and immediate cleanup semantics", async () => {
  const { WorkerOpsHttpServer } = await importOpsModules();
  const calls = [];
  const server = new WorkerOpsHttpServer({
    host: "127.0.0.1",
    port: 0,
    authToken: "ops-secret",
    getReadiness: () => createReadiness("ready"),
    getDiagnostics: () => createDiagnostics(),
    getMetricsText: () => "",
    stopRun: async (runId, options) => {
      calls.push({ runId, force: options?.force ?? false });
      return { stopped: true, force: options?.force ?? false };
    },
    cleanupRun: async (runId) => {
      calls.push({ runId, cleanup: true });
      return { cleaned: true };
    },
  });
  await server.start();
  try {
    for (const force of [false, true]) {
      const response = await fetch(`${server.url}/runs/stop`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-lingban-worker-ops-token": "ops-secret",
        },
        body: JSON.stringify({ runId: force ? "run_force" : "run_graceful", force }),
      });
      assert.equal(response.status, 202);
      assert.equal((await response.json()).result.force, force);
    }
    assert.deepEqual(calls, [
      { runId: "run_graceful", force: false },
      { runId: "run_force", force: true },
    ]);

    const cleanupResponse = await fetch(`${server.url}/runs/cleanup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lingban-worker-ops-token": "ops-secret",
      },
      body: JSON.stringify({ runId: "run_cleanup" }),
    });
    assert.equal(cleanupResponse.status, 200);
    assert.equal((await cleanupResponse.json()).result.cleaned, true);
    assert.deepEqual(calls.at(-1), { runId: "run_cleanup", cleanup: true });
  } finally {
    await server.stop();
  }
});
