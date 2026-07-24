import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  conversationShareAccessRecordSchema,
  conversationShareFileSchema,
  conversationShareMessageSchema,
  conversationShareSummarySchema,
  type ConversationShareAccessRecord,
  type ConversationShareFile,
  type ConversationShareMessage,
  type ConversationShareSummary,
} from "@lingban/contracts";
import { buildAtomicTempPath } from "@lingban/shared";
import { z } from "zod";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

export const storedConversationShareFileSchema = z.object({
  file: conversationShareFileSchema,
  objectKey: z.string().trim().min(1).max(1024).nullable().default(null),
});

export const storedConversationShareSchema = z.object({
  summary: conversationShareSummarySchema,
  messages: z.array(conversationShareMessageSchema),
  files: z.array(storedConversationShareFileSchema),
  idempotencyKey: z.string().trim().min(8).max(240),
});

const conversationSharesStateSchema = z.object({
  shares: z.array(storedConversationShareSchema).default([]),
  accessRecords: z.array(conversationShareAccessRecordSchema).default([]),
});

export type StoredConversationShareFile = z.infer<typeof storedConversationShareFileSchema>;
export type StoredConversationShare = z.infer<typeof storedConversationShareSchema>;
type ConversationSharesState = z.infer<typeof conversationSharesStateSchema>;

export interface ConversationSharesRepository {
  init(): Promise<void>;
  create(record: StoredConversationShare): Promise<StoredConversationShare>;
  get(shareId: string): Promise<StoredConversationShare | null>;
  listByRunId(runId: string): Promise<StoredConversationShare[]>;
  save(record: StoredConversationShare): Promise<StoredConversationShare>;
  recordAccess(record: ConversationShareAccessRecord): Promise<void>;
  listAccess(shareId: string): Promise<ConversationShareAccessRecord[]>;
}

function sortShares(items: StoredConversationShare[]) {
  return [...items].sort(
    (left, right) =>
      right.summary.createdAt.localeCompare(left.summary.createdAt) ||
      left.summary.shareId.localeCompare(right.summary.shareId)
  );
}

class FileBackedConversationSharesRepository implements ConversationSharesRepository {
  #statePath: string;
  #state: ConversationSharesState = conversationSharesStateSchema.parse({});
  #initialized = false;
  #writeChain = Promise.resolve();

  constructor(storageDir = resolveApiStorageDir("conversation-shares")) {
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "conversation-shares-state.json");
  }

  async init() {
    if (this.#initialized) return;
    try {
      this.#state = conversationSharesStateSchema.parse(
        JSON.parse(readFileSync(this.#statePath, "utf8"))
      );
    } catch {
      this.#state = conversationSharesStateSchema.parse({});
    }
    this.#initialized = true;
  }

  async #persist() {
    const snapshot = conversationSharesStateSchema.parse(this.#state);
    this.#writeChain = this.#writeChain.then(async () => {
      const temporaryPath = buildAtomicTempPath(this.#statePath);
      await fs.writeFile(temporaryPath, JSON.stringify(snapshot, null, 2), "utf8");
      renameSync(temporaryPath, this.#statePath);
    });
    await this.#writeChain;
  }

  async create(record: StoredConversationShare) {
    await this.init();
    const parsed = storedConversationShareSchema.parse(record);
    const existing = this.#state.shares.find(
      (item) =>
        item.summary.workspaceId === parsed.summary.workspaceId &&
        item.summary.runId === parsed.summary.runId &&
        item.idempotencyKey === parsed.idempotencyKey
    );
    if (existing) return existing;
    this.#state = conversationSharesStateSchema.parse({
      ...this.#state,
      shares: [...this.#state.shares, parsed],
    });
    await this.#persist();
    return parsed;
  }

  async get(shareId: string) {
    await this.init();
    return this.#state.shares.find((item) => item.summary.shareId === shareId) ?? null;
  }

  async listByRunId(runId: string) {
    await this.init();
    return sortShares(this.#state.shares.filter((item) => item.summary.runId === runId));
  }

  async save(record: StoredConversationShare) {
    await this.init();
    const parsed = storedConversationShareSchema.parse(record);
    const index = this.#state.shares.findIndex(
      (item) => item.summary.shareId === parsed.summary.shareId
    );
    if (index < 0) throw new Error(`Conversation share does not exist: ${parsed.summary.shareId}`);
    const shares = [...this.#state.shares];
    shares[index] = parsed;
    this.#state = conversationSharesStateSchema.parse({ ...this.#state, shares });
    await this.#persist();
    return parsed;
  }

  async recordAccess(record: ConversationShareAccessRecord) {
    await this.init();
    const parsed = conversationShareAccessRecordSchema.parse(record);
    this.#state = conversationSharesStateSchema.parse({
      ...this.#state,
      accessRecords: [...this.#state.accessRecords, parsed],
    });
    await this.#persist();
  }

  async listAccess(shareId: string) {
    await this.init();
    return this.#state.accessRecords
      .filter((item) => item.shareId === shareId)
      .sort((left, right) => right.accessedAt.localeCompare(left.accessedAt));
  }
}

class PostgresConversationSharesRepository implements ConversationSharesRepository {
  async init() {
    await ensureApiDatabaseReady();
  }

  async create(record: StoredConversationShare) {
    const parsed = storedConversationShareSchema.parse(record);
    await this.init();
    const pool = getApiDatabasePool();
    await pool.query(
      `
      INSERT INTO lingban_conversation_shares (
        share_id, run_id, workspace_id, source_type, capture_id, access_scope,
        status, created_by_user_id, created_at, expires_at, revoked_at,
        idempotency_key, record_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      ON CONFLICT (workspace_id, run_id, idempotency_key) DO NOTHING
      `,
      [
        parsed.summary.shareId,
        parsed.summary.runId,
        parsed.summary.workspaceId,
        parsed.summary.sourceType,
        parsed.summary.captureId,
        parsed.summary.accessScope,
        parsed.summary.status,
        parsed.summary.createdByUserId,
        parsed.summary.createdAt,
        parsed.summary.expiresAt,
        parsed.summary.revokedAt,
        parsed.idempotencyKey,
        JSON.stringify(parsed),
      ]
    );
    const result = await pool.query<{ record_json: StoredConversationShare }>(
      `
      SELECT record_json
      FROM lingban_conversation_shares
      WHERE workspace_id = $1 AND run_id = $2 AND idempotency_key = $3
      `,
      [parsed.summary.workspaceId, parsed.summary.runId, parsed.idempotencyKey]
    );
    return storedConversationShareSchema.parse(result.rows[0]?.record_json);
  }

  async get(shareId: string) {
    await this.init();
    const result = await getApiDatabasePool().query<{ record_json: StoredConversationShare }>(
      "SELECT record_json FROM lingban_conversation_shares WHERE share_id = $1",
      [shareId]
    );
    return result.rows[0] ? storedConversationShareSchema.parse(result.rows[0].record_json) : null;
  }

  async listByRunId(runId: string) {
    await this.init();
    const result = await getApiDatabasePool().query<{ record_json: StoredConversationShare }>(
      `
      SELECT record_json
      FROM lingban_conversation_shares
      WHERE run_id = $1
      ORDER BY created_at DESC, share_id ASC
      `,
      [runId]
    );
    return result.rows.map((row) => storedConversationShareSchema.parse(row.record_json));
  }

  async save(record: StoredConversationShare) {
    const parsed = storedConversationShareSchema.parse(record);
    await this.init();
    const result = await getApiDatabasePool().query<{ record_json: StoredConversationShare }>(
      `
      UPDATE lingban_conversation_shares
      SET status = $2, revoked_at = $3, record_json = $4::jsonb
      WHERE share_id = $1
      RETURNING record_json
      `,
      [
        parsed.summary.shareId,
        parsed.summary.status,
        parsed.summary.revokedAt,
        JSON.stringify(parsed),
      ]
    );
    return storedConversationShareSchema.parse(result.rows[0]?.record_json);
  }

  async recordAccess(record: ConversationShareAccessRecord) {
    const parsed = conversationShareAccessRecordSchema.parse(record);
    await this.init();
    await getApiDatabasePool().query(
      `
      INSERT INTO lingban_conversation_share_access (
        access_id, share_id, access_type, file_id, actor_user_id,
        viewer_type, client_fingerprint, accessed_at, record_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        parsed.accessId,
        parsed.shareId,
        parsed.accessType,
        parsed.fileId,
        parsed.actorUserId,
        parsed.viewerType,
        parsed.clientFingerprint,
        parsed.accessedAt,
        JSON.stringify(parsed),
      ]
    );
  }

  async listAccess(shareId: string) {
    await this.init();
    const result = await getApiDatabasePool().query<{
      record_json: ConversationShareAccessRecord;
    }>(
      `
      SELECT record_json
      FROM lingban_conversation_share_access
      WHERE share_id = $1
      ORDER BY accessed_at DESC, access_id ASC
      `,
      [shareId]
    );
    return result.rows.map((row) => conversationShareAccessRecordSchema.parse(row.record_json));
  }
}

function buildConversationSharesRepository(): ConversationSharesRepository {
  return getApiRuntimeConfig().runsStore === "postgres"
    ? new PostgresConversationSharesRepository()
    : new FileBackedConversationSharesRepository();
}

export const conversationSharesRepository = buildConversationSharesRepository();

export async function initializeConversationSharesRepository() {
  await conversationSharesRepository.init();
}

export type { ConversationShareFile, ConversationShareMessage, ConversationShareSummary };
