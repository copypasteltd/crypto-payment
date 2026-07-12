import {
  notificationReadReceiptSchema,
  notificationWorkspaceCursorSchema,
  type NotificationReadReceipt,
  type NotificationWorkspaceCursor,
} from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export const notificationsStateSchema = z.object({
  readReceipts: z.array(notificationReadReceiptSchema).default([]),
  workspaceCursors: z.array(notificationWorkspaceCursorSchema).default([]),
});

export type NotificationsState = z.infer<typeof notificationsStateSchema>;

export interface NotificationsRepository {
  init(): Promise<void>;
  listReadReceipts(userId: string, workspaceId: string): NotificationReadReceipt[];
  getWorkspaceCursor(userId: string, workspaceId: string): NotificationWorkspaceCursor | null;
  saveReadReceipt(receipt: NotificationReadReceipt): Promise<void>;
  saveWorkspaceCursor(cursor: NotificationWorkspaceCursor): Promise<void>;
}

function createEmptyNotificationsState(): NotificationsState {
  return notificationsStateSchema.parse({
    readReceipts: [],
    workspaceCursors: [],
  });
}

function replaceByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const key = getKey(nextItem);
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex((item) => getKey(item) === key);

  if (existingIndex >= 0) {
    nextItems[existingIndex] = nextItem;
    return nextItems;
  }

  nextItems.push(nextItem);
  return nextItems;
}

export abstract class CachedNotificationsRepository implements NotificationsRepository {
  #initialized = false;
  #state: NotificationsState = createEmptyNotificationsState();

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = notificationsStateSchema.parse(await this.loadState());
    this.#initialized = true;
  }

  listReadReceipts(userId: string, workspaceId: string) {
    return this.#state.readReceipts
      .filter((item) => item.userId === userId && item.workspaceId === workspaceId)
      .sort(
        (left, right) =>
          right.readAt.localeCompare(left.readAt) ||
          left.notificationId.localeCompare(right.notificationId)
      );
  }

  getWorkspaceCursor(userId: string, workspaceId: string) {
    return (
      this.#state.workspaceCursors.find(
        (item) => item.userId === userId && item.workspaceId === workspaceId
      ) ?? null
    );
  }

  async saveReadReceipt(receipt: NotificationReadReceipt) {
    const parsed = notificationReadReceiptSchema.parse(receipt);
    await this.updateState((state) => ({
      ...state,
      readReceipts: replaceByKey(
        state.readReceipts,
        parsed,
        (item) => `${item.userId}:${item.workspaceId}:${item.notificationId}`
      ),
    }));
  }

  async saveWorkspaceCursor(cursor: NotificationWorkspaceCursor) {
    const parsed = notificationWorkspaceCursorSchema.parse(cursor);
    await this.updateState((state) => ({
      ...state,
      workspaceCursors: replaceByKey(
        state.workspaceCursors,
        parsed,
        (item) => `${item.userId}:${item.workspaceId}`
      ),
    }));
  }

  protected replaceCachedReadReceipt(receipt: NotificationReadReceipt) {
    this.#state = notificationsStateSchema.parse({
      ...this.#state,
      readReceipts: replaceByKey(
        this.#state.readReceipts,
        receipt,
        (item) => `${item.userId}:${item.workspaceId}:${item.notificationId}`
      ),
    });
  }

  protected replaceCachedWorkspaceCursor(cursor: NotificationWorkspaceCursor) {
    this.#state = notificationsStateSchema.parse({
      ...this.#state,
      workspaceCursors: replaceByKey(
        this.#state.workspaceCursors,
        cursor,
        (item) => `${item.userId}:${item.workspaceId}`
      ),
    });
  }

  protected async updateState(mutator: (state: NotificationsState) => NotificationsState) {
    const nextState = notificationsStateSchema.parse(mutator(this.#state));
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected abstract loadState(): Promise<NotificationsState>;
  protected abstract writeState(state: NotificationsState): Promise<void>;
}

export interface PostgresNotificationsRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresNotificationsRepository extends CachedNotificationsRepository {
  #options: PostgresNotificationsRepositoryOptions;

  constructor(options: PostgresNotificationsRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const [receipts, cursors] = await Promise.all([
      queryable.query<{ receipt_json: NotificationReadReceipt }>(
        "SELECT receipt_json FROM lingban_notification_read_receipts ORDER BY read_at DESC, notification_id ASC"
      ),
      queryable.query<{ cursor_json: NotificationWorkspaceCursor }>(
        "SELECT cursor_json FROM lingban_notification_read_cursors ORDER BY marked_all_read_at DESC, workspace_id ASC, user_id ASC"
      ),
    ]);

    return notificationsStateSchema.parse({
      readReceipts: receipts.rows.map((row) => row.receipt_json),
      workspaceCursors: cursors.rows.map((row) => row.cursor_json),
    });
  }

  async saveReadReceipt(receipt: NotificationReadReceipt) {
    const parsed = notificationReadReceiptSchema.parse(receipt);
    await this.init();
    this.replaceCachedReadReceipt(parsed);

    const queryable = await this.#getQueryable();
    await queryable.query(
      `
      INSERT INTO lingban_notification_read_receipts (
        notification_id,
        user_id,
        workspace_id,
        read_at,
        receipt_json
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (user_id, workspace_id, notification_id)
      DO UPDATE SET
        read_at = EXCLUDED.read_at,
        receipt_json = EXCLUDED.receipt_json
      `,
      [
        parsed.notificationId,
        parsed.userId,
        parsed.workspaceId,
        parsed.readAt,
        JSON.stringify(parsed),
      ]
    );
  }

  async saveWorkspaceCursor(cursor: NotificationWorkspaceCursor) {
    const parsed = notificationWorkspaceCursorSchema.parse(cursor);
    await this.init();
    this.replaceCachedWorkspaceCursor(parsed);

    const queryable = await this.#getQueryable();
    await queryable.query(
      `
      INSERT INTO lingban_notification_read_cursors (
        user_id,
        workspace_id,
        marked_all_read_at,
        cursor_json
      )
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (user_id, workspace_id)
      DO UPDATE SET
        marked_all_read_at = EXCLUDED.marked_all_read_at,
        cursor_json = EXCLUDED.cursor_json
      `,
      [
        parsed.userId,
        parsed.workspaceId,
        parsed.markedAllReadAt,
        JSON.stringify(parsed),
      ]
    );
  }

  protected async writeState(state: NotificationsState) {
    const parsed = notificationsStateSchema.parse(state);

    await this.#options.withTransaction(async (queryable) => {
      await queryable.query("DELETE FROM lingban_notification_read_receipts");
      await queryable.query("DELETE FROM lingban_notification_read_cursors");

      for (const receipt of parsed.readReceipts) {
        await queryable.query(
          `
          INSERT INTO lingban_notification_read_receipts (
            notification_id,
            user_id,
            workspace_id,
            read_at,
            receipt_json
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
          `,
          [
            receipt.notificationId,
            receipt.userId,
            receipt.workspaceId,
            receipt.readAt,
            JSON.stringify(receipt),
          ]
        );
      }

      for (const cursor of parsed.workspaceCursors) {
        await queryable.query(
          `
          INSERT INTO lingban_notification_read_cursors (
            user_id,
            workspace_id,
            marked_all_read_at,
            cursor_json
          )
          VALUES ($1, $2, $3, $4::jsonb)
          `,
          [
            cursor.userId,
            cursor.workspaceId,
            cursor.markedAllReadAt,
            JSON.stringify(cursor),
          ]
        );
      }
    });
  }
}
