import { z } from "zod";
export declare const envCredentialMountSchema: z.ZodObject<{
    credentialId: z.ZodString;
    mode: z.ZodLiteral<"env">;
    envName: z.ZodString;
    readOnly: z.ZodLiteral<true>;
}, z.core.$strip>;
export declare const fileCredentialMountSchema: z.ZodObject<{
    credentialId: z.ZodString;
    mode: z.ZodLiteral<"file">;
    mountPath: z.ZodString;
    readOnly: z.ZodLiteral<true>;
}, z.core.$strip>;
export declare const credentialMountSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    credentialId: z.ZodString;
    mode: z.ZodLiteral<"env">;
    envName: z.ZodString;
    readOnly: z.ZodLiteral<true>;
}, z.core.$strip>, z.ZodObject<{
    credentialId: z.ZodString;
    mode: z.ZodLiteral<"file">;
    mountPath: z.ZodString;
    readOnly: z.ZodLiteral<true>;
}, z.core.$strip>], "mode">;
export declare const mcpBindingSchema: z.ZodObject<{
    bindingId: z.ZodString;
    mcpId: z.ZodString;
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
    riskLevel: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        critical: "critical";
    }>;
    stdioPolicy: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        refSha256: z.ZodString;
    }, z.core.$strip>>>>;
    credentialId: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    authMode: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        env: "env";
        file: "file";
    }>>>>;
    authRef: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    networkPolicyRef: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    approvalRequired: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const bridgeSessionContextSchema: z.ZodObject<{
    runId: z.ZodString;
    workspaceId: z.ZodString;
    requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    taskVersionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    sessionVersionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    entrySurface: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>>;
    workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    targetPath: z.ZodString;
    initialPrompt: z.ZodString;
    requestedInitialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    credentialMounts: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        credentialId: z.ZodString;
        mode: z.ZodLiteral<"env">;
        envName: z.ZodString;
        readOnly: z.ZodLiteral<true>;
    }, z.core.$strip>, z.ZodObject<{
        credentialId: z.ZodString;
        mode: z.ZodLiteral<"file">;
        mountPath: z.ZodString;
        readOnly: z.ZodLiteral<true>;
    }, z.core.$strip>], "mode">>>;
    mcpBindings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        bindingId: z.ZodString;
        mcpId: z.ZodString;
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
        riskLevel: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>;
        stdioPolicy: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodObject<{
            refSha256: z.ZodString;
        }, z.core.$strip>>>>;
        credentialId: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        authMode: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            env: "env";
            file: "file";
        }>>>>;
        authRef: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        networkPolicyRef: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        approvalRequired: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
    mcpNetworkPolicies: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
}, z.core.$strip>;
export type EnvCredentialMount = z.infer<typeof envCredentialMountSchema>;
export type FileCredentialMount = z.infer<typeof fileCredentialMountSchema>;
export type CredentialMount = z.infer<typeof credentialMountSchema>;
export type McpBinding = z.infer<typeof mcpBindingSchema>;
export type BridgeSessionContext = z.infer<typeof bridgeSessionContextSchema>;
//# sourceMappingURL=runtime.d.ts.map