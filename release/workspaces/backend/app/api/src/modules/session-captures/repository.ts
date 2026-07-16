import {
  InMemorySessionCaptureRepository,
  PostgresSessionCaptureRepository,
  type SessionCaptureRepository,
} from "@lingban/db";
import {
  ensureApiDatabaseReady,
  getApiDatabasePool,
  withApiDatabaseTransaction,
} from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";

function buildSessionCaptureRepository(): SessionCaptureRepository {
  return getApiRuntimeConfig().runEventsStore === "postgres"
    ? new PostgresSessionCaptureRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
        withTransaction: withApiDatabaseTransaction,
      })
    : new InMemorySessionCaptureRepository();
}

export const sessionCaptureRepository = buildSessionCaptureRepository();
