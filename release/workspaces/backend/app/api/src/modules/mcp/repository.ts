import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CachedMcpRepository,
  PostgresMcpRepository as SharedPostgresMcpRepository,
  mcpStateSchema,
  type McpRepository,
  type McpState,
} from "@lingban/db";
import { buildAtomicTempPath } from "@lingban/shared";
import type {
  McpNetworkPolicy,
} from "@lingban/contracts";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { seedMcpState } from "./seed-data.js";
export { type McpRepository } from "@lingban/db";

class FileBackedMcpRepository extends CachedMcpRepository {
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("mcp")) {
    super();
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "mcp-state.json");
  }

  async init() {
    await super.init();
    await this.applySeedState();
  }

  protected async loadState() {
    try {
      const raw = readFileSync(this.#statePath, "utf8");
      return mcpStateSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return mcpStateSchema.parse({
        registry: [],
        bindings: [],
        networkPolicies: [],
        healthSnapshots: [],
      });
    }
  }

  protected async writeState(state: McpState) {
    const tempPath = buildAtomicTempPath(this.#statePath);
    await fs.writeFile(tempPath, JSON.stringify(mcpStateSchema.parse(state), null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }

  async applySeedState() {
    const state = this.getState();
    if (
      state.registry.length === 0 &&
      state.bindings.length === 0 &&
      state.networkPolicies.length === 0
    ) {
      await this.replaceState(mcpStateSchema.parse(seedMcpState));
      return;
    }

    const missingSeedPolicies = seedMcpState.networkPolicies.filter(
      (policy) =>
        !state.networkPolicies.some((existing) => existing.policyRef === policy.policyRef)
    );
    if (missingSeedPolicies.length > 0) {
      await this.replaceState(
        mcpStateSchema.parse({
          ...state,
          networkPolicies: [...state.networkPolicies, ...missingSeedPolicies],
        })
      );
    }
  }
}

class PostgresMcpRepository extends SharedPostgresMcpRepository {
  constructor() {
    super({
      ensureReady: ensureApiDatabaseReady,
      getQueryable: getApiDatabasePool,
      withTransaction: withApiDatabaseTransaction,
    });
  }

  async init() {
    await super.init();
    await this.applySeedState();
  }

  async applySeedState() {
    const state = this.getState();
    if (
      state.registry.length === 0 &&
      state.bindings.length === 0 &&
      state.networkPolicies.length === 0
    ) {
      await this.replaceState(mcpStateSchema.parse(seedMcpState));
      return;
    }

    const missingSeedPolicies = seedMcpState.networkPolicies.filter(
      (policy: McpNetworkPolicy) =>
        !state.networkPolicies.some((existing) => existing.policyRef === policy.policyRef)
    );
    if (missingSeedPolicies.length > 0) {
      await this.replaceState(
        mcpStateSchema.parse({
          ...state,
          networkPolicies: [...state.networkPolicies, ...missingSeedPolicies],
        })
      );
    }
  }
}

function buildMcpRepository(): McpRepository {
  const config = getApiRuntimeConfig();
  return config.mcpStore === "postgres"
    ? new PostgresMcpRepository()
    : new FileBackedMcpRepository();
}

export const mcpRepository = buildMcpRepository();
