import type { QuotaMetric, RunRecord } from "@lingban/contracts";

export function buildRunQuotaUsageContext(
  run: Pick<
    RunRecord,
    | "runId"
    | "workspaceId"
    | "requestedByUserId"
    | "taskVersionId"
    | "sessionVersionId"
    | "entrySurface"
    | "catalogMetadata"
  >,
  options: {
    metric: QuotaMetric;
    delta: number;
    requestedByUserId?: string | null;
    note?: string | null;
  }
) {
  return {
    workspaceId: run.workspaceId,
    workspaceContextKey: run.catalogMetadata?.workspaceContextKey ?? null,
    requestedByUserId: options.requestedByUserId ?? run.requestedByUserId ?? null,
    serviceId: run.catalogMetadata?.serviceId ?? null,
    taskVersionId: run.taskVersionId,
    sessionVersionId: run.sessionVersionId,
    entrySurface: run.entrySurface,
    packageIds: [],
    metric: options.metric,
    delta: options.delta,
    runId: run.runId,
    note: options.note ?? null,
  };
}
