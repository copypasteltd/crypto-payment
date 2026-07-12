import {
  CachedBatchRunsRepository,
  PostgresBatchRunsRepository,
  batchRunsStateSchema,
  type BatchRunsRepository,
  type BatchRunsState,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

class FileBackedBatchRunsRepository extends CachedBatchRunsRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("batch-runs")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "batch-runs-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return batchRunsStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return batchRunsStateSchema.parse({});
    }
  }

  protected async persistBatch() {
    await this.#writeState(this.getState());
  }

  protected async clearStorage() {
    await this.#writeState(this.getState());
  }

  async #writeState(state: BatchRunsState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(tempPath, JSON.stringify(batchRunsStateSchema.parse(state), null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }
}

export function buildBatchRunsRepository(): BatchRunsRepository {
  const config = getApiRuntimeConfig();
  return config.batchRunsStore === "postgres"
    ? new PostgresBatchRunsRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new FileBackedBatchRunsRepository();
}

export const batchRunsRepository: BatchRunsRepository = buildBatchRunsRepository();
