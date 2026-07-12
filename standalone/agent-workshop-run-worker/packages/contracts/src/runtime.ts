import { z } from "zod";
import {
  connectorSourceSchema,
  connectorTransportSchema,
  credentialIdSchema,
  credentialMountModeSchema,
  mcpBindingIdSchema,
  userIdSchema,
  runIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
  entrySurfaceSchema,
  workspaceIdSchema,
} from "./common.js";
import {
  mcpIdSchema,
  mcpNetworkPolicySchema,
  mcpRiskLevelSchema,
  mcpStdioPolicySchema,
} from "./mcp.js";

export const envCredentialMountSchema = z.object({
  credentialId: credentialIdSchema,
  mode: z.literal("env"),
  envName: z.string().min(1),
  readOnly: z.literal(true),
});

export const fileCredentialMountSchema = z.object({
  credentialId: credentialIdSchema,
  mode: z.literal("file"),
  mountPath: z.string().min(1),
  readOnly: z.literal(true),
});

export const credentialMountSchema = z.discriminatedUnion("mode", [
  envCredentialMountSchema,
  fileCredentialMountSchema,
]);

export const mcpBindingSchema = z.object({
  bindingId: mcpBindingIdSchema,
  mcpId: mcpIdSchema,
  displayName: z.string().min(1).max(160),
  source: connectorSourceSchema,
  transport: connectorTransportSchema,
  ref: z.string().min(1),
  riskLevel: mcpRiskLevelSchema,
  stdioPolicy: mcpStdioPolicySchema.nullable().optional().default(null),
  credentialId: credentialIdSchema.nullable().optional().default(null),
  authMode: credentialMountModeSchema.nullable().optional().default(null),
  authRef: z.string().min(1).nullable().optional().default(null),
  networkPolicyRef: z.string().min(1).nullable().optional().default(null),
  approvalRequired: z.boolean().default(false),
});

export const bridgeSessionContextSchema = z.object({
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  requestedByUserId: userIdSchema.nullable().default(null),
  taskVersionId: taskVersionIdSchema.nullable().default(null),
  sessionVersionId: sessionVersionIdSchema.nullable().default(null),
  entrySurface: entrySurfaceSchema.nullable().default(null),
  workspaceContextKey: z.string().min(1).nullable().default(null),
  serviceId: z.string().min(1).nullable().default(null),
  targetPath: z.string().min(1),
  initialPrompt: z.string().min(1),
  requestedInitialMessage: z.string().min(1).nullable().default(null),
  credentialMounts: z.array(credentialMountSchema).default([]),
  mcpBindings: z.array(mcpBindingSchema).default([]),
  mcpNetworkPolicies: z.array(mcpNetworkPolicySchema).default([]),
});

export type EnvCredentialMount = z.infer<typeof envCredentialMountSchema>;
export type FileCredentialMount = z.infer<typeof fileCredentialMountSchema>;
export type CredentialMount = z.infer<typeof credentialMountSchema>;
export type McpBinding = z.infer<typeof mcpBindingSchema>;
export type BridgeSessionContext = z.infer<typeof bridgeSessionContextSchema>;
