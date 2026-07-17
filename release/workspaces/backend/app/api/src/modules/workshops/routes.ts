import type { FastifyInstance } from "fastify";
import {
  createWorkshopServiceBundleInputSchema,
  createServiceLaunchTemplateInputSchema,
  listServicesQuerySchema,
  listWorkshopsQuerySchema,
  type WorkspaceRole,
} from "@lingban/contracts";
import { requireCurrentWorkspaceAccess } from "../auth/request-auth.js";
import { executeIdempotent, readIdempotencyKey } from "../idempotency/service.js";
import { serviceIdParamsSchema, workshopIdParamsSchema } from "./storage-schema.js";
import { workshopCatalogService } from "./service.js";

const catalogWriteRoles: WorkspaceRole[] = ["owner", "admin", "creator"];

function toCatalogWriteActor(
  authContext: NonNullable<ReturnType<typeof requireCurrentWorkspaceAccess>>
) {
  return {
    userId: authContext.user.userId,
    workspaceId: authContext.currentWorkspace.workspaceId,
    workspaceContextKey: authContext.currentWorkspace.contextKey,
  };
}

export async function registerWorkshopRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const query = listWorkshopsQuerySchema.parse(request.query);
    return workshopCatalogService.listWorkshops(query);
  });

  server.post("/", async (request, reply) => {
    const authContext = requireCurrentWorkspaceAccess(request, catalogWriteRoles);
    if (!authContext) return null;
    const body = createWorkshopServiceBundleInputSchema.parse(request.body);
    const idempotencyKey = readIdempotencyKey(request);
    const result = await executeIdempotent({
      scope: "catalog.workshop-service-bundle.create",
      key: idempotencyKey,
      actorId: `${authContext.user.userId}:${authContext.currentWorkspace.workspaceId}`,
      request: body,
      execute: () => workshopCatalogService.createWorkshopServiceBundle(
        body,
        toCatalogWriteActor(authContext),
        idempotencyKey
      ),
    });
    reply.header("Idempotency-Status", result.replayed ? "replayed" : "created");
    return result.value;
  });

  server.get("/:workshopId", async (request) => {
    const params = workshopIdParamsSchema.parse(request.params);
    const query = listWorkshopsQuerySchema.parse(request.query);
    return workshopCatalogService.getWorkshop(params.workshopId, query);
  });

  server.get("/:workshopId/services", async (request) => {
    const params = workshopIdParamsSchema.parse(request.params);
    const query = listServicesQuerySchema.parse({
      ...(request.query as Record<string, unknown>),
      workshopId: params.workshopId,
    });
    return workshopCatalogService.listServices(query);
  });
}

export async function registerServiceCatalogRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const query = listServicesQuerySchema.parse(request.query);
    return workshopCatalogService.listServices(query);
  });

  server.get("/:serviceId", async (request) => {
    const params = serviceIdParamsSchema.parse(request.params);
    const query = listServicesQuerySchema.parse(request.query);
    return workshopCatalogService.getService(params.serviceId, query);
  });

  server.get("/:serviceId/versions", async (request) => {
    const authContext = requireCurrentWorkspaceAccess(request, catalogWriteRoles);
    if (!authContext) return [];
    const params = serviceIdParamsSchema.parse(request.params);
    return workshopCatalogService.listTaskVersions(
      params.serviceId,
      toCatalogWriteActor(authContext)
    );
  });

  server.post("/:serviceId/launch-template", async (request) => {
    const params = serviceIdParamsSchema.parse(request.params);
    const body = createServiceLaunchTemplateInputSchema.parse(request.body);
    return workshopCatalogService.createLaunchTemplate(params.serviceId, body);
  });
}
