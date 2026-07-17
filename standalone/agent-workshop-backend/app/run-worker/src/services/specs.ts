import { z } from "zod";
import {
  bridgeEventSchema,
  bridgeSessionContextSchema,
  credentialIdSchema,
  mcpBindingSchema,
  runIdSchema,
  startRunJobPayloadSchema,
  workspaceIdSchema,
} from "@lingban/contracts";

export const containerWorkspacePathsSchema = z.object({
  workspaceRoot: z.string().min(1),
  targetPath: z.string().min(1),
  inputsPath: z.string().min(1),
  outputsPath: z.string().min(1),
  statePath: z.string().min(1),
  runtimePath: z.string().min(1),
  codexHomePath: z.string().min(1),
  homePath: z.string().min(1),
  tmpPath: z.string().min(1),
  browserProfilePath: z.string().min(1),
  mcpPath: z.string().min(1),
  secretsPath: z.string().min(1),
  logsPath: z.string().min(1),
});

export const hostWorkspacePathsSchema = z.object({
  runRootPath: z.string().min(1),
  targetPath: z.string().min(1),
  inputsPath: z.string().min(1),
  outputsPath: z.string().min(1),
  statePath: z.string().min(1),
  runtimePath: z.string().min(1),
  codexHomePath: z.string().min(1),
  homePath: z.string().min(1),
  tmpPath: z.string().min(1),
  browserProfilePath: z.string().min(1),
  mcpPath: z.string().min(1),
  secretsPath: z.string().min(1),
  logsPath: z.string().min(1),
});

export const preparedRunWorkspaceSchema = z.object({
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  hostPaths: hostWorkspacePathsSchema,
  containerPaths: containerWorkspacePathsSchema,
});

export const runtimeEnvironmentSchema = z.record(z.string(), z.string());

export const runSecretMaterializationSchema = z.object({
  env: z.record(z.string(), z.string()),
  files: z.array(
    z.object({
      credentialId: credentialIdSchema,
      hostPath: z.string().min(1),
      containerPath: z.string().min(1),
      readOnly: z.literal(true),
    })
  ),
});

export const workerRuntimeConfigSchema = z.object({
  schemaVersion: z.literal(1),
  runId: runIdSchema,
  workspaceId: workspaceIdSchema,
  job: startRunJobPayloadSchema,
  workspace: preparedRunWorkspaceSchema,
  env: runtimeEnvironmentSchema,
  files: z.object({
    runtimeConfigPath: z.string().min(1),
    bridgeContextHostPath: z.string().min(1),
    bridgeContextContainerPath: z.string().min(1),
    mcpConfigPath: z.string().min(1),
    mcpBindingsPath: z.string().min(1),
    secretManifestPath: z.string().min(1),
    containerLaunchPlanPath: z.string().min(1),
    codexConfigPath: z.string().min(1),
  }),
});

export const containerMountSpecSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  readOnly: z.boolean().default(false),
});

export const containerEgressFirewallTargetSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  reasons: z.array(z.string().min(1)).min(1),
});

export const containerEgressFirewallPlanSchema = z.object({
  enabled: z.boolean().default(false),
  allowDns: z.boolean().default(true),
  targets: z.array(containerEgressFirewallTargetSchema).default([]),
});

export const containerRuntimeUserSchema = z.object({
  uid: z.number().int().positive(),
  gid: z.number().int().positive(),
  appliesAtCreate: z.boolean().default(false),
  dropRootInEntrypoint: z.boolean().default(false),
});

export const containerLaunchPlanSchema = z.object({
  runId: runIdSchema,
  image: z.string().min(1),
  containerName: z.string().min(1),
  workingDirectory: z.string().min(1),
  entrypoint: z.array(z.string().min(1)).min(1),
  env: runtimeEnvironmentSchema,
  labels: z.record(z.string(), z.string()),
  mounts: z.array(containerMountSpecSchema).min(1),
  extraHosts: z.array(z.string().min(1)).default([]),
  capAdd: z.array(z.string().min(1)).default([]),
  egressFirewall: containerEgressFirewallPlanSchema.default({
    enabled: false,
    allowDns: true,
    targets: [],
  }),
  runtimeUser: containerRuntimeUserSchema.nullable().default(null),
  network: z.string().min(1),
  resources: z.object({
    cpus: z.string().min(1),
    memory: z.string().min(1),
    pidsLimit: z.number().int().positive(),
  }),
  removeOnExit: z.boolean(),
  commandPreview: z.array(z.string().min(1)).min(1),
});

export const materializedMcpConfigSchema = z.object({
  servers: z.record(
    z.string(),
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("local-process"),
        command: z.string().min(1),
        args: z.array(z.string().min(1)).optional(),
        auth_env: z.string().min(1).optional(),
        auth_file: z.string().min(1).optional(),
      }),
      z.object({
        type: z.literal("remote-managed"),
        url: z.string().min(1),
        auth_env: z.string().min(1).optional(),
        auth_file: z.string().min(1).optional(),
      }),
      z.object({
        type: z.literal("remote-unmanaged"),
        url: z.string().min(1),
        auth_env: z.string().min(1).optional(),
        auth_file: z.string().min(1).optional(),
      }),
    ])
  ),
});

export const materializedMcpBindingsSchema = z.object({
  runId: runIdSchema,
  bindings: z.array(mcpBindingSchema),
});

export const startRunJobResultSchema = z.object({
  accepted: z.literal(true),
  payload: startRunJobPayloadSchema,
  events: z.array(bridgeEventSchema),
  preparedWorkspace: preparedRunWorkspaceSchema,
  hostBridgeContext: bridgeSessionContextSchema,
  containerBridgeContext: bridgeSessionContextSchema,
  runtimeConfig: workerRuntimeConfigSchema,
  containerLaunchPlan: containerLaunchPlanSchema,
});

export type PreparedRunWorkspace = z.infer<typeof preparedRunWorkspaceSchema>;
export type RunSecretMaterialization = z.infer<typeof runSecretMaterializationSchema>;
export type WorkerRuntimeConfig = z.infer<typeof workerRuntimeConfigSchema>;
export type ContainerMountSpec = z.infer<typeof containerMountSpecSchema>;
export type ContainerEgressFirewallTarget = z.infer<
  typeof containerEgressFirewallTargetSchema
>;
export type ContainerEgressFirewallPlan = z.infer<
  typeof containerEgressFirewallPlanSchema
>;
export type ContainerRuntimeUser = z.infer<typeof containerRuntimeUserSchema>;
export type ContainerLaunchPlan = z.infer<typeof containerLaunchPlanSchema>;
export type MaterializedMcpConfig = z.infer<typeof materializedMcpConfigSchema>;
export type MaterializedMcpBindings = z.infer<typeof materializedMcpBindingsSchema>;
export type StartRunJobResult = z.infer<typeof startRunJobResultSchema>;
