import { mcpBindingIdSchema, mcpBindingRecordSchema, mcpHealthSnapshotSchema, mcpIdSchema, mcpNetworkPolicyRefSchema, mcpNetworkPolicySchema, mcpRegistryEntrySchema, } from "@lingban/contracts";
import { z } from "zod";
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
function replaceByKey(items, nextItem, getKey) {
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
function compareHealthSnapshots(left, right) {
    return (right.probedAt.localeCompare(left.probedAt) ||
        right.recordedAt.localeCompare(left.recordedAt) ||
        left.snapshotId.localeCompare(right.snapshotId));
}
export class CachedMcpRepository {
    #initialized = false;
    #state = mcpStateSchema.parse({
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
    getRegistryEntry(mcpId) {
        return this.#state.registry.find((item) => item.mcpId === mcpId) ?? null;
    }
    async saveRegistryEntry(entry) {
        await this.init();
        const parsed = mcpRegistryEntrySchema.parse(entry);
        await this.updateState((state) => ({
            ...state,
            registry: replaceByKey(state.registry, parsed, (item) => item.mcpId),
        }));
        return parsed;
    }
    listBindings() {
        return [...this.#state.bindings].sort((left, right) => left.createdAt.localeCompare(right.createdAt) ||
            left.bindingId.localeCompare(right.bindingId));
    }
    getBinding(bindingId) {
        return this.#state.bindings.find((item) => item.bindingId === bindingId) ?? null;
    }
    async saveBinding(binding) {
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
    getNetworkPolicy(policyRef) {
        return this.#state.networkPolicies.find((item) => item.policyRef === policyRef) ?? null;
    }
    async saveNetworkPolicy(policy) {
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
    getLatestHealthSnapshot(params) {
        return (this.listHealthSnapshots().find((snapshot) => snapshot.mcpId === params.mcpId &&
            (params.bindingId === undefined
                ? true
                : params.bindingId == null
                    ? snapshot.bindingId == null
                    : snapshot.bindingId === params.bindingId)) ?? null);
    }
    async saveHealthSnapshot(snapshot) {
        await this.init();
        const parsed = mcpHealthSnapshotSchema.parse(snapshot);
        await this.updateState((state) => {
            const related = replaceByKey(state.healthSnapshots.filter((item) => item.mcpId === parsed.mcpId && item.bindingId === parsed.bindingId), parsed, (item) => item.snapshotId)
                .sort(compareHealthSnapshots)
                .slice(0, 20);
            const unrelated = state.healthSnapshots.filter((item) => item.mcpId !== parsed.mcpId || item.bindingId !== parsed.bindingId);
            return {
                ...state,
                healthSnapshots: [...unrelated, ...related],
            };
        });
        return parsed;
    }
    async replaceState(state) {
        const nextState = mcpStateSchema.parse(state);
        this.#state = nextState;
        await this.writeState(nextState);
    }
    getState() {
        return this.#state;
    }
    async updateState(mutator) {
        const nextState = mcpStateSchema.parse(mutator(this.#state));
        this.#state = nextState;
        await this.writeState(nextState);
    }
}
export class PostgresMcpRepository extends CachedMcpRepository {
    #options;
    constructor(options) {
        super();
        this.#options = options;
    }
    async #getQueryable() {
        await this.#options.ensureReady?.();
        return this.#options.getQueryable();
    }
    async loadState() {
        const queryable = await this.#getQueryable();
        const [registry, bindings, networkPolicies, healthSnapshots] = await Promise.all([
            queryable.query("SELECT mcp_json FROM lingban_mcp_registry ORDER BY mcp_id ASC"),
            queryable.query("SELECT binding_json FROM lingban_mcp_bindings ORDER BY binding_id ASC"),
            queryable.query("SELECT policy_json FROM lingban_mcp_network_policies ORDER BY policy_ref ASC"),
            queryable.query("SELECT snapshot_json FROM lingban_mcp_health_snapshots ORDER BY probed_at DESC, snapshot_id ASC"),
        ]);
        return mcpStateSchema.parse({
            registry: registry.rows.map((row) => row.mcp_json),
            bindings: bindings.rows.map((row) => row.binding_json),
            networkPolicies: networkPolicies.rows.map((row) => row.policy_json),
            healthSnapshots: healthSnapshots.rows.map((row) => row.snapshot_json),
        });
    }
    async writeState(state) {
        const parsed = mcpStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_mcp_health_snapshots");
            await queryable.query("DELETE FROM lingban_mcp_network_policies");
            await queryable.query("DELETE FROM lingban_mcp_bindings");
            await queryable.query("DELETE FROM lingban_mcp_registry");
            for (const entry of parsed.registry) {
                await queryable.query(`
          INSERT INTO lingban_mcp_registry (
            mcp_id,
            workspace_id,
            source,
            status,
            risk_level,
            mcp_json
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `, [
                    entry.mcpId,
                    entry.workspaceId,
                    entry.source,
                    entry.status,
                    entry.riskLevel,
                    JSON.stringify(entry),
                ]);
            }
            for (const binding of parsed.bindings) {
                await queryable.query(`
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
          `, [
                    binding.bindingId,
                    binding.mcpId,
                    binding.workspaceId,
                    binding.scope,
                    binding.scopeRef,
                    binding.status,
                    binding.credentialId,
                    JSON.stringify(binding),
                ]);
            }
            for (const policy of parsed.networkPolicies) {
                await queryable.query(`
          INSERT INTO lingban_mcp_network_policies (
            policy_ref,
            workspace_id,
            status,
            policy_json
          )
          VALUES ($1, $2, $3, $4::jsonb)
          `, [
                    policy.policyRef,
                    policy.workspaceId,
                    policy.status,
                    JSON.stringify(policy),
                ]);
            }
            for (const snapshot of parsed.healthSnapshots) {
                await queryable.query(`
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
          `, [
                    snapshot.snapshotId,
                    snapshot.mcpId,
                    snapshot.bindingId,
                    snapshot.workspaceId,
                    snapshot.status,
                    snapshot.probedAt,
                    JSON.stringify(snapshot),
                ]);
            }
        });
    }
}
//# sourceMappingURL=mcp-repository.js.map