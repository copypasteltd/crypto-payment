import { z } from "zod";
export declare const notificationToneSchema: z.ZodEnum<{
    active: "active";
    success: "success";
    warn: "warn";
    danger: "danger";
}>;
export declare const notificationTypeSchema: z.ZodEnum<{
    approval_pending: "approval_pending";
    result_ready: "result_ready";
    run_failed: "run_failed";
    run_succeeded: "run_succeeded";
}>;
export declare const notificationRunTargetViewSchema: z.ZodEnum<{
    detail: "detail";
    files: "files";
    audit: "audit";
}>;
export declare const notificationAnchorTypeSchema: z.ZodEnum<{
    message: "message";
    approval: "approval";
    file: "file";
    run: "run";
}>;
export declare const notificationTargetSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    resource: z.ZodLiteral<"run">;
    runId: z.ZodString;
    view: z.ZodEnum<{
        detail: "detail";
        files: "files";
        audit: "audit";
    }>;
    anchorType: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        message: "message";
        approval: "approval";
        file: "file";
        run: "run";
    }>>>;
    anchorRefId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    resource: z.ZodLiteral<"workspace">;
    workspaceId: z.ZodString;
    view: z.ZodEnum<{
        me: "me";
        notifications: "notifications";
    }>;
}, z.core.$strip>], "resource">;
export declare const notificationRecordSchema: z.ZodObject<{
    notificationId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    type: z.ZodEnum<{
        approval_pending: "approval_pending";
        result_ready: "result_ready";
        run_failed: "run_failed";
        run_succeeded: "run_succeeded";
    }>;
    tone: z.ZodEnum<{
        active: "active";
        success: "success";
        warn: "warn";
        danger: "danger";
    }>;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    occurredAt: z.ZodString;
    target: z.ZodDiscriminatedUnion<[z.ZodObject<{
        resource: z.ZodLiteral<"run">;
        runId: z.ZodString;
        view: z.ZodEnum<{
            detail: "detail";
            files: "files";
            audit: "audit";
        }>;
        anchorType: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            message: "message";
            approval: "approval";
            file: "file";
            run: "run";
        }>>>;
        anchorRefId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        resource: z.ZodLiteral<"workspace">;
        workspaceId: z.ZodString;
        view: z.ZodEnum<{
            me: "me";
            notifications: "notifications";
        }>;
    }, z.core.$strip>], "resource">;
    isRead: z.ZodBoolean;
    readAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const notificationReadStateSchema: z.ZodEnum<{
    all: "all";
    read: "read";
    unread: "unread";
}>;
export declare const listNotificationsQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    type: z.ZodOptional<z.ZodEnum<{
        approval_pending: "approval_pending";
        result_ready: "result_ready";
        run_failed: "run_failed";
        run_succeeded: "run_succeeded";
    }>>;
    readState: z.ZodOptional<z.ZodEnum<{
        all: "all";
        read: "read";
        unread: "unread";
    }>>;
}, z.core.$strip>;
export declare const notificationSummaryBucketSchema: z.ZodObject<{
    type: z.ZodEnum<{
        approval_pending: "approval_pending";
        result_ready: "result_ready";
        run_failed: "run_failed";
        run_succeeded: "run_succeeded";
    }>;
    count: z.ZodNumber;
    unreadCount: z.ZodNumber;
}, z.core.$strip>;
export declare const notificationSummarySchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    unreadCount: z.ZodNumber;
    latestOccurredAt: z.ZodNullable<z.ZodString>;
    byType: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            approval_pending: "approval_pending";
            result_ready: "result_ready";
            run_failed: "run_failed";
            run_succeeded: "run_succeeded";
        }>;
        count: z.ZodNumber;
        unreadCount: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const notificationReadReceiptSchema: z.ZodObject<{
    notificationId: z.ZodString;
    userId: z.ZodString;
    workspaceId: z.ZodString;
    readAt: z.ZodString;
}, z.core.$strip>;
export declare const notificationWorkspaceCursorSchema: z.ZodObject<{
    userId: z.ZodString;
    workspaceId: z.ZodString;
    markedAllReadAt: z.ZodString;
}, z.core.$strip>;
export type NotificationTone = z.infer<typeof notificationToneSchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationRunTargetView = z.infer<typeof notificationRunTargetViewSchema>;
export type NotificationAnchorType = z.infer<typeof notificationAnchorTypeSchema>;
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;
export type NotificationRecord = z.infer<typeof notificationRecordSchema>;
export type NotificationReadState = z.infer<typeof notificationReadStateSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type NotificationSummaryBucket = z.infer<typeof notificationSummaryBucketSchema>;
export type NotificationSummary = z.infer<typeof notificationSummarySchema>;
export type NotificationReadReceipt = z.infer<typeof notificationReadReceiptSchema>;
export type NotificationWorkspaceCursor = z.infer<typeof notificationWorkspaceCursorSchema>;
//# sourceMappingURL=notifications.d.ts.map