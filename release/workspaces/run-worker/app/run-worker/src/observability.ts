export type WorkerQueueReadinessComponent = {
  component: string;
  ready: boolean;
  detail: string | null;
};

export type WorkerRuntimeBackendDiagnostics = {
  backend: "docker" | "local-process";
  ready: boolean;
  checkedAt: string | null;
  detail: string | null;
  serverVersion: string | null;
  apiVersion: string | null;
  os: string | null;
  experimental: boolean | null;
};

export type WorkerReadinessReport = {
  status: "ready" | "not_ready";
  checkedAt: string;
  started: boolean;
  stopping: boolean;
  activeRunsCount: number;
  components: WorkerQueueReadinessComponent[];
};

export type WorkerRecoverySummary = {
  candidates: number;
  enqueuedStarts: number;
  orphanFailures: number;
  scheduledCleanups: number;
  skipped: number;
};

export type WorkerQueueTelemetryName = "start" | "cleanup";

export type WorkerQueueObservedEvent =
  | "added"
  | "active"
  | "completed"
  | "failed"
  | "stalled"
  | "delayed"
  | "waiting"
  | "drained"
  | "error";

export type WorkerQueueEventDiagnostics = {
  queue: WorkerQueueTelemetryName;
  counts: Record<WorkerQueueObservedEvent, number>;
  lastEventName: WorkerQueueObservedEvent | null;
  lastEventAt: string | null;
  lastEventId: string | null;
  lastJobId: string | null;
  lastPrev: string | null;
  lastDelayMs: number | null;
  lastFailedReason: string | null;
  lastErrorMessage: string | null;
};

export type WorkerDaemonMetrics = {
  startJobsProcessedTotal: number;
  startJobsSucceededTotal: number;
  startJobsFailedTotal: number;
  cleanupJobsProcessedTotal: number;
  cleanupJobsSucceededTotal: number;
  cleanupJobsFailedTotal: number;
  startDlqWritesTotal: number;
  cleanupDlqWritesTotal: number;
  recoveryRunsTotal: number;
  recoveryFailuresTotal: number;
  recoveryCandidatesTotal: number;
  recoveryEnqueuedStartsTotal: number;
  recoveryOrphanFailuresTotal: number;
  recoveryScheduledCleanupsTotal: number;
  recoverySkippedTotal: number;
  runtimeHandlesStartedTotal: number;
  runtimeHandlesStoppedTotal: number;
  workspaceCleanupScheduledTotal: number;
  workspaceCleanupEnqueueFailuresTotal: number;
};

export type WorkerRuntimeEgressProxyDiagnostics = {
  started: boolean;
  startedAt: string | null;
  host: string;
  port: number;
  requestsTotal: number;
  connectRequestsTotal: number;
  blockedTotal: number;
  authFailuresTotal: number;
  failuresTotal: number;
  baselineUrlCount: number;
  activeMcpPolicyCount: number;
  lastRequestAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
};

export type WorkerActiveRunDiagnostics = {
  runId: string;
  launchMode: "local-process" | "docker";
  controlUrl: string;
  egressProxy: WorkerRuntimeEgressProxyDiagnostics | null;
};

export type WorkerDaemonDiagnostics = {
  started: boolean;
  startedAt: string | null;
  stopping: boolean;
  stoppedAt: string | null;
  dispatchMode: "embedded" | "bullmq";
  launchMode: "local-process" | "docker";
  maxConcurrentRuns: number;
  redisConfigured: boolean;
  redisEndpoint: string | null;
  runsRoot: string;
  queuePrefix: string;
  queueNames: {
    start: string;
    cleanup: string;
    startDlq: string;
    cleanupDlq: string;
  };
  ops: {
    host: string;
    port: number;
    authRequired: boolean;
    probeTimeoutMs: number;
  };
  runtimeBackend: WorkerRuntimeBackendDiagnostics;
  components: {
    startQueue: boolean;
    cleanupQueue: boolean;
    startWorker: boolean;
    cleanupWorker: boolean;
    startDlqQueue: boolean;
    cleanupDlqQueue: boolean;
    startQueueEvents: boolean;
    cleanupQueueEvents: boolean;
  };
  queueEvents: {
    start: WorkerQueueEventDiagnostics;
    cleanup: WorkerQueueEventDiagnostics;
  };
  activeRunsCount: number;
  activeRunIds: string[];
  activeRuns: WorkerActiveRunDiagnostics[];
  lastRecoveryStartedAt: string | null;
  lastRecoveryFinishedAt: string | null;
  lastRecoveryErrorAt: string | null;
  lastRecoveryErrorMessage: string | null;
  lastRecoverySummary: WorkerRecoverySummary | null;
  lastStartJobRunId: string | null;
  lastStartJobStartedAt: string | null;
  lastStartJobFinishedAt: string | null;
  lastStartJobFailureAt: string | null;
  lastStartJobFailureMessage: string | null;
  lastCleanupJobRunId: string | null;
  lastCleanupJobStartedAt: string | null;
  lastCleanupJobFinishedAt: string | null;
  lastCleanupJobFailureAt: string | null;
  lastCleanupJobFailureMessage: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  metrics: WorkerDaemonMetrics;
};

export type WorkerOpsRouteDiagnostics = {
  route: string;
  requestsTotal: number;
  clientErrorsTotal: number;
  serverErrorsTotal: number;
  unauthorizedTotal: number;
  lastRequestAt: string | null;
  lastStatusCode: number | null;
};

export type WorkerOpsServerDiagnostics = {
  started: boolean;
  startedAt: string | null;
  host: string;
  port: number;
  url: string;
  authRequired: boolean;
  inFlightRequests: number;
  requestsTotal: number;
  unauthorizedRequestsTotal: number;
  clientErrorsTotal: number;
  serverErrorsTotal: number;
  lastRequestAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  routes: WorkerOpsRouteDiagnostics[];
};

function escapeMetricHelp(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function escapeMetricLabelValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function pushMetric(
  lines: string[],
  name: string,
  type: "counter" | "gauge",
  help: string,
  value: number,
  labels?: Record<string, string>
) {
  if (!lines.some((line) => line === `# HELP ${name} ${escapeMetricHelp(help)}`)) {
    lines.push(`# HELP ${name} ${escapeMetricHelp(help)}`);
    lines.push(`# TYPE ${name} ${type}`);
  }

  const serializedLabels = labels
    ? `{${Object.entries(labels)
        .map(([key, labelValue]) => `${key}="${escapeMetricLabelValue(labelValue)}"`)
        .join(",")}}`
    : "";
  lines.push(`${name}${serializedLabels} ${value}`);
}

export function buildRunWorkerMetricsText(
  diagnostics: WorkerDaemonDiagnostics,
  readiness: WorkerReadinessReport
) {
  const lines: string[] = [];

  pushMetric(
    lines,
    "lingban_run_worker_up",
    "gauge",
    "Whether the run worker daemon has started and is not stopping.",
    diagnostics.started && !diagnostics.stopping ? 1 : 0
  );
  pushMetric(
    lines,
    "lingban_run_worker_ready",
    "gauge",
    "Whether the run worker daemon is ready to process jobs.",
    readiness.status === "ready" ? 1 : 0
  );
  pushMetric(
    lines,
    "lingban_run_worker_active_runs",
    "gauge",
    "Active managed runtime handles currently tracked by the worker.",
    diagnostics.activeRunsCount
  );
  pushMetric(
    lines,
    "lingban_run_worker_active_runtime_egress_proxies",
    "gauge",
    "Active runtime egress proxy instances currently tracked by the worker.",
    diagnostics.activeRuns.filter((run) => run.egressProxy?.started).length
  );
  pushMetric(
    lines,
    "lingban_run_worker_runtime_backend_ready",
    "gauge",
    "Whether the configured runtime backend is reachable.",
    diagnostics.runtimeBackend.ready ? 1 : 0,
    { backend: diagnostics.runtimeBackend.backend }
  );
  for (const component of readiness.components) {
    pushMetric(
      lines,
      "lingban_run_worker_readiness_component_ready",
      "gauge",
      "Whether a worker readiness component is healthy.",
      component.ready ? 1 : 0,
      { component: component.component }
    );
  }

  pushMetric(
    lines,
    "lingban_run_worker_start_jobs_processed_total",
    "counter",
    "Run start jobs processed by the worker.",
    diagnostics.metrics.startJobsProcessedTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_start_jobs_succeeded_total",
    "counter",
    "Run start jobs completed successfully.",
    diagnostics.metrics.startJobsSucceededTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_start_jobs_failed_total",
    "counter",
    "Run start jobs that failed during processing.",
    diagnostics.metrics.startJobsFailedTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_cleanup_jobs_processed_total",
    "counter",
    "Run cleanup jobs processed by the worker.",
    diagnostics.metrics.cleanupJobsProcessedTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_cleanup_jobs_succeeded_total",
    "counter",
    "Run cleanup jobs completed successfully.",
    diagnostics.metrics.cleanupJobsSucceededTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_cleanup_jobs_failed_total",
    "counter",
    "Run cleanup jobs that failed during processing.",
    diagnostics.metrics.cleanupJobsFailedTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_dlq_writes_total",
    "counter",
    "Dead-letter queue writes by queue type.",
    diagnostics.metrics.startDlqWritesTotal,
    { queue: "run.start.dlq" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_dlq_writes_total",
    "counter",
    "Dead-letter queue writes by queue type.",
    diagnostics.metrics.cleanupDlqWritesTotal,
    { queue: "run.cleanup.dlq" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_recovery_runs_total",
    "counter",
    "Worker recovery runs executed during daemon start.",
    diagnostics.metrics.recoveryRunsTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_recovery_failures_total",
    "counter",
    "Worker recovery runs that failed.",
    diagnostics.metrics.recoveryFailuresTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_recovery_candidates_total",
    "counter",
    "Recovery candidates inspected by the worker.",
    diagnostics.metrics.recoveryCandidatesTotal
  );
  pushMetric(
    lines,
    "lingban_run_worker_recovery_action_total",
    "counter",
    "Recovery actions executed by action type.",
    diagnostics.metrics.recoveryEnqueuedStartsTotal,
    { action: "enqueue-start" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_recovery_action_total",
    "counter",
    "Recovery actions executed by action type.",
    diagnostics.metrics.recoveryOrphanFailuresTotal,
    { action: "mark-orphan-failed" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_recovery_action_total",
    "counter",
    "Recovery actions executed by action type.",
    diagnostics.metrics.recoveryScheduledCleanupsTotal,
    { action: "schedule-cleanup" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_recovery_action_total",
    "counter",
    "Recovery actions executed by action type.",
    diagnostics.metrics.recoverySkippedTotal,
    { action: "skipped" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_runtime_handles_total",
    "counter",
    "Runtime handle lifecycle events by state.",
    diagnostics.metrics.runtimeHandlesStartedTotal,
    { state: "started" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_runtime_handles_total",
    "counter",
    "Runtime handle lifecycle events by state.",
    diagnostics.metrics.runtimeHandlesStoppedTotal,
    { state: "stopped" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_workspace_cleanup_total",
    "counter",
    "Workspace cleanup scheduling results.",
    diagnostics.metrics.workspaceCleanupScheduledTotal,
    { result: "scheduled" }
  );
  pushMetric(
    lines,
    "lingban_run_worker_workspace_cleanup_total",
    "counter",
    "Workspace cleanup scheduling results.",
    diagnostics.metrics.workspaceCleanupEnqueueFailuresTotal,
    { result: "enqueue_failed" }
  );

  for (const [component, started] of Object.entries(diagnostics.components)) {
    pushMetric(
      lines,
      "lingban_run_worker_component_started",
      "gauge",
      "Whether a worker component has been initialized.",
      started ? 1 : 0,
      { component }
    );
  }

  for (const queue of Object.values(diagnostics.queueEvents)) {
    for (const [eventName, count] of Object.entries(queue.counts)) {
      pushMetric(
        lines,
        "lingban_run_worker_queue_events_total",
        "counter",
        "Observed BullMQ queue events by queue and event name.",
        count,
        {
          queue: queue.queue,
          event: eventName,
        }
      );
    }
  }

  for (const component of readiness.components) {
    pushMetric(
      lines,
      "lingban_run_worker_component_ready",
      "gauge",
      "Whether a worker queue component is ready.",
      component.ready ? 1 : 0,
      { component: component.component }
    );
  }

  return `${lines.join("\n")}\n`;
}

export function redactRedisUrl(redisUrl?: string) {
  if (!redisUrl) {
    return null;
  }

  try {
    const parsed = new URL(redisUrl);
    const dbPath = parsed.pathname.replace(/^\/+/, "");
    const db = dbPath ? `/${dbPath}` : "";
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol === "rediss:" ? "6380" : "6379")}${db}`;
  } catch {
    return "invalid";
  }
}
