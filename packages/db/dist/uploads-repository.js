import { runDownloadTicketSchema, runUploadRecordSchema, } from "@lingban/contracts";
import { z } from "zod";
export const uploadStorageStateSchema = z.object({
    uploads: z.array(runUploadRecordSchema),
    downloadTickets: z.array(runDownloadTicketSchema),
});
export class CachedUploadRepository {
    #initialized = false;
    #uploads = new Map();
    #downloadTickets = new Map();
    #writeChain = Promise.resolve();
    async init() {
        if (this.#initialized) {
            return;
        }
        const state = await this.loadState();
        this.#uploads.clear();
        this.#downloadTickets.clear();
        for (const upload of state.uploads) {
            this.#uploads.set(upload.uploadId, upload);
        }
        for (const ticket of state.downloadTickets) {
            this.#downloadTickets.set(ticket.ticketId, ticket);
        }
        this.#initialized = true;
    }
    snapshotState() {
        return uploadStorageStateSchema.parse({
            uploads: [...this.#uploads.values()],
            downloadTickets: [...this.#downloadTickets.values()],
        });
    }
    async persistSnapshot() {
        const next = this.#writeChain.catch(() => undefined).then(async () => {
            await this.writeSnapshot(this.snapshotState());
        });
        this.#writeChain = next;
        await next;
    }
    async enqueuePersist(persist) {
        const next = this.#writeChain.catch(() => undefined).then(async () => {
            await persist();
        });
        this.#writeChain = next;
        await next;
    }
    async createUpload(record) {
        this.#uploads.set(record.uploadId, record);
        await this.enqueuePersist(() => this.persistUploadRecord(record));
        return record;
    }
    async updateUpload(record) {
        this.#uploads.set(record.uploadId, record);
        await this.enqueuePersist(() => this.persistUploadRecord(record));
        return record;
    }
    listUploads() {
        return [...this.#uploads.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    getUpload(uploadId) {
        return this.#uploads.get(uploadId) ?? null;
    }
    listUploadsByRun(runId) {
        return [...this.#uploads.values()]
            .filter((upload) => upload.runId === runId)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    findUploadByAttachedPath(runId, attachedPath) {
        for (const upload of this.#uploads.values()) {
            if (upload.runId === runId && upload.attachedPath === attachedPath) {
                return upload;
            }
        }
        return null;
    }
    async deleteUpload(uploadId) {
        if (!this.#uploads.delete(uploadId)) {
            return;
        }
        await this.persistSnapshot();
    }
    listDownloadTickets() {
        return [...this.#downloadTickets.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    async createDownloadTicket(record) {
        this.#downloadTickets.set(record.ticketId, record);
        await this.enqueuePersist(() => this.persistDownloadTicketRecord(record));
        return record;
    }
    getDownloadTicket(ticketId) {
        return this.#downloadTickets.get(ticketId) ?? null;
    }
    async deleteDownloadTicket(ticketId) {
        if (!this.#downloadTickets.delete(ticketId)) {
            return;
        }
        await this.persistSnapshot();
    }
}
export class PostgresUploadRepository extends CachedUploadRepository {
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
        const [uploads, tickets] = await Promise.all([
            queryable.query(`
        SELECT upload_json
        FROM lingban_run_uploads
        ORDER BY created_at ASC, upload_id ASC
        `),
            queryable.query(`
        SELECT ticket_json
        FROM lingban_download_tickets
        ORDER BY created_at ASC, ticket_id ASC
        `),
        ]);
        return uploadStorageStateSchema.parse({
            uploads: uploads.rows.map((row) => row.upload_json),
            downloadTickets: tickets.rows.map((row) => row.ticket_json),
        });
    }
    async writeSnapshot(state) {
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_download_tickets");
            await queryable.query("DELETE FROM lingban_run_uploads");
            for (const upload of state.uploads) {
                await queryable.query(`
          INSERT INTO lingban_run_uploads (
            upload_id,
            run_id,
            workspace_id,
            status,
            file_name,
            object_key,
            created_at,
            updated_at,
            upload_json
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
          `, [
                    upload.uploadId,
                    upload.runId,
                    upload.workspaceId,
                    upload.status,
                    upload.fileName,
                    upload.objectKey,
                    upload.createdAt,
                    upload.updatedAt,
                    JSON.stringify(upload),
                ]);
            }
            for (const ticket of state.downloadTickets) {
                await queryable.query(`
          INSERT INTO lingban_download_tickets (
            ticket_id,
            run_id,
            workspace_id,
            expires_at,
            created_at,
            ticket_json
          )
          VALUES ($1,$2,$3,$4,$5,$6::jsonb)
          `, [
                    ticket.ticketId,
                    ticket.runId,
                    ticket.workspaceId,
                    ticket.expiresAt,
                    ticket.createdAt,
                    JSON.stringify(ticket),
                ]);
            }
        });
    }
    async persistUploadRecord(record) {
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_run_uploads (
        upload_id,
        run_id,
        workspace_id,
        status,
        file_name,
        object_key,
        created_at,
        updated_at,
        upload_json
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      ON CONFLICT (upload_id) DO UPDATE
      SET
        run_id = EXCLUDED.run_id,
        workspace_id = EXCLUDED.workspace_id,
        status = EXCLUDED.status,
        file_name = EXCLUDED.file_name,
        object_key = EXCLUDED.object_key,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        upload_json = EXCLUDED.upload_json
      `, [
            record.uploadId,
            record.runId,
            record.workspaceId,
            record.status,
            record.fileName,
            record.objectKey,
            record.createdAt,
            record.updatedAt,
            JSON.stringify(record),
        ]);
    }
    async persistDownloadTicketRecord(record) {
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_download_tickets (
        ticket_id,
        run_id,
        workspace_id,
        expires_at,
        created_at,
        ticket_json
      )
      VALUES ($1,$2,$3,$4,$5,$6::jsonb)
      ON CONFLICT (ticket_id) DO UPDATE
      SET
        run_id = EXCLUDED.run_id,
        workspace_id = EXCLUDED.workspace_id,
        expires_at = EXCLUDED.expires_at,
        created_at = EXCLUDED.created_at,
        ticket_json = EXCLUDED.ticket_json
      `, [
            record.ticketId,
            record.runId,
            record.workspaceId,
            record.expiresAt,
            record.createdAt,
            JSON.stringify(record),
        ]);
    }
}
//# sourceMappingURL=uploads-repository.js.map