import { createHash, randomUUID } from "node:crypto";
import {
  adminExecuteActionInputSchema,
  adminImpactOperationSchema,
  adminImpactRequestSchema,
  adminListQuerySchema,
  adminResourceStateSchema,
  adminSettingRecordSchema,
  type AdminAction,
  type AdminExecuteActionInput,
  type AdminImpactRequest,
  type AdminListQuery,
  type AdminResourceStatus,
  type AdminResourceType,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { buildApiReadinessReport } from "../../app/ops.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { buildInternalRuntimeDiagnosticsReport } from "../../app/runtime-diagnostics.js";
import { authRepository } from "../auth/repository.js";
import { billingRepository } from "../billing/repository.js";
import { bridgeRegistry } from "../bridge/registry.js";
import { creatorRepository } from "../creator/repository.js";
import { credentialAuditRepository } from "../credentials/audit-repository.js";
import { credentialMaterializationRepository } from "../credentials/materialization-repository.js";
import { credentialsRepository } from "../credentials/repository.js";
import { credentialsService } from "../credentials/service.js";
import { mcpCallAuditRepository } from "../mcp/call-audit-repository.js";
import { mcpGovernanceAuditRepository } from "../mcp/governance-audit-repository.js";
import { mcpRepository } from "../mcp/repository.js";
import { providersRepository } from "../providers/repository.js";
import { providersService } from "../providers/service.js";
import { quotaRepository } from "../quotas/repository.js";
import { quotaService } from "../quotas/service.js";
import { runFileLifecycleManager } from "../runs/file-lifecycle.js";
import { runsRepository } from "../runs/repository.js";
import { runsService } from "../runs/service.js";
import { sessionCaptureRepository } from "../session-captures/repository.js";
import { sessionArchiveRepository } from "../sessions/repository.js";
import { sessionCatalogService } from "../sessions/service.js";
import { uploadRepository } from "../uploads/repository.js";
import { workshopCatalogRepository } from "../workshops/repository.js";
import { adminRepository } from "./repository.js";

type AdminActor = {
  user: {
    userId: string;
    email: string;
    displayName: string;
  };
  session: {
    sessionId: string;
  };
  currentWorkspace: {
    workspaceId: string;
    contextKey: string;
    role: "owner" | "admin" | "operator" | "creator" | "viewer";
  };
};

type RequestMetadata = {
  requestId?: string | null;
  traceId?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
  clientRelease?: string | null;
};

type JsonRecord = Record<string, unknown>;

const activeRunStatuses = new Set([
  "CREATED",
  "STARTING",
  "RUNNING",
  "WAITING_INPUT",
  "WAITING_APPROVAL",
  "CANCELLING",
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeQuery(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function matchesQuery(value: unknown, query: string) {
  if (!query) {
    return true;
  }

  return JSON.stringify(value).toLowerCase().includes(query);
}

function paginate<T>(items: T[], query: AdminListQuery) {
  const start = (query.page - 1) * query.pageSize;
  return {
    items: items.slice(start, start + query.pageSize),
    pageInfo: {
      page: query.page,
      pageSize: query.pageSize,
      total: items.length,
      pageCount: Math.max(1, Math.ceil(items.length / query.pageSize)),
      hasPreviousPage: query.page > 1,
      hasNextPage: start + query.pageSize < items.length,
    },
  };
}

function stateStatus(resourceType: AdminResourceType, resourceId: string, fallback = "active") {
  return adminRepository.getResourceState(resourceType, resourceId)?.status ?? fallback;
}

function toPublicCredential(record: ReturnType<typeof credentialsRepository.list>[number]) {
  return {
    credentialId: record.credentialId,
    workspaceId: record.workspaceId,
    ownerUserId: record.ownerUserId,
    scope: record.scope,
    displayName: record.displayName,
    provider: record.provider,
    secretKind: record.secretKind,
    mountMode: record.mountMode,
    status: record.status,
    brokerKind: record.brokerKind,
    activeKeyId: record.activeKeyId,
    secretVersion: record.secretVersion,
    redactedSecretRef: record.redactedSecretRef,
    envName: record.envName,
    mountPathTemplate: record.mountPathTemplate,
    expiresAt: record.expiresAt,
    rotationDueAt: record.rotationDueAt,
    lastRotatedAt: record.lastRotatedAt,
    lastMaterializedAt: record.lastMaterializedAt,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function safeConfigSummary() {
  const config = getApiRuntimeConfig();
  return {
    authMode: config.authMode,
    authStore: config.authStore,
    runsStore: config.runsStore,
    workshopCatalogStore: config.workshopCatalogStore,
    sessionArchivesStore: config.sessionArchivesStore,
    credentialsStore: config.credentialsStore,
    mcpStore: config.mcpStore,
    quotaStore: config.quotaStore,
    billingStore: config.billingStore,
    objectStorageDriver: config.objectStorageDriver,
    fileScanMode: config.fileScanMode,
    sessionPackSignatureEnabled: config.sessionPackSignatureEnabled,
    credentialBrokerProvider: config.credentialBrokerProvider,
    uploadMaxBytes: config.uploadMaxBytes,
    platformAdminCount: config.platformAdminEmails.length,
  };
}

function operationConfirmation(action: AdminAction, resourceId: string) {
  return `${action.toUpperCase()} ${resourceId}`;
}

function hashImpact(impact: JsonRecord) {
  return createHash("sha256").update(JSON.stringify(impact), "utf8").digest("hex");
}

function actionStatus(action: AdminAction): AdminResourceStatus | null {
  switch (action) {
    case "suspend":
      return "suspended";
    case "resume":
    case "restore":
    case "list":
    case "release":
    case "enable":
      return "active";
    case "unlist":
      return "hidden";
    case "archive":
      return "archived";
    case "quarantine":
      return "quarantined";
    case "disable":
      return "disabled";
    case "revoke":
      return "revoked";
    case "drain":
      return "draining";
    case "delete":
      return "deleted";
    default:
      return null;
  }
}

export class AdminService {
  async init() {
    await adminRepository.init();
  }

  async recordMutation(
    actor: AdminActor,
    input: {
      action: string;
      resourceType: AdminResourceType;
      resourceId: string;
      workspaceId?: string | null;
      reason: string;
      before?: JsonRecord | null;
      after?: JsonRecord | null;
    },
    metadata: RequestMetadata = {}
  ) {
    return adminRepository.appendAuditEvent({
      eventId: `ade_${randomUUID().replace(/-/g, "")}`,
      actorUserId: actor.user.userId,
      actorEmail: actor.user.email,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      workspaceId: input.workspaceId ?? null,
      reason: input.reason,
      before: input.before ?? null,
      after: input.after ?? null,
      outcome: "success",
      requestId: metadata.requestId ?? null,
      traceId: metadata.traceId ?? null,
      operationId: null,
      errorCode: null,
      errorMessage: null,
      sourceIp: metadata.sourceIp ?? null,
      userAgent: metadata.userAgent ?? null,
      clientRelease: metadata.clientRelease ?? null,
      occurredAt: nowIso(),
    });
  }

  async getOverview() {
    const [readiness, runtime, sessionPacks] = await Promise.all([
      buildApiReadinessReport(),
      buildInternalRuntimeDiagnosticsReport({ includeBridgeControlProbes: false }),
      sessionCatalogService.listSessionPacks({}),
    ]);
    const users = authRepository.listUsers();
    const workspaces = authRepository.listWorkspaces();
    const workshops = workshopCatalogRepository.listWorkshops();
    const runs = runsService.listRuns();
    const providers = providersRepository.listProviders();
    const mcps = mcpRepository.listRegistry();
    const credentials = credentialsRepository.list();
    const billing = billingRepository.listEntries();
    const activeRuns = runs.filter((item) => activeRunStatuses.has(item.run.status));
    const failedRuns = runs.filter((item) => item.run.status === "FAILED");
    const providerIssues = providers.filter(
      (item) => item.enabled && item.lastHealthcheck?.status !== "healthy"
    );
    const mcpIssues = mcps.filter((item) => {
      const snapshot = mcpRepository.getLatestHealthSnapshot({ mcpId: item.mcpId });
      return item.status === "active" && snapshot?.status !== "healthy";
    });
    const expiringCredentials = credentials.filter((item) => {
      const deadline = item.expiresAt ?? item.rotationDueAt;
      if (!deadline) {
        return false;
      }
      return new Date(deadline).getTime() <= Date.now() + 14 * 24 * 60 * 60 * 1000;
    });

    return {
      generatedAt: nowIso(),
      health: {
        status: readiness.status,
        api: readiness,
        runtime,
      },
      metrics: {
        users: users.length,
        suspendedUsers: users.filter((item) => adminRepository.isSuspended("user", item.userId)).length,
        workspaces: workspaces.length,
        suspendedWorkspaces: workspaces.filter((item) =>
          adminRepository.isSuspended("workspace", item.workspaceId)
        ).length,
        workshops: workshops.length,
        publishedWorkshops: workshops.filter((item) => item.status === "active").length,
        sessions: sessionPacks.length,
        quarantinedSessions: sessionPacks.filter(
          (item) => stateStatus("session", item.sessionVersionId) === "quarantined"
        ).length,
        runs: runs.length,
        activeRuns: activeRuns.length,
        failedRuns: failedRuns.length,
        providers: providers.length,
        providerIssues: providerIssues.length,
        mcps: mcps.length,
        mcpIssues: mcpIssues.length,
        credentials: credentials.length,
        expiringCredentials: expiringCredentials.length,
        monthlyCostUsd: billing.reduce((sum, item) => sum + item.amountUsd, 0),
      },
      anomalies: [
        ...failedRuns.slice(0, 8).map((item) => ({
          severity: "high",
          resourceType: "run",
          resourceId: item.run.runId,
          title: item.run.title,
          detail: item.run.statusReason ?? "Run failed",
          occurredAt: item.run.updatedAt,
        })),
        ...providerIssues.slice(0, 5).map((item) => ({
          severity: "high",
          resourceType: "provider",
          resourceId: item.providerId,
          title: item.displayName,
          detail: item.lastHealthcheck?.errorMessage ?? item.lastHealthcheck?.status ?? "Not checked",
          occurredAt: item.lastHealthcheck?.checkedAt ?? item.updatedAt,
        })),
        ...mcpIssues.slice(0, 5).map((item) => ({
          severity: "medium",
          resourceType: "mcp",
          resourceId: item.mcpId,
          title: item.displayName,
          detail: mcpRepository.getLatestHealthSnapshot({ mcpId: item.mcpId })?.detail ?? "Not checked",
          occurredAt:
            mcpRepository.getLatestHealthSnapshot({ mcpId: item.mcpId })?.probedAt ?? item.updatedAt,
        })),
      ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
      recentAdminEvents: adminRepository.listAuditEvents().slice(0, 12),
    };
  }

  listUsers(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const runs = runsService.listRuns();
    const entries = billingRepository.listEntries();
    const items = authRepository
      .listUsers()
      .map((user) => {
        const memberships = authRepository.listMembershipsByUser(user.userId);
        const sessions = authRepository.listSessions().filter((item) => item.userId === user.userId);
        const userRuns = runs.filter((item) => item.run.requestedByUserId === user.userId);
        const userEntries = entries.filter((item) => item.requestedByUserId === user.userId);
        const status = stateStatus("user", user.userId);
        return {
          userId: user.userId,
          email: user.email,
          displayName: user.displayName,
          status,
          isPlatformAdmin: getApiRuntimeConfig().platformAdminEmails.includes(user.email),
          workspaceCount: memberships.length,
          activeSessionCount: sessions.filter((item) => !item.revokedAt).length,
          runCount: userRuns.length,
          monthlyCostUsd: userEntries.reduce((sum, item) => sum + item.amountUsd, 0),
          lastLoginAt: sessions.map((item) => item.createdAt).sort().at(-1) ?? null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      })
      .filter((item) => (!query.status || item.status === query.status) && matchesQuery(item, q))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return paginate(items, query);
  }

  getUser(userId: string) {
    const user = authRepository.getUserById(userId);
    if (!user) {
      throw new AppError(404, "ADMIN_USER_NOT_FOUND", `User not found: ${userId}`);
    }
    const memberships = authRepository.listMembershipsByUser(userId);
    const sessions = authRepository.listSessions().filter((item) => item.userId === userId);
    const runs = runsService.listRuns().filter((item) => item.run.requestedByUserId === userId);
    return {
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        status: stateStatus("user", user.userId),
        isPlatformAdmin: getApiRuntimeConfig().platformAdminEmails.includes(user.email),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      memberships,
      sessions: sessions.map((item) => ({
        sessionId: item.sessionId,
        currentWorkspaceId: item.currentWorkspaceId,
        accessTokenExpiresAt: item.accessTokenExpiresAt,
        refreshTokenExpiresAt: item.refreshTokenExpiresAt,
        revokedAt: item.revokedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      runs,
      billing: billingRepository.listEntries().filter((item) => item.requestedByUserId === userId),
      audit: adminRepository
        .listAuditEvents()
        .filter((item) => item.resourceType === "user" && item.resourceId === userId),
    };
  }

  listWorkspaces(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const runs = runsService.listRuns();
    const items = authRepository
      .listWorkspaces()
      .map((workspace) => {
        const members = authRepository.listMembershipsByWorkspace(workspace.workspaceId);
        const workspaceRuns = runs.filter((item) => item.run.workspaceId === workspace.workspaceId);
        const ledger = billingRepository
          .listEntries()
          .filter((item) => item.workspaceId === workspace.workspaceId);
        return {
          ...workspace,
          status: stateStatus("workspace", workspace.workspaceId),
          memberCount: members.length,
          activeRunCount: workspaceRuns.filter((item) => activeRunStatuses.has(item.run.status)).length,
          totalRunCount: workspaceRuns.length,
          costUsd: ledger.reduce((sum, item) => sum + item.amountUsd, 0),
          quotaPolicyCount: quotaRepository
            .listPolicies()
            .filter((item) => item.workspaceId === workspace.workspaceId).length,
        };
      })
      .filter((item) => (!query.status || item.status === query.status) && matchesQuery(item, q))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return paginate(items, query);
  }

  getWorkspace(workspaceId: string) {
    const workspace = authRepository.getWorkspaceById(workspaceId);
    if (!workspace) {
      throw new AppError(404, "ADMIN_WORKSPACE_NOT_FOUND", `Workspace not found: ${workspaceId}`);
    }
    return {
      workspace: {
        ...workspace,
        status: stateStatus("workspace", workspaceId),
      },
      members: authRepository.listMembershipsByWorkspace(workspaceId).map((item) => ({
        user: {
          userId: item.user.userId,
          email: item.user.email,
          displayName: item.user.displayName,
        },
        membership: item.membership,
      })),
      runs: runsService.listRuns().filter((item) => item.run.workspaceId === workspaceId),
      credentials: credentialsRepository
        .list()
        .filter((item) => item.workspaceId === workspaceId)
        .map(toPublicCredential),
      mcpBindings: mcpRepository.listBindings().filter((item) => item.workspaceId === workspaceId),
      quota: quotaService.getScopedSnapshot({ workspaceId }),
      billing: billingRepository.listEntries().filter((item) => item.workspaceId === workspaceId),
      audit: adminRepository
        .listAuditEvents()
        .filter((item) => item.workspaceId === workspaceId || item.resourceId === workspaceId),
    };
  }

  listWorkshops(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const services = workshopCatalogRepository.listServices();
    const runs = runsService.listRuns();
    const packages = creatorRepository.listPackages();
    const items = workshopCatalogRepository
      .listWorkshops()
      .map((workshop) => ({
        ...workshop,
        governanceStatus: stateStatus("workshop", workshop.workshopId, workshop.status),
        serviceCount: services.filter((item) => item.workshopId === workshop.workshopId).length,
        packageCount: packages.filter((item) => item.linkedWorkshopIds.includes(workshop.workshopId)).length,
        runCount: runs.filter(
          (item) => item.run.catalogMetadata?.workshopId === workshop.workshopId
        ).length,
      }))
      .filter(
        (item) =>
          (!query.status || item.governanceStatus === query.status || item.status === query.status) &&
          matchesQuery(item, q)
      );
    return paginate(items, query);
  }

  getWorkshop(workshopId: string) {
    const workshop = workshopCatalogRepository.getWorkshopById(workshopId);
    if (!workshop) {
      throw new AppError(404, "ADMIN_WORKSHOP_NOT_FOUND", `Workshop not found: ${workshopId}`);
    }
    const services = workshopCatalogRepository
      .listServices()
      .filter((item) => item.workshopId === workshopId);
    const packages = creatorRepository
      .listPackages()
      .filter((item) => item.linkedWorkshopIds.includes(workshopId));
    return {
      workshop: {
        ...workshop,
        governanceStatus: stateStatus("workshop", workshopId, workshop.status),
      },
      services,
      packages,
      releases: creatorRepository
        .listReleases()
        .filter((item) => packages.some((pkg) => pkg.packageId === item.packageId)),
      runs: runsService
        .listRuns()
        .filter((item) => item.run.catalogMetadata?.workshopId === workshopId),
      audit: adminRepository
        .listAuditEvents()
        .filter((item) => item.resourceType === "workshop" && item.resourceId === workshopId),
    };
  }

  async listSessions(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const sessions = await sessionCatalogService.listSessionPacks({});
    const items = sessions
      .map((item) => ({
        ...item,
        governanceStatus: stateStatus("session", item.sessionVersionId),
      }))
      .filter(
        (item) =>
          (!query.status || item.governanceStatus === query.status) && matchesQuery(item, q)
      );
    return paginate(items, query);
  }

  async getSession(sessionVersionId: string) {
    const [session, lineage] = await Promise.all([
      sessionCatalogService.getSessionPack(sessionVersionId),
      sessionCatalogService.getSessionPackLineage(sessionVersionId),
    ]);
    return {
      session: {
        ...session,
        governanceStatus: stateStatus("session", sessionVersionId),
      },
      lineage,
      importedArchive: sessionArchiveRepository.getImportedArchiveBySessionVersionId(sessionVersionId),
      runs: runsService
        .listRuns()
        .filter((item) => item.run.sessionVersionId === sessionVersionId),
      audit: adminRepository
        .listAuditEvents()
        .filter((item) => item.resourceType === "session" && item.resourceId === sessionVersionId),
    };
  }

  listRuns(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const items = (["ACTIVE", "ARCHIVED", "DELETION_PENDING", "DELETED"] as const)
      .flatMap((recordStatus) => runsService.listRuns({ recordStatus }))
      .map((item) => ({
        ...item,
        governanceStatus: stateStatus("run", item.run.runId, item.run.status),
        fileCount: item.files.length,
        artifactCount: item.artifacts.length,
        approvalCount: item.approvals.length,
      }))
      .filter(
        (item) =>
          (!query.status || item.run.status === query.status || item.lifecycle.recordStatus === query.status || item.lifecycle.runtimeStatus === query.status) &&
          (!query.workspaceId || item.run.workspaceId === query.workspaceId) &&
          matchesQuery(item, q)
      )
      .sort((left, right) => right.run.updatedAt.localeCompare(left.run.updatedAt));
    return paginate(items, query);
  }

  getRun(runId: string) {
    const snapshot = runsService.getRunIncludingDeleted(runId);
    const aggregate = runsRepository.get(runId);
    return {
      ...snapshot,
      governanceStatus: stateStatus("run", runId, snapshot.run.status),
      events: aggregate ? [] : [],
      mcpCalls: mcpCallAuditRepository.list().filter((item) => item.runId === runId),
      billing: billingRepository.listEntries().filter((item) => item.runId === runId),
      audit: adminRepository
        .listAuditEvents()
        .filter((item) => item.resourceType === "run" && item.resourceId === runId),
    };
  }

  async getRuntime() {
    const [readiness, diagnostics] = await Promise.all([
      buildApiReadinessReport(),
      buildInternalRuntimeDiagnosticsReport({ includeBridgeControlProbes: true }),
    ]);
    return {
      readiness,
      diagnostics,
      bridgeConnections: bridgeRegistry.getDiagnostics().connections,
      fileLifecycle: runFileLifecycleManager.getDiagnostics(),
      governance: adminRepository
        .listResourceStates()
        .filter((item) => item.resourceType === "runtime"),
    };
  }

  listProviders(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const bindings = providersRepository.listBindings();
    const items = providersRepository
      .listProviders()
      .map((item) => ({
        ...item,
        governanceStatus: stateStatus(
          "provider",
          item.providerId,
          item.enabled ? "active" : "disabled"
        ),
        bindingCount: bindings.filter((binding) => binding.providerId === item.providerId).length,
      }))
      .filter(
        (item) =>
          (!query.status || item.governanceStatus === query.status) && matchesQuery(item, q)
      );
    return paginate(items, query);
  }

  getProvider(providerId: string) {
    const provider = providersService.getProvider(providerId);
    return {
      provider: {
        ...provider,
        governanceStatus: stateStatus(
          "provider",
          providerId,
          provider.enabled ? "active" : "disabled"
        ),
      },
      bindings: providersRepository
        .listBindings()
        .filter((item) => item.providerId === providerId),
      runs: runsService
        .listRuns()
        .filter((item) => item.provider?.providerId === providerId),
      audit: adminRepository
        .listAuditEvents()
        .filter((item) => item.resourceType === "provider" && item.resourceId === providerId),
    };
  }

  listMcps(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const bindings = mcpRepository.listBindings();
    const calls = mcpCallAuditRepository.list();
    const items = mcpRepository
      .listRegistry()
      .map((item) => ({
        ...item,
        governanceStatus: stateStatus("mcp", item.mcpId, item.status),
        bindingCount: bindings.filter((binding) => binding.mcpId === item.mcpId).length,
        callCount: calls.filter((call) => call.mcpId === item.mcpId).length,
        latestHealth: mcpRepository.getLatestHealthSnapshot({ mcpId: item.mcpId }),
      }))
      .filter(
        (item) =>
          (!query.status || item.governanceStatus === query.status) &&
          (!query.workspaceId || item.workspaceId === query.workspaceId) &&
          matchesQuery(item, q)
      );
    return paginate(items, query);
  }

  getMcp(mcpId: string) {
    const mcp = mcpRepository.getRegistryEntry(mcpId);
    if (!mcp) {
      throw new AppError(404, "ADMIN_MCP_NOT_FOUND", `MCP not found: ${mcpId}`);
    }
    const bindingIds = new Set(
      mcpRepository.listBindings().filter((item) => item.mcpId === mcpId).map((item) => item.bindingId)
    );
    return {
      mcp: {
        ...mcp,
        governanceStatus: stateStatus("mcp", mcpId, mcp.status),
      },
      bindings: mcpRepository.listBindings().filter((item) => item.mcpId === mcpId),
      networkPolicies: mcpRepository.listNetworkPolicies(),
      health: mcpRepository.listHealthSnapshots().filter((item) => item.mcpId === mcpId),
      calls: mcpCallAuditRepository.list().filter((item) => item.mcpId === mcpId),
      governanceEvents: mcpGovernanceAuditRepository
        .list()
        .filter((item) => item.mcpId === mcpId || (item.bindingId && bindingIds.has(item.bindingId))),
      audit: adminRepository
        .listAuditEvents()
        .filter((item) => item.resourceType === "mcp" && item.resourceId === mcpId),
    };
  }

  listCredentials(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const items = credentialsRepository
      .list()
      .map((item) => ({
        ...toPublicCredential(item),
        governanceStatus: stateStatus("credential", item.credentialId, item.status),
        materializationCount: credentialMaterializationRepository
          .list()
          .filter((lease) => lease.credentialIds.includes(item.credentialId)).length,
      }))
      .filter(
        (item) =>
          (!query.status || item.status === query.status || item.governanceStatus === query.status) &&
          (!query.workspaceId || item.workspaceId === query.workspaceId) &&
          matchesQuery(item, q)
      );
    return paginate(items, query);
  }

  getCredential(credentialId: string) {
    const record = credentialsRepository.getById(credentialId);
    if (!record) {
      throw new AppError(
        404,
        "ADMIN_CREDENTIAL_NOT_FOUND",
        `Credential not found: ${credentialId}`
      );
    }
    return {
      credential: {
        ...toPublicCredential(record),
        governanceStatus: stateStatus("credential", credentialId, record.status),
      },
      bindings: mcpRepository
        .listBindings()
        .filter((item) => item.credentialId === credentialId),
      materializations: credentialMaterializationRepository
        .list()
        .filter((item) => item.credentialIds.includes(credentialId)),
      credentialAudit: credentialAuditRepository
        .list()
        .filter((item) => item.credentialId === credentialId),
      adminAudit: adminRepository
        .listAuditEvents()
        .filter(
          (item) => item.resourceType === "credential" && item.resourceId === credentialId
        ),
    };
  }

  listQuotas(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const items = quotaRepository
      .listPolicies()
      .map((policy) => ({
        ...policy,
        counters: quotaRepository.listCounters().filter((item) => item.policyId === policy.policyId),
        overrides: quotaRepository.listOverrides().filter((item) => item.policyId === policy.policyId),
      }))
      .filter(
        (item) =>
          (!query.status || item.status === query.status) &&
          (!query.workspaceId || item.workspaceId === query.workspaceId) &&
          matchesQuery(item, q)
      );
    return paginate(items, query);
  }

  listLedger(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const items = billingRepository
      .listEntries()
      .filter(
        (item) =>
          (!query.workspaceId || item.workspaceId === query.workspaceId) &&
          (!query.from || item.occurredAt >= query.from) &&
          (!query.to || item.occurredAt <= query.to) &&
          matchesQuery(item, q)
      );
    return {
      ...paginate(items, query),
      summary: {
        currency: "USD",
        totalAmountUsd: items.reduce((sum, item) => sum + item.amountUsd, 0),
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        totalEntries: items.length,
      },
    };
  }

  listAudit(rawQuery: unknown) {
    const query = adminListQuerySchema.parse(rawQuery ?? {});
    const q = normalizeQuery(query.q);
    const adminEvents = adminRepository.listAuditEvents().map((item) => ({
      source: "admin",
      ...item,
    }));
    const credentialEvents = credentialAuditRepository.list().map((item) => ({
      source: "credential",
      eventId: item.eventId,
      action: item.action,
      resourceType: "credential",
      resourceId: item.credentialId,
      workspaceId: item.workspaceId,
      actorUserId: item.actorUserId,
      outcome: item.outcome,
      occurredAt: item.occurredAt,
      detail: item,
    }));
    const mcpEvents = mcpGovernanceAuditRepository.list().map((item) => ({
      source: "mcp",
      eventId: item.eventId,
      action: item.action,
      resourceType: "mcp",
      resourceId: item.mcpId ?? item.bindingId ?? "unknown",
      workspaceId: item.workspaceId,
      actorUserId: item.actorUserId,
      outcome: item.outcome,
      occurredAt: item.occurredAt,
      detail: item,
    }));
    const items = [...adminEvents, ...credentialEvents, ...mcpEvents]
      .filter(
        (item) =>
          (!query.status || item.outcome === query.status) &&
          (!query.workspaceId || item.workspaceId === query.workspaceId) &&
          (!query.from || item.occurredAt >= query.from) &&
          (!query.to || item.occurredAt <= query.to) &&
          matchesQuery(item, q)
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    return paginate(items, query);
  }

  getAuditEvent(eventId: string) {
    const result = this.listAudit({ q: eventId, page: 1, pageSize: 200 });
    const event = result.items.find((item) => item.eventId === eventId);
    if (!event) {
      throw new AppError(404, "ADMIN_AUDIT_EVENT_NOT_FOUND", `Audit event not found: ${eventId}`);
    }
    return event;
  }

  async getSystem() {
    const [readiness, runtime] = await Promise.all([
      buildApiReadinessReport(),
      buildInternalRuntimeDiagnosticsReport({ includeBridgeControlProbes: false }),
    ]);
    const config = getApiRuntimeConfig();
    return {
      readiness,
      runtime,
      configuration: safeConfigSummary(),
      settings: adminRepository.listSettings(),
      featureFlags: adminRepository.getSetting("feature-flags")?.value ?? {},
      retention: adminRepository.getSetting("retention")?.value ?? {},
      notifications: adminRepository.getSetting("notifications")?.value ?? {},
      adminAccounts: config.platformAdminEmails.map((email) => {
        const user = authRepository.findUserByEmail(email);
        return {
          email,
          userId: user?.userId ?? null,
          displayName: user?.displayName ?? email,
          status: user ? stateStatus("admin-account", user.userId) : "unregistered",
          mfa: "not_configured",
          lastLoginAt: user
            ? authRepository
                .listSessions()
                .filter((item) => item.userId === user.userId)
                .map((item) => item.createdAt)
                .sort()
                .at(-1) ?? null
            : null,
        };
      }),
      release: process.env.LINGBAN_RELEASE ?? process.env.npm_package_version ?? "development",
      checkedAt: nowIso(),
    };
  }

  async search(queryText: string) {
    const q = normalizeQuery(queryText);
    if (!q) {
      return [];
    }
    const [sessions] = await Promise.all([sessionCatalogService.listSessionPacks({ q })]);
    const results = [
      ...authRepository.listUsers().map((item) => ({
        resourceType: "user",
        resourceId: item.userId,
        title: item.displayName,
        subtitle: item.email,
        route: `/accounts/users/${encodeURIComponent(item.userId)}`,
        search: item,
      })),
      ...authRepository.listWorkspaces().map((item) => ({
        resourceType: "workspace",
        resourceId: item.workspaceId,
        title: item.name,
        subtitle: item.type,
        route: `/accounts/workspaces/${encodeURIComponent(item.workspaceId)}`,
        search: item,
      })),
      ...workshopCatalogRepository.listWorkshops().map((item) => ({
        resourceType: "workshop",
        resourceId: item.workshopId,
        title: item.displayName.zh,
        subtitle: item.displayName.en,
        route: `/catalog/workshops/${encodeURIComponent(item.workshopId)}`,
        search: item,
      })),
      ...sessions.map((item) => ({
        resourceType: "session",
        resourceId: item.sessionVersionId,
        title: item.displayName.zh,
        subtitle: item.displayName.en,
        route: `/catalog/sessions/${encodeURIComponent(item.sessionVersionId)}`,
        search: item,
      })),
      ...runsService.listRuns().map((item) => ({
        resourceType: "run",
        resourceId: item.run.runId,
        title: item.run.title,
        subtitle: item.run.status,
        route: `/runs/${encodeURIComponent(item.run.runId)}`,
        search: item,
      })),
      ...providersRepository.listProviders().map((item) => ({
        resourceType: "provider",
        resourceId: item.providerId,
        title: item.displayName,
        subtitle: item.baseUrl,
        route: `/providers/${encodeURIComponent(item.providerId)}`,
        search: item,
      })),
      ...mcpRepository.listRegistry().map((item) => ({
        resourceType: "mcp",
        resourceId: item.mcpId,
        title: item.displayName,
        subtitle: item.transport,
        route: `/integrations/mcps/${encodeURIComponent(item.mcpId)}`,
        search: item,
      })),
    ];

    return results
      .filter((item) => matchesQuery(item.search, q))
      .slice(0, 40)
      .map(({ search: _search, ...item }) => item);
  }

  async createImpact(actor: AdminActor, rawInput: AdminImpactRequest) {
    const input = adminImpactRequestSchema.parse(rawInput);
    const impact = await this.#buildImpact(input);
    const operation = adminImpactOperationSchema.parse({
      operationId: `aop_${randomUUID().replace(/-/g, "")}`,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.action,
      impactHash: hashImpact(impact),
      impact,
      confirmationPhrase: operationConfirmation(input.action, input.resourceId),
      requestedByUserId: actor.user.userId,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      consumedAt: null,
    });
    return await adminRepository.saveOperation(operation);
  }

  async executeAction(
    actor: AdminActor,
    rawInput: AdminExecuteActionInput,
    metadata: RequestMetadata = {}
  ) {
    const input = adminExecuteActionInputSchema.parse(rawInput);
    const operation = adminRepository.getOperation(input.operationId);
    if (!operation) {
      throw new AppError(404, "ADMIN_OPERATION_NOT_FOUND", "Admin operation was not found");
    }
    if (operation.consumedAt) {
      throw new AppError(409, "ADMIN_OPERATION_CONSUMED", "Admin operation has already been consumed");
    }
    if (new Date(operation.expiresAt).getTime() <= Date.now()) {
      throw new AppError(410, "ADMIN_OPERATION_EXPIRED", "Admin operation has expired");
    }
    if (operation.impactHash !== input.impactHash) {
      throw new AppError(409, "IMPACT_CHANGED", "Admin operation impact hash does not match");
    }
    if (operation.confirmationPhrase !== input.confirmation) {
      throw new AppError(400, "ADMIN_CONFIRMATION_INVALID", "Confirmation phrase does not match");
    }
    const currentState = adminRepository.getResourceState(
      operation.resourceType,
      operation.resourceId
    );
    if (input.expectedVersion && currentState?.version !== input.expectedVersion) {
      throw new AppError(409, "VERSION_CONFLICT", "Resource governance version has changed");
    }

    const before = (await this.#buildImpact({
      resourceType: operation.resourceType,
      resourceId: operation.resourceId,
      action: operation.action,
    })) as JsonRecord;

    try {
      const result = await this.#applyAction(actor, operation, input.reason);
      const consumedAt = nowIso();
      await adminRepository.saveOperation({ ...operation, consumedAt });
      await adminRepository.appendAuditEvent({
        eventId: `ade_${randomUUID().replace(/-/g, "")}`,
        actorUserId: actor.user.userId,
        actorEmail: actor.user.email,
        action: operation.action,
        resourceType: operation.resourceType,
        resourceId: operation.resourceId,
        workspaceId:
          typeof before.workspaceId === "string" ? before.workspaceId : actor.currentWorkspace.workspaceId,
        reason: input.reason,
        before,
        after: result as JsonRecord,
        outcome: "success",
        requestId: metadata.requestId ?? null,
        traceId: metadata.traceId ?? null,
        operationId: operation.operationId,
        errorCode: null,
        errorMessage: null,
        sourceIp: metadata.sourceIp ?? null,
        userAgent: metadata.userAgent ?? null,
        clientRelease: metadata.clientRelease ?? null,
        occurredAt: consumedAt,
      });
      return {
        operationId: operation.operationId,
        auditStatus: "persisted",
        result,
      };
    } catch (error) {
      await adminRepository.appendAuditEvent({
        eventId: `ade_${randomUUID().replace(/-/g, "")}`,
        actorUserId: actor.user.userId,
        actorEmail: actor.user.email,
        action: operation.action,
        resourceType: operation.resourceType,
        resourceId: operation.resourceId,
        workspaceId: actor.currentWorkspace.workspaceId,
        reason: input.reason,
        before,
        after: null,
        outcome: "failed",
        requestId: metadata.requestId ?? null,
        traceId: metadata.traceId ?? null,
        operationId: operation.operationId,
        errorCode: error instanceof AppError ? error.code : "ADMIN_OPERATION_FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        sourceIp: metadata.sourceIp ?? null,
        userAgent: metadata.userAgent ?? null,
        clientRelease: metadata.clientRelease ?? null,
        occurredAt: nowIso(),
      });
      throw error;
    }
  }

  async saveSetting(
    actor: AdminActor,
    key: string,
    value: JsonRecord,
    expectedVersion: number | null,
    reason: string,
    metadata: RequestMetadata = {}
  ) {
    const current = adminRepository.getSetting(key);
    if (expectedVersion && current?.version !== expectedVersion) {
      throw new AppError(409, "VERSION_CONFLICT", `Admin setting version changed: ${key}`);
    }
    const record = adminSettingRecordSchema.parse({
      key,
      value,
      version: (current?.version ?? 0) + 1,
      updatedByUserId: actor.user.userId,
      updatedAt: nowIso(),
    });
    const saved = await adminRepository.saveSetting(record);
    await adminRepository.appendAuditEvent({
      eventId: `ade_${randomUUID().replace(/-/g, "")}`,
      actorUserId: actor.user.userId,
      actorEmail: actor.user.email,
      action: "update",
      resourceType: "system",
      resourceId: key,
      workspaceId: null,
      reason,
      before: current?.value ?? null,
      after: saved.value,
      outcome: "success",
      requestId: metadata.requestId ?? null,
      traceId: metadata.traceId ?? null,
      operationId: null,
      errorCode: null,
      errorMessage: null,
      sourceIp: metadata.sourceIp ?? null,
      userAgent: metadata.userAgent ?? null,
      clientRelease: metadata.clientRelease ?? null,
      occurredAt: saved.updatedAt,
    });
    return saved;
  }

  async #buildImpact(input: AdminImpactRequest): Promise<JsonRecord> {
    const currentState = adminRepository.getResourceState(input.resourceType, input.resourceId);
    switch (input.resourceType) {
      case "user": {
        const user = authRepository.getUserById(input.resourceId);
        if (!user) throw new AppError(404, "ADMIN_USER_NOT_FOUND", `User not found: ${input.resourceId}`);
        const memberships = authRepository.listMembershipsByUser(user.userId);
        return {
          resourceName: user.displayName,
          workspaceId: memberships[0]?.workspace.workspaceId ?? null,
          currentStatus: currentState?.status ?? "active",
          targetStatus: actionStatus(input.action),
          activeSessions: authRepository
            .listSessions()
            .filter((item) => item.userId === user.userId && !item.revokedAt).length,
          activeRuns: runsService
            .listRuns()
            .filter(
              (item) =>
                item.run.requestedByUserId === user.userId && activeRunStatuses.has(item.run.status)
            ).length,
          workspaces: memberships.map((item) => item.workspace.workspaceId),
          version: currentState?.version ?? 0,
        };
      }
      case "workspace": {
        const workspace = authRepository.getWorkspaceById(input.resourceId);
        if (!workspace) {
          throw new AppError(404, "ADMIN_WORKSPACE_NOT_FOUND", `Workspace not found: ${input.resourceId}`);
        }
        return {
          resourceName: workspace.name,
          workspaceId: workspace.workspaceId,
          currentStatus: currentState?.status ?? "active",
          targetStatus: actionStatus(input.action),
          members: authRepository.listMembershipsByWorkspace(workspace.workspaceId).length,
          activeRuns: runsService
            .listRuns()
            .filter(
              (item) =>
                item.run.workspaceId === workspace.workspaceId && activeRunStatuses.has(item.run.status)
            ).length,
          credentials: credentialsRepository
            .list()
            .filter((item) => item.workspaceId === workspace.workspaceId).length,
          version: currentState?.version ?? 0,
        };
      }
      case "workshop": {
        const workshop = workshopCatalogRepository.getWorkshopById(input.resourceId);
        if (!workshop) {
          throw new AppError(404, "ADMIN_WORKSHOP_NOT_FOUND", `Workshop not found: ${input.resourceId}`);
        }
        return {
          resourceName: workshop.displayName.zh,
          currentStatus: currentState?.status ?? workshop.status,
          targetStatus: actionStatus(input.action),
          services: workshopCatalogRepository
            .listServices()
            .filter((item) => item.workshopId === workshop.workshopId).length,
          activeRuns: runsService
            .listRuns()
            .filter(
              (item) =>
                item.run.catalogMetadata?.workshopId === workshop.workshopId &&
                activeRunStatuses.has(item.run.status)
            ).length,
          version: currentState?.version ?? 0,
        };
      }
      case "session": {
        const session = await sessionCatalogService.getSessionPack(input.resourceId);
        return {
          resourceName: session.displayName.zh,
          currentStatus: currentState?.status ?? "active",
          targetStatus: actionStatus(input.action),
          linkedServices: session.linkedServiceIds,
          activeRuns: runsService
            .listRuns()
            .filter(
              (item) =>
                item.run.sessionVersionId === session.sessionVersionId &&
                activeRunStatuses.has(item.run.status)
            ).length,
          version: currentState?.version ?? 0,
        };
      }
      case "run": {
        const run = runsService.getRunIncludingDeleted(input.resourceId);
        const sessionCaptures = await sessionCaptureRepository.listByRunId(input.resourceId);
        const uploads = uploadRepository.listUploadsByRun(input.resourceId);
        const downloadTickets = uploadRepository
          .listDownloadTickets()
          .filter((item) => item.runId === input.resourceId);
        return {
          resourceName: run.run.title,
          workspaceId: run.run.workspaceId,
          currentStatus: run.run.status,
          targetStatus:
            input.action === "cancel" || input.action === "terminate"
              ? "CANCELLED"
              : input.action === "archive"
                ? "ARCHIVED"
                : input.action === "delete"
                  ? "DELETED"
                  : input.action === "restore"
                    ? "ACTIVE"
                    : run.lifecycle.runtimeStatus,
          runtimeStatus: run.lifecycle.runtimeStatus,
          recordStatus: run.lifecycle.recordStatus,
          files: run.files.length,
          artifacts: run.artifacts.length,
          pendingApprovals: run.approvals.filter((item) => item.state === "pending").length,
          deletionScope: {
            workspace: true,
            messages: run.messages.length,
            indexedFiles: run.files.length,
            uploads: uploads.length,
            downloadTickets: downloadTickets.length,
            agentEvents: true,
            realtimeEvents: true,
          },
          retainedScope: {
            sessionCaptures: sessionCaptures.length,
            billingEntries: billingRepository.listEntries().filter((item) => item.runId === input.resourceId).length,
            mcpCallAudits: mcpCallAuditRepository.list().filter((item) => item.runId === input.resourceId).length,
            runTombstone: true,
            adminAudit: true,
          },
          version: currentState?.version ?? 0,
        };
      }
      case "provider": {
        const provider = providersService.getProvider(input.resourceId);
        return {
          resourceName: provider.displayName,
          currentStatus: provider.enabled ? "active" : "disabled",
          targetStatus: actionStatus(input.action),
          models: provider.models.length,
          bindings: providersRepository
            .listBindings()
            .filter((item) => item.providerId === provider.providerId).length,
          activeRuns: runsService
            .listRuns()
            .filter(
              (item) =>
                item.provider?.providerId === provider.providerId && activeRunStatuses.has(item.run.status)
            ).length,
          version: currentState?.version ?? 0,
        };
      }
      case "mcp": {
        const mcp = mcpRepository.getRegistryEntry(input.resourceId);
        if (!mcp) throw new AppError(404, "ADMIN_MCP_NOT_FOUND", `MCP not found: ${input.resourceId}`);
        return {
          resourceName: mcp.displayName,
          workspaceId: mcp.workspaceId,
          currentStatus: mcp.status,
          targetStatus: actionStatus(input.action),
          bindings: mcpRepository.listBindings().filter((item) => item.mcpId === mcp.mcpId).length,
          recentCalls: mcpCallAuditRepository.list().filter((item) => item.mcpId === mcp.mcpId).length,
          version: currentState?.version ?? 0,
        };
      }
      case "credential": {
        const credential = credentialsRepository.getById(input.resourceId);
        if (!credential) {
          throw new AppError(404, "ADMIN_CREDENTIAL_NOT_FOUND", `Credential not found: ${input.resourceId}`);
        }
        return {
          resourceName: credential.displayName,
          workspaceId: credential.workspaceId,
          currentStatus: credential.status,
          targetStatus: actionStatus(input.action),
          bindings: mcpRepository
            .listBindings()
            .filter((item) => item.credentialId === credential.credentialId).length,
          materializations: credentialMaterializationRepository
            .list()
            .filter((item) => item.credentialIds.includes(credential.credentialId)).length,
          version: currentState?.version ?? 0,
        };
      }
      case "runtime":
      case "quota":
      case "system":
      case "admin-account":
      default:
        return {
          resourceName: input.resourceId,
          currentStatus: currentState?.status ?? "active",
          targetStatus: actionStatus(input.action),
          version: currentState?.version ?? 0,
        };
    }
  }

  async #saveGovernanceState(
    actor: AdminActor,
    resourceType: AdminResourceType,
    resourceId: string,
    status: AdminResourceStatus,
    reason: string
  ) {
    const current = adminRepository.getResourceState(resourceType, resourceId);
    return await adminRepository.saveResourceState(
      adminResourceStateSchema.parse({
        resourceType,
        resourceId,
        status,
        version: (current?.version ?? 0) + 1,
        reason,
        updatedByUserId: actor.user.userId,
        updatedAt: nowIso(),
      })
    );
  }

  async #applyAction(
    actor: AdminActor,
    operation: {
      resourceType: AdminResourceType;
      resourceId: string;
      action: AdminAction;
    },
    reason: string
  ): Promise<JsonRecord> {
    const targetStatus = actionStatus(operation.action);
    switch (operation.resourceType) {
      case "user": {
        const user = authRepository.getUserById(operation.resourceId);
        if (!user) throw new AppError(404, "ADMIN_USER_NOT_FOUND", `User not found: ${operation.resourceId}`);
        if (operation.action === "force-logout" || operation.action === "suspend") {
          const at = nowIso();
          await Promise.all(
            authRepository
              .listSessions()
              .filter((item) => item.userId === user.userId && !item.revokedAt)
              .map((item) => authRepository.updateSession({ ...item, revokedAt: at, updatedAt: at }))
          );
        }
        if (targetStatus) {
          const state = await this.#saveGovernanceState(
            actor,
            "user",
            user.userId,
            targetStatus,
            reason
          );
          return { ...state, revokedSessions: operation.action === "suspend" };
        }
        return { userId: user.userId, action: operation.action, completedAt: nowIso() };
      }
      case "workspace": {
        const workspace = authRepository.getWorkspaceById(operation.resourceId);
        if (!workspace) {
          throw new AppError(404, "ADMIN_WORKSPACE_NOT_FOUND", `Workspace not found: ${operation.resourceId}`);
        }
        if (!targetStatus) throw new AppError(400, "ADMIN_ACTION_UNSUPPORTED", "Unsupported workspace action");
        if (operation.action === "suspend") {
          const at = nowIso();
          await Promise.all(
            authRepository
              .listSessions()
              .filter((item) => item.currentWorkspaceId === workspace.workspaceId && !item.revokedAt)
              .map((item) => authRepository.updateSession({ ...item, revokedAt: at, updatedAt: at }))
          );
        }
        return await this.#saveGovernanceState(
          actor,
          "workspace",
          workspace.workspaceId,
          targetStatus,
          reason
        );
      }
      case "workshop": {
        const workshop = workshopCatalogRepository.getWorkshopById(operation.resourceId);
        if (!workshop) {
          throw new AppError(404, "ADMIN_WORKSHOP_NOT_FOUND", `Workshop not found: ${operation.resourceId}`);
        }
        const status =
          operation.action === "list" || operation.action === "release"
            ? "active"
            : operation.action === "archive"
              ? "archived"
              : "hidden";
        const saved = await workshopCatalogRepository.saveWorkshop({ ...workshop, status });
        await this.#saveGovernanceState(
          actor,
          "workshop",
          workshop.workshopId,
          status === "active" ? "active" : status,
          reason
        );
        return saved as unknown as JsonRecord;
      }
      case "session": {
        if (!targetStatus) throw new AppError(400, "ADMIN_ACTION_UNSUPPORTED", "Unsupported session action");
        return await this.#saveGovernanceState(
          actor,
          "session",
          operation.resourceId,
          targetStatus,
          reason
        );
      }
      case "run": {
        if (operation.action === "cancel") {
          return (await runsService.cancel(operation.resourceId, reason, {
            requestedByUserId: actor.user.userId,
          })) as unknown as JsonRecord;
        }
        if (operation.action === "terminate") {
          return (await runsService.forceTerminate(
            operation.resourceId,
            reason,
            actor.user.userId
          )) as unknown as JsonRecord;
        }
        if (operation.action === "reconcile") {
          return (await runsService.reconcileRuntime(operation.resourceId)) as unknown as JsonRecord;
        }
        if (operation.action === "archive") {
          return (await runsService.archiveRun(operation.resourceId, {
            requestedByUserId: actor.user.userId,
          })) as unknown as JsonRecord;
        }
        if (operation.action === "restore") {
          return (await runsService.restoreRun(operation.resourceId, {
            requestedByUserId: actor.user.userId,
          })) as unknown as JsonRecord;
        }
        if (operation.action === "delete") {
          return (await runsService.deleteRun(operation.resourceId, {
            reason,
            confirmation: operation.resourceId,
            requestedByUserId: actor.user.userId,
          })) as unknown as JsonRecord;
        }
        if (operation.action === "retry") {
          const aggregate = runsRepository.get(operation.resourceId);
          if (!aggregate) {
            throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${operation.resourceId}`);
          }
          return (await runsService.createRun({
            ...aggregate.input,
            requestedByUserId: actor.user.userId,
            title: `${aggregate.input.title} (retry)`,
          })) as unknown as JsonRecord;
        }
        throw new AppError(400, "ADMIN_ACTION_UNSUPPORTED", "Unsupported run action");
      }
      case "provider": {
        const enabled = operation.action === "enable" || operation.action === "resume";
        const result = await providersService.updateProvider(
          {
            workspaceId: actor.currentWorkspace.workspaceId,
            userId: actor.user.userId,
            role: actor.currentWorkspace.role,
            isPlatformAdmin: true,
          },
          operation.resourceId,
          { enabled }
        );
        await this.#saveGovernanceState(
          actor,
          "provider",
          operation.resourceId,
          enabled ? "active" : "disabled",
          reason
        );
        return result as unknown as JsonRecord;
      }
      case "mcp": {
        const mcp = mcpRepository.getRegistryEntry(operation.resourceId);
        if (!mcp) throw new AppError(404, "ADMIN_MCP_NOT_FOUND", `MCP not found: ${operation.resourceId}`);
        const enabled = operation.action === "enable" || operation.action === "release";
        const saved = await mcpRepository.saveRegistryEntry({
          ...mcp,
          status: enabled ? "active" : "disabled",
          updatedAt: nowIso(),
        });
        await this.#saveGovernanceState(
          actor,
          "mcp",
          operation.resourceId,
          operation.action === "quarantine" ? "quarantined" : enabled ? "active" : "disabled",
          reason
        );
        return saved as unknown as JsonRecord;
      }
      case "credential": {
        const credential = credentialsRepository.getById(operation.resourceId);
        if (!credential) {
          throw new AppError(404, "ADMIN_CREDENTIAL_NOT_FOUND", `Credential not found: ${operation.resourceId}`);
        }
        const status = operation.action === "revoke" ? "revoked" : "disabled";
        const result = credential.workspaceId
          ? await credentialsService.setCredentialLifecycleStatus(
              credential.credentialId,
              {
                workspaceId: credential.workspaceId,
                userId: actor.user.userId,
                role: "owner",
              },
              { status, note: reason }
            )
          : toPublicCredential(
              await credentialsRepository.save({
                ...credential,
                status,
                notes: reason,
                updatedAt: nowIso(),
              })
            );
        await this.#saveGovernanceState(
          actor,
          "credential",
          operation.resourceId,
          status,
          reason
        );
        return result as unknown as JsonRecord;
      }
      case "runtime": {
        if (!targetStatus) throw new AppError(400, "ADMIN_ACTION_UNSUPPORTED", "Unsupported runtime action");
        return await this.#saveGovernanceState(
          actor,
          "runtime",
          operation.resourceId,
          targetStatus,
          reason
        );
      }
      default:
        throw new AppError(
          400,
          "ADMIN_ACTION_UNSUPPORTED",
          `Unsupported action ${operation.action} for ${operation.resourceType}`
        );
    }
  }
}

export async function initializeAdminInfrastructure() {
  await adminService.init();
}

export const adminService = new AdminService();
