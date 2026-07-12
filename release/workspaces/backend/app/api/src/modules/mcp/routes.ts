import type { FastifyInstance } from "fastify";
import {
  createMcpBindingInputSchema,
  createMcpInputSchema,
  createMcpNetworkPolicyInputSchema,
  listMcpCallsQuerySchema,
  listMcpBindingsQuerySchema,
  listMcpGovernanceEventsQuerySchema,
  listMcpHealthSnapshotsQuerySchema,
  listMcpsQuerySchema,
  listMcpNetworkPoliciesQuerySchema,
  probeMcpInputSchema,
  updateMcpBindingInputSchema,
  updateMcpInputSchema,
  updateMcpNetworkPolicyInputSchema,
} from "@lingban/contracts";
import { requireRequestAuth } from "../auth/request-auth.js";
import { mcpCallAuditService } from "./call-audit-service.js";
import { mcpGovernanceAuditService } from "./governance-audit-service.js";
import {
  mcpBindingIdParamsSchema,
  mcpIdParamsSchema,
  mcpNetworkPolicyRefParamsSchema,
} from "./storage-schema.js";
import { mcpService } from "./service.js";

export async function registerMcpRoutes(server: FastifyInstance) {
  server.get("/mcps", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return [];
    }

    const query = listMcpsQuerySchema.parse(request.query);
    return mcpService.listMcps(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
      },
      query
    );
  });

  server.get("/mcps/:mcpId", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const params = mcpIdParamsSchema.parse(request.params);
    return mcpService.getMcp(params.mcpId, {
      workspaceId: authContext.currentWorkspace.workspaceId,
    });
  });

  server.post("/mcps", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const body = createMcpInputSchema.parse(request.body);
    return await mcpService.createMcp(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.patch("/mcps/:mcpId", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const params = mcpIdParamsSchema.parse(request.params);
    const body = updateMcpInputSchema.parse(request.body);
    return await mcpService.updateMcp(
      params.mcpId,
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.get("/mcps/:mcpId/health", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const params = mcpIdParamsSchema.parse(request.params);
    const query = probeMcpInputSchema.parse(request.query ?? {});
    return mcpService.getLatestHealthSnapshot(
      params.mcpId,
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
      },
      {
        bindingId: query.bindingId,
      }
    );
  });

  server.post("/mcps/:mcpId/probe", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const params = mcpIdParamsSchema.parse(request.params);
    const body = probeMcpInputSchema.parse(request.body ?? {});
    return await mcpService.probeMcp(
      params.mcpId,
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.get("/mcp-network-policies", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return [];
    }

    const query = listMcpNetworkPoliciesQuerySchema.parse(request.query ?? {});
    return mcpService.listNetworkPolicies(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
      },
      query
    );
  });

  server.get("/mcp-network-policies/:policyRef", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const params = mcpNetworkPolicyRefParamsSchema.parse(request.params);
    return mcpService.getNetworkPolicy(params.policyRef, {
      workspaceId: authContext.currentWorkspace.workspaceId,
    });
  });

  server.post("/mcp-network-policies", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const body = createMcpNetworkPolicyInputSchema.parse(request.body);
    return await mcpService.createNetworkPolicy(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.patch("/mcp-network-policies/:policyRef", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const params = mcpNetworkPolicyRefParamsSchema.parse(request.params);
    const body = updateMcpNetworkPolicyInputSchema.parse(request.body);
    return await mcpService.updateNetworkPolicy(
      params.policyRef,
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.get("/mcp-bindings", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return [];
    }

    const query = listMcpBindingsQuerySchema.parse(request.query);
    return mcpService.listBindings(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      query
    );
  });

  server.get("/mcp-health-snapshots", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return [];
    }

    const query = listMcpHealthSnapshotsQuerySchema.parse(request.query ?? {});
    return mcpService.listHealthSnapshots(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
      },
      query
    );
  });

  server.post("/mcp-bindings", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const body = createMcpBindingInputSchema.parse(request.body);
    return await mcpService.createBinding(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.patch("/mcp-bindings/:bindingId", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return null;
    }

    const params = mcpBindingIdParamsSchema.parse(request.params);
    const body = updateMcpBindingInputSchema.parse(request.body);
    return await mcpService.updateBinding(
      params.bindingId,
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.get("/mcp-calls", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return [];
    }

    const query = listMcpCallsQuerySchema.parse(request.query ?? {});
    return mcpCallAuditService.listCalls(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        role: authContext.currentWorkspace.role,
      },
      query
    );
  });

  server.get("/mcp-governance-events", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return [];
    }

    const query = listMcpGovernanceEventsQuerySchema.parse(request.query ?? {});
    return mcpGovernanceAuditService.listEvents(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        role: authContext.currentWorkspace.role,
      },
      query
    );
  });
}
