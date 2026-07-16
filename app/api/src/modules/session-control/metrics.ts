import type { SessionCaptureObject } from "@lingban/contracts";

type SessionCaptureObjectType = SessionCaptureObject["objectType"];

const durationBucketsSeconds = [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300] as const;

class DurationHistogram {
  #count = 0;
  #sum = 0;
  #buckets = new Map<number, number>(durationBucketsSeconds.map((bucket) => [bucket, 0]));

  observe(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    this.#count += 1;
    this.#sum += seconds;
    for (const bucket of durationBucketsSeconds) {
      if (seconds <= bucket) this.#buckets.set(bucket, (this.#buckets.get(bucket) ?? 0) + 1);
    }
  }

  snapshot() {
    return {
      count: this.#count,
      sum: this.#sum,
      buckets: durationBucketsSeconds.map((le) => ({ le, count: this.#buckets.get(le) ?? 0 })),
    };
  }
}

class SessionControlMetrics {
  #captureRequestedTotal = 0;
  #captureCompletedTotal = 0;
  #captureRetryTotal = 0;
  #captureFailedByCode = new Map<string, number>();
  #captureBytesByObjectType = new Map<SessionCaptureObjectType, number>();
  #workspaceFiles = new DurationHistogram();
  #captureDuration = new DurationHistogram();
  #draftBuildDuration = new DurationHistogram();
  #replayDuration = new DurationHistogram();
  #replayByStatus = new Map<"passed" | "failed", number>();
  #redactionUncovered = 0;
  #versionSealedTotal = 0;
  #rawCaptureAccessByMode = new Map<string, number>();
  #legacyMigrationByStatus = new Map<string, number>();

  captureRequested() { this.#captureRequestedTotal += 1; }
  captureRetried() { this.#captureRetryTotal += 1; }
  captureObjectUploaded(objectType: SessionCaptureObjectType, bytes: number) {
    this.#captureBytesByObjectType.set(objectType, (this.#captureBytesByObjectType.get(objectType) ?? 0) + bytes);
  }
  captureCompleted(input: { requestedAt: string; capturedAt: string; fileCount: number }) {
    this.#captureCompletedTotal += 1;
    this.#workspaceFiles.observe(input.fileCount);
    this.#captureDuration.observe(Math.max(0, Date.parse(input.capturedAt) - Date.parse(input.requestedAt)) / 1000);
  }
  captureFailed(code: string) {
    this.#captureFailedByCode.set(code, (this.#captureFailedByCode.get(code) ?? 0) + 1);
  }
  draftBuilt(durationSeconds: number, uncoveredCount: number) {
    this.#draftBuildDuration.observe(durationSeconds);
    this.#redactionUncovered = Math.max(0, uncoveredCount);
  }
  replayCompleted(status: "passed" | "failed", durationSeconds: number) {
    this.#replayByStatus.set(status, (this.#replayByStatus.get(status) ?? 0) + 1);
    this.#replayDuration.observe(durationSeconds);
  }
  versionSealed() { this.#versionSealedTotal += 1; }
  rawCaptureAccess(objectType: SessionCaptureObjectType, mode: "proxy" | "signed-url") {
    const key = `${objectType}:${mode}`;
    this.#rawCaptureAccessByMode.set(key, (this.#rawCaptureAccessByMode.get(key) ?? 0) + 1);
  }
  legacyMigration(status: "planned" | "migrated" | "skipped" | "failed") {
    this.#legacyMigrationByStatus.set(status, (this.#legacyMigrationByStatus.get(status) ?? 0) + 1);
  }

  snapshot() {
    return {
      captureRequestedTotal: this.#captureRequestedTotal,
      captureCompletedTotal: this.#captureCompletedTotal,
      captureRetryTotal: this.#captureRetryTotal,
      captureFailedByCode: Object.fromEntries(this.#captureFailedByCode),
      captureBytesByObjectType: Object.fromEntries(this.#captureBytesByObjectType),
      captureDuration: this.#captureDuration.snapshot(),
      workspaceFiles: this.#workspaceFiles.snapshot(),
      draftBuildDuration: this.#draftBuildDuration.snapshot(),
      replayDuration: this.#replayDuration.snapshot(),
      replayByStatus: Object.fromEntries(this.#replayByStatus),
      redactionUncovered: this.#redactionUncovered,
      versionSealedTotal: this.#versionSealedTotal,
      rawCaptureAccessByMode: Object.fromEntries(this.#rawCaptureAccessByMode),
      legacyMigrationByStatus: Object.fromEntries(this.#legacyMigrationByStatus),
    };
  }
}

export const sessionControlMetrics = new SessionControlMetrics();
