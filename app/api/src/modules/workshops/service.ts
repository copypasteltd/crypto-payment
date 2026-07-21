import { createHash } from "node:crypto";
import {
  createWorkshopServiceBundleInputSchema,
  createWorkshopServiceBundleResponseSchema,
  createServiceLaunchTemplateInputSchema,
  listServicesQuerySchema,
  listWorkshopsQuerySchema,
  serviceDetailSchema,
  serviceLaunchTemplateSchema,
  workshopDetailSchema,
  serviceTaskVersionRecordSchema,
  type CreateWorkshopServiceBundleInput,
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
import { sessionProjectsService } from "../session-projects/service.js";
import { workshopCatalogRepository } from "./repository.js";
import { taskVersionsRepository } from "./task-versions-repository.js";
import {
  serviceCatalogRecordSchema,
  workshopCatalogRecordSchema,
} from "./storage-schema.js";

type CatalogWriteActor = {
  userId: string;
  workspaceId: string;
  workspaceContextKey: string;
};

function buildRunSuffix() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function deriveTargetRoot(root: string, serviceId: string) {
  return `${ensureTrailingSlash(root)}runs/${serviceId}`;
}

function isWorkspaceOwnedVisible(
  ownerWorkspaceId: string | null,
  visibility: "private" | "workspace" | "public" | "marketplace",
  workspaceId?: string
) {
  return (
    visibility === "public" ||
    visibility === "marketplace" ||
    !ownerWorkspaceId ||
    ownerWorkspaceId === workspaceId
  );
}

export class WorkshopCatalogService {
  async createWorkshopServiceBundle(
    input: CreateWorkshopServiceBundleInput,
    actor: CatalogWriteActor,
    idempotencyKey: string
  ) {
    const parsed = createWorkshopServiceBundleInputSchema.parse(input);
    const project = await sessionProjectsService.get(parsed.sessionProjectId, actor);
    if (!project.currentSessionVersionId || !["SEALED", "PACKAGED"].includes(project.status)) {
      throw new AppError(
        409,
        "SESSION_PROJECT_NOT_SEALED",
        "A sealed Session Version is required before catalog assets can be created"
      );
    }
    const context = workshopCatalogRepository.getContextByKey(actor.workspaceContextKey);
    if (!context) {
      throw new AppError(409, "WORKSHOP_CONTEXT_MISMATCH", "Current workspace catalog context is unavailable");
    }

    const resourceSeed = createHash("sha256")
      .update(`${actor.workspaceId}:${actor.userId}:${idempotencyKey}`)
      .digest("hex")
      .slice(0, 32);
    const workshopId = `wks_${resourceSeed}`;
    const serviceId = `svc_${resourceSeed}`;
    const taskVersionId = `tsv_${resourceSeed}`;
    const existingVersions = await taskVersionsRepository.listByServiceId(serviceId);
    const versionNumber = (existingVersions[0]?.versionNumber ?? 0) + 1;
    const at = new Date().toISOString();
    const requiredBindings = {
      firstPartyMcpIds: [...new Set([
        ...project.sourceBindings.firstPartyMcpIds,
        ...parsed.service.requiredBindings.firstPartyMcpIds,
      ])],
      externalConnectorRefs: [...new Set([
        ...project.sourceBindings.externalConnectorRefs,
        ...parsed.service.requiredBindings.externalConnectorRefs,
      ])],
      credentialIds: [...new Set([
        ...project.sourceBindings.credentialIds,
        ...parsed.service.requiredBindings.credentialIds,
      ])],
    };
    const targetRoot = deriveTargetRoot(context.root, serviceId);

    const workshopRecord = workshopCatalogRecordSchema.parse({
      workshopId,
      scope: parsed.scope,
      status: "draft",
      visibility: parsed.visibility,
      displayName: parsed.displayName,
      ownerLabel: { zh: actor.userId, en: actor.userId },
      badge: {
        zh: parsed.visibility === "public" ? "公开" : "工作区",
        en: parsed.visibility === "public" ? "Public" : "Workspace",
      },
      audience: parsed.audience,
      summary: parsed.summary,
      nextStepSummary: parsed.nextStepSummary,
      coverAssetUrl: parsed.coverAssetUrl,
      tagList: parsed.tagList,
      defaultServiceId: serviceId,
      visibleInContexts: [actor.workspaceContextKey],
      ownerWorkspaceId: actor.workspaceId,
    });
    const serviceRecord = serviceCatalogRecordSchema.parse({
      serviceId,
      workshopId,
      status: "draft",
      displayName: parsed.service.displayName,
      summary: parsed.service.summary,
      authRequirementText: parsed.service.authRequirementText,
      estimatedDuration: parsed.service.estimatedDuration,
      targetPathHint: parsed.service.targetPathHint,
      outputContractSummary: parsed.service.outputContractSummary,
      launchMode: "instant-conversation",
      requiredBindings,
      linkedInstanceHint: parsed.service.linkedInstanceHint,
      visibleInContexts: [actor.workspaceContextKey],
      ownerWorkspaceId: actor.workspaceId,
    });
    const immutableContent = {
      serviceId,
      workshopId,
      workspaceId: actor.workspaceId,
      workspaceContextKey: actor.workspaceContextKey,
      sessionProjectId: project.sessionProjectId,
      sessionVersionId: project.currentSessionVersionId,
      versionNumber,
      title: parsed.service.displayName,
      targetRoot,
      requiredBindings,
      allowedEntrySurfaces: context.allowedEntrySurfaces,
    };
    const taskVersion = serviceTaskVersionRecordSchema.parse({
      taskVersionId,
      ...immutableContent,
      contentSha256: createHash("sha256").update(JSON.stringify(immutableContent)).digest("hex"),
      createdByUserId: actor.userId,
      createdAt: at,
    });

    await taskVersionsRepository.create(taskVersion);
    await workshopCatalogRepository.saveWorkshopService({
      workshop: workshopRecord,
      service: serviceRecord,
    });
    await sessionProjectsService.recordCatalogAssets(project.currentSessionVersionId, {
      workshopId,
      serviceId,
    });

    const { visibleInContexts: _workshopContexts, ...workshop } = workshopRecord;
    const { visibleInContexts: _serviceContexts, ...service } = serviceRecord;
    return createWorkshopServiceBundleResponseSchema.parse({ workshop, service, taskVersion });
  }

  async listTaskVersions(serviceId: string, actor: CatalogWriteActor) {
    const service = workshopCatalogRepository.getServiceById(serviceId);
    if (!service || !service.visibleInContexts.includes(actor.workspaceContextKey)) {
      throw new AppError(404, "SERVICE_NOT_FOUND", `Service not found: ${serviceId}`);
    }
    return taskVersionsRepository.listByServiceId(serviceId);
  }

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
    if (
      !workshop ||
      !workshop.visibleInContexts.includes(context.contextKey) ||
      workshop.status !== "active" ||
      !isWorkspaceOwnedVisible(workshop.ownerWorkspaceId, workshop.visibility, query.workspaceId)
    ) {
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
    if (!service) {
      throw new AppError(404, "SERVICE_NOT_FOUND", `Service not found: ${serviceId}`);
    }
    const workshop = workshopCatalogRepository.getWorkshopById(service.workshopId);
    if (
      !service ||
      !workshop ||
      !service.visibleInContexts.includes(context.contextKey) ||
      !workshop.visibleInContexts.includes(context.contextKey) ||
      service.status !== "active" ||
      workshop.status !== "active" ||
      !isWorkspaceOwnedVisible(workshop.ownerWorkspaceId, workshop.visibility, query.workspaceId) ||
      !isWorkspaceOwnedVisible(service.ownerWorkspaceId, workshop.visibility, query.workspaceId)
    ) {
      throw new AppError(404, "SERVICE_NOT_FOUND", `Service not found: ${serviceId}`);
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
          isWorkspaceOwnedVisible(item.ownerWorkspaceId, item.visibility, parsed.workspaceId) &&
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
      .map(({ visibleInContexts, ownerWorkspaceId, ...item }) => item);
  }

  getWorkshop(workshopId: string, query: Pick<ListWorkshopsQuery, "workspaceContextKey" | "workspaceId" | "entrySurface">) {
    const { context, workshop } = this.#ensureVisibleWorkshop(workshopId, query);
    const services = workshopCatalogRepository
      .listServices()
      .filter(
        (item) =>
          item.workshopId === workshop.workshopId &&
          item.status === "active" &&
          item.visibleInContexts.includes(context.contextKey) &&
          isWorkspaceOwnedVisible(item.ownerWorkspaceId, workshop.visibility, query.workspaceId)
      )
      .map(({ visibleInContexts, ownerWorkspaceId, ...item }) => item);

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
        (item) => {
          const workshop = workshopCatalogRepository.getWorkshopById(item.workshopId);
          return item.status === "active" &&
          item.visibleInContexts.includes(context.contextKey) &&
          Boolean(workshop) &&
          workshop!.status === "active" &&
          workshop!.visibleInContexts.includes(context.contextKey) &&
          isWorkspaceOwnedVisible(workshop!.ownerWorkspaceId, workshop!.visibility, parsed.workspaceId) &&
          isWorkspaceOwnedVisible(item.ownerWorkspaceId, workshop!.visibility, parsed.workspaceId) &&
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
          ]);
        }
      )
      .map(({ visibleInContexts, ownerWorkspaceId, ...item }) => item);
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
  await Promise.all([
    workshopCatalogRepository.init(),
    taskVersionsRepository.init(),
  ]);
}

export const workshopCatalogService = new WorkshopCatalogService();
