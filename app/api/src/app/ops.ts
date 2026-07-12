import { loadWorkerRuntimeConfig } from "@lingban/config";
import { bridgeRegistry } from "../modules/bridge/registry.js";
import { runFileLifecycleManager } from "../modules/runs/file-lifecycle.js";
import { runsService } from "../modules/runs/service.js";
import { runFileSecurityService } from "../modules/uploads/file-security.js";
import { objectStore } from "../modules/uploads/object-store.js";
import { uploadRetentionManager } from "../modules/uploads/retention.js";
import { probeApiDatabaseReadiness } from "./database.js";
import { buildInternalRuntimeDiagnosticsReport, probeWorkerOpsRuntime } from "./runtime-diagnostics.js";

type ReadinessDependencyStatus = "ready" | "not_ready" | "disabled";

type ReadinessDependency = {
  status: ReadinessDependencyStatus;
  detail: string | null;
  metadata?: Record<string, unknown>;
};

export type ApiReadinessReport = {
  service: "api";
  status: "ready" | "not_ready";
  checkedAt: string;
  dependencies: {
    database: ReadinessDependency;
    objectStorage: ReadinessDependency;
    fileSecurity: ReadinessDependency;
    bridgeRegistry: ReadinessDependency;
    runtimeOrchestrator: ReadinessDependency;
    workerOps: ReadinessDependency;
  };
};

function nowIso() {
  return new Date().toISOString();
}

function toGaugeValue(status: ReadinessDependencyStatus) {
  return status === "ready" ? 1 : 0;
}

function escapeMetricLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function pushMetricHeader(lines: string[], name: string, type: "gauge" | "counter", help: string) {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} ${type}`);
}

function pushMetricSample(
  lines: string[],
  name: string,
  value: number,
  labels?: Record<string, string | number | boolean>
) {
  if (!labels || Object.keys(labels).length === 0) {
    lines.push(`${name} ${value}`);
    return;
  }

  const suffix = Object.entries(labels)
    .map(([key, rawValue]) => `${key}="${escapeMetricLabel(String(rawValue))}"`)
    .join(",");
  lines.push(`${name}{${suffix}} ${value}`);
}

export async function buildApiReadinessReport(): Promise<ApiReadinessReport> {
  const checkedAt = nowIso();
  const databaseProbe = await probeApiDatabaseReadiness();
  const objectStorageProbe = await objectStore.checkReadiness();
  const fileSecurityProbe = await runFileSecurityService.checkReadiness();
  const diagnostics = runsService.getInternalRuntimeDiagnostics();
  const workerConfig = loadWorkerRuntimeConfig();
  const workerOpsProbe = await probeWorkerOpsRuntime();

  const database: ReadinessDependency = databaseProbe.enabled
    ? {
        status: databaseProbe.ready ? "ready" : "not_ready",
        detail: databaseProbe.detail,
        metadata: {
          enabled: true,
        },
      }
    : {
        status: "disabled",
        detail: null,
        metadata: {
          enabled: false,
        },
      };

  const objectStorage: ReadinessDependency = {
    status: objectStorageProbe.ready ? "ready" : "not_ready",
    detail: objectStorageProbe.detail,
    metadata: {
      driver: objectStorageProbe.driver,
    },
  };
  const fileSecurity: ReadinessDependency = {
    status: fileSecurityProbe.status,
    detail: fileSecurityProbe.detail,
    metadata: fileSecurityProbe.metadata,
  };

  const bridgeRegistryReady =
    diagnostics.bridgeRegistry.initialized && diagnostics.bridgeRegistry.sweeperActive;
  const bridgeRegistryDependency: ReadinessDependency = {
    status: bridgeRegistryReady ? "ready" : "not_ready",
    detail: bridgeRegistryReady
      ? null
      : diagnostics.bridgeRegistry.initialized
        ? "Bridge registry sweeper is not active"
        : "Bridge registry is not initialized",
    metadata: {
      repositoryKind: diagnostics.bridgeRegistry.repositoryKind,
      sweeperActive: diagnostics.bridgeRegistry.sweeperActive,
      initialized: diagnostics.bridgeRegistry.initialized,
    },
  };

  const runtimeOrchestratorReady =
    diagnostics.runtimeOrchestrator.dispatchMode === "embedded"
      ? true
      : diagnostics.runtimeOrchestrator.runStartQueueEnabled &&
        diagnostics.runtimeOrchestrator.runCleanupQueueEnabled &&
        Boolean(workerConfig.redisUrl);

  const runtimeOrchestrator: ReadinessDependency = {
    status: runtimeOrchestratorReady ? "ready" : "not_ready",
    detail: runtimeOrchestratorReady
      ? null
      : diagnostics.runtimeOrchestrator.dispatchMode === "bullmq" && !workerConfig.redisUrl
        ? "BullMQ dispatch mode requires LINGBAN_REDIS_URL"
        : "Runtime orchestrator queue handles are not fully initialized",
    metadata: {
      dispatchMode: diagnostics.runtimeOrchestrator.dispatchMode,
      runStartQueueEnabled: diagnostics.runtimeOrchestrator.runStartQueueEnabled,
      runCleanupQueueEnabled: diagnostics.runtimeOrchestrator.runCleanupQueueEnabled,
    },
  };

  const workerOps: ReadinessDependency = workerOpsProbe.configured
    ? {
        status: workerOpsProbe.status === "ready" ? "ready" : "not_ready",
        detail:
          workerOpsProbe.status === "ready"
            ? null
            : workerOpsProbe.error ??
              (workerOpsProbe.readinessStatus === "not_ready"
                ? "Worker ops endpoint reported not_ready"
                : "Worker ops endpoint is unreachable"),
        metadata: {
          baseUrl: workerOpsProbe.baseUrl,
          readinessStatus: workerOpsProbe.readinessStatus,
          diagnosticsAvailable: workerOpsProbe.diagnosticsAvailable,
          probeDurationMs: workerOpsProbe.durationMs,
        },
      }
    : {
        status: "disabled",
        detail: null,
        metadata: {
          configured: false,
        },
      };

  const dependencies = {
    database,
    objectStorage,
    fileSecurity,
    bridgeRegistry: bridgeRegistryDependency,
    runtimeOrchestrator,
    workerOps,
  } satisfies ApiReadinessReport["dependencies"];

  const notReady = Object.values(dependencies).some((dependency) => dependency.status === "not_ready");

  return {
    service: "api",
    status: notReady ? "not_ready" : "ready",
    checkedAt,
    dependencies,
  };
}

export async function buildApiMetricsText() {
  const readiness = await buildApiReadinessReport();
  const diagnostics = await buildInternalRuntimeDiagnosticsReport({
    includeBridgeControlProbes: false,
  });
  const retention = uploadRetentionManager.getDiagnostics();
  const fileLifecycle = runFileLifecycleManager.getDiagnostics();
  const fileSecurity = await runFileSecurityService.getDiagnostics();
  const lines: string[] = [];

  pushMetricHeader(lines, "lingban_api_ready", "gauge", "Whether the API instance is ready to receive traffic.");
  pushMetricSample(lines, "lingban_api_ready", readiness.status === "ready" ? 1 : 0);

  pushMetricHeader(
    lines,
    "lingban_api_dependency_enabled",
    "gauge",
    "Whether a dependency is enabled for the current API instance."
  );
  for (const [dependency, state] of Object.entries(readiness.dependencies)) {
    const enabled = state.status === "disabled" ? 0 : 1;
    pushMetricSample(lines, "lingban_api_dependency_enabled", enabled, {
      dependency,
    });
  }

  pushMetricHeader(
    lines,
    "lingban_api_dependency_ready",
    "gauge",
    "Whether an enabled dependency is currently ready."
  );
  for (const [dependency, state] of Object.entries(readiness.dependencies)) {
    pushMetricSample(lines, "lingban_api_dependency_ready", toGaugeValue(state.status), {
      dependency,
    });
  }

  pushMetricHeader(
    lines,
    "lingban_bridge_registry_registered_connections",
    "gauge",
    "Current number of registered bridge connections."
  );
  pushMetricSample(
    lines,
    "lingban_bridge_registry_registered_connections",
    diagnostics.bridgeRegistry.registeredConnectionsCount
  );

  pushMetricHeader(
    lines,
    "lingban_bridge_registry_controller_attached",
    "gauge",
    "Current number of bridge connections with an attached control handler."
  );
  pushMetricSample(
    lines,
    "lingban_bridge_registry_controller_attached",
    diagnostics.bridgeRegistry.controllerAttachedCount
  );

  pushMetricHeader(
    lines,
    "lingban_bridge_registry_pending_commands",
    "gauge",
    "Current number of queued bridge control commands waiting for a controller."
  );
  pushMetricSample(
    lines,
    "lingban_bridge_registry_pending_commands",
    diagnostics.bridgeRegistry.pendingCommandsCount
  );

  pushMetricHeader(
    lines,
    "lingban_bridge_registry_stale_candidates",
    "gauge",
    "Current number of registered bridge connections considered stale."
  );
  pushMetricSample(
    lines,
    "lingban_bridge_registry_stale_candidates",
    diagnostics.bridgeRegistry.staleCandidatesCount
  );

  pushMetricHeader(
    lines,
    "lingban_storage_retention_sweeper_active",
    "gauge",
    "Whether the storage retention sweeper is active."
  );
  pushMetricSample(
    lines,
    "lingban_storage_retention_sweeper_active",
    retention.sweeperActive ? 1 : 0
  );

  pushMetricHeader(
    lines,
    "lingban_storage_retention_sweep_runs_total",
    "counter",
    "Total number of storage retention sweeps."
  );
  pushMetricSample(
    lines,
    "lingban_storage_retention_sweep_runs_total",
    retention.metrics.sweepRunsTotal
  );

  pushMetricHeader(
    lines,
    "lingban_storage_retention_sweep_failures_total",
    "counter",
    "Total number of storage retention sweep failures."
  );
  pushMetricSample(
    lines,
    "lingban_storage_retention_sweep_failures_total",
    retention.metrics.sweepFailuresTotal
  );

  pushMetricHeader(
    lines,
    "lingban_storage_retention_expired_download_tickets_deleted_total",
    "counter",
    "Total number of expired download ticket records deleted by retention sweeps."
  );
  pushMetricSample(
    lines,
    "lingban_storage_retention_expired_download_tickets_deleted_total",
    retention.metrics.expiredDownloadTicketsDeletedTotal
  );

  pushMetricHeader(
    lines,
    "lingban_storage_retention_uploads_expired_total",
    "counter",
    "Total number of unattached uploads moved to expired state by retention sweeps."
  );
  pushMetricSample(
    lines,
    "lingban_storage_retention_uploads_expired_total",
    retention.metrics.uploadsExpiredTotal
  );

  pushMetricHeader(
    lines,
    "lingban_storage_retention_upload_records_deleted_total",
    "counter",
    "Total number of expired upload records deleted by retention sweeps."
  );
  pushMetricSample(
    lines,
    "lingban_storage_retention_upload_records_deleted_total",
    retention.metrics.uploadRecordsDeletedTotal
  );

  pushMetricHeader(
    lines,
    "lingban_storage_retention_upload_objects_deleted_total",
    "counter",
    "Total number of upload objects deleted by retention sweeps."
  );
  pushMetricSample(
    lines,
    "lingban_storage_retention_upload_objects_deleted_total",
    retention.metrics.uploadObjectsDeletedTotal
  );

  pushMetricHeader(
    lines,
    "lingban_run_file_lifecycle_sweeper_active",
    "gauge",
    "Whether the run file lifecycle sweeper is active."
  );
  pushMetricSample(
    lines,
    "lingban_run_file_lifecycle_sweeper_active",
    fileLifecycle.sweeperActive ? 1 : 0
  );

  pushMetricHeader(
    lines,
    "lingban_run_file_lifecycle_hot_retention_seconds",
    "gauge",
    "Hot retention window, in seconds, before terminal run files are archived to cold storage."
  );
  pushMetricSample(
    lines,
    "lingban_run_file_lifecycle_hot_retention_seconds",
    fileLifecycle.hotRetentionSeconds
  );

  pushMetricHeader(
    lines,
    "lingban_run_file_lifecycle_sweeps_total",
    "counter",
    "Total number of run file lifecycle sweeps."
  );
  pushMetricSample(
    lines,
    "lingban_run_file_lifecycle_sweeps_total",
    fileLifecycle.metrics.sweepRunsTotal
  );

  pushMetricHeader(
    lines,
    "lingban_run_file_lifecycle_failures_total",
    "counter",
    "Total number of run file lifecycle sweep failures."
  );
  pushMetricSample(
    lines,
    "lingban_run_file_lifecycle_failures_total",
    fileLifecycle.metrics.sweepFailuresTotal
  );

  pushMetricHeader(
    lines,
    "lingban_run_file_lifecycle_events_total",
    "counter",
    "Run file lifecycle event counters grouped by metric name."
  );
  for (const [metric, value] of Object.entries(fileLifecycle.metrics)) {
    if (metric === "sweepRunsTotal" || metric === "sweepFailuresTotal") {
      continue;
    }

    pushMetricSample(lines, "lingban_run_file_lifecycle_events_total", value, {
      metric,
    });
  }

  pushMetricHeader(
    lines,
    "lingban_file_security_mode",
    "gauge",
    "Configured file security scan mode for the current API instance."
  );
  pushMetricSample(lines, "lingban_file_security_mode", 1, {
    mode: fileSecurity.mode,
  });

  pushMetricHeader(
    lines,
    "lingban_file_security_ready",
    "gauge",
    "Whether the configured file security backend is currently ready."
  );
  pushMetricSample(
    lines,
    "lingban_file_security_ready",
    fileSecurity.readiness.status === "ready" ? 1 : 0
  );

  pushMetricHeader(
    lines,
    "lingban_file_security_cache_entries",
    "gauge",
    "Current number of cached file security scan entries."
  );
  pushMetricSample(
    lines,
    "lingban_file_security_cache_entries",
    fileSecurity.cache.entryCount
  );

  pushMetricHeader(
    lines,
    "lingban_file_security_scans_total",
    "counter",
    "Cumulative file security scan counters."
  );
  for (const [metric, value] of Object.entries(fileSecurity.metrics)) {
    pushMetricSample(lines, "lingban_file_security_scans_total", value, {
      metric,
    });
  }

  pushMetricHeader(
    lines,
    "lingban_bridge_registry_persistence_pending",
    "gauge",
    "Current number of pending bridge registry persistence operations."
  );
  pushMetricSample(
    lines,
    "lingban_bridge_registry_persistence_pending",
    diagnostics.bridgeRegistry.persistencePendingCount
  );

  pushMetricHeader(
    lines,
    "lingban_bridge_registry_events_total",
    "counter",
    "Cumulative bridge registry event counters."
  );
  for (const [metricName, value] of Object.entries(diagnostics.bridgeRegistry.metrics)) {
    pushMetricSample(lines, "lingban_bridge_registry_events_total", value, {
      metric: metricName,
    });
  }

  pushMetricHeader(
    lines,
    "lingban_runtime_orchestrator_runs",
    "gauge",
    "Current runtime orchestrator run counts by state."
  );
  pushMetricSample(lines, "lingban_runtime_orchestrator_runs", diagnostics.runtimeOrchestrator.activeRunsCount, {
    state: "active",
  });
  pushMetricSample(
    lines,
    "lingban_runtime_orchestrator_runs",
    diagnostics.runtimeOrchestrator.launchingRunsCount,
    {
      state: "launching",
    }
  );
  pushMetricSample(
    lines,
    "lingban_runtime_orchestrator_runs",
    diagnostics.runtimeOrchestrator.scheduledRunsCount,
    {
      state: "scheduled",
    }
  );
  pushMetricSample(lines, "lingban_runtime_orchestrator_runs", diagnostics.runtimeOrchestrator.queueDepth, {
    state: "queued",
  });

  pushMetricHeader(
    lines,
    "lingban_runtime_orchestrator_timers",
    "gauge",
    "Current runtime orchestrator timer counts by kind."
  );
  pushMetricSample(
    lines,
    "lingban_runtime_orchestrator_timers",
    diagnostics.runtimeOrchestrator.orphanRecoveryTimersCount,
    {
      kind: "orphan_recovery",
    }
  );
  pushMetricSample(
    lines,
    "lingban_runtime_orchestrator_timers",
    diagnostics.runtimeOrchestrator.cleanupTimersCount,
    {
      kind: "cleanup",
    }
  );

  pushMetricHeader(
    lines,
    "lingban_runtime_recovery_candidates",
    "gauge",
    "Current number of runtime recovery candidates."
  );
  pushMetricSample(lines, "lingban_runtime_recovery_candidates", diagnostics.recovery.candidatesCount);

  pushMetricHeader(
    lines,
    "lingban_runtime_recovery_action_count",
    "gauge",
    "Current number of runtime recovery candidates by action."
  );
  for (const [action, value] of Object.entries(diagnostics.recovery.actionCounts)) {
    pushMetricSample(lines, "lingban_runtime_recovery_action_count", value, {
      action,
    });
  }

  pushMetricHeader(
    lines,
    "lingban_runtime_dispatch_mode",
    "gauge",
    "Runtime dispatch mode for the current API instance."
  );
  pushMetricSample(lines, "lingban_runtime_dispatch_mode", 1, {
    mode: diagnostics.runtimeOrchestrator.dispatchMode,
  });

  pushMetricHeader(
    lines,
    "lingban_worker_ops_configured",
    "gauge",
    "Whether the API has a worker ops endpoint configured for runtime probing."
  );
  pushMetricSample(lines, "lingban_worker_ops_configured", diagnostics.workerOps.configured ? 1 : 0);

  pushMetricHeader(
    lines,
    "lingban_worker_ops_ready",
    "gauge",
    "Whether the configured worker ops endpoint currently reports ready."
  );
  pushMetricSample(lines, "lingban_worker_ops_ready", diagnostics.workerOps.status === "ready" ? 1 : 0);

  if (diagnostics.workerOps.durationMs !== null) {
    pushMetricHeader(
      lines,
      "lingban_worker_ops_probe_duration_ms",
      "gauge",
      "Duration of the latest worker ops probe in milliseconds."
    );
    pushMetricSample(lines, "lingban_worker_ops_probe_duration_ms", diagnostics.workerOps.durationMs);
  }

  pushMetricHeader(
    lines,
    "lingban_bridge_control_configured_endpoints",
    "gauge",
    "Current number of registered bridge control endpoints known by the API."
  );
  pushMetricSample(
    lines,
    "lingban_bridge_control_configured_endpoints",
    diagnostics.bridgeControlProbes.configuredCount
  );

  return `${lines.join("\n")}\n`;
}

export async function isApiReady() {
  const report = await buildApiReadinessReport();
  return report.status === "ready";
}

export function getBridgeRegistrySingleton() {
  return bridgeRegistry;
}
