import { access } from "node:fs/promises";
import { createHash } from "node:crypto";

import {
  entrySurfaceSchema,
  createRunBindingSchema,
  publishSessionPackResponseSchema,
  reviewSessionPackRedactionResponseSchema,
  rollbackSessionPackResponseSchema,
  sessionPackArchiveExportAuditEntrySchema,
  sessionPackArchiveExportAuditSummarySchema,
  unpublishSessionPackResponseSchema,
  runIdSchema,
  sessionIdSchema,
  sessionPackArchiveSourceSchema,
  sessionPackDetailSchema,
  sessionPackConsumerGovernanceSummarySchema,
  sessionPackGovernanceSummarySchema,
  sessionPackGovernancePolicySummarySchema,
  sessionPackInheritModeSchema,
  sessionPackInformationCollectionReviewSummarySchema,
  sessionPackLineageResponseSchema,
  sessionPackManifestVersion,
  sessionPackPublishedTargetSchema,
  sessionPackRedactionReviewDecisionSchema,
  sessionPackRedactionReviewSummarySchema,
  sessionPackRedactionSummarySchema,
  sessionPackRuntimeProfileViewSchema,
  sessionPackRuntimeEvidenceSummarySchema,
  sessionPackSignatureSummarySchema,
  sessionPackSummarySchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  userIdSchema,
  workspaceIdSchema,
  type CreateRunBinding,
  type CreatorPackageDetail,
  type EntrySurface,
  type InheritSessionPackResponse,
  type ImportSessionPackArchiveResponse,
  type ListSessionPacksQuery,
  type LocalizedText,
  type ReviewSessionPackRedactionResponse,
  type SessionPackArchiveExportAuditEntry,
  type SessionPackInheritMode,
  type SessionPackDetail,
  type SessionPackArchiveExportAuditSummary,
  type SessionPackConsumerGovernanceEntry,
  type SessionPackConsumerGovernanceSummary,
  type SessionPackInformationCollectionReviewSummary,
  type SessionPackGovernanceDiffField,
  type SessionPackGovernanceFlag,
  type SessionPackGovernancePolicyAction,
  type SessionPackGovernancePolicyActionStatus,
  type SessionPackGovernancePolicyCheck,
  type SessionPackGovernancePolicyDecision,
  type SessionPackGovernancePolicySummary,
  type SessionPackGovernanceRiskLevel,
  type SessionPackGovernanceState,
  type SessionPackGovernanceSummary,
  type SessionPackLineageEntry,
  type SessionPackLineageRelation,
  type SessionPackLineageResponse,
  type SessionPackPublishedTarget,
  type SessionPackRedactionReviewDecision,
  type SessionPackRedactionReviewSummary,
  type SessionPackRedactionRuleInput,
  type SessionPackRedactionSummary,
  type SessionPackRuntimeEvidenceEntry,
  type SessionPackRuntimeEvidenceSummary,
  type SessionPackRuntimeProfileView,
  type SessionPackSignatureStatus,
  type SessionPackSignatureDistributionState,
  type SessionPackSignatureDistributionTarget,
  type SessionPackSignatureSummary,
  type SessionPackSourcePackageView,
  type SessionPackSummary,
  type RunInformationCollection,
  type UpdateSessionPackRedactionMapResponse,
} from "@lingban/contracts";
import { matchesSearchQuery } from "@lingban/domain-models";
import {
  applySessionPackRedaction,
  createEmptyWorkspaceBaseArchive,
  createWorkspaceBaseArchiveFromDirectory,
  deserializeSessionPackBundle,
  packSessionVersion,
  serializeSessionPackBundle,
  sessionPackInformationCollectionReviewFileName,
  sessionPackInformationCollectionReviewFileSchema,
  sessionPackManifestFileName,
  sessionPackMcpRequirementsFileSchema,
  sessionPackOptionalRootFiles,
  sessionPackRedactionMapSchema,
  sessionPackRequiredRootFiles,
  sessionPackRuntimeEvidenceFileName,
  sessionPackRuntimeAlternativeFiles,
  sessionPackSlotSchemaFileSchema,
  sessionPackWorkspaceBaseFileName,
  signSessionPackBundle,
  verifySessionPackManifestSignature,
  type SessionPackBundle,
  type SessionPackManifest,
  type SessionPackMcpRequirementsFile,
  type SessionPackInformationCollectionReviewFile,
  type SessionPackSignatureVerificationOptions,
  type SessionPackSigningOptions,
  type SessionPackSlotDefinition,
} from "@lingban/session-pack";

import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { creatorRepository } from "../creator/repository.js";
import { runsRepository, type RunAggregate } from "../runs/repository.js";
import { adminRepository } from "../admin/repository.js";
import { workshopCatalogRepository } from "../workshops/repository.js";
import {
  launchTemplateRecordSchema,
  type LaunchTemplateRecord,
  type ServiceCatalogRecord,
} from "../workshops/storage-schema.js";
import { findVersionLineRef } from "./version-line.js";
import {
  resolveImportedSessionArchivePath,
  sessionArchiveRepository,
} from "./repository.js";
import { importedSessionPackRecordSchema, type ImportedSessionPackRecord } from "./storage-schema.js";

type SessionActor = {
  workspaceContextKey?: string | null;
  userId?: string | null;
};

type SessionPackConstraint = {
  workspaceContextKey?: string | null;
  serviceId?: string | null;
  packageId?: string | null;
};

type ExportedSessionPackArchive = {
  content: Uint8Array;
  fileName: string;
  source: "imported" | "runtime-derived" | "generated";
  redacted: boolean;
};

type ExportSessionPackArchiveOptions = {
  redact?: boolean;
};

type UpdateSessionPackRedactionMapInput = {
  workspaceContextKey: string;
  updatedByUserId?: string | null;
  mapVersion?: string | null;
  curatedSecretSlotKeys: string[];
  rules: SessionPackRedactionRuleInput[];
};

type ReviewSessionPackRedactionInput = {
  workspaceContextKey: string;
  reviewedByUserId?: string | null;
  decision: SessionPackRedactionReviewDecision;
  note?: string | null;
};

type InheritSessionPackInput = {
  workspaceContextKey: string;
  inheritedByUserId?: string | null;
  inheritMode?: SessionPackInheritMode;
  newSessionId?: string | null;
  newSessionVersionId?: string | null;
  reason?: string | null;
  consumerWorkspaceId?: string | null;
  consumerRunId?: string | null;
  consumerServiceId?: string | null;
  consumerWorkshopId?: string | null;
  consumerEntrySurface?: EntrySurface | null;
  consumerTargetPath?: string | null;
};

type PublishSessionPackInput = {
  workspaceContextKey: string;
  serviceId: string;
  entrySurface?: EntrySurface | null;
  applyToAllEntrySurfaces: boolean;
  taskVersionId?: string | null;
  title?: LocalizedText | null;
  targetRoot?: string | null;
  bindings?: CreateRunBinding | null;
  publishedByUserId?: string | null;
};

type RollbackSessionPackInput = {
  workspaceContextKey: string;
  serviceId: string;
  rollbackToSessionVersionId: string;
  entrySurface?: EntrySurface | null;
  applyToAllEntrySurfaces: boolean;
  rolledBackByUserId?: string | null;
};

type UnpublishSessionPackInput = {
  workspaceContextKey: string;
  serviceId: string;
  entrySurface?: EntrySurface | null;
  applyToAllEntrySurfaces: boolean;
  unpublishedByUserId?: string | null;
};

type ActiveCreatorActivationSessionVersion = {
  activationId: string;
  releaseId: string;
  packageId: string;
  sessionVersionId: string;
  taskVersionId: string | null;
};

let sessionInfrastructureReady = false;

function nowIso() {
  return new Date().toISOString();
}

function l(zh: string, en: string): LocalizedText {
  return { zh, en };
}

function buildSessionPackSigningOptions(): SessionPackSigningOptions | null {
  const config = getApiRuntimeConfig();
  if (!config.sessionPackSignatureEnabled) {
    return null;
  }

  switch (config.sessionPackSignatureAlgorithm) {
    case "sha256":
      return {
        algorithm: "sha256",
        keyId: config.sessionPackSignatureKeyId,
      };
    case "hmac-sha256":
      if (
        !config.sessionPackSignatureHmacSecret &&
        (!config.sessionPackSignatureKeyId ||
          !config.sessionPackSignatureHmacKeysByKeyId[config.sessionPackSignatureKeyId])
      ) {
        throw new Error(
          "LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET or an active entry in LINGBAN_SESSION_PACK_SIGNATURE_HMAC_KEYS_JSON must be configured when session-pack signature signing is enabled."
        );
      }
      return {
        algorithm: "hmac-sha256",
        secret:
          config.sessionPackSignatureHmacSecret ??
          config.sessionPackSignatureHmacKeysByKeyId[config.sessionPackSignatureKeyId ?? ""],
        keyId: config.sessionPackSignatureKeyId,
      };
    case "ed25519":
      if (!config.sessionPackSignatureEd25519PrivateKeyPem) {
        throw new Error(
          "LINGBAN_SESSION_PACK_SIGNATURE_ED25519_PRIVATE_KEY_PEM must be configured when session-pack signature signing is enabled."
        );
      }
      return {
        algorithm: "ed25519",
        privateKeyPem: config.sessionPackSignatureEd25519PrivateKeyPem,
        publicKeyPem: config.sessionPackSignatureEd25519PublicKeyPem,
        keyId: config.sessionPackSignatureKeyId,
      };
  }
}

function buildSessionPackSignatureVerificationOptions(): SessionPackSignatureVerificationOptions {
  const config = getApiRuntimeConfig();

  return {
    requireSignature: config.sessionPackSignatureRequireForImports,
    hmacSecret: config.sessionPackSignatureHmacSecret,
    hmacSecretsByKeyId:
      Object.keys(config.sessionPackSignatureHmacKeysByKeyId).length > 0
        ? config.sessionPackSignatureHmacKeysByKeyId
        : undefined,
    ed25519PublicKeyPem: config.sessionPackSignatureEd25519PublicKeyPem,
    ed25519PrivateKeyPem: config.sessionPackSignatureEd25519PrivateKeyPem,
    ed25519PublicKeysByKeyId:
      Object.keys(config.sessionPackSignatureEd25519PublicKeysByKeyId).length > 0
        ? config.sessionPackSignatureEd25519PublicKeysByKeyId
        : undefined,
  };
}

function safelyResolveSessionPackSigningOptions() {
  const config = getApiRuntimeConfig();
  if (!config.sessionPackSignatureEnabled) {
    return {
      options: null as SessionPackSigningOptions | null,
      ready: false,
      error: null as string | null,
      signingEnabled: false,
    };
  }

  try {
    return {
      options: buildSessionPackSigningOptions(),
      ready: true,
      error: null,
      signingEnabled: true,
    };
  } catch (error) {
    return {
      options: null,
      ready: false,
      error: error instanceof Error ? error.message : "Unknown session-pack signing configuration error.",
      signingEnabled: true,
    };
  }
}

function deriveSessionPackSignatureStatus(input: {
  signaturePresent: boolean;
  verificationRequired: boolean;
  verificationResult: ReturnType<typeof verifySessionPackManifestSignature>;
}): SessionPackSignatureStatus {
  if (!input.signaturePresent) {
    return input.verificationRequired ? "missing-required" : "unsigned-allowed";
  }

  if (input.verificationResult.ok) {
    return "verified";
  }

  if (
    (input.verificationResult.reason ?? "").includes("No HMAC secret is configured") ||
    (input.verificationResult.reason ?? "").includes("No Ed25519 public key is configured")
  ) {
    return "key-unavailable";
  }

  return "invalid";
}

function parseIsoTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isIsoTimestampFresh(
  value: string | null | undefined,
  staleAfterMs: number,
  referenceTimestampMs: number
) {
  const parsed = parseIsoTimestamp(value);
  if (parsed == null) {
    return true;
  }

  return referenceTimestampMs - parsed <= staleAfterMs;
}

function buildSessionPackSignatureDistributionTargets(input: {
  signatureKeyId: string | null;
  activeSigningKeyId: string | null;
  acceptedTargets: ReturnType<typeof getApiRuntimeConfig>["sessionPackSignatureDistributionTargets"];
  staleAfterMs: number;
  evaluatedAt: string;
}): SessionPackSignatureDistributionTarget[] {
  const referenceTimestampMs = parseIsoTimestamp(input.evaluatedAt) ?? Date.now();

  return input.acceptedTargets.map((target) => {
    const acceptedKeyIds = uniqueStrings(target.acceptedKeyIds);
    return {
      targetId: target.targetId,
      displayName: l(
        target.displayNameZh ?? target.displayName,
        target.displayNameEn ?? target.displayName
      ),
      channel: target.channel,
      acceptedKeyIds,
      activeKeyId: target.activeKeyId,
      acceptsManifestKey: input.signatureKeyId
        ? acceptedKeyIds.includes(input.signatureKeyId)
        : true,
      acceptsActiveSigningKey: input.activeSigningKeyId
        ? acceptedKeyIds.includes(input.activeSigningKeyId)
        : true,
      reportFresh: isIsoTimestampFresh(
        target.lastReportedAt,
        input.staleAfterMs,
        referenceTimestampMs
      ),
      lastReportedAt: target.lastReportedAt,
    } satisfies SessionPackSignatureDistributionTarget;
  });
}

function deriveSessionPackSignatureDistributionState(
  targets: SessionPackSignatureDistributionTarget[]
): SessionPackSignatureDistributionState {
  if (targets.length === 0) {
    return "not-configured";
  }

  if (targets.some((target) => !target.reportFresh)) {
    return "stale";
  }

  if (
    targets.every((target) => target.acceptsManifestKey && target.acceptsActiveSigningKey)
  ) {
    return "ready";
  }

  return "partial";
}

function buildSessionPackSignatureSummary(input: {
  bundle: SessionPackBundle;
  evaluatedAt: string;
}): SessionPackSignatureSummary {
  const verificationOptions = buildSessionPackSignatureVerificationOptions();
  const verificationResult = verifySessionPackManifestSignature(
    input.bundle.manifest,
    verificationOptions
  );
  const signingState = safelyResolveSessionPackSigningOptions();
  const signature = input.bundle.manifest.signature ?? null;
  const config = getApiRuntimeConfig();
  const acceptedVerificationKeyIds = uniqueStrings([
    ...Object.keys(verificationOptions.hmacSecretsByKeyId ?? {}),
    ...Object.keys(verificationOptions.ed25519PublicKeysByKeyId ?? {}),
  ]);
  const acceptsDefaultVerificationKey = Boolean(
    verificationOptions.hmacSecret ||
      verificationOptions.ed25519PublicKeyPem ||
      verificationOptions.ed25519PrivateKeyPem
  );
  const activeSigningAlgorithm = signingState.options?.algorithm ?? null;
  const activeSigningKeyId = signingState.options?.keyId ?? null;
  const signatureKeyAcceptedByKeyring = Boolean(
    !signature?.key_id ||
      acceptedVerificationKeyIds.length === 0 ||
      acceptedVerificationKeyIds.includes(signature.key_id)
  );
  const distributionTargets = buildSessionPackSignatureDistributionTargets({
    signatureKeyId: signature?.key_id ?? null,
    activeSigningKeyId,
    acceptedTargets: config.sessionPackSignatureDistributionTargets,
    staleAfterMs: config.sessionPackSignatureDistributionStaleAfterMs,
    evaluatedAt: input.evaluatedAt,
  });
  const distributionState = deriveSessionPackSignatureDistributionState(distributionTargets);
  const freshDistributionTargetCount = distributionTargets.filter((target) => target.reportFresh).length;
  const staleDistributionTargetCount = distributionTargets.length - freshDistributionTargetCount;
  const manifestKeyDistributedTargetCount = distributionTargets.filter(
    (target) => target.reportFresh && target.acceptsManifestKey
  ).length;
  const manifestKeyMissingTargetCount =
    distributionTargets.length - manifestKeyDistributedTargetCount;
  const manifestKeyDistributedToAllTargets =
    distributionTargets.length > 0 &&
    distributionTargets.every((target) => target.reportFresh && target.acceptsManifestKey);
  const activeSigningKeyDistributedTargetCount = distributionTargets.filter(
    (target) => target.reportFresh && target.acceptsActiveSigningKey
  ).length;
  const activeSigningKeyMissingTargetCount =
    distributionTargets.length - activeSigningKeyDistributedTargetCount;
  const activeSigningKeyDistributedToAllTargets =
    distributionTargets.length > 0 &&
    distributionTargets.every((target) => target.reportFresh && target.acceptsActiveSigningKey);

  return sessionPackSignatureSummarySchema.parse({
    present: Boolean(signature),
    algorithm: signature?.algorithm ?? null,
    keyId: signature?.key_id ?? null,
    verificationRequired: Boolean(verificationOptions.requireSignature),
    status: deriveSessionPackSignatureStatus({
      signaturePresent: Boolean(signature),
      verificationRequired: Boolean(verificationOptions.requireSignature),
      verificationResult,
    }),
    verified: verificationResult.verified,
    reason: verificationResult.reason ?? null,
    signingEnabled: signingState.signingEnabled,
    activeSigningReady: signingState.ready,
    activeSigningError: signingState.error,
    activeSigningAlgorithm,
    activeSigningKeyId,
    acceptedVerificationKeyIds,
    acceptsDefaultVerificationKey,
    signatureKeyAcceptedByKeyring,
    distributionState,
    distributionTargetCount: distributionTargets.length,
    freshDistributionTargetCount,
    staleDistributionTargetCount,
    manifestKeyDistributedTargetCount,
    manifestKeyMissingTargetCount,
    manifestKeyDistributedToAllTargets,
    activeSigningKeyDistributedTargetCount,
    activeSigningKeyMissingTargetCount,
    activeSigningKeyDistributedToAllTargets,
    distributionTargets,
    matchesActiveSigningAlgorithm: Boolean(
      signature && activeSigningAlgorithm && signature.algorithm === activeSigningAlgorithm
    ),
    matchesActiveSigningKey: Boolean(
      signature && (signature.key_id ?? null) === (activeSigningKeyId ?? null)
    ),
  });
}

function buildSessionPackGovernancePolicyCheck(input: {
  code: SessionPackGovernancePolicyCheck["code"];
  decision: SessionPackGovernancePolicyDecision;
  appliesToActions: SessionPackGovernancePolicyAction[];
  titleZh: string;
  titleEn: string;
  detailZh: string;
  detailEn: string;
}): SessionPackGovernancePolicyCheck {
  return {
    code: input.code,
    decision: input.decision,
    appliesToActions: input.appliesToActions,
    title: l(input.titleZh, input.titleEn),
    detail: l(input.detailZh, input.detailEn),
  };
}

function sessionPackGovernancePolicyActionLabel(action: SessionPackGovernancePolicyAction) {
  switch (action) {
    case "archive-redacted":
      return "redacted archive export";
    case "inherit":
      return "inherit";
    case "publish":
      return "publish";
    case "rollback":
      return "rollback";
    case "unpublish":
    default:
      return "unpublish";
  }
}

function summarizeSignatureDistributionTargets(
  targets: SessionPackSignatureDistributionTarget[],
  predicate: (target: SessionPackSignatureDistributionTarget) => boolean
) {
  return targets
    .filter(predicate)
    .map((target) => target.targetId)
    .join(", ");
}

function buildSessionPackGovernancePolicySummary(input: {
  detail: SessionPackDetail;
  redactionSummary: SessionPackRedactionSummary | null;
  redactionReview: SessionPackRedactionReviewSummary | null;
  governanceSummary: SessionPackGovernanceSummary;
  signatureSummary: SessionPackSignatureSummary;
}): SessionPackGovernancePolicySummary {
  const config = getApiRuntimeConfig();
  const checks: SessionPackGovernancePolicyCheck[] = [];
  const signatureGovernanceApplies =
    input.detail.persistedArchive || input.detail.archiveSource !== "generated";
  const redactionSummary = input.redactionSummary;
  const redactionReview = input.redactionReview;
  const redactionScopePresent =
    Boolean(redactionSummary) &&
    ((redactionSummary?.totalRules ?? 0) > 0 || (redactionSummary?.secretSlotCount ?? 0) > 0);
  const redactionReviewRequiredActions: SessionPackGovernancePolicyAction[] = [];
  const successfulPreviewRequiredActions: SessionPackGovernancePolicyAction[] = [];
  const secretCoverageRequiredActions: SessionPackGovernancePolicyAction[] = [];
  const signatureRequiredActions: SessionPackGovernancePolicyAction[] = [];
  const signatureKeyAcceptanceRequiredActions: SessionPackGovernancePolicyAction[] = [];
  const signatureKeyDistributionRequiredActions: SessionPackGovernancePolicyAction[] = [];

  if (config.sessionPackGovernancePolicyRequireApprovedRedactionReviewForRedactedExport) {
    redactionReviewRequiredActions.push("archive-redacted");
  }
  if (config.sessionPackGovernancePolicyRequireApprovedRedactionReviewForPublish) {
    redactionReviewRequiredActions.push("publish");
  }
  if (config.sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForRedactedExport) {
    successfulPreviewRequiredActions.push("archive-redacted");
  }
  if (config.sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForPublish) {
    successfulPreviewRequiredActions.push("publish");
  }
  if (config.sessionPackGovernancePolicyRequireCompleteSecretCoverageForRedactedExport) {
    secretCoverageRequiredActions.push("archive-redacted");
  }
  if (config.sessionPackGovernancePolicyRequireCompleteSecretCoverageForPublish) {
    secretCoverageRequiredActions.push("publish");
  }
  if (
    signatureGovernanceApplies &&
    config.sessionPackGovernancePolicyRequireVerifiedSignatureForInherit
  ) {
    signatureRequiredActions.push("inherit");
  }
  if (
    signatureGovernanceApplies &&
    config.sessionPackGovernancePolicyRequireVerifiedSignatureForPublish
  ) {
    signatureRequiredActions.push("publish");
  }
  if (
    signatureGovernanceApplies &&
    config.sessionPackGovernancePolicyRequireVerifiedSignatureForRollback
  ) {
    signatureRequiredActions.push("rollback");
  }
  if (
    signatureGovernanceApplies &&
    config.sessionPackGovernancePolicyRequireSignatureKeyAcceptedForPublish
  ) {
    signatureKeyAcceptanceRequiredActions.push("publish");
  }
  if (
    signatureGovernanceApplies &&
    config.sessionPackGovernancePolicyRequireSignatureKeyAcceptedForRollback
  ) {
    signatureKeyAcceptanceRequiredActions.push("rollback");
  }
  if (
    signatureGovernanceApplies &&
    config.sessionPackGovernancePolicyRequireSignatureKeyDistributionForPublish
  ) {
    signatureKeyDistributionRequiredActions.push("publish");
  }
  if (
    signatureGovernanceApplies &&
    config.sessionPackGovernancePolicyRequireSignatureKeyDistributionForRollback
  ) {
    signatureKeyDistributionRequiredActions.push("rollback");
  }

  if (redactionScopePresent && redactionReviewRequiredActions.length > 0) {
    if (!redactionReview) {
      checks.push(
        buildSessionPackGovernancePolicyCheck({
          code: "approved_redaction_review_required",
          decision: "block",
          appliesToActions: uniqueStrings(redactionReviewRequiredActions) as SessionPackGovernancePolicyAction[],
          titleZh: "需要脱敏复核批准",
          titleEn: "Approved redaction review required",
          detailZh:
            "当前 session-pack 已定义脱敏规则或敏感槽位，但还没有完成正式的脱敏复核批准，不能继续执行对应动作。",
          detailEn:
            "This session-pack already defines redaction rules or secret slots, but no approved redaction review exists yet, so the affected actions are blocked.",
        })
      );
    } else if (redactionReview.decision !== "approved") {
      checks.push(
        buildSessionPackGovernancePolicyCheck({
          code: "redaction_review_changes_requested",
          decision: "block",
          appliesToActions: uniqueStrings(redactionReviewRequiredActions) as SessionPackGovernancePolicyAction[],
          titleZh: "脱敏复核要求修改",
          titleEn: "Redaction review requested changes",
          detailZh:
            "最近一次脱敏复核结论为需要修改。请先修正规则或敏感位覆盖，再重新提交复核。",
          detailEn:
            "The latest redaction review requested changes. Update the rules or secret-slot coverage before retrying the affected actions.",
        })
      );
    } else if (
      redactionSummary?.mapVersion &&
      redactionReview.mapVersion &&
      redactionReview.mapVersion !== redactionSummary.mapVersion
    ) {
      checks.push(
        buildSessionPackGovernancePolicyCheck({
          code: "redaction_review_stale",
          decision: "block",
          appliesToActions: uniqueStrings(redactionReviewRequiredActions) as SessionPackGovernancePolicyAction[],
          titleZh: "脱敏复核已过期",
          titleEn: "Redaction review is stale",
          detailZh:
            "当前脱敏规则版本已经变化，最近一次复核对应的 mapVersion 已失效。请重新发起脱敏复核。",
          detailEn:
            "The redaction map has changed since the last approved review. Re-run redaction review before continuing.",
        })
      );
    }
  }

  if (
    redactionSummary &&
    successfulPreviewRequiredActions.length > 0 &&
    redactionSummary.previewError
  ) {
    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "redaction_preview_error",
        decision: "block",
        appliesToActions: uniqueStrings(successfulPreviewRequiredActions) as SessionPackGovernancePolicyAction[],
        titleZh: "脱敏预检失败",
        titleEn: "Redaction preview failed",
        detailZh: `当前脱敏预检报错：${redactionSummary.previewError}`,
        detailEn: `The current redaction preview failed: ${redactionSummary.previewError}`,
      })
    );
  }

  if (
    redactionSummary &&
    secretCoverageRequiredActions.length > 0 &&
    redactionSummary.secretSlotCount > 0 &&
    !redactionSummary.secretCoverageComplete
  ) {
    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "secret_coverage_complete_required",
        decision: "block",
        appliesToActions: uniqueStrings(secretCoverageRequiredActions) as SessionPackGovernancePolicyAction[],
        titleZh: "敏感槽位覆盖不完整",
        titleEn: "Secret-slot coverage is incomplete",
        detailZh: `仍有 ${redactionSummary.uncoveredSecretSlotCount} 个敏感槽位未被脱敏规则覆盖，不能继续执行对应动作。`,
        detailEn: `${redactionSummary.uncoveredSecretSlotCount} secret slots are still uncovered by the redaction policy, so the affected actions are blocked.`,
      })
    );
  }

  if (
    redactionSummary &&
    redactionSummary.previewUnmatchedRuleIds.length > 0 &&
    (successfulPreviewRequiredActions.length > 0 || secretCoverageRequiredActions.length > 0)
  ) {
    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "redaction_unmatched_rules_present",
        decision: "warn",
        appliesToActions: uniqueStrings([
          ...successfulPreviewRequiredActions,
          ...secretCoverageRequiredActions,
        ]) as SessionPackGovernancePolicyAction[],
        titleZh: "存在未命中的脱敏规则",
        titleEn: "Unmatched redaction rules detected",
        detailZh: `以下规则在预检中没有命中：${redactionSummary.previewUnmatchedRuleIds.join(", ")}。`,
        detailEn: `These redaction rules did not match anything during preview: ${redactionSummary.previewUnmatchedRuleIds.join(", ")}.`,
      })
    );
  }

  if (
    signatureRequiredActions.length > 0 &&
    input.signatureSummary.status !== "verified"
  ) {
    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "verified_signature_required",
        decision: "block",
        appliesToActions: uniqueStrings(signatureRequiredActions) as SessionPackGovernancePolicyAction[],
        titleZh: "需要通过验签的归档",
        titleEn: "Verified archive signature required",
        detailZh:
          input.signatureSummary.reason
            ? `当前归档未通过验签：${input.signatureSummary.reason}`
            : "当前归档未通过验签，不能继续执行对应动作。",
        detailEn:
          input.signatureSummary.reason
            ? `The current archive signature is not verified: ${input.signatureSummary.reason}`
            : "The current archive signature is not verified, so the affected actions are blocked.",
      })
    );
  }

  if (
    signatureKeyAcceptanceRequiredActions.length > 0 &&
    input.signatureSummary.present &&
    input.signatureSummary.keyId &&
    input.signatureSummary.acceptedVerificationKeyIds.length > 0 &&
    !input.signatureSummary.signatureKeyAcceptedByKeyring
  ) {
    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "signature_key_not_in_verification_window",
        decision: "block",
        appliesToActions:
          uniqueStrings(signatureKeyAcceptanceRequiredActions) as SessionPackGovernancePolicyAction[],
        titleZh: "签名 key 不在当前验签窗口内",
        titleEn: "Manifest signing key is outside the verification window",
        detailZh: `当前归档签名 key ${input.signatureSummary.keyId} 不在运行时接受的验签 key 窗口内。可接受 key 为 ${input.signatureSummary.acceptedVerificationKeyIds.join(", ")}。`,
        detailEn: `The current manifest signing key ${input.signatureSummary.keyId} is outside the runtime verification window. Accepted keys: ${input.signatureSummary.acceptedVerificationKeyIds.join(", ")}.`,
      })
    );
  }

  if (
    signatureKeyDistributionRequiredActions.length > 0 &&
    input.signatureSummary.present &&
    input.signatureSummary.keyId &&
    input.signatureSummary.distributionTargetCount > 0 &&
    !input.signatureSummary.manifestKeyDistributedToAllTargets
  ) {
    const staleTargets = summarizeSignatureDistributionTargets(
      input.signatureSummary.distributionTargets,
      (target) => !target.reportFresh
    );
    const missingTargets = summarizeSignatureDistributionTargets(
      input.signatureSummary.distributionTargets,
      (target) => target.reportFresh && !target.acceptsManifestKey
    );
    const detailZhParts = [
      `当前归档签名 key ${input.signatureSummary.keyId} 未完成全部分发覆盖。`,
      `已覆盖 ${input.signatureSummary.manifestKeyDistributedTargetCount}/${input.signatureSummary.distributionTargetCount} 个目标。`,
    ];
    const detailEnParts = [
      `The current manifest signing key ${input.signatureSummary.keyId} is not fully distributed.`,
      `Coverage is ${input.signatureSummary.manifestKeyDistributedTargetCount}/${input.signatureSummary.distributionTargetCount} targets.`,
    ];

    if (missingTargets) {
      detailZhParts.push(`缺少该 key 的目标：${missingTargets}。`);
      detailEnParts.push(`Targets missing this key: ${missingTargets}.`);
    }
    if (staleTargets) {
      detailZhParts.push(`分发状态已过期的目标：${staleTargets}。`);
      detailEnParts.push(`Targets with stale distribution state: ${staleTargets}.`);
    }

    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "signature_key_distribution_required",
        decision: "block",
        appliesToActions:
          uniqueStrings(signatureKeyDistributionRequiredActions) as SessionPackGovernancePolicyAction[],
        titleZh: "签名 key 尚未完成目标分发",
        titleEn: "Manifest signing key is not fully distributed",
        detailZh: detailZhParts.join(" "),
        detailEn: detailEnParts.join(" "),
      })
    );
  }

  if (
    signatureGovernanceApplies &&
    config.sessionPackGovernancePolicyWarnOnActiveSigningKeyDistributionDrift &&
    input.signatureSummary.activeSigningKeyId &&
    input.signatureSummary.distributionTargetCount > 0 &&
    !input.signatureSummary.activeSigningKeyDistributedToAllTargets
  ) {
    const staleTargets = summarizeSignatureDistributionTargets(
      input.signatureSummary.distributionTargets,
      (target) => !target.reportFresh
    );
    const missingTargets = summarizeSignatureDistributionTargets(
      input.signatureSummary.distributionTargets,
      (target) => target.reportFresh && !target.acceptsActiveSigningKey
    );
    const detailZhParts = [
      `当前激活签名 key ${input.signatureSummary.activeSigningKeyId} 尚未覆盖全部目标。`,
      `已覆盖 ${input.signatureSummary.activeSigningKeyDistributedTargetCount}/${input.signatureSummary.distributionTargetCount} 个目标。`,
    ];
    const detailEnParts = [
      `The active signing key ${input.signatureSummary.activeSigningKeyId} has not reached every distribution target yet.`,
      `Coverage is ${input.signatureSummary.activeSigningKeyDistributedTargetCount}/${input.signatureSummary.distributionTargetCount} targets.`,
    ];

    if (missingTargets) {
      detailZhParts.push(`缺少激活 key 的目标：${missingTargets}。`);
      detailEnParts.push(`Targets missing the active key: ${missingTargets}.`);
    }
    if (staleTargets) {
      detailZhParts.push(`分发状态已过期的目标：${staleTargets}。`);
      detailEnParts.push(`Targets with stale distribution state: ${staleTargets}.`);
    }

    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "active_signing_key_distribution_incomplete",
        decision: "warn",
        appliesToActions: ["inherit", "publish", "rollback"],
        titleZh: "当前激活签名 key 分发未完成",
        titleEn: "Active signing key distribution is incomplete",
        detailZh: detailZhParts.join(" "),
        detailEn: detailEnParts.join(" "),
      })
    );
  }

  if (
    signatureGovernanceApplies &&
    input.signatureSummary.present &&
    (!input.signatureSummary.matchesActiveSigningAlgorithm ||
      !input.signatureSummary.matchesActiveSigningKey)
  ) {
    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "active_signing_alignment_recommended",
        decision: "warn",
        appliesToActions: ["inherit", "publish", "rollback"],
        titleZh: "签名策略与当前运行时未完全对齐",
        titleEn: "Archive signing is not fully aligned with the active runtime policy",
        detailZh:
          "当前归档的签名算法或 key 与运行时激活策略不完全一致。继续执行前应先确认签名轮换与兼容窗口。",
        detailEn:
          "The archive signature algorithm or key does not fully match the active runtime signing policy. Review key rotation and compatibility windows before continuing.",
      })
    );
  }

  if (
    config.sessionPackGovernancePolicyWarnOnUnpublishWithLiveConsumers &&
    input.governanceSummary.liveConsumerCount > 0
  ) {
    checks.push(
      buildSessionPackGovernancePolicyCheck({
        code: "live_consumers_visible_on_unpublish",
        decision: "warn",
        appliesToActions: ["unpublish"],
        titleZh: "下线后仍有可见消费版本",
        titleEn: "Live consumer versions remain visible",
        detailZh: `当前可见消费版本数为 ${input.governanceSummary.liveConsumerCount}。执行下线后，这些消费链将失去已发布基线引用。`,
        detailEn: `${input.governanceSummary.liveConsumerCount} live consumer versions are currently visible. Unpublishing will remove the published baseline reference they depend on.`,
      })
    );
  }

  const actions = (
    ["archive-redacted", "inherit", "publish", "rollback", "unpublish"] as SessionPackGovernancePolicyAction[]
  ).map((action) => {
    const actionChecks = checks.filter((check) => check.appliesToActions.includes(action));
    const blockingCheckCount = actionChecks.filter((check) => check.decision === "block").length;
    const warningCheckCount = actionChecks.filter((check) => check.decision === "warn").length;
    const decision: SessionPackGovernancePolicyDecision =
      blockingCheckCount > 0 ? "block" : warningCheckCount > 0 ? "warn" : "allow";

    return {
      action,
      decision,
      blockingCheckCount,
      warningCheckCount,
      checkCodes: actionChecks.map((check) => check.code),
    } satisfies SessionPackGovernancePolicyActionStatus;
  });

  return sessionPackGovernancePolicySummarySchema.parse({
    evaluatedAt: input.detail.updatedAt,
    requireApprovedRedactionReviewForRedactedExport:
      config.sessionPackGovernancePolicyRequireApprovedRedactionReviewForRedactedExport,
    requireApprovedRedactionReviewForPublish:
      config.sessionPackGovernancePolicyRequireApprovedRedactionReviewForPublish,
    requireSuccessfulRedactionPreviewForRedactedExport:
      config.sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForRedactedExport,
    requireSuccessfulRedactionPreviewForPublish:
      config.sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForPublish,
    requireCompleteSecretCoverageForRedactedExport:
      config.sessionPackGovernancePolicyRequireCompleteSecretCoverageForRedactedExport,
    requireCompleteSecretCoverageForPublish:
      config.sessionPackGovernancePolicyRequireCompleteSecretCoverageForPublish,
    requireVerifiedSignatureForInherit:
      config.sessionPackGovernancePolicyRequireVerifiedSignatureForInherit,
    requireVerifiedSignatureForPublish:
      config.sessionPackGovernancePolicyRequireVerifiedSignatureForPublish,
    requireVerifiedSignatureForRollback:
      config.sessionPackGovernancePolicyRequireVerifiedSignatureForRollback,
    requireSignatureKeyAcceptedForPublish:
      config.sessionPackGovernancePolicyRequireSignatureKeyAcceptedForPublish,
    requireSignatureKeyAcceptedForRollback:
      config.sessionPackGovernancePolicyRequireSignatureKeyAcceptedForRollback,
    requireSignatureKeyDistributionForPublish:
      config.sessionPackGovernancePolicyRequireSignatureKeyDistributionForPublish,
    requireSignatureKeyDistributionForRollback:
      config.sessionPackGovernancePolicyRequireSignatureKeyDistributionForRollback,
    warnOnActiveSigningKeyDistributionDrift:
      config.sessionPackGovernancePolicyWarnOnActiveSigningKeyDistributionDrift,
    warnOnUnpublishWithLiveConsumers:
      config.sessionPackGovernancePolicyWarnOnUnpublishWithLiveConsumers,
    checks,
    actions,
  });
}

function resolveSessionPackGovernancePolicyActionStatus(
  summary: SessionPackGovernancePolicySummary | null | undefined,
  action: SessionPackGovernancePolicyAction
) {
  return summary?.actions.find((item) => item.action === action) ?? null;
}

function assertSessionPackGovernanceActionAllowed(
  sessionPack: SessionPackDetail,
  action: SessionPackGovernancePolicyAction
) {
  const policySummary = sessionPack.policySummary ?? null;
  const status = resolveSessionPackGovernancePolicyActionStatus(policySummary, action);

  if (!policySummary || !status || status.decision !== "block") {
    return;
  }

  const blockingChecks = policySummary.checks.filter(
    (check) => check.decision === "block" && check.appliesToActions.includes(action)
  );
  const detail = blockingChecks
    .map((check) => check.detail.en || check.detail.zh)
    .filter((value) => value.trim().length > 0)
    .join(" ");

  throw new AppError(
    409,
    "SESSION_PACK_GOVERNANCE_POLICY_BLOCKED",
    `Session pack ${sessionPack.sessionVersionId} is blocked for ${sessionPackGovernancePolicyActionLabel(action)}. ${detail || "One or more governance policy checks failed."}`,
    {
      action,
      decision: status.decision,
      checks: blockingChecks,
    }
  );
}

function maybeSignSessionPackBundle(bundle: SessionPackBundle) {
  const signing = buildSessionPackSigningOptions();
  return signing ? signSessionPackBundle(bundle, signing) : bundle;
}

function maybeRedactSessionPackBundle(
  bundle: SessionPackBundle,
  options?: ExportSessionPackArchiveOptions
) {
  if (!options?.redact) {
    return {
      bundle,
      redacted: false,
    };
  }

  const redacted = applySessionPackRedaction(bundle, {
    metadata: {
      redaction_export: true,
    },
  });

  return {
    bundle: maybeSignSessionPackBundle(redacted.bundle),
    redacted: true,
  };
}

export function signSessionPackBundleForApiRuntime(bundle: SessionPackBundle) {
  return maybeSignSessionPackBundle(bundle);
}

function hasSameSessionPackSignature(left: SessionPackManifest, right: SessionPackManifest) {
  return JSON.stringify(left.signature ?? null) === JSON.stringify(right.signature ?? null);
}

function assertValidSessionPackSignatureForImport(bundle: SessionPackBundle) {
  const result = verifySessionPackManifestSignature(
    bundle.manifest,
    buildSessionPackSignatureVerificationOptions()
  );
  if (result.ok) {
    return;
  }

  throw new AppError(
    409,
    result.missing ? "SESSION_PACK_SIGNATURE_REQUIRED" : "SESSION_PACK_SIGNATURE_INVALID",
    `Session pack ${bundle.manifest.session_version} failed signature verification: ${result.reason ?? "unknown signature failure"}`
  );
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function maxIso(left: string, right: string) {
  return left.localeCompare(right) >= 0 ? left : right;
}

function maxNullableIso(values: Array<string | null | undefined>) {
  let current: string | null = null;
  for (const value of values) {
    if (!value) {
      continue;
    }
    current = current ? maxIso(current, value) : value;
  }
  return current;
}

function hasSessionRuntimeEvidence(
  detail: Pick<
    SessionPackDetail,
    | "consumerRunId"
    | "consumerTargetPath"
    | "runtimeSourceRunId"
    | "runtimeSourceTargetPath"
    | "runtimeSourceUpdatedAt"
  >
) {
  return Boolean(
    detail.runtimeSourceRunId ||
      detail.runtimeSourceTargetPath ||
      detail.runtimeSourceUpdatedAt ||
      detail.consumerRunId ||
      detail.consumerTargetPath
  );
}

function decodeText(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function sha256Hex(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function slugifySessionPackKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "session"
  );
}

function buildSessionPackArchiveExportId(
  sessionVersionId: string,
  exportedAt: string,
  redacted: boolean,
  archiveBytes: Uint8Array
) {
  const stamp = exportedAt.replace(/[^0-9]/g, "").slice(0, 14) || Date.now().toString();
  return `sex_${slugifySessionPackKey(sessionVersionId)}_${stamp}_${redacted ? "r" : "p"}_${sha256Hex(archiveBytes).slice(0, 8)}`;
}

function buildSessionPackArchiveExportAuditEntry(input: {
  sessionVersionId: string;
  actor?: SessionActor;
  workspaceContextKey?: string | null;
  exportedAt: string;
  redacted: boolean;
  archiveSource: "generated" | "imported" | "runtime-derived";
  fileName: string;
  archiveBytes: Uint8Array;
}): SessionPackArchiveExportAuditEntry {
  return sessionPackArchiveExportAuditEntrySchema.parse({
    exportId: buildSessionPackArchiveExportId(
      input.sessionVersionId,
      input.exportedAt,
      input.redacted,
      input.archiveBytes
    ),
    exportedAt: input.exportedAt,
    exportedByUserId: input.actor?.userId ?? null,
    workspaceContextKey: input.actor?.workspaceContextKey ?? input.workspaceContextKey ?? null,
    redacted: input.redacted,
    archiveSource: input.archiveSource,
    archiveFileName: input.fileName,
    archiveSizeBytes: input.archiveBytes.byteLength,
    archiveSha256: sha256Hex(input.archiveBytes),
  });
}

function appendSessionPackArchiveExportAuditEntry(
  record: ImportedSessionPackRecord,
  entry: SessionPackArchiveExportAuditEntry
) {
  const nextEntries = [entry, ...(record.archiveExports ?? [])]
    .sort((left, right) => right.exportedAt.localeCompare(left.exportedAt))
    .slice(0, 20);

  return importedSessionPackRecordSchema.parse({
    ...record,
    archiveExports: nextEntries,
  });
}

function buildPersistedArchiveRecord(input: {
  sessionVersionId: string;
  workspaceContextKeys: string[];
  requiredBindings: CreateRunBinding;
  archiveBytes: Uint8Array;
  manifest: SessionPackManifest;
  persistedAt: string;
  persistedByUserId?: string | null;
  archiveSource?: "generated" | "imported" | "runtime-derived";
  runtimeSourceRunId?: string | null;
  runtimeSourceTargetPath?: string | null;
  runtimeSourceUpdatedAt?: string | null;
  runtimeEvidenceEntries?: SessionPackRuntimeEvidenceEntry[];
}) {
  return importedSessionPackRecordSchema.parse({
    sessionVersionId: input.sessionVersionId,
    workspaceContextKeys: input.workspaceContextKeys,
    requiredBindings: input.requiredBindings,
    archiveSource: input.archiveSource ?? "imported",
    archivePath: resolveImportedSessionArchivePath(input.sessionVersionId),
    archiveSizeBytes: input.archiveBytes.byteLength,
    archiveSha256: sha256Hex(input.archiveBytes),
    archiveFileName: buildSessionArchiveFileName(input.sessionVersionId),
    importedAt: input.persistedAt,
    importedByUserId: input.persistedByUserId ?? null,
    runtimeSourceRunId: input.runtimeSourceRunId ?? null,
    runtimeSourceTargetPath: input.runtimeSourceTargetPath ?? null,
    runtimeSourceUpdatedAt: input.runtimeSourceUpdatedAt ?? null,
    runtimeEvidenceEntries: input.runtimeEvidenceEntries ?? [],
    updatedAt: input.persistedAt,
    manifest: input.manifest,
  });
}

function replacePersistedArchiveRecordArchive(input: {
  record: ImportedSessionPackRecord;
  manifest: SessionPackManifest;
  requiredBindings: CreateRunBinding;
  archiveBytes: Uint8Array;
  updatedAt: string;
}) {
  return importedSessionPackRecordSchema.parse({
    ...input.record,
    archiveSizeBytes: input.archiveBytes.byteLength,
    archiveSha256: sha256Hex(input.archiveBytes),
    requiredBindings: input.requiredBindings,
    manifest: input.manifest,
    updatedAt: input.updatedAt,
  });
}

function buildSessionPackArchiveExportAuditSummary(
  record: ImportedSessionPackRecord | null
): SessionPackArchiveExportAuditSummary | null {
  const entries = [...(record?.archiveExports ?? [])].sort((left, right) =>
    right.exportedAt.localeCompare(left.exportedAt)
  );

  if (entries.length === 0) {
    return null;
  }

  return sessionPackArchiveExportAuditSummarySchema.parse({
    totalExports: entries.length,
    redactedExportCount: entries.filter((item) => item.redacted).length,
    plainExportCount: entries.filter((item) => !item.redacted).length,
    latestExportedAt: entries[0]?.exportedAt ?? null,
    latestRedactedExportedAt:
      entries.find((item) => item.redacted)?.exportedAt ?? null,
    entries: entries.slice(0, 8),
  });
}

function buildSessionPackRuntimeEvidenceId(
  sessionVersionId: string,
  runId: string,
  capturedAt: string
) {
  const stamp = capturedAt.replace(/[^0-9]/g, "").slice(0, 14) || Date.now().toString();
  return `sre_${slugifySessionPackKey(sessionVersionId)}_${slugifySessionPackKey(runId)}_${stamp}`;
}

function sortSessionPackRuntimeEvidenceEntries(
  left: SessionPackRuntimeEvidenceEntry,
  right: SessionPackRuntimeEvidenceEntry
) {
  return (
    right.capturedAt.localeCompare(left.capturedAt) ||
    right.runtimeSourceUpdatedAt?.localeCompare(left.runtimeSourceUpdatedAt ?? "") ||
    left.runId.localeCompare(right.runId)
  );
}

function mergeSessionPackRuntimeEvidenceEntry(
  left: SessionPackRuntimeEvidenceEntry,
  right: SessionPackRuntimeEvidenceEntry
) {
  return {
    ...left,
    ...right,
    requestedByUserId: left.requestedByUserId ?? right.requestedByUserId ?? null,
    launchMode: left.launchMode ?? right.launchMode ?? null,
    containerName: left.containerName ?? right.containerName ?? null,
    startedAt: left.startedAt ?? right.startedAt ?? null,
    readyAt: left.readyAt ?? right.readyAt ?? null,
    finishedAt: left.finishedAt ?? right.finishedAt ?? null,
    exitCode: left.exitCode ?? right.exitCode ?? null,
    exitSignal: left.exitSignal ?? right.exitSignal ?? null,
    runtimeProfileId: left.runtimeProfileId ?? right.runtimeProfileId ?? null,
    runnerImage: left.runnerImage ?? right.runnerImage ?? null,
    runtimeSourceUpdatedAt: left.runtimeSourceUpdatedAt ?? right.runtimeSourceUpdatedAt ?? null,
    archiveSha256: left.archiveSha256 ?? right.archiveSha256 ?? null,
    archiveFileName: left.archiveFileName ?? right.archiveFileName ?? null,
    workspaceBaseCaptured: left.workspaceBaseCaptured || right.workspaceBaseCaptured,
    workspaceBaseCaptureError:
      left.workspaceBaseCaptureError ?? right.workspaceBaseCaptureError ?? null,
    manifestRuntimeDerived: left.manifestRuntimeDerived || right.manifestRuntimeDerived,
  } satisfies SessionPackRuntimeEvidenceEntry;
}

function mergeSessionPackRuntimeEvidenceEntries(
  ...collections: Array<SessionPackRuntimeEvidenceEntry[] | null | undefined>
) {
  const merged = new Map<string, SessionPackRuntimeEvidenceEntry>();

  for (const collection of collections) {
    for (const entry of collection ?? []) {
      const existing = merged.get(entry.evidenceId);
      merged.set(
        entry.evidenceId,
        existing ? mergeSessionPackRuntimeEvidenceEntry(existing, entry) : entry
      );
    }
  }

  return [...merged.values()].sort(sortSessionPackRuntimeEvidenceEntries);
}

function buildSessionPackRuntimeEvidenceSummaryFromEntries(input: {
  entries: SessionPackRuntimeEvidenceEntry[];
  currentRunId?: string | null;
}): SessionPackRuntimeEvidenceSummary | null {
  const entries = [...input.entries].sort(sortSessionPackRuntimeEvidenceEntries);

  if (entries.length === 0) {
    return null;
  }

  return sessionPackRuntimeEvidenceSummarySchema.parse({
    totalRecords: entries.length,
    latestCapturedAt: entries[0]?.capturedAt ?? null,
    latestRunId: entries[0]?.runId ?? null,
    latestLaunchMode: entries[0]?.launchMode ?? null,
    containerizedRecordCount: entries.filter((entry) => entry.launchMode === "docker").length,
    currentRunId: input.currentRunId ?? entries[0]?.runId ?? null,
    hasCurrentRunRecord: input.currentRunId
      ? entries.some((entry) => entry.runId === input.currentRunId)
      : false,
    items: entries.slice(0, 8),
  });
}

function buildSessionPackRuntimeEvidenceEntryFromAggregate(input: {
  sessionVersionId: string;
  aggregate: RunAggregate;
  archiveSource: "generated" | "imported" | "runtime-derived";
  capturedAt: string;
  runtimeProfile: SessionPackRuntimeProfileView;
  manifestRuntimeDerived: boolean;
  runtimeSourceUpdatedAt?: string | null;
  archiveSha256?: string | null;
  archiveFileName?: string | null;
  workspaceBaseCaptureError?: string | null;
}): SessionPackRuntimeEvidenceEntry {
  const configuredRuntimeLaunchMode =
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE === "local-process" ? "local-process" : "docker";
  return {
    evidenceId: buildSessionPackRuntimeEvidenceId(
      input.sessionVersionId,
      input.aggregate.run.runId,
      input.capturedAt
    ),
    capturedAt: input.capturedAt,
    archiveSource: input.archiveSource,
    runId: input.aggregate.run.runId,
    workspaceId: input.aggregate.run.workspaceId,
    requestedByUserId: input.aggregate.run.requestedByUserId ?? null,
    targetPath: input.aggregate.run.targetPath,
    launchMode: input.aggregate.runtime?.launchMode ?? configuredRuntimeLaunchMode,
    containerName: input.aggregate.runtime?.containerName ?? null,
    startedAt: input.aggregate.runtime?.startedAt ?? null,
    readyAt: input.aggregate.runtime?.readyAt ?? null,
    finishedAt: input.aggregate.runtime?.finishedAt ?? null,
    exitCode: input.aggregate.runtime?.exitCode ?? null,
    exitSignal: input.aggregate.runtime?.exitSignal ?? null,
    runtimeProfileId: input.runtimeProfile.profileId,
    runnerImage: input.runtimeProfile.runnerImage ?? null,
    manifestRuntimeDerived: input.manifestRuntimeDerived,
    runtimeSourceUpdatedAt: input.runtimeSourceUpdatedAt ?? input.aggregate.run.updatedAt,
    archiveSha256: input.archiveSha256 ?? null,
    archiveFileName: input.archiveFileName ?? null,
    workspaceBaseCaptured: !input.workspaceBaseCaptureError,
    workspaceBaseCaptureError: input.workspaceBaseCaptureError ?? null,
  };
}

function parseSessionPackRuntimeEvidenceSummaryFromBundle(
  bundle: SessionPackBundle
): SessionPackRuntimeEvidenceSummary | null {
  const raw = bundle.files[sessionPackRuntimeEvidenceFileName];
  if (!raw) {
    return null;
  }

  try {
    return sessionPackRuntimeEvidenceSummarySchema.parse(
      JSON.parse(Buffer.from(raw).toString("utf8")) as unknown
    );
  } catch {
    return null;
  }
}

function buildSessionPackRuntimeEvidenceSummary(input: {
  detail: SessionPackDetail;
  bundle: SessionPackBundle;
  record: ImportedSessionPackRecord | null;
  currentRunId?: string | null;
}): SessionPackRuntimeEvidenceSummary | null {
  const bundleEntries = parseSessionPackRuntimeEvidenceSummaryFromBundle(input.bundle)?.items ?? [];
  const recordEntries = recordRuntimeEvidenceEntriesWithArchiveMetadata(input.record);
  const entries = mergeSessionPackRuntimeEvidenceEntries(recordEntries, bundleEntries);
  const currentRunId =
    input.currentRunId ??
    input.detail.runtimeSourceRunId ??
    bundleEntries[0]?.runId ??
    recordEntries[0]?.runId ??
    null;

  return buildSessionPackRuntimeEvidenceSummaryFromEntries({
    entries,
    currentRunId,
  });
}

function recordRuntimeEvidenceEntriesWithArchiveMetadata(
  record: ImportedSessionPackRecord | null
) {
  if (!record) {
    return [];
  }

  return (record.runtimeEvidenceEntries ?? []).map((entry) => ({
    ...entry,
    archiveSha256: entry.archiveSha256 ?? record.archiveSha256,
    archiveFileName: entry.archiveFileName ?? record.archiveFileName,
    archiveSource: entry.archiveSource ?? record.archiveSource,
  }));
}

function appendSessionPackRuntimeEvidenceEntries(
  record: ImportedSessionPackRecord,
  entries: SessionPackRuntimeEvidenceEntry[]
) {
  const nextEntries = mergeSessionPackRuntimeEvidenceEntries(
    record.runtimeEvidenceEntries ?? [],
    entries
  ).slice(0, 20);

  return importedSessionPackRecordSchema.parse({
    ...record,
    runtimeEvidenceEntries: nextEntries,
  });
}

async function recordSessionPackArchiveExport(input: {
  detail: SessionPackDetail;
  actor?: SessionActor;
  baseBundle: SessionPackBundle;
  baseArchiveBytes: Uint8Array;
  source: "generated" | "imported" | "runtime-derived";
  exportedBytes: Uint8Array;
  fileName: string;
  redacted: boolean;
}) {
  const exportedAt = nowIso();
  const existingRecord = sessionArchiveRepository.getImportedArchiveBySessionVersionId(
    input.detail.sessionVersionId
  );
  const auditEntry = buildSessionPackArchiveExportAuditEntry({
    sessionVersionId: input.detail.sessionVersionId,
    actor: input.actor,
    workspaceContextKey: input.detail.workspaceContextKeys[0] ?? null,
    exportedAt,
    redacted: input.redacted,
    archiveSource: input.source,
    fileName: input.fileName,
    archiveBytes: input.exportedBytes,
  });
  const mcpRequirements = parseMcpRequirements(input.baseBundle);
  const requiredBindings = buildBindingsFromManifest(input.baseBundle.manifest, mcpRequirements);
  const runtimeEvidenceEntries =
    parseSessionPackRuntimeEvidenceSummaryFromBundle(input.baseBundle)?.items ?? [];

  if (existingRecord) {
    const updatedRecord = appendSessionPackArchiveExportAuditEntry(
      appendSessionPackRuntimeEvidenceEntries(
        replacePersistedArchiveRecordArchive({
          record: existingRecord,
          manifest: input.baseBundle.manifest,
          requiredBindings,
          archiveBytes: input.baseArchiveBytes,
          updatedAt: maxIso(existingRecord.updatedAt, exportedAt),
        }),
        runtimeEvidenceEntries
      ),
      auditEntry
    );
    await sessionArchiveRepository.saveImportedArchive(updatedRecord, input.baseArchiveBytes);
    return;
  }

  const record = appendSessionPackArchiveExportAuditEntry(
    buildPersistedArchiveRecord({
      sessionVersionId: input.detail.sessionVersionId,
      workspaceContextKeys: input.detail.workspaceContextKeys,
      requiredBindings,
      archiveBytes: input.baseArchiveBytes,
      persistedAt: maxIso(input.detail.updatedAt, exportedAt),
      persistedByUserId: input.actor?.userId ?? null,
      archiveSource: input.source,
      runtimeSourceRunId: input.detail.runtimeSourceRunId,
      runtimeSourceTargetPath: input.detail.runtimeSourceTargetPath,
      runtimeSourceUpdatedAt: input.detail.runtimeSourceUpdatedAt,
      runtimeEvidenceEntries,
      manifest: input.baseBundle.manifest,
    }),
    auditEntry
  );

  await sessionArchiveRepository.saveImportedArchive(record, input.baseArchiveBytes);
}

function normalizeSessionVersionId(candidate: string) {
  const normalized = candidate.split("@", 1)[0]?.trim() ?? "";
  const parsed = sessionVersionIdSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new AppError(
      409,
      "SESSION_PACK_VERSION_INVALID",
      `Session pack archive exposes an invalid session version id: ${candidate}`,
      parsed.error.flatten()
    );
  }
  return parsed.data;
}

function normalizeSessionId(candidate: string) {
  const normalized = candidate.trim();
  const parsed = sessionIdSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new AppError(
      409,
      "SESSION_PACK_ID_INVALID",
      `Session pack archive exposes an invalid session id: ${candidate}`,
      parsed.error.flatten()
    );
  }
  return parsed.data;
}

function readManifestMetadataString(manifest: SessionPackManifest, key: string) {
  const value = manifest.metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readManifestMetadataBoolean(manifest: SessionPackManifest, key: string) {
  const value = manifest.metadata?.[key];
  return typeof value === "boolean" ? value : null;
}

function readManifestMetadataNumber(manifest: SessionPackManifest, key: string) {
  const value = manifest.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readManifestMetadataParsedString<T>(
  manifest: SessionPackManifest,
  key: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }
) {
  const value = readManifestMetadataString(manifest, key);
  if (!value) {
    return null;
  }

  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function canonicalizeLookupSessionVersionId(candidate: string) {
  return candidate.split("@", 1)[0]?.trim() ?? candidate.trim();
}

function parseTaskVersionId(candidate: string | null | undefined) {
  if (!candidate) {
    return null;
  }

  const normalized = candidate.split("@", 1)[0]?.trim() ?? "";
  const parsed = taskVersionIdSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}

function buildSessionArchiveFileName(sessionVersionId: string) {
  return `${sessionVersionId}.session-pack.json.gz`;
}

function parseSessionPackRedactionReviewSummary(
  bundle: SessionPackBundle,
  redactionSummary: SessionPackRedactionSummary | null
): SessionPackRedactionReviewSummary | null {
  const decision = readManifestMetadataParsedString(
    bundle.manifest,
    "redaction_review_decision",
    sessionPackRedactionReviewDecisionSchema
  );
  const reviewedAt = readManifestMetadataString(bundle.manifest, "redaction_reviewed_at");

  if (!decision || !reviewedAt) {
    return null;
  }

  const reviewedByUserId = readManifestMetadataParsedString(
    bundle.manifest,
    "redaction_reviewed_by_user_id",
    userIdSchema
  );

  return sessionPackRedactionReviewSummarySchema.parse({
    decision,
    reviewedAt,
    reviewedByUserId: reviewedByUserId ?? null,
    note: readManifestMetadataString(bundle.manifest, "redaction_review_note"),
    mapVersion:
      readManifestMetadataString(bundle.manifest, "redaction_review_map_version") ??
      redactionSummary?.mapVersion ??
      null,
    totalRules:
      readManifestMetadataNumber(bundle.manifest, "redaction_review_total_rules") ??
      redactionSummary?.totalRules ??
      0,
    previewMatchedRuleCount:
      readManifestMetadataNumber(bundle.manifest, "redaction_review_preview_matched_rule_count") ??
      redactionSummary?.previewMatchedRuleCount ??
      0,
    secretCoverageComplete:
      readManifestMetadataBoolean(bundle.manifest, "redaction_review_secret_coverage_complete") ??
      redactionSummary?.secretCoverageComplete ??
      false,
  });
}

function buildArchiveDownloadPath(sessionVersionId: string) {
  return `/v1/sessions/${encodeURIComponent(sessionVersionId)}/archive`;
}

function buildLaunchTemplateKey(serviceId: string, workspaceContextKey: string, entrySurface: EntrySurface) {
  return `${serviceId}:${workspaceContextKey}:${entrySurface}`;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function deriveTargetRoot(root: string, serviceId: string) {
  return `${ensureTrailingSlash(root)}runs/${serviceId}`;
}

function sortLaunchTemplates(templates: LaunchTemplateRecord[]) {
  return [...templates].sort((left, right) => left.templateKey.localeCompare(right.templateKey));
}

function toPublishedTarget(template: LaunchTemplateRecord): SessionPackPublishedTarget {
  return sessionPackPublishedTargetSchema.parse(template);
}

function buildExpectedRootFiles() {
  return [
    sessionPackManifestFileName,
    ...sessionPackRequiredRootFiles,
    ...sessionPackRuntimeAlternativeFiles,
  ];
}

function parseRunnerImage(versionLine: string[]) {
  const raw = versionLine.find((item) => item.startsWith("img:"));
  return raw ? raw.slice("img:".length).trim() || null : null;
}

function buildRuntimeProfileFromPackage(
  pkg: CreatorPackageDetail,
  sessionVersionId: string
): SessionPackRuntimeProfileView {
  const searchableRuntimeText = [
    pkg.runtime.summary.zh,
    pkg.runtime.summary.en,
    ...pkg.runtime.items.flatMap((item) => [item.zh, item.en]),
    ...pkg.dependencies.flatMap((item) => [item.zh, item.en]),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  return sessionPackRuntimeProfileViewSchema.parse({
    profileId: sessionVersionId,
    runnerImage: parseRunnerImage(pkg.versionLine),
    browserRequired: searchableRuntimeText.includes("browser"),
    playwrightRequired: searchableRuntimeText.includes("playwright"),
  });
}

function classifyConnectorRef(ref: string) {
  return ref.includes("://") || ref.startsWith("connector:") || ref.includes("/") || ref.includes(":");
}

function mergeBindings(left: CreateRunBinding, right: CreateRunBinding): CreateRunBinding {
  return createRunBindingSchema.parse({
    firstPartyMcpIds: uniqueStrings([...left.firstPartyMcpIds, ...right.firstPartyMcpIds]),
    externalConnectorRefs: uniqueStrings([
      ...left.externalConnectorRefs,
      ...right.externalConnectorRefs,
    ]),
    credentialIds: uniqueStrings([...left.credentialIds, ...right.credentialIds]),
  });
}

function buildBindingsFromServices(serviceIds: string[]) {
  const merged = createRunBindingSchema.parse({
    firstPartyMcpIds: [],
    externalConnectorRefs: [],
    credentialIds: [],
  });

  for (const serviceId of serviceIds) {
    const service = workshopCatalogRepository.getServiceById(serviceId);
    if (!service) {
      continue;
    }

    merged.firstPartyMcpIds = uniqueStrings([
      ...merged.firstPartyMcpIds,
      ...service.requiredBindings.firstPartyMcpIds,
    ]);
    merged.externalConnectorRefs = uniqueStrings([
      ...merged.externalConnectorRefs,
      ...service.requiredBindings.externalConnectorRefs,
    ]);
    merged.credentialIds = uniqueStrings([
      ...merged.credentialIds,
      ...service.requiredBindings.credentialIds,
    ]);
  }

  return createRunBindingSchema.parse(merged);
}

function buildBindingsFromManifest(
  manifest: SessionPackManifest,
  mcpRequirements?: SessionPackMcpRequirementsFile | null
) {
  const firstPartyMcpIds: string[] = [];
  const externalConnectorRefs: string[] = [];
  const credentialIds: string[] = [];

  for (const connector of manifest.required_capabilities.mcps ?? []) {
    if (classifyConnectorRef(connector.id)) {
      externalConnectorRefs.push(connector.id);
    } else {
      firstPartyMcpIds.push(connector.id);
    }
  }

  for (const connector of mcpRequirements?.connectors ?? []) {
    if (classifyConnectorRef(connector.id)) {
      externalConnectorRefs.push(connector.id);
    } else {
      firstPartyMcpIds.push(connector.id);
    }
  }

  for (const credential of manifest.required_capabilities.credentials ?? []) {
    credentialIds.push(credential.id);
  }

  for (const credential of mcpRequirements?.credentials ?? []) {
    credentialIds.push(credential.id);
  }

  return createRunBindingSchema.parse({
    firstPartyMcpIds: uniqueStrings(firstPartyMcpIds),
    externalConnectorRefs: uniqueStrings(externalConnectorRefs),
    credentialIds: uniqueStrings(credentialIds),
  });
}

function parseMcpRequirements(bundle: SessionPackBundle) {
  const content = bundle.files["mcp-requirements.json"];
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(decodeText(content)) as unknown;
  return sessionPackMcpRequirementsFileSchema.parse(parsed);
}

function parseSlotSchema(bundle: SessionPackBundle) {
  const content = bundle.files["slot-schema.json"];
  if (!content) {
    return sessionPackSlotSchemaFileSchema.parse({
      version: "generated.v1",
      slots: [
        {
          key: "request_context",
          title: "Request context",
          type: "string",
          required: false,
          prompt: "Describe the request context for this session instance.",
        },
      ],
    });
  }

  const parsed = JSON.parse(decodeText(content)) as unknown;
  return sessionPackSlotSchemaFileSchema.parse(parsed);
}

function isEffectiveInformationCollectionAnswer(
  answer: Pick<RunInformationCollection["answers"][number], "reviewStatus">
) {
  return answer.reviewStatus !== "rejected" && answer.reviewStatus !== "superseded";
}

function buildInformationCollectionReviewFile(
  informationCollection: RunInformationCollection | null | undefined
): SessionPackInformationCollectionReviewFile | null {
  if (!informationCollection) {
    return null;
  }

  const slots = informationCollection.slots.map((slot) => {
    const slotAnswers = informationCollection.answers.filter(
      (answer) => answer.slotKey === slot.key
    );
    const latestAnswer = slotAnswers.at(-1) ?? null;
    const latestEffectiveAnswer =
      [...slotAnswers].reverse().find((answer) => isEffectiveInformationCollectionAnswer(answer)) ?? null;

    return {
      key: slot.key,
      title: slot.title,
      type: slot.type,
      required: slot.required,
      secret: slot.secret,
      status: slot.status,
      answer_count: slot.answerCount,
      tracked_answer_count: slotAnswers.length,
      user_message_answer_count: slotAnswers.filter((answer) => answer.source === "user-message").length,
      manual_review_answer_count: slotAnswers.filter((answer) => answer.source === "manual-review").length,
      revision_count: slotAnswers.filter((answer) => answer.supersedesAnswerId != null).length,
      pending_review_count: slotAnswers.filter((answer) => answer.reviewStatus === "pending").length,
      approved_review_count: slotAnswers.filter((answer) => answer.reviewStatus === "approved").length,
      rejected_review_count: slotAnswers.filter((answer) => answer.reviewStatus === "rejected").length,
      superseded_review_count: slotAnswers.filter((answer) => answer.reviewStatus === "superseded").length,
      last_answered_at: maxNullableIso(slotAnswers.map((answer) => answer.createdAt)),
      last_reviewed_at: maxNullableIso(slotAnswers.map((answer) => answer.reviewedAt)),
      latest_answer_id: latestAnswer?.answerId ?? null,
      latest_source: latestAnswer?.source ?? null,
      latest_source_message_id: latestAnswer?.sourceMessageId ?? null,
      effective_answer_id: latestEffectiveAnswer?.answerId ?? null,
      effective_source: latestEffectiveAnswer?.source ?? null,
      effective_source_message_id: latestEffectiveAnswer?.sourceMessageId ?? null,
      answers: slotAnswers.map((answer) => ({
        answer_id: answer.answerId,
        kind: answer.kind,
        source: answer.source,
        source_message_id: answer.sourceMessageId,
        review_status: answer.reviewStatus,
        reviewed_at: answer.reviewedAt,
        reviewed_by_user_id: answer.reviewedByUserId,
        supersedes_answer_id: answer.supersedesAnswerId,
        superseded_by_answer_id: answer.supersededByAnswerId,
        created_at: answer.createdAt,
      })),
    };
  });

  if (slots.length === 0 && informationCollection.answers.length === 0) {
    return null;
  }

  return sessionPackInformationCollectionReviewFileSchema.parse({
    version: "review.v1",
    slot_schema_version: informationCollection.slotSchemaVersion,
    total_slots: informationCollection.slots.length,
    required_slots: informationCollection.slots.filter((slot) => slot.required).length,
    satisfied_slots: informationCollection.slots.filter((slot) => slot.status === "satisfied").length,
    total_answers: informationCollection.answers.length,
    user_message_answer_count: informationCollection.answers.filter(
      (answer) => answer.source === "user-message"
    ).length,
    manual_review_answer_count: informationCollection.answers.filter(
      (answer) => answer.source === "manual-review"
    ).length,
    revision_count: informationCollection.answers.filter(
      (answer) => answer.supersedesAnswerId != null
    ).length,
    pending_review_count: informationCollection.pendingReviewCount,
    approved_review_count: informationCollection.approvedReviewCount,
    rejected_review_count: informationCollection.rejectedReviewCount,
    superseded_review_count: informationCollection.answers.filter(
      (answer) => answer.reviewStatus === "superseded"
    ).length,
    latest_answered_at: maxNullableIso(
      informationCollection.answers.map((answer) => answer.createdAt)
    ),
    latest_reviewed_at: maxNullableIso(
      informationCollection.answers.map((answer) => answer.reviewedAt)
    ),
    slots,
  });
}

function parseInformationCollectionReview(
  bundle: SessionPackBundle
): SessionPackInformationCollectionReviewSummary | null {
  const content = bundle.files[sessionPackInformationCollectionReviewFileName];
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(decodeText(content)) as unknown;
  const reviewFile = sessionPackInformationCollectionReviewFileSchema.parse(parsed);

  return sessionPackInformationCollectionReviewSummarySchema.parse({
    slotSchemaVersion: reviewFile.slot_schema_version,
    totalSlots: reviewFile.total_slots,
    requiredSlots: reviewFile.required_slots,
    satisfiedSlots: reviewFile.satisfied_slots,
    totalAnswers: reviewFile.total_answers,
    userMessageAnswerCount: reviewFile.user_message_answer_count,
    manualReviewAnswerCount: reviewFile.manual_review_answer_count,
    revisionCount: reviewFile.revision_count,
    pendingReviewCount: reviewFile.pending_review_count,
    approvedReviewCount: reviewFile.approved_review_count,
    rejectedReviewCount: reviewFile.rejected_review_count,
    supersededReviewCount: reviewFile.superseded_review_count,
    latestAnsweredAt: reviewFile.latest_answered_at,
    latestReviewedAt: reviewFile.latest_reviewed_at,
    slots: reviewFile.slots.map((slot) => ({
      key: slot.key,
      title: slot.title,
      type: slot.type,
      required: slot.required,
      secret: slot.secret,
      status: slot.status,
      answerCount: slot.answer_count,
      trackedAnswerCount: slot.tracked_answer_count,
      userMessageAnswerCount: slot.user_message_answer_count,
      manualReviewAnswerCount: slot.manual_review_answer_count,
      revisionCount: slot.revision_count,
      pendingReviewCount: slot.pending_review_count,
      approvedReviewCount: slot.approved_review_count,
      rejectedReviewCount: slot.rejected_review_count,
      supersededReviewCount: slot.superseded_review_count,
      lastAnsweredAt: slot.last_answered_at,
      lastReviewedAt: slot.last_reviewed_at,
      latestAnswerId: slot.latest_answer_id,
      latestSource: slot.latest_source,
      latestSourceMessageId: slot.latest_source_message_id,
      effectiveAnswerId: slot.effective_answer_id,
      effectiveSource: slot.effective_source,
      effectiveSourceMessageId: slot.effective_source_message_id,
      answers: slot.answers.map((answer) => ({
        answerId: answer.answer_id,
        kind: answer.kind,
        source: answer.source,
        sourceMessageId: answer.source_message_id,
        reviewStatus: answer.review_status,
        reviewedAt: answer.reviewed_at,
        reviewedByUserId: answer.reviewed_by_user_id,
        supersedesAnswerId: answer.supersedes_answer_id,
        supersededByAnswerId: answer.superseded_by_answer_id,
        createdAt: answer.created_at,
      })),
    })),
  });
}

function parseRedactionSummary(bundle: SessionPackBundle) {
  const slotSchema = parseSlotSchema(bundle);
  const slotByKey = new Map(slotSchema.slots.map((slot) => [slot.key, slot] as const));
  const content = bundle.files["redaction-map.json"];
  const redactionMap = content
    ? sessionPackRedactionMapSchema.parse(JSON.parse(decodeText(content)) as unknown)
    : sessionPackRedactionMapSchema.parse({
        version: "generated.v1",
        secret_slot_keys: [],
        rules: [],
      });
  const schemaSecretSlotKeys = uniqueStrings(
    slotSchema.slots.filter((slot) => slot.secret).map((slot) => slot.key)
  );
  const curatedSecretSlotKeys = uniqueStrings(
    redactionMap.secret_slot_keys.filter((slotKey) => slotByKey.has(slotKey))
  );
  const secretSlotKeys = uniqueStrings([...schemaSecretSlotKeys, ...curatedSecretSlotKeys]);
  const secretSlotKeySet = new Set(secretSlotKeys);

  let previewMatchedRuleCount = 0;
  let previewTotalMatches = 0;
  let previewMutatedEntries: string[] = [];
  let previewUnmatchedRuleIds: string[] = [];
  let previewError: string | null = null;
  const previewByRuleId = new Map<
    string,
    {
      matched: boolean;
      matches: number;
      mutatedEntries: string[];
    }
  >();

  try {
    const preview = applySessionPackRedaction(bundle);
    previewMatchedRuleCount = preview.report.matchedRuleCount;
    previewTotalMatches = preview.report.totalMatches;
    previewMutatedEntries = preview.report.mutatedEntries;
    previewUnmatchedRuleIds = preview.report.rules
      .filter((rule) => rule.matches <= 0)
      .map((rule) => rule.ruleId);
    for (const rule of preview.report.rules) {
      previewByRuleId.set(rule.ruleId, {
        matched: rule.matches > 0,
        matches: rule.matches,
        mutatedEntries: rule.mutatedEntries,
      });
    }
  } catch (error) {
    previewError = error instanceof Error ? error.message : "Unknown redaction preview error";
  }

  const rules = redactionMap.rules.map((rule) => {
    const linkedSlot = rule.slot_key ? slotByKey.get(rule.slot_key) ?? null : null;
    const preview = previewByRuleId.get(rule.rule_id);
    return {
      ruleId: rule.rule_id,
      slotKey: rule.slot_key ?? null,
      targetKind: rule.target.kind,
      selector: rule.target.selector,
      strategy: rule.strategy,
      replacement: rule.replacement ?? null,
      rationale: rule.rationale ?? null,
      linkedSlotExists: Boolean(linkedSlot),
      linkedSecretSlot: Boolean(linkedSlot && secretSlotKeySet.has(linkedSlot.key)),
      previewMatched: preview?.matched ?? false,
      previewMatchCount: preview?.matches ?? 0,
      previewMutatedEntries: preview?.mutatedEntries ?? [],
    };
  });

  const coveredSecretSlotKeys = uniqueStrings(
    rules
      .filter((rule) => rule.linkedSecretSlot)
      .map((rule) => rule.slotKey)
  );
  const uncoveredSecretSlotKeys = secretSlotKeys.filter(
    (slotKey) => !coveredSecretSlotKeys.includes(slotKey)
  );
  const orphanSlotKeys = uniqueStrings(
    rules
      .filter((rule) => rule.slotKey && !rule.linkedSlotExists)
      .map((rule) => rule.slotKey)
  );

  return sessionPackRedactionSummarySchema.parse({
    mapVersion: redactionMap.version ?? null,
    slotSchemaVersion: slotSchema.version ?? null,
    totalRules: rules.length,
    linkedSlotRuleCount: rules.filter((rule) => rule.linkedSlotExists).length,
    linkedSecretSlotRuleCount: rules.filter((rule) => rule.linkedSecretSlot).length,
    unlinkedRuleCount: rules.filter((rule) => !rule.slotKey).length,
    orphanSlotKeyCount: orphanSlotKeys.length,
    secretSlotCount: secretSlotKeys.length,
    coveredSecretSlotCount: coveredSecretSlotKeys.length,
    uncoveredSecretSlotCount: uncoveredSecretSlotKeys.length,
    secretCoverageComplete: uncoveredSecretSlotKeys.length === 0,
    targetKinds: [...new Set(rules.map((rule) => rule.targetKind))],
    strategies: [...new Set(rules.map((rule) => rule.strategy))],
    schemaSecretSlotKeys,
    curatedSecretSlotKeys,
    secretSlotKeys,
    coveredSecretSlotKeys,
    uncoveredSecretSlotKeys,
    orphanSlotKeys,
    previewMatchedRuleCount,
    previewTotalMatches,
    previewMutatedEntries,
    previewUnmatchedRuleIds,
    previewError,
    rules,
  });
}

type DescendantLineageNode = {
  detail: SessionPackDetail;
  relation: SessionPackLineageRelation;
  depth: number;
  viaSessionVersionId: string | null;
};

function buildLineageChildMaps(visibleDetails: SessionPackDetail[]) {
  const lineageChildrenByParent = new Map<string, string[]>();
  const rollbackChildrenBySource = new Map<string, string[]>();

  for (const detail of visibleDetails) {
    if (detail.lineageParentVersionId) {
      const current = lineageChildrenByParent.get(detail.lineageParentVersionId) ?? [];
      current.push(detail.sessionVersionId);
      lineageChildrenByParent.set(detail.lineageParentVersionId, current);
    }

    if (detail.rollbackFromVersionId) {
      const current = rollbackChildrenBySource.get(detail.rollbackFromVersionId) ?? [];
      current.push(detail.sessionVersionId);
      rollbackChildrenBySource.set(detail.rollbackFromVersionId, current);
    }
  }

  return {
    lineageChildrenByParent,
    rollbackChildrenBySource,
  };
}

function sortDescendantLineageNodes(left: DescendantLineageNode, right: DescendantLineageNode) {
  return (
    left.depth - right.depth ||
    right.detail.updatedAt.localeCompare(left.detail.updatedAt) ||
    left.detail.sessionVersionId.localeCompare(right.detail.sessionVersionId)
  );
}

function collectLineageDescendantNodes(
  focus: SessionPackDetail,
  visibleDetails: SessionPackDetail[]
): DescendantLineageNode[] {
  const detailBySessionVersionId = new Map(
    visibleDetails.map((detail) => [detail.sessionVersionId, detail] as const)
  );
  const { lineageChildrenByParent, rollbackChildrenBySource } = buildLineageChildMaps(visibleDetails);
  const descendants: DescendantLineageNode[] = [];
  const seenDescendants = new Set<string>([focus.sessionVersionId]);
  const descendantQueue: Array<{
    sessionVersionId: string;
    relation: SessionPackLineageRelation;
    depth: number;
    viaSessionVersionId: string | null;
  }> = [];

  const enqueueDescendant = (
    targetSessionVersionId: string,
    relation: SessionPackLineageRelation,
    depth: number,
    viaSessionVersionId: string | null
  ) => {
    if (seenDescendants.has(targetSessionVersionId)) {
      return;
    }

    const detail = detailBySessionVersionId.get(targetSessionVersionId);
    if (!detail) {
      return;
    }

    seenDescendants.add(targetSessionVersionId);
    descendantQueue.push({
      sessionVersionId: targetSessionVersionId,
      relation,
      depth,
      viaSessionVersionId,
    });
  };

  for (const childSessionVersionId of lineageChildrenByParent.get(focus.sessionVersionId) ?? []) {
    enqueueDescendant(childSessionVersionId, "lineage_child", 1, focus.sessionVersionId);
  }
  for (const childSessionVersionId of rollbackChildrenBySource.get(focus.sessionVersionId) ?? []) {
    enqueueDescendant(childSessionVersionId, "rollback_child", 1, focus.sessionVersionId);
  }

  while (descendantQueue.length > 0) {
    const current = descendantQueue.shift()!;
    const detail = detailBySessionVersionId.get(current.sessionVersionId);
    if (!detail) {
      continue;
    }

    descendants.push({
      detail,
      relation: current.relation,
      depth: current.depth,
      viaSessionVersionId: current.viaSessionVersionId,
    });

    for (const childSessionVersionId of lineageChildrenByParent.get(detail.sessionVersionId) ?? []) {
      enqueueDescendant(
        childSessionVersionId,
        "lineage_child",
        current.depth + 1,
        detail.sessionVersionId
      );
    }
    for (const childSessionVersionId of rollbackChildrenBySource.get(detail.sessionVersionId) ?? []) {
      enqueueDescendant(
        childSessionVersionId,
        "rollback_child",
        current.depth + 1,
        detail.sessionVersionId
      );
    }
  }

  return descendants.sort(sortDescendantLineageNodes);
}

function isConsumerGovernanceTarget(detail: SessionPackDetail) {
  return (
    detail.inheritMode === "consumer" ||
    Boolean(
      detail.consumerRunId ||
        detail.consumerWorkspaceId ||
        detail.consumerServiceId ||
        detail.consumerWorkshopId ||
        detail.consumerEntrySurface ||
        detail.consumerTargetPath
    )
  );
}

function buildConsumerGovernanceEntry(input: {
  detail: SessionPackDetail;
  depth: number;
  viaSessionVersionId: string | null;
  isCurrent: boolean;
}): SessionPackConsumerGovernanceEntry {
  const { detail, depth, viaSessionVersionId, isCurrent } = input;
  return {
    sessionVersionId: detail.sessionVersionId,
    sessionId: detail.sessionId,
    displayName: detail.displayName,
    summary: detail.summary,
    inheritMode: detail.inheritMode,
    isCurrent,
    depth,
    viaSessionVersionId,
    workspaceContextKeys: detail.workspaceContextKeys,
    linkedServiceIds: detail.linkedServiceIds,
    linkedWorkshopIds: detail.linkedWorkshopIds,
    consumerRunId: detail.consumerRunId,
    consumerWorkspaceId: detail.consumerWorkspaceId,
    consumerServiceId: detail.consumerServiceId,
    consumerWorkshopId: detail.consumerWorkshopId,
    consumerEntrySurface: detail.consumerEntrySurface,
    consumerTargetPath: detail.consumerTargetPath,
    archiveSource: detail.archiveSource,
    publishedTargetCount: detail.publishedTargetCount,
    runtimeSourceRunId: detail.runtimeSourceRunId,
    runtimeSourceTargetPath: detail.runtimeSourceTargetPath,
    runtimeSourceUpdatedAt: detail.runtimeSourceUpdatedAt,
    updatedAt: detail.updatedAt,
  };
}

function buildConsumerGovernanceSummary(
  focus: SessionPackDetail,
  visibleDetails: SessionPackDetail[]
): SessionPackConsumerGovernanceSummary | null {
  const items: SessionPackConsumerGovernanceEntry[] = [];
  const descendantNodes = collectLineageDescendantNodes(focus, visibleDetails);

  if (isConsumerGovernanceTarget(focus)) {
    items.push(
      buildConsumerGovernanceEntry({
        detail: focus,
        depth: 0,
        viaSessionVersionId: null,
        isCurrent: true,
      })
    );
  }

  for (const node of descendantNodes) {
    if (!isConsumerGovernanceTarget(node.detail)) {
      continue;
    }

    items.push(
      buildConsumerGovernanceEntry({
        detail: node.detail,
        depth: node.depth,
        viaSessionVersionId: node.viaSessionVersionId,
        isCurrent: false,
      })
    );
  }

  if (items.length === 0) {
    return null;
  }

  return sessionPackConsumerGovernanceSummarySchema.parse({
    totalConsumerVersions: items.length,
    workspaceIds: uniqueStrings(items.map((item) => item.consumerWorkspaceId)),
    serviceIds: uniqueStrings(items.map((item) => item.consumerServiceId)),
    entrySurfaces: [...new Set(items.flatMap((item) => (item.consumerEntrySurface ? [item.consumerEntrySurface] : [])))],
    items,
  });
}

function resolvePackagePinnedSessionVersionId(detail: SessionPackDetail) {
  if (!detail.primaryPackageId) {
    return null;
  }

  const pkg = creatorRepository.getPackageById(detail.primaryPackageId);
  if (!pkg) {
    return null;
  }

  return findVersionLineRef(pkg.versionLine, "session");
}

function fingerprintStringList(values: string[]) {
  return JSON.stringify([...values].sort((left, right) => left.localeCompare(right)));
}

function fingerprintBindings(bindings: CreateRunBinding) {
  return JSON.stringify({
    firstPartyMcpIds: [...bindings.firstPartyMcpIds].sort((left, right) => left.localeCompare(right)),
    externalConnectorRefs: [...bindings.externalConnectorRefs].sort((left, right) =>
      left.localeCompare(right)
    ),
    credentialIds: [...bindings.credentialIds].sort((left, right) => left.localeCompare(right)),
  });
}

function fingerprintRuntimeProfile(profile: SessionPackRuntimeProfileView) {
  return JSON.stringify({
    profileId: profile.profileId,
    runnerImage: profile.runnerImage ?? null,
    browserRequired: profile.browserRequired,
    playwrightRequired: profile.playwrightRequired,
  });
}

function collectGovernanceDriftFieldKeys(
  focus: SessionPackDetail,
  baseline: SessionPackDetail
): SessionPackGovernanceDiffField[] {
  const driftFieldKeys: SessionPackGovernanceDiffField[] = [];

  if ((focus.inheritMode ?? null) !== (baseline.inheritMode ?? null)) {
    driftFieldKeys.push("inherit_mode");
  }
  if ((focus.lineageParentVersionId ?? null) !== (baseline.lineageParentVersionId ?? null)) {
    driftFieldKeys.push("lineage_parent_version_id");
  }
  if ((focus.consumerRunId ?? null) !== (baseline.consumerRunId ?? null)) {
    driftFieldKeys.push("consumer_run_id");
  }
  if ((focus.consumerWorkspaceId ?? null) !== (baseline.consumerWorkspaceId ?? null)) {
    driftFieldKeys.push("consumer_workspace_id");
  }
  if ((focus.consumerServiceId ?? null) !== (baseline.consumerServiceId ?? null)) {
    driftFieldKeys.push("consumer_service_id");
  }
  if ((focus.consumerWorkshopId ?? null) !== (baseline.consumerWorkshopId ?? null)) {
    driftFieldKeys.push("consumer_workshop_id");
  }
  if ((focus.consumerEntrySurface ?? null) !== (baseline.consumerEntrySurface ?? null)) {
    driftFieldKeys.push("consumer_entry_surface");
  }
  if ((focus.consumerTargetPath ?? null) !== (baseline.consumerTargetPath ?? null)) {
    driftFieldKeys.push("consumer_target_path");
  }
  if (
    fingerprintStringList(focus.workspaceContextKeys) !==
    fingerprintStringList(baseline.workspaceContextKeys)
  ) {
    driftFieldKeys.push("workspace_context_keys");
  }
  if (
    fingerprintStringList(focus.linkedServiceIds) !== fingerprintStringList(baseline.linkedServiceIds)
  ) {
    driftFieldKeys.push("linked_service_ids");
  }
  if (
    fingerprintStringList(focus.linkedWorkshopIds) !==
    fingerprintStringList(baseline.linkedWorkshopIds)
  ) {
    driftFieldKeys.push("linked_workshop_ids");
  }
  if (fingerprintRuntimeProfile(focus.runtimeProfile) !== fingerprintRuntimeProfile(baseline.runtimeProfile)) {
    driftFieldKeys.push("runtime_profile");
  }
  if (fingerprintBindings(focus.requiredBindings) !== fingerprintBindings(baseline.requiredBindings)) {
    driftFieldKeys.push("required_bindings");
  }
  if (focus.publishedTargetCount !== baseline.publishedTargetCount) {
    driftFieldKeys.push("published_target_count");
  }
  if (
    fingerprintStringList(focus.expectedRootFiles) !== fingerprintStringList(baseline.expectedRootFiles)
  ) {
    driftFieldKeys.push("expected_root_files");
  }

  return driftFieldKeys;
}

function deriveSessionPackGovernanceState(input: {
  focus: SessionPackDetail;
  baselineSessionVersionId: string | null;
}): SessionPackGovernanceState {
  const { focus, baselineSessionVersionId } = input;

  if (focus.inheritMode === "consumer") {
    return "consumer-derived";
  }
  if (focus.archiveSource === "runtime-derived") {
    return "runtime-derived";
  }
  if (focus.lineageParentVersionId) {
    return "draft-derived";
  }
  if (focus.publishedTargetCount > 0) {
    return "published";
  }
  if (baselineSessionVersionId && focus.sessionVersionId === baselineSessionVersionId) {
    return "package-baseline";
  }
  if (focus.archiveSource === "imported") {
    return "imported";
  }
  return "unpublished";
}

function deriveSessionPackGovernanceRiskLevel(input: {
  focus: SessionPackDetail;
  draftDescendantCount: number;
  consumerDescendantCount: number;
  rollbackDescendantCount: number;
  driftCount: number;
  hasCurrentRuntimeEvidence: boolean;
  hasOrphanedConsumers: boolean;
}): SessionPackGovernanceRiskLevel {
  if (input.hasOrphanedConsumers) {
    return "high";
  }

  if (
    input.focus.inheritMode === "consumer" ||
    input.rollbackDescendantCount > 0 ||
    input.driftCount > 0
  ) {
    return "medium";
  }

  if (
    input.focus.publishedTargetCount > 0 ||
    input.consumerDescendantCount > 0 ||
    input.draftDescendantCount > 0 ||
    input.hasCurrentRuntimeEvidence ||
    !input.focus.persistedArchive
  ) {
    return "low";
  }

  return "none";
}

function buildSessionPackGovernanceSummary(
  focus: SessionPackDetail,
  visibleDetails: SessionPackDetail[],
  consumerGovernance: SessionPackConsumerGovernanceSummary | null
): SessionPackGovernanceSummary {
  const descendantNodes = collectLineageDescendantNodes(focus, visibleDetails);
  const draftDescendantCount = descendantNodes.filter((node) => node.detail.inheritMode === "draft").length;
  const consumerDescendantCount = descendantNodes.filter((node) =>
    isConsumerGovernanceTarget(node.detail)
  ).length;
  const rollbackDescendantCount = descendantNodes.filter(
    (node) => node.relation === "rollback_child"
  ).length;
  const liveConsumerItems = consumerGovernance?.items ?? [];
  const publishedConsumerCount = liveConsumerItems.filter(
    (item) => item.publishedTargetCount > 0
  ).length;
  const unpublishedConsumerCount = liveConsumerItems.filter(
    (item) => item.publishedTargetCount === 0
  ).length;
  const hasCurrentRuntimeEvidence = hasSessionRuntimeEvidence(focus);
  const runtimeEvidenceSessionIds = new Set<string>();

  if (hasCurrentRuntimeEvidence) {
    runtimeEvidenceSessionIds.add(focus.sessionVersionId);
  }
  for (const item of liveConsumerItems) {
    if (
      item.runtimeSourceRunId ||
      item.runtimeSourceTargetPath ||
      item.consumerRunId ||
      item.consumerTargetPath
    ) {
      runtimeEvidenceSessionIds.add(item.sessionVersionId);
    }
  }

  const baselineSessionVersionId = resolvePackagePinnedSessionVersionId(focus);
  const baseline =
    baselineSessionVersionId && baselineSessionVersionId !== focus.sessionVersionId
      ? visibleDetails.find((detail) => detail.sessionVersionId === baselineSessionVersionId) ?? null
      : null;
  const driftFieldKeys = baseline ? collectGovernanceDriftFieldKeys(focus, baseline) : [];
  const hasOrphanedConsumers =
    focus.inheritMode !== "consumer" && focus.publishedTargetCount === 0 && consumerDescendantCount > 0;
  const flags: SessionPackGovernanceFlag[] = [];

  if (focus.publishedTargetCount > 0) {
    flags.push("published_targets_attached");
  }
  if (liveConsumerItems.length > 0) {
    flags.push("live_consumer_versions_visible");
  }
  if (hasOrphanedConsumers) {
    flags.push("unpublished_with_live_consumers");
  }
  if (draftDescendantCount > 0) {
    flags.push("draft_descendants_present");
  }
  if (consumerDescendantCount > 0) {
    flags.push("consumer_descendants_present");
  }
  if (rollbackDescendantCount > 0) {
    flags.push("rollback_descendants_present");
  }
  if (runtimeEvidenceSessionIds.size > 0) {
    flags.push("runtime_evidence_present");
  }
  if (driftFieldKeys.length > 0) {
    flags.push("drift_from_package_baseline");
  }
  if (!focus.persistedArchive) {
    flags.push("missing_persisted_archive");
  }

  return sessionPackGovernanceSummarySchema.parse({
    state: deriveSessionPackGovernanceState({
      focus,
      baselineSessionVersionId,
    }),
    riskLevel: deriveSessionPackGovernanceRiskLevel({
      focus,
      draftDescendantCount,
      consumerDescendantCount,
      rollbackDescendantCount,
      driftCount: driftFieldKeys.length,
      hasCurrentRuntimeEvidence,
      hasOrphanedConsumers,
    }),
    flags,
    baselineSessionVersionId,
    liveConsumerCount: liveConsumerItems.length,
    publishedConsumerCount,
    unpublishedConsumerCount,
    totalDescendantCount: descendantNodes.length,
    draftDescendantCount,
    consumerDescendantCount,
    rollbackDescendantCount,
    runtimeEvidenceCount: runtimeEvidenceSessionIds.size,
    hasCurrentRuntimeEvidence,
    latestConsumerUpdatedAt: maxNullableIso(liveConsumerItems.map((item) => item.updatedAt)),
    latestRuntimeEvidenceUpdatedAt: maxNullableIso([
      focus.runtimeSourceUpdatedAt,
      ...liveConsumerItems.map((item) => item.runtimeSourceUpdatedAt),
    ]),
    driftCount: driftFieldKeys.length,
    driftFieldKeys,
  });
}

async function enrichSessionPackDetail(
  detail: SessionPackDetail,
  visibleDetails: SessionPackDetail[]
): Promise<SessionPackDetail> {
  const resolved = await resolveBundleForInformationCollection(detail);
  const persistedRecord = sessionArchiveRepository.getImportedArchiveBySessionVersionId(
    detail.sessionVersionId
  );
  const runtimeEvidenceSummary = buildSessionPackRuntimeEvidenceSummary({
    detail,
    bundle: resolved.bundle,
    record: persistedRecord,
    currentRunId: resolved.currentRunId,
  });
  const latestRuntimeEvidence = runtimeEvidenceSummary?.items[0] ?? null;
  const detailWithRuntimeEvidence = sessionPackDetailSchema.parse({
    ...detail,
    archiveSource:
      detail.persistedArchive || resolved.source === "generated" ? detail.archiveSource : resolved.source,
    runtimeSourceRunId: detail.runtimeSourceRunId ?? latestRuntimeEvidence?.runId ?? null,
    runtimeSourceTargetPath: detail.runtimeSourceTargetPath ?? latestRuntimeEvidence?.targetPath ?? null,
    runtimeSourceUpdatedAt:
      detail.runtimeSourceUpdatedAt ?? latestRuntimeEvidence?.runtimeSourceUpdatedAt ?? null,
    runtimeEvidenceSummary,
  });
  const redactionSummary = parseRedactionSummary(resolved.bundle);
  const consumerGovernance = buildConsumerGovernanceSummary(detailWithRuntimeEvidence, visibleDetails);
  const redactionReview = parseSessionPackRedactionReviewSummary(resolved.bundle, redactionSummary);
  const governanceSummary = buildSessionPackGovernanceSummary(
    detailWithRuntimeEvidence,
    visibleDetails,
    consumerGovernance
  );
  const signatureSummary = buildSessionPackSignatureSummary({
    bundle: resolved.bundle,
    evaluatedAt: detailWithRuntimeEvidence.updatedAt,
  });
  return sessionPackDetailSchema.parse({
    ...detailWithRuntimeEvidence,
    informationCollectionReview: parseInformationCollectionReview(resolved.bundle),
    redactionSummary,
    redactionReview,
    archiveExportAudit: buildSessionPackArchiveExportAuditSummary(persistedRecord),
    runtimeEvidenceSummary,
    governanceSummary,
    signatureSummary,
    policySummary: buildSessionPackGovernancePolicySummary({
      detail: detailWithRuntimeEvidence,
      redactionSummary,
      redactionReview,
      governanceSummary,
      signatureSummary,
    }),
    consumerGovernance,
  });
}

function buildSourcePackageView(pkg: CreatorPackageDetail): SessionPackSourcePackageView {
  return {
    packageId: pkg.packageId,
    title: pkg.title,
    state: pkg.state,
    updatedAt: pkg.updatedAt,
    workspaceContextKeys: pkg.workspaceContextKeys,
    linkedServiceIds: pkg.linkedServiceIds,
    linkedWorkshopIds: pkg.linkedWorkshopIds,
  };
}

function collectPackageReleaseIds(packageId: string) {
  return uniqueStrings(
    creatorRepository.listReleasesByPackage(packageId).map((release) => release.releaseId)
  );
}

function collectActiveActivationIds(packageId: string) {
  const releaseIds = collectPackageReleaseIds(packageId);
  const activationIds: string[] = [];

  for (const releaseId of releaseIds) {
    for (const activation of creatorRepository.listReleaseActivationsByRelease(releaseId)) {
      if (activation.packageId === packageId && activation.state === "active") {
        activationIds.push(activation.activationId);
      }
    }
  }

  return uniqueStrings(activationIds);
}

function resolveActiveCreatorActivationSessionVersion(
  serviceId: string,
  workspaceContextKey: string
): ActiveCreatorActivationSessionVersion | null {
  const activation = [...creatorRepository.listReleaseActivations()]
    .filter((item) => item.state === "active" && item.targetWorkspaceContextKey === workspaceContextKey)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .find((item) => {
      const pkg = creatorRepository.getPackageById(item.packageId);
      return Boolean(pkg?.linkedServiceIds.includes(serviceId));
    });

  if (!activation) {
    return null;
  }

  const pkg = creatorRepository.getPackageById(activation.packageId);
  if (!pkg) {
    throw new AppError(
      409,
      "CREATOR_ACTIVATION_PACKAGE_MISSING",
      `Active creator activation ${activation.activationId} references missing package ${activation.packageId}`
    );
  }

  const release = creatorRepository.getReleaseById(activation.releaseId);
  if (!release) {
    throw new AppError(
      409,
      "CREATOR_ACTIVATION_RELEASE_MISSING",
      `Active creator activation ${activation.activationId} references missing release ${activation.releaseId}`
    );
  }

  const sessionVersionId = findVersionLineRef(pkg.versionLine, "session");
  if (!sessionVersionId) {
    throw new AppError(
      409,
      "CREATOR_ACTIVATION_SESSION_VERSION_MISSING",
      `Active creator package ${pkg.packageId} does not expose a valid session version id`
    );
  }

  return {
    activationId: activation.activationId,
    releaseId: release.releaseId,
    packageId: pkg.packageId,
    sessionVersionId,
    taskVersionId: findVersionLineRef(pkg.versionLine, "task"),
  };
}

function requireVisibleContextService(
  serviceId: string,
  workspaceContextKey: string
): {
  context: NonNullable<ReturnType<typeof workshopCatalogRepository.getContextByKey>>;
  service: ServiceCatalogRecord;
} {
  const context = workshopCatalogRepository.getContextByKey(workspaceContextKey);
  if (!context) {
    throw new AppError(
      404,
      "SESSION_PACK_WORKSPACE_CONTEXT_NOT_FOUND",
      `Workspace context not found: ${workspaceContextKey}`
    );
  }

  const service = workshopCatalogRepository.getServiceById(serviceId);
  if (!service) {
    throw new AppError(404, "SESSION_PACK_SERVICE_NOT_FOUND", `Service not found: ${serviceId}`);
  }

  if (!service.visibleInContexts.includes(workspaceContextKey)) {
    throw new AppError(
      409,
      "SESSION_PACK_SERVICE_CONTEXT_INVALID",
      `Service ${serviceId} is not available in workspace context ${workspaceContextKey}`
    );
  }

  return { context, service };
}

function resolveTargetEntrySurfaces(
  allowedEntrySurfaces: EntrySurface[],
  input: {
    entrySurface?: EntrySurface | null;
    applyToAllEntrySurfaces: boolean;
  }
): EntrySurface[] {
  if (input.entrySurface) {
    if (!allowedEntrySurfaces.includes(input.entrySurface)) {
      throw new AppError(
        409,
        "SESSION_PACK_ENTRY_SURFACE_INVALID",
        `Entry surface ${input.entrySurface} is not enabled for the selected workspace context`
      );
    }
    return [input.entrySurface];
  }

  if (input.applyToAllEntrySurfaces !== false) {
    return [...allowedEntrySurfaces];
  }

  if (allowedEntrySurfaces.includes("dashboard")) {
    return ["dashboard"];
  }

  return [allowedEntrySurfaces[0]!];
}

function buildCreatorDetail(pkg: CreatorPackageDetail): SessionPackDetail {
  const sessionVersionId = findVersionLineRef(pkg.versionLine, "session");
  if (!sessionVersionId) {
    throw new AppError(
      409,
      "CREATOR_PACKAGE_SESSION_VERSION_MISSING",
      `Creator package ${pkg.packageId} does not expose a valid session version id`
    );
  }

  const taskVersionId = findVersionLineRef(pkg.versionLine, "task");
  const requiredBindings = buildBindingsFromServices(pkg.linkedServiceIds);

  return sessionPackDetailSchema.parse({
    sessionVersionId,
    sessionId: null,
    displayName: pkg.title,
    summary: pkg.session.summary,
    manifestVersion: sessionPackManifestVersion,
    primaryPackageId: pkg.packageId,
    sourcePackageIds: [pkg.packageId],
    primaryTaskVersionId: taskVersionId,
    linkedServiceIds: pkg.linkedServiceIds,
    linkedWorkshopIds: pkg.linkedWorkshopIds,
    workspaceContextKeys: pkg.workspaceContextKeys,
    sourcePackageState: pkg.state,
    releaseChannel: pkg.releaseChannel,
    runtimeProfile: buildRuntimeProfileFromPackage(pkg, sessionVersionId),
    requiredBindings,
    expectedRootFiles: buildExpectedRootFiles(),
    lineageParentVersionId: null,
    rollbackFromVersionId: null,
    inheritMode: null,
    consumerRunId: null,
    consumerWorkspaceId: null,
    consumerServiceId: null,
    consumerWorkshopId: null,
    consumerEntrySurface: null,
    consumerTargetPath: null,
    persistedArchive: false,
    archiveSource: "generated",
    archiveFileName: null,
    archiveSizeBytes: null,
    archiveRecordedAt: null,
    runtimeSourceRunId: null,
    runtimeSourceTargetPath: null,
    runtimeSourceUpdatedAt: null,
    updatedAt: pkg.updatedAt,
    sourceReleaseIds: collectPackageReleaseIds(pkg.packageId),
    activeActivationIds: collectActiveActivationIds(pkg.packageId),
    runtimeAlternativeFiles: [...sessionPackRuntimeAlternativeFiles],
    optionalRootFiles: [...sessionPackOptionalRootFiles],
    sourcePackages: [buildSourcePackageView(pkg)],
  });
}

function buildImportedDetail(record: ImportedSessionPackRecord): SessionPackDetail {
  const sourcePackageId = record.manifest.source?.creator_package_id ?? null;
  const sourcePackage = sourcePackageId ? creatorRepository.getPackageById(sourcePackageId) : null;
  const consumerInherit = isConsumerInheritedManifest(record.manifest);
  const inheritMode =
    readManifestMetadataParsedString(
      record.manifest,
      "inherit_mode",
      sessionPackInheritModeSchema
    ) ?? (consumerInherit ? "consumer" : null);
  const consumerRunId = readManifestMetadataParsedString(
    record.manifest,
    "consumer_run_id",
    runIdSchema
  );
  const consumerWorkspaceId = readManifestMetadataParsedString(
    record.manifest,
    "consumer_workspace_id",
    workspaceIdSchema
  );
  const consumerServiceId = readManifestMetadataString(record.manifest, "consumer_service_id");
  const consumerWorkshopId = readManifestMetadataString(record.manifest, "consumer_workshop_id");
  const consumerEntrySurface = readManifestMetadataParsedString(
    record.manifest,
    "consumer_entry_surface",
    entrySurfaceSchema
  );
  const consumerTargetPath = readManifestMetadataString(record.manifest, "consumer_target_path");
  const displayName =
    sourcePackage?.title ??
    l(record.sessionVersionId, record.sessionVersionId);
  const summary =
    sourcePackage?.session.summary ??
    (consumerInherit
      ? l(
          `消费继承 session-pack ${record.sessionVersionId}`,
          `Consumer-inherited session-pack ${record.sessionVersionId}`
        )
      : record.archiveSource === "runtime-derived"
        ? l(
            `运行归档 session-pack ${record.sessionVersionId}`,
            `Runtime-derived session-pack ${record.sessionVersionId}`
          )
      : l(
          `导入的 session-pack ${record.sessionVersionId}`,
          `Imported session-pack ${record.sessionVersionId}`
        ));
  const runtimeProfile = sessionPackRuntimeProfileViewSchema.parse({
    profileId: record.manifest.runtime_profile.profile_id,
    runnerImage: record.manifest.runtime_profile.runner_image ?? null,
    browserRequired:
      Boolean(record.manifest.runtime_profile.browser_required) ||
      Boolean(record.manifest.required_capabilities.browser),
    playwrightRequired: Boolean(record.manifest.runtime_profile.playwright_required),
  });

  return sessionPackDetailSchema.parse({
    sessionVersionId: record.sessionVersionId,
    sessionId: sessionIdSchema.safeParse(record.manifest.session_id).success
      ? record.manifest.session_id
      : null,
    displayName,
    summary,
    manifestVersion: sessionPackManifestVersion,
    primaryPackageId: sourcePackageId,
    sourcePackageIds: sourcePackageId ? [sourcePackageId] : [],
    primaryTaskVersionId: parseTaskVersionId(record.manifest.task_family),
    linkedServiceIds: uniqueStrings([...(sourcePackage?.linkedServiceIds ?? []), consumerServiceId]),
    linkedWorkshopIds: uniqueStrings([...(sourcePackage?.linkedWorkshopIds ?? []), consumerWorkshopId]),
    workspaceContextKeys: record.workspaceContextKeys,
    sourcePackageState: sourcePackage?.state ?? null,
    releaseChannel: sourcePackage?.releaseChannel ?? null,
    runtimeProfile,
    requiredBindings: record.requiredBindings,
    expectedRootFiles: buildExpectedRootFiles(),
    lineageParentVersionId:
      sessionVersionIdSchema.safeParse(record.manifest.source?.lineage_parent_version_id).success
        ? record.manifest.source?.lineage_parent_version_id ?? null
        : null,
    rollbackFromVersionId:
      sessionVersionIdSchema.safeParse(record.manifest.source?.rollback_from_version_id).success
        ? record.manifest.source?.rollback_from_version_id ?? null
        : null,
    inheritMode,
    consumerRunId,
    consumerWorkspaceId,
    consumerServiceId,
    consumerWorkshopId,
    consumerEntrySurface,
    consumerTargetPath,
    persistedArchive: true,
    archiveSource: record.archiveSource,
    archiveFileName: record.archiveFileName,
    archiveSizeBytes: record.archiveSizeBytes,
    archiveRecordedAt: record.importedAt,
    runtimeSourceRunId: record.runtimeSourceRunId,
    runtimeSourceTargetPath: record.runtimeSourceTargetPath,
    runtimeSourceUpdatedAt: record.runtimeSourceUpdatedAt,
    updatedAt: record.updatedAt,
    sourceReleaseIds: sourcePackage ? collectPackageReleaseIds(sourcePackage.packageId) : [],
    activeActivationIds: sourcePackage ? collectActiveActivationIds(sourcePackage.packageId) : [],
    runtimeAlternativeFiles: [...sessionPackRuntimeAlternativeFiles],
    optionalRootFiles: [...sessionPackOptionalRootFiles],
    sourcePackages: sourcePackage ? [buildSourcePackageView(sourcePackage)] : [],
  });
}

function mergeLocalizedText(left: LocalizedText, right: LocalizedText) {
  return l(left.zh || right.zh, left.en || right.en);
}

function mergeRuntimeProfiles(
  left: SessionPackRuntimeProfileView,
  right: SessionPackRuntimeProfileView
) {
  return sessionPackRuntimeProfileViewSchema.parse({
    profileId: left.profileId || right.profileId,
    runnerImage: left.runnerImage ?? right.runnerImage ?? null,
    browserRequired: left.browserRequired || right.browserRequired,
    playwrightRequired: left.playwrightRequired || right.playwrightRequired,
  });
}

function mergeSessionPackDetails(left: SessionPackDetail, right: SessionPackDetail): SessionPackDetail {
  const mergedArchiveSource =
    left.persistedArchive && left.archiveSource !== "generated"
      ? left.archiveSource
      : right.persistedArchive && right.archiveSource !== "generated"
        ? right.archiveSource
        : left.archiveSource !== "generated"
          ? left.archiveSource
          : right.archiveSource;
  return sessionPackDetailSchema.parse({
    sessionVersionId: left.sessionVersionId,
    sessionId: left.sessionId ?? right.sessionId ?? null,
    displayName:
      left.primaryPackageId != null ? left.displayName : right.primaryPackageId != null ? right.displayName : mergeLocalizedText(left.displayName, right.displayName),
    summary:
      left.primaryPackageId != null ? left.summary : right.primaryPackageId != null ? right.summary : mergeLocalizedText(left.summary, right.summary),
    manifestVersion: left.manifestVersion,
    primaryPackageId: left.primaryPackageId ?? right.primaryPackageId,
    sourcePackageIds: uniqueStrings([...left.sourcePackageIds, ...right.sourcePackageIds]),
    primaryTaskVersionId: left.primaryTaskVersionId ?? right.primaryTaskVersionId,
    linkedServiceIds: uniqueStrings([...left.linkedServiceIds, ...right.linkedServiceIds]),
    linkedWorkshopIds: uniqueStrings([...left.linkedWorkshopIds, ...right.linkedWorkshopIds]),
    workspaceContextKeys: uniqueStrings([...left.workspaceContextKeys, ...right.workspaceContextKeys]),
    sourcePackageState: left.sourcePackageState ?? right.sourcePackageState,
    releaseChannel: left.releaseChannel ?? right.releaseChannel,
    runtimeProfile: mergeRuntimeProfiles(left.runtimeProfile, right.runtimeProfile),
    requiredBindings: mergeBindings(left.requiredBindings, right.requiredBindings),
    expectedRootFiles: uniqueStrings([...left.expectedRootFiles, ...right.expectedRootFiles]),
    lineageParentVersionId: left.lineageParentVersionId ?? right.lineageParentVersionId ?? null,
    rollbackFromVersionId: left.rollbackFromVersionId ?? right.rollbackFromVersionId ?? null,
    inheritMode: left.inheritMode ?? right.inheritMode ?? null,
    consumerRunId: left.consumerRunId ?? right.consumerRunId ?? null,
    consumerWorkspaceId: left.consumerWorkspaceId ?? right.consumerWorkspaceId ?? null,
    consumerServiceId: left.consumerServiceId ?? right.consumerServiceId ?? null,
    consumerWorkshopId: left.consumerWorkshopId ?? right.consumerWorkshopId ?? null,
    consumerEntrySurface: left.consumerEntrySurface ?? right.consumerEntrySurface ?? null,
    consumerTargetPath: left.consumerTargetPath ?? right.consumerTargetPath ?? null,
    persistedArchive: left.persistedArchive || right.persistedArchive,
    archiveSource: mergedArchiveSource,
    archiveFileName: left.archiveFileName ?? right.archiveFileName ?? null,
    archiveSizeBytes: left.archiveSizeBytes ?? right.archiveSizeBytes ?? null,
    archiveRecordedAt: left.archiveRecordedAt ?? right.archiveRecordedAt ?? null,
    runtimeSourceRunId: left.runtimeSourceRunId ?? right.runtimeSourceRunId ?? null,
    runtimeSourceTargetPath: left.runtimeSourceTargetPath ?? right.runtimeSourceTargetPath ?? null,
    runtimeSourceUpdatedAt: left.runtimeSourceUpdatedAt ?? right.runtimeSourceUpdatedAt ?? null,
    updatedAt: maxIso(left.updatedAt, right.updatedAt),
    sourceReleaseIds: uniqueStrings([...left.sourceReleaseIds, ...right.sourceReleaseIds]),
    activeActivationIds: uniqueStrings([
      ...left.activeActivationIds,
      ...right.activeActivationIds,
    ]),
    runtimeAlternativeFiles: uniqueStrings([
      ...left.runtimeAlternativeFiles,
      ...right.runtimeAlternativeFiles,
    ]),
    optionalRootFiles: uniqueStrings([...left.optionalRootFiles, ...right.optionalRootFiles]),
    sourcePackages: Object.values(
      [...left.sourcePackages, ...right.sourcePackages].reduce<Record<string, SessionPackSourcePackageView>>(
        (accumulator, item) => {
          accumulator[item.packageId] = item;
          return accumulator;
        },
        {}
      )
    ),
  });
}

function mergePublishedTargetsIntoDetail(
  detail: SessionPackDetail,
  publishedTemplates: LaunchTemplateRecord[]
) {
  const publishedTargets = sortLaunchTemplates(publishedTemplates).map((item) => toPublishedTarget(item));
  return sessionPackDetailSchema.parse({
    ...detail,
    linkedServiceIds: uniqueStrings([
      ...detail.linkedServiceIds,
      ...publishedTargets.map((item) => item.serviceId),
    ]),
    workspaceContextKeys: uniqueStrings([
      ...detail.workspaceContextKeys,
      ...publishedTargets.map((item) => item.workspaceContextKey),
    ]),
    publishedTargetCount: publishedTargets.length,
    publishedTargets,
  });
}

function toSummary(detail: SessionPackDetail): SessionPackSummary {
  return sessionPackSummarySchema.parse({
    sessionVersionId: detail.sessionVersionId,
    sessionId: detail.sessionId,
    displayName: detail.displayName,
    summary: detail.summary,
    manifestVersion: detail.manifestVersion,
    primaryPackageId: detail.primaryPackageId,
    sourcePackageIds: detail.sourcePackageIds,
    primaryTaskVersionId: detail.primaryTaskVersionId,
    linkedServiceIds: detail.linkedServiceIds,
    linkedWorkshopIds: detail.linkedWorkshopIds,
    workspaceContextKeys: detail.workspaceContextKeys,
    sourcePackageState: detail.sourcePackageState,
    releaseChannel: detail.releaseChannel,
    runtimeProfile: detail.runtimeProfile,
    requiredBindings: detail.requiredBindings,
    expectedRootFiles: detail.expectedRootFiles,
    lineageParentVersionId: detail.lineageParentVersionId,
    rollbackFromVersionId: detail.rollbackFromVersionId,
    inheritMode: detail.inheritMode,
    consumerRunId: detail.consumerRunId,
    consumerWorkspaceId: detail.consumerWorkspaceId,
    consumerServiceId: detail.consumerServiceId,
    consumerWorkshopId: detail.consumerWorkshopId,
    consumerEntrySurface: detail.consumerEntrySurface,
    consumerTargetPath: detail.consumerTargetPath,
    publishedTargetCount: detail.publishedTargetCount,
    persistedArchive: detail.persistedArchive,
    archiveSource: detail.archiveSource,
    archiveFileName: detail.archiveFileName,
    archiveSizeBytes: detail.archiveSizeBytes,
    archiveRecordedAt: detail.archiveRecordedAt,
    runtimeSourceRunId: detail.runtimeSourceRunId,
    runtimeSourceTargetPath: detail.runtimeSourceTargetPath,
    runtimeSourceUpdatedAt: detail.runtimeSourceUpdatedAt,
    updatedAt: detail.updatedAt,
  });
}

function buildLineageEntry(
  detail: SessionPackDetail,
  relation: SessionPackLineageRelation,
  depth: number,
  viaSessionVersionId: string | null
): SessionPackLineageEntry {
  return {
    ...toSummary(detail),
    relation,
    depth,
    viaSessionVersionId,
  };
}

function sortLineageEntries(left: SessionPackLineageEntry, right: SessionPackLineageEntry) {
  return (
    left.depth - right.depth ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.sessionVersionId.localeCompare(right.sessionVersionId)
  );
}

function buildSyntheticSessionId(sessionVersionId: string) {
  const suffix = sessionVersionId.replace(/^sev_/, "").replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `ses_${suffix || "generated"}`;
}

function buildSessionSlug(candidate: string) {
  return candidate
    .replace(/^(sev_|ses_|run_)/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function draftSuffix() {
  return createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 10);
}

function buildInheritedSessionVersionId(parentSessionVersionId: string) {
  const suffix = buildSessionSlug(parentSessionVersionId);
  return `sev_${suffix || "session"}_draft_${draftSuffix()}`;
}

function buildInheritedSessionId(parentSessionVersionId: string) {
  const suffix = buildSessionSlug(parentSessionVersionId);
  return `ses_${suffix || "session"}`;
}

function buildConsumerSessionDerivationKey(input: {
  runId?: string | null;
  workspaceContextKey?: string | null;
  serviceId?: string | null;
  entrySurface?: EntrySurface | null;
  targetPath?: string | null;
}) {
  const runSuffix = input.runId ? buildSessionSlug(input.runId) : draftSuffix();
  const uniquenessSeed = [
    input.workspaceContextKey ?? "",
    input.serviceId ?? "",
    input.entrySurface ?? "",
    input.targetPath ?? "",
  ].join("|");
  const uniquenessSuffix = createHash("sha256")
    .update(uniquenessSeed || draftSuffix())
    .digest("hex")
    .slice(0, 8);
  return `${runSuffix || "run"}_${uniquenessSuffix}`;
}

function buildConsumerSessionVersionId(
  parentSessionVersionId: string,
  input: {
    runId?: string | null;
    workspaceContextKey?: string | null;
    serviceId?: string | null;
    entrySurface?: EntrySurface | null;
    targetPath?: string | null;
  }
) {
  const sessionSuffix = buildSessionSlug(parentSessionVersionId);
  const consumerSuffix = buildConsumerSessionDerivationKey(input);
  return `sev_${sessionSuffix || "session"}_consumer_${consumerSuffix}`;
}

function buildConsumerSessionId(
  parentSessionVersionId: string,
  input: {
    runId?: string | null;
    workspaceContextKey?: string | null;
    serviceId?: string | null;
    entrySurface?: EntrySurface | null;
    targetPath?: string | null;
  }
) {
  const sessionSuffix = buildSessionSlug(parentSessionVersionId);
  const consumerSuffix = buildConsumerSessionDerivationKey(input);
  return `ses_${sessionSuffix || "session"}_consumer_${consumerSuffix}`;
}

function isConsumerInheritedManifest(manifest: SessionPackManifest) {
  return (
    readManifestMetadataString(manifest, "inherit_mode") === "consumer" ||
    readManifestMetadataBoolean(manifest, "consumer_inherit") === true
  );
}

function cloneBundleForInheritedSessionPack(
  bundle: SessionPackBundle,
  input: {
    inheritMode: SessionPackInheritMode;
    sessionId: string;
    sessionVersionId: string;
    inheritedByUserId?: string | null;
    inheritedFromSessionVersionId: string;
    reason?: string | null;
    createdAt: string;
    consumerWorkspaceId?: string | null;
    consumerRunId?: string | null;
    consumerServiceId?: string | null;
    consumerWorkshopId?: string | null;
    consumerEntrySurface?: EntrySurface | null;
    consumerTargetPath?: string | null;
    consumerWorkspaceContextKey?: string | null;
  }
) {
  const nextMetadata = {
    ...(bundle.manifest.metadata ?? {}),
  } as Record<string, string | number | boolean>;

  for (const key of [
    "inherit_mode",
    "inherit_reason",
    "inherited_draft",
    "consumer_inherit",
    "consumer_run_id",
    "consumer_workspace_id",
    "consumer_workspace_context_key",
    "consumer_service_id",
    "consumer_workshop_id",
    "consumer_entry_surface",
    "consumer_target_path",
  ]) {
    delete nextMetadata[key];
  }

  nextMetadata.inherited_from_session_version = input.inheritedFromSessionVersionId;
  nextMetadata.inherit_mode = input.inheritMode;
  if (input.reason) {
    nextMetadata.inherit_reason = input.reason;
  }

  if (input.inheritMode === "draft") {
    nextMetadata.inherited_draft = true;
  } else {
    nextMetadata.consumer_inherit = true;
    if (input.consumerRunId) {
      nextMetadata.consumer_run_id = input.consumerRunId;
    }
    if (input.consumerWorkspaceId) {
      nextMetadata.consumer_workspace_id = input.consumerWorkspaceId;
    }
    if (input.consumerWorkspaceContextKey) {
      nextMetadata.consumer_workspace_context_key = input.consumerWorkspaceContextKey;
    }
    if (input.consumerServiceId) {
      nextMetadata.consumer_service_id = input.consumerServiceId;
    }
    if (input.consumerWorkshopId) {
      nextMetadata.consumer_workshop_id = input.consumerWorkshopId;
    }
    if (input.consumerEntrySurface) {
      nextMetadata.consumer_entry_surface = input.consumerEntrySurface;
    }
    if (input.consumerTargetPath) {
      nextMetadata.consumer_target_path = input.consumerTargetPath;
    }
  }

  const nextManifest: SessionPackManifest = {
    ...bundle.manifest,
    session_id: input.sessionId,
    session_version: input.sessionVersionId,
    created_at: input.createdAt,
    created_by: {
      user_id: input.inheritedByUserId ?? bundle.manifest.created_by.user_id,
      display_name: bundle.manifest.created_by.display_name,
    },
    source: {
      ...(bundle.manifest.source ?? {}),
      ...(input.inheritMode === "consumer" && input.consumerWorkspaceId
        ? { workspace_id: input.consumerWorkspaceId }
        : {}),
      lineage_parent_version_id: input.inheritedFromSessionVersionId,
    },
    metadata: nextMetadata,
  };

  delete nextManifest.signature;

  return maybeSignSessionPackBundle(
    packSessionVersion({
      manifest: nextManifest,
      files: bundle.files,
    })
  );
}

function buildSyntheticBundle(detail: SessionPackDetail): SessionPackBundle {
  const mcpRequirements = {
    connectors: [
      ...detail.requiredBindings.firstPartyMcpIds.map((id) => ({ id, required: true })),
      ...detail.requiredBindings.externalConnectorRefs.map((id) => ({ id, required: true })),
    ],
    credentials: detail.requiredBindings.credentialIds.map((id) => ({ id, required: true })),
  };

  const runtimeProfile = {
    profile_id: detail.runtimeProfile.profileId,
    runner_image: detail.runtimeProfile.runnerImage ?? undefined,
    browser_required: detail.runtimeProfile.browserRequired || undefined,
    playwright_required: detail.runtimeProfile.playwrightRequired || undefined,
  };

  const conversationLines = [
    {
      role: "system",
      kind: "status",
      text: "Synthetic session-pack archive generated from catalog detail because no persisted imported archive is available.",
    },
    {
      role: "system",
      kind: "text",
      text: `sessionVersionId=${detail.sessionVersionId}; primaryPackageId=${detail.primaryPackageId ?? "-"}`,
    },
  ]
    .map((item) => JSON.stringify(item))
    .join("\n");

  return maybeSignSessionPackBundle(
    packSessionVersion({
      manifest: {
        session_id: detail.sessionId ?? buildSyntheticSessionId(detail.sessionVersionId),
        session_version: detail.sessionVersionId,
      task_family: detail.primaryTaskVersionId ?? detail.displayName.en ?? detail.displayName.zh,
      runtime_profile: runtimeProfile,
      slot_schema_version: "generated.v1",
      required_capabilities: {
        browser: detail.runtimeProfile.browserRequired || detail.runtimeProfile.playwrightRequired,
        filesystem: true,
        downloads: true,
        mcps: [
          ...detail.requiredBindings.firstPartyMcpIds.map((id) => ({ id, required: true })),
          ...detail.requiredBindings.externalConnectorRefs.map((id) => ({ id, required: true })),
        ],
        credentials: detail.requiredBindings.credentialIds.map((id) => ({
          id,
          placement: "env" as const,
          required: true,
        })),
      },
      artifact_contract: {
        outputs: [
          {
            name: "output",
            kind: "directory",
            required: false,
            path_pattern: "output/**",
          },
          {
            name: "receipts",
            kind: "directory",
            required: false,
            path_pattern: "receipts/**",
          },
        ],
      },
      created_by: {
        user_id: "usr_system_session_catalog",
        display_name: "Session Catalog",
      },
      created_at: detail.updatedAt,
      source: {
        creator_package_id: detail.primaryPackageId ?? undefined,
        creator_release_id: detail.sourceReleaseIds[0] ?? undefined,
        lineage_parent_version_id: detail.lineageParentVersionId ?? undefined,
        rollback_from_version_id: detail.rollbackFromVersionId ?? undefined,
      },
      metadata: {
        generated_descriptor: true,
        synthetic_source: "catalog-detail",
      },
    },
    files: {
      "conversation.jsonl": `${conversationLines}\n`,
      [sessionPackWorkspaceBaseFileName]: createEmptyWorkspaceBaseArchive({
        generated: true,
        session_version_id: detail.sessionVersionId,
        source: "catalog-detail",
      }),
      "slot-schema.json": JSON.stringify(
        {
          version: "generated.v1",
          slots: [
            {
              key: "request_context",
              title: "Request context",
              type: "string",
              required: false,
              prompt: "Describe the request context for this session instance.",
            },
          ],
        },
        null,
        2
      ),
      "mcp-requirements.json": JSON.stringify(mcpRequirements, null, 2),
      "runtime-profile.json": JSON.stringify(runtimeProfile, null, 2),
      "redaction-map.json": JSON.stringify(
        {
          version: "generated.v1",
          rules: [],
        },
        null,
        2
      ),
    },
    })
  );
}

async function pathExists(candidate: string) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function resolveLatestRuntimeDerivedRunAggregate(sessionVersionId: string): Promise<RunAggregate | null> {
  const candidates = runsRepository
    .list()
    .filter((aggregate) => aggregate.run.sessionVersionId === sessionVersionId);

  if (candidates.length === 0) {
    return null;
  }

  const ranked = await Promise.all(
    candidates.map(async (aggregate) => ({
      aggregate,
      targetPathExists: await pathExists(aggregate.run.targetPath),
      activityScore:
        aggregate.messages.length > 0 || aggregate.files.length > 0 || aggregate.artifacts.length > 0 ? 1 : 0,
    }))
  );

  ranked.sort((left, right) => {
    if (left.targetPathExists !== right.targetPathExists) {
      return Number(right.targetPathExists) - Number(left.targetPathExists);
    }

    if (left.activityScore !== right.activityScore) {
      return right.activityScore - left.activityScore;
    }

    return right.aggregate.run.updatedAt.localeCompare(left.aggregate.run.updatedAt);
  });

  return ranked[0]?.aggregate ?? null;
}

function buildRuntimeDerivedConversationFile(aggregate: RunAggregate) {
  const lines = aggregate.messages
    .map((message) =>
      JSON.stringify({
        role: message.role,
        kind: message.kind,
        text: message.text,
        created_at: message.createdAt,
      })
    )
    .join("\n");

  if (lines) {
    return `${lines}\n`;
  }

  return `${JSON.stringify({
    role: "system",
    kind: "prompt",
    text: aggregate.startJob.initialPrompt,
    created_at: aggregate.run.createdAt,
  })}\n`;
}

async function buildRuntimeDerivedBundle(
  detail: SessionPackDetail,
  aggregate: RunAggregate
): Promise<{
  bundle: SessionPackBundle;
  runtimeEvidenceSummary: SessionPackRuntimeEvidenceSummary;
  currentRunId: string;
}> {
  const baseBundle = buildSyntheticBundle(detail);
  const { signature: _baseSignature, ...baseManifest } = baseBundle.manifest;
  const informationCollectionReview = buildInformationCollectionReviewFile(
    aggregate.informationCollection
  );
  let workspaceBaseArchive: Uint8Array;
  let workspaceBaseCaptureError: string | null = null;

  try {
    workspaceBaseArchive = await createWorkspaceBaseArchiveFromDirectory(aggregate.run.targetPath, {
      ignoreMissingRoot: true,
      metadata: {
        source: "runtime-derived",
        run_id: aggregate.run.runId,
        target_path: aggregate.run.targetPath,
      },
    });
  } catch (error) {
    workspaceBaseCaptureError =
      error instanceof Error ? error.message : "unknown workspace capture error";
    workspaceBaseArchive = createEmptyWorkspaceBaseArchive({
      source: "runtime-derived",
      run_id: aggregate.run.runId,
      target_path: aggregate.run.targetPath,
      capture_error: workspaceBaseCaptureError,
    });
  }

  const runtimeEvidenceEntry = buildSessionPackRuntimeEvidenceEntryFromAggregate({
    sessionVersionId: detail.sessionVersionId,
    aggregate,
    archiveSource: "runtime-derived",
    capturedAt: maxNullableIso([
      aggregate.runtime?.finishedAt,
      aggregate.runtime?.readyAt,
      aggregate.runtime?.startedAt,
      aggregate.run.updatedAt,
    ]) ?? aggregate.run.updatedAt,
    runtimeProfile: detail.runtimeProfile,
    manifestRuntimeDerived: true,
    runtimeSourceUpdatedAt: aggregate.run.updatedAt,
    workspaceBaseCaptureError,
  });
  const runtimeEvidenceSummary =
    buildSessionPackRuntimeEvidenceSummaryFromEntries({
      entries: [runtimeEvidenceEntry],
      currentRunId: aggregate.run.runId,
    }) ??
    sessionPackRuntimeEvidenceSummarySchema.parse({
      totalRecords: 0,
      items: [],
    });

  const bundle = maybeSignSessionPackBundle(
    packSessionVersion({
      manifest: {
        ...baseManifest,
        source: {
          ...(baseManifest.source ?? {}),
          workspace_id: baseManifest.source?.workspace_id ?? aggregate.run.workspaceId,
        },
        metadata: {
          ...(baseManifest.metadata ?? {}),
          runtime_derived: true,
          runtime_source_run_id: aggregate.run.runId,
          runtime_source_updated_at: aggregate.run.updatedAt,
          runtime_source_target_path: aggregate.run.targetPath,
        },
      },
      files: {
        ...baseBundle.files,
        "conversation.jsonl": buildRuntimeDerivedConversationFile(aggregate),
        ...(informationCollectionReview
          ? {
              [sessionPackInformationCollectionReviewFileName]: JSON.stringify(
                informationCollectionReview,
                null,
                2
              ),
            }
          : {}),
        [sessionPackRuntimeEvidenceFileName]: JSON.stringify(runtimeEvidenceSummary, null, 2),
        [sessionPackWorkspaceBaseFileName]: workspaceBaseArchive,
      },
    })
  );

  return {
    bundle,
    runtimeEvidenceSummary,
    currentRunId: aggregate.run.runId,
  };
}

async function resolveBundleForInformationCollection(detail: SessionPackDetail) {
  const persisted = await sessionArchiveRepository.readImportedArchiveBytes(detail.sessionVersionId);
  const persistedRecord = persisted
    ? sessionArchiveRepository.getImportedArchiveBySessionVersionId(detail.sessionVersionId)
    : null;

  if (persisted) {
    return {
      bundle: deserializeSessionPackBundle(persisted),
      source:
        persistedRecord?.archiveSource === "runtime-derived"
          ? ("runtime-derived" as const)
          : ("imported" as const),
      currentRunId: persistedRecord?.runtimeSourceRunId ?? null,
    };
  }

  const runtimeDerivedAggregate = await resolveLatestRuntimeDerivedRunAggregate(detail.sessionVersionId);
  if (runtimeDerivedAggregate) {
    const runtimeDerived = await buildRuntimeDerivedBundle(detail, runtimeDerivedAggregate);
    return {
      bundle: runtimeDerived.bundle,
      source: "runtime-derived" as const,
      currentRunId: runtimeDerived.currentRunId,
    };
  }

  return {
    bundle: buildSyntheticBundle(detail),
    source: "generated" as const,
    currentRunId: null,
  };
}

class SessionCatalogService {
  async listSessionPacks(query: ListSessionPacksQuery = {}, actor?: SessionActor) {
    await initializeSessionInfrastructure();
    const details = this.#listDetails(actor);
    const filtered = details
      .filter((detail) => {
        if (actor?.workspaceContextKey && !detail.workspaceContextKeys.includes(actor.workspaceContextKey)) {
          return false;
        }
        if (query.workspaceContextKey && !detail.workspaceContextKeys.includes(query.workspaceContextKey)) {
          return false;
        }
        if (query.packageId && !detail.sourcePackageIds.includes(query.packageId)) {
          return false;
        }
        if (query.serviceId && !detail.linkedServiceIds.includes(query.serviceId)) {
          return false;
        }
        if (
          query.q &&
          !matchesSearchQuery(query.q, [
            detail.sessionVersionId,
            detail.primaryPackageId,
            detail.primaryTaskVersionId,
            detail.displayName.zh,
            detail.displayName.en,
            detail.summary.zh,
            detail.summary.en,
            ...detail.linkedServiceIds,
            ...detail.linkedWorkshopIds,
            ...detail.workspaceContextKeys,
          ])
        ) {
          return false;
        }
        return true;
      })
      .map((detail) => toSummary(detail))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return filtered;
  }

  async getSessionPack(sessionVersionId: string, actor?: SessionActor) {
    await initializeSessionInfrastructure();
    const detail = this.#getRequiredDetail(canonicalizeLookupSessionVersionId(sessionVersionId));

    if (
      actor?.workspaceContextKey &&
      !detail.workspaceContextKeys.includes(actor.workspaceContextKey)
    ) {
      throw new AppError(404, "SESSION_PACK_NOT_FOUND", `Session pack not found: ${sessionVersionId}`);
    }

    const visibleDetails = this.#listDetails(actor);
    const scopedDetail =
      visibleDetails.find((item) => item.sessionVersionId === detail.sessionVersionId) ?? detail;
    return await enrichSessionPackDetail(scopedDetail, visibleDetails);
  }

  async tryResolveInformationCollectionTemplate(
    sessionVersionId: string,
    actor?: SessionActor
  ): Promise<{
    slotSchemaVersion: string | null;
    slots: SessionPackSlotDefinition[];
    source: "imported" | "runtime-derived" | "generated";
  } | null> {
    await initializeSessionInfrastructure();
    let detail: SessionPackDetail;

    try {
      detail = await this.getSessionPack(sessionVersionId, actor);
    } catch (error) {
      if (error instanceof AppError && error.code === "SESSION_PACK_NOT_FOUND") {
        return null;
      }

      throw error;
    }

    const resolved = await resolveBundleForInformationCollection(detail);
    const slotSchema = parseSlotSchema(resolved.bundle);

    return {
      slotSchemaVersion: slotSchema.version ?? null,
      slots: slotSchema.slots,
      source: resolved.source,
    };
  }

  async getSessionPackLineage(
    sessionVersionId: string,
    actor?: SessionActor
  ): Promise<SessionPackLineageResponse> {
    await initializeSessionInfrastructure();
    const focus = await this.getSessionPack(sessionVersionId, actor);
    const visibleDetails = this.#listDetails(actor);
    const detailBySessionVersionId = new Map(
      visibleDetails.map((detail) => [detail.sessionVersionId, detail] as const)
    );
    const ancestors: SessionPackLineageEntry[] = [];
    const descendants: SessionPackLineageEntry[] = [];

    const seenAncestors = new Set<string>([focus.sessionVersionId]);
    const ancestorQueue: Array<{
      sessionVersionId: string;
      relation: SessionPackLineageRelation;
      depth: number;
      viaSessionVersionId: string | null;
    }> = [];
    const enqueueAncestor = (
      targetSessionVersionId: string | null | undefined,
      relation: SessionPackLineageRelation,
      depth: number,
      viaSessionVersionId: string | null
    ) => {
      if (!targetSessionVersionId || seenAncestors.has(targetSessionVersionId)) {
        return;
      }

      const detail = detailBySessionVersionId.get(targetSessionVersionId);
      if (!detail) {
        return;
      }

      seenAncestors.add(targetSessionVersionId);
      ancestorQueue.push({
        sessionVersionId: targetSessionVersionId,
        relation,
        depth,
        viaSessionVersionId,
      });
    };

    enqueueAncestor(
      focus.lineageParentVersionId,
      "lineage_parent",
      1,
      focus.sessionVersionId
    );
    enqueueAncestor(
      focus.rollbackFromVersionId,
      "rollback_source",
      1,
      focus.sessionVersionId
    );

    while (ancestorQueue.length > 0) {
      const current = ancestorQueue.shift()!;
      const detail = detailBySessionVersionId.get(current.sessionVersionId);
      if (!detail) {
        continue;
      }

      ancestors.push(
        buildLineageEntry(
          detail,
          current.relation,
          current.depth,
          current.viaSessionVersionId
        )
      );
      enqueueAncestor(
        detail.lineageParentVersionId,
        "lineage_parent",
        current.depth + 1,
        detail.sessionVersionId
      );
      enqueueAncestor(
        detail.rollbackFromVersionId,
        "rollback_source",
        current.depth + 1,
        detail.sessionVersionId
      );
    }

    descendants.push(
      ...collectLineageDescendantNodes(focus, visibleDetails).map((node) =>
        buildLineageEntry(node.detail, node.relation, node.depth, node.viaSessionVersionId)
      )
    );

    ancestors.sort(sortLineageEntries);
    descendants.sort(sortLineageEntries);

    return sessionPackLineageResponseSchema.parse({
      focus,
      ancestors,
      descendants,
    });
  }

  requireSessionPack(sessionVersionId: string, constraint: SessionPackConstraint = {}) {
    const governanceState = adminRepository.getResourceState("session", sessionVersionId);
    if (governanceState?.status === "quarantined" || governanceState?.status === "disabled") {
      throw new AppError(
        409,
        "SESSION_PACK_QUARANTINED",
        `Session pack is unavailable by platform governance: ${sessionVersionId}`
      );
    }

    if (!sessionInfrastructureReady) {
      throw new Error("Session infrastructure is not initialized.");
    }

    const canonicalSessionVersionId = canonicalizeLookupSessionVersionId(sessionVersionId);
    const detail = this.#getRequiredDetail(canonicalSessionVersionId);

    if (
      constraint.workspaceContextKey &&
      !detail.workspaceContextKeys.includes(constraint.workspaceContextKey)
    ) {
      throw new AppError(
        409,
        "SESSION_PACK_WORKSPACE_CONTEXT_INVALID",
        `Session pack ${canonicalSessionVersionId} is not available in workspace context ${constraint.workspaceContextKey}`
      );
    }

    if (
      constraint.serviceId &&
      detail.linkedServiceIds.length > 0 &&
      !detail.linkedServiceIds.includes(constraint.serviceId)
    ) {
      throw new AppError(
        409,
        "SESSION_PACK_SERVICE_INVALID",
        `Session pack ${canonicalSessionVersionId} is not linked to service ${constraint.serviceId}`
      );
    }

    if (
      constraint.packageId &&
      detail.sourcePackageIds.length > 0 &&
      !detail.sourcePackageIds.includes(constraint.packageId)
    ) {
      throw new AppError(
        409,
        "SESSION_PACK_PACKAGE_INVALID",
        `Session pack ${canonicalSessionVersionId} is not linked to creator package ${constraint.packageId}`
      );
    }

    return detail;
  }

  async importSessionPackArchive(
    serialized: Uint8Array | ArrayBuffer,
    input: {
      workspaceContextKey: string;
      importedByUserId?: string | null;
    }
  ): Promise<ImportSessionPackArchiveResponse> {
    await initializeSessionInfrastructure();
    const bundle = deserializeSessionPackBundle(serialized);
    assertValidSessionPackSignatureForImport(bundle);
    const sessionVersionId = normalizeSessionVersionId(bundle.manifest.session_version);
    const archiveBytes =
      serialized instanceof Uint8Array ? serialized : new Uint8Array(serialized);
    const importedAt = nowIso();
    const mcpRequirements = parseMcpRequirements(bundle);
    const requiredBindings = buildBindingsFromManifest(bundle.manifest, mcpRequirements);
    const record = buildPersistedArchiveRecord({
      sessionVersionId,
      workspaceContextKeys: [input.workspaceContextKey],
      requiredBindings,
      archiveBytes,
      persistedAt: importedAt,
      persistedByUserId: input.importedByUserId ?? null,
      archiveSource: "imported",
      runtimeEvidenceEntries:
        parseSessionPackRuntimeEvidenceSummaryFromBundle(bundle)?.items ?? [],
      manifest: {
        ...bundle.manifest,
        session_version: sessionVersionId,
      },
    });

    await sessionArchiveRepository.saveImportedArchive(record, archiveBytes);
    const sessionPack = await this.getSessionPack(sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.importedByUserId ?? null,
    });

    return {
      sessionPack,
      archiveDownloadPath: buildArchiveDownloadPath(sessionVersionId),
      archiveFileName: record.archiveFileName,
      archiveSizeBytes: record.archiveSizeBytes,
      importedAt: record.importedAt,
      importedByUserId: record.importedByUserId,
      persistedArchive: true,
    };
  }

  async inheritSessionPack(
    parentSessionVersionId: string,
    input: InheritSessionPackInput
  ): Promise<InheritSessionPackResponse> {
    await initializeSessionInfrastructure();
    const parentDetail = await this.getSessionPack(parentSessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.inheritedByUserId ?? null,
    });
    assertSessionPackGovernanceActionAllowed(parentDetail, "inherit");
    const inheritMode = input.inheritMode ?? "draft";
    const exportedParent = await this.exportSessionPackArchive(parentDetail.sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.inheritedByUserId ?? null,
    });
    const parentBundle = deserializeSessionPackBundle(exportedParent.content);
    const sessionVersionId = input.newSessionVersionId
      ? normalizeSessionVersionId(input.newSessionVersionId)
      : inheritMode === "consumer"
        ? buildConsumerSessionVersionId(parentDetail.sessionVersionId, {
            runId: input.consumerRunId,
            workspaceContextKey: input.workspaceContextKey,
            serviceId: input.consumerServiceId,
            entrySurface: input.consumerEntrySurface,
            targetPath: input.consumerTargetPath,
          })
        : buildInheritedSessionVersionId(parentDetail.sessionVersionId);

    if (this.#listDetails().some((item) => item.sessionVersionId === sessionVersionId)) {
      throw new AppError(
        409,
        "SESSION_PACK_VERSION_CONFLICT",
        `Session pack ${sessionVersionId} already exists`
      );
    }

    const sessionId = input.newSessionId
      ? normalizeSessionId(input.newSessionId)
      : inheritMode === "consumer"
        ? buildConsumerSessionId(parentDetail.sessionVersionId, {
            runId: input.consumerRunId,
            workspaceContextKey: input.workspaceContextKey,
            serviceId: input.consumerServiceId,
            entrySurface: input.consumerEntrySurface,
            targetPath: input.consumerTargetPath,
          })
        : sessionIdSchema.safeParse(parentBundle.manifest.session_id).success
          ? parentBundle.manifest.session_id
          : buildInheritedSessionId(parentDetail.sessionVersionId);
    const inheritedAt = nowIso();
    const inheritedBundle = cloneBundleForInheritedSessionPack(parentBundle, {
      inheritMode,
      sessionId,
      sessionVersionId,
      inheritedByUserId: input.inheritedByUserId ?? null,
      inheritedFromSessionVersionId: parentDetail.sessionVersionId,
      reason: input.reason ?? null,
      createdAt: inheritedAt,
      consumerWorkspaceId: input.consumerWorkspaceId ?? null,
      consumerRunId: input.consumerRunId ?? null,
      consumerServiceId: input.consumerServiceId ?? null,
      consumerWorkshopId: input.consumerWorkshopId ?? null,
      consumerEntrySurface: input.consumerEntrySurface ?? null,
      consumerTargetPath: input.consumerTargetPath ?? null,
      consumerWorkspaceContextKey: input.workspaceContextKey,
    });
    const archiveBytes = serializeSessionPackBundle(inheritedBundle);
    const mcpRequirements = parseMcpRequirements(inheritedBundle);
    const requiredBindings = buildBindingsFromManifest(inheritedBundle.manifest, mcpRequirements);
    const record = buildPersistedArchiveRecord({
      sessionVersionId,
      workspaceContextKeys: [input.workspaceContextKey],
      requiredBindings,
      archiveBytes,
      persistedAt: inheritedAt,
      persistedByUserId: input.inheritedByUserId ?? null,
      archiveSource: "imported",
      runtimeSourceRunId: input.consumerRunId ?? null,
      runtimeSourceTargetPath: input.consumerTargetPath ?? null,
      runtimeSourceUpdatedAt: inheritMode === "consumer" ? inheritedAt : null,
      runtimeEvidenceEntries:
        parseSessionPackRuntimeEvidenceSummaryFromBundle(inheritedBundle)?.items ?? [],
      manifest: inheritedBundle.manifest,
    });

    await sessionArchiveRepository.saveImportedArchive(record, archiveBytes);
    const sessionPack = await this.getSessionPack(sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.inheritedByUserId ?? null,
    });

    return {
      sessionPack,
      archiveDownloadPath: buildArchiveDownloadPath(sessionVersionId),
      archiveFileName: record.archiveFileName,
      archiveSizeBytes: record.archiveSizeBytes,
      inheritedAt,
      inheritedByUserId: input.inheritedByUserId ?? null,
      inheritedFromSessionVersionId: parentDetail.sessionVersionId,
      inheritMode,
      createdDraft: inheritMode === "draft",
    };
  }

  async ensureConsumerSessionPackForRun(
    parentSessionVersionId: string,
    input: {
      workspaceContextKey: string;
      workspaceId: string;
      runId: string;
      serviceId: string;
      workshopId?: string | null;
      entrySurface: EntrySurface;
      targetPath: string;
      inheritedByUserId?: string | null;
    }
  ) {
    await initializeSessionInfrastructure();
    const canonicalParentSessionVersionId = canonicalizeLookupSessionVersionId(parentSessionVersionId);
    const parentImportedRecord =
      sessionArchiveRepository.getImportedArchiveBySessionVersionId(canonicalParentSessionVersionId);

    if (parentImportedRecord && isConsumerInheritedManifest(parentImportedRecord.manifest)) {
      return this.getSessionPack(canonicalParentSessionVersionId, {
        workspaceContextKey: input.workspaceContextKey,
        userId: input.inheritedByUserId ?? null,
      });
    }

    const plannedSessionVersionId = buildConsumerSessionVersionId(
      canonicalParentSessionVersionId,
      {
        runId: input.runId,
        workspaceContextKey: input.workspaceContextKey,
        serviceId: input.serviceId,
        entrySurface: input.entrySurface,
        targetPath: input.targetPath,
      }
    );
    const existingDerivedRecord =
      sessionArchiveRepository.getImportedArchiveBySessionVersionId(plannedSessionVersionId);
    if (existingDerivedRecord && isConsumerInheritedManifest(existingDerivedRecord.manifest)) {
      return this.getSessionPack(plannedSessionVersionId, {
        workspaceContextKey: input.workspaceContextKey,
        userId: input.inheritedByUserId ?? null,
      });
    }

    const inherited = await this.inheritSessionPack(canonicalParentSessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      inheritedByUserId: input.inheritedByUserId ?? null,
      inheritMode: "consumer",
      newSessionId: buildConsumerSessionId(canonicalParentSessionVersionId, {
        runId: input.runId,
        workspaceContextKey: input.workspaceContextKey,
        serviceId: input.serviceId,
        entrySurface: input.entrySurface,
        targetPath: input.targetPath,
      }),
      newSessionVersionId: plannedSessionVersionId,
      reason: `consumer run ${input.runId}`,
      consumerWorkspaceId: input.workspaceId,
      consumerRunId: input.runId,
      consumerServiceId: input.serviceId,
      consumerWorkshopId: input.workshopId ?? null,
      consumerEntrySurface: input.entrySurface,
      consumerTargetPath: input.targetPath,
    });

    return inherited.sessionPack;
  }

  async publishSessionPack(sessionVersionId: string, input: PublishSessionPackInput) {
    await initializeSessionInfrastructure();
    const sessionPack = await this.getSessionPack(sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.publishedByUserId ?? null,
    });
    assertSessionPackGovernanceActionAllowed(sessionPack, "publish");
    const { context, service } = requireVisibleContextService(input.serviceId, input.workspaceContextKey);
    const entrySurfaces = resolveTargetEntrySurfaces(context.allowedEntrySurfaces, input);
    this.#assertNoCreatorActivationConflict(input.serviceId, context.contextKey, sessionPack.sessionVersionId);
    const replacedSessionVersionIds = new Set<string>();

    for (const entrySurface of entrySurfaces) {
      const existing =
        workshopCatalogRepository.findLaunchTemplate(input.serviceId, context.contextKey, entrySurface) ??
        workshopCatalogRepository.findLaunchTemplate(input.serviceId, context.contextKey, "dashboard");
      const taskVersionId =
        input.taskVersionId ??
        existing?.taskVersionId ??
        sessionPack.primaryTaskVersionId;

      if (!taskVersionId) {
        throw new AppError(
          409,
          "SESSION_PACK_TASK_VERSION_REQUIRED",
          `No task version id is available to publish ${sessionPack.sessionVersionId} for service ${input.serviceId}`
        );
      }

      if (existing?.sessionVersionId && existing.sessionVersionId !== sessionPack.sessionVersionId) {
        replacedSessionVersionIds.add(existing.sessionVersionId);
      }

      await workshopCatalogRepository.saveLaunchTemplate(
        launchTemplateRecordSchema.parse({
          templateKey: buildLaunchTemplateKey(input.serviceId, context.contextKey, entrySurface),
          serviceId: input.serviceId,
          workspaceContextKey: context.contextKey,
          entrySurface,
          taskVersionId,
          sessionVersionId: sessionPack.sessionVersionId,
          title: input.title ?? existing?.title ?? service.displayName,
          targetRoot: input.targetRoot ?? existing?.targetRoot ?? deriveTargetRoot(context.root, input.serviceId),
          bindings: input.bindings ?? existing?.bindings ?? service.requiredBindings,
        })
      );
    }

    const publishedAt = nowIso();
    const refreshed = await this.getSessionPack(sessionPack.sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.publishedByUserId ?? null,
    });
    const publishedTargets = refreshed.publishedTargets.filter(
      (item) =>
        item.serviceId === input.serviceId &&
        item.workspaceContextKey === context.contextKey &&
        entrySurfaces.includes(item.entrySurface)
    );

    return publishSessionPackResponseSchema.parse({
      sessionPack: refreshed,
      publishedTargets,
      publishedAt,
      publishedByUserId: input.publishedByUserId ?? null,
      publishedSessionVersionId: sessionPack.sessionVersionId,
      replacedSessionVersionIds: [...replacedSessionVersionIds].sort(),
    });
  }

  async rollbackSessionPack(sessionVersionId: string, input: RollbackSessionPackInput) {
    await initializeSessionInfrastructure();
    const currentSessionPack = await this.getSessionPack(sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.rolledBackByUserId ?? null,
    });
    const rollbackTarget = await this.getSessionPack(input.rollbackToSessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.rolledBackByUserId ?? null,
    });
    assertSessionPackGovernanceActionAllowed(rollbackTarget, "rollback");
    const { context } = requireVisibleContextService(input.serviceId, input.workspaceContextKey);
    const entrySurfaces = resolveTargetEntrySurfaces(context.allowedEntrySurfaces, input);
    this.#assertNoCreatorActivationConflict(input.serviceId, context.contextKey, rollbackTarget.sessionVersionId);
    const currentTemplates = entrySurfaces.map((entrySurface) => {
      const template = workshopCatalogRepository.findLaunchTemplate(
        input.serviceId,
        context.contextKey,
        entrySurface
      );

      if (!template) {
        throw new AppError(
          409,
          "SESSION_PACK_ROLLBACK_TARGET_NOT_PUBLISHED",
          `No launch template is currently published for service ${input.serviceId} in ${context.contextKey} on ${entrySurface}`
        );
      }

      if (template.sessionVersionId !== currentSessionPack.sessionVersionId) {
        throw new AppError(
          409,
          "SESSION_PACK_ROLLBACK_TARGET_MISMATCH",
          `Launch template ${template.templateKey} currently points to ${template.sessionVersionId}, not ${currentSessionPack.sessionVersionId}`
        );
      }

      return template;
    });
    const replacedSessionVersionIds = new Set<string>();

    for (const template of currentTemplates) {
      const taskVersionId = rollbackTarget.primaryTaskVersionId ?? template.taskVersionId;
      if (!taskVersionId) {
        throw new AppError(
          409,
          "SESSION_PACK_TASK_VERSION_REQUIRED",
          `No task version id is available to roll back ${template.templateKey}`
        );
      }

      if (template.sessionVersionId !== rollbackTarget.sessionVersionId) {
        replacedSessionVersionIds.add(template.sessionVersionId);
      }

      await workshopCatalogRepository.saveLaunchTemplate(
        launchTemplateRecordSchema.parse({
          ...template,
          taskVersionId,
          sessionVersionId: rollbackTarget.sessionVersionId,
          bindings: rollbackTarget.requiredBindings,
        })
      );
    }

    const rolledBackAt = nowIso();
    const refreshed = await this.getSessionPack(rollbackTarget.sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.rolledBackByUserId ?? null,
    });
    const publishedTargets = refreshed.publishedTargets.filter(
      (item) =>
        item.serviceId === input.serviceId &&
        item.workspaceContextKey === context.contextKey &&
        entrySurfaces.includes(item.entrySurface)
    );

    return rollbackSessionPackResponseSchema.parse({
      sessionPack: refreshed,
      publishedTargets,
      rolledBackAt,
      rolledBackByUserId: input.rolledBackByUserId ?? null,
      rolledBackFromSessionVersionId: currentSessionPack.sessionVersionId,
      rolledBackToSessionVersionId: rollbackTarget.sessionVersionId,
      replacedSessionVersionIds: [...replacedSessionVersionIds].sort(),
    });
  }

  async unpublishSessionPack(sessionVersionId: string, input: UnpublishSessionPackInput) {
    await initializeSessionInfrastructure();
    const currentSessionPack = await this.getSessionPack(sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.unpublishedByUserId ?? null,
    });
    assertSessionPackGovernanceActionAllowed(currentSessionPack, "unpublish");
    const { context } = requireVisibleContextService(input.serviceId, input.workspaceContextKey);
    const entrySurfaces = resolveTargetEntrySurfaces(context.allowedEntrySurfaces, input);
    this.#assertNoCreatorActivationForUnpublish(input.serviceId, context.contextKey);

    const selectedTemplates = entrySurfaces
      .map((entrySurface) =>
        workshopCatalogRepository.findLaunchTemplate(input.serviceId, context.contextKey, entrySurface)
      )
      .filter((item): item is LaunchTemplateRecord => item !== null);

    if (input.entrySurface) {
      const template = selectedTemplates[0] ?? null;
      if (!template) {
        throw new AppError(
          409,
          "SESSION_PACK_UNPUBLISH_TARGET_NOT_PUBLISHED",
          `No launch template is currently published for service ${input.serviceId} in ${context.contextKey} on ${input.entrySurface}`
        );
      }

      if (template.sessionVersionId !== currentSessionPack.sessionVersionId) {
        throw new AppError(
          409,
          "SESSION_PACK_UNPUBLISH_TARGET_MISMATCH",
          `Launch template ${template.templateKey} currently points to ${template.sessionVersionId}, not ${currentSessionPack.sessionVersionId}`
        );
      }
    }

    const matchingTemplates = selectedTemplates.filter(
      (item) => item.sessionVersionId === currentSessionPack.sessionVersionId
    );

    if (matchingTemplates.length === 0) {
      throw new AppError(
        409,
        "SESSION_PACK_UNPUBLISH_TARGET_NOT_PUBLISHED",
        `Session ${currentSessionPack.sessionVersionId} is not currently published for service ${input.serviceId} in ${context.contextKey}`
      );
    }

    await workshopCatalogRepository.deleteLaunchTemplates(
      matchingTemplates.map((item) => item.templateKey)
    );

    const unpublishedAt = nowIso();
    const refreshed = await this.getSessionPack(currentSessionPack.sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.unpublishedByUserId ?? null,
    });

    return unpublishSessionPackResponseSchema.parse({
      sessionPack: refreshed,
      unpublishedTargets: matchingTemplates.map((item) => toPublishedTarget(item)),
      unpublishedAt,
      unpublishedByUserId: input.unpublishedByUserId ?? null,
      unpublishedSessionVersionId: currentSessionPack.sessionVersionId,
      removedTemplateKeys: matchingTemplates.map((item) => item.templateKey).sort(),
    });
  }

  async exportSessionPackArchive(
    sessionVersionId: string,
    actor?: SessionActor,
    options?: ExportSessionPackArchiveOptions
  ): Promise<ExportedSessionPackArchive> {
    const detail = await this.getSessionPack(sessionVersionId, actor);
    if (options?.redact) {
      assertSessionPackGovernanceActionAllowed(detail, "archive-redacted");
    }
    const fileName = buildSessionArchiveFileName(detail.sessionVersionId);
    const persisted = await sessionArchiveRepository.readImportedArchiveBytes(detail.sessionVersionId);
    const persistedRecord = persisted
      ? sessionArchiveRepository.getImportedArchiveBySessionVersionId(detail.sessionVersionId)
      : null;

    if (persisted && persistedRecord) {
      const persistedBundle = deserializeSessionPackBundle(persisted);
      const persistedSource = sessionPackArchiveSourceSchema.parse(
        persistedRecord.archiveSource
      );
      const signatureCheck = verifySessionPackManifestSignature(
        persistedBundle.manifest,
        buildSessionPackSignatureVerificationOptions()
      );
      if (!signatureCheck.ok && !(signatureCheck.missing && buildSessionPackSigningOptions())) {
        throw new AppError(
          409,
          signatureCheck.missing ? "SESSION_PACK_SIGNATURE_REQUIRED" : "SESSION_PACK_SIGNATURE_INVALID",
          `Persisted session pack ${detail.sessionVersionId} failed signature verification: ${signatureCheck.reason ?? "unknown signature failure"}`
        );
      }

      const exportedBundle = maybeRedactSessionPackBundle(persistedBundle, options);
      if (options?.redact) {
        const exportedBytes = serializeSessionPackBundle(exportedBundle.bundle);
        await recordSessionPackArchiveExport({
          detail,
          actor,
          baseBundle: persistedBundle,
          baseArchiveBytes: persisted,
          source: persistedSource,
          exportedBytes,
          fileName,
          redacted: exportedBundle.redacted,
        });
        return {
          content: exportedBytes,
          fileName,
          source: persistedSource,
          redacted: exportedBundle.redacted,
        };
      }

      const signedBundle = maybeSignSessionPackBundle(persistedBundle);
      if (!hasSameSessionPackSignature(persistedBundle.manifest, signedBundle.manifest)) {
        const archiveBytes = serializeSessionPackBundle(signedBundle);
        const mcpRequirements = parseMcpRequirements(signedBundle);
        const requiredBindings = buildBindingsFromManifest(
          signedBundle.manifest,
          mcpRequirements
        );
        const updatedRecord = replacePersistedArchiveRecordArchive({
          record: persistedRecord,
          manifest: signedBundle.manifest,
          requiredBindings,
          archiveBytes,
          updatedAt: nowIso(),
        });
        await sessionArchiveRepository.saveImportedArchive(updatedRecord, archiveBytes);
        await recordSessionPackArchiveExport({
          detail,
          actor,
          baseBundle: signedBundle,
          baseArchiveBytes: archiveBytes,
          source: persistedSource,
          exportedBytes: archiveBytes,
          fileName,
          redacted: false,
        });
        return {
          content: archiveBytes,
          fileName,
          source: persistedSource,
          redacted: false,
        };
      }

      await recordSessionPackArchiveExport({
        detail,
        actor,
        baseBundle: persistedBundle,
        baseArchiveBytes: persisted,
        source: persistedSource,
        exportedBytes: persisted,
        fileName,
        redacted: false,
      });
      return {
        content: persisted,
        fileName,
        source: persistedSource,
        redacted: false,
      };
    }

    const runtimeDerivedAggregate = await resolveLatestRuntimeDerivedRunAggregate(detail.sessionVersionId);
    if (runtimeDerivedAggregate) {
      const runtimeDerived = await buildRuntimeDerivedBundle(detail, runtimeDerivedAggregate);
      const archiveBytes = serializeSessionPackBundle(runtimeDerived.bundle);
      if (options?.redact) {
        const exportedBundle = maybeRedactSessionPackBundle(runtimeDerived.bundle, options);
        const exportedBytes = serializeSessionPackBundle(exportedBundle.bundle);
        await recordSessionPackArchiveExport({
          detail,
          actor,
          baseBundle: runtimeDerived.bundle,
          baseArchiveBytes: archiveBytes,
          source: "runtime-derived",
          exportedBytes,
          fileName,
          redacted: exportedBundle.redacted,
        });
        return {
          content: exportedBytes,
          fileName,
          source: "runtime-derived",
          redacted: exportedBundle.redacted,
        };
      }

      const record = buildPersistedArchiveRecord({
        sessionVersionId: detail.sessionVersionId,
        workspaceContextKeys: detail.workspaceContextKeys,
        requiredBindings: detail.requiredBindings,
        archiveBytes,
        persistedAt: maxIso(detail.updatedAt, runtimeDerivedAggregate.run.updatedAt),
        persistedByUserId: runtimeDerivedAggregate.run.requestedByUserId ?? null,
        archiveSource: "runtime-derived",
        runtimeSourceRunId: runtimeDerivedAggregate.run.runId,
        runtimeSourceTargetPath: runtimeDerivedAggregate.run.targetPath,
        runtimeSourceUpdatedAt: runtimeDerivedAggregate.run.updatedAt,
        runtimeEvidenceEntries: runtimeDerived.runtimeEvidenceSummary.items,
        manifest: runtimeDerived.bundle.manifest,
      });
      await sessionArchiveRepository.saveImportedArchive(record, archiveBytes);
      await recordSessionPackArchiveExport({
        detail,
        actor,
        baseBundle: runtimeDerived.bundle,
        baseArchiveBytes: archiveBytes,
        source: "runtime-derived",
        exportedBytes: archiveBytes,
        fileName,
        redacted: false,
      });
      return {
        content: archiveBytes,
        fileName,
        source: "runtime-derived",
        redacted: false,
      };
    }

    const generatedBundle = buildSyntheticBundle(detail);
    const generatedArchiveBytes = serializeSessionPackBundle(generatedBundle);
    if (options?.redact) {
      const exportedBundle = maybeRedactSessionPackBundle(generatedBundle, options);
      const exportedBytes = serializeSessionPackBundle(exportedBundle.bundle);
      await recordSessionPackArchiveExport({
        detail,
        actor,
        baseBundle: generatedBundle,
        baseArchiveBytes: generatedArchiveBytes,
        source: "generated",
        exportedBytes,
        fileName,
        redacted: exportedBundle.redacted,
      });
      return {
        content: exportedBytes,
        fileName,
        source: "generated",
        redacted: exportedBundle.redacted,
      };
    }

    await recordSessionPackArchiveExport({
      detail,
      actor,
      baseBundle: generatedBundle,
      baseArchiveBytes: generatedArchiveBytes,
      source: "generated",
      exportedBytes: generatedArchiveBytes,
      fileName,
      redacted: false,
    });
    return {
      content: generatedArchiveBytes,
      fileName,
      source: "generated",
      redacted: false,
    };
  }

  async exportSessionPackArchiveForRun(runId: string): Promise<ExportedSessionPackArchive> {
    await initializeSessionInfrastructure();
    const aggregate = runsRepository.get(runId);
    if (!aggregate) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }
    if (!aggregate.run.sessionVersionId) {
      throw new AppError(
        409,
        "RUN_SESSION_PACK_NOT_APPLICABLE",
        `Run ${runId} uses blank session bootstrap`
      );
    }

    const detail = this.#getRequiredDetail(
      canonicalizeLookupSessionVersionId(aggregate.run.sessionVersionId)
    );
    const fileName = buildSessionArchiveFileName(detail.sessionVersionId);
    const runtimeDerived = await buildRuntimeDerivedBundle(detail, aggregate);
    const archiveBytes = serializeSessionPackBundle(runtimeDerived.bundle);
    const persistedRecord = sessionArchiveRepository.getImportedArchiveBySessionVersionId(
      detail.sessionVersionId
    );

    if (!persistedRecord || persistedRecord.archiveSource === "runtime-derived") {
      const record = buildPersistedArchiveRecord({
        sessionVersionId: detail.sessionVersionId,
        workspaceContextKeys: detail.workspaceContextKeys,
        requiredBindings: detail.requiredBindings,
        archiveBytes,
        persistedAt: maxIso(detail.updatedAt, aggregate.run.updatedAt),
        persistedByUserId: aggregate.run.requestedByUserId ?? null,
        archiveSource: "runtime-derived",
        runtimeSourceRunId: aggregate.run.runId,
        runtimeSourceTargetPath: aggregate.run.targetPath,
        runtimeSourceUpdatedAt: aggregate.run.updatedAt,
        runtimeEvidenceEntries: runtimeDerived.runtimeEvidenceSummary.items,
        manifest: runtimeDerived.bundle.manifest,
      });
      await sessionArchiveRepository.saveImportedArchive(record, archiveBytes);
    }

    return {
      content: archiveBytes,
      fileName,
      source: "runtime-derived",
      redacted: false,
    };
  }

  async updateSessionPackRedactionMap(
    sessionVersionId: string,
    input: UpdateSessionPackRedactionMapInput
  ): Promise<UpdateSessionPackRedactionMapResponse> {
    const detail = await this.getSessionPack(sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.updatedByUserId ?? null,
    });
    const resolved = await resolveBundleForInformationCollection(detail);
    const slotSchema = parseSlotSchema(resolved.bundle);
    const slotByKey = new Map(slotSchema.slots.map((slot) => [slot.key, slot] as const));
    const seenRuleIds = new Set<string>();
    const curatedSecretSlotKeys = uniqueStrings(input.curatedSecretSlotKeys ?? []);

    for (const slotKey of curatedSecretSlotKeys) {
      if (!slotByKey.has(slotKey)) {
        throw new AppError(
          409,
          "SESSION_PACK_REDACTION_SECRET_SLOT_MISSING",
          `Curated secret slot ${slotKey} does not exist in the current slot schema`
        );
      }
    }

    for (const rule of input.rules) {
      if (seenRuleIds.has(rule.ruleId)) {
        throw new AppError(
          409,
          "SESSION_PACK_REDACTION_RULE_DUPLICATE",
          `Redaction rule id already exists in this update payload: ${rule.ruleId}`
        );
      }
      seenRuleIds.add(rule.ruleId);
      if (rule.slotKey && !slotByKey.has(rule.slotKey)) {
        throw new AppError(
          409,
          "SESSION_PACK_REDACTION_SLOT_MISSING",
          `Redaction rule ${rule.ruleId} references missing slot ${rule.slotKey}`
        );
      }
      if (rule.strategy === "replace" && !rule.replacement) {
        throw new AppError(
          409,
          "SESSION_PACK_REDACTION_REPLACEMENT_REQUIRED",
          `Redaction rule ${rule.ruleId} requires a replacement value when strategy=replace`
        );
      }
    }

    const updatedAt = nowIso();
    const nextMapVersion =
      input.mapVersion?.trim() ||
      readManifestMetadataString(resolved.bundle.manifest, "redaction_map_version") ||
      "curated.v1";
    const nextRedactionMap = {
      version: nextMapVersion,
      secret_slot_keys: curatedSecretSlotKeys,
      rules: input.rules.map((rule) => ({
        rule_id: rule.ruleId,
        ...(rule.slotKey ? { slot_key: rule.slotKey } : {}),
        target: {
          kind: rule.targetKind,
          selector: rule.selector,
        },
        strategy: rule.strategy,
        ...(rule.replacement ? { replacement: rule.replacement } : {}),
        ...(rule.rationale ? { rationale: rule.rationale } : {}),
      })),
    };

    const { files: _manifestFiles, signature: _manifestSignature, ...manifestInput } =
      resolved.bundle.manifest;
    const {
      redaction_review_decision: _redactionReviewDecision,
      redaction_reviewed_at: _redactionReviewedAt,
      redaction_reviewed_by_user_id: _redactionReviewedByUserId,
      redaction_review_note: _redactionReviewNote,
      redaction_review_map_version: _redactionReviewMapVersion,
      redaction_review_total_rules: _redactionReviewTotalRules,
      redaction_review_preview_matched_rule_count: _redactionReviewPreviewMatchedRuleCount,
      redaction_review_secret_coverage_complete: _redactionReviewSecretCoverageComplete,
      redaction_curated_secret_slot_count: _redactionCuratedSecretSlotCount,
      redaction_curated_secret_slots_updated_at: _redactionCuratedSecretSlotsUpdatedAt,
      redaction_curated_secret_slots_updated_by_user_id: _redactionCuratedSecretSlotsUpdatedByUserId,
      ...nextManifestMetadata
    } = manifestInput.metadata ?? {};
    const nextFiles = {
      ...resolved.bundle.files,
      "redaction-map.json": new TextEncoder().encode(JSON.stringify(nextRedactionMap, null, 2)),
    };
    const nextBundle = maybeSignSessionPackBundle(
      packSessionVersion({
        manifest: {
          ...manifestInput,
          metadata: {
            ...nextManifestMetadata,
            redaction_map_curated: true,
            redaction_map_version: nextMapVersion,
            redaction_map_updated_at: updatedAt,
            redaction_curated_secret_slot_count: curatedSecretSlotKeys.length,
            redaction_curated_secret_slots_updated_at: updatedAt,
            ...(input.updatedByUserId
              ? {
                  redaction_map_updated_by_user_id: input.updatedByUserId,
                  redaction_curated_secret_slots_updated_by_user_id: input.updatedByUserId,
                }
              : {}),
          },
        },
        files: nextFiles,
      })
    );
    const archiveBytes = serializeSessionPackBundle(nextBundle);
    const mcpRequirements = parseMcpRequirements(nextBundle);
    const requiredBindings = buildBindingsFromManifest(nextBundle.manifest, mcpRequirements);
    const persistedRecord = sessionArchiveRepository.getImportedArchiveBySessionVersionId(
      detail.sessionVersionId
    );

    if (persistedRecord) {
      const updatedRecord = replacePersistedArchiveRecordArchive({
        record: persistedRecord,
        manifest: nextBundle.manifest,
        requiredBindings,
        archiveBytes,
        updatedAt,
      });
      await sessionArchiveRepository.saveImportedArchive(updatedRecord, archiveBytes);
    } else {
      const record = buildPersistedArchiveRecord({
        sessionVersionId: detail.sessionVersionId,
        workspaceContextKeys: detail.workspaceContextKeys,
        requiredBindings,
        archiveBytes,
        persistedAt: updatedAt,
        persistedByUserId: input.updatedByUserId ?? null,
        archiveSource: resolved.source === "runtime-derived" ? "runtime-derived" : "imported",
        runtimeSourceRunId: detail.runtimeSourceRunId,
        runtimeSourceTargetPath: detail.runtimeSourceTargetPath,
        runtimeSourceUpdatedAt: detail.runtimeSourceUpdatedAt,
        runtimeEvidenceEntries:
          parseSessionPackRuntimeEvidenceSummaryFromBundle(nextBundle)?.items ?? [],
        manifest: nextBundle.manifest,
      });
      await sessionArchiveRepository.saveImportedArchive(record, archiveBytes);
    }

    const sessionPack = await this.getSessionPack(detail.sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.updatedByUserId ?? null,
    });

    return {
      sessionPack,
      updatedAt,
      updatedByUserId: input.updatedByUserId ?? null,
      totalRules: input.rules.length,
      persistedArchive: true,
    };
  }

  async reviewSessionPackRedaction(
    sessionVersionId: string,
    input: ReviewSessionPackRedactionInput
  ): Promise<ReviewSessionPackRedactionResponse> {
    const detail = await this.getSessionPack(sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.reviewedByUserId ?? null,
    });
    const resolved = await resolveBundleForInformationCollection(detail);
    const redactionSummary = parseRedactionSummary(resolved.bundle);

    if (!redactionSummary || redactionSummary.totalRules === 0) {
      throw new AppError(
        409,
        "SESSION_PACK_REDACTION_REVIEW_REQUIRES_RULES",
        `Session pack ${detail.sessionVersionId} does not expose any redaction rules to review`
      );
    }

    const reviewedAt = nowIso();
    const { files: _manifestFiles, signature: _manifestSignature, ...manifestInput } =
      resolved.bundle.manifest;
    const {
      redaction_review_decision: _redactionReviewDecision,
      redaction_reviewed_at: _redactionReviewedAt,
      redaction_reviewed_by_user_id: _redactionReviewedByUserId,
      redaction_review_note: _redactionReviewNote,
      redaction_review_map_version: _redactionReviewMapVersion,
      redaction_review_total_rules: _redactionReviewTotalRules,
      redaction_review_preview_matched_rule_count: _redactionReviewPreviewMatchedRuleCount,
      redaction_review_secret_coverage_complete: _redactionReviewSecretCoverageComplete,
      ...nextManifestMetadata
    } = manifestInput.metadata ?? {};
    const nextBundle = maybeSignSessionPackBundle(
      packSessionVersion({
        manifest: {
          ...manifestInput,
          metadata: {
            ...nextManifestMetadata,
            redaction_review_decision: input.decision,
            redaction_reviewed_at: reviewedAt,
            ...(input.reviewedByUserId
              ? {
                  redaction_reviewed_by_user_id: input.reviewedByUserId,
                }
              : {}),
            ...(input.note?.trim()
              ? {
                  redaction_review_note: input.note.trim(),
                }
              : {}),
            ...(redactionSummary.mapVersion
              ? {
                  redaction_review_map_version: redactionSummary.mapVersion,
                }
              : {}),
            redaction_review_total_rules: redactionSummary.totalRules,
            redaction_review_preview_matched_rule_count:
              redactionSummary.previewMatchedRuleCount,
            redaction_review_secret_coverage_complete:
              redactionSummary.secretCoverageComplete,
          },
        },
        files: resolved.bundle.files,
      })
    );
    const archiveBytes = serializeSessionPackBundle(nextBundle);
    const mcpRequirements = parseMcpRequirements(nextBundle);
    const requiredBindings = buildBindingsFromManifest(nextBundle.manifest, mcpRequirements);
    const persistedRecord = sessionArchiveRepository.getImportedArchiveBySessionVersionId(
      detail.sessionVersionId
    );

    if (persistedRecord) {
      const updatedRecord = replacePersistedArchiveRecordArchive({
        record: persistedRecord,
        manifest: nextBundle.manifest,
        requiredBindings,
        archiveBytes,
        updatedAt: reviewedAt,
      });
      await sessionArchiveRepository.saveImportedArchive(updatedRecord, archiveBytes);
    } else {
      const record = buildPersistedArchiveRecord({
        sessionVersionId: detail.sessionVersionId,
        workspaceContextKeys: detail.workspaceContextKeys,
        requiredBindings,
        archiveBytes,
        persistedAt: reviewedAt,
        persistedByUserId: input.reviewedByUserId ?? null,
        archiveSource: resolved.source,
        runtimeSourceRunId: detail.runtimeSourceRunId,
        runtimeSourceTargetPath: detail.runtimeSourceTargetPath,
        runtimeSourceUpdatedAt: detail.runtimeSourceUpdatedAt,
        runtimeEvidenceEntries:
          parseSessionPackRuntimeEvidenceSummaryFromBundle(nextBundle)?.items ?? [],
        manifest: nextBundle.manifest,
      });
      await sessionArchiveRepository.saveImportedArchive(record, archiveBytes);
    }

    const sessionPack = await this.getSessionPack(detail.sessionVersionId, {
      workspaceContextKey: input.workspaceContextKey,
      userId: input.reviewedByUserId ?? null,
    });

    return reviewSessionPackRedactionResponseSchema.parse({
      sessionPack,
      reviewedAt,
      reviewedByUserId: input.reviewedByUserId ?? null,
      decision: input.decision,
      persistedArchive: true,
    });
  }

  #assertNoCreatorActivationConflict(
    serviceId: string,
    workspaceContextKey: string,
    targetSessionVersionId: string
  ) {
    const activeResolution = resolveActiveCreatorActivationSessionVersion(serviceId, workspaceContextKey);

    if (!activeResolution || activeResolution.sessionVersionId === targetSessionVersionId) {
      return;
    }

    throw new AppError(
      409,
      "SESSION_PACK_PUBLISH_CONFLICT_ACTIVE_CREATOR_ACTIVATION",
      `Active creator activation ${activeResolution.activationId} currently overrides service ${serviceId} in ${workspaceContextKey} with session ${activeResolution.sessionVersionId}`
    );
  }

  #assertNoCreatorActivationForUnpublish(serviceId: string, workspaceContextKey: string) {
    const activeResolution = resolveActiveCreatorActivationSessionVersion(serviceId, workspaceContextKey);

    if (!activeResolution) {
      return;
    }

    throw new AppError(
      409,
      "SESSION_PACK_UNPUBLISH_CONFLICT_ACTIVE_CREATOR_ACTIVATION",
      `Active creator activation ${activeResolution.activationId} currently overrides service ${serviceId} in ${workspaceContextKey} with session ${activeResolution.sessionVersionId}`
    );
  }

  #listDetails(actor?: SessionActor) {
    const bySessionVersionId = new Map<string, SessionPackDetail>();

    for (const pkg of creatorRepository.listPackages()) {
      const sessionVersionId = findVersionLineRef(pkg.versionLine, "session");
      if (!sessionVersionId) {
        continue;
      }

      const detail = buildCreatorDetail(pkg);
      bySessionVersionId.set(
        sessionVersionId,
        bySessionVersionId.has(sessionVersionId)
          ? mergeSessionPackDetails(bySessionVersionId.get(sessionVersionId)!, detail)
          : detail
      );
    }

    for (const record of sessionArchiveRepository.listImportedArchives()) {
      const detail = buildImportedDetail(record);
      const existing = bySessionVersionId.get(record.sessionVersionId);
      bySessionVersionId.set(
        record.sessionVersionId,
        existing ? mergeSessionPackDetails(existing, detail) : detail
      );
    }

    const publishedTargetsBySessionVersionId = new Map<string, LaunchTemplateRecord[]>();
    for (const template of workshopCatalogRepository.listLaunchTemplates()) {
      const list = publishedTargetsBySessionVersionId.get(template.sessionVersionId) ?? [];
      list.push(template);
      publishedTargetsBySessionVersionId.set(template.sessionVersionId, list);
    }

    const details = [...bySessionVersionId.values()]
      .map((detail) =>
        mergePublishedTargetsIntoDetail(
          detail,
          publishedTargetsBySessionVersionId.get(detail.sessionVersionId) ?? []
        )
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    if (!actor?.workspaceContextKey) {
      return details;
    }

    return details.filter((detail) => detail.workspaceContextKeys.includes(actor.workspaceContextKey!));
  }

  #getRequiredDetail(sessionVersionId: string) {
    const detail = this.#listDetails().find((item) => item.sessionVersionId === sessionVersionId);
    if (!detail) {
      throw new AppError(404, "SESSION_PACK_NOT_FOUND", `Session pack not found: ${sessionVersionId}`);
    }

    return detail;
  }
}

export async function initializeSessionInfrastructure() {
  await Promise.all([
    creatorRepository.init(),
    workshopCatalogRepository.init(),
    sessionArchiveRepository.init(),
  ]);
  sessionInfrastructureReady = true;
}

export const sessionCatalogService = new SessionCatalogService();
