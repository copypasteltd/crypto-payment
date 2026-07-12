import { z } from "zod";
export declare const runStatusSchema: z.ZodEnum<{
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
export declare const runListViewStatusSchema: z.ZodEnum<{
    approval: "approval";
    cancelled: "cancelled";
    running: "running";
    done: "done";
    failed: "failed";
}>;
export declare const runAttentionModeSchema: z.ZodEnum<{
    running: "running";
    done: "done";
    todo: "todo";
}>;
export declare const createRunBindingSchema: z.ZodObject<{
    firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
    credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const runCatalogMetadataSchema: z.ZodObject<{
    workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
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
}, z.core.$strip>;
export declare const createRunInputSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    taskVersionId: z.ZodString;
    sessionVersionId: z.ZodString;
    requestedByUserId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    targetPath: z.ZodString;
    entrySurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
    initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    bindings: z.ZodDefault<z.ZodObject<{
        firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    catalogMetadata: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
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
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const listRunsQuerySchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        CREATED: "CREATED";
        READY: "READY";
        QUEUED: "QUEUED";
        STARTING: "STARTING";
        RUNNING: "RUNNING";
        WAITING_APPROVAL: "WAITING_APPROVAL";
        SUCCEEDED: "SUCCEEDED";
        FAILED: "FAILED";
        CANCELLED: "CANCELLED";
    }>>;
    viewStatus: z.ZodOptional<z.ZodEnum<{
        approval: "approval";
        cancelled: "cancelled";
        running: "running";
        done: "done";
        failed: "failed";
    }>>;
    attentionMode: z.ZodOptional<z.ZodEnum<{
        running: "running";
        done: "done";
        todo: "todo";
    }>>;
    entrySurface: z.ZodOptional<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>;
    tag: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const runRecordSchema: z.ZodObject<{
    runId: z.ZodString;
    workspaceId: z.ZodString;
    taskVersionId: z.ZodString;
    sessionVersionId: z.ZodString;
    requestedByUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    title: z.ZodString;
    targetPath: z.ZodString;
    entrySurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
    catalogMetadata: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
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
    }, z.core.$strip>>>;
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
    statusReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const runRuntimeLaunchModeSchema: z.ZodEnum<{
    "local-process": "local-process";
    docker: "docker";
}>;
export declare const runRuntimeMetadataSchema: z.ZodObject<{
    launchMode: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "local-process": "local-process";
        docker: "docker";
    }>>>;
    containerName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    readyAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    exitCode: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    exitSignal: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const runRuntimeUpdateSchema: z.ZodObject<{
    launchMode: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        "local-process": "local-process";
        docker: "docker";
    }>>>;
    containerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    readyAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    finishedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    exitCode: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    exitSignal: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const runInformationCollectionStatusSchema: z.ZodEnum<{
    pending: "pending";
    in_progress: "in_progress";
    completed: "completed";
}>;
export declare const runInformationCollectionSlotStatusSchema: z.ZodEnum<{
    optional: "optional";
    missing: "missing";
    satisfied: "satisfied";
}>;
export declare const runInformationCollectionSlotTypeSchema: z.ZodEnum<{
    string: "string";
    number: "number";
    boolean: "boolean";
    datetime: "datetime";
    file: "file";
    date: "date";
    enum: "enum";
    directory: "directory";
    json: "json";
}>;
export declare const runInformationCollectionSlotChoiceSchema: z.ZodObject<{
    value: z.ZodString;
    label: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const runInformationCollectionSlotSchema: z.ZodObject<{
    key: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<{
        string: "string";
        number: "number";
        boolean: "boolean";
        datetime: "datetime";
        file: "file";
        date: "date";
        enum: "enum";
        directory: "directory";
        json: "json";
    }>;
    required: z.ZodDefault<z.ZodBoolean>;
    secret: z.ZodDefault<z.ZodBoolean>;
    repeatable: z.ZodDefault<z.ZodBoolean>;
    prompt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    placeholder: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    choices: z.ZodDefault<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        label: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    accepts: z.ZodDefault<z.ZodArray<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<{
        optional: "optional";
        missing: "missing";
        satisfied: "satisfied";
    }>>;
    attachmentCount: z.ZodDefault<z.ZodNumber>;
    answerCount: z.ZodDefault<z.ZodNumber>;
    lastAnswerText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastSatisfiedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const runInformationCollectionAnswerKindSchema: z.ZodEnum<{
    text: "text";
    attachment: "attachment";
}>;
export declare const runInformationCollectionAnswerSourceSchema: z.ZodEnum<{
    "user-message": "user-message";
    "manual-review": "manual-review";
}>;
export declare const runInformationCollectionAnswerReviewStatusSchema: z.ZodEnum<{
    pending: "pending";
    approved: "approved";
    rejected: "rejected";
    superseded: "superseded";
}>;
export declare const runInformationCollectionAnswerSchema: z.ZodObject<{
    answerId: z.ZodString;
    slotKey: z.ZodString;
    slotType: z.ZodEnum<{
        string: "string";
        number: "number";
        boolean: "boolean";
        datetime: "datetime";
        file: "file";
        date: "date";
        enum: "enum";
        directory: "directory";
        json: "json";
    }>;
    kind: z.ZodEnum<{
        text: "text";
        attachment: "attachment";
    }>;
    source: z.ZodDefault<z.ZodEnum<{
        "user-message": "user-message";
        "manual-review": "manual-review";
    }>>;
    sourceMessageId: z.ZodString;
    valueText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    attachmentPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    attachmentLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reviewStatus: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
        superseded: "superseded";
    }>>;
    reviewedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reviewedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reviewNote: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    supersedesAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    supersededByAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const runInformationCollectionSchema: z.ZodObject<{
    prompt: z.ZodDefault<z.ZodString>;
    slotSchemaVersion: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        in_progress: "in_progress";
        completed: "completed";
    }>>;
    requiredCount: z.ZodDefault<z.ZodNumber>;
    satisfiedCount: z.ZodDefault<z.ZodNumber>;
    missingCount: z.ZodDefault<z.ZodNumber>;
    userMessageCount: z.ZodDefault<z.ZodNumber>;
    attachmentCount: z.ZodDefault<z.ZodNumber>;
    pendingReviewCount: z.ZodDefault<z.ZodNumber>;
    approvedReviewCount: z.ZodDefault<z.ZodNumber>;
    rejectedReviewCount: z.ZodDefault<z.ZodNumber>;
    lastUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    slots: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        title: z.ZodString;
        type: z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            datetime: "datetime";
            file: "file";
            date: "date";
            enum: "enum";
            directory: "directory";
            json: "json";
        }>;
        required: z.ZodDefault<z.ZodBoolean>;
        secret: z.ZodDefault<z.ZodBoolean>;
        repeatable: z.ZodDefault<z.ZodBoolean>;
        prompt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        placeholder: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        choices: z.ZodDefault<z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            label: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        accepts: z.ZodDefault<z.ZodArray<z.ZodString>>;
        status: z.ZodDefault<z.ZodEnum<{
            optional: "optional";
            missing: "missing";
            satisfied: "satisfied";
        }>>;
        attachmentCount: z.ZodDefault<z.ZodNumber>;
        answerCount: z.ZodDefault<z.ZodNumber>;
        lastAnswerText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        lastSatisfiedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        answerId: z.ZodString;
        slotKey: z.ZodString;
        slotType: z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            datetime: "datetime";
            file: "file";
            date: "date";
            enum: "enum";
            directory: "directory";
            json: "json";
        }>;
        kind: z.ZodEnum<{
            text: "text";
            attachment: "attachment";
        }>;
        source: z.ZodDefault<z.ZodEnum<{
            "user-message": "user-message";
            "manual-review": "manual-review";
        }>>;
        sourceMessageId: z.ZodString;
        valueText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        attachmentPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        attachmentLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        reviewStatus: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            approved: "approved";
            rejected: "rejected";
            superseded: "superseded";
        }>>;
        reviewedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        reviewedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        reviewNote: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        supersedesAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        supersededByAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const runConversationAttachmentSchema: z.ZodObject<{
    path: z.ZodString;
    label: z.ZodString;
    slotKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const runConversationSlotValueSchema: z.ZodObject<{
    slotKey: z.ZodString;
    valueText: z.ZodString;
}, z.core.$strip>;
export declare const runConversationMessageSchema: z.ZodObject<{
    messageId: z.ZodString;
    runId: z.ZodString;
    role: z.ZodEnum<{
        system: "system";
        user: "user";
        agent: "agent";
    }>;
    kind: z.ZodEnum<{
        prompt: "prompt";
        status: "status";
        approval: "approval";
        result: "result";
        text: "text";
    }>;
    text: z.ZodString;
    attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        label: z.ZodString;
        slotKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    slotValues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        slotKey: z.ZodString;
        valueText: z.ZodString;
    }, z.core.$strip>>>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const runFileEntrySchema: z.ZodObject<{
    path: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<{
        output: "output";
        input: "input";
        receipt: "receipt";
        archive: "archive";
        log: "log";
        screenshot: "screenshot";
    }>;
    sizeBytes: z.ZodNullable<z.ZodNumber>;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const runFileSourceSchema: z.ZodEnum<{
    archive: "archive";
    log: "log";
    "target-scan": "target-scan";
    "user-upload": "user-upload";
    "runtime-output": "runtime-output";
}>;
export declare const runFilePreviewModeSchema: z.ZodEnum<{
    text: "text";
    none: "none";
    image: "image";
    pdf: "pdf";
    download: "download";
}>;
export declare const runFileStorageTierSchema: z.ZodEnum<{
    hot: "hot";
    cold: "cold";
}>;
export declare const runFileArchiveReasonSchema: z.ZodEnum<{
    "terminal-retention": "terminal-retention";
    manual: "manual";
}>;
export declare const runFileRecordSchema: z.ZodObject<{
    path: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<{
        output: "output";
        input: "input";
        receipt: "receipt";
        archive: "archive";
        log: "log";
        screenshot: "screenshot";
    }>;
    sizeBytes: z.ZodNullable<z.ZodNumber>;
    updatedAt: z.ZodString;
    runId: z.ZodString;
    workspaceId: z.ZodString;
    logicalPath: z.ZodString;
    source: z.ZodEnum<{
        archive: "archive";
        log: "log";
        "target-scan": "target-scan";
        "user-upload": "user-upload";
        "runtime-output": "runtime-output";
    }>;
    mimeType: z.ZodNullable<z.ZodString>;
    objectKey: z.ZodNullable<z.ZodString>;
    uploadId: z.ZodNullable<z.ZodString>;
    checksum: z.ZodNullable<z.ZodString>;
    previewMode: z.ZodEnum<{
        text: "text";
        none: "none";
        image: "image";
        pdf: "pdf";
        download: "download";
    }>;
    previewable: z.ZodBoolean;
    downloadable: z.ZodBoolean;
    storageTier: z.ZodDefault<z.ZodEnum<{
        hot: "hot";
        cold: "cold";
    }>>;
    archivedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    archivedFromObjectKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    archiveReason: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "terminal-retention": "terminal-retention";
        manual: "manual";
    }>>>;
    indexedAt: z.ZodString;
}, z.core.$strip>;
export declare const runFileReadResponseSchema: z.ZodObject<{
    file: z.ZodObject<{
        path: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            output: "output";
            input: "input";
            receipt: "receipt";
            archive: "archive";
            log: "log";
            screenshot: "screenshot";
        }>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    content: z.ZodString;
    encoding: z.ZodLiteral<"utf8">;
    truncated: z.ZodBoolean;
}, z.core.$strip>;
export declare const runFilePreviewResponseSchema: z.ZodObject<{
    file: z.ZodObject<{
        path: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            output: "output";
            input: "input";
            receipt: "receipt";
            archive: "archive";
            log: "log";
            screenshot: "screenshot";
        }>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        updatedAt: z.ZodString;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        logicalPath: z.ZodString;
        source: z.ZodEnum<{
            archive: "archive";
            log: "log";
            "target-scan": "target-scan";
            "user-upload": "user-upload";
            "runtime-output": "runtime-output";
        }>;
        mimeType: z.ZodNullable<z.ZodString>;
        objectKey: z.ZodNullable<z.ZodString>;
        uploadId: z.ZodNullable<z.ZodString>;
        checksum: z.ZodNullable<z.ZodString>;
        previewMode: z.ZodEnum<{
            text: "text";
            none: "none";
            image: "image";
            pdf: "pdf";
            download: "download";
        }>;
        previewable: z.ZodBoolean;
        downloadable: z.ZodBoolean;
        storageTier: z.ZodDefault<z.ZodEnum<{
            hot: "hot";
            cold: "cold";
        }>>;
        archivedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        archivedFromObjectKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        archiveReason: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "terminal-retention": "terminal-retention";
            manual: "manual";
        }>>>;
        indexedAt: z.ZodString;
    }, z.core.$strip>;
    mode: z.ZodEnum<{
        text: "text";
        none: "none";
        image: "image";
        pdf: "pdf";
        download: "download";
    }>;
    mimeType: z.ZodNullable<z.ZodString>;
    content: z.ZodNullable<z.ZodString>;
    encoding: z.ZodNullable<z.ZodLiteral<"utf8">>;
    truncated: z.ZodBoolean;
    downloadUrl: z.ZodNullable<z.ZodString>;
    downloadTicketId: z.ZodNullable<z.ZodString>;
    downloadExpiresAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const runFileIndexFacetCountSchema: z.ZodObject<{
    key: z.ZodString;
    count: z.ZodNumber;
}, z.core.$strip>;
export declare const runFileIndexSummarySchema: z.ZodObject<{
    totalIndexedCount: z.ZodNumber;
    matchedCount: z.ZodNumber;
    returnedCount: z.ZodNumber;
    fileCount: z.ZodNumber;
    directoryCount: z.ZodNumber;
    previewableCount: z.ZodNumber;
    downloadableCount: z.ZodNumber;
    objectBackedCount: z.ZodNumber;
    uploadBackedCount: z.ZodNumber;
    latestUpdatedAt: z.ZodNullable<z.ZodString>;
    latestIndexedAt: z.ZodNullable<z.ZodString>;
    bySource: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    byKind: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    byStorageTier: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const listRunFileIndexResponseSchema: z.ZodObject<{
    mode: z.ZodLiteral<"indexed">;
    summary: z.ZodObject<{
        totalIndexedCount: z.ZodNumber;
        matchedCount: z.ZodNumber;
        returnedCount: z.ZodNumber;
        fileCount: z.ZodNumber;
        directoryCount: z.ZodNumber;
        previewableCount: z.ZodNumber;
        downloadableCount: z.ZodNumber;
        objectBackedCount: z.ZodNumber;
        uploadBackedCount: z.ZodNumber;
        latestUpdatedAt: z.ZodNullable<z.ZodString>;
        latestIndexedAt: z.ZodNullable<z.ZodString>;
        bySource: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strip>>;
        byKind: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strip>>;
        byStorageTier: z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    items: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            output: "output";
            input: "input";
            receipt: "receipt";
            archive: "archive";
            log: "log";
            screenshot: "screenshot";
        }>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        updatedAt: z.ZodString;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        logicalPath: z.ZodString;
        source: z.ZodEnum<{
            archive: "archive";
            log: "log";
            "target-scan": "target-scan";
            "user-upload": "user-upload";
            "runtime-output": "runtime-output";
        }>;
        mimeType: z.ZodNullable<z.ZodString>;
        objectKey: z.ZodNullable<z.ZodString>;
        uploadId: z.ZodNullable<z.ZodString>;
        checksum: z.ZodNullable<z.ZodString>;
        previewMode: z.ZodEnum<{
            text: "text";
            none: "none";
            image: "image";
            pdf: "pdf";
            download: "download";
        }>;
        previewable: z.ZodBoolean;
        downloadable: z.ZodBoolean;
        storageTier: z.ZodDefault<z.ZodEnum<{
            hot: "hot";
            cold: "cold";
        }>>;
        archivedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        archivedFromObjectKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        archiveReason: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "terminal-retention": "terminal-retention";
            manual: "manual";
        }>>>;
        indexedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const runArtifactSchema: z.ZodObject<{
    artifactId: z.ZodString;
    runId: z.ZodString;
    label: z.ZodString;
    file: z.ZodObject<{
        path: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            output: "output";
            input: "input";
            receipt: "receipt";
            archive: "archive";
            log: "log";
            screenshot: "screenshot";
        }>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    status: z.ZodEnum<{
        pending: "pending";
        ready: "ready";
    }>;
    downloadUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const runApprovalKindSchema: z.ZodEnum<{
    general: "general";
    "quota-override": "quota-override";
    "mcp-access": "mcp-access";
}>;
export declare const runApprovalSchema: z.ZodObject<{
    approvalId: z.ZodString;
    runId: z.ZodString;
    kind: z.ZodDefault<z.ZodEnum<{
        general: "general";
        "quota-override": "quota-override";
        "mcp-access": "mcp-access";
    }>>;
    relatedResourceRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    prompt: z.ZodString;
    state: z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
    }>;
    requestedAt: z.ZodString;
    decidedAt: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const createRunResponseSchema: z.ZodObject<{
    run: z.ZodObject<{
        runId: z.ZodString;
        workspaceId: z.ZodString;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        requestedByUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        targetPath: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        catalogMetadata: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
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
        }, z.core.$strip>>>;
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
        statusReason: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    nextPrompt: z.ZodString;
    informationCollection: z.ZodDefault<z.ZodObject<{
        prompt: z.ZodDefault<z.ZodString>;
        slotSchemaVersion: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            in_progress: "in_progress";
            completed: "completed";
        }>>;
        requiredCount: z.ZodDefault<z.ZodNumber>;
        satisfiedCount: z.ZodDefault<z.ZodNumber>;
        missingCount: z.ZodDefault<z.ZodNumber>;
        userMessageCount: z.ZodDefault<z.ZodNumber>;
        attachmentCount: z.ZodDefault<z.ZodNumber>;
        pendingReviewCount: z.ZodDefault<z.ZodNumber>;
        approvedReviewCount: z.ZodDefault<z.ZodNumber>;
        rejectedReviewCount: z.ZodDefault<z.ZodNumber>;
        lastUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        slots: z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            title: z.ZodString;
            type: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                datetime: "datetime";
                file: "file";
                date: "date";
                enum: "enum";
                directory: "directory";
                json: "json";
            }>;
            required: z.ZodDefault<z.ZodBoolean>;
            secret: z.ZodDefault<z.ZodBoolean>;
            repeatable: z.ZodDefault<z.ZodBoolean>;
            prompt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            placeholder: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            choices: z.ZodDefault<z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            accepts: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                optional: "optional";
                missing: "missing";
                satisfied: "satisfied";
            }>>;
            attachmentCount: z.ZodDefault<z.ZodNumber>;
            answerCount: z.ZodDefault<z.ZodNumber>;
            lastAnswerText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            lastSatisfiedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
            answerId: z.ZodString;
            slotKey: z.ZodString;
            slotType: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                datetime: "datetime";
                file: "file";
                date: "date";
                enum: "enum";
                directory: "directory";
                json: "json";
            }>;
            kind: z.ZodEnum<{
                text: "text";
                attachment: "attachment";
            }>;
            source: z.ZodDefault<z.ZodEnum<{
                "user-message": "user-message";
                "manual-review": "manual-review";
            }>>;
            sourceMessageId: z.ZodString;
            valueText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            attachmentPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            attachmentLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewStatus: z.ZodDefault<z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                superseded: "superseded";
            }>>;
            reviewedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewNote: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            supersedesAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            supersededByAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const runSnapshotSchema: z.ZodObject<{
    run: z.ZodObject<{
        runId: z.ZodString;
        workspaceId: z.ZodString;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        requestedByUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        targetPath: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        catalogMetadata: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
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
        }, z.core.$strip>>>;
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
        statusReason: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    runtime: z.ZodDefault<z.ZodObject<{
        launchMode: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "local-process": "local-process";
            docker: "docker";
        }>>>;
        containerName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        readyAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        exitCode: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        exitSignal: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    informationCollection: z.ZodDefault<z.ZodObject<{
        prompt: z.ZodDefault<z.ZodString>;
        slotSchemaVersion: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            in_progress: "in_progress";
            completed: "completed";
        }>>;
        requiredCount: z.ZodDefault<z.ZodNumber>;
        satisfiedCount: z.ZodDefault<z.ZodNumber>;
        missingCount: z.ZodDefault<z.ZodNumber>;
        userMessageCount: z.ZodDefault<z.ZodNumber>;
        attachmentCount: z.ZodDefault<z.ZodNumber>;
        pendingReviewCount: z.ZodDefault<z.ZodNumber>;
        approvedReviewCount: z.ZodDefault<z.ZodNumber>;
        rejectedReviewCount: z.ZodDefault<z.ZodNumber>;
        lastUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        slots: z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            title: z.ZodString;
            type: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                datetime: "datetime";
                file: "file";
                date: "date";
                enum: "enum";
                directory: "directory";
                json: "json";
            }>;
            required: z.ZodDefault<z.ZodBoolean>;
            secret: z.ZodDefault<z.ZodBoolean>;
            repeatable: z.ZodDefault<z.ZodBoolean>;
            prompt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            placeholder: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            choices: z.ZodDefault<z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            accepts: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                optional: "optional";
                missing: "missing";
                satisfied: "satisfied";
            }>>;
            attachmentCount: z.ZodDefault<z.ZodNumber>;
            answerCount: z.ZodDefault<z.ZodNumber>;
            lastAnswerText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            lastSatisfiedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
            answerId: z.ZodString;
            slotKey: z.ZodString;
            slotType: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                datetime: "datetime";
                file: "file";
                date: "date";
                enum: "enum";
                directory: "directory";
                json: "json";
            }>;
            kind: z.ZodEnum<{
                text: "text";
                attachment: "attachment";
            }>;
            source: z.ZodDefault<z.ZodEnum<{
                "user-message": "user-message";
                "manual-review": "manual-review";
            }>>;
            sourceMessageId: z.ZodString;
            valueText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            attachmentPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            attachmentLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewStatus: z.ZodDefault<z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                superseded: "superseded";
            }>>;
            reviewedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewNote: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            supersedesAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            supersededByAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    messages: z.ZodArray<z.ZodObject<{
        messageId: z.ZodString;
        runId: z.ZodString;
        role: z.ZodEnum<{
            system: "system";
            user: "user";
            agent: "agent";
        }>;
        kind: z.ZodEnum<{
            prompt: "prompt";
            status: "status";
            approval: "approval";
            result: "result";
            text: "text";
        }>;
        text: z.ZodString;
        attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            label: z.ZodString;
            slotKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        slotValues: z.ZodDefault<z.ZodArray<z.ZodObject<{
            slotKey: z.ZodString;
            valueText: z.ZodString;
        }, z.core.$strip>>>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    files: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            output: "output";
            input: "input";
            receipt: "receipt";
            archive: "archive";
            log: "log";
            screenshot: "screenshot";
        }>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    artifacts: z.ZodArray<z.ZodObject<{
        artifactId: z.ZodString;
        runId: z.ZodString;
        label: z.ZodString;
        file: z.ZodObject<{
            path: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<{
                output: "output";
                input: "input";
                receipt: "receipt";
                archive: "archive";
                log: "log";
                screenshot: "screenshot";
            }>;
            sizeBytes: z.ZodNullable<z.ZodNumber>;
            updatedAt: z.ZodString;
        }, z.core.$strip>;
        status: z.ZodEnum<{
            pending: "pending";
            ready: "ready";
        }>;
        downloadUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    approvals: z.ZodArray<z.ZodObject<{
        approvalId: z.ZodString;
        runId: z.ZodString;
        kind: z.ZodDefault<z.ZodEnum<{
            general: "general";
            "quota-override": "quota-override";
            "mcp-access": "mcp-access";
        }>>;
        relatedResourceRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        prompt: z.ZodString;
        state: z.ZodEnum<{
            pending: "pending";
            approved: "approved";
            rejected: "rejected";
        }>;
        requestedAt: z.ZodString;
        decidedAt: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const runListStatusCountsSchema: z.ZodObject<{
    CREATED: z.ZodNumber;
    READY: z.ZodNumber;
    QUEUED: z.ZodNumber;
    STARTING: z.ZodNumber;
    RUNNING: z.ZodNumber;
    WAITING_APPROVAL: z.ZodNumber;
    SUCCEEDED: z.ZodNumber;
    FAILED: z.ZodNumber;
    CANCELLED: z.ZodNumber;
}, z.core.$strip>;
export declare const runListViewStatusCountsSchema: z.ZodObject<{
    all: z.ZodNumber;
    running: z.ZodNumber;
    approval: z.ZodNumber;
    done: z.ZodNumber;
    failed: z.ZodNumber;
    cancelled: z.ZodNumber;
}, z.core.$strip>;
export declare const runAttentionModeCountsSchema: z.ZodObject<{
    todo: z.ZodNumber;
    running: z.ZodNumber;
    done: z.ZodNumber;
}, z.core.$strip>;
export declare const runFacetCountSchema: z.ZodObject<{
    key: z.ZodString;
    count: z.ZodNumber;
}, z.core.$strip>;
export declare const runWorkshopFacetSchema: z.ZodObject<{
    workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    count: z.ZodNumber;
}, z.core.$strip>;
export declare const runListSummarySchema: z.ZodObject<{
    total: z.ZodNumber;
    pendingApprovalsCount: z.ZodNumber;
    outputsReadyCount: z.ZodNumber;
    latestUpdatedAt: z.ZodNullable<z.ZodString>;
    byStatus: z.ZodObject<{
        CREATED: z.ZodNumber;
        READY: z.ZodNumber;
        QUEUED: z.ZodNumber;
        STARTING: z.ZodNumber;
        RUNNING: z.ZodNumber;
        WAITING_APPROVAL: z.ZodNumber;
        SUCCEEDED: z.ZodNumber;
        FAILED: z.ZodNumber;
        CANCELLED: z.ZodNumber;
    }, z.core.$strip>;
    byViewStatus: z.ZodObject<{
        all: z.ZodNumber;
        running: z.ZodNumber;
        approval: z.ZodNumber;
        done: z.ZodNumber;
        failed: z.ZodNumber;
        cancelled: z.ZodNumber;
    }, z.core.$strip>;
    byAttentionMode: z.ZodObject<{
        todo: z.ZodNumber;
        running: z.ZodNumber;
        done: z.ZodNumber;
    }, z.core.$strip>;
    byEntrySurface: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    byTag: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    byWorkshop: z.ZodArray<z.ZodObject<{
        workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        title: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        count: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const sendRunMessageInputSchema: z.ZodObject<{
    text: z.ZodString;
    attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        label: z.ZodString;
        slotKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    slotValues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        slotKey: z.ZodString;
        valueText: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const approveRunInputSchema: z.ZodObject<{
    approvalId: z.ZodOptional<z.ZodString>;
    approved: z.ZodBoolean;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const reviewRunInformationAnswerDecisionSchema: z.ZodEnum<{
    approve: "approve";
    reject: "reject";
    revise: "revise";
}>;
export declare const reviewRunInformationAnswerInputSchema: z.ZodObject<{
    answerId: z.ZodString;
    decision: z.ZodEnum<{
        approve: "approve";
        reject: "reject";
        revise: "revise";
    }>;
    note: z.ZodOptional<z.ZodString>;
    replacementValueText: z.ZodOptional<z.ZodString>;
    replacementAttachmentPath: z.ZodOptional<z.ZodString>;
    replacementAttachmentLabel: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const startRunJobPayloadSchema: z.ZodObject<{
    run: z.ZodObject<{
        runId: z.ZodString;
        workspaceId: z.ZodString;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        requestedByUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        targetPath: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        catalogMetadata: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
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
        }, z.core.$strip>>>;
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
        statusReason: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    initialPrompt: z.ZodString;
    requestedInitialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    bindings: z.ZodDefault<z.ZodObject<{
        firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
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
export declare const cleanupRunJobPayloadSchema: z.ZodObject<{
    runId: z.ZodString;
}, z.core.$strip>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunListViewStatus = z.infer<typeof runListViewStatusSchema>;
export type RunAttentionMode = z.infer<typeof runAttentionModeSchema>;
export type CreateRunBinding = z.infer<typeof createRunBindingSchema>;
export type RunCatalogMetadata = z.infer<typeof runCatalogMetadataSchema>;
export type CreateRunInput = z.infer<typeof createRunInputSchema>;
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;
export type CreateRunResponse = z.infer<typeof createRunResponseSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type RunRuntimeLaunchMode = z.infer<typeof runRuntimeLaunchModeSchema>;
export type RunRuntimeMetadata = z.infer<typeof runRuntimeMetadataSchema>;
export type RunRuntimeUpdate = z.infer<typeof runRuntimeUpdateSchema>;
export type RunInformationCollectionStatus = z.infer<typeof runInformationCollectionStatusSchema>;
export type RunInformationCollectionSlotStatus = z.infer<typeof runInformationCollectionSlotStatusSchema>;
export type RunInformationCollectionSlotType = z.infer<typeof runInformationCollectionSlotTypeSchema>;
export type RunInformationCollectionSlotChoice = z.infer<typeof runInformationCollectionSlotChoiceSchema>;
export type RunInformationCollectionSlot = z.infer<typeof runInformationCollectionSlotSchema>;
export type RunInformationCollectionAnswerKind = z.infer<typeof runInformationCollectionAnswerKindSchema>;
export type RunInformationCollectionAnswerSource = z.infer<typeof runInformationCollectionAnswerSourceSchema>;
export type RunInformationCollectionAnswerReviewStatus = z.infer<typeof runInformationCollectionAnswerReviewStatusSchema>;
export type RunInformationCollectionAnswer = z.infer<typeof runInformationCollectionAnswerSchema>;
export type RunInformationCollection = z.infer<typeof runInformationCollectionSchema>;
export type RunConversationAttachment = z.infer<typeof runConversationAttachmentSchema>;
export type RunConversationSlotValue = z.infer<typeof runConversationSlotValueSchema>;
export type RunConversationMessage = z.infer<typeof runConversationMessageSchema>;
export type RunFileEntry = z.infer<typeof runFileEntrySchema>;
export type RunFileSource = z.infer<typeof runFileSourceSchema>;
export type RunFilePreviewMode = z.infer<typeof runFilePreviewModeSchema>;
export type RunFileStorageTier = z.infer<typeof runFileStorageTierSchema>;
export type RunFileArchiveReason = z.infer<typeof runFileArchiveReasonSchema>;
export type RunFileRecord = z.infer<typeof runFileRecordSchema>;
export type RunFileReadResponse = z.infer<typeof runFileReadResponseSchema>;
export type RunFilePreviewResponse = z.infer<typeof runFilePreviewResponseSchema>;
export type RunFileIndexFacetCount = z.infer<typeof runFileIndexFacetCountSchema>;
export type RunFileIndexSummary = z.infer<typeof runFileIndexSummarySchema>;
export type ListRunFileIndexResponse = z.infer<typeof listRunFileIndexResponseSchema>;
export type RunArtifact = z.infer<typeof runArtifactSchema>;
export type RunApprovalKind = z.infer<typeof runApprovalKindSchema>;
export type RunApproval = z.infer<typeof runApprovalSchema>;
export type RunSnapshot = z.infer<typeof runSnapshotSchema>;
export type RunListStatusCounts = z.infer<typeof runListStatusCountsSchema>;
export type RunListViewStatusCounts = z.infer<typeof runListViewStatusCountsSchema>;
export type RunAttentionModeCounts = z.infer<typeof runAttentionModeCountsSchema>;
export type RunFacetCount = z.infer<typeof runFacetCountSchema>;
export type RunWorkshopFacet = z.infer<typeof runWorkshopFacetSchema>;
export type RunListSummary = z.infer<typeof runListSummarySchema>;
export type SendRunMessageInput = z.infer<typeof sendRunMessageInputSchema>;
export type ApproveRunInput = z.infer<typeof approveRunInputSchema>;
export type ReviewRunInformationAnswerDecision = z.infer<typeof reviewRunInformationAnswerDecisionSchema>;
export type ReviewRunInformationAnswerInput = z.infer<typeof reviewRunInformationAnswerInputSchema>;
export type StartRunJobPayload = z.infer<typeof startRunJobPayloadSchema>;
export type CleanupRunJobPayload = z.infer<typeof cleanupRunJobPayloadSchema>;
//# sourceMappingURL=runs.d.ts.map