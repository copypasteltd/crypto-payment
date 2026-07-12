import { runAggregateSchema } from "./runs.js";
export class CachedRunsRepository {
    #runs = new Map();
    #writeChains = new Map();
    async init() {
        const aggregates = await this.loadAll();
        this.#runs.clear();
        for (const aggregate of aggregates) {
            this.#runs.set(aggregate.run.runId, runAggregateSchema.parse(aggregate));
        }
    }
    get(runId) {
        return this.#runs.get(runId) ?? null;
    }
    list() {
        return [...this.#runs.values()].sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt));
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
    async save(aggregate) {
        const parsed = runAggregateSchema.parse(aggregate);
        this.#runs.set(parsed.run.runId, parsed);
        await this.#enqueuePersist(parsed.run.runId, () => this.persist(parsed));
        return parsed;
    }
    async update(runId, updater) {
        const current = this.get(runId);
        if (!current) {
            return null;
        }
        const next = runAggregateSchema.parse(updater(current));
        this.#runs.set(runId, next);
        await this.#enqueuePersist(runId, () => this.persist(next));
        return next;
    }
    async clear() {
        await this.clearStorage();
        this.#runs.clear();
    }
}
export class PostgresRunsRepository extends CachedRunsRepository {
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
        return result.rows.map((row) => runAggregateSchema.parse(row.aggregate_json));
    }
    async persist(aggregate) {
        const queryable = await this.#getQueryable();
        const payload = runAggregateSchema.parse(aggregate);
        await queryable.query(`
      INSERT INTO lingban_runs (
        run_id,
        workspace_id,
        status,
        title,
        target_path,
        created_at,
        updated_at,
        aggregate_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (run_id) DO UPDATE
      SET
        workspace_id = EXCLUDED.workspace_id,
        status = EXCLUDED.status,
        title = EXCLUDED.title,
        target_path = EXCLUDED.target_path,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        aggregate_json = EXCLUDED.aggregate_json
      `, [
            payload.run.runId,
            payload.run.workspaceId,
            payload.run.status,
            payload.run.title,
            payload.run.targetPath,
            payload.run.createdAt,
            payload.run.updatedAt,
            JSON.stringify(payload),
        ]);
    }
    async clearStorage() {
        const queryable = await this.#getQueryable();
        await queryable.query("DELETE FROM lingban_runs");
    }
}
//# sourceMappingURL=runs-repository.js.map