import {
  InMemoryTaskVersionsRepository,
  PostgresTaskVersionsRepository,
  type TaskVersionsRepository,
} from "@lingban/db";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";

function buildTaskVersionsRepository(): TaskVersionsRepository {
  return getApiRuntimeConfig().workshopCatalogStore === "postgres"
    ? new PostgresTaskVersionsRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
      })
    : new InMemoryTaskVersionsRepository();
}

export const taskVersionsRepository = buildTaskVersionsRepository();
