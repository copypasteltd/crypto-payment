import { isoDatetimeSchema, workspaceContextKeySchema, workspaceIdSchema, workshopIdSchema, } from "@lingban/contracts";
import { z } from "zod";
export const storedFavoriteWorkshopRecordSchema = z.object({
    favoriteId: z.string().trim().min(1).max(240),
    userId: z.string().trim().min(1).max(120),
    workspaceId: workspaceIdSchema,
    workspaceContextKey: workspaceContextKeySchema,
    workshopId: workshopIdSchema,
    createdAt: isoDatetimeSchema,
    updatedAt: isoDatetimeSchema,
});
export const meFavoritesStateSchema = z.object({
    workshopFavorites: z.array(storedFavoriteWorkshopRecordSchema),
});
export const favoriteWorkshopParamsSchema = z.object({
    workshopId: workshopIdSchema,
});
function favoriteKey(record) {
    return `${record.userId}:${record.workspaceContextKey}:${record.workshopId}`;
}
function replaceByKey(items, nextItem, getKey) {
    const nextItems = [...items];
    const key = getKey(nextItem);
    const existingIndex = nextItems.findIndex((item) => getKey(item) === key);
    if (existingIndex >= 0) {
        nextItems[existingIndex] = nextItem;
        return nextItems;
    }
    nextItems.push(nextItem);
    return nextItems;
}
export class CachedMeFavoritesRepository {
    #initialized = false;
    #state = meFavoritesStateSchema.parse({
        workshopFavorites: [],
    });
    async init() {
        if (this.#initialized) {
            return;
        }
        this.#state = meFavoritesStateSchema.parse(await this.loadState());
        this.#initialized = true;
    }
    listFavoriteWorkshops(userId, workspaceContextKey) {
        return this.#state.workshopFavorites
            .filter((item) => item.userId === userId && item.workspaceContextKey === workspaceContextKey)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) ||
            left.workshopId.localeCompare(right.workshopId));
    }
    getFavoriteWorkshop(userId, workspaceContextKey, workshopId) {
        return (this.#state.workshopFavorites.find((item) => item.userId === userId &&
            item.workspaceContextKey === workspaceContextKey &&
            item.workshopId === workshopId) ?? null);
    }
    async saveFavoriteWorkshop(record) {
        await this.updateState((state) => ({
            ...state,
            workshopFavorites: replaceByKey(state.workshopFavorites, record, favoriteKey),
        }));
        return record;
    }
    async deleteFavoriteWorkshop(userId, workspaceContextKey, workshopId) {
        let deleted = false;
        await this.updateState((state) => {
            const nextItems = state.workshopFavorites.filter((item) => {
                const matches = item.userId === userId &&
                    item.workspaceContextKey === workspaceContextKey &&
                    item.workshopId === workshopId;
                if (matches) {
                    deleted = true;
                    return false;
                }
                return true;
            });
            return {
                ...state,
                workshopFavorites: nextItems,
            };
        });
        return deleted;
    }
    replaceCachedFavorite(record) {
        this.#state = meFavoritesStateSchema.parse({
            ...this.#state,
            workshopFavorites: replaceByKey(this.#state.workshopFavorites, record, favoriteKey),
        });
    }
    removeCachedFavorite(userId, workspaceContextKey, workshopId) {
        this.#state = meFavoritesStateSchema.parse({
            ...this.#state,
            workshopFavorites: this.#state.workshopFavorites.filter((item) => !(item.userId === userId &&
                item.workspaceContextKey === workspaceContextKey &&
                item.workshopId === workshopId)),
        });
    }
    async updateState(mutator) {
        const nextState = meFavoritesStateSchema.parse(mutator(this.#state));
        this.#state = nextState;
        await this.writeState(nextState);
    }
}
export class PostgresMeFavoritesRepository extends CachedMeFavoritesRepository {
    #options;
    constructor(options) {
        super();
        this.#options = options;
    }
    async #getQueryable() {
        await this.#options.ensureReady?.();
        return this.#options.getQueryable();
    }
    async loadState() {
        const queryable = await this.#getQueryable();
        const result = await queryable.query("SELECT favorite_json FROM lingban_me_favorite_workshops ORDER BY updated_at DESC, workshop_id ASC");
        return meFavoritesStateSchema.parse({
            workshopFavorites: result.rows.map((row) => row.favorite_json),
        });
    }
    async saveFavoriteWorkshop(record) {
        const parsed = storedFavoriteWorkshopRecordSchema.parse(record);
        await this.init();
        this.replaceCachedFavorite(parsed);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_me_favorite_workshops (
        favorite_id,
        user_id,
        workspace_id,
        workspace_context_key,
        workshop_id,
        created_at,
        updated_at,
        favorite_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (user_id, workspace_context_key, workshop_id)
      DO UPDATE SET
        favorite_id = EXCLUDED.favorite_id,
        workspace_id = EXCLUDED.workspace_id,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        favorite_json = EXCLUDED.favorite_json
      `, [
            parsed.favoriteId,
            parsed.userId,
            parsed.workspaceId,
            parsed.workspaceContextKey,
            parsed.workshopId,
            parsed.createdAt,
            parsed.updatedAt,
            JSON.stringify(parsed),
        ]);
        return parsed;
    }
    async deleteFavoriteWorkshop(userId, workspaceContextKey, workshopId) {
        await this.init();
        this.removeCachedFavorite(userId, workspaceContextKey, workshopId);
        const queryable = await this.#getQueryable();
        const result = await queryable.query(`
      DELETE FROM lingban_me_favorite_workshops
      WHERE user_id = $1 AND workspace_context_key = $2 AND workshop_id = $3
      `, [userId, workspaceContextKey, workshopId]);
        return (result.rowCount ?? 0) > 0;
    }
    async writeState(state) {
        const parsed = meFavoritesStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_me_favorite_workshops");
            for (const record of parsed.workshopFavorites) {
                await queryable.query(`
          INSERT INTO lingban_me_favorite_workshops (
            favorite_id,
            user_id,
            workspace_id,
            workspace_context_key,
            workshop_id,
            created_at,
            updated_at,
            favorite_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `, [
                    record.favoriteId,
                    record.userId,
                    record.workspaceId,
                    record.workspaceContextKey,
                    record.workshopId,
                    record.createdAt,
                    record.updatedAt,
                    JSON.stringify(record),
                ]);
            }
        });
    }
}
//# sourceMappingURL=me-favorites-repository.js.map