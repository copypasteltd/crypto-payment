import type { DatabaseMigrationStatus, RunDatabaseMigrationsResult } from "./index.js";
type DatabaseCliManager = {
    getMigrationStatus(): Promise<DatabaseMigrationStatus>;
    runMigrations(options?: {
        dryRun?: boolean;
    }): Promise<RunDatabaseMigrationsResult>;
};
export type RunPostgresDatabaseCliOptions = {
    programName: string;
    manager: DatabaseCliManager;
    reset?: () => Promise<unknown>;
    seed?: () => Promise<unknown>;
    stdout?: Pick<typeof console, "log">;
};
export declare function runPostgresDatabaseCli(options: RunPostgresDatabaseCliOptions, argv?: string[]): Promise<void>;
export {};
//# sourceMappingURL=cli.d.ts.map