import { z } from "./zod.js";
import {
  isoDatetimeSchema,
  sessionCaptureIdSchema,
  sessionDraftIdSchema,
  sessionDraftRevisionIdSchema,
  sessionIdSchema,
  sessionReplayIdSchema,
  sessionVersionIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";
import { sessionCaptureWorkspaceSelectionSchema } from "./session-captures.js";
import { sessionPackRedactionRuleInputSchema } from "./sessions.js";
import { sealedSessionVersionRecordSchema } from "./session-versions.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");

export const sessionAssetStatusSchema = z.enum(["active", "archived"]);
export const sessionDraftStatusSchema = z.enum([
  "editing",
  "redaction_pending",
  "review_pending",
  "ready_to_seal",
  "sealed",
  "discarded",
]);

export const sessionAssetRecordSchema = z.object({
  sessionId: sessionIdSchema,
  workspaceId: workspaceIdSchema,
  name: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).default(""),
  taskFamily: z.string().trim().min(1).max(240).nullable().default(null),
  status: sessionAssetStatusSchema,
  createdByUserId: userIdSchema.nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const sessionDraftRecordSchema = z.object({
  draftId: sessionDraftIdSchema,
  sessionId: sessionIdSchema,
  sourceCaptureId: sessionCaptureIdSchema,
  parentSessionVersionId: sessionVersionIdSchema.nullable().default(null),
  status: sessionDraftStatusSchema,
  currentRevisionId: sessionDraftRevisionIdSchema.nullable().default(null),
  createdByUserId: userIdSchema.nullable().default(null),
  version: z.number().int().positive().default(1),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const sessionDraftRevisionSchema = z.object({
  revisionId: sessionDraftRevisionIdSchema,
  draftId: sessionDraftIdSchema,
  revisionNumber: z.number().int().positive(),
  inputFingerprint: sha256Schema,
  workspaceSelection: sessionCaptureWorkspaceSelectionSchema,
  redactionRules: z.array(sessionPackRedactionRuleInputSchema).default([]),
  candidateObjectKey: z.string().trim().min(1).max(1024),
  candidateSha256: sha256Schema,
  candidateSizeBytes: z.number().int().nonnegative(),
  validationReport: z.record(z.string(), z.unknown()).default({}),
  securityReport: z.record(z.string(), z.unknown()).default({}),
  createdByUserId: userIdSchema.nullable().default(null),
  createdAt: isoDatetimeSchema,
});

export const createSessionDraftInputSchema = z.object({
  sessionId: sessionIdSchema.nullable().default(null),
  sessionName: z.string().trim().min(1).max(240).nullable().default(null),
  sessionDescription: z.string().trim().max(4000).default(""),
  taskFamily: z.string().trim().min(1).max(240).nullable().default(null),
  parentSessionVersionId: sessionVersionIdSchema.nullable().default(null),
  idempotencyKey: z.string().trim().min(8).max(240),
});

export const createSessionDraftRevisionInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  workspaceSelection: sessionCaptureWorkspaceSelectionSchema,
  redactionRules: z.array(sessionPackRedactionRuleInputSchema).default([]),
});

export const sessionRedactionReviewDecisionSchema = z.enum(["approved", "changes_requested"]);
export const sessionRedactionReviewRecordSchema = z.object({
  reviewId: z.string().trim().min(1),
  draftId: sessionDraftIdSchema,
  revisionId: sessionDraftRevisionIdSchema,
  decision: sessionRedactionReviewDecisionSchema,
  note: z.string().trim().min(1).max(4000).nullable().default(null),
  reviewedByUserId: userIdSchema.nullable().default(null),
  reviewedAt: isoDatetimeSchema,
});
export const submitSessionRedactionReviewInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  revisionId: sessionDraftRevisionIdSchema,
  decision: sessionRedactionReviewDecisionSchema,
  note: z.string().trim().min(1).max(4000).nullable().default(null),
});

export const sessionDraftReplayStatusSchema = z.enum(["passed", "failed"]);
export const sessionDraftReplayCheckStatusSchema = z.enum(["passed", "failed"]);
export const sessionDraftReplayCheckSchema = z.object({
  checkId: z.string().trim().min(1).max(120),
  status: sessionDraftReplayCheckStatusSchema,
  detail: z.string().trim().min(1).max(4000),
  expected: z.unknown().nullable().default(null),
  actual: z.unknown().nullable().default(null),
});
export const sessionDraftReplayRecordSchema = z.object({
  replayId: sessionReplayIdSchema,
  draftId: sessionDraftIdSchema,
  revisionId: sessionDraftRevisionIdSchema,
  mode: z.literal("restore-validation"),
  validatorVersion: z.literal("session-replay/v1"),
  status: sessionDraftReplayStatusSchema,
  candidateSha256: sha256Schema,
  checks: z.array(sessionDraftReplayCheckSchema).min(1),
  restoredFileCount: z.number().int().nonnegative(),
  restoredBytes: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  conversationMessageCount: z.number().int().nonnegative(),
  toolEventCount: z.number().int().nonnegative(),
  approvalEventCount: z.number().int().nonnegative(),
  failureCode: z.string().trim().min(1).max(160).nullable().default(null),
  createdByUserId: userIdSchema.nullable().default(null),
  startedAt: isoDatetimeSchema,
  finishedAt: isoDatetimeSchema,
});
export const createSessionDraftReplayInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  revisionId: sessionDraftRevisionIdSchema,
});

export const createSessionDraftResponseSchema = z.object({
  session: sessionAssetRecordSchema,
  draft: sessionDraftRecordSchema,
});
export const sessionDraftDetailSchema = z.object({
  session: sessionAssetRecordSchema.nullable(),
  draft: sessionDraftRecordSchema,
  revisions: z.array(sessionDraftRevisionSchema),
  reviews: z.array(sessionRedactionReviewRecordSchema),
  replays: z.array(sessionDraftReplayRecordSchema),
  versions: z.array(sealedSessionVersionRecordSchema),
});
export const listSessionDraftsResponseSchema = z.object({
  items: z.array(sessionDraftRecordSchema),
});
export const createSessionDraftRevisionResponseSchema = z.object({
  draft: sessionDraftRecordSchema,
  revision: sessionDraftRevisionSchema,
});
export const submitSessionRedactionReviewResponseSchema = z.object({
  draft: sessionDraftRecordSchema,
  review: sessionRedactionReviewRecordSchema,
});
export const createSessionDraftReplayResponseSchema = z.object({
  draft: sessionDraftRecordSchema,
  replay: sessionDraftReplayRecordSchema,
});
export const sealSessionDraftResponseSchema = z.object({
  draft: sessionDraftRecordSchema,
  version: sealedSessionVersionRecordSchema,
});

export type SessionAssetStatus = z.infer<typeof sessionAssetStatusSchema>;
export type SessionAssetRecord = z.infer<typeof sessionAssetRecordSchema>;
export type SessionDraftStatus = z.infer<typeof sessionDraftStatusSchema>;
export type SessionDraftRecord = z.infer<typeof sessionDraftRecordSchema>;
export type SessionDraftRevision = z.infer<typeof sessionDraftRevisionSchema>;
export type CreateSessionDraftInput = z.infer<typeof createSessionDraftInputSchema>;
export type CreateSessionDraftRevisionInput = z.infer<typeof createSessionDraftRevisionInputSchema>;
export type SessionRedactionReviewRecord = z.infer<typeof sessionRedactionReviewRecordSchema>;
export type SubmitSessionRedactionReviewInput = z.infer<
  typeof submitSessionRedactionReviewInputSchema
>;
export type SessionDraftReplayCheck = z.infer<typeof sessionDraftReplayCheckSchema>;
export type SessionDraftReplayRecord = z.infer<typeof sessionDraftReplayRecordSchema>;
export type CreateSessionDraftReplayInput = z.infer<typeof createSessionDraftReplayInputSchema>;
export type CreateSessionDraftResponse = z.infer<typeof createSessionDraftResponseSchema>;
export type SessionDraftDetail = z.infer<typeof sessionDraftDetailSchema>;
export type ListSessionDraftsResponse = z.infer<typeof listSessionDraftsResponseSchema>;
export type CreateSessionDraftRevisionResponse = z.infer<
  typeof createSessionDraftRevisionResponseSchema
>;
export type SubmitSessionRedactionReviewResponse = z.infer<
  typeof submitSessionRedactionReviewResponseSchema
>;
export type CreateSessionDraftReplayResponse = z.infer<typeof createSessionDraftReplayResponseSchema>;
export type SealSessionDraftResponse = z.infer<typeof sealSessionDraftResponseSchema>;
