import { pathToFileURL } from "node:url";
import { runPostgresDatabaseCli } from "@lingban/db";
import {
  getApiDatabaseMigrationStatus,
  resetApiDatabaseSchema,
  runApiDatabaseMigrations,
} from "./app/database.js";
import { seedApiReferenceData } from "./app/seed.js";

function isDirectExecution() {
  const entry = process.argv[1];
  return entry ? import.meta.url === pathToFileURL(entry).href : false;
}

async function main() {
  await runPostgresDatabaseCli(
    {
      programName: "node dist/migrate.js",
      manager: {
        getMigrationStatus: getApiDatabaseMigrationStatus,
        runMigrations: runApiDatabaseMigrations,
      },
      reset: () => resetApiDatabaseSchema(),
      seed: () => seedApiReferenceData(),
    },
    process.argv.slice(2)
  );
}

if (isDirectExecution()) {
  void main().catch((error) => {
    console.error("[lingban-api] migration command failed", error);
    process.exitCode = 1;
  });
}
