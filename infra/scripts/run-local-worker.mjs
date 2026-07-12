#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnvFile, resolvePnpmCommand } from "./env-file.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultEnvFile = path.join(rootDir, "infra", "docker", "worker.host.env");

function printHelp() {
  console.log(`Usage: node infra/scripts/run-local-worker.mjs [options]

Options:
  --env-file <path>   Override the worker env file path.
  --skip-build        Skip "pnpm -C app/run-worker build" before start.
  --help              Show this help message.
`);
}

function parseArgs(argv) {
  const options = {
    envFile: defaultEnvFile,
    skipBuild: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }

    if (token === "--skip-build") {
      options.skipBuild = true;
      continue;
    }

    if (token === "--env-file") {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error("--env-file requires a value");
      }
      options.envFile = path.resolve(rootDir, nextValue);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
    });

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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const envFromFile = await loadEnvFile(options.envFile);
  const env = {
    ...process.env,
    ...envFromFile,
  };

  console.log(`[lingban-infra] worker env file: ${options.envFile}`);
  console.log(
    `[lingban-infra] worker runs root: ${env.LINGBAN_RUNS_DIR ?? "<default .lingban-data/worker/runs>"}`
  );

  if (!options.skipBuild) {
    console.log("[lingban-infra] building host run-worker before daemon start");
    await run(resolvePnpmCommand(), ["-C", "app/run-worker", "build"]);
  }

  console.log("[lingban-infra] starting host run-worker daemon");
  await run(resolvePnpmCommand(), ["-C", "app/run-worker", "start:daemon"], {
    env,
  });
}

main().catch((error) => {
  console.error(`[lingban-infra] failed to start host worker: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
