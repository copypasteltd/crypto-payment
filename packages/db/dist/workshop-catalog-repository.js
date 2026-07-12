import { createRunBindingSchema, entrySurfaceSchema, localizedTextSchema, serviceCatalogEntrySchema, serviceIdSchema, sessionVersionIdSchema, taskVersionIdSchema, workshopCatalogEntrySchema, workshopIdSchema, workspaceContextKeySchema, workspaceContextSummarySchema, } from "@lingban/contracts";
import { z } from "zod";
export const workshopCatalogRecordSchema = workshopCatalogEntrySchema.extend({
    visibleInContexts: z.array(workspaceContextKeySchema).min(1),
});
export const serviceCatalogRecordSchema = serviceCatalogEntrySchema.extend({
    visibleInContexts: z.array(workspaceContextKeySchema).min(1),
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
function replaceByKey(items, nextItem, getKey) {
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
export class CachedWorkshopCatalogRepository {
    #initialized = false;
    #state = catalogStateSchema.parse({
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
    getContextByKey(contextKey) {
        return this.#state.contexts.find((item) => item.contextKey === contextKey) ?? null;
    }
    getContextByRuntimeWorkspaceId(workspaceId) {
        return this.#state.contexts.find((item) => item.runtimeWorkspaceId === workspaceId) ?? null;
    }
    listWorkshops() {
        return [...this.#state.workshops].sort((left, right) => left.workshopId.localeCompare(right.workshopId));
    }
    getWorkshopById(workshopId) {
        return this.#state.workshops.find((item) => item.workshopId === workshopId) ?? null;
    }
    listServices() {
        return [...this.#state.services].sort((left, right) => left.serviceId.localeCompare(right.serviceId));
    }
    getServiceById(serviceId) {
        return this.#state.services.find((item) => item.serviceId === serviceId) ?? null;
    }
    listLaunchTemplates() {
        return [...this.#state.launchTemplates].sort((left, right) => left.templateKey.localeCompare(right.templateKey));
    }
    findLaunchTemplate(serviceId, workspaceContextKey, entrySurface) {
        return (this.#state.launchTemplates.find((item) => item.serviceId === serviceId &&
            item.workspaceContextKey === workspaceContextKey &&
            item.entrySurface === entrySurface) ?? null);
    }
    async saveLaunchTemplate(template) {
        await this.init();
        await this.updateState((state) => ({
            ...state,
            launchTemplates: replaceByKey(state.launchTemplates, launchTemplateRecordSchema.parse(template), (item) => item.templateKey),
        }));
    }
    async deleteLaunchTemplates(templateKeys) {
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
    async replaceState(state) {
        const nextState = catalogStateSchema.parse(state);
        this.#state = nextState;
        await this.writeState(nextState);
    }
    getState() {
        return this.#state;
    }
    async updateState(mutator) {
        const nextState = catalogStateSchema.parse(mutator(this.#state));
        this.#state = nextState;
        await this.writeState(nextState);
    }
}
export class PostgresWorkshopCatalogRepository extends CachedWorkshopCatalogRepository {
    #options;
    constructor(options) {
        super();
        this.#options = options;
    }
    async #getQueryable() {
        await this.#options.ensureReady?.();
        return this.#options.getQueryable();
    }
    async loadState() {
        const queryable = await this.#getQueryable();
        const [contexts, workshops, services, launchTemplates] = await Promise.all([
            queryable.query("SELECT context_json FROM lingban_workshop_contexts ORDER BY context_key ASC"),
            queryable.query("SELECT workshop_json FROM lingban_catalog_workshops ORDER BY workshop_id ASC"),
            queryable.query("SELECT service_json FROM lingban_catalog_services ORDER BY service_id ASC"),
            queryable.query("SELECT template_json FROM lingban_catalog_launch_templates ORDER BY template_key ASC"),
        ]);
        return catalogStateSchema.parse({
            contexts: contexts.rows.map((row) => row.context_json),
            workshops: workshops.rows.map((row) => row.workshop_json),
            services: services.rows.map((row) => row.service_json),
            launchTemplates: launchTemplates.rows.map((row) => launchTemplateRecordSchema.parse(row.template_json)),
        });
    }
    async writeState(state) {
        const parsed = catalogStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_catalog_launch_templates");
            await queryable.query("DELETE FROM lingban_catalog_services");
            await queryable.query("DELETE FROM lingban_catalog_workshops");
            await queryable.query("DELETE FROM lingban_workshop_contexts");
            for (const context of parsed.contexts) {
                await queryable.query(`
          INSERT INTO lingban_workshop_contexts (context_key, runtime_workspace_id, context_json)
          VALUES ($1, $2, $3::jsonb)
          `, [context.contextKey, context.runtimeWorkspaceId, JSON.stringify(context)]);
            }
            for (const workshop of parsed.workshops) {
                await queryable.query(`
          INSERT INTO lingban_catalog_workshops (workshop_id, scope, status, workshop_json)
          VALUES ($1, $2, $3, $4::jsonb)
          `, [workshop.workshopId, workshop.scope, workshop.status, JSON.stringify(workshop)]);
            }
            for (const service of parsed.services) {
                await queryable.query(`
          INSERT INTO lingban_catalog_services (service_id, workshop_id, status, service_json)
          VALUES ($1, $2, $3, $4::jsonb)
          `, [service.serviceId, service.workshopId, service.status, JSON.stringify(service)]);
            }
            for (const template of parsed.launchTemplates) {
                await queryable.query(`
          INSERT INTO lingban_catalog_launch_templates (
            template_key,
            service_id,
            workspace_context_key,
            entry_surface,
            template_json
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
          `, [
                    template.templateKey,
                    template.serviceId,
                    template.workspaceContextKey,
                    template.entrySurface,
                    JSON.stringify(template),
                ]);
            }
        });
    }
}
//# sourceMappingURL=workshop-catalog-repository.js.map