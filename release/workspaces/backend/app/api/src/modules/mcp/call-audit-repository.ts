import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import type { ListMcpCallsQuery, McpCallRecord } from "@lingban/contracts";
import { mcpCallRecordSchema } from "@lingban/contracts";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

export interface McpCallAuditRepository {
  init(): Promise<void>;
  list(): McpCallRecord[];
  getById(callId: string): McpCallRecord | null;
  save(record: McpCallRecord): Promise<void>;
  clear(): Promise<void>;
}

function replaceByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const key = getKey(nextItem);
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex((item) => getKey(item) === key);

  if (existingIndex >= 0) {
    nextItems[existingIndex] = nextItem;
    return nextItems;
  }

  nextItems.push(nextItem);
  return nextItems;
}

abstract class CachedMcpCallAuditRepository implements McpCallAuditRepository {
  #records: McpCallRecord[] = [];
  #initialized = false;

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#records = (await this.loadAll()).map((record) => mcpCallRecordSchema.parse(record));
    this.#initialized = true;
  }

  list() {
    return [...this.#records].sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        left.callId.localeCompare(right.callId)
    );
  }

  getById(callId: string) {
    return this.#records.find((item) => item.callId === callId) ?? null;
  }

  async save(record: McpCallRecord) {
    const parsed = mcpCallRecordSchema.parse(record);
    this.#records = replaceByKey(this.#records, parsed, (item) => item.callId);
    await this.persist(parsed);
  }

  async clear() {
    this.#records = [];
    await this.clearStorage();
  }

  protected abstract loadAll(): Promise<McpCallRecord[]>;
  protected abstract persist(record: McpCallRecord): Promise<void>;
  protected abstract clearStorage(): Promise<void>;
}

class FileBackedMcpCallAuditRepository extends CachedMcpCallAuditRepository {
  #storageDir: string;

  constructor(storageDir = resolveApiStorageDir("mcp-call-audits")) {
    super();
    this.#storageDir = storageDir;
    mkdirSync(this.#storageDir, { recursive: true });
  }

  #getRecordPath(callId: string) {
    return path.join(this.#storageDir, `${callId}.json`);
  }

  protected async loadAll() {
    const files = readdirSync(this.#storageDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    return files.map((fileName) => {
      const raw = readFileSync(path.join(this.#storageDir, fileName), "utf8");
      return mcpCallRecordSchema.parse(JSON.parse(raw) as unknown);
    });
  }

  protected async persist(record: McpCallRecord) {
    const filePath = this.#getRecordPath(record.callId);
    const tempPath = buildAtomicTempPath(filePath);
    await fs.writeFile(tempPath, JSON.stringify(record, null, 2), "utf8");
    renameSync(tempPath, filePath);
  }

  protected async clearStorage() {
    for (const entry of readdirSync(this.#storageDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      try {
        unlinkSync(path.join(this.#storageDir, entry.name));
      } catch {
        // Ignore missing files during cleanup.
      }
    }
  }
}

class PostgresMcpCallAuditRepository extends CachedMcpCallAuditRepository {
  protected async loadAll() {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();
    const result = await pool.query<{ call_json: McpCallRecord }>(
      `
      SELECT call_json
      FROM lingban_mcp_call_audits
      ORDER BY occurred_at DESC, call_id ASC
      `
    );

    return result.rows.map((row) => mcpCallRecordSchema.parse(row.call_json));
  }

  protected async persist(record: McpCallRecord) {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();

    await pool.query(
      `
      INSERT INTO lingban_mcp_call_audits (
        call_id,
        run_id,
        workspace_id,
        mcp_id,
        tool_name,
        status,
        occurred_at,
        call_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (call_id)
      DO UPDATE SET
        run_id = EXCLUDED.run_id,
        workspace_id = EXCLUDED.workspace_id,
        mcp_id = EXCLUDED.mcp_id,
        tool_name = EXCLUDED.tool_name,
        status = EXCLUDED.status,
        occurred_at = EXCLUDED.occurred_at,
        call_json = EXCLUDED.call_json
      `,
      [
        record.callId,
        record.runId,
        record.workspaceId,
        record.mcpId,
        record.toolName,
        record.status,
        record.occurredAt,
        JSON.stringify(record),
      ]
    );
  }

  protected async clearStorage() {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();
    await pool.query("DELETE FROM lingban_mcp_call_audits");
  }
}

function buildMcpCallAuditRepository(): McpCallAuditRepository {
  const config = getApiRuntimeConfig();
  return config.mcpStore === "postgres"
    ? new PostgresMcpCallAuditRepository()
    : new FileBackedMcpCallAuditRepository();
}

export const mcpCallAuditRepository = buildMcpCallAuditRepository();
