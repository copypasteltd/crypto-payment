import { pathToFileURL } from "node:url";
import { runPostgresDatabaseCli } from "@lingban/db";
import {
  closeApiDatabaseConnection,
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
  try {
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
  } finally {
    await closeApiDatabaseConnection();
  }
}

if (isDirectExecution()) {
  void main().then(
    () => process.exit(0),
    (error) => {
      console.error("[lingban-api] migration command failed", error);
      process.exit(1);
    }
  );
}
