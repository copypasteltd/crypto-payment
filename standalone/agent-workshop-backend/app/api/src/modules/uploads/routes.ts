import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createRunDownloadTicketInputSchema,
  createRunUploadInputSchema,
  finalizeRunUploadInputSchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { requireWorkspaceAccess } from "../auth/request-auth.js";
import { runsService } from "../runs/service.js";
import { runIdParamsSchema } from "../runs/routes.js";
import { runUploadService } from "./service.js";
import { ByteRangeNotSatisfiableError } from "./byte-range.js";

const uploadParamsSchema = runIdParamsSchema.extend({
  uploadId: z.string().min(1),
});

const downloadTicketParamsSchema = z.object({
  ticketId: z.string().min(1),
});

const downloadTicketQuerySchema = z.object({
  disposition: z.enum(["attachment", "inline"]).default("attachment"),
});

export async function registerRunUploadRoutes(server: FastifyInstance) {
  server.get("/:runId/uploads", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return runUploadService.listUploads(params.runId);
  });

  server.post("/:runId/uploads", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = createRunUploadInputSchema.parse(request.body);
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator", "creator"]);
    return await runUploadService.createUpload(params.runId, body);
  });

  server.put("/:runId/uploads/:uploadId/content", async (request) => {
    const params = uploadParamsSchema.parse(request.params);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator", "creator"]);

    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(415, "UPLOAD_BODY_INVALID", "Upload body must be application/octet-stream");
    }

    return await runUploadService.putUploadContent(params.runId, params.uploadId, request.body, {
      requestedByUserId: authContext?.user.userId ?? null,
    });
  });

  server.post("/:runId/uploads/:uploadId/finalize", async (request) => {
    const params = uploadParamsSchema.parse(request.params);
    const body = finalizeRunUploadInputSchema.parse(request.body ?? {});
    const snapshot = runsService.getRun(params.runId);
    requireWorkspaceAccess(request, snapshot.run.workspaceId, ["owner", "admin", "operator", "creator"]);
    return await runUploadService.finalizeUpload(params.runId, params.uploadId, body);
  });

  server.post("/:runId/download-tickets", async (request) => {
    const params = runIdParamsSchema.parse(request.params);
    const body = createRunDownloadTicketInputSchema.parse(request.body);
    const snapshot = runsService.getRun(params.runId);
    const authContext = requireWorkspaceAccess(request, snapshot.run.workspaceId);
    return await runUploadService.createDownloadTicket(
      params.runId,
      body,
      authContext?.user.userId ?? null
    );
  });
}

export async function registerDownloadTicketRoutes(server: FastifyInstance) {
  server.get("/:ticketId", async (request, reply) => {
    const params = downloadTicketParamsSchema.parse(request.params);
    const query = downloadTicketQuerySchema.parse(request.query ?? {});
    let resolved;
    try {
      resolved = await runUploadService.resolveDownloadTicket(params.ticketId, {
        ...query,
        rangeHeader: request.headers.range,
      });
    } catch (error) {
      if (error instanceof ByteRangeNotSatisfiableError) {
        reply.header("accept-ranges", "bytes");
        reply.header("content-range", `bytes */${error.sizeBytes}`);
        return reply.status(416).send({
          error: {
            code: "DOWNLOAD_RANGE_NOT_SATISFIABLE",
            message: error.message,
          },
        });
      }
      throw error;
    }

    if ("redirectUrl" in resolved && resolved.redirectUrl) {
      return reply.redirect(resolved.redirectUrl, 307);
    }

    if (!("descriptor" in resolved) || !resolved.descriptor) {
      throw new AppError(500, "DOWNLOAD_DESCRIPTOR_MISSING", "Download descriptor is missing");
    }

    reply.header("content-type", resolved.ticket.mimeType);
    reply.header("cache-control", "private, no-store");
    reply.header("x-content-type-options", "nosniff");
    reply.header("accept-ranges", "bytes");
    reply.header(
      "content-disposition",
      `${query.disposition}; filename="${encodeURIComponent(resolved.ticket.fileName)}"`
    );

    const sizeBytes = resolved.descriptor.file.sizeBytes;
    if (resolved.descriptor.byteRange) {
      const { start, end, length } = resolved.descriptor.byteRange;
      reply.status(206);
      reply.header("content-range", `bytes ${start}-${end}/${sizeBytes}`);
      reply.header("content-length", length);
    } else if (sizeBytes != null) {
      reply.header("content-length", sizeBytes);
    }

    return reply.send(resolved.descriptor.stream);
  });
}
