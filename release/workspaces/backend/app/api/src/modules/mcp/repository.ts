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
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { ensureApiDatabaseReady, getApiDatabasePool, withApiDatabaseTransaction } from "../../app/database.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { seedMcpState } from "./seed-data.js";
export { type McpRepository } from "@lingban/db";

export function reconcileMcpSeedState(currentState: McpState): McpState {
  const state = mcpStateSchema.parse(currentState);
  if (
    state.registry.length === 0 &&
    state.bindings.length === 0 &&
    state.networkPolicies.length === 0
  ) {
    return mcpStateSchema.parse(seedMcpState);
  }

  const managedFirstPartyEntries = new Map(
    seedMcpState.registry
      .filter((entry) => entry.source === "first-party")
      .map((entry) => [entry.mcpId, entry])
  );
  const reconciledRegistry = state.registry.map((entry) => {
    const managedEntry = managedFirstPartyEntries.get(entry.mcpId);
    if (!managedEntry || entry.source !== "first-party") {
      return entry;
    }

    managedFirstPartyEntries.delete(entry.mcpId);
    return {
      ...managedEntry,
      createdAt: entry.createdAt,
    };
  });
  reconciledRegistry.push(...managedFirstPartyEntries.values());

  const existingPolicyRefs = new Set(
    state.networkPolicies.map((policy) => policy.policyRef)
  );
  const missingSeedPolicies = seedMcpState.networkPolicies.filter(
    (policy) => !existingPolicyRefs.has(policy.policyRef)
  );

  return mcpStateSchema.parse({
    ...state,
    registry: reconciledRegistry,
    networkPolicies: [...state.networkPolicies, ...missingSeedPolicies],
  });
}

function statesEqual(left: McpState, right: McpState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

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
    const reconciled = reconcileMcpSeedState(state);
    if (!statesEqual(state, reconciled)) {
      await this.replaceState(reconciled);
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
    const reconciled = reconcileMcpSeedState(state);
    if (!statesEqual(state, reconciled)) {
      await this.replaceState(reconciled);
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
