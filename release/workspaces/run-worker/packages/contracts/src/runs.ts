import { z } from "zod";
import {
  approvalIdSchema,
  approvalStateSchema,
  artifactIdSchema,
  artifactStatusSchema,
  downloadTicketIdSchema,
  entrySurfaceSchema,
  fileKindSchema,
  isoDatetimeSchema,
  messageKindSchema,
  messageRoleSchema,
  runIdSchema,
  sessionDraftRevisionIdSchema,
  sessionProjectIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  uploadIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";
import { credentialMountSchema, mcpBindingSchema } from "./runtime.js";
import { mcpNetworkPolicySchema } from "./mcp.js";
import { resolvedRunProviderSchema, runProviderSelectionSchema } from "./providers.js";
import { agentThreadSummarySchema } from "./agent-runtime.js";
import { sessionCaptureSummarySchema } from "./session-captures.js";

export const runStatusSchema = z.enum([
  "CREATED",
  "READY",
  "QUEUED",
  "STARTING",
  "RUNNING",
  "WAITING_APPROVAL",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export const runListViewStatusSchema = z.enum([
  "running",
  "approval",
  "done",
  "failed",
  "cancelled",
]);

export const runAttentionModeSchema = z.enum([
  "todo",
  "running",
  "done",
]);

export const runPurposeSchema = z.enum([
  "creator_source",
  "service_consumer",
  "replay_validation",
  "batch_consumer",
]);

export const sessionBootstrapModeSchema = z.enum([
  "blank",
  "sealed_version",
  "draft_revision",
]);

export const createRunBindingSchema = z.object({
  firstPartyMcpIds: z.array(z.string().min(1)).default([]),
  externalConnectorRefs: z.array(z.string().min(1)).default([]),
  credentialIds: z.array(z.string().min(1)).default([]),
});

const runCatalogObjectIdSchema = z.string().trim().min(1).max(120);
const runCatalogLocalizedTextSchema = z.object({
  zh: z.string().min(1),
  en: z.string().min(1),
});

export const runCatalogMetadataSchema = z.object({
  workspaceContextKey: runCatalogObjectIdSchema.nullable().default(null),
  workspaceContextName: runCatalogLocalizedTextSchema.nullable().default(null),
  workshopId: runCatalogObjectIdSchema.nullable().default(null),
  workshopName: runCatalogLocalizedTextSchema.nullable().default(null),
  serviceId: runCatalogObjectIdSchema.nullable().default(null),
  serviceName: runCatalogLocalizedTextSchema.nullable().default(null),
});

const createRunInputObjectSchema = z.object({
  workspaceId: workspaceIdSchema,
  runPurpose: runPurposeSchema.default("service_consumer"),
  sessionBootstrapMode: sessionBootstrapModeSchema.default("sealed_version"),
  sessionProjectId: sessionProjectIdSchema.nullable().default(null),
  taskVersionId: taskVersionIdSchema.nullable().default(null),
  sessionVersionId: sessionVersionIdSchema.nullable().default(null),
  draftRevisionId: sessionDraftRevisionIdSchema.nullable().default(null),
  requestedByUserId: userIdSchema.optional(),
  title: z.string().min(1),
  targetPath: z.string().min(1),
  entrySurface: entrySurfaceSchema,
  initialMessage: z.string().min(1).nullable().default(null),
  bindings: createRunBindingSchema.default({
    firstPartyMcpIds: [],
    externalConnectorRefs: [],
    credentialIds: [],
  }),
  providerSelection: runProviderSelectionSchema.nullable().default(null),
  catalogMetadata: runCatalogMetadataSchema.nullable().default(null),
});

function validateRunIdentity(
  value: z.infer<typeof createRunInputObjectSchema>,
  ctx: z.RefinementCtx
) {
  if (value.runPurpose === "creator_source") {
    if (value.sessionBootstrapMode !== "blank") {
      ctx.addIssue({ code: "custom", path: ["sessionBootstrapMode"], message: "Creator source runs require blank bootstrap" });
    }
    if (!value.sessionProjectId) {
      ctx.addIssue({ code: "custom", path: ["sessionProjectId"], message: "Creator source runs require a Session Project" });
    }
    if (value.taskVersionId || value.sessionVersionId || value.draftRevisionId || value.catalogMetadata) {
      ctx.addIssue({ code: "custom", path: ["runPurpose"], message: "Creator source runs cannot inherit task, session, revision, or catalog state" });
    }
    return;
  }

  if (value.runPurpose === "replay_validation") {
    if (value.sessionBootstrapMode !== "draft_revision") {
      ctx.addIssue({ code: "custom", path: ["sessionBootstrapMode"], message: "Replay runs require draft revision bootstrap" });
    }
    if (!value.sessionProjectId || !value.draftRevisionId) {
      ctx.addIssue({ code: "custom", path: ["draftRevisionId"], message: "Replay runs require a Session Project and Draft Revision" });
    }
    return;
  }

  if (value.sessionBootstrapMode !== "sealed_version") {
    ctx.addIssue({ code: "custom", path: ["sessionBootstrapMode"], message: "Consumer runs require sealed version bootstrap" });
  }
  if (!value.taskVersionId || !value.sessionVersionId) {
    ctx.addIssue({ code: "custom", path: ["sessionVersionId"], message: "Consumer runs require task and session versions" });
  }
  if (value.draftRevisionId) {
    ctx.addIssue({ code: "custom", path: ["draftRevisionId"], message: "Consumer runs cannot bind a Draft Revision" });
  }
}

export const createRunInputSchema = createRunInputObjectSchema.superRefine(validateRunIdentity);

export const listRunsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: runStatusSchema.optional(),
  viewStatus: runListViewStatusSchema.optional(),
  attentionMode: runAttentionModeSchema.optional(),
  entrySurface: entrySurfaceSchema.optional(),
  tag: z.string().trim().min(1).max(120).optional(),
});

export const runRecordSchema = z.object({
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  runPurpose: runPurposeSchema.default("service_consumer"),
  sessionBootstrapMode: sessionBootstrapModeSchema.default("sealed_version"),
  sessionProjectId: sessionProjectIdSchema.nullable().default(null),
  taskVersionId: taskVersionIdSchema.nullable().default(null),
  sessionVersionId: sessionVersionIdSchema.nullable().default(null),
  draftRevisionId: sessionDraftRevisionIdSchema.nullable().default(null),
  requestedByUserId: userIdSchema.nullable().optional(),
  title: z.string().min(1),
  targetPath: z.string().min(1),
  entrySurface: entrySurfaceSchema,
  catalogMetadata: runCatalogMetadataSchema.nullable().default(null),
  status: runStatusSchema,
  statusReason: z.string().nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const runRuntimeLaunchModeSchema = z.enum(["local-process", "docker"]);

export const runRuntimeMetadataSchema = z.object({
  launchMode: runRuntimeLaunchModeSchema.nullable().default(null),
  containerName: z.string().min(1).nullable().default(null),
  startedAt: isoDatetimeSchema.nullable().default(null),
  readyAt: isoDatetimeSchema.nullable().default(null),
  finishedAt: isoDatetimeSchema.nullable().default(null),
  exitCode: z.number().int().nullable().default(null),
  exitSignal: z.string().min(1).nullable().default(null),
});

const runRuntimeMetadataDefaults = runRuntimeMetadataSchema.parse({});

export const runRuntimeUpdateSchema = z
  .object({
    launchMode: runRuntimeLaunchModeSchema.nullable().optional(),
    containerName: z.string().min(1).nullable().optional(),
    startedAt: isoDatetimeSchema.nullable().optional(),
    readyAt: isoDatetimeSchema.nullable().optional(),
    finishedAt: isoDatetimeSchema.nullable().optional(),
    exitCode: z.number().int().nullable().optional(),
    exitSignal: z.string().min(1).nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one runtime metadata field must be provided"
  );

export const runInformationCollectionStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
]);

export const runInformationCollectionSlotStatusSchema = z.enum([
  "missing",
  "optional",
  "satisfied",
]);

export const runInformationCollectionSlotTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "enum",
  "file",
  "directory",
  "json",
]);

export const runInformationCollectionSlotChoiceSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1).nullable().default(null),
});

export const runInformationCollectionSlotSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  type: runInformationCollectionSlotTypeSchema,
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  repeatable: z.boolean().default(false),
  prompt: z.string().min(1).nullable().default(null),
  description: z.string().min(1).nullable().default(null),
  placeholder: z.string().min(1).nullable().default(null),
  choices: z.array(runInformationCollectionSlotChoiceSchema).default([]),
  accepts: z.array(z.string().min(1)).default([]),
  status: runInformationCollectionSlotStatusSchema.default("optional"),
  attachmentCount: z.number().int().nonnegative().default(0),
  answerCount: z.number().int().nonnegative().default(0),
  lastAnswerText: z.string().min(1).nullable().default(null),
  lastSatisfiedAt: isoDatetimeSchema.nullable().default(null),
});

export const runInformationCollectionAnswerKindSchema = z.enum([
  "text",
  "attachment",
]);

export const runInformationCollectionAnswerSourceSchema = z.enum([
  "user-message",
  "manual-review",
]);

export const runInformationCollectionAnswerReviewStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "superseded",
]);

export const runInformationCollectionAnswerSchema = z.object({
  answerId: z.string().min(1),
  slotKey: z.string().min(1),
  slotType: runInformationCollectionSlotTypeSchema,
  kind: runInformationCollectionAnswerKindSchema,
  source: runInformationCollectionAnswerSourceSchema.default("user-message"),
  sourceMessageId: z.string().min(1),
  valueText: z.string().min(1).nullable().default(null),
  attachmentPath: z.string().min(1).nullable().default(null),
  attachmentLabel: z.string().min(1).nullable().default(null),
  reviewStatus: runInformationCollectionAnswerReviewStatusSchema.default("pending"),
  reviewedAt: isoDatetimeSchema.nullable().default(null),
  reviewedByUserId: userIdSchema.nullable().default(null),
  reviewNote: z.string().max(2000).nullable().default(null),
  supersedesAnswerId: z.string().min(1).nullable().default(null),
  supersededByAnswerId: z.string().min(1).nullable().default(null),
  createdAt: isoDatetimeSchema,
});

export const runInformationCollectionSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .default("请问你需要我提供什么信息给你。"),
  slotSchemaVersion: z.string().min(1).nullable().default(null),
  status: runInformationCollectionStatusSchema.default("pending"),
  requiredCount: z.number().int().nonnegative().default(0),
  satisfiedCount: z.number().int().nonnegative().default(0),
  missingCount: z.number().int().nonnegative().default(0),
  userMessageCount: z.number().int().nonnegative().default(0),
  attachmentCount: z.number().int().nonnegative().default(0),
  pendingReviewCount: z.number().int().nonnegative().default(0),
  approvedReviewCount: z.number().int().nonnegative().default(0),
  rejectedReviewCount: z.number().int().nonnegative().default(0),
  lastUpdatedAt: isoDatetimeSchema.nullable().default(null),
  slots: z.array(runInformationCollectionSlotSchema).default([]),
  answers: z.array(runInformationCollectionAnswerSchema).default([]),
});

const runInformationCollectionDefaults = runInformationCollectionSchema.parse({});

export const runConversationAttachmentSchema = z.object({
  path: z.string().min(1),
  label: z.string().min(1),
  slotKey: z.string().min(1).nullable().default(null),
});

export const runConversationSlotValueSchema = z.object({
  slotKey: z.string().min(1),
  valueText: z.string().min(1).max(4000),
});

export const runConversationMessageSchema = z.object({
  messageId: z.string().min(1),
  runId: runIdSchema,
  role: messageRoleSchema,
  kind: messageKindSchema,
  text: z.string().min(1),
  attachments: z.array(runConversationAttachmentSchema).default([]),
  slotValues: z.array(runConversationSlotValueSchema).default([]),
  sequence: z.number().int().nonnegative().nullable().default(null),
  threadId: z.string().trim().min(1).max(240).nullable().default(null),
  turnId: z.string().trim().min(1).max(240).nullable().default(null),
  itemId: z.string().trim().min(1).max(240).nullable().default(null),
  createdAt: isoDatetimeSchema,
});

export const runFileEntrySchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  kind: fileKindSchema,
  sizeBytes: z.number().int().nonnegative().nullable(),
  updatedAt: isoDatetimeSchema,
});

export const runFileSourceSchema = z.enum([
  "target-scan",
  "user-upload",
  "runtime-output",
  "archive",
  "log",
]);

export const runFilePreviewModeSchema = z.enum(["none", "text", "image", "pdf", "download"]);
export const runFileStorageTierSchema = z.enum(["hot", "cold"]);
export const runFileArchiveReasonSchema = z.enum(["terminal-retention", "manual"]);

export const runFileRecordSchema = runFileEntrySchema.extend({
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  logicalPath: z.string().min(1),
  source: runFileSourceSchema,
  mimeType: z.string().min(1).nullable(),
  objectKey: z.string().min(1).nullable(),
  uploadId: uploadIdSchema.nullable(),
  checksum: z.string().length(64).nullable(),
  previewMode: runFilePreviewModeSchema,
  previewable: z.boolean(),
  downloadable: z.boolean(),
  storageTier: runFileStorageTierSchema.default("hot"),
  archivedAt: isoDatetimeSchema.nullable().default(null),
  archivedFromObjectKey: z.string().min(1).nullable().default(null),
  archiveReason: runFileArchiveReasonSchema.nullable().default(null),
  indexedAt: isoDatetimeSchema,
});

export const runFileReadResponseSchema = z.object({
  file: runFileEntrySchema,
  content: z.string(),
  encoding: z.literal("utf8"),
  truncated: z.boolean(),
});

export const runFilePreviewResponseSchema = z.object({
  file: runFileRecordSchema,
  mode: runFilePreviewModeSchema,
  mimeType: z.string().min(1).nullable(),
  content: z.string().nullable(),
  encoding: z.literal("utf8").nullable(),
  truncated: z.boolean(),
  downloadUrl: z.string().min(1).nullable(),
  downloadTicketId: downloadTicketIdSchema.nullable(),
  downloadExpiresAt: isoDatetimeSchema.nullable(),
});

export const runFileIndexFacetCountSchema = z.object({
  key: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const runFileIndexSummarySchema = z.object({
  totalIndexedCount: z.number().int().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  returnedCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  directoryCount: z.number().int().nonnegative(),
  previewableCount: z.number().int().nonnegative(),
  downloadableCount: z.number().int().nonnegative(),
  objectBackedCount: z.number().int().nonnegative(),
  uploadBackedCount: z.number().int().nonnegative(),
  latestUpdatedAt: isoDatetimeSchema.nullable(),
  latestIndexedAt: isoDatetimeSchema.nullable(),
  bySource: z.array(runFileIndexFacetCountSchema),
  byKind: z.array(runFileIndexFacetCountSchema),
  byStorageTier: z.array(runFileIndexFacetCountSchema).default([]),
});

export const listRunFileIndexResponseSchema = z.object({
  mode: z.literal("indexed"),
  summary: runFileIndexSummarySchema,
  items: z.array(runFileRecordSchema),
});

export const runArtifactSchema = z.object({
  artifactId: artifactIdSchema,
  runId: runIdSchema,
  label: z.string().min(1),
  file: runFileEntrySchema,
  status: artifactStatusSchema,
  downloadUrl: z.string().url().nullable().optional(),
});

export const runApprovalKindSchema = z.enum(["general", "quota-override", "mcp-access"]);

export const runApprovalSchema = z.object({
  approvalId: approvalIdSchema,
  runId: runIdSchema,
  kind: runApprovalKindSchema.default("general"),
  relatedResourceRef: z.string().trim().min(1).max(160).nullable().default(null),
  prompt: z.string().min(1),
  state: approvalStateSchema,
  requestedAt: isoDatetimeSchema,
  decidedAt: isoDatetimeSchema.nullable(),
  note: z.string().nullable(),
});

export const createRunResponseSchema = z.object({
  run: runRecordSchema,
  nextPrompt: z.string().min(1),
  informationCollection: runInformationCollectionSchema.default(
    runInformationCollectionDefaults
  ),
});

export const runSnapshotSchema = z.object({
  run: runRecordSchema,
  runtime: runRuntimeMetadataSchema.default(runRuntimeMetadataDefaults),
  provider: resolvedRunProviderSchema.nullable().default(null),
  informationCollection: runInformationCollectionSchema.default(
    runInformationCollectionDefaults
  ),
  messages: z.array(runConversationMessageSchema),
  files: z.array(runFileEntrySchema),
  artifacts: z.array(runArtifactSchema),
  approvals: z.array(runApprovalSchema),
  agentThread: agentThreadSummarySchema.nullable().default(null),
  sessionCaptures: z.array(sessionCaptureSummarySchema).default([]),
});

export const runListStatusCountsSchema = z.object({
  CREATED: z.number().int().nonnegative(),
  READY: z.number().int().nonnegative(),
  QUEUED: z.number().int().nonnegative(),
  STARTING: z.number().int().nonnegative(),
  RUNNING: z.number().int().nonnegative(),
  WAITING_APPROVAL: z.number().int().nonnegative(),
  SUCCEEDED: z.number().int().nonnegative(),
  FAILED: z.number().int().nonnegative(),
  CANCELLED: z.number().int().nonnegative(),
});

export const runListViewStatusCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  approval: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});

export const runAttentionModeCountsSchema = z.object({
  todo: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
});

export const runFacetCountSchema = z.object({
  key: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const runWorkshopFacetSchema = z.object({
  workshopId: runCatalogObjectIdSchema.nullable().default(null),
  title: runCatalogLocalizedTextSchema,
  count: z.number().int().nonnegative(),
});

export const runListSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  pendingApprovalsCount: z.number().int().nonnegative(),
  outputsReadyCount: z.number().int().nonnegative(),
  latestUpdatedAt: isoDatetimeSchema.nullable(),
  byStatus: runListStatusCountsSchema,
  byViewStatus: runListViewStatusCountsSchema,
  byAttentionMode: runAttentionModeCountsSchema,
  byEntrySurface: z.array(runFacetCountSchema),
  byTag: z.array(runFacetCountSchema),
  byWorkshop: z.array(runWorkshopFacetSchema),
});

export const sendRunMessageInputSchema = z.object({
  text: z.string().min(1),
  attachments: z.array(runConversationAttachmentSchema).default([]),
  slotValues: z.array(runConversationSlotValueSchema).default([]),
});

export const approveRunInputSchema = z.object({
  approvalId: approvalIdSchema.optional(),
  approved: z.boolean(),
  note: z.string().max(2000).optional(),
});

export const reviewRunInformationAnswerDecisionSchema = z.enum([
  "approve",
  "reject",
  "revise",
]);

export const reviewRunInformationAnswerInputSchema = z
  .object({
    answerId: z.string().min(1),
    decision: reviewRunInformationAnswerDecisionSchema,
    note: z.string().max(2000).optional(),
    replacementValueText: z.string().min(1).max(4000).optional(),
    replacementAttachmentPath: z.string().min(1).optional(),
    replacementAttachmentLabel: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision !== "revise") {
      return;
    }

    const hasReplacementText = typeof value.replacementValueText === "string";
    const hasReplacementAttachment = typeof value.replacementAttachmentPath === "string";

    if (!hasReplacementText && !hasReplacementAttachment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Revisions must include replacementValueText or replacementAttachmentPath",
        path: ["replacementValueText"],
      });
    }
  });

export const startRunJobPayloadSchema = z.object({
  run: runRecordSchema,
  initialPrompt: z.string().min(1),
  requestedInitialMessage: z.string().min(1).nullable().default(null),
  bindings: createRunBindingSchema.default({
    firstPartyMcpIds: [],
    externalConnectorRefs: [],
    credentialIds: [],
  }),
  credentialMounts: z.array(credentialMountSchema).default([]),
  mcpBindings: z.array(mcpBindingSchema).default([]),
  mcpNetworkPolicies: z.array(mcpNetworkPolicySchema).default([]),
  provider: resolvedRunProviderSchema.nullable().default(null),
});

export const cleanupRunJobPayloadSchema = z.object({
  runId: runIdSchema,
});

export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunPurpose = z.infer<typeof runPurposeSchema>;
export type SessionBootstrapMode = z.infer<typeof sessionBootstrapModeSchema>;
export type RunListViewStatus = z.infer<typeof runListViewStatusSchema>;
export type RunAttentionMode = z.infer<typeof runAttentionModeSchema>;
export type CreateRunBinding = z.infer<typeof createRunBindingSchema>;
export type RunCatalogMetadata = z.infer<typeof runCatalogMetadataSchema>;
export type CreateRunInput = z.input<typeof createRunInputSchema>;
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;
export type CreateRunResponse = z.infer<typeof createRunResponseSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type RunRuntimeLaunchMode = z.infer<typeof runRuntimeLaunchModeSchema>;
export type RunRuntimeMetadata = z.infer<typeof runRuntimeMetadataSchema>;
export type RunRuntimeUpdate = z.infer<typeof runRuntimeUpdateSchema>;
export type RunInformationCollectionStatus = z.infer<
  typeof runInformationCollectionStatusSchema
>;
export type RunInformationCollectionSlotStatus = z.infer<
  typeof runInformationCollectionSlotStatusSchema
>;
export type RunInformationCollectionSlotType = z.infer<
  typeof runInformationCollectionSlotTypeSchema
>;
export type RunInformationCollectionSlotChoice = z.infer<
  typeof runInformationCollectionSlotChoiceSchema
>;
export type RunInformationCollectionSlot = z.infer<
  typeof runInformationCollectionSlotSchema
>;
export type RunInformationCollectionAnswerKind = z.infer<
  typeof runInformationCollectionAnswerKindSchema
>;
export type RunInformationCollectionAnswerSource = z.infer<
  typeof runInformationCollectionAnswerSourceSchema
>;
export type RunInformationCollectionAnswerReviewStatus = z.infer<
  typeof runInformationCollectionAnswerReviewStatusSchema
>;
export type RunInformationCollectionAnswer = z.infer<
  typeof runInformationCollectionAnswerSchema
>;
export type RunInformationCollection = z.infer<
  typeof runInformationCollectionSchema
>;
export type RunConversationAttachment = z.infer<typeof runConversationAttachmentSchema>;
export type RunConversationSlotValue = z.infer<typeof runConversationSlotValueSchema>;
export type RunConversationMessage = z.infer<typeof runConversationMessageSchema>;
export type RunFileEntry = z.infer<typeof runFileEntrySchema>;
export type RunFileSource = z.infer<typeof runFileSourceSchema>;
export type RunFilePreviewMode = z.infer<typeof runFilePreviewModeSchema>;
export type RunFileStorageTier = z.infer<typeof runFileStorageTierSchema>;
export type RunFileArchiveReason = z.infer<typeof runFileArchiveReasonSchema>;
export type RunFileRecord = z.infer<typeof runFileRecordSchema>;
export type RunFileReadResponse = z.infer<typeof runFileReadResponseSchema>;
export type RunFilePreviewResponse = z.infer<typeof runFilePreviewResponseSchema>;
export type RunFileIndexFacetCount = z.infer<typeof runFileIndexFacetCountSchema>;
export type RunFileIndexSummary = z.infer<typeof runFileIndexSummarySchema>;
export type ListRunFileIndexResponse = z.infer<typeof listRunFileIndexResponseSchema>;
export type RunArtifact = z.infer<typeof runArtifactSchema>;
export type RunApprovalKind = z.infer<typeof runApprovalKindSchema>;
export type RunApproval = z.infer<typeof runApprovalSchema>;
export type RunSnapshot = z.infer<typeof runSnapshotSchema>;
export type RunListStatusCounts = z.infer<typeof runListStatusCountsSchema>;
export type RunListViewStatusCounts = z.infer<typeof runListViewStatusCountsSchema>;
export type RunAttentionModeCounts = z.infer<typeof runAttentionModeCountsSchema>;
export type RunFacetCount = z.infer<typeof runFacetCountSchema>;
export type RunWorkshopFacet = z.infer<typeof runWorkshopFacetSchema>;
export type RunListSummary = z.infer<typeof runListSummarySchema>;
export type SendRunMessageInput = z.infer<typeof sendRunMessageInputSchema>;
export type ApproveRunInput = z.infer<typeof approveRunInputSchema>;
export type ReviewRunInformationAnswerDecision = z.infer<
  typeof reviewRunInformationAnswerDecisionSchema
>;
export type ReviewRunInformationAnswerInput = z.infer<
  typeof reviewRunInformationAnswerInputSchema
>;
export type StartRunJobPayload = z.infer<typeof startRunJobPayloadSchema>;
export type CleanupRunJobPayload = z.infer<typeof cleanupRunJobPayloadSchema>;
