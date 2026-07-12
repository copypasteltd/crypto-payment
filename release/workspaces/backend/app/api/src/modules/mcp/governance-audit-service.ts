import { createHash, randomUUID } from "node:crypto";
import {
  listMcpGovernanceEventsQuerySchema,
  mcpGovernanceEventSchema,
  type ListMcpGovernanceEventsQuery,
  type McpBindingRecord,
  type McpGovernanceEvent,
  type McpRegistryEntry,
  type WorkspaceRole,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { mcpGovernanceAuditRepository } from "./governance-audit-repository.js";

type McpGovernanceActor = {
  workspaceId: string;
  role: WorkspaceRole;
};

type RecordMcpGovernanceEventInput = Omit<
  McpGovernanceEvent,
  "eventId" | "recordedAt" | "endpointHash"
> & {
  eventId?: string;
  recordedAt?: string;
  endpointHash?: string | null;
};

function roleRank(role: WorkspaceRole) {
  switch (role) {
    case "owner":
      return 5;
    case "admin":
      return 4;
    case "operator":
      return 3;
    case "creator":
      return 2;
    case "viewer":
    default:
      return 1;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function hashEndpointRef(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return createHash("sha256").update(value).digest("hex");
}

function matchesQuery(record: McpGovernanceEvent, query: ListMcpGovernanceEventsQuery) {
  if (query.runId && record.runId !== query.runId) {
    return false;
  }

  if (query.mcpId && record.mcpId !== query.mcpId) {
    return false;
  }

  if (query.bindingId && record.bindingId !== query.bindingId) {
    return false;
  }

  if (query.action && record.action !== query.action) {
    return false;
  }

  if (query.outcome && record.outcome !== query.outcome) {
    return false;
  }

  if (query.from && record.occurredAt < query.from) {
    return false;
  }

  if (query.to && record.occurredAt > query.to) {
    return false;
  }

  return true;
}

export class McpGovernanceAuditService {
  async init() {
    await mcpGovernanceAuditRepository.init();
  }

  async recordEvent(input: RecordMcpGovernanceEventInput) {
    const occurredAt = input.occurredAt ?? nowIso();
    const record = mcpGovernanceEventSchema.parse({
      ...input,
      eventId: input.eventId ?? `mcpgov_${randomUUID().replace(/-/g, "")}`,
      endpointHash:
        input.endpointHash ?? hashEndpointRef(input.endpointRef),
      occurredAt,
      recordedAt: input.recordedAt ?? occurredAt,
    });

    await mcpGovernanceAuditRepository.save(record);
    return record;
  }

  listEvents(
    actor: McpGovernanceActor,
    query: ListMcpGovernanceEventsQuery = {}
  ) {
    if (roleRank(actor.role) < roleRank("creator")) {
      throw new AppError(
        403,
        "MCP_GOVERNANCE_AUDIT_FORBIDDEN",
        "Current role cannot view MCP governance audit records."
      );
    }

    const parsed = listMcpGovernanceEventsQuerySchema.parse(query);
    return mcpGovernanceAuditRepository
      .list()
      .filter(
        (record) =>
          record.workspaceId === actor.workspaceId &&
          matchesQuery(record, parsed)
      )
      .slice(0, parsed.limit ?? 200);
  }

  async recordConnectorRegistered(
    actor: { workspaceId: string; userId: string | null | undefined },
    entry: Pick<
      McpRegistryEntry,
      | "mcpId"
      | "displayName"
      | "source"
      | "transport"
      | "ref"
      | "riskLevel"
      | "approvalRequired"
      | "defaultCredentialId"
      | "defaultNetworkPolicyRef"
    >
  ) {
    return await this.recordEvent({
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId ?? null,
      runId: null,
      mcpId: entry.mcpId,
      bindingId: null,
      action: "connector.registered",
      outcome: "success",
      reasonCode: null,
      reasonDetail: null,
      displayName: entry.displayName,
      source: entry.source,
      transport: entry.transport,
      scope: null,
      scopeRef: null,
      credentialId: entry.defaultCredentialId,
      networkPolicyRef: entry.defaultNetworkPolicyRef,
      endpointRef: entry.ref,
      riskLevel: entry.riskLevel,
      approvalRequired: entry.approvalRequired,
      healthStatus: null,
      latencyMs: null,
      toolCount: null,
      occurredAt: nowIso(),
    });
  }

  async recordBindingEvent(input: {
    actor: { workspaceId: string; userId: string | null | undefined };
    entry: Pick<
      McpRegistryEntry,
      | "mcpId"
      | "displayName"
      | "source"
      | "transport"
      | "ref"
      | "riskLevel"
    >;
    binding: Pick<
      McpBindingRecord,
      | "bindingId"
      | "scope"
      | "scopeRef"
      | "credentialId"
      | "networkPolicyRef"
      | "approvalRequired"
    >;
    action: "connector.bound" | "connector.binding_updated";
  }) {
    return await this.recordEvent({
      workspaceId: input.actor.workspaceId,
      actorUserId: input.actor.userId ?? null,
      runId: null,
      mcpId: input.entry.mcpId,
      bindingId: input.binding.bindingId,
      action: input.action,
      outcome: "success",
      reasonCode: null,
      reasonDetail: null,
      displayName: input.entry.displayName,
      source: input.entry.source,
      transport: input.entry.transport,
      scope: input.binding.scope,
      scopeRef: input.binding.scopeRef,
      credentialId: input.binding.credentialId,
      networkPolicyRef: input.binding.networkPolicyRef,
      endpointRef: input.entry.ref,
      riskLevel: input.entry.riskLevel,
      approvalRequired: input.binding.approvalRequired,
      healthStatus: null,
      latencyMs: null,
      toolCount: null,
      occurredAt: nowIso(),
    });
  }
}

export const mcpGovernanceAuditService = new McpGovernanceAuditService();

export async function initializeMcpGovernanceAuditInfrastructure() {
  await mcpGovernanceAuditService.init();
}
