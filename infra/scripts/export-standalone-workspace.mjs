import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");
const defaultOutputRoot = path.join(workspaceRoot, "standalone");
const onlyBuiltDependencies = [
  "@parcel/watcher",
  "@swc/core",
  "@tarojs/binding",
  "@tarojs/cli",
  "core-js",
  "core-js-pure",
  "esbuild",
  "msgpackr-extract",
  "node-pty",
];

const copyExcludes = new Set([
  ".git",
  "node_modules",
  "dist",
  ".turbo",
  ".lingban-data",
  ".smoke",
  ".tmp",
  ".codex-artifacts",
  "playwright-report",
]);

const repoPresets = {
  app: {
    bundleDirName: "agent-workshop-app",
    sourceDir: "app/mobile",
    validateCommand: "pnpm run typecheck && pnpm run build:h5",
  },
  dashboard: {
    bundleDirName: "agent-workshop-dashboard",
    sourceDir: "app/dashboard",
    validateCommand: "pnpm run lint && pnpm run build",
  },
  backend: {
    bundleDirName: "agent-workshop-backend",
    sourceDir: "app/api",
    validateCommand: "pnpm run build && pnpm run test:smoke:compiled",
  },
  "run-worker": {
    bundleDirName: "agent-workshop-run-worker",
    sourceDir: "app/run-worker",
    validateCommand: "pnpm run test",
  },
  sdk: {
    bundleDirName: "agent-workshop-sdk",
    sourceDir: "app/container-bridge",
    validateCommand: "pnpm run test",
  },
};

function usage() {
  return [
    "Usage:",
    "  node infra/scripts/export-standalone-workspace.mjs <target|all> [--output-root <dir>]",
    "",
    "Targets:",
    `  ${Object.keys(repoPresets).join(", ")}, all`,
  ].join("\n");
}

function normalizePathForManifest(value) {
  return value.replace(/\\/g, "/");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadWorkspacePackageMap() {
  const candidates = [
    "app/api",
    "app/container-bridge",
    "app/dashboard",
    "app/mobile",
    "app/run-worker",
    "packages/api-sdk",
    "packages/config",
    "packages/contracts",
    "packages/credential",
    "packages/db",
    "packages/domain-models",
    "packages/files",
    "packages/mcp",
    "packages/realtime",
    "packages/session-pack",
    "packages/shared",
    "packages/ui-tokens",
  ];

  const workspacePackages = new Map();

  for (const relativeDir of candidates) {
    const manifestPath = path.join(workspaceRoot, relativeDir, "package.json");
    const manifest = await readJson(manifestPath);
    workspacePackages.set(manifest.name, {
      name: manifest.name,
      relativeDir,
      manifest,
    });
  }

  return workspacePackages;
}

function collectInternalWorkspaceClosure(targetPackageName, workspacePackages) {
  const queued = [targetPackageName];
  const visited = new Set();

  while (queued.length > 0) {
    const packageName = queued.shift();
    if (!packageName || visited.has(packageName)) {
      continue;
    }

    const workspacePackage = workspacePackages.get(packageName);
    if (!workspacePackage) {
      throw new Error(`Unknown workspace package: ${packageName}`);
    }

    visited.add(packageName);

    for (const fieldName of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      const dependencyMap = workspacePackage.manifest[fieldName] ?? {};
      for (const dependencyName of Object.keys(dependencyMap)) {
        if (workspacePackages.has(dependencyName)) {
          queued.push(dependencyName);
        }
      }
    }
  }

  return [...visited]
    .map((packageName) => workspacePackages.get(packageName))
    .sort((left, right) => left.relativeDir.localeCompare(right.relativeDir));
}

async function copyWorkspaceEntry(relativeDir, outputRoot) {
  const sourceDir = path.join(workspaceRoot, relativeDir);
  const destinationDir = path.join(outputRoot, relativeDir);
  await mkdir(path.dirname(destinationDir), { recursive: true });
  await cp(sourceDir, destinationDir, {
    recursive: true,
    filter: (sourcePath) => {
      const baseName = path.basename(sourcePath);
      return !copyExcludes.has(baseName);
    },
  });
}

function buildDependencyBuildCommand(sourcePackageName, includedPackages) {
  const buildTargets = includedPackages
    .filter(
      (entry) => entry.name !== sourcePackageName && typeof entry.manifest.scripts?.build === "string"
    )
    .map((entry) => entry.name);

  if (buildTargets.length === 0) {
    return "";
  }

  return `pnpm ${buildTargets.map((target) => `--filter ${target}`).join(" ")} build`;
}

function shouldPrebuildWorkspaceDeps(scriptName) {
  return scriptName === "build" || scriptName === "typecheck" || scriptName.startsWith("build:");
}

function buildRootScripts(sourceDir, sourceManifest, includedPackages, validateCommand) {
  const scripts = {};
  const dependencyBuildCommand = buildDependencyBuildCommand(sourceManifest.name, includedPackages);

  for (const scriptName of Object.keys(sourceManifest.scripts ?? {})) {
    if (scriptName === "prepare") {
      continue;
    }

    const targetCommand = `pnpm -C ${normalizePathForManifest(sourceDir)} run ${scriptName}`;
    scripts[scriptName] =
      dependencyBuildCommand && shouldPrebuildWorkspaceDeps(scriptName)
        ? `${dependencyBuildCommand} && ${targetCommand}`
        : targetCommand;
  }

  scripts.validate = validateCommand;
  return scripts;
}

function buildGeneratedRootPackageJson(preset, sourceManifest, includedPackages) {
  const rootManifest = sourceManifest.__workspaceRootManifest;
  return {
    name: `${preset.bundleDirName}-workspace`,
    private: true,
    version: "0.1.0",
    type: "module",
    packageManager: "pnpm@10.0.0",
    pnpm: {
      onlyBuiltDependencies,
    },
    devDependencies: {
      ...(rootManifest?.devDependencies ?? {}),
    },
    scripts: buildRootScripts(
      preset.sourceDir,
      sourceManifest,
      includedPackages,
      preset.validateCommand
    ),
  };
}

function buildBundleReadme(input) {
  const includedPackageRows = input.includedPackages
    .map((entry) => `- \`${entry.name}\` -> \`${normalizePathForManifest(entry.relativeDir)}\``)
    .join("\n");

  return `# ${input.bundleDirName}

This directory is a standalone workspace export for \`${normalizePathForManifest(input.sourceDir)}\`.

## Included workspace entries

${includedPackageRows}

## Commands

\`\`\`bash
pnpm install
pnpm run validate
\`\`\`

The generated root scripts forward to the original app package scripts while preserving the internal workspace closure required by \`workspace:*\` dependencies.
`;
}

async function copyRootSupportFiles(outputRoot, generatedRootPackageJson) {
  await writeFile(
    path.join(outputRoot, "package.json"),
    JSON.stringify(generatedRootPackageJson, null, 2) + "\n",
    "utf8"
  );
  await cp(
    path.join(workspaceRoot, "pnpm-workspace.yaml"),
    path.join(outputRoot, "pnpm-workspace.yaml")
  );
  await cp(
    path.join(workspaceRoot, "tsconfig.base.json"),
    path.join(outputRoot, "tsconfig.base.json")
  );
  await cp(path.join(workspaceRoot, "turbo.json"), path.join(outputRoot, "turbo.json"));
  await writeFile(
    path.join(outputRoot, ".gitignore"),
    ["node_modules/", ".turbo/", "playwright-report/", "app/*/dist/", "packages/*/dist/"].join("\n") +
      "\n",
    "utf8"
  );
}

async function exportPreset(targetName, preset, workspacePackages, outputRootBase) {
  const sourceManifestPath = path.join(workspaceRoot, preset.sourceDir, "package.json");
  const sourceManifest = await readJson(sourceManifestPath);
  const workspaceRootManifest = await readJson(path.join(workspaceRoot, "package.json"));
  const includedPackages = collectInternalWorkspaceClosure(sourceManifest.name, workspacePackages);
  const bundleRoot = path.join(outputRootBase, preset.bundleDirName);

  await rm(bundleRoot, { recursive: true, force: true });
  await mkdir(bundleRoot, { recursive: true });

  for (const entry of includedPackages) {
    await copyWorkspaceEntry(entry.relativeDir, bundleRoot);
  }

  const generatedRootPackageJson = buildGeneratedRootPackageJson(
    preset,
    {
      ...sourceManifest,
      __workspaceRootManifest: workspaceRootManifest,
    },
    includedPackages
  );
  await copyRootSupportFiles(bundleRoot, generatedRootPackageJson);

  await writeFile(
    path.join(bundleRoot, "standalone-manifest.json"),
    JSON.stringify(
      {
        target: targetName,
        bundleDirName: preset.bundleDirName,
        sourceDir: normalizePathForManifest(preset.sourceDir),
        validateCommand: preset.validateCommand,
        includedPackages: includedPackages.map((entry) => ({
          name: entry.name,
          relativeDir: normalizePathForManifest(entry.relativeDir),
        })),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  await writeFile(
    path.join(bundleRoot, "README.md"),
    buildBundleReadme({
      bundleDirName: preset.bundleDirName,
      sourceDir: preset.sourceDir,
      includedPackages,
    }),
    "utf8"
  );

  return {
    target: targetName,
    bundleRoot,
    includedPackages,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  let outputRootBase = defaultOutputRoot;
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--output-root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-root requires a value");
      }
      outputRootBase = path.resolve(workspaceRoot, value);
      index += 1;
      continue;
    }
    positional.push(argument);
  }

  const requestedTarget = positional[0];
  if (!requestedTarget) {
    throw new Error("A target is required.");
  }

  const targets =
    requestedTarget === "all"
      ? Object.entries(repoPresets)
      : [[requestedTarget, repoPresets[requestedTarget]]];

  if (targets.some(([, preset]) => !preset)) {
    throw new Error(`Unknown target: ${requestedTarget}`);
  }

  await mkdir(outputRootBase, { recursive: true });
  const workspacePackages = await loadWorkspacePackageMap();
  const results = [];

  for (const [targetName, preset] of targets) {
    results.push(await exportPreset(targetName, preset, workspacePackages, outputRootBase));
  }

  process.stdout.write(
    `${JSON.stringify(
      results.map((result) => ({
        target: result.target,
        bundleRoot: normalizePathForManifest(result.bundleRoot),
        includedPackages: result.includedPackages.map((entry) => entry.name),
      })),
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
