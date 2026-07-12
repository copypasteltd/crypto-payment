import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildAtomicTempPath } from "@lingban/shared";
import {
  CachedRunsRepository,
  PostgresRunsRepository,
  runAggregateSchema,
  type RunAggregate,
  type RunsRepository,
} from "@lingban/db";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";

export type { RunAggregate };

class FileBackedRunsRepository extends CachedRunsRepository {
  #storageDir: string;

  constructor(storageDir = resolveApiStorageDir("runs")) {
    super();
    this.#storageDir = storageDir;
    mkdirSync(this.#storageDir, { recursive: true });
  }

  #getRunFilePath(runId: string) {
    return path.join(this.#storageDir, `${runId}.json`);
  }

  protected async loadAll() {
    const files = readdirSync(this.#storageDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    return files.map((fileName) => {
      const absolutePath = path.join(this.#storageDir, fileName);
      const raw = readFileSync(absolutePath, "utf8");
      return runAggregateSchema.parse(JSON.parse(raw)) as RunAggregate;
    });
  }

  protected async persist(aggregate: RunAggregate) {
    const runFilePath = this.#getRunFilePath(aggregate.run.runId);
    const tempFilePath = buildAtomicTempPath(runFilePath);
    const payload = JSON.stringify(runAggregateSchema.parse(aggregate), null, 2);

    await fs.writeFile(tempFilePath, payload, "utf8");
    renameSync(tempFilePath, runFilePath);
  }

  protected async clearStorage() {
    for (const fileName of readdirSync(this.#storageDir, { withFileTypes: true })) {
      if (!fileName.isFile() || !fileName.name.endsWith(".json")) {
        continue;
      }

      try {
        unlinkSync(path.join(this.#storageDir, fileName.name));
      } catch {
        // Ignore missing files during cleanup.
      }
    }
  }
}

function buildRunsRepository(): RunsRepository {
  const config = getApiRuntimeConfig();
  return config.runsStore === "postgres"
    ? new PostgresRunsRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
      })
    : new FileBackedRunsRepository();
}

export const runsRepository = buildRunsRepository();
