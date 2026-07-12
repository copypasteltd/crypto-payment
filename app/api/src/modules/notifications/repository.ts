import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CachedNotificationsRepository,
  PostgresNotificationsRepository,
  notificationsStateSchema,
  type NotificationsRepository,
  type NotificationsState,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";

class FileBackedNotificationsRepository extends CachedNotificationsRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("notifications")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "notifications-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return notificationsStateSchema.parse(JSON.parse(raw));
    } catch {
      return notificationsStateSchema.parse({
        readReceipts: [],
        workspaceCursors: [],
      });
    }
  }

  protected async writeState(state: NotificationsState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(notificationsStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

function buildNotificationsRepository(): NotificationsRepository {
  const config = getApiRuntimeConfig();
  return config.notificationsStore === "postgres"
    ? new PostgresNotificationsRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new FileBackedNotificationsRepository();
}

export const notificationsRepository = buildNotificationsRepository();
