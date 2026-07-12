import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const storedRecentActivityResourceTypeSchema: z.ZodEnum<{
    run: "run";
    service: "service";
    workshop: "workshop";
}>;
export declare const storedRecentActivityInteractionSchema: z.ZodEnum<{
    open: "open";
    launch: "launch";
    resume: "resume";
}>;
export declare const storedRecentActivityRecordSchema: z.ZodObject<{
    activityId: z.ZodString;
    userId: z.ZodString;
    workspaceId: z.ZodString;
    workspaceContextKey: z.ZodString;
    resourceType: z.ZodEnum<{
        run: "run";
        service: "service";
        workshop: "workshop";
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
    workshopId: z.ZodNullable<z.ZodString>;
    serviceId: z.ZodNullable<z.ZodString>;
    runId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const meRecentActivitiesStateSchema: z.ZodObject<{
    recentActivities: z.ZodArray<z.ZodObject<{
        activityId: z.ZodString;
        userId: z.ZodString;
        workspaceId: z.ZodString;
        workspaceContextKey: z.ZodString;
        resourceType: z.ZodEnum<{
            run: "run";
            service: "service";
            workshop: "workshop";
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
        workshopId: z.ZodNullable<z.ZodString>;
        serviceId: z.ZodNullable<z.ZodString>;
        runId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StoredRecentActivityResourceType = z.infer<typeof storedRecentActivityResourceTypeSchema>;
export type StoredRecentActivityInteraction = z.infer<typeof storedRecentActivityInteractionSchema>;
export type StoredRecentActivityRecord = z.infer<typeof storedRecentActivityRecordSchema>;
export type MeRecentActivitiesState = z.infer<typeof meRecentActivitiesStateSchema>;
export interface MeRecentActivitiesRepository {
    init(): Promise<void>;
    listRecentActivities(userId: string, workspaceContextKey: string, resourceTypes?: StoredRecentActivityResourceType[]): StoredRecentActivityRecord[];
    saveRecentActivity(record: StoredRecentActivityRecord): Promise<StoredRecentActivityRecord>;
}
export declare abstract class CachedMeRecentActivitiesRepository implements MeRecentActivitiesRepository {
    #private;
    init(): Promise<void>;
    listRecentActivities(userId: string, workspaceContextKey: string, resourceTypes?: StoredRecentActivityResourceType[]): {
        activityId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        resourceType: "run" | "service" | "workshop";
        resourceId: string;
        interaction: "open" | "launch" | "resume";
        sourceSurface: "dashboard" | "h5" | "mini-program";
        workshopId: string | null;
        serviceId: string | null;
        runId: string | null;
        createdAt: string;
        updatedAt: string;
    }[];
    saveRecentActivity(record: StoredRecentActivityRecord): Promise<{
        activityId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        resourceType: "run" | "service" | "workshop";
        resourceId: string;
        interaction: "open" | "launch" | "resume";
        sourceSurface: "dashboard" | "h5" | "mini-program";
        workshopId: string | null;
        serviceId: string | null;
        runId: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    protected replaceCachedRecentActivity(record: StoredRecentActivityRecord): void;
    protected updateState(mutator: (state: MeRecentActivitiesState) => MeRecentActivitiesState): Promise<void>;
    protected abstract loadState(): Promise<MeRecentActivitiesState>;
    protected abstract writeState(state: MeRecentActivitiesState): Promise<void>;
}
export interface PostgresMeRecentActivitiesRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresMeRecentActivitiesRepository extends CachedMeRecentActivitiesRepository {
    #private;
    constructor(options: PostgresMeRecentActivitiesRepositoryOptions);
    protected loadState(): Promise<{
        recentActivities: {
            activityId: string;
            userId: string;
            workspaceId: string;
            workspaceContextKey: string;
            resourceType: "run" | "service" | "workshop";
            resourceId: string;
            interaction: "open" | "launch" | "resume";
            sourceSurface: "dashboard" | "h5" | "mini-program";
            workshopId: string | null;
            serviceId: string | null;
            runId: string | null;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    saveRecentActivity(record: StoredRecentActivityRecord): Promise<{
        activityId: string;
        userId: string;
        workspaceId: string;
        workspaceContextKey: string;
        resourceType: "run" | "service" | "workshop";
        resourceId: string;
        interaction: "open" | "launch" | "resume";
        sourceSurface: "dashboard" | "h5" | "mini-program";
        workshopId: string | null;
        serviceId: string | null;
        runId: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    protected writeState(state: MeRecentActivitiesState): Promise<void>;
}
//# sourceMappingURL=me-recent-activities-repository.d.ts.map