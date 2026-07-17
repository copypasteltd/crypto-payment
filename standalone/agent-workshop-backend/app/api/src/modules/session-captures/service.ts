import { createHash, randomUUID } from "node:crypto";
import {
  completeSessionCaptureInputSchema,
  createSessionCaptureInputSchema,
  failSessionCaptureInputSchema,
  heartbeatSessionCaptureInputSchema,
  sessionCaptureBoundarySchema,
  sessionCaptureLeaseSchema,
  sessionCaptureObjectSchema,
  sessionCaptureObjectAccessAuditSchema,
  sessionCaptureObjectTypeSchema,
  sessionCaptureRecordSchema,
  sessionCaptureSummarySchema,
  submitSessionCaptureBarrierInputSchema,
  type CompleteSessionCaptureInput,
  type CreateSessionCaptureInput,
  type FailSessionCaptureInput,
  type HeartbeatSessionCaptureInput,
  type SessionCaptureObject,
  type SessionCaptureObjectAccessAudit,
  type SessionCaptureRecord,
  type SessionCaptureStatus,
  type SubmitSessionCaptureBarrierInput,
} from "@lingban/contracts";
import { nowIso } from "@lingban/shared";
import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { ObjectStoreImmutableConflictError, objectStore } from "../uploads/object-store.js";
import { agentRuntimeRepository } from "../agent-runtime/repository.js";
import { runsService } from "../runs/service.js";
import { sessionCaptureRepository } from "./repository.js";
import { sessionControlMetrics } from "../session-control/metrics.js";

const allowedTransitions: Record<SessionCaptureStatus, ReadonlySet<SessionCaptureStatus>> = {
  REQUESTED: new Set(["WAITING_BARRIER", "CANCELLED"]),
  WAITING_BARRIER: new Set(["CAPTURING_EVENTS", "RETRY_WAIT", "FAILED", "CANCELLED"]),
  CAPTURING_EVENTS: new Set(["CAPTURING_WORKSPACE", "UPLOADING", "RETRY_WAIT", "FAILED", "CANCELLED"]),
  CAPTURING_WORKSPACE: new Set(["UPLOADING", "RETRY_WAIT", "FAILED", "CANCELLED"]),
  UPLOADING: new Set(["VERIFYING", "RETRY_WAIT", "FAILED", "CANCELLED"]),
  VERIFYING: new Set(["CAPTURED", "RETRY_WAIT", "FAILED", "CANCELLED"]),
  CAPTURED: new Set(),
  RETRY_WAIT: new Set(["REQUESTED", "WAITING_BARRIER", "FAILED", "CANCELLED"]),
  FAILED: new Set(["REQUESTED", "CANCELLED"]),
  CANCELLED: new Set(),
};

function transition(record: SessionCaptureRecord, status: SessionCaptureStatus, patch: Partial<SessionCaptureRecord> = {}) {
  if (record.status !== status && !allowedTransitions[record.status].has(status)) {
    throw new AppError(409, "RUN_CAPTURE_STATE_CONFLICT", `Invalid capture transition: ${record.status} -> ${status}`);
  }
  return sessionCaptureRecordSchema.parse({
    ...record,
    ...patch,
    status,
    version: record.version + 1,
    updatedAt: nowIso(),
  });
}

function requireLease(record: SessionCaptureRecord, workerId: string, leaseGeneration: number) {
  if (record.leaseOwner !== workerId || record.leaseGeneration !== leaseGeneration) {
    throw new AppError(409, "RUN_CAPTURE_LEASE_CONFLICT", `Capture lease does not match ${record.captureId}`);
  }
  if (!record.leaseExpiresAt || Date.parse(record.leaseExpiresAt) <= Date.now()) {
    throw new AppError(409, "RUN_CAPTURE_LEASE_EXPIRED", `Capture lease expired: ${record.captureId}`);
  }
}

function verifyCaptureAllowed(snapshot: ReturnType<typeof runsService.getRun>, input: CreateSessionCaptureInput) {
  if (snapshot.run.status === "STARTING" || snapshot.run.status === "CREATED" || snapshot.run.status === "READY" || snapshot.run.status === "QUEUED") {
    throw new AppError(409, "RUN_CAPTURE_NOT_ALLOWED", `Run status does not allow capture: ${snapshot.run.status}`);
  }
  if (input.mode === "checkpoint") {
    if (!snapshot.agentThread?.threadId || snapshot.agentThread.currentTurnState === "in_progress") {
      throw new AppError(409, "RUN_CAPTURE_TURN_IN_PROGRESS", "Checkpoint capture requires a completed App Server turn");
    }
  }
  if (input.mode === "terminal") {
    const activeCompletedTurn =
      snapshot.run.status === "RUNNING" &&
      Boolean(snapshot.agentThread?.threadId) &&
      Boolean(snapshot.agentThread?.currentTurnId) &&
      snapshot.agentThread?.currentTurnState === "completed";
    const retainedTerminalRuntime =
      ["SUCCEEDED", "FAILED", "CANCELLED"].includes(snapshot.run.status) &&
      snapshot.agentThread?.connectionState !== "stopped" &&
      snapshot.agentThread?.connectionState !== "failed";
    if (!activeCompletedTurn && !retainedTerminalRuntime) {
      throw new AppError(409, "RUN_CAPTURE_NOT_ALLOWED", `Terminal capture requires an active completed turn: ${snapshot.run.status}`);
    }
  }
}

function contentAddressedObjectKey(captureId: string, object: SessionCaptureObject) {
  const extensions: Record<SessionCaptureObject["objectType"], string> = {
    raw_events: "jsonl.gz",
    thread: "json.gz",
    workspace: "tar.zst",
    inventory: "json.gz",
    manifest: "json",
  };
  return `session-captures/${captureId}/${object.objectType}/${object.sha256}.${extensions[object.objectType]}`;
}

export class SessionCaptureService {
  #retrySweeper: NodeJS.Timeout | null = null;
  #dispatchingClaimable = false;

  startRetrySweeper(intervalMs = 5_000) {
    if (!getApiRuntimeConfig().sessionCaptureV2Enabled) return;
    if (this.#retrySweeper) return;
    const dispatch = () => void this.dispatchClaimable().catch((error) => {
      console.error("[lingban-session-capture] claimable dispatch sweep failed:", error);
    });
    dispatch();
    this.#retrySweeper = setInterval(dispatch, Math.max(1_000, intervalMs));
    this.#retrySweeper.unref?.();
  }

  stopRetrySweeper() {
    if (this.#retrySweeper) clearInterval(this.#retrySweeper);
    this.#retrySweeper = null;
  }

  async dispatchClaimable() {
    if (this.#dispatchingClaimable) return;
    this.#dispatchingClaimable = true;
    try {
      const captures = await sessionCaptureRepository.listClaimable();
      for (const capture of captures) {
        if (capture.status === "RETRY_WAIT") {
          await this.retry(capture.captureId).catch((error) => {
            console.error(`[lingban-session-capture] automatic retry failed for ${capture.captureId}:`, error);
          });
          continue;
        }
        void runsService.requestSessionCaptureExecution(capture.runId, capture.captureId).catch((error) => {
          console.error(`[lingban-session-capture] claimable dispatch failed for ${capture.captureId}:`, error);
        });
      }
    } finally {
      this.#dispatchingClaimable = false;
    }
  }

  async create(runId: string, input: CreateSessionCaptureInput, requestedByUserId: string | null) {
    if (!getApiRuntimeConfig().sessionCaptureV2Enabled) {
      throw new AppError(503, "SESSION_CAPTURE_V2_DISABLED", "Session Capture v2 is disabled");
    }
    const parsed = createSessionCaptureInputSchema.parse(input);
    const snapshot = runsService.getRun(runId);
    verifyCaptureAllowed(snapshot, parsed);
    const at = nowIso();
    const record = sessionCaptureRecordSchema.parse({
      captureId: `cap_${randomUUID()}`,
      runId,
      workspaceId: snapshot.run.workspaceId,
      requestedByUserId,
      mode: parsed.mode,
      requestedThroughTurnId: parsed.throughTurnId ?? snapshot.agentThread?.currentTurnId ?? null,
      status: "REQUESTED",
      workspaceSelection: parsed.workspaceSelection,
      destinationSessionId: parsed.destinationSessionId,
      createDraft: parsed.createDraft,
      requestedAt: at,
      updatedAt: at,
    });
    const created = await sessionCaptureRepository.create({
      record,
      idempotencyKey: parsed.idempotencyKey,
      requestedTurnId: record.requestedThroughTurnId,
    });
    if (created.captureId === record.captureId) sessionControlMetrics.captureRequested();
    await this.#syncRunSummaries(runId);
    void runsService.requestSessionCaptureExecution(runId, created.captureId).catch((error) => {
      console.error(`[lingban-session-capture] dispatch failed for ${created.captureId}:`, error);
    });
    return { capture: created, statusUrl: `/v1/session-captures/${created.captureId}` };
  }

  async get(captureId: string) {
    const capture = await sessionCaptureRepository.get(captureId);
    if (!capture) throw new AppError(404, "SESSION_CAPTURE_NOT_FOUND", `Session capture not found: ${captureId}`);
    return capture;
  }

  async listForRun(runId: string) {
    runsService.getRun(runId);
    return sessionCaptureRepository.listByRunId(runId);
  }

  async listForWorkspace(workspaceId: string) {
    return sessionCaptureRepository.listByWorkspaceId(workspaceId);
  }

  async retry(captureId: string) {
    if (!getApiRuntimeConfig().sessionCaptureV2Enabled) {
      throw new AppError(503, "SESSION_CAPTURE_V2_DISABLED", "Session Capture v2 is disabled");
    }
    const current = await this.get(captureId);
    if (current.status !== "FAILED" && current.status !== "RETRY_WAIT") {
      throw new AppError(409, "RUN_CAPTURE_RETRY_NOT_ALLOWED", `Capture cannot be retried from ${current.status}`);
    }
    const next = transition(current, "REQUESTED", {
      statusReason: null,
      errorCode: null,
      diagnosticId: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      nextRetryAt: null,
    });
    const updated = await sessionCaptureRepository.update(next, current.version);
    if (!updated) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Capture changed concurrently: ${captureId}`);
    sessionControlMetrics.captureRetried();
    await this.#syncRunSummaries(current.runId);
    void runsService.requestSessionCaptureExecution(current.runId, updated.captureId).catch((error) => {
      console.error(`[lingban-session-capture] retry dispatch failed for ${updated.captureId}:`, error);
    });
    return updated;
  }

  async listClaimable(runId?: string) {
    if (!getApiRuntimeConfig().sessionCaptureV2Enabled) return [];
    return sessionCaptureRepository.listClaimable(runId);
  }

  async authorizeObjectDownload(input: {
    captureId: string;
    objectType: SessionCaptureObject["objectType"];
    actorUserId: string;
    reason: string;
  }) {
    const capture = await this.get(input.captureId);
    if (capture.status !== "CAPTURED") {
      throw new AppError(409, "SESSION_CAPTURE_NOT_READY", `Capture is unavailable for download: ${capture.status}`);
    }
    const objectType = sessionCaptureObjectTypeSchema.parse(input.objectType);
    const object = capture.objects.find((item) => item.objectType === objectType);
    if (!object) {
      throw new AppError(404, "SESSION_CAPTURE_OBJECT_NOT_FOUND", `Capture object is unavailable: ${objectType}`);
    }
    const config = getApiRuntimeConfig();
    const requestedAt = nowIso();
    const expiresAt = new Date(Date.parse(requestedAt) + config.objectStorageSignedUrlTtlSeconds * 1000).toISOString();
    const downloadUrl = await objectStore.createDownloadUrl?.({
      objectKey: object.objectKey,
      fileName: `${capture.captureId}-${object.objectType}`,
      contentType: object.contentType,
      expiresInSeconds: config.objectStorageSignedUrlTtlSeconds,
    }) ?? null;
    const audit = sessionCaptureObjectAccessAuditSchema.parse({
      auditId: `scaa_${randomUUID()}`,
      captureId: capture.captureId,
      workspaceId: capture.workspaceId,
      objectType,
      objectSha256: object.sha256,
      actorUserId: input.actorUserId,
      reason: input.reason,
      accessMode: downloadUrl ? "signed-url" : "proxy",
      requestedAt,
      expiresAt: downloadUrl ? expiresAt : null,
    });
    await sessionCaptureRepository.recordObjectAccess(audit);
    sessionControlMetrics.rawCaptureAccess(objectType, audit.accessMode);
    return { capture, object, audit, downloadUrl, expiresAt: downloadUrl ? expiresAt : null };
  }

  async listObjectAccessAudit(captureId: string): Promise<SessionCaptureObjectAccessAudit[]> {
    await this.get(captureId);
    return sessionCaptureRepository.listObjectAccessAudit(captureId);
  }

  async getCleanupGate(runId: string) {
    const captures = await sessionCaptureRepository.listByRunId(runId);
    const blockingCaptureIds = captures
      .filter((capture) => !["CAPTURED", "FAILED", "CANCELLED"].includes(capture.status))
      .map((capture) => capture.captureId);
    return {
      runId,
      allowed: blockingCaptureIds.length === 0,
      blockingCaptureIds,
      evaluatedAt: nowIso(),
    };
  }

  async acquireLease(captureId: string, workerId: string, leaseSeconds: number) {
    const claimed = await sessionCaptureRepository.claim(captureId, workerId, leaseSeconds);
    if (!claimed) throw new AppError(409, "RUN_CAPTURE_LEASE_UNAVAILABLE", `Capture lease is unavailable: ${captureId}`);
    await this.#syncRunSummaries(claimed.runId);
    return sessionCaptureLeaseSchema.parse({
      captureId: claimed.captureId,
      runId: claimed.runId,
      workerId,
      leaseGeneration: claimed.leaseGeneration,
      leaseExpiresAt: claimed.leaseExpiresAt,
      workspaceSelection: claimed.workspaceSelection,
      requestedBoundaryTurnId: claimed.requestedThroughTurnId,
    });
  }

  async submitBarrier(captureId: string, input: SubmitSessionCaptureBarrierInput) {
    const parsed = submitSessionCaptureBarrierInputSchema.parse(input);
    const current = await this.get(captureId);
    requireLease(current, parsed.workerId, parsed.leaseGeneration);
    const boundary = sessionCaptureBoundarySchema.parse(parsed.boundary);
    if (current.requestedThroughTurnId && current.requestedThroughTurnId !== boundary.throughTurnId) {
      throw new AppError(409, "RUN_CAPTURE_BARRIER_MISMATCH", `Capture boundary turn does not match the requested turn: ${captureId}`);
    }
    const thread = await agentRuntimeRepository.getThreadByRunId(current.runId);
    if (!thread || thread.threadId !== boundary.threadId || thread.eventHighWatermark < boundary.eventHighWatermark) {
      throw new AppError(409, "RUN_CAPTURE_BARRIER_NOT_REACHED", `Agent event barrier is unavailable: ${captureId}`);
    }
    const next = transition(current, "CAPTURING_EVENTS", { boundary });
    const updated = await sessionCaptureRepository.update(next, current.version);
    if (!updated) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Capture changed concurrently: ${captureId}`);
    await this.#syncRunSummaries(current.runId);
    return updated;
  }

  async getEvidence(captureId: string, workerId: string, leaseGeneration: number) {
    const capture = await this.get(captureId);
    requireLease(capture, workerId, leaseGeneration);
    if (!capture.boundary) throw new AppError(409, "RUN_CAPTURE_BARRIER_REQUIRED", `Capture barrier is missing: ${captureId}`);
    const [thread, events] = await Promise.all([
      agentRuntimeRepository.getThreadByRunId(capture.runId),
      agentRuntimeRepository.listEvents(capture.runId, { throughSequence: capture.boundary.eventHighWatermark }),
    ]);
    return { capture, thread, events, run: runsService.getRun(capture.runId) };
  }

  async uploadObject(captureId: string, input: {
    workerId: string;
    leaseGeneration: number;
    objectType: SessionCaptureObject["objectType"];
    contentType: string;
    expectedSha256: string;
    content: Buffer;
  }) {
    const current = await this.get(captureId);
    requireLease(current, input.workerId, input.leaseGeneration);
    const actualSha256 = createHash("sha256").update(input.content).digest("hex");
    if (actualSha256 !== input.expectedSha256) {
      throw new AppError(409, "RUN_CAPTURE_HASH_MISMATCH", `Capture object hash mismatch: ${input.objectType}`);
    }
    const descriptor = sessionCaptureObjectSchema.parse({
      objectType: input.objectType,
      objectKey: "pending",
      sha256: actualSha256,
      sizeBytes: input.content.byteLength,
      contentType: input.contentType,
    });
    const objectKey = contentAddressedObjectKey(captureId, descriptor);
    let stored;
    try {
      stored = await objectStore.putBufferImmutable(objectKey, {
        content: input.content,
        contentType: input.contentType,
      });
    } catch (error) {
      if (error instanceof ObjectStoreImmutableConflictError) {
        throw new AppError(409, "RUN_CAPTURE_HASH_MISMATCH", `Immutable capture object conflict: ${input.objectType}`);
      }
      throw error;
    }
    if (stored.sha256 !== actualSha256 || stored.sizeBytes !== input.content.byteLength) {
      throw new AppError(409, "RUN_CAPTURE_HASH_MISMATCH", `Stored capture object failed verification: ${input.objectType}`);
    }
    sessionControlMetrics.captureObjectUploaded(input.objectType, input.content.byteLength);
    const object = sessionCaptureObjectSchema.parse({ ...descriptor, objectKey });
    const objects = [...current.objects.filter((item) => item.objectType !== object.objectType), object];
    const targetStatus = current.status === "CAPTURING_EVENTS" || current.status === "CAPTURING_WORKSPACE" ? "UPLOADING" : current.status;
    const next = transition(current, targetStatus, {
      objects,
      capturedBytes: objects.reduce((total, item) => total + item.sizeBytes, 0),
    });
    const updated = await sessionCaptureRepository.update(next, current.version);
    if (!updated) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Capture changed concurrently: ${captureId}`);
    return { capture: updated, object };
  }

  async heartbeat(captureId: string, input: HeartbeatSessionCaptureInput) {
    const parsed = heartbeatSessionCaptureInputSchema.parse(input);
    const current = await this.get(captureId);
    requireLease(current, parsed.workerId, parsed.leaseGeneration);
    const now = new Date();
    const next = transition(current, parsed.stage, {
      capturedBytes: Math.max(current.capturedBytes, parsed.capturedBytes),
      leaseExpiresAt: new Date(now.getTime() + 120_000).toISOString(),
    });
    const updated = await sessionCaptureRepository.update(next, current.version);
    if (!updated) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Capture changed concurrently: ${captureId}`);
    return updated;
  }

  async complete(captureId: string, input: CompleteSessionCaptureInput) {
    const parsed = completeSessionCaptureInputSchema.parse(input);
    const current = await this.get(captureId);
    requireLease(current, parsed.workerId, parsed.leaseGeneration);
    if (!current.boundary || current.boundary.eventHighWatermark !== parsed.boundary.eventHighWatermark) {
      throw new AppError(409, "RUN_CAPTURE_BARRIER_MISMATCH", `Capture completion boundary mismatch: ${captureId}`);
    }
    const expectedByType = new Map(current.objects.map((object) => [object.objectType, object]));
    for (const object of parsed.objects) {
      const uploaded = expectedByType.get(object.objectType);
      if (!uploaded || uploaded.sha256 !== object.sha256 || uploaded.objectKey !== object.objectKey) {
        throw new AppError(409, "RUN_CAPTURE_HASH_MISMATCH", `Capture completion object mismatch: ${object.objectType}`);
      }
    }
    const verifying = transition(current, "VERIFYING");
    const verified = await sessionCaptureRepository.update(verifying, current.version);
    if (!verified) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Capture changed concurrently: ${captureId}`);
    const completed = transition(verified, "CAPTURED", {
      boundary: parsed.boundary,
      objects: parsed.objects,
      captureManifestSha256: parsed.captureManifestSha256,
      eventCount: parsed.eventCount,
      messageCount: parsed.messageCount,
      toolEventCount: parsed.toolEventCount,
      fileCount: parsed.fileCount,
      artifactCount: parsed.artifactCount,
      capturedBytes: parsed.objects.reduce((total, object) => total + object.sizeBytes, 0),
      securityState: "clean",
      capturedAt: parsed.capturedAt,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    const saved = await sessionCaptureRepository.complete(completed, verified.version);
    if (!saved) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Capture changed concurrently: ${captureId}`);
    sessionControlMetrics.captureCompleted({
      requestedAt: saved.requestedAt,
      capturedAt: saved.capturedAt!,
      fileCount: saved.fileCount,
    });
    await this.#syncRunSummaries(current.runId);
    await import("../session-projects/service.js")
      .then(({ sessionProjectsService }) =>
        sessionProjectsService.recordCapture(saved.runId, saved.captureId)
      )
      .catch((error) =>
        console.error(`[lingban-session-capture] project capture sync failed for ${saved.captureId}:`, error)
      );
    if (saved.createDraft) {
      void import("../session-drafts/service.js")
        .then(async ({ sessionDraftService }) => {
          const created = await sessionDraftService.createFromCapture(saved.captureId, {
            sessionId: saved.destinationSessionId,
            sessionName: null,
            sessionDescription: "",
            taskFamily:
              runsService.getRun(saved.runId).run.taskVersionId ??
              runsService.getRun(saved.runId).run.sessionProjectId ??
              "creator-source",
            parentSessionVersionId: null,
            idempotencyKey: `capture:${saved.captureId}:default-draft`,
          }, saved.requestedByUserId);
          await import("../session-projects/service.js")
            .then(({ sessionProjectsService }) =>
              sessionProjectsService.recordDraft(saved.runId, saved.captureId, created.draft.draftId)
            );
          await sessionDraftService.createRevision(created.draft.draftId, {
            expectedVersion: created.draft.version,
            workspaceSelection: saved.workspaceSelection,
            redactionRules: [],
          }, saved.requestedByUserId);
        })
        .catch((error) => console.error(`[lingban-session-capture] default draft failed for ${saved.captureId}:`, error));
    }
    if (saved.mode === "terminal") {
      await runsService.finalizeAfterSessionCapture(saved.runId, saved.captureId);
    }
    return saved;
  }

  async fail(captureId: string, input: FailSessionCaptureInput) {
    const parsed = failSessionCaptureInputSchema.parse(input);
    const current = await this.get(captureId);
    requireLease(current, parsed.workerId, parsed.leaseGeneration);
    const retryAt = parsed.retryable ? new Date(Date.now() + Math.min(60_000, 2 ** Math.min(current.attemptCount, 8) * 1000)).toISOString() : null;
    const next = transition(current, parsed.retryable ? "RETRY_WAIT" : "FAILED", {
      statusReason: parsed.reason,
      errorCode: parsed.errorCode,
      diagnosticId: parsed.diagnosticId,
      nextRetryAt: retryAt,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    const updated = await sessionCaptureRepository.update(next, current.version);
    if (!updated) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Capture changed concurrently: ${captureId}`);
    sessionControlMetrics.captureFailed(parsed.errorCode);
    await this.#syncRunSummaries(current.runId);
    return updated;
  }

  async #syncRunSummaries(runId: string) {
    const captures = await sessionCaptureRepository.listByRunId(runId);
    await runsService.syncSessionCaptures(runId, captures.map((capture) => sessionCaptureSummarySchema.parse(capture)));
  }
}

export const sessionCaptureService = new SessionCaptureService();
