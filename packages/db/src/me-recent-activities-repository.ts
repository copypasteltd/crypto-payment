import {
  entrySurfaceSchema,
  isoDatetimeSchema,
  runIdSchema,
  serviceIdSchema,
  workspaceContextKeySchema,
  workspaceIdSchema,
  workshopIdSchema,
} from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export const storedRecentActivityResourceTypeSchema = z.enum(["workshop", "service", "run"]);
export const storedRecentActivityInteractionSchema = z.enum(["open", "launch", "resume"]);

export const storedRecentActivityRecordSchema = z.object({
  activityId: z.string().trim().min(1).max(240),
  userId: z.string().trim().min(1).max(120),
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  resourceType: storedRecentActivityResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(240),
  interaction: storedRecentActivityInteractionSchema,
  sourceSurface: entrySurfaceSchema,
  workshopId: workshopIdSchema.nullable(),
  serviceId: serviceIdSchema.nullable(),
  runId: runIdSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const meRecentActivitiesStateSchema = z.object({
  recentActivities: z.array(storedRecentActivityRecordSchema),
});

export type StoredRecentActivityResourceType = z.infer<typeof storedRecentActivityResourceTypeSchema>;
export type StoredRecentActivityInteraction = z.infer<typeof storedRecentActivityInteractionSchema>;
export type StoredRecentActivityRecord = z.infer<typeof storedRecentActivityRecordSchema>;
export type MeRecentActivitiesState = z.infer<typeof meRecentActivitiesStateSchema>;

export interface MeRecentActivitiesRepository {
  init(): Promise<void>;
  listRecentActivities(
    userId: string,
    workspaceContextKey: string,
    resourceTypes?: StoredRecentActivityResourceType[]
  ): StoredRecentActivityRecord[];
  saveRecentActivity(record: StoredRecentActivityRecord): Promise<StoredRecentActivityRecord>;
}

function createEmptyMeRecentActivitiesState(): MeRecentActivitiesState {
  return meRecentActivitiesStateSchema.parse({
    recentActivities: [],
  });
}

function recentActivityKey(
  record: Pick<
    StoredRecentActivityRecord,
    "userId" | "workspaceContextKey" | "resourceType" | "resourceId"
  >
) {
  return `${record.userId}:${record.workspaceContextKey}:${record.resourceType}:${record.resourceId}`;
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

export abstract class CachedMeRecentActivitiesRepository implements MeRecentActivitiesRepository {
  #initialized = false;
  #state: MeRecentActivitiesState = createEmptyMeRecentActivitiesState();

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = meRecentActivitiesStateSchema.parse(await this.loadState());
    this.#initialized = true;
  }

  listRecentActivities(
    userId: string,
    workspaceContextKey: string,
    resourceTypes?: StoredRecentActivityResourceType[]
  ) {
    const resourceTypeSet = resourceTypes ? new Set(resourceTypes) : null;
    return this.#state.recentActivities
      .filter(
        (item) =>
          item.userId === userId &&
          item.workspaceContextKey === workspaceContextKey &&
          (!resourceTypeSet || resourceTypeSet.has(item.resourceType))
      )
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.resourceType.localeCompare(right.resourceType) ||
          left.resourceId.localeCompare(right.resourceId)
      );
  }

  async saveRecentActivity(record: StoredRecentActivityRecord) {
    const parsed = storedRecentActivityRecordSchema.parse(record);
    await this.updateState((state) => ({
      ...state,
      recentActivities: replaceByKey(state.recentActivities, parsed, recentActivityKey),
    }));
    return parsed;
  }

  protected replaceCachedRecentActivity(record: StoredRecentActivityRecord) {
    this.#state = meRecentActivitiesStateSchema.parse({
      ...this.#state,
      recentActivities: replaceByKey(this.#state.recentActivities, record, recentActivityKey),
    });
  }

  protected async updateState(mutator: (state: MeRecentActivitiesState) => MeRecentActivitiesState) {
    const nextState = meRecentActivitiesStateSchema.parse(mutator(this.#state));
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected abstract loadState(): Promise<MeRecentActivitiesState>;
  protected abstract writeState(state: MeRecentActivitiesState): Promise<void>;
}

export interface PostgresMeRecentActivitiesRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresMeRecentActivitiesRepository extends CachedMeRecentActivitiesRepository {
  #options: PostgresMeRecentActivitiesRepositoryOptions;

  constructor(options: PostgresMeRecentActivitiesRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ activity_json: StoredRecentActivityRecord }>(
      "SELECT activity_json FROM lingban_me_recent_activities ORDER BY updated_at DESC, resource_type ASC, resource_id ASC"
    );

    return meRecentActivitiesStateSchema.parse({
      recentActivities: result.rows.map((row) => row.activity_json),
    });
  }

  async saveRecentActivity(record: StoredRecentActivityRecord) {
    const parsed = storedRecentActivityRecordSchema.parse(record);
    await this.init();
    this.replaceCachedRecentActivity(parsed);

    const queryable = await this.#getQueryable();
    await queryable.query(
      `
      INSERT INTO lingban_me_recent_activities (
        activity_id,
        user_id,
        workspace_id,
        workspace_context_key,
        resource_type,
        resource_id,
        interaction,
        source_surface,
        workshop_id,
        service_id,
        run_id,
        created_at,
        updated_at,
        activity_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      ON CONFLICT (user_id, workspace_context_key, resource_type, resource_id)
      DO UPDATE SET
        activity_id = EXCLUDED.activity_id,
        workspace_id = EXCLUDED.workspace_id,
        interaction = EXCLUDED.interaction,
        source_surface = EXCLUDED.source_surface,
        workshop_id = EXCLUDED.workshop_id,
        service_id = EXCLUDED.service_id,
        run_id = EXCLUDED.run_id,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        activity_json = EXCLUDED.activity_json
      `,
      [
        parsed.activityId,
        parsed.userId,
        parsed.workspaceId,
        parsed.workspaceContextKey,
        parsed.resourceType,
        parsed.resourceId,
        parsed.interaction,
        parsed.sourceSurface,
        parsed.workshopId,
        parsed.serviceId,
        parsed.runId,
        parsed.createdAt,
        parsed.updatedAt,
        JSON.stringify(parsed),
      ]
    );

    return parsed;
  }

  protected async writeState(state: MeRecentActivitiesState) {
    const parsed = meRecentActivitiesStateSchema.parse(state);

    await this.#options.withTransaction(async (queryable) => {
      await queryable.query("DELETE FROM lingban_me_recent_activities");

      for (const record of parsed.recentActivities) {
        await queryable.query(
          `
          INSERT INTO lingban_me_recent_activities (
            activity_id,
            user_id,
            workspace_id,
            workspace_context_key,
            resource_type,
            resource_id,
            interaction,
            source_surface,
            workshop_id,
            service_id,
            run_id,
            created_at,
            updated_at,
            activity_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
          `,
          [
            record.activityId,
            record.userId,
            record.workspaceId,
            record.workspaceContextKey,
            record.resourceType,
            record.resourceId,
            record.interaction,
            record.sourceSurface,
            record.workshopId,
            record.serviceId,
            record.runId,
            record.createdAt,
            record.updatedAt,
            JSON.stringify(record),
          ]
        );
      }
    });
  }
}
