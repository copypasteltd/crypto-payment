import { type McpBindingRecord, type McpHealthSnapshot, type McpNetworkPolicy, type McpRegistryEntry } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const mcpStateSchema: z.ZodObject<{
    registry: z.ZodDefault<z.ZodArray<z.ZodObject<{
        mcpId: z.ZodString;
        workspaceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        displayName: z.ZodString;
        description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        source: z.ZodEnum<{
            "first-party": "first-party";
            "workspace-managed": "workspace-managed";
            "third-party": "third-party";
        }>;
        transport: z.ZodEnum<{
            stdio: "stdio";
            http: "http";
            sse: "sse";
            websocket: "websocket";
        }>;
        ref: z.ZodString;
        stdioPolicy: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            refSha256: z.ZodString;
        }, z.core.$strip>>>;
        status: z.ZodEnum<{
            active: "active";
            disabled: "disabled";
            deprecated: "deprecated";
        }>;
        riskLevel: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>;
        defaultCredentialId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        defaultNetworkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        approvalRequired: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>>;
    bindings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        bindingId: z.ZodString;
        mcpId: z.ZodString;
        workspaceId: z.ZodString;
        scope: z.ZodEnum<{
            user: "user";
            workspace: "workspace";
            "session-version": "session-version";
            run: "run";
        }>;
        scopeRef: z.ZodString;
        credentialId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            disabled: "disabled";
            "needs-review": "needs-review";
        }>;
        networkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        approvalRequired: z.ZodDefault<z.ZodBoolean>;
        autoAttach: z.ZodDefault<z.ZodBoolean>;
        notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>>;
    networkPolicies: z.ZodDefault<z.ZodArray<z.ZodObject<{
        policyRef: z.ZodString;
        workspaceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        displayName: z.ZodString;
        description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<{
            active: "active";
            disabled: "disabled";
        }>;
        mode: z.ZodDefault<z.ZodEnum<{
            allowlist: "allowlist";
        }>>;
        allowedProtocols: z.ZodArray<z.ZodEnum<{
            http: "http";
            https: "https";
            ws: "ws";
            wss: "wss";
        }>>;
        allowedHostPatterns: z.ZodArray<z.ZodString>;
        allowedPorts: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
        allowedPathPrefixes: z.ZodDefault<z.ZodArray<z.ZodString>>;
        requireTls: z.ZodDefault<z.ZodBoolean>;
        blockPrivateNetwork: z.ZodDefault<z.ZodBoolean>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>>;
    healthSnapshots: z.ZodDefault<z.ZodArray<z.ZodObject<{
        snapshotId: z.ZodString;
        mcpId: z.ZodString;
        bindingId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workspaceId: z.ZodString;
        requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        displayName: z.ZodString;
        source: z.ZodEnum<{
            "first-party": "first-party";
            "workspace-managed": "workspace-managed";
            "third-party": "third-party";
        }>;
        transport: z.ZodEnum<{
            stdio: "stdio";
            http: "http";
            sse: "sse";
            websocket: "websocket";
        }>;
        ref: z.ZodString;
        networkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<{
            healthy: "healthy";
            degraded: "degraded";
            unhealthy: "unhealthy";
            blocked: "blocked";
            unsupported: "unsupported";
        }>;
        detail: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        errorCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        httpStatus: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        latencyMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        toolCount: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        policyEnforced: z.ZodDefault<z.ZodBoolean>;
        probedAt: z.ZodString;
        recordedAt: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const mcpIdParamsSchema: z.ZodObject<{
    mcpId: z.ZodString;
}, z.core.$strip>;
export declare const mcpBindingIdParamsSchema: z.ZodObject<{
    bindingId: z.ZodString;
}, z.core.$strip>;
export declare const mcpNetworkPolicyRefParamsSchema: z.ZodObject<{
    policyRef: z.ZodString;
}, z.core.$strip>;
export type McpState = z.infer<typeof mcpStateSchema>;
export interface McpRepository {
    init(): Promise<void>;
    listRegistry(): McpRegistryEntry[];
    getRegistryEntry(mcpId: string): McpRegistryEntry | null;
    saveRegistryEntry(entry: McpRegistryEntry): Promise<McpRegistryEntry>;
    listBindings(): McpBindingRecord[];
    getBinding(bindingId: string): McpBindingRecord | null;
    saveBinding(binding: McpBindingRecord): Promise<McpBindingRecord>;
    listNetworkPolicies(): McpNetworkPolicy[];
    getNetworkPolicy(policyRef: string): McpNetworkPolicy | null;
    saveNetworkPolicy(policy: McpNetworkPolicy): Promise<McpNetworkPolicy>;
    listHealthSnapshots(): McpHealthSnapshot[];
    getLatestHealthSnapshot(params: {
        mcpId: string;
        bindingId?: string | null;
    }): McpHealthSnapshot | null;
    saveHealthSnapshot(snapshot: McpHealthSnapshot): Promise<McpHealthSnapshot>;
}
export declare abstract class CachedMcpRepository implements McpRepository {
    #private;
    init(): Promise<void>;
    listRegistry(): {
        mcpId: string;
        workspaceId: string | null;
        displayName: string;
        description: string | null;
        source: "first-party" | "workspace-managed" | "third-party";
        transport: "stdio" | "http" | "sse" | "websocket";
        ref: string;
        stdioPolicy: {
            refSha256: string;
        } | null;
        status: "active" | "disabled" | "deprecated";
        riskLevel: "low" | "medium" | "high" | "critical";
        defaultCredentialId: string | null;
        defaultNetworkPolicyRef: string | null;
        approvalRequired: boolean;
        tags: string[];
        createdAt: string;
        updatedAt: string;
    }[];
    getRegistryEntry(mcpId: string): {
        mcpId: string;
        workspaceId: string | null;
        displayName: string;
        description: string | null;
        source: "first-party" | "workspace-managed" | "third-party";
        transport: "stdio" | "http" | "sse" | "websocket";
        ref: string;
        stdioPolicy: {
            refSha256: string;
        } | null;
        status: "active" | "disabled" | "deprecated";
        riskLevel: "low" | "medium" | "high" | "critical";
        defaultCredentialId: string | null;
        defaultNetworkPolicyRef: string | null;
        approvalRequired: boolean;
        tags: string[];
        createdAt: string;
        updatedAt: string;
    } | null;
    saveRegistryEntry(entry: McpRegistryEntry): Promise<{
        mcpId: string;
        workspaceId: string | null;
        displayName: string;
        description: string | null;
        source: "first-party" | "workspace-managed" | "third-party";
        transport: "stdio" | "http" | "sse" | "websocket";
        ref: string;
        stdioPolicy: {
            refSha256: string;
        } | null;
        status: "active" | "disabled" | "deprecated";
        riskLevel: "low" | "medium" | "high" | "critical";
        defaultCredentialId: string | null;
        defaultNetworkPolicyRef: string | null;
        approvalRequired: boolean;
        tags: string[];
        createdAt: string;
        updatedAt: string;
    }>;
    listBindings(): {
        bindingId: string;
        mcpId: string;
        workspaceId: string;
        scope: "run" | "user" | "workspace" | "session-version";
        scopeRef: string;
        credentialId: string | null;
        status: "active" | "disabled" | "needs-review";
        networkPolicyRef: string | null;
        approvalRequired: boolean;
        autoAttach: boolean;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
    }[];
    getBinding(bindingId: string): {
        bindingId: string;
        mcpId: string;
        workspaceId: string;
        scope: "run" | "user" | "workspace" | "session-version";
        scopeRef: string;
        credentialId: string | null;
        status: "active" | "disabled" | "needs-review";
        networkPolicyRef: string | null;
        approvalRequired: boolean;
        autoAttach: boolean;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
    } | null;
    saveBinding(binding: McpBindingRecord): Promise<{
        bindingId: string;
        mcpId: string;
        workspaceId: string;
        scope: "run" | "user" | "workspace" | "session-version";
        scopeRef: string;
        credentialId: string | null;
        status: "active" | "disabled" | "needs-review";
        networkPolicyRef: string | null;
        approvalRequired: boolean;
        autoAttach: boolean;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    listNetworkPolicies(): {
        policyRef: string;
        workspaceId: string | null;
        displayName: string;
        description: string | null;
        status: "active" | "disabled";
        mode: "allowlist";
        allowedProtocols: ("http" | "https" | "ws" | "wss")[];
        allowedHostPatterns: string[];
        allowedPorts: number[];
        allowedPathPrefixes: string[];
        requireTls: boolean;
        blockPrivateNetwork: boolean;
        tags: string[];
        createdAt: string;
        updatedAt: string;
    }[];
    getNetworkPolicy(policyRef: string): {
        policyRef: string;
        workspaceId: string | null;
        displayName: string;
        description: string | null;
        status: "active" | "disabled";
        mode: "allowlist";
        allowedProtocols: ("http" | "https" | "ws" | "wss")[];
        allowedHostPatterns: string[];
        allowedPorts: number[];
        allowedPathPrefixes: string[];
        requireTls: boolean;
        blockPrivateNetwork: boolean;
        tags: string[];
        createdAt: string;
        updatedAt: string;
    } | null;
    saveNetworkPolicy(policy: McpNetworkPolicy): Promise<{
        policyRef: string;
        workspaceId: string | null;
        displayName: string;
        description: string | null;
        status: "active" | "disabled";
        mode: "allowlist";
        allowedProtocols: ("http" | "https" | "ws" | "wss")[];
        allowedHostPatterns: string[];
        allowedPorts: number[];
        allowedPathPrefixes: string[];
        requireTls: boolean;
        blockPrivateNetwork: boolean;
        tags: string[];
        createdAt: string;
        updatedAt: string;
    }>;
    listHealthSnapshots(): {
        snapshotId: string;
        mcpId: string;
        bindingId: string | null;
        workspaceId: string;
        requestedByUserId: string | null;
        displayName: string;
        source: "first-party" | "workspace-managed" | "third-party";
        transport: "stdio" | "http" | "sse" | "websocket";
        ref: string;
        networkPolicyRef: string | null;
        status: "healthy" | "blocked" | "degraded" | "unhealthy" | "unsupported";
        detail: string | null;
        errorCode: string | null;
        httpStatus: number | null;
        latencyMs: number | null;
        toolCount: number | null;
        policyEnforced: boolean;
        probedAt: string;
        recordedAt: string;
    }[];
    getLatestHealthSnapshot(params: {
        mcpId: string;
        bindingId?: string | null;
    }): {
        snapshotId: string;
        mcpId: string;
        bindingId: string | null;
        workspaceId: string;
        requestedByUserId: string | null;
        displayName: string;
        source: "first-party" | "workspace-managed" | "third-party";
        transport: "stdio" | "http" | "sse" | "websocket";
        ref: string;
        networkPolicyRef: string | null;
        status: "healthy" | "blocked" | "degraded" | "unhealthy" | "unsupported";
        detail: string | null;
        errorCode: string | null;
        httpStatus: number | null;
        latencyMs: number | null;
        toolCount: number | null;
        policyEnforced: boolean;
        probedAt: string;
        recordedAt: string;
    } | null;
    saveHealthSnapshot(snapshot: McpHealthSnapshot): Promise<{
        snapshotId: string;
        mcpId: string;
        bindingId: string | null;
        workspaceId: string;
        requestedByUserId: string | null;
        displayName: string;
        source: "first-party" | "workspace-managed" | "third-party";
        transport: "stdio" | "http" | "sse" | "websocket";
        ref: string;
        networkPolicyRef: string | null;
        status: "healthy" | "blocked" | "degraded" | "unhealthy" | "unsupported";
        detail: string | null;
        errorCode: string | null;
        httpStatus: number | null;
        latencyMs: number | null;
        toolCount: number | null;
        policyEnforced: boolean;
        probedAt: string;
        recordedAt: string;
    }>;
    protected replaceState(state: McpState): Promise<void>;
    protected getState(): {
        registry: {
            mcpId: string;
            workspaceId: string | null;
            displayName: string;
            description: string | null;
            source: "first-party" | "workspace-managed" | "third-party";
            transport: "stdio" | "http" | "sse" | "websocket";
            ref: string;
            stdioPolicy: {
                refSha256: string;
            } | null;
            status: "active" | "disabled" | "deprecated";
            riskLevel: "low" | "medium" | "high" | "critical";
            defaultCredentialId: string | null;
            defaultNetworkPolicyRef: string | null;
            approvalRequired: boolean;
            tags: string[];
            createdAt: string;
            updatedAt: string;
        }[];
        bindings: {
            bindingId: string;
            mcpId: string;
            workspaceId: string;
            scope: "run" | "user" | "workspace" | "session-version";
            scopeRef: string;
            credentialId: string | null;
            status: "active" | "disabled" | "needs-review";
            networkPolicyRef: string | null;
            approvalRequired: boolean;
            autoAttach: boolean;
            notes: string | null;
            createdAt: string;
            updatedAt: string;
        }[];
        networkPolicies: {
            policyRef: string;
            workspaceId: string | null;
            displayName: string;
            description: string | null;
            status: "active" | "disabled";
            mode: "allowlist";
            allowedProtocols: ("http" | "https" | "ws" | "wss")[];
            allowedHostPatterns: string[];
            allowedPorts: number[];
            allowedPathPrefixes: string[];
            requireTls: boolean;
            blockPrivateNetwork: boolean;
            tags: string[];
            createdAt: string;
            updatedAt: string;
        }[];
        healthSnapshots: {
            snapshotId: string;
            mcpId: string;
            bindingId: string | null;
            workspaceId: string;
            requestedByUserId: string | null;
            displayName: string;
            source: "first-party" | "workspace-managed" | "third-party";
            transport: "stdio" | "http" | "sse" | "websocket";
            ref: string;
            networkPolicyRef: string | null;
            status: "healthy" | "blocked" | "degraded" | "unhealthy" | "unsupported";
            detail: string | null;
            errorCode: string | null;
            httpStatus: number | null;
            latencyMs: number | null;
            toolCount: number | null;
            policyEnforced: boolean;
            probedAt: string;
            recordedAt: string;
        }[];
    };
    protected updateState(mutator: (state: McpState) => McpState): Promise<void>;
    protected abstract loadState(): Promise<McpState>;
    protected abstract writeState(state: McpState): Promise<void>;
}
export interface PostgresMcpRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresMcpRepository extends CachedMcpRepository {
    #private;
    constructor(options: PostgresMcpRepositoryOptions);
    protected loadState(): Promise<{
        registry: {
            mcpId: string;
            workspaceId: string | null;
            displayName: string;
            description: string | null;
            source: "first-party" | "workspace-managed" | "third-party";
            transport: "stdio" | "http" | "sse" | "websocket";
            ref: string;
            stdioPolicy: {
                refSha256: string;
            } | null;
            status: "active" | "disabled" | "deprecated";
            riskLevel: "low" | "medium" | "high" | "critical";
            defaultCredentialId: string | null;
            defaultNetworkPolicyRef: string | null;
            approvalRequired: boolean;
            tags: string[];
            createdAt: string;
            updatedAt: string;
        }[];
        bindings: {
            bindingId: string;
            mcpId: string;
            workspaceId: string;
            scope: "run" | "user" | "workspace" | "session-version";
            scopeRef: string;
            credentialId: string | null;
            status: "active" | "disabled" | "needs-review";
            networkPolicyRef: string | null;
            approvalRequired: boolean;
            autoAttach: boolean;
            notes: string | null;
            createdAt: string;
            updatedAt: string;
        }[];
        networkPolicies: {
            policyRef: string;
            workspaceId: string | null;
            displayName: string;
            description: string | null;
            status: "active" | "disabled";
            mode: "allowlist";
            allowedProtocols: ("http" | "https" | "ws" | "wss")[];
            allowedHostPatterns: string[];
            allowedPorts: number[];
            allowedPathPrefixes: string[];
            requireTls: boolean;
            blockPrivateNetwork: boolean;
            tags: string[];
            createdAt: string;
            updatedAt: string;
        }[];
        healthSnapshots: {
            snapshotId: string;
            mcpId: string;
            bindingId: string | null;
            workspaceId: string;
            requestedByUserId: string | null;
            displayName: string;
            source: "first-party" | "workspace-managed" | "third-party";
            transport: "stdio" | "http" | "sse" | "websocket";
            ref: string;
            networkPolicyRef: string | null;
            status: "healthy" | "blocked" | "degraded" | "unhealthy" | "unsupported";
            detail: string | null;
            errorCode: string | null;
            httpStatus: number | null;
            latencyMs: number | null;
            toolCount: number | null;
            policyEnforced: boolean;
            probedAt: string;
            recordedAt: string;
        }[];
    }>;
    protected writeState(state: McpState): Promise<void>;
}
//# sourceMappingURL=mcp-repository.d.ts.map