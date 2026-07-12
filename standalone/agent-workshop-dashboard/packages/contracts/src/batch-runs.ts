import { z } from "zod";
import {
  entrySurfaceSchema,
  isoDatetimeSchema,
  runIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";
import {
  localizedTextSchema,
  serviceIdSchema,
  serviceLaunchTemplateResolutionSourceSchema,
  workshopIdSchema,
  workspaceContextKeySchema,
} from "./catalog.js";
import { createRunBindingSchema, runStatusSchema } from "./runs.js";
import { quotaMetricSchema } from "./quota.js";

export const batchRunJobIdSchema = z.string().trim().min(1).max(160);
export const batchRunItemIdSchema = z.string().trim().min(1).max(160);

export const batchRunStatusSchema = z.enum([
  "draft",
  "validated",
  "queued",
  "running",
  "partial_failed",
  "completed",
  "cancelled",
]);

export const batchRunItemStatusSchema = z.enum([
  "draft",
  "validated",
  "queued",
  "starting",
  "running",
  "waiting_approval",
  "succeeded",
  "failed",
  "cancelled",
]);

export const batchRunGovernanceSchema = z.object({
  maxParallelRuns: z.number().int().positive().max(50).default(3),
  budgetLimit: z.number().nonnegative().nullable().default(null),
  retryLimit: z.number().int().nonnegative().max(10).default(0),
});

export const batchRunItemContextSchema = z.record(z.string().min(1), z.string().min(1));

export const batchRunImportFileFormatSchema = z.enum(["csv", "xlsx"]);

export const batchRunImportFieldMappingSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  pathSuffix: z.string().trim().min(1).max(160).optional(),
  targetPath: z.string().trim().min(1).max(240).optional(),
  initialMessage: z.string().trim().min(1).max(160).optional(),
  rowKey: z.string().trim().min(1).max(160).optional(),
  ignoreColumns: z.array(z.string().trim().min(1).max(160)).max(80).default([]),
});

export const batchRunImportResolvedMappingSchema = z.object({
  title: z.string().trim().min(1).max(160).nullable().default(null),
  pathSuffix: z.string().trim().min(1).max(160).nullable().default(null),
  targetPath: z.string().trim().min(1).max(240).nullable().default(null),
  initialMessage: z.string().trim().min(1).max(160).nullable().default(null),
  rowKey: z.string().trim().min(1).max(160).nullable().default(null),
  ignoreColumns: z.array(z.string().trim().min(1).max(160)).default([]),
  contextColumns: z.array(z.string().trim().min(1).max(160)).default([]),
});

export const batchRunDraftItemInputSchema = z.object({
  rowKey: z.string().trim().min(1).max(120).nullable().default(null),
  title: z.string().min(1),
  targetPath: z.string().min(1).nullable().default(null),
  pathSuffix: z.string().trim().min(1).max(120).nullable().default(null),
  initialMessage: z.string().min(1).nullable().default(null),
  context: batchRunItemContextSchema.default({}),
});

export const batchRunBudgetEstimateMetricSchema = z.object({
  metric: quotaMetricSchema,
  label: localizedTextSchema,
  quantityLow: z.number().nonnegative(),
  quantityHigh: z.number().nonnegative(),
  unitPriceUsd: z.number().nonnegative(),
  amountUsdLow: z.number().nonnegative(),
  amountUsdHigh: z.number().nonnegative(),
  currency: z.literal("USD").default("USD"),
});

export const batchRunBudgetEstimateSchema = z.object({
  currency: z.literal("USD").default("USD"),
  itemCount: z.number().int().nonnegative(),
  estimatedMinutesPerItemLow: z.number().nonnegative(),
  estimatedMinutesPerItemHigh: z.number().nonnegative(),
  estimatedTotalMinutesLow: z.number().nonnegative(),
  estimatedTotalMinutesHigh: z.number().nonnegative(),
  estimatedWallClockMinutesLow: z.number().nonnegative(),
  estimatedWallClockMinutesHigh: z.number().nonnegative(),
  estimatedTotalAmountUsdLow: z.number().nonnegative(),
  estimatedTotalAmountUsdHigh: z.number().nonnegative(),
  budgetLimit: z.number().nonnegative().nullable().default(null),
  budgetRemainingUsdLow: z.number().nullable().default(null),
  budgetRemainingUsdHigh: z.number().nullable().default(null),
  withinBudget: z.boolean().default(true),
  metrics: z.array(batchRunBudgetEstimateMetricSchema).default([]),
  warnings: z.array(z.string().min(1).max(500)).default([]),
});

const createBatchRunInputBaseSchema = z.object({
  workspaceId: workspaceIdSchema.optional(),
  workspaceContextKey: workspaceContextKeySchema.optional(),
  serviceId: serviceIdSchema,
  entrySurface: entrySurfaceSchema,
  title: z.string().min(1).optional(),
  items: z.array(batchRunDraftItemInputSchema).min(1),
  governance: batchRunGovernanceSchema.default({
    maxParallelRuns: 3,
    budgetLimit: null,
    retryLimit: 0,
  }),
  autoStart: z.boolean().default(false),
});

function requireBatchWorkspaceScope<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.refine(
    (value) => Boolean(value.workspaceId || value.workspaceContextKey),
    "workspaceId or workspaceContextKey is required"
  );
}

export const createBatchRunInputSchema = requireBatchWorkspaceScope(createBatchRunInputBaseSchema);

export const estimateBatchRunInputSchema = requireBatchWorkspaceScope(
  createBatchRunInputBaseSchema.omit({
    autoStart: true,
  })
);

export const importBatchRunFileInputSchema = z
  .object({
    workspaceId: workspaceIdSchema.optional(),
    workspaceContextKey: workspaceContextKeySchema.optional(),
    fileName: z.string().trim().min(1).max(240),
    contentBase64: z.string().min(1).max(16 * 1024 * 1024),
    format: batchRunImportFileFormatSchema.optional(),
    sheetName: z.string().trim().min(1).max(160).optional(),
    previewLimit: z.number().int().positive().max(500).default(200),
    mapping: batchRunImportFieldMappingSchema.default({
      ignoreColumns: [],
    }),
  })
  .refine(
    (value) => Boolean(value.workspaceId || value.workspaceContextKey),
    "workspaceId or workspaceContextKey is required"
  );

export const listBatchRunsQuerySchema = z.object({
  workspaceId: workspaceIdSchema.optional(),
  workspaceContextKey: workspaceContextKeySchema.optional(),
  serviceId: serviceIdSchema.optional(),
  status: batchRunStatusSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const listBatchRunItemsQuerySchema = z.object({
  status: batchRunItemStatusSchema.optional(),
});

export const batchRunStartInputSchema = z.object({
  itemIds: z.array(batchRunItemIdSchema).min(1).optional(),
});

export const batchRunRetryInputSchema = z
  .object({
    onlyFailed: z.boolean().default(true),
    itemIds: z.array(batchRunItemIdSchema).min(1).optional(),
  })
  .refine(
    (value) => value.onlyFailed || Boolean(value.itemIds && value.itemIds.length > 0),
    "itemIds are required when onlyFailed is false"
  );

export const batchRunCancelInputSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export const batchRunJobSchema = z.object({
  batchJobId: batchRunJobIdSchema,
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema.nullable().default(null),
  workspaceContextName: localizedTextSchema.nullable().default(null),
  workspaceRoot: z.string().min(1),
  workshopId: workshopIdSchema.nullable().default(null),
  workshopName: localizedTextSchema.nullable().default(null),
  serviceId: serviceIdSchema,
  serviceName: localizedTextSchema.nullable().default(null),
  taskVersionId: taskVersionIdSchema,
  sessionVersionId: sessionVersionIdSchema,
  entrySurface: entrySurfaceSchema,
  title: z.string().min(1),
  templateSource: serviceLaunchTemplateResolutionSourceSchema,
  sourcePackageId: z.string().trim().min(1).nullable().default(null),
  sourceReleaseId: z.string().trim().min(1).nullable().default(null),
  sourceActivationId: z.string().trim().min(1).nullable().default(null),
  bindings: createRunBindingSchema,
  status: batchRunStatusSchema,
  maxParallelRuns: z.number().int().positive().max(50),
  budgetLimit: z.number().nonnegative().nullable(),
  retryLimit: z.number().int().nonnegative(),
  createdByUserId: userIdSchema.nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  validatedAt: isoDatetimeSchema.nullable().default(null),
  startedAt: isoDatetimeSchema.nullable().default(null),
  finishedAt: isoDatetimeSchema.nullable().default(null),
  cancelledAt: isoDatetimeSchema.nullable().default(null),
  cancellationReason: z.string().nullable().default(null),
});

export const batchRunItemSchema = z.object({
  batchItemId: batchRunItemIdSchema,
  batchJobId: batchRunJobIdSchema,
  rowIndex: z.number().int().nonnegative(),
  rowKey: z.string().trim().min(1).max(120).nullable().default(null),
  title: z.string().min(1),
  targetPath: z.string().min(1),
  pathSuffix: z.string().trim().min(1).max(120).nullable().default(null),
  initialMessage: z.string().min(1).nullable().default(null),
  context: batchRunItemContextSchema.default({}),
  runId: runIdSchema.nullable().default(null),
  previousRunIds: z.array(runIdSchema).default([]),
  runStatus: runStatusSchema.nullable().default(null),
  runStatusReason: z.string().nullable().default(null),
  status: batchRunItemStatusSchema,
  attemptCount: z.number().int().nonnegative().default(0),
  errorCode: z.string().nullable().default(null),
  errorMessage: z.string().nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  startedAt: isoDatetimeSchema.nullable().default(null),
  finishedAt: isoDatetimeSchema.nullable().default(null),
});

export const batchRunSummarySchema = z.object({
  totalCount: z.number().int().nonnegative(),
  draftCount: z.number().int().nonnegative(),
  validatedCount: z.number().int().nonnegative(),
  queuedCount: z.number().int().nonnegative(),
  startingCount: z.number().int().nonnegative(),
  runningCount: z.number().int().nonnegative(),
  waitingApprovalCount: z.number().int().nonnegative(),
  succeededCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  cancelledCount: z.number().int().nonnegative(),
  latestUpdatedAt: isoDatetimeSchema.nullable(),
});

export const batchRunDetailSchema = z.object({
  job: batchRunJobSchema,
  summary: batchRunSummarySchema,
  estimate: batchRunBudgetEstimateSchema.nullable().default(null),
  itemsPreview: z.array(batchRunItemSchema).default([]),
});

export const batchRunItemsResponseSchema = z.object({
  job: batchRunJobSchema,
  summary: batchRunSummarySchema,
  estimate: batchRunBudgetEstimateSchema.nullable().default(null),
  items: z.array(batchRunItemSchema),
});

export const importBatchRunFileResponseSchema = z.object({
  sourceFormat: batchRunImportFileFormatSchema,
  fileName: z.string().trim().min(1).max(240),
  sheetNames: z.array(z.string().trim().min(1).max(160)).default([]),
  activeSheetName: z.string().trim().min(1).max(160).nullable().default(null),
  detectedColumns: z.array(z.string().trim().min(1).max(160)).default([]),
  effectiveMapping: batchRunImportResolvedMappingSchema,
  items: z.array(batchRunDraftItemInputSchema),
  importedRowCount: z.number().int().nonnegative(),
  skippedRowCount: z.number().int().nonnegative(),
  truncated: z.boolean().default(false),
  warnings: z.array(z.string().min(1).max(500)).default([]),
});

export type BatchRunJobId = z.infer<typeof batchRunJobIdSchema>;
export type BatchRunItemId = z.infer<typeof batchRunItemIdSchema>;
export type BatchRunStatus = z.infer<typeof batchRunStatusSchema>;
export type BatchRunItemStatus = z.infer<typeof batchRunItemStatusSchema>;
export type BatchRunGovernance = z.input<typeof batchRunGovernanceSchema>;
export type BatchRunItemContext = z.input<typeof batchRunItemContextSchema>;
export type BatchRunImportFileFormat = z.infer<typeof batchRunImportFileFormatSchema>;
export type BatchRunImportFieldMapping = z.input<typeof batchRunImportFieldMappingSchema>;
export type BatchRunImportResolvedMapping = z.infer<typeof batchRunImportResolvedMappingSchema>;
export type BatchRunDraftItemInput = z.input<typeof batchRunDraftItemInputSchema>;
export type BatchRunBudgetEstimateMetric = z.infer<typeof batchRunBudgetEstimateMetricSchema>;
export type BatchRunBudgetEstimate = z.infer<typeof batchRunBudgetEstimateSchema>;
export type CreateBatchRunInput = z.input<typeof createBatchRunInputSchema>;
export type EstimateBatchRunInput = z.input<typeof estimateBatchRunInputSchema>;
export type ImportBatchRunFileInput = z.input<typeof importBatchRunFileInputSchema>;
export type ListBatchRunsQuery = z.input<typeof listBatchRunsQuerySchema>;
export type ListBatchRunItemsQuery = z.input<typeof listBatchRunItemsQuerySchema>;
export type BatchRunStartInput = z.input<typeof batchRunStartInputSchema>;
export type BatchRunRetryInput = z.input<typeof batchRunRetryInputSchema>;
export type BatchRunCancelInput = z.input<typeof batchRunCancelInputSchema>;
export type BatchRunJob = z.infer<typeof batchRunJobSchema>;
export type BatchRunItem = z.infer<typeof batchRunItemSchema>;
export type BatchRunSummary = z.infer<typeof batchRunSummarySchema>;
export type BatchRunDetail = z.infer<typeof batchRunDetailSchema>;
export type BatchRunItemsResponse = z.infer<typeof batchRunItemsResponseSchema>;
export type ImportBatchRunFileResponse = z.infer<typeof importBatchRunFileResponseSchema>;
