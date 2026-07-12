import { z } from "zod";
export declare const billingSourceSchema: z.ZodEnum<{
    "run-message": "run-message";
    "run-upload": "run-upload";
    "file-read": "file-read";
    "file-preview": "file-preview";
    "download-ticket": "download-ticket";
    "file-download": "file-download";
    "mcp-call": "mcp-call";
    "audit-export": "audit-export";
    "runtime-estimate": "runtime-estimate";
}>;
export declare const billingCostBasisSchema: z.ZodEnum<{
    estimated: "estimated";
    actual: "actual";
}>;
export declare const billingEntrySchema: z.ZodObject<{
    entryId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    packageId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    taskVersionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    sessionVersionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    entrySurface: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>>;
    runId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
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
    quantity: z.ZodNumber;
    unitPriceUsd: z.ZodNumber;
    amountUsd: z.ZodNumber;
    currency: z.ZodDefault<z.ZodLiteral<"USD">>;
    source: z.ZodEnum<{
        "run-message": "run-message";
        "run-upload": "run-upload";
        "file-read": "file-read";
        "file-preview": "file-preview";
        "download-ticket": "download-ticket";
        "file-download": "file-download";
        "mcp-call": "mcp-call";
        "audit-export": "audit-export";
        "runtime-estimate": "runtime-estimate";
    }>;
    costBasis: z.ZodDefault<z.ZodEnum<{
        estimated: "estimated";
        actual: "actual";
    }>>;
    sourceRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    note: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    occurredAt: z.ZodString;
}, z.core.$strip>;
export declare const billingMetricSummarySchema: z.ZodObject<{
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
    quantity: z.ZodNumber;
    amountUsd: z.ZodNumber;
    entriesCount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodLiteral<"USD">>;
    latestOccurredAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    label: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const billingLedgerSummarySchema: z.ZodObject<{
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    packageId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    runId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    currency: z.ZodDefault<z.ZodLiteral<"USD">>;
    totalAmountUsd: z.ZodNumber;
    totalEntriesCount: z.ZodNumber;
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
        quantity: z.ZodNumber;
        amountUsd: z.ZodNumber;
        entriesCount: z.ZodNumber;
        currency: z.ZodDefault<z.ZodLiteral<"USD">>;
        latestOccurredAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        label: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    updatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const listBillingEntriesQuerySchema: z.ZodObject<{
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    packageId: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    metric: z.ZodOptional<z.ZodEnum<{
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
    }>>;
    source: z.ZodOptional<z.ZodEnum<{
        "run-message": "run-message";
        "run-upload": "run-upload";
        "file-read": "file-read";
        "file-preview": "file-preview";
        "download-ticket": "download-ticket";
        "file-download": "file-download";
        "mcp-call": "mcp-call";
        "audit-export": "audit-export";
        "runtime-estimate": "runtime-estimate";
    }>>;
    costBasis: z.ZodOptional<z.ZodEnum<{
        estimated: "estimated";
        actual: "actual";
    }>>;
    runId: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const billingLedgerSummaryQuerySchema: z.ZodObject<{
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    packageId: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BillingSource = z.infer<typeof billingSourceSchema>;
export type BillingCostBasis = z.infer<typeof billingCostBasisSchema>;
export type BillingEntry = z.infer<typeof billingEntrySchema>;
export type BillingMetricSummary = z.infer<typeof billingMetricSummarySchema>;
export type BillingLedgerSummary = z.infer<typeof billingLedgerSummarySchema>;
export type ListBillingEntriesQuery = z.infer<typeof listBillingEntriesQuerySchema>;
export type BillingLedgerSummaryQuery = z.infer<typeof billingLedgerSummaryQuerySchema>;
//# sourceMappingURL=billing.d.ts.map