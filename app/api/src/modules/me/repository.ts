import {
  CachedMeFavoritesRepository,
  PostgresMeFavoritesRepository,
  meFavoritesStateSchema,
  type MeFavoritesRepository,
  type MeFavoritesState,
  type StoredFavoriteWorkshopRecord,
} from "@lingban/db";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

class FileBackedMeFavoritesRepository extends CachedMeFavoritesRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("me")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "favorites-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return meFavoritesStateSchema.parse(JSON.parse(raw));
    } catch {
      return meFavoritesStateSchema.parse({
        workshopFavorites: [],
      });
    }
  }

  protected async writeState(state: MeFavoritesState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(meFavoritesStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

function buildMeFavoritesRepository(): MeFavoritesRepository {
  const config = getApiRuntimeConfig();
  return config.favoritesStore === "postgres"
    ? new PostgresMeFavoritesRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new FileBackedMeFavoritesRepository();
}

export const meFavoritesRepository = buildMeFavoritesRepository();
