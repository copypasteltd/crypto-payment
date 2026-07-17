import { randomUUID } from "node:crypto";
import type { WorkspaceRole } from "@lingban/contracts";
import {
  createMcpBindingInputSchema,
  createMcpInputSchema,
  createMcpNetworkPolicyInputSchema,
  listMcpBindingsQuerySchema,
  listMcpHealthSnapshotsQuerySchema,
  listMcpsQuerySchema,
  listMcpNetworkPoliciesQuerySchema,
  mcpBindingRecordSchema,
  mcpHealthSnapshotSchema,
  mcpNetworkPolicySchema,
  mcpRegistryEntrySchema,
  probeMcpInputSchema,
  updateMcpBindingInputSchema,
  updateMcpInputSchema,
  updateMcpNetworkPolicyInputSchema,
  type CreateMcpBindingInput,
  type CreateMcpInput,
  type CreateMcpNetworkPolicyInput,
  type CreateRunBinding,
  type ListMcpBindingsQuery,
  type ListMcpHealthSnapshotsQuery,
  type ListMcpsQuery,
  type ListMcpNetworkPoliciesQuery,
  type McpBindingRecord,
  type McpHealthSnapshot,
  type McpNetworkPolicy,
  type McpRegistryEntry,
  type ProbeMcpInput,
  type UpdateMcpBindingInput,
  type UpdateMcpInput,
  type UpdateMcpNetworkPolicyInput,
} from "@lingban/contracts";
import { matchesSearchQuery } from "@lingban/domain-models";
import {
  assertMcpNetworkPolicyShape,
  evaluateMcpNetworkPolicy,
  evaluateMcpStdioPathAllowlist,
} from "@lingban/mcp";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { AppError } from "../../app/errors.js";
import { credentialsService } from "../credentials/service.js";
import { initializeMcpCallAuditInfrastructure } from "./call-audit-service.js";
import { initializeMcpGovernanceAuditInfrastructure, mcpGovernanceAuditService } from "./governance-audit-service.js";
import { probeMcpTarget } from "./probe.js";
import { mcpRepository } from "./repository.js";

let bindingSequence = 1;
let bootstrapped = false;
const knownFirstPartyMcpIds = new Set([
  "mcp.browser.playwright",
  "mcp.image.gpt-image-2",
]);
const knownFirstPartyDefaultCredentialIds: Record<string, string | null> = {
  "mcp.browser.playwright": "cred_browser_storage_state",
  "mcp.image.gpt-image-2": "cred_openai_image_api_key",
};

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

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

  let maxBinding = 0;
  for (const binding of mcpRepository.listBindings()) {
    maxBinding = Math.max(maxBinding, parseCounter(binding.bindingId, "mbd_"));
  }

  bindingSequence = Math.max(bindingSequence, maxBinding + 1);
  bootstrapped = true;
}

function nextBindingId() {
  ensureBootstrapped();
  return `mbd_${String(bindingSequence++).padStart(8, "0")}`;
}

function nextHealthSnapshotId() {
  return `chs_${randomUUID().replace(/-/g, "")}`;
}

function canManageWorkspaceMcp(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "operator" || role === "creator";
}

function isKnownFirstPartyMcpId(mcpId: string) {
  return knownFirstPartyMcpIds.has(mcpId);
}

function getKnownFirstPartyDefaultCredentialId(mcpId: string) {
  return knownFirstPartyDefaultCredentialIds[mcpId] ?? null;
}

function assertRemoteRefShape(params: {
  mcpId: string;
  transport: McpRegistryEntry["transport"];
  ref: string;
}) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(params.ref);
  } catch {
    throw new AppError(
      400,
      "MCP_REF_INVALID",
      `MCP ${params.mcpId} must use an absolute URL for transport ${params.transport}`
    );
  }

  const protocol = parsedUrl.protocol.toLowerCase();
  if (
    (params.transport === "http" || params.transport === "sse") &&
    protocol !== "http:" &&
    protocol !== "https:"
  ) {
    throw new AppError(
      400,
      "MCP_REF_INVALID",
      `MCP ${params.mcpId} must use http/https for transport ${params.transport}`
    );
  }

  if (
    params.transport === "websocket" &&
    protocol !== "ws:" &&
    protocol !== "wss:"
  ) {
    throw new AppError(
      400,
      "MCP_REF_INVALID",
      `MCP ${params.mcpId} must use ws/wss for websocket transport`
    );
  }
}

function supportsRuntimeNetworkPolicy(
  entry: Pick<McpRegistryEntry, "transport">
) {
  return entry.transport !== "stdio";
}

function mapStdioValidationErrorCode(
  reasonCode:
    | "STDIO_ALLOWLIST_INVALID"
    | "STDIO_REF_INVALID"
    | "STDIO_NOT_ALLOWED"
    | "STDIO_PATH_NOT_ALLOWED"
) {
  switch (reasonCode) {
    case "STDIO_ALLOWLIST_INVALID":
      return "MCP_STDIO_ALLOWLIST_INVALID";
    case "STDIO_REF_INVALID":
      return "MCP_STDIO_REF_INVALID";
    case "STDIO_NOT_ALLOWED":
      return "MCP_STDIO_NOT_ALLOWED";
    case "STDIO_PATH_NOT_ALLOWED":
    default:
      return "MCP_STDIO_PATH_NOT_ALLOWED";
  }
}

function assertManagedStdioRefShape(
  entry: Pick<McpRegistryEntry, "mcpId" | "ref">
) {
  const evaluation = evaluateMcpStdioPathAllowlist({
    targetPath: entry.ref,
    allowedPathPrefixes: getApiRuntimeConfig().mcpStdioAllowedPathPrefixes,
  });
  if (evaluation.allowed) {
    return;
  }

  throw new AppError(
    400,
    mapStdioValidationErrorCode(evaluation.reasonCode),
    `MCP ${entry.mcpId} stdio target is invalid: ${evaluation.message}`
  );
}

function assertManagedStdioPolicy(
  entry: Pick<McpRegistryEntry, "mcpId" | "stdioPolicy">
) {
  if (!getApiRuntimeConfig().mcpStdioRequireRefSha256) {
    return;
  }

  if (entry.stdioPolicy) {
    return;
  }

  throw new AppError(
    400,
    "MCP_STDIO_SIGNATURE_REQUIRED",
    `MCP ${entry.mcpId} must provide stdioPolicy.refSha256 for governed stdio execution`
  );
}

function assertRegistryEntryShape(
  entry: Pick<
    McpRegistryEntry,
    "mcpId" | "source" | "transport" | "ref" | "stdioPolicy"
  >
) {
  if (entry.source === "first-party") {
    if (entry.transport !== "stdio") {
      throw new AppError(
        400,
        "MCP_TRANSPORT_INVALID",
        `First-party MCP ${entry.mcpId} must use stdio transport`
      );
    }

    if (!entry.ref.startsWith("/")) {
      throw new AppError(
        400,
        "MCP_REF_INVALID",
        `First-party MCP ${entry.mcpId} must use an absolute helper path`
      );
    }
    return;
  }

  if (entry.transport === "stdio") {
    assertManagedStdioRefShape(entry);
    assertManagedStdioPolicy(entry);
    return;
  }

  if (entry.stdioPolicy != null) {
    throw new AppError(
      400,
      "MCP_STDIO_POLICY_UNSUPPORTED",
      `Remote MCP ${entry.mcpId} does not accept stdio execution policy`
    );
  }

  assertRemoteRefShape({
    mcpId: entry.mcpId,
    transport: entry.transport,
    ref: entry.ref,
  });
}

function resolveNetworkPolicyRef(
  entry: McpRegistryEntry,
  binding: McpBindingRecord | null | undefined
) {
  return binding?.networkPolicyRef ?? entry.defaultNetworkPolicyRef ?? null;
}

function assertRunEntryAvailable(
  entry: McpRegistryEntry,
  binding: McpBindingRecord | null | undefined,
  workspaceId: string
) {
  if (entry.status !== "active") {
    throw new AppError(
      409,
      "RUN_MCP_UNAVAILABLE",
      `MCP ${entry.mcpId} is not active`
    );
  }

  assertRegistryEntryShape(entry);

  if (
    supportsRuntimeNetworkPolicy(entry) &&
    !isNonEmptyString(resolveNetworkPolicyRef(entry, binding))
  ) {
    throw new AppError(
      409,
      "RUN_MCP_NETWORK_POLICY_REQUIRED",
      `Remote MCP ${entry.mcpId} requires a network policy before run start`
    );
  }

  if (supportsRuntimeNetworkPolicy(entry)) {
    resolveRunNetworkPolicy({
      workspaceId,
      entry,
      binding,
    });
  }
}

function canSeeUserBinding(
  binding: McpBindingRecord,
  actor: { userId: string; role: WorkspaceRole }
) {
  return binding.scope !== "user" || binding.scopeRef === actor.userId || actor.role === "owner" || actor.role === "admin";
}

function visibleRegistryEntriesForWorkspace(workspaceId: string) {
  return mcpRepository
    .listRegistry()
    .filter((entry) => entry.workspaceId == null || entry.workspaceId === workspaceId);
}

function visibleNetworkPoliciesForWorkspace(workspaceId: string) {
  return mcpRepository
    .listNetworkPolicies()
    .filter((policy) => policy.workspaceId == null || policy.workspaceId === workspaceId);
}

function visibleHealthSnapshotsForWorkspace(workspaceId: string) {
  return mcpRepository
    .listHealthSnapshots()
    .filter((snapshot) => snapshot.workspaceId === workspaceId);
}

function resolveBindingPriority(scope: McpBindingRecord["scope"]) {
  switch (scope) {
    case "run":
      return 4;
    case "session-version":
      return 3;
    case "user":
      return 2;
    case "workspace":
    default:
      return 1;
  }
}

function resolveImplicitScopeRef(input: {
  scope: McpBindingRecord["scope"];
  scopeRef?: string;
  workspaceId: string;
  userId: string;
}) {
  if (input.scope === "workspace") {
    return input.workspaceId;
  }

  if (input.scope === "user") {
    return input.scopeRef ?? input.userId;
  }

  if (input.scopeRef) {
    return input.scopeRef;
  }

  throw new AppError(
    400,
    "MCP_BINDING_SCOPE_REF_REQUIRED",
    `scopeRef is required for scope ${input.scope}`
  );
}

function ensureRegistryEntryVisible(
  entry: McpRegistryEntry,
  actor: { workspaceId: string }
) {
  if (entry.workspaceId != null && entry.workspaceId !== actor.workspaceId) {
    throw new AppError(403, "MCP_ACCESS_DENIED", `MCP not visible: ${entry.mcpId}`);
  }

  return entry;
}

function ensureRegistryEntryManageable(
  entry: McpRegistryEntry,
  actor: { workspaceId: string; role: WorkspaceRole }
) {
  ensureRegistryEntryVisible(entry, actor);
  if (entry.workspaceId == null) {
    throw new AppError(
      403,
      "MCP_MANAGE_FORBIDDEN",
      `Global MCP entries are read-only: ${entry.mcpId}`
    );
  }

  if (!canManageWorkspaceMcp(actor.role)) {
    throw new AppError(
      403,
      "MCP_MANAGE_FORBIDDEN",
      `Role ${actor.role} cannot manage MCP registry entries`
    );
  }

  return entry;
}

function ensureNetworkPolicyVisible(
  policy: McpNetworkPolicy,
  actor: { workspaceId: string }
) {
  if (policy.workspaceId != null && policy.workspaceId !== actor.workspaceId) {
    throw new AppError(
      403,
      "MCP_NETWORK_POLICY_ACCESS_DENIED",
      `Network policy not visible: ${policy.policyRef}`
    );
  }

  return policy;
}

function ensureNetworkPolicyManageable(
  policy: McpNetworkPolicy,
  actor: { workspaceId: string; role: WorkspaceRole }
) {
  ensureNetworkPolicyVisible(policy, actor);
  if (policy.workspaceId == null) {
    throw new AppError(
      403,
      "MCP_NETWORK_POLICY_MANAGE_FORBIDDEN",
      `Global network policies are read-only: ${policy.policyRef}`
    );
  }

  if (!canManageWorkspaceMcp(actor.role)) {
    throw new AppError(
      403,
      "MCP_NETWORK_POLICY_MANAGE_FORBIDDEN",
      `Role ${actor.role} cannot manage MCP network policies`
    );
  }

  return policy;
}

function ensureBindingVisible(
  binding: McpBindingRecord,
  actor: { workspaceId: string; userId: string; role: WorkspaceRole }
) {
  if (binding.workspaceId !== actor.workspaceId) {
    throw new AppError(403, "MCP_BINDING_ACCESS_DENIED", `Binding not visible: ${binding.bindingId}`);
  }

  if (!canSeeUserBinding(binding, actor)) {
    throw new AppError(403, "MCP_BINDING_ACCESS_DENIED", `Binding not visible: ${binding.bindingId}`);
  }

  return binding;
}

function ensureBindingManageable(
  binding: McpBindingRecord,
  actor: { workspaceId: string; userId: string; role: WorkspaceRole }
) {
  ensureBindingVisible(binding, actor);

  if (binding.scope === "workspace" && !canManageWorkspaceMcp(actor.role)) {
    throw new AppError(
      403,
      "MCP_BINDING_MANAGE_FORBIDDEN",
      `Role ${actor.role} cannot manage workspace bindings`
    );
  }

  if (binding.scope === "user" && binding.scopeRef !== actor.userId && actor.role !== "owner" && actor.role !== "admin") {
    throw new AppError(
      403,
      "MCP_BINDING_MANAGE_FORBIDDEN",
      `Role ${actor.role} cannot manage another user's binding`
    );
  }

  if ((binding.scope === "session-version" || binding.scope === "run") && !canManageWorkspaceMcp(actor.role)) {
    throw new AppError(
      403,
      "MCP_BINDING_MANAGE_FORBIDDEN",
      `Role ${actor.role} cannot manage scoped bindings`
    );
  }

  return binding;
}

function parseNetworkPolicyOrThrow(policy: McpNetworkPolicy) {
  const parsed = mcpNetworkPolicySchema.parse(policy);
  try {
    return assertMcpNetworkPolicyShape(parsed);
  } catch (error) {
    throw new AppError(
      400,
      "MCP_NETWORK_POLICY_INVALID",
      error instanceof Error ? error.message : "Invalid MCP network policy"
    );
  }
}

function resolveVisibleNetworkPolicy(
  policyRef: string,
  actor: { workspaceId: string }
) {
  const policy = mcpRepository.getNetworkPolicy(policyRef);
  if (!policy) {
    throw new AppError(
      404,
      "MCP_NETWORK_POLICY_NOT_FOUND",
      `MCP network policy not found: ${policyRef}`
    );
  }

  return ensureNetworkPolicyVisible(policy, actor);
}

function assertPolicyAllowsEntryTarget(params: {
  entry: Pick<McpRegistryEntry, "mcpId" | "ref" | "source" | "transport">;
  policy: McpNetworkPolicy;
  errorStatus: number;
  notAllowedCode: string;
}) {
  if (!supportsRuntimeNetworkPolicy(params.entry)) {
    return;
  }

  const evaluation = evaluateMcpNetworkPolicy({
    policy: params.policy,
    targetUrl: params.entry.ref,
  });
  if (!evaluation.allowed) {
    throw new AppError(
      params.errorStatus,
      params.notAllowedCode,
      `MCP ${params.entry.mcpId} target is not allowed by network policy ${params.policy.policyRef}: ${evaluation.message}`
    );
  }
}

function assertEntryNetworkPolicyRef(
  entry: Pick<McpRegistryEntry, "mcpId" | "ref" | "source" | "transport">,
  policyRef: string | null | undefined,
  actor: { workspaceId: string },
  errorStatus = 400,
  notFoundCode = "MCP_NETWORK_POLICY_NOT_FOUND",
  notAllowedCode = "MCP_NETWORK_POLICY_VIOLATION"
) {
  if (!isNonEmptyString(policyRef)) {
    return null;
  }

  const policy = resolveVisibleNetworkPolicy(policyRef, actor);
  if (policy.status !== "active") {
    throw new AppError(
      errorStatus,
      "MCP_NETWORK_POLICY_DISABLED",
      `MCP network policy ${policy.policyRef} is not active`
    );
  }

  assertPolicyAllowsEntryTarget({
    entry,
    policy,
    errorStatus,
    notAllowedCode,
  });
  return policy;
}

function resolveRunNetworkPolicy(params: {
  workspaceId: string;
  entry: McpRegistryEntry;
  binding: McpBindingRecord | null | undefined;
}) {
  const policyRef = resolveNetworkPolicyRef(params.entry, params.binding);
  if (!isNonEmptyString(policyRef)) {
    return null;
  }

  const policy = mcpRepository.getNetworkPolicy(policyRef);
  if (!policy || (policy.workspaceId != null && policy.workspaceId !== params.workspaceId)) {
    throw new AppError(
      409,
      "RUN_MCP_NETWORK_POLICY_NOT_FOUND",
      `Network policy ${policyRef} must exist before run start`
    );
  }

  if (policy.status !== "active") {
    throw new AppError(
      409,
      "RUN_MCP_NETWORK_POLICY_DISABLED",
      `Network policy ${policy.policyRef} is not active`
    );
  }

  assertPolicyAllowsEntryTarget({
    entry: params.entry,
    policy,
    errorStatus: 409,
    notAllowedCode: "RUN_MCP_NETWORK_POLICY_VIOLATION",
  });
  return policy;
}

function resolveProbeNetworkPolicy(params: {
  workspaceId: string;
  entry: McpRegistryEntry;
  binding: McpBindingRecord | null | undefined;
}) {
  const policyRef = resolveNetworkPolicyRef(params.entry, params.binding);
  if (!isNonEmptyString(policyRef)) {
    return {
      ok: false as const,
      policyRef: null,
      status: "blocked" as const,
      errorCode: "PROBE_NETWORK_POLICY_REQUIRED",
      detail: `Remote MCP ${params.entry.mcpId} requires a network policy before probing`,
    };
  }

  const policy = mcpRepository.getNetworkPolicy(policyRef);
  if (!policy || (policy.workspaceId != null && policy.workspaceId !== params.workspaceId)) {
    return {
      ok: false as const,
      policyRef,
      status: "blocked" as const,
      errorCode: "PROBE_NETWORK_POLICY_NOT_FOUND",
      detail: `Network policy ${policyRef} must exist before probing`,
    };
  }

  if (policy.status !== "active") {
    return {
      ok: false as const,
      policyRef,
      status: "blocked" as const,
      errorCode: "PROBE_NETWORK_POLICY_DISABLED",
      detail: `Network policy ${policy.policyRef} is not active`,
    };
  }

  const evaluation = evaluateMcpNetworkPolicy({
    policy,
    targetUrl: params.entry.ref,
  });
  if (!evaluation.allowed) {
    return {
      ok: false as const,
      policyRef,
      status: "blocked" as const,
      errorCode: "PROBE_NETWORK_POLICY_VIOLATION",
      detail: evaluation.message,
    };
  }

  return {
    ok: true as const,
    policyRef,
    policy,
  };
}

function buildHealthSnapshotRecord(input: {
  entry: McpRegistryEntry;
  binding: McpBindingRecord | null;
  workspaceId: string;
  requestedByUserId: string;
  networkPolicyRef: string | null;
  status: McpHealthSnapshot["status"];
  detail?: string | null;
  errorCode?: string | null;
  httpStatus?: number | null;
  latencyMs?: number | null;
  toolCount?: number | null;
  toolNames?: string[];
  policyEnforced: boolean;
}) {
  const now = nowIso();
  return mcpHealthSnapshotSchema.parse({
    snapshotId: nextHealthSnapshotId(),
    mcpId: input.entry.mcpId,
    bindingId: input.binding?.bindingId ?? null,
    workspaceId: input.workspaceId,
    requestedByUserId: input.requestedByUserId,
    displayName: input.entry.displayName,
    source: input.entry.source,
    transport: input.entry.transport,
    ref: input.entry.ref,
    networkPolicyRef: input.networkPolicyRef,
    status: input.status,
    detail: input.detail ?? null,
    errorCode: input.errorCode ?? null,
    httpStatus: input.httpStatus ?? null,
    latencyMs: input.latencyMs ?? null,
    toolCount: input.toolCount ?? null,
    toolNames: input.toolNames ?? [],
    policyEnforced: input.policyEnforced,
    probedAt: now,
    recordedAt: now,
  });
}

function resolveEffectiveCredentialId(
  entry: Pick<McpRegistryEntry, "defaultCredentialId">,
  binding: Pick<McpBindingRecord, "credentialId"> | null | undefined
) {
  return binding?.credentialId ?? entry.defaultCredentialId ?? null;
}

function toProbeGovernanceOutcome(status: McpHealthSnapshot["status"]) {
  switch (status) {
    case "healthy":
    case "degraded":
      return "success" as const;
    case "blocked":
      return "blocked" as const;
    case "unhealthy":
    case "unsupported":
    default:
      return "error" as const;
  }
}

export class McpService {
  listMcps(
    actor: { workspaceId: string },
    query: ListMcpsQuery
  ) {
    const parsed = listMcpsQuerySchema.parse(query);
    return visibleRegistryEntriesForWorkspace(actor.workspaceId)
      .filter(
        (entry) =>
          (!parsed.source || entry.source === parsed.source) &&
          (!parsed.status || entry.status === parsed.status) &&
          matchesSearchQuery(parsed.q ?? "", [
            entry.mcpId,
            entry.displayName,
            entry.description ?? "",
            entry.ref,
            ...entry.tags,
          ])
      )
      .map((entry) => mcpRegistryEntrySchema.parse(entry));
  }

  getMcp(
    mcpId: string,
    actor: { workspaceId: string }
  ) {
    const entry = mcpRepository.getRegistryEntry(mcpId);
    if (!entry) {
      throw new AppError(404, "MCP_NOT_FOUND", `MCP not found: ${mcpId}`);
    }

    return mcpRegistryEntrySchema.parse(ensureRegistryEntryVisible(entry, actor));
  }

  async createMcp(
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    input: CreateMcpInput
  ) {
    const parsed = createMcpInputSchema.parse(input);
    if (!canManageWorkspaceMcp(actor.role)) {
      throw new AppError(
        403,
        "MCP_MANAGE_FORBIDDEN",
        `Role ${actor.role} cannot create MCP entries`
      );
    }

    if (parsed.source === "first-party") {
      throw new AppError(
        400,
        "MCP_SOURCE_INVALID",
        "First-party MCP entries are system-managed and cannot be created from the API"
      );
    }

    const existing = mcpRepository.getRegistryEntry(parsed.mcpId);
    if (existing) {
      throw new AppError(409, "MCP_ALREADY_EXISTS", `MCP already exists: ${parsed.mcpId}`);
    }

    if (parsed.defaultCredentialId) {
      credentialsService.getCredentialForActor(parsed.defaultCredentialId, {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        role: actor.role,
      });
    }

    const createdAt = nowIso();
    const entry = mcpRegistryEntrySchema.parse({
      ...parsed,
      workspaceId: actor.workspaceId,
      createdAt,
      updatedAt: createdAt,
    });
    assertRegistryEntryShape(entry);
    if (!supportsRuntimeNetworkPolicy(entry) && entry.defaultNetworkPolicyRef != null) {
      throw new AppError(
        400,
        "MCP_NETWORK_POLICY_UNSUPPORTED",
        `stdio MCP ${entry.mcpId} does not accept a default network policy`
      );
    }
    if (supportsRuntimeNetworkPolicy(entry)) {
      assertEntryNetworkPolicyRef(
        entry,
        entry.defaultNetworkPolicyRef,
        { workspaceId: actor.workspaceId }
      );
    }

    const saved = await mcpRepository.saveRegistryEntry(entry);
    await mcpGovernanceAuditService.recordConnectorRegistered(actor, saved);
    return saved;
  }

  async updateMcp(
    mcpId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    input: UpdateMcpInput
  ) {
    const parsed = updateMcpInputSchema.parse(input);
    const current = mcpRepository.getRegistryEntry(mcpId);
    if (!current) {
      throw new AppError(404, "MCP_NOT_FOUND", `MCP not found: ${mcpId}`);
    }

    ensureRegistryEntryManageable(current, actor);
    if (parsed.defaultCredentialId) {
      credentialsService.getCredentialForActor(parsed.defaultCredentialId, actor);
    }
    const next = mcpRegistryEntrySchema.parse({
      ...current,
      ...parsed,
      ...(parsed.transport && parsed.transport !== "stdio" && parsed.stdioPolicy === undefined
        ? { stdioPolicy: null }
        : {}),
      updatedAt: nowIso(),
    });
    assertRegistryEntryShape(next);
    if (!supportsRuntimeNetworkPolicy(next) && next.defaultNetworkPolicyRef != null) {
      throw new AppError(
        400,
        "MCP_NETWORK_POLICY_UNSUPPORTED",
        `stdio MCP ${next.mcpId} does not accept a default network policy`
      );
    }
    if (supportsRuntimeNetworkPolicy(next)) {
      assertEntryNetworkPolicyRef(
        next,
        next.defaultNetworkPolicyRef,
        { workspaceId: actor.workspaceId }
      );
    }

    const saved = await mcpRepository.saveRegistryEntry(next);
    await mcpGovernanceAuditService.recordEvent({
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      runId: null,
      mcpId: saved.mcpId,
      bindingId: null,
      action: "connector.updated",
      outcome: "success",
      reasonCode: null,
      reasonDetail: null,
      displayName: saved.displayName,
      source: saved.source,
      transport: saved.transport,
      scope: null,
      scopeRef: null,
      credentialId: saved.defaultCredentialId,
      networkPolicyRef: saved.defaultNetworkPolicyRef,
      endpointRef: saved.ref,
      riskLevel: saved.riskLevel,
      approvalRequired: saved.approvalRequired,
      healthStatus: null,
      latencyMs: null,
      toolCount: null,
      occurredAt: saved.updatedAt,
    });
    return saved;
  }

  listNetworkPolicies(
    actor: { workspaceId: string },
    query: ListMcpNetworkPoliciesQuery
  ) {
    const parsed = listMcpNetworkPoliciesQuerySchema.parse(query);
    return visibleNetworkPoliciesForWorkspace(actor.workspaceId)
      .filter(
        (policy) =>
          (!parsed.status || policy.status === parsed.status) &&
          matchesSearchQuery(parsed.q ?? "", [
            policy.policyRef,
            policy.displayName,
            policy.description ?? "",
            ...policy.allowedHostPatterns,
            ...policy.tags,
          ])
      )
      .map((policy) => mcpNetworkPolicySchema.parse(policy));
  }

  getNetworkPolicy(
    policyRef: string,
    actor: { workspaceId: string }
  ) {
    return mcpNetworkPolicySchema.parse(
      resolveVisibleNetworkPolicy(policyRef, actor)
    );
  }

  async createNetworkPolicy(
    actor: { workspaceId: string; role: WorkspaceRole },
    input: CreateMcpNetworkPolicyInput
  ) {
    const parsed = createMcpNetworkPolicyInputSchema.parse(input);
    if (!canManageWorkspaceMcp(actor.role)) {
      throw new AppError(
        403,
        "MCP_NETWORK_POLICY_MANAGE_FORBIDDEN",
        `Role ${actor.role} cannot create MCP network policies`
      );
    }

    const existing = mcpRepository.getNetworkPolicy(parsed.policyRef);
    if (existing) {
      throw new AppError(
        409,
        "MCP_NETWORK_POLICY_ALREADY_EXISTS",
        `MCP network policy already exists: ${parsed.policyRef}`
      );
    }

    const createdAt = nowIso();
    const policy = parseNetworkPolicyOrThrow({
      ...parsed,
      workspaceId: actor.workspaceId,
      createdAt,
      updatedAt: createdAt,
    });

    return await mcpRepository.saveNetworkPolicy(policy);
  }

  async updateNetworkPolicy(
    policyRef: string,
    actor: { workspaceId: string; role: WorkspaceRole },
    input: UpdateMcpNetworkPolicyInput
  ) {
    const parsed = updateMcpNetworkPolicyInputSchema.parse(input);
    const current = mcpRepository.getNetworkPolicy(policyRef);
    if (!current) {
      throw new AppError(
        404,
        "MCP_NETWORK_POLICY_NOT_FOUND",
        `MCP network policy not found: ${policyRef}`
      );
    }

    ensureNetworkPolicyManageable(current, actor);
    const next = parseNetworkPolicyOrThrow({
      ...current,
      ...parsed,
      updatedAt: nowIso(),
    });

    return await mcpRepository.saveNetworkPolicy(next);
  }

  listHealthSnapshots(
    actor: { workspaceId: string },
    query: ListMcpHealthSnapshotsQuery
  ) {
    const parsed = listMcpHealthSnapshotsQuerySchema.parse(query);
    return visibleHealthSnapshotsForWorkspace(actor.workspaceId)
      .filter(
        (snapshot) =>
          (!parsed.mcpId || snapshot.mcpId === parsed.mcpId) &&
          (!parsed.bindingId || snapshot.bindingId === parsed.bindingId) &&
          (!parsed.status || snapshot.status === parsed.status)
      )
      .slice(0, parsed.limit ?? 50)
      .map((snapshot) => mcpHealthSnapshotSchema.parse(snapshot));
  }

  getLatestHealthSnapshot(
    mcpId: string,
    actor: { workspaceId: string },
    params: { bindingId?: string | null } = {}
  ) {
    this.getMcp(mcpId, actor);
    const snapshot = mcpRepository.getLatestHealthSnapshot({
      mcpId,
      bindingId: params.bindingId,
    });
    if (!snapshot || snapshot.workspaceId !== actor.workspaceId) {
      return null;
    }

    return mcpHealthSnapshotSchema.parse(snapshot);
  }

  async probeMcp(
    mcpId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    input: ProbeMcpInput
  ) {
    const parsed = probeMcpInputSchema.parse(input);
    const entry = this.getMcp(mcpId, {
      workspaceId: actor.workspaceId,
    });

    if (!canManageWorkspaceMcp(actor.role)) {
      throw new AppError(
        403,
        "MCP_PROBE_FORBIDDEN",
        `Role ${actor.role} cannot probe MCP connectors`
      );
    }

    let binding: McpBindingRecord | null = null;
    if (parsed.bindingId) {
      const currentBinding = mcpRepository.getBinding(parsed.bindingId);
      if (!currentBinding || currentBinding.mcpId !== mcpId) {
        throw new AppError(
          404,
          "MCP_BINDING_NOT_FOUND",
          `Binding not found: ${parsed.bindingId}`
        );
      }

      binding = ensureBindingVisible(currentBinding, actor);
    }

    if (entry.status !== "active") {
      const blockedSnapshot = buildHealthSnapshotRecord({
        entry,
        binding,
        workspaceId: actor.workspaceId,
        requestedByUserId: actor.userId,
        networkPolicyRef: resolveNetworkPolicyRef(entry, binding),
        status: "blocked",
        detail: `MCP ${entry.mcpId} is not active`,
        errorCode: "PROBE_MCP_UNAVAILABLE",
        policyEnforced: false,
      });
      const savedSnapshot = await mcpRepository.saveHealthSnapshot(blockedSnapshot);
      await mcpGovernanceAuditService.recordEvent({
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        runId: null,
        mcpId: entry.mcpId,
        bindingId: binding?.bindingId ?? null,
        action: "connector.tested",
        outcome: toProbeGovernanceOutcome(savedSnapshot.status),
        reasonCode: savedSnapshot.errorCode,
        reasonDetail: savedSnapshot.detail,
        displayName: entry.displayName,
        source: entry.source,
        transport: entry.transport,
        scope: binding?.scope ?? null,
        scopeRef: binding?.scopeRef ?? null,
        credentialId: resolveEffectiveCredentialId(entry, binding),
        networkPolicyRef: savedSnapshot.networkPolicyRef,
        endpointRef: entry.ref,
        riskLevel: entry.riskLevel,
        approvalRequired: binding?.approvalRequired ?? entry.approvalRequired,
        healthStatus: savedSnapshot.status,
        latencyMs: savedSnapshot.latencyMs,
        toolCount: savedSnapshot.toolCount,
        occurredAt: savedSnapshot.probedAt,
      });
      return savedSnapshot;
    }

    assertRegistryEntryShape(entry);

    if (supportsRuntimeNetworkPolicy(entry)) {
      const policyResult = resolveProbeNetworkPolicy({
        workspaceId: actor.workspaceId,
        entry,
        binding,
      });
      if (!policyResult.ok) {
        const blockedSnapshot = buildHealthSnapshotRecord({
          entry,
          binding,
          workspaceId: actor.workspaceId,
          requestedByUserId: actor.userId,
          networkPolicyRef: policyResult.policyRef,
          status: policyResult.status,
          detail: policyResult.detail,
          errorCode: policyResult.errorCode,
          policyEnforced: true,
        });
        const savedSnapshot = await mcpRepository.saveHealthSnapshot(blockedSnapshot);
        await mcpGovernanceAuditService.recordEvent({
          workspaceId: actor.workspaceId,
          actorUserId: actor.userId,
          runId: null,
          mcpId: entry.mcpId,
          bindingId: binding?.bindingId ?? null,
          action: "connector.tested",
          outcome: toProbeGovernanceOutcome(savedSnapshot.status),
          reasonCode: savedSnapshot.errorCode,
          reasonDetail: savedSnapshot.detail,
          displayName: entry.displayName,
          source: entry.source,
          transport: entry.transport,
          scope: binding?.scope ?? null,
          scopeRef: binding?.scopeRef ?? null,
          credentialId: resolveEffectiveCredentialId(entry, binding),
          networkPolicyRef: savedSnapshot.networkPolicyRef,
          endpointRef: entry.ref,
          riskLevel: entry.riskLevel,
          approvalRequired: binding?.approvalRequired ?? entry.approvalRequired,
          healthStatus: savedSnapshot.status,
          latencyMs: savedSnapshot.latencyMs,
          toolCount: savedSnapshot.toolCount,
          occurredAt: savedSnapshot.probedAt,
        });
        return savedSnapshot;
      }
    }

    const probe = await probeMcpTarget({
      entry,
      timeoutMs: getApiRuntimeConfig().mcpProbeTimeoutMs,
    });
    const snapshot = buildHealthSnapshotRecord({
      entry,
      binding,
      workspaceId: actor.workspaceId,
      requestedByUserId: actor.userId,
      networkPolicyRef: resolveNetworkPolicyRef(entry, binding),
      status: probe.status,
      detail: probe.detail,
      errorCode: probe.errorCode,
      httpStatus: probe.httpStatus,
      latencyMs: probe.latencyMs,
      toolCount: probe.toolCount,
      toolNames: probe.toolNames ?? [],
      policyEnforced: supportsRuntimeNetworkPolicy(entry),
    });

    const savedSnapshot = await mcpRepository.saveHealthSnapshot(snapshot);
    await mcpGovernanceAuditService.recordEvent({
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      runId: null,
      mcpId: entry.mcpId,
      bindingId: binding?.bindingId ?? null,
      action: "connector.tested",
      outcome: toProbeGovernanceOutcome(savedSnapshot.status),
      reasonCode: savedSnapshot.errorCode,
      reasonDetail: savedSnapshot.detail,
      displayName: entry.displayName,
      source: entry.source,
      transport: entry.transport,
      scope: binding?.scope ?? null,
      scopeRef: binding?.scopeRef ?? null,
      credentialId: resolveEffectiveCredentialId(entry, binding),
      networkPolicyRef: savedSnapshot.networkPolicyRef,
      endpointRef: entry.ref,
      riskLevel: entry.riskLevel,
      approvalRequired: binding?.approvalRequired ?? entry.approvalRequired,
      healthStatus: savedSnapshot.status,
      latencyMs: savedSnapshot.latencyMs,
      toolCount: savedSnapshot.toolCount,
      occurredAt: savedSnapshot.probedAt,
    });
    return savedSnapshot;
  }

  listBindings(
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    query: ListMcpBindingsQuery
  ) {
    const parsed = listMcpBindingsQuerySchema.parse(query);
    return mcpRepository
      .listBindings()
      .filter(
        (binding) =>
          binding.workspaceId === actor.workspaceId &&
          canSeeUserBinding(binding, actor) &&
          (!parsed.scope || binding.scope === parsed.scope) &&
          (!parsed.status || binding.status === parsed.status) &&
          (!parsed.mcpId || binding.mcpId === parsed.mcpId)
      )
      .map((binding) => mcpBindingRecordSchema.parse(binding));
  }

  async createBinding(
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    input: CreateMcpBindingInput
  ) {
    const parsed = createMcpBindingInputSchema.parse(input);
    const entry = this.getMcp(parsed.mcpId, {
      workspaceId: actor.workspaceId,
    });

    if (parsed.scope !== "user" && !canManageWorkspaceMcp(actor.role)) {
      throw new AppError(
        403,
        "MCP_BINDING_MANAGE_FORBIDDEN",
        `Role ${actor.role} cannot create ${parsed.scope} bindings`
      );
    }

    if (parsed.scope === "user" && parsed.scopeRef && parsed.scopeRef !== actor.userId && actor.role !== "owner" && actor.role !== "admin") {
      throw new AppError(
        403,
        "MCP_BINDING_MANAGE_FORBIDDEN",
        `Role ${actor.role} cannot create another user's binding`
      );
    }

    if (parsed.credentialId) {
      credentialsService.getCredentialForActor(parsed.credentialId, actor);
    }

    if (!supportsRuntimeNetworkPolicy(entry) && parsed.networkPolicyRef != null) {
      throw new AppError(
        400,
        "MCP_NETWORK_POLICY_UNSUPPORTED",
        `stdio MCP ${entry.mcpId} does not accept network policy overrides`
      );
    }

    if (supportsRuntimeNetworkPolicy(entry)) {
      assertEntryNetworkPolicyRef(
        entry,
        parsed.networkPolicyRef,
        { workspaceId: actor.workspaceId }
      );
    }

    const createdAt = nowIso();
    const binding = mcpBindingRecordSchema.parse({
      bindingId: nextBindingId(),
      mcpId: entry.mcpId,
      workspaceId: actor.workspaceId,
      scope: parsed.scope,
      scopeRef: resolveImplicitScopeRef({
        scope: parsed.scope,
        scopeRef: parsed.scopeRef,
        workspaceId: actor.workspaceId,
        userId: actor.userId,
      }),
      credentialId: parsed.credentialId,
      status: "active",
      networkPolicyRef: parsed.networkPolicyRef,
      approvalRequired: parsed.approvalRequired,
      autoAttach: parsed.autoAttach,
      notes: parsed.notes,
      createdAt,
      updatedAt: createdAt,
    });

    const saved = await mcpRepository.saveBinding(binding);
    await mcpGovernanceAuditService.recordBindingEvent({
      actor,
      entry,
      binding: saved,
      action: "connector.bound",
    });
    return saved;
  }

  async updateBinding(
    bindingId: string,
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    input: UpdateMcpBindingInput
  ) {
    const parsed = updateMcpBindingInputSchema.parse(input);
    const current = mcpRepository.getBinding(bindingId);
    if (!current) {
      throw new AppError(404, "MCP_BINDING_NOT_FOUND", `Binding not found: ${bindingId}`);
    }

    ensureBindingManageable(current, actor);
    if (parsed.credentialId) {
      credentialsService.getCredentialForActor(parsed.credentialId, actor);
    }
    const entry = this.getMcp(current.mcpId, {
      workspaceId: actor.workspaceId,
    });
    const next = mcpBindingRecordSchema.parse({
      ...current,
      ...parsed,
      updatedAt: nowIso(),
    });
    if (!supportsRuntimeNetworkPolicy(entry) && next.networkPolicyRef != null) {
      throw new AppError(
        400,
        "MCP_NETWORK_POLICY_UNSUPPORTED",
        `stdio MCP ${entry.mcpId} does not accept network policy overrides`
      );
    }
    if (supportsRuntimeNetworkPolicy(entry)) {
      assertEntryNetworkPolicyRef(
        entry,
        next.networkPolicyRef,
        { workspaceId: actor.workspaceId }
      );
    }

    const saved = await mcpRepository.saveBinding(next);
    await mcpGovernanceAuditService.recordBindingEvent({
      actor,
      entry,
      binding: saved,
      action: "connector.binding_updated",
    });
    return saved;
  }

  async resolveRunContext(params: {
    runId: string;
    workspaceId: string;
    requestedByUserId: string | null | undefined;
    sessionVersionId: string | null;
    bindings: CreateRunBinding;
  }) {
    const visibleEntries = visibleRegistryEntriesForWorkspace(params.workspaceId);
    const entryById = new Map(visibleEntries.map((entry) => [entry.mcpId, entry]));
    const applicableBindings = mcpRepository
      .listBindings()
      .filter((binding) => {
        if (binding.workspaceId !== params.workspaceId || binding.status !== "active") {
          return false;
        }

        switch (binding.scope) {
          case "workspace":
            return binding.scopeRef === params.workspaceId;
          case "user":
            return params.requestedByUserId != null && binding.scopeRef === params.requestedByUserId;
          case "session-version":
            return binding.scopeRef === params.sessionVersionId;
          case "run":
          default:
            return false;
        }
      })
      .sort(
        (left, right) => resolveBindingPriority(right.scope) - resolveBindingPriority(left.scope)
      );

    const bestBindingByMcpId = new Map<string, McpBindingRecord>();
    for (const binding of applicableBindings) {
      if (!bestBindingByMcpId.has(binding.mcpId)) {
        bestBindingByMcpId.set(binding.mcpId, binding);
      }
    }

    const explicitIds = [
      ...params.bindings.firstPartyMcpIds,
      ...params.bindings.externalConnectorRefs,
    ];
    const autoAttachedIds = [...bestBindingByMcpId.values()]
      .filter((binding) => binding.autoAttach)
      .map((binding) => binding.mcpId);
    const selectedIds = [...new Set([...explicitIds, ...autoAttachedIds])];
    const firstPartyMcpIds: string[] = [];
    const externalConnectorRefs: string[] = [];
    const selectedEntries: McpRegistryEntry[] = [];
    const selectedBindings: McpBindingRecord[] = [];
    const selectedPolicies: McpNetworkPolicy[] = [];
    const selectedPolicyRefs = new Set<string>();
    const credentialIds: string[] = [...new Set(params.bindings.credentialIds)];
    for (const mcpId of selectedIds) {
      const binding = bestBindingByMcpId.get(mcpId);
      const entry = entryById.get(mcpId);
      if (!entry) {
        if (isKnownFirstPartyMcpId(mcpId)) {
          firstPartyMcpIds.push(mcpId);
          const effectiveCredentialId = binding?.credentialId ?? getKnownFirstPartyDefaultCredentialId(mcpId);
          if (isNonEmptyString(effectiveCredentialId)) {
            credentialIds.push(effectiveCredentialId);
          }
          continue;
        }

        await mcpGovernanceAuditService.recordEvent({
          workspaceId: params.workspaceId,
          actorUserId: params.requestedByUserId ?? null,
          runId: params.runId,
          mcpId,
          bindingId: binding?.bindingId ?? null,
          action: "external_call.blocked",
          outcome: "blocked",
          reasonCode: "RUN_MCP_NOT_REGISTERED",
          reasonDetail: `MCP ${mcpId} must be registered before it can be attached to a run`,
          displayName: null,
          source: null,
          transport: null,
          scope: binding?.scope ?? null,
          scopeRef: binding?.scopeRef ?? null,
          credentialId: binding?.credentialId ?? null,
          networkPolicyRef: binding?.networkPolicyRef ?? null,
          endpointRef: null,
          riskLevel: null,
          approvalRequired: binding?.approvalRequired ?? null,
          healthStatus: null,
          latencyMs: null,
          toolCount: null,
          occurredAt: nowIso(),
        });
        throw new AppError(
          409,
          "RUN_MCP_NOT_REGISTERED",
          `MCP ${mcpId} must be registered before it can be attached to a run`
        );
      }

      try {
        assertRunEntryAvailable(entry, binding, params.workspaceId);
      } catch (error) {
        if (error instanceof AppError) {
          await mcpGovernanceAuditService.recordEvent({
            workspaceId: params.workspaceId,
            actorUserId: params.requestedByUserId ?? null,
            runId: params.runId,
            mcpId: entry.mcpId,
            bindingId: binding?.bindingId ?? null,
            action: "external_call.blocked",
            outcome: "blocked",
            reasonCode: error.code,
            reasonDetail: error.message,
            displayName: entry.displayName,
            source: entry.source,
            transport: entry.transport,
            scope: binding?.scope ?? null,
            scopeRef: binding?.scopeRef ?? null,
            credentialId: resolveEffectiveCredentialId(entry, binding),
            networkPolicyRef: resolveNetworkPolicyRef(entry, binding),
            endpointRef: entry.ref,
            riskLevel: entry.riskLevel,
            approvalRequired: binding?.approvalRequired ?? entry.approvalRequired,
            healthStatus: null,
            latencyMs: null,
            toolCount: null,
            occurredAt: nowIso(),
          });
        }
        throw error;
      }
      selectedEntries.push(entry);
      if (binding) {
        selectedBindings.push(binding);
      }
      if (supportsRuntimeNetworkPolicy(entry)) {
        const policyRef = resolveNetworkPolicyRef(entry, binding);
        if (policyRef && !selectedPolicyRefs.has(policyRef)) {
          selectedPolicies.push(
            resolveVisibleNetworkPolicy(policyRef, {
              workspaceId: params.workspaceId,
            })
          );
          selectedPolicyRefs.add(policyRef);
        }
      }

      if (entry.source === "first-party") {
        firstPartyMcpIds.push(mcpId);
      } else {
        externalConnectorRefs.push(mcpId);
      }

      await mcpGovernanceAuditService.recordEvent({
        workspaceId: params.workspaceId,
        actorUserId: params.requestedByUserId ?? null,
        runId: params.runId,
        mcpId: entry.mcpId,
        bindingId: binding?.bindingId ?? null,
        action: "connector.bound_to_run",
        outcome: "success",
        reasonCode: null,
        reasonDetail: null,
        displayName: entry.displayName,
        source: entry.source,
        transport: entry.transport,
        scope: binding?.scope ?? null,
        scopeRef: binding?.scopeRef ?? null,
        credentialId: resolveEffectiveCredentialId(entry, binding),
        networkPolicyRef: resolveNetworkPolicyRef(entry, binding),
        endpointRef: entry.ref,
        riskLevel: entry.riskLevel,
        approvalRequired: binding?.approvalRequired ?? entry.approvalRequired,
        healthStatus: null,
        latencyMs: null,
        toolCount: null,
        occurredAt: nowIso(),
      });

      if (isNonEmptyString(binding?.credentialId)) {
        credentialIds.push(binding.credentialId);
        continue;
      }

      if (isNonEmptyString(entry.defaultCredentialId)) {
        credentialIds.push(entry.defaultCredentialId);
      }
    }

    return {
      effectiveBindings: {
        firstPartyMcpIds,
        externalConnectorRefs,
        credentialIds: [...new Set(credentialIds)],
      } satisfies CreateRunBinding,
      registryEntries: selectedEntries,
      bindingRecords: selectedBindings,
      networkPolicies: selectedPolicies,
    };
  }
}

export async function initializeMcpInfrastructure() {
  await Promise.all([
    mcpRepository.init(),
    initializeMcpCallAuditInfrastructure(),
    initializeMcpGovernanceAuditInfrastructure(),
  ]);
}

export const mcpService = new McpService();
