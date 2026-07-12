import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CachedCreatorRepository,
  PostgresCreatorRepository as SharedPostgresCreatorRepository,
  creatorStateSchema,
  type CreatorRepository,
  type CreatorState,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { seedCreatorState } from "./seed-data.js";

export { type CreatorRepository } from "@lingban/db";

function isEmptyCreatorState(state: CreatorState) {
  return (
    state.packages.length === 0 &&
    state.releases.length === 0 &&
    state.replays.length === 0 &&
    state.releaseGates.length === 0 &&
    state.activations.length === 0 &&
    state.auditExports.length === 0
  );
}

class FileBackedCreatorRepository extends CachedCreatorRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("creator")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "creator-state.json");
  }

  async init() {
    await super.init();
    if (isEmptyCreatorState(this.getState())) {
      await this.replaceState(creatorStateSchema.parse(seedCreatorState));
    }
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return creatorStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return creatorStateSchema.parse({
        packages: [],
        releases: [],
        replays: [],
        releaseGates: [],
        activations: [],
        auditExports: [],
      });
    }
  }

  protected async writeState(state: CreatorState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(tempPath, JSON.stringify(creatorStateSchema.parse(state), null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }
}

class PostgresCreatorRepository extends SharedPostgresCreatorRepository {
  async init() {
    await super.init();
    if (isEmptyCreatorState(this.getState())) {
      await this.replaceState(creatorStateSchema.parse(seedCreatorState));
    }
  }

  constructor() {
    super({
      ensureReady: ensureApiDatabaseReady,
      getQueryable: () => getApiDatabasePool(),
      withTransaction: withApiDatabaseTransaction,
    });
  }
}

function buildCreatorRepository(): CreatorRepository {
  const config = getApiRuntimeConfig();
  return config.creatorStore === "postgres"
    ? new PostgresCreatorRepository()
    : new FileBackedCreatorRepository();
}

export const creatorRepository = buildCreatorRepository();
