import { runAggregateSchema, type RunAggregate, type RunsRepository } from "./runs.js";
import type { PostgresRepositoryOptions } from "./postgres-types.js";

export abstract class CachedRunsRepository implements RunsRepository {
  #runs = new Map<string, RunAggregate>();
  #writeChains = new Map<string, Promise<void>>();

  async init() {
    const aggregates = await this.loadAll();
    this.#runs.clear();

    for (const aggregate of aggregates) {
      this.#runs.set(aggregate.run.runId, runAggregateSchema.parse(aggregate) as RunAggregate);
    }
  }

  get(runId: string) {
    return this.#runs.get(runId) ?? null;
  }

  list() {
    return [...this.#runs.values()].sort((left, right) =>
      left.run.createdAt.localeCompare(right.run.createdAt)
    );
  }

  async #enqueuePersist(runId: string, persist: () => Promise<void>) {
    const previous = this.#writeChains.get(runId) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        await persist();
      });

    this.#writeChains.set(runId, current);

    try {
      await current;
    } finally {
      if (this.#writeChains.get(runId) === current) {
        this.#writeChains.delete(runId);
      }
    }
  }

  async save(aggregate: RunAggregate) {
    const parsed = runAggregateSchema.parse(aggregate) as RunAggregate;
    this.#runs.set(parsed.run.runId, parsed);
    await this.#enqueuePersist(parsed.run.runId, () => this.persist(parsed));
    return parsed;
  }

  async update(runId: string, updater: (current: RunAggregate) => RunAggregate) {
    const current = this.get(runId);

    if (!current) {
      return null;
    }

    const next = runAggregateSchema.parse(updater(current)) as RunAggregate;
    this.#runs.set(runId, next);
    await this.#enqueuePersist(runId, () => this.persist(next));
    return next;
  }

  async clear() {
    await this.clearStorage();
    this.#runs.clear();
  }

  protected abstract loadAll(): Promise<RunAggregate[]>;
  protected abstract persist(aggregate: RunAggregate): Promise<void>;
  protected abstract clearStorage(): Promise<void>;
}

export class PostgresRunsRepository extends CachedRunsRepository {
  #options: PostgresRepositoryOptions;

  constructor(options: PostgresRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadAll() {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ aggregate_json: RunAggregate }>(
      `
      SELECT aggregate_json
      FROM lingban_runs
      ORDER BY created_at ASC, run_id ASC
      `
    );

    return result.rows.map((row) => runAggregateSchema.parse(row.aggregate_json) as RunAggregate);
  }

  protected async persist(aggregate: RunAggregate) {
    const queryable = await this.#getQueryable();
    const payload = runAggregateSchema.parse(aggregate);

    await queryable.query(
      `
      INSERT INTO lingban_runs (
        run_id,
        workspace_id,
        status,
        title,
        target_path,
        run_purpose,
        session_bootstrap_mode,
        session_project_id,
        task_version_id,
        session_version_id,
        workspace_context_key,
        service_id,
        created_at,
        updated_at,
        aggregate_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      ON CONFLICT (run_id) DO UPDATE
      SET
        workspace_id = EXCLUDED.workspace_id,
        status = EXCLUDED.status,
        title = EXCLUDED.title,
        target_path = EXCLUDED.target_path,
        run_purpose = EXCLUDED.run_purpose,
        session_bootstrap_mode = EXCLUDED.session_bootstrap_mode,
        session_project_id = EXCLUDED.session_project_id,
        task_version_id = EXCLUDED.task_version_id,
        session_version_id = EXCLUDED.session_version_id,
        workspace_context_key = EXCLUDED.workspace_context_key,
        service_id = EXCLUDED.service_id,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        aggregate_json = EXCLUDED.aggregate_json
      `,
      [
        payload.run.runId,
        payload.run.workspaceId,
        payload.run.status,
        payload.run.title,
        payload.run.targetPath,
        payload.run.runPurpose,
        payload.run.sessionBootstrapMode,
        payload.run.sessionProjectId,
        payload.run.taskVersionId,
        payload.run.sessionVersionId,
        payload.run.catalogMetadata?.workspaceContextKey ?? null,
        payload.run.catalogMetadata?.serviceId ?? null,
        payload.run.createdAt,
        payload.run.updatedAt,
        JSON.stringify(payload),
      ]
    );
  }

  protected async clearStorage() {
    const queryable = await this.#getQueryable();
    await queryable.query("DELETE FROM lingban_runs");
  }
}
