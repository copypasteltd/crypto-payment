import test from "node:test";
import assert from "node:assert/strict";

async function importDaemonModule() {
  return import(new URL("../dist/daemon.js", import.meta.url));
}

function createConfig(overrides = {}) {
  return {
    runsRoot: "/tmp/lingban/runs",
    apiBaseUrl: "http://127.0.0.1:3100",
    internalAuthToken: "internal-token",
    runtimeDispatchMode: "bullmq",
    runtimeLaunchMode: "local-process",
    maxConcurrentRuns: 1,
    orphanRecoveryGraceMs: 15_000,
    terminalWorkspaceTtlMs: 0,
    redisUrl: "redis://127.0.0.1:6379/0",
    queuePrefix: "lingban",
    runStartQueueName: "run.start",
    runCleanupQueueName: "run.cleanup",
    runStartDlqQueueName: "run.start.dlq",
    runCleanupDlqQueueName: "run.cleanup.dlq",
    runStartJobAttempts: 3,
    runStartJobBackoffMs: 2_000,
    runCleanupJobAttempts: 5,
    runCleanupJobBackoffMs: 5_000,
    dockerBin: "docker",
    runtimeStartupTimeoutMs: 15_000,
    playwrightBrowsersPath: "/ms-playwright",
    bridgePort: 3800,
    runnerImage: "ghcr.io/lingban/runner:latest",
    runnerCpus: "2",
    runnerMemory: "4g",
    runnerPidsLimit: 512,
    runnerNetwork: "lingban-egress-default",
    ...overrides,
  };
}

function createPayload(runId = "run_00000077") {
  return {
    run: {
      runId,
      workspaceId: "wsp_00000077",
      taskVersionId: "tsv_00000077",
      sessionVersionId: "sev_00000077",
      title: "Daemon processor test",
      targetPath: "/workspace/target",
      entrySurface: "dashboard",
      status: "CREATED",
      statusReason: null,
      createdAt: "2026-07-08T10:00:00.000Z",
      updatedAt: "2026-07-08T10:00:00.000Z",
    },
    initialPrompt: "hello",
    requestedInitialMessage: null,
    bindings: {
      firstPartyMcpIds: [],
      externalConnectorRefs: [],
      credentialIds: [],
    },
  };
}

test("processBullmqRunStartPayload skips startup for already terminal runs", async () => {
  const { processBullmqRunStartPayload } = await importDaemonModule();
  const payload = createPayload("run_terminal_skip");
  let startRunJobCalled = false;
  const cleanupCalls = [];

  await processBullmqRunStartPayload(payload, {
    config: createConfig(),
    apiConnector: {
      async getRunSnapshot() {
        return {
          run: {
            ...payload.run,
            status: "CANCELLED",
          },
        };
      },
      async ingestEvents() {
        throw new Error("should not ingest events");
      },
      async syncRunRuntime() {
        throw new Error("should not sync runtime");
      },
      async postTerminalFailure() {
        throw new Error("should not post terminal failure");
      },
    },
    startRunJobImpl: async () => {
      startRunJobCalled = true;
      throw new Error("should not start job");
    },
    cleanupRunWorkspaceImpl: async ({ runId }) => {
      cleanupCalls.push(runId);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(startRunJobCalled, false);
  assert.deepEqual(cleanupCalls, ["run_terminal_skip"]);
});

test("processBullmqRunStartPayload skips duplicate recovery start when bridge is already active", async () => {
  const { processBullmqRunStartPayload } = await importDaemonModule();
  const payload = createPayload("run_duplicate_recovery");
  let startRunJobCalled = false;
  const terminalFailures = [];
  const cleanupCalls = [];

  await processBullmqRunStartPayload(payload, {
    config: createConfig(),
    apiConnector: {
      async getRunRecoveryCandidate() {
        return {
          snapshot: {
            run: {
              ...payload.run,
              status: "RUNNING",
            },
            runtime: {},
            messages: [],
            files: [],
            artifacts: [],
            approvals: [],
          },
          bridge: {
            registered: true,
            controllerAttached: true,
            connectedAt: "2026-07-09T02:10:00.000Z",
          },
          action: "await-bridge",
          reason: "run already has an active bridge registration",
          startJob: null,
        };
      },
      async getRunSnapshot() {
        throw new Error("should not need snapshot fallback");
      },
      async ingestEvents() {
        throw new Error("should not ingest events");
      },
      async syncRunRuntime() {
        throw new Error("should not sync runtime");
      },
      async postTerminalFailure(runId, error) {
        terminalFailures.push({ runId, error });
        return null;
      },
    },
    startRunJobImpl: async () => {
      startRunJobCalled = true;
      throw new Error("should not start job");
    },
    cleanupRunWorkspaceImpl: async ({ runId }) => {
      cleanupCalls.push(runId);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(startRunJobCalled, false);
  assert.deepEqual(terminalFailures, []);
  assert.deepEqual(cleanupCalls, []);
});

test("processBullmqRunStartPayload marks orphaned runtime as failed during recovery", async () => {
  const { processBullmqRunStartPayload } = await importDaemonModule();
  const payload = createPayload("run_orphaned_recovery");
  let startRunJobCalled = false;
  const terminalFailures = [];
  const runtimeUpdates = [];
  const cleanupCalls = [];

  await processBullmqRunStartPayload(payload, {
    config: createConfig(),
    apiConnector: {
      async getRunRecoveryCandidate() {
        return {
          snapshot: {
            run: {
              ...payload.run,
              status: "RUNNING",
            },
            runtime: {},
            messages: [],
            files: [],
            artifacts: [],
            approvals: [],
          },
          bridge: {
            registered: false,
            controllerAttached: false,
            connectedAt: null,
          },
          action: "mark-orphan-failed",
          reason: "run is RUNNING but no active bridge registration is present during worker recovery",
          startJob: null,
        };
      },
      async getRunSnapshot() {
        throw new Error("should not need snapshot fallback");
      },
      async ingestEvents() {
        throw new Error("should not ingest events");
      },
      async syncRunRuntime(runId, runtime) {
        runtimeUpdates.push({ runId, runtime });
        return null;
      },
      async postTerminalFailure(runId, error) {
        terminalFailures.push({ runId, error });
        return null;
      },
    },
    startRunJobImpl: async () => {
      startRunJobCalled = true;
      throw new Error("should not start job");
    },
    scheduleWorkspaceCleanup(runId) {
      cleanupCalls.push(runId);
    },
    cleanupRunWorkspaceImpl: async () => null,
  });

  assert.equal(startRunJobCalled, false);
  assert.equal(terminalFailures.length, 1);
  assert.equal(terminalFailures[0].runId, "run_orphaned_recovery");
  assert.equal(terminalFailures[0].error.includes("no active bridge registration"), true);
  assert.equal(
    runtimeUpdates.some(
      (entry) =>
        entry.runId === "run_orphaned_recovery" &&
        entry.runtime.finishedAt &&
        entry.runtime.exitCode === null
    ),
    true
  );
  assert.deepEqual(cleanupCalls, ["run_orphaned_recovery"]);
});

test("processBullmqRunStartPayload does not convert CANCELLED into FAILED on non-zero exit", async () => {
  const { processBullmqRunStartPayload } = await importDaemonModule();
  const payload = createPayload("run_cancelled_exit");
  const cleanupCalls = [];
  const terminalFailures = [];
  const runtimeUpdates = [];
  let snapshotStage = 0;

  await processBullmqRunStartPayload(payload, {
    config: createConfig(),
    apiConnector: {
      async getRunSnapshot() {
        snapshotStage += 1;
        if (snapshotStage === 1) {
          return { run: { ...payload.run, status: "CREATED" } };
        }
        if (snapshotStage === 2) {
          return { run: { ...payload.run, status: "QUEUED" } };
        }
        if (snapshotStage === 3) {
          return { run: { ...payload.run, status: "RUNNING" } };
        }
        return { run: { ...payload.run, status: "CANCELLED" } };
      },
      async ingestEvents() {
        return null;
      },
      async syncRunRuntime(runId, runtime) {
        runtimeUpdates.push({ runId, runtime });
        return null;
      },
      async postTerminalFailure(runId, error) {
        terminalFailures.push({ runId, error });
        return null;
      },
    },
    startRunJobImpl: async (input) => ({
      accepted: true,
      payload: {
        ...input,
        run: {
          ...input.run,
          status: "QUEUED",
          updatedAt: "2026-07-08T10:00:01.000Z",
        },
      },
      events: [],
      preparedWorkspace: {
        hostPaths: {
          runRootPath: "/tmp/run",
          targetPath: "/tmp/run/target",
          inputsPath: "/tmp/run/inputs",
          outputsPath: "/tmp/run/outputs",
          runtimePath: "/tmp/run/runtime",
          logsPath: "/tmp/run/logs",
        },
        containerPaths: {
          workspaceRoot: "/workspace",
          targetPath: "/workspace/target",
          inputsPath: "/workspace/inputs",
          outputsPath: "/workspace/outputs",
          runtimePath: "/workspace/runtime",
        },
      },
      hostBridgeContext: {
        runId: input.run.runId,
        workspaceId: input.run.workspaceId,
        targetPath: input.run.targetPath,
        initialPrompt: input.initialPrompt,
        requestedInitialMessage: input.requestedInitialMessage,
        credentialMounts: [],
        mcpBindings: [],
      },
      containerBridgeContext: {
        runId: input.run.runId,
        workspaceId: input.run.workspaceId,
        targetPath: input.run.targetPath,
        initialPrompt: input.initialPrompt,
        requestedInitialMessage: input.requestedInitialMessage,
        credentialMounts: [],
        mcpBindings: [],
      },
      runtimeConfig: {
        runId: input.run.runId,
        files: {
          runtimeConfigPath: "/tmp/run/runtime/runtime-config.json",
          bridgeContextHostPath: "/tmp/run/runtime/bridge-context.host.json",
          bridgeContextContainerPath: "/tmp/run/runtime/bridge-context.container.json",
          mcpConfigPath: "/tmp/run/runtime/mcp-config.json",
          mcpBindingsPath: "/tmp/run/runtime/mcp-bindings.json",
          secretManifestPath: "/tmp/run/runtime/secret-manifest.json",
          containerLaunchPlanPath: "/tmp/run/runtime/container-launch-plan.json",
        },
        workspace: {
          hostPaths: {
            runRootPath: "/tmp/run",
            targetPath: "/tmp/run/target",
            inputsPath: "/tmp/run/inputs",
            outputsPath: "/tmp/run/outputs",
            runtimePath: "/tmp/run/runtime",
            logsPath: "/tmp/run/logs",
          },
          containerPaths: {
            workspaceRoot: "/workspace",
            targetPath: "/workspace/target",
            inputsPath: "/workspace/inputs",
            outputsPath: "/workspace/outputs",
            runtimePath: "/workspace/runtime",
          },
        },
      },
      containerLaunchPlan: {
        runId: input.run.runId,
        image: "ghcr.io/lingban/runner:latest",
        containerName: `lingban-${input.run.runId}`,
        network: "lingban-egress-default",
        workingDirectory: "/workspace/target",
        labels: {},
        env: {},
        mounts: [],
        resources: {
          cpus: "2",
          memory: "4g",
          pidsLimit: 512,
        },
      },
    }),
    startManagedBridgeRuntimeImpl: async () => ({
      launchMode: "local-process",
      controlUrl: "http://127.0.0.1:39000",
      controller: {
        async handle() {
          return null;
        },
      },
      waitUntilReady: async () => undefined,
      completion: Promise.resolve({
        exitCode: 1,
        signal: null,
      }),
      stop: async () => undefined,
    }),
    cleanupRunWorkspaceImpl: async ({ runId }) => {
      cleanupCalls.push(runId);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(terminalFailures, []);
  assert.deepEqual(cleanupCalls, ["run_cancelled_exit"]);
  assert.equal(
    runtimeUpdates.some(
      (entry) =>
        entry.runId === "run_cancelled_exit" &&
        entry.runtime.launchMode === "local-process" &&
        entry.runtime.startedAt
    ),
    true
  );
  assert.equal(
    runtimeUpdates.some(
      (entry) => entry.runId === "run_cancelled_exit" && entry.runtime.readyAt
    ),
    true
  );
  assert.equal(
    runtimeUpdates.some(
      (entry) =>
        entry.runId === "run_cancelled_exit" &&
        entry.runtime.finishedAt &&
        entry.runtime.exitCode === 1
    ),
    true
  );
});

test("handleRunStartJobFailure ignores non-terminal attempts before retries are exhausted", async () => {
  const { handleRunStartJobFailure } = await importDaemonModule();
  const dlqRecords = [];
  const terminalFailures = [];
  const runtimeUpdates = [];
  const cleanupCalls = [];
  const config = createConfig({
    runStartJobAttempts: 3,
  });

  const result = await handleRunStartJobFailure(
    {
      id: "job_retry_1",
      attemptsMade: 1,
      opts: {
        attempts: 3,
      },
      data: createPayload("run_retrying_start"),
    },
    new Error("temporary redis hiccup"),
    {
      config,
      apiConnector: {
        async postTerminalFailure(runId, error) {
          terminalFailures.push({ runId, error });
          return null;
        },
        async syncRunRuntime(runId, runtime) {
          runtimeUpdates.push({ runId, runtime });
          return null;
        },
      },
      dlqQueue: {
        async add(_name, payload) {
          dlqRecords.push(payload);
          return null;
        },
        async close() {
          return null;
        },
      },
      scheduleWorkspaceCleanup(runId) {
        cleanupCalls.push(runId);
      },
      now: () => "2026-07-09T02:00:00.000Z",
    }
  );

  assert.equal(result.exhausted, false);
  assert.equal(dlqRecords.length, 0);
  assert.equal(terminalFailures.length, 0);
  assert.equal(runtimeUpdates.length, 0);
  assert.deepEqual(cleanupCalls, []);
});

test("recoverBullmqRunWorkerState enqueues queued runs and fails orphaned ones", async () => {
  const { recoverBullmqRunWorkerState } = await importDaemonModule();
  const startQueueAdds = [];
  const cleanupQueueAdds = [];
  const runtimeUpdates = [];
  const terminalFailures = [];
  const cleanupCalls = [];

  const summary = await recoverBullmqRunWorkerState({
    config: createConfig({
      terminalWorkspaceTtlMs: 60_000,
    }),
    apiConnector: {
      async listRunRecoveryCandidates() {
        return {
          candidates: [
            {
              snapshot: {
                run: {
                  ...createPayload("run_recover_start").run,
                  status: "QUEUED",
                },
                runtime: {},
                messages: [],
                files: [],
                artifacts: [],
                approvals: [],
              },
              bridge: {
                registered: false,
                controllerAttached: false,
                connectedAt: null,
              },
              action: "enqueue-start",
              reason: "queued run should be re-enqueued",
              startJob: createPayload("run_recover_start"),
            },
            {
              snapshot: {
                run: {
                  ...createPayload("run_recover_orphan").run,
                  status: "RUNNING",
                },
                runtime: {},
                messages: [],
                files: [],
                artifacts: [],
                approvals: [],
              },
              bridge: {
                registered: false,
                controllerAttached: false,
                connectedAt: null,
              },
              action: "mark-orphan-failed",
              reason: "running run should be failed during worker restart recovery",
              startJob: null,
            },
            {
              snapshot: {
                run: {
                  ...createPayload("run_recover_skip").run,
                  status: "RUNNING",
                },
                runtime: {},
                messages: [],
                files: [],
                artifacts: [],
                approvals: [],
              },
              bridge: {
                registered: true,
                controllerAttached: true,
                connectedAt: "2026-07-09T02:20:00.000Z",
              },
              action: "await-bridge",
              reason: "active bridge should be preserved",
              startJob: null,
            },
            {
              snapshot: {
                run: {
                  ...createPayload("run_recover_cleanup").run,
                  status: "SUCCEEDED",
                  updatedAt: "2026-07-09T02:29:30.000Z",
                },
                runtime: {
                  launchMode: "docker",
                  containerName: "ctr_recover_cleanup",
                  startedAt: "2026-07-09T02:10:00.000Z",
                  readyAt: "2026-07-09T02:10:05.000Z",
                  finishedAt: "2026-07-09T02:29:30.000Z",
                  exitCode: 0,
                  exitSignal: null,
                },
                messages: [],
                files: [],
                artifacts: [],
                approvals: [],
              },
              bridge: {
                registered: false,
                controllerAttached: false,
                connectedAt: null,
              },
              action: "schedule-cleanup",
              reason: "terminal run should be re-scheduled for workspace cleanup",
              startJob: null,
            },
          ],
        };
      },
      async syncRunRuntime(runId, runtime) {
        runtimeUpdates.push({ runId, runtime });
        return null;
      },
      async postTerminalFailure(runId, error) {
        terminalFailures.push({ runId, error });
        return null;
      },
    },
    startQueue: {
      async getJob() {
        return undefined;
      },
      async add(name, payload, options) {
        startQueueAdds.push({ name, payload, options });
        return null;
      },
      async close() {
        return null;
      },
    },
    cleanupQueue: {
      async getJob() {
        return undefined;
      },
      async add(name, payload, options) {
        cleanupQueueAdds.push({ name, payload, options });
        return null;
      },
      async close() {
        return null;
      },
    },
    scheduleWorkspaceCleanup(runId) {
      cleanupCalls.push(runId);
    },
    now: () => "2026-07-09T02:30:00.000Z",
  });

  assert.deepEqual(summary, {
    candidates: 4,
    enqueuedStarts: 1,
    orphanFailures: 1,
    scheduledCleanups: 1,
    skipped: 1,
  });
  assert.equal(startQueueAdds.length, 1);
  assert.equal(startQueueAdds[0].name, "run.start");
  assert.equal(startQueueAdds[0].payload.run.runId, "run_recover_start");
  assert.deepEqual(startQueueAdds[0].options, {
    jobId: "run_recover_start",
  });
  assert.equal(
    runtimeUpdates.some(
      (entry) =>
        entry.runId === "run_recover_orphan" &&
        entry.runtime.finishedAt &&
        entry.runtime.exitCode === null
    ),
    true
  );
  assert.equal(terminalFailures.length, 1);
  assert.equal(terminalFailures[0].runId, "run_recover_orphan");
  assert.equal(cleanupQueueAdds.length, 1);
  assert.equal(cleanupQueueAdds[0].name, "run.cleanup");
  assert.deepEqual(cleanupQueueAdds[0].payload, {
    runId: "run_recover_cleanup",
  });
  assert.deepEqual(cleanupQueueAdds[0].options, {
    jobId: "run_recover_cleanup",
    delay: 30_000,
  });
  assert.deepEqual(cleanupCalls, ["run_recover_orphan"]);
});

test("handleRunStartJobFailure writes final start failures to DLQ and posts terminal failure", async () => {
  const { handleRunStartJobFailure } = await importDaemonModule();
  const dlqRecords = [];
  const terminalFailures = [];
  const runtimeUpdates = [];
  const cleanupCalls = [];
  const config = createConfig({
    runStartJobAttempts: 3,
  });

  const result = await handleRunStartJobFailure(
    {
      id: "job_retry_3",
      attemptsMade: 3,
      opts: {
        attempts: 3,
      },
      data: createPayload("run_final_start_failure"),
    },
    new Error("bridge bootstrap crashed"),
    {
      config,
      apiConnector: {
        async postTerminalFailure(runId, error) {
          terminalFailures.push({ runId, error });
          return null;
        },
        async syncRunRuntime(runId, runtime) {
          runtimeUpdates.push({ runId, runtime });
          return null;
        },
      },
      dlqQueue: {
        async add(name, payload, options) {
          dlqRecords.push({ name, payload, options });
          return null;
        },
        async close() {
          return null;
        },
      },
      scheduleWorkspaceCleanup(runId) {
        cleanupCalls.push(runId);
      },
      now: () => "2026-07-09T02:05:00.000Z",
    }
  );

  assert.equal(result.exhausted, true);
  assert.equal(dlqRecords.length, 1);
  assert.equal(dlqRecords[0].name, "run.start.dlq");
  assert.equal(dlqRecords[0].payload.runId, "run_final_start_failure");
  assert.equal(dlqRecords[0].payload.attemptsMade, 3);
  assert.equal(dlqRecords[0].payload.maxAttempts, 3);
  assert.equal(dlqRecords[0].payload.error, "bridge bootstrap crashed");
  assert.equal(
    dlqRecords[0].options.jobId.startsWith("run.start.dlq:run_final_start_failure:3:2026-07-09T02:05:00.000Z"),
    true
  );
  assert.deepEqual(runtimeUpdates, [
    {
      runId: "run_final_start_failure",
      runtime: {
        finishedAt: "2026-07-09T02:05:00.000Z",
        exitCode: null,
        exitSignal: null,
      },
    },
  ]);
  assert.equal(terminalFailures.length, 1);
  assert.equal(terminalFailures[0].runId, "run_final_start_failure");
  assert.equal(
    terminalFailures[0].error.includes("bullmq run.start exhausted after 3/3 attempts"),
    true
  );
  assert.deepEqual(cleanupCalls, ["run_final_start_failure"]);
});

test("handleRunCleanupJobFailure writes exhausted cleanup jobs to cleanup DLQ", async () => {
  const { handleRunCleanupJobFailure } = await importDaemonModule();
  const dlqRecords = [];
  const config = createConfig({
    runCleanupJobAttempts: 2,
  });

  const result = await handleRunCleanupJobFailure(
    {
      id: "cleanup_retry_2",
      attemptsMade: 2,
      opts: {
        attempts: 2,
      },
      data: {
        runId: "run_cleanup_dlq",
      },
    },
    new Error("filesystem permission denied"),
    {
      config,
      dlqQueue: {
        async add(name, payload, options) {
          dlqRecords.push({ name, payload, options });
          return null;
        },
        async close() {
          return null;
        },
      },
      now: () => "2026-07-09T02:10:00.000Z",
    }
  );

  assert.equal(result.exhausted, true);
  assert.equal(dlqRecords.length, 1);
  assert.equal(dlqRecords[0].name, "run.cleanup.dlq");
  assert.equal(dlqRecords[0].payload.runId, "run_cleanup_dlq");
  assert.equal(dlqRecords[0].payload.attemptsMade, 2);
  assert.equal(dlqRecords[0].payload.maxAttempts, 2);
  assert.equal(dlqRecords[0].payload.error, "filesystem permission denied");
});

test("processBullmqRunCleanupPayload delegates to workspace cleanup", async () => {
  const { processBullmqRunCleanupPayload } = await importDaemonModule();
  const cleanupCalls = [];

  await processBullmqRunCleanupPayload(
    {
      runId: "run_cleanup_001",
    },
    {
      cleanupRunWorkspaceImpl: async ({ runId }) => {
        cleanupCalls.push(runId);
      },
    }
  );

  assert.deepEqual(cleanupCalls, ["run_cleanup_001"]);
});
