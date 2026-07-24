import path from "node:path";
import {
  bridgeSessionContextSchema,
  fileCredentialMountSchema,
  mcpBindingSchema,
  type BridgeSessionContext,
  type CredentialMount,
  type McpBinding,
  type StartRunJobPayload,
} from "@lingban/contracts";
import { type PreparedRunWorkspace } from "./specs.js";

type BridgeRuntimeMode = "host" | "container";

function toPosix(value: string) {
  return value.replace(/\\/g, "/");
}

function mapContainerSecretsPathToHost(
  mountPath: string,
  preparedWorkspace: PreparedRunWorkspace
) {
  const containerSecretsRoot = preparedWorkspace.containerPaths.secretsPath;
  if (!mountPath.startsWith(containerSecretsRoot)) {
    return path.join(preparedWorkspace.hostPaths.secretsPath, path.basename(mountPath));
  }

  const relative = mountPath.slice(containerSecretsRoot.length).replace(/^\/+/, "");
  return path.join(preparedWorkspace.hostPaths.secretsPath, ...relative.split("/"));
}

function mapContainerPathToHost(
  value: string,
  preparedWorkspace: PreparedRunWorkspace
) {
  const normalized = toPosix(value);
  const candidates = ([
    [preparedWorkspace.containerPaths.targetPath, preparedWorkspace.hostPaths.targetPath],
    [preparedWorkspace.containerPaths.inputsPath, preparedWorkspace.hostPaths.inputsPath],
    [preparedWorkspace.containerPaths.outputsPath, preparedWorkspace.hostPaths.outputsPath],
    [preparedWorkspace.containerPaths.statePath, preparedWorkspace.hostPaths.statePath],
    [preparedWorkspace.containerPaths.runtimePath, preparedWorkspace.hostPaths.runtimePath],
    [preparedWorkspace.containerPaths.codexHomePath, preparedWorkspace.hostPaths.codexHomePath],
    [preparedWorkspace.containerPaths.homePath, preparedWorkspace.hostPaths.homePath],
    [preparedWorkspace.containerPaths.tmpPath, preparedWorkspace.hostPaths.tmpPath],
    [preparedWorkspace.containerPaths.browserProfilePath, preparedWorkspace.hostPaths.browserProfilePath],
    [preparedWorkspace.containerPaths.mcpPath, preparedWorkspace.hostPaths.mcpPath],
    [preparedWorkspace.containerPaths.secretsPath, preparedWorkspace.hostPaths.secretsPath],
    [preparedWorkspace.containerPaths.logsPath, preparedWorkspace.hostPaths.logsPath],
    [preparedWorkspace.containerPaths.workspaceRoot, preparedWorkspace.hostPaths.runRootPath],
  ] as Array<[string, string]>).sort((left, right) => right[0].length - left[0].length);

  for (const [containerRoot, hostRoot] of candidates) {
    const normalizedRoot = toPosix(containerRoot);
    if (
      normalized === normalizedRoot ||
      normalized.startsWith(`${normalizedRoot}/`)
    ) {
      const relative = normalized.slice(normalizedRoot.length).replace(/^\/+/, "");
      return relative ? path.join(hostRoot, ...relative.split("/")) : hostRoot;
    }
  }

  return value;
}

function rewriteCredentialMount(
  mount: CredentialMount,
  preparedWorkspace: PreparedRunWorkspace,
  mode: BridgeRuntimeMode
): CredentialMount {
  if (mount.mode !== "file") {
    return mount;
  }

  if (mode === "container") {
    return fileCredentialMountSchema.parse({
      ...mount,
      mountPath: toPosix(mount.mountPath),
    });
  }

  return fileCredentialMountSchema.parse({
    ...mount,
    mountPath: mapContainerSecretsPathToHost(mount.mountPath, preparedWorkspace),
  });
}

function rewriteMcpBinding(
  binding: McpBinding,
  preparedWorkspace: PreparedRunWorkspace,
  mode: BridgeRuntimeMode
) {
  const next = { ...binding } as McpBinding;

  if (binding.authMode === "file" && binding.authRef) {
    next.authRef =
      mode === "container"
        ? toPosix(binding.authRef)
        : mapContainerSecretsPathToHost(binding.authRef, preparedWorkspace);
  }

  if (binding.transport === "stdio") {
    next.ref =
      mode === "container"
        ? toPosix(binding.ref)
        : mapContainerPathToHost(binding.ref, preparedWorkspace);
  }

  return mcpBindingSchema.parse(next);
}

function buildBridgeSessionContext(
  payload: StartRunJobPayload,
  preparedWorkspace: PreparedRunWorkspace,
  mode: BridgeRuntimeMode
): BridgeSessionContext {
  return bridgeSessionContextSchema.parse({
    runId: payload.run.runId,
    workspaceId: payload.run.workspaceId,
    requestedByUserId: payload.run.requestedByUserId ?? null,
    taskVersionId: payload.run.taskVersionId,
    sessionVersionId: payload.run.sessionVersionId,
    entrySurface: payload.run.entrySurface,
    workspaceContextKey: payload.run.catalogMetadata?.workspaceContextKey ?? null,
    serviceId: payload.run.catalogMetadata?.serviceId ?? null,
    approvalMode: payload.run.approvalMode,
    targetPath:
      mode === "container"
        ? preparedWorkspace.containerPaths.targetPath
        : preparedWorkspace.hostPaths.targetPath,
    initialPrompt: payload.initialPrompt,
    deferInitialTurn: payload.run.sessionBootstrapMode === "blank",
    requestedInitialMessage: payload.requestedInitialMessage,
    resumeThreadId: payload.resumeThreadId,
    resumeThroughTurnId: payload.resumeThroughTurnId,
    resumeThroughTurnState: payload.resumeThroughTurnState,
    credentialMounts: payload.credentialMounts.map((mount) =>
      rewriteCredentialMount(mount, preparedWorkspace, mode)
    ),
    mcpBindings: payload.mcpBindings.map((binding) =>
      rewriteMcpBinding(binding, preparedWorkspace, mode)
    ),
    mcpNetworkPolicies: payload.mcpNetworkPolicies ?? [],
  });
}

export function buildHostBridgeSessionContext(
  payload: StartRunJobPayload,
  preparedWorkspace: PreparedRunWorkspace
) {
  return buildBridgeSessionContext(payload, preparedWorkspace, "host");
}

export function buildContainerBridgeSessionContext(
  payload: StartRunJobPayload,
  preparedWorkspace: PreparedRunWorkspace
) {
  return buildBridgeSessionContext(payload, preparedWorkspace, "container");
}
