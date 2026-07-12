#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const composeFile = path.join(rootDir, "infra", "docker", "docker-compose.local.yml");
const composeEnvFile = path.join(rootDir, "infra", "docker", "compose.env");
const workerScript = path.join(rootDir, "infra", "scripts", "run-local-worker.mjs");
const defaultRunnerTag = "lingban/runner:local";

function printHelp() {
  console.log(`Usage: node infra/scripts/local-stack.mjs <command> [options]

Commands:
  up     Bring up postgres, redis, minio, and api, then wait for API /health.
  dev    Bring up the local stack, build the runner image, start the host worker,
         then wait for API /readyz.

Options:
  --skip-build          Skip "docker compose up --build".
  --skip-runner-build   Skip building the runner image in "dev" mode.
  --skip-worker-build   Skip "pnpm -C app/run-worker build" before daemon start.
  --runner-tag <tag>    Override the runner image tag. Default: lingban/runner:local
  --help                Show this help message.
`);
}

function parseArgs(argv) {
  if (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    return {
      command: "help",
      help: true,
      skipBuild: false,
      skipRunnerBuild: false,
      skipWorkerBuild: false,
      runnerTag: defaultRunnerTag,
    };
  }

  const [command = "up", ...rest] = argv;
  const options = {
    command,
    skipBuild: false,
    skipRunnerBuild: false,
    skipWorkerBuild: false,
    runnerTag: defaultRunnerTag,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }

    if (token === "--skip-build") {
      options.skipBuild = true;
      continue;
    }

    if (token === "--skip-runner-build") {
      options.skipRunnerBuild = true;
      continue;
    }

    if (token === "--skip-worker-build") {
      options.skipWorkerBuild = true;
      continue;
    }

    if (token === "--runner-tag") {
      const nextValue = rest[index + 1];
      if (!nextValue) {
        throw new Error("--runner-tag requires a value");
      }
      options.runnerTag = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}

function spawnChild(command, args, options = {}) {
  return spawn(command, args, {
    cwd: options.cwd ?? rootDir,
    env: options.env ?? process.env,
    stdio: options.stdio ?? "inherit",
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(command, args, options);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code=${code ?? "null"} signal=${signal ?? "null"}`
        )
      );
    });
  });
}

async function waitForUrl(url, label, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${label}: ${url}`);
}

async function bringUpCompose(skipBuild) {
  const composeArgs = [
    "compose",
    "-f",
    composeFile,
    "--env-file",
    composeEnvFile,
    "up",
    "-d",
  ];

  if (!skipBuild) {
    composeArgs.push("--build");
  }

  console.log("[lingban-infra] bringing up local compose stack");
  await run("docker", composeArgs);
  console.log("[lingban-infra] waiting for API /health");
  await waitForUrl("http://127.0.0.1:3100/health", "API health endpoint");
}

async function buildRunnerImage(runnerTag) {
  console.log(`[lingban-infra] building runner image ${runnerTag}`);
  await run("docker", ["build", "-f", "infra/docker/runner.Dockerfile", "-t", runnerTag, "."]);
}

async function startWorkerDaemon(skipWorkerBuild) {
  const args = [workerScript];
  if (skipWorkerBuild) {
    args.push("--skip-build");
  }

  console.log("[lingban-infra] starting host worker daemon");
  const child = spawnChild(process.execPath, args);
  const exitPromise = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `host worker exited with code=${code ?? "null"} signal=${signal ?? "null"}`
        )
      );
    });
  });

  return {
    child,
    exitPromise,
  };
}

async function runDevMode(options) {
  await bringUpCompose(options.skipBuild);
  if (!options.skipRunnerBuild) {
    await buildRunnerImage(options.runnerTag);
  }

  const worker = await startWorkerDaemon(options.skipWorkerBuild);
  try {
    console.log("[lingban-infra] waiting for API /readyz after worker startup");
    await Promise.race([
      waitForUrl("http://127.0.0.1:3100/readyz", "API readiness endpoint"),
      worker.exitPromise,
    ]);
    console.log("[lingban-infra] local stack is ready: compose services + host worker");
    await worker.exitPromise;
  } finally {
    worker.child.kill("SIGTERM");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.command === "up") {
    await bringUpCompose(options.skipBuild);
    console.log("[lingban-infra] local compose stack is healthy");
    return;
  }

  if (options.command === "dev") {
    await runDevMode(options);
    return;
  }

  throw new Error(`Unsupported command: ${options.command}`);
}

main().catch((error) => {
  console.error(`[lingban-infra] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
