import { z } from "zod";
export declare const localizedTextSchema: z.ZodObject<{
    zh: z.ZodString;
    en: z.ZodString;
}, z.core.$strip>;
export declare const workshopScopeSchema: z.ZodEnum<{
    content: "content";
    enterprise: "enterprise";
    creative: "creative";
    personal: "personal";
}>;
export declare const catalogVisibilitySchema: z.ZodEnum<{
    workspace: "workspace";
    private: "private";
    public: "public";
    marketplace: "marketplace";
}>;
export declare const catalogStatusSchema: z.ZodEnum<{
    active: "active";
    draft: "draft";
    hidden: "hidden";
    archived: "archived";
}>;
export declare const serviceLaunchModeSchema: z.ZodEnum<{
    "instant-conversation": "instant-conversation";
    "form-first": "form-first";
    "approval-first": "approval-first";
}>;
export declare const workspaceContextTypeSchema: z.ZodEnum<{
    enterprise: "enterprise";
    personal: "personal";
    team: "team";
}>;
export declare const workspaceContextKeySchema: z.ZodString;
export declare const workshopIdSchema: z.ZodString;
export declare const serviceIdSchema: z.ZodString;
export declare const workspaceContextSummarySchema: z.ZodObject<{
    contextKey: z.ZodString;
    runtimeWorkspaceId: z.ZodString;
    displayName: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    type: z.ZodEnum<{
        enterprise: "enterprise";
        personal: "personal";
        team: "team";
    }>;
    meta: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    root: z.ZodString;
    allowedEntrySurfaces: z.ZodArray<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>;
}, z.core.$strip>;
export declare const workshopCatalogEntrySchema: z.ZodObject<{
    workshopId: z.ZodString;
    scope: z.ZodEnum<{
        content: "content";
        enterprise: "enterprise";
        creative: "creative";
        personal: "personal";
    }>;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        hidden: "hidden";
        archived: "archived";
    }>;
    visibility: z.ZodEnum<{
        workspace: "workspace";
        private: "private";
        public: "public";
        marketplace: "marketplace";
    }>;
    displayName: z.ZodObject<{
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
    audience: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    nextStepSummary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    coverAssetUrl: z.ZodString;
    tagList: z.ZodDefault<z.ZodArray<z.ZodString>>;
    defaultServiceId: z.ZodString;
}, z.core.$strip>;
export declare const serviceCatalogEntrySchema: z.ZodObject<{
    serviceId: z.ZodString;
    workshopId: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        hidden: "hidden";
        archived: "archived";
    }>;
    displayName: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    authRequirementText: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    estimatedDuration: z.ZodString;
    targetPathHint: z.ZodString;
    outputContractSummary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    launchMode: z.ZodEnum<{
        "instant-conversation": "instant-conversation";
        "form-first": "form-first";
        "approval-first": "approval-first";
    }>;
    requiredBindings: z.ZodObject<{
        firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    linkedInstanceHint: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const workshopDetailSchema: z.ZodObject<{
    workshopId: z.ZodString;
    scope: z.ZodEnum<{
        content: "content";
        enterprise: "enterprise";
        creative: "creative";
        personal: "personal";
    }>;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        hidden: "hidden";
        archived: "archived";
    }>;
    visibility: z.ZodEnum<{
        workspace: "workspace";
        private: "private";
        public: "public";
        marketplace: "marketplace";
    }>;
    displayName: z.ZodObject<{
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
    audience: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    nextStepSummary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    coverAssetUrl: z.ZodString;
    tagList: z.ZodDefault<z.ZodArray<z.ZodString>>;
    defaultServiceId: z.ZodString;
    services: z.ZodDefault<z.ZodArray<z.ZodObject<{
        serviceId: z.ZodString;
        workshopId: z.ZodString;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            hidden: "hidden";
            archived: "archived";
        }>;
        displayName: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        authRequirementText: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        estimatedDuration: z.ZodString;
        targetPathHint: z.ZodString;
        outputContractSummary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        launchMode: z.ZodEnum<{
            "instant-conversation": "instant-conversation";
            "form-first": "form-first";
            "approval-first": "approval-first";
        }>;
        requiredBindings: z.ZodObject<{
            firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
            credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
        linkedInstanceHint: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const serviceDetailSchema: z.ZodObject<{
    serviceId: z.ZodString;
    workshopId: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        draft: "draft";
        hidden: "hidden";
        archived: "archived";
    }>;
    displayName: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    authRequirementText: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    estimatedDuration: z.ZodString;
    targetPathHint: z.ZodString;
    outputContractSummary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    launchMode: z.ZodEnum<{
        "instant-conversation": "instant-conversation";
        "form-first": "form-first";
        "approval-first": "approval-first";
    }>;
    requiredBindings: z.ZodObject<{
        firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    linkedInstanceHint: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    workshop: z.ZodObject<{
        workshopId: z.ZodString;
        scope: z.ZodEnum<{
            content: "content";
            enterprise: "enterprise";
            creative: "creative";
            personal: "personal";
        }>;
        status: z.ZodEnum<{
            active: "active";
            draft: "draft";
            hidden: "hidden";
            archived: "archived";
        }>;
        visibility: z.ZodEnum<{
            workspace: "workspace";
            private: "private";
            public: "public";
            marketplace: "marketplace";
        }>;
        displayName: z.ZodObject<{
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
        audience: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        nextStepSummary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        coverAssetUrl: z.ZodString;
        tagList: z.ZodDefault<z.ZodArray<z.ZodString>>;
        defaultServiceId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const serviceLaunchTemplateResolutionSourceSchema: z.ZodEnum<{
    "catalog-default": "catalog-default";
    "creator-activation": "creator-activation";
}>;
export declare const serviceLaunchTemplateResolutionSchema: z.ZodObject<{
    source: z.ZodEnum<{
        "catalog-default": "catalog-default";
        "creator-activation": "creator-activation";
    }>;
    packageId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    releaseId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    activationId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const serviceLaunchTemplateSchema: z.ZodObject<{
    serviceId: z.ZodString;
    workspaceContext: z.ZodObject<{
        contextKey: z.ZodString;
        runtimeWorkspaceId: z.ZodString;
        displayName: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        type: z.ZodEnum<{
            enterprise: "enterprise";
            personal: "personal";
            team: "team";
        }>;
        meta: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        root: z.ZodString;
        allowedEntrySurfaces: z.ZodArray<z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>>;
    }, z.core.$strip>;
    taskVersionId: z.ZodString;
    sessionVersionId: z.ZodString;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    targetRoot: z.ZodString;
    initialMessagePolicy: z.ZodLiteral<"system-collects-required-info">;
    resolution: z.ZodDefault<z.ZodObject<{
        source: z.ZodEnum<{
            "catalog-default": "catalog-default";
            "creator-activation": "creator-activation";
        }>;
        packageId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        releaseId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        activationId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    createRunInput: z.ZodObject<{
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
}, z.core.$strip>;
export declare const listWorkshopsQuerySchema: z.ZodObject<{
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodOptional<z.ZodString>;
    entrySurface: z.ZodOptional<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>;
    q: z.ZodOptional<z.ZodString>;
    tag: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodEnum<{
        content: "content";
        enterprise: "enterprise";
        creative: "creative";
        personal: "personal";
    }>>;
}, z.core.$strip>;
export declare const listServicesQuerySchema: z.ZodObject<{
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodOptional<z.ZodString>;
    workshopId: z.ZodOptional<z.ZodString>;
    entrySurface: z.ZodOptional<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>;
    q: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createServiceLaunchTemplateInputSchema: z.ZodObject<{
    workspaceContextKey: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodOptional<z.ZodString>;
    entrySurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
}, z.core.$strip>;
export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type WorkshopScope = z.infer<typeof workshopScopeSchema>;
export type CatalogVisibility = z.infer<typeof catalogVisibilitySchema>;
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
export type ServiceLaunchMode = z.infer<typeof serviceLaunchModeSchema>;
export type WorkspaceContextType = z.infer<typeof workspaceContextTypeSchema>;
export type WorkspaceContextSummary = z.infer<typeof workspaceContextSummarySchema>;
export type WorkshopCatalogEntry = z.infer<typeof workshopCatalogEntrySchema>;
export type ServiceCatalogEntry = z.infer<typeof serviceCatalogEntrySchema>;
export type WorkshopDetail = z.infer<typeof workshopDetailSchema>;
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;
export type ServiceLaunchTemplateResolutionSource = z.infer<typeof serviceLaunchTemplateResolutionSourceSchema>;
export type ServiceLaunchTemplateResolution = z.infer<typeof serviceLaunchTemplateResolutionSchema>;
export type ServiceLaunchTemplate = z.infer<typeof serviceLaunchTemplateSchema>;
export type ListWorkshopsQuery = z.infer<typeof listWorkshopsQuerySchema>;
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type CreateServiceLaunchTemplateInput = z.infer<typeof createServiceLaunchTemplateInputSchema>;
//# sourceMappingURL=catalog.d.ts.map