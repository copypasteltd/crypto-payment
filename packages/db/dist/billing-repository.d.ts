import { type BillingEntry } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const billingStateSchema: z.ZodObject<{
    entries: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type BillingState = z.infer<typeof billingStateSchema>;
export interface BillingRepository {
    init(): Promise<void>;
    listEntries(): BillingEntry[];
    getEntryById(entryId: string): BillingEntry | null;
    saveEntry(entry: BillingEntry): Promise<void>;
}
export declare abstract class CachedBillingRepository implements BillingRepository {
    protected initialized: boolean;
    protected state: BillingState;
    init(): Promise<void>;
    listEntries(): {
        entryId: string;
        workspaceId: string;
        workspaceContextKey: string | null;
        packageId: string | null;
        serviceId: string | null;
        taskVersionId: string | null;
        sessionVersionId: string | null;
        entrySurface: "dashboard" | "h5" | "mini-program" | null;
        runId: string | null;
        requestedByUserId: string | null;
        metric: "active_runs" | "daily_runs" | "browser_minutes" | "model_tokens" | "image_credits" | "mcp_calls" | "storage_bytes" | "download_bytes" | "audit_exports" | "replays" | "ws_connections";
        quantity: number;
        unitPriceUsd: number;
        amountUsd: number;
        currency: "USD";
        source: "run-message" | "run-upload" | "file-read" | "file-preview" | "download-ticket" | "file-download" | "mcp-call" | "audit-export" | "runtime-estimate";
        costBasis: "estimated" | "actual";
        sourceRef: string | null;
        note: string | null;
        createdAt: string;
        updatedAt: string;
        occurredAt: string;
    }[];
    getEntryById(entryId: string): {
        entryId: string;
        workspaceId: string;
        workspaceContextKey: string | null;
        packageId: string | null;
        serviceId: string | null;
        taskVersionId: string | null;
        sessionVersionId: string | null;
        entrySurface: "dashboard" | "h5" | "mini-program" | null;
        runId: string | null;
        requestedByUserId: string | null;
        metric: "active_runs" | "daily_runs" | "browser_minutes" | "model_tokens" | "image_credits" | "mcp_calls" | "storage_bytes" | "download_bytes" | "audit_exports" | "replays" | "ws_connections";
        quantity: number;
        unitPriceUsd: number;
        amountUsd: number;
        currency: "USD";
        source: "run-message" | "run-upload" | "file-read" | "file-preview" | "download-ticket" | "file-download" | "mcp-call" | "audit-export" | "runtime-estimate";
        costBasis: "estimated" | "actual";
        sourceRef: string | null;
        note: string | null;
        createdAt: string;
        updatedAt: string;
        occurredAt: string;
    } | null;
    saveEntry(entry: BillingEntry): Promise<void>;
    protected updateState(mutator: (state: BillingState) => BillingState): Promise<void>;
    protected replaceCachedEntry(entry: BillingEntry): void;
    protected abstract loadState(): Promise<BillingState>;
    protected abstract writeState(state: BillingState): Promise<void>;
}
export interface PostgresBillingRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresBillingRepository extends CachedBillingRepository {
    #private;
    constructor(options: PostgresBillingRepositoryOptions);
    protected loadState(): Promise<{
        entries: {
            entryId: string;
            workspaceId: string;
            workspaceContextKey: string | null;
            packageId: string | null;
            serviceId: string | null;
            taskVersionId: string | null;
            sessionVersionId: string | null;
            entrySurface: "dashboard" | "h5" | "mini-program" | null;
            runId: string | null;
            requestedByUserId: string | null;
            metric: "active_runs" | "daily_runs" | "browser_minutes" | "model_tokens" | "image_credits" | "mcp_calls" | "storage_bytes" | "download_bytes" | "audit_exports" | "replays" | "ws_connections";
            quantity: number;
            unitPriceUsd: number;
            amountUsd: number;
            currency: "USD";
            source: "run-message" | "run-upload" | "file-read" | "file-preview" | "download-ticket" | "file-download" | "mcp-call" | "audit-export" | "runtime-estimate";
            costBasis: "estimated" | "actual";
            sourceRef: string | null;
            note: string | null;
            createdAt: string;
            updatedAt: string;
            occurredAt: string;
        }[];
    }>;
    saveEntry(entry: BillingEntry): Promise<void>;
    protected writeState(state: BillingState): Promise<void>;
}
//# sourceMappingURL=billing-repository.d.ts.map