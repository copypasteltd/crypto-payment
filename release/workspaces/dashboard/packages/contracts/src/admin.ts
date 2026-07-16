import { z } from "zod";
import { isoDatetimeSchema, userIdSchema } from "./common.js";

export const adminResourceTypeSchema = z.enum([
  "user",
  "workspace",
  "workshop",
  "session",
  "run",
  "provider",
  "mcp",
  "credential",
  "quota",
  "runtime",
  "system",
  "admin-account",
]);

export const adminResourceStatusSchema = z.enum([
  "active",
  "suspended",
  "hidden",
  "archived",
  "quarantined",
  "disabled",
  "revoked",
  "draining",
]);

export const adminActionSchema = z.enum([
  "suspend",
  "resume",
  "force-logout",
  "list",
  "unlist",
  "archive",
  "quarantine",
  "release",
  "cancel",
  "retry",
  "terminate",
  "enable",
  "disable",
  "revoke",
  "drain",
  "restore",
  "update",
]);

export const adminOperationOutcomeSchema = z.enum([
  "success",
  "failed",
  "partial",
  "rejected",
]);

export const adminResourceStateSchema = z.object({
  resourceType: adminResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(240),
  status: adminResourceStatusSchema,
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(2000),
  updatedByUserId: userIdSchema.nullable(),
  updatedAt: isoDatetimeSchema,
});

export const adminAuditEventSchema = z.object({
  eventId: z.string().trim().min(1).max(240),
  actorUserId: userIdSchema.nullable(),
  actorEmail: z.string().email().nullable(),
  action: z.string().trim().min(1).max(160),
  resourceType: adminResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(240),
  workspaceId: z.string().trim().min(1).max(160).nullable(),
  reason: z.string().trim().min(1).max(2000).nullable(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  outcome: adminOperationOutcomeSchema,
  requestId: z.string().trim().min(1).max(240).nullable(),
  traceId: z.string().trim().min(1).max(240).nullable(),
  operationId: z.string().trim().min(1).max(240).nullable(),
  errorCode: z.string().trim().min(1).max(160).nullable(),
  errorMessage: z.string().trim().min(1).max(2000).nullable(),
  sourceIp: z.string().trim().min(1).max(160).nullable(),
  userAgent: z.string().trim().min(1).max(1000).nullable(),
  clientRelease: z.string().trim().min(1).max(160).nullable(),
  occurredAt: isoDatetimeSchema,
});

export const adminSettingRecordSchema = z.object({
  key: z.string().trim().min(1).max(160),
  value: z.record(z.string(), z.unknown()),
  version: z.number().int().positive(),
  updatedByUserId: userIdSchema.nullable(),
  updatedAt: isoDatetimeSchema,
});

export const adminImpactOperationSchema = z.object({
  operationId: z.string().trim().min(1).max(240),
  resourceType: adminResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(240),
  action: adminActionSchema,
  impactHash: z.string().regex(/^[a-f0-9]{64}$/),
  impact: z.record(z.string(), z.unknown()),
  confirmationPhrase: z.string().trim().min(1).max(160),
  requestedByUserId: userIdSchema.nullable(),
  createdAt: isoDatetimeSchema,
  expiresAt: isoDatetimeSchema,
  consumedAt: isoDatetimeSchema.nullable(),
});

export const adminListQuerySchema = z.object({
  q: z.string().trim().max(240).optional(),
  status: z.string().trim().max(120).optional(),
  workspaceId: z.string().trim().max(160).optional(),
  from: isoDatetimeSchema.optional(),
  to: isoDatetimeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  sort: z.string().trim().max(120).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export const adminImpactRequestSchema = z.object({
  resourceType: adminResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(240),
  action: adminActionSchema,
});

export const adminExecuteActionInputSchema = z.object({
  operationId: z.string().trim().min(1).max(240),
  impactHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirmation: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(8).max(2000),
  expectedVersion: z.number().int().positive().nullable().default(null),
});

export const adminBootstrapSchema = z.object({
  user: z.object({
    userId: userIdSchema,
    email: z.string().email(),
    displayName: z.string().min(1),
  }),
  role: z.literal("platform_admin"),
  session: z.object({
    sessionId: z.string().min(1),
    accessTokenExpiresAt: isoDatetimeSchema,
    refreshTokenExpiresAt: isoDatetimeSchema,
  }),
  csrfToken: z.string().min(16),
  system: z.object({
    status: z.enum(["ready", "degraded", "not_ready"]),
    release: z.string().min(1),
    checkedAt: isoDatetimeSchema,
  }),
});

export const adminStateSchema = z.object({
  resourceStates: z.array(adminResourceStateSchema).default([]),
  auditEvents: z.array(adminAuditEventSchema).default([]),
  settings: z.array(adminSettingRecordSchema).default([]),
  operations: z.array(adminImpactOperationSchema).default([]),
});

export type AdminResourceType = z.infer<typeof adminResourceTypeSchema>;
export type AdminResourceStatus = z.infer<typeof adminResourceStatusSchema>;
export type AdminAction = z.infer<typeof adminActionSchema>;
export type AdminOperationOutcome = z.infer<typeof adminOperationOutcomeSchema>;
export type AdminResourceState = z.infer<typeof adminResourceStateSchema>;
export type AdminAuditEvent = z.infer<typeof adminAuditEventSchema>;
export type AdminSettingRecord = z.infer<typeof adminSettingRecordSchema>;
export type AdminImpactOperation = z.infer<typeof adminImpactOperationSchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type AdminImpactRequest = z.infer<typeof adminImpactRequestSchema>;
export type AdminExecuteActionInput = z.infer<typeof adminExecuteActionInputSchema>;
export type AdminBootstrap = z.infer<typeof adminBootstrapSchema>;
export type AdminState = z.infer<typeof adminStateSchema>;
