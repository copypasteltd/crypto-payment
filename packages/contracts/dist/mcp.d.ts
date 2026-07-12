import { z } from "zod";
export declare const mcpIdSchema: z.ZodString;
export declare const mcpStatusSchema: z.ZodEnum<{
    active: "active";
    disabled: "disabled";
    deprecated: "deprecated";
}>;
export declare const mcpRiskLevelSchema: z.ZodEnum<{
    low: "low";
    medium: "medium";
    high: "high";
    critical: "critical";
}>;
export declare const mcpNetworkPolicyRefSchema: z.ZodString;
export declare const mcpNetworkProtocolSchema: z.ZodEnum<{
    http: "http";
    https: "https";
    ws: "ws";
    wss: "wss";
}>;
export declare const mcpNetworkPolicyStatusSchema: z.ZodEnum<{
    active: "active";
    disabled: "disabled";
}>;
export declare const mcpNetworkPolicyModeSchema: z.ZodEnum<{
    allowlist: "allowlist";
}>;
export declare const mcpStdioPolicySchema: z.ZodObject<{
    refSha256: z.ZodString;
}, z.core.$strip>;
export declare const mcpBindingScopeSchema: z.ZodEnum<{
    user: "user";
    workspace: "workspace";
    "session-version": "session-version";
    run: "run";
}>;
export declare const mcpBindingStatusSchema: z.ZodEnum<{
    active: "active";
    disabled: "disabled";
    "needs-review": "needs-review";
}>;
export declare const mcpCallStatusSchema: z.ZodEnum<{
    error: "error";
    rejected: "rejected";
    success: "success";
    cancelled: "cancelled";
}>;
export declare const mcpHealthStatusSchema: z.ZodEnum<{
    healthy: "healthy";
    degraded: "degraded";
    unhealthy: "unhealthy";
    blocked: "blocked";
    unsupported: "unsupported";
}>;
export declare const mcpGovernanceEventActionSchema: z.ZodEnum<{
    "connector.registered": "connector.registered";
    "connector.updated": "connector.updated";
    "connector.tested": "connector.tested";
    "connector.bound": "connector.bound";
    "connector.binding_updated": "connector.binding_updated";
    "connector.bound_to_run": "connector.bound_to_run";
    "external_call.blocked": "external_call.blocked";
}>;
export declare const mcpGovernanceEventOutcomeSchema: z.ZodEnum<{
    error: "error";
    success: "success";
    blocked: "blocked";
}>;
export declare const mcpRegistryEntrySchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const mcpBindingRecordSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const listMcpsQuerySchema: z.ZodObject<{
    source: z.ZodOptional<z.ZodEnum<{
        "first-party": "first-party";
        "workspace-managed": "workspace-managed";
        "third-party": "third-party";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        deprecated: "deprecated";
    }>>;
    q: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createMcpInputSchema: z.ZodObject<{
    mcpId: z.ZodString;
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
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        deprecated: "deprecated";
    }>>;
    riskLevel: z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        critical: "critical";
    }>>;
    defaultCredentialId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    defaultNetworkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    approvalRequired: z.ZodDefault<z.ZodBoolean>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const updateMcpInputSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    transport: z.ZodOptional<z.ZodEnum<{
        stdio: "stdio";
        http: "http";
        sse: "sse";
        websocket: "websocket";
    }>>;
    ref: z.ZodOptional<z.ZodString>;
    stdioPolicy: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        refSha256: z.ZodString;
    }, z.core.$strip>>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        deprecated: "deprecated";
    }>>;
    riskLevel: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        critical: "critical";
    }>>;
    defaultCredentialId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultNetworkPolicyRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    approvalRequired: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const listMcpBindingsQuerySchema: z.ZodObject<{
    scope: z.ZodOptional<z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        run: "run";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        "needs-review": "needs-review";
    }>>;
    mcpId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createMcpBindingInputSchema: z.ZodObject<{
    mcpId: z.ZodString;
    scope: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        run: "run";
    }>;
    scopeRef: z.ZodOptional<z.ZodString>;
    credentialId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    networkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    approvalRequired: z.ZodDefault<z.ZodBoolean>;
    autoAttach: z.ZodDefault<z.ZodBoolean>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const updateMcpBindingInputSchema: z.ZodObject<{
    credentialId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        "needs-review": "needs-review";
    }>>;
    networkPolicyRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    approvalRequired: z.ZodOptional<z.ZodBoolean>;
    autoAttach: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const mcpNetworkPolicySchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const listMcpNetworkPoliciesQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
    }>>;
    q: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createMcpNetworkPolicyInputSchema: z.ZodObject<{
    policyRef: z.ZodString;
    displayName: z.ZodString;
    description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
    }>>;
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
}, z.core.$strip>;
export declare const updateMcpNetworkPolicyInputSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
    }>>;
    mode: z.ZodOptional<z.ZodEnum<{
        allowlist: "allowlist";
    }>>;
    allowedProtocols: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        http: "http";
        https: "https";
        ws: "ws";
        wss: "wss";
    }>>>;
    allowedHostPatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
    allowedPorts: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    allowedPathPrefixes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    requireTls: z.ZodOptional<z.ZodBoolean>;
    blockPrivateNetwork: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const mcpHealthSnapshotSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const listMcpHealthSnapshotsQuerySchema: z.ZodObject<{
    mcpId: z.ZodOptional<z.ZodString>;
    bindingId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        healthy: "healthy";
        degraded: "degraded";
        unhealthy: "unhealthy";
        blocked: "blocked";
        unsupported: "unsupported";
    }>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const probeMcpInputSchema: z.ZodObject<{
    bindingId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const mcpGovernanceEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    workspaceId: z.ZodString;
    actorUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    runId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    mcpId: z.ZodString;
    bindingId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    action: z.ZodEnum<{
        "connector.registered": "connector.registered";
        "connector.updated": "connector.updated";
        "connector.tested": "connector.tested";
        "connector.bound": "connector.bound";
        "connector.binding_updated": "connector.binding_updated";
        "connector.bound_to_run": "connector.bound_to_run";
        "external_call.blocked": "external_call.blocked";
    }>;
    outcome: z.ZodEnum<{
        error: "error";
        success: "success";
        blocked: "blocked";
    }>;
    reasonCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reasonDetail: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    displayName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    source: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "first-party": "first-party";
        "workspace-managed": "workspace-managed";
        "third-party": "third-party";
    }>>>;
    transport: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        stdio: "stdio";
        http: "http";
        sse: "sse";
        websocket: "websocket";
    }>>>;
    scope: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        run: "run";
    }>>>;
    scopeRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    credentialId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    networkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    endpointRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    endpointHash: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    riskLevel: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        critical: "critical";
    }>>>;
    approvalRequired: z.ZodDefault<z.ZodNullable<z.ZodBoolean>>;
    healthStatus: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        healthy: "healthy";
        degraded: "degraded";
        unhealthy: "unhealthy";
        blocked: "blocked";
        unsupported: "unsupported";
    }>>>;
    latencyMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    toolCount: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    occurredAt: z.ZodString;
    recordedAt: z.ZodString;
}, z.core.$strip>;
export declare const listMcpGovernanceEventsQuerySchema: z.ZodObject<{
    runId: z.ZodOptional<z.ZodString>;
    mcpId: z.ZodOptional<z.ZodString>;
    bindingId: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodEnum<{
        "connector.registered": "connector.registered";
        "connector.updated": "connector.updated";
        "connector.tested": "connector.tested";
        "connector.bound": "connector.bound";
        "connector.binding_updated": "connector.binding_updated";
        "connector.bound_to_run": "connector.bound_to_run";
        "external_call.blocked": "external_call.blocked";
    }>>;
    outcome: z.ZodOptional<z.ZodEnum<{
        error: "error";
        success: "success";
        blocked: "blocked";
    }>>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const mcpCallObservationSchema: z.ZodObject<{
    callId: z.ZodOptional<z.ZodString>;
    mcpId: z.ZodString;
    bindingId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    toolName: z.ZodString;
    requestId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<{
        error: "error";
        rejected: "rejected";
        success: "success";
        cancelled: "cancelled";
    }>;
    startedAt: z.ZodString;
    finishedAt: z.ZodString;
    durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    inputSummary: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    outputSummary: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    errorMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    inputBytes: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    outputBytes: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
export declare const mcpCallRecordSchema: z.ZodObject<{
    mcpId: z.ZodString;
    bindingId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    toolName: z.ZodString;
    requestId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<{
        error: "error";
        rejected: "rejected";
        success: "success";
        cancelled: "cancelled";
    }>;
    startedAt: z.ZodString;
    finishedAt: z.ZodString;
    durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    inputSummary: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    outputSummary: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    errorMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    inputBytes: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    outputBytes: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    callId: z.ZodString;
    runId: z.ZodString;
    workspaceId: z.ZodString;
    requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    taskVersionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    sessionVersionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    entrySurface: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>>;
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
    networkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    approvalRequired: z.ZodDefault<z.ZodBoolean>;
    occurredAt: z.ZodString;
    recordedAt: z.ZodString;
}, z.core.$strip>;
export declare const listMcpCallsQuerySchema: z.ZodObject<{
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    mcpId: z.ZodOptional<z.ZodString>;
    toolName: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        error: "error";
        rejected: "rejected";
        success: "success";
        cancelled: "cancelled";
    }>>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type McpId = z.infer<typeof mcpIdSchema>;
export type McpStatus = z.infer<typeof mcpStatusSchema>;
export type McpRiskLevel = z.infer<typeof mcpRiskLevelSchema>;
export type McpNetworkPolicyRef = z.infer<typeof mcpNetworkPolicyRefSchema>;
export type McpNetworkProtocol = z.infer<typeof mcpNetworkProtocolSchema>;
export type McpNetworkPolicyStatus = z.infer<typeof mcpNetworkPolicyStatusSchema>;
export type McpNetworkPolicyMode = z.infer<typeof mcpNetworkPolicyModeSchema>;
export type McpStdioPolicy = z.infer<typeof mcpStdioPolicySchema>;
export type McpBindingScope = z.infer<typeof mcpBindingScopeSchema>;
export type McpBindingStatus = z.infer<typeof mcpBindingStatusSchema>;
export type McpCallStatus = z.infer<typeof mcpCallStatusSchema>;
export type McpHealthStatus = z.infer<typeof mcpHealthStatusSchema>;
export type McpGovernanceEventAction = z.infer<typeof mcpGovernanceEventActionSchema>;
export type McpGovernanceEventOutcome = z.infer<typeof mcpGovernanceEventOutcomeSchema>;
export type McpRegistryEntry = z.infer<typeof mcpRegistryEntrySchema>;
export type McpBindingRecord = z.infer<typeof mcpBindingRecordSchema>;
export type ListMcpsQuery = z.infer<typeof listMcpsQuerySchema>;
export type CreateMcpInput = z.infer<typeof createMcpInputSchema>;
export type UpdateMcpInput = z.infer<typeof updateMcpInputSchema>;
export type ListMcpBindingsQuery = z.infer<typeof listMcpBindingsQuerySchema>;
export type CreateMcpBindingInput = z.infer<typeof createMcpBindingInputSchema>;
export type UpdateMcpBindingInput = z.infer<typeof updateMcpBindingInputSchema>;
export type McpNetworkPolicy = z.infer<typeof mcpNetworkPolicySchema>;
export type ListMcpNetworkPoliciesQuery = z.infer<typeof listMcpNetworkPoliciesQuerySchema>;
export type CreateMcpNetworkPolicyInput = z.infer<typeof createMcpNetworkPolicyInputSchema>;
export type UpdateMcpNetworkPolicyInput = z.infer<typeof updateMcpNetworkPolicyInputSchema>;
export type McpHealthSnapshot = z.infer<typeof mcpHealthSnapshotSchema>;
export type ListMcpHealthSnapshotsQuery = z.infer<typeof listMcpHealthSnapshotsQuerySchema>;
export type ProbeMcpInput = z.infer<typeof probeMcpInputSchema>;
export type McpGovernanceEvent = z.infer<typeof mcpGovernanceEventSchema>;
export type ListMcpGovernanceEventsQuery = z.infer<typeof listMcpGovernanceEventsQuerySchema>;
export type McpCallObservation = z.infer<typeof mcpCallObservationSchema>;
export type McpCallRecord = z.infer<typeof mcpCallRecordSchema>;
export type ListMcpCallsQuery = z.infer<typeof listMcpCallsQuerySchema>;
//# sourceMappingURL=mcp.d.ts.map