import { PostgresRunQueryRepository, type RunQueryRepository } from "@lingban/db";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";

function buildRunQueryRepository(): RunQueryRepository | null {
  const config = getApiRuntimeConfig();
  return config.runsStore === "postgres"
    ? new PostgresRunQueryRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
      })
    : null;
}

export const runQueryRepository = buildRunQueryRepository();
