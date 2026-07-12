import { z } from "zod";
export declare const credentialScopeSchema: z.ZodEnum<{
    user: "user";
    workspace: "workspace";
}>;
export declare const credentialStatusSchema: z.ZodEnum<{
    active: "active";
    disabled: "disabled";
    revoked: "revoked";
    "needs-rotation": "needs-rotation";
}>;
export declare const credentialSecretKindSchema: z.ZodEnum<{
    "api-key": "api-key";
    "access-token": "access-token";
    "oauth-token": "oauth-token";
    "json-file": "json-file";
    "browser-storage-state": "browser-storage-state";
    "session-cookie": "session-cookie";
}>;
export declare const credentialBrokerKindSchema: z.ZodEnum<{
    "local-envelope": "local-envelope";
    "vault-transit-http": "vault-transit-http";
    "aws-kms-envelope": "aws-kms-envelope";
}>;
export declare const localEnvelopeSecretEnvelopeSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    brokerKind: z.ZodLiteral<"local-envelope">;
    algorithm: z.ZodLiteral<"aes-256-gcm">;
    keyId: z.ZodString;
    ivBase64: z.ZodString;
    authTagBase64: z.ZodString;
    ciphertextBase64: z.ZodString;
}, z.core.$strip>;
export declare const vaultTransitSecretEnvelopeSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    brokerKind: z.ZodLiteral<"vault-transit-http">;
    algorithm: z.ZodLiteral<"vault-transit">;
    keyId: z.ZodString;
    ciphertext: z.ZodString;
}, z.core.$strip>;
export declare const awsKmsEnvelopeSecretEnvelopeSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    brokerKind: z.ZodLiteral<"aws-kms-envelope">;
    algorithm: z.ZodLiteral<"aes-256-gcm">;
    keyId: z.ZodString;
    kmsKeyId: z.ZodString;
    kmsRegion: z.ZodString;
    encryptedDataKeyBase64: z.ZodString;
    ivBase64: z.ZodString;
    authTagBase64: z.ZodString;
    ciphertextBase64: z.ZodString;
}, z.core.$strip>;
export declare const credentialSecretEnvelopeSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    version: z.ZodLiteral<1>;
    brokerKind: z.ZodLiteral<"local-envelope">;
    algorithm: z.ZodLiteral<"aes-256-gcm">;
    keyId: z.ZodString;
    ivBase64: z.ZodString;
    authTagBase64: z.ZodString;
    ciphertextBase64: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    version: z.ZodLiteral<1>;
    brokerKind: z.ZodLiteral<"vault-transit-http">;
    algorithm: z.ZodLiteral<"vault-transit">;
    keyId: z.ZodString;
    ciphertext: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    version: z.ZodLiteral<1>;
    brokerKind: z.ZodLiteral<"aws-kms-envelope">;
    algorithm: z.ZodLiteral<"aes-256-gcm">;
    keyId: z.ZodString;
    kmsKeyId: z.ZodString;
    kmsRegion: z.ZodString;
    encryptedDataKeyBase64: z.ZodString;
    ivBase64: z.ZodString;
    authTagBase64: z.ZodString;
    ciphertextBase64: z.ZodString;
}, z.core.$strip>], "brokerKind">;
export declare const credentialSummarySchema: z.ZodObject<{
    credentialId: z.ZodString;
    workspaceId: z.ZodString;
    ownerUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    scope: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
    }>;
    displayName: z.ZodString;
    provider: z.ZodString;
    secretKind: z.ZodEnum<{
        "api-key": "api-key";
        "access-token": "access-token";
        "oauth-token": "oauth-token";
        "json-file": "json-file";
        "browser-storage-state": "browser-storage-state";
        "session-cookie": "session-cookie";
    }>;
    mountMode: z.ZodEnum<{
        env: "env";
        file: "file";
    }>;
    status: z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        revoked: "revoked";
        "needs-rotation": "needs-rotation";
    }>;
    brokerKind: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "local-envelope": "local-envelope";
        "vault-transit-http": "vault-transit-http";
        "aws-kms-envelope": "aws-kms-envelope";
    }>>>;
    activeKeyId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    secretVersion: z.ZodDefault<z.ZodNumber>;
    redactedSecretRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    expiresAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastRotatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastMaterializedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    rotationDueAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const credentialDetailSchema: z.ZodObject<{
    credentialId: z.ZodString;
    workspaceId: z.ZodString;
    ownerUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    scope: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
    }>;
    displayName: z.ZodString;
    provider: z.ZodString;
    secretKind: z.ZodEnum<{
        "api-key": "api-key";
        "access-token": "access-token";
        "oauth-token": "oauth-token";
        "json-file": "json-file";
        "browser-storage-state": "browser-storage-state";
        "session-cookie": "session-cookie";
    }>;
    mountMode: z.ZodEnum<{
        env: "env";
        file: "file";
    }>;
    status: z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        revoked: "revoked";
        "needs-rotation": "needs-rotation";
    }>;
    brokerKind: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "local-envelope": "local-envelope";
        "vault-transit-http": "vault-transit-http";
        "aws-kms-envelope": "aws-kms-envelope";
    }>>>;
    activeKeyId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    secretVersion: z.ZodDefault<z.ZodNumber>;
    redactedSecretRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    expiresAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastRotatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastMaterializedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    rotationDueAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    envName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    mountPathTemplate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const listCredentialsQuerySchema: z.ZodObject<{
    scope: z.ZodOptional<z.ZodEnum<{
        user: "user";
        workspace: "workspace";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        revoked: "revoked";
        "needs-rotation": "needs-rotation";
    }>>;
    q: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createCredentialInputSchema: z.ZodObject<{
    scope: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
    }>;
    displayName: z.ZodString;
    provider: z.ZodString;
    secretKind: z.ZodEnum<{
        "api-key": "api-key";
        "access-token": "access-token";
        "oauth-token": "oauth-token";
        "json-file": "json-file";
        "browser-storage-state": "browser-storage-state";
        "session-cookie": "session-cookie";
    }>;
    mountMode: z.ZodOptional<z.ZodEnum<{
        env: "env";
        file: "file";
    }>>;
    secretValue: z.ZodString;
    secretRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    envName: z.ZodOptional<z.ZodString>;
    mountPathTemplate: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    rotationDueAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const updateCredentialInputSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodString>;
    secretKind: z.ZodOptional<z.ZodEnum<{
        "api-key": "api-key";
        "access-token": "access-token";
        "oauth-token": "oauth-token";
        "json-file": "json-file";
        "browser-storage-state": "browser-storage-state";
        "session-cookie": "session-cookie";
    }>>;
    mountMode: z.ZodOptional<z.ZodEnum<{
        env: "env";
        file: "file";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        revoked: "revoked";
        "needs-rotation": "needs-rotation";
    }>>;
    envName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mountPathTemplate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rotationDueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const rotateCredentialInputSchema: z.ZodObject<{
    secretValue: z.ZodString;
    secretRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    expiresAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rotationDueAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const credentialUsageRunSchema: z.ZodObject<{
    runId: z.ZodString;
    workspaceId: z.ZodString;
    requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    title: z.ZodString;
    status: z.ZodEnum<{
        CREATED: "CREATED";
        READY: "READY";
        QUEUED: "QUEUED";
        STARTING: "STARTING";
        RUNNING: "RUNNING";
        WAITING_APPROVAL: "WAITING_APPROVAL";
        SUCCEEDED: "SUCCEEDED";
        FAILED: "FAILED";
        CANCELLED: "CANCELLED";
    }>;
    targetPath: z.ZodString;
    taskVersionId: z.ZodString;
    sessionVersionId: z.ZodString;
    entrySurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
    workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    workshopName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
    serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    serviceName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    usesDirectMount: z.ZodBoolean;
    usesMcpBinding: z.ZodBoolean;
}, z.core.$strip>;
export declare const credentialUsageBindingSchema: z.ZodObject<{
    bindingId: z.ZodString;
    mcpId: z.ZodString;
    mcpDisplayName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    scope: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
        "session-version": "session-version";
        run: "run";
    }>;
    scopeRef: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        "needs-review": "needs-review";
    }>;
    approvalRequired: z.ZodDefault<z.ZodBoolean>;
    autoAttach: z.ZodDefault<z.ZodBoolean>;
    networkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const credentialUsageSummarySchema: z.ZodObject<{
    credentialId: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        revoked: "revoked";
        "needs-rotation": "needs-rotation";
    }>;
    totalRunCount: z.ZodNumber;
    activeRunCount: z.ZodNumber;
    bindingCount: z.ZodNumber;
    lastMaterializedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastRotatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const credentialUsageResponseSchema: z.ZodObject<{
    summary: z.ZodObject<{
        credentialId: z.ZodString;
        status: z.ZodEnum<{
            active: "active";
            disabled: "disabled";
            revoked: "revoked";
            "needs-rotation": "needs-rotation";
        }>;
        totalRunCount: z.ZodNumber;
        activeRunCount: z.ZodNumber;
        bindingCount: z.ZodNumber;
        lastMaterializedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        lastRotatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
    activeRuns: z.ZodDefault<z.ZodArray<z.ZodObject<{
        runId: z.ZodString;
        workspaceId: z.ZodString;
        requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        status: z.ZodEnum<{
            CREATED: "CREATED";
            READY: "READY";
            QUEUED: "QUEUED";
            STARTING: "STARTING";
            RUNNING: "RUNNING";
            WAITING_APPROVAL: "WAITING_APPROVAL";
            SUCCEEDED: "SUCCEEDED";
            FAILED: "FAILED";
            CANCELLED: "CANCELLED";
        }>;
        targetPath: z.ZodString;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workshopName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        serviceName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        usesDirectMount: z.ZodBoolean;
        usesMcpBinding: z.ZodBoolean;
    }, z.core.$strip>>>;
    recentRuns: z.ZodDefault<z.ZodArray<z.ZodObject<{
        runId: z.ZodString;
        workspaceId: z.ZodString;
        requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        status: z.ZodEnum<{
            CREATED: "CREATED";
            READY: "READY";
            QUEUED: "QUEUED";
            STARTING: "STARTING";
            RUNNING: "RUNNING";
            WAITING_APPROVAL: "WAITING_APPROVAL";
            SUCCEEDED: "SUCCEEDED";
            FAILED: "FAILED";
            CANCELLED: "CANCELLED";
        }>;
        targetPath: z.ZodString;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workshopName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        serviceName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        usesDirectMount: z.ZodBoolean;
        usesMcpBinding: z.ZodBoolean;
    }, z.core.$strip>>>;
    bindings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        bindingId: z.ZodString;
        mcpId: z.ZodString;
        mcpDisplayName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scope: z.ZodEnum<{
            user: "user";
            workspace: "workspace";
            "session-version": "session-version";
            run: "run";
        }>;
        scopeRef: z.ZodString;
        status: z.ZodEnum<{
            active: "active";
            disabled: "disabled";
            "needs-review": "needs-review";
        }>;
        approvalRequired: z.ZodDefault<z.ZodBoolean>;
        autoAttach: z.ZodDefault<z.ZodBoolean>;
        networkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const credentialLifecycleImpactActionSchema: z.ZodEnum<{
    block: "block";
    "allow-active-runs": "allow-active-runs";
    "cancel-active-runs": "cancel-active-runs";
}>;
export declare const changeCredentialLifecycleInputSchema: z.ZodObject<{
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    impactAction: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        block: "block";
        "allow-active-runs": "allow-active-runs";
        "cancel-active-runs": "cancel-active-runs";
    }>>>;
}, z.core.$strip>;
export declare const credentialLifecycleChangeResultSchema: z.ZodObject<{
    credential: z.ZodObject<{
        credentialId: z.ZodString;
        workspaceId: z.ZodString;
        ownerUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scope: z.ZodEnum<{
            user: "user";
            workspace: "workspace";
        }>;
        displayName: z.ZodString;
        provider: z.ZodString;
        secretKind: z.ZodEnum<{
            "api-key": "api-key";
            "access-token": "access-token";
            "oauth-token": "oauth-token";
            "json-file": "json-file";
            "browser-storage-state": "browser-storage-state";
            "session-cookie": "session-cookie";
        }>;
        mountMode: z.ZodEnum<{
            env: "env";
            file: "file";
        }>;
        status: z.ZodEnum<{
            active: "active";
            disabled: "disabled";
            revoked: "revoked";
            "needs-rotation": "needs-rotation";
        }>;
        brokerKind: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "local-envelope": "local-envelope";
            "vault-transit-http": "vault-transit-http";
            "aws-kms-envelope": "aws-kms-envelope";
        }>>>;
        activeKeyId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        secretVersion: z.ZodDefault<z.ZodNumber>;
        redactedSecretRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        expiresAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        lastRotatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        lastMaterializedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        rotationDueAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        envName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        mountPathTemplate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
    activeRunCount: z.ZodNumber;
    activeRuns: z.ZodDefault<z.ZodArray<z.ZodObject<{
        runId: z.ZodString;
        workspaceId: z.ZodString;
        requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        status: z.ZodEnum<{
            CREATED: "CREATED";
            READY: "READY";
            QUEUED: "QUEUED";
            STARTING: "STARTING";
            RUNNING: "RUNNING";
            WAITING_APPROVAL: "WAITING_APPROVAL";
            SUCCEEDED: "SUCCEEDED";
            FAILED: "FAILED";
            CANCELLED: "CANCELLED";
        }>;
        targetPath: z.ZodString;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workshopName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        serviceName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        usesDirectMount: z.ZodBoolean;
        usesMcpBinding: z.ZodBoolean;
    }, z.core.$strip>>>;
    cancelledRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const credentialAuditEventActionSchema: z.ZodEnum<{
    created: "created";
    updated: "updated";
    rotated: "rotated";
    "status-changed": "status-changed";
    "lifecycle-callback-sent": "lifecycle-callback-sent";
    "lifecycle-callback-failed": "lifecycle-callback-failed";
    "auto-disabled-expired": "auto-disabled-expired";
    "auto-needs-rotation": "auto-needs-rotation";
    materialized: "materialized";
    "materialization-denied": "materialization-denied";
}>;
export declare const credentialAuditEventOutcomeSchema: z.ZodEnum<{
    success: "success";
    blocked: "blocked";
}>;
export declare const credentialAuditEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    credentialId: z.ZodString;
    workspaceId: z.ZodString;
    actorUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    runId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    leaseId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    action: z.ZodEnum<{
        created: "created";
        updated: "updated";
        rotated: "rotated";
        "status-changed": "status-changed";
        "lifecycle-callback-sent": "lifecycle-callback-sent";
        "lifecycle-callback-failed": "lifecycle-callback-failed";
        "auto-disabled-expired": "auto-disabled-expired";
        "auto-needs-rotation": "auto-needs-rotation";
        materialized: "materialized";
        "materialization-denied": "materialization-denied";
    }>;
    outcome: z.ZodEnum<{
        success: "success";
        blocked: "blocked";
    }>;
    statusBefore: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        revoked: "revoked";
        "needs-rotation": "needs-rotation";
    }>>>;
    statusAfter: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        revoked: "revoked";
        "needs-rotation": "needs-rotation";
    }>>>;
    secretVersion: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    mountMode: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        env: "env";
        file: "file";
    }>>>;
    reasonCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reasonDetail: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    traceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    occurredAt: z.ZodString;
}, z.core.$strip>;
export declare const listCredentialAuditEventsQuerySchema: z.ZodObject<{
    action: z.ZodOptional<z.ZodEnum<{
        created: "created";
        updated: "updated";
        rotated: "rotated";
        "status-changed": "status-changed";
        "lifecycle-callback-sent": "lifecycle-callback-sent";
        "lifecycle-callback-failed": "lifecycle-callback-failed";
        "auto-disabled-expired": "auto-disabled-expired";
        "auto-needs-rotation": "auto-needs-rotation";
        materialized: "materialized";
        "materialization-denied": "materialization-denied";
    }>>;
    outcome: z.ZodOptional<z.ZodEnum<{
        success: "success";
        blocked: "blocked";
    }>>;
    runId: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const credentialMaterializationLeaseSchema: z.ZodObject<{
    leaseId: z.ZodString;
    runId: z.ZodString;
    workspaceId: z.ZodString;
    requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    brokerKind: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "local-envelope": "local-envelope";
        "vault-transit-http": "vault-transit-http";
        "aws-kms-envelope": "aws-kms-envelope";
    }>>>;
    brokerKindByCredentialId: z.ZodRecord<z.ZodString, z.ZodEnum<{
        "local-envelope": "local-envelope";
        "vault-transit-http": "vault-transit-http";
        "aws-kms-envelope": "aws-kms-envelope";
    }>>;
    credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    secretVersionByCredentialId: z.ZodRecord<z.ZodString, z.ZodNumber>;
    issuedAt: z.ZodString;
    expiresAt: z.ZodString;
}, z.core.$strip>;
export declare const materializeRunCredentialsResponseSchema: z.ZodObject<{
    lease: z.ZodObject<{
        leaseId: z.ZodString;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        brokerKind: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "local-envelope": "local-envelope";
            "vault-transit-http": "vault-transit-http";
            "aws-kms-envelope": "aws-kms-envelope";
        }>>>;
        brokerKindByCredentialId: z.ZodRecord<z.ZodString, z.ZodEnum<{
            "local-envelope": "local-envelope";
            "vault-transit-http": "vault-transit-http";
            "aws-kms-envelope": "aws-kms-envelope";
        }>>;
        credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        secretVersionByCredentialId: z.ZodRecord<z.ZodString, z.ZodNumber>;
        issuedAt: z.ZodString;
        expiresAt: z.ZodString;
    }, z.core.$strip>;
    secrets: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export type CredentialScope = z.infer<typeof credentialScopeSchema>;
export type CredentialStatus = z.infer<typeof credentialStatusSchema>;
export type CredentialSecretKind = z.infer<typeof credentialSecretKindSchema>;
export type CredentialBrokerKind = z.infer<typeof credentialBrokerKindSchema>;
export type CredentialSecretEnvelope = z.infer<typeof credentialSecretEnvelopeSchema>;
export type CredentialSummary = z.infer<typeof credentialSummarySchema>;
export type CredentialDetail = z.infer<typeof credentialDetailSchema>;
export type ListCredentialsQuery = z.infer<typeof listCredentialsQuerySchema>;
export type CreateCredentialInput = z.infer<typeof createCredentialInputSchema>;
export type UpdateCredentialInput = z.infer<typeof updateCredentialInputSchema>;
export type RotateCredentialInput = z.infer<typeof rotateCredentialInputSchema>;
export type CredentialUsageRun = z.infer<typeof credentialUsageRunSchema>;
export type CredentialUsageBinding = z.infer<typeof credentialUsageBindingSchema>;
export type CredentialUsageSummary = z.infer<typeof credentialUsageSummarySchema>;
export type CredentialUsageResponse = z.infer<typeof credentialUsageResponseSchema>;
export type CredentialLifecycleImpactAction = z.infer<typeof credentialLifecycleImpactActionSchema>;
export type ChangeCredentialLifecycleInput = z.input<typeof changeCredentialLifecycleInputSchema>;
export type CredentialLifecycleChangeResult = z.infer<typeof credentialLifecycleChangeResultSchema>;
export type CredentialAuditEventAction = z.infer<typeof credentialAuditEventActionSchema>;
export type CredentialAuditEventOutcome = z.infer<typeof credentialAuditEventOutcomeSchema>;
export type CredentialAuditEvent = z.infer<typeof credentialAuditEventSchema>;
export type ListCredentialAuditEventsQuery = z.infer<typeof listCredentialAuditEventsQuerySchema>;
export type CredentialMaterializationLease = z.infer<typeof credentialMaterializationLeaseSchema>;
export type MaterializeRunCredentialsResponse = z.infer<typeof materializeRunCredentialsResponseSchema>;
//# sourceMappingURL=credentials.d.ts.map