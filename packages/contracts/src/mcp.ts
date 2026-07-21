import { z } from "./zod.js";
import {
  entrySurfaceSchema,
  connectorSourceSchema,
  connectorTransportSchema,
  credentialIdSchema,
  isoDatetimeSchema,
  mcpBindingIdSchema,
  mcpHealthSnapshotIdSchema,
  runIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";

const workspaceContextKeySchema = z.string().trim().min(1).max(120);
const serviceIdSchema = z.string().trim().min(1).max(120);

export const mcpIdSchema = z.string().min(1);
export const mcpStatusSchema = z.enum(["active", "disabled", "deprecated"]);
export const mcpRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const mcpNetworkPolicyRefSchema = z.string().min(1);
export const mcpNetworkProtocolSchema = z.enum(["http", "https", "ws", "wss"]);
export const mcpNetworkPolicyStatusSchema = z.enum(["active", "disabled"]);
export const mcpNetworkPolicyModeSchema = z.enum(["allowlist"]);
export const mcpStdioPolicySchema = z.object({
  refSha256: z.string().trim().regex(/^[a-f0-9]{64}$/i),
});
export const mcpBindingScopeSchema = z.enum([
  "workspace",
  "user",
  "session-version",
  "run",
]);
export const mcpBindingStatusSchema = z.enum([
  "active",
  "disabled",
  "needs-review",
]);
export const mcpCallStatusSchema = z.enum([
  "success",
  "error",
  "cancelled",
  "rejected",
]);
export const mcpHealthStatusSchema = z.enum([
  "healthy",
  "degraded",
  "unhealthy",
  "blocked",
  "unsupported",
]);
export const mcpGovernanceEventActionSchema = z.enum([
  "connector.registered",
  "connector.updated",
  "connector.tested",
  "connector.bound",
  "connector.binding_updated",
  "connector.bound_to_run",
  "external_call.blocked",
]);
export const mcpGovernanceEventOutcomeSchema = z.enum([
  "success",
  "blocked",
  "error",
]);

export const mcpRegistryEntrySchema = z.object({
  mcpId: mcpIdSchema,
  workspaceId: workspaceIdSchema.nullable().default(null),
  displayName: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().default(null),
  source: connectorSourceSchema,
  transport: connectorTransportSchema,
  ref: z.string().min(1),
  stdioPolicy: mcpStdioPolicySchema.nullable().default(null),
  status: mcpStatusSchema,
  riskLevel: mcpRiskLevelSchema,
  defaultCredentialId: credentialIdSchema.nullable().default(null),
  defaultNetworkPolicyRef: z.string().min(1).nullable().default(null),
  approvalRequired: z.boolean().default(false),
  tags: z.array(z.string().min(1)).default([]),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const mcpBindingRecordSchema = z.object({
  bindingId: mcpBindingIdSchema,
  mcpId: mcpIdSchema,
  workspaceId: workspaceIdSchema,
  scope: mcpBindingScopeSchema,
  scopeRef: z.string().min(1),
  credentialId: credentialIdSchema.nullable().default(null),
  status: mcpBindingStatusSchema,
  networkPolicyRef: z.string().min(1).nullable().default(null),
  approvalRequired: z.boolean().default(false),
  autoAttach: z.boolean().default(true),
  notes: z.string().max(2000).nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const listMcpsQuerySchema = z.object({
  source: connectorSourceSchema.optional(),
  status: mcpStatusSchema.optional(),
  q: z.string().trim().optional(),
});

export const createMcpInputSchema = z.object({
  mcpId: mcpIdSchema,
  displayName: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().default(null),
  source: connectorSourceSchema,
  transport: connectorTransportSchema,
  ref: z.string().min(1),
  stdioPolicy: mcpStdioPolicySchema.nullable().default(null),
  status: mcpStatusSchema.default("active"),
  riskLevel: mcpRiskLevelSchema.default("medium"),
  defaultCredentialId: credentialIdSchema.nullable().default(null),
  defaultNetworkPolicyRef: z.string().min(1).nullable().default(null),
  approvalRequired: z.boolean().default(false),
  tags: z.array(z.string().min(1)).default([]),
});

export const updateMcpInputSchema = z
  .object({
    displayName: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    transport: connectorTransportSchema.optional(),
    ref: z.string().min(1).optional(),
    stdioPolicy: mcpStdioPolicySchema.nullable().optional(),
    status: mcpStatusSchema.optional(),
    riskLevel: mcpRiskLevelSchema.optional(),
    defaultCredentialId: credentialIdSchema.nullable().optional(),
    defaultNetworkPolicyRef: z.string().min(1).nullable().optional(),
    approvalRequired: z.boolean().optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one MCP field must be updated"
  );

export const listMcpBindingsQuerySchema = z.object({
  scope: mcpBindingScopeSchema.optional(),
  status: mcpBindingStatusSchema.optional(),
  mcpId: mcpIdSchema.optional(),
});

export const createMcpBindingInputSchema = z.object({
  mcpId: mcpIdSchema,
  scope: mcpBindingScopeSchema,
  scopeRef: z.string().min(1).optional(),
  credentialId: credentialIdSchema.nullable().default(null),
  networkPolicyRef: z.string().min(1).nullable().default(null),
  approvalRequired: z.boolean().default(false),
  autoAttach: z.boolean().default(true),
  notes: z.string().max(2000).nullable().default(null),
});

export const updateMcpBindingInputSchema = z
  .object({
    credentialId: credentialIdSchema.nullable().optional(),
    status: mcpBindingStatusSchema.optional(),
    networkPolicyRef: z.string().min(1).nullable().optional(),
    approvalRequired: z.boolean().optional(),
    autoAttach: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one MCP binding field must be updated"
  );

export const mcpNetworkPolicySchema = z.object({
  policyRef: mcpNetworkPolicyRefSchema,
  workspaceId: workspaceIdSchema.nullable().default(null),
  displayName: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().default(null),
  status: mcpNetworkPolicyStatusSchema,
  mode: mcpNetworkPolicyModeSchema.default("allowlist"),
  allowedProtocols: z.array(mcpNetworkProtocolSchema).min(1),
  allowedHostPatterns: z.array(z.string().trim().min(1).max(255)).min(1),
  allowedPorts: z.array(z.number().int().min(1).max(65535)).max(64).default([]),
  allowedPathPrefixes: z.array(z.string().trim().min(1).max(1024)).max(128).default([]),
  requireTls: z.boolean().default(true),
  blockPrivateNetwork: z.boolean().default(true),
  tags: z.array(z.string().min(1)).default([]),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const listMcpNetworkPoliciesQuerySchema = z.object({
  status: mcpNetworkPolicyStatusSchema.optional(),
  q: z.string().trim().optional(),
});

export const createMcpNetworkPolicyInputSchema = z.object({
  policyRef: mcpNetworkPolicyRefSchema,
  displayName: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().default(null),
  status: mcpNetworkPolicyStatusSchema.default("active"),
  mode: mcpNetworkPolicyModeSchema.default("allowlist"),
  allowedProtocols: z.array(mcpNetworkProtocolSchema).min(1),
  allowedHostPatterns: z.array(z.string().trim().min(1).max(255)).min(1),
  allowedPorts: z.array(z.number().int().min(1).max(65535)).max(64).default([]),
  allowedPathPrefixes: z.array(z.string().trim().min(1).max(1024)).max(128).default([]),
  requireTls: z.boolean().default(true),
  blockPrivateNetwork: z.boolean().default(true),
  tags: z.array(z.string().min(1)).default([]),
});

export const updateMcpNetworkPolicyInputSchema = z
  .object({
    displayName: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: mcpNetworkPolicyStatusSchema.optional(),
    mode: mcpNetworkPolicyModeSchema.optional(),
    allowedProtocols: z.array(mcpNetworkProtocolSchema).min(1).optional(),
    allowedHostPatterns: z.array(z.string().trim().min(1).max(255)).min(1).optional(),
    allowedPorts: z.array(z.number().int().min(1).max(65535)).max(64).optional(),
    allowedPathPrefixes: z.array(z.string().trim().min(1).max(1024)).max(128).optional(),
    requireTls: z.boolean().optional(),
    blockPrivateNetwork: z.boolean().optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one MCP network policy field must be updated"
  );

export const mcpHealthSnapshotSchema = z.object({
  snapshotId: mcpHealthSnapshotIdSchema,
  mcpId: mcpIdSchema,
  bindingId: mcpBindingIdSchema.nullable().default(null),
  workspaceId: workspaceIdSchema,
  requestedByUserId: userIdSchema.nullable().default(null),
  displayName: z.string().min(1).max(160),
  source: connectorSourceSchema,
  transport: connectorTransportSchema,
  ref: z.string().min(1),
  networkPolicyRef: z.string().min(1).nullable().default(null),
  status: mcpHealthStatusSchema,
  detail: z.string().trim().min(1).max(4000).nullable().default(null),
  errorCode: z.string().trim().min(1).max(160).nullable().default(null),
  httpStatus: z.number().int().min(100).max(599).nullable().default(null),
  latencyMs: z.number().int().nonnegative().nullable().default(null),
  toolCount: z.number().int().nonnegative().nullable().default(null),
  toolNames: z.array(z.string().trim().min(1).max(240)).max(500).default([]),
  policyEnforced: z.boolean().default(false),
  probedAt: isoDatetimeSchema,
  recordedAt: isoDatetimeSchema,
});

export const listMcpHealthSnapshotsQuerySchema = z.object({
  mcpId: mcpIdSchema.optional(),
  bindingId: mcpBindingIdSchema.optional(),
  status: mcpHealthStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const probeMcpInputSchema = z.object({
  bindingId: mcpBindingIdSchema.optional(),
});

const mcpGovernanceEventIdSchema = z.string().trim().min(1).max(160);
const boundedNullableReasonCodeSchema = z.string().trim().min(1).max(160).nullable().default(null);
const boundedNullableReasonDetailSchema = z.string().trim().min(1).max(4000).nullable().default(null);
const endpointHashSchema = z.string().trim().regex(/^[a-f0-9]{64}$/i);

export const mcpGovernanceEventSchema = z.object({
  eventId: mcpGovernanceEventIdSchema,
  workspaceId: workspaceIdSchema,
  actorUserId: userIdSchema.nullable().default(null),
  runId: runIdSchema.nullable().default(null),
  mcpId: mcpIdSchema,
  bindingId: mcpBindingIdSchema.nullable().default(null),
  action: mcpGovernanceEventActionSchema,
  outcome: mcpGovernanceEventOutcomeSchema,
  reasonCode: boundedNullableReasonCodeSchema,
  reasonDetail: boundedNullableReasonDetailSchema,
  displayName: z.string().trim().min(1).max(160).nullable().default(null),
  source: connectorSourceSchema.nullable().default(null),
  transport: connectorTransportSchema.nullable().default(null),
  scope: mcpBindingScopeSchema.nullable().default(null),
  scopeRef: z.string().trim().min(1).max(160).nullable().default(null),
  credentialId: credentialIdSchema.nullable().default(null),
  networkPolicyRef: mcpNetworkPolicyRefSchema.nullable().default(null),
  endpointRef: z.string().trim().min(1).max(4000).nullable().default(null),
  endpointHash: endpointHashSchema.nullable().default(null),
  riskLevel: mcpRiskLevelSchema.nullable().default(null),
  approvalRequired: z.boolean().nullable().default(null),
  healthStatus: mcpHealthStatusSchema.nullable().default(null),
  latencyMs: z.number().int().nonnegative().nullable().default(null),
  toolCount: z.number().int().nonnegative().nullable().default(null),
  occurredAt: isoDatetimeSchema,
  recordedAt: isoDatetimeSchema,
});

export const listMcpGovernanceEventsQuerySchema = z.object({
  runId: runIdSchema.optional(),
  mcpId: mcpIdSchema.optional(),
  bindingId: mcpBindingIdSchema.optional(),
  action: mcpGovernanceEventActionSchema.optional(),
  outcome: mcpGovernanceEventOutcomeSchema.optional(),
  from: isoDatetimeSchema.optional(),
  to: isoDatetimeSchema.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const mcpCallIdSchema = z.string().trim().min(1).max(160);
const mcpToolNameSchema = z.string().trim().min(1).max(160);
const boundedNullableSummarySchema = z.string().trim().min(1).max(4000).nullable().default(null);
const boundedNullableIdSchema = z.string().trim().min(1).max(160).nullable().default(null);

export const mcpCallObservationSchema = z.object({
  callId: mcpCallIdSchema.optional(),
  mcpId: mcpIdSchema,
  bindingId: mcpBindingIdSchema.nullable().default(null),
  toolName: mcpToolNameSchema,
  requestId: boundedNullableIdSchema,
  status: mcpCallStatusSchema,
  startedAt: isoDatetimeSchema,
  finishedAt: isoDatetimeSchema,
  durationMs: z.number().int().nonnegative().nullable().default(null),
  inputSummary: boundedNullableSummarySchema,
  outputSummary: boundedNullableSummarySchema,
  errorMessage: boundedNullableSummarySchema,
  inputBytes: z.number().int().nonnegative().nullable().default(null),
  outputBytes: z.number().int().nonnegative().nullable().default(null),
});

export const mcpCallRecordSchema = mcpCallObservationSchema.extend({
  callId: mcpCallIdSchema,
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  requestedByUserId: userIdSchema.nullable().default(null),
  workspaceContextKey: workspaceContextKeySchema.nullable().default(null),
  serviceId: serviceIdSchema.nullable().default(null),
  taskVersionId: taskVersionIdSchema.nullable().default(null),
  sessionVersionId: sessionVersionIdSchema.nullable().default(null),
  entrySurface: entrySurfaceSchema.nullable().default(null),
  displayName: z.string().min(1).max(160),
  source: connectorSourceSchema,
  transport: connectorTransportSchema,
  ref: z.string().min(1),
  riskLevel: mcpRiskLevelSchema,
  networkPolicyRef: z.string().min(1).nullable().default(null),
  approvalRequired: z.boolean().default(false),
  occurredAt: isoDatetimeSchema,
  recordedAt: isoDatetimeSchema,
});

export const listMcpCallsQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  serviceId: serviceIdSchema.optional(),
  runId: runIdSchema.optional(),
  mcpId: mcpIdSchema.optional(),
  toolName: mcpToolNameSchema.optional(),
  status: mcpCallStatusSchema.optional(),
  from: isoDatetimeSchema.optional(),
  to: isoDatetimeSchema.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export type McpId = z.infer<typeof mcpIdSchema>;
export type McpStatus = z.infer<typeof mcpStatusSchema>;
export type McpRiskLevel = z.infer<typeof mcpRiskLevelSchema>;
export type McpNetworkPolicyRef = z.infer<typeof mcpNetworkPolicyRefSchema>;
export type McpNetworkProtocol = z.infer<typeof mcpNetworkProtocolSchema>;
export type McpNetworkPolicyStatus = z.infer<typeof mcpNetworkPolicyStatusSchema>;
export type McpNetworkPolicyMode = z.infer<typeof mcpNetworkPolicyModeSchema>;
export type McpStdioPolicy = z.infer<typeof mcpStdioPolicySchema>;
export type McpBindingScope = z.infer<typeof mcpBindingScopeSchema>;
export type McpBindingStatus = z.infer<typeof mcpBindingStatusSchema>;
export type McpCallStatus = z.infer<typeof mcpCallStatusSchema>;
export type McpHealthStatus = z.infer<typeof mcpHealthStatusSchema>;
export type McpGovernanceEventAction = z.infer<typeof mcpGovernanceEventActionSchema>;
export type McpGovernanceEventOutcome = z.infer<typeof mcpGovernanceEventOutcomeSchema>;
export type McpRegistryEntry = z.infer<typeof mcpRegistryEntrySchema>;
export type McpBindingRecord = z.infer<typeof mcpBindingRecordSchema>;
export type ListMcpsQuery = z.infer<typeof listMcpsQuerySchema>;
export type CreateMcpInput = z.infer<typeof createMcpInputSchema>;
export type UpdateMcpInput = z.infer<typeof updateMcpInputSchema>;
export type ListMcpBindingsQuery = z.infer<typeof listMcpBindingsQuerySchema>;
export type CreateMcpBindingInput = z.infer<typeof createMcpBindingInputSchema>;
export type UpdateMcpBindingInput = z.infer<typeof updateMcpBindingInputSchema>;
export type McpNetworkPolicy = z.infer<typeof mcpNetworkPolicySchema>;
export type ListMcpNetworkPoliciesQuery = z.infer<typeof listMcpNetworkPoliciesQuerySchema>;
export type CreateMcpNetworkPolicyInput = z.infer<typeof createMcpNetworkPolicyInputSchema>;
export type UpdateMcpNetworkPolicyInput = z.infer<typeof updateMcpNetworkPolicyInputSchema>;
export type McpHealthSnapshot = z.infer<typeof mcpHealthSnapshotSchema>;
export type ListMcpHealthSnapshotsQuery = z.infer<typeof listMcpHealthSnapshotsQuerySchema>;
export type ProbeMcpInput = z.infer<typeof probeMcpInputSchema>;
export type McpGovernanceEvent = z.infer<typeof mcpGovernanceEventSchema>;
export type ListMcpGovernanceEventsQuery = z.infer<typeof listMcpGovernanceEventsQuerySchema>;
export type McpCallObservation = z.infer<typeof mcpCallObservationSchema>;
export type McpCallRecord = z.infer<typeof mcpCallRecordSchema>;
export type ListMcpCallsQuery = z.infer<typeof listMcpCallsQuerySchema>;
