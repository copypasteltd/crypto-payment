import { randomUUID } from "node:crypto";
import {
  billingEntrySchema,
  billingLedgerSummaryQuerySchema,
  billingLedgerSummarySchema,
  billingMetricSummarySchema,
  listBillingEntriesQuerySchema,
  type BillingCostBasis,
  type BillingEntry,
  type BillingLedgerSummary,
  type BillingLedgerSummaryQuery,
  type BillingSource,
  type ListBillingEntriesQuery,
  type QuotaMetric,
  type WorkspaceRole,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { creatorRepository } from "../creator/repository.js";
import { billingRepository } from "./repository.js";

type BillingActor = {
  userId: string;
  role: WorkspaceRole;
  workspaceId: string;
  workspaceContextKey?: string | null;
};

type BillingUsageContext = {
  workspaceId: string;
  workspaceContextKey: string | null;
  requestedByUserId: string | null;
  serviceId: string | null;
  taskVersionId: string | null;
  sessionVersionId: string | null;
  entrySurface: string | null;
  packageIds: string[];
  metric: QuotaMetric;
  quantity: number;
  source: BillingSource;
  sourceRef?: string | null;
  runId?: string | null;
  note?: string | null;
  costBasis?: BillingCostBasis;
  entryId?: string | null;
};

type ScopedBillingQuery = {
  workspaceId: string;
  workspaceContextKey?: string | null;
  packageId?: string | null;
  serviceId?: string | null;
  metric?: QuotaMetric | null;
  source?: BillingSource | null;
  runId?: string | null;
  from?: string | null;
  to?: string | null;
};

type ResolvedBillingUsageContext = BillingUsageContext & {
  packageIds: string[];
};

function l(zh: string, en: string) {
  return { zh, en };
}

function nowIso() {
  return new Date().toISOString();
}

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

function roundAmount(value: number, digits = 8) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function metricLabel(metric: QuotaMetric) {
  switch (metric) {
    case "browser_minutes":
      return l("浏览器分钟", "Browser minutes");
    case "model_tokens":
      return l("模型 Token", "Model tokens");
    case "image_credits":
      return l("图像额度", "Image credits");
    case "storage_bytes":
      return l("存储字节", "Storage bytes");
    case "download_bytes":
      return l("下载字节", "Download bytes");
    case "audit_exports":
      return l("审计导出", "Audit exports");
    case "mcp_calls":
      return l("MCP 调用", "MCP calls");
    case "replays":
      return l("回放次数", "Replays");
    case "active_runs":
      return l("并发实例", "Active runs");
    case "daily_runs":
      return l("单日实例", "Daily runs");
    case "ws_connections":
      return l("实时连接", "WS connections");
    default:
      return l(metric, metric);
  }
}

const BILLING_PRICING: Record<
  QuotaMetric,
  {
    unitPriceUsd: number;
  }
> = {
  active_runs: { unitPriceUsd: 0 },
  daily_runs: { unitPriceUsd: 0 },
  browser_minutes: { unitPriceUsd: 0.03 },
  model_tokens: { unitPriceUsd: 0.000002 },
  image_credits: { unitPriceUsd: 0.04 },
  mcp_calls: { unitPriceUsd: 0.0015 },
  storage_bytes: { unitPriceUsd: 0.0000000002 },
  download_bytes: { unitPriceUsd: 0.0000000004 },
  audit_exports: { unitPriceUsd: 0.02 },
  replays: { unitPriceUsd: 0.05 },
  ws_connections: { unitPriceUsd: 0 },
};

function matchesScopedMetadata(entry: BillingEntry, query: ScopedBillingQuery) {
  if (entry.workspaceId !== query.workspaceId) {
    return false;
  }

  if (query.workspaceContextKey && entry.workspaceContextKey !== query.workspaceContextKey) {
    return false;
  }

  if (query.packageId && entry.packageId !== query.packageId) {
    return false;
  }

  if (query.serviceId && entry.serviceId !== query.serviceId) {
    return false;
  }

  if (query.metric && entry.metric !== query.metric) {
    return false;
  }

  if (query.source && entry.source !== query.source) {
    return false;
  }

  if (query.runId && entry.runId !== query.runId) {
    return false;
  }

  if (query.from && entry.occurredAt < query.from) {
    return false;
  }

  if (query.to && entry.occurredAt > query.to) {
    return false;
  }

  return true;
}

function latestIso(values: Array<string | null | undefined>) {
  const filtered = values.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (filtered.length === 0) {
    return null;
  }

  return [...filtered].sort((left, right) => right.localeCompare(left))[0] ?? null;
}

export class BillingService {
  async init() {
    await creatorRepository.init();
    await billingRepository.init();
  }

  private assertCanView(actor: BillingActor) {
    if (roleRank(actor.role) < roleRank("creator")) {
      throw new AppError(403, "BILLING_VIEW_FORBIDDEN", "Current role cannot view billing ledgers.");
    }
  }

  private resolveRelatedPackageIds(input: {
    sessionVersionId: string | null;
    taskVersionId: string | null;
    serviceId: string | null;
  }) {
    return creatorRepository
      .listPackages()
      .filter((pkg) => {
        if (input.serviceId && pkg.linkedServiceIds.includes(input.serviceId)) {
          return true;
        }

        const versionHaystack = pkg.versionLine.join(" ");
        if (input.sessionVersionId && versionHaystack.includes(input.sessionVersionId)) {
          return true;
        }

        if (input.taskVersionId && versionHaystack.includes(input.taskVersionId)) {
          return true;
        }

        return false;
      })
      .map((pkg) => pkg.packageId);
  }

  private normalizeUsageContext(context: BillingUsageContext): ResolvedBillingUsageContext {
    const packageIds =
      context.packageIds.length > 0
        ? context.packageIds
        : this.resolveRelatedPackageIds({
            sessionVersionId: context.sessionVersionId,
            taskVersionId: context.taskVersionId,
            serviceId: context.serviceId,
          });

    return {
      ...context,
      packageIds,
    };
  }

  async recordUsage(context: BillingUsageContext) {
    const normalized = this.normalizeUsageContext(context);
    const pricing = BILLING_PRICING[normalized.metric];
    const occurredAt = nowIso();
    const entryId =
      normalized.entryId?.trim() ||
      (normalized.sourceRef
        ? `ble_${normalized.source}_${normalized.metric}_${normalized.sourceRef.replace(/[^a-zA-Z0-9_-]+/g, "_")}`
        : `ble_${randomUUID()}`);

    const entry = billingEntrySchema.parse({
      entryId,
      workspaceId: normalized.workspaceId,
      workspaceContextKey: normalized.workspaceContextKey,
      packageId: normalized.packageIds[0] ?? null,
      serviceId: normalized.serviceId,
      taskVersionId: normalized.taskVersionId,
      sessionVersionId: normalized.sessionVersionId,
      entrySurface: normalized.entrySurface,
      runId: normalized.runId ?? null,
      requestedByUserId: normalized.requestedByUserId,
      metric: normalized.metric,
      quantity: roundAmount(normalized.quantity),
      unitPriceUsd: pricing.unitPriceUsd,
      amountUsd: roundAmount(normalized.quantity * pricing.unitPriceUsd),
      currency: "USD",
      source: normalized.source,
      costBasis: normalized.costBasis ?? "estimated",
      sourceRef: normalized.sourceRef ?? null,
      note: normalized.note ?? null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      occurredAt,
    });

    await billingRepository.saveEntry(entry);
    return entry;
  }

  estimateUsage(metric: QuotaMetric, quantity: number) {
    const pricing = BILLING_PRICING[metric];
    return {
      metric,
      label: metricLabel(metric),
      quantity: roundAmount(quantity),
      unitPriceUsd: pricing.unitPriceUsd,
      amountUsd: roundAmount(quantity * pricing.unitPriceUsd),
      currency: "USD" as const,
    };
  }

  async recordRunRuntimeEstimate(run: {
    run: {
      runId: string;
      workspaceId: string;
      requestedByUserId?: string | null;
      taskVersionId: string;
      sessionVersionId: string;
      entrySurface: string;
      createdAt: string;
      updatedAt: string;
      catalogMetadata?: {
        workspaceContextKey?: string | null;
        serviceId?: string | null;
      } | null;
    };
    runtime?: {
      startedAt?: string | null;
      finishedAt?: string | null;
    } | null;
  }) {
    const startedAt = run.runtime?.startedAt ?? run.run.createdAt;
    const finishedAt = run.runtime?.finishedAt ?? run.run.updatedAt;
    const durationMs =
      new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    const quantity = Math.max(1, Math.ceil(Math.max(durationMs, 0) / 60_000));

    return this.recordUsage({
      workspaceId: run.run.workspaceId,
      workspaceContextKey: run.run.catalogMetadata?.workspaceContextKey ?? null,
      requestedByUserId: run.run.requestedByUserId ?? null,
      serviceId: run.run.catalogMetadata?.serviceId ?? null,
      taskVersionId: run.run.taskVersionId,
      sessionVersionId: run.run.sessionVersionId,
      entrySurface: run.run.entrySurface,
      packageIds: [],
      metric: "browser_minutes",
      quantity,
      source: "runtime-estimate",
      sourceRef: run.run.runId,
      runId: run.run.runId,
      note: `Estimated runtime minutes recorded for run ${run.run.runId}.`,
      costBasis: "estimated",
      entryId: `ble_runtime_estimate_${run.run.runId}`,
    });
  }

  listEntries(actor: BillingActor, query: ListBillingEntriesQuery = {}) {
    this.assertCanView(actor);
    const parsed = listBillingEntriesQuerySchema.parse(query);
    const entries = billingRepository
      .listEntries()
      .filter((entry) =>
        matchesScopedMetadata(entry, {
          workspaceId: actor.workspaceId,
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          metric: parsed.metric,
          source: parsed.source,
          runId: parsed.runId,
          from: parsed.from,
          to: parsed.to,
        })
      )
      .filter((entry) => !parsed.costBasis || entry.costBasis === parsed.costBasis);

    return entries.slice(0, parsed.limit ?? 200);
  }

  private summarizeEntries(
    workspaceId: string,
    entries: BillingEntry[],
    context: {
      workspaceContextKey?: string | null;
      packageId?: string | null;
      serviceId?: string | null;
      runId?: string | null;
    } = {}
  ): BillingLedgerSummary {
    const metricsMap = new Map<QuotaMetric, BillingEntry[]>();

    for (const entry of entries) {
      const bucket = metricsMap.get(entry.metric) ?? [];
      bucket.push(entry);
      metricsMap.set(entry.metric, bucket);
    }

    const metricSummaries = [...metricsMap.entries()]
      .map(([metric, metricEntries]) =>
        billingMetricSummarySchema.parse({
          metric,
          quantity: roundAmount(
            metricEntries.reduce((sum, entry) => sum + entry.quantity, 0)
          ),
          amountUsd: roundAmount(
            metricEntries.reduce((sum, entry) => sum + entry.amountUsd, 0)
          ),
          entriesCount: metricEntries.length,
          currency: "USD",
          latestOccurredAt: latestIso(metricEntries.map((entry) => entry.occurredAt)),
          label: metricLabel(metric),
        })
      )
      .sort((left, right) => right.amountUsd - left.amountUsd || left.metric.localeCompare(right.metric));

    return billingLedgerSummarySchema.parse({
      workspaceId,
      workspaceContextKey: context.workspaceContextKey ?? null,
      packageId: context.packageId ?? null,
      serviceId: context.serviceId ?? null,
      runId: context.runId ?? null,
      currency: "USD",
      totalAmountUsd: roundAmount(
        entries.reduce((sum, entry) => sum + entry.amountUsd, 0)
      ),
      totalEntriesCount: entries.length,
      metrics: metricSummaries,
      updatedAt: latestIso(entries.map((entry) => entry.updatedAt)),
    });
  }

  getSummary(actor: BillingActor, query: BillingLedgerSummaryQuery = {}) {
    this.assertCanView(actor);
    const parsed = billingLedgerSummaryQuerySchema.parse(query);
    const entries = billingRepository
      .listEntries()
      .filter((entry) =>
        matchesScopedMetadata(entry, {
          workspaceId: actor.workspaceId,
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          runId: parsed.runId,
          from: parsed.from,
          to: parsed.to,
        })
      );

    return this.summarizeEntries(actor.workspaceId, entries, parsed);
  }

  getScopedSnapshot(query: ScopedBillingQuery) {
    const entries = billingRepository
      .listEntries()
      .filter((entry) => matchesScopedMetadata(entry, query));

    return {
      entries,
      summary: this.summarizeEntries(query.workspaceId, entries, query),
    };
  }
}

export const billingService = new BillingService();

export async function initializeBillingInfrastructure() {
  await billingService.init();
}
