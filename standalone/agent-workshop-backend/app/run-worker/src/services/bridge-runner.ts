import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { ApiConnector } from "@lingban/container-bridge";
import { loadWorkerRuntimeConfig } from "@lingban/config";
import {
  runControlCommandSchema,
  type CredentialMount,
  type RunControlCommand,
} from "@lingban/contracts";
import { nowIso, toErrorMessage } from "@lingban/shared";
import type { ContainerLaunchPlan, StartRunJobResult } from "./specs.js";
import {
  buildRuntimeEgressProxyConfig,
  type RuntimeEgressProxyDiagnostics,
  RuntimeEgressProxyServer,
} from "./egress-proxy.js";
import { buildContainerEgressFirewallEnv } from "./egress-firewall.js";
import { buildRunSessionPackHostPaths } from "./session-pack-materializer.js";

type RuntimeProcessOptions = {
  job: StartRunJobResult;
  apiBaseUrl: string;
  authToken?: string;
  codex?: {
    command?: string;
    args?: string[];
  };
  launchMode?: ManagedBridgeRuntimeLaunchMode;
  startupTimeoutMs?: number;
};

export type ManagedBridgeRuntimeLaunchMode = "local-process" | "docker";

export type BridgeCommandController = {
  handle(command: RunControlCommand): Promise<unknown> | unknown;
};

export type ManagedBridgeRuntimeHandle = {
  launchMode: ManagedBridgeRuntimeLaunchMode;
  controlUrl: string;
  controller: BridgeCommandController;
  getDiagnostics: () => ManagedBridgeRuntimeDiagnostics;
  waitUntilReady: () => Promise<void>;
  completion: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
  stop: (options?: { force?: boolean }) => Promise<void>;
};

export type ManagedBridgeRuntimeDiagnostics = {
  launchMode: ManagedBridgeRuntimeLaunchMode;
  controlUrl: string;
  egressProxy: RuntimeEgressProxyDiagnostics | null;
};

type ExitResult = { exitCode: number | null; signal: NodeJS.Signals | null };
type SpawnedChildProcess = ReturnType<typeof spawn>;
type SpawnProcess = typeof spawn;
type DockerInspectState = {
  status: string | null;
  running: boolean | null;
  exitCode: number | null;
  error: string | null;
  dead: boolean | null;
  oomKilled: boolean | null;
};

export type DockerDaemonProbeResult = {
  backend: "docker";
  ready: boolean;
  checkedAt: string;
  detail: string;
  serverVersion: string | null;
  apiVersion: string | null;
  os: string | null;
  experimental: boolean | null;
};

type RuntimeProcessDependencies = {
  allocatePortImpl?: typeof allocatePort;
  runSubprocessImpl?: typeof runSubprocess;
  spawnImpl?: SpawnProcess;
  waitForHealthImpl?: typeof waitForHealth;
  createApiConnectorImpl?: (
    baseUrl: string,
    authToken?: string
  ) => Pick<ApiConnector, "materializeRunCredentials"> | null;
};

type RuntimeApiConnector = Pick<ApiConnector, "materializeRunCredentials">;

async function waitForCompletionGracefully<T>(
  completion: Promise<T>,
  timeoutMs: number
): Promise<T | null> {
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);
    timer.unref?.();

    void completion
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

const LOCAL_BRIDGE_STOP_GRACE_MS = 5_000;

function resolveBridgeCliPath() {
  const workerConfig = loadWorkerRuntimeConfig();
  if (workerConfig.containerBridgeCliPath) {
    return workerConfig.containerBridgeCliPath;
  }

  return path.resolve(fileURLToPath(new URL("../../../container-bridge/dist/cli.js", import.meta.url)));
}

function toCredentialEnvKey(credentialId: string) {
  return `LINGBAN_CREDENTIAL_${credentialId
    .replace(/^cred_/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()}`;
}

function resolveCredentialValue(mount: CredentialMount) {
  if (mount.mode === "env") {
    return process.env[mount.envName] ?? process.env[toCredentialEnvKey(mount.credentialId)];
  }

  return process.env[toCredentialEnvKey(mount.credentialId)];
}

function createRuntimeApiConnector(input: {
  baseUrl: string;
  authToken?: string;
  createApiConnectorImpl?: RuntimeProcessDependencies["createApiConnectorImpl"];
}): RuntimeApiConnector | null {
  if (!input.authToken) {
    return null;
  }

  if (input.createApiConnectorImpl) {
    return input.createApiConnectorImpl(input.baseUrl, input.authToken);
  }

  return new ApiConnector({
    baseUrl: input.baseUrl,
    authToken: input.authToken,
    requestTimeoutMs: 10_000,
    retryAttempts: 2,
    retryDelayMs: 250,
  });
}

async function materializeRuntimeSecrets(
  job: StartRunJobResult,
  apiConnector: RuntimeApiConnector | null
) {
  const injectedEnv: Record<string, string> = {};
  const brokerSecrets = apiConnector
    ? (await apiConnector.materializeRunCredentials(job.payload.run.runId)).secrets
    : null;

  for (const mount of job.hostBridgeContext.credentialMounts) {
    const value = brokerSecrets
      ? brokerSecrets[mount.credentialId]
      : resolveCredentialValue(mount);
    if (value == null) {
      if (brokerSecrets) {
        throw new Error(
          `Credential broker response did not include a secret value for ${mount.credentialId}`
        );
      }
      continue;
    }

    if (mount.mode === "env") {
      injectedEnv[mount.envName] = value;
      continue;
    }

    await fs.mkdir(path.dirname(mount.mountPath), { recursive: true });
    await fs.writeFile(mount.mountPath, value, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.chmod(mount.mountPath, 0o600).catch(() => undefined);
  }

  return injectedEnv;
}

async function allocatePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate control port"));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
    server.once("error", reject);
  });
}

async function waitForHealth(
  url: string,
  timeoutMs: number,
  getExitResult: () => ExitResult | null,
  runtimeLabel: string,
  getRuntimeFailure?: () => Error | null
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const failure = getRuntimeFailure?.();
    if (failure) {
      throw new Error(
        `${runtimeLabel} failed before health check succeeded: ${failure.message}`
      );
    }

    const exit = getExitResult();
    if (exit) {
      throw new Error(
        `${runtimeLabel} exited before health check succeeded (exit=${exit.exitCode ?? "null"}, signal=${exit.signal ?? "null"})`
      );
    }

    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for bridge health endpoint: ${url}`);
}

async function runSubprocess(command: string, args: string[], cwd: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (exitCode, signal) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed (exit=${exitCode ?? "null"}, signal=${signal ?? "null"}): ${stderr || stdout || "<empty>"}`
        )
      );
    });
  });
}

function describeDockerDaemon(details: {
  serverVersion: string | null;
  apiVersion: string | null;
  os: string | null;
  experimental: boolean | null;
}) {
  const parts = [
    details.serverVersion ? `server=${details.serverVersion}` : null,
    details.apiVersion ? `api=${details.apiVersion}` : null,
    details.os ? `os=${details.os}` : null,
    details.experimental == null ? null : `experimental=${String(details.experimental)}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "server metadata unavailable";
}

export async function probeDockerDaemon(input: {
  dockerBin: string;
  cwd: string;
  runSubprocessImpl?: typeof runSubprocess;
}): Promise<DockerDaemonProbeResult> {
  const runSubprocessImpl = input.runSubprocessImpl ?? runSubprocess;
  const checkedAt = nowIso();

  try {
    const { stdout } = await runSubprocessImpl(
      input.dockerBin,
      ["version", "--format", "{{json .Server}}"],
      input.cwd
    );
    const raw = stdout.trim();
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const serverVersion =
      typeof parsed.Version === "string" && parsed.Version.length > 0 ? parsed.Version : null;
    const apiVersion =
      typeof parsed.ApiVersion === "string" && parsed.ApiVersion.length > 0 ? parsed.ApiVersion : null;
    const os = typeof parsed.Os === "string" && parsed.Os.length > 0 ? parsed.Os : null;
    const experimental =
      typeof parsed.Experimental === "boolean" ? parsed.Experimental : null;

    return {
      backend: "docker",
      ready: true,
      checkedAt,
      detail: describeDockerDaemon({
        serverVersion,
        apiVersion,
        os,
        experimental,
      }),
      serverVersion,
      apiVersion,
      os,
      experimental,
    };
  } catch (error) {
    return {
      backend: "docker",
      ready: false,
      checkedAt,
      detail: toErrorMessage(error),
      serverVersion: null,
      apiVersion: null,
      os: null,
      experimental: null,
    };
  }
}

function attachProcessLogs(
  child: SpawnedChildProcess,
  stdoutPath: string,
  stderrPath: string
) {
  const stdoutStream = createWriteStream(stdoutPath, { flags: "a" });
  const stderrStream = createWriteStream(stderrPath, { flags: "a" });

  child.stdout?.pipe(stdoutStream);
  child.stderr?.pipe(stderrStream);

  const completion = new Promise<ExitResult>((resolve, reject) => {
    const closeStreams = () => {
      stdoutStream.end();
      stderrStream.end();
    };

    child.once("error", (error) => {
      closeStreams();
      reject(error);
    });
    child.once("exit", (exitCode, signal) => {
      closeStreams();
      resolve({
        exitCode,
        signal,
      });
    });
  });

  return {
    completion,
  };
}

class HttpRunBridgeController implements BridgeCommandController {
  #controlUrl: string;
  #authToken?: string;

  constructor(controlUrl: string, authToken?: string) {
    this.#controlUrl = controlUrl;
    this.#authToken = authToken;
  }

  async handle(command: RunControlCommand): Promise<unknown> {
    const parsed = runControlCommandSchema.parse(command);
    const response = await fetch(`${this.#controlUrl}/control`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.#authToken ? { "x-lingban-control-token": this.#authToken } : {}),
      },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Bridge control request failed (${response.status} ${response.statusText}): ${text || "<empty>"}`
      );
    }

    const raw = await response.text();
    return raw ? (JSON.parse(raw) as unknown) : null;
  }
}

function buildDockerRuntimeEnv(input: {
  plan: ContainerLaunchPlan;
  controlToken: string;
  hostControlPort: number;
  runtimeApiBaseUrl: string;
  authToken?: string;
  secretEnv?: Record<string, string>;
  egressProxyEnv?: Record<string, string>;
  codex?: {
    command?: string;
    args?: string[];
  };
}) {
  const workerConfig = loadWorkerRuntimeConfig();
  const firewallEnv = buildContainerEgressFirewallEnv({
    plan: input.plan.egressFirewall,
    proxyEnv: input.egressProxyEnv,
  });
  return {
    ...input.plan.env,
    ...(input.secretEnv ?? {}),
    ...(input.egressProxyEnv ?? {}),
    LINGBAN_RUNTIME_UMASK: "077",
    BRIDGE_CONTROL_HOST: "0.0.0.0",
    BRIDGE_CONTROL_PORT: String(workerConfig.bridgePort),
    LINGBAN_BRIDGE_CONTROL_TOKEN: input.controlToken,
    LINGBAN_BRIDGE_EXTERNAL_CONTROL_URL: `http://127.0.0.1:${input.hostControlPort}`,
    LINGBAN_BRIDGE_EXTERNAL_CONTROL_TOKEN: input.controlToken,
    LINGBAN_API_BASE_URL: input.runtimeApiBaseUrl,
    LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES: JSON.stringify(
      workerConfig.mcpStdioAllowedPathPrefixes
    ),
    ...(input.plan.runtimeUser?.dropRootInEntrypoint
      ? {
          LINGBAN_RUNTIME_DROP_ROOT: "true",
          LINGBAN_RUNTIME_EXEC_UID: String(input.plan.runtimeUser.uid),
          LINGBAN_RUNTIME_EXEC_GID: String(input.plan.runtimeUser.gid),
        }
      : {}),
    ...firewallEnv,
    ...(input.authToken ? { LINGBAN_INTERNAL_AUTH_TOKEN: input.authToken } : {}),
    CODEX_RUNTIME_PROTOCOL: process.env.CODEX_RUNTIME_PROTOCOL ?? "app-server",
    CODEX_APP_SERVER_REQUEST_TIMEOUT_MS:
      process.env.CODEX_APP_SERVER_REQUEST_TIMEOUT_MS ?? "30000",
    CODEX_APP_SERVER_INCLUDE_DEFAULT_ARGS:
      process.env.CODEX_APP_SERVER_INCLUDE_DEFAULT_ARGS ?? "true",
    ...(input.codex?.command ? { CODEX_BIN: input.codex.command } : {}),
    ...(input.codex?.args ? { CODEX_ARGS_JSON: JSON.stringify(input.codex.args) } : {}),
  };
}

function serializeDockerEnvFile(env: Record<string, string>) {
  return Object.entries(env)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => {
      if (value.includes("\n") || value.includes("\r")) {
        throw new Error(`Docker env file does not support multiline values: ${key}`);
      }

      return `${key}=${value}`;
    })
    .join("\n");
}

async function writeDockerEnvFile(envFilePath: string, env: Record<string, string>) {
  const content = serializeDockerEnvFile(env);
  await fs.writeFile(envFilePath, `${content}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(envFilePath, 0o600).catch(() => undefined);
}

export function buildDockerCreateArgs(input: {
  plan: ContainerLaunchPlan;
  hostControlPort: number;
  bridgePort: number;
  envFilePath: string;
}) {
  const args = [
    "create",
    ...(input.plan.removeOnExit ? ["--rm"] : []),
    "--name",
    input.plan.containerName,
    "--hostname",
    `run-${input.plan.runId}`,
    "--cpus",
    input.plan.resources.cpus,
    "--memory",
    input.plan.resources.memory,
    "--pids-limit",
    String(input.plan.resources.pidsLimit),
    "--network",
    input.plan.network,
    "--workdir",
    input.plan.workingDirectory,
    "--stop-timeout",
    "10",
    "--init",
    "-p",
    `127.0.0.1:${input.hostControlPort}:${input.bridgePort}`,
  ];

  if (input.plan.runtimeUser?.appliesAtCreate) {
    args.push("--user", `${input.plan.runtimeUser.uid}:${input.plan.runtimeUser.gid}`);
  }

  for (const extraHost of input.plan.extraHosts ?? []) {
    args.push("--add-host", extraHost);
  }

  for (const capability of input.plan.capAdd ?? []) {
    args.push("--cap-add", capability);
  }

  for (const [key, value] of Object.entries(input.plan.labels)) {
    args.push("--label", `${key}=${value}`);
  }

  for (const mount of input.plan.mounts) {
    args.push(
      "--mount",
      `type=bind,source=${mount.source},target=${mount.target}${mount.readOnly ? ",readonly" : ""}`
    );
  }

  args.push("--env-file", input.envFilePath);
  if (input.plan.entrypoint.length > 0) {
    args.push("--entrypoint", input.plan.entrypoint[0]);
  }

  args.push(input.plan.image);
  if (input.plan.entrypoint.length > 1) {
    args.push(...input.plan.entrypoint.slice(1));
  }

  return args;
}

function buildDockerStartArgs(containerName: string) {
  return ["start", "-a", containerName];
}

async function inspectDockerContainerState(input: {
  dockerBin: string;
  containerName: string;
  cwd: string;
  runSubprocessImpl: typeof runSubprocess;
}): Promise<DockerInspectState | null> {
  try {
    const { stdout } = await input.runSubprocessImpl(
      input.dockerBin,
      ["inspect", "--type", "container", "--format", "{{json .State}}", input.containerName],
      input.cwd
    );
    const raw = stdout.trim();
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      status: typeof parsed.Status === "string" ? parsed.Status : null,
      running: typeof parsed.Running === "boolean" ? parsed.Running : null,
      exitCode: typeof parsed.ExitCode === "number" ? parsed.ExitCode : null,
      error: typeof parsed.Error === "string" && parsed.Error.length > 0 ? parsed.Error : null,
      dead: typeof parsed.Dead === "boolean" ? parsed.Dead : null,
      oomKilled: typeof parsed.OOMKilled === "boolean" ? parsed.OOMKilled : null,
    };
  } catch {
    return null;
  }
}

function formatDockerInspectState(state: DockerInspectState | null) {
  if (!state) {
    return "";
  }

  const details = [
    state.status ? `status=${state.status}` : null,
    state.running == null ? null : `running=${String(state.running)}`,
    state.exitCode == null ? null : `exit=${state.exitCode}`,
    state.error ? `error=${state.error}` : null,
    state.dead == null ? null : `dead=${String(state.dead)}`,
    state.oomKilled == null ? null : `oom_killed=${String(state.oomKilled)}`,
  ].filter(Boolean);

  return details.length > 0 ? `docker inspect: ${details.join(", ")}` : "";
}

function toPosixPath(value: string) {
  return value.replace(/\\/g, "/");
}

function mapContainerPathToHostPrefix(input: {
  prefix: string;
  workspace: StartRunJobResult["preparedWorkspace"];
}) {
  const normalized = toPosixPath(input.prefix);
  const candidates = ([
    [input.workspace.containerPaths.targetPath, input.workspace.hostPaths.targetPath],
    [input.workspace.containerPaths.inputsPath, input.workspace.hostPaths.inputsPath],
    [input.workspace.containerPaths.outputsPath, input.workspace.hostPaths.outputsPath],
    [input.workspace.containerPaths.statePath, input.workspace.hostPaths.statePath],
    [input.workspace.containerPaths.runtimePath, input.workspace.hostPaths.runtimePath],
    [input.workspace.containerPaths.codexHomePath, input.workspace.hostPaths.codexHomePath],
    [input.workspace.containerPaths.homePath, input.workspace.hostPaths.homePath],
    [input.workspace.containerPaths.tmpPath, input.workspace.hostPaths.tmpPath],
    [input.workspace.containerPaths.browserProfilePath, input.workspace.hostPaths.browserProfilePath],
    [input.workspace.containerPaths.mcpPath, input.workspace.hostPaths.mcpPath],
    [input.workspace.containerPaths.secretsPath, input.workspace.hostPaths.secretsPath],
    [input.workspace.containerPaths.logsPath, input.workspace.hostPaths.logsPath],
    [input.workspace.containerPaths.workspaceRoot, input.workspace.hostPaths.runRootPath],
  ] as Array<[string, string]>).sort((left, right) => right[0].length - left[0].length);

  for (const [containerRoot, hostRoot] of candidates) {
    const normalizedRoot = toPosixPath(containerRoot);
    if (
      normalized === normalizedRoot ||
      normalized.startsWith(`${normalizedRoot}/`)
    ) {
      const relative = normalized.slice(normalizedRoot.length).replace(/^\/+/, "");
      return relative ? path.join(hostRoot, ...relative.split("/")) : hostRoot;
    }
  }

  return input.prefix;
}

function resolveLocalProcessStdioAllowlistPrefixes(
  workspace: StartRunJobResult["preparedWorkspace"],
  configuredPrefixes: string[]
) {
  return configuredPrefixes.map((prefix) =>
    mapContainerPathToHostPrefix({
      prefix,
      workspace,
    })
  );
}

type RuntimeEgressProxyHandle = {
  env: Record<string, string>;
  getDiagnostics: () => RuntimeEgressProxyDiagnostics;
  stop: () => Promise<void>;
};

async function maybeStartRuntimeEgressProxy(input: {
  launchMode: ManagedBridgeRuntimeLaunchMode;
  workerConfig: ReturnType<typeof loadWorkerRuntimeConfig>;
  job: StartRunJobResult;
  allocatePortImpl: typeof allocatePort;
}) {
  if (!input.workerConfig.runtimeEgressProxyEnabled) {
    return null;
  }

  const proxyConfig = buildRuntimeEgressProxyConfig({
    launchMode: input.launchMode,
    runtimeApiBaseUrl: input.workerConfig.runtimeApiBaseUrl,
    configuredAllowedBaseUrls: [
      ...input.workerConfig.runtimeEgressAllowedBaseUrls,
      ...(input.job.payload.provider?.allowedBaseUrls ?? []),
    ],
    configuredNoProxyHosts: input.workerConfig.runtimeEgressNoProxyHosts,
    mcpPolicies: input.job.containerBridgeContext.mcpNetworkPolicies ?? [],
  });
  const port = await input.allocatePortImpl();
  const proxyServer = new RuntimeEgressProxyServer({
    policy: proxyConfig.policy,
    host: proxyConfig.listenHost,
    port,
  });
  await proxyServer.start();

  return {
    env: proxyServer.buildProxyEnv(proxyConfig.noProxyHosts, proxyConfig.envHost),
    getDiagnostics: () => proxyServer.getDiagnostics(),
    stop: async () => {
      await proxyServer.stop().catch(() => undefined);
    },
  } satisfies RuntimeEgressProxyHandle;
}

export async function startLocalBridgeProcess(
  options: RuntimeProcessOptions,
  dependencies: RuntimeProcessDependencies = {}
): Promise<ManagedBridgeRuntimeHandle> {
  const workerConfig = loadWorkerRuntimeConfig();
  const allocatePortImpl = dependencies.allocatePortImpl ?? allocatePort;
  const spawnImpl = dependencies.spawnImpl ?? spawn;
  const waitForHealthImpl = dependencies.waitForHealthImpl ?? waitForHealth;
  await fs.mkdir(options.job.preparedWorkspace.hostPaths.logsPath, { recursive: true });
  const apiConnector = createRuntimeApiConnector({
    baseUrl: options.apiBaseUrl || workerConfig.apiBaseUrl,
    authToken: options.authToken ?? workerConfig.internalAuthToken,
    createApiConnectorImpl: dependencies.createApiConnectorImpl,
  });
  const secretEnv = await materializeRuntimeSecrets(options.job, apiConnector);
  const egressProxy = await maybeStartRuntimeEgressProxy({
    launchMode: "local-process",
    workerConfig,
    job: options.job,
    allocatePortImpl,
  });
  const controlPort = await allocatePortImpl();
  const controlUrl = `http://127.0.0.1:${controlPort}`;
  const controlToken = randomUUID();
  const cliPath = resolveBridgeCliPath();
  const stdoutLogPath = path.join(options.job.preparedWorkspace.hostPaths.logsPath, "bridge.stdout.log");
  const stderrLogPath = path.join(options.job.preparedWorkspace.hostPaths.logsPath, "bridge.stderr.log");
  const hostPaths = options.job.preparedWorkspace.hostPaths;
  const sessionPackPaths = buildRunSessionPackHostPaths(options.job.preparedWorkspace);
  let child: SpawnedChildProcess;
  try {
    child = spawnImpl(process.execPath, [cliPath], {
      cwd: options.job.preparedWorkspace.hostPaths.runRootPath,
      env: {
        ...process.env,
        HOME: hostPaths.homePath,
        CODEX_HOME: hostPaths.codexHomePath,
        TMPDIR: hostPaths.tmpPath,
        TARGET_PATH: hostPaths.targetPath,
        RUN_ID: options.job.payload.run.runId,
        WORKSPACE_ID: options.job.payload.run.workspaceId,
        BRIDGE_CONTEXT_PATH: options.job.runtimeConfig.files.bridgeContextHostPath,
        RUNTIME_CONFIG_PATH: options.job.runtimeConfig.files.runtimeConfigPath,
        MCP_CONFIG_PATH: options.job.runtimeConfig.files.mcpConfigPath,
        OUTPUTS_PATH: hostPaths.outputsPath,
        RUNTIME_DIR: hostPaths.runtimePath,
        PLAYWRIGHT_BROWSERS_PATH: workerConfig.playwrightBrowsersPath,
        SESSION_PACK_ROOT: sessionPackPaths.unpackedPath,
        SESSION_PACK_ARCHIVE_PATH: sessionPackPaths.archivePath,
        SESSION_PACK_MANIFEST_PATH: sessionPackPaths.manifestPath,
        SESSION_PACK_METADATA_PATH: sessionPackPaths.metadataPath,
        SESSION_PACK_WORKSPACE_BASE_PATH: sessionPackPaths.workspaceBasePath,
        LINGBAN_RUNTIME_UMASK: "077",
        ...(options.job.payload.provider?.runtimeEnv ?? {}),
        ...secretEnv,
        ...(egressProxy?.env ?? {}),
        BRIDGE_CONTROL_PORT: String(controlPort),
        BRIDGE_CONTROL_HOST: "127.0.0.1",
        LINGBAN_BRIDGE_CONTROL_TOKEN: controlToken,
        LINGBAN_BRIDGE_EXTERNAL_CONTROL_URL: controlUrl,
        LINGBAN_BRIDGE_EXTERNAL_CONTROL_TOKEN: controlToken,
        LINGBAN_API_BASE_URL: options.apiBaseUrl || workerConfig.apiBaseUrl,
        LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES: JSON.stringify(
          resolveLocalProcessStdioAllowlistPrefixes(
            options.job.preparedWorkspace,
            workerConfig.mcpStdioAllowedPathPrefixes
          )
        ),
        ...((options.authToken ?? workerConfig.internalAuthToken)
          ? { LINGBAN_INTERNAL_AUTH_TOKEN: options.authToken ?? workerConfig.internalAuthToken }
          : {}),
        ...(options.codex?.command ? { CODEX_BIN: options.codex.command } : {}),
        CODEX_RUNTIME_PROTOCOL: process.env.CODEX_RUNTIME_PROTOCOL ?? "app-server",
        CODEX_APP_SERVER_REQUEST_TIMEOUT_MS:
          process.env.CODEX_APP_SERVER_REQUEST_TIMEOUT_MS ?? "30000",
        CODEX_APP_SERVER_INCLUDE_DEFAULT_ARGS:
          process.env.CODEX_APP_SERVER_INCLUDE_DEFAULT_ARGS ?? "true",
        ...(options.codex?.args ? { CODEX_ARGS_JSON: JSON.stringify(options.codex.args) } : {}),
      },
      stdio: "pipe",
    });
  } catch (error) {
    await egressProxy?.stop();
    throw error;
  }

  let exitResult: ExitResult | null = null;
  let runtimeFailure: Error | null = null;
  child.once("error", (error) => {
    runtimeFailure = error;
  });
  const { completion } = attachProcessLogs(child, stdoutLogPath, stderrLogPath);
  void completion.then((result) => {
    exitResult = result;
  }).catch((error) => {
    runtimeFailure = error instanceof Error ? error : new Error(String(error));
  });

  return {
    launchMode: "local-process",
    controlUrl,
    controller: new HttpRunBridgeController(controlUrl, controlToken),
    getDiagnostics: () => ({
      launchMode: "local-process",
      controlUrl,
      egressProxy: egressProxy?.getDiagnostics() ?? null,
    }),
    waitUntilReady: async () => {
      await waitForHealthImpl(
        controlUrl,
        options.startupTimeoutMs ?? workerConfig.runtimeStartupTimeoutMs,
        () => exitResult,
        "local bridge process",
        () => runtimeFailure
      );
    },
    completion,
    stop: async (stopOptions = {}) => {
      try {
        if (child.exitCode != null || child.killed) {
          await completion.catch(() => undefined);
          return;
        }

        if (!stopOptions.force) {
          const gracefulResult = await waitForCompletionGracefully(
            completion,
            LOCAL_BRIDGE_STOP_GRACE_MS
          );
          if (gracefulResult) {
            return;
          }
        }

        child.kill(stopOptions.force ? "SIGKILL" : "SIGTERM");
        await completion.catch(() => undefined);
      } finally {
        await egressProxy?.stop();
      }
    },
  };
}

export async function startDockerBridgeProcess(
  options: RuntimeProcessOptions,
  dependencies: RuntimeProcessDependencies = {}
): Promise<ManagedBridgeRuntimeHandle> {
  const workerConfig = loadWorkerRuntimeConfig();
  const allocatePortImpl = dependencies.allocatePortImpl ?? allocatePort;
  const runSubprocessImpl = dependencies.runSubprocessImpl ?? runSubprocess;
  const spawnImpl = dependencies.spawnImpl ?? spawn;
  const waitForHealthImpl = dependencies.waitForHealthImpl ?? waitForHealth;
  const cwd = options.job.preparedWorkspace.hostPaths.runRootPath;
  await fs.mkdir(options.job.preparedWorkspace.hostPaths.logsPath, { recursive: true });
  const daemonProbe = await probeDockerDaemon({
    dockerBin: workerConfig.dockerBin,
    cwd,
    runSubprocessImpl,
  });
  if (!daemonProbe.ready) {
    throw new Error(`Docker daemon is unavailable: ${daemonProbe.detail}`);
  }
  const apiConnector = createRuntimeApiConnector({
    baseUrl: options.apiBaseUrl || workerConfig.apiBaseUrl,
    authToken: options.authToken ?? workerConfig.internalAuthToken,
    createApiConnectorImpl: dependencies.createApiConnectorImpl,
  });
  const secretEnv = await materializeRuntimeSecrets(options.job, apiConnector);
  const egressProxy = await maybeStartRuntimeEgressProxy({
    launchMode: "docker",
    workerConfig,
    job: options.job,
    allocatePortImpl,
  });
  const controlPort = await allocatePortImpl();
  const controlUrl = `http://127.0.0.1:${controlPort}`;
  const controlToken = randomUUID();
  const stdoutLogPath = path.join(options.job.preparedWorkspace.hostPaths.logsPath, "bridge.stdout.log");
  const stderrLogPath = path.join(options.job.preparedWorkspace.hostPaths.logsPath, "bridge.stderr.log");
  const dockerEnv = buildDockerRuntimeEnv({
    plan: options.job.containerLaunchPlan,
    controlToken,
    hostControlPort: controlPort,
    runtimeApiBaseUrl: workerConfig.runtimeApiBaseUrl,
    authToken: options.authToken ?? workerConfig.internalAuthToken,
    secretEnv,
    egressProxyEnv: egressProxy?.env ?? undefined,
    codex: options.codex,
  });
  const envFilePath = path.join(options.job.preparedWorkspace.hostPaths.runtimePath, "docker.env");
  await writeDockerEnvFile(envFilePath, dockerEnv);
  const dockerCreateArgs = buildDockerCreateArgs({
    plan: options.job.containerLaunchPlan,
    hostControlPort: controlPort,
    bridgePort: workerConfig.bridgePort,
    envFilePath,
  });

  await runSubprocessImpl(
    workerConfig.dockerBin,
    ["rm", "-f", options.job.containerLaunchPlan.containerName],
    cwd
  ).catch(() => undefined);

  try {
    await runSubprocessImpl(workerConfig.dockerBin, dockerCreateArgs, cwd);
  } catch (error) {
    await egressProxy?.stop();
    throw error;
  } finally {
    await fs.rm(envFilePath, { force: true }).catch(() => undefined);
  }
  let child: SpawnedChildProcess;
  try {
    child = spawnImpl(workerConfig.dockerBin, buildDockerStartArgs(options.job.containerLaunchPlan.containerName), {
      cwd,
      env: process.env,
      stdio: "pipe",
    });
  } catch (error) {
    await egressProxy?.stop();
    throw error;
  }

  let exitResult: ExitResult | null = null;
  let runtimeFailure: Error | null = null;
  child.once("error", (error) => {
    runtimeFailure = error;
  });
  const { completion } = attachProcessLogs(child, stdoutLogPath, stderrLogPath);
  void completion.then((result) => {
    exitResult = result;
  }).catch((error) => {
    runtimeFailure = error instanceof Error ? error : new Error(String(error));
  });

  return {
    launchMode: "docker",
    controlUrl,
    controller: new HttpRunBridgeController(controlUrl, controlToken),
    getDiagnostics: () => ({
      launchMode: "docker",
      controlUrl,
      egressProxy: egressProxy?.getDiagnostics() ?? null,
    }),
    waitUntilReady: async () => {
      try {
        await waitForHealthImpl(
          controlUrl,
          options.startupTimeoutMs ?? workerConfig.runtimeStartupTimeoutMs,
          () => exitResult,
          "docker bridge runtime",
          () => runtimeFailure
        );
      } catch (error) {
        const inspectState = await inspectDockerContainerState({
          dockerBin: workerConfig.dockerBin,
          containerName: options.job.containerLaunchPlan.containerName,
          cwd,
          runSubprocessImpl,
        });
        const inspectSuffix = formatDockerInspectState(inspectState);
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}${inspectSuffix ? `; ${inspectSuffix}` : ""}`
        );
      }
    },
    completion,
    stop: async (stopOptions = {}) => {
      try {
        try {
          if (!stopOptions.force && child.exitCode == null && !child.killed) {
            await runSubprocessImpl(
              workerConfig.dockerBin,
              ["stop", "--time", "10", options.job.containerLaunchPlan.containerName],
              cwd
            );
          }
        } catch {
          // escalate to rm -f below
        }

        await runSubprocessImpl(
          workerConfig.dockerBin,
          ["rm", "-f", options.job.containerLaunchPlan.containerName],
          cwd
        ).catch(() => undefined);

        await completion.catch(() => undefined);
      } finally {
        await egressProxy?.stop();
      }
    },
  };
}

export async function startManagedBridgeRuntime(
  options: RuntimeProcessOptions,
  dependencies: RuntimeProcessDependencies = {}
): Promise<ManagedBridgeRuntimeHandle> {
  const workerConfig = loadWorkerRuntimeConfig();
  const launchMode = options.launchMode ?? workerConfig.runtimeLaunchMode;

  if (launchMode === "local-process") {
    return startLocalBridgeProcess(options, dependencies);
  }

  return startDockerBridgeProcess(options, dependencies);
}
