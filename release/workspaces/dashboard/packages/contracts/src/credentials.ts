import { z } from "zod";
import {
  credentialIdSchema,
  credentialMountModeSchema,
  entrySurfaceSchema,
  isoDatetimeSchema,
  mcpBindingIdSchema,
  runIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";
import { localizedTextSchema, serviceIdSchema, workshopIdSchema, workspaceContextKeySchema } from "./catalog.js";
import {
  mcpBindingScopeSchema,
  mcpBindingStatusSchema,
  mcpIdSchema,
} from "./mcp.js";
import { runStatusSchema } from "./runs.js";

export const credentialScopeSchema = z.enum(["user", "workspace"]);
export const credentialStatusSchema = z.enum([
  "active",
  "needs-rotation",
  "disabled",
  "revoked",
]);
export const credentialSecretKindSchema = z.enum([
  "api-key",
  "access-token",
  "oauth-token",
  "json-file",
  "browser-storage-state",
  "session-cookie",
]);
export const credentialBrokerKindSchema = z.enum([
  "local-envelope",
  "vault-transit-http",
  "aws-kms-envelope",
]);
export const localEnvelopeSecretEnvelopeSchema = z.object({
  version: z.literal(1),
  brokerKind: z.literal("local-envelope"),
  algorithm: z.literal("aes-256-gcm"),
  keyId: z.string().min(1),
  ivBase64: z.string().min(1),
  authTagBase64: z.string().min(1),
  ciphertextBase64: z.string().min(1),
});
export const vaultTransitSecretEnvelopeSchema = z.object({
  version: z.literal(1),
  brokerKind: z.literal("vault-transit-http"),
  algorithm: z.literal("vault-transit"),
  keyId: z.string().min(1),
  ciphertext: z.string().min(1),
});
export const awsKmsEnvelopeSecretEnvelopeSchema = z.object({
  version: z.literal(1),
  brokerKind: z.literal("aws-kms-envelope"),
  algorithm: z.literal("aes-256-gcm"),
  keyId: z.string().min(1),
  kmsKeyId: z.string().min(1),
  kmsRegion: z.string().min(1),
  encryptedDataKeyBase64: z.string().min(1),
  ivBase64: z.string().min(1),
  authTagBase64: z.string().min(1),
  ciphertextBase64: z.string().min(1),
});
export const credentialSecretEnvelopeSchema = z.discriminatedUnion("brokerKind", [
  localEnvelopeSecretEnvelopeSchema,
  vaultTransitSecretEnvelopeSchema,
  awsKmsEnvelopeSecretEnvelopeSchema,
]);

export const credentialSummarySchema = z.object({
  credentialId: credentialIdSchema,
  workspaceId: workspaceIdSchema,
  ownerUserId: userIdSchema.nullable().default(null),
  scope: credentialScopeSchema,
  displayName: z.string().min(1).max(120),
  provider: z.string().min(1).max(120),
  secretKind: credentialSecretKindSchema,
  mountMode: credentialMountModeSchema,
  status: credentialStatusSchema,
  brokerKind: credentialBrokerKindSchema.nullable().default(null),
  activeKeyId: z.string().min(1).nullable().default(null),
  secretVersion: z.number().int().positive().default(1),
  redactedSecretRef: z.string().min(1).nullable().default(null),
  expiresAt: isoDatetimeSchema.nullable().default(null),
  lastRotatedAt: isoDatetimeSchema.nullable().default(null),
  lastMaterializedAt: isoDatetimeSchema.nullable().default(null),
  rotationDueAt: isoDatetimeSchema.nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const credentialDetailSchema = credentialSummarySchema.extend({
  envName: z.string().min(1).nullable().default(null),
  mountPathTemplate: z.string().min(1).nullable().default(null),
});

export const listCredentialsQuerySchema = z.object({
  scope: credentialScopeSchema.optional(),
  status: credentialStatusSchema.optional(),
  q: z.string().trim().optional(),
});

export const createCredentialInputSchema = z.object({
  scope: credentialScopeSchema,
  displayName: z.string().min(1).max(120),
  provider: z.string().min(1).max(120),
  secretKind: credentialSecretKindSchema,
  mountMode: credentialMountModeSchema.optional(),
  secretValue: z.string().min(1),
  secretRef: z.string().min(1).nullable().default(null),
  envName: z.string().min(1).optional(),
  mountPathTemplate: z.string().min(1).optional(),
  expiresAt: isoDatetimeSchema.nullable().default(null),
  rotationDueAt: isoDatetimeSchema.nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
});

export const updateCredentialInputSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    provider: z.string().min(1).max(120).optional(),
    secretKind: credentialSecretKindSchema.optional(),
    mountMode: credentialMountModeSchema.optional(),
    status: credentialStatusSchema.optional(),
    envName: z.string().min(1).nullable().optional(),
    mountPathTemplate: z.string().min(1).nullable().optional(),
    expiresAt: isoDatetimeSchema.nullable().optional(),
    rotationDueAt: isoDatetimeSchema.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one credential field must be updated"
  );

export const rotateCredentialInputSchema = z.object({
  secretValue: z.string().min(1),
  secretRef: z.string().min(1).nullable().default(null),
  expiresAt: isoDatetimeSchema.nullable().optional(),
  rotationDueAt: isoDatetimeSchema.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

export const credentialUsageRunSchema = z.object({
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  requestedByUserId: userIdSchema.nullable().default(null),
  title: z.string().min(1),
  status: runStatusSchema,
  targetPath: z.string().min(1),
  taskVersionId: taskVersionIdSchema,
  sessionVersionId: sessionVersionIdSchema,
  entrySurface: entrySurfaceSchema,
  workspaceContextKey: workspaceContextKeySchema.nullable().default(null),
  workshopId: workshopIdSchema.nullable().default(null),
  workshopName: localizedTextSchema.nullable().default(null),
  serviceId: serviceIdSchema.nullable().default(null),
  serviceName: localizedTextSchema.nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  usesDirectMount: z.boolean(),
  usesMcpBinding: z.boolean(),
});

export const credentialUsageBindingSchema = z.object({
  bindingId: mcpBindingIdSchema,
  mcpId: mcpIdSchema,
  mcpDisplayName: z.string().min(1).max(160).nullable().default(null),
  scope: mcpBindingScopeSchema,
  scopeRef: z.string().min(1),
  status: mcpBindingStatusSchema,
  approvalRequired: z.boolean().default(false),
  autoAttach: z.boolean().default(true),
  networkPolicyRef: z.string().min(1).nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const credentialUsageSummarySchema = z.object({
  credentialId: credentialIdSchema,
  status: credentialStatusSchema,
  totalRunCount: z.number().int().nonnegative(),
  activeRunCount: z.number().int().nonnegative(),
  bindingCount: z.number().int().nonnegative(),
  lastMaterializedAt: isoDatetimeSchema.nullable().default(null),
  lastRotatedAt: isoDatetimeSchema.nullable().default(null),
});

export const credentialUsageResponseSchema = z.object({
  summary: credentialUsageSummarySchema,
  activeRuns: z.array(credentialUsageRunSchema).default([]),
  recentRuns: z.array(credentialUsageRunSchema).default([]),
  bindings: z.array(credentialUsageBindingSchema).default([]),
});

export const credentialLifecycleImpactActionSchema = z.enum([
  "block",
  "allow-active-runs",
  "cancel-active-runs",
]);

export const changeCredentialLifecycleInputSchema = z.object({
  note: z.string().max(2000).nullable().optional(),
  impactAction: credentialLifecycleImpactActionSchema.optional().default("block"),
});

export const credentialLifecycleChangeResultSchema = z.object({
  credential: credentialDetailSchema,
  activeRunCount: z.number().int().nonnegative(),
  activeRuns: z.array(credentialUsageRunSchema).default([]),
  cancelledRunIds: z.array(runIdSchema).default([]),
});

export const credentialAuditEventActionSchema = z.enum([
  "created",
  "updated",
  "rotated",
  "status-changed",
  "lifecycle-callback-sent",
  "lifecycle-callback-failed",
  "auto-disabled-expired",
  "auto-needs-rotation",
  "materialized",
  "materialization-denied",
]);

export const credentialAuditEventOutcomeSchema = z.enum(["success", "blocked"]);

export const credentialAuditEventSchema = z.object({
  eventId: z.string().min(1),
  credentialId: credentialIdSchema,
  workspaceId: workspaceIdSchema,
  actorUserId: userIdSchema.nullable().default(null),
  runId: runIdSchema.nullable().default(null),
  leaseId: z.string().min(1).nullable().default(null),
  action: credentialAuditEventActionSchema,
  outcome: credentialAuditEventOutcomeSchema,
  statusBefore: credentialStatusSchema.nullable().default(null),
  statusAfter: credentialStatusSchema.nullable().default(null),
  secretVersion: z.number().int().positive().nullable().default(null),
  mountMode: credentialMountModeSchema.nullable().default(null),
  reasonCode: z.string().min(1).nullable().default(null),
  reasonDetail: z.string().max(2000).nullable().default(null),
  traceId: z.string().min(1).nullable().default(null),
  occurredAt: isoDatetimeSchema,
});

export const listCredentialAuditEventsQuerySchema = z.object({
  action: credentialAuditEventActionSchema.optional(),
  outcome: credentialAuditEventOutcomeSchema.optional(),
  runId: runIdSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const credentialMaterializationLeaseSchema = z.object({
  leaseId: z.string().min(1),
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  requestedByUserId: userIdSchema.nullable().default(null),
  brokerKind: credentialBrokerKindSchema.nullable().default(null),
  brokerKindByCredentialId: z.record(
    z.string().min(1),
    credentialBrokerKindSchema
  ),
  credentialIds: z.array(credentialIdSchema).default([]),
  secretVersionByCredentialId: z.record(z.string().min(1), z.number().int().positive()),
  issuedAt: isoDatetimeSchema,
  expiresAt: isoDatetimeSchema,
});

export const materializeRunCredentialsResponseSchema = z.object({
  lease: credentialMaterializationLeaseSchema,
  secrets: z.record(z.string().min(1), z.string()),
});

export type CredentialScope = z.infer<typeof credentialScopeSchema>;
export type CredentialStatus = z.infer<typeof credentialStatusSchema>;
export type CredentialSecretKind = z.infer<typeof credentialSecretKindSchema>;
export type CredentialBrokerKind = z.infer<typeof credentialBrokerKindSchema>;
export type CredentialSecretEnvelope = z.infer<typeof credentialSecretEnvelopeSchema>;
export type CredentialSummary = z.infer<typeof credentialSummarySchema>;
export type CredentialDetail = z.infer<typeof credentialDetailSchema>;
export type ListCredentialsQuery = z.infer<typeof listCredentialsQuerySchema>;
export type CreateCredentialInput = z.infer<typeof createCredentialInputSchema>;
export type UpdateCredentialInput = z.infer<typeof updateCredentialInputSchema>;
export type RotateCredentialInput = z.infer<typeof rotateCredentialInputSchema>;
export type CredentialUsageRun = z.infer<typeof credentialUsageRunSchema>;
export type CredentialUsageBinding = z.infer<typeof credentialUsageBindingSchema>;
export type CredentialUsageSummary = z.infer<typeof credentialUsageSummarySchema>;
export type CredentialUsageResponse = z.infer<typeof credentialUsageResponseSchema>;
export type CredentialLifecycleImpactAction = z.infer<
  typeof credentialLifecycleImpactActionSchema
>;
export type ChangeCredentialLifecycleInput = z.input<
  typeof changeCredentialLifecycleInputSchema
>;
export type CredentialLifecycleChangeResult = z.infer<
  typeof credentialLifecycleChangeResultSchema
>;
export type CredentialAuditEventAction = z.infer<
  typeof credentialAuditEventActionSchema
>;
export type CredentialAuditEventOutcome = z.infer<
  typeof credentialAuditEventOutcomeSchema
>;
export type CredentialAuditEvent = z.infer<typeof credentialAuditEventSchema>;
export type ListCredentialAuditEventsQuery = z.infer<
  typeof listCredentialAuditEventsQuerySchema
>;
export type CredentialMaterializationLease = z.infer<typeof credentialMaterializationLeaseSchema>;
export type MaterializeRunCredentialsResponse = z.infer<
  typeof materializeRunCredentialsResponseSchema
>;
