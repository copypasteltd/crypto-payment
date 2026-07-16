import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPostgresDatabaseManager,
  type DatabaseMigrationStatus,
  type PostgresDatabaseClient,
  type RunDatabaseMigrationsResult,
} from "@lingban/db";
import type { Pool } from "pg";
import { getApiRuntimeConfig } from "./runtime.js";

function needsDatabase() {
  const config = getApiRuntimeConfig();
  return (
    config.catalogStore === "postgres" ||
    config.workshopCatalogStore === "postgres" ||
    config.creatorStore === "postgres" ||
    config.runsStore === "postgres" ||
    config.batchRunsStore === "postgres" ||
    config.runEventsStore === "postgres" ||
    config.internalCallbacksStore === "postgres" ||
    config.authStore === "postgres" ||
    config.uploadsStore === "postgres" ||
    config.runFilesStore === "postgres" ||
    config.bridgeRegistryStore === "postgres" ||
    config.credentialsStore === "postgres" ||
    config.mcpStore === "postgres" ||
    config.quotaStore === "postgres" ||
    config.billingStore === "postgres" ||
    config.notificationsStore === "postgres" ||
    config.favoritesStore === "postgres" ||
    config.recentStore === "postgres" ||
    config.searchStore === "postgres" ||
    config.sessionArchivesStore === "postgres"
  );
}

function resolveMigrationsDirectory() {
  return path.resolve(fileURLToPath(new URL("../../migrations/", import.meta.url)));
}

const apiDatabaseManager = createPostgresDatabaseManager({
  isEnabled: needsDatabase,
  getDatabaseUrl: () => getApiRuntimeConfig().databaseUrl,
  resolveMigrationsDirectory,
  poolConfig: {
    max: 10,
  },
});

export type ApiDatabaseMigrationStatus = DatabaseMigrationStatus;
export type RunApiDatabaseMigrationsResult = RunDatabaseMigrationsResult;

export function isApiDatabaseEnabled() {
  return apiDatabaseManager.isEnabled();
}

export function getApiDatabasePool() {
  return apiDatabaseManager.getPool();
}

export function withApiDatabaseClient<T>(fn: (client: PostgresDatabaseClient) => Promise<T>) {
  return ensureApiDatabaseReady().then(() => apiDatabaseManager.withClient(fn));
}

export function withApiDatabaseTransaction<T>(fn: (client: PostgresDatabaseClient) => Promise<T>) {
  return ensureApiDatabaseReady().then(() => apiDatabaseManager.withTransaction(fn));
}

export function getApiDatabaseMigrationStatus(): Promise<ApiDatabaseMigrationStatus> {
  return apiDatabaseManager.getMigrationStatus();
}

export function runApiDatabaseMigrations(options: {
  dryRun?: boolean;
} = {}): Promise<RunApiDatabaseMigrationsResult> {
  return apiDatabaseManager.runMigrations(options);
}

export function ensureApiDatabaseReady() {
  return apiDatabaseManager.ensureReady();
}

export function probeApiDatabaseReadiness() {
  return apiDatabaseManager.probeReadiness();
}

export function resetApiDatabaseForTests() {
  return apiDatabaseManager.resetForTests();
}

export function closeApiDatabaseConnection() {
  return apiDatabaseManager.resetConnectionState();
}

export function setApiDatabasePoolFactoryForTests(factory: (() => Pool) | null) {
  apiDatabaseManager.setPoolFactoryForTests(factory);
}

export async function resetApiDatabaseSchema(options: {
  requireEnvGuard?: boolean;
  reapplyMigrations?: boolean;
} = {}) {
  if (!isApiDatabaseEnabled()) {
    return {
      enabled: false,
      reset: false,
      migrated: null,
    };
  }

  if (options.requireEnvGuard !== false && process.env.LINGBAN_ALLOW_DB_RESET !== "1") {
    throw new Error("Database reset requires LINGBAN_ALLOW_DB_RESET=1");
  }

  const pool = getApiDatabasePool();
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await apiDatabaseManager.resetConnectionState();

  const migrated =
    options.reapplyMigrations === false ? null : await apiDatabaseManager.runMigrations();

  return {
    enabled: true,
    reset: true,
    migrated,
  };
}
