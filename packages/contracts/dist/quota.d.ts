import { z } from "zod";
export declare const quotaScopeTypeSchema: z.ZodEnum<{
    user: "user";
    workspace: "workspace";
    "session-version": "session-version";
    "workspace-context": "workspace-context";
    service: "service";
    "task-version": "task-version";
    package: "package";
    "entry-surface": "entry-surface";
}>;
export declare const quotaMetricSchema: z.ZodEnum<{
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
export declare const quotaWindowTypeSchema: z.ZodEnum<{
    instant: "instant";
    daily: "daily";
    monthly: "monthly";
}>;
export declare const quotaPolicyStatusSchema: z.ZodEnum<{
    active: "active";
    draft: "draft";
    archived: "archived";
    paused: "paused";
    replaced: "replaced";
}>;
export declare const quotaSoftActionSchema: z.ZodEnum<{
    warn: "warn";
    require_approval: "require_approval";
}>;
export declare const quotaHardActionSchema: z.ZodEnum<{
    block: "block";
    require_override: "require_override";
}>;
export declare const quotaEventDecisionSchema: z.ZodEnum<{
    healthy: "healthy";
    blocked: "blocked";
    warned: "warned";
    approval_pending: "approval_pending";
    approved_override: "approved_override";
    rejected_override: "rejected_override";
}>;
export declare const quotaOverrideStatusSchema: z.ZodEnum<{
    pending: "pending";
    approved: "approved";
    rejected: "rejected";
    expired: "expired";
}>;
export declare const quotaDecisionKindSchema: z.ZodEnum<{
    warn: "warn";
    require_approval: "require_approval";
    block: "block";
    allow: "allow";
}>;
export declare const quotaPolicyIdSchema: z.ZodString;
export declare const quotaCounterIdSchema: z.ZodString;
export declare const quotaEventIdSchema: z.ZodString;
export declare const quotaOverrideIdSchema: z.ZodString;
export declare const quotaPolicySchema: z.ZodObject<{
    createdByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    updatedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
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
    policyId: z.ZodString;
    workspaceId: z.ZodString;
    scopeType: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        "workspace-context": "workspace-context";
        service: "service";
        "task-version": "task-version";
        package: "package";
        "entry-surface": "entry-surface";
    }>;
    scopeRefId: z.ZodString;
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
    windowType: z.ZodEnum<{
        instant: "instant";
        daily: "daily";
        monthly: "monthly";
    }>;
    limitValue: z.ZodNumber;
    softLimitValue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    hardLimitValue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    actionOnSoftLimit: z.ZodEnum<{
        warn: "warn";
        require_approval: "require_approval";
    }>;
    actionOnHardLimit: z.ZodEnum<{
        block: "block";
        require_override: "require_override";
    }>;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
        paused: "paused";
        replaced: "replaced";
    }>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    priority: z.ZodDefault<z.ZodNumber>;
    summary: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const quotaCounterSchema: z.ZodObject<{
    updatedAt: z.ZodString;
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
    counterId: z.ZodString;
    policyId: z.ZodString;
    workspaceId: z.ZodString;
    scopeType: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        "workspace-context": "workspace-context";
        service: "service";
        "task-version": "task-version";
        package: "package";
        "entry-surface": "entry-surface";
    }>;
    scopeRefId: z.ZodString;
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
    windowType: z.ZodEnum<{
        instant: "instant";
        daily: "daily";
        monthly: "monthly";
    }>;
    windowStartedAt: z.ZodString;
    windowEndsAt: z.ZodString;
    currentValue: z.ZodNumber;
}, z.core.$strip>;
export declare const quotaEventSchema: z.ZodObject<{
    occurredAt: z.ZodString;
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
    eventId: z.ZodString;
    policyId: z.ZodString;
    workspaceId: z.ZodString;
    scopeType: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        "workspace-context": "workspace-context";
        service: "service";
        "task-version": "task-version";
        package: "package";
        "entry-surface": "entry-surface";
    }>;
    scopeRefId: z.ZodString;
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
    decision: z.ZodEnum<{
        healthy: "healthy";
        blocked: "blocked";
        warned: "warned";
        approval_pending: "approval_pending";
        approved_override: "approved_override";
        rejected_override: "rejected_override";
    }>;
    currentValue: z.ZodNumber;
    limitValue: z.ZodNumber;
    runId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    approvalId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    overrideId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    note: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const quotaOverrideRecordSchema: z.ZodObject<{
    requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    requestedAt: z.ZodString;
    decidedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    decidedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    decisionNote: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    updatedAt: z.ZodString;
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
    overrideId: z.ZodString;
    policyId: z.ZodString;
    workspaceId: z.ZodString;
    scopeType: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        "workspace-context": "workspace-context";
        service: "service";
        "task-version": "task-version";
        package: "package";
        "entry-surface": "entry-surface";
    }>;
    scopeRefId: z.ZodString;
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
    status: z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
        expired: "expired";
    }>;
    requiredRole: z.ZodEnum<{
        owner: "owner";
        admin: "admin";
        operator: "operator";
        creator: "creator";
        viewer: "viewer";
    }>;
    currentValue: z.ZodNumber;
    limitValue: z.ZodNumber;
    requestedDelta: z.ZodNumber;
    reasonSummary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    runId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    approvalId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const quotaDecisionPreviewSchema: z.ZodObject<{
    decision: z.ZodEnum<{
        warn: "warn";
        require_approval: "require_approval";
        block: "block";
        allow: "allow";
    }>;
    policyId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    metric: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
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
    }>>>;
    currentValue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    limitValue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    summary: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
    overrideId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const listQuotaPoliciesQuerySchema: z.ZodObject<{
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
    scopeType: z.ZodOptional<z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        "workspace-context": "workspace-context";
        service: "service";
        "task-version": "task-version";
        package: "package";
        "entry-surface": "entry-surface";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
        paused: "paused";
        replaced: "replaced";
    }>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const createQuotaPolicyInputSchema: z.ZodObject<{
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
    scopeType: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        "workspace-context": "workspace-context";
        service: "service";
        "task-version": "task-version";
        package: "package";
        "entry-surface": "entry-surface";
    }>;
    scopeRefId: z.ZodString;
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
    windowType: z.ZodEnum<{
        instant: "instant";
        daily: "daily";
        monthly: "monthly";
    }>;
    limitValue: z.ZodNumber;
    softLimitValue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    hardLimitValue: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    actionOnSoftLimit: z.ZodDefault<z.ZodEnum<{
        warn: "warn";
        require_approval: "require_approval";
    }>>;
    actionOnHardLimit: z.ZodDefault<z.ZodEnum<{
        block: "block";
        require_override: "require_override";
    }>>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
        paused: "paused";
        replaced: "replaced";
    }>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    priority: z.ZodDefault<z.ZodNumber>;
    summary: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const updateQuotaPolicyInputSchema: z.ZodObject<{
    scopeType: z.ZodOptional<z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        "workspace-context": "workspace-context";
        service: "service";
        "task-version": "task-version";
        package: "package";
        "entry-surface": "entry-surface";
    }>>;
    scopeRefId: z.ZodOptional<z.ZodString>;
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
    windowType: z.ZodOptional<z.ZodEnum<{
        instant: "instant";
        daily: "daily";
        monthly: "monthly";
    }>>;
    limitValue: z.ZodOptional<z.ZodNumber>;
    softLimitValue: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    hardLimitValue: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    actionOnSoftLimit: z.ZodOptional<z.ZodEnum<{
        warn: "warn";
        require_approval: "require_approval";
    }>>;
    actionOnHardLimit: z.ZodOptional<z.ZodEnum<{
        block: "block";
        require_override: "require_override";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        draft: "draft";
        archived: "archived";
        paused: "paused";
        replaced: "replaced";
    }>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    priority: z.ZodOptional<z.ZodNumber>;
    summary: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    workspaceContextKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    packageId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serviceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    taskVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sessionVersionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    entrySurface: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>>;
}, z.core.$strip>;
export declare const listQuotaCountersQuerySchema: z.ZodObject<{
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
    scopeType: z.ZodOptional<z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        "workspace-context": "workspace-context";
        service: "service";
        "task-version": "task-version";
        package: "package";
        "entry-surface": "entry-surface";
    }>>;
    runId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const listQuotaEventsQuerySchema: z.ZodObject<{
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
    decision: z.ZodOptional<z.ZodEnum<{
        healthy: "healthy";
        blocked: "blocked";
        warned: "warned";
        approval_pending: "approval_pending";
        approved_override: "approved_override";
        rejected_override: "rejected_override";
    }>>;
    runId: z.ZodOptional<z.ZodString>;
    overrideId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const listQuotaOverridesQuerySchema: z.ZodObject<{
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
    status: z.ZodOptional<z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
        expired: "expired";
    }>>;
    runId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const decideQuotaOverrideInputSchema: z.ZodObject<{
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type QuotaScopeType = z.infer<typeof quotaScopeTypeSchema>;
export type QuotaMetric = z.infer<typeof quotaMetricSchema>;
export type QuotaWindowType = z.infer<typeof quotaWindowTypeSchema>;
export type QuotaPolicyStatus = z.infer<typeof quotaPolicyStatusSchema>;
export type QuotaSoftAction = z.infer<typeof quotaSoftActionSchema>;
export type QuotaHardAction = z.infer<typeof quotaHardActionSchema>;
export type QuotaEventDecision = z.infer<typeof quotaEventDecisionSchema>;
export type QuotaOverrideStatus = z.infer<typeof quotaOverrideStatusSchema>;
export type QuotaDecisionKind = z.infer<typeof quotaDecisionKindSchema>;
export type QuotaPolicy = z.infer<typeof quotaPolicySchema>;
export type QuotaCounter = z.infer<typeof quotaCounterSchema>;
export type QuotaEvent = z.infer<typeof quotaEventSchema>;
export type QuotaOverrideRecord = z.infer<typeof quotaOverrideRecordSchema>;
export type QuotaDecisionPreview = z.infer<typeof quotaDecisionPreviewSchema>;
export type ListQuotaPoliciesQuery = z.infer<typeof listQuotaPoliciesQuerySchema>;
export type CreateQuotaPolicyInput = z.infer<typeof createQuotaPolicyInputSchema>;
export type UpdateQuotaPolicyInput = z.infer<typeof updateQuotaPolicyInputSchema>;
export type ListQuotaCountersQuery = z.infer<typeof listQuotaCountersQuerySchema>;
export type ListQuotaEventsQuery = z.infer<typeof listQuotaEventsQuerySchema>;
export type ListQuotaOverridesQuery = z.infer<typeof listQuotaOverridesQuerySchema>;
export type DecideQuotaOverrideInput = z.infer<typeof decideQuotaOverrideInputSchema>;
//# sourceMappingURL=quota.d.ts.map