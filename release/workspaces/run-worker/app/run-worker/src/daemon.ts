import { pathToFileURL } from "node:url";
import { loadWorkerRuntimeConfig, type WorkerRuntimeConfig } from "@lingban/config";
import { ApiConnector } from "@lingban/container-bridge";
import type { Queue, Worker } from "bullmq";
import { nowIso, toErrorMessage } from "@lingban/shared";
import type {
  CleanupRunJobPayload,
  RunRuntimeRecoveryCandidate,
  RunSnapshot,
  RunStatus,
  StartRunJobPayload,
} from "@lingban/contracts";
import { startRunJob } from "./jobs/start-run.js";
import {
  createRunCleanupQueue,
  createRunCleanupDeadLetterQueue,
  createRunCleanupQueueEvents,
  createRunCleanupWorker,
  createRunStartQueue,
  createRunStartDeadLetterQueue,
  createRunStartQueueEvents,
  createRunStartWorker,
  enqueueRunStartJob,
  enqueueRunCleanupJob,
  RUN_CLEANUP_DLQ_JOB_NAME,
  RUN_CLEANUP_JOB_NAME,
  RUN_START_DLQ_JOB_NAME,
  RUN_START_JOB_NAME,
  type RunCleanupDeadLetterQueueLike,
  type RunCleanupQueueLike,
  type RunQueueEventsLike,
  type RunStartQueueLike,
  type RunStartDeadLetterQueueLike,
} from "./queue.js";
import {
  startManagedBridgeRuntime,
  probeDockerDaemon,
  type ManagedBridgeRuntimeHandle,
} from "./services/bridge-runner.js";
import { cleanupRunWorkspace } from "./services/workspace-preparer.js";
import {
  buildRunWorkerMetricsText,
  redactRedisUrl,
  type WorkerDaemonDiagnostics,
  type WorkerReadinessReport,
  type WorkerRecoverySummary,
  type WorkerRuntimeBackendDiagnostics,
} from "./observability.js";
import { WorkerOpsHttpServer } from "./ops-http.js";
import { BullmqQueueEventTelemetry } from "./queue-event-telemetry.js";
import { processSessionCapture } from "./services/session-capture/capture-orchestrator.js";

function formatExitReason(
  handle: ManagedBridgeRuntimeHandle,
  result: Awaited<ManagedBridgeRuntimeHandle["completion"]>
) {
  return `bridge runtime exited unexpectedly (mode=${handle.launchMode}, exit=${result.exitCode ?? "null"}, signal=${result.signal ?? "null"})`;
}

const TERMINAL_STATUSES = new Set<RunStatus>(["SUCCEEDED", "FAILED", "CANCELLED"]);
const RUNTIME_BACKEND_PROBE_TTL_MS = 5_000;

function isTerminalStatus(status: RunStatus) {
  return TERMINAL_STATUSES.has(status);
}

function createDefaultRuntimeBackendDiagnostics(
  launchMode: WorkerRuntimeConfig["runtimeLaunchMode"]
): WorkerRuntimeBackendDiagnostics {
  if (launchMode === "local-process") {
    return {
      backend: "local-process",
      ready: true,
      checkedAt: null,
      detail: "local-process launch mode does not require Docker daemon",
      serverVersion: null,
      apiVersion: null,
      os: null,
      experimental: null,
    };
  }

  return {
    backend: "docker",
    ready: false,
    checkedAt: null,
    detail: "docker daemon has not been probed yet",
    serverVersion: null,
    apiVersion: null,
    os: null,
    experimental: null,
  };
}

export type ProcessBullmqRunStartPayloadDependencies = {
  config: WorkerRuntimeConfig;
  apiConnector: ApiConnector;
  startRunJobImpl?: typeof startRunJob;
  startManagedBridgeRuntimeImpl?: typeof startManagedBridgeRuntime;
  cleanupRunWorkspaceImpl?: typeof cleanupRunWorkspace;
  scheduleWorkspaceCleanup?: (runId: string) => void;
  onActiveHandle?: (
    runId: string,
    handle: ManagedBridgeRuntimeHandle,
    job: Awaited<ReturnType<typeof startRunJob>>
  ) => void;
  onRuntimeStopped?: (runId: string) => void;
};

export type ProcessBullmqRunCleanupPayloadDependencies = {
  cleanupRunWorkspaceImpl?: typeof cleanupRunWorkspace;
  apiConnector?: Pick<ApiConnector, "getSessionCaptureCleanupGate">;
};

type FailedRunStartJobLike = {
  id?: string | number | null;
  attemptsMade?: number;
  opts?: { attempts?: number };
  data?: StartRunJobPayload;
};

type FailedRunCleanupJobLike = {
  id?: string | number | null;
  attemptsMade?: number;
  opts?: { attempts?: number };
  data?: CleanupRunJobPayload;
};

type HandleRunStartJobFailureDependencies = {
  config: WorkerRuntimeConfig;
  apiConnector: Pick<ApiConnector, "postTerminalFailure" | "syncRunRuntime">;
  dlqQueue?: RunStartDeadLetterQueueLike | null;
  scheduleWorkspaceCleanup?: (runId: string) => void;
  now?: () => string;
};

type HandleRunCleanupJobFailureDependencies = {
  config: WorkerRuntimeConfig;
  dlqQueue?: RunCleanupDeadLetterQueueLike | null;
  now?: () => string;
};

type RecoveryAwareApiConnector = Pick<
  ApiConnector,
  | "getRunSnapshot"
  | "getRunRecoveryCandidate"
  | "listRunRecoveryCandidates"
  | "ingestEvents"
  | "syncRunRuntime"
  | "postTerminalFailure"
>;

type RecoverBullmqRunWorkerStateDependencies = {
  config: WorkerRuntimeConfig;
  apiConnector: RecoveryAwareApiConnector;
  startQueue: RunStartQueueLike;
  cleanupQueue: RunCleanupQueueLike;
  scheduleWorkspaceCleanup?: (runId: string) => void;
  now?: () => string;
};

type RecoveryActionSummary = {
  candidates: number;
  enqueuedStarts: number;
  orphanFailures: number;
  scheduledCleanups: number;
  skipped: number;
};

type QueueReadinessTarget = {
  waitUntilReady(): Promise<unknown>;
};

type WorkerComponentState = {
  startQueue: boolean;
  cleanupQueue: boolean;
  startWorker: boolean;
  cleanupWorker: boolean;
  startDlqQueue: boolean;
  cleanupDlqQueue: boolean;
  startQueueEvents: boolean;
  cleanupQueueEvents: boolean;
};

function createWorkerComponentState(): WorkerComponentState {
  return {
    startQueue: false,
    cleanupQueue: false,
    startWorker: false,
    cleanupWorker: false,
    startDlqQueue: false,
    cleanupDlqQueue: false,
    startQueueEvents: false,
    cleanupQueueEvents: false,
  };
}

function createWorkerMetrics(): WorkerDaemonDiagnostics["metrics"] {
  return {
    startJobsProcessedTotal: 0,
    startJobsSucceededTotal: 0,
    startJobsFailedTotal: 0,
    cleanupJobsProcessedTotal: 0,
    cleanupJobsSucceededTotal: 0,
    cleanupJobsFailedTotal: 0,
    startDlqWritesTotal: 0,
    cleanupDlqWritesTotal: 0,
    recoveryRunsTotal: 0,
    recoveryFailuresTotal: 0,
    recoveryCandidatesTotal: 0,
    recoveryEnqueuedStartsTotal: 0,
    recoveryOrphanFailuresTotal: 0,
    recoveryScheduledCleanupsTotal: 0,
    recoverySkippedTotal: 0,
    runtimeHandlesStartedTotal: 0,
    runtimeHandlesStoppedTotal: 0,
    workspaceCleanupScheduledTotal: 0,
    workspaceCleanupEnqueueFailuresTotal: 0,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} probe timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function probeQueueReadiness(
  component: string,
  target: QueueReadinessTarget | null,
  timeoutMs: number
) {
  if (!target) {
    return {
      component,
      ready: false,
      detail: "not initialized",
    } satisfies WorkerReadinessReport["components"][number];
  }

  try {
    await withTimeout(target.waitUntilReady(), timeoutMs, component);
    return {
      component,
      ready: true,
      detail: "ready",
    } satisfies WorkerReadinessReport["components"][number];
  } catch (error) {
    return {
      component,
      ready: false,
      detail: toErrorMessage(error),
    } satisfies WorkerReadinessReport["components"][number];
  }
}

function resolveConfiguredAttempts(
  job: { attemptsMade?: number; opts?: { attempts?: number } } | undefined,
  fallbackAttempts: number
) {
  return Math.max(1, job?.opts?.attempts ?? fallbackAttempts);
}

function hasRetryAttemptsExhausted(
  job: { attemptsMade?: number; opts?: { attempts?: number } } | undefined,
  fallbackAttempts: number
) {
  return (job?.attemptsMade ?? 0) >= resolveConfiguredAttempts(job, fallbackAttempts);
}

function buildDeadLetterJobId(prefix: string, runId: string, attemptsMade: number, at: string) {
  const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return [prefix, runId, String(attemptsMade), at]
    .map(sanitize)
    .join("-");
}

function resolveRecoveryFailureReason(
  candidate: Pick<RunRuntimeRecoveryCandidate, "reason" | "snapshot">
) {
  return (
    candidate.reason ??
    `run-worker restart recovery marked ${candidate.snapshot.run.runId} as failed because runtime state ${candidate.snapshot.run.status} had no active bridge registration`
  );
}

async function postRecoveryTerminalFailure(
  candidate: Pick<RunRuntimeRecoveryCandidate, "snapshot" | "reason">,
  dependencies: Pick<
    RecoverBullmqRunWorkerStateDependencies,
    "apiConnector" | "scheduleWorkspaceCleanup" | "now"
  >
) {
  const failedAt = dependencies.now?.() ?? nowIso();
  const reason = resolveRecoveryFailureReason(candidate);
  const runId = candidate.snapshot.run.runId;

  await dependencies.apiConnector
    .syncRunRuntime(runId, {
      finishedAt: failedAt,
      exitCode: null,
      exitSignal: null,
    })
    .catch((runtimeError) => {
      console.error(
        `[lingban-run-worker] failed to sync recovery failure metadata for ${runId}: ${toErrorMessage(runtimeError)}`
      );
    });

  await dependencies.apiConnector.postTerminalFailure(runId, reason).catch((apiError) => {
    console.error(
      `[lingban-run-worker] failed to post recovery terminal failure for ${runId}: ${toErrorMessage(apiError)}`
    );
  });

  dependencies.scheduleWorkspaceCleanup?.(runId);
}

function resolveRecoveryCleanupDelayMs(
  candidate: Pick<RunRuntimeRecoveryCandidate, "snapshot">,
  config: WorkerRuntimeConfig,
  now: string
) {
  if (config.terminalWorkspaceTtlMs <= 0) {
    return 0;
  }

  const anchor = candidate.snapshot.runtime?.finishedAt ?? candidate.snapshot.run.updatedAt ?? null;
  if (!anchor) {
    return config.terminalWorkspaceTtlMs;
  }

  const anchorMs = Date.parse(anchor);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(anchorMs) || !Number.isFinite(nowMs)) {
    return config.terminalWorkspaceTtlMs;
  }

  return Math.max(0, config.terminalWorkspaceTtlMs - (nowMs - anchorMs));
}

export function buildRunStartDeadLetterRecord(
  job: FailedRunStartJobLike | undefined,
  error: unknown,
  config: WorkerRuntimeConfig,
  now: () => string = nowIso
) {
  const runId = job?.data?.run?.runId ?? String(job?.id ?? "unknown");
  const failedAt = now();
  const attemptsMade = Math.max(0, job?.attemptsMade ?? 0);
  const maxAttempts = resolveConfiguredAttempts(job, config.runStartJobAttempts);

  return {
    jobId: job?.id == null ? null : String(job.id),
    runId,
    queueName: config.runStartQueueName,
    jobName: RUN_START_JOB_NAME,
    attemptsMade,
    maxAttempts,
    failedAt,
    error: toErrorMessage(error),
    payload: job?.data ?? null,
  };
}

export function buildRunCleanupDeadLetterRecord(
  job: FailedRunCleanupJobLike | undefined,
  error: unknown,
  config: WorkerRuntimeConfig,
  now: () => string = nowIso
) {
  const runId = job?.data?.runId ?? String(job?.id ?? "unknown");
  const failedAt = now();
  const attemptsMade = Math.max(0, job?.attemptsMade ?? 0);
  const maxAttempts = resolveConfiguredAttempts(job, config.runCleanupJobAttempts);

  return {
    jobId: job?.id == null ? null : String(job.id),
    runId,
    queueName: config.runCleanupQueueName,
    jobName: RUN_CLEANUP_JOB_NAME,
    attemptsMade,
    maxAttempts,
    failedAt,
    error: toErrorMessage(error),
    payload: job?.data ?? null,
  };
}

export async function handleRunStartJobFailure(
  job: FailedRunStartJobLike | undefined,
  error: unknown,
  dependencies: HandleRunStartJobFailureDependencies
) {
  const record = buildRunStartDeadLetterRecord(job, error, dependencies.config, dependencies.now);
  if (!hasRetryAttemptsExhausted(job, dependencies.config.runStartJobAttempts)) {
    return {
      exhausted: false,
      record,
    };
  }

  const terminalReason =
    `bullmq ${record.jobName} exhausted after ${record.attemptsMade}/${record.maxAttempts} attempts: ` +
    record.error;

  await Promise.resolve(
    dependencies.dlqQueue?.add(RUN_START_DLQ_JOB_NAME, record, {
      jobId: buildDeadLetterJobId("run.start.dlq", record.runId, record.attemptsMade, record.failedAt),
    })
  ).catch((dlqError: unknown) => {
      console.error(
        `[lingban-run-worker] failed to enqueue run.start DLQ record for ${record.runId}: ${toErrorMessage(dlqError)}`
      );
    });

  await dependencies.apiConnector
    .syncRunRuntime(record.runId, {
      finishedAt: record.failedAt,
      exitCode: null,
      exitSignal: null,
    })
    .catch((runtimeError) => {
      console.error(
        `[lingban-run-worker] failed to sync runtime failure metadata for ${record.runId}: ${toErrorMessage(runtimeError)}`
      );
    });

  await dependencies.apiConnector.postTerminalFailure(record.runId, terminalReason).catch((apiError) => {
    console.error(
      `[lingban-run-worker] failed to post terminal failure for ${record.runId}: ${toErrorMessage(apiError)}`
    );
  });

  dependencies.scheduleWorkspaceCleanup?.(record.runId);

  return {
    exhausted: true,
    record,
  };
}

export async function handleRunCleanupJobFailure(
  job: FailedRunCleanupJobLike | undefined,
  error: unknown,
  dependencies: HandleRunCleanupJobFailureDependencies
) {
  const record = buildRunCleanupDeadLetterRecord(job, error, dependencies.config, dependencies.now);
  if (!hasRetryAttemptsExhausted(job, dependencies.config.runCleanupJobAttempts)) {
    return {
      exhausted: false,
      record,
    };
  }

  await Promise.resolve(
    dependencies.dlqQueue?.add(RUN_CLEANUP_DLQ_JOB_NAME, record, {
      jobId: buildDeadLetterJobId(
        "run.cleanup.dlq",
        record.runId,
        record.attemptsMade,
        record.failedAt
      ),
    })
  ).catch((dlqError: unknown) => {
      console.error(
        `[lingban-run-worker] failed to enqueue run.cleanup DLQ record for ${record.runId}: ${toErrorMessage(dlqError)}`
      );
    });

  return {
    exhausted: true,
    record,
  };
}

export async function recoverBullmqRunWorkerState(
  dependencies: RecoverBullmqRunWorkerStateDependencies
): Promise<RecoveryActionSummary> {
  const recovery = await dependencies.apiConnector.listRunRecoveryCandidates();
  const summary: RecoveryActionSummary = {
    candidates: recovery.candidates.length,
    enqueuedStarts: 0,
    orphanFailures: 0,
    scheduledCleanups: 0,
    skipped: 0,
  };

  for (const candidate of recovery.candidates) {
    switch (candidate.action) {
      case "enqueue-start":
        if (!candidate.startJob) {
          console.error(
            `[lingban-run-worker] recovery candidate ${candidate.snapshot.run.runId} is missing start job payload`
          );
          summary.skipped += 1;
          break;
        }

        await enqueueRunStartJob(dependencies.startQueue, candidate.startJob);
        summary.enqueuedStarts += 1;
        break;
      case "mark-orphan-failed":
        await postRecoveryTerminalFailure(candidate, dependencies);
        summary.orphanFailures += 1;
        break;
      case "schedule-cleanup": {
        const delayMs = resolveRecoveryCleanupDelayMs(
          candidate,
          dependencies.config,
          dependencies.now?.() ?? nowIso()
        );
        await enqueueRunCleanupJob(
          dependencies.cleanupQueue,
          {
            runId: candidate.snapshot.run.runId,
          },
          {
            delayMs,
          }
        );
        summary.scheduledCleanups += 1;
        break;
      }
      default:
        summary.skipped += 1;
        break;
    }
  }

  return summary;
}

export async function processBullmqRunStartPayload(
  payload: StartRunJobPayload,
  dependencies: ProcessBullmqRunStartPayloadDependencies
) {
  const startRunJobImpl = dependencies.startRunJobImpl ?? startRunJob;
  const startManagedBridgeRuntimeImpl =
    dependencies.startManagedBridgeRuntimeImpl ?? startManagedBridgeRuntime;
  const cleanupRunWorkspaceImpl =
    dependencies.cleanupRunWorkspaceImpl ?? cleanupRunWorkspace;

  const getRunSnapshotSafely = async (runId: string): Promise<RunSnapshot | null> => {
    try {
      return await dependencies.apiConnector.getRunSnapshot(runId);
    } catch {
      return null;
    }
  };

  const scheduleWorkspaceCleanup =
    dependencies.scheduleWorkspaceCleanup ??
    ((runId: string) => {
      const timer = setTimeout(() => {
        void cleanupRunWorkspaceImpl({ runId }).catch((error) => {
          console.error(
            `[lingban-run-worker] failed to cleanup workspace for ${runId}: ${toErrorMessage(error)}`
          );
        });
      }, dependencies.config.terminalWorkspaceTtlMs);

      timer.unref?.();
    });

  const getRecoveryCandidateSafely = async (runId: string) => {
    try {
      return await dependencies.apiConnector.getRunRecoveryCandidate(runId);
    } catch {
      return null;
    }
  };

  const initialRecoveryCandidate = await getRecoveryCandidateSafely(payload.run.runId);
  const initialSnapshot =
    initialRecoveryCandidate?.snapshot ??
    (await dependencies.apiConnector.getRunSnapshot(payload.run.runId));

  if (
    initialRecoveryCandidate?.action === "schedule-cleanup" ||
    isTerminalStatus(initialSnapshot.run.status)
  ) {
    scheduleWorkspaceCleanup(payload.run.runId);
    return;
  }

  if (initialRecoveryCandidate?.action === "await-bridge") {
    return;
  }

  if (initialRecoveryCandidate?.action === "mark-orphan-failed") {
    await postRecoveryTerminalFailure(initialRecoveryCandidate, {
      apiConnector: dependencies.apiConnector,
      scheduleWorkspaceCleanup,
    });
    return;
  }

  const accepted = await startRunJobImpl(payload);
  const runId = accepted.payload.run.runId;

  await dependencies.apiConnector.ingestEvents(runId, accepted.events);

  const afterPreflightSnapshot = await dependencies.apiConnector.getRunSnapshot(runId);
  if (isTerminalStatus(afterPreflightSnapshot.run.status)) {
    scheduleWorkspaceCleanup(runId);
    return;
  }

  const beforeLaunchRecoveryCandidate = await getRecoveryCandidateSafely(runId);
  if (beforeLaunchRecoveryCandidate?.action === "await-bridge") {
    return;
  }

  if (beforeLaunchRecoveryCandidate?.action === "mark-orphan-failed") {
    await postRecoveryTerminalFailure(beforeLaunchRecoveryCandidate, {
      apiConnector: dependencies.apiConnector,
      scheduleWorkspaceCleanup,
    });
    return;
  }

  if (beforeLaunchRecoveryCandidate?.action === "schedule-cleanup") {
    scheduleWorkspaceCleanup(runId);
    return;
  }

  let handle: ManagedBridgeRuntimeHandle | null = null;
  let completionResult: Awaited<ManagedBridgeRuntimeHandle["completion"]> | null = null;

  try {
    handle = await startManagedBridgeRuntimeImpl({
      job: accepted,
      apiBaseUrl: dependencies.config.apiBaseUrl,
      authToken: dependencies.config.internalAuthToken,
    });
    dependencies.onActiveHandle?.(runId, handle, accepted);
    await dependencies.apiConnector.syncRunRuntime(runId, {
      launchMode: handle.launchMode,
      containerName:
        handle.launchMode === "docker" ? accepted.containerLaunchPlan.containerName : null,
      startedAt: nowIso(),
      exitCode: null,
      exitSignal: null,
      finishedAt: null,
    });

    await handle.waitUntilReady();
    await dependencies.apiConnector.syncRunRuntime(runId, {
      readyAt: nowIso(),
    });
    const afterReadySnapshot = await dependencies.apiConnector.getRunSnapshot(runId);
    if (isTerminalStatus(afterReadySnapshot.run.status)) {
      return;
    }

    const result = await handle.completion;
    completionResult = result;

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

    const finalSnapshot = await getRunSnapshotSafely(runId);
    if (
      !finalSnapshot ||
      (!isTerminalStatus(finalSnapshot.run.status) && ((result.exitCode ?? 1) !== 0 || result.signal))
    ) {
      await dependencies.apiConnector.postTerminalFailure(runId, formatExitReason(handle, result));
    }
  } catch (error) {
    const snapshot = await getRunSnapshotSafely(runId);
    if (!snapshot || !isTerminalStatus(snapshot.run.status)) {
      await dependencies.apiConnector
        .postTerminalFailure(runId, `bridge launch failed: ${toErrorMessage(error)}`)
        .catch(() => undefined);
    }
    throw error;
  } finally {
    dependencies.onRuntimeStopped?.(runId);
    if (handle) {
      await handle.stop().catch(() => undefined);
      completionResult = completionResult ?? (await handle.completion.catch(() => null));
      await dependencies.apiConnector
        .syncRunRuntime(runId, {
          finishedAt: nowIso(),
          exitCode: completionResult?.exitCode ?? null,
          exitSignal: completionResult?.signal ?? null,
        })
        .catch(() => undefined);
    }
    scheduleWorkspaceCleanup(runId);
  }
}

export async function processBullmqRunCleanupPayload(
  payload: CleanupRunJobPayload,
  dependencies: ProcessBullmqRunCleanupPayloadDependencies = {}
) {
  if (dependencies.apiConnector) {
    const gate = await dependencies.apiConnector.getSessionCaptureCleanupGate(payload.runId);
    if (!gate.allowed) {
      throw new Error(
        `RUN_CLEANUP_CAPTURE_PENDING:${payload.runId}:${gate.blockingCaptureIds.join(",")}`
      );
    }
  }
  const cleanupRunWorkspaceImpl =
    dependencies.cleanupRunWorkspaceImpl ?? cleanupRunWorkspace;
  await cleanupRunWorkspaceImpl({ runId: payload.runId });
}

export class BullmqRunWorkerDaemon {
  #config: WorkerRuntimeConfig;
  #apiConnector: ApiConnector;
  #runtimeBackend: WorkerRuntimeBackendDiagnostics;
  #runtimeBackendProbeAt = 0;
  #runtimeBackendProbePromise: Promise<WorkerRuntimeBackendDiagnostics> | null = null;
  #startQueue: ReturnType<typeof createRunStartQueue> | null = null;
  #startWorker: ReturnType<typeof createRunStartWorker> | null = null;
  #cleanupWorker: ReturnType<typeof createRunCleanupWorker> | null = null;
  #cleanupQueue: ReturnType<typeof createRunCleanupQueue> | null = null;
  #startDlqQueue: ReturnType<typeof createRunStartDeadLetterQueue> | null = null;
  #cleanupDlqQueue: ReturnType<typeof createRunCleanupDeadLetterQueue> | null = null;
  #startQueueEvents: RunQueueEventsLike | null = null;
  #cleanupQueueEvents: RunQueueEventsLike | null = null;
  #active = new Map<string, ManagedBridgeRuntimeHandle>();
  #activeJobs = new Map<string, Awaited<ReturnType<typeof startRunJob>>>();
  #queueTelemetry = new BullmqQueueEventTelemetry();
  #started = false;
  #stopping = false;
  #startedAt: string | null = null;
  #stoppedAt: string | null = null;
  #lastRecoveryStartedAt: string | null = null;
  #lastRecoveryFinishedAt: string | null = null;
  #lastRecoveryErrorAt: string | null = null;
  #lastRecoveryErrorMessage: string | null = null;
  #lastRecoverySummary: WorkerRecoverySummary | null = null;
  #lastStartJobRunId: string | null = null;
  #lastStartJobStartedAt: string | null = null;
  #lastStartJobFinishedAt: string | null = null;
  #lastStartJobFailureAt: string | null = null;
  #lastStartJobFailureMessage: string | null = null;
  #lastCleanupJobRunId: string | null = null;
  #lastCleanupJobStartedAt: string | null = null;
  #lastCleanupJobFinishedAt: string | null = null;
  #lastCleanupJobFailureAt: string | null = null;
  #lastCleanupJobFailureMessage: string | null = null;
  #lastErrorAt: string | null = null;
  #lastErrorMessage: string | null = null;
  #componentState = createWorkerComponentState();
  #metrics = createWorkerMetrics();

  constructor(config: WorkerRuntimeConfig = loadWorkerRuntimeConfig()) {
    if (config.runtimeDispatchMode !== "bullmq") {
      throw new Error("BullmqRunWorkerDaemon requires LINGBAN_RUNTIME_DISPATCH_MODE=bullmq");
    }

    if (!config.redisUrl) {
      throw new Error("BullmqRunWorkerDaemon requires LINGBAN_REDIS_URL");
    }

    this.#config = config;
    this.#apiConnector = new ApiConnector({
      baseUrl: config.apiBaseUrl,
      authToken: config.internalAuthToken,
    });
    this.#runtimeBackend = createDefaultRuntimeBackendDiagnostics(config.runtimeLaunchMode);
  }

  async start() {
    if (this.#startWorker || this.#cleanupWorker) {
      return;
    }

    this.#stopping = false;
    this.#stoppedAt = null;
    this.#started = true;
    this.#startedAt = nowIso();

    this.#startQueue = createRunStartQueue(this.#config);
    this.#componentState.startQueue = true;
    this.#cleanupQueue = createRunCleanupQueue(this.#config);
    this.#componentState.cleanupQueue = true;
    this.#startDlqQueue = createRunStartDeadLetterQueue(this.#config);
    this.#componentState.startDlqQueue = true;
    this.#cleanupDlqQueue = createRunCleanupDeadLetterQueue(this.#config);
    this.#componentState.cleanupDlqQueue = true;
    this.#startQueueEvents = createRunStartQueueEvents(this.#config);
    this.#componentState.startQueueEvents = true;
    this.#cleanupQueueEvents = createRunCleanupQueueEvents(this.#config);
    this.#componentState.cleanupQueueEvents = true;
    this.#queueTelemetry.attach("start", this.#startQueueEvents);
    this.#queueTelemetry.attach("cleanup", this.#cleanupQueueEvents);
    this.#attachQueueEventHandlers("start", this.#startQueueEvents);
    this.#attachQueueEventHandlers("cleanup", this.#cleanupQueueEvents);

    this.#startWorker = createRunStartWorker(
      async (job) => await this.#processStartJob(job.data),
      this.#config
    );
    this.#componentState.startWorker = true;
    this.#startWorker.on("failed", (job, error) => {
      const runId = job?.data?.run?.runId ?? job?.id ?? "unknown";
      console.error(
        `[lingban-run-worker] bullmq job failed for ${runId}: ${toErrorMessage(error)}`
      );
      this.#recordError(`run.start failed for ${runId}: ${toErrorMessage(error)}`);

      void handleRunStartJobFailure(job, error, {
        config: this.#config,
        apiConnector: this.#apiConnector,
        dlqQueue: this.#startDlqQueue,
        scheduleWorkspaceCleanup: (jobRunId) => this.#scheduleWorkspaceCleanup(jobRunId),
      })
        .then((result) => {
          if (result.exhausted) {
            this.#metrics.startDlqWritesTotal += 1;
          }
        })
        .catch((handlerError) => {
          this.#recordError(
            `run.start failure handler crashed for ${runId}: ${toErrorMessage(handlerError)}`
          );
        });
    });

    this.#cleanupWorker = createRunCleanupWorker(
      async (job) => await this.#processCleanupJob(job.data),
      this.#config
    );
    this.#componentState.cleanupWorker = true;
    this.#cleanupWorker.on("failed", (job, error) => {
      const runId = job?.data?.runId ?? job?.id ?? "unknown";
      console.error(
        `[lingban-run-worker] cleanup job failed for ${runId}: ${toErrorMessage(error)}`
      );
      this.#recordError(`run.cleanup failed for ${runId}: ${toErrorMessage(error)}`);

      void handleRunCleanupJobFailure(job, error, {
        config: this.#config,
        dlqQueue: this.#cleanupDlqQueue,
      })
        .then((result) => {
          if (result.exhausted) {
            this.#metrics.cleanupDlqWritesTotal += 1;
          }
        })
        .catch((handlerError) => {
          this.#recordError(
            `run.cleanup failure handler crashed for ${runId}: ${toErrorMessage(handlerError)}`
          );
        });
    });

    if (this.#startQueue) {
      this.#metrics.recoveryRunsTotal += 1;
      this.#lastRecoveryStartedAt = nowIso();
      await recoverBullmqRunWorkerState({
        config: this.#config,
        apiConnector: this.#apiConnector,
        startQueue: this.#startQueue,
        cleanupQueue: this.#cleanupQueue,
        scheduleWorkspaceCleanup: (runId) => this.#scheduleWorkspaceCleanup(runId),
      })
        .then((summary) => {
          this.#lastRecoverySummary = summary;
          this.#lastRecoveryFinishedAt = nowIso();
          this.#lastRecoveryErrorAt = null;
          this.#lastRecoveryErrorMessage = null;
          this.#metrics.recoveryCandidatesTotal += summary.candidates;
          this.#metrics.recoveryEnqueuedStartsTotal += summary.enqueuedStarts;
          this.#metrics.recoveryOrphanFailuresTotal += summary.orphanFailures;
          this.#metrics.recoveryScheduledCleanupsTotal += summary.scheduledCleanups;
          this.#metrics.recoverySkippedTotal += summary.skipped;
        })
        .catch((error) => {
          this.#metrics.recoveryFailuresTotal += 1;
          this.#lastRecoveryErrorAt = nowIso();
          this.#lastRecoveryErrorMessage = toErrorMessage(error);
          this.#recordError(
            `failed to recover bullmq runtime state on startup: ${toErrorMessage(error)}`
          );
          console.error(
            `[lingban-run-worker] failed to recover bullmq runtime state on startup: ${toErrorMessage(error)}`
          );
        });
    }
  }

  async stop() {
    this.#stopping = true;
    const startQueue = this.#startQueue;
    const startWorker = this.#startWorker;
    const cleanupWorker = this.#cleanupWorker;
    const cleanupQueue = this.#cleanupQueue;
    const startDlqQueue = this.#startDlqQueue;
    const cleanupDlqQueue = this.#cleanupDlqQueue;
    const startQueueEvents = this.#startQueueEvents;
    const cleanupQueueEvents = this.#cleanupQueueEvents;
    this.#startQueue = null;
    this.#startWorker = null;
    this.#cleanupWorker = null;
    this.#cleanupQueue = null;
    this.#startDlqQueue = null;
    this.#cleanupDlqQueue = null;
    this.#startQueueEvents = null;
    this.#cleanupQueueEvents = null;
    this.#componentState = createWorkerComponentState();

    if (startWorker) {
      await startWorker.close();
    }

    if (cleanupWorker) {
      await cleanupWorker.close();
    }

    await startQueue?.close().catch(() => undefined);
    await cleanupQueue?.close().catch(() => undefined);
    await startDlqQueue?.close().catch(() => undefined);
    await cleanupDlqQueue?.close().catch(() => undefined);
    await startQueueEvents?.close().catch(() => undefined);
    await cleanupQueueEvents?.close().catch(() => undefined);

    const activeHandles = [...this.#active.entries()];
    this.#active.clear();
    this.#activeJobs.clear();
    await Promise.all(
      activeHandles.map(async ([runId, handle]) => {
        try {
          await handle.stop();
          this.#metrics.runtimeHandlesStoppedTotal += 1;
        } catch (error) {
          console.error(
            `[lingban-run-worker] failed to stop active runtime ${runId}: ${toErrorMessage(error)}`
          );
          this.#recordError(
            `failed to stop active runtime ${runId}: ${toErrorMessage(error)}`
          );
        }
      })
    );

    this.#started = false;
    this.#stopping = false;
    this.#stoppedAt = nowIso();
  }

  async #processStartJob(payload: StartRunJobPayload) {
    this.#metrics.startJobsProcessedTotal += 1;
    this.#lastStartJobRunId = payload.run.runId;
    this.#lastStartJobStartedAt = nowIso();
    this.#lastStartJobFinishedAt = null;

    try {
      await processBullmqRunStartPayload(payload, {
        config: this.#config,
        apiConnector: this.#apiConnector,
        scheduleWorkspaceCleanup: (runId) => this.#scheduleWorkspaceCleanup(runId),
        onActiveHandle: (runId, handle, job) => {
          this.#active.set(runId, handle);
          this.#activeJobs.set(runId, job);
          this.#metrics.runtimeHandlesStartedTotal += 1;
        },
        onRuntimeStopped: (runId) => {
          if (this.#active.delete(runId)) {
            this.#metrics.runtimeHandlesStoppedTotal += 1;
          }
          this.#activeJobs.delete(runId);
        },
        cleanupRunWorkspaceImpl: cleanupRunWorkspace,
      });
      this.#metrics.startJobsSucceededTotal += 1;
      this.#lastStartJobFinishedAt = nowIso();
    } catch (error) {
      this.#metrics.startJobsFailedTotal += 1;
      this.#lastStartJobFinishedAt = nowIso();
      this.#lastStartJobFailureAt = this.#lastStartJobFinishedAt;
      this.#lastStartJobFailureMessage = toErrorMessage(error);
      this.#recordError(
        `run.start processor crashed for ${payload.run.runId}: ${toErrorMessage(error)}`
      );
      throw error;
    }
  }

  async #processCleanupJob(payload: CleanupRunJobPayload) {
    this.#metrics.cleanupJobsProcessedTotal += 1;
    this.#lastCleanupJobRunId = payload.runId;
    this.#lastCleanupJobStartedAt = nowIso();
    this.#lastCleanupJobFinishedAt = null;

    try {
      await processBullmqRunCleanupPayload(payload, {
        cleanupRunWorkspaceImpl: cleanupRunWorkspace,
        apiConnector: this.#apiConnector,
      });
      this.#metrics.cleanupJobsSucceededTotal += 1;
      this.#lastCleanupJobFinishedAt = nowIso();
    } catch (error) {
      this.#metrics.cleanupJobsFailedTotal += 1;
      this.#lastCleanupJobFinishedAt = nowIso();
      this.#lastCleanupJobFailureAt = this.#lastCleanupJobFinishedAt;
      this.#lastCleanupJobFailureMessage = toErrorMessage(error);
      this.#recordError(
        `run.cleanup processor crashed for ${payload.runId}: ${toErrorMessage(error)}`
      );
      throw error;
    }
  }

  async processSessionCapture(runId: string, captureId: string) {
    const handle = this.#active.get(runId);
    const job = this.#activeJobs.get(runId);
    if (!handle || !job) {
      throw new Error(`Active runtime is unavailable for capture ${captureId}`);
    }
    return processSessionCapture({
      runId,
      captureId,
      workerId: `bullmq-worker:${process.pid}`,
      targetPath: job.preparedWorkspace.hostPaths.targetPath,
      runtimePath: job.preparedWorkspace.hostPaths.runtimePath,
      handle,
      apiConnector: this.#apiConnector,
    });
  }

  async stopRun(runId: string) {
    const handle = this.#active.get(runId);
    if (!handle) return { stopped: false, reason: "runtime-not-active" };
    await handle.stop();
    return { stopped: true };
  }

  #scheduleWorkspaceCleanup(runId: string) {
    if (!this.#cleanupQueue) {
      console.error(
        `[lingban-run-worker] cleanup queue is unavailable, skipping delayed cleanup for ${runId}`
      );
      this.#recordError(`cleanup queue is unavailable for ${runId}`);
      return;
    }

    this.#metrics.workspaceCleanupScheduledTotal += 1;
    void enqueueRunCleanupJob(
      this.#cleanupQueue,
      { runId },
      { delayMs: this.#config.terminalWorkspaceTtlMs }
    ).catch((error) => {
      this.#metrics.workspaceCleanupEnqueueFailuresTotal += 1;
      this.#recordError(
        `failed to enqueue cleanup job for ${runId}: ${toErrorMessage(error)}`
      );
      console.error(
        `[lingban-run-worker] failed to enqueue cleanup job for ${runId}: ${toErrorMessage(error)}`
      );
    });
  }

  async #probeRuntimeBackend(): Promise<WorkerRuntimeBackendDiagnostics> {
    if (this.#config.runtimeLaunchMode !== "docker") {
      this.#runtimeBackend = {
        ...createDefaultRuntimeBackendDiagnostics("local-process"),
        checkedAt: nowIso(),
      };
      this.#runtimeBackendProbeAt = Date.now();
      return {
        ...this.#runtimeBackend,
      };
    }

    const now = Date.now();
    if (
      this.#runtimeBackend.checkedAt !== null &&
      now - this.#runtimeBackendProbeAt < RUNTIME_BACKEND_PROBE_TTL_MS
    ) {
      return {
        ...this.#runtimeBackend,
      };
    }

    if (this.#runtimeBackendProbePromise) {
      return await this.#runtimeBackendProbePromise;
    }

    this.#runtimeBackendProbePromise = (async () => {
      const probe = await probeDockerDaemon({
        dockerBin: this.#config.dockerBin,
        cwd: process.cwd(),
      });
      this.#runtimeBackend = {
        backend: probe.backend,
        ready: probe.ready,
        checkedAt: probe.checkedAt,
        detail: probe.detail,
        serverVersion: probe.serverVersion,
        apiVersion: probe.apiVersion,
        os: probe.os,
        experimental: probe.experimental,
      };
      this.#runtimeBackendProbeAt = Date.now();
      return {
        ...this.#runtimeBackend,
      };
    })();

    try {
      return await this.#runtimeBackendProbePromise;
    } finally {
      this.#runtimeBackendProbePromise = null;
    }
  }

  async getReadinessReport(): Promise<WorkerReadinessReport> {
    const runtimeBackend = await this.#probeRuntimeBackend();
    const queueComponents = await Promise.all([
      probeQueueReadiness("startQueue", this.#startQueue, this.#config.opsProbeTimeoutMs),
      probeQueueReadiness("cleanupQueue", this.#cleanupQueue, this.#config.opsProbeTimeoutMs),
      probeQueueReadiness("startWorker", this.#startWorker, this.#config.opsProbeTimeoutMs),
      probeQueueReadiness("cleanupWorker", this.#cleanupWorker, this.#config.opsProbeTimeoutMs),
      probeQueueReadiness("startDlqQueue", this.#startDlqQueue, this.#config.opsProbeTimeoutMs),
      probeQueueReadiness(
        "startQueueEvents",
        this.#startQueueEvents,
        this.#config.opsProbeTimeoutMs
      ),
      probeQueueReadiness(
        "cleanupDlqQueue",
        this.#cleanupDlqQueue,
        this.#config.opsProbeTimeoutMs
      ),
      probeQueueReadiness(
        "cleanupQueueEvents",
        this.#cleanupQueueEvents,
        this.#config.opsProbeTimeoutMs
      ),
    ]);
    const components = [
      {
        component: "runtimeBackend",
        ready: runtimeBackend.ready,
        detail: runtimeBackend.detail,
      },
      ...queueComponents,
    ];

    const ready =
      this.#started && !this.#stopping && components.every((component) => component.ready);

    return {
      status: ready ? "ready" : "not_ready",
      checkedAt: nowIso(),
      started: this.#started,
      stopping: this.#stopping,
      activeRunsCount: this.#active.size,
      components,
    };
  }

  async getDiagnostics(): Promise<WorkerDaemonDiagnostics> {
    const runtimeBackend = await this.#probeRuntimeBackend();
    const activeRuns = [...this.#active.entries()]
      .map(([runId, handle]) => {
        const diagnostics = handle.getDiagnostics();
        return {
          runId,
          launchMode: diagnostics.launchMode,
          controlUrl: diagnostics.controlUrl,
          egressProxy: diagnostics.egressProxy,
        };
      })
      .sort((left, right) => left.runId.localeCompare(right.runId));

    return {
      started: this.#started,
      startedAt: this.#startedAt,
      stopping: this.#stopping,
      stoppedAt: this.#stoppedAt,
      dispatchMode: this.#config.runtimeDispatchMode,
      launchMode: this.#config.runtimeLaunchMode,
      maxConcurrentRuns: this.#config.maxConcurrentRuns,
      redisConfigured: Boolean(this.#config.redisUrl),
      redisEndpoint: redactRedisUrl(this.#config.redisUrl),
      runsRoot: this.#config.runsRoot,
      queuePrefix: this.#config.queuePrefix,
      queueNames: {
        start: this.#config.runStartQueueName,
        cleanup: this.#config.runCleanupQueueName,
        startDlq: this.#config.runStartDlqQueueName,
        cleanupDlq: this.#config.runCleanupDlqQueueName,
      },
      ops: {
        host: this.#config.opsHost,
        port: this.#config.opsPort,
        authRequired: Boolean(this.#config.opsToken),
        probeTimeoutMs: this.#config.opsProbeTimeoutMs,
      },
      runtimeBackend,
      components: {
        ...this.#componentState,
      },
      queueEvents: this.#queueTelemetry.getDiagnostics(),
      activeRunsCount: this.#active.size,
      activeRunIds: [...this.#active.keys()].sort(),
      activeRuns,
      lastRecoveryStartedAt: this.#lastRecoveryStartedAt,
      lastRecoveryFinishedAt: this.#lastRecoveryFinishedAt,
      lastRecoveryErrorAt: this.#lastRecoveryErrorAt,
      lastRecoveryErrorMessage: this.#lastRecoveryErrorMessage,
      lastRecoverySummary: this.#lastRecoverySummary,
      lastStartJobRunId: this.#lastStartJobRunId,
      lastStartJobStartedAt: this.#lastStartJobStartedAt,
      lastStartJobFinishedAt: this.#lastStartJobFinishedAt,
      lastStartJobFailureAt: this.#lastStartJobFailureAt,
      lastStartJobFailureMessage: this.#lastStartJobFailureMessage,
      lastCleanupJobRunId: this.#lastCleanupJobRunId,
      lastCleanupJobStartedAt: this.#lastCleanupJobStartedAt,
      lastCleanupJobFinishedAt: this.#lastCleanupJobFinishedAt,
      lastCleanupJobFailureAt: this.#lastCleanupJobFailureAt,
      lastCleanupJobFailureMessage: this.#lastCleanupJobFailureMessage,
      lastErrorAt: this.#lastErrorAt,
      lastErrorMessage: this.#lastErrorMessage,
      metrics: {
        ...this.#metrics,
      },
    };
  }

  #recordError(message: string) {
    this.#lastErrorAt = nowIso();
    this.#lastErrorMessage = message;
  }

  #attachQueueEventHandlers(queueName: "start" | "cleanup", emitter: RunQueueEventsLike) {
    emitter.on("stalled", (...rawArgs: unknown[]) => {
      const args = (rawArgs[0] ?? {}) as { jobId?: string };
      const jobId = args.jobId ?? "unknown";
      const message = `[lingban-run-worker] ${queueName} queue detected stalled job ${jobId}`;
      console.error(message);
      this.#recordError(message);
    });

    emitter.on("failed", (...rawArgs: unknown[]) => {
      if (queueName === "start") {
        return;
      }

      const args = (rawArgs[0] ?? {}) as { jobId?: string; failedReason?: string };
      this.#recordError(
        `[lingban-run-worker] ${queueName} queue event failed for ${args.jobId ?? "unknown"}: ${args.failedReason ?? "unknown"}`
      );
    });

    emitter.on("error", (...rawArgs: unknown[]) => {
      const error = rawArgs[0];
      const message = `[lingban-run-worker] ${queueName} queue events error: ${toErrorMessage(error)}`;
      console.error(message);
      this.#recordError(message);
    });
  }
}

function isDirectExecution() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}

async function main() {
  const config = loadWorkerRuntimeConfig();
  const daemon = new BullmqRunWorkerDaemon(config);
  const opsServer = new WorkerOpsHttpServer({
    host: config.opsHost,
    port: config.opsPort,
    authToken: config.opsToken,
    getReadiness: async () => await daemon.getReadinessReport(),
    getDiagnostics: async () => await daemon.getDiagnostics(),
    getMetricsText: async () =>
      buildRunWorkerMetricsText(await daemon.getDiagnostics(), await daemon.getReadinessReport()),
    processCapture: async (runId, captureId) => await daemon.processSessionCapture(runId, captureId),
    stopRun: async (runId) => await daemon.stopRun(runId),
  });
  await daemon.start();
  await opsServer.start();

  const shutdown = async (signal: string, exitCode: number) => {
    console.log(`[lingban-run-worker] received ${signal}, shutting down`);
    await opsServer.stop().catch(() => undefined);
    await daemon.stop();
    process.exit(exitCode);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT", 130);
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM", 143);
  });

  await new Promise<void>(() => undefined);
}

if (isDirectExecution()) {
  void main().catch((error) => {
    console.error(`[lingban-run-worker] failed to start daemon: ${toErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
