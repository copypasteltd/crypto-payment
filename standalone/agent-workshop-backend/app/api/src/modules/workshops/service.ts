import {
  createServiceLaunchTemplateInputSchema,
  listServicesQuerySchema,
  listWorkshopsQuerySchema,
  serviceDetailSchema,
  serviceLaunchTemplateSchema,
  workshopDetailSchema,
  type CreateServiceLaunchTemplateInput,
  type ListServicesQuery,
  type ListWorkshopsQuery,
} from "@lingban/contracts";
import { matchesSearchQuery } from "@lingban/domain-models";
import { AppError } from "../../app/errors.js";
import { creatorService } from "../creator/service.js";
import { getSealedSessionVersion } from "../session-drafts/version-registry.js";
import { getActiveServiceSessionBinding } from "../session-drafts/service-binding-registry.js";
import { sessionCatalogService } from "../sessions/service.js";
import { workshopCatalogRepository } from "./repository.js";

function buildRunSuffix() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function deriveTargetRoot(root: string, serviceId: string) {
  return `${ensureTrailingSlash(root)}runs/${serviceId}`;
}

export class WorkshopCatalogService {
  #resolveContext(input: {
    workspaceContextKey?: string;
    workspaceId?: string;
  }) {
    if (input.workspaceContextKey) {
      const byKey = workshopCatalogRepository.getContextByKey(input.workspaceContextKey);
      if (!byKey) {
        throw new AppError(
          404,
          "WORKSHOP_CONTEXT_NOT_FOUND",
          `Workspace context not found: ${input.workspaceContextKey}`
        );
      }
      return byKey;
    }

    if (input.workspaceId) {
      const byRuntimeId = workshopCatalogRepository.getContextByRuntimeWorkspaceId(input.workspaceId);
      if (!byRuntimeId) {
        throw new AppError(
          404,
          "WORKSHOP_CONTEXT_NOT_FOUND",
          `Runtime workspace context not found: ${input.workspaceId}`
        );
      }
      return byRuntimeId;
    }

    return (
      workshopCatalogRepository.getContextByKey("personal") ??
      workshopCatalogRepository.listContexts()[0] ??
      null
    );
  }

  #ensureVisibleWorkshop(workshopId: string, query: Pick<ListWorkshopsQuery, "workspaceContextKey" | "workspaceId" | "entrySurface">) {
    const context = this.#resolveContext(query);
    if (!context) {
      throw new AppError(500, "WORKSHOP_CONTEXT_EMPTY", "No workshop contexts are configured");
    }

    if (query.entrySurface && !context.allowedEntrySurfaces.includes(query.entrySurface)) {
      throw new AppError(
        403,
        "WORKSHOP_SURFACE_NOT_ALLOWED",
        `Entry surface ${query.entrySurface} is not allowed for context ${context.contextKey}`
      );
    }

    const workshop = workshopCatalogRepository.getWorkshopById(workshopId);
    if (!workshop || !workshop.visibleInContexts.includes(context.contextKey) || workshop.status !== "active") {
      throw new AppError(404, "WORKSHOP_NOT_FOUND", `Workshop not found: ${workshopId}`);
    }

    return {
      context,
      workshop,
    };
  }

  #ensureVisibleService(serviceId: string, query: Pick<ListServicesQuery, "workspaceContextKey" | "workspaceId" | "entrySurface">) {
    const context = this.#resolveContext(query);
    if (!context) {
      throw new AppError(500, "WORKSHOP_CONTEXT_EMPTY", "No workshop contexts are configured");
    }

    if (query.entrySurface && !context.allowedEntrySurfaces.includes(query.entrySurface)) {
      throw new AppError(
        403,
        "WORKSHOP_SURFACE_NOT_ALLOWED",
        `Entry surface ${query.entrySurface} is not allowed for context ${context.contextKey}`
      );
    }

    const service = workshopCatalogRepository.getServiceById(serviceId);
    if (!service || !service.visibleInContexts.includes(context.contextKey) || service.status !== "active") {
      throw new AppError(404, "SERVICE_NOT_FOUND", `Service not found: ${serviceId}`);
    }

    const workshop = workshopCatalogRepository.getWorkshopById(service.workshopId);
    if (!workshop || !workshop.visibleInContexts.includes(context.contextKey) || workshop.status !== "active") {
      throw new AppError(404, "WORKSHOP_NOT_FOUND", `Workshop not found: ${service.workshopId}`);
    }

    return {
      context,
      workshop,
      service,
    };
  }

  listWorkshops(query: ListWorkshopsQuery) {
    const parsed = listWorkshopsQuerySchema.parse(query);
    const context = this.#resolveContext(parsed);
    if (!context) {
      return [];
    }

    if (parsed.entrySurface && !context.allowedEntrySurfaces.includes(parsed.entrySurface)) {
      return [];
    }

    return workshopCatalogRepository
      .listWorkshops()
      .filter(
        (item) =>
          item.status === "active" &&
          item.visibleInContexts.includes(context.contextKey) &&
          (!parsed.scope || item.scope === parsed.scope) &&
          (!parsed.tag || item.tagList.includes(parsed.tag)) &&
          matchesSearchQuery(parsed.q ?? "", [
            item.workshopId,
            item.scope,
            item.displayName.zh,
            item.displayName.en,
            item.ownerLabel.zh,
            item.ownerLabel.en,
            item.badge.zh,
            item.badge.en,
            item.audience.zh,
            item.audience.en,
            item.summary.zh,
            item.summary.en,
            item.nextStepSummary.zh,
            item.nextStepSummary.en,
            ...item.tagList,
          ])
      )
      .map(({ visibleInContexts, ...item }) => item);
  }

  getWorkshop(workshopId: string, query: Pick<ListWorkshopsQuery, "workspaceContextKey" | "workspaceId" | "entrySurface">) {
    const { context, workshop } = this.#ensureVisibleWorkshop(workshopId, query);
    const services = workshopCatalogRepository
      .listServices()
      .filter(
        (item) =>
          item.workshopId === workshop.workshopId &&
          item.status === "active" &&
          item.visibleInContexts.includes(context.contextKey)
      )
      .map(({ visibleInContexts, ...item }) => item);

    return workshopDetailSchema.parse({
      ...workshop,
      services,
    });
  }

  listServices(query: ListServicesQuery) {
    const parsed = listServicesQuerySchema.parse(query);
    const context = this.#resolveContext(parsed);
    if (!context) {
      return [];
    }

    if (parsed.entrySurface && !context.allowedEntrySurfaces.includes(parsed.entrySurface)) {
      return [];
    }

    return workshopCatalogRepository
      .listServices()
      .filter(
        (item) =>
          item.status === "active" &&
          item.visibleInContexts.includes(context.contextKey) &&
          (!parsed.workshopId || item.workshopId === parsed.workshopId) &&
          matchesSearchQuery(parsed.q ?? "", [
            item.serviceId,
            item.workshopId,
            item.estimatedDuration,
            item.targetPathHint,
            item.displayName.zh,
            item.displayName.en,
            item.summary.zh,
            item.summary.en,
            item.authRequirementText.zh,
            item.authRequirementText.en,
            item.outputContractSummary.zh,
            item.outputContractSummary.en,
          ])
      )
      .map(({ visibleInContexts, ...item }) => item);
  }

  getService(serviceId: string, query: Pick<ListServicesQuery, "workspaceContextKey" | "workspaceId" | "entrySurface">) {
    const { workshop, service } = this.#ensureVisibleService(serviceId, query);
    return serviceDetailSchema.parse({
      ...service,
      workshop: {
        ...workshop,
      },
    });
  }

  createLaunchTemplate(serviceId: string, input: CreateServiceLaunchTemplateInput) {
    const parsed = createServiceLaunchTemplateInputSchema.parse(input);
    const { context, workshop, service } = this.#ensureVisibleService(serviceId, parsed);
    const creatorResolution = creatorService.resolveActiveLaunchTemplateResolution(
      serviceId,
      context.contextKey
    );
    const formalBinding = getActiveServiceSessionBinding(
      serviceId,
      context.contextKey,
      parsed.entrySurface
    );

    const template =
      workshopCatalogRepository.findLaunchTemplate(serviceId, context.contextKey, parsed.entrySurface) ??
      workshopCatalogRepository.findLaunchTemplate(serviceId, context.contextKey, "dashboard");

    if (!template && !creatorResolution && !formalBinding) {
      throw new AppError(
        404,
        "SERVICE_LAUNCH_TEMPLATE_NOT_FOUND",
        `Launch template not found for service ${serviceId} in context ${context.contextKey}`
      );
    }

    const resolvedTaskVersionId = formalBinding?.taskVersionId ?? creatorResolution?.taskVersionId ?? template?.taskVersionId;
    const resolvedSessionVersionId = formalBinding?.sessionVersionId ?? creatorResolution?.sessionVersionId ?? template?.sessionVersionId;
    const resolvedTitle = template?.title ?? service.displayName;
    const resolvedTargetRoot = template?.targetRoot ?? deriveTargetRoot(context.root, service.serviceId);
    const resolvedBindings = template?.bindings ?? service.requiredBindings;

    if (!resolvedTaskVersionId || !resolvedSessionVersionId) {
      throw new AppError(
        409,
        "SERVICE_LAUNCH_TEMPLATE_VERSION_MISSING",
        `Launch template versions are not available for service ${serviceId} in context ${context.contextKey}`
      );
    }
    try {
      sessionCatalogService.requireSessionPack(resolvedSessionVersionId, {
        workspaceContextKey: context.contextKey,
        serviceId: service.serviceId,
      });
    } catch (error) {
      if (!getSealedSessionVersion(resolvedSessionVersionId)) throw error;
    }

    const targetRoot = ensureTrailingSlash(resolvedTargetRoot);
    const targetPath = `${targetRoot.slice(0, -1)}-${buildRunSuffix()}/`;

    return serviceLaunchTemplateSchema.parse({
      serviceId,
      workspaceContext: context,
      taskVersionId: resolvedTaskVersionId,
      sessionVersionId: resolvedSessionVersionId,
      title: resolvedTitle,
      targetRoot: resolvedTargetRoot,
      initialMessagePolicy: "system-collects-required-info",
      resolution: creatorResolution ?? {
        source: "catalog-default",
        packageId: null,
        releaseId: null,
        activationId: null,
      },
      createRunInput: {
        workspaceId: parsed.workspaceId ?? context.runtimeWorkspaceId,
        taskVersionId: resolvedTaskVersionId,
        sessionVersionId: resolvedSessionVersionId,
        title: resolvedTitle.zh,
        targetPath,
        entrySurface: parsed.entrySurface,
        initialMessage: null,
        bindings: resolvedBindings,
        catalogMetadata: {
          workspaceContextKey: context.contextKey,
          workspaceContextName: context.displayName,
          workshopId: workshop.workshopId,
          workshopName: workshop.displayName,
          serviceId: service.serviceId,
          serviceName: service.displayName,
        },
      },
    });
  }
}

export async function initializeWorkshopInfrastructure() {
  await workshopCatalogRepository.init();
}

export const workshopCatalogService = new WorkshopCatalogService();
