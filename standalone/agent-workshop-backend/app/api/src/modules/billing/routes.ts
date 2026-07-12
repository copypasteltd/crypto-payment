import type { FastifyInstance } from "fastify";
import {
  billingLedgerSummaryQuerySchema,
  listBillingEntriesQuerySchema,
} from "@lingban/contracts";
import { requireRequestAuth } from "../auth/request-auth.js";
import { billingService } from "./service.js";

function buildBillingActor(request: Parameters<typeof requireRequestAuth>[0]) {
  const authContext = requireRequestAuth(request);
  if (!authContext) {
    return null;
  }

  return {
    userId: authContext.user.userId,
    role: authContext.currentWorkspace.role,
    workspaceId: authContext.currentWorkspace.workspaceId,
    workspaceContextKey: authContext.currentWorkspace.contextKey,
  };
}

export async function registerBillingRoutes(server: FastifyInstance) {
  server.get("/billing/entries", async (request) => {
    const actor = buildBillingActor(request);
    if (!actor) {
      return null;
    }

    const query = listBillingEntriesQuerySchema.parse(request.query ?? {});
    return billingService.listEntries(actor, query);
  });

  server.get("/billing/summary", async (request) => {
    const actor = buildBillingActor(request);
    if (!actor) {
      return null;
    }

    const query = billingLedgerSummaryQuerySchema.parse(request.query ?? {});
    return billingService.getSummary(actor, query);
  });
}
