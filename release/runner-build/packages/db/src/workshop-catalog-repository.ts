import type { EntrySurface, WorkspaceContextSummary } from "@lingban/contracts";
import {
  createRunBindingSchema,
  entrySurfaceSchema,
  localizedTextSchema,
  serviceCatalogEntrySchema,
  serviceIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  workshopCatalogEntrySchema,
  workshopIdSchema,
  workspaceContextKeySchema,
  workspaceContextSummarySchema,
  workspaceIdSchema,
} from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export const workshopCatalogRecordSchema = workshopCatalogEntrySchema.extend({
  visibleInContexts: z.array(workspaceContextKeySchema).min(1),
  ownerWorkspaceId: workspaceIdSchema.nullable().default(null),
});

export const serviceCatalogRecordSchema = serviceCatalogEntrySchema.extend({
  visibleInContexts: z.array(workspaceContextKeySchema).min(1),
  ownerWorkspaceId: workspaceIdSchema.nullable().default(null),
});

export const launchTemplateRecordSchema = z.object({
  templateKey: z.string().min(1),
  serviceId: serviceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  entrySurface: entrySurfaceSchema,
  taskVersionId: taskVersionIdSchema,
  sessionVersionId: sessionVersionIdSchema,
  title: localizedTextSchema,
  targetRoot: z.string().min(1),
  bindings: createRunBindingSchema,
});

export const catalogStateSchema = z.object({
  contexts: z.array(workspaceContextSummarySchema),
  workshops: z.array(workshopCatalogRecordSchema),
  services: z.array(serviceCatalogRecordSchema),
  launchTemplates: z.array(launchTemplateRecordSchema),
});

export const workshopIdParamsSchema = z.object({
  workshopId: workshopIdSchema,
});

export const serviceIdParamsSchema = z.object({
  serviceId: serviceIdSchema,
});

export type WorkshopCatalogRecord = z.infer<typeof workshopCatalogRecordSchema>;
export type ServiceCatalogRecord = z.infer<typeof serviceCatalogRecordSchema>;
export type LaunchTemplateRecord = z.infer<typeof launchTemplateRecordSchema>;
export type CatalogState = z.infer<typeof catalogStateSchema>;

export interface WorkshopCatalogRepository {
  init(): Promise<void>;
  listContexts(): WorkspaceContextSummary[];
  getContextByKey(contextKey: string): WorkspaceContextSummary | null;
  getContextByRuntimeWorkspaceId(workspaceId: string): WorkspaceContextSummary | null;
  listWorkshops(): WorkshopCatalogRecord[];
  getWorkshopById(workshopId: string): WorkshopCatalogRecord | null;
  saveWorkshop(workshop: WorkshopCatalogRecord): Promise<WorkshopCatalogRecord>;
  listServices(): ServiceCatalogRecord[];
  getServiceById(serviceId: string): ServiceCatalogRecord | null;
  saveService(service: ServiceCatalogRecord): Promise<ServiceCatalogRecord>;
  saveWorkshopService(input: {
    workshop: WorkshopCatalogRecord;
    service: ServiceCatalogRecord;
  }): Promise<{ workshop: WorkshopCatalogRecord; service: ServiceCatalogRecord }>;
  activateWorkshopService(workshopId: string, serviceId: string): Promise<{
    workshop: WorkshopCatalogRecord;
    service: ServiceCatalogRecord;
  }>;
  listLaunchTemplates(): LaunchTemplateRecord[];
  findLaunchTemplate(
    serviceId: string,
    workspaceContextKey: string,
    entrySurface: EntrySurface
  ): LaunchTemplateRecord | null;
  saveLaunchTemplate(template: LaunchTemplateRecord): Promise<void>;
  deleteLaunchTemplates(templateKeys: string[]): Promise<void>;
}

function replaceByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const key = getKey(nextItem);
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex((item) => getKey(item) === key);

  if (existingIndex >= 0) {
    nextItems[existingIndex] = nextItem;
    return nextItems;
  }

  nextItems.push(nextItem);
  return nextItems;
}

export abstract class CachedWorkshopCatalogRepository implements WorkshopCatalogRepository {
  #initialized = false;
  #state: CatalogState = catalogStateSchema.parse({
    contexts: [],
    workshops: [],
    services: [],
    launchTemplates: [],
  });

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = catalogStateSchema.parse(await this.loadState());
    this.#initialized = true;
  }

  listContexts() {
    return [...this.#state.contexts].sort((left, right) => left.contextKey.localeCompare(right.contextKey));
  }

  getContextByKey(contextKey: string) {
    return this.#state.contexts.find((item) => item.contextKey === contextKey) ?? null;
  }

  getContextByRuntimeWorkspaceId(workspaceId: string) {
    return this.#state.contexts.find((item) => item.runtimeWorkspaceId === workspaceId) ?? null;
  }

  listWorkshops() {
    return [...this.#state.workshops].sort((left, right) => left.workshopId.localeCompare(right.workshopId));
  }

  getWorkshopById(workshopId: string) {
    return this.#state.workshops.find((item) => item.workshopId === workshopId) ?? null;
  }

  async saveWorkshop(workshop: WorkshopCatalogRecord) {
    await this.init();
    const parsed = workshopCatalogRecordSchema.parse(workshop);
    await this.updateState((state) => ({
      ...state,
      workshops: replaceByKey(state.workshops, parsed, (item) => item.workshopId),
    }));
    return parsed;
  }

  listServices() {
    return [...this.#state.services].sort((left, right) => left.serviceId.localeCompare(right.serviceId));
  }

  getServiceById(serviceId: string) {
    return this.#state.services.find((item) => item.serviceId === serviceId) ?? null;
  }

  async saveService(service: ServiceCatalogRecord) {
    await this.init();
    const parsed = serviceCatalogRecordSchema.parse(service);
    await this.updateState((state) => ({
      ...state,
      services: replaceByKey(state.services, parsed, (item) => item.serviceId),
    }));
    return parsed;
  }

  async saveWorkshopService(input: {
    workshop: WorkshopCatalogRecord;
    service: ServiceCatalogRecord;
  }) {
    await this.init();
    const workshop = workshopCatalogRecordSchema.parse(input.workshop);
    const service = serviceCatalogRecordSchema.parse(input.service);
    if (service.workshopId !== workshop.workshopId) {
      throw new Error(`Catalog Workshop/Service binding mismatch: ${workshop.workshopId}/${service.serviceId}`);
    }
    await this.updateState((state) => ({
      ...state,
      workshops: replaceByKey(state.workshops, workshop, (item) => item.workshopId),
      services: replaceByKey(state.services, service, (item) => item.serviceId),
    }));
    return { workshop, service };
  }

  async activateWorkshopService(workshopId: string, serviceId: string) {
    await this.init();
    const workshop = this.getWorkshopById(workshopId);
    const service = this.getServiceById(serviceId);
    if (!workshop || !service || service.workshopId !== workshop.workshopId) {
      throw new Error(`Catalog Workshop/Service binding not found: ${workshopId}/${serviceId}`);
    }
    const activeWorkshop = workshopCatalogRecordSchema.parse({ ...workshop, status: "active" });
    const activeService = serviceCatalogRecordSchema.parse({ ...service, status: "active" });
    await this.updateState((state) => ({
      ...state,
      workshops: replaceByKey(state.workshops, activeWorkshop, (item) => item.workshopId),
      services: replaceByKey(state.services, activeService, (item) => item.serviceId),
    }));
    return { workshop: activeWorkshop, service: activeService };
  }

  listLaunchTemplates() {
    return [...this.#state.launchTemplates].sort((left, right) => left.templateKey.localeCompare(right.templateKey));
  }

  findLaunchTemplate(serviceId: string, workspaceContextKey: string, entrySurface: EntrySurface) {
    return (
      this.#state.launchTemplates.find(
        (item) =>
          item.serviceId === serviceId &&
          item.workspaceContextKey === workspaceContextKey &&
          item.entrySurface === entrySurface
      ) ?? null
    );
  }

  async saveLaunchTemplate(template: LaunchTemplateRecord) {
    await this.init();
    await this.updateState((state) => ({
      ...state,
      launchTemplates: replaceByKey(
        state.launchTemplates,
        launchTemplateRecordSchema.parse(template),
        (item) => item.templateKey
      ),
    }));
  }

  async deleteLaunchTemplates(templateKeys: string[]) {
    await this.init();
    const keySet = new Set(templateKeys.filter((item) => item.length > 0));
    if (keySet.size === 0) {
      return;
    }

    await this.updateState((state) => ({
      ...state,
      launchTemplates: state.launchTemplates.filter((item) => !keySet.has(item.templateKey)),
    }));
  }

  protected async replaceState(state: CatalogState) {
    const nextState = catalogStateSchema.parse(state);
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected getState() {
    return this.#state;
  }

  protected updateCachedState(mutator: (state: CatalogState) => CatalogState) {
    this.#state = catalogStateSchema.parse(mutator(this.#state));
  }

  protected async updateState(mutator: (state: CatalogState) => CatalogState) {
    this.updateCachedState(mutator);
    await this.writeState(this.#state);
  }

  protected abstract loadState(): Promise<CatalogState>;
  protected abstract writeState(state: CatalogState): Promise<void>;
}

export interface PostgresWorkshopCatalogRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresWorkshopCatalogRepository extends CachedWorkshopCatalogRepository {
  #options: PostgresWorkshopCatalogRepositoryOptions;

  constructor(options: PostgresWorkshopCatalogRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  async #upsertWorkshop(queryable: PostgresQueryExecutor, workshop: WorkshopCatalogRecord) {
    await queryable.query(
      `INSERT INTO lingban_catalog_workshops (workshop_id, scope, status, workshop_json)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (workshop_id) DO UPDATE
       SET scope = EXCLUDED.scope, status = EXCLUDED.status, workshop_json = EXCLUDED.workshop_json`,
      [workshop.workshopId, workshop.scope, workshop.status, JSON.stringify(workshop)]
    );
  }

  async #upsertService(queryable: PostgresQueryExecutor, service: ServiceCatalogRecord) {
    await queryable.query(
      `INSERT INTO lingban_catalog_services (service_id, workshop_id, status, service_json)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (service_id) DO UPDATE
       SET workshop_id = EXCLUDED.workshop_id, status = EXCLUDED.status, service_json = EXCLUDED.service_json`,
      [service.serviceId, service.workshopId, service.status, JSON.stringify(service)]
    );
  }

  override async saveWorkshop(workshop: WorkshopCatalogRecord) {
    await this.init();
    const parsed = workshopCatalogRecordSchema.parse(workshop);
    await this.#upsertWorkshop(await this.#getQueryable(), parsed);
    this.updateCachedState((state) => ({
      ...state,
      workshops: replaceByKey(state.workshops, parsed, (item) => item.workshopId),
    }));
    return parsed;
  }

  override async saveService(service: ServiceCatalogRecord) {
    await this.init();
    const parsed = serviceCatalogRecordSchema.parse(service);
    await this.#upsertService(await this.#getQueryable(), parsed);
    this.updateCachedState((state) => ({
      ...state,
      services: replaceByKey(state.services, parsed, (item) => item.serviceId),
    }));
    return parsed;
  }

  override async saveWorkshopService(input: {
    workshop: WorkshopCatalogRecord;
    service: ServiceCatalogRecord;
  }) {
    await this.init();
    const workshop = workshopCatalogRecordSchema.parse(input.workshop);
    const service = serviceCatalogRecordSchema.parse(input.service);
    if (service.workshopId !== workshop.workshopId) {
      throw new Error(`Catalog Workshop/Service binding mismatch: ${workshop.workshopId}/${service.serviceId}`);
    }
    await this.#options.withTransaction(async (queryable) => {
      await this.#upsertWorkshop(queryable, workshop);
      await this.#upsertService(queryable, service);
    });
    this.updateCachedState((state) => ({
      ...state,
      workshops: replaceByKey(state.workshops, workshop, (item) => item.workshopId),
      services: replaceByKey(state.services, service, (item) => item.serviceId),
    }));
    return { workshop, service };
  }

  override async activateWorkshopService(workshopId: string, serviceId: string) {
    await this.init();
    const workshop = this.getWorkshopById(workshopId);
    const service = this.getServiceById(serviceId);
    if (!workshop || !service || service.workshopId !== workshop.workshopId) {
      throw new Error(`Catalog Workshop/Service binding not found: ${workshopId}/${serviceId}`);
    }
    const activeWorkshop = workshopCatalogRecordSchema.parse({ ...workshop, status: "active" });
    const activeService = serviceCatalogRecordSchema.parse({ ...service, status: "active" });
    await this.#options.withTransaction(async (queryable) => {
      await this.#upsertWorkshop(queryable, activeWorkshop);
      await this.#upsertService(queryable, activeService);
    });
    this.updateCachedState((state) => ({
      ...state,
      workshops: replaceByKey(state.workshops, activeWorkshop, (item) => item.workshopId),
      services: replaceByKey(state.services, activeService, (item) => item.serviceId),
    }));
    return { workshop: activeWorkshop, service: activeService };
  }

  override async saveLaunchTemplate(template: LaunchTemplateRecord) {
    await this.init();
    const parsed = launchTemplateRecordSchema.parse(template);
    const queryable = await this.#getQueryable();
    await queryable.query(
      `INSERT INTO lingban_catalog_launch_templates (
         template_key, service_id, workspace_context_key, entry_surface, template_json
       ) VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (template_key) DO UPDATE
       SET service_id = EXCLUDED.service_id,
           workspace_context_key = EXCLUDED.workspace_context_key,
           entry_surface = EXCLUDED.entry_surface,
           template_json = EXCLUDED.template_json`,
      [
        parsed.templateKey,
        parsed.serviceId,
        parsed.workspaceContextKey,
        parsed.entrySurface,
        JSON.stringify(parsed),
      ]
    );
    this.updateCachedState((state) => ({
      ...state,
      launchTemplates: replaceByKey(state.launchTemplates, parsed, (item) => item.templateKey),
    }));
  }

  override async deleteLaunchTemplates(templateKeys: string[]) {
    await this.init();
    const keys = Array.from(new Set(templateKeys.filter(Boolean)));
    if (!keys.length) return;
    const queryable = await this.#getQueryable();
    await queryable.query(
      "DELETE FROM lingban_catalog_launch_templates WHERE template_key = ANY($1::text[])",
      [keys]
    );
    const keySet = new Set(keys);
    this.updateCachedState((state) => ({
      ...state,
      launchTemplates: state.launchTemplates.filter((item) => !keySet.has(item.templateKey)),
    }));
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const [contexts, workshops, services, launchTemplates] = await Promise.all([
      queryable.query<{ context_json: WorkspaceContextSummary }>(
        "SELECT context_json FROM lingban_workshop_contexts ORDER BY context_key ASC"
      ),
      queryable.query<{ workshop_json: WorkshopCatalogRecord }>(
        "SELECT workshop_json FROM lingban_catalog_workshops ORDER BY workshop_id ASC"
      ),
      queryable.query<{ service_json: ServiceCatalogRecord }>(
        "SELECT service_json FROM lingban_catalog_services ORDER BY service_id ASC"
      ),
      queryable.query<{ template_json: LaunchTemplateRecord }>(
        "SELECT template_json FROM lingban_catalog_launch_templates ORDER BY template_key ASC"
      ),
    ]);

    return catalogStateSchema.parse({
      contexts: contexts.rows.map((row) => row.context_json),
      workshops: workshops.rows.map((row) => row.workshop_json),
      services: services.rows.map((row) => row.service_json),
      launchTemplates: launchTemplates.rows.map((row) => launchTemplateRecordSchema.parse(row.template_json)),
    });
  }

  protected async writeState(state: CatalogState) {
    const parsed = catalogStateSchema.parse(state);
    await this.#options.withTransaction(async (queryable) => {
      for (const context of parsed.contexts) {
        await queryable.query(
          `
          INSERT INTO lingban_workshop_contexts (context_key, runtime_workspace_id, context_json)
          VALUES ($1, $2, $3::jsonb)
          ON CONFLICT (context_key) DO UPDATE
          SET runtime_workspace_id = EXCLUDED.runtime_workspace_id,
              context_json = EXCLUDED.context_json
          `,
          [context.contextKey, context.runtimeWorkspaceId, JSON.stringify(context)]
        );
      }

      for (const workshop of parsed.workshops) {
        await queryable.query(
          `
          INSERT INTO lingban_catalog_workshops (workshop_id, scope, status, workshop_json)
          VALUES ($1, $2, $3, $4::jsonb)
          ON CONFLICT (workshop_id) DO UPDATE
          SET scope = EXCLUDED.scope, status = EXCLUDED.status,
              workshop_json = EXCLUDED.workshop_json
          `,
          [workshop.workshopId, workshop.scope, workshop.status, JSON.stringify(workshop)]
        );
      }

      for (const service of parsed.services) {
        await queryable.query(
          `
          INSERT INTO lingban_catalog_services (service_id, workshop_id, status, service_json)
          VALUES ($1, $2, $3, $4::jsonb)
          ON CONFLICT (service_id) DO UPDATE
          SET workshop_id = EXCLUDED.workshop_id, status = EXCLUDED.status,
              service_json = EXCLUDED.service_json
          `,
          [service.serviceId, service.workshopId, service.status, JSON.stringify(service)]
        );
      }

      for (const template of parsed.launchTemplates) {
        await queryable.query(
          `
          INSERT INTO lingban_catalog_launch_templates (
            template_key,
            service_id,
            workspace_context_key,
            entry_surface,
            template_json
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
          ON CONFLICT (template_key) DO UPDATE
          SET service_id = EXCLUDED.service_id,
              workspace_context_key = EXCLUDED.workspace_context_key,
              entry_surface = EXCLUDED.entry_surface,
              template_json = EXCLUDED.template_json
          `,
          [
            template.templateKey,
            template.serviceId,
            template.workspaceContextKey,
            template.entrySurface,
            JSON.stringify(template),
          ]
        );
      }
    });
  }
}
