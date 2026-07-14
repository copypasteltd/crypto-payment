import { z } from "zod";
import {
  credentialIdSchema,
  isoDatetimeSchema,
  providerIdSchema,
  queryBooleanSchema,
  workspaceIdSchema,
  workspaceProviderBindingIdSchema,
} from "./common.js";

export const providerAdapterModeSchema = z.enum(["openai-compatible", "gateway"]);
export const providerApiStyleSchema = z.enum(["openai-compatible", "gateway"]);
export const providerHealthStatusSchema = z.enum([
  "healthy",
  "auth_required",
  "degraded",
  "unreachable",
]);

export const providerHealthSummarySchema = z.object({
  checkedAt: isoDatetimeSchema,
  healthcheckUrl: z.string().url(),
  status: providerHealthStatusSchema,
  reachable: z.boolean(),
  httpStatus: z.number().int().min(100).max(599).nullable().default(null),
  responseTimeMs: z.number().int().nonnegative().nullable().default(null),
  errorMessage: z.string().trim().min(1).max(2000).nullable().default(null),
});

export const providerCapabilitiesSchema = z.object({
  stream: z.boolean().default(true),
  toolCalling: z.boolean().default(true),
  responsesApi: z.boolean().default(true),
  longSession: z.boolean().default(true),
});

const defaultProviderCapabilities = {
  stream: true,
  toolCalling: true,
  responsesApi: true,
  longSession: true,
} as const;

export const providerModelSchema = z.object({
  model: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160).nullable().default(null),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  capabilities: providerCapabilitiesSchema.default(defaultProviderCapabilities),
});

export const providerProfileSchema = z.object({
  providerId: providerIdSchema,
  displayName: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).nullable().default(null),
  enabled: z.boolean().default(true),
  adapterMode: providerAdapterModeSchema.default("openai-compatible"),
  apiStyle: providerApiStyleSchema.default("openai-compatible"),
  baseUrl: z.string().url(),
  authEnvName: z.string().trim().min(1).max(120).default("OPENAI_API_KEY"),
  baseUrlEnvName: z.string().trim().min(1).max(120).default("OPENAI_BASE_URL"),
  modelEnvName: z.string().trim().min(1).max(120).default("OPENAI_MODEL"),
  defaultModel: z.string().trim().min(1).max(160),
  models: z.array(providerModelSchema).default([]),
  allowCustomModel: z.boolean().default(false),
  extraAllowedBaseUrls: z.array(z.string().url()).default([]),
  healthcheckPath: z.string().trim().min(1).max(240).nullable().default("/models"),
  capabilities: providerCapabilitiesSchema.default(defaultProviderCapabilities),
  lastHealthcheck: providerHealthSummarySchema.nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const createProviderInputSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).nullable().optional(),
  enabled: z.boolean().optional(),
  adapterMode: providerAdapterModeSchema.optional(),
  apiStyle: providerApiStyleSchema.optional(),
  baseUrl: z.string().url(),
  authEnvName: z.string().trim().min(1).max(120).optional(),
  baseUrlEnvName: z.string().trim().min(1).max(120).optional(),
  modelEnvName: z.string().trim().min(1).max(120).optional(),
  defaultModel: z.string().trim().min(1).max(160),
  models: z.array(providerModelSchema).optional(),
  allowCustomModel: z.boolean().optional(),
  extraAllowedBaseUrls: z.array(z.string().url()).optional(),
  healthcheckPath: z.string().trim().min(1).max(240).nullable().optional(),
  capabilities: providerCapabilitiesSchema.optional(),
});

export const updateProviderInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    enabled: z.boolean().optional(),
    adapterMode: providerAdapterModeSchema.optional(),
    apiStyle: providerApiStyleSchema.optional(),
    baseUrl: z.string().url().optional(),
    authEnvName: z.string().trim().min(1).max(120).optional(),
    baseUrlEnvName: z.string().trim().min(1).max(120).optional(),
    modelEnvName: z.string().trim().min(1).max(120).optional(),
    defaultModel: z.string().trim().min(1).max(160).optional(),
    models: z.array(providerModelSchema).optional(),
    allowCustomModel: z.boolean().optional(),
    extraAllowedBaseUrls: z.array(z.string().url()).optional(),
    healthcheckPath: z.string().trim().min(1).max(240).nullable().optional(),
    capabilities: providerCapabilitiesSchema.optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one provider field must be updated"
  );

export const listProvidersQuerySchema = z.object({
  enabled: queryBooleanSchema.optional(),
});

export const providerIdParamsSchema = z.object({
  providerId: providerIdSchema,
});

export const workspaceProviderBindingSchema = z.object({
  bindingId: workspaceProviderBindingIdSchema,
  workspaceId: workspaceIdSchema,
  providerId: providerIdSchema,
  credentialId: credentialIdSchema,
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  priority: z.number().int().min(0).max(1000).default(100),
  allowUserOverride: z.boolean().default(true),
  notes: z.string().trim().max(2000).nullable().default(null),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const createWorkspaceProviderBindingInputSchema = z.object({
  providerId: providerIdSchema,
  credentialId: credentialIdSchema,
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  allowUserOverride: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateWorkspaceProviderBindingInputSchema = z
  .object({
    credentialId: credentialIdSchema.optional(),
    enabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    allowUserOverride: z.boolean().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one workspace provider binding field must be updated"
  );

export const listWorkspaceProviderBindingsQuerySchema = z.object({
  providerId: providerIdSchema.optional(),
  enabled: queryBooleanSchema.optional(),
});

export const workspaceProviderBindingIdParamsSchema = z.object({
  bindingId: workspaceProviderBindingIdSchema,
});

export const runProviderSelectionSchema = z
  .object({
    providerId: providerIdSchema.optional(),
    model: z.string().trim().min(1).max(160).optional(),
  })
  .refine(
    (value) => value.providerId !== undefined || value.model !== undefined,
    "Run provider selection requires providerId or model"
  );

export const resolvedRunProviderSchema = z.object({
  providerId: providerIdSchema,
  bindingId: workspaceProviderBindingIdSchema,
  displayName: z.string().trim().min(1).max(160),
  adapterMode: providerAdapterModeSchema,
  apiStyle: providerApiStyleSchema,
  baseUrl: z.string().url(),
  model: z.string().trim().min(1).max(160),
  credentialId: credentialIdSchema,
  authEnvName: z.string().trim().min(1).max(120),
  baseUrlEnvName: z.string().trim().min(1).max(120),
  modelEnvName: z.string().trim().min(1).max(120),
  runtimeEnv: z.record(z.string(), z.string()).default({}),
  allowedBaseUrls: z.array(z.string().url()).default([]),
  resolvedAt: isoDatetimeSchema,
});

export const providerHealthcheckResultSchema = z.object({
  providerId: providerIdSchema,
  displayName: z.string().trim().min(1).max(160),
  baseUrl: z.string().url(),
  healthcheck: providerHealthSummarySchema,
});

export type ProviderAdapterMode = z.infer<typeof providerAdapterModeSchema>;
export type ProviderApiStyle = z.infer<typeof providerApiStyleSchema>;
export type ProviderHealthStatus = z.infer<typeof providerHealthStatusSchema>;
export type ProviderHealthSummary = z.infer<typeof providerHealthSummarySchema>;
export type ProviderCapabilities = z.infer<typeof providerCapabilitiesSchema>;
export type ProviderModel = z.infer<typeof providerModelSchema>;
export type ProviderProfile = z.infer<typeof providerProfileSchema>;
export type CreateProviderInput = z.infer<typeof createProviderInputSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderInputSchema>;
export type ListProvidersQuery = z.infer<typeof listProvidersQuerySchema>;
export type WorkspaceProviderBinding = z.infer<typeof workspaceProviderBindingSchema>;
export type CreateWorkspaceProviderBindingInput = z.infer<
  typeof createWorkspaceProviderBindingInputSchema
>;
export type UpdateWorkspaceProviderBindingInput = z.infer<
  typeof updateWorkspaceProviderBindingInputSchema
>;
export type ListWorkspaceProviderBindingsQuery = z.infer<
  typeof listWorkspaceProviderBindingsQuerySchema
>;
export type RunProviderSelection = z.infer<typeof runProviderSelectionSchema>;
export type ResolvedRunProvider = z.infer<typeof resolvedRunProviderSchema>;
export type ProviderHealthcheckResult = z.infer<typeof providerHealthcheckResultSchema>;
