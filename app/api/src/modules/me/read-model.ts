import type {
  NotificationTarget,
  NotificationTone,
  NotificationType,
  RunSnapshot,
} from "@lingban/contracts";

type NoticeActorContext = {
  workspaceId: string;
  workspaceContextKey: string;
};

export type RunNoticeRecord = {
  noticeId: string;
  workspaceId: string;
  workspaceContextKey: string;
  type: NotificationType;
  tone: NotificationTone;
  title: {
    zh: string;
    en: string;
  };
  summary: {
    zh: string;
    en: string;
  };
  occurredAt: string;
  target: NotificationTarget;
};

function localized(zh: string, en: string) {
  return { zh, en };
}

function buildNoticeId(type: NotificationType, runId: string) {
  return `ntf_${type}_${runId}`;
}

function pickRunTitle(snapshot: RunSnapshot) {
  const title = snapshot.run.title.trim();
  return title.length > 0 ? title : snapshot.run.runId;
}

function isDirectoryPath(value: string) {
  return value.endsWith("/") || value.endsWith("\\");
}

function countMaterializedOutputs(snapshot: RunSnapshot) {
  const outputPaths = new Set<string>();

  for (const artifact of snapshot.artifacts) {
    if (artifact.status === "ready" && !isDirectoryPath(artifact.file.path)) {
      outputPaths.add(artifact.file.path);
    }
  }

  for (const file of snapshot.files) {
    if (isDirectoryPath(file.path)) {
      continue;
    }

    if (file.kind === "output" || file.kind === "receipt" || file.kind === "archive") {
      outputPaths.add(file.path);
    }
  }

  return outputPaths;
}

function pickLatestAgentMessageId(snapshot: RunSnapshot) {
  for (let index = snapshot.messages.length - 1; index >= 0; index -= 1) {
    const message = snapshot.messages[index];
    if (message.role !== "user") {
      return message.messageId;
    }
  }

  return null;
}

function buildPendingApprovalNotice(
  snapshot: RunSnapshot,
  actor: NoticeActorContext,
  pendingApprovalsCount: number
): RunNoticeRecord {
  const pendingApproval = snapshot.approvals.find((approval) => approval.state === "pending") ?? null;
  const runTitle = pickRunTitle(snapshot);

  return {
    noticeId: buildNoticeId("approval_pending", snapshot.run.runId),
    workspaceId: actor.workspaceId,
    workspaceContextKey: actor.workspaceContextKey,
    type: "approval_pending",
    tone: "warn",
    title: localized("任务待审批", "Approval pending"),
    summary: localized(
      `${runTitle} 当前有 ${pendingApprovalsCount} 个待处理审批项，请回到任务继续。`,
      `${runTitle} currently has ${pendingApprovalsCount} pending approval item(s). Return to the run to continue.`
    ),
    occurredAt: snapshot.run.updatedAt,
    target: {
      resource: "run",
      runId: snapshot.run.runId,
      view: "audit",
      anchorType: pendingApproval ? "approval" : "run",
      anchorRefId: pendingApproval?.approvalId ?? null,
    },
  };
}

function buildFailedRunNotice(snapshot: RunSnapshot, actor: NoticeActorContext): RunNoticeRecord {
  const runTitle = pickRunTitle(snapshot);
  const fallback = "Open the run to review logs and decide whether to retry.";
  const reason = snapshot.run.statusReason?.trim() || fallback;
  const latestMessageId = pickLatestAgentMessageId(snapshot);

  return {
    noticeId: buildNoticeId("run_failed", snapshot.run.runId),
    workspaceId: actor.workspaceId,
    workspaceContextKey: actor.workspaceContextKey,
    type: "run_failed",
    tone: "danger",
    title: localized("任务运行失败", "Run failed"),
    summary: localized(
      `${runTitle} 执行失败。${reason}`,
      `${runTitle} failed. ${reason}`
    ),
    occurredAt: snapshot.run.updatedAt,
    target: {
      resource: "run",
      runId: snapshot.run.runId,
      view: "detail",
      anchorType: latestMessageId ? "message" : "run",
      anchorRefId: latestMessageId,
    },
  };
}

function buildResultsReadyNotice(
  snapshot: RunSnapshot,
  actor: NoticeActorContext,
  outputPaths: Set<string>
): RunNoticeRecord {
  const runTitle = pickRunTitle(snapshot);
  const firstOutputPath = [...outputPaths].sort((left, right) => left.localeCompare(right))[0] ?? null;

  return {
    noticeId: buildNoticeId("result_ready", snapshot.run.runId),
    workspaceId: actor.workspaceId,
    workspaceContextKey: actor.workspaceContextKey,
    type: "result_ready",
    tone: "success",
    title: localized("结果已生成", "Results ready"),
    summary: localized(
      `${runTitle} 已生成 ${outputPaths.size} 个结果文件，可直接查看或下载。`,
      `${runTitle} generated ${outputPaths.size} result file(s). Open the files view to inspect or download them.`
    ),
    occurredAt: snapshot.run.updatedAt,
    target: {
      resource: "run",
      runId: snapshot.run.runId,
      view: "files",
      anchorType: firstOutputPath ? "file" : "run",
      anchorRefId: firstOutputPath,
    },
  };
}

function buildRunSucceededNotice(
  snapshot: RunSnapshot,
  actor: NoticeActorContext
): RunNoticeRecord {
  const runTitle = pickRunTitle(snapshot);
  const latestMessageId = pickLatestAgentMessageId(snapshot);

  return {
    noticeId: buildNoticeId("run_succeeded", snapshot.run.runId),
    workspaceId: actor.workspaceId,
    workspaceContextKey: actor.workspaceContextKey,
    type: "run_succeeded",
    tone: "success",
    title: localized("任务已完成", "Run succeeded"),
    summary: localized(
      `${runTitle} 已完成，可回到任务查看对话和摘要。`,
      `${runTitle} completed successfully. Reopen the run to review the conversation and summary.`
    ),
    occurredAt: snapshot.run.updatedAt,
    target: {
      resource: "run",
      runId: snapshot.run.runId,
      view: "detail",
      anchorType: latestMessageId ? "message" : "run",
      anchorRefId: latestMessageId,
    },
  };
}

export function buildNoticeFromSnapshot(
  snapshot: RunSnapshot,
  actor: NoticeActorContext
): RunNoticeRecord | null {
  const pendingApprovalsCount = snapshot.approvals.filter(
    (approval) => approval.state === "pending"
  ).length;
  const outputPaths = countMaterializedOutputs(snapshot);

  if (snapshot.run.status === "WAITING_APPROVAL" || pendingApprovalsCount > 0) {
    return buildPendingApprovalNotice(snapshot, actor, pendingApprovalsCount);
  }

  if (snapshot.run.status === "FAILED") {
    return buildFailedRunNotice(snapshot, actor);
  }

  if (snapshot.run.status === "SUCCEEDED" && outputPaths.size > 0) {
    return buildResultsReadyNotice(snapshot, actor, outputPaths);
  }

  if (snapshot.run.status === "SUCCEEDED") {
    return buildRunSucceededNotice(snapshot, actor);
  }

  return null;
}

export function collectRunNoticeRecords(
  snapshots: RunSnapshot[],
  actor: NoticeActorContext
): RunNoticeRecord[] {
  return snapshots
    .map((snapshot) => buildNoticeFromSnapshot(snapshot, actor))
    .filter((notice): notice is RunNoticeRecord => notice !== null)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}
