import {
  runDownloadTicketSchema,
  runUploadRecordSchema,
  type RunDownloadTicket,
  type RunUploadRecord,
} from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export const uploadStorageStateSchema = z.object({
  uploads: z.array(runUploadRecordSchema),
  downloadTickets: z.array(runDownloadTicketSchema),
});

export type UploadStorageState = z.infer<typeof uploadStorageStateSchema>;

export interface UploadRepository {
  init(): Promise<void>;
  listUploads(): RunUploadRecord[];
  listDownloadTickets(): RunDownloadTicket[];
  createUpload(record: RunUploadRecord): Promise<RunUploadRecord>;
  updateUpload(record: RunUploadRecord): Promise<RunUploadRecord>;
  getUpload(uploadId: string): RunUploadRecord | null;
  listUploadsByRun(runId: string): RunUploadRecord[];
  findUploadByAttachedPath(runId: string, attachedPath: string): RunUploadRecord | null;
  deleteUpload(uploadId: string): Promise<void>;
  createDownloadTicket(record: RunDownloadTicket): Promise<RunDownloadTicket>;
  getDownloadTicket(ticketId: string): RunDownloadTicket | null;
  deleteDownloadTicket(ticketId: string): Promise<void>;
}

export abstract class CachedUploadRepository implements UploadRepository {
  #initialized = false;
  #uploads = new Map<string, RunUploadRecord>();
  #downloadTickets = new Map<string, RunDownloadTicket>();
  #writeChain: Promise<void> = Promise.resolve();

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

  protected snapshotState(): UploadStorageState {
    return uploadStorageStateSchema.parse({
      uploads: [...this.#uploads.values()],
      downloadTickets: [...this.#downloadTickets.values()],
    });
  }

  protected async persistSnapshot() {
    const next = this.#writeChain.catch(() => undefined).then(async () => {
      await this.writeSnapshot(this.snapshotState());
    });

    this.#writeChain = next;
    await next;
  }

  protected async enqueuePersist(persist: () => Promise<void>) {
    const next = this.#writeChain.catch(() => undefined).then(async () => {
      await persist();
    });

    this.#writeChain = next;
    await next;
  }

  async createUpload(record: RunUploadRecord) {
    this.#uploads.set(record.uploadId, record);
    await this.enqueuePersist(() => this.persistUploadRecord(record));
    return record;
  }

  async updateUpload(record: RunUploadRecord) {
    this.#uploads.set(record.uploadId, record);
    await this.enqueuePersist(() => this.persistUploadRecord(record));
    return record;
  }

  listUploads() {
    return [...this.#uploads.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  getUpload(uploadId: string) {
    return this.#uploads.get(uploadId) ?? null;
  }

  listUploadsByRun(runId: string) {
    return [...this.#uploads.values()]
      .filter((upload) => upload.runId === runId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  findUploadByAttachedPath(runId: string, attachedPath: string) {
    for (const upload of this.#uploads.values()) {
      if (upload.runId === runId && upload.attachedPath === attachedPath) {
        return upload;
      }
    }

    return null;
  }

  async deleteUpload(uploadId: string) {
    if (!this.#uploads.delete(uploadId)) {
      return;
    }

    await this.persistSnapshot();
  }

  listDownloadTickets() {
    return [...this.#downloadTickets.values()].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  async createDownloadTicket(record: RunDownloadTicket) {
    this.#downloadTickets.set(record.ticketId, record);
    await this.enqueuePersist(() => this.persistDownloadTicketRecord(record));
    return record;
  }

  getDownloadTicket(ticketId: string) {
    return this.#downloadTickets.get(ticketId) ?? null;
  }

  async deleteDownloadTicket(ticketId: string) {
    if (!this.#downloadTickets.delete(ticketId)) {
      return;
    }

    await this.persistSnapshot();
  }

  protected abstract loadState(): Promise<UploadStorageState>;
  protected abstract writeSnapshot(state: UploadStorageState): Promise<void>;
  protected abstract persistUploadRecord(record: RunUploadRecord): Promise<void>;
  protected abstract persistDownloadTicketRecord(record: RunDownloadTicket): Promise<void>;
}

export interface PostgresUploadRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresUploadRepository extends CachedUploadRepository {
  #options: PostgresUploadRepositoryOptions;

  constructor(options: PostgresUploadRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const [uploads, tickets] = await Promise.all([
      queryable.query<{ upload_json: RunUploadRecord }>(
        `
        SELECT upload_json
        FROM lingban_run_uploads
        ORDER BY created_at ASC, upload_id ASC
        `
      ),
      queryable.query<{ ticket_json: RunDownloadTicket }>(
        `
        SELECT ticket_json
        FROM lingban_download_tickets
        ORDER BY created_at ASC, ticket_id ASC
        `
      ),
    ]);

    return uploadStorageStateSchema.parse({
      uploads: uploads.rows.map((row) => row.upload_json),
      downloadTickets: tickets.rows.map((row) => row.ticket_json),
    });
  }

  protected async writeSnapshot(state: UploadStorageState) {
    await this.#options.withTransaction(async (queryable) => {
      await queryable.query("DELETE FROM lingban_download_tickets");
      await queryable.query("DELETE FROM lingban_run_uploads");

      for (const upload of state.uploads) {
        await queryable.query(
          `
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
          `,
          [
            upload.uploadId,
            upload.runId,
            upload.workspaceId,
            upload.status,
            upload.fileName,
            upload.objectKey,
            upload.createdAt,
            upload.updatedAt,
            JSON.stringify(upload),
          ]
        );
      }

      for (const ticket of state.downloadTickets) {
        await queryable.query(
          `
          INSERT INTO lingban_download_tickets (
            ticket_id,
            run_id,
            workspace_id,
            expires_at,
            created_at,
            ticket_json
          )
          VALUES ($1,$2,$3,$4,$5,$6::jsonb)
          `,
          [
            ticket.ticketId,
            ticket.runId,
            ticket.workspaceId,
            ticket.expiresAt,
            ticket.createdAt,
            JSON.stringify(ticket),
          ]
        );
      }
    });
  }

  protected async persistUploadRecord(record: RunUploadRecord) {
    const queryable = await this.#getQueryable();
    await queryable.query(
      `
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
      `,
      [
        record.uploadId,
        record.runId,
        record.workspaceId,
        record.status,
        record.fileName,
        record.objectKey,
        record.createdAt,
        record.updatedAt,
        JSON.stringify(record),
      ]
    );
  }

  protected async persistDownloadTicketRecord(record: RunDownloadTicket) {
    const queryable = await this.#getQueryable();
    await queryable.query(
      `
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
      `,
      [
        record.ticketId,
        record.runId,
        record.workspaceId,
        record.expiresAt,
        record.createdAt,
        JSON.stringify(record),
      ]
    );
  }
}
