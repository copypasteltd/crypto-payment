import {
  listMcpCallsQuerySchema,
  mcpCallRecordSchema,
  type ListMcpCallsQuery,
  type McpCallRecord,
  type RunRecord,
  type WorkspaceRole,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { mcpCallAuditRepository } from "./call-audit-repository.js";

type McpCallAuditActor = {
  workspaceId: string;
  role: WorkspaceRole;
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

function matchesQuery(record: McpCallRecord, query: ListMcpCallsQuery) {
  if (query.workspaceContextKey && record.workspaceContextKey !== query.workspaceContextKey) {
    return false;
  }

  if (query.serviceId && record.serviceId !== query.serviceId) {
    return false;
  }

  if (query.runId && record.runId !== query.runId) {
    return false;
  }

  if (query.mcpId && record.mcpId !== query.mcpId) {
    return false;
  }

  if (query.toolName && record.toolName !== query.toolName) {
    return false;
  }

  if (query.status && record.status !== query.status) {
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

export class McpCallAuditService {
  async init() {
    await mcpCallAuditRepository.init();
  }

  async recordCallForRun(run: RunRecord, record: McpCallRecord) {
    const existing = mcpCallAuditRepository.getById(record.callId);
    const normalized = mcpCallRecordSchema.parse({
      ...record,
      runId: run.runId,
      workspaceId: run.workspaceId,
      requestedByUserId: run.requestedByUserId ?? null,
      workspaceContextKey: run.catalogMetadata?.workspaceContextKey ?? null,
      serviceId: run.catalogMetadata?.serviceId ?? null,
      taskVersionId: run.taskVersionId,
      sessionVersionId: run.sessionVersionId,
      entrySurface: run.entrySurface,
      occurredAt: record.occurredAt ?? record.finishedAt,
      recordedAt: record.recordedAt ?? nowIso(),
    });

    await mcpCallAuditRepository.save(normalized);

    return {
      record: normalized,
      isFirstSeen: existing == null,
    };
  }

  listCalls(actor: McpCallAuditActor, query: ListMcpCallsQuery = {}) {
    if (roleRank(actor.role) < roleRank("creator")) {
      throw new AppError(403, "MCP_CALL_AUDIT_FORBIDDEN", "Current role cannot view MCP audit records.");
    }

    const parsed = listMcpCallsQuerySchema.parse(query);
    return mcpCallAuditRepository
      .list()
      .filter(
        (record) =>
          record.workspaceId === actor.workspaceId &&
          matchesQuery(record, parsed)
      )
      .slice(0, parsed.limit ?? 200);
  }

  listRunCalls(runId: string) {
    return mcpCallAuditRepository.list().filter((record) => record.runId === runId);
  }
}

export const mcpCallAuditService = new McpCallAuditService();

export async function initializeMcpCallAuditInfrastructure() {
  await mcpCallAuditService.init();
}
