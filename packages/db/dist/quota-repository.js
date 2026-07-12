import { quotaCounterSchema, quotaEventSchema, quotaOverrideIdSchema, quotaOverrideRecordSchema, quotaPolicyIdSchema, quotaPolicySchema, } from "@lingban/contracts";
import { z } from "zod";
export const quotaStateSchema = z.object({
    policies: z.array(quotaPolicySchema).default([]),
    counters: z.array(quotaCounterSchema).default([]),
    events: z.array(quotaEventSchema).default([]),
    overrides: z.array(quotaOverrideRecordSchema).default([]),
});
export const quotaPolicyIdParamsSchema = z.object({
    policyId: quotaPolicyIdSchema,
});
export const quotaOverrideIdParamsSchema = z.object({
    overrideId: quotaOverrideIdSchema,
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
export class CachedQuotaRepository {
    #initialized = false;
    #state = quotaStateSchema.parse({
        policies: [],
        counters: [],
        events: [],
        overrides: [],
    });
    async init() {
        if (this.#initialized) {
            return;
        }
        this.#state = quotaStateSchema.parse(await this.loadState());
        this.#initialized = true;
    }
    listPolicies() {
        return [...this.#state.policies].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) ||
            left.policyId.localeCompare(right.policyId));
    }
    getPolicyById(policyId) {
        return this.#state.policies.find((item) => item.policyId === policyId) ?? null;
    }
    listCounters() {
        return [...this.#state.counters].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) ||
            left.counterId.localeCompare(right.counterId));
    }
    listEvents() {
        return [...this.#state.events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) ||
            left.eventId.localeCompare(right.eventId));
    }
    listOverrides() {
        return [...this.#state.overrides].sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) ||
            left.overrideId.localeCompare(right.overrideId));
    }
    getOverrideById(overrideId) {
        return this.#state.overrides.find((item) => item.overrideId === overrideId) ?? null;
    }
    async savePolicy(policy) {
        await this.init();
        await this.updateState((state) => ({
            ...state,
            policies: replaceByKey(state.policies, policy, (item) => item.policyId),
        }));
    }
    async saveCounter(counter) {
        await this.init();
        await this.updateState((state) => ({
            ...state,
            counters: replaceByKey(state.counters, counter, (item) => item.counterId),
        }));
    }
    async saveEvent(event) {
        await this.init();
        await this.updateState((state) => ({
            ...state,
            events: replaceByKey(state.events, event, (item) => item.eventId),
        }));
    }
    async saveOverride(record) {
        await this.init();
        await this.updateState((state) => ({
            ...state,
            overrides: replaceByKey(state.overrides, record, (item) => item.overrideId),
        }));
    }
    async replaceState(state) {
        const nextState = quotaStateSchema.parse(state);
        this.#state = nextState;
        await this.writeState(nextState);
    }
    getState() {
        return this.#state;
    }
    async updateState(mutator) {
        const nextState = quotaStateSchema.parse(mutator(this.#state));
        this.#state = nextState;
        await this.writeState(nextState);
    }
}
export class PostgresQuotaRepository extends CachedQuotaRepository {
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
        const [policies, counters, events, overrides] = await Promise.all([
            queryable.query("SELECT policy_json FROM lingban_quota_policies ORDER BY updated_at DESC, policy_id ASC"),
            queryable.query("SELECT counter_json FROM lingban_quota_counters ORDER BY updated_at DESC, counter_id ASC"),
            queryable.query("SELECT event_json FROM lingban_quota_events ORDER BY occurred_at DESC, event_id ASC"),
            queryable.query("SELECT override_json FROM lingban_quota_overrides ORDER BY requested_at DESC, override_id ASC"),
        ]);
        return quotaStateSchema.parse({
            policies: policies.rows.map((row) => row.policy_json),
            counters: counters.rows.map((row) => row.counter_json),
            events: events.rows.map((row) => row.event_json),
            overrides: overrides.rows.map((row) => row.override_json),
        });
    }
    async writeState(state) {
        const parsed = quotaStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_quota_overrides");
            await queryable.query("DELETE FROM lingban_quota_events");
            await queryable.query("DELETE FROM lingban_quota_counters");
            await queryable.query("DELETE FROM lingban_quota_policies");
            for (const policy of parsed.policies) {
                await queryable.query(`
          INSERT INTO lingban_quota_policies (
            policy_id,
            workspace_id,
            scope_type,
            scope_ref_id,
            metric,
            status,
            enabled,
            updated_at,
            policy_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `, [
                    policy.policyId,
                    policy.workspaceId,
                    policy.scopeType,
                    policy.scopeRefId,
                    policy.metric,
                    policy.status,
                    policy.enabled,
                    policy.updatedAt,
                    JSON.stringify(policy),
                ]);
            }
            for (const counter of parsed.counters) {
                await queryable.query(`
          INSERT INTO lingban_quota_counters (
            counter_id,
            policy_id,
            workspace_id,
            scope_type,
            scope_ref_id,
            metric,
            window_started_at,
            window_ends_at,
            updated_at,
            counter_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
          `, [
                    counter.counterId,
                    counter.policyId,
                    counter.workspaceId,
                    counter.scopeType,
                    counter.scopeRefId,
                    counter.metric,
                    counter.windowStartedAt,
                    counter.windowEndsAt,
                    counter.updatedAt,
                    JSON.stringify(counter),
                ]);
            }
            for (const event of parsed.events) {
                await queryable.query(`
          INSERT INTO lingban_quota_events (
            event_id,
            policy_id,
            workspace_id,
            scope_type,
            scope_ref_id,
            metric,
            decision,
            occurred_at,
            event_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `, [
                    event.eventId,
                    event.policyId,
                    event.workspaceId,
                    event.scopeType,
                    event.scopeRefId,
                    event.metric,
                    event.decision,
                    event.occurredAt,
                    JSON.stringify(event),
                ]);
            }
            for (const record of parsed.overrides) {
                await queryable.query(`
          INSERT INTO lingban_quota_overrides (
            override_id,
            policy_id,
            workspace_id,
            scope_type,
            scope_ref_id,
            metric,
            status,
            requested_at,
            override_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `, [
                    record.overrideId,
                    record.policyId,
                    record.workspaceId,
                    record.scopeType,
                    record.scopeRefId,
                    record.metric,
                    record.status,
                    record.requestedAt,
                    JSON.stringify(record),
                ]);
            }
        });
    }
}
//# sourceMappingURL=quota-repository.js.map