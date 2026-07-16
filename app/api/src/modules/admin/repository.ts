import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  adminAuditEventSchema,
  adminImpactOperationSchema,
  adminResourceStateSchema,
  adminSettingRecordSchema,
  adminStateSchema,
  type AdminAuditEvent,
  type AdminImpactOperation,
  type AdminResourceState,
  type AdminResourceType,
  type AdminSettingRecord,
  type AdminState,
} from "@lingban/contracts";
import { buildAtomicTempPath } from "@lingban/shared";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  isApiDatabaseEnabled,
} from "../../app/database.js";
import { resolveApiStorageDir } from "../../app/storage.js";

function resourceKey(resourceType: AdminResourceType, resourceId: string) {
  return `${resourceType}:${resourceId}`;
}

export class AdminRepository {
  #initialized = false;
  #state: AdminState = adminStateSchema.parse({});
  #statePath: string;
  #writeChain: Promise<void> = Promise.resolve();

  constructor(storageDir = resolveApiStorageDir("admin")) {
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "admin-state.json");
  }

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = isApiDatabaseEnabled()
      ? await this.#loadPostgresState()
      : this.#loadFileState();
    this.#initialized = true;
  }

  listResourceStates() {
    return [...this.#state.resourceStates].sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        resourceKey(left.resourceType, left.resourceId).localeCompare(
          resourceKey(right.resourceType, right.resourceId)
        )
    );
  }

  getResourceState(resourceType: AdminResourceType, resourceId: string) {
    return (
      this.#state.resourceStates.find(
        (item) => item.resourceType === resourceType && item.resourceId === resourceId
      ) ?? null
    );
  }

  isSuspended(resourceType: Extract<AdminResourceType, "user" | "workspace">, resourceId: string) {
    return this.getResourceState(resourceType, resourceId)?.status === "suspended";
  }

  async saveResourceState(input: AdminResourceState) {
    await this.init();
    const record = adminResourceStateSchema.parse(input);
    this.#state = adminStateSchema.parse({
      ...this.#state,
      resourceStates: [
        ...this.#state.resourceStates.filter(
          (item) =>
            item.resourceType !== record.resourceType || item.resourceId !== record.resourceId
        ),
        record,
      ],
    });

    if (isApiDatabaseEnabled()) {
      const pool = getApiDatabasePool();
      await pool.query(
        `
        INSERT INTO lingban_admin_resource_states (
          resource_type, resource_id, status, updated_at, state_json
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (resource_type, resource_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at,
          state_json = EXCLUDED.state_json
        `,
        [
          record.resourceType,
          record.resourceId,
          record.status,
          record.updatedAt,
          JSON.stringify(record),
        ]
      );
    } else {
      await this.#persistFileState();
    }

    return record;
  }

  listAuditEvents() {
    return [...this.#state.auditEvents].sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        left.eventId.localeCompare(right.eventId)
    );
  }

  async appendAuditEvent(input: AdminAuditEvent) {
    await this.init();
    const record = adminAuditEventSchema.parse(input);
    this.#state = adminStateSchema.parse({
      ...this.#state,
      auditEvents: [
        ...this.#state.auditEvents.filter((item) => item.eventId !== record.eventId),
        record,
      ],
    });

    if (isApiDatabaseEnabled()) {
      const pool = getApiDatabasePool();
      await pool.query(
        `
        INSERT INTO lingban_admin_audit_events (
          event_id, actor_user_id, action, resource_type, resource_id,
          outcome, occurred_at, event_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (event_id) DO NOTHING
        `,
        [
          record.eventId,
          record.actorUserId,
          record.action,
          record.resourceType,
          record.resourceId,
          record.outcome,
          record.occurredAt,
          JSON.stringify(record),
        ]
      );
    } else {
      await this.#persistFileState();
    }

    return record;
  }

  listSettings() {
    return [...this.#state.settings].sort((left, right) => left.key.localeCompare(right.key));
  }

  getSetting(key: string) {
    return this.#state.settings.find((item) => item.key === key) ?? null;
  }

  async saveSetting(input: AdminSettingRecord) {
    await this.init();
    const record = adminSettingRecordSchema.parse(input);
    this.#state = adminStateSchema.parse({
      ...this.#state,
      settings: [
        ...this.#state.settings.filter((item) => item.key !== record.key),
        record,
      ],
    });

    if (isApiDatabaseEnabled()) {
      const pool = getApiDatabasePool();
      await pool.query(
        `
        INSERT INTO lingban_admin_settings (setting_key, version, updated_at, setting_json)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          version = EXCLUDED.version,
          updated_at = EXCLUDED.updated_at,
          setting_json = EXCLUDED.setting_json
        `,
        [record.key, record.version, record.updatedAt, JSON.stringify(record)]
      );
    } else {
      await this.#persistFileState();
    }

    return record;
  }

  listOperations() {
    return [...this.#state.operations].sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt)
    );
  }

  getOperation(operationId: string) {
    return this.#state.operations.find((item) => item.operationId === operationId) ?? null;
  }

  async saveOperation(input: AdminImpactOperation) {
    await this.init();
    const record = adminImpactOperationSchema.parse(input);
    this.#state = adminStateSchema.parse({
      ...this.#state,
      operations: [
        ...this.#state.operations.filter((item) => item.operationId !== record.operationId),
        record,
      ],
    });

    if (isApiDatabaseEnabled()) {
      const pool = getApiDatabasePool();
      await pool.query(
        `
        INSERT INTO lingban_admin_operations (
          operation_id, resource_type, resource_id, action,
          expires_at, consumed_at, operation_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (operation_id)
        DO UPDATE SET
          expires_at = EXCLUDED.expires_at,
          consumed_at = EXCLUDED.consumed_at,
          operation_json = EXCLUDED.operation_json
        `,
        [
          record.operationId,
          record.resourceType,
          record.resourceId,
          record.action,
          record.expiresAt,
          record.consumedAt,
          JSON.stringify(record),
        ]
      );
    } else {
      await this.#persistFileState();
    }

    return record;
  }

  #loadFileState() {
    try {
      return adminStateSchema.parse(JSON.parse(readFileSync(this.#statePath, "utf8")));
    } catch {
      return adminStateSchema.parse({});
    }
  }

  async #loadPostgresState() {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();
    const [resourceStates, auditEvents, settings, operations] = await Promise.all([
      pool.query<{ state_json: AdminResourceState }>(
        "SELECT state_json FROM lingban_admin_resource_states ORDER BY updated_at DESC"
      ),
      pool.query<{ event_json: AdminAuditEvent }>(
        "SELECT event_json FROM lingban_admin_audit_events ORDER BY occurred_at DESC"
      ),
      pool.query<{ setting_json: AdminSettingRecord }>(
        "SELECT setting_json FROM lingban_admin_settings ORDER BY setting_key ASC"
      ),
      pool.query<{ operation_json: AdminImpactOperation }>(
        "SELECT operation_json FROM lingban_admin_operations ORDER BY expires_at DESC"
      ),
    ]);

    return adminStateSchema.parse({
      resourceStates: resourceStates.rows.map((row) => row.state_json),
      auditEvents: auditEvents.rows.map((row) => row.event_json),
      settings: settings.rows.map((row) => row.setting_json),
      operations: operations.rows.map((row) => row.operation_json),
    });
  }

  async #persistFileState() {
    const snapshot = adminStateSchema.parse(this.#state);
    const next = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        const tempPath = buildAtomicTempPath(this.#statePath);
        await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2), "utf8");
        renameSync(tempPath, this.#statePath);
      });
    this.#writeChain = next;
    await next;
  }
}

export const adminRepository = new AdminRepository();
