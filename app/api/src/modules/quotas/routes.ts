import type { FastifyInstance } from "fastify";
import {
  createQuotaPolicyInputSchema,
  decideQuotaOverrideInputSchema,
  listQuotaCountersQuerySchema,
  listQuotaEventsQuerySchema,
  listQuotaOverridesQuerySchema,
  listQuotaPoliciesQuerySchema,
  updateQuotaPolicyInputSchema,
} from "@lingban/contracts";
import { requireRequestAuth } from "../auth/request-auth.js";
import { quotaOverrideIdParamsSchema, quotaPolicyIdParamsSchema } from "./storage-schema.js";
import { quotaService } from "./service.js";

function buildQuotaActor(request: Parameters<typeof requireRequestAuth>[0]) {
  const authContext = requireRequestAuth(request);
  if (!authContext) {
    return null;
  }

  return {
    actor: {
      userId: authContext.user.userId,
      role: authContext.currentWorkspace.role,
      workspaceId: authContext.currentWorkspace.workspaceId,
      workspaceContextKey: authContext.currentWorkspace.contextKey,
    },
    authContext,
  };
}

export async function registerQuotaRoutes(server: FastifyInstance) {
  server.get("/quotas/policies", async (request) => {
    const context = buildQuotaActor(request);
    if (!context) {
      return null;
    }

    const query = listQuotaPoliciesQuerySchema.parse(request.query ?? {});
    return quotaService.listPolicies(context.actor, query);
  });

  server.post("/quotas/policies", async (request) => {
    const context = buildQuotaActor(request);
    if (!context) {
      return null;
    }

    const body = createQuotaPolicyInputSchema.parse(request.body);
    return quotaService.createPolicy(context.actor, body);
  });

  server.patch("/quotas/policies/:policyId", async (request) => {
    const context = buildQuotaActor(request);
    if (!context) {
      return null;
    }

    const params = quotaPolicyIdParamsSchema.parse(request.params);
    const body = updateQuotaPolicyInputSchema.parse(request.body);
    return quotaService.updatePolicy(context.actor, params.policyId, body);
  });

  server.get("/quotas/counters", async (request) => {
    const context = buildQuotaActor(request);
    if (!context) {
      return null;
    }

    const query = listQuotaCountersQuerySchema.parse(request.query ?? {});
    return quotaService.listCounters(context.actor, query);
  });

  server.get("/quotas/events", async (request) => {
    const context = buildQuotaActor(request);
    if (!context) {
      return null;
    }

    const query = listQuotaEventsQuerySchema.parse(request.query ?? {});
    return quotaService.listEvents(context.actor, query);
  });

  server.get("/quotas/overrides", async (request) => {
    const context = buildQuotaActor(request);
    if (!context) {
      return null;
    }

    const query = listQuotaOverridesQuerySchema.parse(request.query ?? {});
    return quotaService.listOverrides(context.actor, query);
  });

  server.post("/quotas/overrides/:overrideId/approve", async (request) => {
    const context = buildQuotaActor(request);
    if (!context) {
      return null;
    }

    const params = quotaOverrideIdParamsSchema.parse(request.params);
    const body = decideQuotaOverrideInputSchema.parse(request.body ?? {});
    return quotaService.decideOverride(params.overrideId, context.actor, true, body);
  });

  server.post("/quotas/overrides/:overrideId/reject", async (request) => {
    const context = buildQuotaActor(request);
    if (!context) {
      return null;
    }

    const params = quotaOverrideIdParamsSchema.parse(request.params);
    const body = decideQuotaOverrideInputSchema.parse(request.body ?? {});
    return quotaService.decideOverride(params.overrideId, context.actor, false, body);
  });
}
