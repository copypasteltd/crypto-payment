import { runFileRecordSchema, type RunFileRecord } from "@lingban/contracts";
import type { PostgresRepositoryOptions } from "./postgres-types.js";

export interface RunFilesIndexRepository {
  init(): Promise<void>;
  listRunFiles(runId: string): RunFileRecord[];
  getRunFile(runId: string, filePath: string): RunFileRecord | null;
  replaceRunFiles(runId: string, files: RunFileRecord[]): Promise<void>;
  upsertRunFile(file: RunFileRecord): Promise<RunFileRecord>;
  clear(): Promise<void>;
}

function sortFiles(files: RunFileRecord[]) {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

export abstract class CachedRunFilesIndexRepository implements RunFilesIndexRepository {
  #filesByRun = new Map<string, Map<string, RunFileRecord>>();
  #writeChains = new Map<string, Promise<void>>();

  async init() {
    const records = await this.loadAll();
    this.#filesByRun.clear();

    for (const record of records) {
      this.#setRecord(record);
    }
  }

  #setRecord(record: RunFileRecord) {
    const runBucket = this.#filesByRun.get(record.runId) ?? new Map<string, RunFileRecord>();
    runBucket.set(record.path, record);
    this.#filesByRun.set(record.runId, runBucket);
  }

  #replaceRun(runId: string, records: RunFileRecord[]) {
    const runBucket = new Map<string, RunFileRecord>();
    for (const record of sortFiles(records)) {
      runBucket.set(record.path, record);
    }
    this.#filesByRun.set(runId, runBucket);
  }

  listRunFiles(runId: string) {
    const runBucket = this.#filesByRun.get(runId);
    if (!runBucket) {
      return [];
    }

    return sortFiles([...runBucket.values()]);
  }

  getRunFile(runId: string, filePath: string) {
    return this.#filesByRun.get(runId)?.get(filePath) ?? null;
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

  async replaceRunFiles(runId: string, files: RunFileRecord[]) {
    const parsed = sortFiles(files).map((item) => runFileRecordSchema.parse(item));
    this.#replaceRun(runId, parsed);
    await this.#enqueuePersist(runId, () => this.persistRun(runId, parsed));
  }

  async upsertRunFile(file: RunFileRecord) {
    const parsed = runFileRecordSchema.parse(file);
    this.#setRecord(parsed);
    await this.#enqueuePersist(parsed.runId, () =>
      this.persistRun(parsed.runId, this.listRunFiles(parsed.runId))
    );
    return parsed;
  }

  async clear() {
    await this.clearStorage();
    this.#filesByRun.clear();
  }

  protected abstract loadAll(): Promise<RunFileRecord[]>;
  protected abstract persistRun(runId: string, files: RunFileRecord[]): Promise<void>;
  protected abstract clearStorage(): Promise<void>;
}

export class PostgresRunFilesIndexRepository extends CachedRunFilesIndexRepository {
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
    const result = await queryable.query<{ file_json: RunFileRecord }>(
      `
      SELECT file_json
      FROM lingban_run_files
      ORDER BY run_id ASC, logical_path ASC
      `
    );

    return result.rows.map((row) => runFileRecordSchema.parse(row.file_json));
  }

  protected async persistRun(runId: string, files: RunFileRecord[]) {
    const queryable = await this.#getQueryable();
    await queryable.query("DELETE FROM lingban_run_files WHERE run_id = $1", [runId]);

    for (const file of files) {
      await queryable.query(
        `
        INSERT INTO lingban_run_files (
          run_id,
          workspace_id,
          logical_path,
          file_path,
          source,
          kind,
          mime_type,
          object_key,
          upload_id,
          updated_at,
          indexed_at,
          file_json
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
        `,
        [
          file.runId,
          file.workspaceId,
          file.logicalPath,
          file.path,
          file.source,
          file.kind,
          file.mimeType,
          file.objectKey,
          file.uploadId,
          file.updatedAt,
          file.indexedAt,
          JSON.stringify(file),
        ]
      );
    }
  }

  protected async clearStorage() {
    const queryable = await this.#getQueryable();
    await queryable.query("DELETE FROM lingban_run_files");
  }
}
