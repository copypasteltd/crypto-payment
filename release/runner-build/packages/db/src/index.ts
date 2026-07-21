import { readdir, readFile } from "node:fs/promises";
import { Pool, type PoolClient, type PoolConfig } from "pg";
export * from "./runs.js";
export * from "./agent-runtime-repository.js";
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
export * from "./session-capture-repository.js";
export * from "./session-projects-repository.js";
export * from "./task-versions-repository.js";
export * from "./session-asset-repository.js";
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

export const DEFAULT_SCHEMA_MIGRATIONS_TABLE = "lingban_schema_migrations";

export function splitSqlStatements(contents: string) {
  const statements: string[] = [];
  let current = "";
  let quote: "single" | "double" | "line-comment" | "block-comment" | null = null;
  let dollarTag: string | null = null;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index]!;
    const nextCharacter = contents[index + 1] ?? "";

    if (quote === "line-comment") {
      current += character;
      if (character === "\n") quote = null;
      continue;
    }

    if (quote === "block-comment") {
      current += character;
      if (character === "*" && nextCharacter === "/") {
        current += nextCharacter;
        index += 1;
        quote = null;
      }
      continue;
    }

    if (dollarTag) {
      if (contents.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += character;
      }
      continue;
    }

    if (quote === "single") {
      current += character;
      if (character === "'" && nextCharacter === "'") {
        current += nextCharacter;
        index += 1;
      } else if (character === "'") {
        quote = null;
      }
      continue;
    }

    if (quote === "double") {
      current += character;
      if (character === '"' && nextCharacter === '"') {
        current += nextCharacter;
        index += 1;
      } else if (character === '"') {
        quote = null;
      }
      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      current += character + nextCharacter;
      index += 1;
      quote = "line-comment";
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      current += character + nextCharacter;
      index += 1;
      quote = "block-comment";
      continue;
    }
    if (character === "'") {
      current += character;
      quote = "single";
      continue;
    }
    if (character === '"') {
      current += character;
      quote = "double";
      continue;
    }
    if (character === "$") {
      const match = contents.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length - 1;
        continue;
      }
    }
    if (character === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += character;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

export function compareMigrationVersions(left: string, right: string) {
  return left.localeCompare(right);
}

function assertSafeIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return identifier;
}

export async function loadSqlDirectoryMigrations(directory: string): Promise<DiskMigration[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort(compareMigrationVersions);

  if (files.length === 0) {
    throw new Error(`No database migrations found under ${directory}`);
  }

  const seenVersions = new Set<string>();
  const migrations: DiskMigration[] = [];

  for (const fileName of files) {
    const version = fileName.slice(0, -".sql".length);
    if (seenVersions.has(version)) {
      throw new Error(`Duplicate database migration version: ${version}`);
    }

    seenVersions.add(version);
    const filePath = `${directory}/${fileName}`.replace(/\\/g, "/");
    const contents = await readFile(filePath, "utf8");
    const statements = splitSqlStatements(contents);

    if (statements.length === 0) {
      throw new Error(`Database migration ${fileName} does not contain executable SQL`);
    }

    migrations.push({
      version,
      filePath,
      statements,
    });
  }

  return migrations;
}

export function buildMigrationStatus(input: {
  enabled: boolean;
  directory: string;
  migrations: DiskMigration[];
  applied: AppliedMigrationRow[];
}): DatabaseMigrationStatus {
  const appliedByVersion = new Map(input.applied.map((item) => [item.version, item.appliedAt]));
  const migrations = input.migrations.map((migration) => ({
    version: migration.version,
    filePath: migration.filePath,
    statementsCount: migration.statements.length,
    applied: appliedByVersion.has(migration.version),
    appliedAt: appliedByVersion.get(migration.version) ?? null,
  }));
  const appliedCount = migrations.filter((migration) => migration.applied).length;

  return {
    enabled: input.enabled,
    directory: input.directory,
    migrations,
    appliedCount,
    pendingCount: migrations.length - appliedCount,
  };
}

export async function runPostgresTransaction<T, TClient extends PostgresTransactionClient>(
  client: TClient,
  fn: (client: TClient) => Promise<T>
) {
  await client.query("BEGIN");

  try {
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export function createPostgresDatabaseManager(options: CreatePostgresDatabaseManagerOptions) {
  const migrationsTableName = assertSafeIdentifier(options.migrationsTableName ?? DEFAULT_SCHEMA_MIGRATIONS_TABLE);
  const ensureSchemaMigrationsTableStatement = `
CREATE TABLE IF NOT EXISTS ${migrationsTableName} (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`;

  let pool: Pool | null = null;
  let readyPromise: Promise<void> | null = null;
  let poolFactoryOverride: (() => Pool) | null = null;
  let migrationCachePromise: Promise<DiskMigration[]> | null = null;

  async function loadMigrations() {
    if (!migrationCachePromise) {
      migrationCachePromise = loadSqlDirectoryMigrations(options.resolveMigrationsDirectory());
    }

    return migrationCachePromise;
  }

  function getPool() {
    if (!options.isEnabled()) {
      throw new Error("Database pool requested while PostgreSQL storage is disabled");
    }

    if (!pool) {
      if (poolFactoryOverride) {
        pool = poolFactoryOverride();
      } else {
        const connectionString = options.getDatabaseUrl();
        if (!connectionString) {
          throw new Error("DATABASE_URL is required when PostgreSQL-backed storage is enabled");
        }

        pool = new Pool({
          connectionString,
          max: 10,
          ...options.poolConfig,
        });
      }
    }

    return pool;
  }

  async function withClient<T>(fn: (client: PoolClient) => Promise<T>) {
    const currentPool = getPool();
    const client = await currentPool.connect();

    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
    return withClient((client) => runPostgresTransaction(client, fn));
  }

  async function ensureSchemaMigrationsTable(client: PoolClient) {
    await client.query(ensureSchemaMigrationsTableStatement);
  }

  async function readAppliedMigrations(client: PoolClient) {
    await ensureSchemaMigrationsTable(client);
    const result = await client.query<{
      version: string;
      applied_at: Date | string;
    }>(
      `
      SELECT version, applied_at
      FROM ${migrationsTableName}
      ORDER BY applied_at ASC, version ASC
      `
    );

    return result.rows.map((row) => ({
      version: row.version,
      appliedAt:
        row.applied_at instanceof Date ? row.applied_at.toISOString() : new Date(row.applied_at).toISOString(),
    })) satisfies AppliedMigrationRow[];
  }

  async function getMigrationStatus(): Promise<DatabaseMigrationStatus> {
    const migrations = await loadMigrations();
    const directory = options.resolveMigrationsDirectory();

    if (!options.isEnabled()) {
      return buildMigrationStatus({
        enabled: false,
        directory,
        migrations,
        applied: [],
      });
    }

    return withClient(async (client) => {
      const applied = await readAppliedMigrations(client);
      return buildMigrationStatus({
        enabled: true,
        directory,
        migrations,
        applied,
      });
    });
  }

  async function runMigrations(runOptions: { dryRun?: boolean } = {}): Promise<RunDatabaseMigrationsResult> {
    const migrations = await loadMigrations();
    const directory = options.resolveMigrationsDirectory();

    if (!options.isEnabled()) {
      const status = buildMigrationStatus({
        enabled: false,
        directory,
        migrations,
        applied: [],
      });
      return {
        ...status,
        newlyAppliedVersions: [],
        newlyAppliedCount: 0,
      };
    }

    return withClient(async (client) => {
      const applied = await readAppliedMigrations(client);
      const appliedByVersion = new Set(applied.map((item) => item.version));
      const newlyAppliedVersions: string[] = [];

      if (!runOptions.dryRun) {
        for (const migration of migrations) {
          if (appliedByVersion.has(migration.version)) {
            continue;
          }

          await runPostgresTransaction(client, async (transactionClient) => {
            for (const statement of migration.statements) {
              await transactionClient.query(statement);
            }

            await transactionClient.query(
              `INSERT INTO ${migrationsTableName} (version) VALUES ($1) ON CONFLICT (version) DO NOTHING`,
              [migration.version]
            );
            newlyAppliedVersions.push(migration.version);
            appliedByVersion.add(migration.version);
          });
        }
      }

      const nextApplied = await readAppliedMigrations(client);
      const status = buildMigrationStatus({
        enabled: true,
        directory,
        migrations,
        applied: nextApplied,
      });

      return {
        ...status,
        newlyAppliedVersions,
        newlyAppliedCount: newlyAppliedVersions.length,
      };
    });
  }

  async function ensureReady() {
    if (!options.isEnabled()) {
      return;
    }

    if (!readyPromise) {
      readyPromise = runMigrations().then(() => undefined);
    }

    return readyPromise;
  }

  async function probeReadiness() {
    if (!options.isEnabled()) {
      return {
        enabled: false,
        ready: false,
        detail: null,
      };
    }

    try {
      await ensureReady();
      const currentPool = getPool();
      await currentPool.query("SELECT 1 AS ready");
      return {
        enabled: true,
        ready: true,
        detail: null,
      };
    } catch (error) {
      return {
        enabled: true,
        ready: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function resetConnectionState() {
    readyPromise = null;

    if (pool) {
      await pool.end().catch(() => undefined);
    }

    pool = null;
  }

  async function resetForTests() {
    migrationCachePromise = null;
    await resetConnectionState();
    poolFactoryOverride = null;
  }

  function setPoolFactoryForTests(factory: (() => Pool) | null) {
    poolFactoryOverride = factory;
    readyPromise = null;
    pool = null;
  }

  return {
    isEnabled: options.isEnabled,
    getPool,
    withClient,
    withTransaction,
    loadMigrations,
    getMigrationStatus,
    runMigrations,
    ensureReady,
    probeReadiness,
    resetConnectionState,
    resetForTests,
    setPoolFactoryForTests,
  };
}
