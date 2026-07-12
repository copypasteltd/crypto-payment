import type { FastifyInstance } from "fastify";
import {
  listSearchHistoryQuerySchema,
  listSearchResultsQuerySchema,
  listSearchSuggestionsQuerySchema,
  recordSearchClickInputSchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { requireCurrentWorkspaceAccess, type AuthRequestContext } from "../auth/request-auth.js";
import { searchService } from "./service.js";

function toSearchActor(authContext: AuthRequestContext) {
  return {
    userId: authContext.user.userId,
    workspaceId: authContext.currentWorkspace.workspaceId,
    workspaceContextKey: authContext.currentWorkspace.contextKey,
    role: authContext.currentWorkspace.role,
  };
}

export async function registerSearchRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const query = listSearchResultsQuerySchema.parse(request.query ?? {});
    return searchService.listSearchResults(toSearchActor(authContext), query);
  });

  server.get("/history", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const query = listSearchHistoryQuerySchema.parse(request.query ?? {});
    return searchService.listSearchHistory(toSearchActor(authContext), query);
  });

  server.get("/suggestions", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const query = listSearchSuggestionsQuerySchema.parse(request.query ?? {});
    return searchService.listSearchSuggestions(toSearchActor(authContext), query);
  });

  server.post("/clicks", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request);
    if (!authContext) {
      throw new AppError(401, "AUTH_ACCESS_REQUIRED", "Access token is required");
    }

    const body = recordSearchClickInputSchema.parse(request.body ?? {});
    return searchService.recordSearchClick(toSearchActor(authContext), body);
  });
}
