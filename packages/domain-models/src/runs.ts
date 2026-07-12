import {
  bridgeEventSchema,
  createRunInputSchema,
  runInformationCollectionAnswerSchema,
  runInformationCollectionSchema,
  runInformationCollectionSlotSchema,
  listRunsQuerySchema,
  runApprovalSchema,
  runAttentionModeSchema,
  runArtifactSchema,
  type RunConversationAttachment,
  type RunConversationSlotValue,
  runListSummarySchema,
  runListViewStatusSchema,
  runRecordSchema,
  runSnapshotSchema,
  runStatusSchema,
  type BridgeEvent,
  type CreateRunInput,
  type ListRunsQuery,
  type RunAttentionMode,
  type RunInformationCollection,
  type RunInformationCollectionAnswer,
  type RunInformationCollectionSlot,
  type RunListSummary,
  type RunListViewStatus,
  type RunRecord,
  type RunSnapshot,
  type RunStatus,
} from "@lingban/contracts";
import { matchesSearchQuery } from "./search.js";

export const runStatusTransitions: Record<RunStatus, readonly RunStatus[]> = {
  CREATED: ["READY", "WAITING_APPROVAL", "FAILED", "CANCELLED"],
  READY: ["QUEUED", "FAILED", "CANCELLED"],
  QUEUED: ["STARTING", "FAILED", "CANCELLED"],
  STARTING: ["RUNNING", "FAILED", "CANCELLED"],
  RUNNING: ["WAITING_APPROVAL", "SUCCEEDED", "FAILED", "CANCELLED"],
  WAITING_APPROVAL: ["RUNNING", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransitionRunStatus(from: RunStatus, to: RunStatus) {
  return runStatusTransitions[from].includes(to);
}

export function resolveRunListViewStatus(status: RunStatus): RunListViewStatus {
  runStatusSchema.parse(status);

  switch (status) {
    case "WAITING_APPROVAL":
      return runListViewStatusSchema.parse("approval");
    case "SUCCEEDED":
      return runListViewStatusSchema.parse("done");
    case "FAILED":
      return runListViewStatusSchema.parse("failed");
    case "CANCELLED":
      return runListViewStatusSchema.parse("cancelled");
    case "CREATED":
    case "READY":
    case "QUEUED":
    case "STARTING":
    case "RUNNING":
    default:
      return runListViewStatusSchema.parse("running");
  }
}

function hasRunOutput(snapshot: RunSnapshot) {
  if (snapshot.run.status === "SUCCEEDED") {
    return true;
  }

  return snapshot.files.some(
    (file) =>
      !file.path.endsWith("/") &&
      (file.kind === "output" || file.kind === "archive" || file.kind === "receipt")
  );
}

export function resolveRunAttentionMode(snapshot: RunSnapshot): RunAttentionMode {
  const current = runSnapshotSchema.parse(snapshot);

  if (
    current.run.status === "FAILED" ||
    current.run.status === "CANCELLED" ||
    current.approvals.some((item) => item.state === "pending")
  ) {
    return runAttentionModeSchema.parse("todo");
  }

  if (hasRunOutput(current)) {
    return runAttentionModeSchema.parse("done");
  }

  return runAttentionModeSchema.parse("running");
}

function inferRunDomainTag(snapshot: RunSnapshot) {
  const haystack = [
    snapshot.run.taskVersionId,
    snapshot.run.targetPath,
    snapshot.run.catalogMetadata?.workshopId,
    snapshot.run.catalogMetadata?.serviceId,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("tax")) {
    return "#tax";
  }

  if (haystack.includes("drama")) {
    return "#drama";
  }

  if (haystack.includes("poster") || haystack.includes("brand")) {
    return "#image";
  }

  return null;
}

export function resolveRunListTags(
  snapshot: RunSnapshot,
  options: {
    workspaceContextKey?: string | null;
  } = {}
) {
  const current = runSnapshotSchema.parse(snapshot);
  const tags = new Set<string>();
  const workspaceContextKey =
    options.workspaceContextKey?.trim() ||
    current.run.catalogMetadata?.workspaceContextKey?.trim() ||
    "";

  tags.add("#live");
  tags.add(`#${current.run.entrySurface}`);
  tags.add(`#${current.run.status.toLowerCase()}`);

  const attentionMode = resolveRunAttentionMode(current);
  if (attentionMode === "running") {
    tags.add("#running");
  } else if (attentionMode === "todo") {
    tags.add("#approval");
  } else if (attentionMode === "done") {
    tags.add("#result");
  }

  if (workspaceContextKey) {
    tags.add(`#${workspaceContextKey}`);
  }

  const domainTag = inferRunDomainTag(current);
  if (domainTag) {
    tags.add(domainTag);
  }

  return [...tags];
}

export function matchesRunListQuery(
  snapshot: RunSnapshot,
  query: ListRunsQuery = {},
  options: {
    workspaceContextKey?: string | null;
  } = {}
) {
  const current = runSnapshotSchema.parse(snapshot);
  const parsed = listRunsQuerySchema.parse(query);
  const viewStatus = resolveRunListViewStatus(current.run.status);
  const tags = resolveRunListTags(current, options);

  if (parsed.status && current.run.status !== parsed.status) {
    return false;
  }

  if (parsed.viewStatus && viewStatus !== parsed.viewStatus) {
    return false;
  }

  if (parsed.attentionMode && resolveRunAttentionMode(current) !== parsed.attentionMode) {
    return false;
  }

  if (parsed.entrySurface && current.run.entrySurface !== parsed.entrySurface) {
    return false;
  }

  if (parsed.tag && !tags.includes(parsed.tag)) {
    return false;
  }

  if (!parsed.q) {
    return true;
  }

  return matchesSearchQuery(parsed.q, [
    current.run.runId,
    current.run.title,
    current.run.taskVersionId,
    current.run.sessionVersionId,
    current.run.targetPath,
    current.run.entrySurface,
    current.run.status,
    current.run.statusReason,
    current.run.catalogMetadata?.workspaceContextKey,
    current.run.catalogMetadata?.workspaceContextName?.zh,
    current.run.catalogMetadata?.workspaceContextName?.en,
    current.run.catalogMetadata?.workshopId,
    current.run.catalogMetadata?.workshopName?.zh,
    current.run.catalogMetadata?.workshopName?.en,
    current.run.catalogMetadata?.serviceId,
    current.run.catalogMetadata?.serviceName?.zh,
    current.run.catalogMetadata?.serviceName?.en,
    ...tags,
  ]);
}

function sortFacetCounts<T extends { count: number }>(items: T[]) {
  return [...items].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return JSON.stringify(left).localeCompare(JSON.stringify(right));
  });
}

export function summarizeRunSnapshots(
  snapshots: RunSnapshot[],
  options: {
    workspaceContextKey?: string | null;
  } = {}
): RunListSummary {
  const current = snapshots.map((item) => runSnapshotSchema.parse(item));
  const byStatus = {
    CREATED: 0,
    READY: 0,
    QUEUED: 0,
    STARTING: 0,
    RUNNING: 0,
    WAITING_APPROVAL: 0,
    SUCCEEDED: 0,
    FAILED: 0,
    CANCELLED: 0,
  };
  const byViewStatus = {
    all: current.length,
    running: 0,
    approval: 0,
    done: 0,
    failed: 0,
    cancelled: 0,
  };
  const byAttentionMode = {
    todo: 0,
    running: 0,
    done: 0,
  };
  const byEntrySurface = new Map<string, number>();
  const byTag = new Map<string, number>();
  const byWorkshop = new Map<string, { workshopId: string | null; title: { zh: string; en: string }; count: number }>();
  let pendingApprovalsCount = 0;
  let outputsReadyCount = 0;
  let latestUpdatedAt: string | null = null;

  for (const snapshot of current) {
    byStatus[snapshot.run.status] += 1;

    const viewStatus = resolveRunListViewStatus(snapshot.run.status);
    byViewStatus[viewStatus] += 1;
    byAttentionMode[resolveRunAttentionMode(snapshot)] += 1;

    byEntrySurface.set(
      snapshot.run.entrySurface,
      (byEntrySurface.get(snapshot.run.entrySurface) ?? 0) + 1
    );

    for (const tag of resolveRunListTags(snapshot, options)) {
      byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
    }

    const workshopId = snapshot.run.catalogMetadata?.workshopId ?? null;
    const workshopTitle = snapshot.run.catalogMetadata?.workshopName ?? {
      zh: snapshot.run.title,
      en: snapshot.run.title,
    };
    const workshopKey = workshopId ?? `title:${workshopTitle.zh}|${workshopTitle.en}`;
    const currentWorkshop = byWorkshop.get(workshopKey) ?? {
      workshopId,
      title: workshopTitle,
      count: 0,
    };
    currentWorkshop.count += 1;
    byWorkshop.set(workshopKey, currentWorkshop);

    pendingApprovalsCount += snapshot.approvals.filter((item) => item.state === "pending").length;

    if (hasRunOutput(snapshot)) {
      outputsReadyCount += 1;
    }

    if (!latestUpdatedAt || snapshot.run.updatedAt > latestUpdatedAt) {
      latestUpdatedAt = snapshot.run.updatedAt;
    }
  }

  return runListSummarySchema.parse({
    total: current.length,
    pendingApprovalsCount,
    outputsReadyCount,
    latestUpdatedAt,
    byStatus,
    byViewStatus,
    byAttentionMode,
    byEntrySurface: sortFacetCounts(
      [...byEntrySurface.entries()].map(([key, count]) => ({ key, count }))
    ),
    byTag: sortFacetCounts(
      [...byTag.entries()].map(([key, count]) => ({ key, count }))
    ),
    byWorkshop: sortFacetCounts([...byWorkshop.values()]),
  });
}

export function assertRunStatusTransition(from: RunStatus, to: RunStatus) {
  runStatusSchema.parse(from);
  runStatusSchema.parse(to);

  if (!canTransitionRunStatus(from, to)) {
    throw new Error(`Invalid run status transition: ${from} -> ${to}`);
  }
}

export function createRunRecord(params: {
  runId: string;
  createdAt: string;
  input: CreateRunInput;
}): RunRecord {
  const input = createRunInputSchema.parse(params.input);

  return runRecordSchema.parse({
    runId: params.runId,
    workspaceId: input.workspaceId,
    taskVersionId: input.taskVersionId,
    sessionVersionId: input.sessionVersionId,
    requestedByUserId: input.requestedByUserId ?? null,
    title: input.title,
    targetPath: input.targetPath,
    entrySurface: input.entrySurface,
    catalogMetadata: input.catalogMetadata ?? null,
    status: "CREATED",
    statusReason: null,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  });
}

export function transitionRunStatus(
  run: RunRecord,
  nextStatus: RunStatus,
  options: { at: string; reason?: string | null }
): RunRecord {
  const current = runRecordSchema.parse(run);
  assertRunStatusTransition(current.status, nextStatus);

  return runRecordSchema.parse({
    ...current,
    status: nextStatus,
    statusReason: options.reason ?? null,
    updatedAt: options.at,
  });
}

function projectRunStatus(
  run: RunRecord,
  nextStatus: RunStatus,
  options: { at: string; reason?: string | null }
) {
  if (run.status === nextStatus) {
    return runRecordSchema.parse({
      ...run,
      statusReason: options.reason ?? run.statusReason,
      updatedAt: options.at,
    });
  }

  if (canTransitionRunStatus(run.status, nextStatus)) {
    return transitionRunStatus(run, nextStatus, options);
  }

  return runRecordSchema.parse({
    ...run,
    status: nextStatus,
    statusReason: options.reason ?? null,
    updatedAt: options.at,
  });
}

function upsertByKey<T extends Record<string, unknown>>(items: T[], key: keyof T, value: T) {
  const index = items.findIndex((item) => item[key] === value[key]);
  if (index === -1) {
    return [...items, value];
  }

  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

export function applyBridgeEventToRunSnapshot(snapshot: RunSnapshot, event: BridgeEvent): RunSnapshot {
  const current = runSnapshotSchema.parse(snapshot);
  const parsed = bridgeEventSchema.parse(event);

  switch (parsed.type) {
    case "run.status.changed":
      return runSnapshotSchema.parse({
        ...current,
        run: projectRunStatus(current.run, parsed.status, {
          at: parsed.occurredAt,
          reason: parsed.reason ?? null,
        }),
      });
    case "conversation.message":
      if (current.messages.some((message) => message.messageId === parsed.message.messageId)) {
        return current;
      }
      return runSnapshotSchema.parse({
        ...current,
        messages: [...current.messages, parsed.message],
      });
    case "approval.requested":
      return runSnapshotSchema.parse({
        ...current,
        approvals: upsertByKey(current.approvals, "approvalId", runApprovalSchema.parse(parsed.approval)),
      });
    case "informationCollection.updated":
      return runSnapshotSchema.parse({
        ...current,
        informationCollection: runInformationCollectionSchema.parse(
          parsed.informationCollection
        ),
      });
    case "artifact.ready":
      return runSnapshotSchema.parse({
        ...current,
        artifacts: upsertByKey(current.artifacts, "artifactId", runArtifactSchema.parse(parsed.artifact)),
      });
    case "mcp.call":
      return current;
    case "files.synced":
      return runSnapshotSchema.parse({
        ...current,
        files: parsed.files,
      });
    case "file.changed":
      return runSnapshotSchema.parse({
        ...current,
        files: upsertByKey(current.files, "path", parsed.file),
      });
    case "run.failed":
      return runSnapshotSchema.parse({
        ...current,
        run: projectRunStatus(current.run, "FAILED", {
          at: parsed.occurredAt,
          reason: parsed.error,
        }),
      });
    case "heartbeat":
      return current;
  }
}

export function applyBridgeEventsToRunSnapshot(snapshot: RunSnapshot, events: BridgeEvent[]) {
  return events.reduce((current, event) => applyBridgeEventToRunSnapshot(current, event), snapshot);
}

export function createInformationCollectionPrompt(run: RunRecord) {
  return [
    "请问你需要我提供什么信息给你。",
    `当前任务标题：${run.title}`,
    `目标路径：${run.targetPath}`,
    "请基于当前任务目标，明确告诉用户继续执行前需要的资料、账号、授权、审批和补充说明。",
  ].join("\n");
}

function countSatisfiedRequiredSlots(slots: RunInformationCollectionSlot[]) {
  return slots.filter((slot) => slot.required && slot.status === "satisfied").length;
}

function countMissingRequiredSlots(slots: RunInformationCollectionSlot[]) {
  return slots.filter((slot) => slot.required && slot.status !== "satisfied").length;
}

function normalizeCollectionStatus(input: {
  slots: RunInformationCollectionSlot[];
  userMessageCount: number;
  attachmentCount: number;
}) {
  const missingCount = countMissingRequiredSlots(input.slots);
  if (missingCount === 0 && input.slots.some((slot) => slot.required)) {
    return "completed" as const;
  }

  if (input.userMessageCount > 0 || input.attachmentCount > 0) {
    return "in_progress" as const;
  }

  return "pending" as const;
}

function isAttachmentSatisfiedSlot(slot: Pick<RunInformationCollectionSlot, "type">) {
  return slot.type === "file" || slot.type === "directory";
}

function isTextSatisfiedSlot(slot: Pick<RunInformationCollectionSlot, "type">) {
  return !isAttachmentSatisfiedSlot(slot);
}

function normalizeAnswerPreview(
  slot: Pick<RunInformationCollectionSlot, "secret">,
  valueText: string
) {
  if (slot.secret) {
    return null;
  }

  const normalized = valueText.trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function buildStructuredAnswerId(
  sourceMessageId: string,
  slotKey: string,
  kind: "text" | "attachment",
  index: number
) {
  const safeSlotKey = slotKey.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `ica_${sourceMessageId}_${safeSlotKey}_${kind}_${index + 1}`;
}

function buildManualReviewAnswerId(answerId: string, at: string) {
  const safeAnswerId = answerId.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const safeTimestamp = at.replace(/[^0-9]+/g, "");
  return `ica_review_${safeAnswerId}_${safeTimestamp}`;
}

function isEffectiveStructuredAnswer(answer: Pick<RunInformationCollectionAnswer, "reviewStatus">) {
  return answer.reviewStatus !== "rejected" && answer.reviewStatus !== "superseded";
}

function countAnswersByReviewStatus(
  answers: RunInformationCollectionAnswer[],
  reviewStatus: RunInformationCollectionAnswer["reviewStatus"]
) {
  return answers.filter((answer) => answer.reviewStatus === reviewStatus).length;
}

function collectStructuredAnswers(
  collection: RunInformationCollection,
  options: {
    attachments: RunConversationAttachment[];
    slotValues: RunConversationSlotValue[];
    sourceMessageId?: string;
    at: string;
  }
) {
  if (!options.sourceMessageId) {
    return [] as RunInformationCollectionAnswer[];
  }

  const slotByKey = new Map(collection.slots.map((slot) => [slot.key, slot] as const));
  const answers: RunInformationCollectionAnswer[] = [];
  let textIndex = 0;
  let attachmentIndex = 0;

  for (const slotValue of options.slotValues) {
    const slot = slotByKey.get(slotValue.slotKey);
    if (!slot) {
      continue;
    }

    answers.push(
      runInformationCollectionAnswerSchema.parse({
        answerId: buildStructuredAnswerId(
          options.sourceMessageId,
          slot.key,
          "text",
          textIndex++
        ),
        slotKey: slot.key,
        slotType: slot.type,
        kind: "text",
        source: "user-message",
        sourceMessageId: options.sourceMessageId,
        valueText: slotValue.valueText,
        attachmentPath: null,
        attachmentLabel: null,
        reviewStatus: "pending",
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNote: null,
        supersedesAnswerId: null,
        supersededByAnswerId: null,
        createdAt: options.at,
      })
    );
  }

  for (const attachment of options.attachments) {
    if (!attachment.slotKey) {
      continue;
    }

    const slot = slotByKey.get(attachment.slotKey);
    if (!slot) {
      continue;
    }

    answers.push(
      runInformationCollectionAnswerSchema.parse({
        answerId: buildStructuredAnswerId(
          options.sourceMessageId,
          slot.key,
          "attachment",
          attachmentIndex++
        ),
        slotKey: slot.key,
        slotType: slot.type,
        kind: "attachment",
        source: "user-message",
        sourceMessageId: options.sourceMessageId,
        valueText: null,
        attachmentPath: attachment.path,
        attachmentLabel: attachment.label,
        reviewStatus: "pending",
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNote: null,
        supersedesAnswerId: null,
        supersededByAnswerId: null,
        createdAt: options.at,
      })
    );
  }

  return answers;
}

function inferSlotValuesFromMessage(
  collection: RunInformationCollection,
  text: string,
  attachments: RunConversationAttachment[]
): RunConversationSlotValue[] {
  if (attachments.length > 0) {
    return [];
  }

  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const eligibleSlots = collection.slots.filter(
    (slot) =>
      slot.required &&
      slot.status !== "satisfied" &&
      isTextSatisfiedSlot(slot)
  );

  if (eligibleSlots.length !== 1) {
    return [];
  }

  return [
    {
      slotKey: eligibleSlots[0].key,
      valueText: normalized,
    },
  ];
}

function rebuildInformationCollection(
  collection: RunInformationCollection,
  options: {
    userMessageCount?: number;
    attachmentCount?: number;
    lastUpdatedAt?: string | null;
  } = {}
): RunInformationCollection {
  const current = runInformationCollectionSchema.parse(collection);
  const answers = current.answers.map((answer) => runInformationCollectionAnswerSchema.parse(answer));
  const userMessageCount = options.userMessageCount ?? current.userMessageCount;
  const attachmentCount = options.attachmentCount ?? current.attachmentCount;
  const effectiveAnswersBySlot = answers.reduce<Map<string, RunInformationCollectionAnswer[]>>(
    (accumulator, answer) => {
      if (!isEffectiveStructuredAnswer(answer)) {
        return accumulator;
      }

      const currentEntries = accumulator.get(answer.slotKey) ?? [];
      currentEntries.push(answer);
      accumulator.set(answer.slotKey, currentEntries);
      return accumulator;
    },
    new Map()
  );

  const slots = current.slots.map((slot) => {
    const effectiveAnswers = effectiveAnswersBySlot.get(slot.key) ?? [];
    const effectiveTextAnswers = effectiveAnswers.filter((answer) => answer.kind === "text");
    const effectiveAttachmentAnswers = effectiveAnswers.filter(
      (answer) => answer.kind === "attachment"
    );
    const latestTextAnswer = effectiveTextAnswers.at(-1) ?? null;
    const latestSatisfiedAnswer = effectiveAnswers.at(-1) ?? null;
    const canSatisfyWithAttachment = isAttachmentSatisfiedSlot(slot);
    const canSatisfyWithText = isTextSatisfiedSlot(slot);
    const satisfied =
      (canSatisfyWithAttachment && effectiveAttachmentAnswers.length > 0) ||
      (canSatisfyWithText && effectiveTextAnswers.length > 0);
    const nextStatus = satisfied ? "satisfied" : slot.required ? "missing" : "optional";

    return runInformationCollectionSlotSchema.parse({
      ...slot,
      attachmentCount: effectiveAttachmentAnswers.length,
      answerCount: effectiveTextAnswers.length,
      lastAnswerText:
        latestTextAnswer?.valueText != null
          ? normalizeAnswerPreview(slot, latestTextAnswer.valueText)
          : null,
      status: nextStatus,
      lastSatisfiedAt: nextStatus === "satisfied" ? latestSatisfiedAnswer?.createdAt ?? null : null,
    });
  });

  const requiredCount = slots.filter((slot) => slot.required).length;
  const satisfiedCount = countSatisfiedRequiredSlots(slots);
  const missingCount = countMissingRequiredSlots(slots);

  return runInformationCollectionSchema.parse({
    ...current,
    status: normalizeCollectionStatus({
      slots,
      userMessageCount,
      attachmentCount,
    }),
    requiredCount,
    satisfiedCount,
    missingCount,
    userMessageCount,
    attachmentCount,
    pendingReviewCount: countAnswersByReviewStatus(answers, "pending"),
    approvedReviewCount: countAnswersByReviewStatus(answers, "approved"),
    rejectedReviewCount: countAnswersByReviewStatus(answers, "rejected"),
    lastUpdatedAt:
      options.lastUpdatedAt === undefined ? current.lastUpdatedAt : options.lastUpdatedAt,
    slots,
    answers,
  });
}

export function createRunInformationCollection(params: {
  prompt: string;
  slotSchemaVersion?: string | null;
  slots?: Array<
    Pick<
      RunInformationCollectionSlot,
      | "key"
      | "title"
      | "type"
      | "required"
      | "secret"
      | "repeatable"
      | "prompt"
      | "description"
      | "placeholder"
      | "choices"
      | "accepts"
    >
  >;
}): RunInformationCollection {
  const slots = (params.slots ?? []).map((slot) =>
    runInformationCollectionSlotSchema.parse({
      ...slot,
      status: slot.required ? "missing" : "optional",
      attachmentCount: 0,
      answerCount: 0,
      lastAnswerText: null,
      lastSatisfiedAt: null,
    })
  );
  const requiredCount = slots.filter((slot) => slot.required).length;
  return rebuildInformationCollection(
    runInformationCollectionSchema.parse({
      prompt: params.prompt,
      slotSchemaVersion: params.slotSchemaVersion ?? null,
      status: normalizeCollectionStatus({
        slots,
        userMessageCount: 0,
        attachmentCount: 0,
      }),
      requiredCount,
      satisfiedCount: 0,
      missingCount: requiredCount,
      userMessageCount: 0,
      attachmentCount: 0,
      pendingReviewCount: 0,
      approvedReviewCount: 0,
      rejectedReviewCount: 0,
      lastUpdatedAt: null,
      slots,
      answers: [],
    }),
    {
      userMessageCount: 0,
      attachmentCount: 0,
      lastUpdatedAt: null,
    }
  );
}

export function resolveInformationCollectionSlotValues(
  collection: RunInformationCollection,
  options: {
    text?: string;
    attachments?: RunConversationAttachment[];
    slotValues?: RunConversationSlotValue[];
  }
) {
  const current = runInformationCollectionSchema.parse(collection);
  const attachments = options.attachments ?? [];
  const explicitSlotValues = options.slotValues ?? [];

  return explicitSlotValues.length > 0
    ? explicitSlotValues
    : inferSlotValuesFromMessage(current, options.text ?? "", attachments);
}

export function applyUserMessageToInformationCollection(
  collection: RunInformationCollection,
  options: {
    text?: string;
    attachments?: RunConversationAttachment[];
    slotValues?: RunConversationSlotValue[];
    sourceMessageId?: string;
    at: string;
  }
): RunInformationCollection {
  const current = runInformationCollectionSchema.parse(collection);
  const attachments = options.attachments ?? [];
  const slotValues = resolveInformationCollectionSlotValues(current, {
    text: options.text,
    attachments,
    slotValues: options.slotValues,
  });
  const structuredAnswers = collectStructuredAnswers(current, {
    attachments,
    slotValues,
    sourceMessageId: options.sourceMessageId,
    at: options.at,
  });
  return rebuildInformationCollection(
    runInformationCollectionSchema.parse({
      ...current,
      answers: [...current.answers, ...structuredAnswers],
    }),
    {
      userMessageCount: current.userMessageCount + 1,
      attachmentCount: current.attachmentCount + attachments.length,
      lastUpdatedAt: options.at,
    }
  );
}

export function reviewInformationCollectionAnswer(
  collection: RunInformationCollection,
  options: {
    answerId: string;
    decision: "approve" | "reject" | "revise";
    at: string;
    reviewedByUserId?: string | null;
    note?: string | null;
    replacementValueText?: string;
    replacementAttachmentPath?: string;
    replacementAttachmentLabel?: string;
  }
): RunInformationCollection {
  const current = runInformationCollectionSchema.parse(collection);
  const answerIndex = current.answers.findIndex((answer) => answer.answerId === options.answerId);

  if (answerIndex === -1) {
    throw new Error(`Information collection answer not found: ${options.answerId}`);
  }

  const currentAnswer = runInformationCollectionAnswerSchema.parse(current.answers[answerIndex]);
  if (currentAnswer.reviewStatus === "superseded") {
    throw new Error(`Information collection answer is already superseded: ${options.answerId}`);
  }

  const reviewNote = options.note ?? currentAnswer.reviewNote ?? null;
  const reviewedByUserId = options.reviewedByUserId ?? null;
  const answers = [...current.answers];

  if (options.decision === "approve") {
    answers[answerIndex] = runInformationCollectionAnswerSchema.parse({
      ...currentAnswer,
      reviewStatus: "approved",
      reviewedAt: options.at,
      reviewedByUserId,
      reviewNote,
    });
  } else if (options.decision === "reject") {
    answers[answerIndex] = runInformationCollectionAnswerSchema.parse({
      ...currentAnswer,
      reviewStatus: "rejected",
      reviewedAt: options.at,
      reviewedByUserId,
      reviewNote,
    });
  } else {
    if (currentAnswer.kind === "text") {
      const replacementValueText = options.replacementValueText?.trim();
      if (!replacementValueText) {
        throw new Error(
          `Text answer revisions require replacementValueText: ${options.answerId}`
        );
      }

      const revisedAnswer = runInformationCollectionAnswerSchema.parse({
        ...currentAnswer,
        answerId: buildManualReviewAnswerId(currentAnswer.answerId, options.at),
        source: "manual-review",
        sourceMessageId: `review:${currentAnswer.answerId}`,
        valueText: replacementValueText,
        attachmentPath: null,
        attachmentLabel: null,
        reviewStatus: "approved",
        reviewedAt: options.at,
        reviewedByUserId,
        reviewNote,
        supersedesAnswerId: currentAnswer.answerId,
        supersededByAnswerId: null,
        createdAt: options.at,
      });

      answers[answerIndex] = runInformationCollectionAnswerSchema.parse({
        ...currentAnswer,
        reviewStatus: "superseded",
        reviewedAt: options.at,
        reviewedByUserId,
        reviewNote,
        supersededByAnswerId: revisedAnswer.answerId,
      });
      answers.push(revisedAnswer);
    } else {
      const replacementAttachmentPath = options.replacementAttachmentPath?.trim();
      if (!replacementAttachmentPath) {
        throw new Error(
          `Attachment answer revisions require replacementAttachmentPath: ${options.answerId}`
        );
      }

      const revisedAnswer = runInformationCollectionAnswerSchema.parse({
        ...currentAnswer,
        answerId: buildManualReviewAnswerId(currentAnswer.answerId, options.at),
        source: "manual-review",
        sourceMessageId: `review:${currentAnswer.answerId}`,
        valueText: null,
        attachmentPath: replacementAttachmentPath,
        attachmentLabel: options.replacementAttachmentLabel?.trim() || currentAnswer.attachmentLabel,
        reviewStatus: "approved",
        reviewedAt: options.at,
        reviewedByUserId,
        reviewNote,
        supersedesAnswerId: currentAnswer.answerId,
        supersededByAnswerId: null,
        createdAt: options.at,
      });

      answers[answerIndex] = runInformationCollectionAnswerSchema.parse({
        ...currentAnswer,
        reviewStatus: "superseded",
        reviewedAt: options.at,
        reviewedByUserId,
        reviewNote,
        supersededByAnswerId: revisedAnswer.answerId,
      });
      answers.push(revisedAnswer);
    }
  }

  return rebuildInformationCollection(
    runInformationCollectionSchema.parse({
      ...current,
      answers,
    }),
    {
      lastUpdatedAt: options.at,
    }
  );
}
