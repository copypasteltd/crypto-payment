import {
  mcpBindingIdSchema,
  mcpBindingRecordSchema,
  mcpHealthSnapshotSchema,
  mcpIdSchema,
  mcpNetworkPolicyRefSchema,
  mcpNetworkPolicySchema,
  mcpRegistryEntrySchema,
  type McpBindingRecord,
  type McpHealthSnapshot,
  type McpNetworkPolicy,
  type McpRegistryEntry,
} from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export const mcpStateSchema = z.object({
  registry: z.array(mcpRegistryEntrySchema).default([]),
  bindings: z.array(mcpBindingRecordSchema).default([]),
  networkPolicies: z.array(mcpNetworkPolicySchema).default([]),
  healthSnapshots: z.array(mcpHealthSnapshotSchema).default([]),
});

export const mcpIdParamsSchema = z.object({
  mcpId: mcpIdSchema,
});

export const mcpBindingIdParamsSchema = z.object({
  bindingId: mcpBindingIdSchema,
});

export const mcpNetworkPolicyRefParamsSchema = z.object({
  policyRef: mcpNetworkPolicyRefSchema,
});

export type McpState = z.infer<typeof mcpStateSchema>;

export interface McpRepository {
  init(): Promise<void>;
  listRegistry(): McpRegistryEntry[];
  getRegistryEntry(mcpId: string): McpRegistryEntry | null;
  saveRegistryEntry(entry: McpRegistryEntry): Promise<McpRegistryEntry>;
  listBindings(): McpBindingRecord[];
  getBinding(bindingId: string): McpBindingRecord | null;
  saveBinding(binding: McpBindingRecord): Promise<McpBindingRecord>;
  listNetworkPolicies(): McpNetworkPolicy[];
  getNetworkPolicy(policyRef: string): McpNetworkPolicy | null;
  saveNetworkPolicy(policy: McpNetworkPolicy): Promise<McpNetworkPolicy>;
  listHealthSnapshots(): McpHealthSnapshot[];
  getLatestHealthSnapshot(params: {
    mcpId: string;
    bindingId?: string | null;
  }): McpHealthSnapshot | null;
  saveHealthSnapshot(snapshot: McpHealthSnapshot): Promise<McpHealthSnapshot>;
}

function replaceByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const key = getKey(nextItem);
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex((item) => getKey(item) === key);

  if (existingIndex >= 0) {
    nextItems[existingIndex] = nextItem;
    return nextItems;
  }

  nextItems.push(nextItem);
  return nextItems;
}

function compareHealthSnapshots(left: McpHealthSnapshot, right: McpHealthSnapshot) {
  return (
    right.probedAt.localeCompare(left.probedAt) ||
    right.recordedAt.localeCompare(left.recordedAt) ||
    left.snapshotId.localeCompare(right.snapshotId)
  );
}

export abstract class CachedMcpRepository implements McpRepository {
  #initialized = false;
  #state: McpState = mcpStateSchema.parse({
    registry: [],
    bindings: [],
    networkPolicies: [],
    healthSnapshots: [],
  });

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = mcpStateSchema.parse(await this.loadState());
    this.#initialized = true;
  }

  listRegistry() {
    return [...this.#state.registry].sort((left, right) => left.mcpId.localeCompare(right.mcpId));
  }

  getRegistryEntry(mcpId: string) {
    return this.#state.registry.find((item) => item.mcpId === mcpId) ?? null;
  }

  async saveRegistryEntry(entry: McpRegistryEntry) {
    await this.init();
    const parsed = mcpRegistryEntrySchema.parse(entry);
    await this.updateState((state) => ({
      ...state,
      registry: replaceByKey(state.registry, parsed, (item) => item.mcpId),
    }));
    return parsed;
  }

  listBindings() {
    return [...this.#state.bindings].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.bindingId.localeCompare(right.bindingId)
    );
  }

  getBinding(bindingId: string) {
    return this.#state.bindings.find((item) => item.bindingId === bindingId) ?? null;
  }

  async saveBinding(binding: McpBindingRecord) {
    await this.init();
    const parsed = mcpBindingRecordSchema.parse(binding);
    await this.updateState((state) => ({
      ...state,
      bindings: replaceByKey(state.bindings, parsed, (item) => item.bindingId),
    }));
    return parsed;
  }

  listNetworkPolicies() {
    return [...this.#state.networkPolicies].sort((left, right) => left.policyRef.localeCompare(right.policyRef));
  }

  getNetworkPolicy(policyRef: string) {
    return this.#state.networkPolicies.find((item) => item.policyRef === policyRef) ?? null;
  }

  async saveNetworkPolicy(policy: McpNetworkPolicy) {
    await this.init();
    const parsed = mcpNetworkPolicySchema.parse(policy);
    await this.updateState((state) => ({
      ...state,
      networkPolicies: replaceByKey(state.networkPolicies, parsed, (item) => item.policyRef),
    }));
    return parsed;
  }

  listHealthSnapshots() {
    return [...this.#state.healthSnapshots].sort(compareHealthSnapshots);
  }

  getLatestHealthSnapshot(params: { mcpId: string; bindingId?: string | null }) {
    return (
      this.listHealthSnapshots().find(
        (snapshot) =>
          snapshot.mcpId === params.mcpId &&
          (params.bindingId === undefined
            ? true
            : params.bindingId == null
              ? snapshot.bindingId == null
              : snapshot.bindingId === params.bindingId)
      ) ?? null
    );
  }

  async saveHealthSnapshot(snapshot: McpHealthSnapshot) {
    await this.init();
    const parsed = mcpHealthSnapshotSchema.parse(snapshot);
    await this.updateState((state) => {
      const related = replaceByKey(
        state.healthSnapshots.filter(
          (item) => item.mcpId === parsed.mcpId && item.bindingId === parsed.bindingId
        ),
        parsed,
        (item) => item.snapshotId
      )
        .sort(compareHealthSnapshots)
        .slice(0, 20);
      const unrelated = state.healthSnapshots.filter(
        (item) => item.mcpId !== parsed.mcpId || item.bindingId !== parsed.bindingId
      );

      return {
        ...state,
        healthSnapshots: [...unrelated, ...related],
      };
    });
    return parsed;
  }

  protected async replaceState(state: McpState) {
    const nextState = mcpStateSchema.parse(state);
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected getState() {
    return this.#state;
  }

  protected async updateState(mutator: (state: McpState) => McpState) {
    const nextState = mcpStateSchema.parse(mutator(this.#state));
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected abstract loadState(): Promise<McpState>;
  protected abstract writeState(state: McpState): Promise<void>;
}

export interface PostgresMcpRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresMcpRepository extends CachedMcpRepository {
  #options: PostgresMcpRepositoryOptions;

  constructor(options: PostgresMcpRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const [registry, bindings, networkPolicies, healthSnapshots] = await Promise.all([
      queryable.query<{ mcp_json: McpRegistryEntry }>(
        "SELECT mcp_json FROM lingban_mcp_registry ORDER BY mcp_id ASC"
      ),
      queryable.query<{ binding_json: McpBindingRecord }>(
        "SELECT binding_json FROM lingban_mcp_bindings ORDER BY binding_id ASC"
      ),
      queryable.query<{ policy_json: McpNetworkPolicy }>(
        "SELECT policy_json FROM lingban_mcp_network_policies ORDER BY policy_ref ASC"
      ),
      queryable.query<{ snapshot_json: McpHealthSnapshot }>(
        "SELECT snapshot_json FROM lingban_mcp_health_snapshots ORDER BY probed_at DESC, snapshot_id ASC"
      ),
    ]);

    return mcpStateSchema.parse({
      registry: registry.rows.map((row) => row.mcp_json),
      bindings: bindings.rows.map((row) => row.binding_json),
      networkPolicies: networkPolicies.rows.map((row) => row.policy_json),
      healthSnapshots: healthSnapshots.rows.map((row) => row.snapshot_json),
    });
  }

  protected async writeState(state: McpState) {
    const parsed = mcpStateSchema.parse(state);
    await this.#options.withTransaction(async (queryable) => {
      await queryable.query("DELETE FROM lingban_mcp_health_snapshots");
      await queryable.query("DELETE FROM lingban_mcp_network_policies");
      await queryable.query("DELETE FROM lingban_mcp_bindings");
      await queryable.query("DELETE FROM lingban_mcp_registry");

      for (const entry of parsed.registry) {
        await queryable.query(
          `
          INSERT INTO lingban_mcp_registry (
            mcp_id,
            workspace_id,
            source,
            status,
            risk_level,
            mcp_json
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            entry.mcpId,
            entry.workspaceId,
            entry.source,
            entry.status,
            entry.riskLevel,
            JSON.stringify(entry),
          ]
        );
      }

      for (const binding of parsed.bindings) {
        await queryable.query(
          `
          INSERT INTO lingban_mcp_bindings (
            binding_id,
            mcp_id,
            workspace_id,
            scope,
            scope_ref,
            status,
            credential_id,
            binding_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `,
          [
            binding.bindingId,
            binding.mcpId,
            binding.workspaceId,
            binding.scope,
            binding.scopeRef,
            binding.status,
            binding.credentialId,
            JSON.stringify(binding),
          ]
        );
      }

      for (const policy of parsed.networkPolicies) {
        await queryable.query(
          `
          INSERT INTO lingban_mcp_network_policies (
            policy_ref,
            workspace_id,
            status,
            policy_json
          )
          VALUES ($1, $2, $3, $4::jsonb)
          `,
          [
            policy.policyRef,
            policy.workspaceId,
            policy.status,
            JSON.stringify(policy),
          ]
        );
      }

      for (const snapshot of parsed.healthSnapshots) {
        await queryable.query(
          `
          INSERT INTO lingban_mcp_health_snapshots (
            snapshot_id,
            mcp_id,
            binding_id,
            workspace_id,
            status,
            probed_at,
            snapshot_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          `,
          [
            snapshot.snapshotId,
            snapshot.mcpId,
            snapshot.bindingId,
            snapshot.workspaceId,
            snapshot.status,
            snapshot.probedAt,
            JSON.stringify(snapshot),
          ]
        );
      }
    });
  }
}
