import { z } from "./zod.js";
import {
  isoDatetimeSchema,
  runIdSchema,
  sessionCaptureAccessAuditIdSchema,
  sessionCaptureIdSchema,
  sessionIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");

export const sessionCaptureModeSchema = z.enum(["terminal", "checkpoint"]);
export const sessionCaptureStatusSchema = z.enum([
  "REQUESTED",
  "WAITING_BARRIER",
  "CAPTURING_EVENTS",
  "CAPTURING_WORKSPACE",
  "UPLOADING",
  "VERIFYING",
  "CAPTURED",
  "RETRY_WAIT",
  "FAILED",
  "CANCELLED",
]);
export const sessionCaptureSecurityStateSchema = z.enum(["pending", "clean", "quarantined", "blocked"]);
export const sessionCaptureObjectTypeSchema = z.enum([
  "raw_events",
  "thread",
  "workspace",
  "inventory",
  "manifest",
]);

export const sessionCaptureWorkspaceSelectionSchema = z.object({
  targetPath: z.string().trim().min(1).max(1024),
  includeGlobs: z.array(z.string().trim().min(1).max(512)).min(1).default(["**/*"]),
  excludeGlobs: z.array(z.string().trim().min(1).max(512)).default([
    ".git/**",
    "**/node_modules/**",
    "**/.env",
    "**/.env.*",
    "**/secrets/**",
    "**/codex-home/**",
    "**/tmp/**",
    "**/.cache/**",
  ]),
  includeArtifacts: z.boolean().default(true),
  maxFiles: z.number().int().positive().max(1_000_000).default(100_000),
  maxBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).default(5 * 1024 * 1024 * 1024),
});

export const sessionCaptureBoundarySchema = z.object({
  threadId: z.string().trim().min(1).max(240),
  throughTurnId: z.string().trim().min(1).max(240),
  eventHighWatermark: z.number().int().nonnegative(),
  barrierReachedAt: isoDatetimeSchema,
});

export const createSessionCaptureInputSchema = z.object({
  mode: sessionCaptureModeSchema,
  throughTurnId: z.string().trim().min(1).max(240).nullable().default(null),
  workspaceSelection: sessionCaptureWorkspaceSelectionSchema,
  destinationSessionId: sessionIdSchema.nullable().default(null),
  createDraft: z.boolean().default(true),
  idempotencyKey: z.string().trim().min(8).max(240),
});

export const sessionCaptureObjectSchema = z.object({
  objectType: sessionCaptureObjectTypeSchema,
  objectKey: z.string().trim().min(1).max(1024),
  sha256: sha256Schema,
  sizeBytes: z.number().int().nonnegative(),
  contentType: z.string().trim().min(1).max(160),
});

export const sessionCaptureRecordSchema = z.object({
  captureId: sessionCaptureIdSchema,
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  requestedByUserId: userIdSchema.nullable().default(null),
  mode: sessionCaptureModeSchema,
  requestedThroughTurnId: z.string().trim().min(1).max(240).nullable().default(null),
  status: sessionCaptureStatusSchema,
  statusReason: z.string().trim().min(1).max(4000).nullable().default(null),
  errorCode: z.string().trim().min(1).max(160).nullable().default(null),
  diagnosticId: z.string().trim().min(1).max(240).nullable().default(null),
  workspaceSelection: sessionCaptureWorkspaceSelectionSchema,
  boundary: sessionCaptureBoundarySchema.nullable().default(null),
  destinationSessionId: sessionIdSchema.nullable().default(null),
  createDraft: z.boolean().default(true),
  securityState: sessionCaptureSecurityStateSchema.default("pending"),
  objects: z.array(sessionCaptureObjectSchema).default([]),
  captureManifestSha256: sha256Schema.nullable().default(null),
  eventCount: z.number().int().nonnegative().default(0),
  messageCount: z.number().int().nonnegative().default(0),
  toolEventCount: z.number().int().nonnegative().default(0),
  fileCount: z.number().int().nonnegative().default(0),
  artifactCount: z.number().int().nonnegative().default(0),
  capturedBytes: z.number().int().nonnegative().default(0),
  leaseGeneration: z.number().int().nonnegative().default(0),
  leaseOwner: z.string().trim().min(1).max(240).nullable().default(null),
  leaseExpiresAt: isoDatetimeSchema.nullable().default(null),
  attemptCount: z.number().int().nonnegative().default(0),
  nextRetryAt: isoDatetimeSchema.nullable().default(null),
  version: z.number().int().positive().default(1),
  requestedAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  capturedAt: isoDatetimeSchema.nullable().default(null),
});

export const sessionCaptureSummarySchema = sessionCaptureRecordSchema.pick({
  captureId: true,
  mode: true,
  status: true,
  statusReason: true,
  errorCode: true,
  securityState: true,
  eventCount: true,
  fileCount: true,
  capturedBytes: true,
  requestedAt: true,
  updatedAt: true,
  capturedAt: true,
});

export const createSessionCaptureResponseSchema = z.object({
  capture: sessionCaptureRecordSchema,
  statusUrl: z.string().trim().min(1),
});
export const listSessionCapturesResponseSchema = z.object({
  items: z.array(sessionCaptureRecordSchema),
});

export const requestSessionCaptureObjectDownloadSchema = z.object({
  reason: z.string().trim().min(8).max(2000),
});
export const sessionCaptureObjectAccessAuditSchema = z.object({
  auditId: sessionCaptureAccessAuditIdSchema,
  captureId: sessionCaptureIdSchema,
  workspaceId: workspaceIdSchema,
  objectType: sessionCaptureObjectTypeSchema,
  objectSha256: sha256Schema,
  actorUserId: userIdSchema,
  reason: z.string().trim().min(8).max(2000),
  accessMode: z.enum(["proxy", "signed-url"]),
  requestedAt: isoDatetimeSchema,
  expiresAt: isoDatetimeSchema.nullable().default(null),
});
export const sessionCaptureObjectDownloadResponseSchema = z.object({
  audit: sessionCaptureObjectAccessAuditSchema,
  downloadUrl: z.string().url().nullable(),
  expiresAt: isoDatetimeSchema.nullable(),
});
export const listSessionCaptureObjectAccessAuditResponseSchema = z.object({
  items: z.array(sessionCaptureObjectAccessAuditSchema),
});

export const sessionCaptureCleanupGateSchema = z.object({
  runId: runIdSchema,
  allowed: z.boolean(),
  blockingCaptureIds: z.array(sessionCaptureIdSchema).default([]),
  evaluatedAt: isoDatetimeSchema,
});

export const acquireSessionCaptureLeaseInputSchema = z.object({
  workerId: z.string().trim().min(1).max(240),
  leaseSeconds: z.number().int().positive().max(3600).default(120),
});
export const sessionCaptureLeaseSchema = z.object({
  captureId: sessionCaptureIdSchema,
  runId: runIdSchema,
  workerId: z.string().trim().min(1).max(240),
  leaseGeneration: z.number().int().positive(),
  leaseExpiresAt: isoDatetimeSchema,
  workspaceSelection: sessionCaptureWorkspaceSelectionSchema,
  requestedBoundaryTurnId: z.string().trim().min(1).max(240).nullable().default(null),
});
export const submitSessionCaptureBarrierInputSchema = z.object({
  workerId: z.string().trim().min(1).max(240),
  leaseGeneration: z.number().int().positive(),
  boundary: sessionCaptureBoundarySchema,
});
export const heartbeatSessionCaptureInputSchema = z.object({
  workerId: z.string().trim().min(1).max(240),
  leaseGeneration: z.number().int().positive(),
  stage: sessionCaptureStatusSchema,
  capturedBytes: z.number().int().nonnegative().default(0),
});
export const completeSessionCaptureInputSchema = z.object({
  workerId: z.string().trim().min(1).max(240),
  leaseGeneration: z.number().int().positive(),
  boundary: sessionCaptureBoundarySchema,
  objects: z.array(sessionCaptureObjectSchema).min(5),
  captureManifestSha256: sha256Schema,
  eventCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  toolEventCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  artifactCount: z.number().int().nonnegative(),
  capturedAt: isoDatetimeSchema,
});
export const failSessionCaptureInputSchema = z.object({
  workerId: z.string().trim().min(1).max(240),
  leaseGeneration: z.number().int().positive(),
  errorCode: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(4000),
  retryable: z.boolean(),
  diagnosticId: z.string().trim().min(1).max(240).nullable().default(null),
});

export type SessionCaptureMode = z.infer<typeof sessionCaptureModeSchema>;
export type SessionCaptureStatus = z.infer<typeof sessionCaptureStatusSchema>;
export type SessionCaptureSecurityState = z.infer<typeof sessionCaptureSecurityStateSchema>;
export type SessionCaptureWorkspaceSelection = z.infer<typeof sessionCaptureWorkspaceSelectionSchema>;
export type SessionCaptureBoundary = z.infer<typeof sessionCaptureBoundarySchema>;
export type CreateSessionCaptureInput = z.infer<typeof createSessionCaptureInputSchema>;
export type SessionCaptureObject = z.infer<typeof sessionCaptureObjectSchema>;
export type SessionCaptureRecord = z.infer<typeof sessionCaptureRecordSchema>;
export type SessionCaptureSummary = z.infer<typeof sessionCaptureSummarySchema>;
export type CreateSessionCaptureResponse = z.infer<typeof createSessionCaptureResponseSchema>;
export type ListSessionCapturesResponse = z.infer<typeof listSessionCapturesResponseSchema>;
export type RequestSessionCaptureObjectDownload = z.infer<
  typeof requestSessionCaptureObjectDownloadSchema
>;
export type SessionCaptureObjectAccessAudit = z.infer<
  typeof sessionCaptureObjectAccessAuditSchema
>;
export type SessionCaptureObjectDownloadResponse = z.infer<
  typeof sessionCaptureObjectDownloadResponseSchema
>;
export type ListSessionCaptureObjectAccessAuditResponse = z.infer<
  typeof listSessionCaptureObjectAccessAuditResponseSchema
>;
export type SessionCaptureLease = z.infer<typeof sessionCaptureLeaseSchema>;
export type SessionCaptureCleanupGate = z.infer<typeof sessionCaptureCleanupGateSchema>;
export type AcquireSessionCaptureLeaseInput = z.infer<
  typeof acquireSessionCaptureLeaseInputSchema
>;
export type SubmitSessionCaptureBarrierInput = z.infer<
  typeof submitSessionCaptureBarrierInputSchema
>;
export type HeartbeatSessionCaptureInput = z.infer<
  typeof heartbeatSessionCaptureInputSchema
>;
export type CompleteSessionCaptureInput = z.infer<
  typeof completeSessionCaptureInputSchema
>;
export type FailSessionCaptureInput = z.infer<typeof failSessionCaptureInputSchema>;
