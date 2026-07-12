import { mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import type { McpGovernanceEvent } from "@lingban/contracts";
import { mcpGovernanceEventSchema } from "@lingban/contracts";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

export interface McpGovernanceAuditRepository {
  init(): Promise<void>;
  list(): McpGovernanceEvent[];
  save(record: McpGovernanceEvent): Promise<void>;
}

abstract class CachedMcpGovernanceAuditRepository
  implements McpGovernanceAuditRepository
{
  #records: McpGovernanceEvent[] = [];
  #initialized = false;

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#records = (await this.loadAll()).map((record) =>
      mcpGovernanceEventSchema.parse(record)
    );
    this.#initialized = true;
  }

  list() {
    return [...this.#records].sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        left.eventId.localeCompare(right.eventId)
    );
  }

  async save(record: McpGovernanceEvent) {
    const parsed = mcpGovernanceEventSchema.parse(record);
    this.#records = [...this.#records, parsed];
    await this.persist(parsed);
  }

  protected abstract loadAll(): Promise<McpGovernanceEvent[]>;
  protected abstract persist(record: McpGovernanceEvent): Promise<void>;
}

class FileBackedMcpGovernanceAuditRepository extends CachedMcpGovernanceAuditRepository {
  #storageDir: string;

  constructor(storageDir = resolveApiStorageDir("mcp-governance-events")) {
    super();
    this.#storageDir = storageDir;
    mkdirSync(this.#storageDir, { recursive: true });
  }

  #getRecordPath(eventId: string) {
    return path.join(this.#storageDir, `${eventId}.json`);
  }

  protected async loadAll() {
    const files = readdirSync(this.#storageDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    return files.map((fileName) => {
      const raw = readFileSync(path.join(this.#storageDir, fileName), "utf8");
      return mcpGovernanceEventSchema.parse(JSON.parse(raw) as unknown);
    });
  }

  protected async persist(record: McpGovernanceEvent) {
    const filePath = this.#getRecordPath(record.eventId);
    const tempPath = buildAtomicTempPath(filePath);
    await fs.writeFile(tempPath, JSON.stringify(record, null, 2), "utf8");
    renameSync(tempPath, filePath);
  }
}

class PostgresMcpGovernanceAuditRepository extends CachedMcpGovernanceAuditRepository {
  protected async loadAll() {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();
    const result = await pool.query<{ event_json: McpGovernanceEvent }>(
      `
      SELECT event_json
      FROM lingban_mcp_governance_events
      ORDER BY occurred_at DESC, event_id ASC
      `
    );

    return result.rows.map((row) => mcpGovernanceEventSchema.parse(row.event_json));
  }

  protected async persist(record: McpGovernanceEvent) {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();

    await pool.query(
      `
      INSERT INTO lingban_mcp_governance_events (
        event_id,
        workspace_id,
        run_id,
        mcp_id,
        binding_id,
        action,
        outcome,
        occurred_at,
        event_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (event_id)
      DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        run_id = EXCLUDED.run_id,
        mcp_id = EXCLUDED.mcp_id,
        binding_id = EXCLUDED.binding_id,
        action = EXCLUDED.action,
        outcome = EXCLUDED.outcome,
        occurred_at = EXCLUDED.occurred_at,
        event_json = EXCLUDED.event_json
      `,
      [
        record.eventId,
        record.workspaceId,
        record.runId,
        record.mcpId,
        record.bindingId,
        record.action,
        record.outcome,
        record.occurredAt,
        JSON.stringify(record),
      ]
    );
  }
}

function buildMcpGovernanceAuditRepository(): McpGovernanceAuditRepository {
  const config = getApiRuntimeConfig();
  return config.mcpStore === "postgres"
    ? new PostgresMcpGovernanceAuditRepository()
    : new FileBackedMcpGovernanceAuditRepository();
}

export const mcpGovernanceAuditRepository = buildMcpGovernanceAuditRepository();
