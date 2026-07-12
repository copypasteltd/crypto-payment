import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CachedSearchRepository,
  PostgresSearchRepository,
  searchStateSchema,
  type SearchRepository,
  type SearchState,
  type StoredSearchClickEventRecord,
  type StoredSearchHistoryRecord,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

class FileBackedSearchRepository extends CachedSearchRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("search")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "search-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return searchStateSchema.parse(JSON.parse(raw));
    } catch {
      return searchStateSchema.parse({
        historyEntries: [],
        clickEvents: [],
      });
    }
  }

  protected async writeState(state: SearchState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(searchStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

function buildSearchRepository(): SearchRepository {
  const config = getApiRuntimeConfig();
  return config.searchStore === "postgres"
    ? new PostgresSearchRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new FileBackedSearchRepository();
}

export const searchRepository = buildSearchRepository();
