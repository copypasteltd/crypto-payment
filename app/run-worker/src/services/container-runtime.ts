import { promises as fs } from "node:fs";
import path from "node:path";
import { loadWorkerRuntimeConfig } from "@lingban/config";
import { assertRuntimeMcpBindings } from "@lingban/mcp";
import type { BridgeSessionContext, McpBinding, StartRunJobPayload } from "@lingban/contracts";
import {
  containerLaunchPlanSchema,
  materializedMcpBindingsSchema,
  materializedMcpConfigSchema,
  runSecretMaterializationSchema,
  workerRuntimeConfigSchema,
  type ContainerLaunchPlan,
  type ContainerRuntimeUser,
  type MaterializedMcpBindings,
  type MaterializedMcpConfig,
  type PreparedRunWorkspace,
  type RunSecretMaterialization,
  type WorkerRuntimeConfig,
} from "./specs.js";
import { buildContainerEgressFirewallPlan } from "./egress-firewall.js";
import { buildRunSessionPackContainerPaths } from "./session-pack-materializer.js";

type RuntimeFiles = WorkerRuntimeConfig["files"];

function buildRuntimeEnv(
  payload: StartRunJobPayload,
  preparedWorkspace: PreparedRunWorkspace,
  bridgeContextContainerPath: string,
  mcpConfigPath: string
) {
  const workerConfig = loadWorkerRuntimeConfig();
  const sessionPackPaths = buildRunSessionPackContainerPaths(preparedWorkspace);

  return {
    HOME: preparedWorkspace.containerPaths.homePath,
    CODEX_HOME: preparedWorkspace.containerPaths.codexHomePath,
    TMPDIR: preparedWorkspace.containerPaths.tmpPath,
    TARGET_PATH: preparedWorkspace.containerPaths.targetPath,
    PLAYWRIGHT_BROWSERS_PATH: workerConfig.playwrightBrowsersPath,
    RUN_ID: payload.run.runId,
    WORKSPACE_ID: payload.run.workspaceId,
    MCP_CONFIG_PATH: mcpConfigPath,
    BRIDGE_CONTEXT_PATH: bridgeContextContainerPath,
    RUNTIME_CONFIG_PATH: path.posix.join(preparedWorkspace.containerPaths.runtimePath, "runtime-config.json"),
    BRIDGE_CONTROL_HOST: "0.0.0.0",
    BRIDGE_CONTROL_PORT: String(workerConfig.bridgePort),
    LINGBAN_API_BASE_URL: workerConfig.runtimeApiBaseUrl,
    SESSION_PACK_ROOT: sessionPackPaths.unpackedPath,
    SESSION_PACK_ARCHIVE_PATH: sessionPackPaths.archivePath,
    SESSION_PACK_MANIFEST_PATH: sessionPackPaths.manifestPath,
    SESSION_PACK_METADATA_PATH: sessionPackPaths.metadataPath,
    SESSION_PACK_WORKSPACE_BASE_PATH: sessionPackPaths.workspaceBasePath,
    ...(payload.provider?.runtimeEnv ?? {}),
  } as const;
}

function buildContainerExtraHosts(workerConfig: ReturnType<typeof loadWorkerRuntimeConfig>) {
  const extraHosts = new Set<string>();

  try {
    const runtimeApiHost = new URL(workerConfig.runtimeApiBaseUrl).hostname.toLowerCase();
    if (runtimeApiHost === "host.docker.internal") {
      extraHosts.add("host.docker.internal:host-gateway");
    }
  } catch {
    // ignore invalid runtime API base urls here; API URL validation happens elsewhere
  }

  if (workerConfig.runtimeEgressProxyEnabled) {
    extraHosts.add("host.docker.internal:host-gateway");
  }

  return [...extraHosts];
}

function resolveContainerRuntimeUser(input: {
  workerConfig: ReturnType<typeof loadWorkerRuntimeConfig>;
  requiresRootEntrypoint: boolean;
}): ContainerRuntimeUser | null {
  if (
    !input.workerConfig.runnerDropRootEnabled ||
    input.workerConfig.runnerUid == null ||
    input.workerConfig.runnerGid == null
  ) {
    return null;
  }

  return {
    uid: input.workerConfig.runnerUid,
    gid: input.workerConfig.runnerGid,
    appliesAtCreate: !input.requiresRootEntrypoint,
    dropRootInEntrypoint: input.requiresRootEntrypoint,
  };
}

function buildSecretMaterialization(
  hostContext: BridgeSessionContext,
  containerContext: BridgeSessionContext
): RunSecretMaterialization {
  const env: Record<string, string> = {};
  const files: RunSecretMaterialization["files"] = [];
  const hostMountsByCredentialId = new Map(
    hostContext.credentialMounts.map((mount) => [mount.credentialId, mount])
  );

  for (const mount of containerContext.credentialMounts) {
    const hostMount = hostMountsByCredentialId.get(mount.credentialId);
    if (mount.mode === "env") {
      env[mount.credentialId] = mount.envName;
      continue;
    }

    if (!hostMount || hostMount.mode !== "file") {
      continue;
    }

    files.push({
      credentialId: mount.credentialId,
      hostPath: hostMount.mountPath,
      containerPath: mount.mountPath.replace(/\\/g, "/"),
      readOnly: true,
    });
  }

  return runSecretMaterializationSchema.parse({
    env,
    files,
  });
}

function buildServerDefinition(binding: McpBinding): MaterializedMcpConfig["servers"][string] {
  const auth =
    binding.authMode === "env"
      ? { auth_env: binding.authRef ?? undefined }
      : binding.authMode === "file"
        ? { auth_file: binding.authRef ?? undefined }
        : {};

  if (binding.transport === "stdio") {
    if (binding.ref.endsWith(".js") || binding.ref.endsWith(".mjs") || binding.ref.endsWith(".cjs")) {
      return {
        type: "local-process",
        command: "node",
        args: [binding.ref],
        ...auth,
      };
    }

    return {
      type: "local-process",
      command: binding.ref,
      ...auth,
    };
  }

  return {
    type: binding.source === "third-party" ? "remote-unmanaged" : "remote-managed",
    url: binding.ref,
    ...auth,
  };
}

export function buildMaterializedMcpConfig(input: {
  bindings: McpBinding[];
  policies?: BridgeSessionContext["mcpNetworkPolicies"];
  stdioAllowedPathPrefixes?: string[];
}): MaterializedMcpConfig {
  assertRuntimeMcpBindings({
    bindings: input.bindings,
    policies: input.policies ?? [],
    stdioAllowedPathPrefixes: input.stdioAllowedPathPrefixes ?? [],
  });

  return materializedMcpConfigSchema.parse({
    servers: Object.fromEntries(
      input.bindings.map((binding) => [binding.bindingId, buildServerDefinition(binding)])
    ),
  });
}

export function buildMaterializedMcpBindings(
  runId: string,
  bindings: McpBinding[]
): MaterializedMcpBindings {
  return materializedMcpBindingsSchema.parse({
    runId,
    bindings,
  });
}

export function buildContainerLaunchPlan(input: {
  payload: StartRunJobPayload;
  preparedWorkspace: PreparedRunWorkspace;
  env: Record<string, string>;
  bindings?: McpBinding[];
}): ContainerLaunchPlan {
  const workerConfig = loadWorkerRuntimeConfig();
  const image = workerConfig.runnerImage;
  const containerName = `lingban-run-${input.payload.run.runId}`;
  const entrypoint = ["/usr/local/bin/lingban-runner-entrypoint"];

  const mounts = [
    {
      source: input.preparedWorkspace.hostPaths.targetPath,
      target: input.preparedWorkspace.containerPaths.targetPath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.inputsPath,
      target: input.preparedWorkspace.containerPaths.inputsPath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.outputsPath,
      target: input.preparedWorkspace.containerPaths.outputsPath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.statePath,
      target: input.preparedWorkspace.containerPaths.statePath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.runtimePath,
      target: input.preparedWorkspace.containerPaths.runtimePath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.codexHomePath,
      target: input.preparedWorkspace.containerPaths.codexHomePath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.homePath,
      target: input.preparedWorkspace.containerPaths.homePath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.tmpPath,
      target: input.preparedWorkspace.containerPaths.tmpPath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.browserProfilePath,
      target: input.preparedWorkspace.containerPaths.browserProfilePath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.mcpPath,
      target: input.preparedWorkspace.containerPaths.mcpPath,
      readOnly: false,
    },
    {
      source: input.preparedWorkspace.hostPaths.secretsPath,
      target: input.preparedWorkspace.containerPaths.secretsPath,
      readOnly: true,
    },
    {
      source: input.preparedWorkspace.hostPaths.logsPath,
      target: input.preparedWorkspace.containerPaths.logsPath,
      readOnly: false,
    },
  ];

  const labels = {
    "lingban.run_id": input.payload.run.runId,
    "lingban.workspace_id": input.payload.run.workspaceId,
    "lingban.task_version_id": input.payload.run.taskVersionId,
    "lingban.session_version_id": input.payload.run.sessionVersionId,
  };

  const resources = {
    cpus: workerConfig.runnerCpus,
    memory: workerConfig.runnerMemory,
    pidsLimit: workerConfig.runnerPidsLimit,
  };
  const extraHosts = buildContainerExtraHosts(workerConfig);
  const capAdd = workerConfig.runtimeEgressFirewallEnabled ? ["NET_ADMIN"] : [];
  const egressFirewall = buildContainerEgressFirewallPlan({
    enabled: workerConfig.runtimeEgressFirewallEnabled,
    allowDns: workerConfig.runtimeEgressFirewallAllowDns,
    runtimeApiBaseUrl: workerConfig.runtimeApiBaseUrl,
    allowedBaseUrls: input.payload.provider?.allowedBaseUrls ?? [],
    bindings: input.bindings ?? [],
  });
  const runtimeUser = resolveContainerRuntimeUser({
    workerConfig,
    requiresRootEntrypoint: egressFirewall.enabled,
  });

  const commandPreview = [
    "docker",
    "create",
    "--rm",
    "--name",
    containerName,
    "--hostname",
    `run-${input.payload.run.runId}`,
    "--cpus",
    resources.cpus,
    "--memory",
    resources.memory,
    "--pids-limit",
    String(resources.pidsLimit),
    "--network",
    workerConfig.runnerNetwork,
    "--workdir",
    input.preparedWorkspace.containerPaths.targetPath,
    "--stop-timeout",
    "10",
    "--init",
    "--env-file",
    path.join(input.preparedWorkspace.hostPaths.runtimePath, "docker.env"),
    "--entrypoint",
    entrypoint[0],
  ];

  if (runtimeUser?.appliesAtCreate) {
    commandPreview.push("--user", `${runtimeUser.uid}:${runtimeUser.gid}`);
  }

  for (const capability of capAdd) {
    commandPreview.push("--cap-add", capability);
  }

  for (const extraHost of extraHosts) {
    commandPreview.push("--add-host", extraHost);
  }

  for (const [key, value] of Object.entries(labels)) {
    commandPreview.push("--label", `${key}=${value}`);
  }

  for (const mount of mounts) {
    commandPreview.push(
      "--mount",
      `type=bind,source=${mount.source},target=${mount.target}${mount.readOnly ? ",readonly" : ""}`
    );
  }

  commandPreview.push(image);
  if (entrypoint.length > 1) {
    commandPreview.push(...entrypoint.slice(1));
  }

  return containerLaunchPlanSchema.parse({
    runId: input.payload.run.runId,
    image,
    containerName,
    workingDirectory: input.preparedWorkspace.containerPaths.targetPath,
    entrypoint,
    env: input.env,
    labels,
    mounts,
    extraHosts,
    capAdd,
    egressFirewall,
    runtimeUser,
    network: workerConfig.runnerNetwork,
    resources,
    removeOnExit: true,
    commandPreview,
  });
}

export async function materializeRunRuntime(input: {
  payload: StartRunJobPayload;
  preparedWorkspace: PreparedRunWorkspace;
  hostBridgeContext: BridgeSessionContext;
  containerBridgeContext: BridgeSessionContext;
}) {
  const runtimeDir = input.preparedWorkspace.hostPaths.runtimePath;
  await fs.mkdir(runtimeDir, { recursive: true });

  const files: RuntimeFiles = {
    runtimeConfigPath: path.join(runtimeDir, "runtime-config.json"),
    bridgeContextHostPath: path.join(runtimeDir, "bridge-context.host.json"),
    bridgeContextContainerPath: path.join(runtimeDir, "bridge-context.container.json"),
    mcpConfigPath: path.join(runtimeDir, "mcp-config.json"),
    mcpBindingsPath: path.join(runtimeDir, "mcp-bindings.json"),
    secretManifestPath: path.join(runtimeDir, "secret-manifest.json"),
    containerLaunchPlanPath: path.join(runtimeDir, "container-launch-plan.json"),
  };

  const env = buildRuntimeEnv(
    input.payload,
    input.preparedWorkspace,
    input.preparedWorkspace.containerPaths.runtimePath + "/bridge-context.container.json",
    input.preparedWorkspace.containerPaths.runtimePath + "/mcp-config.json"
  );
  const mcpConfig = buildMaterializedMcpConfig({
    bindings: input.containerBridgeContext.mcpBindings,
    policies: input.containerBridgeContext.mcpNetworkPolicies ?? [],
    stdioAllowedPathPrefixes: loadWorkerRuntimeConfig().mcpStdioAllowedPathPrefixes,
  });
  const mcpBindings = buildMaterializedMcpBindings(
    input.payload.run.runId,
    input.containerBridgeContext.mcpBindings
  );
  const secrets = buildSecretMaterialization(
    input.hostBridgeContext,
    input.containerBridgeContext
  );
  const containerLaunchPlan = buildContainerLaunchPlan({
    payload: input.payload,
    preparedWorkspace: input.preparedWorkspace,
    env,
    bindings: input.containerBridgeContext.mcpBindings,
  });

  const runtimeConfig = workerRuntimeConfigSchema.parse({
    schemaVersion: 1,
    runId: input.payload.run.runId,
    workspaceId: input.payload.run.workspaceId,
    job: input.payload,
    workspace: input.preparedWorkspace,
    env,
    files,
  });

  await Promise.all([
    fs.writeFile(files.runtimeConfigPath, JSON.stringify(runtimeConfig, null, 2), "utf8"),
    fs.writeFile(files.bridgeContextHostPath, JSON.stringify(input.hostBridgeContext, null, 2), "utf8"),
    fs.writeFile(
      files.bridgeContextContainerPath,
      JSON.stringify(input.containerBridgeContext, null, 2),
      "utf8"
    ),
    fs.writeFile(files.mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf8"),
    fs.writeFile(files.mcpBindingsPath, JSON.stringify(mcpBindings, null, 2), "utf8"),
    fs.writeFile(files.secretManifestPath, JSON.stringify(secrets, null, 2), "utf8"),
    fs.writeFile(
      files.containerLaunchPlanPath,
      JSON.stringify(containerLaunchPlan, null, 2),
      "utf8"
    ),
  ]);

  return {
    runtimeConfig,
    containerLaunchPlan,
    mcpConfig,
    mcpBindings,
    secrets,
  };
}
