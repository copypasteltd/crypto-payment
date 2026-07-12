import {
  activateCreatorReleaseInputSchema,
  createCreatorAuditExportInputSchema,
  createCreatorReleaseInputSchema,
  createCreatorReplayInputSchema,
  creatorAuditExportRecordSchema,
  creatorAuditExportResponseSchema,
  creatorGovernanceDynamicSectionSchema,
  creatorGovernanceSectionSummaryQuerySchema,
  creatorGovernanceSectionSummarySchema,
  creatorPackageDetailSchema,
  creatorPackageSummarySchema,
  creatorReleaseActivationSchema,
  creatorReleaseGateChecklistItemSchema,
  creatorReleaseGateSchema,
  creatorReleaseSummarySchema,
  creatorReplaySummarySchema,
  decideCreatorReleaseGateInputSchema,
  listCreatorAuditExportsQuerySchema,
  listCreatorPackagesQuerySchema,
  runSnapshotSchema,
  updateCreatorReleaseInputSchema,
  updateCreatorReplayInputSchema,
  type ActivateCreatorReleaseInput,
  type BillingMetricSummary,
  type CreateCreatorAuditExportInput,
  type CreateCreatorReleaseInput,
  type CreateCreatorReplayInput,
  type CreatorAuditExportResponse,
  type CredentialDetail,
  type CreatorGovernanceDynamicSection,
  type CreatorGovernanceRow,
  type CreatorGovernanceSectionSummary,
  type CreatorGovernanceSectionSummaryQuery,
  type CreatorPackageDetail,
  type CreatorReleaseActivation,
  type CreatorReleaseGate,
  type CreatorReleaseGateChecklistItem,
  type CreatorReleaseGateStatus,
  type CreatorReleaseGateType,
  type CreatorReleaseSummary,
  type CreatorReplaySummary,
  type DecideCreatorReleaseGateInput,
  type ListCreatorAuditExportsQuery,
  type ListCreatorPackagesQuery,
  type LocalizedText,
  type McpBindingRecord,
  type McpRegistryEntry,
  type RunSnapshot,
  type ServiceLaunchTemplateResolution,
  type UpdateCreatorReleaseInput,
  type UpdateCreatorReplayInput,
  type Workspace,
  type WorkspaceMembership,
  type WorkspaceRole,
} from "@lingban/contracts";
import { matchesSearchQuery, resolveRunListViewStatus } from "@lingban/domain-models";
import { AppError } from "../../app/errors.js";
import { authRepository } from "../auth/repository.js";
import { billingService } from "../billing/service.js";
import { credentialsService } from "../credentials/service.js";
import { mcpService } from "../mcp/service.js";
import { quotaService } from "../quotas/service.js";
import { runsRepository } from "../runs/repository.js";
import { findVersionLineRef, requireVersionLineRef } from "../sessions/version-line.js";
import { sessionCatalogService } from "../sessions/service.js";
import { objectStore } from "../uploads/object-store.js";
import { workshopCatalogRepository } from "../workshops/repository.js";
import { creatorRepository } from "./repository.js";

type CreatorScopeActor = {
  workspaceContextKey?: string | null;
};

type CreatorActor = CreatorScopeActor & {
  userId: string;
  role: WorkspaceRole;
};

type CreatorGovernanceActor = CreatorActor & {
  workspaceId: string;
  workspaceContextKey: string;
};

type GateBlueprint = {
  gateType: CreatorReleaseGateType;
  requiredRole: WorkspaceRole;
  status: CreatorReleaseGateStatus;
  resultSummary: LocalizedText;
};

type FormalGateBlueprint = GateBlueprint & {
  checklist: CreatorReleaseGateChecklistItem[];
  recommendedActions: LocalizedText[];
};

type ActiveCreatorLaunchTemplateResolution = ServiceLaunchTemplateResolution & {
  source: "creator-activation";
  taskVersionId: string;
  sessionVersionId: string;
};

type CreatorAuditExportPayload = {
  package: {
    packageId: string;
    title: LocalizedText;
    workspaceContextKey: string;
    generatedAt: string;
    versionLine: string[];
  };
  counts: {
    releases: number;
    replays: number;
    gates: number;
    activations: number;
    runs: number;
    total: number;
  };
  releases: CreatorReleaseSummary[];
  replays: CreatorReplaySummary[];
  gates: CreatorReleaseGate[];
  activations: CreatorReleaseActivation[];
  runs: Array<{
    runId: string;
    title: string;
    status: RunSnapshot["run"]["status"];
    viewStatus: ReturnType<typeof resolveRunListViewStatus>;
    serviceId: string | null;
    workspaceId: string;
    workspaceContextKey: string | null;
    createdAt: string;
    updatedAt: string;
    approvalCount: number;
    artifactCount: number;
  }>;
};

export class CreatorService {
  #releaseSequence = 0;
  #replaySequence = 0;
  #gateSequence = 0;
  #activationSequence = 0;
  #auditExportSequence = 0;

  listPackages(query: ListCreatorPackagesQuery, actor?: CreatorScopeActor) {
    const parsed = listCreatorPackagesQuerySchema.parse(query);
    const currentWorkspaceContextKey = actor?.workspaceContextKey?.trim() || null;

    if (currentWorkspaceContextKey && parsed.workspaceContextKey?.trim()) {
      this.assertActorWorkspaceContext(actor, parsed.workspaceContextKey.trim());
    }

    return creatorRepository
      .listPackages()
      .filter(
        (item) =>
          (!currentWorkspaceContextKey ||
            item.workspaceContextKeys.includes(currentWorkspaceContextKey)) &&
          (!parsed.workspaceContextKey || item.workspaceContextKeys.includes(parsed.workspaceContextKey)) &&
          (!parsed.state || item.state === parsed.state) &&
          matchesSearchQuery(parsed.q ?? "", [
            item.packageId,
            item.title.zh,
            item.title.en,
            item.source.zh,
            item.source.en,
            item.statusLabel.zh,
            item.statusLabel.en,
            item.ownerLabel.zh,
            item.ownerLabel.en,
            item.releaseChannel.zh,
            item.releaseChannel.en,
            ...item.versionLine,
          ])
      )
      .map((item) => creatorPackageSummarySchema.parse(item));
  }

  getPackage(packageId: string, actor?: CreatorScopeActor) {
    const pkg = creatorRepository.getPackageById(packageId);
    if (!pkg) {
      throw new AppError(404, "CREATOR_PACKAGE_NOT_FOUND", `Creator package not found: ${packageId}`);
    }

    const parsed = creatorPackageDetailSchema.parse(pkg);
    this.assertPackageVisibleToActor(parsed, actor);
    return parsed;
  }

  getGovernanceSectionSummary(
    packageId: string,
    section: CreatorGovernanceDynamicSection,
    actor: CreatorGovernanceActor,
    query: CreatorGovernanceSectionSummaryQuery = {}
  ) {
    const pkg = this.getPackage(packageId, actor);
    const parsedSection = creatorGovernanceDynamicSectionSchema.parse(section);
    const parsedQuery = creatorGovernanceSectionSummaryQuerySchema.parse(query);
    const workspaceContextKey =
      parsedQuery.workspaceContextKey?.trim() || actor.workspaceContextKey;

    this.assertActorWorkspaceContext(actor, workspaceContextKey);
    this.assertPackageContext(pkg, workspaceContextKey);
    this.assertCanManageGovernance(actor);

    if (parsedSection === "members") {
      return creatorGovernanceSectionSummarySchema.parse(
        buildCreatorMembersSectionSummary(pkg, actor, workspaceContextKey)
      );
    }

    if (parsedSection === "audit") {
      return creatorGovernanceSectionSummarySchema.parse(
        buildCreatorAuditSectionSummary(pkg, workspaceContextKey)
      );
    }

    return creatorGovernanceSectionSummarySchema.parse(
      buildCreatorCostSectionSummary(pkg, workspaceContextKey, actor)
    );
  }

  listPackageReleases(packageId: string, actor?: CreatorScopeActor) {
    this.getPackage(packageId, actor);
    return creatorRepository.listReleasesByPackage(packageId);
  }

  listPackageReplays(packageId: string, actor?: CreatorScopeActor) {
    this.getPackage(packageId, actor);
    return creatorRepository.listReplaysByPackage(packageId);
  }

  listPackageAuditExports(
    packageId: string,
    actor: CreatorGovernanceActor,
    query: ListCreatorAuditExportsQuery = {}
  ) {
    const pkg = this.getPackage(packageId, actor);
    const parsed = listCreatorAuditExportsQuerySchema.parse(query);
    const workspaceContextKey =
      parsed.workspaceContextKey?.trim() || actor.workspaceContextKey;

    this.assertActorWorkspaceContext(actor, workspaceContextKey);
    this.assertPackageContext(pkg, workspaceContextKey);
    this.assertCanManageGovernance(actor);

    return creatorRepository
      .listAuditExportsByPackage(packageId)
      .filter((item) => item.workspaceContextKey === workspaceContextKey)
      .map((item) => creatorAuditExportRecordSchema.parse(item));
  }

  async createAuditExport(
    packageId: string,
    actor: CreatorGovernanceActor,
    input: CreateCreatorAuditExportInput
  ): Promise<CreatorAuditExportResponse> {
    const pkg = this.getPackage(packageId, actor);
    const parsed = createCreatorAuditExportInputSchema.parse(input);

    this.assertActorWorkspaceContext(actor, parsed.workspaceContextKey);
    this.assertPackageContext(pkg, parsed.workspaceContextKey);
    this.assertCanManageGovernance(actor);

    const payload = buildCreatorAuditExportPayload(pkg, parsed.workspaceContextKey);
    const fileName = buildCreatorAuditExportFileName(
      packageId,
      parsed.workspaceContextKey,
      parsed.format
    );
    const exportId = this.nextAuditExportId(packageId);
    const serialized = serializeCreatorAuditExportPayload(payload, parsed.format);
    const objectKey = buildCreatorAuditExportObjectKey(packageId, exportId, parsed.format);
    const stored = await objectStore.putBuffer(objectKey, {
      content: Buffer.from(serialized, "utf8"),
      contentType: auditExportMimeType(parsed.format),
    });
    const createdAt = nowIso();

    const record = creatorAuditExportRecordSchema.parse({
      exportId,
      packageId,
      workspaceContextKey: parsed.workspaceContextKey,
      format: parsed.format,
      status: "ready",
      fileName,
      mimeType: auditExportMimeType(parsed.format),
      objectKey,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      recordCount: payload.counts.total,
      summary: buildCreatorAuditExportSummary(payload),
      createdByUserId: actor.userId,
      createdAt,
      updatedAt: createdAt,
    });

    await creatorRepository.saveAuditExport(record);
    await quotaService.recordUsage({
      workspaceId: actor.workspaceId,
      workspaceContextKey: parsed.workspaceContextKey,
      requestedByUserId: actor.userId,
      serviceId: pkg.linkedServiceIds[0] ?? null,
      taskVersionId: findVersionLineRef(payload.package.versionLine, "task"),
      sessionVersionId: findVersionLineRef(payload.package.versionLine, "session"),
      entrySurface: null,
      packageIds: [packageId],
      metric: "audit_exports",
      delta: 1,
      note: `Audit export created: ${exportId}`,
    });
    await billingService.recordUsage({
      workspaceId: actor.workspaceId,
      workspaceContextKey: parsed.workspaceContextKey,
      requestedByUserId: actor.userId,
      serviceId: pkg.linkedServiceIds[0] ?? null,
      taskVersionId: findVersionLineRef(payload.package.versionLine, "task"),
      sessionVersionId: findVersionLineRef(payload.package.versionLine, "session"),
      entrySurface: null,
      packageIds: [packageId],
      metric: "audit_exports",
      quantity: 1,
      source: "audit-export",
      sourceRef: exportId,
      costBasis: "estimated",
      note: `Audit export billing recorded: ${exportId}`,
    });

    return creatorAuditExportResponseSchema.parse({
      export: record,
      downloadPath: `/v1/packages/${encodeURIComponent(packageId)}/audit-exports/${encodeURIComponent(exportId)}/content`,
    });
  }

  async resolveAuditExportDownload(
    packageId: string,
    exportId: string,
    actor: CreatorGovernanceActor
  ) {
    const pkg = this.getPackage(packageId, actor);
    const record = creatorRepository.getAuditExportById(exportId);

    if (!record || record.packageId !== packageId) {
      throw new AppError(
        404,
        "CREATOR_AUDIT_EXPORT_NOT_FOUND",
        `Creator audit export not found: ${exportId}`
      );
    }

    this.assertPackageContext(pkg, record.workspaceContextKey);
    this.assertActorWorkspaceContext(actor, record.workspaceContextKey);
    this.assertCanManageGovernance(actor);

    const redirectUrl = await objectStore.createDownloadUrl?.({
      objectKey: record.objectKey,
      fileName: record.fileName,
      contentType: record.mimeType,
      expiresInSeconds: 300,
    });

    if (redirectUrl) {
      return {
        export: creatorAuditExportRecordSchema.parse(record),
        redirectUrl,
      };
    }

    return {
      export: creatorAuditExportRecordSchema.parse(record),
      stream: await objectStore.createReadStream(record.objectKey),
    };
  }

  async listReleaseGates(releaseId: string, actor?: CreatorScopeActor) {
    const release = this.getReleaseOrThrow(releaseId);
    this.getPackage(release.packageId, actor);
    return await this.ensureReleaseGates(release);
  }

  listReleaseActivations(releaseId: string, actor?: CreatorScopeActor) {
    const release = this.getReleaseOrThrow(releaseId);
    this.getPackage(release.packageId, actor);
    return creatorRepository.listReleaseActivationsByRelease(releaseId);
  }

  resolveActiveLaunchTemplateResolution(
    serviceId: string,
    workspaceContextKey: string
  ): ActiveCreatorLaunchTemplateResolution | null {
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

    const { taskVersionId, sessionVersionId } = extractLaunchTemplateVersionsFromPackage(pkg.packageId, pkg.versionLine);
    sessionCatalogService.requireSessionPack(sessionVersionId, {
      workspaceContextKey,
      serviceId,
    });

    return {
      source: "creator-activation",
      packageId: pkg.packageId,
      releaseId: release.releaseId,
      activationId: activation.activationId,
      taskVersionId,
      sessionVersionId,
    };
  }

  async createRelease(packageId: string, actor: CreatorActor, input: CreateCreatorReleaseInput) {
    this.assertCanManage(actor);
    const pkg = this.getPackage(packageId, actor);
    const parsed = createCreatorReleaseInputSchema.parse(input);

    if (!pkg.workspaceContextKeys.includes(parsed.targetWorkspaceContextKey)) {
      throw new AppError(
        400,
        "CREATOR_RELEASE_WORKSPACE_CONTEXT_INVALID",
        `Package ${packageId} cannot release into workspace context ${parsed.targetWorkspaceContextKey}`
      );
    }

    const release = creatorReleaseSummarySchema.parse({
      releaseId: this.nextReleaseId(packageId),
      packageId,
      targetWorkspaceContextKey: parsed.targetWorkspaceContextKey,
      state: parsed.state,
      channelLabel: parsed.channelLabel,
      gateSummary: parsed.gateSummary,
      updatedAt: nowIso(),
    });

    await creatorRepository.saveRelease(release);
    const gates = await this.ensureReleaseGates(release);
    await creatorRepository.savePackage(
      this.applyReleaseToPackage(pkg, release, gates, creatorRepository.listReleaseActivationsByRelease(release.releaseId))
    );

    return release;
  }

  async updateRelease(
    packageId: string,
    releaseId: string,
    actor: CreatorActor,
    input: UpdateCreatorReleaseInput
  ) {
    this.assertCanManage(actor);
    const pkg = this.getPackage(packageId, actor);
    const current = this.listPackageReleases(packageId, actor).find((item) => item.releaseId === releaseId);
    if (!current) {
      throw new AppError(404, "CREATOR_RELEASE_NOT_FOUND", `Creator release not found: ${releaseId}`);
    }

    const parsed = updateCreatorReleaseInputSchema.parse(input);
    const nextTargetWorkspaceContextKey =
      parsed.targetWorkspaceContextKey ?? current.targetWorkspaceContextKey;

    if (!pkg.workspaceContextKeys.includes(nextTargetWorkspaceContextKey)) {
      throw new AppError(
        400,
        "CREATOR_RELEASE_WORKSPACE_CONTEXT_INVALID",
        `Package ${packageId} cannot release into workspace context ${nextTargetWorkspaceContextKey}`
      );
    }

    const release = creatorReleaseSummarySchema.parse({
      ...current,
      ...parsed,
      targetWorkspaceContextKey: nextTargetWorkspaceContextKey,
      updatedAt: nowIso(),
    });

    await creatorRepository.saveRelease(release);
    const gates = await this.ensureReleaseGates(release);
    await creatorRepository.savePackage(
      this.applyReleaseToPackage(pkg, release, gates, creatorRepository.listReleaseActivationsByRelease(release.releaseId))
    );

    return release;
  }

  async decideReleaseGate(
    releaseId: string,
    gateId: string,
    actor: CreatorActor,
    input: DecideCreatorReleaseGateInput
  ) {
    const release = this.getReleaseOrThrow(releaseId);
    const pkg = this.getPackage(release.packageId, actor);
    const gates = await this.ensureReleaseGates(release);
    const current = gates.find((item) => item.gateId === gateId);
    if (!current) {
      throw new AppError(404, "CREATOR_RELEASE_GATE_NOT_FOUND", `Creator release gate not found: ${gateId}`);
    }

    this.assertCanDecideGate(actor, current.requiredRole);
    const parsed = decideCreatorReleaseGateInputSchema.parse(input);
    const decidedAt = nowIso();
    const nextChecklist = resolveFormalNextGateChecklist(current, parsed.checklist, parsed.status);
    const nextRecommendedActions = parsed.recommendedActions ?? current.recommendedActions;
    const nextEvidenceRef =
      parsed.evidenceRef === undefined ? current.evidenceRef : parsed.evidenceRef;
    const nextResultSummary =
      parsed.note === undefined
        ? current.resultSummary
        : parsed.note ?? defaultGateDecisionSummary(current.gateType, parsed.status);

    assertFormalGateDecisionPayload(current, parsed.status, {
      checklist: nextChecklist,
      evidenceRef: nextEvidenceRef,
      resultSummary: nextResultSummary,
    });

    const nextGate = creatorReleaseGateSchema.parse({
      ...current,
      status: parsed.status,
      resultSummary: nextResultSummary,
      evidenceRef: nextEvidenceRef,
      checklist: nextChecklist,
      recommendedActions: nextRecommendedActions,
      decidedByUserId: actor.userId,
      decidedAt,
      updatedAt: decidedAt,
    });

    await creatorRepository.saveReleaseGate(nextGate);
    const nextGates = gates.map((item) => (item.gateId === gateId ? nextGate : item));
    await creatorRepository.savePackage(
      this.applyReleaseToPackage(
        pkg,
        release,
        nextGates,
        creatorRepository.listReleaseActivationsByRelease(release.releaseId)
      )
    );

    return nextGate;
  }

  async activateRelease(releaseId: string, actor: CreatorActor, input: ActivateCreatorReleaseInput) {
    this.assertCanActivate(actor);
    const release = this.getReleaseOrThrow(releaseId);
    const pkg = this.getPackage(release.packageId, actor);
    const gates = await this.ensureReleaseGates(release);
    const parsed = activateCreatorReleaseInputSchema.parse(input);

    if (gates.length === 0) {
      throw new AppError(409, "CREATOR_RELEASE_GATE_EMPTY", `Release ${releaseId} has no formal gates`);
    }

    const blockingGate = gates.find(
      (item) => item.status === "pending" || item.status === "running" || item.status === "failed"
    );
    if (blockingGate) {
      throw new AppError(
        409,
        "CREATOR_RELEASE_GATE_BLOCKED",
        `Release ${releaseId} is blocked by gate ${blockingGate.gateId}`
      );
    }

    const existingActivations = creatorRepository.listReleaseActivations();
    const existingActive = existingActivations.find(
      (item) =>
        item.releaseId === release.releaseId &&
        item.targetWorkspaceContextKey === release.targetWorkspaceContextKey &&
        item.state === "active"
    );
    if (existingActive) {
      return existingActive;
    }

    const updatedAt = nowIso();
    const rolledBack = existingActivations
      .filter(
        (item) =>
          item.packageId === release.packageId &&
          item.targetWorkspaceContextKey === release.targetWorkspaceContextKey &&
          item.state === "active"
      )
      .map((item) =>
        creatorReleaseActivationSchema.parse({
          ...item,
          state: "rolled_back",
          note:
            parsed.note ??
            l(
              `已被新的激活记录替换：${release.releaseId}`,
              `Superseded by activation for release ${release.releaseId}`
            ),
          updatedAt,
        })
      );

    for (const activation of rolledBack) {
      await creatorRepository.saveReleaseActivation(activation);
    }

    const activation = creatorReleaseActivationSchema.parse({
      activationId: this.nextActivationId(release.packageId),
      releaseId: release.releaseId,
      packageId: release.packageId,
      targetWorkspaceContextKey: release.targetWorkspaceContextKey,
      state: "active",
      rolloutMode: release.state,
      effectiveAt: updatedAt,
      note: parsed.note ?? activationSummaryNote(release),
      activatedByUserId: actor.userId,
      updatedAt,
    });

    const touchedRelease = creatorReleaseSummarySchema.parse({
      ...release,
      updatedAt,
    });

    await creatorRepository.saveRelease(touchedRelease);
    await creatorRepository.saveReleaseActivation(activation);
    await creatorRepository.savePackage(
      this.applyReleaseToPackage(pkg, touchedRelease, gates, [
        ...existingActivations
          .filter((item) => item.releaseId === release.releaseId && item.state !== "active"),
        ...rolledBack,
        activation,
      ])
    );

    return activation;
  }

  async createReplay(packageId: string, actor: CreatorActor, input: CreateCreatorReplayInput) {
    this.assertCanManage(actor);
    const pkg = this.getPackage(packageId, actor);
    const parsed = createCreatorReplayInputSchema.parse(input);

    const replay = creatorReplaySummarySchema.parse({
      replayId: this.nextReplayId(packageId),
      packageId,
      sourceRunId: parsed.sourceRunId,
      state: parsed.state,
      summary: parsed.summary,
      updatedAt: nowIso(),
    });

    await creatorRepository.saveReplay(replay);
    await creatorRepository.savePackage({
      ...pkg,
      updatedAt: replay.updatedAt,
    });

    return replay;
  }

  async updateReplay(
    packageId: string,
    replayId: string,
    actor: CreatorActor,
    input: UpdateCreatorReplayInput
  ) {
    this.assertCanManage(actor);
    const pkg = this.getPackage(packageId, actor);
    const current = this.listPackageReplays(packageId, actor).find((item) => item.replayId === replayId);
    if (!current) {
      throw new AppError(404, "CREATOR_REPLAY_NOT_FOUND", `Creator replay not found: ${replayId}`);
    }

    const parsed = updateCreatorReplayInputSchema.parse(input);
    const replay = creatorReplaySummarySchema.parse({
      ...current,
      ...parsed,
      updatedAt: nowIso(),
    });

    await creatorRepository.saveReplay(replay);
    await creatorRepository.savePackage({
      ...pkg,
      updatedAt: replay.updatedAt,
    });

    return replay;
  }

  private getReleaseOrThrow(releaseId: string) {
    const release = creatorRepository.getReleaseById(releaseId);
    if (!release) {
      throw new AppError(404, "CREATOR_RELEASE_NOT_FOUND", `Creator release not found: ${releaseId}`);
    }

    return release;
  }

  private assertCanManage(actor: CreatorActor) {
    if (actor.role === "owner" || actor.role === "admin" || actor.role === "creator") {
      return;
    }

    throw new AppError(403, "CREATOR_MUTATION_FORBIDDEN", "Current actor cannot mutate creator assets");
  }

  private assertCanActivate(actor: CreatorActor) {
    if (actor.role === "owner" || actor.role === "admin") {
      return;
    }

    throw new AppError(403, "CREATOR_ACTIVATION_FORBIDDEN", "Current actor cannot activate creator releases");
  }

  private assertCanDecideGate(actor: CreatorActor, requiredRole: WorkspaceRole) {
    this.assertCanManage(actor);
    if (workspaceRoleRank(actor.role) >= workspaceRoleRank(requiredRole)) {
      return;
    }

    throw new AppError(
      403,
      "CREATOR_RELEASE_GATE_FORBIDDEN",
      `Role ${actor.role} cannot decide gate requiring ${requiredRole}`
    );
  }

  private assertCanManageGovernance(actor: CreatorGovernanceActor) {
    if (workspaceRoleRank(actor.role) >= workspaceRoleRank("admin")) {
      return;
    }

    throw new AppError(
      403,
      "CREATOR_GOVERNANCE_FORBIDDEN",
      "Current actor cannot inspect creator governance or export creator audit records"
    );
  }

  private assertPackageContext(pkg: CreatorPackageDetail, workspaceContextKey: string) {
    if (pkg.workspaceContextKeys.includes(workspaceContextKey)) {
      return;
    }

    throw new AppError(
      400,
      "CREATOR_GOVERNANCE_CONTEXT_INVALID",
      `Package ${pkg.packageId} is not linked to workspace context ${workspaceContextKey}`
    );
  }

  private assertPackageVisibleToActor(pkg: CreatorPackageDetail, actor?: CreatorScopeActor) {
    const workspaceContextKey = actor?.workspaceContextKey?.trim();
    if (!workspaceContextKey) {
      return;
    }

    if (pkg.workspaceContextKeys.includes(workspaceContextKey)) {
      return;
    }

    throw new AppError(
      404,
      "CREATOR_PACKAGE_NOT_FOUND",
      `Creator package not found: ${pkg.packageId}`
    );
  }

  private assertActorWorkspaceContext(actor: CreatorScopeActor | undefined, workspaceContextKey: string) {
    const currentWorkspaceContextKey = actor?.workspaceContextKey?.trim();
    if (!currentWorkspaceContextKey || currentWorkspaceContextKey === workspaceContextKey) {
      return;
    }

    throw new AppError(
      403,
      "CREATOR_CONTEXT_FORBIDDEN",
      `Current workspace context ${currentWorkspaceContextKey} cannot access creator context ${workspaceContextKey}`
    );
  }

  private nextReleaseId(packageId: string) {
    if (this.#releaseSequence === 0) {
      this.#releaseSequence =
        creatorRepository
          .listReleases()
          .map((item) => parseNumericSuffix(item.releaseId))
          .reduce((max, current) => Math.max(max, current), 0) + 1;
    }

    return `rel_${slugifyCreatorKey(packageId)}_${String(this.#releaseSequence++).padStart(4, "0")}`;
  }

  private nextReplayId(packageId: string) {
    if (this.#replaySequence === 0) {
      this.#replaySequence =
        creatorRepository
          .listReplays()
          .map((item) => parseNumericSuffix(item.replayId))
          .reduce((max, current) => Math.max(max, current), 0) + 1;
    }

    return `rpl_${slugifyCreatorKey(packageId)}_${String(this.#replaySequence++).padStart(4, "0")}`;
  }

  private nextGateId(packageId: string) {
    if (this.#gateSequence === 0) {
      this.#gateSequence =
        creatorRepository
          .listReleaseGates()
          .map((item) => parseNumericSuffix(item.gateId))
          .reduce((max, current) => Math.max(max, current), 0) + 1;
    }

    return `rgt_${slugifyCreatorKey(packageId)}_${String(this.#gateSequence++).padStart(4, "0")}`;
  }

  private nextActivationId(packageId: string) {
    if (this.#activationSequence === 0) {
      this.#activationSequence =
        creatorRepository
          .listReleaseActivations()
          .map((item) => parseNumericSuffix(item.activationId))
          .reduce((max, current) => Math.max(max, current), 0) + 1;
    }

    return `rac_${slugifyCreatorKey(packageId)}_${String(this.#activationSequence++).padStart(4, "0")}`;
  }

  private nextAuditExportId(packageId: string) {
    if (this.#auditExportSequence === 0) {
      this.#auditExportSequence =
        creatorRepository
          .listAuditExports()
          .map((item) => parseNumericSuffix(item.exportId))
          .reduce((max, current) => Math.max(max, current), 0) + 1;
    }

    return `aex_${slugifyCreatorKey(packageId)}_${String(this.#auditExportSequence++).padStart(4, "0")}`;
  }

  private async ensureReleaseGates(release: CreatorReleaseSummary) {
    const current = creatorRepository.listReleaseGatesByRelease(release.releaseId);
    const nextByType = new Map<CreatorReleaseGateType, CreatorReleaseGate>();

    for (const gate of current) {
      nextByType.set(gate.gateType, gate);
    }

    const updates: CreatorReleaseGate[] = [];
    for (const blueprint of buildFormalGateBlueprints(release.state)) {
      const existing = nextByType.get(blueprint.gateType);
      if (!existing) {
        const created = creatorReleaseGateSchema.parse({
          gateId: this.nextGateId(release.packageId),
          releaseId: release.releaseId,
          packageId: release.packageId,
          gateType: blueprint.gateType,
          status: blueprint.status,
          requiredRole: blueprint.requiredRole,
          resultSummary: blueprint.resultSummary,
          evidenceRef: null,
          checklist: blueprint.checklist,
          recommendedActions: blueprint.recommendedActions,
          decidedByUserId: null,
          decidedAt: null,
          updatedAt: release.updatedAt,
        });
        nextByType.set(created.gateType, created);
        updates.push(created);
        continue;
      }

      const synced = syncFormalGateForReleaseState(existing, release.state);
      if (JSON.stringify(synced) !== JSON.stringify(existing)) {
        nextByType.set(synced.gateType, synced);
        updates.push(synced);
      }
    }

    for (const gate of updates) {
      await creatorRepository.saveReleaseGate(gate);
    }

    return gateOrder()
      .map((gateType) => nextByType.get(gateType))
      .filter((item): item is CreatorReleaseGate => Boolean(item));
  }

  private applyReleaseToPackage(
    pkg: CreatorPackageDetail,
    release: CreatorReleaseSummary,
    gates: CreatorReleaseGate[],
    activations: CreatorReleaseActivation[]
  ): CreatorPackageDetail {
    const latestActiveActivation = [...activations]
      .filter((item) => item.state === "active")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    const mappedState = mapPackageStateFromRelease(release.state, gates, latestActiveActivation);

    return creatorPackageDetailSchema.parse({
      ...pkg,
      state: mappedState.state,
      statusLabel: mappedState.statusLabel,
      tone: mappedState.tone,
      updatedAt: latestIso([
        pkg.updatedAt,
        release.updatedAt,
        ...gates.map((item) => item.updatedAt),
        ...activations.map((item) => item.updatedAt),
      ]),
      releaseChannel: release.channelLabel,
      release: {
        summary: summarizeReleaseChannel(release.channelLabel, latestActiveActivation),
        items: summarizeReleaseItems(release, gates, latestActiveActivation, pkg.release.items),
      },
    });
  }
}

function buildCreatorMembersSectionSummary(
  pkg: CreatorPackageDetail,
  actor: CreatorGovernanceActor,
  workspaceContextKey: string
): CreatorGovernanceSectionSummary {
  const contextLabel = resolveWorkspaceContextLabel(workspaceContextKey);
  const packageContextSet = new Set(pkg.workspaceContextKeys);
  const visibleMembers = authRepository
    .listUsers()
    .flatMap((user) => {
      const activeMemberships = authRepository
        .listMembershipsByUser(user.userId)
        .filter(({ membership }) => membership.status === "active");
      const currentContextMemberships = activeMemberships.filter(({ workspace }) => {
        return resolveWorkspaceContextKeyFromAuthWorkspace(workspace) === workspaceContextKey;
      });
      if (currentContextMemberships.length === 0) {
        return [];
      }

      const linkedMemberships = activeMemberships.filter(({ workspace }) => {
        return packageContextSet.has(resolveWorkspaceContextKeyFromAuthWorkspace(workspace));
      });

      return linkedMemberships.length > 0
        ? [
            {
              user,
              currentMembership: currentContextMemberships.sort(
                (left, right) =>
                  workspaceRoleRank(right.membership.role) -
                  workspaceRoleRank(left.membership.role)
              )[0].membership,
              linkedMemberships,
            },
          ]
        : [];
    })
    .sort((left, right) => {
      const leftRank = highestMembershipRoleRank(left.linkedMemberships);
      const rightRank = highestMembershipRoleRank(right.linkedMemberships);
      if (leftRank !== rightRank) {
        return rightRank - leftRank;
      }

      return left.user.displayName.localeCompare(right.user.displayName);
    });
  const multiContextMembers = visibleMembers.filter((item) => item.linkedMemberships.length > 1).length;
  const releaseCapableMembers = visibleMembers.filter(
    (item) => highestMembershipRoleRank(item.linkedMemberships) >= workspaceRoleRank("creator")
  ).length;
  const governanceCapableMembers = visibleMembers.filter(
    (item) => highestMembershipRoleRank(item.linkedMemberships) >= workspaceRoleRank("admin")
  ).length;
  const currentWorkspaceMembers = visibleMembers.length;

  return {
    packageId: pkg.packageId,
    section: "members",
    workspaceContextKey,
    summary:
      currentWorkspaceMembers > 0
        ? l(
            `${contextLabel.zh} 当前共有 ${currentWorkspaceMembers} 名可见成员参与该 package 的空间边界，其中 ${multiContextMembers} 人横跨多个关联空间，${releaseCapableMembers} 人具备发布能力。`,
            `${contextLabel.en} currently has ${currentWorkspaceMembers} visible members participating in this package boundary, with ${multiContextMembers} spanning multiple linked workspaces and ${releaseCapableMembers} carrying release capability.`
          )
        : l(
            `${contextLabel.zh} 当前还没有检测到可见成员记录。`,
            `${contextLabel.en} does not currently expose any visible member record.`
          ),
    metrics: [
      {
        label: l("关联空间", "Linked workspaces"),
        value: String(pkg.workspaceContextKeys.length).padStart(2, "0"),
        note: l(
          "当前 package 可发布或激活到的全部工作区上下文。",
          "All workspace contexts where the current package can be released or activated."
        ),
      },
      {
        label: l("可见成员", "Visible members"),
        value: String(currentWorkspaceMembers).padStart(2, "0"),
        note: l(
          "以当前工作区为观察面，统计所有 active 成员。",
          "Counts all active members visible from the current workspace scope."
        ),
      },
      {
        label: l("发布 / 治理能力", "Release / governance"),
        value: `${releaseCapableMembers}/${governanceCapableMembers}`,
        note: l(
          "前者表示 Creator 级及以上，后者表示 Admin / Owner 级治理能力。",
          "The first number is Creator-or-higher release capability; the second is Admin/Owner governance capability."
        ),
      },
    ],
    headers: [
      l("成员 / 角色", "Member / role"),
      l("可见范围", "Visible scope"),
      l("实例权限", "Run access"),
      l("包权限", "Package access"),
    ],
    rows: visibleMembers.map((item) => buildCreatorMemberRow(item, pkg)),
    updatedAt: latestIso([
      pkg.updatedAt,
      ...visibleMembers.map((item) => item.user.updatedAt),
      ...visibleMembers.flatMap((item) => item.linkedMemberships.map(({ workspace }) => workspace.updatedAt)),
      ...visibleMembers.flatMap((item) => item.linkedMemberships.map(({ membership }) => membership.updatedAt)),
    ]),
  };
}

function buildCreatorAuditSectionSummary(
  pkg: CreatorPackageDetail,
  workspaceContextKey: string
): CreatorGovernanceSectionSummary {
  const contextLabel = resolveWorkspaceContextLabel(workspaceContextKey);
  const releases = creatorRepository
    .listReleasesByPackage(pkg.packageId)
    .filter((item) => item.targetWorkspaceContextKey === workspaceContextKey)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const replays = creatorRepository
    .listReplaysByPackage(pkg.packageId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const activations = creatorRepository
    .listReleaseActivations()
    .filter(
      (item) => item.packageId === pkg.packageId && item.targetWorkspaceContextKey === workspaceContextKey
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const gates = releases.flatMap((release) =>
    creatorRepository.listReleaseGatesByRelease(release.releaseId)
  );
  const packageRuns = listPackageRuns(pkg, workspaceContextKey);
  const pendingGateCount = gates.filter(
    (item) => item.status === "pending" || item.status === "running" || item.status === "failed"
  ).length;
  const passedGateCount = gates.filter(
    (item) => item.status === "passed" || item.status === "waived"
  ).length;
  const activeActivationCount = activations.filter((item) => item.state === "active").length;
  const latestRelease = releases[0] ?? null;
  const latestReplay = replays[0] ?? null;
  const latestRun = packageRuns[0] ?? null;
  const runningReplayCount = replays.filter((item) => item.state === "running").length;
  const readyReplayCount = replays.filter((item) => item.state === "ready").length;
  const failedReplayCount = replays.filter((item) => item.state === "failed").length;
  const pendingApprovals = packageRuns.reduce(
    (sum, snapshot) => sum + snapshot.approvals.filter((item) => item.state === "pending").length,
    0
  );
  const exportedOutputs = packageRuns.reduce(
    (sum, snapshot) =>
      sum +
      snapshot.files.filter(
        (file) =>
          file.kind === "output" || file.kind === "archive" || file.kind === "receipt"
      ).length,
    0
  );
  const artifactCount = packageRuns.reduce((sum, snapshot) => sum + snapshot.artifacts.length, 0);
  const runStatusCounts = summarizePackageRunStates(packageRuns);

  return {
    packageId: pkg.packageId,
    section: "audit",
    workspaceContextKey,
    summary:
      releases.length > 0 || replays.length > 0 || packageRuns.length > 0
        ? l(
            `${contextLabel.zh} 当前已有 ${releases.length} 条发布记录、${replays.length} 条回放记录和 ${packageRuns.length} 个关联实例，可直接用于核对 Gate、回放证据与结果留痕。`,
            `${contextLabel.en} currently has ${releases.length} release records, ${replays.length} replay records, and ${packageRuns.length} related runs for gate review, replay evidence, and result traceability.`
          )
        : l(
            `${contextLabel.zh} 当前还没有形成可用的发布、回放或实例审计样本。`,
            `${contextLabel.en} does not yet have any usable release, replay, or run-audit evidence.`
          ),
    metrics: [
      {
        label: l("待处理 Gate", "Open gates"),
        value: `${pendingGateCount}/${gates.length || 0}`,
        note: l(
          "包含待处理、执行中和失败状态，用于判断当前发布能否进入激活。",
          "Includes pending, running, and failed gates to show whether the current release can move into activation."
        ),
      },
      {
        label: l("回放 / 激活", "Replays / activations"),
        value: `${replays.length}/${activeActivationCount}`,
        note: l(
          "前者表示已登记的回放证据，后者表示当前工作区内仍处于 active 的正式激活记录。",
          "The first number is recorded replay evidence; the second is the number of active formal activations in this workspace context."
        ),
      },
      {
        label: l("实例样本 / 结果", "Run samples / outputs"),
        value: `${packageRuns.length}/${exportedOutputs}`,
        note: l(
          "按 package 关联服务和版本线统计实例样本，并汇总输出、归档和回执文件数。",
          "Counts run samples by linked services and version refs, then sums output, archive, and receipt files."
        ),
      },
    ],
    headers: [
      l("留痕对象", "Ledger object"),
      l("来源", "Source"),
      l("状态", "State"),
      l("当前摘要", "Current summary"),
    ],
    rows: [
      {
        id: "audit-release-ledger",
        tone:
          activeActivationCount > 0
            ? "success"
            : pendingGateCount > 0
              ? "warn"
              : releases.length > 0
                ? "active"
                : "",
        cells: [
          l("发布门与激活台账", "Release gates and activation"),
          joinTexts([
            contextLabel,
            latestRelease?.channelLabel ?? null,
          ]),
          activeActivationCount > 0
            ? l("已激活", "Active")
            : pendingGateCount > 0
              ? l("待推进", "Needs action")
              : passesOrNoneLabel(passedGateCount, gates.length),
          latestRelease
            ? l(
                `最近发布于 ${latestRelease.updatedAt} 更新；共 ${gates.length} 条 Gate，${passedGateCount} 条已通过或豁免，${activeActivationCount} 条激活记录仍有效。`,
                `Latest release updated at ${latestRelease.updatedAt}; ${gates.length} gates exist, ${passedGateCount} are passed or waived, and ${activeActivationCount} activation records remain active.`
              )
            : l("当前工作区还没有正式发布台账。", "No formal release ledger exists for this workspace context yet."),
        ],
      },
      {
        id: "audit-replay-ledger",
        tone:
          failedReplayCount > 0
            ? "warn"
            : runningReplayCount > 0
              ? "active"
              : readyReplayCount > 0
                ? "success"
                : "",
        cells: [
          l("回放证据", "Replay evidence"),
          latestReplay
            ? joinTexts([sameText(latestReplay.sourceRunId), contextLabel])
            : contextLabel,
          failedReplayCount > 0
            ? l("存在失败回放", "Failed replay exists")
            : runningReplayCount > 0
              ? l("回放执行中", "Replay running")
              : readyReplayCount > 0
                ? l("已登记", "Recorded")
                : l("暂无回放", "No replay"),
          latestReplay
            ? joinTexts([
                latestReplay.summary,
                l(
                  `最近更新时间 ${latestReplay.updatedAt}；ready ${readyReplayCount} / running ${runningReplayCount} / failed ${failedReplayCount}。`,
                  `Latest update ${latestReplay.updatedAt}; ready ${readyReplayCount} / running ${runningReplayCount} / failed ${failedReplayCount}.`
                ),
              ], " ")
            : l("当前 package 还没有登记任何回放记录。", "No replay record has been created for this package yet."),
        ],
      },
      {
        id: "audit-run-ledger",
        tone:
          runStatusCounts.approval > 0
            ? "warn"
            : runStatusCounts.running > 0
              ? "active"
              : packageRuns.length > 0
                ? "success"
                : "",
        cells: [
          l("实例审计样本", "Run audit samples"),
          latestRun
            ? joinTexts([sameText(latestRun.run.title), sameText(latestRun.run.runId)])
            : contextLabel,
          l(
            `运行 ${runStatusCounts.running} / 审批 ${runStatusCounts.approval} / 完成 ${runStatusCounts.done}`,
            `Running ${runStatusCounts.running} / Approval ${runStatusCounts.approval} / Done ${runStatusCounts.done}`
          ),
          latestRun
            ? l(
                `共 ${artifactCount} 个产物、${pendingApprovals} 个待确认动作、${exportedOutputs} 个结果文件；最近实例更新时间 ${latestRun.run.updatedAt}。`,
                `${artifactCount} artifacts, ${pendingApprovals} pending approval actions, and ${exportedOutputs} result files are present; latest run updated at ${latestRun.run.updatedAt}.`
              )
            : l("当前工作区还没有形成实例级审计样本。", "No run-level audit sample exists in this workspace context yet."),
        ],
      },
    ],
    updatedAt: latestIso([
      pkg.updatedAt,
      ...releases.map((item) => item.updatedAt),
      ...replays.map((item) => item.updatedAt),
      ...activations.map((item) => item.updatedAt),
      ...packageRuns.map((item) => item.run.updatedAt),
    ]),
  };
}

function buildCreatorCostSectionSummary(
  pkg: CreatorPackageDetail,
  workspaceContextKey: string,
  actor: CreatorGovernanceActor
): CreatorGovernanceSectionSummary {
  const contextLabel = resolveWorkspaceContextLabel(workspaceContextKey);
  const services = resolveLinkedServiceRecords(pkg);
  const packageRuns = listPackageRuns(pkg, workspaceContextKey);
  const { sessionVersionId } = extractLaunchTemplateVersionsFromPackage(pkg.packageId, pkg.versionLine);
  const visibleCredentials = credentialsService.listVisibleCredentials(actor, {});
  const visibleMcps = mcpService.listMcps({ workspaceId: actor.workspaceId }, {});
  const visibleBindings = mcpService.listBindings(actor, {});
  const runIds = new Set(packageRuns.map((item) => item.run.runId));
  const relevantMcpIds = new Set(
    services.flatMap((service) => service.requiredBindings.firstPartyMcpIds)
  );
  const relevantRegistryEntries = visibleMcps.filter((entry) => relevantMcpIds.has(entry.mcpId));
  const relevantBindings = visibleBindings.filter((binding) =>
    relevantMcpIds.has(binding.mcpId) &&
    isBindingRelevantToPackage(binding, {
      sessionVersionId,
      runIds,
      workspaceId: actor.workspaceId,
      userId: actor.userId,
    })
  );
  const relevantCredentialIds = new Set<string>();
  for (const service of services) {
    for (const credentialId of service.requiredBindings.credentialIds) {
      relevantCredentialIds.add(credentialId);
    }
  }
  for (const binding of relevantBindings) {
    if (binding.credentialId) {
      relevantCredentialIds.add(binding.credentialId);
    }
  }
  const relevantCredentials = visibleCredentials.filter((item) =>
    relevantCredentialIds.has(item.credentialId)
  );
  const quotaSnapshot = quotaService.getScopedSnapshot({
    workspaceId: actor.workspaceId,
    workspaceContextKey,
    packageId: pkg.packageId,
  });
  const billingSnapshot = billingService.getScopedSnapshot({
    workspaceId: actor.workspaceId,
    workspaceContextKey,
    packageId: pkg.packageId,
  });
  const totalRuntimeMinutes = packageRuns.reduce(
    (sum, snapshot) => sum + estimateRunMinutes(snapshot),
    0
  );
  const completedRuns = packageRuns.filter((item) => item.run.status === "SUCCEEDED").length;
  const approvalRequiredBindings = relevantBindings.filter((item) => item.approvalRequired).length;
  const autoAttachedBindings = relevantBindings.filter((item) => item.autoAttach).length;
  const rotationDueCredentials = relevantCredentials.filter(
    (item) => item.status === "needs-rotation"
  ).length;
  const pendingQuotaOverrides = quotaSnapshot.overrides.filter((item) => item.status === "pending").length;
  const quotaWarningEvents = quotaSnapshot.events.filter(
    (item) => item.decision === "warned" || item.decision === "approval_pending"
  ).length;
  const quotaRows = quotaSnapshot.policies
    .slice(0, 6)
    .map((policy) =>
      buildCreatorQuotaCostRow({
        policy,
        counter:
          quotaSnapshot.counters.find((counter) => counter.policyId === policy.policyId) ?? null,
        latestEvent:
          quotaSnapshot.events.find((event) => event.policyId === policy.policyId) ?? null,
      })
    );
  const billingRows = billingSnapshot.summary.metrics
    .slice(0, 6)
    .map((item) =>
      buildCreatorBillingCostRow({
        metric: item,
        workspaceContextKey,
      })
    );
  const rowSeed: CreatorGovernanceRow[] =
    services.length > 0
      ? services.map((service) =>
          buildCreatorServiceCostRow({
            service,
            workspaceContextKey,
            packageRuns,
            relevantBindings,
            relevantCredentials,
          })
        )
      : [
          {
            id: "cost-no-linked-service",
            tone: packageRuns.length > 0 ? "active" : "",
            cells: [
              l("当前 package 尚未挂接目录服务", "No linked catalog service"),
              contextLabel,
              sameText(`${packageRuns.length} runs / ${totalRuntimeMinutes} min`),
              l(
                "运行样本已经存在，但 Creator 目录还没有登记可计量的服务绑定。",
                "Run samples exist, but the Creator catalog has not yet registered a metered service binding."
              ),
            ] satisfies CreatorGovernanceRow["cells"],
          },
        ];
  const rows =
    billingRows.length > 0 || quotaRows.length > 0
      ? [...rowSeed, ...billingRows, ...quotaRows]
      : rowSeed;

  return {
    packageId: pkg.packageId,
    section: "cost",
    workspaceContextKey,
    summary:
      services.length > 0 || packageRuns.length > 0
        ? l(
            `${contextLabel.zh} 当前已可按关联服务读取运行分钟、实例样本、绑定策略和凭证覆盖范围，用于替代静态额度说明。`,
            `${contextLabel.en} can now read runtime minutes, run samples, binding policies, and credential coverage by linked service instead of relying on static quota copy.`
          )
        : l(
            `${contextLabel.zh} 当前还没有形成可计量的服务运行样本。`,
            `${contextLabel.en} does not yet have any metered service run sample.`
          ),
    metrics: [
      {
        label: l("运行分钟", "Runtime minutes"),
        value: `${totalRuntimeMinutes}m`,
        note: l(
          "以实例创建时间到最近更新时间近似计算，用于展示当前 package 的运行消耗轮廓。",
          "Estimated from run creation to latest update time to show the current runtime-consumption profile of this package."
        ),
      },
      {
        label: l("实例 / 完成", "Runs / completed"),
        value: `${packageRuns.length}/${completedRuns}`,
        note: l(
          "统计当前工作区中命中 package 版本线或关联服务的全部实例。",
          "Counts all runs in the current workspace context that match the package version line or linked services."
        ),
      },
      {
        label: l("估算成本 / 台账", "Estimated cost / ledger"),
        value: `$${billingSnapshot.summary.totalAmountUsd.toFixed(4)}/${billingSnapshot.summary.totalEntriesCount}`,
        note: l(
          `当前账本已有 ${billingSnapshot.summary.totalEntriesCount} 条计费记录，累计估算成本为 $${billingSnapshot.summary.totalAmountUsd.toFixed(4)}。`,
          `${billingSnapshot.summary.totalEntriesCount} billing entries are now recorded, with an estimated total cost of $${billingSnapshot.summary.totalAmountUsd.toFixed(4)}.`
        ),
      },
      {
        label: l("额度策略 / 待处理", "Policies / pending"),
        value: `${quotaSnapshot.policies.length}/${pendingQuotaOverrides}`,
        note: l(
          `当前工作区命中 ${quotaSnapshot.policies.length} 条正式额度策略，最近共有 ${quotaWarningEvents} 条告警或待审批事件。`,
          `${quotaSnapshot.policies.length} formal quota policies are in scope for this workspace context, with ${quotaWarningEvents} recent warning or approval-pending events.`
        ),
      },
    ],
    headers: [
      l("成本项", "Cost item"),
      l("计量域", "Metering scope"),
      l("当前使用", "Current usage"),
      l("阈值 / 动作", "Threshold / action"),
    ],
    rows,
    updatedAt: latestIso([
      pkg.updatedAt,
      ...packageRuns.map((item) => item.run.updatedAt),
      ...relevantBindings.map((item) => item.updatedAt),
      ...relevantCredentials.map((item) => item.updatedAt),
      ...relevantRegistryEntries.map((item) => item.updatedAt),
      ...billingSnapshot.entries.map((item) => item.updatedAt),
      ...quotaSnapshot.policies.map((item) => item.updatedAt),
      ...quotaSnapshot.counters.map((item) => item.updatedAt),
      ...quotaSnapshot.events.map((item) => item.occurredAt),
      ...quotaSnapshot.overrides.map((item) => item.updatedAt),
    ]),
  };
}

function buildCreatorAuditExportPayload(
  pkg: CreatorPackageDetail,
  workspaceContextKey: string
): CreatorAuditExportPayload {
  const releases = creatorRepository
    .listReleasesByPackage(pkg.packageId)
    .filter((item) => item.targetWorkspaceContextKey === workspaceContextKey)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const replays = creatorRepository
    .listReplaysByPackage(pkg.packageId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const activations = creatorRepository
    .listReleaseActivations()
    .filter(
      (item) => item.packageId === pkg.packageId && item.targetWorkspaceContextKey === workspaceContextKey
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const gates = releases
    .flatMap((release) => creatorRepository.listReleaseGatesByRelease(release.releaseId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const runs = listPackageRuns(pkg, workspaceContextKey).map((snapshot) => ({
    runId: snapshot.run.runId,
    title: snapshot.run.title,
    status: snapshot.run.status,
    viewStatus: resolveRunListViewStatus(snapshot.run.status),
    serviceId: snapshot.run.catalogMetadata?.serviceId ?? null,
    workspaceId: snapshot.run.workspaceId,
    workspaceContextKey: snapshot.run.catalogMetadata?.workspaceContextKey ?? null,
    createdAt: snapshot.run.createdAt,
    updatedAt: snapshot.run.updatedAt,
    approvalCount: snapshot.approvals.length,
    artifactCount: snapshot.artifacts.length,
  }));
  const counts = {
    releases: releases.length,
    replays: replays.length,
    gates: gates.length,
    activations: activations.length,
    runs: runs.length,
    total:
      releases.length + replays.length + gates.length + activations.length + runs.length,
  };

  return {
    package: {
      packageId: pkg.packageId,
      title: pkg.title,
      workspaceContextKey,
      generatedAt: nowIso(),
      versionLine: [...pkg.versionLine],
    },
    counts,
    releases,
    replays,
    gates,
    activations,
    runs,
  };
}

function serializeCreatorAuditExportPayload(
  payload: CreatorAuditExportPayload,
  format: CreateCreatorAuditExportInput["format"]
) {
  if (format === "csv") {
    return serializeCreatorAuditExportCsv(payload);
  }

  return JSON.stringify(payload, null, 2);
}

function serializeCreatorAuditExportCsv(payload: CreatorAuditExportPayload) {
  const rows: string[][] = [
    [
      "record_type",
      "record_id",
      "package_id",
      "workspace_context_key",
      "state",
      "status",
      "updated_at",
      "note",
    ],
  ];

  for (const release of payload.releases) {
    rows.push([
      "release",
      release.releaseId,
      release.packageId,
      release.targetWorkspaceContextKey,
      release.state,
      "",
      release.updatedAt,
      release.channelLabel.en,
    ]);
  }

  for (const replay of payload.replays) {
    rows.push([
      "replay",
      replay.replayId,
      replay.packageId,
      payload.package.workspaceContextKey,
      replay.state,
      "",
      replay.updatedAt,
      replay.summary.en,
    ]);
  }

  for (const gate of payload.gates) {
    rows.push([
      "gate",
      gate.gateId,
      gate.packageId,
      payload.package.workspaceContextKey,
      gate.gateType,
      gate.status,
      gate.updatedAt,
      gate.resultSummary.en,
    ]);
  }

  for (const activation of payload.activations) {
    rows.push([
      "activation",
      activation.activationId,
      activation.packageId,
      activation.targetWorkspaceContextKey,
      activation.rolloutMode,
      activation.state,
      activation.updatedAt,
      activation.note?.en ?? "",
    ]);
  }

  for (const run of payload.runs) {
    rows.push([
      "run",
      run.runId,
      payload.package.packageId,
      run.workspaceContextKey ?? payload.package.workspaceContextKey,
      run.viewStatus,
      run.status,
      run.updatedAt,
      `${run.title} / approvals=${run.approvalCount} / artifacts=${run.artifactCount}`,
    ]);
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value: string | number | null | undefined) {
  const serialized = String(value ?? "");
  if (!/[",\n]/.test(serialized)) {
    return serialized;
  }

  return `"${serialized.replace(/"/g, "\"\"")}"`;
}

function auditExportMimeType(format: CreateCreatorAuditExportInput["format"]) {
  return format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8";
}

function buildCreatorAuditExportFileName(
  packageId: string,
  workspaceContextKey: string,
  format: CreateCreatorAuditExportInput["format"]
) {
  const extension = format === "csv" ? "csv" : "json";
  return `${slugifyCreatorKey(packageId)}-${slugifyCreatorKey(workspaceContextKey)}-audit-export.${extension}`;
}

function buildCreatorAuditExportObjectKey(
  packageId: string,
  exportId: string,
  format: CreateCreatorAuditExportInput["format"]
) {
  const extension = format === "csv" ? "csv" : "json";
  return `creator/audit-exports/${slugifyCreatorKey(packageId)}/${exportId}.${extension}`;
}

function buildCreatorAuditExportSummary(payload: CreatorAuditExportPayload) {
  return l(
    `包含 ${payload.counts.releases} 条发布、${payload.counts.gates} 条 Gate、${payload.counts.activations} 条激活、${payload.counts.replays} 条回放与 ${payload.counts.runs} 个实例样本。`,
    `Contains ${payload.counts.releases} releases, ${payload.counts.gates} gates, ${payload.counts.activations} activations, ${payload.counts.replays} replays, and ${payload.counts.runs} run samples.`
  );
}

function buildCreatorServiceCostRow(input: {
  service: ReturnType<typeof resolveLinkedServiceRecords>[number];
  workspaceContextKey: string;
  packageRuns: RunSnapshot[];
  relevantBindings: McpBindingRecord[];
  relevantCredentials: CredentialDetail[];
}): CreatorGovernanceRow {
  const { service, workspaceContextKey, packageRuns, relevantBindings, relevantCredentials } = input;
  const contextLabel = resolveWorkspaceContextLabel(workspaceContextKey);
  const serviceRuns = packageRuns.filter(
    (snapshot) => snapshot.run.catalogMetadata?.serviceId === service.serviceId
  );
  const runMinutes = serviceRuns.reduce((sum, snapshot) => sum + estimateRunMinutes(snapshot), 0);
  const failedRuns = serviceRuns.filter(
    (snapshot) => snapshot.run.status === "FAILED" || snapshot.run.status === "CANCELLED"
  ).length;
  const waitingApprovals = serviceRuns.reduce(
    (sum, snapshot) => sum + snapshot.approvals.filter((item) => item.state === "pending").length,
    0
  );
  const serviceBindings = relevantBindings.filter((binding) =>
    service.requiredBindings.firstPartyMcpIds.includes(binding.mcpId)
  );
  const serviceCredentialIds = new Set(service.requiredBindings.credentialIds);
  for (const binding of serviceBindings) {
    if (binding.credentialId) {
      serviceCredentialIds.add(binding.credentialId);
    }
  }
  const serviceCredentials = relevantCredentials.filter((item) =>
    serviceCredentialIds.has(item.credentialId)
  );
  const approvalPolicies = serviceBindings.filter((item) => item.approvalRequired).length;
  const externalConnectorCount = service.requiredBindings.externalConnectorRefs.length;
  const tone: CreatorGovernanceRow["tone"] =
    failedRuns > 0
      ? "warn"
      : waitingApprovals > 0
        ? "active"
        : serviceRuns.length > 0
          ? "success"
          : serviceBindings.length > 0 || serviceCredentials.length > 0
            ? "active"
            : "";

  return {
    id: `cost-service-${service.serviceId}`,
    tone,
    cells: [
      service.displayName,
      joinTexts([
        contextLabel,
        l(
          `${service.requiredBindings.firstPartyMcpIds.length} MCP / ${externalConnectorCount} Connector`,
          `${service.requiredBindings.firstPartyMcpIds.length} MCP / ${externalConnectorCount} Connector`
        ),
      ]),
      sameText(`${serviceRuns.length} runs / ${runMinutes} min`),
      l(
        `${serviceBindings.length} 条绑定、${serviceCredentials.length} 个凭证、${approvalPolicies} 条审批策略${failedRuns > 0 ? `、${failedRuns} 个失败或取消实例` : waitingApprovals > 0 ? `、${waitingApprovals} 个待确认动作` : ""}。`,
        `${serviceBindings.length} bindings, ${serviceCredentials.length} credentials, and ${approvalPolicies} approval policies${failedRuns > 0 ? ` with ${failedRuns} failed or cancelled runs` : waitingApprovals > 0 ? ` with ${waitingApprovals} pending approval actions` : ""}.`
      ),
    ] satisfies CreatorGovernanceRow["cells"],
  };
}

function buildCreatorQuotaCostRow(input: {
  policy: import("@lingban/contracts").QuotaPolicy;
  counter: import("@lingban/contracts").QuotaCounter | null;
  latestEvent: import("@lingban/contracts").QuotaEvent | null;
}): CreatorGovernanceRow {
  const { policy, counter, latestEvent } = input;
  const tone: CreatorGovernanceRow["tone"] =
    latestEvent?.decision === "blocked" || latestEvent?.decision === "rejected_override"
      ? "warn"
      : latestEvent?.decision === "approval_pending"
        ? "active"
        : counter != null
          ? "success"
          : "";
  const counterValue =
    counter == null
      ? "-"
      : `${counter.currentValue} / ${policy.hardLimitValue ?? policy.limitValue}`;
  const actionText =
    latestEvent?.decision === "approval_pending"
      ? l("已触发超额审批，等待处理。", "An overage approval is pending.")
      : latestEvent?.decision === "blocked"
        ? l("最近一次命中硬阈值并被阻断。", "The latest evaluation hit a hard limit and was blocked.")
        : latestEvent?.decision === "warned"
          ? l("最近一次命中软阈值告警。", "The latest evaluation crossed a soft warning threshold.")
          : l(
              `${policy.actionOnSoftLimit} / ${policy.actionOnHardLimit}`,
              `${policy.actionOnSoftLimit} / ${policy.actionOnHardLimit}`
            );

  return {
    id: `cost-quota-${policy.policyId}`,
    tone,
    cells: [
      joinTexts([quotaMetricLabelForCreator(policy.metric), sameText(policy.policyId)]),
      joinTexts([quotaScopeLabelForCreator(policy.scopeType), sameText(policy.scopeRefId)]),
      sameText(counterValue),
      actionText,
    ] satisfies CreatorGovernanceRow["cells"],
  };
}

function buildCreatorBillingCostRow(input: {
  metric: BillingMetricSummary;
  workspaceContextKey: string;
}): CreatorGovernanceRow {
  const { metric, workspaceContextKey } = input;
  const tone: CreatorGovernanceRow["tone"] =
    metric.amountUsd > 0 ? "success" : metric.entriesCount > 0 ? "active" : "";
  const contextLabel = resolveWorkspaceContextLabel(workspaceContextKey);

  return {
    id: `cost-ledger-${metric.metric}`,
    tone,
    cells: [
      joinTexts([metric.label, sameText(metric.metric)]),
      joinTexts([contextLabel, l("正式账本聚合", "Formal ledger rollup")]),
      sameText(`${metric.quantity} / $${metric.amountUsd.toFixed(4)}`),
      l(
        `估算成本，${metric.entriesCount} 条记录${metric.latestOccurredAt ? `，最新于 ${metric.latestOccurredAt}` : ""}。`,
        `Estimated cost with ${metric.entriesCount} entries${metric.latestOccurredAt ? `, latest at ${metric.latestOccurredAt}` : ""}.`
      ),
    ] satisfies CreatorGovernanceRow["cells"],
  };
}

function quotaMetricLabelForCreator(metric: string) {
  switch (metric) {
    case "daily_runs":
      return l("单日实例额度", "Daily run quota");
    case "active_runs":
      return l("并发实例额度", "Active-run quota");
    case "browser_minutes":
      return l("浏览器分钟预算", "Browser-minute budget");
    case "audit_exports":
      return l("审计导出额度", "Audit-export quota");
    case "image_credits":
      return l("图像额度", "Image-credit quota");
    default:
      return sameText(metric);
  }
}

function quotaScopeLabelForCreator(scopeType: string) {
  switch (scopeType) {
    case "workspace-context":
      return l("工作区上下文", "Workspace context");
    case "workspace":
      return l("工作区", "Workspace");
    case "package":
      return l("Creator 包", "Creator package");
    case "service":
      return l("服务", "Service");
    case "task-version":
      return l("任务版本", "Task version");
    case "session-version":
      return l("Session 版本", "Session version");
    case "user":
      return l("用户", "User");
    default:
      return sameText(scopeType);
  }
}

function buildCreatorMemberRow(
  input: {
    user: {
      userId: string;
      displayName: string;
      updatedAt: string;
    };
    currentMembership: WorkspaceMembership;
    linkedMemberships: Array<{
      workspace: Workspace;
      membership: WorkspaceMembership;
    }>;
  },
  pkg: CreatorPackageDetail
): CreatorGovernanceRow {
  const highestRole = highestMembershipRole(input.linkedMemberships);
  const tone: CreatorGovernanceRow["tone"] =
    highestRole === "admin" || highestRole === "owner"
      ? "warn"
      : highestRole === "creator"
        ? "active"
        : "success";
  const scopeLabels = input.linkedMemberships.map(({ workspace, membership }) => {
    const contextKey = resolveWorkspaceContextKeyFromAuthWorkspace(workspace);
    const contextLabel = resolveWorkspaceContextLabel(contextKey);
    return joinTexts([contextLabel, workspaceRoleLabel(membership.role)]);
  });

  return {
    id: `member-${input.user.userId}`,
    tone,
    cells: [
      joinTexts([sameText(input.user.displayName), workspaceRoleLabel(highestRole)]),
      scopeLabels.length > 0
        ? l(
            scopeLabels.map((item) => item.zh).join(" + "),
            scopeLabels.map((item) => item.en).join(" + ")
          )
        : l("当前空间", "Current workspace"),
      runAccessLabel(highestRole),
      packageAccessLabel(highestRole, pkg),
    ] satisfies CreatorGovernanceRow["cells"],
  };
}

function listPackageRuns(pkg: CreatorPackageDetail, workspaceContextKey: string): RunSnapshot[] {
  const { taskVersionId, sessionVersionId } = extractLaunchTemplateVersionsFromPackage(
    pkg.packageId,
    pkg.versionLine
  );

  return runsRepository
    .list()
    .map((aggregate) => runSnapshotSchema.parse(aggregate))
    .filter((snapshot) => {
      if (snapshot.run.catalogMetadata?.workspaceContextKey !== workspaceContextKey) {
        return false;
      }

      if (pkg.linkedServiceIds.includes(snapshot.run.catalogMetadata?.serviceId ?? "")) {
        return true;
      }

      return (
        snapshot.run.taskVersionId === taskVersionId ||
        snapshot.run.sessionVersionId === sessionVersionId
      );
    })
    .sort((left, right) => right.run.updatedAt.localeCompare(left.run.updatedAt));
}

function resolveLinkedServiceRecords(pkg: CreatorPackageDetail) {
  return pkg.linkedServiceIds.flatMap((serviceId) => {
    const item = workshopCatalogRepository.getServiceById(serviceId);
    return item ? [item] : [];
  });
}

function resolveWorkspaceContextLabel(workspaceContextKey: string): LocalizedText {
  const context = workshopCatalogRepository.getContextByKey(workspaceContextKey);
  return context?.displayName ?? sameText(workspaceContextKey);
}

function passesOrNoneLabel(passedGateCount: number, totalGateCount: number) {
  if (totalGateCount === 0) {
    return l("暂无 Gate", "No gate");
  }

  if (passedGateCount >= totalGateCount) {
    return l("已就绪", "Ready");
  }

  return sameText(`${passedGateCount}/${totalGateCount}`);
}

function summarizePackageRunStates(snapshots: RunSnapshot[]) {
  let running = 0;
  let approval = 0;
  let done = 0;

  for (const snapshot of snapshots) {
    switch (snapshot.run.status) {
      case "WAITING_APPROVAL":
        approval += 1;
        break;
      case "SUCCEEDED":
        done += 1;
        break;
      case "CREATED":
      case "READY":
      case "QUEUED":
      case "STARTING":
      case "RUNNING":
      default:
        running += 1;
        break;
    }
  }

  return { running, approval, done };
}

function estimateRunMinutes(snapshot: RunSnapshot) {
  const createdAt = Date.parse(snapshot.run.createdAt);
  const updatedAt = Date.parse(snapshot.run.updatedAt);

  if (Number.isNaN(createdAt) || Number.isNaN(updatedAt) || updatedAt <= createdAt) {
    return snapshot.run.status === "CREATED" ? 0 : 1;
  }

  return Math.max(1, Math.ceil((updatedAt - createdAt) / 60_000));
}

function isBindingRelevantToPackage(
  binding: McpBindingRecord,
  input: {
    sessionVersionId: string;
    runIds: Set<string>;
    workspaceId: string;
    userId: string;
  }
) {
  switch (binding.scope) {
    case "workspace":
      return binding.scopeRef === input.workspaceId;
    case "user":
      return binding.scopeRef === input.userId;
    case "session-version":
      return binding.scopeRef === input.sessionVersionId;
    case "run":
      return input.runIds.has(binding.scopeRef);
    default:
      return false;
  }
}

function resolveWorkspaceContextKeyFromAuthWorkspace(workspace: {
  workspaceId: string;
  slug: string;
  name: string;
  type: string;
}) {
  const mapped = workshopCatalogRepository.getContextByRuntimeWorkspaceId(workspace.workspaceId);
  if (mapped) {
    return mapped.contextKey;
  }

  const type = normalizeWorkspaceText(workspace.type);
  const haystack = [
    normalizeWorkspaceText(workspace.workspaceId),
    normalizeWorkspaceText(workspace.slug),
    normalizeWorkspaceText(workspace.name),
  ].join(" ");

  if (type === "personal" || haystack.includes("personal") || /个人/.test(haystack)) {
    return "personal";
  }

  if (/harbor|finance|tax|filing|财务|财税|报税/.test(haystack)) {
    return "harbor-finance";
  }

  if (/brand|content|poster|drama|creator|品牌|内容|海报|短剧/.test(haystack)) {
    return "brand-lab";
  }

  return workspace.workspaceId;
}

function normalizeWorkspaceText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function highestMembershipRoleRank(
  memberships: Array<{ membership: { role: WorkspaceRole } }>
) {
  return memberships.reduce(
    (max, item) => Math.max(max, workspaceRoleRank(item.membership.role)),
    workspaceRoleRank("viewer")
  );
}

function highestMembershipRole(
  memberships: Array<{ membership: { role: WorkspaceRole } }>
): WorkspaceRole {
  return [...memberships]
    .sort(
      (left, right) =>
        workspaceRoleRank(right.membership.role) - workspaceRoleRank(left.membership.role)
    )[0]?.membership.role ?? "viewer";
}

function workspaceRoleLabel(role: WorkspaceRole) {
  switch (role) {
    case "owner":
      return l("所有者", "Owner");
    case "admin":
      return l("管理员", "Admin");
    case "operator":
      return l("操作员", "Operator");
    case "creator":
      return l("创作者", "Creator");
    case "viewer":
    default:
      return l("查看者", "Viewer");
  }
}

function runAccessLabel(role: WorkspaceRole) {
  switch (role) {
    case "owner":
      return l("查看全部实例 + 最终审批", "Read all runs + final approval");
    case "admin":
      return l("查看全部实例 + 审计治理", "Read all runs + audit governance");
    case "creator":
      return l("查看、追问、回放与差异复核", "Read, follow up, replay, and review diffs");
    case "operator":
      return l("查看实例 + 处理审批动作", "Read runs + handle approval actions");
    case "viewer":
    default:
      return l("只读实例", "Read-only runs");
  }
}

function packageAccessLabel(role: WorkspaceRole, pkg: CreatorPackageDetail) {
  switch (role) {
    case "owner":
      return l(
        `可治理 ${pkg.packageId}、激活正式发布并调整全部凭证域`,
        `Can govern ${pkg.packageId}, activate production releases, and manage all secret domains`
      );
    case "admin":
      return l(
        `可治理 ${pkg.packageId}、发布 Gate 与绑定策略`,
        `Can govern ${pkg.packageId}, release gates, and binding policies`
      );
    case "creator":
      return l(
        `可发布 ${pkg.packageId} 并登记回放证据`,
        `Can release ${pkg.packageId} and record replay evidence`
      );
    case "operator":
      return l(
        `可查看 ${pkg.packageId} 与结果目录`,
        `Can inspect ${pkg.packageId} and result directories`
      );
    case "viewer":
    default:
      return l(
        `只读 ${pkg.packageId}`,
        `Readonly ${pkg.packageId}`
      );
  }
}

function joinTexts(
  parts: Array<LocalizedText | null | undefined>,
  separator = " / "
): LocalizedText {
  const filtered = parts.filter((item): item is LocalizedText => item != null);
  if (filtered.length === 0) {
    return l("-", "-");
  }

  return l(
    filtered.map((item) => item.zh).join(separator),
    filtered.map((item) => item.en).join(separator)
  );
}

function sameText(value: string | null | undefined, fallback = "-"): LocalizedText {
  const safe = value?.trim() || fallback;
  return l(safe, safe);
}

function slugifyCreatorKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "creator";
}

function parseNumericSuffix(value: string) {
  const match = /(\d+)$/.exec(value);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function l(zh: string, en: string): LocalizedText {
  return { zh, en };
}

function workspaceRoleRank(role: WorkspaceRole) {
  switch (role) {
    case "viewer":
      return 0;
    case "operator":
      return 1;
    case "creator":
      return 2;
    case "admin":
      return 3;
    case "owner":
    default:
      return 4;
  }
}

function gateOrder(): CreatorReleaseGateType[] {
  return ["desensitization", "replay", "credential", "manual_approval"];
}

function defaultGateBlueprints(releaseState: CreatorReleaseSummary["state"]): GateBlueprint[] {
  return [
    {
      gateType: "desensitization",
      requiredRole: "creator",
      status: "pending",
      resultSummary: l("待提交脱敏复核结果。", "Desensitization review evidence is pending."),
    },
    {
      gateType: "replay",
      requiredRole: "creator",
      status: "pending",
      resultSummary: l("待补全回放与差异确认。", "Replay and diff evidence is pending."),
    },
    {
      gateType: "credential",
      requiredRole: "admin",
      status: "pending",
      resultSummary: l("待确认凭证与依赖可用性。", "Credential and dependency availability is pending."),
    },
    {
      gateType: "manual_approval",
      requiredRole: "owner",
      status: releaseState === "production" ? "pending" : "waived",
      resultSummary:
        releaseState === "production"
          ? l("正式发布前需要 Owner 签核。", "Owner approval is required before production activation.")
          : l("非正式发布不要求 Owner 人工签核。", "Owner approval is not required for non-production releases."),
    },
  ];
}

function syncGateForReleaseState(
  gate: CreatorReleaseGate,
  releaseState: CreatorReleaseSummary["state"]
): CreatorReleaseGate {
  if (gate.gateType !== "manual_approval") {
    return gate;
  }

  if (releaseState === "production" && gate.status === "waived") {
    return creatorReleaseGateSchema.parse({
      ...gate,
      status: "pending",
      resultSummary: l("正式发布前需要 Owner 签核。", "Owner approval is required before production activation."),
      evidenceRef: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: nowIso(),
    });
  }

  if (releaseState !== "production" && gate.status !== "waived") {
    return creatorReleaseGateSchema.parse({
      ...gate,
      status: "waived",
      resultSummary: l("非正式发布不要求 Owner 人工签核。", "Owner approval is not required for non-production releases."),
      evidenceRef: null,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: nowIso(),
    });
  }

  return gate;
}

function defaultGateDecisionSummary(
  gateType: CreatorReleaseGateType,
  status: "passed" | "failed" | "waived"
): LocalizedText {
  const label = gateTypeLabel(gateType);
  switch (status) {
    case "passed":
      return l(`${label.zh}已通过。`, `${label.en} passed.`);
    case "failed":
      return l(`${label.zh}已驳回。`, `${label.en} failed.`);
    case "waived":
    default:
      return l(`${label.zh}已豁免。`, `${label.en} waived.`);
  }
}

function buildFormalGateBlueprints(releaseState: CreatorReleaseSummary["state"]): FormalGateBlueprint[] {
  return gateOrder().map((gateType) => buildFormalGateBlueprint(gateType, releaseState));
}

function buildFormalGateBlueprint(
  gateType: CreatorReleaseGateType,
  releaseState: CreatorReleaseSummary["state"]
): FormalGateBlueprint {
  const status =
    gateType === "manual_approval"
      ? releaseState === "production"
        ? "pending"
        : "waived"
      : "pending";

  switch (gateType) {
    case "desensitization":
      return {
        gateType,
        requiredRole: "creator",
        status,
        resultSummary: l(
          "待提交脱敏复核结果。",
          "Desensitization review evidence is pending."
        ),
        checklist: buildFormalGateChecklistTemplate(gateType, status),
        recommendedActions: [
          l("附上脱敏报告或样本路径差异。", "Attach the desensitization report or a sample path diff."),
          l("标注仍需二次复核的残余暴露项。", "Mark any residual exposure that still requires a second review."),
        ],
      };
    case "replay":
      return {
        gateType,
        requiredRole: "creator",
        status,
        resultSummary: l(
          "待补齐回放与差异核对结果。",
          "Replay and diff evidence is pending."
        ),
        checklist: buildFormalGateChecklistTemplate(gateType, status),
        recommendedActions: [
          l("绑定真实 run，并记录消息时序核对结果。", "Bind a real run and record the message-order review result."),
          l("补充关键产物差异和阻塞节点说明。", "Document key artifact diffs and any blocking nodes."),
        ],
      };
    case "credential":
      return {
        gateType,
        requiredRole: "admin",
        status,
        resultSummary: l(
          "待确认凭证、依赖与网络策略可用性。",
          "Credential, dependency, and network-policy availability is pending."
        ),
        checklist: buildFormalGateChecklistTemplate(gateType, status),
        recommendedActions: [
          l("核对绑定凭证、轮换窗口和作用域。", "Verify bound credentials, rotation windows, and scope."),
          l("复核远程依赖域名和网络策略白名单。", "Review remote dependency domains and network-policy allowlists."),
        ],
      };
    case "manual_approval":
    default:
      return {
        gateType,
        requiredRole: "owner",
        status,
        resultSummary:
          releaseState === "production"
            ? l(
                "正式发布前需要 Owner 签核。",
                "Owner approval is required before production activation."
              )
            : l(
                "非正式发布不要求 Owner 人工签核。",
                "Owner approval is not required for non-production releases."
              ),
        checklist: buildFormalGateChecklistTemplate(gateType, status),
        recommendedActions: [
          l("确认发布窗口、回滚负责人和升级范围。", "Confirm rollout window, rollback owner, and activation scope."),
          l("记录最终风险接受说明。", "Record the final risk-acceptance note."),
        ],
      };
  }
}

function buildFormalGateChecklistTemplate(
  gateType: CreatorReleaseGateType,
  status: "pending" | "passed" | "failed" | "waived"
): CreatorReleaseGateChecklistItem[] {
  const templates: Array<{ itemId: string; label: LocalizedText }> = (() => {
    switch (gateType) {
      case "desensitization":
        return [
          {
            itemId: "path-reference-scan",
            label: l("路径引用已复核。", "Path references are reviewed."),
          },
          {
            itemId: "pii-secret-scan",
            label: l("PII 与密钥暴露已排查。", "PII and secret exposure are checked."),
          },
          {
            itemId: "artifact-sample-review",
            label: l("抽样产物已完成复看。", "Sample artifacts were re-reviewed."),
          },
        ];
      case "replay":
        return [
          {
            itemId: "source-run-bound",
            label: l("已绑定真实来源 run。", "A real source run is bound."),
          },
          {
            itemId: "message-order-reviewed",
            label: l("消息时序已核对。", "Message order was reviewed."),
          },
          {
            itemId: "artifact-diff-reviewed",
            label: l("关键产物差异已核对。", "Key artifact diffs were reviewed."),
          },
        ];
      case "credential":
        return [
          {
            itemId: "credential-binding-reviewed",
            label: l("凭证绑定与作用域已复核。", "Credential bindings and scope were reviewed."),
          },
          {
            itemId: "rotation-window-verified",
            label: l("轮换窗口已核对。", "Rotation windows were verified."),
          },
          {
            itemId: "network-policy-verified",
            label: l("网络策略与依赖域名已确认。", "Network policy and dependency domains were verified."),
          },
        ];
      case "manual_approval":
      default:
        return [
          {
            itemId: "risk-acceptance-recorded",
            label: l("风险接受说明已记录。", "Risk-acceptance note was recorded."),
          },
          {
            itemId: "rollback-owner-confirmed",
            label: l("回滚责任人已确认。", "Rollback owner was confirmed."),
          },
          {
            itemId: "rollout-window-confirmed",
            label: l("发布窗口已确认。", "Rollout window was confirmed."),
          },
        ];
    }
  })();

  return templates.map((item) =>
    creatorReleaseGateChecklistItemSchema.parse({
      ...item,
      status,
      note: null,
    })
  );
}

function resolveFormalNextGateChecklist(
  current: CreatorReleaseGate,
  input: CreatorReleaseGateChecklistItem[] | undefined,
  status: "passed" | "failed" | "waived"
) {
  const fallbackStatus = current.status === "waived" ? "waived" : "pending";
  const source =
    input && input.length > 0
      ? input
      : current.checklist.length > 0
        ? current.checklist
        : buildFormalGateChecklistTemplate(current.gateType, fallbackStatus);
  const normalized = normalizeFormalGateChecklist(source);

  if (status === "waived") {
    return normalized.map((item) =>
      creatorReleaseGateChecklistItemSchema.parse({
        ...item,
        status: "waived",
      })
    );
  }

  return normalized;
}

function normalizeFormalGateChecklist(items: CreatorReleaseGateChecklistItem[]) {
  const parsed = items.map((item) => creatorReleaseGateChecklistItemSchema.parse(item));
  const seen = new Set<string>();

  for (const item of parsed) {
    if (seen.has(item.itemId)) {
      throw new AppError(
        400,
        "CREATOR_RELEASE_GATE_CHECKLIST_DUPLICATE",
        `Duplicate gate checklist item: ${item.itemId}`
      );
    }
    seen.add(item.itemId);
  }

  return parsed;
}

function assertFormalGateDecisionPayload(
  gate: CreatorReleaseGate,
  status: "passed" | "failed" | "waived",
  input: {
    checklist: CreatorReleaseGateChecklistItem[];
    evidenceRef: string | null;
    resultSummary: LocalizedText;
  }
) {
  const hasPendingChecklist = input.checklist.some((item) => item.status === "pending");
  const hasFailedChecklist = input.checklist.some((item) => item.status === "failed");
  const hasEvidenceRef = Boolean(input.evidenceRef?.trim());

  if (status === "passed") {
    if (hasPendingChecklist || hasFailedChecklist) {
      throw new AppError(
        400,
        "CREATOR_RELEASE_GATE_CHECKLIST_INCOMPLETE",
        `Gate ${gate.gateId} cannot pass while checklist items remain pending or failed`
      );
    }

    if (gate.gateType !== "manual_approval" && !hasEvidenceRef) {
      throw new AppError(
        400,
        "CREATOR_RELEASE_GATE_EVIDENCE_REQUIRED",
        `Gate ${gate.gateId} requires evidence before it can pass`
      );
    }
  }

  if (
    status === "failed" &&
    !hasFailedChecklist &&
    isFormalDefaultPendingGateSummary(gate, input.resultSummary)
  ) {
    throw new AppError(
      400,
      "CREATOR_RELEASE_GATE_FAILURE_DETAIL_REQUIRED",
      `Gate ${gate.gateId} requires either a failed checklist item or an explicit failure note`
    );
  }
}

function syncFormalGateForReleaseState(
  gate: CreatorReleaseGate,
  releaseState: CreatorReleaseSummary["state"]
): CreatorReleaseGate {
  const blueprint = buildFormalGateBlueprint(gate.gateType, releaseState);
  const normalizedGate = creatorReleaseGateSchema.parse({
    ...gate,
    checklist: gate.checklist.length > 0 ? gate.checklist : blueprint.checklist,
    recommendedActions:
      gate.recommendedActions.length > 0
        ? gate.recommendedActions
        : blueprint.recommendedActions,
  });

  if (normalizedGate.gateType !== "manual_approval") {
    return normalizedGate;
  }

  if (releaseState === "production" && normalizedGate.status === "waived") {
    return creatorReleaseGateSchema.parse({
      ...normalizedGate,
      status: "pending",
      resultSummary: blueprint.resultSummary,
      evidenceRef: null,
      checklist: blueprint.checklist,
      recommendedActions: blueprint.recommendedActions,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: nowIso(),
    });
  }

  if (releaseState !== "production" && normalizedGate.status !== "waived") {
    return creatorReleaseGateSchema.parse({
      ...normalizedGate,
      status: "waived",
      resultSummary: blueprint.resultSummary,
      evidenceRef: null,
      checklist: blueprint.checklist,
      recommendedActions: blueprint.recommendedActions,
      decidedByUserId: null,
      decidedAt: null,
      updatedAt: nowIso(),
    });
  }

  return normalizedGate;
}

function isFormalDefaultPendingGateSummary(gate: CreatorReleaseGate, summary: LocalizedText) {
  const pendingBlueprint = buildFormalGateBlueprint(gate.gateType, "production");
  return (
    summary.zh.trim() === pendingBlueprint.resultSummary.zh.trim() &&
    summary.en.trim() === pendingBlueprint.resultSummary.en.trim()
  );
}

function activationSummaryNote(release: CreatorReleaseSummary): LocalizedText {
  return l(
    `已激活到 ${release.targetWorkspaceContextKey}。`,
    `Activated into ${release.targetWorkspaceContextKey}.`
  );
}

function extractLaunchTemplateVersionsFromPackage(packageId: string, versionLine: string[]) {
  const taskVersionId = requireVersionLineRef(versionLine, "task", { packageId });
  const sessionVersionId = requireVersionLineRef(versionLine, "session", { packageId });

  return {
    taskVersionId,
    sessionVersionId,
  };
}

function gateTypeLabel(type: CreatorReleaseGateType): LocalizedText {
  switch (type) {
    case "desensitization":
      return l("脱敏门", "Desensitization gate");
    case "replay":
      return l("回放门", "Replay gate");
    case "credential":
      return l("凭证门", "Credential gate");
    case "manual_approval":
    default:
      return l("人工审核门", "Manual approval gate");
  }
}

function gateStatusLabel(status: CreatorReleaseGateStatus): LocalizedText {
  switch (status) {
    case "passed":
      return l("已通过", "Passed");
    case "failed":
      return l("已失败", "Failed");
    case "waived":
      return l("已豁免", "Waived");
    case "running":
      return l("执行中", "Running");
    case "pending":
    default:
      return l("待处理", "Pending");
  }
}

function summarizeReleaseChannel(
  channelLabel: LocalizedText,
  activeActivation: CreatorReleaseActivation | null
): LocalizedText {
  if (activeActivation) {
    return {
      zh: `当前主发布通道：${channelLabel.zh}，已激活到 ${activeActivation.targetWorkspaceContextKey}`,
      en: `Current primary release channel: ${channelLabel.en}, active in ${activeActivation.targetWorkspaceContextKey}`,
    };
  }

  return {
    zh: `当前主发布通道：${channelLabel.zh}`,
    en: `Current primary release channel: ${channelLabel.en}`,
  };
}

function summarizeReleaseItems(
  release: CreatorReleaseSummary,
  gates: CreatorReleaseGate[],
  activeActivation: CreatorReleaseActivation | null,
  fallbackItems: LocalizedText[]
) {
  const items: LocalizedText[] = [];

  if (activeActivation) {
    items.push(
      l(
        `已激活到 ${activeActivation.targetWorkspaceContextKey} / ${activeActivation.rolloutMode}`,
        `Activated into ${activeActivation.targetWorkspaceContextKey} / ${activeActivation.rolloutMode}`
      )
    );
  }

  for (const gate of gates) {
    const gateLabel = gateTypeLabel(gate.gateType);
    const statusLabel = gateStatusLabel(gate.status);
    items.push(
      l(`${gateLabel.zh}：${statusLabel.zh}`, `${gateLabel.en}: ${statusLabel.en}`)
    );
  }

  if (items.length > 0) {
    return items;
  }

  if (release.gateSummary.length > 0) {
    return release.gateSummary;
  }

  return fallbackItems.length > 0 ? fallbackItems : [l("当前暂无发布摘要。", "No release summary is available yet.")];
}

function latestIso(values: string[]) {
  return [...values].sort((left, right) => right.localeCompare(left))[0] ?? nowIso();
}

function mapPackageStateFromRelease(
  state: CreatorReleaseSummary["state"],
  gates: CreatorReleaseGate[],
  activeActivation: CreatorReleaseActivation | null
) {
  if (activeActivation?.state === "active") {
    return {
      state: "ready" as const,
      tone: "active" as const,
      statusLabel: l("已激活", "Activated"),
    };
  }

  if (gates.some((item) => item.status === "failed")) {
    return {
      state: "pending_release" as const,
      tone: "warn" as const,
      statusLabel: l("发布受阻", "Release blocked"),
    };
  }

  if (gates.some((item) => item.status === "pending" || item.status === "running")) {
    return {
      state: "pending_release" as const,
      tone: "warn" as const,
      statusLabel: l("待完成发布门", "Pending release gates"),
    };
  }

  switch (state) {
    case "private":
      return {
        state: "audited" as const,
        tone: "success" as const,
        statusLabel: l("已审计", "Audited"),
      };
    case "staged":
      return {
        state: "pending_release" as const,
        tone: "warn" as const,
        statusLabel: l("待灰度激活", "Awaiting staged activation"),
      };
    case "production":
    default:
      return {
        state: "ready" as const,
        tone: "active" as const,
        statusLabel: l("可激活", "Ready to activate"),
      };
  }
}

export async function initializeCreatorInfrastructure() {
  await creatorRepository.init();
}

export const creatorService = new CreatorService();
