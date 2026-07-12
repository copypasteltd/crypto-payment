import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const storedSearchHistoryRecordSchema: z.ZodObject<{
    historyId: z.ZodString;
    userId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    query: z.ZodString;
    normalizedQuery: z.ZodString;
    resourceTypes: z.ZodArray<z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
        package: "package";
    }>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const storedSearchClickEventRecordSchema: z.ZodObject<{
    eventId: z.ZodString;
    userId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    query: z.ZodString;
    normalizedQuery: z.ZodString;
    documentId: z.ZodString;
    resourceType: z.ZodEnum<{
        run: "run";
        workshop: "workshop";
        service: "service";
        package: "package";
    }>;
    resourceId: z.ZodString;
    rank: z.ZodNumber;
    sourceSurface: z.ZodEnum<{
        dashboard: "dashboard";
        h5: "h5";
        "mini-program": "mini-program";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const searchStateSchema: z.ZodObject<{
    historyEntries: z.ZodArray<z.ZodObject<{
        historyId: z.ZodString;
        userId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        query: z.ZodString;
        normalizedQuery: z.ZodString;
        resourceTypes: z.ZodArray<z.ZodEnum<{
            run: "run";
            workshop: "workshop";
            service: "service";
            package: "package";
        }>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    clickEvents: z.ZodArray<z.ZodObject<{
        eventId: z.ZodString;
        userId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        query: z.ZodString;
        normalizedQuery: z.ZodString;
        documentId: z.ZodString;
        resourceType: z.ZodEnum<{
            run: "run";
            workshop: "workshop";
            service: "service";
            package: "package";
        }>;
        resourceId: z.ZodString;
        rank: z.ZodNumber;
        sourceSurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StoredSearchHistoryRecord = z.infer<typeof storedSearchHistoryRecordSchema>;
export type StoredSearchClickEventRecord = z.infer<typeof storedSearchClickEventRecordSchema>;
export type SearchState = z.infer<typeof searchStateSchema>;
export declare const MAX_HISTORY_ENTRIES_PER_CONTEXT = 50;
export declare const MAX_CLICK_EVENTS_PER_CONTEXT = 200;
export interface SearchRepository {
    init(): Promise<void>;
    listSearchHistory(userId: string, workspaceContextKey: string): StoredSearchHistoryRecord[];
    getSearchHistory(userId: string, workspaceContextKey: string, normalizedQuery: string): StoredSearchHistoryRecord | null;
    saveSearchHistory(record: StoredSearchHistoryRecord): Promise<StoredSearchHistoryRecord>;
    listSearchClickEvents(userId: string, workspaceContextKey: string, normalizedQuery?: string, limit?: number): StoredSearchClickEventRecord[];
    appendSearchClickEvent(record: StoredSearchClickEventRecord): Promise<StoredSearchClickEventRecord>;
}
export declare abstract class CachedSearchRepository implements SearchRepository {
    #private;
    init(): Promise<void>;
    listSearchHistory(userId: string, workspaceContextKey: string): {
        historyId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        query: string;
        normalizedQuery: string;
        resourceTypes: ("run" | "service" | "package" | "workshop")[];
        createdAt: string;
        updatedAt: string;
    }[];
    getSearchHistory(userId: string, workspaceContextKey: string, normalizedQuery: string): {
        historyId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        query: string;
        normalizedQuery: string;
        resourceTypes: ("run" | "service" | "package" | "workshop")[];
        createdAt: string;
        updatedAt: string;
    } | null;
    saveSearchHistory(record: StoredSearchHistoryRecord): Promise<{
        historyId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        query: string;
        normalizedQuery: string;
        resourceTypes: ("run" | "service" | "package" | "workshop")[];
        createdAt: string;
        updatedAt: string;
    }>;
    listSearchClickEvents(userId: string, workspaceContextKey: string, normalizedQuery?: string, limit?: number): {
        eventId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        query: string;
        normalizedQuery: string;
        documentId: string;
        resourceType: "run" | "service" | "package" | "workshop";
        resourceId: string;
        rank: number;
        sourceSurface: "dashboard" | "h5" | "mini-program";
        createdAt: string;
        updatedAt: string;
    }[];
    appendSearchClickEvent(record: StoredSearchClickEventRecord): Promise<{
        eventId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        query: string;
        normalizedQuery: string;
        documentId: string;
        resourceType: "run" | "service" | "package" | "workshop";
        resourceId: string;
        rank: number;
        sourceSurface: "dashboard" | "h5" | "mini-program";
        createdAt: string;
        updatedAt: string;
    }>;
    protected setState(state: SearchState): void;
    protected replaceCachedSearchHistory(record: StoredSearchHistoryRecord): void;
    protected appendCachedSearchClickEvent(record: StoredSearchClickEventRecord): void;
    protected updateState(mutator: (state: SearchState) => SearchState): Promise<void>;
    protected abstract loadState(): Promise<SearchState>;
    protected abstract writeState(state: SearchState): Promise<void>;
}
export interface PostgresSearchRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresSearchRepository extends CachedSearchRepository {
    #private;
    constructor(options: PostgresSearchRepositoryOptions);
    protected loadState(): Promise<{
        historyEntries: {
            historyId: string;
            userId: string;
            workspaceId: string;
            workspaceContextKey: string;
            query: string;
            normalizedQuery: string;
            resourceTypes: ("run" | "service" | "package" | "workshop")[];
            createdAt: string;
            updatedAt: string;
        }[];
        clickEvents: {
            eventId: string;
            userId: string;
            workspaceId: string;
            workspaceContextKey: string;
            query: string;
            normalizedQuery: string;
            documentId: string;
            resourceType: "run" | "service" | "package" | "workshop";
            resourceId: string;
            rank: number;
            sourceSurface: "dashboard" | "h5" | "mini-program";
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    saveSearchHistory(record: StoredSearchHistoryRecord): Promise<{
        historyId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        query: string;
        normalizedQuery: string;
        resourceTypes: ("run" | "service" | "package" | "workshop")[];
        createdAt: string;
        updatedAt: string;
    }>;
    appendSearchClickEvent(record: StoredSearchClickEventRecord): Promise<{
        eventId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        query: string;
        normalizedQuery: string;
        documentId: string;
        resourceType: "run" | "service" | "package" | "workshop";
        resourceId: string;
        rank: number;
        sourceSurface: "dashboard" | "h5" | "mini-program";
        createdAt: string;
        updatedAt: string;
    }>;
    protected writeState(state: SearchState): Promise<void>;
}
//# sourceMappingURL=search-repository.d.ts.map