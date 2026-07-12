import test from "node:test";
import assert from "node:assert/strict";

async function importRuntimeOrchestrator() {
  return import(new URL("../dist/modules/runs/runtime-orchestrator.js", import.meta.url));
}

async function importBridgeRegistry() {
  return import(new URL("../dist/modules/bridge/registry.js", import.meta.url));
}

function createSnapshots(statusByRunId) {
  const snapshots = new Map();
  for (const [runId, status] of Object.entries(statusByRunId)) {
    snapshots.set(runId, {
      run: {
        runId,
        status,
      },
    });
  }
  return snapshots;
}

function createHooks(snapshots, ingestedEvents, runtimeUpdates = []) {
  return {
    getRunSnapshot(runId) {
      const snapshot = snapshots.get(runId);
      if (!snapshot) {
        throw new Error(`missing snapshot for ${runId}`);
      }
      return snapshot;
    },
    getStartRunJobPayload(runId) {
      return {
        run: {
          runId,
          workspaceId: "wsp_test_runtime",
          taskVersionId: "tsv_test_runtime",
          sessionVersionId: "sev_test_runtime",
          title: `Recovered ${runId}`,
          targetPath: `/workspace/${runId}`,
          entrySurface: "dashboard",
          status: snapshots.get(runId)?.run.status ?? "CREATED",
          statusReason: null,
          createdAt: "2026-07-08T10:00:00.000Z",
          updatedAt: "2026-07-08T10:00:00.000Z",
        },
        initialPrompt: `Start ${runId}`,
      };
    },
    listRuns() {
      return [...snapshots.values()];
    },
    async syncRunRuntime(runId, runtime) {
      runtimeUpdates.push({ runId, runtime });
      return null;
    },
    async ingestBridgeEvents(runId, events) {
      ingestedEvents.push(...events.map((event) => ({ runId, event })));
      const snapshot = snapshots.get(runId);
      if (!snapshot) {
        return null;
      }

      for (const event of events) {
        if (event.type === "run.status.changed") {
          snapshot.run.status = event.status;
        }

        if (event.type === "run.failed") {
          snapshot.run.status = "FAILED";
        }
      }

      return snapshot;
    },
  };
}

function createFakeRunWorker(options = {}) {
  const startOrder = [];
  const cleanupCalls = [];
  const controls = new Map();

  return {
    startOrder,
    cleanupCalls,
    controls,
    async startRunJob(payload) {
      if (options.startRunJobError) {
        throw options.startRunJobError;
      }

      return {
        accepted: true,
        payload,
        events: [],
      };
    },
    async startManagedBridgeRuntime({ job }) {
      const runId = job.payload.run.runId;
      startOrder.push(runId);

      let completionResolve;
      const completion = new Promise((resolve) => {
        completionResolve = resolve;
      });

      const handle = {
        launchMode: "local-process",
        controlUrl: `http://127.0.0.1/fake/${runId}`,
        controller: {
          async handle() {
            return null;
          },
        },
        waitUntilReady: async () => undefined,
        completion,
        stop: async () => {
          if (options.onStop) {
            await options.onStop(runId);
          }
        },
      };

      controls.set(runId, {
        complete(result = { exitCode: 0, signal: null }) {
          completionResolve(result);
        },
      });

      return handle;
    },
    async cleanupRunWorkspace({ runId }) {
      cleanupCalls.push(runId);
    },
  };
}

function createFakeQueue() {
  const jobs = new Map();
  const added = [];
  let closed = false;

  return {
    added,
    get closed() {
      return closed;
    },
    async getJob(jobId) {
      return jobs.get(jobId);
    },
    async add(name, payload, options = {}) {
      const job = {
        id: options.jobId ?? payload.runId ?? payload.run?.runId ?? `${name}-${added.length + 1}`,
        name,
        data: payload,
        options,
        async remove() {
          jobs.delete(job.id);
        },
      };
      jobs.set(job.id, job);
      added.push({
        name,
        payload,
        options,
      });
      return job;
    },
    async close() {
      closed = true;
    },
  };
}

async function nextTick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitFor(predicate, timeoutMs = 2_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await nextTick();
  }

  throw new Error("Timed out waiting for predicate");
}

test("EmbeddedRunOrchestrator enforces max concurrency and drains the queue", async () => {
  const { EmbeddedRunOrchestrator } = await importRuntimeOrchestrator();
  const snapshots = createSnapshots({
    run_1: "CREATED",
    run_2: "CREATED",
  });
  const ingestedEvents = [];
  const hooks = createHooks(snapshots, ingestedEvents);
  const worker = createFakeRunWorker();

  const orchestrator = new EmbeddedRunOrchestrator(hooks, {
    runWorker: worker,
    maxConcurrentRuns: 1,
    terminalWorkspaceTtlMs: 0,
  });

  const run1Promise = orchestrator.startRun("run_1");
  const run2Promise = orchestrator.startRun("run_2");

  await nextTick();
  assert.deepEqual(worker.startOrder, ["run_1"]);

  worker.controls.get("run_1").complete();
  await waitFor(() => worker.startOrder.length === 2);

  assert.deepEqual(worker.startOrder, ["run_1", "run_2"]);

  worker.controls.get("run_2").complete();
  await Promise.all([run1Promise, run2Promise]);
});

test("EmbeddedRunOrchestrator recovers queued runs, fails orphaned sessions, and schedules cleanup", async () => {
  const { EmbeddedRunOrchestrator } = await importRuntimeOrchestrator();
  const snapshots = createSnapshots({
    run_created: "CREATED",
    run_queued: "QUEUED",
    run_running: "RUNNING",
    run_terminal: "SUCCEEDED",
  });
  const ingestedEvents = [];
  const hooks = createHooks(snapshots, ingestedEvents);
  const worker = createFakeRunWorker();

  const orchestrator = new EmbeddedRunOrchestrator(hooks, {
    runWorker: worker,
    maxConcurrentRuns: 2,
    orphanRecoveryGraceMs: 0,
    terminalWorkspaceTtlMs: 0,
  });

  await orchestrator.recover();
  await nextTick();
  await nextTick();

  assert.deepEqual(worker.startOrder, ["run_created", "run_queued"]);
  assert.equal(
    ingestedEvents.some(
      (entry) =>
        entry.runId === "run_running" &&
        entry.event.type === "run.failed" &&
        entry.event.error.includes("grace timeout")
    ),
    true
  );

  await nextTick();
  assert.equal(worker.cleanupCalls.includes("run_terminal"), true);
});

test("EmbeddedRunOrchestrator keeps orphaned runs alive when bridge re-registers before grace timeout", async () => {
  const { EmbeddedRunOrchestrator } = await importRuntimeOrchestrator();
  const { bridgeRegistry } = await importBridgeRegistry();
  const snapshots = createSnapshots({
    run_running: "RUNNING",
  });
  const ingestedEvents = [];
  const hooks = createHooks(snapshots, ingestedEvents);
  const worker = createFakeRunWorker();

  const orchestrator = new EmbeddedRunOrchestrator(hooks, {
    runWorker: worker,
    maxConcurrentRuns: 1,
    orphanRecoveryGraceMs: 20,
    terminalWorkspaceTtlMs: 0,
  });

  try {
    await orchestrator.recover();
    bridgeRegistry.register({
      bridgeId: "brg_test_recovered",
      runId: "run_running",
      workspaceId: "wsp_test_recovered",
      targetPath: "/workspace/target",
      control: {
        baseUrl: "http://127.0.0.1:39999",
        authToken: "control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
    await bridgeRegistry.flushPersistence();

    await new Promise((resolve) => setTimeout(resolve, 40));

    assert.equal(
      ingestedEvents.some((entry) => entry.runId === "run_running" && entry.event.type === "run.failed"),
      false
    );
    assert.equal(worker.cleanupCalls.includes("run_running"), false);
  } finally {
    bridgeRegistry.unregister("run_running");
    await bridgeRegistry.flushPersistence();
  }
});

test("EmbeddedRunOrchestrator bullmq mode enqueues start and delayed cleanup jobs", async () => {
  const { EmbeddedRunOrchestrator } = await importRuntimeOrchestrator();
  const snapshots = createSnapshots({
    run_bullmq_created: "CREATED",
    run_bullmq_terminal: "FAILED",
  });
  const ingestedEvents = [];
  const hooks = createHooks(snapshots, ingestedEvents);
  const worker = createFakeRunWorker();
  const startQueue = createFakeQueue();
  const cleanupQueue = createFakeQueue();

  const orchestrator = new EmbeddedRunOrchestrator(hooks, {
    runWorker: worker,
    runtimeDispatchMode: "bullmq",
    runStartQueue: startQueue,
    runCleanupQueue: cleanupQueue,
    terminalWorkspaceTtlMs: 2_500,
  });

  await orchestrator.startRun("run_bullmq_created");
  await orchestrator.recover();
  await nextTick();

  assert.equal(startQueue.added.length, 1);
  assert.equal(startQueue.added[0].name, "run.start");
  assert.equal(startQueue.added[0].payload.run.runId, "run_bullmq_created");
  assert.equal(startQueue.added[0].payload.initialPrompt, "Start run_bullmq_created");
  assert.deepEqual(startQueue.added[0].options, {
    jobId: "run_bullmq_created",
  });

  assert.equal(cleanupQueue.added.length, 1);
  assert.deepEqual(cleanupQueue.added[0], {
    name: "run.cleanup",
    payload: {
      runId: "run_bullmq_terminal",
    },
    options: {
      jobId: "run_bullmq_terminal",
      delay: 2_500,
    },
  });

  await orchestrator.shutdown();
  assert.equal(startQueue.closed, true);
  assert.equal(cleanupQueue.closed, true);
});

test("EmbeddedRunOrchestrator syncs runtime metadata during launch and shutdown", async () => {
  const { EmbeddedRunOrchestrator } = await importRuntimeOrchestrator();
  const snapshots = createSnapshots({
    run_runtime_meta: "CREATED",
  });
  const ingestedEvents = [];
  const runtimeUpdates = [];
  const hooks = createHooks(snapshots, ingestedEvents, runtimeUpdates);
  const worker = createFakeRunWorker();

  const orchestrator = new EmbeddedRunOrchestrator(hooks, {
    runWorker: worker,
    maxConcurrentRuns: 1,
    terminalWorkspaceTtlMs: 0,
  });

  await orchestrator.startRun("run_runtime_meta");
  worker.controls.get("run_runtime_meta").complete({ exitCode: 0, signal: null });
  await waitFor(
    () =>
      runtimeUpdates.some(
        (entry) =>
          entry.runId === "run_runtime_meta" &&
          entry.runtime.finishedAt &&
          entry.runtime.exitCode === 0
      )
  );

  assert.equal(
    runtimeUpdates.some(
      (entry) =>
        entry.runId === "run_runtime_meta" &&
        entry.runtime.launchMode === "local-process" &&
        entry.runtime.startedAt
    ),
    true
  );
  assert.equal(
    runtimeUpdates.some(
      (entry) => entry.runId === "run_runtime_meta" && entry.runtime.readyAt
    ),
    true
  );
});

test("EmbeddedRunOrchestrator marks startup failures as failed and syncs runtime completion", async () => {
  const { EmbeddedRunOrchestrator } = await importRuntimeOrchestrator();
  const snapshots = createSnapshots({
    run_startup_failure: "CREATED",
  });
  const ingestedEvents = [];
  const runtimeUpdates = [];
  const hooks = createHooks(snapshots, ingestedEvents, runtimeUpdates);
  const worker = createFakeRunWorker({
    startRunJobError: new Error("session-pack archive is unavailable"),
  });

  const orchestrator = new EmbeddedRunOrchestrator(hooks, {
    runWorker: worker,
    maxConcurrentRuns: 1,
    terminalWorkspaceTtlMs: 0,
  });

  await assert.rejects(
    orchestrator.startRun("run_startup_failure"),
    /session-pack archive is unavailable/
  );
  await waitFor(
    () =>
      ingestedEvents.some(
        (entry) =>
          entry.runId === "run_startup_failure" &&
          entry.event.type === "run.failed" &&
          entry.event.error.includes("runtime startup failed")
      )
  );
  await waitFor(
    () =>
      runtimeUpdates.some(
        (entry) =>
          entry.runId === "run_startup_failure" &&
          entry.runtime.finishedAt &&
          entry.runtime.exitCode === null
      )
  );

  assert.equal(snapshots.get("run_startup_failure")?.run.status, "FAILED");
});

test("EmbeddedRunOrchestrator shutdown waits for in-flight startup failures to settle", async () => {
  const { EmbeddedRunOrchestrator } = await importRuntimeOrchestrator();
  const snapshots = createSnapshots({
    run_shutdown_startup_failure: "CREATED",
  });
  const ingestedEvents = [];
  const runtimeUpdates = [];
  const hooks = createHooks(snapshots, ingestedEvents, runtimeUpdates);

  let rejectStartRunJob;
  const worker = {
    async startRunJob() {
      return await new Promise((_resolve, reject) => {
        rejectStartRunJob = reject;
      });
    },
    async startManagedBridgeRuntime() {
      throw new Error("startManagedBridgeRuntime should not be reached for this test");
    },
    async cleanupRunWorkspace() {
      return undefined;
    },
  };

  const orchestrator = new EmbeddedRunOrchestrator(hooks, {
    runWorker: worker,
    maxConcurrentRuns: 1,
    terminalWorkspaceTtlMs: 0,
  });

  const startPromise = orchestrator.startRun("run_shutdown_startup_failure");
  await waitFor(() => typeof rejectStartRunJob === "function");

  let shutdownResolved = false;
  const shutdownPromise = orchestrator.shutdown().then(() => {
    shutdownResolved = true;
  });

  await nextTick();
  assert.equal(shutdownResolved, false);

  rejectStartRunJob(new Error("delayed startup failure"));

  await shutdownPromise;
  await assert.rejects(startPromise, /delayed startup failure/);

  assert.equal(
    ingestedEvents.some(
      (entry) =>
        entry.runId === "run_shutdown_startup_failure" &&
        entry.event.type === "run.failed" &&
        entry.event.error.includes("runtime startup failed: delayed startup failure")
    ),
    true
  );
  assert.equal(
    runtimeUpdates.some(
      (entry) =>
        entry.runId === "run_shutdown_startup_failure" &&
        entry.runtime.finishedAt &&
        entry.runtime.exitCode === null
    ),
    true
  );

  const diagnostics = orchestrator.getDiagnostics();
  assert.equal(diagnostics.activeRunsCount, 0);
  assert.equal(diagnostics.launchingRunsCount, 0);
  assert.equal(diagnostics.scheduledRunsCount, 0);
  assert.equal(diagnostics.queueDepth, 0);
});
