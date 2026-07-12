import type { FastifyInstance } from "fastify";
import {
  changeCredentialLifecycleInputSchema,
  credentialLifecycleChangeResultSchema,
  createCredentialInputSchema,
  listCredentialAuditEventsQuerySchema,
  listCredentialsQuerySchema,
  rotateCredentialInputSchema,
  updateCredentialInputSchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { requireRequestAuth } from "../auth/request-auth.js";
import { runsService } from "../runs/service.js";
import { credentialsService } from "./service.js";
import { credentialIdParamsSchema } from "./storage-schema.js";

export async function registerCredentialRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const authContext = requireRequestAuth(request);
    if (!authContext) {
      return [];
    }

    const query = listCredentialsQuerySchema.parse(request.query);
    return credentialsService.listVisibleCredentials(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      query
    );
  });

  server.get("/:credentialId", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = credentialIdParamsSchema.parse(request.params);
    if (!authContext) {
      return null;
    }

    return credentialsService.getCredentialForActor(params.credentialId, {
      workspaceId: authContext.currentWorkspace.workspaceId,
      userId: authContext.user.userId,
      role: authContext.currentWorkspace.role,
    });
  });

  server.get("/:credentialId/usages", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = credentialIdParamsSchema.parse(request.params);
    if (!authContext) {
      return null;
    }

    return credentialsService.getCredentialUsage(params.credentialId, {
      workspaceId: authContext.currentWorkspace.workspaceId,
      userId: authContext.user.userId,
      role: authContext.currentWorkspace.role,
    });
  });

  server.get("/:credentialId/audit-events", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = credentialIdParamsSchema.parse(request.params);
    const query = listCredentialAuditEventsQuerySchema.parse(request.query);
    if (!authContext) {
      return [];
    }

    return credentialsService.listCredentialAuditEvents(params.credentialId, {
      workspaceId: authContext.currentWorkspace.workspaceId,
      userId: authContext.user.userId,
      role: authContext.currentWorkspace.role,
    }, query);
  });

  server.post("/", async (request) => {
    const authContext = requireRequestAuth(request);
    const body = createCredentialInputSchema.parse(request.body);
    if (!authContext) {
      return null;
    }

    return await credentialsService.createCredential(
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.patch("/:credentialId", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = credentialIdParamsSchema.parse(request.params);
    const body = updateCredentialInputSchema.parse(request.body);
    if (!authContext) {
      return null;
    }

    return await credentialsService.updateCredential(
      params.credentialId,
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.post("/:credentialId/rotate", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = credentialIdParamsSchema.parse(request.params);
    const body = rotateCredentialInputSchema.parse(request.body);
    if (!authContext) {
      return null;
    }

    return await credentialsService.rotateCredential(
      params.credentialId,
      {
        workspaceId: authContext.currentWorkspace.workspaceId,
        userId: authContext.user.userId,
        role: authContext.currentWorkspace.role,
      },
      body
    );
  });

  server.post("/:credentialId/suspend", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = credentialIdParamsSchema.parse(request.params);
    const body = changeCredentialLifecycleInputSchema.parse(request.body ?? {});
    if (!authContext) {
      return null;
    }

    const actor = {
      workspaceId: authContext.currentWorkspace.workspaceId,
      userId: authContext.user.userId,
      role: authContext.currentWorkspace.role,
    };
    const usage = credentialsService.getCredentialUsage(params.credentialId, actor);
    if (usage.summary.activeRunCount > 0 && body.impactAction === "block") {
      throw new AppError(
        409,
        "CREDENTIAL_ACTIVE_USAGE_PRESENT",
        `Credential ${params.credentialId} has active runs and cannot be suspended without an explicit impact action`,
        usage
      );
    }

    const cancelledRunIds: string[] = [];
    if (body.impactAction === "cancel-active-runs") {
      for (const run of usage.activeRuns) {
        await runsService.cancel(
          run.runId,
          `Credential ${params.credentialId} suspended by governance action.`
        );
        cancelledRunIds.push(run.runId);
      }
    }
    const credential = await credentialsService.setCredentialLifecycleStatus(
      params.credentialId,
      actor,
      {
        status: "disabled",
        note: body.note,
        allowActiveRuns: body.impactAction === "allow-active-runs",
      }
    );

    return credentialLifecycleChangeResultSchema.parse({
      credential,
      activeRunCount: usage.summary.activeRunCount,
      activeRuns: usage.activeRuns,
      cancelledRunIds,
    });
  });

  server.post("/:credentialId/revoke", async (request) => {
    const authContext = requireRequestAuth(request);
    const params = credentialIdParamsSchema.parse(request.params);
    const body = changeCredentialLifecycleInputSchema.parse(request.body ?? {});
    if (!authContext) {
      return null;
    }

    const actor = {
      workspaceId: authContext.currentWorkspace.workspaceId,
      userId: authContext.user.userId,
      role: authContext.currentWorkspace.role,
    };
    const usage = credentialsService.getCredentialUsage(params.credentialId, actor);
    if (usage.summary.activeRunCount > 0 && body.impactAction === "block") {
      throw new AppError(
        409,
        "CREDENTIAL_ACTIVE_USAGE_PRESENT",
        `Credential ${params.credentialId} has active runs and cannot be revoked without an explicit impact action`,
        usage
      );
    }

    const cancelledRunIds: string[] = [];
    if (body.impactAction === "cancel-active-runs") {
      for (const run of usage.activeRuns) {
        await runsService.cancel(
          run.runId,
          `Credential ${params.credentialId} revoked by governance action.`
        );
        cancelledRunIds.push(run.runId);
      }
    }
    const credential = await credentialsService.setCredentialLifecycleStatus(
      params.credentialId,
      actor,
      {
        status: "revoked",
        note: body.note,
      }
    );

    return credentialLifecycleChangeResultSchema.parse({
      credential,
      activeRunCount: usage.summary.activeRunCount,
      activeRuns: usage.activeRuns,
      cancelledRunIds,
    });
  });
}
