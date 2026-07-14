import { z } from "zod";
import {
  bridgeEventSchema,
  createRunInputSchema,
  runIdSchema,
  runSnapshotSchema,
  startRunJobPayloadSchema,
  type BridgeEvent,
  type CreateRunInput,
  type RunApproval,
  type RunArtifact,
  type RunConversationMessage,
  type RunFileEntry,
  type RunRecord,
  type RunSnapshot,
  type StartRunJobPayload,
} from "@lingban/contracts";

export const runAggregateSchema = runSnapshotSchema.extend({
  input: createRunInputSchema,
  startJob: startRunJobPayloadSchema,
});

export type RunAggregate = {
  run: RunRecord;
  runtime?: RunSnapshot["runtime"];
  provider?: RunSnapshot["provider"];
  informationCollection?: RunSnapshot["informationCollection"];
  input: CreateRunInput;
  startJob: StartRunJobPayload;
  messages: RunConversationMessage[];
  files: RunFileEntry[];
  artifacts: RunArtifact[];
  approvals: RunApproval[];
};

export function projectRunSnapshot(aggregate: {
  run: RunSnapshot["run"];
  runtime?: RunSnapshot["runtime"];
  provider?: RunSnapshot["provider"];
  informationCollection?: RunSnapshot["informationCollection"];
  messages: RunConversationMessage[];
  files: RunFileEntry[];
  artifacts: RunArtifact[];
  approvals: RunApproval[];
}) {
  return runSnapshotSchema.parse(aggregate);
}

export interface RunsRepository {
  init(): Promise<void>;
  save(aggregate: RunAggregate): Promise<RunAggregate>;
  get(runId: string): RunAggregate | null;
  list(): RunAggregate[];
  update(runId: string, updater: (current: RunAggregate) => RunAggregate): Promise<RunAggregate | null>;
  clear(): Promise<void>;
}

export const runEventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  runId: runIdSchema,
  event: bridgeEventSchema,
});

export type RunEventEnvelope = z.infer<typeof runEventEnvelopeSchema>;
export type RunEventListener = (envelope: RunEventEnvelope) => void;

export interface RunEventBus {
  init(): Promise<void>;
  append(event: BridgeEvent): Promise<RunEventEnvelope>;
  appendMany(events: BridgeEvent[]): Promise<RunEventEnvelope[]>;
  list(runId: string): RunEventEnvelope[];
  subscribe(runId: string, listener: RunEventListener): () => void;
}

export interface RunMessageRepository {
  append(message: RunConversationMessage): Promise<RunConversationMessage>;
  listByRunId(runId: string): Promise<RunConversationMessage[]>;
}

export interface RunArtifactRepository {
  upsert(artifact: RunArtifact): Promise<RunArtifact>;
  listByRunId(runId: string): Promise<RunArtifact[]>;
}

export interface RunApprovalRepository {
  create(approval: RunApproval): Promise<RunApproval>;
  update(approval: RunApproval): Promise<RunApproval>;
  listByRunId(runId: string): Promise<RunApproval[]>;
  listPending(): Promise<RunApproval[]>;
}

export interface RunFileRepository {
  replaceForRun(runId: string, files: RunFileEntry[]): Promise<void>;
  listByRunId(runId: string): Promise<RunFileEntry[]>;
}

export interface RunQueryRepository {
  init(): Promise<void>;
  getSnapshot(runId: string): RunSnapshot | null;
  listSnapshots(): RunSnapshot[];
  upsertSnapshot(snapshot: RunSnapshot): Promise<RunSnapshot>;
  clear(): Promise<void>;
}
