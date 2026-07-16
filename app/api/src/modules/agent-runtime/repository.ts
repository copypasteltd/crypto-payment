import {
  InMemoryAgentRuntimeRepository,
  PostgresAgentRuntimeRepository,
  type AgentRuntimeRepository,
} from "@lingban/db";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";

function buildAgentRuntimeRepository(): AgentRuntimeRepository {
  return getApiRuntimeConfig().runEventsStore === "postgres"
    ? new PostgresAgentRuntimeRepository({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
      })
    : new InMemoryAgentRuntimeRepository();
}

export const agentRuntimeRepository = buildAgentRuntimeRepository();
