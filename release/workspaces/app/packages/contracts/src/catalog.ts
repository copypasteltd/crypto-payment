import { z } from "zod";
import { entrySurfaceSchema, sessionVersionIdSchema, taskVersionIdSchema, workspaceIdSchema } from "./common.js";
import { createRunBindingSchema, createRunInputSchema } from "./runs.js";

export const localizedTextSchema = z.object({
  zh: z.string().min(1),
  en: z.string().min(1),
});

export const workshopScopeSchema = z.enum(["enterprise", "content", "creative", "personal"]);
export const catalogVisibilitySchema = z.enum(["private", "workspace", "public", "marketplace"]);
export const catalogStatusSchema = z.enum(["draft", "active", "hidden", "archived"]);
export const serviceLaunchModeSchema = z.enum([
  "instant-conversation",
  "form-first",
  "approval-first",
]);
export const workspaceContextTypeSchema = z.enum(["personal", "team", "enterprise"]);
export const workspaceContextKeySchema = z.string().trim().min(1).max(120);
export const workshopIdSchema = z.string().trim().min(1).max(120);
export const serviceIdSchema = z.string().trim().min(1).max(120);

export const workspaceContextSummarySchema = z.object({
  contextKey: workspaceContextKeySchema,
  runtimeWorkspaceId: workspaceIdSchema,
  displayName: localizedTextSchema,
  type: workspaceContextTypeSchema,
  meta: localizedTextSchema,
  root: z.string().min(1),
  allowedEntrySurfaces: z.array(entrySurfaceSchema).min(1),
});

export const workshopCatalogEntrySchema = z.object({
  workshopId: workshopIdSchema,
  scope: workshopScopeSchema,
  status: catalogStatusSchema,
  visibility: catalogVisibilitySchema,
  displayName: localizedTextSchema,
  ownerLabel: localizedTextSchema,
  badge: localizedTextSchema,
  audience: localizedTextSchema,
  summary: localizedTextSchema,
  nextStepSummary: localizedTextSchema,
  coverAssetUrl: z.string().min(1),
  tagList: z.array(z.string().min(1)).default([]),
  defaultServiceId: serviceIdSchema,
});

export const serviceCatalogEntrySchema = z.object({
  serviceId: serviceIdSchema,
  workshopId: workshopIdSchema,
  status: catalogStatusSchema,
  displayName: localizedTextSchema,
  summary: localizedTextSchema,
  authRequirementText: localizedTextSchema,
  estimatedDuration: z.string().min(1),
  targetPathHint: z.string().min(1),
  outputContractSummary: localizedTextSchema,
  launchMode: serviceLaunchModeSchema,
  requiredBindings: createRunBindingSchema,
  linkedInstanceHint: z.string().trim().min(1).nullable().default(null),
});

export const workshopDetailSchema = workshopCatalogEntrySchema.extend({
  services: z.array(serviceCatalogEntrySchema).default([]),
});

export const serviceDetailSchema = serviceCatalogEntrySchema.extend({
  workshop: workshopCatalogEntrySchema,
});

export const serviceLaunchTemplateResolutionSourceSchema = z.enum([
  "catalog-default",
  "creator-activation",
]);

export const serviceLaunchTemplateResolutionSchema = z.object({
  source: serviceLaunchTemplateResolutionSourceSchema,
  packageId: z.string().trim().min(1).nullable().default(null),
  releaseId: z.string().trim().min(1).nullable().default(null),
  activationId: z.string().trim().min(1).nullable().default(null),
});

export const serviceLaunchTemplateSchema = z.object({
  serviceId: serviceIdSchema,
  workspaceContext: workspaceContextSummarySchema,
  taskVersionId: taskVersionIdSchema,
  sessionVersionId: sessionVersionIdSchema,
  title: localizedTextSchema,
  targetRoot: z.string().min(1),
  initialMessagePolicy: z.literal("system-collects-required-info"),
  resolution: serviceLaunchTemplateResolutionSchema.default({
    source: "catalog-default",
    packageId: null,
    releaseId: null,
    activationId: null,
  }),
  createRunInput: createRunInputSchema,
});

export const listWorkshopsQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  workspaceId: workspaceIdSchema.optional(),
  entrySurface: entrySurfaceSchema.optional(),
  q: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).optional(),
  scope: workshopScopeSchema.optional(),
});

export const listServicesQuerySchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  workspaceId: workspaceIdSchema.optional(),
  workshopId: workshopIdSchema.optional(),
  entrySurface: entrySurfaceSchema.optional(),
  q: z.string().trim().min(1).optional(),
});

export const createServiceLaunchTemplateInputSchema = z.object({
  workspaceContextKey: workspaceContextKeySchema.optional(),
  workspaceId: workspaceIdSchema.optional(),
  entrySurface: entrySurfaceSchema,
});

export type LocalizedText = z.infer<typeof localizedTextSchema>;
export type WorkshopScope = z.infer<typeof workshopScopeSchema>;
export type CatalogVisibility = z.infer<typeof catalogVisibilitySchema>;
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
export type ServiceLaunchMode = z.infer<typeof serviceLaunchModeSchema>;
export type WorkspaceContextType = z.infer<typeof workspaceContextTypeSchema>;
export type WorkspaceContextSummary = z.infer<typeof workspaceContextSummarySchema>;
export type WorkshopCatalogEntry = z.infer<typeof workshopCatalogEntrySchema>;
export type ServiceCatalogEntry = z.infer<typeof serviceCatalogEntrySchema>;
export type WorkshopDetail = z.infer<typeof workshopDetailSchema>;
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;
export type ServiceLaunchTemplateResolutionSource = z.infer<
  typeof serviceLaunchTemplateResolutionSourceSchema
>;
export type ServiceLaunchTemplateResolution = z.infer<typeof serviceLaunchTemplateResolutionSchema>;
export type ServiceLaunchTemplate = z.infer<typeof serviceLaunchTemplateSchema>;
export type ListWorkshopsQuery = z.infer<typeof listWorkshopsQuerySchema>;
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type CreateServiceLaunchTemplateInput = z.infer<typeof createServiceLaunchTemplateInputSchema>;
