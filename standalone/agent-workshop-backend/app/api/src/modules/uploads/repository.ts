import {
  CachedUploadRepository,
  PostgresUploadRepository,
  type UploadRepository,
  type UploadStorageState,
} from "@lingban/db";
import {
  mkdirSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import type { RunDownloadTicket, RunUploadRecord } from "@lingban/contracts";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";

class FileBackedUploadRepository extends CachedUploadRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("uploads")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "uploads-state.json");
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return JSON.parse(raw) as UploadStorageState;
    } catch {
      return {
        uploads: [],
        downloadTickets: [],
      };
    }
  }

  protected async writeSnapshot(state: UploadStorageState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }

  protected async persistUploadRecord(_record: RunUploadRecord) {
    await this.writeSnapshot(this.snapshotState());
  }

  protected async persistDownloadTicketRecord(_record: RunDownloadTicket) {
    await this.writeSnapshot(this.snapshotState());
  }
}

function buildUploadRepository(): UploadRepository {
  const config = getApiRuntimeConfig();
  return config.uploadsStore === "postgres"
    ? new PostgresUploadRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new FileBackedUploadRepository();
}

export const uploadRepository = buildUploadRepository();
