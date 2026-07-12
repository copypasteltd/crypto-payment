import type { RunDownloadTicket, RunUploadRecord } from "@lingban/contracts";
import { nowIso, toErrorMessage } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { objectStore } from "./object-store.js";
import { uploadRepository } from "./repository.js";

type StorageRetentionSweepMetrics = {
  sweepRunsTotal: number;
  sweepFailuresTotal: number;
  expiredDownloadTicketsDeletedTotal: number;
  uploadsExpiredTotal: number;
  uploadRecordsDeletedTotal: number;
  uploadObjectsDeletedTotal: number;
};

type StorageRetentionLastSweep = {
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  dryRun: boolean;
  expiredDownloadTicketsDeletedCount: number;
  uploadsExpiredCount: number;
  uploadRecordsDeletedCount: number;
  uploadObjectsDeletedCount: number;
  failureCount: number;
  errorMessage: string | null;
};

export type StorageRetentionDiagnostics = {
  sweeperActive: boolean;
  sweepIntervalMs: number;
  metrics: StorageRetentionSweepMetrics;
  lastSweep: StorageRetentionLastSweep;
};

type SweepNowOptions = {
  now?: Date;
  dryRun?: boolean;
};

function toTimestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function canDeleteExpiredDownloadTicket(ticket: RunDownloadTicket, nowMs: number) {
  const retentionMs = getApiRuntimeConfig().downloadTicketRetentionSeconds * 1000;
  const expiresAtMs = toTimestamp(ticket.expiresAt);
  return expiresAtMs != null && expiresAtMs + retentionMs <= nowMs;
}

function canExpireUnattachedUpload(upload: RunUploadRecord, nowMs: number) {
  if (upload.status === "attached" || upload.attachedPath) {
    return false;
  }

  if (upload.status === "expired") {
    return false;
  }

  const cutoffMs = nowMs - getApiRuntimeConfig().unattachedUploadTtlSeconds * 1000;
  const updatedAtMs = toTimestamp(upload.updatedAt) ?? toTimestamp(upload.createdAt);
  return updatedAtMs != null && updatedAtMs <= cutoffMs;
}

function canDeleteExpiredUploadRecord(upload: RunUploadRecord, nowMs: number) {
  if (upload.status !== "expired" || upload.attachedPath) {
    return false;
  }

  const cutoffMs = nowMs - getApiRuntimeConfig().expiredUploadRetentionSeconds * 1000;
  const updatedAtMs = toTimestamp(upload.updatedAt) ?? toTimestamp(upload.createdAt);
  return updatedAtMs != null && updatedAtMs <= cutoffMs;
}

function createEmptyLastSweep(): StorageRetentionLastSweep {
  return {
    startedAt: null,
    completedAt: null,
    durationMs: null,
    dryRun: false,
    expiredDownloadTicketsDeletedCount: 0,
    uploadsExpiredCount: 0,
    uploadRecordsDeletedCount: 0,
    uploadObjectsDeletedCount: 0,
    failureCount: 0,
    errorMessage: null,
  };
}

export class UploadRetentionManager {
  #sweeperActive = false;
  #sweepTimer: NodeJS.Timeout | null = null;
  #sweepInFlight: Promise<StorageRetentionLastSweep> | null = null;
  #metrics: StorageRetentionSweepMetrics = {
    sweepRunsTotal: 0,
    sweepFailuresTotal: 0,
    expiredDownloadTicketsDeletedTotal: 0,
    uploadsExpiredTotal: 0,
    uploadRecordsDeletedTotal: 0,
    uploadObjectsDeletedTotal: 0,
  };
  #lastSweep: StorageRetentionLastSweep = createEmptyLastSweep();

  getDiagnostics(): StorageRetentionDiagnostics {
    return {
      sweeperActive: this.#sweeperActive,
      sweepIntervalMs: getApiRuntimeConfig().storageRetentionSweepIntervalMs,
      metrics: {
        ...this.#metrics,
      },
      lastSweep: {
        ...this.#lastSweep,
      },
    };
  }

  async sweepNow(options: SweepNowOptions = {}) {
    const startedAt = nowIso();
    const startedAtMs = Date.now();
    const nowMs = (options.now ?? new Date()).getTime();
    const dryRun = options.dryRun ?? false;
    const deletedObjectKeys = new Set<string>();
    const result: StorageRetentionLastSweep = {
      startedAt,
      completedAt: null,
      durationMs: null,
      dryRun,
      expiredDownloadTicketsDeletedCount: 0,
      uploadsExpiredCount: 0,
      uploadRecordsDeletedCount: 0,
      uploadObjectsDeletedCount: 0,
      failureCount: 0,
      errorMessage: null,
    };

    this.#metrics.sweepRunsTotal += 1;

    const deleteUploadObject = async (upload: RunUploadRecord) => {
      if (!upload.objectKey || deletedObjectKeys.has(upload.objectKey)) {
        return false;
      }

      if (dryRun) {
        deletedObjectKeys.add(upload.objectKey);
        result.uploadObjectsDeletedCount += 1;
        return true;
      }

      await objectStore.deleteObject(upload.objectKey);
      deletedObjectKeys.add(upload.objectKey);
      result.uploadObjectsDeletedCount += 1;
      this.#metrics.uploadObjectsDeletedTotal += 1;
      return true;
    };

    try {
      const downloadsToDelete = uploadRepository
        .listDownloadTickets()
        .filter((ticket) => canDeleteExpiredDownloadTicket(ticket, nowMs));

      for (const ticket of downloadsToDelete) {
        try {
          if (!dryRun) {
            await uploadRepository.deleteDownloadTicket(ticket.ticketId);
            this.#metrics.expiredDownloadTicketsDeletedTotal += 1;
          }
          result.expiredDownloadTicketsDeletedCount += 1;
        } catch (error) {
          result.failureCount += 1;
          this.#metrics.sweepFailuresTotal += 1;
          result.errorMessage = toErrorMessage(error);
        }
      }

      const uploads = uploadRepository.listUploads();
      const uploadsToExpire = uploads.filter((upload) => canExpireUnattachedUpload(upload, nowMs));
      const uploadsToDelete = uploads.filter((upload) => canDeleteExpiredUploadRecord(upload, nowMs));

      for (const upload of uploadsToExpire) {
        try {
          await deleteUploadObject(upload);
          if (!dryRun) {
            await uploadRepository.updateUpload({
              ...upload,
              status: "expired",
              updatedAt: options.now?.toISOString() ?? nowIso(),
            });
            this.#metrics.uploadsExpiredTotal += 1;
          }
          result.uploadsExpiredCount += 1;
        } catch (error) {
          result.failureCount += 1;
          this.#metrics.sweepFailuresTotal += 1;
          result.errorMessage = toErrorMessage(error);
        }
      }

      for (const upload of uploadsToDelete) {
        try {
          await deleteUploadObject(upload);
          if (!dryRun) {
            await uploadRepository.deleteUpload(upload.uploadId);
            this.#metrics.uploadRecordsDeletedTotal += 1;
          }
          result.uploadRecordsDeletedCount += 1;
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

    const intervalMs = getApiRuntimeConfig().storageRetentionSweepIntervalMs;
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

export const uploadRetentionManager = new UploadRetentionManager();
