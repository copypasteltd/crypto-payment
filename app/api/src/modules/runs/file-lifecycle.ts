import type { RunAggregate } from "@lingban/db";
import { nowIso, toErrorMessage } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { objectStore } from "../uploads/object-store.js";
import { runsRepository } from "./repository.js";
import { runFileIndexService } from "./file-index.js";
import type { RunFileRecord } from "@lingban/contracts";

type ApiRuntimeConfig = ReturnType<typeof getApiRuntimeConfig>;

type RunFileLifecycleMetrics = {
  sweepRunsTotal: number;
  sweepFailuresTotal: number;
  runsEvaluatedTotal: number;
  runsArchivedTotal: number;
  filesArchivedTotal: number;
  filesAlreadyColdTotal: number;
};

type RunFileLifecycleLastSweep = {
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  dryRun: boolean;
  requestedRunId: string | null;
  cutoffAt: string | null;
  runsEvaluatedCount: number;
  runsArchivedCount: number;
  runsSkippedCount: number;
  filesArchivedCount: number;
  filesAlreadyColdCount: number;
  failureCount: number;
  errorMessage: string | null;
};

export type RunFileLifecycleDiagnostics = {
  sweeperActive: boolean;
  sweepIntervalMs: number;
  hotRetentionSeconds: number;
  archivePrefix: string;
  archiveSources: string[];
  metrics: RunFileLifecycleMetrics;
  lastSweep: RunFileLifecycleLastSweep;
};

type SweepNowOptions = {
  now?: Date;
  dryRun?: boolean;
  runId?: string;
};

type RunFileLifecycleDependencies = {
  getRuntimeConfig: () => ApiRuntimeConfig;
  runsRepository: Pick<typeof runsRepository, "list">;
  runFileIndexService: Pick<typeof runFileIndexService, "list" | "replaceRecords">;
  objectStore: Pick<typeof objectStore, "copyObject">;
};

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function createEmptyLastSweep(): RunFileLifecycleLastSweep {
  return {
    startedAt: null,
    completedAt: null,
    durationMs: null,
    dryRun: false,
    requestedRunId: null,
    cutoffAt: null,
    runsEvaluatedCount: 0,
    runsArchivedCount: 0,
    runsSkippedCount: 0,
    filesArchivedCount: 0,
    filesAlreadyColdCount: 0,
    failureCount: 0,
    errorMessage: null,
  };
}

function isTerminalAggregate(aggregate: RunAggregate) {
  return TERMINAL_STATUSES.has(aggregate.run.status);
}

function resolveTerminalAt(aggregate: RunAggregate) {
  return aggregate.runtime?.finishedAt ?? aggregate.run.updatedAt;
}

function buildArchiveObjectKey(file: RunFileRecord, archivedAt: string, config: ApiRuntimeConfig) {
  const prefix = trimSlashes(config.runFileArchivePrefix);
  const logicalPath = file.logicalPath.replace(/^\/+/, "");
  const archivedDate = new Date(archivedAt);
  const year = String(archivedDate.getUTCFullYear());
  const month = String(archivedDate.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${year}/${month}/${file.workspaceId}/${file.runId}/${file.source}/${logicalPath}`;
}

function canArchiveFile(file: RunFileRecord, allowedSources: Set<string>) {
  if (file.path.endsWith("/")) {
    return false;
  }

  if (!file.objectKey || file.uploadId) {
    return false;
  }

  return allowedSources.has(file.source);
}

const defaultRunFileLifecycleDependencies: RunFileLifecycleDependencies = {
  getRuntimeConfig: getApiRuntimeConfig,
  runsRepository,
  runFileIndexService,
  objectStore,
};

export class RunFileLifecycleManager {
  #dependencies: RunFileLifecycleDependencies;
  #sweeperActive = false;
  #sweepTimer: NodeJS.Timeout | null = null;
  #sweepInFlight: Promise<RunFileLifecycleLastSweep> | null = null;
  #metrics: RunFileLifecycleMetrics = {
    sweepRunsTotal: 0,
    sweepFailuresTotal: 0,
    runsEvaluatedTotal: 0,
    runsArchivedTotal: 0,
    filesArchivedTotal: 0,
    filesAlreadyColdTotal: 0,
  };
  #lastSweep: RunFileLifecycleLastSweep = createEmptyLastSweep();

  constructor(dependencies: RunFileLifecycleDependencies = defaultRunFileLifecycleDependencies) {
    this.#dependencies = dependencies;
  }

  getDiagnostics(): RunFileLifecycleDiagnostics {
    const config = this.#dependencies.getRuntimeConfig();
    return {
      sweeperActive: this.#sweeperActive,
      sweepIntervalMs: config.runFileLifecycleSweepIntervalMs,
      hotRetentionSeconds: config.runFileArchiveHotRetentionSeconds,
      archivePrefix: config.runFileArchivePrefix,
      archiveSources: [...config.runFileArchiveSources],
      metrics: {
        ...this.#metrics,
      },
      lastSweep: {
        ...this.#lastSweep,
      },
    };
  }

  async sweepNow(options: SweepNowOptions = {}) {
    const config = this.#dependencies.getRuntimeConfig();
    const startedAt = nowIso();
    const startedAtMs = Date.now();
    const now = options.now ?? new Date();
    const nowMs = now.getTime();
    const dryRun = options.dryRun ?? false;
    const cutoffAt = new Date(
      nowMs - config.runFileArchiveHotRetentionSeconds * 1000
    ).toISOString();
    const allowedSources = new Set(config.runFileArchiveSources);
    const result: RunFileLifecycleLastSweep = {
      startedAt,
      completedAt: null,
      durationMs: null,
      dryRun,
      requestedRunId: options.runId ?? null,
      cutoffAt,
      runsEvaluatedCount: 0,
      runsArchivedCount: 0,
      runsSkippedCount: 0,
      filesArchivedCount: 0,
      filesAlreadyColdCount: 0,
      failureCount: 0,
      errorMessage: null,
    };

    this.#metrics.sweepRunsTotal += 1;

    try {
      const allRuns = options.runId
        ? this.#dependencies.runsRepository
            .list()
            .filter((aggregate) => aggregate.run.runId === options.runId)
        : this.#dependencies.runsRepository.list();

      for (const aggregate of allRuns) {
        try {
          const terminalAt = resolveTerminalAt(aggregate);
          const terminalAtMs = toTimestamp(terminalAt);

          if (
            !isTerminalAggregate(aggregate) ||
          terminalAtMs == null ||
          terminalAtMs > nowMs - config.runFileArchiveHotRetentionSeconds * 1000
        ) {
          result.runsSkippedCount += 1;
          continue;
        }

          const previousFiles = this.#dependencies.runFileIndexService.list(aggregate.run.runId);
          if (previousFiles.length === 0) {
            result.runsSkippedCount += 1;
            continue;
          }

          result.runsEvaluatedCount += 1;
          this.#metrics.runsEvaluatedTotal += 1;

          const archivedAt = options.now?.toISOString() ?? nowIso();
          let changed = false;
          const nextFiles: RunFileRecord[] = [];

          for (const file of previousFiles) {
            if (!canArchiveFile(file, allowedSources)) {
              nextFiles.push(file);
              continue;
            }

            if (file.storageTier === "cold") {
              result.filesAlreadyColdCount += 1;
              if (!dryRun) {
                this.#metrics.filesAlreadyColdTotal += 1;
              }
              nextFiles.push(file);
              continue;
            }

            const nextObjectKey = buildArchiveObjectKey(file, archivedAt, config);

            if (!dryRun && file.objectKey !== nextObjectKey) {
              await this.#dependencies.objectStore.copyObject(file.objectKey as string, nextObjectKey);
            }

            nextFiles.push({
              ...file,
              objectKey: nextObjectKey,
              storageTier: "cold",
              archivedAt,
              archivedFromObjectKey:
                file.archivedFromObjectKey ?? (file.objectKey === nextObjectKey ? null : file.objectKey),
              archiveReason: "terminal-retention",
              indexedAt: archivedAt,
            });
            changed = true;
            result.filesArchivedCount += 1;
            if (!dryRun) {
              this.#metrics.filesArchivedTotal += 1;
            }
          }

          if (!changed) {
            result.runsSkippedCount += 1;
            continue;
          }

          if (!dryRun) {
            await this.#dependencies.runFileIndexService.replaceRecords(
              aggregate.run.runId,
              nextFiles
            );
            this.#metrics.runsArchivedTotal += 1;
          }

          result.runsArchivedCount += 1;
        } catch (error) {
          result.failureCount += 1;
          this.#metrics.sweepFailuresTotal += 1;
          result.errorMessage = toErrorMessage(error);
        }
      }
    } catch (error) {
      result.failureCount += 1;
      this.#metrics.sweepFailuresTotal += 1;
      result.errorMessage = toErrorMessage(error);
    }

    result.completedAt = nowIso();
    result.durationMs = Math.max(0, Date.now() - startedAtMs);
    this.#lastSweep = result;
    return result;
  }

  #scheduleNextSweep() {
    if (!this.#sweeperActive) {
      return;
    }

    const intervalMs = this.#dependencies.getRuntimeConfig().runFileLifecycleSweepIntervalMs;
    this.#sweepTimer = setTimeout(() => {
      this.#sweepInFlight = this.sweepNow()
        .catch(() => this.#lastSweep)
        .finally(() => {
          this.#sweepInFlight = null;
          this.#scheduleNextSweep();
        });
    }, intervalMs);
    this.#sweepTimer.unref?.();
  }

  startSweeper() {
    if (this.#sweeperActive) {
      return;
    }

    this.#sweeperActive = true;
    this.#sweepInFlight = this.sweepNow()
      .catch(() => this.#lastSweep)
      .finally(() => {
        this.#sweepInFlight = null;
        this.#scheduleNextSweep();
      });
  }

  async stopSweeper() {
    this.#sweeperActive = false;
    if (this.#sweepTimer) {
      clearTimeout(this.#sweepTimer);
      this.#sweepTimer = null;
    }

    await this.#sweepInFlight?.catch(() => undefined);
  }
}

export const runFileLifecycleManager = new RunFileLifecycleManager();
