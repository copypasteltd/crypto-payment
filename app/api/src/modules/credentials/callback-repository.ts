import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import {
  credentialLifecycleCallbackDeliveriesStateSchema,
  credentialLifecycleCallbackDeliverySchema,
  type CredentialLifecycleCallbackDeliveriesState,
  type CredentialLifecycleCallbackDelivery,
} from "./storage-schema.js";

export interface CredentialLifecycleCallbackRepository {
  init(): Promise<void>;
  list(): CredentialLifecycleCallbackDelivery[];
  getById(deliveryId: string): CredentialLifecycleCallbackDelivery | null;
  save(delivery: CredentialLifecycleCallbackDelivery): Promise<CredentialLifecycleCallbackDelivery>;
}

abstract class CachedCredentialLifecycleCallbackRepository
  implements CredentialLifecycleCallbackRepository
{
  #initialized = false;
  #deliveries = new Map<string, CredentialLifecycleCallbackDelivery>();
  #writeChain: Promise<void> = Promise.resolve();

  async init() {
    if (this.#initialized) {
      return;
    }

    const state = await this.loadState();
    this.#deliveries.clear();
    for (const delivery of state.deliveries) {
      this.#deliveries.set(
        delivery.deliveryId,
        credentialLifecycleCallbackDeliverySchema.parse(delivery)
      );
    }

    this.#initialized = true;
  }

  list() {
    return [...this.#deliveries.values()].sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        left.deliveryId.localeCompare(right.deliveryId)
    );
  }

  getById(deliveryId: string) {
    return this.#deliveries.get(deliveryId) ?? null;
  }

  async save(delivery: CredentialLifecycleCallbackDelivery) {
    const parsed = credentialLifecycleCallbackDeliverySchema.parse(delivery);
    this.#deliveries.set(parsed.deliveryId, parsed);
    const state = credentialLifecycleCallbackDeliveriesStateSchema.parse({
      deliveries: this.list(),
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

  protected abstract loadState(): Promise<CredentialLifecycleCallbackDeliveriesState>;
  protected abstract writeState(state: CredentialLifecycleCallbackDeliveriesState): Promise<void>;
}

class FileBackedCredentialLifecycleCallbackRepository
  extends CachedCredentialLifecycleCallbackRepository
{
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("credentials")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "credential-lifecycle-callback-deliveries-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return credentialLifecycleCallbackDeliveriesStateSchema.parse(
        JSON.parse(raw) as unknown
      );
    } catch {
      return credentialLifecycleCallbackDeliveriesStateSchema.parse({
        deliveries: [],
      });
    }
  }

  protected async writeState(state: CredentialLifecycleCallbackDeliveriesState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(credentialLifecycleCallbackDeliveriesStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

class PostgresCredentialLifecycleCallbackRepository
  extends CachedCredentialLifecycleCallbackRepository
{
  protected async loadState() {
    await ensureApiDatabaseReady();
    const pool = getApiDatabasePool();
    const result = await pool.query<{ delivery_json: CredentialLifecycleCallbackDelivery }>(
      `
      SELECT delivery_json
      FROM lingban_credential_lifecycle_callback_deliveries
      ORDER BY created_at DESC, delivery_id ASC
      `
    );

    return credentialLifecycleCallbackDeliveriesStateSchema.parse({
      deliveries: result.rows.map((row) => row.delivery_json),
    });
  }

  protected async writeState(state: CredentialLifecycleCallbackDeliveriesState) {
    await withApiDatabaseTransaction(async (client) => {
      await client.query("DELETE FROM lingban_credential_lifecycle_callback_deliveries");

      for (const delivery of state.deliveries) {
        await client.query(
          `
          INSERT INTO lingban_credential_lifecycle_callback_deliveries (
            delivery_id,
            credential_id,
            workspace_id,
            provider,
            target_status,
            status,
            next_attempt_at,
            created_at,
            updated_at,
            delivery_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
          `,
          [
            delivery.deliveryId,
            delivery.credentialId,
            delivery.workspaceId,
            delivery.provider,
            delivery.targetStatus,
            delivery.status,
            delivery.nextAttemptAt,
            delivery.createdAt,
            delivery.updatedAt,
            JSON.stringify(delivery),
          ]
        );
      }
    });
  }
}

function buildCredentialLifecycleCallbackRepository(): CredentialLifecycleCallbackRepository {
  const config = getApiRuntimeConfig();
  return config.credentialsStore === "postgres"
    ? new PostgresCredentialLifecycleCallbackRepository()
    : new FileBackedCredentialLifecycleCallbackRepository();
}

export const credentialLifecycleCallbackRepository =
  buildCredentialLifecycleCallbackRepository();
