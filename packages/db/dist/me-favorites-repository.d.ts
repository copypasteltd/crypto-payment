import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const storedFavoriteWorkshopRecordSchema: z.ZodObject<{
    favoriteId: z.ZodString;
    userId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    workshopId: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const meFavoritesStateSchema: z.ZodObject<{
    workshopFavorites: z.ZodArray<z.ZodObject<{
        favoriteId: z.ZodString;
        userId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        workshopId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const favoriteWorkshopParamsSchema: z.ZodObject<{
    workshopId: z.ZodString;
}, z.core.$strip>;
export type StoredFavoriteWorkshopRecord = z.infer<typeof storedFavoriteWorkshopRecordSchema>;
export type MeFavoritesState = z.infer<typeof meFavoritesStateSchema>;
export interface MeFavoritesRepository {
    init(): Promise<void>;
    listFavoriteWorkshops(userId: string, workspaceContextKey: string): StoredFavoriteWorkshopRecord[];
    getFavoriteWorkshop(userId: string, workspaceContextKey: string, workshopId: string): StoredFavoriteWorkshopRecord | null;
    saveFavoriteWorkshop(record: StoredFavoriteWorkshopRecord): Promise<StoredFavoriteWorkshopRecord>;
    deleteFavoriteWorkshop(userId: string, workspaceContextKey: string, workshopId: string): Promise<boolean>;
}
export declare abstract class CachedMeFavoritesRepository implements MeFavoritesRepository {
    #private;
    init(): Promise<void>;
    listFavoriteWorkshops(userId: string, workspaceContextKey: string): {
        favoriteId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        workshopId: string;
        createdAt: string;
        updatedAt: string;
    }[];
    getFavoriteWorkshop(userId: string, workspaceContextKey: string, workshopId: string): {
        favoriteId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        workshopId: string;
        createdAt: string;
        updatedAt: string;
    } | null;
    saveFavoriteWorkshop(record: StoredFavoriteWorkshopRecord): Promise<{
        favoriteId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        workshopId: string;
        createdAt: string;
        updatedAt: string;
    }>;
    deleteFavoriteWorkshop(userId: string, workspaceContextKey: string, workshopId: string): Promise<boolean>;
    protected replaceCachedFavorite(record: StoredFavoriteWorkshopRecord): void;
    protected removeCachedFavorite(userId: string, workspaceContextKey: string, workshopId: string): void;
    protected updateState(mutator: (state: MeFavoritesState) => MeFavoritesState): Promise<void>;
    protected abstract loadState(): Promise<MeFavoritesState>;
    protected abstract writeState(state: MeFavoritesState): Promise<void>;
}
export interface PostgresMeFavoritesRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresMeFavoritesRepository extends CachedMeFavoritesRepository {
    #private;
    constructor(options: PostgresMeFavoritesRepositoryOptions);
    protected loadState(): Promise<{
        workshopFavorites: {
            favoriteId: string;
            userId: string;
            workspaceId: string;
            workspaceContextKey: string;
            workshopId: string;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    saveFavoriteWorkshop(record: StoredFavoriteWorkshopRecord): Promise<{
        favoriteId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        workshopId: string;
        createdAt: string;
        updatedAt: string;
    }>;
    deleteFavoriteWorkshop(userId: string, workspaceContextKey: string, workshopId: string): Promise<boolean>;
    protected writeState(state: MeFavoritesState): Promise<void>;
}
//# sourceMappingURL=me-favorites-repository.d.ts.map