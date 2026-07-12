import { runSnapshotSchema, type RunSnapshot } from "@lingban/contracts";
import type { PostgresRepositoryOptions } from "./postgres-types.js";
import {
  projectRunSnapshot,
  runAggregateSchema,
  type RunAggregate,
  type RunQueryRepository,
} from "./runs.js";

export abstract class CachedRunQueryRepository implements RunQueryRepository {
  #snapshots = new Map<string, RunSnapshot>();
  #writeChains = new Map<string, Promise<void>>();

  async init() {
    const snapshots = await this.loadAll();
    this.#snapshots.clear();

    for (const snapshot of snapshots) {
      const parsed = runSnapshotSchema.parse(snapshot);
      this.#snapshots.set(parsed.run.runId, parsed);
    }
  }

  getSnapshot(runId: string) {
    return this.#snapshots.get(runId) ?? null;
  }

  listSnapshots() {
    return [...this.#snapshots.values()].sort((left, right) =>
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

  async upsertSnapshot(snapshot: RunSnapshot) {
    const parsed = runSnapshotSchema.parse(snapshot);
    this.#snapshots.set(parsed.run.runId, parsed);
    await this.#enqueuePersist(parsed.run.runId, () => this.persist(parsed));
    return parsed;
  }

  async clear() {
    await this.clearStorage();
    this.#snapshots.clear();
  }

  protected abstract loadAll(): Promise<RunSnapshot[]>;
  protected abstract persist(snapshot: RunSnapshot): Promise<void>;
  protected abstract clearStorage(): Promise<void>;
}

export class PostgresRunQueryRepository extends CachedRunQueryRepository {
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

    return result.rows.map((row) =>
      projectRunSnapshot(runAggregateSchema.parse(row.aggregate_json) as RunAggregate)
    );
  }

  protected async persist(_snapshot: RunSnapshot) {
    // Query snapshots are rebuilt from lingban_runs aggregate_json on init.
  }

  protected async clearStorage() {
    // Query snapshot storage is derived from lingban_runs and does not own a separate table yet.
  }
}
