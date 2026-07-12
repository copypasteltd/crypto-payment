import { runSnapshotSchema } from "@lingban/contracts";
import { projectRunSnapshot, runAggregateSchema, } from "./runs.js";
export class CachedRunQueryRepository {
    #snapshots = new Map();
    #writeChains = new Map();
    async init() {
        const snapshots = await this.loadAll();
        this.#snapshots.clear();
        for (const snapshot of snapshots) {
            const parsed = runSnapshotSchema.parse(snapshot);
            this.#snapshots.set(parsed.run.runId, parsed);
        }
    }
    getSnapshot(runId) {
        return this.#snapshots.get(runId) ?? null;
    }
    listSnapshots() {
        return [...this.#snapshots.values()].sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt));
    }
    async #enqueuePersist(runId, persist) {
        const previous = this.#writeChains.get(runId) ?? Promise.resolve();
        const current = previous
            .catch(() => undefined)
            .then(async () => {
            await persist();
        });
        this.#writeChains.set(runId, current);
        try {
            await current;
        }
        finally {
            if (this.#writeChains.get(runId) === current) {
                this.#writeChains.delete(runId);
            }
        }
    }
    async upsertSnapshot(snapshot) {
        const parsed = runSnapshotSchema.parse(snapshot);
        this.#snapshots.set(parsed.run.runId, parsed);
        await this.#enqueuePersist(parsed.run.runId, () => this.persist(parsed));
        return parsed;
    }
    async clear() {
        await this.clearStorage();
        this.#snapshots.clear();
    }
}
export class PostgresRunQueryRepository extends CachedRunQueryRepository {
    #options;
    constructor(options) {
        super();
        this.#options = options;
    }
    async #getQueryable() {
        await this.#options.ensureReady?.();
        return this.#options.getQueryable();
    }
    async loadAll() {
        const queryable = await this.#getQueryable();
        const result = await queryable.query(`
      SELECT aggregate_json
      FROM lingban_runs
      ORDER BY created_at ASC, run_id ASC
      `);
        return result.rows.map((row) => projectRunSnapshot(runAggregateSchema.parse(row.aggregate_json)));
    }
    async persist(_snapshot) {
        // Query snapshots are rebuilt from lingban_runs aggregate_json on init.
    }
    async clearStorage() {
        // Query snapshot storage is derived from lingban_runs and does not own a separate table yet.
    }
}
//# sourceMappingURL=run-query-repository.js.map