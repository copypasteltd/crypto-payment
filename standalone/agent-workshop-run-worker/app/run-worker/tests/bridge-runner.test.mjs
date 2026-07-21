import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { promises as fs } from "node:fs";

async function importBridgeRunnerModule() {
  return import(new URL("../dist/services/bridge-runner.js", import.meta.url));
}

async function allocateEphemeralPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate ephemeral port"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
    server.once("error", reject);
  });
}

class FakeChildProcess extends EventEmitter {
  constructor() {
    super();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.exitCode = null;
    this.killed = false;
  }

  kill() {
    this.killed = true;
    queueMicrotask(() => {
      this.exitCode = 0;
      this.emit("exit", 0, null);
    });
    return true;
  }
}

async function createWorkspaceFixture(runId) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `lingban-${runId}-`));
  const runRootPath = path.join(root, "run");
  const hostPaths = {
    runRootPath,
    targetPath: path.join(runRootPath, "target"),
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

  await Promise.all(Object.values(hostPaths).map((value) => fs.mkdir(value, { recursive: true })));

  return {
    root,
    preparedWorkspace: {
      runId,
      workspaceId: "wsp_test_runtime",
      hostPaths,
      containerPaths: {
        workspaceRoot: "/workspace",
        targetPath: "/workspace/target",
        inputsPath: "/workspace/inputs",
        outputsPath: "/workspace/outputs",
        statePath: "/workspace/state",
        runtimePath: "/workspace/runtime",
        codexHomePath: "/workspace/codex-home",
        homePath: "/workspace/home",
        tmpPath: "/workspace/tmp",
        browserProfilePath: "/workspace/browser-profile",
        mcpPath: "/workspace/mcp",
        secretsPath: "/workspace/secrets",
        logsPath: "/workspace/logs",
      },
    },
  };
}

function createJob(preparedWorkspace, runId) {
  return {
    accepted: true,
    payload: {
      run: {
        runId,
        workspaceId: "wsp_test_runtime",
        taskVersionId: "tsv_test_runtime",
        sessionVersionId: "sev_test_runtime",
        title: "Docker bridge runner test",
        targetPath: preparedWorkspace.hostPaths.targetPath,
        entrySurface: "dashboard",
        status: "QUEUED",
        statusReason: null,
        createdAt: "2026-07-08T10:00:00.000Z",
        updatedAt: "2026-07-08T10:00:00.000Z",
      },
      initialPrompt: "hello",
      requestedInitialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      credentialMounts: [
        {
          credentialId: "cred_secret_env",
          mode: "env",
          envName: "TEST_RUNTIME_SECRET",
          readOnly: true,
        },
      ],
      mcpBindings: [],
    },
    events: [],
    preparedWorkspace,
    hostBridgeContext: {
      runId,
      workspaceId: "wsp_test_runtime",
      targetPath: preparedWorkspace.hostPaths.targetPath,
      initialPrompt: "hello",
      requestedInitialMessage: null,
      credentialMounts: [
        {
          credentialId: "cred_secret_env",
          mode: "env",
          envName: "TEST_RUNTIME_SECRET",
          readOnly: true,
        },
      ],
      mcpBindings: [],
    },
    containerBridgeContext: {
      runId,
      workspaceId: "wsp_test_runtime",
      targetPath: preparedWorkspace.containerPaths.targetPath,
      initialPrompt: "hello",
      requestedInitialMessage: null,
      credentialMounts: [
        {
          credentialId: "cred_secret_env",
          mode: "env",
          envName: "TEST_RUNTIME_SECRET",
          readOnly: true,
        },
      ],
      mcpBindings: [],
    },
    runtimeConfig: {
      schemaVersion: 1,
      runId,
      workspaceId: "wsp_test_runtime",
      job: {
        run: {
          runId,
          workspaceId: "wsp_test_runtime",
          taskVersionId: "tsv_test_runtime",
          sessionVersionId: "sev_test_runtime",
          title: "Docker bridge runner test",
          targetPath: preparedWorkspace.hostPaths.targetPath,
          entrySurface: "dashboard",
          status: "QUEUED",
          statusReason: null,
          createdAt: "2026-07-08T10:00:00.000Z",
          updatedAt: "2026-07-08T10:00:00.000Z",
        },
        initialPrompt: "hello",
        requestedInitialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
        credentialMounts: [
          {
            credentialId: "cred_secret_env",
            mode: "env",
            envName: "TEST_RUNTIME_SECRET",
            readOnly: true,
          },
        ],
        mcpBindings: [],
      },
      workspace: preparedWorkspace,
      env: {
        HOME: preparedWorkspace.containerPaths.homePath,
        CODEX_HOME: preparedWorkspace.containerPaths.codexHomePath,
      },
      files: {
        runtimeConfigPath: path.join(preparedWorkspace.hostPaths.runtimePath, "runtime-config.json"),
        bridgeContextHostPath: path.join(preparedWorkspace.hostPaths.runtimePath, "bridge-context.host.json"),
        bridgeContextContainerPath: path.join(
          preparedWorkspace.hostPaths.runtimePath,
          "bridge-context.container.json"
        ),
        mcpConfigPath: path.join(preparedWorkspace.hostPaths.runtimePath, "mcp-config.json"),
        mcpBindingsPath: path.join(preparedWorkspace.hostPaths.runtimePath, "mcp-bindings.json"),
        secretManifestPath: path.join(preparedWorkspace.hostPaths.runtimePath, "secret-manifest.json"),
        containerLaunchPlanPath: path.join(
          preparedWorkspace.hostPaths.runtimePath,
          "container-launch-plan.json"
        ),
        codexConfigPath: path.join(preparedWorkspace.hostPaths.codexHomePath, "config.toml"),
      },
    },
    containerLaunchPlan: {
      runId,
      image: "ghcr.io/lingban/runner:latest",
      containerName: `lingban-run-${runId}`,
      workingDirectory: preparedWorkspace.containerPaths.targetPath,
      entrypoint: ["/usr/local/bin/lingban-runner-entrypoint"],
      env: {
        HOME: preparedWorkspace.containerPaths.homePath,
        CODEX_HOME: preparedWorkspace.containerPaths.codexHomePath,
        TARGET_PATH: preparedWorkspace.containerPaths.targetPath,
      },
      labels: {
        "lingban.run_id": runId,
      },
      mounts: [
        {
          source: preparedWorkspace.hostPaths.targetPath,
          target: preparedWorkspace.containerPaths.targetPath,
          readOnly: false,
        },
        {
          source: preparedWorkspace.hostPaths.runtimePath,
          target: preparedWorkspace.containerPaths.runtimePath,
          readOnly: false,
        },
      ],
      extraHosts: [],
      capAdd: [],
      egressFirewall: {
        enabled: false,
        allowDns: true,
        targets: [],
      },
      network: "lingban-egress-default",
      resources: {
        cpus: "2",
        memory: "4g",
        pidsLimit: 512,
      },
      removeOnExit: true,
      commandPreview: ["docker", "create"],
    },
  };
}

function createApiConnectorStub(secretValue = "super-secret-value") {
  return () => ({
    async materializeRunCredentials(runId) {
      return {
        lease: {
          leaseId: `lse_${runId}`,
          runId,
          workspaceId: "wsp_test_runtime",
          requestedByUserId: null,
          brokerKind: "local-envelope",
          credentialIds: ["cred_secret_env"],
          secretVersionByCredentialId: {
            cred_secret_env: 1,
          },
          issuedAt: "2026-07-10T10:00:00.000Z",
          expiresAt: "2026-07-10T10:05:00.000Z",
        },
        secrets: {
          cred_secret_env: secretValue,
        },
      };
    },
  });
}

test("startDockerBridgeProcess uses docker create/start flow and hides secrets from argv", async () => {
  const { startDockerBridgeProcess } = await importBridgeRunnerModule();
  const fixture = await createWorkspaceFixture("run_bridge_runner_flow");
  const job = createJob(fixture.preparedWorkspace, "run_bridge_runner_flow");
  const originalSecret = process.env.TEST_RUNTIME_SECRET;
  const originalRuntimeApiBaseUrl = process.env.LINGBAN_RUNTIME_API_BASE_URL;
  const originalRuntimeEgressProxyEnabled = process.env.LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED;
  const originalRuntimeEgressFirewallEnabled =
    process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED;
  const originalRuntimeEgressAllowedBaseUrls = process.env.LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS;
  process.env.TEST_RUNTIME_SECRET = "super-secret-value";
  process.env.LINGBAN_RUNTIME_API_BASE_URL = "http://host.docker.internal:3100";
  process.env.LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED = "true";
  process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED = "true";
  process.env.LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS = JSON.stringify([
    "https://api.openai.com/",
  ]);
  job.containerLaunchPlan.extraHosts = ["host.docker.internal:host-gateway"];
  job.containerLaunchPlan.capAdd = ["NET_ADMIN"];
  job.containerLaunchPlan.egressFirewall = {
    enabled: true,
    allowDns: true,
    targets: [
      {
        host: "host.docker.internal",
        port: 3100,
        reasons: ["runtime-api"],
      },
    ],
  };
  job.containerLaunchPlan.runtimeUser = {
    uid: 21010,
    gid: 21010,
    appliesAtCreate: false,
    dropRootInEntrypoint: true,
  };

  try {
    const subprocessCalls = [];
    const spawnCalls = [];
    let child = null;
    let dockerEnvFileContent = null;
    const runSubprocessImpl = async (command, args, cwd) => {
      subprocessCalls.push({ command, args, cwd });
      if (args[0] === "version") {
        return {
          stdout: JSON.stringify({
            Version: "27.1.1",
            ApiVersion: "1.47",
            Os: "linux",
            Experimental: false,
          }),
          stderr: "",
        };
      }
      if (args[0] === "create") {
        const envFileIndex = args.indexOf("--env-file");
        const envFilePath = envFileIndex >= 0 ? args[envFileIndex + 1] : null;
        if (envFilePath) {
          dockerEnvFileContent = await fs.readFile(envFilePath, "utf8");
        }
      }
      if (args[0] === "stop" && child) {
        queueMicrotask(() => {
          child.exitCode = 0;
          child.emit("exit", 0, null);
        });
      }

      return {
        stdout: args[0] === "create" ? "container-id-001\n" : "",
        stderr: "",
      };
    };

    const spawnImpl = (command, args, options) => {
      spawnCalls.push({ command, args, options });
      child = new FakeChildProcess();
      return child;
    };

    const handle = await startDockerBridgeProcess(
      {
        job,
        apiBaseUrl: "http://127.0.0.1:3100",
        authToken: "internal-auth-token",
      },
      {
        allocatePortImpl: allocateEphemeralPort,
        runSubprocessImpl,
        spawnImpl,
        waitForHealthImpl: async () => undefined,
        createApiConnectorImpl: createApiConnectorStub("super-secret-value"),
      }
    );

    await handle.waitUntilReady();
    const runtimeDiagnostics = handle.getDiagnostics();
    const envFilePath = path.join(fixture.preparedWorkspace.hostPaths.runtimePath, "docker.env");
    await assert.rejects(fs.access(envFilePath));

    assert.equal(subprocessCalls[0].args[0], "version");
    assert.equal(subprocessCalls[1].args[0], "rm");
    assert.equal(subprocessCalls[2].args[0], "create");
    assert.equal(spawnCalls[0].args[0], "start");
    assert.deepEqual(spawnCalls[0].args, ["start", "-a", job.containerLaunchPlan.containerName]);
    assert.equal(
      subprocessCalls[2].args.includes("super-secret-value"),
      false
    );
    assert.equal(
      dockerEnvFileContent?.includes("LINGBAN_API_BASE_URL=http://host.docker.internal:3100"),
      true
    );
    assert.equal(subprocessCalls[2].args.includes("--env-file"), true);
    assert.equal(subprocessCalls[2].args.includes("--entrypoint"), true);
    assert.equal(subprocessCalls[2].args.includes("--cap-add"), true);
    assert.equal(subprocessCalls[2].args.includes("NET_ADMIN"), true);
    assert.equal(subprocessCalls[2].args.includes("--user"), false);
    assert.equal(
      /HTTP_PROXY=http:\/\/[^:\n]+:[^@\n]+@host\.docker\.internal:\d+/m.test(
        dockerEnvFileContent ?? ""
      ),
      true
    );
    assert.equal(
      /LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED=true/m.test(
        dockerEnvFileContent ?? ""
      ),
      true
    );
    assert.equal(
      /LINGBAN_RUNTIME_EGRESS_FIREWALL_ALLOW_DNS=true/m.test(
        dockerEnvFileContent ?? ""
      ),
      true
    );
    assert.equal(
      /LINGBAN_RUNTIME_DROP_ROOT=true/m.test(dockerEnvFileContent ?? ""),
      true
    );
    assert.equal(
      /LINGBAN_RUNTIME_EXEC_UID=21010/m.test(dockerEnvFileContent ?? ""),
      true
    );
    assert.equal(
      /LINGBAN_RUNTIME_EXEC_GID=21010/m.test(dockerEnvFileContent ?? ""),
      true
    );
    assert.equal(
      /LINGBAN_RUNTIME_UMASK=077/m.test(dockerEnvFileContent ?? ""),
      true
    );
    const firewallTargetsMatch = (dockerEnvFileContent ?? "").match(
      /^LINGBAN_RUNTIME_EGRESS_FIREWALL_TARGETS_JSON=(.+)$/m
    );
    assert.ok(firewallTargetsMatch);
    const firewallTargets = JSON.parse(firewallTargetsMatch[1]);
    assert.equal(
      firewallTargets.some(
        (target) =>
          target.host === "host.docker.internal" &&
          target.port === 3100 &&
          target.reasons.includes("runtime-api")
      ),
      true
    );
    assert.equal(
      firewallTargets.some(
        (target) =>
          target.host === "host.docker.internal" &&
          typeof target.port === "number" &&
          target.reasons.includes("runtime-egress-proxy")
      ),
      true
    );
    assert.equal(
      (dockerEnvFileContent ?? "").includes("NO_PROXY=127.0.0.1,localhost,host.docker.internal"),
      true
    );
    assert.equal(subprocessCalls[2].args.includes("--add-host"), true);
    assert.equal(
      subprocessCalls[2].args.includes("host.docker.internal:host-gateway"),
      true
    );
    assert.equal(runtimeDiagnostics.launchMode, "docker");
    assert.equal(runtimeDiagnostics.egressProxy?.started, true);
    assert.equal(runtimeDiagnostics.egressProxy?.host, "0.0.0.0");
    assert.ok((runtimeDiagnostics.egressProxy?.port ?? 0) > 0);

    await handle.stop();
    assert.equal(
      subprocessCalls.some((entry) => entry.args[0] === "stop"),
      true
    );
    assert.equal(
      subprocessCalls.filter((entry) => entry.args[0] === "rm").length >= 2,
      true
    );
  } finally {
    if (originalSecret == null) {
      delete process.env.TEST_RUNTIME_SECRET;
    } else {
      process.env.TEST_RUNTIME_SECRET = originalSecret;
    }
    if (originalRuntimeApiBaseUrl == null) {
      delete process.env.LINGBAN_RUNTIME_API_BASE_URL;
    } else {
      process.env.LINGBAN_RUNTIME_API_BASE_URL = originalRuntimeApiBaseUrl;
    }
    if (originalRuntimeEgressProxyEnabled == null) {
      delete process.env.LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED;
    } else {
      process.env.LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED = originalRuntimeEgressProxyEnabled;
    }
    if (originalRuntimeEgressFirewallEnabled == null) {
      delete process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED;
    } else {
      process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED =
        originalRuntimeEgressFirewallEnabled;
    }
    if (originalRuntimeEgressAllowedBaseUrls == null) {
      delete process.env.LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS;
    } else {
      process.env.LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS = originalRuntimeEgressAllowedBaseUrls;
    }
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("buildDockerCreateArgs attaches --user when runtime user can be applied at create time", async () => {
  const { buildDockerCreateArgs } = await importBridgeRunnerModule();

  const args = buildDockerCreateArgs({
    plan: {
      runId: "run_bridge_user_create",
      image: "ghcr.io/lingban/runner:latest",
      containerName: "lingban-run-run_bridge_user_create",
      workingDirectory: "/workspace/target",
      entrypoint: ["/usr/local/bin/lingban-runner-entrypoint"],
      env: {},
      labels: {},
      mounts: [],
      extraHosts: [],
      capAdd: [],
      egressFirewall: {
        enabled: false,
        allowDns: true,
        targets: [],
      },
      runtimeUser: {
        uid: 21011,
        gid: 21011,
        appliesAtCreate: true,
        dropRootInEntrypoint: false,
      },
      network: "lingban-egress-default",
      resources: {
        cpus: "2",
        memory: "4g",
        pidsLimit: 512,
      },
      removeOnExit: true,
      commandPreview: ["docker", "create"],
    },
    hostControlPort: 39000,
    bridgePort: 3800,
    envFilePath: "/tmp/runtime/docker.env",
  });

  const userIndex = args.indexOf("--user");
  assert.ok(userIndex >= 0);
  assert.equal(args[userIndex + 1], "21011:21011");
});

test("probeDockerDaemon parses server metadata from docker version", async () => {
  const { probeDockerDaemon } = await importBridgeRunnerModule();
  const result = await probeDockerDaemon({
    dockerBin: "docker",
    cwd: process.cwd(),
    runSubprocessImpl: async (_command, args) => {
      assert.deepEqual(args, ["version", "--format", "{{json .Server}}"]);
      return {
        stdout: JSON.stringify({
          Version: "27.1.1",
          ApiVersion: "1.47",
          Os: "linux",
          Experimental: true,
        }),
        stderr: "",
      };
    },
  });

  assert.equal(result.backend, "docker");
  assert.equal(result.ready, true);
  assert.equal(result.serverVersion, "27.1.1");
  assert.equal(result.apiVersion, "1.47");
  assert.equal(result.os, "linux");
  assert.equal(result.experimental, true);
  assert.match(result.detail, /server=27\.1\.1/);
  assert.match(result.detail, /api=1\.47/);
});

test("startDockerBridgeProcess fails fast when docker daemon is unavailable", async () => {
  const { startDockerBridgeProcess } = await importBridgeRunnerModule();
  const fixture = await createWorkspaceFixture("run_bridge_runner_daemon_down");
  const job = createJob(fixture.preparedWorkspace, "run_bridge_runner_daemon_down");
  const subprocessCalls = [];

  try {
    await assert.rejects(
      startDockerBridgeProcess(
        {
          job,
          apiBaseUrl: "http://127.0.0.1:3100",
          authToken: "internal-auth-token",
        },
        {
          allocatePortImpl: async () => 39003,
          runSubprocessImpl: async (_command, args) => {
            subprocessCalls.push(args[0]);
            if (args[0] === "version") {
              throw new Error("Cannot connect to the Docker daemon");
            }
            return { stdout: "", stderr: "" };
          },
          spawnImpl: () => {
            throw new Error("should not spawn docker start when daemon probe fails");
          },
          waitForHealthImpl: async () => undefined,
        }
      ),
      /Docker daemon is unavailable: Cannot connect to the Docker daemon/
    );

    assert.deepEqual(subprocessCalls, ["version"]);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("startDockerBridgeProcess appends docker inspect details on health timeout", async () => {
  const { startDockerBridgeProcess } = await importBridgeRunnerModule();
  const fixture = await createWorkspaceFixture("run_bridge_runner_timeout");
  const job = createJob(fixture.preparedWorkspace, "run_bridge_runner_timeout");

  try {
    let child = null;
    const runSubprocessImpl = async (_command, args) => {
      if (args[0] === "version") {
        return {
          stdout: JSON.stringify({
            Version: "27.1.1",
            ApiVersion: "1.47",
            Os: "linux",
            Experimental: false,
          }),
          stderr: "",
        };
      }

      if (args[0] === "stop" && child) {
        queueMicrotask(() => {
          child.exitCode = 0;
          child.emit("exit", 0, null);
        });
        return { stdout: "", stderr: "" };
      }

      if (args[0] === "inspect") {
        return {
          stdout: JSON.stringify({
            Status: "exited",
            Running: false,
            ExitCode: 127,
            Error: "bridge crashed",
            Dead: false,
            OOMKilled: false,
          }),
          stderr: "",
        };
      }

      return { stdout: "", stderr: "" };
    };

    const spawnImpl = () => {
      child = new FakeChildProcess();
      return child;
    };

    const handle = await startDockerBridgeProcess(
      {
        job,
        apiBaseUrl: "http://127.0.0.1:3100",
        authToken: "internal-auth-token",
      },
      {
        allocatePortImpl: async () => 39002,
        runSubprocessImpl,
        spawnImpl,
        waitForHealthImpl: async () => {
          throw new Error("Timed out waiting for bridge health endpoint");
        },
        createApiConnectorImpl: createApiConnectorStub("super-secret-value"),
      }
    );

    await assert.rejects(
      handle.waitUntilReady(),
      /docker inspect: status=exited, running=false, exit=127, error=bridge crashed, dead=false, oom_killed=false/
    );

    await handle.stop();
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("startLocalBridgeProcess maps stdio allowlist prefixes from container paths to host paths", async () => {
  const { startLocalBridgeProcess } = await importBridgeRunnerModule();
  const fixture = await createWorkspaceFixture("run_bridge_runner_local_stdio");
  const job = createJob(fixture.preparedWorkspace, "run_bridge_runner_local_stdio");
  const originalAllowlist = process.env.LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES;

  try {
    process.env.LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES = JSON.stringify([
      "/workspace/target/tools",
      "/workspace/runtime/mcp",
    ]);

    const spawnCalls = [];
    const handle = await startLocalBridgeProcess(
      {
        job,
        apiBaseUrl: "http://127.0.0.1:3100",
        authToken: "internal-auth-token",
      },
      {
        allocatePortImpl: async () => 39011,
        spawnImpl: (command, args, options) => {
          spawnCalls.push({ command, args, options });
          const child = new FakeChildProcess();
          queueMicrotask(() => {
            child.kill();
          });
          return child;
        },
        waitForHealthImpl: async () => undefined,
        createApiConnectorImpl: createApiConnectorStub("local-secret-value"),
      }
    );

    await handle.waitUntilReady();
    const childEnv = spawnCalls[0].options.env;
    assert.equal(childEnv.HOME, fixture.preparedWorkspace.hostPaths.homePath);
    assert.equal(childEnv.CODEX_HOME, fixture.preparedWorkspace.hostPaths.codexHomePath);
    assert.equal(childEnv.TMPDIR, fixture.preparedWorkspace.hostPaths.tmpPath);
    assert.equal(childEnv.TARGET_PATH, fixture.preparedWorkspace.hostPaths.targetPath);
    assert.equal(childEnv.MCP_CONFIG_PATH, job.runtimeConfig.files.mcpConfigPath);
    assert.equal(childEnv.BRIDGE_CONTEXT_PATH, job.runtimeConfig.files.bridgeContextHostPath);
    assert.equal(childEnv.RUNTIME_CONFIG_PATH, job.runtimeConfig.files.runtimeConfigPath);
    assert.deepEqual(
      JSON.parse(childEnv.LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES),
      [
        path.join(fixture.preparedWorkspace.hostPaths.targetPath, "tools"),
        path.join(fixture.preparedWorkspace.hostPaths.runtimePath, "mcp"),
      ]
    );

    await handle.stop();
  } finally {
    if (originalAllowlist == null) {
      delete process.env.LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES;
    } else {
      process.env.LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES = originalAllowlist;
    }
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("startLocalBridgeProcess injects runtime egress proxy environment when enabled", async () => {
  const { startLocalBridgeProcess } = await importBridgeRunnerModule();
  const fixture = await createWorkspaceFixture("run_bridge_runner_local_proxy");
  const job = createJob(fixture.preparedWorkspace, "run_bridge_runner_local_proxy");
  const originalRuntimeApiBaseUrl = process.env.LINGBAN_RUNTIME_API_BASE_URL;
  const originalRuntimeEgressProxyEnabled = process.env.LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED;
  const originalRuntimeEgressAllowedBaseUrls = process.env.LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS;

  try {
    process.env.LINGBAN_RUNTIME_API_BASE_URL = "http://127.0.0.1:3100";
    process.env.LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED = "true";
    process.env.LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS = JSON.stringify([
      "https://api.openai.com/",
    ]);

    const spawnCalls = [];
    const handle = await startLocalBridgeProcess(
      {
        job,
        apiBaseUrl: "http://127.0.0.1:3100",
        authToken: "internal-auth-token",
      },
      {
        allocatePortImpl: allocateEphemeralPort,
        spawnImpl: (command, args, options) => {
          spawnCalls.push({ command, args, options });
          const child = new FakeChildProcess();
          queueMicrotask(() => {
            child.kill();
          });
          return child;
        },
        waitForHealthImpl: async () => undefined,
        createApiConnectorImpl: createApiConnectorStub("proxy-secret-value"),
      }
    );

    await handle.waitUntilReady();
    const childEnv = spawnCalls[0].options.env;
    const runtimeDiagnostics = handle.getDiagnostics();
    assert.equal(
      /^http:\/\/[^:]+:[^@]+@127\.0\.0\.1:\d+\/?$/.test(childEnv.HTTP_PROXY),
      true
    );
    assert.equal(childEnv.HTTP_PROXY, childEnv.HTTPS_PROXY);
    assert.equal(childEnv.NO_PROXY.includes("127.0.0.1"), true);
    assert.equal(childEnv.NO_PROXY.includes("localhost"), true);
    assert.equal(runtimeDiagnostics.launchMode, "local-process");
    assert.equal(runtimeDiagnostics.egressProxy?.started, true);
    assert.equal(runtimeDiagnostics.egressProxy?.host, "127.0.0.1");
    assert.ok((runtimeDiagnostics.egressProxy?.port ?? 0) > 0);

    await handle.stop();
  } finally {
    if (originalRuntimeApiBaseUrl == null) {
      delete process.env.LINGBAN_RUNTIME_API_BASE_URL;
    } else {
      process.env.LINGBAN_RUNTIME_API_BASE_URL = originalRuntimeApiBaseUrl;
    }
    if (originalRuntimeEgressProxyEnabled == null) {
      delete process.env.LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED;
    } else {
      process.env.LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED = originalRuntimeEgressProxyEnabled;
    }
    if (originalRuntimeEgressAllowedBaseUrls == null) {
      delete process.env.LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS;
    } else {
      process.env.LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS = originalRuntimeEgressAllowedBaseUrls;
    }
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});
