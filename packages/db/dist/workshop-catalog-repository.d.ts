import type { EntrySurface, WorkspaceContextSummary } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const workshopCatalogRecordSchema: z.ZodObject<{
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
    visibleInContexts: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const serviceCatalogRecordSchema: z.ZodObject<{
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
    visibleInContexts: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const launchTemplateRecordSchema: z.ZodObject<{
    templateKey: z.ZodString;
    serviceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    entrySurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
    taskVersionId: z.ZodString;
    sessionVersionId: z.ZodString;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    targetRoot: z.ZodString;
    bindings: z.ZodObject<{
        firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const catalogStateSchema: z.ZodObject<{
    contexts: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    workshops: z.ZodArray<z.ZodObject<{
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
        visibleInContexts: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    services: z.ZodArray<z.ZodObject<{
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
        visibleInContexts: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    launchTemplates: z.ZodArray<z.ZodObject<{
        templateKey: z.ZodString;
        serviceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        title: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        targetRoot: z.ZodString;
        bindings: z.ZodObject<{
            firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
            credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const workshopIdParamsSchema: z.ZodObject<{
    workshopId: z.ZodString;
}, z.core.$strip>;
export declare const serviceIdParamsSchema: z.ZodObject<{
    serviceId: z.ZodString;
}, z.core.$strip>;
export type WorkshopCatalogRecord = z.infer<typeof workshopCatalogRecordSchema>;
export type ServiceCatalogRecord = z.infer<typeof serviceCatalogRecordSchema>;
export type LaunchTemplateRecord = z.infer<typeof launchTemplateRecordSchema>;
export type CatalogState = z.infer<typeof catalogStateSchema>;
export interface WorkshopCatalogRepository {
    init(): Promise<void>;
    listContexts(): WorkspaceContextSummary[];
    getContextByKey(contextKey: string): WorkspaceContextSummary | null;
    getContextByRuntimeWorkspaceId(workspaceId: string): WorkspaceContextSummary | null;
    listWorkshops(): WorkshopCatalogRecord[];
    getWorkshopById(workshopId: string): WorkshopCatalogRecord | null;
    listServices(): ServiceCatalogRecord[];
    getServiceById(serviceId: string): ServiceCatalogRecord | null;
    listLaunchTemplates(): LaunchTemplateRecord[];
    findLaunchTemplate(serviceId: string, workspaceContextKey: string, entrySurface: EntrySurface): LaunchTemplateRecord | null;
    saveLaunchTemplate(template: LaunchTemplateRecord): Promise<void>;
    deleteLaunchTemplates(templateKeys: string[]): Promise<void>;
}
export declare abstract class CachedWorkshopCatalogRepository implements WorkshopCatalogRepository {
    #private;
    init(): Promise<void>;
    listContexts(): {
        contextKey: string;
        runtimeWorkspaceId: string;
        displayName: {
            zh: string;
            en: string;
        };
        type: "enterprise" | "personal" | "team";
        meta: {
            zh: string;
            en: string;
        };
        root: string;
        allowedEntrySurfaces: ("dashboard" | "h5" | "mini-program")[];
    }[];
    getContextByKey(contextKey: string): {
        contextKey: string;
        runtimeWorkspaceId: string;
        displayName: {
            zh: string;
            en: string;
        };
        type: "enterprise" | "personal" | "team";
        meta: {
            zh: string;
            en: string;
        };
        root: string;
        allowedEntrySurfaces: ("dashboard" | "h5" | "mini-program")[];
    } | null;
    getContextByRuntimeWorkspaceId(workspaceId: string): {
        contextKey: string;
        runtimeWorkspaceId: string;
        displayName: {
            zh: string;
            en: string;
        };
        type: "enterprise" | "personal" | "team";
        meta: {
            zh: string;
            en: string;
        };
        root: string;
        allowedEntrySurfaces: ("dashboard" | "h5" | "mini-program")[];
    } | null;
    listWorkshops(): {
        workshopId: string;
        scope: "enterprise" | "personal" | "content" | "creative";
        status: "active" | "draft" | "archived" | "hidden";
        visibility: "workspace" | "private" | "public" | "marketplace";
        displayName: {
            zh: string;
            en: string;
        };
        ownerLabel: {
            zh: string;
            en: string;
        };
        badge: {
            zh: string;
            en: string;
        };
        audience: {
            zh: string;
            en: string;
        };
        summary: {
            zh: string;
            en: string;
        };
        nextStepSummary: {
            zh: string;
            en: string;
        };
        coverAssetUrl: string;
        tagList: string[];
        defaultServiceId: string;
        visibleInContexts: string[];
    }[];
    getWorkshopById(workshopId: string): {
        workshopId: string;
        scope: "enterprise" | "personal" | "content" | "creative";
        status: "active" | "draft" | "archived" | "hidden";
        visibility: "workspace" | "private" | "public" | "marketplace";
        displayName: {
            zh: string;
            en: string;
        };
        ownerLabel: {
            zh: string;
            en: string;
        };
        badge: {
            zh: string;
            en: string;
        };
        audience: {
            zh: string;
            en: string;
        };
        summary: {
            zh: string;
            en: string;
        };
        nextStepSummary: {
            zh: string;
            en: string;
        };
        coverAssetUrl: string;
        tagList: string[];
        defaultServiceId: string;
        visibleInContexts: string[];
    } | null;
    listServices(): {
        serviceId: string;
        workshopId: string;
        status: "active" | "draft" | "archived" | "hidden";
        displayName: {
            zh: string;
            en: string;
        };
        summary: {
            zh: string;
            en: string;
        };
        authRequirementText: {
            zh: string;
            en: string;
        };
        estimatedDuration: string;
        targetPathHint: string;
        outputContractSummary: {
            zh: string;
            en: string;
        };
        launchMode: "instant-conversation" | "form-first" | "approval-first";
        requiredBindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
        linkedInstanceHint: string | null;
        visibleInContexts: string[];
    }[];
    getServiceById(serviceId: string): {
        serviceId: string;
        workshopId: string;
        status: "active" | "draft" | "archived" | "hidden";
        displayName: {
            zh: string;
            en: string;
        };
        summary: {
            zh: string;
            en: string;
        };
        authRequirementText: {
            zh: string;
            en: string;
        };
        estimatedDuration: string;
        targetPathHint: string;
        outputContractSummary: {
            zh: string;
            en: string;
        };
        launchMode: "instant-conversation" | "form-first" | "approval-first";
        requiredBindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
        linkedInstanceHint: string | null;
        visibleInContexts: string[];
    } | null;
    listLaunchTemplates(): {
        templateKey: string;
        serviceId: string;
        workspaceContextKey: string;
        entrySurface: "dashboard" | "h5" | "mini-program";
        taskVersionId: string;
        sessionVersionId: string;
        title: {
            zh: string;
            en: string;
        };
        targetRoot: string;
        bindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
    }[];
    findLaunchTemplate(serviceId: string, workspaceContextKey: string, entrySurface: EntrySurface): {
        templateKey: string;
        serviceId: string;
        workspaceContextKey: string;
        entrySurface: "dashboard" | "h5" | "mini-program";
        taskVersionId: string;
        sessionVersionId: string;
        title: {
            zh: string;
            en: string;
        };
        targetRoot: string;
        bindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
    } | null;
    saveLaunchTemplate(template: LaunchTemplateRecord): Promise<void>;
    deleteLaunchTemplates(templateKeys: string[]): Promise<void>;
    protected replaceState(state: CatalogState): Promise<void>;
    protected getState(): {
        contexts: {
            contextKey: string;
            runtimeWorkspaceId: string;
            displayName: {
                zh: string;
                en: string;
            };
            type: "enterprise" | "personal" | "team";
            meta: {
                zh: string;
                en: string;
            };
            root: string;
            allowedEntrySurfaces: ("dashboard" | "h5" | "mini-program")[];
        }[];
        workshops: {
            workshopId: string;
            scope: "enterprise" | "personal" | "content" | "creative";
            status: "active" | "draft" | "archived" | "hidden";
            visibility: "workspace" | "private" | "public" | "marketplace";
            displayName: {
                zh: string;
                en: string;
            };
            ownerLabel: {
                zh: string;
                en: string;
            };
            badge: {
                zh: string;
                en: string;
            };
            audience: {
                zh: string;
                en: string;
            };
            summary: {
                zh: string;
                en: string;
            };
            nextStepSummary: {
                zh: string;
                en: string;
            };
            coverAssetUrl: string;
            tagList: string[];
            defaultServiceId: string;
            visibleInContexts: string[];
        }[];
        services: {
            serviceId: string;
            workshopId: string;
            status: "active" | "draft" | "archived" | "hidden";
            displayName: {
                zh: string;
                en: string;
            };
            summary: {
                zh: string;
                en: string;
            };
            authRequirementText: {
                zh: string;
                en: string;
            };
            estimatedDuration: string;
            targetPathHint: string;
            outputContractSummary: {
                zh: string;
                en: string;
            };
            launchMode: "instant-conversation" | "form-first" | "approval-first";
            requiredBindings: {
                firstPartyMcpIds: string[];
                externalConnectorRefs: string[];
                credentialIds: string[];
            };
            linkedInstanceHint: string | null;
            visibleInContexts: string[];
        }[];
        launchTemplates: {
            templateKey: string;
            serviceId: string;
            workspaceContextKey: string;
            entrySurface: "dashboard" | "h5" | "mini-program";
            taskVersionId: string;
            sessionVersionId: string;
            title: {
                zh: string;
                en: string;
            };
            targetRoot: string;
            bindings: {
                firstPartyMcpIds: string[];
                externalConnectorRefs: string[];
                credentialIds: string[];
            };
        }[];
    };
    protected updateState(mutator: (state: CatalogState) => CatalogState): Promise<void>;
    protected abstract loadState(): Promise<CatalogState>;
    protected abstract writeState(state: CatalogState): Promise<void>;
}
export interface PostgresWorkshopCatalogRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresWorkshopCatalogRepository extends CachedWorkshopCatalogRepository {
    #private;
    constructor(options: PostgresWorkshopCatalogRepositoryOptions);
    protected loadState(): Promise<{
        contexts: {
            contextKey: string;
            runtimeWorkspaceId: string;
            displayName: {
                zh: string;
                en: string;
            };
            type: "enterprise" | "personal" | "team";
            meta: {
                zh: string;
                en: string;
            };
            root: string;
            allowedEntrySurfaces: ("dashboard" | "h5" | "mini-program")[];
        }[];
        workshops: {
            workshopId: string;
            scope: "enterprise" | "personal" | "content" | "creative";
            status: "active" | "draft" | "archived" | "hidden";
            visibility: "workspace" | "private" | "public" | "marketplace";
            displayName: {
                zh: string;
                en: string;
            };
            ownerLabel: {
                zh: string;
                en: string;
            };
            badge: {
                zh: string;
                en: string;
            };
            audience: {
                zh: string;
                en: string;
            };
            summary: {
                zh: string;
                en: string;
            };
            nextStepSummary: {
                zh: string;
                en: string;
            };
            coverAssetUrl: string;
            tagList: string[];
            defaultServiceId: string;
            visibleInContexts: string[];
        }[];
        services: {
            serviceId: string;
            workshopId: string;
            status: "active" | "draft" | "archived" | "hidden";
            displayName: {
                zh: string;
                en: string;
            };
            summary: {
                zh: string;
                en: string;
            };
            authRequirementText: {
                zh: string;
                en: string;
            };
            estimatedDuration: string;
            targetPathHint: string;
            outputContractSummary: {
                zh: string;
                en: string;
            };
            launchMode: "instant-conversation" | "form-first" | "approval-first";
            requiredBindings: {
                firstPartyMcpIds: string[];
                externalConnectorRefs: string[];
                credentialIds: string[];
            };
            linkedInstanceHint: string | null;
            visibleInContexts: string[];
        }[];
        launchTemplates: {
            templateKey: string;
            serviceId: string;
            workspaceContextKey: string;
            entrySurface: "dashboard" | "h5" | "mini-program";
            taskVersionId: string;
            sessionVersionId: string;
            title: {
                zh: string;
                en: string;
            };
            targetRoot: string;
            bindings: {
                firstPartyMcpIds: string[];
                externalConnectorRefs: string[];
                credentialIds: string[];
            };
        }[];
    }>;
    protected writeState(state: CatalogState): Promise<void>;
}
//# sourceMappingURL=workshop-catalog-repository.d.ts.map