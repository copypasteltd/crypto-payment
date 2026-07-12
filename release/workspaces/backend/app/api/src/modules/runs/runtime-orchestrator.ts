import { loadWorkerRuntimeConfig } from "@lingban/config";
import type {
  BridgeEvent,
  RunSnapshot,
  RunStatus,
  RuntimeOrchestratorDiagnostics,
  RunRuntimeUpdate,
  StartRunJobPayload,
} from "@lingban/contracts";
import { runtimeOrchestratorDiagnosticsSchema } from "@lingban/contracts";
import {
  buildRunWorker,
  createRunCleanupQueue,
  createRunStartQueue,
  enqueueRunCleanupJob,
  enqueueRunStartJob,
  type RunCleanupQueueLike,
  type RunStartQueueLike,
} from "@lingban/run-worker";
import { nowIso, toErrorMessage } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { bridgeRegistry } from "../bridge/registry.js";

const TERMINAL_STATUSES = new Set<RunStatus>(["SUCCEEDED", "FAILED", "CANCELLED"]);
const RECOVERABLE_QUEUE_STATUSES = new Set<RunStatus>(["CREATED", "READY", "QUEUED", "STARTING"]);
const ORPHANED_RUNTIME_STATUSES = new Set<RunStatus>(["RUNNING", "WAITING_APPROVAL"]);

type RuntimeHooks = {
  getRunSnapshot: (runId: string) => RunSnapshot;
  getStartRunJobPayload: (runId: string) => StartRunJobPayload;
  listRuns: () => RunSnapshot[];
  syncRunRuntime: (runId: string, runtime: RunRuntimeUpdate) => Promise<unknown> | unknown;
  ingestBridgeEvents: (runId: string, events: BridgeEvent[]) => Promise<unknown> | unknown;
};

type RunWorkerLike = ReturnType<typeof buildRunWorker>;
type ActiveRuntimeHandle = Awaited<ReturnType<RunWorkerLike["startManagedBridgeRuntime"]>>;

type EmbeddedRunOrchestratorOptions = {
  runWorker?: RunWorkerLike;
  runtimeDispatchMode?: "embedded" | "bullmq";
  runStartQueue?: RunStartQueueLike;
  runCleanupQueue?: RunCleanupQueueLike;
  maxConcurrentRuns?: number;
  orphanRecoveryGraceMs?: number;
  terminalWorkspaceTtlMs?: number;
};

function isTerminalStatus(status: RunStatus) {
  return TERMINAL_STATUSES.has(status);
}

function formatExitReason(
  handle: ActiveRuntimeHandle,
  result: Awaited<ActiveRuntimeHandle["completion"]>
) {
  return `bridge runtime exited unexpectedly (mode=${handle.launchMode}, exit=${result.exitCode ?? "null"}, signal=${result.signal ?? "null"})`;
}

export class EmbeddedRunOrchestrator {
  #hooks: RuntimeHooks;
  #runWorker: RunWorkerLike;
  #runtimeDispatchMode: "embedded" | "bullmq";
  #runStartQueue: RunStartQueueLike | null;
  #runCleanupQueue: RunCleanupQueueLike | null;
  #maxConcurrentRuns: number;
  #orphanRecoveryGraceMs: number;
  #terminalWorkspaceTtlMs: number;
  #active = new Map<string, ActiveRuntimeHandle>();
  #launching = new Map<string, Promise<void>>();
  #scheduled = new Map<
    string,
    {
      promise: Promise<void>;
      resolve: () => void;
      reject: (error: unknown) => void;
    }
  >();
  #queue: string[] = [];
  #stopRequested = new Set<string>();
  #orphanRecoveryTimers = new Map<string, NodeJS.Timeout>();
  #cleanupTimers = new Map<string, NodeJS.Timeout>();
  #drainPromise: Promise<void> | null = null;
  #shuttingDown = false;

  constructor(hooks: RuntimeHooks, options: EmbeddedRunOrchestratorOptions = {}) {
    const workerConfig = loadWorkerRuntimeConfig();
    this.#hooks = hooks;
    this.#runWorker = options.runWorker ?? buildRunWorker();
    this.#runtimeDispatchMode = options.runtimeDispatchMode ?? workerConfig.runtimeDispatchMode;
    this.#runStartQueue =
      this.#runtimeDispatchMode === "bullmq"
        ? (options.runStartQueue ?? createRunStartQueue(workerConfig))
        : null;
    this.#runCleanupQueue =
      this.#runtimeDispatchMode === "bullmq"
        ? (options.runCleanupQueue ?? createRunCleanupQueue(workerConfig))
        : null;
    this.#maxConcurrentRuns = Math.max(1, options.maxConcurrentRuns ?? workerConfig.maxConcurrentRuns);
    this.#orphanRecoveryGraceMs = Math.max(
      0,
      options.orphanRecoveryGraceMs ?? workerConfig.orphanRecoveryGraceMs
    );
    this.#terminalWorkspaceTtlMs = Math.max(
      0,
      options.terminalWorkspaceTtlMs ?? workerConfig.terminalWorkspaceTtlMs
    );
  }

  getDiagnostics(): RuntimeOrchestratorDiagnostics {
    const activeRunIds = [...this.#active.keys()].sort();
    const launchingRunIds = [...this.#launching.keys()].sort();
    const scheduledRunIds = [...this.#scheduled.keys()].sort();
    const queuedRunIds = [...this.#queue];

    return runtimeOrchestratorDiagnosticsSchema.parse({
      dispatchMode: this.#runtimeDispatchMode,
      maxConcurrentRuns: this.#maxConcurrentRuns,
      orphanRecoveryGraceMs: this.#orphanRecoveryGraceMs,
      terminalWorkspaceTtlMs: this.#terminalWorkspaceTtlMs,
      runStartQueueEnabled: Boolean(this.#runStartQueue),
      runCleanupQueueEnabled: Boolean(this.#runCleanupQueue),
      activeRunsCount: activeRunIds.length,
      launchingRunsCount: launchingRunIds.length,
      scheduledRunsCount: scheduledRunIds.length,
      queueDepth: this.#queue.length,
      stopRequestedCount: this.#stopRequested.size,
      orphanRecoveryTimersCount: this.#orphanRecoveryTimers.size,
      cleanupTimersCount: this.#cleanupTimers.size,
      drainInProgress: this.#drainPromise !== null,
      activeRunIds,
      launchingRunIds,
      scheduledRunIds,
      queuedRunIds,
    });
  }

  startRun(runId: string) {
    if (this.#active.has(runId)) {
      return Promise.resolve();
    }

    const existing = this.#launching.get(runId) ?? this.#scheduled.get(runId)?.promise;
    if (existing) {
      return existing;
    }

    this.#clearWorkspaceCleanup(runId);
    this.#clearOrphanRecovery(runId);
    this.#stopRequested.delete(runId);

    if (this.#runtimeDispatchMode === "bullmq") {
      const promise = this.#enqueueToBullmq(runId).finally(() => {
        this.#scheduled.delete(runId);
      });
      this.#scheduled.set(runId, {
        promise,
        resolve: () => undefined,
        reject: () => undefined,
      });
      return promise;
    }

    let resolvePromise: (() => void) | null = null;
    let rejectPromise: ((error: unknown) => void) | null = null;
    const pending = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    this.#scheduled.set(runId, {
      promise: pending,
      resolve: () => resolvePromise?.(),
      reject: (error) => rejectPromise?.(error),
    });
    this.#queue.push(runId);
    void this.#drainQueue();
    return pending;
  }

  async requestStop(runId: string) {
    this.#stopRequested.add(runId);
    this.#clearOrphanRecovery(runId);

    if (this.#runtimeDispatchMode === "bullmq") {
      const queuedJob = await this.#runStartQueue?.getJob(runId);
      await Promise.resolve(queuedJob?.remove()).catch(() => undefined);
      return;
    }

    const handle = this.#active.get(runId);
    if (!handle) {
      return;
    }

    await this.#cleanup(runId, handle);
  }

  async recover() {
    for (const snapshot of this.#hooks.listRuns()) {
      const status = snapshot.run.status;
      const runId = snapshot.run.runId;

      if (RECOVERABLE_QUEUE_STATUSES.has(status)) {
        void this.startRun(runId).catch((error) => {
          console.error(
            `[lingban-runtime-orchestrator] failed to recover queued run ${runId}: ${toErrorMessage(error)}`
          );
        });
        continue;
      }

      if (ORPHANED_RUNTIME_STATUSES.has(status)) {
        this.#scheduleOrphanRecoveryFailure(runId);
        continue;
      }

      if (isTerminalStatus(status)) {
        this.#scheduleWorkspaceCleanup(runId);
      }
    }
  }

  async shutdown() {
    this.#shuttingDown = true;

    for (const timer of this.#cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.#cleanupTimers.clear();

    for (const timer of this.#orphanRecoveryTimers.values()) {
      clearTimeout(timer);
    }
    this.#orphanRecoveryTimers.clear();

    if (this.#runtimeDispatchMode === "bullmq") {
      await Promise.resolve(this.#runStartQueue?.close()).catch(() => undefined);
      await Promise.resolve(this.#runCleanupQueue?.close()).catch(() => undefined);
      this.#runStartQueue = null;
      this.#runCleanupQueue = null;
      return;
    }

    const knownRunIds = new Set([
      ...this.#active.keys(),
      ...this.#launching.keys(),
      ...this.#scheduled.keys(),
      ...this.#queue,
    ]);
    for (const runId of knownRunIds) {
      this.#stopRequested.add(runId);
      this.#clearOrphanRecovery(runId);
    }

    this.#queue = [];

    for (const [runId, entry] of [...this.#scheduled.entries()]) {
      if (this.#launching.has(runId)) {
        continue;
      }

      this.#scheduled.delete(runId);
      entry.resolve();
    }

    const handles = [...this.#active.entries()];
    this.#active.clear();
    await Promise.all(
      handles.map(async ([runId, handle]) => {
        try {
          await handle.stop();
        } catch (error) {
          console.error(
            `[lingban-runtime-orchestrator] failed to stop runtime ${runId}: ${toErrorMessage(error)}`
          );
        } finally {
          bridgeRegistry.unregister(runId);
        }
      })
    );

    await Promise.allSettled([...this.#launching.values()]);

    const remainingHandles = [...this.#active.entries()];
    this.#active.clear();
    await Promise.all(
      remainingHandles.map(async ([runId, handle]) => {
        try {
          await handle.stop();
        } catch (error) {
          console.error(
            `[lingban-runtime-orchestrator] failed to stop runtime ${runId}: ${toErrorMessage(error)}`
          );
        } finally {
          bridgeRegistry.unregister(runId);
        }
      })
    );
  }

  async #drainQueue() {
    if (this.#drainPromise) {
      return this.#drainPromise;
    }

    this.#drainPromise = (async () => {
      while (
        this.#queue.length > 0 &&
        this.#active.size + this.#launching.size < this.#maxConcurrentRuns
      ) {
        const runId = this.#queue.shift();
        if (!runId) {
          continue;
        }

        const entry = this.#scheduled.get(runId);
        if (!entry) {
          continue;
        }

        const launchPromise = this.#launch(runId)
          .then(() => {
            entry.resolve();
          })
          .catch((error) => {
            entry.reject(error);
          })
          .finally(() => {
            this.#launching.delete(runId);
            this.#scheduled.delete(runId);
            void this.#drainQueue();
          });

        this.#launching.set(runId, launchPromise);
      }
    })().finally(() => {
      this.#drainPromise = null;
    });

    return this.#drainPromise;
  }

  async #launch(runId: string) {
    if (this.#shouldAbort(runId)) {
      return;
    }
    let handle: ActiveRuntimeHandle | null = null;
    try {
      const payload = this.#hooks.getStartRunJobPayload(runId);
      const accepted = await this.#runWorker.startRunJob(payload);

      if (this.#shouldAbort(runId)) {
        return;
      }

      await this.#hooks.ingestBridgeEvents(runId, accepted.events);

      if (this.#shouldAbort(runId)) {
        return;
      }

      handle = await this.#runWorker.startManagedBridgeRuntime({
        job: accepted,
        apiBaseUrl: this.#resolveInternalApiBaseUrl(),
        authToken: getApiRuntimeConfig().internalAuthToken,
        codex: this.#resolveCodexLaunchOptions(),
      });

      this.#active.set(runId, handle);
      await Promise.resolve(
        this.#hooks.syncRunRuntime(runId, {
          launchMode: handle.launchMode,
          containerName:
            handle.launchMode === "docker" ? accepted.containerLaunchPlan.containerName : null,
          startedAt: nowIso(),
          exitCode: null,
          exitSignal: null,
          finishedAt: null,
        })
      );
      this.#watchCompletion(runId, handle);

      await handle.waitUntilReady();
      await Promise.resolve(
        this.#hooks.syncRunRuntime(runId, {
          readyAt: nowIso(),
        })
      );

      if (!this.#active.has(runId)) {
        bridgeRegistry.unregister(runId);
        return;
      }

      if (this.#shouldAbort(runId)) {
        await this.#cleanup(runId, handle);
        return;
      }

      bridgeRegistry.attachController(runId, handle.controller);
    } catch (error) {
      if (handle) {
        this.#active.delete(runId);
        bridgeRegistry.unregister(runId);
        await handle.stop().catch(() => undefined);
      }
      await Promise.resolve(
        this.#hooks.syncRunRuntime(runId, {
          finishedAt: nowIso(),
          exitCode: null,
          exitSignal: null,
        })
      ).catch((syncError) => {
        if (this.#shuttingDown) {
          return;
        }
        console.error(
          `[lingban-runtime-orchestrator] failed to sync startup failure metadata for ${runId}: ${toErrorMessage(syncError)}`
        );
      });
      await this.#hooks.ingestBridgeEvents(runId, [
        {
          type: "run.failed",
          runId,
          occurredAt: new Date().toISOString(),
          error: `runtime startup failed: ${toErrorMessage(error)}`,
        },
      ]);
      this.#scheduleWorkspaceCleanupIfTerminal(runId);
      throw error;
    }
  }

  async #enqueueToBullmq(runId: string) {
    if (this.#shouldAbort(runId)) {
      return;
    }

    if (!this.#runStartQueue) {
      throw new Error("bullmq runtime dispatch mode is enabled, but no run start queue is available");
    }

    const payload = this.#hooks.getStartRunJobPayload(runId);
    await enqueueRunStartJob(this.#runStartQueue, payload);
  }

  #watchCompletion(runId: string, handle: ActiveRuntimeHandle) {
    void handle.completion.then(async (result) => {
      const active = this.#active.get(runId);
      if (active !== handle) {
        return;
      }

      const status = this.#hooks.getRunSnapshot(runId).run.status;

      if (isTerminalStatus(status) || this.#stopRequested.has(runId)) {
        await this.#cleanup(runId, handle).catch(() => undefined);
        return;
      }

      try {
        await Promise.resolve(
          this.#hooks.ingestBridgeEvents(runId, [
            {
              type: "run.failed",
              runId,
              occurredAt: new Date().toISOString(),
              error: formatExitReason(handle, result),
            },
          ])
        );
      } catch (error: unknown) {
        console.error("[lingban-runtime-orchestrator] failed to ingest runtime exit", error);
      }

      try {
        await this.#cleanup(runId, handle);
      } catch (error: unknown) {
        console.error("[lingban-runtime-orchestrator] failed to cleanup runtime", error);
      }
    });
  }

  async #cleanup(runId: string, handle: ActiveRuntimeHandle) {
    if (this.#active.get(runId) !== handle) {
      return;
    }

    this.#active.delete(runId);
    this.#clearOrphanRecovery(runId);
    let completion: Awaited<ActiveRuntimeHandle["completion"]> | null = null;

    try {
      try {
        await Promise.resolve(handle.controller.handle({ type: "syncFiles" }));
      } catch {
        // ignore control errors during shutdown
      }

      try {
        await Promise.resolve(handle.controller.handle({ type: "flushArtifacts" }));
      } catch {
        // ignore control errors during shutdown
      }

      await handle.stop();
      completion = await handle.completion.catch(() => null);
    } finally {
      completion = completion ?? (await handle.completion.catch(() => null));
      await Promise.resolve(
        this.#hooks.syncRunRuntime(runId, {
          finishedAt: nowIso(),
          exitCode: completion?.exitCode ?? null,
          exitSignal: completion?.signal ?? null,
        })
      ).catch((error) => {
        if (this.#shuttingDown) {
          return;
        }
        console.error(
          `[lingban-runtime-orchestrator] failed to sync runtime metadata for ${runId}: ${toErrorMessage(error)}`
        );
      });
      bridgeRegistry.unregister(runId);
      this.#scheduleWorkspaceCleanupIfTerminal(runId);
      void this.#drainQueue();
    }
  }

  #shouldAbort(runId: string) {
    if (this.#stopRequested.has(runId)) {
      return true;
    }

    const status = this.#hooks.getRunSnapshot(runId).run.status;
    return isTerminalStatus(status);
  }

  #scheduleWorkspaceCleanupIfTerminal(runId: string) {
    const status = this.#hooks.getRunSnapshot(runId).run.status;
    if (!isTerminalStatus(status)) {
      return;
    }

    this.#scheduleWorkspaceCleanup(runId);
  }

  #scheduleWorkspaceCleanup(runId: string) {
    if (this.#runtimeDispatchMode === "bullmq") {
      if (!this.#runCleanupQueue) {
        console.error(
          `[lingban-runtime-orchestrator] cleanup queue is unavailable, skipping delayed cleanup for ${runId}`
        );
        return;
      }

      void enqueueRunCleanupJob(
        this.#runCleanupQueue,
        { runId },
        { delayMs: this.#terminalWorkspaceTtlMs }
      ).catch((error) => {
        console.error(
          `[lingban-runtime-orchestrator] failed to enqueue cleanup job for ${runId}: ${toErrorMessage(error)}`
        );
      });
      return;
    }

    this.#clearWorkspaceCleanup(runId);
    const timer = setTimeout(() => {
      this.#cleanupTimers.delete(runId);
      void Promise.resolve(this.#runWorker.cleanupRunWorkspace({ runId })).catch((error) => {
        console.error(
          `[lingban-runtime-orchestrator] failed to cleanup workspace for ${runId}: ${toErrorMessage(error)}`
        );
      });
    }, this.#terminalWorkspaceTtlMs);
    timer.unref?.();

    this.#cleanupTimers.set(runId, timer);
  }

  #clearWorkspaceCleanup(runId: string) {
    if (this.#runtimeDispatchMode === "bullmq") {
      void Promise.resolve(this.#runCleanupQueue?.getJob(runId))
        .then((job) => job?.remove())
        .catch((error) => {
          console.error(
            `[lingban-runtime-orchestrator] failed to clear queued cleanup job for ${runId}: ${toErrorMessage(error)}`
          );
        });
      return;
    }

    const timer = this.#cleanupTimers.get(runId);
    if (timer) {
      clearTimeout(timer);
      this.#cleanupTimers.delete(runId);
    }
  }

  #scheduleOrphanRecoveryFailure(runId: string) {
    this.#clearOrphanRecovery(runId);
    const timer = setTimeout(() => {
      this.#orphanRecoveryTimers.delete(runId);
      const registration = bridgeRegistry.get(runId);
      if (registration?.controllerAttached) {
        return;
      }

      void Promise.resolve(
        this.#hooks.ingestBridgeEvents(runId, [
          {
            type: "run.failed",
            runId,
            occurredAt: new Date().toISOString(),
            error:
              "runtime session became orphaned during API restart; bridge re-registration did not arrive before grace timeout",
          },
        ])
      )
        .catch((error) => {
          console.error(
            `[lingban-runtime-orchestrator] failed to mark orphaned run ${runId} as failed: ${toErrorMessage(error)}`
          );
        })
        .finally(() => {
          this.#scheduleWorkspaceCleanup(runId);
        });
    }, this.#orphanRecoveryGraceMs);
    timer.unref?.();
    this.#orphanRecoveryTimers.set(runId, timer);
  }

  #clearOrphanRecovery(runId: string) {
    const timer = this.#orphanRecoveryTimers.get(runId);
    if (timer) {
      clearTimeout(timer);
      this.#orphanRecoveryTimers.delete(runId);
    }
  }

  #resolveInternalApiBaseUrl() {
    const config = getApiRuntimeConfig();
    const host =
      config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host;
    return `http://${host}:${config.port}`;
  }

  #resolveCodexLaunchOptions() {
    const config = getApiRuntimeConfig();

    if (!config.codexBin && !config.bridgeArgs) {
      return undefined;
    }

    return {
      command: config.codexBin,
      args: config.bridgeArgs,
    };
  }
}
