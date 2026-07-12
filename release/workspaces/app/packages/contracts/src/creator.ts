import { z } from "zod";
import { workspaceRoleSchema } from "./auth.js";
import { localizedTextSchema, serviceIdSchema, workshopIdSchema, workspaceContextKeySchema } from "./catalog.js";
import { isoDatetimeSchema, userIdSchema } from "./common.js";

export const creatorPackageStateSchema = z.enum(["audited", "pending_release", "ready"]);
export const creatorPackageToneSchema = z.enum(["success", "warn", "active"]);
export const creatorReleaseStateSchema = z.enum(["private", "staged", "production"]);
export const creatorReplayStateSchema = z.enum(["ready", "running", "failed"]);
export const creatorReleaseGateTypeSchema = z.enum([
  "desensitization",
  "replay",
  "credential",
  "manual_approval",
]);
export const creatorReleaseGateStatusSchema = z.enum(["pending", "running", "passed", "failed", "waived"]);
export const creatorReleaseGateChecklistStatusSchema = z.enum(["pending", "passed", "failed", "waived"]);
export const creatorReleaseActivationStateSchema = z.enum(["active", "rolled_back", "failed"]);
export const creatorGovernanceSectionSchema = z.enum([
  "credentials",
  "members",
  "policy",
  "audit",
  "cost",
]);
export const creatorGovernanceDynamicSectionSchema = z.enum(["members", "audit", "cost"]);
export const creatorGovernanceToneSchema = z.enum(["", "active", "warn", "success"]);
export const creatorAuditExportFormatSchema = z.enum(["json", "csv"]);
export const creatorAuditExportStatusSchema = z.enum(["ready", "failed"]);
export const creatorPackageIdSchema = z.string().trim().min(1).max(120);
export const creatorReleaseIdSchema = z.string().trim().min(1).max(120);
export const creatorReplayIdSchema = z.string().trim().min(1).max(120);
export const creatorReleaseGateIdSchema = z.string().trim().min(1).max(120);
export const creatorReleaseActivationIdSchema = z.string().trim().min(1).max(120);
export const creatorAuditExportIdSchema = z.string().trim().min(1).max(120);
export const creatorReleaseGateChecklistItemIdSchema = z.string().trim().min(1).max(120);

export const creatorPackageSectionSchema = z.object({
  summary: localizedTextSchema,
  items: z.array(localizedTextSchema).default([]),
});

export const creatorPackageSummarySchema = z.object({
  packageId: creatorPackageIdSchema,
  title: localizedTextSchema,
  source: localizedTextSchema,
  state: creatorPackageStateSchema,
  statusLabel: localizedTextSchema,
  tone: creatorPackageToneSchema,
  ownerLabel: localizedTextSchema,
  updatedAt: z.string().min(1),
  releaseChannel: localizedTextSchema,
  workspaceContextKeys: z.array(workspaceContextKeySchema).min(1),
  linkedWorkshopIds: z.array(workshopIdSchema).default([]),
  linkedServiceIds: z.array(serviceIdSchema).default([]),
});

export const creatorPackageDetailSchema = creatorPackageSummarySchema.extend({
  session: creatorPackageSectionSchema,
  runtime: creatorPackageSectionSchema,
  connectors: creatorPackageSectionSchema,
  release: creatorPackageSectionSchema,
  versionLine: z.array(z.string().min(1)).default([]),
  dependencies: z.array(localizedTextSchema).default([]),
});

export const creatorReleaseSummarySchema = z.object({
  releaseId: creatorReleaseIdSchema,
  packageId: creatorPackageIdSchema,
  targetWorkspaceContextKey: workspaceContextKeySchema,
  state: creatorReleaseStateSchema,
  channelLabel: localizedTextSchema,
  gateSummary: z.array(localizedTextSchema).default([]),
  updatedAt: z.string().min(1),
});

export const creatorReplaySummarySchema = z.object({
  replayId: creatorReplayIdSchema,
  packageId: creatorPackageIdSchema,
  sourceRunId: z.string().min(1),
  state: creatorReplayStateSchema,
  summary: localizedTextSchema,
  updatedAt: z.string().min(1),
});

export const creatorReleaseGateChecklistItemSchema = z.object({
  itemId: creatorReleaseGateChecklistItemIdSchema,
  label: localizedTextSchema,
  status: creatorReleaseGateChecklistStatusSchema,
  note: localizedTextSchema.nullable().default(null),
});

export const creatorReleaseGateSchema = z.object({
  gateId: creatorReleaseGateIdSchema,
  releaseId: creatorReleaseIdSchema,
  packageId: creatorPackageIdSchema,
  gateType: creatorReleaseGateTypeSchema,
  status: creatorReleaseGateStatusSchema,
  requiredRole: workspaceRoleSchema,
  resultSummary: localizedTextSchema,
  evidenceRef: z.string().trim().min(1).max(240).nullable().default(null),
  checklist: z.array(creatorReleaseGateChecklistItemSchema).default([]),
  recommendedActions: z.array(localizedTextSchema).default([]),
  decidedByUserId: userIdSchema.nullable().default(null),
  decidedAt: isoDatetimeSchema.nullable().default(null),
  updatedAt: isoDatetimeSchema,
});

export const creatorReleaseActivationSchema = z.object({
  activationId: creatorReleaseActivationIdSchema,
  releaseId: creatorReleaseIdSchema,
  packageId: creatorPackageIdSchema,
  targetWorkspaceContextKey: workspaceContextKeySchema,
  state: creatorReleaseActivationStateSchema,
  rolloutMode: creatorReleaseStateSchema,
  effectiveAt: isoDatetimeSchema,
  note: localizedTextSchema.nullable().default(null),
  activatedByUserId: userIdSchema,
  updatedAt: isoDatetimeSchema,
});

export const creatorGovernanceMetricSchema = z.object({
  label: localizedTextSchema,
  value: z.string().trim().min(1).max(120),
  note: localizedTextSchema,
});

export const creatorGovernanceRowSchema = z.object({
  id: z.string().trim().min(1).max(160),
  tone: creatorGovernanceToneSchema,
  cells: z.tuple([
    localizedTextSchema,
    localizedTextSchema,
    localizedTextSchema,
    localizedTextSchema,
  ]),
});

export const creatorGovernanceSectionSummarySchema = z.object({
  packageId: creatorPackageIdSchema,
  section: creatorGovernanceDynamicSectionSchema,
  workspaceContextKey: workspaceContextKeySchema,
  summary: localizedTextSchema,
  metrics: z.array(creatorGovernanceMetricSchema).default([]),
  headers: z.tuple([
    localizedTextSchema,
    localizedTextSchema,
    localizedTextSchema,
    localizedTextSchema,
  ]),
  rows: z.array(creatorGovernanceRowSchema).default([]),
  updatedAt: isoDatetimeSchema,
});

export const creatorGovernanceSectionSummaryQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
});

export const creatorAuditExportRecordSchema = z.object({
  exportId: creatorAuditExportIdSchema,
  packageId: creatorPackageIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  format: creatorAuditExportFormatSchema,
  status: creatorAuditExportStatusSchema,
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  objectKey: z.string().trim().min(1).max(512),
  sizeBytes: z.number().int().nonnegative().nullable().default(null),
  sha256: z.string().trim().min(1).max(128).nullable().default(null),
  recordCount: z.number().int().nonnegative().default(0),
  summary: localizedTextSchema,
  createdByUserId: userIdSchema.nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const listCreatorAuditExportsQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
});

export const createCreatorAuditExportInputSchema = z.object({
  workspaceContextKey: workspaceContextKeySchema,
  format: creatorAuditExportFormatSchema.default("json"),
});

export const creatorAuditExportResponseSchema = z.object({
  export: creatorAuditExportRecordSchema,
  downloadPath: z.string().trim().min(1).max(512),
});

export const createCreatorReleaseInputSchema = z.object({
  targetWorkspaceContextKey: workspaceContextKeySchema,
  state: creatorReleaseStateSchema.default("private"),
  channelLabel: localizedTextSchema,
  gateSummary: z.array(localizedTextSchema).default([]),
});

export const updateCreatorReleaseInputSchema = z
  .object({
    targetWorkspaceContextKey: workspaceContextKeySchema.optional(),
    state: creatorReleaseStateSchema.optional(),
    channelLabel: localizedTextSchema.optional(),
    gateSummary: z.array(localizedTextSchema).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one creator release field must be updated"
  );

export const createCreatorReplayInputSchema = z.object({
  sourceRunId: z.string().trim().min(1).max(160),
  state: creatorReplayStateSchema.default("ready"),
  summary: localizedTextSchema,
});

export const updateCreatorReplayInputSchema = z
  .object({
    sourceRunId: z.string().trim().min(1).max(160).optional(),
    state: creatorReplayStateSchema.optional(),
    summary: localizedTextSchema.optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one creator replay field must be updated"
  );

export const decideCreatorReleaseGateInputSchema = z.object({
  status: creatorReleaseGateStatusSchema.refine(
    (value) => value === "passed" || value === "failed" || value === "waived",
    "Gate decisions only support passed, failed, or waived"
  ),
  note: localizedTextSchema.nullable().optional(),
  evidenceRef: z.string().trim().min(1).max(240).nullable().optional(),
  checklist: z.array(creatorReleaseGateChecklistItemSchema).optional(),
  recommendedActions: z.array(localizedTextSchema).optional(),
});

export const activateCreatorReleaseInputSchema = z.object({
  note: localizedTextSchema.optional(),
});

export const listCreatorPackagesQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  q: z.string().trim().min(1).optional(),
  state: creatorPackageStateSchema.optional(),
});

export type CreatorPackageState = z.infer<typeof creatorPackageStateSchema>;
export type CreatorPackageTone = z.infer<typeof creatorPackageToneSchema>;
export type CreatorReleaseState = z.infer<typeof creatorReleaseStateSchema>;
export type CreatorReplayState = z.infer<typeof creatorReplayStateSchema>;
export type CreatorReleaseGateType = z.infer<typeof creatorReleaseGateTypeSchema>;
export type CreatorReleaseGateStatus = z.infer<typeof creatorReleaseGateStatusSchema>;
export type CreatorReleaseGateChecklistStatus = z.infer<typeof creatorReleaseGateChecklistStatusSchema>;
export type CreatorReleaseActivationState = z.infer<typeof creatorReleaseActivationStateSchema>;
export type CreatorGovernanceSection = z.infer<typeof creatorGovernanceSectionSchema>;
export type CreatorGovernanceDynamicSection = z.infer<typeof creatorGovernanceDynamicSectionSchema>;
export type CreatorGovernanceTone = z.infer<typeof creatorGovernanceToneSchema>;
export type CreatorAuditExportFormat = z.infer<typeof creatorAuditExportFormatSchema>;
export type CreatorAuditExportStatus = z.infer<typeof creatorAuditExportStatusSchema>;
export type CreatorPackageSection = z.infer<typeof creatorPackageSectionSchema>;
export type CreatorPackageSummary = z.infer<typeof creatorPackageSummarySchema>;
export type CreatorPackageDetail = z.infer<typeof creatorPackageDetailSchema>;
export type CreatorReleaseSummary = z.infer<typeof creatorReleaseSummarySchema>;
export type CreatorReplaySummary = z.infer<typeof creatorReplaySummarySchema>;
export type CreatorReleaseGateChecklistItem = z.infer<typeof creatorReleaseGateChecklistItemSchema>;
export type CreatorReleaseGate = z.infer<typeof creatorReleaseGateSchema>;
export type CreatorReleaseActivation = z.infer<typeof creatorReleaseActivationSchema>;
export type CreatorGovernanceMetric = z.infer<typeof creatorGovernanceMetricSchema>;
export type CreatorGovernanceRow = z.infer<typeof creatorGovernanceRowSchema>;
export type CreatorGovernanceSectionSummary = z.infer<typeof creatorGovernanceSectionSummarySchema>;
export type CreatorAuditExportRecord = z.infer<typeof creatorAuditExportRecordSchema>;
export type CreateCreatorReleaseInput = z.infer<typeof createCreatorReleaseInputSchema>;
export type UpdateCreatorReleaseInput = z.infer<typeof updateCreatorReleaseInputSchema>;
export type CreateCreatorReplayInput = z.infer<typeof createCreatorReplayInputSchema>;
export type UpdateCreatorReplayInput = z.infer<typeof updateCreatorReplayInputSchema>;
export type DecideCreatorReleaseGateInput = z.infer<typeof decideCreatorReleaseGateInputSchema>;
export type ActivateCreatorReleaseInput = z.infer<typeof activateCreatorReleaseInputSchema>;
export type ListCreatorPackagesQuery = z.infer<typeof listCreatorPackagesQuerySchema>;
export type CreatorGovernanceSectionSummaryQuery = z.infer<typeof creatorGovernanceSectionSummaryQuerySchema>;
export type ListCreatorAuditExportsQuery = z.infer<typeof listCreatorAuditExportsQuerySchema>;
export type CreateCreatorAuditExportInput = z.infer<typeof createCreatorAuditExportInputSchema>;
export type CreatorAuditExportResponse = z.infer<typeof creatorAuditExportResponseSchema>;
