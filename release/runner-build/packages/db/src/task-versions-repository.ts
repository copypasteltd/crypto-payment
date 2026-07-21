import {
  serviceTaskVersionRecordSchema,
  type ServiceTaskVersionRecord,
} from "@lingban/contracts";
import type { PostgresRepositoryOptions } from "./postgres-types.js";

export interface TaskVersionsRepository {
  init(): Promise<void>;
  create(record: ServiceTaskVersionRecord): Promise<ServiceTaskVersionRecord>;
  get(taskVersionId: string): Promise<ServiceTaskVersionRecord | null>;
  listByServiceId(serviceId: string): Promise<ServiceTaskVersionRecord[]>;
}

export class InMemoryTaskVersionsRepository implements TaskVersionsRepository {
  #records = new Map<string, ServiceTaskVersionRecord>();

  async init() {}

  async create(record: ServiceTaskVersionRecord) {
    const parsed = serviceTaskVersionRecordSchema.parse(record);
    const existing = this.#records.get(parsed.taskVersionId);
    if (existing) {
      if (existing.contentSha256 !== parsed.contentSha256) {
        throw new Error(`Task Version immutable conflict: ${parsed.taskVersionId}`);
      }
      return existing;
    }
    const serviceVersions = [...this.#records.values()].filter(
      (item) => item.serviceId === parsed.serviceId
    );
    const duplicateVersion = serviceVersions.find(
      (item) => item.versionNumber === parsed.versionNumber
    );
    if (duplicateVersion) {
      throw new Error(`Task Version number already exists: ${parsed.serviceId}/v${parsed.versionNumber}`);
    }
    const duplicateContent = serviceVersions.find(
      (item) => item.contentSha256 === parsed.contentSha256
    );
    if (duplicateContent) return duplicateContent;
    this.#records.set(parsed.taskVersionId, parsed);
    return parsed;
  }

  async get(taskVersionId: string) {
    return this.#records.get(taskVersionId) ?? null;
  }

  async listByServiceId(serviceId: string) {
    return [...this.#records.values()]
      .filter((record) => record.serviceId === serviceId)
      .sort((left, right) => right.versionNumber - left.versionNumber);
  }
}

export class PostgresTaskVersionsRepository implements TaskVersionsRepository {
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

  async create(record: ServiceTaskVersionRecord) {
    const parsed = serviceTaskVersionRecordSchema.parse(record);
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: ServiceTaskVersionRecord }>(
      `
      INSERT INTO lingban_service_task_versions (
        task_version_id, service_id, workshop_id, workspace_id, workspace_context_key,
        session_project_id, session_version_id, version_number, content_sha256,
        created_by_user_id, created_at, record_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      ON CONFLICT (task_version_id) DO NOTHING
      RETURNING record_json
      `,
      [
        parsed.taskVersionId,
        parsed.serviceId,
        parsed.workshopId,
        parsed.workspaceId,
        parsed.workspaceContextKey,
        parsed.sessionProjectId,
        parsed.sessionVersionId,
        parsed.versionNumber,
        parsed.contentSha256,
        parsed.createdByUserId,
        parsed.createdAt,
        JSON.stringify(parsed),
      ]
    );
    if (result.rows[0]) return serviceTaskVersionRecordSchema.parse(result.rows[0].record_json);
    const existing = await this.get(parsed.taskVersionId);
    if (!existing || existing.contentSha256 !== parsed.contentSha256) {
      throw new Error(`Task Version immutable conflict: ${parsed.taskVersionId}`);
    }
    return existing;
  }

  async get(taskVersionId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: ServiceTaskVersionRecord }>(
      "SELECT record_json FROM lingban_service_task_versions WHERE task_version_id=$1",
      [taskVersionId]
    );
    return result.rows[0] ? serviceTaskVersionRecordSchema.parse(result.rows[0].record_json) : null;
  }

  async listByServiceId(serviceId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ record_json: ServiceTaskVersionRecord }>(
      "SELECT record_json FROM lingban_service_task_versions WHERE service_id=$1 ORDER BY version_number DESC",
      [serviceId]
    );
    return result.rows.map((row) => serviceTaskVersionRecordSchema.parse(row.record_json));
  }
}
