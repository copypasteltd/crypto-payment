import { billingEntrySchema } from "@lingban/contracts";
import { z } from "zod";
export const billingStateSchema = z.object({
    entries: z.array(billingEntrySchema).default([]),
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
export class CachedBillingRepository {
    initialized = false;
    state = billingStateSchema.parse({
        entries: [],
    });
    async init() {
        if (this.initialized) {
            return;
        }
        this.state = billingStateSchema.parse(await this.loadState());
        this.initialized = true;
    }
    listEntries() {
        return [...this.state.entries].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) ||
            left.entryId.localeCompare(right.entryId));
    }
    getEntryById(entryId) {
        return this.state.entries.find((item) => item.entryId === entryId) ?? null;
    }
    async saveEntry(entry) {
        const parsed = billingEntrySchema.parse(entry);
        await this.updateState((state) => ({
            ...state,
            entries: replaceByKey(state.entries, parsed, (item) => item.entryId),
        }));
    }
    async updateState(mutator) {
        const nextState = billingStateSchema.parse(mutator(this.state));
        this.state = nextState;
        await this.writeState(nextState);
    }
    replaceCachedEntry(entry) {
        const parsed = billingEntrySchema.parse(entry);
        this.state = billingStateSchema.parse({
            ...this.state,
            entries: replaceByKey(this.state.entries, parsed, (item) => item.entryId),
        });
    }
}
export class PostgresBillingRepository extends CachedBillingRepository {
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
        const result = await queryable.query("SELECT entry_json FROM lingban_billing_entries ORDER BY occurred_at DESC, entry_id ASC");
        return billingStateSchema.parse({
            entries: result.rows.map((row) => row.entry_json),
        });
    }
    async saveEntry(entry) {
        const parsed = billingEntrySchema.parse(entry);
        await this.init();
        this.replaceCachedEntry(parsed);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_billing_entries (
        entry_id,
        workspace_id,
        package_id,
        service_id,
        run_id,
        metric,
        source,
        occurred_at,
        entry_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (entry_id)
      DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        package_id = EXCLUDED.package_id,
        service_id = EXCLUDED.service_id,
        run_id = EXCLUDED.run_id,
        metric = EXCLUDED.metric,
        source = EXCLUDED.source,
        occurred_at = EXCLUDED.occurred_at,
        entry_json = EXCLUDED.entry_json
      `, [
            parsed.entryId,
            parsed.workspaceId,
            parsed.packageId,
            parsed.serviceId,
            parsed.runId,
            parsed.metric,
            parsed.source,
            parsed.occurredAt,
            JSON.stringify(parsed),
        ]);
    }
    async writeState(state) {
        const parsed = billingStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_billing_entries");
            for (const entry of parsed.entries) {
                await queryable.query(`
          INSERT INTO lingban_billing_entries (
            entry_id,
            workspace_id,
            package_id,
            service_id,
            run_id,
            metric,
            source,
            occurred_at,
            entry_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `, [
                    entry.entryId,
                    entry.workspaceId,
                    entry.packageId,
                    entry.serviceId,
                    entry.runId,
                    entry.metric,
                    entry.source,
                    entry.occurredAt,
                    JSON.stringify(entry),
                ]);
            }
        });
    }
}
//# sourceMappingURL=billing-repository.js.map