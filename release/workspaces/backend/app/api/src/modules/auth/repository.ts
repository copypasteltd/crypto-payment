import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CachedAuthRepository,
  PostgresAuthRepository as SharedPostgresAuthRepository,
  authStateSchema,
  type AuthRepository,
  type AuthStorageState,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";

export { type AuthRepository } from "@lingban/db";

class FileBackedAuthRepository extends CachedAuthRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("auth")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "auth-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return authStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return authStateSchema.parse({
        users: [],
        workspaces: [],
        memberships: [],
        invitations: [],
        sessions: [],
      });
    }
  }

  protected async writeSnapshot(state: AuthStorageState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(tempPath, JSON.stringify(authStateSchema.parse(state), null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }

  protected async persistUserRecord() {
    await this.writeSnapshot(this.snapshotState());
  }

  protected async persistWorkspaceRecord() {
    await this.writeSnapshot(this.snapshotState());
  }

  protected async persistMembershipRecord() {
    await this.writeSnapshot(this.snapshotState());
  }

  protected async persistInvitationRecord() {
    await this.writeSnapshot(this.snapshotState());
  }

  protected async persistSessionRecord() {
    await this.writeSnapshot(this.snapshotState());
  }
}

class PostgresAuthRepository extends SharedPostgresAuthRepository {
  constructor() {
    super({
      ensureReady: ensureApiDatabaseReady,
      getQueryable: () => getApiDatabasePool(),
      withTransaction: withApiDatabaseTransaction,
    });
  }
}

function buildAuthRepository(): AuthRepository {
  const config = getApiRuntimeConfig();
  return config.authStore === "postgres"
    ? new PostgresAuthRepository()
    : new FileBackedAuthRepository();
}

export const authRepository = buildAuthRepository();
