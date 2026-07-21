import {
  sessionCaptureObjectAccessAuditSchema,
  sessionCaptureRecordSchema,
  type SessionCaptureObjectAccessAudit,
  type SessionCaptureRecord,
} from "@lingban/contracts";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export type CreateSessionCaptureRecordInput = {
  record: SessionCaptureRecord;
  idempotencyKey: string;
  requestedTurnId: string | null;
};

export interface SessionCaptureRepository {
  create(input: CreateSessionCaptureRecordInput): Promise<SessionCaptureRecord>;
  get(captureId: string): Promise<SessionCaptureRecord | null>;
  listByRunId(runId: string): Promise<SessionCaptureRecord[]>;
  listByWorkspaceId(workspaceId: string): Promise<SessionCaptureRecord[]>;
  listClaimable(runId?: string): Promise<SessionCaptureRecord[]>;
  claim(captureId: string, workerId: string, leaseSeconds: number): Promise<SessionCaptureRecord | null>;
  update(record: SessionCaptureRecord, expectedVersion: number): Promise<SessionCaptureRecord | null>;
  complete(record: SessionCaptureRecord, expectedVersion: number): Promise<SessionCaptureRecord | null>;
  recordObjectAccess(audit: SessionCaptureObjectAccessAudit): Promise<SessionCaptureObjectAccessAudit>;
  listObjectAccessAudit(captureId: string): Promise<SessionCaptureObjectAccessAudit[]>;
}

export class InMemorySessionCaptureRepository implements SessionCaptureRepository {
  #records = new Map<string, SessionCaptureRecord>();
  #idempotency = new Map<string, string>();
  #objectAccessAudit: SessionCaptureObjectAccessAudit[] = [];

  async create(input: CreateSessionCaptureRecordInput) {
    const parsed = sessionCaptureRecordSchema.parse(input.record);
    const key = `${parsed.workspaceId}:${parsed.runId}:${input.idempotencyKey}`;
    const existingId = this.#idempotency.get(key);
    if (existingId) return this.#records.get(existingId)!;
    this.#records.set(parsed.captureId, parsed);
    this.#idempotency.set(key, parsed.captureId);
    return parsed;
  }

  async get(captureId: string) {
    return this.#records.get(captureId) ?? null;
  }

  async listByRunId(runId: string) {
    return [...this.#records.values()]
      .filter((record) => record.runId === runId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  }

  async listByWorkspaceId(workspaceId: string) {
    return [...this.#records.values()]
      .filter((record) => record.workspaceId === workspaceId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  }

  async listClaimable(runId?: string) {
    const now = Date.now();
    return [...this.#records.values()]
      .filter((record) => !runId || record.runId === runId)
      .filter((record) => record.status === "REQUESTED" || record.status === "RETRY_WAIT")
      .filter((record) => !record.nextRetryAt || Date.parse(record.nextRetryAt) <= now)
      .filter((record) => !record.leaseExpiresAt || Date.parse(record.leaseExpiresAt) <= now)
      .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
  }

  async claim(captureId: string, workerId: string, leaseSeconds: number) {
    const current = this.#records.get(captureId);
    if (!current) return null;
    const now = new Date();
    if (
      (current.status !== "REQUESTED" && current.status !== "RETRY_WAIT") ||
      (current.leaseExpiresAt && Date.parse(current.leaseExpiresAt) > now.getTime())
    ) return null;
    const next = sessionCaptureRecordSchema.parse({
      ...current,
      status: "WAITING_BARRIER",
      leaseOwner: workerId,
      leaseGeneration: current.leaseGeneration + 1,
      leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000).toISOString(),
      attemptCount: current.attemptCount + 1,
      nextRetryAt: null,
      version: current.version + 1,
      updatedAt: now.toISOString(),
    });
    this.#records.set(captureId, next);
    return next;
  }

  async update(record: SessionCaptureRecord, expectedVersion: number) {
    const current = this.#records.get(record.captureId);
    if (!current || current.version !== expectedVersion) return null;
    const parsed = sessionCaptureRecordSchema.parse(record);
    this.#records.set(parsed.captureId, parsed);
    return parsed;
  }

  async complete(record: SessionCaptureRecord, expectedVersion: number) {
    return this.update(record, expectedVersion);
  }

  async recordObjectAccess(audit: SessionCaptureObjectAccessAudit) {
    const parsed = sessionCaptureObjectAccessAuditSchema.parse(audit);
    if (!this.#objectAccessAudit.some((entry) => entry.auditId === parsed.auditId)) {
      this.#objectAccessAudit.push(parsed);
    }
    return parsed;
  }

  async listObjectAccessAudit(captureId: string) {
    return this.#objectAccessAudit
      .filter((entry) => entry.captureId === captureId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  }
}

type PostgresSessionCaptureRepositoryOptions = PostgresRepositoryOptions & {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
};

export class PostgresSessionCaptureRepository implements SessionCaptureRepository {
  #options: PostgresSessionCaptureRepositoryOptions;

  constructor(options: PostgresSessionCaptureRepositoryOptions) {
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  async create(input: CreateSessionCaptureRecordInput) {
    const parsed = sessionCaptureRecordSchema.parse(input.record);
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionCaptureRecord }>(
      `
      INSERT INTO lingban_session_capture_jobs (
        capture_id, run_id, workspace_id, requested_by_user_id, mode, requested_turn_id,
        status, status_reason, error_code, diagnostic_id, workspace_selection_json,
        destination_session_id, create_draft, idempotency_key, lease_generation,
        lease_owner, lease_expires_at, attempt_count, next_retry_at, version,
        requested_at, updated_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb
      )
      ON CONFLICT (workspace_id, run_id, idempotency_key) DO UPDATE
        SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING record_json
      `,
      [
        parsed.captureId, parsed.runId, parsed.workspaceId, parsed.requestedByUserId,
        parsed.mode, input.requestedTurnId, parsed.status, parsed.statusReason,
        parsed.errorCode, parsed.diagnosticId, JSON.stringify(parsed.workspaceSelection),
        parsed.destinationSessionId, parsed.createDraft, input.idempotencyKey,
        parsed.leaseGeneration, parsed.leaseOwner, parsed.leaseExpiresAt,
        parsed.attemptCount, parsed.nextRetryAt, parsed.version, parsed.requestedAt,
        parsed.updatedAt, JSON.stringify(parsed),
      ]
    );
    return sessionCaptureRecordSchema.parse(result.rows[0]!.record_json);
  }

  async get(captureId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionCaptureRecord }>(
      "SELECT record_json FROM lingban_session_capture_jobs WHERE capture_id = $1",
      [captureId]
    );
    return result.rows[0] ? sessionCaptureRecordSchema.parse(result.rows[0].record_json) : null;
  }

  async listByRunId(runId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionCaptureRecord }>(
      "SELECT record_json FROM lingban_session_capture_jobs WHERE run_id = $1 ORDER BY requested_at DESC",
      [runId]
    );
    return result.rows.map((row) => sessionCaptureRecordSchema.parse(row.record_json));
  }

  async listByWorkspaceId(workspaceId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionCaptureRecord }>(
      "SELECT record_json FROM lingban_session_capture_jobs WHERE workspace_id = $1 ORDER BY requested_at DESC",
      [workspaceId]
    );
    return result.rows.map((row) => sessionCaptureRecordSchema.parse(row.record_json));
  }

  async listClaimable(runId?: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionCaptureRecord }>(
      `
      SELECT record_json
      FROM lingban_session_capture_jobs
      WHERE status IN ('REQUESTED', 'RETRY_WAIT')
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
        AND ($1::text IS NULL OR run_id = $1)
      ORDER BY requested_at ASC
      `,
      [runId ?? null]
    );
    return result.rows.map((row) => sessionCaptureRecordSchema.parse(row.record_json));
  }

  async claim(captureId: string, workerId: string, leaseSeconds: number) {
    const queryable = await this.#getQueryable();
    const current = await this.get(captureId);
    if (!current) return null;
    const now = new Date();
    const next = sessionCaptureRecordSchema.parse({
      ...current,
      status: "WAITING_BARRIER",
      leaseOwner: workerId,
      leaseGeneration: current.leaseGeneration + 1,
      leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000).toISOString(),
      attemptCount: current.attemptCount + 1,
      nextRetryAt: null,
      version: current.version + 1,
      updatedAt: now.toISOString(),
    });
    const result = await queryable.query<{ record_json: SessionCaptureRecord }>(
      `
      UPDATE lingban_session_capture_jobs
      SET status = $2, lease_owner = $3, lease_generation = $4, lease_expires_at = $5,
          attempt_count = $6, next_retry_at = NULL, version = $7, updated_at = $8,
          record_json = $9::jsonb
      WHERE capture_id = $1 AND version = $10
        AND status IN ('REQUESTED', 'RETRY_WAIT')
        AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
      RETURNING record_json
      `,
      [captureId, next.status, workerId, next.leaseGeneration, next.leaseExpiresAt,
        next.attemptCount, next.version, next.updatedAt, JSON.stringify(next), current.version]
    );
    return result.rows[0] ? sessionCaptureRecordSchema.parse(result.rows[0].record_json) : null;
  }

  async update(record: SessionCaptureRecord, expectedVersion: number) {
    const parsed = sessionCaptureRecordSchema.parse(record);
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionCaptureRecord }>(
      `
      UPDATE lingban_session_capture_jobs
      SET status = $2, status_reason = $3, error_code = $4, diagnostic_id = $5,
          lease_generation = $6, lease_owner = $7, lease_expires_at = $8,
          attempt_count = $9, next_retry_at = $10, version = $11, updated_at = $12,
          record_json = $13::jsonb
      WHERE capture_id = $1 AND version = $14
      RETURNING record_json
      `,
      [parsed.captureId, parsed.status, parsed.statusReason, parsed.errorCode,
        parsed.diagnosticId, parsed.leaseGeneration, parsed.leaseOwner,
        parsed.leaseExpiresAt, parsed.attemptCount, parsed.nextRetryAt, parsed.version,
        parsed.updatedAt, JSON.stringify(parsed), expectedVersion]
    );
    return result.rows[0] ? sessionCaptureRecordSchema.parse(result.rows[0].record_json) : null;
  }

  async complete(record: SessionCaptureRecord, expectedVersion: number) {
    const parsed = sessionCaptureRecordSchema.parse(record);
    if (parsed.status !== "CAPTURED" || !parsed.boundary || !parsed.captureManifestSha256) {
      throw new Error(`Capture completion record is incomplete: ${parsed.captureId}`);
    }
    const boundary = parsed.boundary;
    return this.#options.withTransaction(async (queryable) => {
      const updated = await queryable.query<{ record_json: SessionCaptureRecord }>(
        `
        UPDATE lingban_session_capture_jobs
        SET status = $2, status_reason = NULL, error_code = NULL, diagnostic_id = NULL,
            lease_owner = NULL, lease_expires_at = NULL, version = $3, updated_at = $4,
            record_json = $5::jsonb
        WHERE capture_id = $1 AND version = $6
        RETURNING record_json
        `,
        [parsed.captureId, parsed.status, parsed.version, parsed.updatedAt, JSON.stringify(parsed), expectedVersion]
      );
      if (!updated.rows[0]) return null;
      const manifest = parsed.objects.find((object) => object.objectType === "manifest");
      if (!manifest) throw new Error(`Capture manifest object is missing: ${parsed.captureId}`);
      await queryable.query(
        `
        INSERT INTO lingban_session_captures (
          capture_id, thread_id, through_turn_id, event_high_watermark, barrier_reached_at,
          capture_manifest_object_key, capture_manifest_sha256, event_count, message_count,
          tool_event_count, file_count, artifact_count, captured_bytes, security_state, captured_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (capture_id) DO NOTHING
        `,
        [parsed.captureId, boundary.threadId, boundary.throughTurnId,
          boundary.eventHighWatermark, boundary.barrierReachedAt,
          manifest.objectKey, parsed.captureManifestSha256, parsed.eventCount,
          parsed.messageCount, parsed.toolEventCount, parsed.fileCount,
          parsed.artifactCount, parsed.capturedBytes, parsed.securityState, parsed.capturedAt]
      );
      for (const object of parsed.objects) {
        await queryable.query(
          `
          INSERT INTO lingban_session_capture_objects (
            capture_id, object_type, object_key, sha256, size_bytes, content_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (capture_id, object_type) DO NOTHING
          `,
          [parsed.captureId, object.objectType, object.objectKey, object.sha256,
            object.sizeBytes, object.contentType, parsed.capturedAt]
        );
      }
      return sessionCaptureRecordSchema.parse(updated.rows[0].record_json);
    });
  }

  async recordObjectAccess(audit: SessionCaptureObjectAccessAudit) {
    const parsed = sessionCaptureObjectAccessAuditSchema.parse(audit);
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionCaptureObjectAccessAudit }>(
      `
      INSERT INTO lingban_session_capture_access_audit (
        audit_id, capture_id, workspace_id, object_type, object_sha256,
        actor_user_id, reason, access_mode, requested_at, expires_at, record_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      ON CONFLICT (audit_id) DO UPDATE SET audit_id = EXCLUDED.audit_id
      RETURNING record_json
      `,
      [
        parsed.auditId,
        parsed.captureId,
        parsed.workspaceId,
        parsed.objectType,
        parsed.objectSha256,
        parsed.actorUserId,
        parsed.reason,
        parsed.accessMode,
        parsed.requestedAt,
        parsed.expiresAt,
        JSON.stringify(parsed),
      ]
    );
    return sessionCaptureObjectAccessAuditSchema.parse(result.rows[0]!.record_json);
  }

  async listObjectAccessAudit(captureId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionCaptureObjectAccessAudit }>(
      `
      SELECT record_json
      FROM lingban_session_capture_access_audit
      WHERE capture_id = $1
      ORDER BY requested_at DESC
      `,
      [captureId]
    );
    return result.rows.map((row) => sessionCaptureObjectAccessAuditSchema.parse(row.record_json));
  }
}
