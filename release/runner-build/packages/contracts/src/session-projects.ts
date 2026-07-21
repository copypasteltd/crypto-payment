import { z } from "./zod.js";
import {
  entrySurfaceSchema,
  isoDatetimeSchema,
  runIdSchema,
  sessionCaptureIdSchema,
  sessionDraftIdSchema,
  sessionProjectIdSchema,
  sessionVersionIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";
import { creatorPackageIdSchema } from "./creator.js";
import { serviceIdSchema, workshopIdSchema, workspaceContextKeySchema } from "./catalog.js";
import { runProviderSelectionSchema } from "./providers.js";
import {
  createRunBindingSchema,
  runApprovalModeSchema,
  runRecordSchema,
} from "./runs.js";

export const sessionProjectStatusSchema = z.enum([
  "DRAFT",
  "RECORDING",
  "CAPTURED",
  "EDITING",
  "REPLAYING",
  "READY_TO_SEAL",
  "SEALED",
  "PACKAGED",
  "PUBLISHED",
  "ARCHIVED",
]);

export const sessionProjectRecordSchema = z.object({
  sessionProjectId: sessionProjectIdSchema,
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).default(""),
  status: sessionProjectStatusSchema,
  sourceRunId: runIdSchema.nullable().default(null),
  currentCaptureId: sessionCaptureIdSchema.nullable().default(null),
  currentDraftId: sessionDraftIdSchema.nullable().default(null),
  currentSessionVersionId: sessionVersionIdSchema.nullable().default(null),
  packageId: creatorPackageIdSchema.nullable().default(null),
  workshopId: workshopIdSchema.nullable().default(null),
  serviceId: serviceIdSchema.nullable().default(null),
  sourceProviderSelection: runProviderSelectionSchema.nullable().default(null),
  sourceBindings: createRunBindingSchema.default({
    firstPartyMcpIds: [],
    externalConnectorRefs: [],
    credentialIds: [],
  }),
  version: z.number().int().positive(),
  createdByUserId: userIdSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const createSessionProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).default(""),
});

export const updateSessionProjectInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
});

export const listSessionProjectsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: sessionProjectStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const listSessionProjectsResponseSchema = z.object({
  items: z.array(sessionProjectRecordSchema),
  total: z.number().int().nonnegative(),
});

export const createCreatorSourceRunInputSchema = z.object({
  sessionProjectId: sessionProjectIdSchema,
  title: z.string().trim().min(1).max(200).optional(),
  targetPath: z.string().trim().min(1).max(1000).optional(),
  entrySurface: entrySurfaceSchema.default("dashboard"),
  approvalMode: runApprovalModeSchema.default("manual"),
  providerSelection: runProviderSelectionSchema.nullable().default(null),
  bindings: createRunBindingSchema.default({
    firstPartyMcpIds: [],
    externalConnectorRefs: [],
    credentialIds: [],
  }),
});

export const createCreatorSourceRunResponseSchema = z.object({
  sessionProject: sessionProjectRecordSchema,
  run: runRecordSchema,
  nextPrompt: z.string().min(1),
});

export type SessionProjectStatus = z.infer<typeof sessionProjectStatusSchema>;
export type SessionProjectRecord = z.infer<typeof sessionProjectRecordSchema>;
export type CreateSessionProjectInput = z.input<typeof createSessionProjectInputSchema>;
export type UpdateSessionProjectInput = z.infer<typeof updateSessionProjectInputSchema>;
export type ListSessionProjectsQuery = z.input<typeof listSessionProjectsQuerySchema>;
export type ListSessionProjectsResponse = z.infer<typeof listSessionProjectsResponseSchema>;
export type CreateCreatorSourceRunInput = z.input<typeof createCreatorSourceRunInputSchema>;
export type CreateCreatorSourceRunResponse = z.infer<typeof createCreatorSourceRunResponseSchema>;
