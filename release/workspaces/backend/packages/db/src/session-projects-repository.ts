import {
  sessionProjectRecordSchema,
  type SessionProjectRecord,
} from "@lingban/contracts";
import type { PostgresRepositoryOptions } from "./postgres-types.js";

export interface SessionProjectsRepository {
  init(): Promise<void>;
  create(record: SessionProjectRecord): Promise<SessionProjectRecord>;
  get(sessionProjectId: string): Promise<SessionProjectRecord | null>;
  findBySessionVersionId(sessionVersionId: string): Promise<SessionProjectRecord | null>;
  listByWorkspaceId(workspaceId: string): Promise<SessionProjectRecord[]>;
  update(record: SessionProjectRecord, expectedVersion: number): Promise<SessionProjectRecord | null>;
}

export class InMemorySessionProjectsRepository implements SessionProjectsRepository {
  #records = new Map<string, SessionProjectRecord>();

  async init() {}

  async create(record: SessionProjectRecord) {
    const parsed = sessionProjectRecordSchema.parse(record);
    const existing = this.#records.get(parsed.sessionProjectId);
    if (existing) return existing;
    this.#records.set(parsed.sessionProjectId, parsed);
    return parsed;
  }

  async get(sessionProjectId: string) {
    return this.#records.get(sessionProjectId) ?? null;
  }

  async findBySessionVersionId(sessionVersionId: string) {
    return [...this.#records.values()].find(
      (record) => record.currentSessionVersionId === sessionVersionId
    ) ?? null;
  }

  async listByWorkspaceId(workspaceId: string) {
    return [...this.#records.values()]
      .filter((record) => record.workspaceId === workspaceId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async update(record: SessionProjectRecord, expectedVersion: number) {
    const current = this.#records.get(record.sessionProjectId);
    if (!current || current.version !== expectedVersion) return null;
    const parsed = sessionProjectRecordSchema.parse(record);
    this.#records.set(parsed.sessionProjectId, parsed);
    return parsed;
  }
}

export class PostgresSessionProjectsRepository implements SessionProjectsRepository {
  #options: PostgresRepositoryOptions;

  constructor(options: PostgresRepositoryOptions) {
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  async init() {
    await this.#options.ensureReady?.();
  }

  async create(record: SessionProjectRecord) {
    const parsed = sessionProjectRecordSchema.parse(record);
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionProjectRecord }>(
      `
      INSERT INTO lingban_session_projects (
        session_project_id, workspace_id, workspace_context_key, name, status,
        source_run_id, current_capture_id, current_draft_id, current_session_version_id,
        package_id, workshop_id, service_id, version, created_by_user_id,
        source_provider_selection, source_bindings, created_at, updated_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17, $18, $19::jsonb
      )
      ON CONFLICT (session_project_id) DO UPDATE
        SET session_project_id = EXCLUDED.session_project_id
      RETURNING record_json
      `,
      [
        parsed.sessionProjectId, parsed.workspaceId, parsed.workspaceContextKey, parsed.name,
        parsed.status, parsed.sourceRunId, parsed.currentCaptureId, parsed.currentDraftId,
        parsed.currentSessionVersionId, parsed.packageId, parsed.workshopId, parsed.serviceId,
        parsed.version, parsed.createdByUserId, JSON.stringify(parsed.sourceProviderSelection),
        JSON.stringify(parsed.sourceBindings), parsed.createdAt, parsed.updatedAt,
        JSON.stringify(parsed),
      ]
    );
    return sessionProjectRecordSchema.parse(result.rows[0]!.record_json);
  }

  async get(sessionProjectId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionProjectRecord }>(
      "SELECT record_json FROM lingban_session_projects WHERE session_project_id = $1",
      [sessionProjectId]
    );
    return result.rows[0] ? sessionProjectRecordSchema.parse(result.rows[0].record_json) : null;
  }

  async findBySessionVersionId(sessionVersionId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionProjectRecord }>(
      "SELECT record_json FROM lingban_session_projects WHERE current_session_version_id = $1 ORDER BY updated_at DESC LIMIT 1",
      [sessionVersionId]
    );
    return result.rows[0] ? sessionProjectRecordSchema.parse(result.rows[0].record_json) : null;
  }

  async listByWorkspaceId(workspaceId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionProjectRecord }>(
      "SELECT record_json FROM lingban_session_projects WHERE workspace_id = $1 ORDER BY updated_at DESC",
      [workspaceId]
    );
    return result.rows.map((row) => sessionProjectRecordSchema.parse(row.record_json));
  }

  async update(record: SessionProjectRecord, expectedVersion: number) {
    const parsed = sessionProjectRecordSchema.parse(record);
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: SessionProjectRecord }>(
      `
      UPDATE lingban_session_projects
      SET name = $2, status = $3, source_run_id = $4, current_capture_id = $5,
          current_draft_id = $6, current_session_version_id = $7, package_id = $8,
          workshop_id = $9, service_id = $10, version = $11, updated_at = $12,
          source_provider_selection = $13::jsonb, source_bindings = $14::jsonb,
          record_json = $15::jsonb
      WHERE session_project_id = $1 AND version = $16
      RETURNING record_json
      `,
      [
        parsed.sessionProjectId, parsed.name, parsed.status, parsed.sourceRunId,
        parsed.currentCaptureId, parsed.currentDraftId, parsed.currentSessionVersionId,
        parsed.packageId, parsed.workshopId, parsed.serviceId, parsed.version,
        parsed.updatedAt, JSON.stringify(parsed.sourceProviderSelection),
        JSON.stringify(parsed.sourceBindings), JSON.stringify(parsed), expectedVersion,
      ]
    );
    return result.rows[0] ? sessionProjectRecordSchema.parse(result.rows[0].record_json) : null;
  }
}
