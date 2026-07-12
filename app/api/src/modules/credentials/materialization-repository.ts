import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import {
  credentialMaterializationsStateSchema,
  storedCredentialMaterializationLeaseSchema,
  type CredentialMaterializationsState,
  type StoredCredentialMaterializationLease,
} from "./storage-schema.js";

export interface CredentialMaterializationRepository {
  init(): Promise<void>;
  list(): StoredCredentialMaterializationLease[];
  save(lease: StoredCredentialMaterializationLease): Promise<StoredCredentialMaterializationLease>;
}

abstract class CachedCredentialMaterializationRepository
  implements CredentialMaterializationRepository
{
  #initialized = false;
  #leases = new Map<string, StoredCredentialMaterializationLease>();
  #writeChain: Promise<void> = Promise.resolve();

  async init() {
    if (this.#initialized) {
      return;
    }

    const state = await this.loadState();
    this.#leases.clear();
    for (const lease of state.leases) {
      this.#leases.set(lease.leaseId, storedCredentialMaterializationLeaseSchema.parse(lease));
    }

    this.#initialized = true;
  }

  list() {
    return [...this.#leases.values()].sort((left, right) =>
      left.issuedAt.localeCompare(right.issuedAt) || left.leaseId.localeCompare(right.leaseId)
    );
  }

  async save(lease: StoredCredentialMaterializationLease) {
    const parsed = storedCredentialMaterializationLeaseSchema.parse(lease);
    this.#leases.set(parsed.leaseId, parsed);
    const state = credentialMaterializationsStateSchema.parse({
      leases: this.list(),
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

  protected abstract loadState(): Promise<CredentialMaterializationsState>;
  protected abstract writeState(state: CredentialMaterializationsState): Promise<void>;
}

class FileBackedCredentialMaterializationRepository extends CachedCredentialMaterializationRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("credentials")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "credential-materializations-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return credentialMaterializationsStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return credentialMaterializationsStateSchema.parse({
        leases: [],
      });
    }
  }

  protected async writeState(state: CredentialMaterializationsState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(credentialMaterializationsStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

class PostgresCredentialMaterializationRepository extends CachedCredentialMaterializationRepository {
  protected async loadState() {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();
    const result = await pool.query<{ lease_json: StoredCredentialMaterializationLease }>(
      `
      SELECT lease_json
      FROM lingban_credential_materializations
      ORDER BY issued_at ASC, lease_id ASC
      `
    );

    return credentialMaterializationsStateSchema.parse({
      leases: result.rows.map((row) => row.lease_json),
    });
  }

  protected async writeState(state: CredentialMaterializationsState) {
    await withApiDatabaseTransaction(async (client) => {
      await client.query("DELETE FROM lingban_credential_materializations");

      for (const lease of state.leases) {
        await client.query(
          `
          INSERT INTO lingban_credential_materializations (
            lease_id,
            run_id,
            workspace_id,
            issued_at,
            expires_at,
            lease_json
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            lease.leaseId,
            lease.runId,
            lease.workspaceId,
            lease.issuedAt,
            lease.expiresAt,
            JSON.stringify(lease),
          ]
        );
      }
    });
  }
}

function buildCredentialMaterializationRepository(): CredentialMaterializationRepository {
  const config = getApiRuntimeConfig();
  return config.credentialsStore === "postgres"
    ? new PostgresCredentialMaterializationRepository()
    : new FileBackedCredentialMaterializationRepository();
}

export const credentialMaterializationRepository =
  buildCredentialMaterializationRepository();
