import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");
const standaloneRoot = path.join(workspaceRoot, "standalone");
const releaseRoot = path.join(workspaceRoot, "release");

const standaloneTargets = [
  {
    target: "admin",
    sourceDir: "agent-workshop-admin",
  },
  {
    target: "backend",
    sourceDir: "agent-workshop-backend",
  },
  {
    target: "run-worker",
    sourceDir: "agent-workshop-run-worker",
  },
  {
    target: "dashboard",
    sourceDir: "agent-workshop-dashboard",
  },
  {
    target: "app",
    sourceDir: "agent-workshop-app",
  },
];

const frontendBuilds = [
  {
    label: "admin",
    command: ["-C", path.join(workspaceRoot, "app", "admin"), "build"],
    distSource: path.join(workspaceRoot, "app", "admin", "dist"),
    distTarget: path.join(releaseRoot, "static", "admin"),
  },
  {
    label: "dashboard",
    command: ["-C", path.join(workspaceRoot, "app", "dashboard"), "build"],
    distSource: path.join(workspaceRoot, "app", "dashboard", "dist"),
    distTarget: path.join(releaseRoot, "static", "dashboard"),
  },
  {
    label: "mobile-h5",
    command: ["-C", path.join(workspaceRoot, "app", "mobile"), "build:h5"],
    distSource: path.join(workspaceRoot, "app", "mobile", "dist"),
    distTarget: path.join(releaseRoot, "static", "mobile-h5"),
  },
];

function resolvePnpmBin() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function quoteWindowsArg(value) {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, "$1$1")}"`;
}

function runCommand(command, args, cwd = workspaceRoot) {
  return new Promise((resolve, reject) => {
    const spawnCommand =
      process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command;
    const spawnArgs =
      process.platform === "win32"
        ? ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArg).join(" ")]
        : args;

    const child = spawn(spawnCommand, spawnArgs, {
      cwd,
      env: process.env,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function ensurePathExists(targetPath) {
  await stat(targetPath);
}

async function copyDirectory(sourceDir, destinationDir) {
  await rm(destinationDir, { recursive: true, force: true });
  await mkdir(path.dirname(destinationDir), { recursive: true });
  await cp(sourceDir, destinationDir, { recursive: true });
}

async function buildStandaloneWorkspaces() {
  for (const entry of standaloneTargets) {
    await runCommand("node", ["infra/scripts/export-standalone-workspace.mjs", entry.target], workspaceRoot);
  }
}

async function buildFrontends() {
  const pnpmBin = resolvePnpmBin();
  for (const build of frontendBuilds) {
    await runCommand(pnpmBin, build.command, workspaceRoot);
    await ensurePathExists(build.distSource);
    await copyDirectory(build.distSource, build.distTarget);
  }
}

async function copyStandaloneBundles() {
  for (const entry of standaloneTargets) {
    const sourceDir = path.join(standaloneRoot, entry.sourceDir);
    const destinationDir = path.join(releaseRoot, "workspaces", entry.target);
    await ensurePathExists(sourceDir);
    await copyDirectory(sourceDir, destinationDir);
  }
}

async function writeManifest() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    artifacts: {
      static: {
        admin: "static/admin",
        dashboard: "static/dashboard",
        mobileH5: "static/mobile-h5",
      },
      workspaces: {
        admin: "workspaces/admin",
        backend: "workspaces/backend",
        runWorker: "workspaces/run-worker",
        dashboard: "workspaces/dashboard",
        app: "workspaces/app",
      },
      deployAssets: "deploy",
    },
    postDeployChecklist: [
      "Install dependencies inside release/workspaces/backend and release/workspaces/run-worker.",
      "Build backend and run-worker standalone workspaces on the target Linux host.",
      "Run backend database migrations before restarting services.",
      "Serve release/static/dashboard and release/static/mobile-h5 through Nginx or another static host.",
      "Serve release/static/admin from an isolated Admin virtual host and proxy /admin/v1 to the API.",
      "Restart lingban-api and lingban-run-worker systemd services after updating the current symlink.",
    ],
  };

  await writeFile(path.join(releaseRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function main() {
  await rm(releaseRoot, { recursive: true, force: true });
  await mkdir(releaseRoot, { recursive: true });

  await buildStandaloneWorkspaces();
  await buildFrontends();
  await copyStandaloneBundles();
  await copyDirectory(path.join(workspaceRoot, "infra", "deploy"), path.join(releaseRoot, "deploy"));
  await writeManifest();

  process.stdout.write(`${JSON.stringify({ releaseRoot }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
