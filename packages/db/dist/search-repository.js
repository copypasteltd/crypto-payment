import { entrySurfaceSchema, isoDatetimeSchema, searchResourceTypeSchema, workspaceContextKeySchema, workspaceIdSchema, } from "@lingban/contracts";
import { z } from "zod";
export const storedSearchHistoryRecordSchema = z.object({
    historyId: z.string().trim().min(1).max(240),
    userId: z.string().trim().min(1).max(120),
    workspaceId: workspaceIdSchema,
    workspaceContextKey: workspaceContextKeySchema,
    query: z.string().trim().min(1).max(200),
    normalizedQuery: z.string().trim().min(1).max(200),
    resourceTypes: z.array(searchResourceTypeSchema).min(1).max(4),
    createdAt: isoDatetimeSchema,
    updatedAt: isoDatetimeSchema,
});
export const storedSearchClickEventRecordSchema = z.object({
    eventId: z.string().trim().min(1).max(240),
    userId: z.string().trim().min(1).max(120),
    workspaceId: workspaceIdSchema,
    workspaceContextKey: workspaceContextKeySchema,
    query: z.string().trim().min(1).max(200),
    normalizedQuery: z.string().trim().min(1).max(200),
    documentId: z.string().trim().min(1).max(240),
    resourceType: searchResourceTypeSchema,
    resourceId: z.string().trim().min(1).max(240),
    rank: z.number().int().min(0),
    sourceSurface: entrySurfaceSchema,
    createdAt: isoDatetimeSchema,
    updatedAt: isoDatetimeSchema,
});
export const searchStateSchema = z.object({
    historyEntries: z.array(storedSearchHistoryRecordSchema),
    clickEvents: z.array(storedSearchClickEventRecordSchema),
});
export const MAX_HISTORY_ENTRIES_PER_CONTEXT = 50;
export const MAX_CLICK_EVENTS_PER_CONTEXT = 200;
function createEmptySearchState() {
    return searchStateSchema.parse({
        historyEntries: [],
        clickEvents: [],
    });
}
function historyKey(record) {
    return `${record.userId}:${record.workspaceContextKey}:${record.normalizedQuery}`;
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
function sortHistoryRecords(left, right) {
    return right.updatedAt.localeCompare(left.updatedAt) || left.query.localeCompare(right.query);
}
function sortClickEvents(left, right) {
    return (right.updatedAt.localeCompare(left.updatedAt) ||
        left.rank - right.rank ||
        left.eventId.localeCompare(right.eventId));
}
function pruneHistoryEntries(entries) {
    const grouped = new Map();
    for (const entry of entries) {
        const key = `${entry.userId}:${entry.workspaceContextKey}`;
        const bucket = grouped.get(key) ?? [];
        bucket.push(entry);
        grouped.set(key, bucket);
    }
    return [...grouped.values()].flatMap((bucket) => bucket.sort(sortHistoryRecords).slice(0, MAX_HISTORY_ENTRIES_PER_CONTEXT));
}
function pruneClickEvents(entries) {
    const grouped = new Map();
    for (const entry of entries) {
        const key = `${entry.userId}:${entry.workspaceContextKey}`;
        const bucket = grouped.get(key) ?? [];
        bucket.push(entry);
        grouped.set(key, bucket);
    }
    return [...grouped.values()].flatMap((bucket) => bucket.sort(sortClickEvents).slice(0, MAX_CLICK_EVENTS_PER_CONTEXT));
}
async function deleteIdsNotIn(queryable, tableName, idColumn, userId, workspaceContextKey, retainedIds) {
    if (retainedIds.length === 0) {
        await queryable.query(`
      DELETE FROM ${tableName}
      WHERE user_id = $1 AND workspace_context_key = $2
      `, [userId, workspaceContextKey]);
        return;
    }
    const placeholders = retainedIds.map((_, index) => `$${index + 3}`).join(", ");
    await queryable.query(`
    DELETE FROM ${tableName}
    WHERE user_id = $1
      AND workspace_context_key = $2
      AND ${idColumn} NOT IN (${placeholders})
    `, [userId, workspaceContextKey, ...retainedIds]);
}
export class CachedSearchRepository {
    #initialized = false;
    #state = createEmptySearchState();
    async init() {
        if (this.#initialized) {
            return;
        }
        this.#state = searchStateSchema.parse(await this.loadState());
        this.#initialized = true;
    }
    listSearchHistory(userId, workspaceContextKey) {
        return this.#state.historyEntries
            .filter((entry) => entry.userId === userId && entry.workspaceContextKey === workspaceContextKey)
            .sort(sortHistoryRecords);
    }
    getSearchHistory(userId, workspaceContextKey, normalizedQuery) {
        return (this.#state.historyEntries.find((entry) => entry.userId === userId &&
            entry.workspaceContextKey === workspaceContextKey &&
            entry.normalizedQuery === normalizedQuery) ?? null);
    }
    async saveSearchHistory(record) {
        const parsed = storedSearchHistoryRecordSchema.parse(record);
        await this.updateState((state) => ({
            ...state,
            historyEntries: pruneHistoryEntries(replaceByKey(state.historyEntries, parsed, historyKey)),
        }));
        return parsed;
    }
    listSearchClickEvents(userId, workspaceContextKey, normalizedQuery, limit = MAX_CLICK_EVENTS_PER_CONTEXT) {
        return this.#state.clickEvents
            .filter((entry) => entry.userId === userId &&
            entry.workspaceContextKey === workspaceContextKey &&
            (normalizedQuery == null || entry.normalizedQuery === normalizedQuery))
            .sort(sortClickEvents)
            .slice(0, limit);
    }
    async appendSearchClickEvent(record) {
        const parsed = storedSearchClickEventRecordSchema.parse(record);
        await this.updateState((state) => ({
            ...state,
            clickEvents: pruneClickEvents([parsed, ...state.clickEvents]),
        }));
        return parsed;
    }
    setState(state) {
        this.#state = searchStateSchema.parse(state);
    }
    replaceCachedSearchHistory(record) {
        this.setState({
            ...this.#state,
            historyEntries: pruneHistoryEntries(replaceByKey(this.#state.historyEntries, record, historyKey)),
        });
    }
    appendCachedSearchClickEvent(record) {
        this.setState({
            ...this.#state,
            clickEvents: pruneClickEvents([record, ...this.#state.clickEvents]),
        });
    }
    async updateState(mutator) {
        const nextState = searchStateSchema.parse(mutator(this.#state));
        this.#state = nextState;
        await this.writeState(nextState);
    }
}
export class PostgresSearchRepository extends CachedSearchRepository {
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
        const [historyResult, clickResult] = await Promise.all([
            queryable.query("SELECT history_json FROM lingban_search_history_entries ORDER BY updated_at DESC, query ASC"),
            queryable.query("SELECT event_json FROM lingban_search_click_events ORDER BY occurred_at DESC, rank ASC, event_id ASC"),
        ]);
        return searchStateSchema.parse({
            historyEntries: historyResult.rows.map((row) => row.history_json),
            clickEvents: clickResult.rows.map((row) => row.event_json),
        });
    }
    async saveSearchHistory(record) {
        const parsed = storedSearchHistoryRecordSchema.parse(record);
        await this.init();
        this.replaceCachedSearchHistory(parsed);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_search_history_entries (
        history_id,
        user_id,
        workspace_id,
        workspace_context_key,
        normalized_query,
        query,
        resource_types_json,
        created_at,
        updated_at,
        history_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb)
      ON CONFLICT (user_id, workspace_context_key, normalized_query)
      DO UPDATE SET
        history_id = EXCLUDED.history_id,
        workspace_id = EXCLUDED.workspace_id,
        query = EXCLUDED.query,
        resource_types_json = EXCLUDED.resource_types_json,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        history_json = EXCLUDED.history_json
      `, [
            parsed.historyId,
            parsed.userId,
            parsed.workspaceId,
            parsed.workspaceContextKey,
            parsed.normalizedQuery,
            parsed.query,
            JSON.stringify(parsed.resourceTypes),
            parsed.createdAt,
            parsed.updatedAt,
            JSON.stringify(parsed),
        ]);
        const retainedIds = this.listSearchHistory(parsed.userId, parsed.workspaceContextKey).map((item) => item.historyId);
        await deleteIdsNotIn(queryable, "lingban_search_history_entries", "history_id", parsed.userId, parsed.workspaceContextKey, retainedIds);
        return parsed;
    }
    async appendSearchClickEvent(record) {
        const parsed = storedSearchClickEventRecordSchema.parse(record);
        await this.init();
        this.appendCachedSearchClickEvent(parsed);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_search_click_events (
        event_id,
        user_id,
        workspace_id,
        workspace_context_key,
        normalized_query,
        query,
        document_id,
        resource_type,
        resource_id,
        rank,
        source_surface,
        occurred_at,
        event_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      `, [
            parsed.eventId,
            parsed.userId,
            parsed.workspaceId,
            parsed.workspaceContextKey,
            parsed.normalizedQuery,
            parsed.query,
            parsed.documentId,
            parsed.resourceType,
            parsed.resourceId,
            parsed.rank,
            parsed.sourceSurface,
            parsed.updatedAt,
            JSON.stringify(parsed),
        ]);
        const retainedIds = this.listSearchClickEvents(parsed.userId, parsed.workspaceContextKey).map((item) => item.eventId);
        await deleteIdsNotIn(queryable, "lingban_search_click_events", "event_id", parsed.userId, parsed.workspaceContextKey, retainedIds);
        return parsed;
    }
    async writeState(state) {
        const parsed = searchStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_search_history_entries");
            await queryable.query("DELETE FROM lingban_search_click_events");
            for (const record of parsed.historyEntries) {
                await queryable.query(`
          INSERT INTO lingban_search_history_entries (
            history_id,
            user_id,
            workspace_id,
            workspace_context_key,
            normalized_query,
            query,
            resource_types_json,
            created_at,
            updated_at,
            history_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb)
          `, [
                    record.historyId,
                    record.userId,
                    record.workspaceId,
                    record.workspaceContextKey,
                    record.normalizedQuery,
                    record.query,
                    JSON.stringify(record.resourceTypes),
                    record.createdAt,
                    record.updatedAt,
                    JSON.stringify(record),
                ]);
            }
            for (const record of parsed.clickEvents) {
                await queryable.query(`
          INSERT INTO lingban_search_click_events (
            event_id,
            user_id,
            workspace_id,
            workspace_context_key,
            normalized_query,
            query,
            document_id,
            resource_type,
            resource_id,
            rank,
            source_surface,
            occurred_at,
            event_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
          `, [
                    record.eventId,
                    record.userId,
                    record.workspaceId,
                    record.workspaceContextKey,
                    record.normalizedQuery,
                    record.query,
                    record.documentId,
                    record.resourceType,
                    record.resourceId,
                    record.rank,
                    record.sourceSurface,
                    record.updatedAt,
                    JSON.stringify(record),
                ]);
            }
        });
    }
}
//# sourceMappingURL=search-repository.js.map