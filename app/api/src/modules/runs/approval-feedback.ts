import { randomUUID } from "node:crypto";
import {
  bridgeEventSchema,
  runApprovalSchema,
  runConversationMessageSchema,
  runSnapshotSchema,
} from "@lingban/contracts";
import type { RunQueryRepository } from "@lingban/db";
import { AppError } from "../../app/errors.js";
import { runEventBus } from "../realtime/event-bus.js";
import { runQueryRepository } from "./query-repository.js";
import { runsRepository } from "./repository.js";

export type ApprovalFeedbackDependencies = {
  runsRepository: Pick<typeof runsRepository, "get" | "update">;
  runEventBus: Pick<typeof runEventBus, "append" | "appendMany">;
  runQueryRepository?: Pick<RunQueryRepository, "upsertSnapshot"> | null;
};

export const defaultApprovalFeedbackDependencies: ApprovalFeedbackDependencies = {
  runsRepository,
  runEventBus,
  runQueryRepository,
};

function nowIso() {
  return new Date().toISOString();
}

function createSystemMessage(
  runId: string,
  text: string,
  kind: "status" | "approval" = "status"
) {
  return runConversationMessageSchema.parse({
    messageId: `msg_${randomUUID()}`,
    runId,
    role: "system",
    kind,
    text,
    attachments: [],
    createdAt: nowIso(),
  });
}

function createQuotaApproval(
  runId: string,
  prompt: string,
  relatedResourceRef: string | null,
  options: { autoApprove: boolean; decidedByUserId: string | null }
) {
  const requestedAt = nowIso();
  return runApprovalSchema.parse({
    approvalId: `apr_${randomUUID()}`,
    runId,
    kind: "quota-override",
    relatedResourceRef: relatedResourceRef ?? null,
    prompt,
    state: options.autoApprove ? "approved" : "pending",
    requestedAt,
    decidedAt: options.autoApprove ? requestedAt : null,
    decisionMode: options.autoApprove ? "auto_all" : null,
    decidedByUserId: options.autoApprove ? options.decidedByUserId : null,
    note: options.autoApprove
      ? "Automatically approved by the instance approval policy."
      : null,
  });
}

export async function appendRunSystemMessage(
  runId: string,
  text: string,
  kind: "status" | "approval" = "status",
  dependencies: ApprovalFeedbackDependencies = defaultApprovalFeedbackDependencies
) {
  const message = createSystemMessage(runId, text, kind);
  const updated = await dependencies.runsRepository.update(runId, (current) => ({
    ...current,
    messages: [...current.messages, message],
  }));

  if (!updated) {
    throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
  }

  if (dependencies.runQueryRepository) {
    await dependencies.runQueryRepository.upsertSnapshot(runSnapshotSchema.parse(updated));
  }

  await dependencies.runEventBus.append(
    bridgeEventSchema.parse({
      type: "conversation.message",
      message,
    })
  );

  return runSnapshotSchema.parse(updated);
}

export async function appendQuotaApprovalFeedback(input: {
  runId: string;
  prompt: string;
  relatedResourceRef?: string | null;
  messageText?: string | null;
},
dependencies: ApprovalFeedbackDependencies = defaultApprovalFeedbackDependencies) {
  const aggregate = dependencies.runsRepository.get(input.runId);
  if (!aggregate) {
    throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${input.runId}`);
  }
  const autoApprove = aggregate.run.approvalMode === "auto_all";
  const approval = createQuotaApproval(
    input.runId,
    input.prompt,
    input.relatedResourceRef ?? null,
    {
      autoApprove,
      decidedByUserId: aggregate.run.approvalModeUpdatedByUserId ?? aggregate.run.requestedByUserId ?? null,
    }
  );
  const messageText = autoApprove
    ? "Quota approval was accepted automatically by the instance approval policy."
    : input.messageText?.trim() ?? "";
  const message = messageText
    ? createSystemMessage(input.runId, messageText, "approval")
    : null;

  const updated = await dependencies.runsRepository.update(input.runId, (current) => ({
    ...current,
    approvals: [...current.approvals, approval],
    messages: message ? [...current.messages, message] : current.messages,
  }));

  if (!updated) {
    throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${input.runId}`);
  }

  if (dependencies.runQueryRepository) {
    await dependencies.runQueryRepository.upsertSnapshot(runSnapshotSchema.parse(updated));
  }

  const events = [
    bridgeEventSchema.parse({
      type: "approval.requested",
      approval,
    }),
  ];

  if (message) {
    events.push(
      bridgeEventSchema.parse({
        type: "conversation.message",
        message,
      })
    );
  }

  await dependencies.runEventBus.appendMany(events);

  return {
    approval,
    snapshot: runSnapshotSchema.parse(updated),
  };
}
