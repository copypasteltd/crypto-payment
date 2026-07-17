import {
  InMemorySessionProjectsRepository,
  PostgresSessionProjectsRepository,
  type SessionProjectsRepository,
} from "@lingban/db";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";

function buildSessionProjectsRepository(): SessionProjectsRepository {
  return getApiRuntimeConfig().creatorStore === "postgres"
    ? new PostgresSessionProjectsRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
      })
    : new InMemorySessionProjectsRepository();
}

export const sessionProjectsRepository = buildSessionProjectsRepository();
