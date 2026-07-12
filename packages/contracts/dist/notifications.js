import { z } from "zod";
import { localizedTextSchema, workspaceContextKeySchema } from "./catalog.js";
import { isoDatetimeSchema, runIdSchema, workspaceIdSchema } from "./common.js";
export const notificationToneSchema = z.enum(["active", "warn", "success", "danger"]);
export const notificationTypeSchema = z.enum([
    "approval_pending",
    "result_ready",
    "run_failed",
    "run_succeeded",
]);
export const notificationRunTargetViewSchema = z.enum(["detail", "audit", "files"]);
export const notificationAnchorTypeSchema = z.enum(["run", "message", "approval", "file"]);
export const notificationTargetSchema = z.discriminatedUnion("resource", [
    z.object({
        resource: z.literal("run"),
        runId: runIdSchema,
        view: notificationRunTargetViewSchema,
        anchorType: notificationAnchorTypeSchema.nullable().default(null),
        anchorRefId: z.string().trim().min(1).max(240).nullable().default(null),
    }),
    z.object({
        resource: z.literal("workspace"),
        workspaceId: workspaceIdSchema,
        view: z.enum(["me", "notifications"]),
    }),
]);
export const notificationRecordSchema = z.object({
    notificationId: z.string().trim().min(1).max(200),
    workspaceId: workspaceIdSchema,
    workspaceContextKey: workspaceContextKeySchema,
    type: notificationTypeSchema,
    tone: notificationToneSchema,
    title: localizedTextSchema,
    summary: localizedTextSchema,
    occurredAt: isoDatetimeSchema,
    target: notificationTargetSchema,
    isRead: z.boolean(),
    readAt: isoDatetimeSchema.nullable(),
});
export const notificationReadStateSchema = z.enum(["all", "read", "unread"]);
export const listNotificationsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(20).optional(),
    type: notificationTypeSchema.optional(),
    readState: notificationReadStateSchema.optional(),
});
export const notificationSummaryBucketSchema = z.object({
    type: notificationTypeSchema,
    count: z.number().int().nonnegative(),
    unreadCount: z.number().int().nonnegative(),
});
export const notificationSummarySchema = z.object({
    totalCount: z.number().int().nonnegative(),
    unreadCount: z.number().int().nonnegative(),
    latestOccurredAt: isoDatetimeSchema.nullable(),
    byType: z.array(notificationSummaryBucketSchema),
});
export const notificationReadReceiptSchema = z.object({
    notificationId: z.string().trim().min(1).max(200),
    userId: z.string().trim().min(1).max(120),
    workspaceId: workspaceIdSchema,
    readAt: isoDatetimeSchema,
});
export const notificationWorkspaceCursorSchema = z.object({
    userId: z.string().trim().min(1).max(120),
    workspaceId: workspaceIdSchema,
    markedAllReadAt: isoDatetimeSchema,
});
//# sourceMappingURL=notifications.js.map