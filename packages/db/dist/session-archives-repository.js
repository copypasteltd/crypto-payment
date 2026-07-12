import { createRunBindingSchema, isoDatetimeSchema, runIdSchema, sessionPackArchiveExportAuditEntrySchema, sessionPackRuntimeEvidenceEntrySchema, sessionVersionIdSchema, userIdSchema, workspaceContextKeySchema, } from "@lingban/contracts";
import { sessionPackManifestSchema } from "@lingban/session-pack";
import { z } from "zod";
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
function createEmptySessionArchiveState() {
    return sessionArchiveStateSchema.parse({
        archives: [],
    });
}
function replaceBySessionVersionId(records, nextRecord) {
    const nextRecords = [...records];
    const existingIndex = nextRecords.findIndex((item) => item.sessionVersionId === nextRecord.sessionVersionId);
    if (existingIndex >= 0) {
        nextRecords[existingIndex] = nextRecord;
        return nextRecords;
    }
    nextRecords.push(nextRecord);
    return nextRecords;
}
export class CachedSessionArchiveRecordRepository {
    #initialized = false;
    #state = createEmptySessionArchiveState();
    async init() {
        if (this.#initialized) {
            return;
        }
        this.#state = sessionArchiveStateSchema.parse(await this.loadState());
        this.#initialized = true;
    }
    listImportedArchives() {
        return [...this.#state.archives].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }
    getImportedArchiveBySessionVersionId(sessionVersionId) {
        return (this.#state.archives.find((item) => item.sessionVersionId === sessionVersionId) ?? null);
    }
    async saveImportedArchiveRecord(record) {
        const parsed = importedSessionPackRecordSchema.parse(record);
        await this.updateState((state) => ({
            archives: replaceBySessionVersionId(state.archives, parsed),
        }));
        return parsed;
    }
    replaceCachedImportedArchiveRecord(record) {
        this.#state = sessionArchiveStateSchema.parse({
            archives: replaceBySessionVersionId(this.#state.archives, record),
        });
    }
    async updateState(mutator) {
        const nextState = sessionArchiveStateSchema.parse(mutator(this.#state));
        this.#state = nextState;
        await this.writeState(nextState);
    }
}
export class PostgresSessionArchiveRecordRepository extends CachedSessionArchiveRecordRepository {
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
        const result = await queryable.query("SELECT archive_record_json FROM lingban_session_archives ORDER BY updated_at DESC, session_version_id ASC");
        return sessionArchiveStateSchema.parse({
            archives: result.rows.map((row) => row.archive_record_json),
        });
    }
    async saveImportedArchiveRecord(record) {
        const parsed = importedSessionPackRecordSchema.parse(record);
        await this.init();
        this.replaceCachedImportedArchiveRecord(parsed);
        const queryable = await this.#getQueryable();
        await queryable.query(`
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
      `, [
            parsed.sessionVersionId,
            parsed.archiveSource,
            parsed.importedAt,
            parsed.updatedAt,
            parsed.runtimeSourceRunId,
            JSON.stringify(parsed),
        ]);
        return parsed;
    }
    async writeState(state) {
        const parsed = sessionArchiveStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_session_archives");
            for (const record of parsed.archives) {
                await queryable.query(`
          INSERT INTO lingban_session_archives (
            session_version_id,
            archive_source,
            imported_at,
            updated_at,
            runtime_source_run_id,
            archive_record_json
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `, [
                    record.sessionVersionId,
                    record.archiveSource,
                    record.importedAt,
                    record.updatedAt,
                    record.runtimeSourceRunId,
                    JSON.stringify(record),
                ]);
            }
        });
    }
}
//# sourceMappingURL=session-archives-repository.js.map