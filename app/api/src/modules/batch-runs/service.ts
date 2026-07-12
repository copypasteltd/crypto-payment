import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  batchRunCancelInputSchema,
  batchRunBudgetEstimateSchema,
  batchRunDetailSchema,
  estimateBatchRunInputSchema,
  importBatchRunFileInputSchema,
  importBatchRunFileResponseSchema,
  batchRunItemsResponseSchema,
  batchRunRetryInputSchema,
  batchRunStartInputSchema,
  batchRunSummarySchema,
  createBatchRunInputSchema,
  listBatchRunItemsQuerySchema,
  listBatchRunsQuerySchema,
  type BatchRunDetail,
  type BatchRunBudgetEstimate,
  type BatchRunItem,
  type BatchRunItemStatus,
  type BatchRunItemsResponse,
  type BatchRunJob,
  type BatchRunSummary,
  type BatchRunStartInput,
  type CreateBatchRunInput,
  type EstimateBatchRunInput,
  type ImportBatchRunFileInput,
  type ListBatchRunItemsQuery,
  type ListBatchRunsQuery,
  type RunStatus,
} from "@lingban/contracts";
import { matchesSearchQuery } from "@lingban/domain-models";
import { nowIso, toErrorMessage } from "@lingban/shared";
import { AppError, isAppError } from "../../app/errors.js";
import { billingService } from "../billing/service.js";
import { runsService } from "../runs/service.js";
import { workshopCatalogService } from "../workshops/service.js";
import { importBatchRunFile } from "./import-file.js";
import { batchRunsRepository } from "./repository.js";

const ACTIVE_ITEM_STATUSES = new Set<BatchRunItemStatus>([
  "queued",
  "starting",
  "running",
  "waiting_approval",
]);
const TERMINAL_ITEM_STATUSES = new Set<BatchRunItemStatus>(["succeeded", "failed", "cancelled"]);

function nextBatchJobId() {
  return `brj_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function nextBatchItemId() {
  return `bri_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function mapRunStatusToBatchItemStatus(runStatus: RunStatus): BatchRunItemStatus {
  switch (runStatus) {
    case "CREATED":
    case "READY":
    case "QUEUED":
      return "queued";
    case "STARTING":
      return "starting";
    case "RUNNING":
      return "running";
    case "WAITING_APPROVAL":
      return "waiting_approval";
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
  }
}

function summarizeItems(items: BatchRunItem[]): BatchRunSummary {
  const summary = {
    totalCount: items.length,
    draftCount: 0,
    validatedCount: 0,
    queuedCount: 0,
    startingCount: 0,
    runningCount: 0,
    waitingApprovalCount: 0,
    succeededCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    latestUpdatedAt: null as string | null,
  };

  for (const item of items) {
    switch (item.status) {
      case "draft":
        summary.draftCount += 1;
        break;
      case "validated":
        summary.validatedCount += 1;
        break;
      case "queued":
        summary.queuedCount += 1;
        break;
      case "starting":
        summary.startingCount += 1;
        break;
      case "running":
        summary.runningCount += 1;
        break;
      case "waiting_approval":
        summary.waitingApprovalCount += 1;
        break;
      case "succeeded":
        summary.succeededCount += 1;
        break;
      case "failed":
        summary.failedCount += 1;
        break;
      case "cancelled":
        summary.cancelledCount += 1;
        break;
    }

    if (!summary.latestUpdatedAt || item.updatedAt > summary.latestUpdatedAt) {
      summary.latestUpdatedAt = item.updatedAt;
    }
  }

  return batchRunSummarySchema.parse(summary);
}

function deriveBatchJobStatus(job: BatchRunJob, summary: BatchRunSummary) {
  if (summary.totalCount === 0) {
    return job.status;
  }

  if (summary.cancelledCount === summary.totalCount) {
    return "cancelled" as const;
  }

  if (summary.succeededCount === summary.totalCount) {
    return "completed" as const;
  }

  if (summary.failedCount > 0 && summary.failedCount + summary.succeededCount + summary.cancelledCount === summary.totalCount) {
    return "partial_failed" as const;
  }

  if (
    summary.runningCount > 0 ||
    summary.startingCount > 0 ||
    summary.waitingApprovalCount > 0
  ) {
    return "running" as const;
  }

  if (summary.queuedCount > 0) {
    return "queued" as const;
  }

  if (summary.validatedCount > 0 && summary.draftCount === 0) {
    return "validated" as const;
  }

  return "draft" as const;
}

function toErrorCode(error: unknown) {
  if (isAppError(error)) {
    return error.code;
  }

  return "BATCH_RUN_ITEM_START_FAILED";
}

async function runWithConcurrency<T, TResult>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<TResult>
) {
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  async function consume() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => consume())
  );

  return results;
}

function roundEstimate(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseEstimatedDurationRangeMinutes(input: string | null | undefined) {
  const normalized = input?.trim() ?? "";
  const matches = Array.from(normalized.matchAll(/\d+(?:\.\d+)?/g), (item) => Number(item[0]));
  if (matches.length === 0) {
    return {
      low: 5,
      high: 10,
      warning:
        "Service estimatedDuration could not be parsed. A fallback runtime range of 5-10 minutes per item was applied.",
    };
  }

  if (matches.length === 1) {
    const value = Math.max(1, matches[0]);
    return {
      low: value,
      high: value,
      warning: null,
    };
  }

  const low = Math.max(1, Math.min(matches[0], matches[1]));
  const high = Math.max(low, Math.max(matches[0], matches[1]));
  return {
    low,
    high,
    warning: null,
  };
}

type CreateBatchRunActor = {
  requestedByUserId: string | null;
};

export class BatchRunsService {
  importBatchRunFile(input: ImportBatchRunFileInput) {
    const parsed = importBatchRunFileInputSchema.parse(input);
    return importBatchRunFileResponseSchema.parse(importBatchRunFile(parsed));
  }

  async estimateBatchRun(input: EstimateBatchRunInput) {
    const parsed = estimateBatchRunInputSchema.parse(input);
    return this.#buildBudgetEstimate({
      workspaceId: parsed.workspaceId,
      workspaceContextKey: parsed.workspaceContextKey,
      serviceId: parsed.serviceId,
      entrySurface: parsed.entrySurface,
      budgetLimit: parsed.governance.budgetLimit,
      maxParallelRuns: parsed.governance.maxParallelRuns,
      itemCount: parsed.items.length,
    });
  }

  async createBatchRun(input: CreateBatchRunInput, actor: CreateBatchRunActor): Promise<BatchRunDetail> {
    const parsed = createBatchRunInputSchema.parse(input);
    const template = workshopCatalogService.createLaunchTemplate(parsed.serviceId, {
      workspaceId: parsed.workspaceId,
      workspaceContextKey: parsed.workspaceContextKey,
      entrySurface: parsed.entrySurface,
    });
    const createdAt = nowIso();
    const batchJobId = nextBatchJobId();
    const job = {
      batchJobId,
      workspaceId: template.workspaceContext.runtimeWorkspaceId,
      workspaceContextKey: template.workspaceContext.contextKey,
      workspaceContextName: template.workspaceContext.displayName,
      workspaceRoot: template.workspaceContext.root,
      workshopId: template.createRunInput.catalogMetadata?.workshopId ?? null,
      workshopName: template.createRunInput.catalogMetadata?.workshopName ?? null,
      serviceId: template.serviceId,
      serviceName: template.createRunInput.catalogMetadata?.serviceName ?? null,
      taskVersionId: template.taskVersionId,
      sessionVersionId: template.sessionVersionId,
      entrySurface: template.createRunInput.entrySurface,
      title:
        parsed.title?.trim() ||
        `${template.title.zh} / ${String(parsed.items.length).padStart(2, "0")} items`,
      templateSource: template.resolution.source,
      sourcePackageId: template.resolution.packageId,
      sourceReleaseId: template.resolution.releaseId,
      sourceActivationId: template.resolution.activationId,
      bindings: template.createRunInput.bindings,
      status: "draft",
      maxParallelRuns: parsed.governance.maxParallelRuns,
      budgetLimit: parsed.governance.budgetLimit,
      retryLimit: parsed.governance.retryLimit,
      createdByUserId: actor.requestedByUserId,
      createdAt,
      updatedAt: createdAt,
      validatedAt: null,
      startedAt: null,
      finishedAt: null,
      cancelledAt: null,
      cancellationReason: null,
    } satisfies BatchRunJob;
    const items = parsed.items.map((item, index) => {
      const pathSuffix = item.pathSuffix?.trim() || item.rowKey?.trim() || `batch-${index + 1}`;
      const targetPath =
        item.targetPath?.trim() ||
        path.posix.join(template.targetRoot.replace(/\/+$/g, ""), pathSuffix);

      return {
        batchItemId: nextBatchItemId(),
        batchJobId,
        rowIndex: index,
        rowKey: item.rowKey,
        title: item.title,
        targetPath,
        pathSuffix: item.pathSuffix,
        initialMessage: item.initialMessage,
        context: item.context,
        runId: null,
        previousRunIds: [],
        runStatus: null,
        runStatusReason: null,
        status: "draft",
        attemptCount: 0,
        errorCode: null,
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        finishedAt: null,
      } satisfies BatchRunItem;
    });

    await batchRunsRepository.saveBatch(job, items);

    const estimate = await this.#buildBudgetEstimate({
      workspaceId: job.workspaceId,
      workspaceContextKey: job.workspaceContextKey,
      serviceId: job.serviceId,
      entrySurface: job.entrySurface,
      budgetLimit: job.budgetLimit,
      maxParallelRuns: job.maxParallelRuns,
      itemCount: items.length,
    });

    if (parsed.autoStart) {
      await this.validateBatchRun(batchJobId);
      return this.startBatchRun(batchJobId, {});
    }

    return batchRunDetailSchema.parse({
      job,
      summary: summarizeItems(items),
      estimate,
      itemsPreview: items.slice(0, 3),
    });
  }

  async listBatchRuns(query: ListBatchRunsQuery) {
    const parsed = listBatchRunsQuerySchema.parse(query);
    const records = await Promise.all(
      batchRunsRepository.listJobs().map((job) => this.#hydrateBatch(job.batchJobId))
    );

    return records.filter((item) => {
      if (parsed.workspaceId && item.job.workspaceId !== parsed.workspaceId) {
        return false;
      }
      if (
        parsed.workspaceContextKey &&
        item.job.workspaceContextKey !== parsed.workspaceContextKey
      ) {
        return false;
      }
      if (parsed.serviceId && item.job.serviceId !== parsed.serviceId) {
        return false;
      }
      if (parsed.status && item.job.status !== parsed.status) {
        return false;
      }

      return matchesSearchQuery(parsed.q ?? "", [
        item.job.batchJobId,
        item.job.title,
        item.job.workspaceContextKey ?? "",
        item.job.serviceId,
        item.job.serviceName?.zh ?? "",
        item.job.serviceName?.en ?? "",
        item.job.workshopId ?? "",
        item.job.workshopName?.zh ?? "",
        item.job.workshopName?.en ?? "",
      ]);
    });
  }

  async getBatchRun(batchJobId: string) {
    return this.#hydrateBatch(batchJobId);
  }

  async listBatchItems(batchJobId: string, query: ListBatchRunItemsQuery): Promise<BatchRunItemsResponse> {
    const parsed = listBatchRunItemsQuerySchema.parse(query);
    const hydrated = await this.#hydrateBatch(batchJobId, { includeAllItems: true });
    const items = parsed.status
      ? hydrated.items.filter((item) => item.status === parsed.status)
      : hydrated.items;

    return batchRunItemsResponseSchema.parse({
      job: hydrated.job,
      summary: hydrated.summary,
      estimate: hydrated.estimate,
      items,
    });
  }

  async validateBatchRun(batchJobId: string) {
    const record = await this.#requireBatch(batchJobId);
    const now = nowIso();
    const seenPaths = new Set<string>();
    const nextItems = record.items.map((item) => {
      if (seenPaths.has(item.targetPath)) {
        throw new AppError(
          409,
          "BATCH_RUN_TARGET_PATH_DUPLICATED",
          `Duplicate target path in batch: ${item.targetPath}`
        );
      }

      seenPaths.add(item.targetPath);

      if (item.runId || TERMINAL_ITEM_STATUSES.has(item.status)) {
        return item;
      }

      if (!item.targetPath.startsWith(record.job.workspaceRoot)) {
        throw new AppError(
          409,
          "BATCH_RUN_TARGET_PATH_OUTSIDE_WORKSPACE",
          `Target path ${item.targetPath} must stay within ${record.job.workspaceRoot}`
        );
      }
      return {
        ...item,
        status: "validated",
        errorCode: null,
        errorMessage: null,
        updatedAt: now,
      } satisfies BatchRunItem;
    });

    const estimate = await this.#buildBudgetEstimate({
      workspaceId: record.job.workspaceId,
      workspaceContextKey: record.job.workspaceContextKey,
      serviceId: record.job.serviceId,
      entrySurface: record.job.entrySurface,
      budgetLimit: record.job.budgetLimit,
      maxParallelRuns: record.job.maxParallelRuns,
      itemCount: nextItems.length,
    });
    if (!estimate.withinBudget) {
      throw new AppError(
        409,
        "BATCH_RUN_BUDGET_LIMIT_EXCEEDED",
        `Estimated high-bound runtime cost $${estimate.estimatedTotalAmountUsdHigh.toFixed(4)} exceeds budget limit $${(record.job.budgetLimit ?? 0).toFixed(4)}.`
      );
    }

    const summary = summarizeItems(nextItems);
    const nextJob = {
      ...record.job,
      status: deriveBatchJobStatus(
        {
          ...record.job,
          status: "validated",
        },
        summary
      ),
      validatedAt: now,
      updatedAt: now,
      finishedAt: null,
    } satisfies BatchRunJob;
    await batchRunsRepository.saveBatch(nextJob, nextItems);

    return batchRunDetailSchema.parse({
      job: nextJob,
      summary,
      estimate,
      itemsPreview: nextItems.slice(0, 3),
    });
  }

  async startBatchRun(batchJobId: string, input: BatchRunStartInput) {
    const parsed = batchRunStartInputSchema.parse(input);
    const hydrated = await this.#hydrateBatch(batchJobId, { includeAllItems: true });
    const selectedIdSet = parsed.itemIds ? new Set(parsed.itemIds) : null;
    const pendingItems = hydrated.items.filter((item) => {
      if (selectedIdSet && !selectedIdSet.has(item.batchItemId)) {
        return false;
      }

      return (
        item.runId == null &&
        (item.status === "draft" || item.status === "validated" || item.status === "failed")
      );
    });

    if (pendingItems.length === 0) {
      throw new AppError(409, "BATCH_RUN_NOTHING_TO_START", "No pending batch items can be started.");
    }

    await this.validateBatchRun(batchJobId);
    const validated = await this.#requireBatch(batchJobId);
    const selectedIds = new Set(pendingItems.map((item) => item.batchItemId));
    const updatedById = new Map<string, BatchRunItem>();
    const startedAt = nowIso();

    const launchedItems = await runWithConcurrency(
      validated.items.filter((item) => selectedIds.has(item.batchItemId)),
      validated.job.maxParallelRuns,
      async (item) => {
        const launchStartedAt = nowIso();
        try {
          const created = await runsService.createRun({
            workspaceId: validated.job.workspaceId,
            taskVersionId: validated.job.taskVersionId,
            sessionVersionId: validated.job.sessionVersionId,
            requestedByUserId: validated.job.createdByUserId ?? undefined,
            title: item.title,
            targetPath: item.targetPath,
            entrySurface: validated.job.entrySurface,
            initialMessage: item.initialMessage,
            bindings: validated.job.bindings,
            catalogMetadata: {
              workspaceContextKey: validated.job.workspaceContextKey,
              workspaceContextName: validated.job.workspaceContextName,
              workshopId: validated.job.workshopId,
              workshopName: validated.job.workshopName,
              serviceId: validated.job.serviceId,
              serviceName: validated.job.serviceName,
            },
          });

          const status = mapRunStatusToBatchItemStatus(created.run.status);
          return {
            ...item,
            runId: created.run.runId,
            runStatus: created.run.status,
            runStatusReason: created.run.statusReason,
            status,
            attemptCount: item.attemptCount + 1,
            errorCode: null,
            errorMessage: null,
            startedAt: launchStartedAt,
            finishedAt:
              status === "succeeded" || status === "failed" || status === "cancelled"
                ? created.run.updatedAt
                : null,
            updatedAt: created.run.updatedAt,
          } satisfies BatchRunItem;
        } catch (error) {
          return {
            ...item,
            runId: null,
            runStatus: null,
            runStatusReason: null,
            status: "failed",
            attemptCount: item.attemptCount + 1,
            errorCode: toErrorCode(error),
            errorMessage: toErrorMessage(error),
            startedAt: launchStartedAt,
            finishedAt: nowIso(),
            updatedAt: nowIso(),
          } satisfies BatchRunItem;
        }
      }
    );

    for (const item of launchedItems) {
      updatedById.set(item.batchItemId, item);
    }

    const nextItems = validated.items.map((item) => updatedById.get(item.batchItemId) ?? item);
    const summary = summarizeItems(nextItems);
    const nextStatus = deriveBatchJobStatus(
      {
        ...validated.job,
        status: "running",
      },
      summary
    );
    const nextJob = {
      ...validated.job,
      status: nextStatus,
      startedAt: validated.job.startedAt ?? startedAt,
      updatedAt: nowIso(),
      finishedAt:
        nextStatus === "completed" || nextStatus === "partial_failed" || nextStatus === "cancelled"
          ? nowIso()
          : null,
    } satisfies BatchRunJob;
    await batchRunsRepository.saveBatch(nextJob, nextItems);

    return batchRunDetailSchema.parse({
      job: nextJob,
      summary,
      estimate: await this.#buildBudgetEstimate({
        workspaceId: nextJob.workspaceId,
        workspaceContextKey: nextJob.workspaceContextKey,
        serviceId: nextJob.serviceId,
        entrySurface: nextJob.entrySurface,
        budgetLimit: nextJob.budgetLimit,
        maxParallelRuns: nextJob.maxParallelRuns,
        itemCount: nextItems.length,
      }),
      itemsPreview: nextItems.slice(0, 5),
    });
  }

  async retryBatchRun(batchJobId: string, input: unknown) {
    const parsed = batchRunRetryInputSchema.parse(input);
    const hydrated = await this.#hydrateBatch(batchJobId, { includeAllItems: true });
    const selectedIdSet =
      parsed.itemIds && parsed.itemIds.length > 0 ? new Set(parsed.itemIds) : null;
    const targetItems = hydrated.items.filter((item) => {
      if (selectedIdSet && !selectedIdSet.has(item.batchItemId)) {
        return false;
      }

      return parsed.onlyFailed ? item.status === "failed" : true;
    });

    if (targetItems.length === 0) {
      throw new AppError(409, "BATCH_RUN_RETRY_EMPTY", "No batch items matched the retry selection.");
    }

    const retryAt = nowIso();
    const targetIdSet = new Set(targetItems.map((item) => item.batchItemId));
    const resetItems = hydrated.items.map((item) => {
      if (!targetIdSet.has(item.batchItemId)) {
        return item;
      }

      return {
        ...item,
        previousRunIds: item.runId ? [...item.previousRunIds, item.runId] : item.previousRunIds,
        runId: null,
        runStatus: null,
        runStatusReason: null,
        status: "validated",
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: retryAt,
      } satisfies BatchRunItem;
    });

    const nextJob = {
      ...hydrated.job,
      status: "validated",
      updatedAt: retryAt,
      finishedAt: null,
      cancelledAt: null,
      cancellationReason: null,
    } satisfies BatchRunJob;
    await batchRunsRepository.saveBatch(nextJob, resetItems);

    return this.startBatchRun(batchJobId, {
      itemIds: targetItems.map((item) => item.batchItemId),
    });
  }

  async cancelBatchRun(batchJobId: string, input: unknown) {
    const parsed = batchRunCancelInputSchema.parse(input);
    const hydrated = await this.#hydrateBatch(batchJobId, { includeAllItems: true });
    const cancelledAt = nowIso();
    const nextItems = [...hydrated.items];

    await Promise.all(
      nextItems.map(async (item, index) => {
        if (item.runId && ACTIVE_ITEM_STATUSES.has(item.status)) {
          try {
            const snapshot = await runsService.cancel(item.runId, parsed.reason);
            nextItems[index] = {
              ...item,
              runStatus: snapshot.run.status,
              runStatusReason: snapshot.run.statusReason,
              status: mapRunStatusToBatchItemStatus(snapshot.run.status),
              updatedAt: snapshot.run.updatedAt,
              finishedAt: snapshot.run.updatedAt,
            };
            return;
          } catch {
            // Keep the item-level error surface minimal and still mark it cancelled locally.
          }
        }

        if (!TERMINAL_ITEM_STATUSES.has(item.status)) {
          nextItems[index] = {
            ...item,
            status: "cancelled",
            errorCode: item.errorCode,
            errorMessage: item.errorMessage,
            updatedAt: cancelledAt,
            finishedAt: item.finishedAt ?? cancelledAt,
          };
        }
      })
    );

    const summary = summarizeItems(nextItems);
    const nextJob = {
      ...hydrated.job,
      status: "cancelled",
      updatedAt: cancelledAt,
      cancelledAt,
      cancellationReason: parsed.reason ?? null,
      finishedAt: cancelledAt,
    } satisfies BatchRunJob;
    await batchRunsRepository.saveBatch(nextJob, nextItems);

    return batchRunDetailSchema.parse({
      job: nextJob,
      summary,
      estimate: await this.#buildBudgetEstimate({
        workspaceId: nextJob.workspaceId,
        workspaceContextKey: nextJob.workspaceContextKey,
        serviceId: nextJob.serviceId,
        entrySurface: nextJob.entrySurface,
        budgetLimit: nextJob.budgetLimit,
        maxParallelRuns: nextJob.maxParallelRuns,
        itemCount: nextItems.length,
      }),
      itemsPreview: nextItems.slice(0, 5),
    });
  }

  async #buildBudgetEstimate(input: {
    workspaceId?: string | null;
    workspaceContextKey?: string | null;
    serviceId: string;
    entrySurface: BatchRunJob["entrySurface"];
    budgetLimit: number | null;
    maxParallelRuns: number;
    itemCount: number;
  }): Promise<BatchRunBudgetEstimate> {
    let estimatedDuration = "";
    const warnings: string[] = [];

    try {
      const serviceDetail = workshopCatalogService.getService(input.serviceId, {
        workspaceId: input.workspaceId ?? undefined,
        workspaceContextKey: input.workspaceContextKey ?? undefined,
        entrySurface: input.entrySurface,
      });
      estimatedDuration = serviceDetail.estimatedDuration;
    } catch {
      warnings.push(
        `Service metadata for ${input.serviceId} could not be loaded during budget estimation.`
      );
    }

    const durationRange = parseEstimatedDurationRangeMinutes(estimatedDuration);
    if (durationRange.warning) {
      warnings.push(durationRange.warning);
    }

    const estimatedMinutesPerItemLow = roundEstimate(durationRange.low);
    const estimatedMinutesPerItemHigh = roundEstimate(durationRange.high);
    const estimatedTotalMinutesLow = roundEstimate(estimatedMinutesPerItemLow * input.itemCount);
    const estimatedTotalMinutesHigh = roundEstimate(estimatedMinutesPerItemHigh * input.itemCount);
    const estimatedWallClockMinutesLow = roundEstimate(
      estimatedTotalMinutesLow / Math.max(1, input.maxParallelRuns)
    );
    const estimatedWallClockMinutesHigh = roundEstimate(
      estimatedTotalMinutesHigh / Math.max(1, input.maxParallelRuns)
    );
    const browserMinutesLow = billingService.estimateUsage(
      "browser_minutes",
      estimatedTotalMinutesLow
    );
    const browserMinutesHigh = billingService.estimateUsage(
      "browser_minutes",
      estimatedTotalMinutesHigh
    );
    const budgetLimit = input.budgetLimit ?? null;
    const budgetRemainingUsdLow =
      budgetLimit == null ? null : roundEstimate(budgetLimit - browserMinutesLow.amountUsd);
    const budgetRemainingUsdHigh =
      budgetLimit == null ? null : roundEstimate(budgetLimit - browserMinutesHigh.amountUsd);
    const withinBudget = budgetLimit == null ? true : browserMinutesHigh.amountUsd <= budgetLimit;

    if (!withinBudget && budgetLimit != null) {
      warnings.push(
        `Estimated high-bound runtime cost $${browserMinutesHigh.amountUsd.toFixed(4)} exceeds budget limit $${budgetLimit.toFixed(4)}.`
      );
    }

    return batchRunBudgetEstimateSchema.parse({
      currency: "USD",
      itemCount: input.itemCount,
      estimatedMinutesPerItemLow,
      estimatedMinutesPerItemHigh,
      estimatedTotalMinutesLow,
      estimatedTotalMinutesHigh,
      estimatedWallClockMinutesLow,
      estimatedWallClockMinutesHigh,
      estimatedTotalAmountUsdLow: browserMinutesLow.amountUsd,
      estimatedTotalAmountUsdHigh: browserMinutesHigh.amountUsd,
      budgetLimit,
      budgetRemainingUsdLow,
      budgetRemainingUsdHigh,
      withinBudget,
      metrics: [
        {
          metric: "browser_minutes",
          label: browserMinutesLow.label,
          quantityLow: browserMinutesLow.quantity,
          quantityHigh: browserMinutesHigh.quantity,
          unitPriceUsd: browserMinutesLow.unitPriceUsd,
          amountUsdLow: browserMinutesLow.amountUsd,
          amountUsdHigh: browserMinutesHigh.amountUsd,
          currency: "USD",
        },
      ],
      warnings,
    });
  }

  async #requireBatch(batchJobId: string) {
    await batchRunsRepository.init();
    const job = batchRunsRepository.getJob(batchJobId);
    if (!job) {
      throw new AppError(404, "BATCH_RUN_NOT_FOUND", `Batch run not found: ${batchJobId}`);
    }

    return {
      job,
      items: batchRunsRepository.listItems(batchJobId),
    };
  }

  async #hydrateBatch(batchJobId: string, options: { includeAllItems?: boolean } = {}) {
    const current = await this.#requireBatch(batchJobId);
    let mutated = false;
    const syncedItems = await Promise.all(
      current.items.map(async (item) => {
        if (!item.runId) {
          return item;
        }

        try {
          const snapshot = runsService.getRun(item.runId);
          const nextStatus = mapRunStatusToBatchItemStatus(snapshot.run.status);
          const nextItem = {
            ...item,
            runStatus: snapshot.run.status,
            runStatusReason: snapshot.run.statusReason,
            status: nextStatus,
            updatedAt: snapshot.run.updatedAt,
            startedAt: item.startedAt ?? snapshot.runtime.startedAt ?? snapshot.run.createdAt,
            finishedAt:
              nextStatus === "succeeded" || nextStatus === "failed" || nextStatus === "cancelled"
                ? snapshot.runtime.finishedAt ?? snapshot.run.updatedAt
                : null,
          } satisfies BatchRunItem;

          if (JSON.stringify(nextItem) !== JSON.stringify(item)) {
            mutated = true;
          }

          return nextItem;
        } catch {
          return item;
        }
      })
    );

    const summary = summarizeItems(syncedItems);
    const nextStatus = deriveBatchJobStatus(current.job, summary);
    let nextJob = current.job;
    if (
      nextStatus !== current.job.status ||
      (nextStatus === "completed" || nextStatus === "partial_failed" || nextStatus === "cancelled") &&
        current.job.finishedAt == null
    ) {
      mutated = true;
      nextJob = {
        ...current.job,
        status: nextStatus,
        updatedAt: summary.latestUpdatedAt ?? current.job.updatedAt,
        finishedAt:
          nextStatus === "completed" || nextStatus === "partial_failed" || nextStatus === "cancelled"
            ? summary.latestUpdatedAt ?? current.job.updatedAt
            : null,
      };
    }

    if (mutated) {
      await batchRunsRepository.saveBatch(nextJob, syncedItems);
    }

    const estimate = await this.#buildBudgetEstimate({
      workspaceId: nextJob.workspaceId,
      workspaceContextKey: nextJob.workspaceContextKey,
      serviceId: nextJob.serviceId,
      entrySurface: nextJob.entrySurface,
      budgetLimit: nextJob.budgetLimit,
      maxParallelRuns: nextJob.maxParallelRuns,
      itemCount: syncedItems.length,
    });

    return {
      job: nextJob,
      summary,
      estimate,
      items: syncedItems,
      itemsPreview: options.includeAllItems ? syncedItems : syncedItems.slice(0, 5),
    };
  }
}

export const batchRunsService = new BatchRunsService();

export async function initializeBatchRunsInfrastructure() {
  await batchRunsRepository.init();
}
