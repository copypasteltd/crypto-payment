import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  archiveRunInputSchema,
  deleteRunInputSchema,
  fileKindSchema,
  listMcpCallsQuerySchema,
  listRunsQuerySchema,
  runFileSourceSchema,
  runFileStorageTierSchema,
  serverRealtimeMessageSchema,
  stopRunInputSchema,
} from "@lingban/contracts";
import {
  approveRunInputSchema,
  createRunInputSchema,
  reviewRunInformationAnswerInputSchema,
  sendRunMessageInputSchema,
  updateRunApprovalModeInputSchema,
} from "./schemas.js";
import { runEventBus } from "../realtime/event-bus.js";
import { AppError } from "../../app/errors.js";
import { requireRequestAuth, requireWorkspaceAccess } from "../auth/request-auth.js";
import { runFileAccessService } from "./file-access.js";
import { runFileIndexService } from "./file-index.js";
import { runsService } from "./service.js";
import { runUploadService } from "../uploads/service.js";
import { meService } from "../me/service.js";
import { mcpCallAuditService } from "../mcp/call-audit-service.js";

export const runIdParamsSchema = z.object({
  runId: z.string().min(1),
});

const runFileQuerySchema = z.object({
  path: z.string().min(1).optional(),
});

const booleanQueryValueSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean());

const runFileIndexQuerySchema = z.object({
  prefix: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  source: runFileSourceSchema.optional(),
  kind: fileKindSchema.optional(),
  storageTier: runFileStorageTierSchema.optional(),
  previewable: booleanQueryValueSchema.optional(),
  downloadable: booleanQueryValueSchema.optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

function writeSseFrame(
  raw: NodeJS.WritableStream,
  options: { id?: string; event: string; data: unknown }
) {
  if (options.id) {
    raw.write(`id: ${options.id}\n`);
  }

  raw.write(`event: ${options.event}\n`);
  raw.write(`data: ${JSON.stringify(options.data)}\n\n`);
}

export async function registerRunRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const authContext = requireRequestAuth(request);
    const query = listRunsQuerySchema.parse(request.query ?? {});

    return runsService.listRuns(query, {
      workspaceId: authContext?.currentWorkspace.workspaceId,
      workspaceContextKey: authContext?.currentWorkspace.contextKey ?? null,
    });
  });

  server.get("/summary", async (request) => {
    const authContext = requireRequestAuth(request);
    const query = listRunsQuerySchema.parse(request.query ?? {});

    return runsService.getRunsSummary(query, {
      workspaceId: authContext?.currentWorkspace.workspaceId,
      workspaceContextKey: authContext?.currentWorkspace.contextKey ?? null,
    });
  });

  server.post("/", async (request) => {
    const body = createRunInputSchema.parse(request.body);
    const authContext = requireWorkspaceAccess(
      request,
      body.workspaceId,
      ["owner", "admin", "operator", "creator"]
    );

    const created = await runsService.createRun({
      ...body,
      workspaceId: authContext?.currentWorkspace.workspaceId ?? body.workspaceId,
      requestedByUserId: authContext?.user.userId ?? body.requestedByUserId,
    });

    if (authContext) {
      await meService
        .recordRecentActivity(
          {
            userId: authContext.user.userId,
            user: authContext.user,
            workspaceId: authContext.currentWorkspace.workspaceId,
            workspaceContextKey: authContext.currentWorkspace.contextKey,
            role: authContext.currentWorkspace.role,
            currentWorkspace: authContext.currentWorkspace,
          },
          {
            resourceType: "run",
            runId: created.run.runId,
            interaction: "launch",
            sourceSurface: created.run.entrySurface,
          }
        )
        .catch(() => undefined);
    }

    return created;
  });

  server.get("/:runId", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return snapshot;
  });

  server.get("/:runId/lifecycle", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return {
      runId: snapshot.run.runId,
      runStatus: snapshot.run.status,
      runtime: snapshot.runtime,
      lifecycle: snapshot.lifecycle,
    };
  });

  server.get("/:runId/files", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return runsService.listFiles(params.runId);
  });

  server.get("/:runId/files/tree", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return runFileAccessService.listRunFiles(params.runId);
  });

  server.get("/:runId/files/indexed", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const query = runFileIndexQuerySchema.parse(request.query ?? {});
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return runFileIndexService.listIndexed(params.runId, query);
  });

  server.get("/:runId/files/stat", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const query = runFileQuerySchema.parse(request.query);
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return runFileAccessService.statRunFile(params.runId, query.path);
  });

  server.get("/:runId/files/read", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const query = runFileQuerySchema.parse(request.query);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return runFileAccessService.readRunFile(params.runId, query.path, {
      requestedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.get("/:runId/files/preview", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const query = runFileQuerySchema.parse(request.query);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId);
    const preview = await runFileAccessService.previewRunFile(params.runId, query.path, {
      requestedByUserId: authContext?.user.userId ?? null,
    });

    if (preview.mode === "image" || preview.mode === "pdf") {
      const ticket = await runUploadService.createDownloadTicket(
        params.runId,
        {
          path: query.path ?? preview.file.path,
        },
        authContext?.user.userId ?? null,
        {
          purpose: "preview",
        }
      );

      return {
        ...preview,
        downloadUrl: ticket.downloadUrl,
        downloadTicketId: ticket.ticket.ticketId,
        downloadExpiresAt: ticket.ticket.expiresAt,
      };
    }

    return preview;
  });

  server.get("/:runId/files/download", async (request, reply) => {
    const params = runIdParamsSchema.parse(request.params);
    const query = runFileQuerySchema.parse(request.query);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId);
    const descriptor = await runFileAccessService.createDownloadDescriptor(params.runId, query.path, {
      requestedByUserId: authContext?.user.userId ?? null,
      enforceQuota: true,
    });

    reply.header("content-type", descriptor.mimeType);
    reply.header(
      "content-disposition",
      `attachment; filename="${encodeURIComponent(descriptor.file.name)}"`
    );

    return reply.send(descriptor.stream);
  });

  server.get("/:runId/mcp-calls", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const query = listMcpCallsQuerySchema.parse(request.query ?? {});
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return mcpCallAuditService.listRunCalls(params.runId).filter((record) => {
      if (query.mcpId && record.mcpId !== query.mcpId) {
        return false;
      }

      if (query.toolName && record.toolName !== query.toolName) {
        return false;
      }

      if (query.status && record.status !== query.status) {
        return false;
      }

      if (query.from && record.occurredAt < query.from) {
        return false;
      }

      if (query.to && record.occurredAt > query.to) {
        return false;
      }

      return true;
    }).slice(0, query.limit ?? 200);
  });

  server.post("/:runId/messages", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = sendRunMessageInputSchema.parse(request.body);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator", "creator"]);
    const updated = await runsService.sendMessage(params.runId, body, {
      requestedByUserId: authContext?.user.userId ?? null,
    });

    if (authContext) {
      await meService
        .recordRecentActivity(
          {
            userId: authContext.user.userId,
            user: authContext.user,
            workspaceId: authContext.currentWorkspace.workspaceId,
            workspaceContextKey: authContext.currentWorkspace.contextKey,
            role: authContext.currentWorkspace.role,
            currentWorkspace: authContext.currentWorkspace,
          },
          {
            resourceType: "run",
            runId: params.runId,
            interaction: "resume",
            sourceSurface: updated.run.entrySurface,
          }
        )
        .catch(() => undefined);
    }

    return updated;
  });

  server.post("/:runId/information-collection/reviews", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = reviewRunInformationAnswerInputSchema.parse(request.body);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(
      request,
      snapshot.run.workspaceId,
      ["owner", "admin", "operator", "creator"]
    );

    return await runsService.reviewInformationAnswer(params.runId, body, {
      reviewedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:runId/approvals", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = approveRunInputSchema.parse(request.body);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator"]);
    return await runsService.approve(params.runId, body, {
      decidedByUserId: authContext?.user.userId ?? null,
      decisionMode: "manual",
      awaitBridgeDispatch: true,
    });
  });

  server.patch("/:runId/approval-mode", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = updateRunApprovalModeInputSchema.parse(request.body);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(
      request,
      snapshot.run.workspaceId,
      ["owner", "admin", "operator"]
    );

    return await runsService.setApprovalMode(params.runId, body, {
      updatedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:runId/approve", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = approveRunInputSchema.parse(request.body);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator"]);
    return await runsService.approve(params.runId, body, {
      decidedByUserId: authContext?.user.userId ?? null,
      decisionMode: "manual",
      awaitBridgeDispatch: true,
    });
  });

  server.post("/:runId/cancel", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = z
      .object({
        reason: z.string().min(1).optional(),
      })
      .parse(request.body ?? {});
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator", "creator"]);

    return await runsService.cancel(params.runId, body.reason, {
      requestedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:runId/stop", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = stopRunInputSchema.parse(request.body ?? {});
    if (body.mode === "force") {
      throw new AppError(403, "RUN_FORCE_STOP_ADMIN_ONLY", "Force termination is restricted to the platform Admin.");
    }
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator", "creator"]);
    return await runsService.stop(params.runId, {
      reason: body.reason,
      mode: "graceful",
      requestedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:runId/archive", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    archiveRunInputSchema.parse(request.body ?? {});
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator", "creator"]);
    return await runsService.archiveRun(params.runId, {
      requestedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:runId/restore", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator", "creator"]);
    return await runsService.restoreRun(params.runId, {
      requestedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.delete("/:runId", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = deleteRunInputSchema.parse(request.body);
    const snapshot = runsService.getRunIncludingDeleted(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin"]);
    return await runsService.deleteRun(params.runId, {
      ...body,
      requestedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.get("/:runId/stream", async (request, reply) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    const backlog = runEventBus.list(params.runId);

    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    });
    reply.hijack();

    writeSseFrame(reply.raw, {
      event: "runs.snapshot",
      data: serverRealtimeMessageSchema.parse({
        type: "runs.snapshot",
        payload: snapshot,
      }),
    });

    for (const envelope of backlog) {
      writeSseFrame(reply.raw, {
        id: envelope.eventId,
        event: "runs.event",
        data: serverRealtimeMessageSchema.parse({
          type: "runs.event",
          payload: envelope.event,
        }),
      });
    }

    const unsubscribe = runEventBus.subscribe(params.runId, (envelope) => {
      writeSseFrame(reply.raw, {
        id: envelope.eventId,
        event: "runs.event",
        data: serverRealtimeMessageSchema.parse({
          type: "runs.event",
          payload: envelope.event,
        }),
      });
    });

    request.raw.on("close", () => {
      unsubscribe();
      reply.raw.end();
    });
  });
}
