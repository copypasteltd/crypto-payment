import { z } from "zod";
import { localizedTextSchema, serviceIdSchema, workshopIdSchema, workspaceContextKeySchema } from "./catalog.js";
import {
  creatorPackageIdSchema,
  creatorPackageStateSchema,
  creatorReleaseActivationIdSchema,
  creatorReleaseIdSchema,
} from "./creator.js";
import {
  entrySurfaceSchema,
  isoDatetimeSchema,
  runIdSchema,
  sessionIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  userIdSchema,
  workspaceIdSchema,
} from "./common.js";
import {
  createRunBindingSchema,
  runInformationCollectionAnswerKindSchema,
  runInformationCollectionAnswerReviewStatusSchema,
  runInformationCollectionAnswerSourceSchema,
  runInformationCollectionSlotStatusSchema,
  runInformationCollectionSlotTypeSchema,
  runRuntimeLaunchModeSchema,
} from "./runs.js";

export const sessionPackManifestVersion = "lingban.session-pack/v1" as const;
export const sessionPackInheritModeSchema = z.enum(["draft", "consumer"]);
export const sessionPackArchiveSourceSchema = z.enum(["generated", "imported", "runtime-derived"]);

export const sessionPackRuntimeProfileViewSchema = z.object({
  profileId: z.string().trim().min(1).max(160),
  runnerImage: z.string().trim().min(1).max(240).nullable().default(null),
  browserRequired: z.boolean().default(false),
  playwrightRequired: z.boolean().default(false),
});

export const sessionPackSourcePackageViewSchema = z.object({
  packageId: creatorPackageIdSchema,
  title: localizedTextSchema,
  state: creatorPackageStateSchema,
  updatedAt: isoDatetimeSchema,
  workspaceContextKeys: z.array(workspaceContextKeySchema).default([]),
  linkedServiceIds: z.array(serviceIdSchema).default([]),
  linkedWorkshopIds: z.array(workshopIdSchema).default([]),
});

export const sessionPackPublishedTargetSchema = z.object({
  templateKey: z.string().trim().min(1).max(240),
  serviceId: serviceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  entrySurface: entrySurfaceSchema,
  taskVersionId: taskVersionIdSchema,
  sessionVersionId: sessionVersionIdSchema,
  title: localizedTextSchema,
  targetRoot: z.string().trim().min(1).max(512),
  bindings: createRunBindingSchema,
});

export const sessionPackSummarySchema = z.object({
  sessionVersionId: sessionVersionIdSchema,
  sessionId: sessionIdSchema.nullable().default(null),
  displayName: localizedTextSchema,
  summary: localizedTextSchema,
  manifestVersion: z.literal(sessionPackManifestVersion),
  primaryPackageId: creatorPackageIdSchema.nullable().default(null),
  sourcePackageIds: z.array(creatorPackageIdSchema).default([]),
  primaryTaskVersionId: taskVersionIdSchema.nullable().default(null),
  linkedServiceIds: z.array(serviceIdSchema).default([]),
  linkedWorkshopIds: z.array(workshopIdSchema).default([]),
  workspaceContextKeys: z.array(workspaceContextKeySchema).default([]),
  sourcePackageState: creatorPackageStateSchema.nullable().default(null),
  releaseChannel: localizedTextSchema.nullable().default(null),
  runtimeProfile: sessionPackRuntimeProfileViewSchema,
  requiredBindings: createRunBindingSchema,
  expectedRootFiles: z.array(z.string().trim().min(1).max(240)).default([]),
  lineageParentVersionId: sessionVersionIdSchema.nullable().default(null),
  rollbackFromVersionId: sessionVersionIdSchema.nullable().default(null),
  inheritMode: sessionPackInheritModeSchema.nullable().default(null),
  consumerRunId: runIdSchema.nullable().default(null),
  consumerWorkspaceId: workspaceIdSchema.nullable().default(null),
  consumerServiceId: serviceIdSchema.nullable().default(null),
  consumerWorkshopId: workshopIdSchema.nullable().default(null),
  consumerEntrySurface: entrySurfaceSchema.nullable().default(null),
  consumerTargetPath: z.string().trim().min(1).max(512).nullable().default(null),
  publishedTargetCount: z.number().int().nonnegative().default(0),
  persistedArchive: z.boolean().default(false),
  archiveSource: sessionPackArchiveSourceSchema.default("generated"),
  archiveFileName: z.string().trim().min(1).max(240).nullable().default(null),
  archiveSizeBytes: z.number().int().nonnegative().nullable().default(null),
  archiveRecordedAt: isoDatetimeSchema.nullable().default(null),
  runtimeSourceRunId: runIdSchema.nullable().default(null),
  runtimeSourceTargetPath: z.string().trim().min(1).max(1024).nullable().default(null),
  runtimeSourceUpdatedAt: isoDatetimeSchema.nullable().default(null),
  updatedAt: isoDatetimeSchema,
});

export const sessionPackInformationCollectionReviewAnswerTraceSchema = z.object({
  answerId: z.string().trim().min(1).max(240),
  kind: runInformationCollectionAnswerKindSchema,
  source: runInformationCollectionAnswerSourceSchema,
  sourceMessageId: z.string().trim().min(1).max(240),
  reviewStatus: runInformationCollectionAnswerReviewStatusSchema,
  reviewedAt: isoDatetimeSchema.nullable().default(null),
  reviewedByUserId: userIdSchema.nullable().default(null),
  supersedesAnswerId: z.string().trim().min(1).max(240).nullable().default(null),
  supersededByAnswerId: z.string().trim().min(1).max(240).nullable().default(null),
  createdAt: isoDatetimeSchema,
});

export const sessionPackInformationCollectionReviewSlotSummarySchema = z.object({
  key: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(240),
  type: runInformationCollectionSlotTypeSchema,
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  status: runInformationCollectionSlotStatusSchema,
  answerCount: z.number().int().nonnegative().default(0),
  trackedAnswerCount: z.number().int().nonnegative().default(0),
  userMessageAnswerCount: z.number().int().nonnegative().default(0),
  manualReviewAnswerCount: z.number().int().nonnegative().default(0),
  revisionCount: z.number().int().nonnegative().default(0),
  pendingReviewCount: z.number().int().nonnegative().default(0),
  approvedReviewCount: z.number().int().nonnegative().default(0),
  rejectedReviewCount: z.number().int().nonnegative().default(0),
  supersededReviewCount: z.number().int().nonnegative().default(0),
  lastAnsweredAt: isoDatetimeSchema.nullable().default(null),
  lastReviewedAt: isoDatetimeSchema.nullable().default(null),
  latestAnswerId: z.string().trim().min(1).max(240).nullable().default(null),
  latestSource: runInformationCollectionAnswerSourceSchema.nullable().default(null),
  latestSourceMessageId: z.string().trim().min(1).max(240).nullable().default(null),
  effectiveAnswerId: z.string().trim().min(1).max(240).nullable().default(null),
  effectiveSource: runInformationCollectionAnswerSourceSchema.nullable().default(null),
  effectiveSourceMessageId: z.string().trim().min(1).max(240).nullable().default(null),
  answers: z.array(sessionPackInformationCollectionReviewAnswerTraceSchema).default([]),
});

export const sessionPackInformationCollectionReviewSummarySchema = z.object({
  slotSchemaVersion: z.string().trim().min(1).max(160).nullable().default(null),
  totalSlots: z.number().int().nonnegative().default(0),
  requiredSlots: z.number().int().nonnegative().default(0),
  satisfiedSlots: z.number().int().nonnegative().default(0),
  totalAnswers: z.number().int().nonnegative().default(0),
  userMessageAnswerCount: z.number().int().nonnegative().default(0),
  manualReviewAnswerCount: z.number().int().nonnegative().default(0),
  revisionCount: z.number().int().nonnegative().default(0),
  pendingReviewCount: z.number().int().nonnegative().default(0),
  approvedReviewCount: z.number().int().nonnegative().default(0),
  rejectedReviewCount: z.number().int().nonnegative().default(0),
  supersededReviewCount: z.number().int().nonnegative().default(0),
  latestAnsweredAt: isoDatetimeSchema.nullable().default(null),
  latestReviewedAt: isoDatetimeSchema.nullable().default(null),
  slots: z.array(sessionPackInformationCollectionReviewSlotSummarySchema).default([]),
});

export const sessionPackRedactionTargetKindSchema = z.enum([
  "text",
  "file-path",
  "json-path",
  "header",
  "cookie",
]);

export const sessionPackRedactionStrategySchema = z.enum([
  "mask",
  "remove",
  "replace",
  "hash",
]);

export const sessionPackRedactionRuleSummarySchema = z.object({
  ruleId: z.string().trim().min(1).max(160),
  slotKey: z.string().trim().min(1).max(160).nullable().default(null),
  targetKind: sessionPackRedactionTargetKindSchema,
  selector: z.string().trim().min(1).max(1024),
  strategy: sessionPackRedactionStrategySchema,
  replacement: z.string().trim().min(1).max(1024).nullable().default(null),
  rationale: z.string().trim().min(1).max(500).nullable().default(null),
  linkedSlotExists: z.boolean().default(false),
  linkedSecretSlot: z.boolean().default(false),
  previewMatched: z.boolean().default(false),
  previewMatchCount: z.number().int().nonnegative().default(0),
  previewMutatedEntries: z.array(z.string().trim().min(1).max(1024)).default([]),
});

export const sessionPackRedactionRuleInputSchema = z
  .object({
    ruleId: z.string().trim().min(1).max(160),
    slotKey: z.string().trim().min(1).max(160).optional(),
    targetKind: sessionPackRedactionTargetKindSchema,
    selector: z.string().trim().min(1).max(1024),
    strategy: sessionPackRedactionStrategySchema,
    replacement: z.string().trim().min(1).max(1024).optional(),
    rationale: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.strategy === "replace" && !value.replacement) {
      context.addIssue({
        code: "custom",
        path: ["replacement"],
        message: "replacement is required when strategy is replace",
      });
    }
  });

export const sessionPackRedactionSummarySchema = z.object({
  mapVersion: z.string().trim().min(1).max(160).nullable().default(null),
  slotSchemaVersion: z.string().trim().min(1).max(160).nullable().default(null),
  totalRules: z.number().int().nonnegative().default(0),
  linkedSlotRuleCount: z.number().int().nonnegative().default(0),
  linkedSecretSlotRuleCount: z.number().int().nonnegative().default(0),
  unlinkedRuleCount: z.number().int().nonnegative().default(0),
  orphanSlotKeyCount: z.number().int().nonnegative().default(0),
  secretSlotCount: z.number().int().nonnegative().default(0),
  coveredSecretSlotCount: z.number().int().nonnegative().default(0),
  uncoveredSecretSlotCount: z.number().int().nonnegative().default(0),
  secretCoverageComplete: z.boolean().default(false),
  targetKinds: z.array(sessionPackRedactionTargetKindSchema).default([]),
  strategies: z.array(sessionPackRedactionStrategySchema).default([]),
  schemaSecretSlotKeys: z.array(z.string().trim().min(1).max(160)).default([]),
  curatedSecretSlotKeys: z.array(z.string().trim().min(1).max(160)).default([]),
  secretSlotKeys: z.array(z.string().trim().min(1).max(160)).default([]),
  coveredSecretSlotKeys: z.array(z.string().trim().min(1).max(160)).default([]),
  uncoveredSecretSlotKeys: z.array(z.string().trim().min(1).max(160)).default([]),
  orphanSlotKeys: z.array(z.string().trim().min(1).max(160)).default([]),
  previewMatchedRuleCount: z.number().int().nonnegative().default(0),
  previewTotalMatches: z.number().int().nonnegative().default(0),
  previewMutatedEntries: z.array(z.string().trim().min(1).max(1024)).default([]),
  previewUnmatchedRuleIds: z.array(z.string().trim().min(1).max(160)).default([]),
  previewError: z.string().trim().min(1).max(2000).nullable().default(null),
  rules: z.array(sessionPackRedactionRuleSummarySchema).default([]),
});

export const sessionPackRedactionReviewDecisionSchema = z.enum([
  "approved",
  "changes_requested",
]);

export const sessionPackRedactionReviewSummarySchema = z.object({
  decision: sessionPackRedactionReviewDecisionSchema,
  reviewedAt: isoDatetimeSchema,
  reviewedByUserId: userIdSchema.nullable().default(null),
  note: z.string().trim().min(1).max(2000).nullable().default(null),
  mapVersion: z.string().trim().min(1).max(160).nullable().default(null),
  totalRules: z.number().int().nonnegative().default(0),
  previewMatchedRuleCount: z.number().int().nonnegative().default(0),
  secretCoverageComplete: z.boolean().default(false),
});

export const sessionPackArchiveExportAuditEntrySchema = z.object({
  exportId: z.string().trim().min(1).max(160),
  exportedAt: isoDatetimeSchema,
  exportedByUserId: userIdSchema.nullable().default(null),
  workspaceContextKey: workspaceContextKeySchema.nullable().default(null),
  redacted: z.boolean().default(false),
  archiveSource: sessionPackArchiveSourceSchema.default("generated"),
  archiveFileName: z.string().trim().min(1).max(240),
  archiveSizeBytes: z.number().int().nonnegative().default(0),
  archiveSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest"),
});

export const sessionPackArchiveExportAuditSummarySchema = z.object({
  totalExports: z.number().int().nonnegative().default(0),
  redactedExportCount: z.number().int().nonnegative().default(0),
  plainExportCount: z.number().int().nonnegative().default(0),
  latestExportedAt: isoDatetimeSchema.nullable().default(null),
  latestRedactedExportedAt: isoDatetimeSchema.nullable().default(null),
  entries: z.array(sessionPackArchiveExportAuditEntrySchema).default([]),
});

const sessionPackRuntimeEvidenceSha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");

export const sessionPackRuntimeEvidenceEntrySchema = z.object({
  evidenceId: z.string().trim().min(1).max(200),
  capturedAt: isoDatetimeSchema,
  archiveSource: sessionPackArchiveSourceSchema.default("runtime-derived"),
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  requestedByUserId: userIdSchema.nullable().default(null),
  targetPath: z.string().trim().min(1).max(1024),
  launchMode: runRuntimeLaunchModeSchema.nullable().default(null),
  containerName: z.string().trim().min(1).max(240).nullable().default(null),
  startedAt: isoDatetimeSchema.nullable().default(null),
  readyAt: isoDatetimeSchema.nullable().default(null),
  finishedAt: isoDatetimeSchema.nullable().default(null),
  exitCode: z.number().int().nullable().default(null),
  exitSignal: z.string().trim().min(1).max(120).nullable().default(null),
  runtimeProfileId: z.string().trim().min(1).max(160).nullable().default(null),
  runnerImage: z.string().trim().min(1).max(240).nullable().default(null),
  manifestRuntimeDerived: z.boolean().default(false),
  runtimeSourceUpdatedAt: isoDatetimeSchema.nullable().default(null),
  archiveSha256: sessionPackRuntimeEvidenceSha256Schema.nullable().default(null),
  archiveFileName: z.string().trim().min(1).max(240).nullable().default(null),
  workspaceBaseCaptured: z.boolean().default(false),
  workspaceBaseCaptureError: z.string().trim().min(1).max(2000).nullable().default(null),
});

export const sessionPackRuntimeEvidenceSummarySchema = z.object({
  totalRecords: z.number().int().nonnegative().default(0),
  latestCapturedAt: isoDatetimeSchema.nullable().default(null),
  latestRunId: runIdSchema.nullable().default(null),
  latestLaunchMode: runRuntimeLaunchModeSchema.nullable().default(null),
  containerizedRecordCount: z.number().int().nonnegative().default(0),
  currentRunId: runIdSchema.nullable().default(null),
  hasCurrentRunRecord: z.boolean().default(false),
  items: z.array(sessionPackRuntimeEvidenceEntrySchema).default([]),
});

export const sessionPackConsumerGovernanceEntrySchema = z.object({
  sessionVersionId: sessionVersionIdSchema,
  sessionId: sessionIdSchema.nullable().default(null),
  displayName: localizedTextSchema,
  summary: localizedTextSchema,
  inheritMode: sessionPackInheritModeSchema.nullable().default(null),
  isCurrent: z.boolean().default(false),
  depth: z.number().int().nonnegative().default(0),
  viaSessionVersionId: sessionVersionIdSchema.nullable().default(null),
  workspaceContextKeys: z.array(workspaceContextKeySchema).default([]),
  linkedServiceIds: z.array(serviceIdSchema).default([]),
  linkedWorkshopIds: z.array(workshopIdSchema).default([]),
  consumerRunId: runIdSchema.nullable().default(null),
  consumerWorkspaceId: workspaceIdSchema.nullable().default(null),
  consumerServiceId: serviceIdSchema.nullable().default(null),
  consumerWorkshopId: workshopIdSchema.nullable().default(null),
  consumerEntrySurface: entrySurfaceSchema.nullable().default(null),
  consumerTargetPath: z.string().trim().min(1).max(512).nullable().default(null),
  archiveSource: sessionPackArchiveSourceSchema.default("generated"),
  publishedTargetCount: z.number().int().nonnegative().default(0),
  runtimeSourceRunId: runIdSchema.nullable().default(null),
  runtimeSourceTargetPath: z.string().trim().min(1).max(1024).nullable().default(null),
  runtimeSourceUpdatedAt: isoDatetimeSchema.nullable().default(null),
  updatedAt: isoDatetimeSchema,
});

export const sessionPackConsumerGovernanceSummarySchema = z.object({
  totalConsumerVersions: z.number().int().nonnegative().default(0),
  workspaceIds: z.array(workspaceIdSchema).default([]),
  serviceIds: z.array(serviceIdSchema).default([]),
  entrySurfaces: z.array(entrySurfaceSchema).default([]),
  items: z.array(sessionPackConsumerGovernanceEntrySchema).default([]),
});

export const sessionPackGovernanceStateSchema = z.enum([
  "package-baseline",
  "published",
  "draft-derived",
  "consumer-derived",
  "runtime-derived",
  "imported",
  "unpublished",
]);

export const sessionPackGovernanceRiskLevelSchema = z.enum(["none", "low", "medium", "high"]);

export const sessionPackGovernanceFlagSchema = z.enum([
  "published_targets_attached",
  "live_consumer_versions_visible",
  "unpublished_with_live_consumers",
  "draft_descendants_present",
  "consumer_descendants_present",
  "rollback_descendants_present",
  "runtime_evidence_present",
  "drift_from_package_baseline",
  "missing_persisted_archive",
]);

export const sessionPackGovernanceDiffFieldSchema = z.enum([
  "inherit_mode",
  "lineage_parent_version_id",
  "consumer_run_id",
  "consumer_workspace_id",
  "consumer_service_id",
  "consumer_workshop_id",
  "consumer_entry_surface",
  "consumer_target_path",
  "workspace_context_keys",
  "linked_service_ids",
  "linked_workshop_ids",
  "runtime_profile",
  "required_bindings",
  "published_target_count",
  "expected_root_files",
]);

export const sessionPackGovernanceSummarySchema = z.object({
  state: sessionPackGovernanceStateSchema,
  riskLevel: sessionPackGovernanceRiskLevelSchema.default("none"),
  flags: z.array(sessionPackGovernanceFlagSchema).default([]),
  baselineSessionVersionId: sessionVersionIdSchema.nullable().default(null),
  liveConsumerCount: z.number().int().nonnegative().default(0),
  publishedConsumerCount: z.number().int().nonnegative().default(0),
  unpublishedConsumerCount: z.number().int().nonnegative().default(0),
  totalDescendantCount: z.number().int().nonnegative().default(0),
  draftDescendantCount: z.number().int().nonnegative().default(0),
  consumerDescendantCount: z.number().int().nonnegative().default(0),
  rollbackDescendantCount: z.number().int().nonnegative().default(0),
  runtimeEvidenceCount: z.number().int().nonnegative().default(0),
  hasCurrentRuntimeEvidence: z.boolean().default(false),
  latestConsumerUpdatedAt: isoDatetimeSchema.nullable().default(null),
  latestRuntimeEvidenceUpdatedAt: isoDatetimeSchema.nullable().default(null),
  driftCount: z.number().int().nonnegative().default(0),
  driftFieldKeys: z.array(sessionPackGovernanceDiffFieldSchema).default([]),
});

export const sessionPackSignatureAlgorithmSchema = z.enum([
  "sha256",
  "hmac-sha256",
  "ed25519",
]);

export const sessionPackSignatureStatusSchema = z.enum([
  "verified",
  "unsigned-allowed",
  "missing-required",
  "key-unavailable",
  "invalid",
]);

export const sessionPackSignatureDistributionStateSchema = z.enum([
  "not-configured",
  "ready",
  "partial",
  "stale",
]);

export const sessionPackSignatureDistributionTargetChannelSchema = z.enum([
  "api",
  "worker",
  "bridge",
  "external",
]);

export const sessionPackSignatureDistributionTargetSchema = z.object({
  targetId: z.string().trim().min(1).max(160),
  displayName: localizedTextSchema,
  channel: sessionPackSignatureDistributionTargetChannelSchema.default("external"),
  acceptedKeyIds: z.array(z.string().trim().min(1).max(160)).default([]),
  activeKeyId: z.string().trim().min(1).max(160).nullable().default(null),
  acceptsManifestKey: z.boolean().default(false),
  acceptsActiveSigningKey: z.boolean().default(false),
  reportFresh: z.boolean().default(true),
  lastReportedAt: isoDatetimeSchema.nullable().default(null),
});

export const sessionPackSignatureSummarySchema = z.object({
  present: z.boolean().default(false),
  algorithm: sessionPackSignatureAlgorithmSchema.nullable().default(null),
  keyId: z.string().trim().min(1).max(160).nullable().default(null),
  verificationRequired: z.boolean().default(false),
  status: sessionPackSignatureStatusSchema,
  verified: z.boolean().default(false),
  reason: z.string().trim().min(1).max(2000).nullable().default(null),
  signingEnabled: z.boolean().default(false),
  activeSigningReady: z.boolean().default(false),
  activeSigningError: z.string().trim().min(1).max(2000).nullable().default(null),
  activeSigningAlgorithm: sessionPackSignatureAlgorithmSchema.nullable().default(null),
  activeSigningKeyId: z.string().trim().min(1).max(160).nullable().default(null),
  acceptedVerificationKeyIds: z.array(z.string().trim().min(1).max(160)).default([]),
  acceptsDefaultVerificationKey: z.boolean().default(false),
  signatureKeyAcceptedByKeyring: z.boolean().default(false),
  distributionState: sessionPackSignatureDistributionStateSchema.default("not-configured"),
  distributionTargetCount: z.number().int().nonnegative().default(0),
  freshDistributionTargetCount: z.number().int().nonnegative().default(0),
  staleDistributionTargetCount: z.number().int().nonnegative().default(0),
  manifestKeyDistributedTargetCount: z.number().int().nonnegative().default(0),
  manifestKeyMissingTargetCount: z.number().int().nonnegative().default(0),
  manifestKeyDistributedToAllTargets: z.boolean().default(false),
  activeSigningKeyDistributedTargetCount: z.number().int().nonnegative().default(0),
  activeSigningKeyMissingTargetCount: z.number().int().nonnegative().default(0),
  activeSigningKeyDistributedToAllTargets: z.boolean().default(false),
  distributionTargets: z.array(sessionPackSignatureDistributionTargetSchema).default([]),
  matchesActiveSigningAlgorithm: z.boolean().default(false),
  matchesActiveSigningKey: z.boolean().default(false),
});

export const sessionPackGovernancePolicyActionSchema = z.enum([
  "archive-redacted",
  "inherit",
  "publish",
  "rollback",
  "unpublish",
]);

export const sessionPackGovernancePolicyDecisionSchema = z.enum([
  "allow",
  "warn",
  "block",
]);

export const sessionPackGovernancePolicyCheckCodeSchema = z.enum([
  "approved_redaction_review_required",
  "redaction_review_changes_requested",
  "redaction_review_stale",
  "redaction_preview_error",
  "secret_coverage_complete_required",
  "redaction_unmatched_rules_present",
  "verified_signature_required",
  "signature_key_not_in_verification_window",
  "signature_key_distribution_required",
  "active_signing_key_distribution_incomplete",
  "active_signing_alignment_recommended",
  "live_consumers_visible_on_unpublish",
]);

export const sessionPackGovernancePolicyCheckSchema = z.object({
  code: sessionPackGovernancePolicyCheckCodeSchema,
  decision: sessionPackGovernancePolicyDecisionSchema,
  appliesToActions: z.array(sessionPackGovernancePolicyActionSchema).default([]),
  title: localizedTextSchema,
  detail: localizedTextSchema,
});

export const sessionPackGovernancePolicyActionStatusSchema = z.object({
  action: sessionPackGovernancePolicyActionSchema,
  decision: sessionPackGovernancePolicyDecisionSchema,
  blockingCheckCount: z.number().int().nonnegative().default(0),
  warningCheckCount: z.number().int().nonnegative().default(0),
  checkCodes: z.array(sessionPackGovernancePolicyCheckCodeSchema).default([]),
});

export const sessionPackGovernancePolicySummarySchema = z.object({
  evaluatedAt: isoDatetimeSchema,
  requireApprovedRedactionReviewForRedactedExport: z.boolean().default(false),
  requireApprovedRedactionReviewForPublish: z.boolean().default(false),
  requireSuccessfulRedactionPreviewForRedactedExport: z.boolean().default(false),
  requireSuccessfulRedactionPreviewForPublish: z.boolean().default(false),
  requireCompleteSecretCoverageForRedactedExport: z.boolean().default(false),
  requireCompleteSecretCoverageForPublish: z.boolean().default(false),
  requireVerifiedSignatureForInherit: z.boolean().default(false),
  requireVerifiedSignatureForPublish: z.boolean().default(false),
  requireVerifiedSignatureForRollback: z.boolean().default(false),
  requireSignatureKeyAcceptedForPublish: z.boolean().default(false),
  requireSignatureKeyAcceptedForRollback: z.boolean().default(false),
  requireSignatureKeyDistributionForPublish: z.boolean().default(false),
  requireSignatureKeyDistributionForRollback: z.boolean().default(false),
  warnOnActiveSigningKeyDistributionDrift: z.boolean().default(false),
  warnOnUnpublishWithLiveConsumers: z.boolean().default(false),
  checks: z.array(sessionPackGovernancePolicyCheckSchema).default([]),
  actions: z.array(sessionPackGovernancePolicyActionStatusSchema).default([]),
});

export const sessionPackDetailSchema = sessionPackSummarySchema.extend({
  sourceReleaseIds: z.array(creatorReleaseIdSchema).default([]),
  activeActivationIds: z.array(creatorReleaseActivationIdSchema).default([]),
  runtimeAlternativeFiles: z.array(z.string().trim().min(1).max(240)).default([]),
  optionalRootFiles: z.array(z.string().trim().min(1).max(240)).default([]),
  sourcePackages: z.array(sessionPackSourcePackageViewSchema).default([]),
  publishedTargets: z.array(sessionPackPublishedTargetSchema).default([]),
  informationCollectionReview: sessionPackInformationCollectionReviewSummarySchema
    .nullable()
    .default(null),
  redactionSummary: sessionPackRedactionSummarySchema.nullable().default(null),
  redactionReview: sessionPackRedactionReviewSummarySchema.nullable().default(null),
  archiveExportAudit: sessionPackArchiveExportAuditSummarySchema.nullable().default(null),
  runtimeEvidenceSummary: sessionPackRuntimeEvidenceSummarySchema.nullable().default(null),
  governanceSummary: sessionPackGovernanceSummarySchema.nullable().default(null),
  signatureSummary: sessionPackSignatureSummarySchema.nullable().default(null),
  policySummary: sessionPackGovernancePolicySummarySchema.nullable().default(null),
  consumerGovernance: sessionPackConsumerGovernanceSummarySchema.nullable().default(null),
});

export const sessionPackLineageRelationSchema = z.enum([
  "lineage_parent",
  "rollback_source",
  "lineage_child",
  "rollback_child",
]);

export const sessionPackLineageEntrySchema = sessionPackSummarySchema.extend({
  relation: sessionPackLineageRelationSchema,
  depth: z.number().int().positive(),
  viaSessionVersionId: sessionVersionIdSchema.nullable().default(null),
});

export const sessionPackLineageResponseSchema = z.object({
  focus: sessionPackDetailSchema,
  ancestors: z.array(sessionPackLineageEntrySchema).default([]),
  descendants: z.array(sessionPackLineageEntrySchema).default([]),
});

export const listSessionPacksQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  packageId: creatorPackageIdSchema.optional(),
  serviceId: serviceIdSchema.optional(),
  q: z.string().trim().min(1).optional(),
});

export const sessionVersionIdParamsSchema = z.object({
  sessionVersionId: sessionVersionIdSchema,
});

export const importSessionPackArchiveQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
});

export const downloadSessionPackArchiveQuerySchema = z.object({
  redact: z
    .preprocess((value) => {
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") {
          return true;
        }
        if (normalized === "false" || normalized === "0" || normalized === "") {
          return false;
        }
      }
      return value;
    }, z.boolean())
    .optional()
    .default(false),
});

export const updateSessionPackRedactionMapInputSchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  mapVersion: z.string().trim().min(1).max(160).optional(),
  curatedSecretSlotKeys: z.array(z.string().trim().min(1).max(160)).default([]),
  rules: z.array(sessionPackRedactionRuleInputSchema).default([]),
});

export const reviewSessionPackRedactionInputSchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  decision: sessionPackRedactionReviewDecisionSchema,
  note: z.string().trim().min(1).max(2000).optional(),
});

export const importSessionPackArchiveResponseSchema = z.object({
  sessionPack: sessionPackDetailSchema,
  archiveDownloadPath: z.string().trim().min(1).max(512),
  archiveFileName: z.string().trim().min(1).max(240),
  archiveSizeBytes: z.number().int().nonnegative(),
  importedAt: isoDatetimeSchema,
  importedByUserId: userIdSchema.nullable().default(null),
  persistedArchive: z.boolean().default(true),
});

export const updateSessionPackRedactionMapResponseSchema = z.object({
  sessionPack: sessionPackDetailSchema,
  updatedAt: isoDatetimeSchema,
  updatedByUserId: userIdSchema.nullable().default(null),
  totalRules: z.number().int().nonnegative().default(0),
  persistedArchive: z.boolean().default(true),
});

export const reviewSessionPackRedactionResponseSchema = z.object({
  sessionPack: sessionPackDetailSchema,
  reviewedAt: isoDatetimeSchema,
  reviewedByUserId: userIdSchema.nullable().default(null),
  decision: sessionPackRedactionReviewDecisionSchema,
  persistedArchive: z.boolean().default(true),
});

export const inheritSessionPackInputSchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  inheritMode: sessionPackInheritModeSchema.default("draft"),
  newSessionId: sessionIdSchema.optional(),
  newSessionVersionId: sessionVersionIdSchema.optional(),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const inheritSessionPackResponseSchema = z.object({
  sessionPack: sessionPackDetailSchema,
  archiveDownloadPath: z.string().trim().min(1).max(512),
  archiveFileName: z.string().trim().min(1).max(240),
  archiveSizeBytes: z.number().int().nonnegative(),
  inheritedAt: isoDatetimeSchema,
  inheritedByUserId: userIdSchema.nullable().default(null),
  inheritedFromSessionVersionId: sessionVersionIdSchema,
  inheritMode: sessionPackInheritModeSchema.default("draft"),
  createdDraft: z.boolean().default(true),
});

export const publishSessionPackInputSchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  serviceId: serviceIdSchema,
  entrySurface: entrySurfaceSchema.optional(),
  applyToAllEntrySurfaces: z.boolean().default(true),
  taskVersionId: taskVersionIdSchema.optional(),
  title: localizedTextSchema.optional(),
  targetRoot: z.string().trim().min(1).max(512).optional(),
  bindings: createRunBindingSchema.optional(),
});

export const publishSessionPackResponseSchema = z.object({
  sessionPack: sessionPackDetailSchema,
  publishedTargets: z.array(sessionPackPublishedTargetSchema).default([]),
  publishedAt: isoDatetimeSchema,
  publishedByUserId: userIdSchema.nullable().default(null),
  publishedSessionVersionId: sessionVersionIdSchema,
  replacedSessionVersionIds: z.array(sessionVersionIdSchema).default([]),
});

export const rollbackSessionPackInputSchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  serviceId: serviceIdSchema,
  rollbackToSessionVersionId: sessionVersionIdSchema,
  entrySurface: entrySurfaceSchema.optional(),
  applyToAllEntrySurfaces: z.boolean().default(true),
});

export const rollbackSessionPackResponseSchema = z.object({
  sessionPack: sessionPackDetailSchema,
  publishedTargets: z.array(sessionPackPublishedTargetSchema).default([]),
  rolledBackAt: isoDatetimeSchema,
  rolledBackByUserId: userIdSchema.nullable().default(null),
  rolledBackFromSessionVersionId: sessionVersionIdSchema,
  rolledBackToSessionVersionId: sessionVersionIdSchema,
  replacedSessionVersionIds: z.array(sessionVersionIdSchema).default([]),
});

export const unpublishSessionPackInputSchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  serviceId: serviceIdSchema,
  entrySurface: entrySurfaceSchema.optional(),
  applyToAllEntrySurfaces: z.boolean().default(true),
});

export const unpublishSessionPackResponseSchema = z.object({
  sessionPack: sessionPackDetailSchema,
  unpublishedTargets: z.array(sessionPackPublishedTargetSchema).default([]),
  unpublishedAt: isoDatetimeSchema,
  unpublishedByUserId: userIdSchema.nullable().default(null),
  unpublishedSessionVersionId: sessionVersionIdSchema,
  removedTemplateKeys: z.array(z.string().trim().min(1).max(240)).default([]),
});

export type SessionPackRuntimeProfileView = z.infer<typeof sessionPackRuntimeProfileViewSchema>;
export type SessionPackSourcePackageView = z.infer<typeof sessionPackSourcePackageViewSchema>;
export type SessionPackPublishedTarget = z.infer<typeof sessionPackPublishedTargetSchema>;
export type SessionPackArchiveSource = z.infer<typeof sessionPackArchiveSourceSchema>;
export type SessionPackInformationCollectionReviewSlotSummary = z.infer<
  typeof sessionPackInformationCollectionReviewSlotSummarySchema
>;
export type SessionPackInformationCollectionReviewAnswerTrace = z.infer<
  typeof sessionPackInformationCollectionReviewAnswerTraceSchema
>;
export type SessionPackInformationCollectionReviewSummary = z.infer<
  typeof sessionPackInformationCollectionReviewSummarySchema
>;
export type SessionPackRedactionTargetKind = z.infer<typeof sessionPackRedactionTargetKindSchema>;
export type SessionPackRedactionStrategy = z.infer<typeof sessionPackRedactionStrategySchema>;
export type SessionPackRedactionRuleSummary = z.infer<typeof sessionPackRedactionRuleSummarySchema>;
export type SessionPackRedactionRuleInput = z.input<typeof sessionPackRedactionRuleInputSchema>;
export type SessionPackRedactionSummary = z.infer<typeof sessionPackRedactionSummarySchema>;
export type SessionPackRedactionReviewDecision = z.infer<
  typeof sessionPackRedactionReviewDecisionSchema
>;
export type SessionPackRedactionReviewSummary = z.infer<
  typeof sessionPackRedactionReviewSummarySchema
>;
export type SessionPackArchiveExportAuditEntry = z.infer<
  typeof sessionPackArchiveExportAuditEntrySchema
>;
export type SessionPackArchiveExportAuditSummary = z.infer<
  typeof sessionPackArchiveExportAuditSummarySchema
>;
export type SessionPackRuntimeEvidenceEntry = z.infer<
  typeof sessionPackRuntimeEvidenceEntrySchema
>;
export type SessionPackRuntimeEvidenceSummary = z.infer<
  typeof sessionPackRuntimeEvidenceSummarySchema
>;
export type SessionPackConsumerGovernanceEntry = z.infer<
  typeof sessionPackConsumerGovernanceEntrySchema
>;
export type SessionPackConsumerGovernanceSummary = z.infer<
  typeof sessionPackConsumerGovernanceSummarySchema
>;
export type SessionPackGovernanceState = z.infer<typeof sessionPackGovernanceStateSchema>;
export type SessionPackGovernanceRiskLevel = z.infer<typeof sessionPackGovernanceRiskLevelSchema>;
export type SessionPackGovernanceFlag = z.infer<typeof sessionPackGovernanceFlagSchema>;
export type SessionPackGovernanceDiffField = z.infer<typeof sessionPackGovernanceDiffFieldSchema>;
export type SessionPackGovernanceSummary = z.infer<typeof sessionPackGovernanceSummarySchema>;
export type SessionPackSignatureAlgorithm = z.infer<typeof sessionPackSignatureAlgorithmSchema>;
export type SessionPackSignatureStatus = z.infer<typeof sessionPackSignatureStatusSchema>;
export type SessionPackSignatureDistributionState = z.infer<
  typeof sessionPackSignatureDistributionStateSchema
>;
export type SessionPackSignatureDistributionTargetChannel = z.infer<
  typeof sessionPackSignatureDistributionTargetChannelSchema
>;
export type SessionPackSignatureDistributionTarget = z.infer<
  typeof sessionPackSignatureDistributionTargetSchema
>;
export type SessionPackSignatureSummary = z.infer<typeof sessionPackSignatureSummarySchema>;
export type SessionPackGovernancePolicyAction = z.infer<
  typeof sessionPackGovernancePolicyActionSchema
>;
export type SessionPackGovernancePolicyDecision = z.infer<
  typeof sessionPackGovernancePolicyDecisionSchema
>;
export type SessionPackGovernancePolicyCheckCode = z.infer<
  typeof sessionPackGovernancePolicyCheckCodeSchema
>;
export type SessionPackGovernancePolicyCheck = z.infer<
  typeof sessionPackGovernancePolicyCheckSchema
>;
export type SessionPackGovernancePolicyActionStatus = z.infer<
  typeof sessionPackGovernancePolicyActionStatusSchema
>;
export type SessionPackGovernancePolicySummary = z.infer<
  typeof sessionPackGovernancePolicySummarySchema
>;
export type SessionPackSummary = z.infer<typeof sessionPackSummarySchema>;
export type SessionPackDetail = z.infer<typeof sessionPackDetailSchema>;
export type SessionPackLineageRelation = z.infer<typeof sessionPackLineageRelationSchema>;
export type SessionPackLineageEntry = z.infer<typeof sessionPackLineageEntrySchema>;
export type SessionPackLineageResponse = z.infer<typeof sessionPackLineageResponseSchema>;
export type ListSessionPacksQuery = z.infer<typeof listSessionPacksQuerySchema>;
export type ImportSessionPackArchiveQuery = z.infer<typeof importSessionPackArchiveQuerySchema>;
export type DownloadSessionPackArchiveQuery = z.input<typeof downloadSessionPackArchiveQuerySchema>;
export type UpdateSessionPackRedactionMapInput = z.input<typeof updateSessionPackRedactionMapInputSchema>;
export type ReviewSessionPackRedactionInput = z.input<typeof reviewSessionPackRedactionInputSchema>;
export type ImportSessionPackArchiveResponse = z.infer<typeof importSessionPackArchiveResponseSchema>;
export type UpdateSessionPackRedactionMapResponse = z.infer<typeof updateSessionPackRedactionMapResponseSchema>;
export type ReviewSessionPackRedactionResponse = z.infer<
  typeof reviewSessionPackRedactionResponseSchema
>;
export type SessionPackInheritMode = z.infer<typeof sessionPackInheritModeSchema>;
export type InheritSessionPackInput = z.input<typeof inheritSessionPackInputSchema>;
export type InheritSessionPackResponse = z.infer<typeof inheritSessionPackResponseSchema>;
export type PublishSessionPackInput = z.input<typeof publishSessionPackInputSchema>;
export type PublishSessionPackResponse = z.infer<typeof publishSessionPackResponseSchema>;
export type RollbackSessionPackInput = z.input<typeof rollbackSessionPackInputSchema>;
export type RollbackSessionPackResponse = z.infer<typeof rollbackSessionPackResponseSchema>;
export type UnpublishSessionPackInput = z.input<typeof unpublishSessionPackInputSchema>;
export type UnpublishSessionPackResponse = z.infer<typeof unpublishSessionPackResponseSchema>;
