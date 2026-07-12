import { batchRunItemSchema, batchRunJobSchema, type BatchRunItem, type BatchRunJob } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export const batchRunsStateSchema = z.object({
  jobs: z.array(batchRunJobSchema).default([]),
  items: z.array(batchRunItemSchema).default([]),
});

export type BatchRunsState = z.infer<typeof batchRunsStateSchema>;

export interface BatchRunsRepository {
  init(): Promise<void>;
  listJobs(): BatchRunJob[];
  getJob(batchJobId: string): BatchRunJob | null;
  listItems(batchJobId: string): BatchRunItem[];
  saveBatch(job: BatchRunJob, items: BatchRunItem[]): Promise<void>;
  clear(): Promise<void>;
}

function replaceJob(records: BatchRunJob[], nextJob: BatchRunJob) {
  const nextRecords = [...records];
  const existingIndex = nextRecords.findIndex((item) => item.batchJobId === nextJob.batchJobId);
  if (existingIndex >= 0) {
    nextRecords[existingIndex] = nextJob;
    return nextRecords;
  }

  nextRecords.push(nextJob);
  return nextRecords;
}

function replaceBatchItems(records: BatchRunItem[], batchJobId: string, nextItems: BatchRunItem[]) {
  return [...records.filter((item) => item.batchJobId !== batchJobId), ...nextItems];
}

export abstract class CachedBatchRunsRepository implements BatchRunsRepository {
  #initialized = false;
  #state: BatchRunsState = batchRunsStateSchema.parse({});

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = await this.loadState();
    this.#initialized = true;
  }

  listJobs() {
    return [...this.#state.jobs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  getJob(batchJobId: string) {
    return this.#state.jobs.find((item) => item.batchJobId === batchJobId) ?? null;
  }

  listItems(batchJobId: string) {
    return this.#state.items
      .filter((item) => item.batchJobId === batchJobId)
      .sort((left, right) => left.rowIndex - right.rowIndex);
  }

  async saveBatch(job: BatchRunJob, items: BatchRunItem[]) {
    await this.init();
    const nextState = batchRunsStateSchema.parse({
      jobs: replaceJob(this.#state.jobs, job),
      items: replaceBatchItems(this.#state.items, job.batchJobId, items),
    });
    this.#state = nextState;
    await this.persistBatch(job, items);
  }

  async clear() {
    await this.init();
    this.#state = batchRunsStateSchema.parse({});
    await this.clearStorage();
  }

  protected getState() {
    return this.#state;
  }

  protected abstract loadState(): Promise<BatchRunsState>;
  protected abstract persistBatch(job: BatchRunJob, items: BatchRunItem[]): Promise<void>;
  protected abstract clearStorage(): Promise<void>;
}

export interface PostgresBatchRunsRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresBatchRunsRepository extends CachedBatchRunsRepository {
  #options: PostgresBatchRunsRepositoryOptions;

  constructor(options: PostgresBatchRunsRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const [jobsResult, itemsResult] = await Promise.all([
      queryable.query<{ job_json: BatchRunJob }>(
        "SELECT job_json FROM lingban_batch_run_jobs ORDER BY updated_at DESC, batch_job_id ASC"
      ),
      queryable.query<{ item_json: BatchRunItem }>(
        "SELECT item_json FROM lingban_batch_run_items ORDER BY batch_job_id ASC, row_index ASC, batch_item_id ASC"
      ),
    ]);

    return batchRunsStateSchema.parse({
      jobs: jobsResult.rows.map((row) => row.job_json),
      items: itemsResult.rows.map((row) => row.item_json),
    });
  }

  protected async persistBatch(job: BatchRunJob, items: BatchRunItem[]) {
    await this.#options.withTransaction(async (queryable) => {
      await queryable.query(
        `
        INSERT INTO lingban_batch_run_jobs (
          batch_job_id,
          workspace_id,
          workspace_context_key,
          service_id,
          status,
          created_at,
          updated_at,
          job_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (batch_job_id) DO UPDATE SET
          workspace_id = EXCLUDED.workspace_id,
          workspace_context_key = EXCLUDED.workspace_context_key,
          service_id = EXCLUDED.service_id,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          job_json = EXCLUDED.job_json
        `,
        [
          job.batchJobId,
          job.workspaceId,
          job.workspaceContextKey,
          job.serviceId,
          job.status,
          job.createdAt,
          job.updatedAt,
          JSON.stringify(job),
        ]
      );

      await queryable.query("DELETE FROM lingban_batch_run_items WHERE batch_job_id = $1", [
        job.batchJobId,
      ]);

      for (const item of items) {
        await queryable.query(
          `
          INSERT INTO lingban_batch_run_items (
            batch_item_id,
            batch_job_id,
            row_index,
            status,
            run_id,
            created_at,
            updated_at,
            item_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (batch_item_id) DO UPDATE SET
            batch_job_id = EXCLUDED.batch_job_id,
            row_index = EXCLUDED.row_index,
            status = EXCLUDED.status,
            run_id = EXCLUDED.run_id,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at,
            item_json = EXCLUDED.item_json
          `,
          [
            item.batchItemId,
            item.batchJobId,
            item.rowIndex,
            item.status,
            item.runId,
            item.createdAt,
            item.updatedAt,
            JSON.stringify(item),
          ]
        );
      }
    });
  }

  protected async clearStorage() {
    const queryable = await this.#getQueryable();
    await queryable.query("DELETE FROM lingban_batch_run_items");
    await queryable.query("DELETE FROM lingban_batch_run_jobs");
  }
}
