import {
  InMemorySessionAssetRepository,
  PostgresSessionAssetRepository,
  type SessionAssetRepository,
} from "@lingban/db";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";

function buildSessionAssetRepository(): SessionAssetRepository {
  return getApiRuntimeConfig().sessionArchivesStore === "postgres"
    ? new PostgresSessionAssetRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new InMemorySessionAssetRepository();
}

export const sessionAssetRepository = buildSessionAssetRepository();
