import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import {
  credentialAuditEventsStateSchema,
  storedCredentialAuditEventSchema,
  type CredentialAuditEventsState,
  type StoredCredentialAuditEvent,
} from "./storage-schema.js";

export interface CredentialAuditRepository {
  init(): Promise<void>;
  list(): StoredCredentialAuditEvent[];
  save(event: StoredCredentialAuditEvent): Promise<StoredCredentialAuditEvent>;
}

abstract class CachedCredentialAuditRepository implements CredentialAuditRepository {
  #initialized = false;
  #events = new Map<string, StoredCredentialAuditEvent>();
  #writeChain: Promise<void> = Promise.resolve();

  async init() {
    if (this.#initialized) {
      return;
    }

    const state = await this.loadState();
    this.#events.clear();
    for (const event of state.events) {
      this.#events.set(event.eventId, storedCredentialAuditEventSchema.parse(event));
    }

    this.#initialized = true;
  }

  list() {
    return [...this.#events.values()].sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        left.eventId.localeCompare(right.eventId)
    );
  }

  async save(event: StoredCredentialAuditEvent) {
    const parsed = storedCredentialAuditEventSchema.parse(event);
    this.#events.set(parsed.eventId, parsed);
    const state = credentialAuditEventsStateSchema.parse({
      events: this.list(),
    });

    const next = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        await this.writeState(state);
      });
    this.#writeChain = next;
    await next;
    return parsed;
  }

  protected abstract loadState(): Promise<CredentialAuditEventsState>;
  protected abstract writeState(state: CredentialAuditEventsState): Promise<void>;
}

class FileBackedCredentialAuditRepository extends CachedCredentialAuditRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("credentials")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "credential-audit-events-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return credentialAuditEventsStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return credentialAuditEventsStateSchema.parse({
        events: [],
      });
    }
  }

  protected async writeState(state: CredentialAuditEventsState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(credentialAuditEventsStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

class PostgresCredentialAuditRepository extends CachedCredentialAuditRepository {
  protected async loadState() {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();
    const result = await pool.query<{ event_json: StoredCredentialAuditEvent }>(
      `
      SELECT event_json
      FROM lingban_credential_audit_events
      ORDER BY occurred_at DESC, event_id ASC
      `
    );

    return credentialAuditEventsStateSchema.parse({
      events: result.rows.map((row) => row.event_json),
    });
  }

  protected async writeState(state: CredentialAuditEventsState) {
    await withApiDatabaseTransaction(async (client) => {
      await client.query("DELETE FROM lingban_credential_audit_events");

      for (const event of state.events) {
        await client.query(
          `
          INSERT INTO lingban_credential_audit_events (
            event_id,
            credential_id,
            workspace_id,
            run_id,
            action,
            outcome,
            occurred_at,
            event_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `,
          [
            event.eventId,
            event.credentialId,
            event.workspaceId,
            event.runId,
            event.action,
            event.outcome,
            event.occurredAt,
            JSON.stringify(event),
          ]
        );
      }
    });
  }
}

function buildCredentialAuditRepository(): CredentialAuditRepository {
  const config = getApiRuntimeConfig();
  return config.credentialsStore === "postgres"
    ? new PostgresCredentialAuditRepository()
    : new FileBackedCredentialAuditRepository();
}

export const credentialAuditRepository = buildCredentialAuditRepository();
