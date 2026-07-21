import { z } from "./zod.js";
import {
  agentEventIdSchema,
  isoDatetimeSchema,
  providerIdSchema,
  runIdSchema,
  workspaceProviderBindingIdSchema,
} from "./common.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");

export const agentRuntimeProtocolSchema = z.enum(["legacy-pty", "app-server"]);
export const agentRuntimeConnectionStateSchema = z.enum([
  "starting",
  "initializing",
  "ready",
  "turn_running",
  "waiting_approval",
  "waiting_input",
  "stopping",
  "stopped",
  "failed",
]);
export const agentTurnStateSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "interrupted",
  "failed",
]);

export const agentThreadSummarySchema = z.object({
  protocol: agentRuntimeProtocolSchema,
  threadId: z.string().trim().min(1).max(240).nullable().default(null),
  currentTurnId: z.string().trim().min(1).max(240).nullable().default(null),
  currentTurnState: agentTurnStateSchema.nullable().default(null),
  connectionState: agentRuntimeConnectionStateSchema,
  eventHighWatermark: z.number().int().nonnegative().default(0),
  codexVersion: z.string().trim().min(1).max(120).nullable().default(null),
  protocolVersion: z.string().trim().min(1).max(120).nullable().default(null),
  lastEventAt: isoDatetimeSchema.nullable().default(null),
});

export const agentThreadRecordSchema = agentThreadSummarySchema.extend({
  runId: runIdSchema,
  providerId: providerIdSchema.nullable().default(null),
  providerBindingId: workspaceProviderBindingIdSchema.nullable().default(null),
  model: z.string().trim().min(1).max(240).nullable().default(null),
  runtimeConfigSha256: sha256Schema.nullable().default(null),
  startedAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  stoppedAt: isoDatetimeSchema.nullable().default(null),
});

export const agentRuntimeEventInputSchema = z.object({
  runId: runIdSchema,
  sequence: z.number().int().positive(),
  eventType: z.string().trim().min(1).max(240),
  occurredAt: isoDatetimeSchema,
  threadId: z.string().trim().min(1).max(240).nullable().default(null),
  turnId: z.string().trim().min(1).max(240).nullable().default(null),
  itemId: z.string().trim().min(1).max(240).nullable().default(null),
  sourceRequestId: z.string().trim().min(1).max(240).nullable().default(null),
  payload: z.unknown(),
  payloadSha256: sha256Schema,
});

export const agentRuntimeEventRecordSchema = agentRuntimeEventInputSchema.extend({
  eventId: agentEventIdSchema,
  receivedAt: isoDatetimeSchema,
});

export const agentRuntimeEventBridgeSchema = agentRuntimeEventInputSchema.extend({
  type: z.literal("agent.runtime.event"),
});

export const agentThreadStateBridgeSchema = z.object({
  type: z.literal("agent.thread.state"),
  runId: runIdSchema,
  thread: agentThreadSummarySchema,
  occurredAt: isoDatetimeSchema,
});

export type AgentRuntimeProtocol = z.infer<typeof agentRuntimeProtocolSchema>;
export type AgentRuntimeConnectionState = z.infer<typeof agentRuntimeConnectionStateSchema>;
export type AgentTurnState = z.infer<typeof agentTurnStateSchema>;
export type AgentThreadSummary = z.infer<typeof agentThreadSummarySchema>;
export type AgentThreadRecord = z.infer<typeof agentThreadRecordSchema>;
export type AgentRuntimeEventInput = z.infer<typeof agentRuntimeEventInputSchema>;
export type AgentRuntimeEventRecord = z.infer<typeof agentRuntimeEventRecordSchema>;
