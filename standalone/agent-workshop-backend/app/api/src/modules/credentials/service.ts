import type { WorkspaceRole } from "@lingban/contracts";
import {
  credentialAuditEventSchema,
  credentialUsageResponseSchema,
  createCredentialInputSchema,
  credentialMaterializationLeaseSchema,
  credentialDetailSchema,
  listCredentialAuditEventsQuerySchema,
  listCredentialsQuerySchema,
  materializeRunCredentialsResponseSchema,
  rotateCredentialInputSchema,
  updateCredentialInputSchema,
  type CredentialAuditEvent,
  type CredentialAuditEventAction,
  type CreateCredentialInput,
  type CredentialMount,
  type CredentialDetail,
  type CredentialStatus,
  type CredentialUsageResponse,
  type ListCredentialAuditEventsQuery,
  type ListCredentialsQuery,
  type MaterializeRunCredentialsResponse,
  type RotateCredentialInput,
  type RunStatus,
  type UpdateCredentialInput,
} from "@lingban/contracts";
import {
  buildCredentialMount,
  inferCredentialMountMode,
  redactSecretRef,
  toCredentialEnvName,
} from "@lingban/credential";
import { matchesSearchQuery } from "@lingban/domain-models";
import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { mcpRepository } from "../mcp/repository.js";
import { runsRepository } from "../runs/repository.js";
import { credentialAuditRepository } from "./audit-repository.js";
import { getCredentialBroker, getCredentialBrokerForKind } from "./broker.js";
import { credentialLifecycleCallbackRepository } from "./callback-repository.js";
import { credentialLifecycleCallbackManager } from "./callback-manager.js";
import { credentialMaterializationRepository } from "./materialization-repository.js";
import { credentialsRepository } from "./repository.js";
import type {
  StoredCredentialAuditEvent,
  StoredCredentialMaterializationLease,
  StoredCredentialRecord,
} from "./storage-schema.js";

let credentialSequence = 1;
let credentialLeaseSequence = 1;
let credentialAuditEventSequence = 1;
let bootstrapped = false;
const TERMINAL_RUN_STATUSES = new Set<RunStatus>(["SUCCEEDED", "FAILED", "CANCELLED"]);

function nowIso() {
  return new Date().toISOString();
}

function parseCounter(value: string | undefined, prefix: string) {
  if (!value?.startsWith(prefix)) {
    return 0;
  }

  const parsed = Number.parseInt(value.slice(prefix.length), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureBootstrapped() {
  if (bootstrapped) {
    return;
  }

  let maxCredential = 0;
  let maxLease = 0;
  let maxAuditEvent = 0;
  for (const record of credentialsRepository.list()) {
    maxCredential = Math.max(maxCredential, parseCounter(record.credentialId, "cred_"));
  }
  for (const lease of credentialMaterializationRepository.list()) {
    maxLease = Math.max(maxLease, parseCounter(lease.leaseId, "lse_"));
  }
  for (const event of credentialAuditRepository.list()) {
    maxAuditEvent = Math.max(maxAuditEvent, parseCounter(event.eventId, "cdae_"));
  }

  credentialSequence = Math.max(credentialSequence, maxCredential + 1);
  credentialLeaseSequence = Math.max(credentialLeaseSequence, maxLease + 1);
  credentialAuditEventSequence = Math.max(credentialAuditEventSequence, maxAuditEvent + 1);
  bootstrapped = true;
}

function nextCredentialId() {
  ensureBootstrapped();
  return `cred_${String(credentialSequence++).padStart(8, "0")}`;
}

function nextCredentialLeaseId() {
  ensureBootstrapped();
  return `lse_${String(credentialLeaseSequence++).padStart(8, "0")}`;
}

function nextCredentialAuditEventId() {
  ensureBootstrapped();
  return `cdae_${String(credentialAuditEventSequence++).padStart(8, "0")}`;
}

function canManageWorkspaceScope(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

function canManageMcpAdjacentScope(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

function toPublicCredential(record: StoredCredentialRecord): CredentialDetail {
  return credentialDetailSchema.parse({
    credentialId: record.credentialId,
    workspaceId: record.workspaceId,
    ownerUserId: record.ownerUserId,
    scope: record.scope,
    displayName: record.displayName,
    provider: record.provider,
    secretKind: record.secretKind,
    mountMode: record.mountMode,
    status: deriveCredentialStatus(record),
    brokerKind: record.secretEnvelope?.brokerKind ?? null,
    activeKeyId: record.secretEnvelope?.keyId ?? record.activeKeyId ?? null,
    secretVersion: record.secretVersion,
    redactedSecretRef: record.redactedSecretRef ?? redactSecretRef(record.secretRef),
    expiresAt: record.expiresAt,
    lastRotatedAt: record.lastRotatedAt,
    lastMaterializedAt: record.lastMaterializedAt,
    rotationDueAt: record.rotationDueAt,
    notes: record.notes,
    envName: record.envName,
    mountPathTemplate: record.mountPathTemplate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function ensureCredentialVisible(
  record: StoredCredentialRecord,
  actor: { workspaceId: string; userId: string; role: WorkspaceRole }
) {
  if (record.workspaceId !== actor.workspaceId) {
    throw new AppError(403, "CREDENTIAL_ACCESS_DENIED", `Credential not visible: ${record.credentialId}`);
  }

  if (record.scope === "workspace") {
    return record;
  }

  if (
    record.ownerUserId === actor.userId ||
    actor.role === "owner" ||
    actor.role === "admin"
  ) {
    return record;
  }

  throw new AppError(403, "CREDENTIAL_ACCESS_DENIED", `Credential not visible: ${record.credentialId}`);
}

function ensureCredentialManageable(
  record: StoredCredentialRecord,
  actor: { workspaceId: string; userId: string; role: WorkspaceRole }
) {
  ensureCredentialVisible(record, actor);

  if (record.scope === "workspace" && !canManageWorkspaceScope(actor.role)) {
    throw new AppError(
      403,
      "CREDENTIAL_MANAGE_FORBIDDEN",
      `Role ${actor.role} cannot manage workspace credentials`
    );
  }

  if (record.scope === "user" && record.ownerUserId !== actor.userId && !canManageMcpAdjacentScope(actor.role)) {
    throw new AppError(
      403,
      "CREDENTIAL_MANAGE_FORBIDDEN",
      `Role ${actor.role} cannot manage this user credential`
    );
  }

  return record;
}

function normalizeMountFields(input: {
  credentialId: string;
  secretKind: StoredCredentialRecord["secretKind"];
  mountMode: StoredCredentialRecord["mountMode"];
  envName?: string | null;
  mountPathTemplate?: string | null;
}) {
  const mount = buildCredentialMount({
    credentialId: input.credentialId,
    secretKind: input.secretKind,
    mountMode: input.mountMode,
    envName: input.envName,
    mountPathTemplate: input.mountPathTemplate,
  });

  return {
    mountMode: mount.mode,
    envName: mount.mode === "env" ? mount.envName : null,
    mountPathTemplate: mount.mode === "file" ? mount.mountPath : null,
  };
}

function ensureCredentialActiveForRun(
  record: StoredCredentialRecord,
  requestedByUserId?: string | null,
  options: {
    allowDisabledForGrandfatheredRun?: boolean;
  } = {}
) {
  if (record.scope === "user") {
    if (!requestedByUserId) {
      throw new AppError(
        403,
        "RUN_CREDENTIAL_ACTOR_REQUIRED",
        `Credential ${record.credentialId} requires a user-scoped actor`
      );
    }

    if (record.ownerUserId !== requestedByUserId) {
      throw new AppError(
        403,
        "RUN_CREDENTIAL_SCOPE_DENIED",
        `Credential ${record.credentialId} is not owned by user ${requestedByUserId}`
      );
    }
  }

  const effectiveStatus = deriveCredentialStatus(record);
  if (effectiveStatus === "revoked") {
    throw new AppError(
      409,
      "RUN_CREDENTIAL_REVOKED",
      `Credential ${record.credentialId} has been revoked`
    );
  }

  if (effectiveStatus === "disabled") {
    if (options.allowDisabledForGrandfatheredRun && !isCredentialExpired(record)) {
      return;
    }

    if (isCredentialExpired(record)) {
      throw new AppError(
        409,
        "RUN_CREDENTIAL_EXPIRED",
        `Credential ${record.credentialId} has expired`
      );
    }

    throw new AppError(
      409,
      "RUN_CREDENTIAL_DISABLED",
      `Credential ${record.credentialId} is not active`
    );
  }
}

function canMaterializeGrandfatheredDisabledCredential(params: {
  record: StoredCredentialRecord;
  runId: string;
}) {
  if (params.record.status !== "disabled" || isCredentialExpired(params.record)) {
    return false;
  }

  const graceIssuedAtMs = parseIsoTimestamp(params.record.activeRunGraceIssuedAt);
  if (graceIssuedAtMs == null) {
    return false;
  }

  const aggregate = runsRepository.get(params.runId);
  if (!aggregate) {
    return false;
  }

  if (
    aggregate.run.workspaceId !== params.record.workspaceId ||
    isTerminalRunStatus(aggregate.run.status)
  ) {
    return false;
  }

  const createdAtMs = parseIsoTimestamp(aggregate.run.createdAt);
  if (createdAtMs == null || createdAtMs > graceIssuedAtMs) {
    return false;
  }

  return (
    aggregate.startJob.credentialMounts.some(
      (mount) => mount.credentialId === params.record.credentialId
    ) ||
    aggregate.startJob.mcpBindings.some(
      (binding) => binding.credentialId === params.record.credentialId
    )
  );
}

function buildCredentialAad(record: Pick<StoredCredentialRecord, "credentialId" | "secretVersion">) {
  return `credential:${record.credentialId}:v${record.secretVersion}`;
}

function buildMissingRunCredentialRequirementDetails(credentialIds: string[]) {
  const missingCredentialIds = [...new Set(credentialIds)];

  return {
    missingCredentialIds,
    requirements: missingCredentialIds.map((credentialId) => ({
      credentialId,
      reason: "not-found" as const,
    })),
  };
}

function isTerminalRunStatus(status: RunStatus) {
  return TERMINAL_RUN_STATUSES.has(status);
}

function parseIsoTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isCredentialExpired(record: Pick<StoredCredentialRecord, "expiresAt">, nowMs = Date.now()) {
  const expiresAtMs = parseIsoTimestamp(record.expiresAt);
  return expiresAtMs != null && expiresAtMs <= nowMs;
}

function isCredentialRotationDue(
  record: Pick<StoredCredentialRecord, "rotationDueAt">,
  nowMs = Date.now()
) {
  const rotationDueAtMs = parseIsoTimestamp(record.rotationDueAt);
  return rotationDueAtMs != null && rotationDueAtMs <= nowMs;
}

function deriveCredentialStatus(
  record: Pick<StoredCredentialRecord, "status" | "expiresAt" | "rotationDueAt">,
  nowMs = Date.now()
): CredentialStatus {
  if (record.status === "revoked" || record.status === "disabled") {
    return record.status;
  }

  if (isCredentialExpired(record, nowMs)) {
    return "disabled";
  }

  if (record.status === "needs-rotation" || isCredentialRotationDue(record, nowMs)) {
    return "needs-rotation";
  }

  return "active";
}

function buildDerivedLifecycleTransition(record: StoredCredentialRecord, nowMs = Date.now()) {
  if (record.status === "revoked" || record.status === "disabled") {
    return null;
  }

  if (isCredentialExpired(record, nowMs)) {
    return {
      nextStatus: "disabled" as const,
      action: "auto-disabled-expired" as const,
      reasonCode: "CREDENTIAL_EXPIRED",
      reasonDetail: `Credential ${record.credentialId} reached expiresAt ${record.expiresAt}.`,
    };
  }

  if (record.status === "active" && isCredentialRotationDue(record, nowMs)) {
    return {
      nextStatus: "needs-rotation" as const,
      action: "auto-needs-rotation" as const,
      reasonCode: "CREDENTIAL_ROTATION_DUE",
      reasonDetail: `Credential ${record.credentialId} reached rotationDueAt ${record.rotationDueAt}.`,
    };
  }

  return null;
}

export class CredentialsService {
  listVisibleCredentials(
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    query: ListCredentialsQuery
  ) {
    const parsed = listCredentialsQuerySchema.parse(query);

    return credentialsRepository
      .list()
      .filter((record) => {
        if (record.workspaceId !== actor.workspaceId) {
          return false;
        }

        const effectiveStatus = deriveCredentialStatus(record);

        if (
          record.scope === "user" &&
          record.ownerUserId !== actor.userId &&
          actor.role !== "owner" &&
          actor.role !== "admin"
        ) {
          return false;
        }

        return (
          (!parsed.scope || record.scope === parsed.scope) &&
          (!parsed.status || effectiveStatus === parsed.status) &&
          matchesSearchQuery(parsed.q ?? "", [
            record.credentialId,
            record.displayName,
            record.provider,
            record.notes ?? "",
          ])
        );
      })
      .map((record) => toPublicCredential(record));
  }

  getCredentialForActor(
    credentialId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole }
  ) {
    const record = credentialsRepository.getById(credentialId);
    if (!record) {
      throw new AppError(404, "CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
    }

    return toPublicCredential(ensureCredentialVisible(record, actor));
  }

  getCredentialUsage(
    credentialId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole }
  ): CredentialUsageResponse {
    const record = credentialsRepository.getById(credentialId);
    if (!record) {
      throw new AppError(404, "CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
    }

    ensureCredentialVisible(record, actor);

    const registryById = new Map(
      mcpRepository.listRegistry().map((entry) => [entry.mcpId, entry])
    );
    const bindings = mcpRepository
      .listBindings()
      .filter(
        (binding) =>
          binding.workspaceId === actor.workspaceId &&
          binding.credentialId === credentialId
      )
      .map((binding) => {
        const entry = registryById.get(binding.mcpId);
        return {
          bindingId: binding.bindingId,
          mcpId: binding.mcpId,
          mcpDisplayName: entry?.displayName ?? null,
          scope: binding.scope,
          scopeRef: binding.scopeRef,
          status: binding.status,
          approvalRequired: binding.approvalRequired,
          autoAttach: binding.autoAttach,
          networkPolicyRef: binding.networkPolicyRef,
          createdAt: binding.createdAt,
          updatedAt: binding.updatedAt,
        };
      })
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.createdAt.localeCompare(left.createdAt) ||
          left.bindingId.localeCompare(right.bindingId)
      );

    const matchedRuns = runsRepository
      .list()
      .filter((aggregate) => aggregate.run.workspaceId === actor.workspaceId)
      .flatMap((aggregate) => {
        const usesDirectMount = aggregate.startJob.credentialMounts.some(
          (mount) => mount.credentialId === credentialId
        );
        const usesMcpBinding = aggregate.startJob.mcpBindings.some(
          (binding) => binding.credentialId === credentialId
        );

        if (!usesDirectMount && !usesMcpBinding) {
          return [];
        }

        return [
          {
            runId: aggregate.run.runId,
            workspaceId: aggregate.run.workspaceId,
            requestedByUserId: aggregate.run.requestedByUserId ?? null,
            title: aggregate.run.title,
            status: aggregate.run.status,
            targetPath: aggregate.run.targetPath,
            taskVersionId: aggregate.run.taskVersionId,
            sessionVersionId: aggregate.run.sessionVersionId,
            entrySurface: aggregate.run.entrySurface,
            workspaceContextKey: aggregate.run.catalogMetadata?.workspaceContextKey ?? null,
            workshopId: aggregate.run.catalogMetadata?.workshopId ?? null,
            workshopName: aggregate.run.catalogMetadata?.workshopName ?? null,
            serviceId: aggregate.run.catalogMetadata?.serviceId ?? null,
            serviceName: aggregate.run.catalogMetadata?.serviceName ?? null,
            createdAt: aggregate.run.createdAt,
            updatedAt: aggregate.run.updatedAt,
            usesDirectMount,
            usesMcpBinding,
          },
        ];
      })
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.createdAt.localeCompare(left.createdAt) ||
          left.runId.localeCompare(right.runId)
      );

    const activeRuns = matchedRuns.filter((run) => !isTerminalRunStatus(run.status));
    const recentRuns = matchedRuns.filter((run) => isTerminalRunStatus(run.status)).slice(0, 12);

    return credentialUsageResponseSchema.parse({
      summary: {
        credentialId: record.credentialId,
        status: deriveCredentialStatus(record),
        totalRunCount: matchedRuns.length,
        activeRunCount: activeRuns.length,
        bindingCount: bindings.length,
        lastMaterializedAt: record.lastMaterializedAt,
        lastRotatedAt: record.lastRotatedAt,
      },
      activeRuns,
      recentRuns,
      bindings,
    });
  }

  listCredentialAuditEvents(
    credentialId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    query: ListCredentialAuditEventsQuery
  ) {
    const record = credentialsRepository.getById(credentialId);
    if (!record) {
      throw new AppError(404, "CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
    }

    ensureCredentialVisible(record, actor);
    const parsed = listCredentialAuditEventsQuerySchema.parse(query);

    return credentialAuditRepository
      .list()
      .filter(
        (event) =>
          event.workspaceId === actor.workspaceId &&
          event.credentialId === credentialId &&
          (!parsed.action || event.action === parsed.action) &&
          (!parsed.outcome || event.outcome === parsed.outcome) &&
          (!parsed.runId || event.runId === parsed.runId)
      )
      .slice(0, parsed.limit ?? 50)
      .map((event) => credentialAuditEventSchema.parse(event));
  }

  async reconcileDerivedStatuses(options: {
    workspaceId?: string;
    credentialId?: string;
    dryRun?: boolean;
    actorUserId?: string | null;
    runId?: string | null;
    traceId?: string | null;
  } = {}) {
    const scannedRecords = credentialsRepository
      .list()
      .filter(
        (record) =>
          (!options.workspaceId || record.workspaceId === options.workspaceId) &&
          (!options.credentialId || record.credentialId === options.credentialId)
      );

    const changes: Array<{
      credentialId: string;
      fromStatus: CredentialStatus;
      toStatus: CredentialStatus;
      action: CredentialAuditEventAction;
      reasonCode: string;
    }> = [];

    for (const record of scannedRecords) {
      const transition = buildDerivedLifecycleTransition(record);
      if (!transition) {
        continue;
      }

      changes.push({
        credentialId: record.credentialId,
        fromStatus: record.status,
        toStatus: transition.nextStatus,
        action: transition.action,
        reasonCode: transition.reasonCode,
      });

      if (options.dryRun) {
        continue;
      }

      await this.#persistCredentialTransition(record, {
        nextStatus: transition.nextStatus,
        action: transition.action,
        actorUserId: options.actorUserId ?? null,
        runId: options.runId ?? null,
        traceId: options.traceId ?? null,
        reasonCode: transition.reasonCode,
        reasonDetail: transition.reasonDetail,
      });
    }

    return {
      scannedCount: scannedRecords.length,
      changedCount: changes.length,
      changes,
    };
  }

  async #persistCredentialTransition(
    record: StoredCredentialRecord,
    input: {
      nextStatus: CredentialStatus;
      action: CredentialAuditEventAction;
      actorUserId?: string | null;
      runId?: string | null;
      leaseId?: string | null;
      traceId?: string | null;
      reasonCode?: string | null;
      reasonDetail?: string | null;
      occurredAt?: string;
      activeRunGraceIssuedAt?: string | null;
    }
  ) {
    const occurredAt = input.occurredAt ?? nowIso();
    const nextRecord: StoredCredentialRecord = {
      ...record,
      status: input.nextStatus,
      updatedAt: occurredAt,
      activeRunGraceIssuedAt:
        input.activeRunGraceIssuedAt !== undefined ? input.activeRunGraceIssuedAt : null,
    };

    await credentialsRepository.save(nextRecord);
    await this.#recordAuditEvent({
      credentialId: record.credentialId,
      workspaceId: record.workspaceId,
      actorUserId: input.actorUserId ?? null,
      runId: input.runId ?? null,
      leaseId: input.leaseId ?? null,
      action: input.action,
      outcome: "success",
      statusBefore: record.status,
      statusAfter: input.nextStatus,
      secretVersion: record.secretVersion,
      mountMode: record.mountMode,
      reasonCode: input.reasonCode ?? null,
      reasonDetail: input.reasonDetail ?? null,
      traceId: input.traceId ?? null,
      occurredAt,
    });

    if (input.nextStatus === "disabled" || input.nextStatus === "revoked") {
      await credentialLifecycleCallbackManager.dispatchForTransition({
        record: nextRecord,
        nextStatus: input.nextStatus,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        runId: input.runId ?? null,
        traceId: input.traceId ?? null,
        reasonCode: input.reasonCode ?? null,
        reasonDetail: input.reasonDetail ?? null,
      });
    }

    return nextRecord;
  }

  async #recordAuditEvent(
    input: Omit<CredentialAuditEvent, "eventId" | "occurredAt"> & {
      occurredAt?: string;
    }
  ) {
    return await credentialAuditRepository.save(
      credentialAuditEventSchema.parse({
        ...input,
        eventId: nextCredentialAuditEventId(),
        occurredAt: input.occurredAt ?? nowIso(),
      }) satisfies StoredCredentialAuditEvent
    );
  }

  async createCredential(
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    input: CreateCredentialInput
  ) {
    const parsed = createCredentialInputSchema.parse(input);
    if (parsed.scope === "workspace" && !canManageWorkspaceScope(actor.role)) {
      throw new AppError(
        403,
        "CREDENTIAL_MANAGE_FORBIDDEN",
        `Role ${actor.role} cannot create workspace credentials`
      );
    }

    const credentialId = nextCredentialId();
    const createdAt = nowIso();
    const mountMode = parsed.mountMode ?? inferCredentialMountMode(parsed.secretKind);
    const broker = getCredentialBroker();
    const normalized = normalizeMountFields({
      credentialId,
      secretKind: parsed.secretKind,
      mountMode,
      envName:
        mountMode === "env" ? (parsed.envName ?? toCredentialEnvName(credentialId)) : null,
      mountPathTemplate: mountMode === "file" ? (parsed.mountPathTemplate ?? null) : null,
    });
    let secretEnvelope: StoredCredentialRecord["secretEnvelope"];
    try {
      secretEnvelope = await broker.sealSecret({
        secretValue: parsed.secretValue,
        aad: buildCredentialAad({
          credentialId,
          secretVersion: 1,
        }),
      });
    } catch (error) {
      throw new AppError(
        502,
        "CREDENTIAL_BROKER_SEAL_FAILED",
        `Credential broker ${broker.provider} failed to seal ${credentialId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const record: StoredCredentialRecord = {
      credentialId,
      workspaceId: actor.workspaceId,
      ownerUserId: parsed.scope === "user" ? actor.userId : null,
      scope: parsed.scope,
      displayName: parsed.displayName.trim(),
      provider: parsed.provider.trim(),
      secretKind: parsed.secretKind,
      mountMode: normalized.mountMode,
      status: deriveCredentialStatus({
        status: "active",
        expiresAt: parsed.expiresAt,
        rotationDueAt: parsed.rotationDueAt,
      }),
      brokerKind: broker.provider,
      activeKeyId: broker.activeKeyId,
      secretVersion: 1,
      redactedSecretRef: redactSecretRef(parsed.secretRef),
      secretRef: parsed.secretRef?.trim() ?? null,
      secretEnvelope,
      envName: normalized.envName,
      mountPathTemplate: normalized.mountPathTemplate,
      expiresAt: parsed.expiresAt,
      lastRotatedAt: createdAt,
      lastMaterializedAt: null,
      lastMaterializationLeaseId: null,
      activeRunGraceIssuedAt: null,
      rotationDueAt: parsed.rotationDueAt,
      notes: parsed.notes,
      createdAt,
      updatedAt: createdAt,
    };

    const saved = await credentialsRepository.save(record);
    await this.#recordAuditEvent({
      credentialId: saved.credentialId,
      workspaceId: saved.workspaceId,
      actorUserId: actor.userId,
      runId: null,
      leaseId: null,
      action: "created",
      outcome: "success",
      statusBefore: null,
      statusAfter: saved.status,
      secretVersion: saved.secretVersion,
      mountMode: saved.mountMode,
      reasonCode: null,
      reasonDetail: null,
      traceId: null,
      occurredAt: saved.createdAt,
    });

    return toPublicCredential(saved);
  }

  async updateCredential(
    credentialId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    input: UpdateCredentialInput
  ) {
    const parsed = updateCredentialInputSchema.parse(input);
    const current = credentialsRepository.getById(credentialId);
    if (!current) {
      throw new AppError(404, "CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
    }

    ensureCredentialManageable(current, actor);

    const secretKind = parsed.secretKind ?? current.secretKind;
    const mountMode = parsed.mountMode ?? current.mountMode ?? inferCredentialMountMode(secretKind);
    const normalized = normalizeMountFields({
      credentialId: current.credentialId,
      secretKind,
      mountMode,
      envName:
        mountMode === "env"
          ? (parsed.envName ?? current.envName ?? toCredentialEnvName(current.credentialId))
          : null,
      mountPathTemplate:
        mountMode === "file"
          ? (parsed.mountPathTemplate ?? current.mountPathTemplate ?? null)
          : null,
    });

    const next: StoredCredentialRecord = {
      ...current,
      displayName: parsed.displayName?.trim() ?? current.displayName,
      provider: parsed.provider?.trim() ?? current.provider,
      secretKind,
      mountMode: normalized.mountMode,
      status: deriveCredentialStatus({
        status: parsed.status ?? current.status,
        expiresAt: parsed.expiresAt === undefined ? current.expiresAt : parsed.expiresAt,
        rotationDueAt:
          parsed.rotationDueAt === undefined ? current.rotationDueAt : parsed.rotationDueAt,
      }),
      envName: normalized.envName,
      mountPathTemplate: normalized.mountPathTemplate,
      expiresAt: parsed.expiresAt === undefined ? current.expiresAt : parsed.expiresAt,
      rotationDueAt:
        parsed.rotationDueAt === undefined ? current.rotationDueAt : parsed.rotationDueAt,
      notes: parsed.notes === undefined ? current.notes : parsed.notes,
      updatedAt: nowIso(),
      activeRunGraceIssuedAt:
        parsed.status === undefined ? current.activeRunGraceIssuedAt ?? null : null,
    };

    const saved = await credentialsRepository.save(next);
    await this.#recordAuditEvent({
      credentialId: saved.credentialId,
      workspaceId: saved.workspaceId,
      actorUserId: actor.userId,
      runId: null,
      leaseId: null,
      action: "updated",
      outcome: "success",
      statusBefore: current.status,
      statusAfter: saved.status,
      secretVersion: saved.secretVersion,
      mountMode: saved.mountMode,
      reasonCode: null,
      reasonDetail: null,
      traceId: null,
      occurredAt: saved.updatedAt,
    });

    return toPublicCredential(saved);
  }

  async rotateCredential(
    credentialId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    input: RotateCredentialInput
  ) {
    const parsed = rotateCredentialInputSchema.parse(input);
    const current = credentialsRepository.getById(credentialId);
    if (!current) {
      throw new AppError(404, "CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
    }

    ensureCredentialManageable(current, actor);
    const rotatedAt = nowIso();
    const nextSecretVersion = current.secretVersion + 1;
    const broker = getCredentialBroker();
    let secretEnvelope: StoredCredentialRecord["secretEnvelope"];
    try {
      secretEnvelope = await broker.sealSecret({
        secretValue: parsed.secretValue,
        aad: buildCredentialAad({
          credentialId: current.credentialId,
          secretVersion: nextSecretVersion,
        }),
      });
    } catch (error) {
      throw new AppError(
        502,
        "CREDENTIAL_BROKER_SEAL_FAILED",
        `Credential broker ${broker.provider} failed to rotate ${current.credentialId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const next: StoredCredentialRecord = {
      ...current,
      status: deriveCredentialStatus({
        status: "active",
        expiresAt: parsed.expiresAt === undefined ? current.expiresAt : parsed.expiresAt,
        rotationDueAt:
          parsed.rotationDueAt === undefined ? current.rotationDueAt : parsed.rotationDueAt,
      }),
      brokerKind: broker.provider,
      activeKeyId: broker.activeKeyId,
      secretVersion: nextSecretVersion,
      redactedSecretRef: redactSecretRef(parsed.secretRef),
      secretRef: parsed.secretRef?.trim() ?? null,
      secretEnvelope,
      lastRotatedAt: rotatedAt,
      expiresAt: parsed.expiresAt === undefined ? current.expiresAt : parsed.expiresAt,
      rotationDueAt:
        parsed.rotationDueAt === undefined ? current.rotationDueAt : parsed.rotationDueAt,
      notes: parsed.note === undefined ? current.notes : parsed.note,
      updatedAt: rotatedAt,
      activeRunGraceIssuedAt: null,
    };

    const saved = await credentialsRepository.save(next);
    await this.#recordAuditEvent({
      credentialId: saved.credentialId,
      workspaceId: saved.workspaceId,
      actorUserId: actor.userId,
      runId: null,
      leaseId: null,
      action: "rotated",
      outcome: "success",
      statusBefore: current.status,
      statusAfter: saved.status,
      secretVersion: saved.secretVersion,
      mountMode: saved.mountMode,
      reasonCode: null,
      reasonDetail: parsed.note ?? null,
      traceId: null,
      occurredAt: saved.updatedAt,
    });

    return toPublicCredential(saved);
  }

  async setCredentialLifecycleStatus(
    credentialId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    params: {
      status: Extract<CredentialStatus, "disabled" | "revoked">;
      note?: string | null;
      allowActiveRuns?: boolean;
    }
  ) {
    const current = credentialsRepository.getById(credentialId);
    if (!current) {
      throw new AppError(404, "CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
    }

    ensureCredentialManageable(current, actor);
    const updatedAt = nowIso();
    const next = await this.#persistCredentialTransition(current, {
      nextStatus: params.status,
      action: "status-changed",
      actorUserId: actor.userId,
      reasonCode: params.status === "revoked" ? "CREDENTIAL_REVOKED" : "CREDENTIAL_DISABLED",
      reasonDetail: params.note ?? null,
      occurredAt: updatedAt,
      activeRunGraceIssuedAt:
        params.status === "disabled" && params.allowActiveRuns ? updatedAt : null,
    });

    if (params.note !== undefined && params.note !== current.notes) {
      await credentialsRepository.save({
        ...next,
        notes: params.note,
        updatedAt,
      });
      return toPublicCredential({
        ...next,
        notes: params.note,
        updatedAt,
      });
    }

    return toPublicCredential(next);
  }

  async resolveRunCredentials(params: {
    workspaceId: string;
    requestedByUserId: string | null | undefined;
    credentialIds: string[];
  }) {
    const resolved: CredentialDetail[] = [];
    const uniqueIds = [...new Set(params.credentialIds)];
    const missingCredentialIds: string[] = [];

    for (const credentialId of uniqueIds) {
      const record = credentialsRepository.getById(credentialId);
      if (!record) {
        missingCredentialIds.push(credentialId);
        continue;
      }

      if (record.workspaceId !== params.workspaceId) {
        throw new AppError(
          403,
          "RUN_CREDENTIAL_SCOPE_DENIED",
          `Credential ${credentialId} does not belong to workspace ${params.workspaceId}`
        );
      }

      const refreshedRecord = await this.reconcileDerivedStatuses({
        workspaceId: params.workspaceId,
        credentialId,
      }).then(() => credentialsRepository.getById(credentialId) ?? record);

      ensureCredentialActiveForRun(refreshedRecord, params.requestedByUserId);

      resolved.push(toPublicCredential(refreshedRecord));
    }

    if (missingCredentialIds.length > 0) {
      const details = buildMissingRunCredentialRequirementDetails(missingCredentialIds);
      throw new AppError(
        409,
        "CREDENTIAL_REQUIREMENT_UNMET",
        `Run requires credential bindings that are not currently available: ${details.missingCredentialIds.join(", ")}`,
        details
      );
    }

    return resolved;
  }

  async materializeRunCredentials(params: {
    runId: string;
    workspaceId: string;
    requestedByUserId: string | null;
    mounts: CredentialMount[];
    traceId?: string | null;
  }): Promise<MaterializeRunCredentialsResponse> {
    const now = new Date();
    const issuedAt = now.toISOString();
    const expiresAt = new Date(
      now.getTime() + getApiRuntimeConfig().credentialBrokerLeaseTtlSeconds * 1000
    ).toISOString();
    const uniqueCredentialIds = [...new Set(params.mounts.map((mount) => mount.credentialId))];
    const secrets: Record<string, string> = {};
    const secretVersionByCredentialId: Record<string, number> = {};
    const brokerKindByCredentialId: Record<string, NonNullable<CredentialDetail["brokerKind"]>> =
      {};

    for (const credentialId of uniqueCredentialIds) {
      const record = credentialsRepository.getById(credentialId);
      if (!record) {
        throw new AppError(404, "CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
      }

      const refreshedRecord = await this.reconcileDerivedStatuses({
        workspaceId: params.workspaceId,
        credentialId,
        actorUserId: params.requestedByUserId ?? null,
        runId: params.runId,
        traceId: params.traceId ?? null,
      }).then(() => credentialsRepository.getById(credentialId) ?? record);
      const allowDisabledForGrandfatheredRun = canMaterializeGrandfatheredDisabledCredential({
        record: refreshedRecord,
        runId: params.runId,
      });

      if (refreshedRecord.workspaceId !== params.workspaceId) {
        throw new AppError(
          403,
          "RUN_CREDENTIAL_SCOPE_DENIED",
          `Credential ${credentialId} does not belong to workspace ${params.workspaceId}`
        );
      }

      try {
        ensureCredentialActiveForRun(refreshedRecord, params.requestedByUserId, {
          allowDisabledForGrandfatheredRun,
        });
      } catch (error) {
        await this.#recordAuditEvent({
          credentialId: refreshedRecord.credentialId,
          workspaceId: refreshedRecord.workspaceId,
          actorUserId: params.requestedByUserId ?? null,
          runId: params.runId,
          leaseId: null,
          action: "materialization-denied",
          outcome: "blocked",
          statusBefore: refreshedRecord.status,
          statusAfter: deriveCredentialStatus(refreshedRecord),
          secretVersion: refreshedRecord.secretVersion,
          mountMode: refreshedRecord.mountMode,
          reasonCode: error instanceof AppError ? error.code : "CREDENTIAL_MATERIALIZATION_DENIED",
          reasonDetail: error instanceof Error ? error.message : String(error),
          traceId: params.traceId ?? null,
        });
        throw error;
      }

      if (!refreshedRecord.secretEnvelope) {
        await this.#recordAuditEvent({
          credentialId: refreshedRecord.credentialId,
          workspaceId: refreshedRecord.workspaceId,
          actorUserId: params.requestedByUserId ?? null,
          runId: params.runId,
          leaseId: null,
          action: "materialization-denied",
          outcome: "blocked",
          statusBefore: refreshedRecord.status,
          statusAfter: deriveCredentialStatus(refreshedRecord),
          secretVersion: refreshedRecord.secretVersion,
          mountMode: refreshedRecord.mountMode,
          reasonCode: "CREDENTIAL_SECRET_UNAVAILABLE",
          reasonDetail: `Credential ${credentialId} does not have a materializable secret payload`,
          traceId: params.traceId ?? null,
        });
        throw new AppError(
          409,
          "CREDENTIAL_SECRET_UNAVAILABLE",
          `Credential ${credentialId} does not have a materializable secret payload`
        );
      }

      try {
        const broker = getCredentialBrokerForKind(refreshedRecord.secretEnvelope.brokerKind);
        secrets[credentialId] = await broker.openSecret({
          envelope: refreshedRecord.secretEnvelope,
          aad: buildCredentialAad(refreshedRecord),
        });
      } catch (error) {
        await this.#recordAuditEvent({
          credentialId: refreshedRecord.credentialId,
          workspaceId: refreshedRecord.workspaceId,
          actorUserId: params.requestedByUserId ?? null,
          runId: params.runId,
          leaseId: null,
          action: "materialization-denied",
          outcome: "blocked",
          statusBefore: refreshedRecord.status,
          statusAfter: deriveCredentialStatus(refreshedRecord),
          secretVersion: refreshedRecord.secretVersion,
          mountMode: refreshedRecord.mountMode,
          reasonCode: "CREDENTIAL_BROKER_OPEN_FAILED",
          reasonDetail: error instanceof Error ? error.message : String(error),
          traceId: params.traceId ?? null,
        });
        throw new AppError(
          502,
          "CREDENTIAL_BROKER_OPEN_FAILED",
          `Credential broker ${refreshedRecord.secretEnvelope.brokerKind} failed to materialize ${credentialId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      secretVersionByCredentialId[credentialId] = refreshedRecord.secretVersion;
      brokerKindByCredentialId[credentialId] = refreshedRecord.secretEnvelope.brokerKind;
    }

    const uniqueBrokerKinds = [...new Set(Object.values(brokerKindByCredentialId).filter(Boolean))];

    const lease = credentialMaterializationLeaseSchema.parse({
      leaseId: nextCredentialLeaseId(),
      runId: params.runId,
      workspaceId: params.workspaceId,
      requestedByUserId: params.requestedByUserId,
      brokerKind: uniqueBrokerKinds.length === 1 ? uniqueBrokerKinds[0] : null,
      brokerKindByCredentialId,
      credentialIds: uniqueCredentialIds,
      secretVersionByCredentialId,
      issuedAt,
      expiresAt,
    });

    await credentialMaterializationRepository.save({
      ...lease,
      consumer: "run-worker",
      traceId: params.traceId ?? null,
    } satisfies StoredCredentialMaterializationLease);

    await Promise.all(
      uniqueCredentialIds.map(async (credentialId) => {
        const record = credentialsRepository.getById(credentialId);
        if (!record) {
          return;
        }

        await credentialsRepository.save({
          ...record,
          lastMaterializedAt: issuedAt,
          lastMaterializationLeaseId: lease.leaseId,
          updatedAt: issuedAt,
        });

        await this.#recordAuditEvent({
          credentialId: record.credentialId,
          workspaceId: record.workspaceId,
          actorUserId: params.requestedByUserId ?? null,
          runId: params.runId,
          leaseId: lease.leaseId,
          action: "materialized",
          outcome: "success",
          statusBefore: record.status,
          statusAfter: deriveCredentialStatus(record),
          secretVersion: secretVersionByCredentialId[credentialId] ?? record.secretVersion,
          mountMode: record.mountMode,
          reasonCode: null,
          reasonDetail: null,
          traceId: params.traceId ?? null,
          occurredAt: issuedAt,
        });
      })
    );

    return materializeRunCredentialsResponseSchema.parse({
      lease,
      secrets,
    });
  }
}

export async function initializeCredentialsInfrastructure() {
  await credentialsRepository.init();
  await credentialMaterializationRepository.init();
  await credentialAuditRepository.init();
  await credentialLifecycleCallbackRepository.init();
}

export const credentialsService = new CredentialsService();
