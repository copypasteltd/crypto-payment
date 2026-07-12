import { z } from "zod";
export declare const batchRunJobIdSchema: z.ZodString;
export declare const batchRunItemIdSchema: z.ZodString;
export declare const batchRunStatusSchema: z.ZodEnum<{
    cancelled: "cancelled";
    running: "running";
    completed: "completed";
    draft: "draft";
    validated: "validated";
    queued: "queued";
    partial_failed: "partial_failed";
}>;
export declare const batchRunItemStatusSchema: z.ZodEnum<{
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
export declare const batchRunGovernanceSchema: z.ZodObject<{
    maxParallelRuns: z.ZodDefault<z.ZodNumber>;
    budgetLimit: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    retryLimit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const batchRunItemContextSchema: z.ZodRecord<z.ZodString, z.ZodString>;
export declare const batchRunImportFileFormatSchema: z.ZodEnum<{
    csv: "csv";
    xlsx: "xlsx";
}>;
export declare const batchRunImportFieldMappingSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    pathSuffix: z.ZodOptional<z.ZodString>;
    targetPath: z.ZodOptional<z.ZodString>;
    initialMessage: z.ZodOptional<z.ZodString>;
    rowKey: z.ZodOptional<z.ZodString>;
    ignoreColumns: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const batchRunImportResolvedMappingSchema: z.ZodObject<{
    title: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    pathSuffix: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    targetPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    rowKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    ignoreColumns: z.ZodDefault<z.ZodArray<z.ZodString>>;
    contextColumns: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const batchRunDraftItemInputSchema: z.ZodObject<{
    rowKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    title: z.ZodString;
    targetPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    pathSuffix: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    context: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export declare const batchRunBudgetEstimateMetricSchema: z.ZodObject<{
    metric: z.ZodEnum<{
        active_runs: "active_runs";
        daily_runs: "daily_runs";
        browser_minutes: "browser_minutes";
        model_tokens: "model_tokens";
        image_credits: "image_credits";
        mcp_calls: "mcp_calls";
        storage_bytes: "storage_bytes";
        download_bytes: "download_bytes";
        audit_exports: "audit_exports";
        replays: "replays";
        ws_connections: "ws_connections";
    }>;
    label: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    quantityLow: z.ZodNumber;
    quantityHigh: z.ZodNumber;
    unitPriceUsd: z.ZodNumber;
    amountUsdLow: z.ZodNumber;
    amountUsdHigh: z.ZodNumber;
    currency: z.ZodDefault<z.ZodLiteral<"USD">>;
}, z.core.$strip>;
export declare const batchRunBudgetEstimateSchema: z.ZodObject<{
    currency: z.ZodDefault<z.ZodLiteral<"USD">>;
    itemCount: z.ZodNumber;
    estimatedMinutesPerItemLow: z.ZodNumber;
    estimatedMinutesPerItemHigh: z.ZodNumber;
    estimatedTotalMinutesLow: z.ZodNumber;
    estimatedTotalMinutesHigh: z.ZodNumber;
    estimatedWallClockMinutesLow: z.ZodNumber;
    estimatedWallClockMinutesHigh: z.ZodNumber;
    estimatedTotalAmountUsdLow: z.ZodNumber;
    estimatedTotalAmountUsdHigh: z.ZodNumber;
    budgetLimit: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    budgetRemainingUsdLow: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    budgetRemainingUsdHigh: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    withinBudget: z.ZodDefault<z.ZodBoolean>;
    metrics: z.ZodDefault<z.ZodArray<z.ZodObject<{
        metric: z.ZodEnum<{
            active_runs: "active_runs";
            daily_runs: "daily_runs";
            browser_minutes: "browser_minutes";
            model_tokens: "model_tokens";
            image_credits: "image_credits";
            mcp_calls: "mcp_calls";
            storage_bytes: "storage_bytes";
            download_bytes: "download_bytes";
            audit_exports: "audit_exports";
            replays: "replays";
            ws_connections: "ws_connections";
        }>;
        label: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        quantityLow: z.ZodNumber;
        quantityHigh: z.ZodNumber;
        unitPriceUsd: z.ZodNumber;
        amountUsdLow: z.ZodNumber;
        amountUsdHigh: z.ZodNumber;
        currency: z.ZodDefault<z.ZodLiteral<"USD">>;
    }, z.core.$strip>>>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const createBatchRunInputSchema: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodString;
    entrySurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
    title: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        rowKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        targetPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        pathSuffix: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        context: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
    governance: z.ZodDefault<z.ZodObject<{
        maxParallelRuns: z.ZodDefault<z.ZodNumber>;
        budgetLimit: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        retryLimit: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    autoStart: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const estimateBatchRunInputSchema: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodString;
    entrySurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
    title: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        rowKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        targetPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        pathSuffix: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        context: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
    governance: z.ZodDefault<z.ZodObject<{
        maxParallelRuns: z.ZodDefault<z.ZodNumber>;
        budgetLimit: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        retryLimit: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const importBatchRunFileInputSchema: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    fileName: z.ZodString;
    contentBase64: z.ZodString;
    format: z.ZodOptional<z.ZodEnum<{
        csv: "csv";
        xlsx: "xlsx";
    }>>;
    sheetName: z.ZodOptional<z.ZodString>;
    previewLimit: z.ZodDefault<z.ZodNumber>;
    mapping: z.ZodDefault<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        pathSuffix: z.ZodOptional<z.ZodString>;
        targetPath: z.ZodOptional<z.ZodString>;
        initialMessage: z.ZodOptional<z.ZodString>;
        rowKey: z.ZodOptional<z.ZodString>;
        ignoreColumns: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const listBatchRunsQuerySchema: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        cancelled: "cancelled";
        running: "running";
        completed: "completed";
        draft: "draft";
        validated: "validated";
        queued: "queued";
        partial_failed: "partial_failed";
    }>>;
    q: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const listBatchRunItemsQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        cancelled: "cancelled";
        running: "running";
        failed: "failed";
        draft: "draft";
        validated: "validated";
        queued: "queued";
        starting: "starting";
        waiting_approval: "waiting_approval";
        succeeded: "succeeded";
    }>>;
}, z.core.$strip>;
export declare const batchRunStartInputSchema: z.ZodObject<{
    itemIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const batchRunRetryInputSchema: z.ZodObject<{
    onlyFailed: z.ZodDefault<z.ZodBoolean>;
    itemIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const batchRunCancelInputSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const batchRunJobSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const batchRunItemSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const batchRunSummarySchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    draftCount: z.ZodNumber;
    validatedCount: z.ZodNumber;
    queuedCount: z.ZodNumber;
    startingCount: z.ZodNumber;
    runningCount: z.ZodNumber;
    waitingApprovalCount: z.ZodNumber;
    succeededCount: z.ZodNumber;
    failedCount: z.ZodNumber;
    cancelledCount: z.ZodNumber;
    latestUpdatedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const batchRunDetailSchema: z.ZodObject<{
    job: z.ZodObject<{
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
    }, z.core.$strip>;
    summary: z.ZodObject<{
        totalCount: z.ZodNumber;
        draftCount: z.ZodNumber;
        validatedCount: z.ZodNumber;
        queuedCount: z.ZodNumber;
        startingCount: z.ZodNumber;
        runningCount: z.ZodNumber;
        waitingApprovalCount: z.ZodNumber;
        succeededCount: z.ZodNumber;
        failedCount: z.ZodNumber;
        cancelledCount: z.ZodNumber;
        latestUpdatedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    estimate: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        currency: z.ZodDefault<z.ZodLiteral<"USD">>;
        itemCount: z.ZodNumber;
        estimatedMinutesPerItemLow: z.ZodNumber;
        estimatedMinutesPerItemHigh: z.ZodNumber;
        estimatedTotalMinutesLow: z.ZodNumber;
        estimatedTotalMinutesHigh: z.ZodNumber;
        estimatedWallClockMinutesLow: z.ZodNumber;
        estimatedWallClockMinutesHigh: z.ZodNumber;
        estimatedTotalAmountUsdLow: z.ZodNumber;
        estimatedTotalAmountUsdHigh: z.ZodNumber;
        budgetLimit: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        budgetRemainingUsdLow: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        budgetRemainingUsdHigh: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        withinBudget: z.ZodDefault<z.ZodBoolean>;
        metrics: z.ZodDefault<z.ZodArray<z.ZodObject<{
            metric: z.ZodEnum<{
                active_runs: "active_runs";
                daily_runs: "daily_runs";
                browser_minutes: "browser_minutes";
                model_tokens: "model_tokens";
                image_credits: "image_credits";
                mcp_calls: "mcp_calls";
                storage_bytes: "storage_bytes";
                download_bytes: "download_bytes";
                audit_exports: "audit_exports";
                replays: "replays";
                ws_connections: "ws_connections";
            }>;
            label: z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>;
            quantityLow: z.ZodNumber;
            quantityHigh: z.ZodNumber;
            unitPriceUsd: z.ZodNumber;
            amountUsdLow: z.ZodNumber;
            amountUsdHigh: z.ZodNumber;
            currency: z.ZodDefault<z.ZodLiteral<"USD">>;
        }, z.core.$strip>>>;
        warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    itemsPreview: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
export declare const batchRunItemsResponseSchema: z.ZodObject<{
    job: z.ZodObject<{
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
    }, z.core.$strip>;
    summary: z.ZodObject<{
        totalCount: z.ZodNumber;
        draftCount: z.ZodNumber;
        validatedCount: z.ZodNumber;
        queuedCount: z.ZodNumber;
        startingCount: z.ZodNumber;
        runningCount: z.ZodNumber;
        waitingApprovalCount: z.ZodNumber;
        succeededCount: z.ZodNumber;
        failedCount: z.ZodNumber;
        cancelledCount: z.ZodNumber;
        latestUpdatedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    estimate: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        currency: z.ZodDefault<z.ZodLiteral<"USD">>;
        itemCount: z.ZodNumber;
        estimatedMinutesPerItemLow: z.ZodNumber;
        estimatedMinutesPerItemHigh: z.ZodNumber;
        estimatedTotalMinutesLow: z.ZodNumber;
        estimatedTotalMinutesHigh: z.ZodNumber;
        estimatedWallClockMinutesLow: z.ZodNumber;
        estimatedWallClockMinutesHigh: z.ZodNumber;
        estimatedTotalAmountUsdLow: z.ZodNumber;
        estimatedTotalAmountUsdHigh: z.ZodNumber;
        budgetLimit: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        budgetRemainingUsdLow: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        budgetRemainingUsdHigh: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        withinBudget: z.ZodDefault<z.ZodBoolean>;
        metrics: z.ZodDefault<z.ZodArray<z.ZodObject<{
            metric: z.ZodEnum<{
                active_runs: "active_runs";
                daily_runs: "daily_runs";
                browser_minutes: "browser_minutes";
                model_tokens: "model_tokens";
                image_credits: "image_credits";
                mcp_calls: "mcp_calls";
                storage_bytes: "storage_bytes";
                download_bytes: "download_bytes";
                audit_exports: "audit_exports";
                replays: "replays";
                ws_connections: "ws_connections";
            }>;
            label: z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>;
            quantityLow: z.ZodNumber;
            quantityHigh: z.ZodNumber;
            unitPriceUsd: z.ZodNumber;
            amountUsdLow: z.ZodNumber;
            amountUsdHigh: z.ZodNumber;
            currency: z.ZodDefault<z.ZodLiteral<"USD">>;
        }, z.core.$strip>>>;
        warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    items: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const importBatchRunFileResponseSchema: z.ZodObject<{
    sourceFormat: z.ZodEnum<{
        csv: "csv";
        xlsx: "xlsx";
    }>;
    fileName: z.ZodString;
    sheetNames: z.ZodDefault<z.ZodArray<z.ZodString>>;
    activeSheetName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    detectedColumns: z.ZodDefault<z.ZodArray<z.ZodString>>;
    effectiveMapping: z.ZodObject<{
        title: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        pathSuffix: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        targetPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        rowKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        ignoreColumns: z.ZodDefault<z.ZodArray<z.ZodString>>;
        contextColumns: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    items: z.ZodArray<z.ZodObject<{
        rowKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        targetPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        pathSuffix: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        context: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
    importedRowCount: z.ZodNumber;
    skippedRowCount: z.ZodNumber;
    truncated: z.ZodDefault<z.ZodBoolean>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type BatchRunJobId = z.infer<typeof batchRunJobIdSchema>;
export type BatchRunItemId = z.infer<typeof batchRunItemIdSchema>;
export type BatchRunStatus = z.infer<typeof batchRunStatusSchema>;
export type BatchRunItemStatus = z.infer<typeof batchRunItemStatusSchema>;
export type BatchRunGovernance = z.input<typeof batchRunGovernanceSchema>;
export type BatchRunItemContext = z.input<typeof batchRunItemContextSchema>;
export type BatchRunImportFileFormat = z.infer<typeof batchRunImportFileFormatSchema>;
export type BatchRunImportFieldMapping = z.input<typeof batchRunImportFieldMappingSchema>;
export type BatchRunImportResolvedMapping = z.infer<typeof batchRunImportResolvedMappingSchema>;
export type BatchRunDraftItemInput = z.input<typeof batchRunDraftItemInputSchema>;
export type BatchRunBudgetEstimateMetric = z.infer<typeof batchRunBudgetEstimateMetricSchema>;
export type BatchRunBudgetEstimate = z.infer<typeof batchRunBudgetEstimateSchema>;
export type CreateBatchRunInput = z.input<typeof createBatchRunInputSchema>;
export type EstimateBatchRunInput = z.input<typeof estimateBatchRunInputSchema>;
export type ImportBatchRunFileInput = z.input<typeof importBatchRunFileInputSchema>;
export type ListBatchRunsQuery = z.input<typeof listBatchRunsQuerySchema>;
export type ListBatchRunItemsQuery = z.input<typeof listBatchRunItemsQuerySchema>;
export type BatchRunStartInput = z.input<typeof batchRunStartInputSchema>;
export type BatchRunRetryInput = z.input<typeof batchRunRetryInputSchema>;
export type BatchRunCancelInput = z.input<typeof batchRunCancelInputSchema>;
export type BatchRunJob = z.infer<typeof batchRunJobSchema>;
export type BatchRunItem = z.infer<typeof batchRunItemSchema>;
export type BatchRunSummary = z.infer<typeof batchRunSummarySchema>;
export type BatchRunDetail = z.infer<typeof batchRunDetailSchema>;
export type BatchRunItemsResponse = z.infer<typeof batchRunItemsResponseSchema>;
export type ImportBatchRunFileResponse = z.infer<typeof importBatchRunFileResponseSchema>;
//# sourceMappingURL=batch-runs.d.ts.map