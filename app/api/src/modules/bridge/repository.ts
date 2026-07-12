import { mkdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { promises as fs } from "node:fs";
import { buildAtomicTempPath } from "@lingban/shared";
import path from "node:path";
import type { BridgeRegistration } from "@lingban/contracts";
import {
  CachedBridgeRegistrationRepository,
  PostgresBridgeRegistrationRepository as SharedPostgresBridgeRegistrationRepository,
  bridgeRegistryStateSchema,
  type BridgeRegistrationRepository,
  type BridgeRegistryState,
} from "@lingban/db";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";

export {
  type BridgeRegistrationRepository,
} from "@lingban/db";

export class FileBackedBridgeRegistrationRepository extends CachedBridgeRegistrationRepository {
  kind = "file" as const;

  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("bridge")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "bridge-registry.json");
  }

  protected async loadState(): Promise<BridgeRegistryState> {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return bridgeRegistryStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return bridgeRegistryStateSchema.parse({
        connections: [],
      });
    }
  }

  protected async persistRegistration(_registration: BridgeRegistration) {
    await this.#persist(this.getState());
  }

  protected async deleteRegistration(_runId: string) {
    await this.#persist(this.getState());
  }

  protected async clearStorage() {
    try {
      unlinkSync(this.#statePath);
    } catch {
      // ignore missing file during cleanup
    }
  }

  async #persist(state: BridgeRegistryState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(
      tempPath,
      JSON.stringify(bridgeRegistryStateSchema.parse(state), null, 2),
      "utf8"
    );
    renameSync(tempPath, this.#statePath);
  }
}

export class PostgresBridgeRegistrationRepository extends SharedPostgresBridgeRegistrationRepository {
  constructor() {
    super({
      ensureReady: ensureApiDatabaseReady,
      getQueryable: getApiDatabasePool,
    });
  }
}

export function buildBridgeRegistrationRepository(): BridgeRegistrationRepository {
  const config = getApiRuntimeConfig();
  return config.bridgeRegistryStore === "postgres"
    ? new PostgresBridgeRegistrationRepository()
    : new FileBackedBridgeRegistrationRepository();
}

export const bridgeRegistrationRepository = buildBridgeRegistrationRepository();
