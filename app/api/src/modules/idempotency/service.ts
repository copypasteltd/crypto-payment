import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { AppError } from "../../app/errors.js";
import { ensureApiDatabaseReady, getApiDatabasePool, isApiDatabaseEnabled } from "../../app/database.js";

type IdempotencyRecord = {
  requestHash: string;
  state: "pending" | "completed";
  response: unknown;
};

const memoryRecords = new Map<string, IdempotencyRecord>();

function hashRequest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeKey(value: string | string[] | undefined) {
  const key = Array.isArray(value) ? value[0] : value;
  const normalized = key?.trim();
  if (!normalized || normalized.length > 240) {
    throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required");
  }
  return normalized;
}

export function readIdempotencyKey(request: FastifyRequest) {
  return normalizeKey(request.headers["idempotency-key"]);
}

export function readOptionalIdempotencyKey(request: FastifyRequest) {
  const raw = request.headers["idempotency-key"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? normalizeKey(raw) : null;
}

export async function executeIdempotent<T>(input: {
  scope: string;
  key: string;
  actorId: string;
  request: unknown;
  execute: () => Promise<T>;
}): Promise<{ value: T; replayed: boolean }> {
  const requestHash = hashRequest({ actorId: input.actorId, request: input.request });
  const recordKey = `${input.scope}:${input.key}`;
  if (isApiDatabaseEnabled()) {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();
    const inserted = await pool.query(
      `
      INSERT INTO lingban_idempotency_records (
        operation_scope, idempotency_key, actor_id, request_hash, state,
        response_json, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,'pending',NULL,NOW(),NOW())
      ON CONFLICT (operation_scope, idempotency_key) DO NOTHING
      `,
      [input.scope, input.key, input.actorId, requestHash]
    );
    if (inserted.rowCount === 0) {
      const existing = await pool.query<{
        actor_id: string;
        request_hash: string;
        state: "pending" | "completed";
        response_json: T | null;
      }>(
        "SELECT actor_id,request_hash,state,response_json FROM lingban_idempotency_records WHERE operation_scope=$1 AND idempotency_key=$2",
        [input.scope, input.key]
      );
      const row = existing.rows[0];
      if (!row || row.actor_id !== input.actorId || row.request_hash !== requestHash) {
        throw new AppError(409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency-Key is bound to a different request");
      }
      if (row.state !== "completed" || row.response_json === null) {
        throw new AppError(409, "IDEMPOTENCY_REQUEST_IN_PROGRESS", "An identical request is still in progress");
      }
      return { value: row.response_json, replayed: true };
    }
    try {
      const value = await input.execute();
      await pool.query(
        "UPDATE lingban_idempotency_records SET state='completed',response_json=$3::jsonb,updated_at=NOW() WHERE operation_scope=$1 AND idempotency_key=$2",
        [input.scope, input.key, JSON.stringify(value)]
      );
      return { value, replayed: false };
    } catch (error) {
      await pool.query(
        "DELETE FROM lingban_idempotency_records WHERE operation_scope=$1 AND idempotency_key=$2 AND state='pending'",
        [input.scope, input.key]
      ).catch(() => undefined);
      throw error;
    }
  }

  const existing = memoryRecords.get(recordKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AppError(409, "IDEMPOTENCY_KEY_CONFLICT", "Idempotency-Key is bound to a different request");
    }
    if (existing.state !== "completed") {
      throw new AppError(409, "IDEMPOTENCY_REQUEST_IN_PROGRESS", "An identical request is still in progress");
    }
    return { value: existing.response as T, replayed: true };
  }
  memoryRecords.set(recordKey, { requestHash, state: "pending", response: null });
  try {
    const value = await input.execute();
    memoryRecords.set(recordKey, { requestHash, state: "completed", response: value });
    return { value, replayed: false };
  } catch (error) {
    memoryRecords.delete(recordKey);
    throw error;
  }
}
