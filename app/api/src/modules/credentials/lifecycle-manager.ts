import { getApiRuntimeConfig } from "../../app/runtime.js";
import { nowIso, toErrorMessage } from "@lingban/shared";
import { credentialsService } from "./service.js";

type CredentialLifecycleSweepMetrics = {
  sweepRunsTotal: number;
  sweepFailuresTotal: number;
  credentialsScannedTotal: number;
  credentialsChangedTotal: number;
};

type CredentialLifecycleLastSweep = {
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  dryRun: boolean;
  requestedWorkspaceId: string | null;
  requestedCredentialId: string | null;
  scannedCount: number;
  changedCount: number;
  changes: Array<{
    credentialId: string;
    fromStatus: string;
    toStatus: string;
    action: string;
    reasonCode: string;
  }>;
  failureCount: number;
  errorMessage: string | null;
};

export type CredentialLifecycleDiagnostics = {
  sweeperActive: boolean;
  sweepIntervalMs: number;
  metrics: CredentialLifecycleSweepMetrics;
  lastSweep: CredentialLifecycleLastSweep;
};

type SweepNowOptions = {
  workspaceId?: string;
  credentialId?: string;
  dryRun?: boolean;
};

function createEmptyLastSweep(): CredentialLifecycleLastSweep {
  return {
    startedAt: null,
    completedAt: null,
    durationMs: null,
    dryRun: false,
    requestedWorkspaceId: null,
    requestedCredentialId: null,
    scannedCount: 0,
    changedCount: 0,
    changes: [],
    failureCount: 0,
    errorMessage: null,
  };
}

export class CredentialLifecycleManager {
  #sweeperActive = false;
  #sweepTimer: NodeJS.Timeout | null = null;
  #sweepInFlight: Promise<CredentialLifecycleLastSweep> | null = null;
  #metrics: CredentialLifecycleSweepMetrics = {
    sweepRunsTotal: 0,
    sweepFailuresTotal: 0,
    credentialsScannedTotal: 0,
    credentialsChangedTotal: 0,
  };
  #lastSweep: CredentialLifecycleLastSweep = createEmptyLastSweep();

  getDiagnostics(): CredentialLifecycleDiagnostics {
    return {
      sweeperActive: this.#sweeperActive,
      sweepIntervalMs: getApiRuntimeConfig().credentialLifecycleSweepIntervalMs,
      metrics: {
        ...this.#metrics,
      },
      lastSweep: {
        ...this.#lastSweep,
        changes: [...this.#lastSweep.changes],
      },
    };
  }

  async sweepNow(options: SweepNowOptions = {}) {
    const startedAt = nowIso();
    const startedAtMs = Date.now();
    const dryRun = options.dryRun ?? false;
    const result: CredentialLifecycleLastSweep = {
      startedAt,
      completedAt: null,
      durationMs: null,
      dryRun,
      requestedWorkspaceId: options.workspaceId ?? null,
      requestedCredentialId: options.credentialId ?? null,
      scannedCount: 0,
      changedCount: 0,
      changes: [],
      failureCount: 0,
      errorMessage: null,
    };

    this.#metrics.sweepRunsTotal += 1;

    try {
      const summary = await credentialsService.reconcileDerivedStatuses({
        workspaceId: options.workspaceId,
        credentialId: options.credentialId,
        dryRun,
      });

      result.scannedCount = summary.scannedCount;
      result.changedCount = summary.changedCount;
      result.changes = summary.changes;
      this.#metrics.credentialsScannedTotal += summary.scannedCount;
      if (!dryRun) {
        this.#metrics.credentialsChangedTotal += summary.changedCount;
      }
    } catch (error) {
      result.failureCount += 1;
      result.errorMessage = toErrorMessage(error);
      this.#metrics.sweepFailuresTotal += 1;
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

    this.#sweepTimer = setTimeout(() => {
      this.#sweepInFlight = this.sweepNow()
        .catch(() => this.#lastSweep)
        .finally(() => {
          this.#sweepInFlight = null;
          this.#scheduleNextSweep();
        });
    }, getApiRuntimeConfig().credentialLifecycleSweepIntervalMs);
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

export const credentialLifecycleManager = new CredentialLifecycleManager();
