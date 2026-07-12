import { z } from "zod";
export declare const searchResourceTypeSchema: z.ZodEnum<{
    run: "run";
    workshop: "workshop";
    service: "service";
    package: "package";
}>;
export declare const searchResultToneSchema: z.ZodEnum<{
    active: "active";
    success: "success";
    warn: "warn";
    danger: "danger";
}>;
export declare const searchMatchFieldSchema: z.ZodEnum<{
    title: "title";
    tag: "tag";
    summary: "summary";
    id: "id";
    subtitle: "subtitle";
}>;
export declare const searchResultTargetSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strip>, z.ZodObject<{
    resource: z.ZodLiteral<"package">;
    packageId: z.ZodString;
    view: z.ZodLiteral<"detail">;
}, z.core.$strip>], "resource">;
export declare const searchResultRecordSchema: z.ZodObject<{
    documentId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    resourceType: z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
        package: "package";
    }>;
    resourceId: z.ZodString;
    title: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    subtitle: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
    summary: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
    badge: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>>>;
    tone: z.ZodEnum<{
        active: "active";
        success: "success";
        warn: "warn";
        danger: "danger";
    }>;
    matchedFields: z.ZodDefault<z.ZodArray<z.ZodEnum<{
        title: "title";
        tag: "tag";
        summary: "summary";
        id: "id";
        subtitle: "subtitle";
    }>>>;
    recent: z.ZodDefault<z.ZodBoolean>;
    favorited: z.ZodDefault<z.ZodBoolean>;
    updatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
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
    }, z.core.$strip>, z.ZodObject<{
        resource: z.ZodLiteral<"package">;
        packageId: z.ZodString;
        view: z.ZodLiteral<"detail">;
    }, z.core.$strip>], "resource">;
}, z.core.$strip>;
export declare const searchResultListResponseSchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    updatedAt: z.ZodNullable<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        documentId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        resourceType: z.ZodEnum<{
            run: "run";
            workshop: "workshop";
            service: "service";
            package: "package";
        }>;
        resourceId: z.ZodString;
        title: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        subtitle: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        badge: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        tone: z.ZodEnum<{
            active: "active";
            success: "success";
            warn: "warn";
            danger: "danger";
        }>;
        matchedFields: z.ZodDefault<z.ZodArray<z.ZodEnum<{
            title: "title";
            tag: "tag";
            summary: "summary";
            id: "id";
            subtitle: "subtitle";
        }>>>;
        recent: z.ZodDefault<z.ZodBoolean>;
        favorited: z.ZodDefault<z.ZodBoolean>;
        updatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
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
        }, z.core.$strip>, z.ZodObject<{
            resource: z.ZodLiteral<"package">;
            packageId: z.ZodString;
            view: z.ZodLiteral<"detail">;
        }, z.core.$strip>], "resource">;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const listSearchResultsQuerySchema: z.ZodObject<{
    q: z.ZodString;
    types: z.ZodPipe<z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodString>>>, z.ZodOptional<z.ZodArray<z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
        package: "package";
    }>>>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    entrySurface: z.ZodOptional<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>;
}, z.core.$strip>;
export declare const searchSuggestionSchema: z.ZodObject<{
    suggestionId: z.ZodString;
    resourceTypes: z.ZodArray<z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
        package: "package";
    }>>;
    text: z.ZodObject<{
        zh: z.ZodString;
        en: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const searchSuggestionListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        suggestionId: z.ZodString;
        resourceTypes: z.ZodArray<z.ZodEnum<{
            run: "run";
            workshop: "workshop";
            service: "service";
            package: "package";
        }>>;
        text: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const listSearchSuggestionsQuerySchema: z.ZodObject<{
    q: z.ZodString;
    types: z.ZodPipe<z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodString>>>, z.ZodOptional<z.ZodArray<z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
        package: "package";
    }>>>>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    entrySurface: z.ZodOptional<z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>>;
}, z.core.$strip>;
export declare const searchHistoryRecordSchema: z.ZodObject<{
    historyId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    query: z.ZodString;
    resourceTypes: z.ZodArray<z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
        package: "package";
    }>>;
    lastUsedAt: z.ZodString;
}, z.core.$strip>;
export declare const searchHistoryListResponseSchema: z.ZodObject<{
    totalCount: z.ZodNumber;
    updatedAt: z.ZodNullable<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        historyId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        query: z.ZodString;
        resourceTypes: z.ZodArray<z.ZodEnum<{
            run: "run";
            workshop: "workshop";
            service: "service";
            package: "package";
        }>>;
        lastUsedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const listSearchHistoryQuerySchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const recordSearchClickInputSchema: z.ZodObject<{
    query: z.ZodString;
    documentId: z.ZodString;
    entrySurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
}, z.core.$strip>;
export declare const recordSearchClickResultSchema: z.ZodObject<{
    eventId: z.ZodString;
    documentId: z.ZodString;
    resourceType: z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
        package: "package";
    }>;
    resourceId: z.ZodString;
    rank: z.ZodNumber;
    acceptedAt: z.ZodString;
    history: z.ZodObject<{
        historyId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        query: z.ZodString;
        resourceTypes: z.ZodArray<z.ZodEnum<{
            run: "run";
            workshop: "workshop";
            service: "service";
            package: "package";
        }>>;
        lastUsedAt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type SearchResourceType = z.infer<typeof searchResourceTypeSchema>;
export type SearchResultTone = z.infer<typeof searchResultToneSchema>;
export type SearchMatchField = z.infer<typeof searchMatchFieldSchema>;
export type SearchResultTarget = z.infer<typeof searchResultTargetSchema>;
export type SearchResultRecord = z.infer<typeof searchResultRecordSchema>;
export type SearchResultListResponse = z.infer<typeof searchResultListResponseSchema>;
export type ListSearchResultsQuery = z.infer<typeof listSearchResultsQuerySchema>;
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
export type SearchSuggestionListResponse = z.infer<typeof searchSuggestionListResponseSchema>;
export type ListSearchSuggestionsQuery = z.infer<typeof listSearchSuggestionsQuerySchema>;
export type SearchHistoryRecord = z.infer<typeof searchHistoryRecordSchema>;
export type SearchHistoryListResponse = z.infer<typeof searchHistoryListResponseSchema>;
export type ListSearchHistoryQuery = z.infer<typeof listSearchHistoryQuerySchema>;
export type RecordSearchClickInput = z.infer<typeof recordSearchClickInputSchema>;
export type RecordSearchClickResult = z.infer<typeof recordSearchClickResultSchema>;
//# sourceMappingURL=search.d.ts.map