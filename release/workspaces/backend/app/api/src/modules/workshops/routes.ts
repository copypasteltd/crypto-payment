import type { FastifyInstance } from "fastify";
import {
  createServiceLaunchTemplateInputSchema,
  listServicesQuerySchema,
  listWorkshopsQuerySchema,
} from "@lingban/contracts";
import { serviceIdParamsSchema, workshopIdParamsSchema } from "./storage-schema.js";
import { workshopCatalogService } from "./service.js";

export async function registerWorkshopRoutes(server: FastifyInstance) {
  server.get("/", async (request) => {
    const query = listWorkshopsQuerySchema.parse(request.query);
    return workshopCatalogService.listWorkshops(query);
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

  server.post("/:serviceId/launch-template", async (request) => {
    const params = serviceIdParamsSchema.parse(request.params);
    const body = createServiceLaunchTemplateInputSchema.parse(request.body);
    return workshopCatalogService.createLaunchTemplate(params.serviceId, body);
  });
}
