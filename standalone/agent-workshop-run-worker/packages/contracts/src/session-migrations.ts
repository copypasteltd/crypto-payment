import { z } from "zod";
import { sessionVersionIdSchema } from "./common.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");

export const migrateLegacySessionArchivesInputSchema = z.object({
  sessionVersionIds: z.array(sessionVersionIdSchema).max(1000).default([]),
  dryRun: z.boolean().default(true),
});

export const legacySessionArchiveMigrationItemSchema = z.object({
  sessionVersionId: sessionVersionIdSchema,
  status: z.enum(["planned", "migrated", "skipped", "failed"]),
  sourceArchiveSha256: sha256Schema.nullable().default(null),
  targetPackSha256: sha256Schema.nullable().default(null),
  migrationReportObjectKey: z.string().trim().min(1).max(1024).nullable().default(null),
  legacyIncomplete: z.boolean().default(true),
  detail: z.string().trim().min(1).max(4000),
});

export const migrateLegacySessionArchivesResponseSchema = z.object({
  dryRun: z.boolean(),
  total: z.number().int().nonnegative(),
  planned: z.number().int().nonnegative(),
  migrated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  items: z.array(legacySessionArchiveMigrationItemSchema),
});

export type MigrateLegacySessionArchivesInput = z.infer<
  typeof migrateLegacySessionArchivesInputSchema
>;
export type LegacySessionArchiveMigrationItem = z.infer<
  typeof legacySessionArchiveMigrationItemSchema
>;
export type MigrateLegacySessionArchivesResponse = z.infer<
  typeof migrateLegacySessionArchivesResponseSchema
>;
