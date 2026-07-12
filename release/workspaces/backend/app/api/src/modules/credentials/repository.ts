import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CachedCredentialsRepository,
  PostgresCredentialsRepository as SharedPostgresCredentialsRepository,
  credentialsStateSchema,
  type CredentialsRepository,
  type CredentialsState,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { seedCredentialsState } from "./seed-data.js";
export { type CredentialsRepository } from "@lingban/db";

class FileBackedCredentialsRepository extends CachedCredentialsRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("credentials")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "credentials-state.json");
  }

  async init() {
    await super.init();

    if (this.list().length === 0) {
      await this.replaceState(credentialsStateSchema.parse(seedCredentialsState));
    }
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return credentialsStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return credentialsStateSchema.parse({
        credentials: [],
      });
    }
  }

  protected async writeState(state: CredentialsState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(credentialsStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

class PostgresCredentialsRepository extends SharedPostgresCredentialsRepository {
  constructor() {
    super({
      ensureReady: ensureApiDatabaseReady,
      getQueryable: getApiDatabasePool,
      withTransaction: withApiDatabaseTransaction,
    });
  }

  async init() {
    await super.init();

    if (this.list().length === 0) {
      await this.replaceState(credentialsStateSchema.parse(seedCredentialsState));
    }
  }
}

function buildCredentialsRepository(): CredentialsRepository {
  const config = getApiRuntimeConfig();
  return config.credentialsStore === "postgres"
    ? new PostgresCredentialsRepository()
    : new FileBackedCredentialsRepository();
}

export const credentialsRepository = buildCredentialsRepository();
