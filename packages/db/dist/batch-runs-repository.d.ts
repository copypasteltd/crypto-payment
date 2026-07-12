import { type BatchRunItem, type BatchRunJob } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const batchRunsStateSchema: z.ZodObject<{
    jobs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        batchJobId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        workspaceRoot: z.ZodString;
        workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workshopName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        serviceId: z.ZodString;
        serviceName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        title: z.ZodString;
        templateSource: z.ZodEnum<{
            "catalog-default": "catalog-default";
            "creator-activation": "creator-activation";
        }>;
        sourcePackageId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        sourceReleaseId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        sourceActivationId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        bindings: z.ZodObject<{
            firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
            credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
        status: z.ZodEnum<{
            cancelled: "cancelled";
            running: "running";
            completed: "completed";
            draft: "draft";
            validated: "validated";
            queued: "queued";
            partial_failed: "partial_failed";
        }>;
        maxParallelRuns: z.ZodNumber;
        budgetLimit: z.ZodNullable<z.ZodNumber>;
        retryLimit: z.ZodNumber;
        createdByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        validatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        cancelledAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        cancellationReason: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        batchItemId: z.ZodString;
        batchJobId: z.ZodString;
        rowIndex: z.ZodNumber;
        rowKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        targetPath: z.ZodString;
        pathSuffix: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        context: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        runId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        previousRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        runStatus: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            CREATED: "CREATED";
            READY: "READY";
            QUEUED: "QUEUED";
            STARTING: "STARTING";
            RUNNING: "RUNNING";
            WAITING_APPROVAL: "WAITING_APPROVAL";
            SUCCEEDED: "SUCCEEDED";
            FAILED: "FAILED";
            CANCELLED: "CANCELLED";
        }>>>;
        runStatusReason: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<{
            cancelled: "cancelled";
            running: "running";
            failed: "failed";
            draft: "draft";
            validated: "validated";
            queued: "queued";
            starting: "starting";
            waiting_approval: "waiting_approval";
            succeeded: "succeeded";
        }>;
        attemptCount: z.ZodDefault<z.ZodNumber>;
        errorCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        errorMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type BatchRunsState = z.infer<typeof batchRunsStateSchema>;
export interface BatchRunsRepository {
    init(): Promise<void>;
    listJobs(): BatchRunJob[];
    getJob(batchJobId: string): BatchRunJob | null;
    listItems(batchJobId: string): BatchRunItem[];
    saveBatch(job: BatchRunJob, items: BatchRunItem[]): Promise<void>;
    clear(): Promise<void>;
}
export declare abstract class CachedBatchRunsRepository implements BatchRunsRepository {
    #private;
    init(): Promise<void>;
    listJobs(): {
        batchJobId: string;
        workspaceId: string;
        workspaceContextKey: string | null;
        workspaceContextName: {
            zh: string;
            en: string;
        } | null;
        workspaceRoot: string;
        workshopId: string | null;
        workshopName: {
            zh: string;
            en: string;
        } | null;
        serviceId: string;
        serviceName: {
            zh: string;
            en: string;
        } | null;
        taskVersionId: string;
        sessionVersionId: string;
        entrySurface: "dashboard" | "h5" | "mini-program";
        title: string;
        templateSource: "catalog-default" | "creator-activation";
        sourcePackageId: string | null;
        sourceReleaseId: string | null;
        sourceActivationId: string | null;
        bindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
        status: "cancelled" | "running" | "completed" | "draft" | "validated" | "queued" | "partial_failed";
        maxParallelRuns: number;
        budgetLimit: number | null;
        retryLimit: number;
        createdByUserId: string | null;
        createdAt: string;
        updatedAt: string;
        validatedAt: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        cancelledAt: string | null;
        cancellationReason: string | null;
    }[];
    getJob(batchJobId: string): {
        batchJobId: string;
        workspaceId: string;
        workspaceContextKey: string | null;
        workspaceContextName: {
            zh: string;
            en: string;
        } | null;
        workspaceRoot: string;
        workshopId: string | null;
        workshopName: {
            zh: string;
            en: string;
        } | null;
        serviceId: string;
        serviceName: {
            zh: string;
            en: string;
        } | null;
        taskVersionId: string;
        sessionVersionId: string;
        entrySurface: "dashboard" | "h5" | "mini-program";
        title: string;
        templateSource: "catalog-default" | "creator-activation";
        sourcePackageId: string | null;
        sourceReleaseId: string | null;
        sourceActivationId: string | null;
        bindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
        status: "cancelled" | "running" | "completed" | "draft" | "validated" | "queued" | "partial_failed";
        maxParallelRuns: number;
        budgetLimit: number | null;
        retryLimit: number;
        createdByUserId: string | null;
        createdAt: string;
        updatedAt: string;
        validatedAt: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        cancelledAt: string | null;
        cancellationReason: string | null;
    } | null;
    listItems(batchJobId: string): {
        batchItemId: string;
        batchJobId: string;
        rowIndex: number;
        rowKey: string | null;
        title: string;
        targetPath: string;
        pathSuffix: string | null;
        initialMessage: string | null;
        context: Record<string, string>;
        runId: string | null;
        previousRunIds: string[];
        runStatus: "CREATED" | "READY" | "QUEUED" | "STARTING" | "RUNNING" | "WAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "CANCELLED" | null;
        runStatusReason: string | null;
        status: "cancelled" | "running" | "draft" | "validated" | "queued" | "failed" | "starting" | "waiting_approval" | "succeeded";
        attemptCount: number;
        errorCode: string | null;
        errorMessage: string | null;
        createdAt: string;
        updatedAt: string;
        startedAt: string | null;
        finishedAt: string | null;
    }[];
    saveBatch(job: BatchRunJob, items: BatchRunItem[]): Promise<void>;
    clear(): Promise<void>;
    protected getState(): {
        jobs: {
            batchJobId: string;
            workspaceId: string;
            workspaceContextKey: string | null;
            workspaceContextName: {
                zh: string;
                en: string;
            } | null;
            workspaceRoot: string;
            workshopId: string | null;
            workshopName: {
                zh: string;
                en: string;
            } | null;
            serviceId: string;
            serviceName: {
                zh: string;
                en: string;
            } | null;
            taskVersionId: string;
            sessionVersionId: string;
            entrySurface: "dashboard" | "h5" | "mini-program";
            title: string;
            templateSource: "catalog-default" | "creator-activation";
            sourcePackageId: string | null;
            sourceReleaseId: string | null;
            sourceActivationId: string | null;
            bindings: {
                firstPartyMcpIds: string[];
                externalConnectorRefs: string[];
                credentialIds: string[];
            };
            status: "cancelled" | "running" | "completed" | "draft" | "validated" | "queued" | "partial_failed";
            maxParallelRuns: number;
            budgetLimit: number | null;
            retryLimit: number;
            createdByUserId: string | null;
            createdAt: string;
            updatedAt: string;
            validatedAt: string | null;
            startedAt: string | null;
            finishedAt: string | null;
            cancelledAt: string | null;
            cancellationReason: string | null;
        }[];
        items: {
            batchItemId: string;
            batchJobId: string;
            rowIndex: number;
            rowKey: string | null;
            title: string;
            targetPath: string;
            pathSuffix: string | null;
            initialMessage: string | null;
            context: Record<string, string>;
            runId: string | null;
            previousRunIds: string[];
            runStatus: "CREATED" | "READY" | "QUEUED" | "STARTING" | "RUNNING" | "WAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "CANCELLED" | null;
            runStatusReason: string | null;
            status: "cancelled" | "running" | "draft" | "validated" | "queued" | "failed" | "starting" | "waiting_approval" | "succeeded";
            attemptCount: number;
            errorCode: string | null;
            errorMessage: string | null;
            createdAt: string;
            updatedAt: string;
            startedAt: string | null;
            finishedAt: string | null;
        }[];
    };
    protected abstract loadState(): Promise<BatchRunsState>;
    protected abstract persistBatch(job: BatchRunJob, items: BatchRunItem[]): Promise<void>;
    protected abstract clearStorage(): Promise<void>;
}
export interface PostgresBatchRunsRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresBatchRunsRepository extends CachedBatchRunsRepository {
    #private;
    constructor(options: PostgresBatchRunsRepositoryOptions);
    protected loadState(): Promise<{
        jobs: {
            batchJobId: string;
            workspaceId: string;
            workspaceContextKey: string | null;
            workspaceContextName: {
                zh: string;
                en: string;
            } | null;
            workspaceRoot: string;
            workshopId: string | null;
            workshopName: {
                zh: string;
                en: string;
            } | null;
            serviceId: string;
            serviceName: {
                zh: string;
                en: string;
            } | null;
            taskVersionId: string;
            sessionVersionId: string;
            entrySurface: "dashboard" | "h5" | "mini-program";
            title: string;
            templateSource: "catalog-default" | "creator-activation";
            sourcePackageId: string | null;
            sourceReleaseId: string | null;
            sourceActivationId: string | null;
            bindings: {
                firstPartyMcpIds: string[];
                externalConnectorRefs: string[];
                credentialIds: string[];
            };
            status: "cancelled" | "running" | "completed" | "draft" | "validated" | "queued" | "partial_failed";
            maxParallelRuns: number;
            budgetLimit: number | null;
            retryLimit: number;
            createdByUserId: string | null;
            createdAt: string;
            updatedAt: string;
            validatedAt: string | null;
            startedAt: string | null;
            finishedAt: string | null;
            cancelledAt: string | null;
            cancellationReason: string | null;
        }[];
        items: {
            batchItemId: string;
            batchJobId: string;
            rowIndex: number;
            rowKey: string | null;
            title: string;
            targetPath: string;
            pathSuffix: string | null;
            initialMessage: string | null;
            context: Record<string, string>;
            runId: string | null;
            previousRunIds: string[];
            runStatus: "CREATED" | "READY" | "QUEUED" | "STARTING" | "RUNNING" | "WAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "CANCELLED" | null;
            runStatusReason: string | null;
            status: "cancelled" | "running" | "draft" | "validated" | "queued" | "failed" | "starting" | "waiting_approval" | "succeeded";
            attemptCount: number;
            errorCode: string | null;
            errorMessage: string | null;
            createdAt: string;
            updatedAt: string;
            startedAt: string | null;
            finishedAt: string | null;
        }[];
    }>;
    protected persistBatch(job: BatchRunJob, items: BatchRunItem[]): Promise<void>;
    protected clearStorage(): Promise<void>;
}
//# sourceMappingURL=batch-runs-repository.d.ts.map