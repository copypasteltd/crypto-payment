import { promises as fs } from "node:fs";
import path from "node:path";
import { loadWorkerRuntimeConfig } from "@lingban/config";
import { preparedRunWorkspaceSchema, type PreparedRunWorkspace } from "./specs.js";

const CONTAINER_WORKSPACE_ROOT = "/workspace";

function resolveWorkerRunsRoot() {
  return loadWorkerRuntimeConfig().runsRoot;
}

function buildContainerPaths() {
  return {
    workspaceRoot: CONTAINER_WORKSPACE_ROOT,
    targetPath: `${CONTAINER_WORKSPACE_ROOT}/target`,
    inputsPath: `${CONTAINER_WORKSPACE_ROOT}/inputs`,
    outputsPath: `${CONTAINER_WORKSPACE_ROOT}/outputs`,
    statePath: `${CONTAINER_WORKSPACE_ROOT}/state`,
    runtimePath: `${CONTAINER_WORKSPACE_ROOT}/runtime`,
    codexHomePath: `${CONTAINER_WORKSPACE_ROOT}/codex-home`,
    homePath: `${CONTAINER_WORKSPACE_ROOT}/home`,
    tmpPath: `${CONTAINER_WORKSPACE_ROOT}/tmp`,
    browserProfilePath: `${CONTAINER_WORKSPACE_ROOT}/browser-profile`,
    mcpPath: `${CONTAINER_WORKSPACE_ROOT}/mcp`,
    secretsPath: `${CONTAINER_WORKSPACE_ROOT}/secrets`,
    logsPath: `${CONTAINER_WORKSPACE_ROOT}/logs`,
  } as const;
}

async function chmodIfSupported(targetPath: string, mode: number) {
  await fs.chmod(targetPath, mode).catch(() => undefined);
}

export async function prepareRunWorkspace(input: {
  runId: string;
  workspaceId: string;
  targetPath: string;
}): Promise<PreparedRunWorkspace> {
  const runsRoot = resolveWorkerRunsRoot();
  const runRootPath = path.join(runsRoot, input.runId);
  const targetPath = path.resolve(input.targetPath);

  const hostPaths = {
    runRootPath,
    targetPath,
    inputsPath: path.join(runRootPath, "inputs"),
    outputsPath: path.join(runRootPath, "outputs"),
    statePath: path.join(runRootPath, "state"),
    runtimePath: path.join(runRootPath, "runtime"),
    codexHomePath: path.join(runRootPath, "codex-home"),
    homePath: path.join(runRootPath, "home"),
    tmpPath: path.join(runRootPath, "tmp"),
    browserProfilePath: path.join(runRootPath, "browser-profile"),
    mcpPath: path.join(runRootPath, "mcp"),
    secretsPath: path.join(runRootPath, "secrets"),
    logsPath: path.join(runRootPath, "logs"),
  };

  await Promise.all([
    fs.mkdir(hostPaths.runRootPath, { recursive: true }),
    fs.mkdir(hostPaths.targetPath, { recursive: true }),
    fs.mkdir(hostPaths.inputsPath, { recursive: true }),
    fs.mkdir(hostPaths.outputsPath, { recursive: true }),
    fs.mkdir(hostPaths.statePath, { recursive: true }),
    fs.mkdir(hostPaths.runtimePath, { recursive: true }),
    fs.mkdir(hostPaths.codexHomePath, { recursive: true }),
    fs.mkdir(hostPaths.homePath, { recursive: true }),
    fs.mkdir(hostPaths.tmpPath, { recursive: true }),
    fs.mkdir(hostPaths.browserProfilePath, { recursive: true }),
    fs.mkdir(hostPaths.mcpPath, { recursive: true }),
    fs.mkdir(hostPaths.secretsPath, { recursive: true }),
    fs.mkdir(hostPaths.logsPath, { recursive: true }),
  ]);

  await Promise.all([
    chmodIfSupported(hostPaths.runRootPath, 0o700),
    chmodIfSupported(hostPaths.inputsPath, 0o700),
    chmodIfSupported(hostPaths.outputsPath, 0o700),
    chmodIfSupported(hostPaths.statePath, 0o700),
    chmodIfSupported(hostPaths.runtimePath, 0o700),
    chmodIfSupported(hostPaths.codexHomePath, 0o700),
    chmodIfSupported(hostPaths.homePath, 0o700),
    chmodIfSupported(hostPaths.tmpPath, 0o700),
    chmodIfSupported(hostPaths.browserProfilePath, 0o700),
    chmodIfSupported(hostPaths.mcpPath, 0o700),
    chmodIfSupported(hostPaths.secretsPath, 0o700),
    chmodIfSupported(hostPaths.logsPath, 0o700),
  ]);

  return preparedRunWorkspaceSchema.parse({
    runId: input.runId,
    workspaceId: input.workspaceId,
    hostPaths,
    containerPaths: buildContainerPaths(),
  });
}

export async function cleanupRunWorkspace(input: { runId: string }) {
  const runsRoot = resolveWorkerRunsRoot();
  const runRootPath = path.join(runsRoot, input.runId);
  await fs.rm(runRootPath, { recursive: true, force: true });
}
