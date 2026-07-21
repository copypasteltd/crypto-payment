import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createCreatorSourceRunInputSchema,
  createSessionProjectInputSchema,
  listSessionProjectsQuerySchema,
  sessionProjectRecordSchema,
  updateSessionProjectInputSchema,
  type CreateCreatorSourceRunInput,
  type CreateSessionProjectInput,
  type ListSessionProjectsQuery,
  type SessionProjectRecord,
  type UpdateSessionProjectInput,
} from "@lingban/contracts";
import { nowIso } from "@lingban/shared";
import { AppError } from "../../app/errors.js";
import { runsService } from "../runs/service.js";
import { sessionProjectsRepository } from "./repository.js";

type SessionProjectActor = {
  userId: string;
  workspaceId: string;
  workspaceContextKey: string;
};

function nextSessionProjectId() {
  return `spj_${randomUUID()}`;
}

function buildDefaultTargetPath(actor: SessionProjectActor, sessionProjectId: string) {
  return path.posix.join(
    "/var/lib/lingban/runtime-targets",
    actor.workspaceId,
    "creator-source",
    sessionProjectId
  );
}

export class SessionProjectsService {
  async create(input: CreateSessionProjectInput, actor: SessionProjectActor) {
    const parsed = createSessionProjectInputSchema.parse(input);
    const at = nowIso();
    return sessionProjectsRepository.create(
      sessionProjectRecordSchema.parse({
        sessionProjectId: nextSessionProjectId(),
        workspaceId: actor.workspaceId,
        workspaceContextKey: actor.workspaceContextKey,
        name: parsed.name,
        description: parsed.description,
        status: "DRAFT",
        sourceRunId: null,
        currentCaptureId: null,
        currentDraftId: null,
        currentSessionVersionId: null,
        packageId: null,
        workshopId: null,
        serviceId: null,
        sourceProviderSelection: null,
        sourceBindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
        version: 1,
        createdByUserId: actor.userId,
        createdAt: at,
        updatedAt: at,
      })
    );
  }

  async get(sessionProjectId: string, actor: SessionProjectActor) {
    const project = await sessionProjectsRepository.get(sessionProjectId);
    if (!project || project.workspaceId !== actor.workspaceId) {
      throw new AppError(
        404,
        "SESSION_PROJECT_NOT_FOUND",
        `Session Project not found: ${sessionProjectId}`
      );
    }
    return project;
  }

  async list(query: ListSessionProjectsQuery, actor: SessionProjectActor) {
    const parsed = listSessionProjectsQuerySchema.parse(query);
    const normalizedQuery = parsed.q?.toLowerCase();
    const all = (await sessionProjectsRepository.listByWorkspaceId(actor.workspaceId)).filter(
      (project) =>
        project.workspaceContextKey === actor.workspaceContextKey &&
        (!parsed.status || project.status === parsed.status) &&
        (!normalizedQuery ||
          project.name.toLowerCase().includes(normalizedQuery) ||
          project.description.toLowerCase().includes(normalizedQuery) ||
          project.sessionProjectId.toLowerCase().includes(normalizedQuery))
    );
    return {
      items: all.slice(0, parsed.limit),
      total: all.length,
    };
  }

  async update(
    sessionProjectId: string,
    input: UpdateSessionProjectInput,
    actor: SessionProjectActor
  ) {
    const parsed = updateSessionProjectInputSchema.parse(input);
    const current = await this.get(sessionProjectId, actor);
    if (current.status === "ARCHIVED") {
      throw new AppError(409, "SESSION_PROJECT_ARCHIVED", "Archived Session Projects are read-only");
    }
    const next = sessionProjectRecordSchema.parse({
      ...current,
      name: parsed.name ?? current.name,
      description: parsed.description ?? current.description,
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    const saved = await sessionProjectsRepository.update(next, parsed.expectedVersion);
    if (!saved) {
      throw new AppError(
        409,
        "RESOURCE_VERSION_CONFLICT",
        `Session Project changed concurrently: ${sessionProjectId}`
      );
    }
    return saved;
  }

  async createSourceRun(input: CreateCreatorSourceRunInput, actor: SessionProjectActor) {
    const parsed = createCreatorSourceRunInputSchema.parse(input);
    const project = await this.get(parsed.sessionProjectId, actor);
    if (project.sourceRunId) {
      const existing = runsService.getRun(project.sourceRunId);
      return {
        sessionProject: project,
        run: existing.run,
        nextPrompt: existing.informationCollection.prompt,
      };
    }
    if (project.status !== "DRAFT") {
      throw new AppError(
        409,
        "SESSION_PROJECT_SOURCE_RUN_INVALID_STATE",
        `Session Project ${project.sessionProjectId} cannot start recording from ${project.status}`
      );
    }

    const created = await runsService.createRun({
      workspaceId: actor.workspaceId,
      runPurpose: "creator_source",
      sessionBootstrapMode: "blank",
      sessionProjectId: project.sessionProjectId,
      taskVersionId: null,
      sessionVersionId: null,
      draftRevisionId: null,
      requestedByUserId: actor.userId,
      title: parsed.title ?? project.name,
      targetPath:
        parsed.targetPath ?? buildDefaultTargetPath(actor, project.sessionProjectId),
      entrySurface: parsed.entrySurface,
      approvalMode: parsed.approvalMode,
      initialMessage: null,
      bindings: parsed.bindings,
      providerSelection: parsed.providerSelection,
      catalogMetadata: null,
    });

    const recordingProject = sessionProjectRecordSchema.parse({
      ...project,
      sourceRunId: created.run.runId,
      sourceProviderSelection: parsed.providerSelection,
      sourceBindings: parsed.bindings,
      status: "RECORDING",
      version: project.version + 1,
      updatedAt: nowIso(),
    });
    const savedProject = await sessionProjectsRepository.update(recordingProject, project.version);
    if (!savedProject) {
      throw new AppError(
        409,
        "RESOURCE_VERSION_CONFLICT",
        `Session Project changed while Source Run was created: ${project.sessionProjectId}`
      );
    }
    return {
      sessionProject: savedProject,
      run: created.run,
      nextPrompt: created.nextPrompt,
    };
  }

  async archive(sessionProjectId: string, actor: SessionProjectActor) {
    const current = await this.get(sessionProjectId, actor);
    if (current.status === "ARCHIVED") return current;
    const next: SessionProjectRecord = sessionProjectRecordSchema.parse({
      ...current,
      status: "ARCHIVED",
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    const saved = await sessionProjectsRepository.update(next, current.version);
    if (!saved) {
      throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Session Project changed concurrently: ${sessionProjectId}`);
    }
    return saved;
  }

  async recordCapture(runId: string, captureId: string) {
    const snapshot = runsService.getRun(runId);
    if (!snapshot.run.sessionProjectId) return null;
    const current = await sessionProjectsRepository.get(snapshot.run.sessionProjectId);
    if (!current || current.sourceRunId !== runId || current.status === "ARCHIVED") return null;
    const next = sessionProjectRecordSchema.parse({
      ...current,
      currentCaptureId: captureId,
      status: "CAPTURED",
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    return sessionProjectsRepository.update(next, current.version);
  }

  async recordDraft(runId: string, captureId: string, draftId: string) {
    const snapshot = runsService.getRun(runId);
    if (!snapshot.run.sessionProjectId) return null;
    const current = await sessionProjectsRepository.get(snapshot.run.sessionProjectId);
    if (!current || current.currentCaptureId !== captureId || current.status === "ARCHIVED") return null;
    const next = sessionProjectRecordSchema.parse({
      ...current,
      currentDraftId: draftId,
      status: "EDITING",
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    return sessionProjectsRepository.update(next, current.version);
  }

  async recordDraftProgress(
    runId: string,
    captureId: string,
    draftId: string,
    status: "EDITING" | "REPLAYING" | "READY_TO_SEAL"
  ) {
    const snapshot = runsService.getRun(runId);
    if (!snapshot.run.sessionProjectId) return null;
    const current = await sessionProjectsRepository.get(snapshot.run.sessionProjectId);
    if (
      !current ||
      current.sourceRunId !== runId ||
      current.currentCaptureId !== captureId ||
      current.status === "ARCHIVED"
    ) return null;
    const next = sessionProjectRecordSchema.parse({
      ...current,
      currentDraftId: draftId,
      status,
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    return sessionProjectsRepository.update(next, current.version);
  }

  async recordSessionVersion(
    runId: string,
    captureId: string,
    draftId: string,
    sessionVersionId: string
  ) {
    const snapshot = runsService.getRun(runId);
    if (!snapshot.run.sessionProjectId) return null;
    const current = await sessionProjectsRepository.get(snapshot.run.sessionProjectId);
    if (
      !current ||
      current.sourceRunId !== runId ||
      current.currentCaptureId !== captureId ||
      current.currentDraftId !== draftId ||
      current.status === "ARCHIVED"
    ) return null;
    const next = sessionProjectRecordSchema.parse({
      ...current,
      currentSessionVersionId: sessionVersionId,
      status: "SEALED",
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    return sessionProjectsRepository.update(next, current.version);
  }

  async recordPackage(sessionVersionId: string, packageId: string) {
    const current = await sessionProjectsRepository.findBySessionVersionId(sessionVersionId);
    if (!current || current.status === "ARCHIVED") return null;
    const next = sessionProjectRecordSchema.parse({
      ...current,
      packageId,
      status: "PACKAGED",
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    return sessionProjectsRepository.update(next, current.version);
  }

  async recordCatalogAssets(
    sessionVersionId: string,
    input: { workshopId: string; serviceId: string }
  ) {
    const current = await sessionProjectsRepository.findBySessionVersionId(sessionVersionId);
    if (!current || current.status === "ARCHIVED") return null;
    const next = sessionProjectRecordSchema.parse({
      ...current,
      workshopId: input.workshopId,
      serviceId: input.serviceId,
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    return sessionProjectsRepository.update(next, current.version);
  }

  async recordPublication(
    sessionVersionId: string,
    input: { packageId: string; workshopId: string; serviceId: string }
  ) {
    const current = await sessionProjectsRepository.findBySessionVersionId(sessionVersionId);
    if (!current || current.status === "ARCHIVED") return null;
    const next = sessionProjectRecordSchema.parse({
      ...current,
      packageId: input.packageId,
      workshopId: input.workshopId,
      serviceId: input.serviceId,
      status: "PUBLISHED",
      version: current.version + 1,
      updatedAt: nowIso(),
    });
    return sessionProjectsRepository.update(next, current.version);
  }
}

export const sessionProjectsService = new SessionProjectsService();

export async function initializeSessionProjectsInfrastructure() {
  await sessionProjectsRepository.init();
}
