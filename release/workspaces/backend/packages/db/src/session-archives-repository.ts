import {
  createRunBindingSchema,
  isoDatetimeSchema,
  runIdSchema,
  sessionPackArchiveExportAuditEntrySchema,
  sessionPackRuntimeEvidenceEntrySchema,
  sessionVersionIdSchema,
  userIdSchema,
  workspaceContextKeySchema,
} from "@lingban/contracts";
import { sessionPackManifestSchema } from "@lingban/session-pack";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

const sha256HexSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");

export const importedSessionPackRecordSchema = z.object({
  sessionVersionId: sessionVersionIdSchema,
  workspaceContextKeys: z.array(workspaceContextKeySchema).min(1),
  requiredBindings: createRunBindingSchema,
  archiveSource: z.enum(["generated", "imported", "runtime-derived"]).default("imported"),
  archivePath: z.string().min(1).max(1024),
  archiveSizeBytes: z.number().int().nonnegative(),
  archiveSha256: sha256HexSchema,
  archiveFileName: z.string().min(1).max(240),
  importedAt: isoDatetimeSchema,
  importedByUserId: userIdSchema.nullable().default(null),
  runtimeSourceRunId: runIdSchema.nullable().default(null),
  runtimeSourceTargetPath: z.string().min(1).max(1024).nullable().default(null),
  runtimeSourceUpdatedAt: isoDatetimeSchema.nullable().default(null),
  archiveExports: z.array(sessionPackArchiveExportAuditEntrySchema).default([]),
  runtimeEvidenceEntries: z.array(sessionPackRuntimeEvidenceEntrySchema).default([]),
  updatedAt: isoDatetimeSchema,
  manifest: sessionPackManifestSchema,
});

export const sessionArchiveStateSchema = z.object({
  archives: z.array(importedSessionPackRecordSchema).default([]),
});

export type ImportedSessionPackRecord = z.infer<typeof importedSessionPackRecordSchema>;
export type SessionArchiveState = z.infer<typeof sessionArchiveStateSchema>;

export interface SessionArchiveRecordRepository {
  init(): Promise<void>;
  listImportedArchives(): ImportedSessionPackRecord[];
  getImportedArchiveBySessionVersionId(sessionVersionId: string): ImportedSessionPackRecord | null;
  saveImportedArchiveRecord(record: ImportedSessionPackRecord): Promise<ImportedSessionPackRecord>;
}

function createEmptySessionArchiveState(): SessionArchiveState {
  return sessionArchiveStateSchema.parse({
    archives: [],
  });
}

function replaceBySessionVersionId(
  records: ImportedSessionPackRecord[],
  nextRecord: ImportedSessionPackRecord
) {
  const nextRecords = [...records];
  const existingIndex = nextRecords.findIndex(
    (item) => item.sessionVersionId === nextRecord.sessionVersionId
  );

  if (existingIndex >= 0) {
    nextRecords[existingIndex] = nextRecord;
    return nextRecords;
  }

  nextRecords.push(nextRecord);
  return nextRecords;
}

export abstract class CachedSessionArchiveRecordRepository
  implements SessionArchiveRecordRepository
{
  #initialized = false;
  #state: SessionArchiveState = createEmptySessionArchiveState();

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = sessionArchiveStateSchema.parse(await this.loadState());
    this.#initialized = true;
  }

  listImportedArchives() {
    return [...this.#state.archives].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
  }

  getImportedArchiveBySessionVersionId(sessionVersionId: string) {
    return (
      this.#state.archives.find((item) => item.sessionVersionId === sessionVersionId) ?? null
    );
  }

  async saveImportedArchiveRecord(record: ImportedSessionPackRecord) {
    const parsed = importedSessionPackRecordSchema.parse(record);
    await this.updateState((state) => ({
      archives: replaceBySessionVersionId(state.archives, parsed),
    }));
    return parsed;
  }

  protected replaceCachedImportedArchiveRecord(record: ImportedSessionPackRecord) {
    this.#state = sessionArchiveStateSchema.parse({
      archives: replaceBySessionVersionId(this.#state.archives, record),
    });
  }

  protected async updateState(mutator: (state: SessionArchiveState) => SessionArchiveState) {
    const nextState = sessionArchiveStateSchema.parse(mutator(this.#state));
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected abstract loadState(): Promise<SessionArchiveState>;
  protected abstract writeState(state: SessionArchiveState): Promise<void>;
}

export interface PostgresSessionArchiveRecordRepositoryOptions
  extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresSessionArchiveRecordRepository extends CachedSessionArchiveRecordRepository {
  #options: PostgresSessionArchiveRecordRepositoryOptions;

  constructor(options: PostgresSessionArchiveRecordRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ archive_record_json: ImportedSessionPackRecord }>(
      "SELECT archive_record_json FROM lingban_session_archives ORDER BY updated_at DESC, session_version_id ASC"
    );

    return sessionArchiveStateSchema.parse({
      archives: result.rows.map((row) => row.archive_record_json),
    });
  }

  async saveImportedArchiveRecord(record: ImportedSessionPackRecord) {
    const parsed = importedSessionPackRecordSchema.parse(record);
    await this.init();
    this.replaceCachedImportedArchiveRecord(parsed);

    const queryable = await this.#getQueryable();
    await queryable.query(
      `
      INSERT INTO lingban_session_archives (
        session_version_id,
        archive_source,
        imported_at,
        updated_at,
        runtime_source_run_id,
        archive_record_json
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (session_version_id) DO UPDATE SET
        archive_source = EXCLUDED.archive_source,
        imported_at = EXCLUDED.imported_at,
        updated_at = EXCLUDED.updated_at,
        runtime_source_run_id = EXCLUDED.runtime_source_run_id,
        archive_record_json = EXCLUDED.archive_record_json
      `,
      [
        parsed.sessionVersionId,
        parsed.archiveSource,
        parsed.importedAt,
        parsed.updatedAt,
        parsed.runtimeSourceRunId,
        JSON.stringify(parsed),
      ]
    );

    return parsed;
  }

  protected async writeState(state: SessionArchiveState) {
    const parsed = sessionArchiveStateSchema.parse(state);

    await this.#options.withTransaction(async (queryable) => {
      await queryable.query("DELETE FROM lingban_session_archives");

      for (const record of parsed.archives) {
        await queryable.query(
          `
          INSERT INTO lingban_session_archives (
            session_version_id,
            archive_source,
            imported_at,
            updated_at,
            runtime_source_run_id,
            archive_record_json
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            record.sessionVersionId,
            record.archiveSource,
            record.importedAt,
            record.updatedAt,
            record.runtimeSourceRunId,
            JSON.stringify(record),
          ]
        );
      }
    });
  }
}
