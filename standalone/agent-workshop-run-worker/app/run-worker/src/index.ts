import { startRunJob } from "./jobs/start-run.js";
import {
  buildContainerBridgeSessionContext,
  buildHostBridgeSessionContext,
} from "./services/run-lifecycle.js";
import { startManagedBridgeRuntime } from "./services/bridge-runner.js";
import { buildContainerLaunchPlan, materializeRunRuntime } from "./services/container-runtime.js";
import { cleanupRunWorkspace, prepareRunWorkspace } from "./services/workspace-preparer.js";
import { processSessionCapture } from "./services/session-capture/capture-orchestrator.js";
export { BullmqRunWorkerDaemon } from "./daemon.js";
export { WorkerOpsHttpServer } from "./ops-http.js";
export { processSessionCapture, type ProcessSessionCaptureInput } from "./services/session-capture/capture-orchestrator.js";
export {
  buildRunWorkerMetricsText,
  redactRedisUrl,
  type WorkerDaemonDiagnostics,
  type WorkerReadinessReport,
  type WorkerRecoverySummary,
  type WorkerQueueEventDiagnostics,
  type WorkerQueueObservedEvent,
  type WorkerQueueTelemetryName,
  type WorkerOpsServerDiagnostics,
} from "./observability.js";
export { BullmqQueueEventTelemetry, bullmqObservedQueueEvents } from "./queue-event-telemetry.js";
export {
  RUN_CLEANUP_DLQ_JOB_NAME,
  RUN_CLEANUP_JOB_NAME,
  RUN_START_DLQ_JOB_NAME,
  RUN_START_JOB_NAME,
  createBullmqConnection,
  createRunCleanupQueue,
  createRunCleanupDeadLetterQueue,
  createRunCleanupQueueEvents,
  createRunCleanupWorker,
  createRunStartQueue,
  createRunStartDeadLetterQueue,
  createRunStartQueueEvents,
  createRunStartWorker,
  enqueueRunCleanupJob,
  enqueueRunStartJob,
  type RunCleanupDeadLetterQueueLike,
  type RunCleanupDeadLetterRecord,
  type RunCleanupQueueLike,
  type RunQueueEventsLike,
  type RunQueueDeadLetterRecord,
  type RunStartDeadLetterQueueLike,
  type RunStartDeadLetterRecord,
  type RunStartQueueLike,
} from "./queue.js";

export function buildRunWorker() {
  return {
    name: "run-worker",
    startRunJob,
    buildHostBridgeSessionContext,
    buildContainerBridgeSessionContext,
    prepareRunWorkspace,
    cleanupRunWorkspace,
    buildContainerLaunchPlan,
    materializeRunRuntime,
    startManagedBridgeRuntime,
    processSessionCapture,
  };
}
