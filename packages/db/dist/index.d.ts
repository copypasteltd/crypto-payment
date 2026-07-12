import { Pool, type PoolClient, type PoolConfig } from "pg";
export * from "./runs.js";
export * from "./postgres-types.js";
export * from "./bridge-repository.js";
export * from "./billing-repository.js";
export * from "./auth-repository.js";
export * from "./credentials-repository.js";
export * from "./creator-repository.js";
export * from "./quota-repository.js";
export * from "./mcp-repository.js";
export * from "./workshop-catalog-repository.js";
export * from "./runs-repository.js";
export * from "./run-event-bus.js";
export * from "./run-files-repository.js";
export * from "./run-query-repository.js";
export * from "./batch-runs-repository.js";
export * from "./me-recent-activities-repository.js";
export * from "./me-favorites-repository.js";
export * from "./notifications-repository.js";
export * from "./search-repository.js";
export * from "./session-archives-repository.js";
export * from "./uploads-repository.js";
export * from "./cli.js";
export type DiskMigration = {
    version: string;
    filePath: string;
    statements: string[];
};
export type AppliedMigrationRow = {
    version: string;
    appliedAt: string;
};
export type DatabaseMigrationStatus = {
    enabled: boolean;
    directory: string;
    migrations: Array<{
        version: string;
        filePath: string;
        statementsCount: number;
        applied: boolean;
        appliedAt: string | null;
    }>;
    appliedCount: number;
    pendingCount: number;
};
export type RunDatabaseMigrationsResult = DatabaseMigrationStatus & {
    newlyAppliedVersions: string[];
    newlyAppliedCount: number;
};
export type CreatePostgresDatabaseManagerOptions = {
    isEnabled: () => boolean;
    getDatabaseUrl: () => string | null | undefined;
    resolveMigrationsDirectory: () => string;
    migrationsTableName?: string;
    poolConfig?: Omit<PoolConfig, "connectionString">;
};
export type PostgresDatabaseClient = PoolClient;
export type PostgresTransactionClient = Pick<PoolClient, "query">;
export declare const DEFAULT_SCHEMA_MIGRATIONS_TABLE = "lingban_schema_migrations";
export declare function splitSqlStatements(contents: string): string[];
export declare function compareMigrationVersions(left: string, right: string): number;
export declare function loadSqlDirectoryMigrations(directory: string): Promise<DiskMigration[]>;
export declare function buildMigrationStatus(input: {
    enabled: boolean;
    directory: string;
    migrations: DiskMigration[];
    applied: AppliedMigrationRow[];
}): DatabaseMigrationStatus;
export declare function runPostgresTransaction<T, TClient extends PostgresTransactionClient>(client: TClient, fn: (client: TClient) => Promise<T>): Promise<T>;
export declare function createPostgresDatabaseManager(options: CreatePostgresDatabaseManagerOptions): {
    isEnabled: () => boolean;
    getPool: () => Pool;
    withClient: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
    withTransaction: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
    loadMigrations: () => Promise<DiskMigration[]>;
    getMigrationStatus: () => Promise<DatabaseMigrationStatus>;
    runMigrations: (runOptions?: {
        dryRun?: boolean;
    }) => Promise<RunDatabaseMigrationsResult>;
    ensureReady: () => Promise<void>;
    probeReadiness: () => Promise<{
        enabled: boolean;
        ready: boolean;
        detail: null;
    } | {
        enabled: boolean;
        ready: boolean;
        detail: string;
    }>;
    resetConnectionState: () => Promise<void>;
    resetForTests: () => Promise<void>;
    setPoolFactoryForTests: (factory: (() => Pool) | null) => void;
};
//# sourceMappingURL=index.d.ts.map