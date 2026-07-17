import {
  createQuotaPolicyInputSchema,
  decideQuotaOverrideInputSchema,
  listQuotaCountersQuerySchema,
  listQuotaEventsQuerySchema,
  listQuotaOverridesQuerySchema,
  listQuotaPoliciesQuerySchema,
  quotaCounterSchema,
  quotaDecisionPreviewSchema,
  quotaEventSchema,
  quotaOverrideRecordSchema,
  quotaPolicySchema,
  updateQuotaPolicyInputSchema,
  type CreateQuotaPolicyInput,
  type DecideQuotaOverrideInput,
  type ListQuotaCountersQuery,
  type ListQuotaEventsQuery,
  type ListQuotaOverridesQuery,
  type ListQuotaPoliciesQuery,
  type QuotaCounter,
  type QuotaDecisionKind,
  type QuotaDecisionPreview,
  type QuotaEvent,
  type QuotaEventDecision,
  type QuotaMetric,
  type QuotaOverrideRecord,
  type QuotaPolicy,
  type QuotaScopeType,
  type QuotaWindowType,
  type RunApproval,
  type WorkspaceRole,
} from "@lingban/contracts";
import {
  evaluateQuotaPolicyValue,
  quotaDecisionSeverity,
  resolveQuotaWindowRange,
} from "@lingban/domain-models";
import { AppError } from "../../app/errors.js";
import { creatorRepository } from "../creator/repository.js";
import { runsRepository } from "../runs/repository.js";
import { quotaRepository } from "./repository.js";

type QuotaActor = {
  userId: string;
  role: WorkspaceRole;
  workspaceId: string;
  workspaceContextKey?: string | null;
};

type ScopedQuotaQuery = {
  workspaceId: string;
  workspaceContextKey?: string | null;
  packageId?: string | null;
  serviceId?: string | null;
  metric?: QuotaMetric | null;
  scopeType?: QuotaScopeType | null;
  runId?: string | null;
};

type RunCreateQuotaContext = {
  runId: string;
  workspaceId: string;
  workspaceContextKey: string | null;
  requestedByUserId: string | null;
  serviceId: string | null;
  taskVersionId: string | null;
  sessionVersionId: string | null;
  entrySurface: string;
  packageIds: string[];
};

type UsageContext = {
  workspaceId: string;
  workspaceContextKey: string | null;
  requestedByUserId: string | null;
  serviceId: string | null;
  taskVersionId: string | null;
  sessionVersionId: string | null;
  entrySurface: string | null;
  packageIds: string[];
  metric: QuotaMetric;
  delta: number;
  runId?: string | null;
  note?: string | null;
};

type ResolvedUsageContext = UsageContext & {
  packageIds: string[];
};

type PreparedCounterUpdate = {
  policy: QuotaPolicy;
  counter: QuotaCounter;
  persist: boolean;
};

type PreparedQuotaEvaluation = {
  decision: QuotaDecisionKind;
  eventDecision: QuotaEventDecision | null;
  policy: QuotaPolicy | null;
  currentValue: number | null;
  limitValue: number | null;
  counterUpdates: PreparedCounterUpdate[];
  summary: { zh: string; en: string } | null;
  overrideDraft: QuotaOverrideRecord | null;
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

function quotaScopeLabel(scopeType: QuotaScopeType) {
  switch (scopeType) {
    case "workspace":
      return l("工作区", "Workspace");
    case "workspace-context":
      return l("工作区上下文", "Workspace context");
    case "service":
      return l("服务", "Service");
    case "task-version":
      return l("任务版本", "Task version");
    case "session-version":
      return l("Session 版本", "Session version");
    case "package":
      return l("Creator 包", "Creator package");
    case "entry-surface":
      return l("入口", "Entry surface");
    case "user":
    default:
      return l("用户", "User");
  }
}

function quotaMetricLabel(metric: QuotaMetric) {
  switch (metric) {
    case "active_runs":
      return l("活跃实例数", "Active runs");
    case "daily_runs":
      return l("单日实例数", "Daily runs");
    case "browser_minutes":
      return l("浏览器分钟", "Browser minutes");
    case "model_tokens":
      return l("模型 Token", "Model tokens");
    case "image_credits":
      return l("图像额度", "Image credits");
    case "mcp_calls":
      return l("MCP 调用数", "MCP calls");
    case "storage_bytes":
      return l("存储容量", "Storage bytes");
    case "download_bytes":
      return l("下载流量", "Download bytes");
    case "audit_exports":
      return l("审计导出次数", "Audit exports");
    case "replays":
      return l("回放次数", "Replays");
    case "ws_connections":
    default:
      return l("实时连接数", "Realtime connections");
  }
}

function decisionToEventDecision(decision: QuotaDecisionKind): QuotaEventDecision | null {
  switch (decision) {
    case "warn":
      return "warned";
    case "require_approval":
      return "approval_pending";
    case "block":
      return "blocked";
    case "allow":
    default:
      return null;
  }
}

function isRunTerminal(status: string) {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED";
}

function isRunActive(status: string) {
  return !isRunTerminal(status);
}

function sortPoliciesForDecision(left: QuotaPolicy, right: QuotaPolicy) {
  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  return right.updatedAt.localeCompare(left.updatedAt) || left.policyId.localeCompare(right.policyId);
}

function matchesScopedMetadata<
  T extends {
    workspaceId: string;
    workspaceContextKey?: string | null;
    packageId?: string | null;
    serviceId?: string | null;
    metric?: QuotaMetric;
    scopeType?: QuotaScopeType;
    runId?: string | null;
  },
>(item: T, query: ScopedQuotaQuery) {
  if (item.workspaceId !== query.workspaceId) {
    return false;
  }

  if (query.workspaceContextKey && item.workspaceContextKey !== query.workspaceContextKey) {
    return false;
  }

  if (query.packageId && item.packageId !== query.packageId) {
    return false;
  }

  if (query.serviceId && item.serviceId !== query.serviceId) {
    return false;
  }

  if (query.metric && item.metric !== query.metric) {
    return false;
  }

  if (query.scopeType && item.scopeType !== query.scopeType) {
    return false;
  }

  if (query.runId && item.runId !== query.runId) {
    return false;
  }

  return true;
}

function buildOverrideSummary(
  policy: QuotaPolicy,
  currentValue: number,
  limitValue: number
) {
  const metricLabel = quotaMetricLabel(policy.metric);
  const scopeLabel = quotaScopeLabel(policy.scopeType);
  return l(
    `${scopeLabel.zh}的${metricLabel.zh}达到 ${currentValue}，已超过阈值 ${limitValue}，需要额度放行后才能继续。`,
    `${scopeLabel.en} ${metricLabel.en.toLowerCase()} reached ${currentValue}, which is above the ${limitValue} threshold and now requires quota approval to continue.`
  );
}

function createScopedCounter(policy: QuotaPolicy, currentValue: number, at: string): QuotaCounter {
  const window = resolveQuotaWindowRange(policy.windowType, at);
  return quotaCounterSchema.parse({
    counterId: `qct_${policy.policyId}_${window.windowStartedAt.slice(0, 10).replace(/-/g, "")}`,
    policyId: policy.policyId,
    workspaceId: policy.workspaceId,
    scopeType: policy.scopeType,
    scopeRefId: policy.scopeRefId,
    metric: policy.metric,
    windowType: policy.windowType,
    currentValue,
    workspaceContextKey: policy.workspaceContextKey,
    packageId: policy.packageId,
    serviceId: policy.serviceId,
    taskVersionId: policy.taskVersionId,
    sessionVersionId: policy.sessionVersionId,
    entrySurface: policy.entrySurface,
    windowStartedAt: window.windowStartedAt,
    windowEndsAt: window.windowEndsAt,
    updatedAt: at,
  });
}

export class QuotaService {
  #policySequence = 1;
  #eventSequence = 1;
  #overrideSequence = 1;

  async init() {
    await creatorRepository.init();
    await quotaRepository.init();
    this.bootstrapSequences();
  }

  private bootstrapSequences() {
    let maxPolicy = 0;
    let maxEvent = 0;
    let maxOverride = 0;

    for (const policy of quotaRepository.listPolicies()) {
      const match = /(\d+)$/.exec(policy.policyId);
      maxPolicy = Math.max(maxPolicy, match ? Number.parseInt(match[1], 10) : 0);
    }

    for (const event of quotaRepository.listEvents()) {
      const match = /(\d+)$/.exec(event.eventId);
      maxEvent = Math.max(maxEvent, match ? Number.parseInt(match[1], 10) : 0);
    }

    for (const override of quotaRepository.listOverrides()) {
      const match = /(\d+)$/.exec(override.overrideId);
      maxOverride = Math.max(maxOverride, match ? Number.parseInt(match[1], 10) : 0);
    }

    this.#policySequence = maxPolicy + 1;
    this.#eventSequence = maxEvent + 1;
    this.#overrideSequence = maxOverride + 1;
  }

  private assertCanManagePolicies(actor: QuotaActor) {
    if (roleRank(actor.role) < roleRank("operator")) {
      throw new AppError(403, "QUOTA_POLICY_FORBIDDEN", "Current role cannot manage quota policies.");
    }
  }

  private assertCanView(actor: QuotaActor) {
    if (roleRank(actor.role) < roleRank("creator")) {
      throw new AppError(403, "QUOTA_VIEW_FORBIDDEN", "Current role cannot view quota governance.");
    }
  }

  private assertCanDecideOverride(actor: QuotaActor) {
    if (roleRank(actor.role) < roleRank("operator")) {
      throw new AppError(403, "QUOTA_OVERRIDE_FORBIDDEN", "Current role cannot decide quota overrides.");
    }
  }

  private nextPolicyId(metric: QuotaMetric) {
    return `qpo_${metric}_${String(this.#policySequence++).padStart(4, "0")}`;
  }

  private nextEventId(metric: QuotaMetric) {
    return `qev_${metric}_${String(this.#eventSequence++).padStart(4, "0")}`;
  }

  private nextOverrideId(metric: QuotaMetric) {
    return `qor_${metric}_${String(this.#overrideSequence++).padStart(4, "0")}`;
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

  private matchesPolicyToRunContext(policy: QuotaPolicy, context: RunCreateQuotaContext) {
    switch (policy.scopeType) {
      case "user":
        return context.requestedByUserId === policy.scopeRefId;
      case "workspace":
        return context.workspaceId === policy.scopeRefId;
      case "workspace-context":
        return context.workspaceContextKey === policy.scopeRefId;
      case "service":
        return context.serviceId === policy.scopeRefId;
      case "task-version":
        return context.taskVersionId === policy.scopeRefId;
      case "session-version":
        return context.sessionVersionId === policy.scopeRefId;
      case "package":
        return context.packageIds.includes(policy.scopeRefId);
      case "entry-surface":
        return context.entrySurface === policy.scopeRefId;
      default:
        return false;
    }
  }

  private matchesPolicyToUsageContext(policy: QuotaPolicy, context: ResolvedUsageContext) {
    switch (policy.scopeType) {
      case "user":
        return context.requestedByUserId === policy.scopeRefId;
      case "workspace":
        return context.workspaceId === policy.scopeRefId;
      case "workspace-context":
        return context.workspaceContextKey === policy.scopeRefId;
      case "service":
        return context.serviceId === policy.scopeRefId;
      case "task-version":
        return context.taskVersionId === policy.scopeRefId;
      case "session-version":
        return context.sessionVersionId === policy.scopeRefId;
      case "package":
        return context.packageIds.includes(policy.scopeRefId);
      case "entry-surface":
        return context.entrySurface === policy.scopeRefId;
      default:
        return false;
    }
  }

  private buildStoredCounterKey(policy: QuotaPolicy, at: string) {
    const window = resolveQuotaWindowRange(policy.windowType, at);
    return `${policy.policyId}:${window.windowStartedAt}:${window.windowEndsAt}`;
  }

  private findStoredCounter(policy: QuotaPolicy, at: string) {
    const currentKey = this.buildStoredCounterKey(policy, at);
    return quotaRepository.listCounters().find((item) => {
      const itemKey = `${item.policyId}:${item.windowStartedAt}:${item.windowEndsAt}`;
      return itemKey === currentKey;
    }) ?? null;
  }

  private computeActiveRunsForPolicy(policy: QuotaPolicy) {
    return runsRepository
      .list()
      .filter((aggregate) => {
        const snapshot = aggregate;
        if (!isRunActive(snapshot.run.status)) {
          return false;
        }

        const workspaceContextKey = snapshot.run.catalogMetadata?.workspaceContextKey ?? null;
        const serviceId = snapshot.run.catalogMetadata?.serviceId ?? null;
        const packageIds = this.resolveRelatedPackageIds({
          sessionVersionId: snapshot.run.sessionVersionId,
          taskVersionId: snapshot.run.taskVersionId,
          serviceId,
        });

        switch (policy.scopeType) {
          case "workspace":
            return snapshot.run.workspaceId === policy.scopeRefId;
          case "workspace-context":
            return workspaceContextKey === policy.scopeRefId;
          case "user":
            return snapshot.run.requestedByUserId === policy.scopeRefId;
          case "service":
            return serviceId === policy.scopeRefId;
          case "task-version":
            return snapshot.run.taskVersionId === policy.scopeRefId;
          case "session-version":
            return snapshot.run.sessionVersionId === policy.scopeRefId;
          case "package":
            return packageIds.includes(policy.scopeRefId);
          case "entry-surface":
            return snapshot.run.entrySurface === policy.scopeRefId;
          default:
            return false;
        }
      })
      .length;
  }

  private preparePolicyCounter(
    policy: QuotaPolicy,
    delta: number,
    at: string
  ): PreparedCounterUpdate {
    if (policy.windowType === "instant" || policy.metric === "active_runs") {
      return {
        policy,
        counter: createScopedCounter(policy, this.computeActiveRunsForPolicy(policy) + delta, at),
        persist: false,
      };
    }

    const existing = this.findStoredCounter(policy, at);
    const currentValue = (existing?.currentValue ?? 0) + delta;
    return {
      policy,
      counter: createScopedCounter(policy, currentValue, at),
      persist: true,
    };
  }

  private evaluatePolicies(
    policies: QuotaPolicy[],
    delta: number,
    at: string
  ): PreparedQuotaEvaluation {
    const preparedCounters = policies.map((policy) => this.preparePolicyCounter(policy, delta, at));
    const candidates = preparedCounters
      .map((item) => {
        const result = evaluateQuotaPolicyValue(item.policy, item.counter.currentValue);
        return {
          ...item,
          decision: result.decision,
          matchedLimit: result.matchedLimit,
        };
      })
      .sort((left, right) => {
        const severityDiff =
          quotaDecisionSeverity(right.decision) - quotaDecisionSeverity(left.decision);
        if (severityDiff !== 0) {
          return severityDiff;
        }

        return sortPoliciesForDecision(left.policy, right.policy);
      });

    const winning = candidates[0] ?? null;
    if (!winning || winning.decision === "allow") {
      return {
        decision: "allow",
        eventDecision: null,
        policy: winning?.policy ?? null,
        currentValue: winning?.counter.currentValue ?? null,
        limitValue: winning?.matchedLimit ?? null,
        counterUpdates: preparedCounters,
        summary: null,
        overrideDraft: null,
      };
    }

    const summary = buildOverrideSummary(
      winning.policy,
      winning.counter.currentValue,
      winning.matchedLimit ?? winning.policy.limitValue
    );

    return {
      decision: winning.decision,
      eventDecision: decisionToEventDecision(winning.decision),
      policy: winning.policy,
      currentValue: winning.counter.currentValue,
      limitValue: winning.matchedLimit ?? winning.policy.limitValue,
      counterUpdates: preparedCounters,
      summary,
      overrideDraft:
        winning.decision === "require_approval"
          ? quotaOverrideRecordSchema.parse({
              overrideId: this.nextOverrideId(winning.policy.metric),
              policyId: winning.policy.policyId,
              workspaceId: winning.policy.workspaceId,
              scopeType: winning.policy.scopeType,
              scopeRefId: winning.policy.scopeRefId,
              metric: winning.policy.metric,
              status: "pending",
              requiredRole: "operator",
              currentValue: winning.counter.currentValue,
              limitValue: winning.matchedLimit ?? winning.policy.limitValue,
              requestedDelta: delta,
              reasonSummary: summary,
              runId: null,
              approvalId: null,
              workspaceContextKey: winning.policy.workspaceContextKey,
              packageId: winning.policy.packageId,
              serviceId: winning.policy.serviceId,
              taskVersionId: winning.policy.taskVersionId,
              sessionVersionId: winning.policy.sessionVersionId,
              entrySurface: winning.policy.entrySurface,
              requestedByUserId: null,
              requestedAt: at,
              decidedByUserId: null,
              decidedAt: null,
              decisionNote: null,
              updatedAt: at,
            })
          : null,
    };
  }

  private async persistEvent(event: QuotaEvent) {
    await quotaRepository.saveEvent(quotaEventSchema.parse(event));
  }

  async listPolicies(actor: QuotaActor, query: ListQuotaPoliciesQuery = {}) {
    this.assertCanView(actor);
    const parsed = listQuotaPoliciesQuerySchema.parse(query);

    return quotaRepository.listPolicies().filter((item) => {
      if (item.workspaceId !== actor.workspaceId) {
        return false;
      }

      if (parsed.workspaceContextKey && item.workspaceContextKey !== parsed.workspaceContextKey) {
        return false;
      }

      if (parsed.packageId && item.packageId !== parsed.packageId) {
        return false;
      }

      if (parsed.serviceId && item.serviceId !== parsed.serviceId) {
        return false;
      }

      if (parsed.metric && item.metric !== parsed.metric) {
        return false;
      }

      if (parsed.scopeType && item.scopeType !== parsed.scopeType) {
        return false;
      }

      if (parsed.status && item.status !== parsed.status) {
        return false;
      }

      if (parsed.enabled != null && item.enabled !== parsed.enabled) {
        return false;
      }

      return true;
    });
  }

  async createPolicy(actor: QuotaActor, input: CreateQuotaPolicyInput) {
    this.assertCanManagePolicies(actor);
    const parsed = createQuotaPolicyInputSchema.parse(input);
    const at = nowIso();
    const policy = quotaPolicySchema.parse({
      policyId: this.nextPolicyId(parsed.metric),
      workspaceId: actor.workspaceId,
      ...parsed,
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
      createdAt: at,
      updatedAt: at,
    });

    await quotaRepository.savePolicy(policy);
    return policy;
  }

  async updatePolicy(actor: QuotaActor, policyId: string, input: Record<string, unknown>) {
    this.assertCanManagePolicies(actor);
    const policy = quotaRepository.getPolicyById(policyId);

    if (!policy || policy.workspaceId !== actor.workspaceId) {
      throw new AppError(404, "QUOTA_POLICY_NOT_FOUND", `Quota policy not found: ${policyId}`);
    }

    const parsed = updateQuotaPolicyInputSchema.parse(input);
    const updated = quotaPolicySchema.parse({
      ...policy,
      ...parsed,
      updatedByUserId: actor.userId,
      updatedAt: nowIso(),
    });

    await quotaRepository.savePolicy(updated);
    return updated;
  }

  private buildDerivedInstantCounters(query: ScopedQuotaQuery) {
    return quotaRepository
      .listPolicies()
      .filter(
        (policy) =>
          policy.workspaceId === query.workspaceId &&
          policy.enabled &&
          policy.status === "active" &&
          (policy.windowType === "instant" || policy.metric === "active_runs") &&
          matchesScopedMetadata(policy, query)
      )
      .map((policy) =>
        quotaCounterSchema.parse({
          counterId: `qct_live_${policy.policyId}`,
          policyId: policy.policyId,
          workspaceId: policy.workspaceId,
          scopeType: policy.scopeType,
          scopeRefId: policy.scopeRefId,
          metric: policy.metric,
          windowType: policy.windowType,
          currentValue: this.computeActiveRunsForPolicy(policy),
          workspaceContextKey: policy.workspaceContextKey,
          packageId: policy.packageId,
          serviceId: policy.serviceId,
          taskVersionId: policy.taskVersionId,
          sessionVersionId: policy.sessionVersionId,
          entrySurface: policy.entrySurface,
          windowStartedAt: nowIso(),
          windowEndsAt: nowIso(),
          updatedAt: nowIso(),
        })
      );
  }

  async listCounters(actor: QuotaActor, query: ListQuotaCountersQuery = {}) {
    this.assertCanView(actor);
    const parsed = listQuotaCountersQuerySchema.parse(query);
    const scopedQuery: ScopedQuotaQuery = {
      workspaceId: actor.workspaceId,
      workspaceContextKey: parsed.workspaceContextKey,
      packageId: parsed.packageId,
      serviceId: parsed.serviceId,
      metric: parsed.metric,
      scopeType: parsed.scopeType,
      runId: parsed.runId,
    };

    return [
      ...quotaRepository.listCounters().filter((item) => matchesScopedMetadata(item, scopedQuery)),
      ...this.buildDerivedInstantCounters(scopedQuery),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async listEvents(actor: QuotaActor, query: ListQuotaEventsQuery = {}) {
    this.assertCanView(actor);
    const parsed = listQuotaEventsQuerySchema.parse(query);
    return quotaRepository.listEvents().filter((item) => {
      if (!matchesScopedMetadata(item, {
        workspaceId: actor.workspaceId,
        workspaceContextKey: parsed.workspaceContextKey,
        packageId: parsed.packageId,
        serviceId: parsed.serviceId,
        metric: parsed.metric,
        runId: parsed.runId,
      })) {
        return false;
      }

      if (parsed.decision && item.decision !== parsed.decision) {
        return false;
      }

      if (parsed.overrideId && item.overrideId !== parsed.overrideId) {
        return false;
      }

      return true;
    });
  }

  async listOverrides(actor: QuotaActor, query: ListQuotaOverridesQuery = {}) {
    this.assertCanView(actor);
    const parsed = listQuotaOverridesQuerySchema.parse(query);
    return quotaRepository.listOverrides().filter((item) => {
      if (!matchesScopedMetadata(item, {
        workspaceId: actor.workspaceId,
        workspaceContextKey: parsed.workspaceContextKey,
        packageId: parsed.packageId,
        serviceId: parsed.serviceId,
        metric: parsed.metric,
        runId: parsed.runId,
      })) {
        return false;
      }

      if (parsed.status && item.status !== parsed.status) {
        return false;
      }

      return true;
    });
  }

  async decideOverride(
    overrideId: string,
    actor: QuotaActor,
    approved: boolean,
    input: DecideQuotaOverrideInput = {}
  ) {
    this.assertCanDecideOverride(actor);
    const record = quotaRepository.getOverrideById(overrideId);

    if (!record || record.workspaceId !== actor.workspaceId) {
      throw new AppError(404, "QUOTA_OVERRIDE_NOT_FOUND", `Quota override not found: ${overrideId}`);
    }

    if (record.runId && record.approvalId) {
      const { runsService } = await import("../runs/service.js");
      const snapshot = runsService.getRun(record.runId);
      const approvalInput = {
        approvalId: record.approvalId,
        approved,
        note: decideQuotaOverrideInputSchema.parse(input).note,
      };

      if (snapshot.run.status === "WAITING_APPROVAL") {
        await runsService.approve(record.runId, approvalInput, {
          decidedByUserId: actor.userId,
        });
      } else {
        await runsService.decideApprovalWithoutStatusTransition(
          record.runId,
          approvalInput,
          {
            decidedByUserId: actor.userId,
          }
        );
      }
      return quotaRepository.getOverrideById(overrideId);
    }

    const parsed = decideQuotaOverrideInputSchema.parse(input);
    const at = nowIso();
    const updated = quotaOverrideRecordSchema.parse({
      ...record,
      status: approved ? "approved" : "rejected",
      decidedByUserId: actor.userId,
      decidedAt: at,
      decisionNote: parsed.note ?? null,
      updatedAt: at,
    });

    await quotaRepository.saveOverride(updated);
    await this.persistEvent(
      quotaEventSchema.parse({
        eventId: this.nextEventId(record.metric),
        policyId: record.policyId,
        workspaceId: record.workspaceId,
        scopeType: record.scopeType,
        scopeRefId: record.scopeRefId,
        metric: record.metric,
        decision: approved ? "approved_override" : "rejected_override",
        currentValue: record.currentValue,
        limitValue: record.limitValue,
        runId: record.runId,
        approvalId: record.approvalId,
        overrideId: record.overrideId,
        note: parsed.note ?? null,
        workspaceContextKey: record.workspaceContextKey,
        packageId: record.packageId,
        serviceId: record.serviceId,
        taskVersionId: record.taskVersionId,
        sessionVersionId: record.sessionVersionId,
        entrySurface: record.entrySurface,
        occurredAt: at,
      })
    );

    return updated;
  }

  previewRunCreate(context: Omit<RunCreateQuotaContext, "packageIds"> & {
    packageIds?: string[];
  }): QuotaDecisionPreview & {
    internal: PreparedQuotaEvaluation;
  } {
    const packageIds =
      context.packageIds && context.packageIds.length > 0
        ? context.packageIds
        : this.resolveRelatedPackageIds({
            sessionVersionId: context.sessionVersionId,
            taskVersionId: context.taskVersionId,
            serviceId: context.serviceId,
          });
    const normalized: RunCreateQuotaContext = {
      ...context,
      packageIds,
    };
    const at = nowIso();
    const policies = quotaRepository
      .listPolicies()
      .filter(
        (policy) =>
          policy.workspaceId === normalized.workspaceId &&
          policy.enabled &&
          policy.status === "active" &&
          (policy.metric === "daily_runs" || policy.metric === "active_runs") &&
          this.matchesPolicyToRunContext(policy, normalized)
      )
      .sort(sortPoliciesForDecision);
    const internal = this.evaluatePolicies(policies, 1, at);

    if (internal.overrideDraft) {
      internal.overrideDraft = quotaOverrideRecordSchema.parse({
        ...internal.overrideDraft,
        runId: normalized.runId,
        requestedByUserId: normalized.requestedByUserId,
        workspaceContextKey: normalized.workspaceContextKey,
        packageId: internal.overrideDraft.packageId ?? normalized.packageIds[0] ?? null,
        serviceId: internal.overrideDraft.serviceId ?? normalized.serviceId,
        taskVersionId: internal.overrideDraft.taskVersionId ?? normalized.taskVersionId,
        sessionVersionId: internal.overrideDraft.sessionVersionId ?? normalized.sessionVersionId,
        entrySurface: internal.overrideDraft.entrySurface ?? normalized.entrySurface,
      });
    }

    return {
      ...quotaDecisionPreviewSchema.parse({
        decision: internal.decision,
        policyId: internal.policy?.policyId ?? null,
        metric: internal.policy?.metric ?? null,
        currentValue: internal.currentValue,
        limitValue: internal.limitValue,
        summary: internal.summary,
        overrideId: internal.overrideDraft?.overrideId ?? null,
      }),
      internal,
    };
  }

  async commitRunCreateDecision(
    preview: { internal: PreparedQuotaEvaluation },
    context: {
      runId: string;
      approvalId?: string | null;
      workspaceContextKey: string | null;
      packageIds: string[];
    }
  ) {
    const at = nowIso();

    for (const item of preview.internal.counterUpdates) {
      if (!item.persist || preview.internal.decision === "block") {
        continue;
      }

      await quotaRepository.saveCounter(
        quotaCounterSchema.parse({
          ...item.counter,
          updatedAt: at,
        })
      );
    }

    if (preview.internal.overrideDraft && preview.internal.decision !== "block") {
      const override = quotaOverrideRecordSchema.parse({
        ...preview.internal.overrideDraft,
        approvalId: context.approvalId ?? preview.internal.overrideDraft.approvalId,
        workspaceContextKey:
          preview.internal.overrideDraft.workspaceContextKey ?? context.workspaceContextKey,
        packageId:
          preview.internal.overrideDraft.packageId ?? context.packageIds[0] ?? null,
        updatedAt: at,
      });
      await quotaRepository.saveOverride(override);
    }

    if (preview.internal.eventDecision && preview.internal.policy) {
      await this.persistEvent(
        quotaEventSchema.parse({
          eventId: this.nextEventId(preview.internal.policy.metric),
          policyId: preview.internal.policy.policyId,
          workspaceId: preview.internal.policy.workspaceId,
          scopeType: preview.internal.policy.scopeType,
          scopeRefId: preview.internal.policy.scopeRefId,
          metric: preview.internal.policy.metric,
          decision: preview.internal.eventDecision,
          currentValue: preview.internal.currentValue ?? 0,
          limitValue: preview.internal.limitValue ?? preview.internal.policy.limitValue,
          runId: context.runId,
          approvalId: context.approvalId ?? null,
          overrideId: preview.internal.overrideDraft?.overrideId ?? null,
          note:
            preview.internal.decision === "block"
              ? "Run creation was blocked by quota policy."
              : preview.internal.decision === "require_approval"
                ? "Run creation now waits for quota approval."
                : "Run creation crossed a quota warning threshold.",
          workspaceContextKey: preview.internal.policy.workspaceContextKey ?? context.workspaceContextKey,
          packageId: preview.internal.policy.packageId ?? context.packageIds[0] ?? null,
          serviceId: preview.internal.policy.serviceId,
          taskVersionId: preview.internal.policy.taskVersionId,
          sessionVersionId: preview.internal.policy.sessionVersionId,
          entrySurface: preview.internal.policy.entrySurface,
          occurredAt: at,
        })
      );
    }
  }

  buildQuotaApprovalPrompt(preview: { internal: PreparedQuotaEvaluation }) {
    return preview.internal.summary?.en ??
      "Quota approval is required before this run can continue.";
  }

  async consumeApprovedUsageOverride(context: UsageContext) {
    const packageIds =
      context.packageIds.length > 0
        ? context.packageIds
        : this.resolveRelatedPackageIds({
            sessionVersionId: context.sessionVersionId,
            taskVersionId: context.taskVersionId,
            serviceId: context.serviceId,
          });
    const normalized: ResolvedUsageContext = {
      ...context,
      packageIds,
    };
    const current =
      quotaRepository.listOverrides().find((item) => {
        if (item.status !== "approved") {
          return false;
        }

        if (item.workspaceId !== normalized.workspaceId || item.metric !== normalized.metric) {
          return false;
        }

        if (item.runId && item.runId !== normalized.runId) {
          return false;
        }

        if (
          normalized.requestedByUserId &&
          item.requestedByUserId &&
          item.requestedByUserId !== normalized.requestedByUserId
        ) {
          return false;
        }

        if (
          item.workspaceContextKey &&
          item.workspaceContextKey !== normalized.workspaceContextKey
        ) {
          return false;
        }

        if (item.serviceId && item.serviceId !== normalized.serviceId) {
          return false;
        }

        if (item.taskVersionId && item.taskVersionId !== normalized.taskVersionId) {
          return false;
        }

        if (item.sessionVersionId && item.sessionVersionId !== normalized.sessionVersionId) {
          return false;
        }

        if (item.entrySurface && item.entrySurface !== normalized.entrySurface) {
          return false;
        }

        if (item.packageId && !normalized.packageIds.includes(item.packageId)) {
          return false;
        }

        return item.requestedDelta >= normalized.delta;
      }) ?? null;

    if (!current) {
      return null;
    }

    const consumedAt = nowIso();
    const updated = quotaOverrideRecordSchema.parse({
      ...current,
      status: "expired",
      decisionNote: current.decisionNote
        ? `${current.decisionNote}\nConsumed by approved quota action.`
        : "Consumed by approved quota action.",
      updatedAt: consumedAt,
    });
    await quotaRepository.saveOverride(updated);
    await this.persistEvent(
      quotaEventSchema.parse({
        eventId: this.nextEventId(current.metric),
        policyId: current.policyId,
        workspaceId: current.workspaceId,
        scopeType: current.scopeType,
        scopeRefId: current.scopeRefId,
        metric: current.metric,
        decision: "approved_override",
        currentValue: current.currentValue,
        limitValue: current.limitValue,
        runId: current.runId,
        approvalId: current.approvalId,
        overrideId: current.overrideId,
        note: `Approved override consumed for ${current.metric}.`,
        workspaceContextKey: current.workspaceContextKey,
        packageId: current.packageId,
        serviceId: current.serviceId,
        taskVersionId: current.taskVersionId,
        sessionVersionId: current.sessionVersionId,
        entrySurface: current.entrySurface,
        occurredAt: consumedAt,
      })
    );

    return updated;
  }

  previewUsage(context: UsageContext) {
    const at = nowIso();
    const packageIds =
      context.packageIds.length > 0
        ? context.packageIds
        : this.resolveRelatedPackageIds({
            sessionVersionId: context.sessionVersionId,
            taskVersionId: context.taskVersionId,
            serviceId: context.serviceId,
          });
    const normalized: ResolvedUsageContext = {
      ...context,
      packageIds,
    };
    const policies = quotaRepository
      .listPolicies()
      .filter(
        (policy) =>
          policy.workspaceId === normalized.workspaceId &&
          policy.enabled &&
          policy.status === "active" &&
          policy.metric === normalized.metric &&
          this.matchesPolicyToUsageContext(policy, normalized)
      )
      .sort(sortPoliciesForDecision);

    const evaluation = this.evaluatePolicies(policies, normalized.delta, at);

    if (evaluation.overrideDraft) {
      evaluation.overrideDraft = quotaOverrideRecordSchema.parse({
        ...evaluation.overrideDraft,
        runId: normalized.runId ?? null,
        requestedByUserId: normalized.requestedByUserId,
        workspaceContextKey: normalized.workspaceContextKey,
        packageId: evaluation.overrideDraft.packageId ?? normalized.packageIds[0] ?? null,
        serviceId: evaluation.overrideDraft.serviceId ?? normalized.serviceId,
        taskVersionId: evaluation.overrideDraft.taskVersionId ?? normalized.taskVersionId,
        sessionVersionId:
          evaluation.overrideDraft.sessionVersionId ?? normalized.sessionVersionId,
        entrySurface: evaluation.overrideDraft.entrySurface ?? normalized.entrySurface,
      });
    }

    return {
      ...quotaDecisionPreviewSchema.parse({
        decision: evaluation.decision,
        policyId: evaluation.policy?.policyId ?? null,
        metric: evaluation.policy?.metric ?? normalized.metric,
        currentValue: evaluation.currentValue,
        limitValue: evaluation.limitValue,
        summary: evaluation.summary,
        overrideId: evaluation.overrideDraft?.overrideId ?? null,
      }),
      internal: evaluation,
      usage: normalized,
    };
  }

  async commitUsageDecision(
    preview: ReturnType<QuotaService["previewUsage"]>,
    options: {
      approvalId?: string | null;
      note?: string | null;
    } = {}
  ) {
    const at = nowIso();

    for (const item of preview.internal.counterUpdates) {
      if (!item.persist || preview.internal.decision === "block") {
        continue;
      }

      await quotaRepository.saveCounter(
        quotaCounterSchema.parse({
          ...item.counter,
          updatedAt: at,
        })
      );
    }

    if (preview.internal.overrideDraft && preview.internal.decision !== "block") {
      const override = quotaOverrideRecordSchema.parse({
        ...preview.internal.overrideDraft,
        approvalId: options.approvalId ?? preview.internal.overrideDraft.approvalId,
        updatedAt: at,
      });
      await quotaRepository.saveOverride(override);
    }

    if (preview.internal.eventDecision && preview.internal.policy) {
      const note =
        options.note ??
        preview.usage.note ??
        (preview.internal.decision === "block"
          ? `Quota blocked ${preview.usage.metric}.`
          : preview.internal.decision === "require_approval"
            ? `Quota approval is now pending for ${preview.usage.metric}.`
            : `Quota warning recorded for ${preview.usage.metric}.`);

      await this.persistEvent(
        quotaEventSchema.parse({
          eventId: this.nextEventId(preview.internal.policy.metric),
          policyId: preview.internal.policy.policyId,
          workspaceId: preview.internal.policy.workspaceId,
          scopeType: preview.internal.policy.scopeType,
          scopeRefId: preview.internal.policy.scopeRefId,
          metric: preview.internal.policy.metric,
          decision: preview.internal.eventDecision,
          currentValue: preview.internal.currentValue ?? 0,
          limitValue: preview.internal.limitValue ?? preview.internal.policy.limitValue,
          runId: preview.usage.runId ?? null,
          approvalId: options.approvalId ?? null,
          overrideId: preview.internal.overrideDraft?.overrideId ?? null,
          note,
          workspaceContextKey:
            preview.internal.policy.workspaceContextKey ?? preview.usage.workspaceContextKey,
          packageId:
            preview.internal.policy.packageId ?? preview.usage.packageIds[0] ?? null,
          serviceId: preview.internal.policy.serviceId ?? preview.usage.serviceId,
          taskVersionId:
            preview.internal.policy.taskVersionId ?? preview.usage.taskVersionId,
          sessionVersionId:
            preview.internal.policy.sessionVersionId ?? preview.usage.sessionVersionId,
          entrySurface:
            preview.internal.policy.entrySurface ?? preview.usage.entrySurface,
          occurredAt: at,
        })
      );
    }
  }

  async applyRunApprovalDecision(input: {
    approval: RunApproval;
    approved: boolean;
    decidedByUserId: string | null;
    note?: string | null;
  }) {
    if (input.approval.kind !== "quota-override" || !input.approval.relatedResourceRef) {
      return;
    }

    const current = quotaRepository.getOverrideById(input.approval.relatedResourceRef);
    if (!current) {
      return;
    }

    const at = nowIso();
    const updated = quotaOverrideRecordSchema.parse({
      ...current,
      approvalId: current.approvalId ?? input.approval.approvalId,
      status: input.approved ? "approved" : "rejected",
      decidedByUserId: input.decidedByUserId,
      decidedAt: at,
      decisionNote: input.note ?? null,
      updatedAt: at,
    });

    await quotaRepository.saveOverride(updated);
    await this.persistEvent(
      quotaEventSchema.parse({
        eventId: this.nextEventId(current.metric),
        policyId: current.policyId,
        workspaceId: current.workspaceId,
        scopeType: current.scopeType,
        scopeRefId: current.scopeRefId,
        metric: current.metric,
        decision: input.approved ? "approved_override" : "rejected_override",
        currentValue: current.currentValue,
        limitValue: current.limitValue,
        runId: current.runId,
        approvalId: input.approval.approvalId,
        overrideId: current.overrideId,
        note: input.note ?? null,
        workspaceContextKey: current.workspaceContextKey,
        packageId: current.packageId,
        serviceId: current.serviceId,
        taskVersionId: current.taskVersionId,
        sessionVersionId: current.sessionVersionId,
        entrySurface: current.entrySurface,
        occurredAt: at,
      })
    );
  }

  async recordUsage(context: UsageContext) {
    const preview = this.previewUsage(context);
    await this.commitUsageDecision(preview, {
      note: context.note ?? null,
    });
    return preview;
  }

  getScopedSnapshot(query: ScopedQuotaQuery) {
    return {
      policies: quotaRepository.listPolicies().filter((item) => matchesScopedMetadata(item, query)),
      counters: [
        ...quotaRepository.listCounters().filter((item) => matchesScopedMetadata(item, query)),
        ...this.buildDerivedInstantCounters(query),
      ],
      events: quotaRepository.listEvents().filter((item) => matchesScopedMetadata(item, query)),
      overrides: quotaRepository.listOverrides().filter((item) => matchesScopedMetadata(item, query)),
    };
  }
}

export async function initializeQuotaInfrastructure() {
  await quotaService.init();
}

export const quotaService = new QuotaService();
