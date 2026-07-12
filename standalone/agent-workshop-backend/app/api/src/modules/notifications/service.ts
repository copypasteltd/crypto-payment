import {
  listNotificationsQuerySchema,
  notificationReadReceiptSchema,
  notificationRecordSchema,
  notificationSummarySchema,
  notificationWorkspaceCursorSchema,
  type ListNotificationsQuery,
  type NotificationRecord,
  type NotificationSummary,
  type NotificationType,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { runsService } from "../runs/service.js";
import { collectRunNoticeRecords } from "../me/read-model.js";
import { notificationsRepository } from "./repository.js";

const DEFAULT_NOTIFICATION_LIMIT = 6;
const NOTIFICATION_TYPE_ORDER: NotificationType[] = [
  "approval_pending",
  "result_ready",
  "run_failed",
  "run_succeeded",
];

type NotificationActorContext = {
  userId: string;
  workspaceId: string;
  workspaceContextKey: string;
};

function nowIso() {
  return new Date().toISOString();
}

function isReadByCursor(occurredAt: string, cursorMarkedAllReadAt: string | null) {
  return cursorMarkedAllReadAt != null && occurredAt.localeCompare(cursorMarkedAllReadAt) <= 0;
}

export class NotificationsService {
  #hydrateNotifications(
    actor: NotificationActorContext
  ): Array<{
    record: NotificationRecord;
  }> {
    const notices = collectRunNoticeRecords(
      runsService.listRuns(
        {},
        {
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
        }
      ),
      actor
    );
    const receipts = notificationsRepository.listReadReceipts(actor.userId, actor.workspaceId);
    const receiptById = new Map(receipts.map((receipt) => [receipt.notificationId, receipt]));
    const cursor =
      notificationsRepository.getWorkspaceCursor(actor.userId, actor.workspaceId)?.markedAllReadAt ??
      null;

    return notices.map((notice) => {
      const receipt = receiptById.get(notice.noticeId) ?? null;
      const readAt = receipt?.readAt ?? (isReadByCursor(notice.occurredAt, cursor) ? cursor : null);

      return {
        record: notificationRecordSchema.parse({
          notificationId: notice.noticeId,
          workspaceId: notice.workspaceId,
          workspaceContextKey: notice.workspaceContextKey,
          type: notice.type,
          tone: notice.tone,
          title: notice.title,
          summary: notice.summary,
          occurredAt: notice.occurredAt,
          target: notice.target,
          isRead: readAt != null,
          readAt,
        }),
      };
    });
  }

  listNotifications(
    actor: NotificationActorContext,
    query: ListNotificationsQuery = {}
  ): NotificationRecord[] {
    const parsed = listNotificationsQuerySchema.parse(query);

    return this.#hydrateNotifications(actor)
      .map((item) => item.record)
      .filter((record) => {
        if (parsed.type && record.type !== parsed.type) {
          return false;
        }

        if (parsed.readState === "read" && !record.isRead) {
          return false;
        }

        if (parsed.readState === "unread" && record.isRead) {
          return false;
        }

        return true;
      })
      .slice(0, parsed.limit ?? DEFAULT_NOTIFICATION_LIMIT);
  }

  getNotificationSummary(actor: NotificationActorContext): NotificationSummary {
    const notifications = this.#hydrateNotifications(actor).map((item) => item.record);
    const counts = new Map<NotificationType, { count: number; unreadCount: number }>(
      NOTIFICATION_TYPE_ORDER.map((type) => [type, { count: 0, unreadCount: 0 }])
    );

    for (const notification of notifications) {
      const bucket = counts.get(notification.type);
      if (!bucket) {
        continue;
      }

      bucket.count += 1;
      if (!notification.isRead) {
        bucket.unreadCount += 1;
      }
    }

    return notificationSummarySchema.parse({
      totalCount: notifications.length,
      unreadCount: notifications.filter((item) => !item.isRead).length,
      latestOccurredAt: notifications[0]?.occurredAt ?? null,
      byType: NOTIFICATION_TYPE_ORDER.map((type) => ({
        type,
        count: counts.get(type)?.count ?? 0,
        unreadCount: counts.get(type)?.unreadCount ?? 0,
      })),
    });
  }

  async markNotificationRead(
    actor: NotificationActorContext,
    notificationId: string
  ): Promise<NotificationRecord> {
    const notifications = this.#hydrateNotifications(actor);
    const target = notifications.find((item) => item.record.notificationId === notificationId);

    if (!target) {
      throw new AppError(
        404,
        "NOTIFICATION_NOT_FOUND",
        `Notification not found: ${notificationId}`
      );
    }

    if (target.record.isRead) {
      return target.record;
    }

    const receipt = notificationReadReceiptSchema.parse({
      notificationId,
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      readAt: nowIso(),
    });
    await notificationsRepository.saveReadReceipt(receipt);

    return notificationRecordSchema.parse({
      ...target.record,
      isRead: true,
      readAt: receipt.readAt,
    });
  }

  async markAllRead(actor: NotificationActorContext): Promise<NotificationSummary> {
    const cursor = notificationWorkspaceCursorSchema.parse({
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      markedAllReadAt: nowIso(),
    });
    await notificationsRepository.saveWorkspaceCursor(cursor);
    return this.getNotificationSummary(actor);
  }
}

export async function initializeNotificationsInfrastructure() {
  await notificationsRepository.init();
}

export const notificationsService = new NotificationsService();
