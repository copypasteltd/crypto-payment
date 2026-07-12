import { type NotificationReadReceipt, type NotificationWorkspaceCursor } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const notificationsStateSchema: z.ZodObject<{
    readReceipts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        notificationId: z.ZodString;
        userId: z.ZodString;
        workspaceId: z.ZodString;
        readAt: z.ZodString;
    }, z.core.$strip>>>;
    workspaceCursors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        userId: z.ZodString;
        workspaceId: z.ZodString;
        markedAllReadAt: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type NotificationsState = z.infer<typeof notificationsStateSchema>;
export interface NotificationsRepository {
    init(): Promise<void>;
    listReadReceipts(userId: string, workspaceId: string): NotificationReadReceipt[];
    getWorkspaceCursor(userId: string, workspaceId: string): NotificationWorkspaceCursor | null;
    saveReadReceipt(receipt: NotificationReadReceipt): Promise<void>;
    saveWorkspaceCursor(cursor: NotificationWorkspaceCursor): Promise<void>;
}
export declare abstract class CachedNotificationsRepository implements NotificationsRepository {
    #private;
    init(): Promise<void>;
    listReadReceipts(userId: string, workspaceId: string): {
        notificationId: string;
        userId: string;
        workspaceId: string;
        readAt: string;
    }[];
    getWorkspaceCursor(userId: string, workspaceId: string): {
        userId: string;
        workspaceId: string;
        markedAllReadAt: string;
    } | null;
    saveReadReceipt(receipt: NotificationReadReceipt): Promise<void>;
    saveWorkspaceCursor(cursor: NotificationWorkspaceCursor): Promise<void>;
    protected replaceCachedReadReceipt(receipt: NotificationReadReceipt): void;
    protected replaceCachedWorkspaceCursor(cursor: NotificationWorkspaceCursor): void;
    protected updateState(mutator: (state: NotificationsState) => NotificationsState): Promise<void>;
    protected abstract loadState(): Promise<NotificationsState>;
    protected abstract writeState(state: NotificationsState): Promise<void>;
}
export interface PostgresNotificationsRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresNotificationsRepository extends CachedNotificationsRepository {
    #private;
    constructor(options: PostgresNotificationsRepositoryOptions);
    protected loadState(): Promise<{
        readReceipts: {
            notificationId: string;
            userId: string;
            workspaceId: string;
            readAt: string;
        }[];
        workspaceCursors: {
            userId: string;
            workspaceId: string;
            markedAllReadAt: string;
        }[];
    }>;
    saveReadReceipt(receipt: NotificationReadReceipt): Promise<void>;
    saveWorkspaceCursor(cursor: NotificationWorkspaceCursor): Promise<void>;
    protected writeState(state: NotificationsState): Promise<void>;
}
//# sourceMappingURL=notifications-repository.d.ts.map