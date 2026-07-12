import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CachedMeRecentActivitiesRepository,
  PostgresMeRecentActivitiesRepository,
  meRecentActivitiesStateSchema,
  type MeRecentActivitiesRepository,
  type MeRecentActivitiesState,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

class FileBackedMeRecentActivitiesRepository extends CachedMeRecentActivitiesRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("me")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "recent-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return meRecentActivitiesStateSchema.parse(JSON.parse(raw));
    } catch {
      return meRecentActivitiesStateSchema.parse({
        recentActivities: [],
      });
    }
  }

  protected async writeState(state: MeRecentActivitiesState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(meRecentActivitiesStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

function buildMeRecentActivitiesRepository(): MeRecentActivitiesRepository {
  const config = getApiRuntimeConfig();
  return config.recentStore === "postgres"
    ? new PostgresMeRecentActivitiesRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new FileBackedMeRecentActivitiesRepository();
}

export const meRecentActivitiesRepository = buildMeRecentActivitiesRepository();
