import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import {
  CachedBillingRepository,
  PostgresBillingRepository,
  billingStateSchema,
  type BillingRepository,
  type BillingState,
} from "@lingban/db";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

export {
  PostgresBillingRepository,
  type BillingRepository,
} from "@lingban/db";

class FileBackedBillingRepository extends CachedBillingRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("billing")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "billing-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return billingStateSchema.parse(JSON.parse(raw));
    } catch {
      return billingStateSchema.parse({
        entries: [],
      });
    }
  }

  protected async writeState(state: BillingState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(billingStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

function buildBillingRepository(): BillingRepository {
  const config = getApiRuntimeConfig();
  return config.billingStore === "postgres"
    ? new PostgresBillingRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new FileBackedBillingRepository();
}

export const billingRepository = buildBillingRepository();
