import {
  isoDatetimeSchema,
  workspaceContextKeySchema,
  workspaceIdSchema,
  workshopIdSchema,
} from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

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

export type StoredFavoriteWorkshopRecord = z.infer<typeof storedFavoriteWorkshopRecordSchema>;
export type MeFavoritesState = z.infer<typeof meFavoritesStateSchema>;

export interface MeFavoritesRepository {
  init(): Promise<void>;
  listFavoriteWorkshops(userId: string, workspaceContextKey: string): StoredFavoriteWorkshopRecord[];
  getFavoriteWorkshop(
    userId: string,
    workspaceContextKey: string,
    workshopId: string
  ): StoredFavoriteWorkshopRecord | null;
  saveFavoriteWorkshop(record: StoredFavoriteWorkshopRecord): Promise<StoredFavoriteWorkshopRecord>;
  deleteFavoriteWorkshop(
    userId: string,
    workspaceContextKey: string,
    workshopId: string
  ): Promise<boolean>;
}

function favoriteKey(record: Pick<StoredFavoriteWorkshopRecord, "userId" | "workspaceContextKey" | "workshopId">) {
  return `${record.userId}:${record.workspaceContextKey}:${record.workshopId}`;
}

function replaceByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
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

export abstract class CachedMeFavoritesRepository implements MeFavoritesRepository {
  #initialized = false;
  #state: MeFavoritesState = meFavoritesStateSchema.parse({
    workshopFavorites: [],
  });

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = meFavoritesStateSchema.parse(await this.loadState());
    this.#initialized = true;
  }

  listFavoriteWorkshops(userId: string, workspaceContextKey: string) {
    return this.#state.workshopFavorites
      .filter(
        (item) => item.userId === userId && item.workspaceContextKey === workspaceContextKey
      )
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.workshopId.localeCompare(right.workshopId)
      );
  }

  getFavoriteWorkshop(userId: string, workspaceContextKey: string, workshopId: string) {
    return (
      this.#state.workshopFavorites.find(
        (item) =>
          item.userId === userId &&
          item.workspaceContextKey === workspaceContextKey &&
          item.workshopId === workshopId
      ) ?? null
    );
  }

  async saveFavoriteWorkshop(record: StoredFavoriteWorkshopRecord) {
    await this.updateState((state) => ({
      ...state,
      workshopFavorites: replaceByKey(state.workshopFavorites, record, favoriteKey),
    }));
    return record;
  }

  async deleteFavoriteWorkshop(userId: string, workspaceContextKey: string, workshopId: string) {
    let deleted = false;
    await this.updateState((state) => {
      const nextItems = state.workshopFavorites.filter((item) => {
        const matches =
          item.userId === userId &&
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

  protected replaceCachedFavorite(record: StoredFavoriteWorkshopRecord) {
    this.#state = meFavoritesStateSchema.parse({
      ...this.#state,
      workshopFavorites: replaceByKey(this.#state.workshopFavorites, record, favoriteKey),
    });
  }

  protected removeCachedFavorite(
    userId: string,
    workspaceContextKey: string,
    workshopId: string
  ) {
    this.#state = meFavoritesStateSchema.parse({
      ...this.#state,
      workshopFavorites: this.#state.workshopFavorites.filter(
        (item) =>
          !(
            item.userId === userId &&
            item.workspaceContextKey === workspaceContextKey &&
            item.workshopId === workshopId
          )
      ),
    });
  }

  protected async updateState(mutator: (state: MeFavoritesState) => MeFavoritesState) {
    const nextState = meFavoritesStateSchema.parse(mutator(this.#state));
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected abstract loadState(): Promise<MeFavoritesState>;
  protected abstract writeState(state: MeFavoritesState): Promise<void>;
}

export interface PostgresMeFavoritesRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresMeFavoritesRepository extends CachedMeFavoritesRepository {
  #options: PostgresMeFavoritesRepositoryOptions;

  constructor(options: PostgresMeFavoritesRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ favorite_json: StoredFavoriteWorkshopRecord }>(
      "SELECT favorite_json FROM lingban_me_favorite_workshops ORDER BY updated_at DESC, workshop_id ASC"
    );

    return meFavoritesStateSchema.parse({
      workshopFavorites: result.rows.map((row) => row.favorite_json),
    });
  }

  async saveFavoriteWorkshop(record: StoredFavoriteWorkshopRecord) {
    const parsed = storedFavoriteWorkshopRecordSchema.parse(record);
    await this.init();
    this.replaceCachedFavorite(parsed);

    const queryable = await this.#getQueryable();
    await queryable.query(
      `
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
      `,
      [
        parsed.favoriteId,
        parsed.userId,
        parsed.workspaceId,
        parsed.workspaceContextKey,
        parsed.workshopId,
        parsed.createdAt,
        parsed.updatedAt,
        JSON.stringify(parsed),
      ]
    );

    return parsed;
  }

  async deleteFavoriteWorkshop(userId: string, workspaceContextKey: string, workshopId: string) {
    await this.init();
    this.removeCachedFavorite(userId, workspaceContextKey, workshopId);

    const queryable = await this.#getQueryable();
    const result = await queryable.query(
      `
      DELETE FROM lingban_me_favorite_workshops
      WHERE user_id = $1 AND workspace_context_key = $2 AND workshop_id = $3
      `,
      [userId, workspaceContextKey, workshopId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  protected async writeState(state: MeFavoritesState) {
    const parsed = meFavoritesStateSchema.parse(state);
    await this.#options.withTransaction(async (queryable) => {
      await queryable.query("DELETE FROM lingban_me_favorite_workshops");

      for (const record of parsed.workshopFavorites) {
        await queryable.query(
          `
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
          `,
          [
            record.favoriteId,
            record.userId,
            record.workspaceId,
            record.workspaceContextKey,
            record.workshopId,
            record.createdAt,
            record.updatedAt,
            JSON.stringify(record),
          ]
        );
      }
    });
  }
}
