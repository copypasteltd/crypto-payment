import {
  listMeAssetsQuerySchema,
  listMeAuthorizationsQuerySchema,
  listMeFavoriteWorkshopsQuerySchema,
  listMeNoticesQuerySchema,
  listMeRecentActivitiesQuerySchema,
  meAssetListResponseSchema,
  meAssetRecordSchema,
  meAuthorizationRecordSchema,
  meAuthorizationSummarySchema,
  meFavoriteWorkshopListResponseSchema,
  meFavoriteWorkshopRecordSchema,
  meNoticeSchema,
  meNoticeSummarySchema,
  meProfileSummarySchema,
  meRecentActivityListResponseSchema,
  meRecentActivityRecordSchema,
  recordMeRecentActivityInputSchema,
  setMeFavoriteWorkshopInputSchema,
  setMeFavoriteWorkshopResultSchema,
  type AuthUser,
  type CredentialDetail,
  type ListMeAssetsQuery,
  type ListMeAuthorizationsQuery,
  type ListMeFavoriteWorkshopsQuery,
  type ListMeNoticesQuery,
  type ListMeRecentActivitiesQuery,
  type McpRegistryEntry,
  type MeAssetKind,
  type MeAssetListResponse,
  type MeAssetRecord,
  type MeAuthorizationRecord,
  type MeAuthorizationSummary,
  type MeFavoriteWorkshopListResponse,
  type MeFavoriteWorkshopRecord,
  type MeNotice,
  type MeNoticeSummary,
  type MeNoticeType,
  type MeProfileSummary,
  type MeRecentActivityListResponse,
  type MeRecentActivityRecord,
  type MeRecentInteraction,
  type MeRecentResourceType,
  type RunFilePreviewMode,
  type RunSnapshot,
  type RunStatus,
  type RecordMeRecentActivityInput,
  type SetMeFavoriteWorkshopInput,
  type SetMeFavoriteWorkshopResult,
  type WorkspaceRole,
  type WorkspaceSummary,
} from "@lingban/contracts";
import { authService } from "../auth/service.js";
import { AppError } from "../../app/errors.js";
import { billingService } from "../billing/service.js";
import { credentialsService } from "../credentials/service.js";
import { mcpService } from "../mcp/service.js";
import { quotaService } from "../quotas/service.js";
import { runFileIndexService } from "../runs/file-index.js";
import { guessRunFileMimeType, inferRunFilePreviewMode } from "@lingban/files";
import { runsService } from "../runs/service.js";
import { meFavoritesRepository } from "./repository.js";
import { meRecentActivitiesRepository } from "./recent-repository.js";
import { collectRunNoticeRecords } from "./read-model.js";
import type { StoredRecentActivityRecord } from "./storage-schema.js";
import { workshopCatalogRepository } from "../workshops/repository.js";

const DEFAULT_NOTICE_LIMIT = 6;
const DEFAULT_ASSET_LIMIT = 6;
const DEFAULT_AUTHORIZATION_LIMIT = 8;
const DEFAULT_FAVORITES_LIMIT = 8;
const DEFAULT_RECENT_LIMIT = 6;

const NOTICE_TYPE_ORDER: MeNoticeType[] = [
  "approval_pending",
  "result_ready",
  "run_failed",
  "run_succeeded",
];

const ASSET_KIND_ORDER: MeAssetKind[] = [
  "result_bundle",
  "receipt",
  "general_file",
  "archive_record",
  "evidence",
];

type MeActorContext = {
  userId: string;
  user: AuthUser;
  workspaceId: string;
  workspaceContextKey: string;
  role: WorkspaceRole;
  currentWorkspace: WorkspaceSummary;
};

type CollectedAssetSource = {
  path: string;
  name: string;
  kind: "input" | "output" | "receipt" | "archive" | "log" | "screenshot";
  sizeBytes: number | null;
  updatedAt: string;
  previewMode: RunFilePreviewMode;
  previewable: boolean;
  downloadable: boolean;
};

function l(zh: string, en: string) {
  return { zh, en };
}

function roleRank(role: WorkspaceRole) {
  switch (role) {
    case "owner":
      return 5;
    case "admin":
      return 4;
    case "creator":
      return 3;
    case "operator":
      return 2;
    case "viewer":
    default:
      return 1;
  }
}

function canViewGovernance(role: WorkspaceRole) {
  return roleRank(role) >= roleRank("creator");
}

function isDirectoryPath(value: string) {
  return value.endsWith("/") || value.endsWith("\\");
}

function toLocalizedRunTitle(title: string) {
  return l(title, title);
}

function latestIso(values: Array<string | null | undefined>) {
  const filtered = values.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (filtered.length === 0) {
    return null;
  }

  return [...filtered].sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function inferAssetKind(file: Pick<CollectedAssetSource, "kind" | "name">): MeAssetKind | null {
  if (file.kind === "receipt") {
    return "receipt";
  }

  if (file.kind === "archive") {
    return "archive_record";
  }

  if (file.kind === "screenshot") {
    return "evidence";
  }

  if (file.kind === "output") {
    const normalizedName = file.name.toLowerCase();
    if (
      normalizedName.endsWith(".zip") ||
      normalizedName.endsWith(".tar") ||
      normalizedName.endsWith(".tar.gz") ||
      normalizedName.endsWith(".tgz")
    ) {
      return "result_bundle";
    }

    return "general_file";
  }

  return null;
}

function buildAssetId(runId: string, filePath: string) {
  const encoded = Buffer.from(`${runId}:${filePath}`, "utf8").toString("base64url");
  return `ast_${encoded.slice(0, 96)}`;
}

function buildFavoriteId(userId: string, workspaceContextKey: string, workshopId: string) {
  const encoded = Buffer.from(
    `${userId}:${workspaceContextKey}:${workshopId}`,
    "utf8"
  ).toString("base64url");
  return `favwk_${encoded.slice(0, 96)}`;
}

function buildRecentActivityId(
  userId: string,
  workspaceContextKey: string,
  resourceType: MeRecentResourceType,
  resourceId: string
) {
  const encoded = Buffer.from(
    `${userId}:${workspaceContextKey}:${resourceType}:${resourceId}`,
    "utf8"
  ).toString("base64url");
  return `rct_${encoded.slice(0, 96)}`;
}

function buildSourceSummary(snapshot: RunSnapshot) {
  const serviceName = snapshot.run.catalogMetadata?.serviceName;
  const workshopName = snapshot.run.catalogMetadata?.workshopName;
  const serviceZh = serviceName?.zh ?? workshopName?.zh ?? snapshot.run.title;
  const serviceEn = serviceName?.en ?? workshopName?.en ?? snapshot.run.title;
  return l(
    `${serviceZh} / ${snapshot.run.title}`,
    `${serviceEn} / ${snapshot.run.title}`
  );
}

function buildRunStatusLabel(status: RunStatus) {
  switch (status) {
    case "CREATED":
      return l("Created", "Created");
    case "READY":
      return l("Ready", "Ready");
    case "QUEUED":
      return l("Queued", "Queued");
    case "STARTING":
      return l("Starting", "Starting");
    case "RUNNING":
      return l("Running", "Running");
    case "WAITING_APPROVAL":
      return l("Waiting approval", "Waiting approval");
    case "SUCCEEDED":
      return l("Succeeded", "Succeeded");
    case "FAILED":
      return l("Failed", "Failed");
    case "CANCELLED":
      return l("Cancelled", "Cancelled");
    default:
      return l(status, status);
  }
}

function buildRunRecentTone(status: RunStatus) {
  switch (status) {
    case "WAITING_APPROVAL":
      return "warn" as const;
    case "SUCCEEDED":
      return "success" as const;
    case "FAILED":
    case "CANCELLED":
      return "danger" as const;
    default:
      return "active" as const;
  }
}

function buildCredentialTone(status: CredentialDetail["status"]) {
  switch (status) {
    case "active":
      return "success" as const;
    case "needs-rotation":
      return "warn" as const;
    case "disabled":
    case "revoked":
      return "danger" as const;
    default:
      return "active" as const;
  }
}

function buildCredentialStatusLabel(status: CredentialDetail["status"]) {
  switch (status) {
    case "active":
      return l("可用", "Active");
    case "needs-rotation":
      return l("待轮换", "Needs rotation");
    case "disabled":
      return l("已停用", "Disabled");
    case "revoked":
      return l("已吊销", "Revoked");
    default:
      return l(status, status);
  }
}

function buildCredentialScopeLabel(scope: CredentialDetail["scope"]) {
  return scope === "workspace" ? l("工作区", "Workspace") : l("个人", "User");
}

function buildCredentialSecretKindLabel(secretKind: CredentialDetail["secretKind"]) {
  switch (secretKind) {
    case "api-key":
      return l("API Key", "API Key");
    case "access-token":
      return l("Access Token", "Access Token");
    case "oauth-token":
      return l("OAuth Token", "OAuth Token");
    case "json-file":
      return l("JSON 文件", "JSON file");
    case "browser-storage-state":
      return l("浏览器状态", "Browser state");
    case "session-cookie":
      return l("会话 Cookie", "Session cookie");
    default:
      return l(secretKind, secretKind);
  }
}

function buildMcpSourceLabel(source: McpRegistryEntry["source"]) {
  switch (source) {
    case "first-party":
      return l("第一方", "First-party");
    case "workspace-managed":
      return l("工作区", "Workspace");
    case "third-party":
    default:
      return l("第三方", "Third-party");
  }
}

function buildMcpRiskLabel(riskLevel: McpRegistryEntry["riskLevel"]) {
  switch (riskLevel) {
    case "low":
      return l("低", "Low");
    case "medium":
      return l("中", "Medium");
    case "high":
      return l("高", "High");
    case "critical":
      return l("关键", "Critical");
    default:
      return l(riskLevel, riskLevel);
  }
}

function buildWorkspaceRoleLabel(role: WorkspaceRole) {
  switch (role) {
    case "owner":
      return l("所有者", "Owner");
    case "admin":
      return l("管理员", "Admin");
    case "creator":
      return l("创作者", "Creator");
    case "operator":
      return l("操作员", "Operator");
    case "viewer":
    default:
      return l("查看者", "Viewer");
  }
}

function formatUsd(value: number) {
  return value.toFixed(2);
}

function compareCredentials(left: CredentialDetail, right: CredentialDetail) {
  const leftPriority = left.status === "active" ? 0 : left.status === "needs-rotation" ? 1 : 2;
  const rightPriority = right.status === "active" ? 0 : right.status === "needs-rotation" ? 1 : 2;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftScopePriority = left.scope === "workspace" ? 0 : 1;
  const rightScopePriority = right.scope === "workspace" ? 0 : 1;
  if (leftScopePriority !== rightScopePriority) {
    return leftScopePriority - rightScopePriority;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareMcps(
  left: McpRegistryEntry,
  right: McpRegistryEntry,
  bindingCountByMcpId: Map<string, number>
) {
  const leftBindingCount = bindingCountByMcpId.get(left.mcpId) ?? 0;
  const rightBindingCount = bindingCountByMcpId.get(right.mcpId) ?? 0;
  if (leftBindingCount !== rightBindingCount) {
    return rightBindingCount - leftBindingCount;
  }

  const leftPriority =
    left.source === "first-party" ? 0 : left.source === "workspace-managed" ? 1 : 2;
  const rightPriority =
    right.source === "first-party" ? 0 : right.source === "workspace-managed" ? 1 : 2;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

export class MeService {
  #listRunSnapshots(actor: MeActorContext) {
    return runsService.listRuns(
      {},
      {
        workspaceId: actor.workspaceId,
        workspaceContextKey: actor.workspaceContextKey,
      }
    );
  }

  #collectNotices(actor: MeActorContext): MeNotice[] {
    return collectRunNoticeRecords(this.#listRunSnapshots(actor), actor).map((notice) =>
      meNoticeSchema.parse({
        noticeId: notice.noticeId,
        workspaceId: notice.workspaceId,
        workspaceContextKey: notice.workspaceContextKey,
        type: notice.type,
        tone: notice.tone,
        title: notice.title,
        summary: notice.summary,
        occurredAt: notice.occurredAt,
        target: notice.target,
      })
    );
  }

  #collectAssets(actor: MeActorContext): MeAssetRecord[] {
    const assets: MeAssetRecord[] = [];

    for (const snapshot of this.#listRunSnapshots(actor)) {
      const indexedFiles = runFileIndexService.list(snapshot.run.runId);
      const sourceFiles: CollectedAssetSource[] =
        indexedFiles.length > 0
          ? indexedFiles.map((file) => ({
              path: file.path,
              name: file.name,
              kind: file.kind,
              sizeBytes: file.sizeBytes,
              updatedAt: file.updatedAt,
              previewMode: file.previewMode,
              previewable: file.previewable,
              downloadable: file.downloadable,
            }))
          : snapshot.files.map((file) => {
              const previewMode = inferRunFilePreviewMode(
                file.path,
                guessRunFileMimeType(file.path)
              );
              return {
                path: file.path,
                name: file.name,
                kind: file.kind,
                sizeBytes: file.sizeBytes,
                updatedAt: file.updatedAt,
                previewMode,
                previewable:
                  previewMode === "text" || previewMode === "image" || previewMode === "pdf",
                downloadable: !isDirectoryPath(file.path),
              };
            });

      const seenPaths = new Set<string>();
      for (const file of sourceFiles) {
        if (seenPaths.has(file.path) || isDirectoryPath(file.path)) {
          continue;
        }

        seenPaths.add(file.path);
        const assetKind = inferAssetKind(file);
        if (!assetKind) {
          continue;
        }

        assets.push(
          meAssetRecordSchema.parse({
            assetId: buildAssetId(snapshot.run.runId, file.path),
            workspaceId: actor.workspaceId,
            workspaceContextKey: actor.workspaceContextKey,
            runId: snapshot.run.runId,
            runTitle: toLocalizedRunTitle(snapshot.run.title),
            title: file.name,
            filePath: file.path,
            fileKind: file.kind,
            assetKind,
            previewMode: file.previewMode,
            previewAvailable: file.previewable,
            downloadable: file.downloadable,
            sizeBytes: file.sizeBytes,
            updatedAt: file.updatedAt,
            sourceSummary: buildSourceSummary(snapshot),
            target: {
              resource: "run",
              runId: snapshot.run.runId,
              view: "files",
              anchorType: "file",
              anchorRefId: file.path,
            },
          })
        );
      }
    }

    return assets.sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.runId.localeCompare(left.runId) ||
        left.filePath.localeCompare(right.filePath)
    );
  }

  #collectFavoriteWorkshops(actor: MeActorContext): MeFavoriteWorkshopRecord[] {
    const visibleWorkshopById = new Map(
      workshopCatalogRepository
        .listWorkshops()
        .filter(
          (item) =>
            item.status === "active" &&
            item.visibleInContexts.includes(actor.workspaceContextKey)
        )
        .map((item) => [item.workshopId, item] as const)
    );

    return meFavoritesRepository
      .listFavoriteWorkshops(actor.userId, actor.workspaceContextKey)
      .map((record) => {
        const workshop = visibleWorkshopById.get(record.workshopId);
        if (!workshop) {
          return null;
        }

        return meFavoriteWorkshopRecordSchema.parse({
          favoriteId: record.favoriteId,
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          workshopId: workshop.workshopId,
          title: workshop.displayName,
          ownerLabel: workshop.ownerLabel,
          badge: workshop.badge,
          summary: workshop.summary,
          coverAssetUrl: workshop.coverAssetUrl,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          target: {
            resource: "workshop",
            workshopId: workshop.workshopId,
            view: "detail",
          },
        });
      })
      .filter((item): item is MeFavoriteWorkshopRecord => item != null)
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.workshopId.localeCompare(right.workshopId)
      );
  }

  #buildRecentActivityFromWorkshop(
    actor: MeActorContext,
    record: StoredRecentActivityRecord
  ): MeRecentActivityRecord | null {
    const workshop = workshopCatalogRepository.getWorkshopById(record.resourceId);
    if (
      !workshop ||
      workshop.status !== "active" ||
      !workshop.visibleInContexts.includes(actor.workspaceContextKey)
    ) {
      return null;
    }

    return meRecentActivityRecordSchema.parse({
      activityId: record.activityId,
      workspaceId: actor.workspaceId,
      workspaceContextKey: actor.workspaceContextKey,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      interaction: record.interaction,
      sourceSurface: record.sourceSurface,
      title: workshop.displayName,
      summary: workshop.summary,
      badge: workshop.badge,
      tone: "active",
      workshopId: workshop.workshopId,
      serviceId: null,
      runId: null,
      lastAccessedAt: record.updatedAt,
      target: {
        resource: "workshop",
        workshopId: workshop.workshopId,
        view: "detail",
      },
    });
  }

  #buildRecentActivityFromService(
    actor: MeActorContext,
    record: StoredRecentActivityRecord
  ): MeRecentActivityRecord | null {
    const service = workshopCatalogRepository.getServiceById(record.resourceId);
    if (
      !service ||
      service.status !== "active" ||
      !service.visibleInContexts.includes(actor.workspaceContextKey)
    ) {
      return null;
    }

    return meRecentActivityRecordSchema.parse({
      activityId: record.activityId,
      workspaceId: actor.workspaceId,
      workspaceContextKey: actor.workspaceContextKey,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      interaction: record.interaction,
      sourceSurface: record.sourceSurface,
      title: service.displayName,
      summary: service.summary,
      badge: service.authRequirementText,
      tone: "active",
      workshopId: service.workshopId,
      serviceId: service.serviceId,
      runId: null,
      lastAccessedAt: record.updatedAt,
      target: {
        resource: "service",
        serviceId: service.serviceId,
        view: "detail",
      },
    });
  }

  #buildRecentActivityFromRun(
    actor: MeActorContext,
    record: StoredRecentActivityRecord,
    snapshotsByRunId: Map<string, RunSnapshot>
  ): MeRecentActivityRecord | null {
    const snapshot = snapshotsByRunId.get(record.resourceId);
    if (!snapshot) {
      return null;
    }

    return meRecentActivityRecordSchema.parse({
      activityId: record.activityId,
      workspaceId: actor.workspaceId,
      workspaceContextKey: actor.workspaceContextKey,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      interaction: record.interaction,
      sourceSurface: record.sourceSurface,
      title: toLocalizedRunTitle(snapshot.run.title),
      summary: snapshot.run.statusReason
        ? l(snapshot.run.statusReason, snapshot.run.statusReason)
        : buildSourceSummary(snapshot),
      badge: buildRunStatusLabel(snapshot.run.status),
      tone: buildRunRecentTone(snapshot.run.status),
      workshopId: snapshot.run.catalogMetadata?.workshopId ?? null,
      serviceId: snapshot.run.catalogMetadata?.serviceId ?? null,
      runId: snapshot.run.runId,
      lastAccessedAt: record.updatedAt,
      target: {
        resource: "run",
        runId: snapshot.run.runId,
        view: "detail",
      },
    });
  }

  #collectRecentActivities(
    actor: MeActorContext,
    query: ListMeRecentActivitiesQuery
  ): MeRecentActivityRecord[] {
    const snapshotsByRunId = new Map(
      this.#listRunSnapshots(actor).map((snapshot) => [snapshot.run.runId, snapshot] as const)
    );

    return meRecentActivitiesRepository
      .listRecentActivities(actor.userId, actor.workspaceContextKey, query.types)
      .map((record) => {
        switch (record.resourceType) {
          case "workshop":
            return this.#buildRecentActivityFromWorkshop(actor, record);
          case "service":
            return this.#buildRecentActivityFromService(actor, record);
          case "run":
            return this.#buildRecentActivityFromRun(actor, record, snapshotsByRunId);
          default:
            return null;
        }
      })
      .filter((item): item is MeRecentActivityRecord => item != null)
      .sort(
        (left, right) =>
          right.lastAccessedAt.localeCompare(left.lastAccessedAt) ||
          left.resourceType.localeCompare(right.resourceType) ||
          left.resourceId.localeCompare(right.resourceId)
      );
  }

  #buildAuthorizationEntries(actor: MeActorContext): MeAuthorizationRecord[] {
    const entries: MeAuthorizationRecord[] = [
      meAuthorizationRecordSchema.parse({
        authorizationId: `me-account-${actor.userId}`,
        category: "account",
        provider: "auth",
        title: l("当前账号", "Current account"),
        summary: l(
          `${actor.user.displayName} / ${actor.user.email}`,
          `${actor.user.displayName} / ${actor.user.email}`
        ),
        statusLabel: l("已登录", "Signed in"),
        tone: "success",
        updatedAt: actor.user.updatedAt,
      }),
      meAuthorizationRecordSchema.parse({
        authorizationId: `me-workspace-${actor.workspaceId}`,
        category: "workspace",
        provider: "workspace",
        title: l("当前工作区角色", "Current workspace role"),
        summary: l(
          `${actor.currentWorkspace.name} / ${actor.currentWorkspace.root}`,
          `${actor.currentWorkspace.name} / ${actor.currentWorkspace.root}`
        ),
        statusLabel: buildWorkspaceRoleLabel(actor.role),
        tone: "active",
        updatedAt: actor.currentWorkspace.updatedAt,
      }),
    ];

    const credentials = credentialsService
      .listVisibleCredentials(
        {
          workspaceId: actor.workspaceId,
          userId: actor.userId,
          role: actor.role,
        },
        {}
      )
      .sort(compareCredentials);

    for (const credential of credentials) {
      const scopeLabel = buildCredentialScopeLabel(credential.scope);
      const secretKindLabel = buildCredentialSecretKindLabel(credential.secretKind);
      entries.push(
        meAuthorizationRecordSchema.parse({
          authorizationId: `me-credential-${credential.credentialId}`,
          category: "credential",
          provider: credential.provider,
          title: l(credential.displayName, credential.displayName),
          summary: l(
            `${credential.provider} / ${scopeLabel.zh} / ${secretKindLabel.zh}`,
            `${credential.provider} / ${scopeLabel.en} / ${secretKindLabel.en}`
          ),
          statusLabel: buildCredentialStatusLabel(credential.status),
          tone: buildCredentialTone(credential.status),
          updatedAt: credential.updatedAt,
        })
      );
    }

    const bindings = mcpService.listBindings(
      {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        role: actor.role,
      },
      {
        status: "active",
      }
    );
    const bindingCountByMcpId = new Map<string, number>();
    for (const binding of bindings) {
      bindingCountByMcpId.set(
        binding.mcpId,
        (bindingCountByMcpId.get(binding.mcpId) ?? 0) + 1
      );
    }

    const mcps = mcpService
      .listMcps(
        {
          workspaceId: actor.workspaceId,
        },
        {
          status: "active",
        }
      )
      .sort((left, right) => compareMcps(left, right, bindingCountByMcpId));

    for (const mcp of mcps) {
      const sourceLabel = buildMcpSourceLabel(mcp.source);
      const riskLabel = buildMcpRiskLabel(mcp.riskLevel);
      const bindingCount = bindingCountByMcpId.get(mcp.mcpId) ?? 0;
      entries.push(
        meAuthorizationRecordSchema.parse({
          authorizationId: `me-mcp-${mcp.mcpId}`,
          category: "mcp",
          provider: mcp.mcpId,
          title: l(mcp.displayName, mcp.displayName),
          summary: l(
            `${sourceLabel.zh} / ${mcp.transport} / 风险 ${riskLabel.zh}${bindingCount > 0 ? ` / 绑定 ${bindingCount}` : ""}`,
            `${sourceLabel.en} / ${mcp.transport} / risk ${riskLabel.en}${bindingCount > 0 ? ` / bound ${bindingCount}` : ""}`
          ),
          statusLabel:
            bindingCount > 0 ? l(`已绑定 ${bindingCount}`, `Bound ${bindingCount}`) : l("待绑定", "Unbound"),
          tone: bindingCount > 0 ? "success" : "warn",
          updatedAt: mcp.updatedAt,
        })
      );
    }

    if (canViewGovernance(actor.role)) {
      const quotaSnapshot = quotaService.getScopedSnapshot({
        workspaceId: actor.workspaceId,
        workspaceContextKey: actor.workspaceContextKey,
      });
      const pendingOverrides = quotaSnapshot.overrides.filter(
        (item) => item.status === "pending"
      );
      const alertEvents = quotaSnapshot.events.filter(
        (item) => item.decision === "blocked" || item.decision === "approval_pending"
      );
      const quotaTone =
        pendingOverrides.length > 0 || alertEvents.length > 0
          ? ("warn" as const)
          : quotaSnapshot.policies.length > 0
            ? ("success" as const)
            : ("active" as const);
      entries.push(
        meAuthorizationRecordSchema.parse({
          authorizationId: `me-quota-${actor.workspaceId}`,
          category: "quota",
          provider: "quota",
          title: l("容量与审批", "Capacity and approvals"),
          summary: l(
            `策略 ${quotaSnapshot.policies.length} / 放行 ${pendingOverrides.length} / 告警 ${alertEvents.length}`,
            `Policies ${quotaSnapshot.policies.length} / approvals ${pendingOverrides.length} / alerts ${alertEvents.length}`
          ),
          statusLabel:
            pendingOverrides.length > 0
              ? l(`${pendingOverrides.length} 待处理`, `${pendingOverrides.length} pending`)
              : quotaSnapshot.policies.length > 0
                ? l("已同步", "Synced")
                : l("未配置", "Not configured"),
          tone: quotaTone,
          updatedAt: latestIso([
            ...quotaSnapshot.policies.map((item) => item.updatedAt),
            ...quotaSnapshot.overrides.map((item) => item.updatedAt),
            ...quotaSnapshot.events.map((item) => item.occurredAt),
          ]),
        })
      );

      const billingSummary = billingService.getSummary(
        {
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          role: actor.role,
          userId: actor.userId,
        },
        {
          workspaceContextKey: actor.workspaceContextKey,
        }
      );
      entries.push(
        meAuthorizationRecordSchema.parse({
          authorizationId: `me-billing-${actor.workspaceId}`,
          category: "billing",
          provider: "billing",
          title: l("计费账本", "Billing ledger"),
          summary: l(
            `账目 ${billingSummary.totalEntriesCount} / 累计 USD ${formatUsd(billingSummary.totalAmountUsd)}`,
            `Entries ${billingSummary.totalEntriesCount} / total USD ${formatUsd(billingSummary.totalAmountUsd)}`
          ),
          statusLabel:
            billingSummary.totalEntriesCount > 0 ? l("已归集", "Recorded") : l("暂无账目", "No entries"),
          tone: billingSummary.totalEntriesCount > 0 ? "success" : "active",
          updatedAt: billingSummary.updatedAt,
        })
      );
    } else {
      entries.push(
        meAuthorizationRecordSchema.parse({
          authorizationId: `me-quota-limited-${actor.workspaceId}`,
          category: "quota",
          provider: "quota",
          title: l("容量与审批", "Capacity and approvals"),
          summary: l(
            "当前角色不可查看额度治理明细。",
            "Your current role cannot view quota governance details."
          ),
          statusLabel: l("受角色限制", "Role limited"),
          tone: "active",
          updatedAt: actor.currentWorkspace.updatedAt,
        }),
        meAuthorizationRecordSchema.parse({
          authorizationId: `me-billing-limited-${actor.workspaceId}`,
          category: "billing",
          provider: "billing",
          title: l("计费账本", "Billing ledger"),
          summary: l(
            "当前角色不可查看计费治理汇总。",
            "Your current role cannot view billing governance summaries."
          ),
          statusLabel: l("受角色限制", "Role limited"),
          tone: "active",
          updatedAt: actor.currentWorkspace.updatedAt,
        })
      );
    }

    return entries;
  }

  getProfileSummary(actor: MeActorContext): MeProfileSummary {
    const workspaceProfile = authService.getWorkspaceProfileSummary(actor.userId, actor.workspaceId);
    const assets = this.#collectAssets(actor);
    const favoriteWorkshops = this.#collectFavoriteWorkshops(actor);
    const pendingActionsCount = this.#listRunSnapshots(actor).filter(
      (snapshot) =>
        snapshot.run.status !== "SUCCEEDED" && snapshot.run.status !== "CANCELLED"
    ).length;

    return meProfileSummarySchema.parse({
      user: actor.user,
      currentWorkspace: actor.currentWorkspace,
      metrics: workspaceProfile.metrics,
      profileMetrics: {
        totalAssetsCount: assets.length,
        receiptAssetsCount: assets.filter((item) => item.assetKind === "receipt").length,
        visibleWorkshopsCount: workspaceProfile.metrics.visibleWorkshopsCount,
        favoriteWorkshopsCount: favoriteWorkshops.length,
        pendingActionsCount,
      },
      updatedAt: latestIso([
        workspaceProfile.updatedAt,
        workspaceProfile.workspace.updatedAt,
        ...assets.map((item) => item.updatedAt),
        ...favoriteWorkshops.map((item) => item.updatedAt),
      ]) ?? new Date().toISOString(),
    });
  }

  listRecentActivities(
    actor: MeActorContext,
    query: ListMeRecentActivitiesQuery = {}
  ): MeRecentActivityListResponse {
    const parsed = listMeRecentActivitiesQuerySchema.parse(query);
    const items = this.#collectRecentActivities(actor, parsed);

    return meRecentActivityListResponseSchema.parse({
      totalCount: items.length,
      updatedAt: items[0]?.lastAccessedAt ?? null,
      items: items.slice(0, parsed.limit ?? DEFAULT_RECENT_LIMIT),
    });
  }

  async recordRecentActivity(
    actor: MeActorContext,
    input: RecordMeRecentActivityInput
  ): Promise<MeRecentActivityRecord> {
    const parsed = recordMeRecentActivityInputSchema.parse(input);
    const now = new Date().toISOString();

    switch (parsed.resourceType) {
      case "workshop": {
        const workshop = workshopCatalogRepository.getWorkshopById(parsed.workshopId);
        if (
          !workshop ||
          workshop.status !== "active" ||
          !workshop.visibleInContexts.includes(actor.workspaceContextKey)
        ) {
          throw new AppError(
            404,
            "ME_RECENT_RESOURCE_NOT_FOUND",
            `Workshop not found: ${parsed.workshopId}`
          );
        }

        const stored = await meRecentActivitiesRepository.saveRecentActivity({
          activityId: buildRecentActivityId(
            actor.userId,
            actor.workspaceContextKey,
            parsed.resourceType,
            parsed.workshopId
          ),
          userId: actor.userId,
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          resourceType: parsed.resourceType,
          resourceId: parsed.workshopId,
          interaction: parsed.interaction,
          sourceSurface: parsed.sourceSurface,
          workshopId: parsed.workshopId,
          serviceId: null,
          runId: null,
          createdAt: now,
          updatedAt: now,
        });

        return this.#buildRecentActivityFromWorkshop(actor, stored) ?? (() => {
          throw new AppError(
            404,
            "ME_RECENT_RESOURCE_NOT_FOUND",
            `Workshop not found: ${parsed.workshopId}`
          );
        })();
      }
      case "service": {
        const service = workshopCatalogRepository.getServiceById(parsed.serviceId);
        if (
          !service ||
          service.status !== "active" ||
          !service.visibleInContexts.includes(actor.workspaceContextKey)
        ) {
          throw new AppError(
            404,
            "ME_RECENT_RESOURCE_NOT_FOUND",
            `Service not found: ${parsed.serviceId}`
          );
        }

        const stored = await meRecentActivitiesRepository.saveRecentActivity({
          activityId: buildRecentActivityId(
            actor.userId,
            actor.workspaceContextKey,
            parsed.resourceType,
            parsed.serviceId
          ),
          userId: actor.userId,
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          resourceType: parsed.resourceType,
          resourceId: parsed.serviceId,
          interaction: parsed.interaction,
          sourceSurface: parsed.sourceSurface,
          workshopId: service.workshopId,
          serviceId: parsed.serviceId,
          runId: null,
          createdAt: now,
          updatedAt: now,
        });

        return this.#buildRecentActivityFromService(actor, stored) ?? (() => {
          throw new AppError(
            404,
            "ME_RECENT_RESOURCE_NOT_FOUND",
            `Service not found: ${parsed.serviceId}`
          );
        })();
      }
      case "run": {
        const snapshot = this.#listRunSnapshots(actor).find(
          (item) => item.run.runId === parsed.runId
        );
        if (!snapshot) {
          throw new AppError(
            404,
            "ME_RECENT_RESOURCE_NOT_FOUND",
            `Run not found: ${parsed.runId}`
          );
        }

        const stored = await meRecentActivitiesRepository.saveRecentActivity({
          activityId: buildRecentActivityId(
            actor.userId,
            actor.workspaceContextKey,
            parsed.resourceType,
            parsed.runId
          ),
          userId: actor.userId,
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          resourceType: parsed.resourceType,
          resourceId: parsed.runId,
          interaction: parsed.interaction,
          sourceSurface: parsed.sourceSurface,
          workshopId: snapshot.run.catalogMetadata?.workshopId ?? null,
          serviceId: snapshot.run.catalogMetadata?.serviceId ?? null,
          runId: parsed.runId,
          createdAt: now,
          updatedAt: now,
        });

        return (
          this.#buildRecentActivityFromRun(
            actor,
            stored,
            new Map([[snapshot.run.runId, snapshot]])
          ) ?? (() => {
            throw new AppError(
              404,
              "ME_RECENT_RESOURCE_NOT_FOUND",
              `Run not found: ${parsed.runId}`
            );
          })()
        );
      }
      default:
        throw new AppError(400, "ME_RECENT_RESOURCE_INVALID", "Unsupported recent resource.");
    }
  }

  listFavoriteWorkshops(
    actor: MeActorContext,
    query: ListMeFavoriteWorkshopsQuery = {}
  ): MeFavoriteWorkshopListResponse {
    const parsed = listMeFavoriteWorkshopsQuerySchema.parse(query);
    const items = this.#collectFavoriteWorkshops(actor);

    return meFavoriteWorkshopListResponseSchema.parse({
      totalCount: items.length,
      updatedAt: items[0]?.updatedAt ?? null,
      items: items.slice(0, parsed.limit ?? DEFAULT_FAVORITES_LIMIT),
    });
  }

  async setFavoriteWorkshop(
    actor: MeActorContext,
    workshopId: string,
    input: SetMeFavoriteWorkshopInput
  ): Promise<SetMeFavoriteWorkshopResult> {
    const parsed = setMeFavoriteWorkshopInputSchema.parse(input);
    if (!parsed.favorited) {
      await meFavoritesRepository.deleteFavoriteWorkshop(
        actor.userId,
        actor.workspaceContextKey,
        workshopId
      );

      return setMeFavoriteWorkshopResultSchema.parse({
        favorited: false,
        favorite: null,
      });
    }

    const workshop = workshopCatalogRepository.getWorkshopById(workshopId);
    if (
      !workshop ||
      workshop.status !== "active" ||
      !workshop.visibleInContexts.includes(actor.workspaceContextKey)
    ) {
      throw new AppError(
        404,
        "WORKSHOP_NOT_FOUND",
        `Workshop not found: ${workshopId}`
      );
    }

    const existing = meFavoritesRepository.getFavoriteWorkshop(
      actor.userId,
      actor.workspaceContextKey,
      workshopId
    );
    const now = new Date().toISOString();
    await meFavoritesRepository.saveFavoriteWorkshop({
      favoriteId:
        existing?.favoriteId ??
        buildFavoriteId(actor.userId, actor.workspaceContextKey, workshopId),
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      workspaceContextKey: actor.workspaceContextKey,
      workshopId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    return setMeFavoriteWorkshopResultSchema.parse({
      favorited: true,
      favorite:
        this.#collectFavoriteWorkshops(actor).find(
          (item) => item.workshopId === workshopId
        ) ?? null,
    });
  }

  listAssets(
    actor: MeActorContext,
    query: ListMeAssetsQuery = {}
  ): MeAssetListResponse {
    const parsed = listMeAssetsQuerySchema.parse(query);
    const assets = this.#collectAssets(actor).filter((item) =>
      parsed.kind ? item.assetKind === parsed.kind : true
    );
    const counts = new Map<MeAssetKind, number>(ASSET_KIND_ORDER.map((kind) => [kind, 0]));

    for (const asset of assets) {
      counts.set(asset.assetKind, (counts.get(asset.assetKind) ?? 0) + 1);
    }

    return meAssetListResponseSchema.parse({
      totalCount: assets.length,
      updatedAt: assets[0]?.updatedAt ?? null,
      byKind: ASSET_KIND_ORDER.map((kind) => ({
        kind,
        count: counts.get(kind) ?? 0,
      })),
      items: assets.slice(0, parsed.limit ?? DEFAULT_ASSET_LIMIT),
    });
  }

  getAuthorizationSummary(
    actor: MeActorContext,
    query: ListMeAuthorizationsQuery = {}
  ): MeAuthorizationSummary {
    const parsed = listMeAuthorizationsQuerySchema.parse(query);
    const entries = this.#buildAuthorizationEntries(actor);

    return meAuthorizationSummarySchema.parse({
      totalCount: entries.length,
      attentionCount: entries.filter((item) => item.tone === "warn" || item.tone === "danger").length,
      updatedAt: latestIso(entries.map((item) => item.updatedAt)),
      entries: entries.slice(0, parsed.limit ?? DEFAULT_AUTHORIZATION_LIMIT),
    });
  }

  listNotices(
    actor: MeActorContext,
    query: ListMeNoticesQuery = {}
  ): MeNotice[] {
    const parsed = listMeNoticesQuerySchema.parse(query);
    const notices = this.#collectNotices(actor);

    return notices.slice(0, parsed.limit ?? DEFAULT_NOTICE_LIMIT);
  }

  getNoticeSummary(actor: MeActorContext): MeNoticeSummary {
    const notices = this.#collectNotices(actor);
    const counts = new Map<MeNoticeType, number>(
      NOTICE_TYPE_ORDER.map((type) => [type, 0])
    );

    for (const notice of notices) {
      counts.set(notice.type, (counts.get(notice.type) ?? 0) + 1);
    }

    return meNoticeSummarySchema.parse({
      totalCount: notices.length,
      latestOccurredAt: notices[0]?.occurredAt ?? null,
      byType: NOTICE_TYPE_ORDER.map((type) => ({
        type,
        count: counts.get(type) ?? 0,
      })),
    });
  }
}

export async function initializeMeInfrastructure() {
  await Promise.all([
    meFavoritesRepository.init(),
    meRecentActivitiesRepository.init(),
  ]);
}

export const meService = new MeService();
