import { z } from "zod";
export declare const meNoticeToneSchema: z.ZodEnum<{
    active: "active";
    success: "success";
    warn: "warn";
    danger: "danger";
}>;
export declare const meNoticeTypeSchema: z.ZodEnum<{
    approval_pending: "approval_pending";
    result_ready: "result_ready";
    run_failed: "run_failed";
    run_succeeded: "run_succeeded";
}>;
export declare const meNoticeRunTargetViewSchema: z.ZodEnum<{
    detail: "detail";
    files: "files";
    audit: "audit";
}>;
export declare const meNoticeTargetSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    resource: z.ZodLiteral<"run">;
    runId: z.ZodString;
    view: z.ZodEnum<{
        detail: "detail";
        files: "files";
        audit: "audit";
    }>;
}, z.core.$strip>, z.ZodObject<{
    resource: z.ZodLiteral<"workspace">;
    workspaceId: z.ZodString;
    view: z.ZodLiteral<"me">;
}, z.core.$strip>], "resource">;
export declare const meNoticeSchema: z.ZodObject<{
    noticeId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    type: z.ZodEnum<{
        approval_pending: "approval_pending";
        result_ready: "result_ready";
        run_failed: "run_failed";
        run_succeeded: "run_succeeded";
    }>;
    tone: z.ZodEnum<{
        active: "active";
        success: "success";
        warn: "warn";
        danger: "danger";
    }>;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    occurredAt: z.ZodString;
    target: z.ZodDiscriminatedUnion<[z.ZodObject<{
        resource: z.ZodLiteral<"run">;
        runId: z.ZodString;
        view: z.ZodEnum<{
            detail: "detail";
            files: "files";
            audit: "audit";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        resource: z.ZodLiteral<"workspace">;
        workspaceId: z.ZodString;
        view: z.ZodLiteral<"me">;
    }, z.core.$strip>], "resource">;
}, z.core.$strip>;
export declare const listMeNoticesQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const meNoticeSummaryBucketSchema: z.ZodObject<{
    type: z.ZodEnum<{
        approval_pending: "approval_pending";
        result_ready: "result_ready";
        run_failed: "run_failed";
        run_succeeded: "run_succeeded";
    }>;
    count: z.ZodNumber;
}, z.core.$strip>;
export declare const meNoticeSummarySchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    latestOccurredAt: z.ZodNullable<z.ZodString>;
    byType: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            approval_pending: "approval_pending";
            result_ready: "result_ready";
            run_failed: "run_failed";
            run_succeeded: "run_succeeded";
        }>;
        count: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const meProfileMetricsSchema: z.ZodObject<{
    totalAssetsCount: z.ZodNumber;
    receiptAssetsCount: z.ZodNumber;
    visibleWorkshopsCount: z.ZodNumber;
    favoriteWorkshopsCount: z.ZodNumber;
    pendingActionsCount: z.ZodNumber;
}, z.core.$strip>;
export declare const meProfileSummarySchema: z.ZodObject<{
    user: z.ZodObject<{
        userId: z.ZodString;
        email: z.ZodString;
        displayName: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    currentWorkspace: z.ZodObject<{
        workspaceId: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            enterprise: "enterprise";
            personal: "personal";
            team: "team";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        contextKey: z.ZodString;
        root: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        membershipStatus: z.ZodEnum<{
            active: "active";
            suspended: "suspended";
        }>;
    }, z.core.$strip>;
    metrics: z.ZodObject<{
        visibleWorkshopsCount: z.ZodNumber;
        visibleServicesCount: z.ZodNumber;
        visibleRunsCount: z.ZodNumber;
        visiblePackagesCount: z.ZodNumber;
        pendingApprovalsCount: z.ZodNumber;
        recentAssetsCount: z.ZodNumber;
    }, z.core.$strip>;
    profileMetrics: z.ZodObject<{
        totalAssetsCount: z.ZodNumber;
        receiptAssetsCount: z.ZodNumber;
        visibleWorkshopsCount: z.ZodNumber;
        favoriteWorkshopsCount: z.ZodNumber;
        pendingActionsCount: z.ZodNumber;
    }, z.core.$strip>;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const meAssetKindSchema: z.ZodEnum<{
    receipt: "receipt";
    general_file: "general_file";
    result_bundle: "result_bundle";
    archive_record: "archive_record";
    evidence: "evidence";
}>;
export declare const meAssetRecordSchema: z.ZodObject<{
    assetId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    runId: z.ZodString;
    runTitle: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    title: z.ZodString;
    filePath: z.ZodString;
    fileKind: z.ZodEnum<{
        output: "output";
        input: "input";
        receipt: "receipt";
        archive: "archive";
        log: "log";
        screenshot: "screenshot";
    }>;
    assetKind: z.ZodEnum<{
        receipt: "receipt";
        general_file: "general_file";
        result_bundle: "result_bundle";
        archive_record: "archive_record";
        evidence: "evidence";
    }>;
    previewMode: z.ZodEnum<{
        text: "text";
        none: "none";
        image: "image";
        pdf: "pdf";
        download: "download";
    }>;
    previewAvailable: z.ZodBoolean;
    downloadable: z.ZodBoolean;
    sizeBytes: z.ZodNullable<z.ZodNumber>;
    updatedAt: z.ZodString;
    sourceSummary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    target: z.ZodDiscriminatedUnion<[z.ZodObject<{
        resource: z.ZodLiteral<"run">;
        runId: z.ZodString;
        view: z.ZodEnum<{
            detail: "detail";
            files: "files";
            audit: "audit";
        }>;
        anchorType: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            message: "message";
            approval: "approval";
            file: "file";
            run: "run";
        }>>>;
        anchorRefId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        resource: z.ZodLiteral<"workspace">;
        workspaceId: z.ZodString;
        view: z.ZodEnum<{
            me: "me";
            notifications: "notifications";
        }>;
    }, z.core.$strip>], "resource">;
}, z.core.$strip>;
export declare const listMeAssetsQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    kind: z.ZodOptional<z.ZodEnum<{
        receipt: "receipt";
        general_file: "general_file";
        result_bundle: "result_bundle";
        archive_record: "archive_record";
        evidence: "evidence";
    }>>;
}, z.core.$strip>;
export declare const meAssetSummaryBucketSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        receipt: "receipt";
        general_file: "general_file";
        result_bundle: "result_bundle";
        archive_record: "archive_record";
        evidence: "evidence";
    }>;
    count: z.ZodNumber;
}, z.core.$strip>;
export declare const meAssetListResponseSchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    updatedAt: z.ZodNullable<z.ZodString>;
    byKind: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            receipt: "receipt";
            general_file: "general_file";
            result_bundle: "result_bundle";
            archive_record: "archive_record";
            evidence: "evidence";
        }>;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    items: z.ZodArray<z.ZodObject<{
        assetId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        runId: z.ZodString;
        runTitle: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        title: z.ZodString;
        filePath: z.ZodString;
        fileKind: z.ZodEnum<{
            output: "output";
            input: "input";
            receipt: "receipt";
            archive: "archive";
            log: "log";
            screenshot: "screenshot";
        }>;
        assetKind: z.ZodEnum<{
            receipt: "receipt";
            general_file: "general_file";
            result_bundle: "result_bundle";
            archive_record: "archive_record";
            evidence: "evidence";
        }>;
        previewMode: z.ZodEnum<{
            text: "text";
            none: "none";
            image: "image";
            pdf: "pdf";
            download: "download";
        }>;
        previewAvailable: z.ZodBoolean;
        downloadable: z.ZodBoolean;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        updatedAt: z.ZodString;
        sourceSummary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        target: z.ZodDiscriminatedUnion<[z.ZodObject<{
            resource: z.ZodLiteral<"run">;
            runId: z.ZodString;
            view: z.ZodEnum<{
                detail: "detail";
                files: "files";
                audit: "audit";
            }>;
            anchorType: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
                message: "message";
                approval: "approval";
                file: "file";
                run: "run";
            }>>>;
            anchorRefId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>, z.ZodObject<{
            resource: z.ZodLiteral<"workspace">;
            workspaceId: z.ZodString;
            view: z.ZodEnum<{
                me: "me";
                notifications: "notifications";
            }>;
        }, z.core.$strip>], "resource">;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const meFavoriteTargetSchema: z.ZodObject<{
    resource: z.ZodLiteral<"workshop">;
    workshopId: z.ZodString;
    view: z.ZodLiteral<"detail">;
}, z.core.$strip>;
export declare const meFavoriteWorkshopRecordSchema: z.ZodObject<{
    favoriteId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    workshopId: z.ZodString;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    ownerLabel: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    badge: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    coverAssetUrl: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    target: z.ZodObject<{
        resource: z.ZodLiteral<"workshop">;
        workshopId: z.ZodString;
        view: z.ZodLiteral<"detail">;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const listMeFavoriteWorkshopsQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const meFavoriteWorkshopListResponseSchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    updatedAt: z.ZodNullable<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        favoriteId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        workshopId: z.ZodString;
        title: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        ownerLabel: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        badge: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        coverAssetUrl: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        target: z.ZodObject<{
            resource: z.ZodLiteral<"workshop">;
            workshopId: z.ZodString;
            view: z.ZodLiteral<"detail">;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const setMeFavoriteWorkshopInputSchema: z.ZodObject<{
    favorited: z.ZodBoolean;
}, z.core.$strip>;
export declare const setMeFavoriteWorkshopResultSchema: z.ZodObject<{
    favorited: z.ZodBoolean;
    favorite: z.ZodNullable<z.ZodObject<{
        favoriteId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        workshopId: z.ZodString;
        title: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        ownerLabel: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        badge: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        coverAssetUrl: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        target: z.ZodObject<{
            resource: z.ZodLiteral<"workshop">;
            workshopId: z.ZodString;
            view: z.ZodLiteral<"detail">;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const meRecentResourceTypeSchema: z.ZodEnum<{
    run: "run";
    workshop: "workshop";
    service: "service";
}>;
export declare const meRecentInteractionSchema: z.ZodEnum<{
    open: "open";
    launch: "launch";
    resume: "resume";
}>;
export declare const meRecentToneSchema: z.ZodEnum<{
    active: "active";
    success: "success";
    warn: "warn";
    danger: "danger";
}>;
export declare const meRecentTargetSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    resource: z.ZodLiteral<"workshop">;
    workshopId: z.ZodString;
    view: z.ZodLiteral<"detail">;
}, z.core.$strip>, z.ZodObject<{
    resource: z.ZodLiteral<"service">;
    serviceId: z.ZodString;
    view: z.ZodLiteral<"detail">;
}, z.core.$strip>, z.ZodObject<{
    resource: z.ZodLiteral<"run">;
    runId: z.ZodString;
    view: z.ZodEnum<{
        detail: "detail";
        files: "files";
    }>;
}, z.core.$strip>], "resource">;
export declare const meRecentActivityRecordSchema: z.ZodObject<{
    activityId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    resourceType: z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
    }>;
    resourceId: z.ZodString;
    interaction: z.ZodEnum<{
        open: "open";
        launch: "launch";
        resume: "resume";
    }>;
    sourceSurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    badge: z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>;
    tone: z.ZodEnum<{
        active: "active";
        success: "success";
        warn: "warn";
        danger: "danger";
    }>;
    workshopId: z.ZodNullable<z.ZodString>;
    serviceId: z.ZodNullable<z.ZodString>;
    runId: z.ZodNullable<z.ZodString>;
    lastAccessedAt: z.ZodString;
    target: z.ZodDiscriminatedUnion<[z.ZodObject<{
        resource: z.ZodLiteral<"workshop">;
        workshopId: z.ZodString;
        view: z.ZodLiteral<"detail">;
    }, z.core.$strip>, z.ZodObject<{
        resource: z.ZodLiteral<"service">;
        serviceId: z.ZodString;
        view: z.ZodLiteral<"detail">;
    }, z.core.$strip>, z.ZodObject<{
        resource: z.ZodLiteral<"run">;
        runId: z.ZodString;
        view: z.ZodEnum<{
            detail: "detail";
            files: "files";
        }>;
    }, z.core.$strip>], "resource">;
}, z.core.$strip>;
export declare const listMeRecentActivitiesQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    types: z.ZodPipe<z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodString>>>, z.ZodOptional<z.ZodArray<z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
    }>>>>;
}, z.core.$strip>;
export declare const meRecentActivityListResponseSchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    updatedAt: z.ZodNullable<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        activityId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        resourceType: z.ZodEnum<{
            run: "run";
            workshop: "workshop";
            service: "service";
        }>;
        resourceId: z.ZodString;
        interaction: z.ZodEnum<{
            open: "open";
            launch: "launch";
            resume: "resume";
        }>;
        sourceSurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        title: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        badge: z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>;
        tone: z.ZodEnum<{
            active: "active";
            success: "success";
            warn: "warn";
            danger: "danger";
        }>;
        workshopId: z.ZodNullable<z.ZodString>;
        serviceId: z.ZodNullable<z.ZodString>;
        runId: z.ZodNullable<z.ZodString>;
        lastAccessedAt: z.ZodString;
        target: z.ZodDiscriminatedUnion<[z.ZodObject<{
            resource: z.ZodLiteral<"workshop">;
            workshopId: z.ZodString;
            view: z.ZodLiteral<"detail">;
        }, z.core.$strip>, z.ZodObject<{
            resource: z.ZodLiteral<"service">;
            serviceId: z.ZodString;
            view: z.ZodLiteral<"detail">;
        }, z.core.$strip>, z.ZodObject<{
            resource: z.ZodLiteral<"run">;
            runId: z.ZodString;
            view: z.ZodEnum<{
                detail: "detail";
                files: "files";
            }>;
        }, z.core.$strip>], "resource">;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const recordMeRecentActivityInputSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    resourceType: z.ZodLiteral<"workshop">;
    workshopId: z.ZodString;
    interaction: z.ZodEnum<{
        open: "open";
        launch: "launch";
        resume: "resume";
    }>;
    sourceSurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
}, z.core.$strip>, z.ZodObject<{
    resourceType: z.ZodLiteral<"service">;
    serviceId: z.ZodString;
    interaction: z.ZodEnum<{
        open: "open";
        launch: "launch";
        resume: "resume";
    }>;
    sourceSurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
}, z.core.$strip>, z.ZodObject<{
    resourceType: z.ZodLiteral<"run">;
    runId: z.ZodString;
    interaction: z.ZodEnum<{
        open: "open";
        launch: "launch";
        resume: "resume";
    }>;
    sourceSurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
}, z.core.$strip>], "resourceType">;
export declare const meAuthorizationCategorySchema: z.ZodEnum<{
    workspace: "workspace";
    credential: "credential";
    account: "account";
    mcp: "mcp";
    quota: "quota";
    billing: "billing";
}>;
export declare const meAuthorizationToneSchema: z.ZodEnum<{
    active: "active";
    success: "success";
    warn: "warn";
    danger: "danger";
}>;
export declare const meAuthorizationRecordSchema: z.ZodObject<{
    authorizationId: z.ZodString;
    category: z.ZodEnum<{
        workspace: "workspace";
        credential: "credential";
        account: "account";
        mcp: "mcp";
        quota: "quota";
        billing: "billing";
    }>;
    provider: z.ZodNullable<z.ZodString>;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    statusLabel: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    tone: z.ZodEnum<{
        active: "active";
        success: "success";
        warn: "warn";
        danger: "danger";
    }>;
    updatedAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const listMeAuthorizationsQuerySchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const meAuthorizationSummarySchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    attentionCount: z.ZodNumber;
    updatedAt: z.ZodNullable<z.ZodString>;
    entries: z.ZodArray<z.ZodObject<{
        authorizationId: z.ZodString;
        category: z.ZodEnum<{
            workspace: "workspace";
            credential: "credential";
            account: "account";
            mcp: "mcp";
            quota: "quota";
            billing: "billing";
        }>;
        provider: z.ZodNullable<z.ZodString>;
        title: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        statusLabel: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        tone: z.ZodEnum<{
            active: "active";
            success: "success";
            warn: "warn";
            danger: "danger";
        }>;
        updatedAt: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MeNoticeTone = z.infer<typeof meNoticeToneSchema>;
export type MeNoticeType = z.infer<typeof meNoticeTypeSchema>;
export type MeNoticeRunTargetView = z.infer<typeof meNoticeRunTargetViewSchema>;
export type MeNoticeTarget = z.infer<typeof meNoticeTargetSchema>;
export type MeNotice = z.infer<typeof meNoticeSchema>;
export type ListMeNoticesQuery = z.infer<typeof listMeNoticesQuerySchema>;
export type MeNoticeSummaryBucket = z.infer<typeof meNoticeSummaryBucketSchema>;
export type MeNoticeSummary = z.infer<typeof meNoticeSummarySchema>;
export type MeProfileMetrics = z.infer<typeof meProfileMetricsSchema>;
export type MeProfileSummary = z.infer<typeof meProfileSummarySchema>;
export type MeAssetKind = z.infer<typeof meAssetKindSchema>;
export type MeAssetRecord = z.infer<typeof meAssetRecordSchema>;
export type ListMeAssetsQuery = z.infer<typeof listMeAssetsQuerySchema>;
export type MeAssetSummaryBucket = z.infer<typeof meAssetSummaryBucketSchema>;
export type MeAssetListResponse = z.infer<typeof meAssetListResponseSchema>;
export type MeFavoriteTarget = z.infer<typeof meFavoriteTargetSchema>;
export type MeFavoriteWorkshopRecord = z.infer<typeof meFavoriteWorkshopRecordSchema>;
export type ListMeFavoriteWorkshopsQuery = z.infer<typeof listMeFavoriteWorkshopsQuerySchema>;
export type MeFavoriteWorkshopListResponse = z.infer<typeof meFavoriteWorkshopListResponseSchema>;
export type SetMeFavoriteWorkshopInput = z.infer<typeof setMeFavoriteWorkshopInputSchema>;
export type SetMeFavoriteWorkshopResult = z.infer<typeof setMeFavoriteWorkshopResultSchema>;
export type MeRecentResourceType = z.infer<typeof meRecentResourceTypeSchema>;
export type MeRecentInteraction = z.infer<typeof meRecentInteractionSchema>;
export type MeRecentTone = z.infer<typeof meRecentToneSchema>;
export type MeRecentTarget = z.infer<typeof meRecentTargetSchema>;
export type MeRecentActivityRecord = z.infer<typeof meRecentActivityRecordSchema>;
export type ListMeRecentActivitiesQuery = z.infer<typeof listMeRecentActivitiesQuerySchema>;
export type MeRecentActivityListResponse = z.infer<typeof meRecentActivityListResponseSchema>;
export type RecordMeRecentActivityInput = z.infer<typeof recordMeRecentActivityInputSchema>;
export type MeAuthorizationCategory = z.infer<typeof meAuthorizationCategorySchema>;
export type MeAuthorizationTone = z.infer<typeof meAuthorizationToneSchema>;
export type MeAuthorizationRecord = z.infer<typeof meAuthorizationRecordSchema>;
export type ListMeAuthorizationsQuery = z.infer<typeof listMeAuthorizationsQuerySchema>;
export type MeAuthorizationSummary = z.infer<typeof meAuthorizationSummarySchema>;
//# sourceMappingURL=me.d.ts.map