import {
  mkdirSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import {
  CachedWorkshopCatalogRepository,
  PostgresWorkshopCatalogRepository as SharedPostgresWorkshopCatalogRepository,
  catalogStateSchema,
  type CatalogState,
  type WorkshopCatalogRepository,
} from "@lingban/db";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";
import { isDemoDataEnabled } from "../../app/demo-data.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { seedCatalogState } from "./seed-data.js";

export {
  type WorkshopCatalogRepository,
} from "@lingban/db";

class FileBackedWorkshopCatalogRepository extends CachedWorkshopCatalogRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("workshops")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "catalog-state.json");
  }

  async init() {
    await super.init();

    if (
      isDemoDataEnabled() &&
      this.listContexts().length === 0 &&
      this.listWorkshops().length === 0 &&
      this.listServices().length === 0 &&
      this.listLaunchTemplates().length === 0
    ) {
      await this.replaceState(catalogStateSchema.parse(seedCatalogState));
    }
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return catalogStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return catalogStateSchema.parse({
        contexts: [],
        workshops: [],
        services: [],
        launchTemplates: [],
      });
    }
  }

  protected async writeState(state: CatalogState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(tempPath, JSON.stringify(catalogStateSchema.parse(state), null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }
}

export class PostgresWorkshopCatalogRepository extends SharedPostgresWorkshopCatalogRepository {
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
      isDemoDataEnabled() &&
      this.listContexts().length === 0 &&
      this.listWorkshops().length === 0 &&
      this.listServices().length === 0 &&
      this.listLaunchTemplates().length === 0
    ) {
      await this.replaceState(catalogStateSchema.parse(seedCatalogState));
    }
  }
}

function buildWorkshopCatalogRepository(): WorkshopCatalogRepository {
  const config = getApiRuntimeConfig();
  return config.workshopCatalogStore === "postgres"
    ? new PostgresWorkshopCatalogRepository()
    : new FileBackedWorkshopCatalogRepository();
}

export const workshopCatalogRepository = buildWorkshopCatalogRepository();
