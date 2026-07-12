import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import {
  CachedQuotaRepository,
  PostgresQuotaRepository as SharedPostgresQuotaRepository,
  quotaStateSchema,
  type QuotaRepository,
  type QuotaState,
} from "@lingban/db";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { seedQuotaState } from "./seed-data.js";

export {
  type QuotaRepository,
} from "@lingban/db";

class FileBackedQuotaRepository extends CachedQuotaRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("quotas")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "quota-state.json");
  }

  async init() {
    await super.init();

    if (
      this.listPolicies().length === 0 &&
      this.listCounters().length === 0 &&
      this.listEvents().length === 0 &&
      this.listOverrides().length === 0
    ) {
      await this.replaceState(quotaStateSchema.parse(seedQuotaState));
    }
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return quotaStateSchema.parse(JSON.parse(raw));
    } catch {
      return quotaStateSchema.parse({
        policies: [],
        counters: [],
        events: [],
        overrides: [],
      });
    }
  }

  protected async writeState(state: QuotaState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(tempPath, JSON.stringify(quotaStateSchema.parse(state), null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }
}

export class PostgresQuotaRepository extends SharedPostgresQuotaRepository {
  constructor() {
    super({
      ensureReady: ensureApiDatabaseReady,
      getQueryable: getApiDatabasePool,
      withTransaction: withApiDatabaseTransaction,
    });
  }

  async init() {
    await super.init();

    if (
      this.listPolicies().length === 0 &&
      this.listCounters().length === 0 &&
      this.listEvents().length === 0 &&
      this.listOverrides().length === 0
    ) {
      await this.replaceState(quotaStateSchema.parse(seedQuotaState));
    }
  }
}

function buildQuotaRepository(): QuotaRepository {
  const config = getApiRuntimeConfig();
  return config.quotaStore === "postgres"
    ? new PostgresQuotaRepository()
    : new FileBackedQuotaRepository();
}

export const quotaRepository = buildQuotaRepository();
