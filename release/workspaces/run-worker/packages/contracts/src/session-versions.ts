import { z } from "./zod.js";
import {
  isoDatetimeSchema,
  sessionDraftRevisionIdSchema,
  sessionIdSchema,
  sessionReplayIdSchema,
  sessionVersionIdSchema,
  userIdSchema,
} from "./common.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");

export const sealedSessionManifestVersionSchema = z.literal("lingban.session-pack/v2");
export const sealedSessionContentStateSchema = z.enum(["sealed", "archived"]);
export const sealedSessionSignatureAlgorithmSchema = z.enum(["hmac-sha256", "ed25519"]);
export const sealedSessionVersionSourceTypeSchema = z.enum([
  "captured",
  "legacy-imported",
  "external-imported",
]);

export const sealedSessionVersionRecordSchema = z.object({
  sessionVersionId: sessionVersionIdSchema,
  sessionId: sessionIdSchema,
  sealedFromRevisionId: sessionDraftRevisionIdSchema.nullable().default(null),
  sealedFromReplayId: sessionReplayIdSchema.nullable().default(null),
  sourceType: sealedSessionVersionSourceTypeSchema.default("captured"),
  legacyIncomplete: z.boolean().default(false),
  migrationReportObjectKey: z.string().trim().min(1).max(1024).nullable().default(null),
  parentSessionVersionId: sessionVersionIdSchema.nullable().default(null),
  manifestVersion: sealedSessionManifestVersionSchema,
  packObjectKey: z.string().trim().min(1).max(1024),
  packSha256: sha256Schema,
  packSizeBytes: z.number().int().nonnegative(),
  signatureAlgorithm: sealedSessionSignatureAlgorithmSchema,
  signatureKeyId: z.string().trim().min(1).max(240),
  signatureValue: z.string().trim().min(1).max(4096),
  contentState: sealedSessionContentStateSchema,
  sealedByUserId: userIdSchema.nullable().default(null),
  sealedAt: isoDatetimeSchema,
});
export const listSealedSessionVersionsResponseSchema = z.object({
  items: z.array(sealedSessionVersionRecordSchema),
});

export const sealSessionDraftInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  revisionId: sessionDraftRevisionIdSchema,
  signingPolicyId: z.string().trim().min(1).max(240),
  replayId: sessionReplayIdSchema,
});

export const sessionVersionLineageRelationSchema = z.enum([
  "derived",
  "consumer",
  "rollback",
  "imported",
]);
export const sessionVersionLineageRecordSchema = z.object({
  parentVersionId: sessionVersionIdSchema,
  childVersionId: sessionVersionIdSchema,
  relationType: sessionVersionLineageRelationSchema,
  reason: z.string().trim().min(1).max(2000).nullable().default(null),
  createdAt: isoDatetimeSchema,
});

export type SealedSessionVersionRecord = z.infer<typeof sealedSessionVersionRecordSchema>;
export type SealedSessionVersionSourceType = z.infer<typeof sealedSessionVersionSourceTypeSchema>;
export type ListSealedSessionVersionsResponse = z.infer<typeof listSealedSessionVersionsResponseSchema>;
export type SealSessionDraftInput = z.infer<typeof sealSessionDraftInputSchema>;
export type SessionVersionLineageRelation = z.infer<typeof sessionVersionLineageRelationSchema>;
export type SessionVersionLineageRecord = z.infer<typeof sessionVersionLineageRecordSchema>;
