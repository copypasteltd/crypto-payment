import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

async function importContainerRuntimeModule() {
  return import(new URL("../dist/services/container-runtime.js", import.meta.url));
}

test("materializeRunRuntime keeps internal auth token out of runtime artifacts and previews create flow", async () => {
  const { materializeRunRuntime } = await importContainerRuntimeModule();
  const originalInternalToken = process.env.LINGBAN_INTERNAL_AUTH_TOKEN;
  const originalWorkerApiBaseUrl = process.env.LINGBAN_API_BASE_URL;
  const originalRuntimeApiBaseUrl = process.env.LINGBAN_RUNTIME_API_BASE_URL;
  const originalRunnerDropRootEnabled = process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED;
  const originalRunnerUid = process.env.LINGBAN_RUNNER_UID;
  const originalRunnerGid = process.env.LINGBAN_RUNNER_GID;
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "internal-token-should-not-persist";
  process.env.LINGBAN_API_BASE_URL = "http://127.0.0.1:3100";
  process.env.LINGBAN_RUNTIME_API_BASE_URL = "http://host.docker.internal:3100";
  process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED = "true";
  process.env.LINGBAN_RUNNER_UID = "21001";
  process.env.LINGBAN_RUNNER_GID = "21001";

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lingban-runtime-"));
  const preparedWorkspace = {
    runId: "run_runtime_materialize",
    workspaceId: "wsp_runtime_materialize",
    hostPaths: {
      runRootPath: path.join(root, "run"),
      targetPath: path.join(root, "run", "target"),
      inputsPath: path.join(root, "run", "inputs"),
      outputsPath: path.join(root, "run", "outputs"),
      statePath: path.join(root, "run", "state"),
      runtimePath: path.join(root, "run", "runtime"),
      codexHomePath: path.join(root, "run", "codex-home"),
      homePath: path.join(root, "run", "home"),
      tmpPath: path.join(root, "run", "tmp"),
      browserProfilePath: path.join(root, "run", "browser-profile"),
      mcpPath: path.join(root, "run", "mcp"),
      secretsPath: path.join(root, "run", "secrets"),
      logsPath: path.join(root, "run", "logs"),
    },
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
  };

  try {
    await Promise.all(Object.values(preparedWorkspace.hostPaths).map((value) => fs.mkdir(value, { recursive: true })));

    const payload = {
      run: {
        runId: "run_runtime_materialize",
        workspaceId: "wsp_runtime_materialize",
        taskVersionId: "tsv_runtime_materialize",
        sessionVersionId: "sev_runtime_materialize",
        title: "Runtime materialize test",
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
      credentialMounts: [],
      mcpBindings: [],
      provider: {
        providerId: "prv_runtime_materialize",
        bindingId: "wpb_runtime_materialize",
        bindingScope: "platform",
        displayName: "Runtime Materialize Provider",
        adapterMode: "openai-compatible",
        apiStyle: "openai-compatible",
        baseUrl: "https://provider-runtime.example.com/v1",
        model: "gpt-runtime-materialize",
        credentialId: "cred_runtime_materialize",
        authEnvName: "OPENAI_API_KEY",
        baseUrlEnvName: "OPENAI_BASE_URL",
        modelEnvName: "OPENAI_MODEL",
        runtimeEnv: {
          OPENAI_BASE_URL: "https://provider-runtime.example.com/v1",
          OPENAI_MODEL: "gpt-runtime-materialize",
        },
        allowedBaseUrls: ["https://provider-runtime.example.com/v1"],
        resolvedAt: "2026-07-08T10:00:00.000Z",
      },
    };

    const hostBridgeContext = {
      runId: payload.run.runId,
      workspaceId: payload.run.workspaceId,
      targetPath: preparedWorkspace.hostPaths.targetPath,
      initialPrompt: payload.initialPrompt,
      requestedInitialMessage: null,
      credentialMounts: [],
      mcpBindings: [],
    };

    const containerBridgeContext = {
      runId: payload.run.runId,
      workspaceId: payload.run.workspaceId,
      targetPath: preparedWorkspace.containerPaths.targetPath,
      initialPrompt: payload.initialPrompt,
      requestedInitialMessage: null,
      credentialMounts: [],
      mcpBindings: [],
    };

    const runtime = await materializeRunRuntime({
      payload,
      preparedWorkspace,
      hostBridgeContext,
      containerBridgeContext,
    });

    assert.equal(
      Object.prototype.hasOwnProperty.call(runtime.runtimeConfig.env, "LINGBAN_INTERNAL_AUTH_TOKEN"),
      false
    );
    assert.equal(
      runtime.runtimeConfig.env.LINGBAN_API_BASE_URL,
      "http://host.docker.internal:3100"
    );
    assert.equal(runtime.containerLaunchPlan.commandPreview[0], "docker");
    assert.equal(runtime.containerLaunchPlan.commandPreview[1], "create");
    assert.equal(runtime.containerLaunchPlan.commandPreview.includes("--env-file"), true);
    assert.equal(runtime.containerLaunchPlan.commandPreview.includes("--user"), true);
    assert.equal(runtime.containerLaunchPlan.commandPreview.includes("21001:21001"), true);
    assert.equal(runtime.containerLaunchPlan.extraHosts.includes("host.docker.internal:host-gateway"), true);
    assert.equal(runtime.containerLaunchPlan.commandPreview.includes("--add-host"), true);
    assert.equal(runtime.containerLaunchPlan.runtimeUser.uid, 21001);
    assert.equal(runtime.containerLaunchPlan.runtimeUser.gid, 21001);
    assert.equal(runtime.containerLaunchPlan.runtimeUser.appliesAtCreate, true);
    assert.equal(runtime.containerLaunchPlan.runtimeUser.dropRootInEntrypoint, false);
    const codexConfig = await fs.readFile(runtime.runtimeConfig.files.codexConfigPath, "utf8");
    assert.match(codexConfig, /sandbox_mode = "workspace-write"/);
    assert.match(codexConfig, /\[sandbox_workspace_write\]/);
    assert.match(codexConfig, /network_access = true/);
    assert.match(codexConfig, /model_provider = "lingban_runtime"/);
    assert.ok(
      codexConfig.indexOf('model_provider = "lingban_runtime"') <
        codexConfig.indexOf("[sandbox_workspace_write]")
    );
    assert.match(codexConfig, /base_url = "https:\/\/provider-runtime\.example\.com\/v1"/);
    assert.match(codexConfig, /env_key = "OPENAI_API_KEY"/);
    assert.match(codexConfig, /wire_api = "responses"/);
    assert.match(codexConfig, /supports_websockets = false/);
    assert.equal(codexConfig.includes("internal-token-should-not-persist"), false);
  } finally {
    if (originalInternalToken == null) {
      delete process.env.LINGBAN_INTERNAL_AUTH_TOKEN;
    } else {
      process.env.LINGBAN_INTERNAL_AUTH_TOKEN = originalInternalToken;
    }
    if (originalWorkerApiBaseUrl == null) {
      delete process.env.LINGBAN_API_BASE_URL;
    } else {
      process.env.LINGBAN_API_BASE_URL = originalWorkerApiBaseUrl;
    }
    if (originalRuntimeApiBaseUrl == null) {
      delete process.env.LINGBAN_RUNTIME_API_BASE_URL;
    } else {
      process.env.LINGBAN_RUNTIME_API_BASE_URL = originalRuntimeApiBaseUrl;
    }
    if (originalRunnerDropRootEnabled == null) {
      delete process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED;
    } else {
      process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED = originalRunnerDropRootEnabled;
    }
    if (originalRunnerUid == null) {
      delete process.env.LINGBAN_RUNNER_UID;
    } else {
      process.env.LINGBAN_RUNNER_UID = originalRunnerUid;
    }
    if (originalRunnerGid == null) {
      delete process.env.LINGBAN_RUNNER_GID;
    } else {
      process.env.LINGBAN_RUNNER_GID = originalRunnerGid;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("materializeRunRuntime builds docker firewall plan for runtime API and governed remote MCP targets", async () => {
  const { materializeRunRuntime } = await importContainerRuntimeModule();
  const originalWorkerApiBaseUrl = process.env.LINGBAN_API_BASE_URL;
  const originalRuntimeApiBaseUrl = process.env.LINGBAN_RUNTIME_API_BASE_URL;
  const originalRuntimeEgressFirewallEnabled =
    process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED;
  const originalRuntimeEgressFirewallAllowDns =
    process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ALLOW_DNS;
  const originalRunnerDropRootEnabled = process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED;
  const originalRunnerUid = process.env.LINGBAN_RUNNER_UID;
  const originalRunnerGid = process.env.LINGBAN_RUNNER_GID;
  process.env.LINGBAN_API_BASE_URL = "http://127.0.0.1:3100";
  process.env.LINGBAN_RUNTIME_API_BASE_URL = "http://host.docker.internal:3100";
  process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED = "true";
  process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ALLOW_DNS = "true";
  process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED = "true";
  process.env.LINGBAN_RUNNER_UID = "21002";
  process.env.LINGBAN_RUNNER_GID = "21002";

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lingban-runtime-firewall-"));
  const preparedWorkspace = {
    runId: "run_runtime_firewall",
    workspaceId: "wsp_runtime_firewall",
    hostPaths: {
      runRootPath: path.join(root, "run"),
      targetPath: path.join(root, "run", "target"),
      inputsPath: path.join(root, "run", "inputs"),
      outputsPath: path.join(root, "run", "outputs"),
      statePath: path.join(root, "run", "state"),
      runtimePath: path.join(root, "run", "runtime"),
      codexHomePath: path.join(root, "run", "codex-home"),
      homePath: path.join(root, "run", "home"),
      tmpPath: path.join(root, "run", "tmp"),
      browserProfilePath: path.join(root, "run", "browser-profile"),
      mcpPath: path.join(root, "run", "mcp"),
      secretsPath: path.join(root, "run", "secrets"),
      logsPath: path.join(root, "run", "logs"),
    },
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
  };

  try {
    await Promise.all(
      Object.values(preparedWorkspace.hostPaths).map((value) =>
        fs.mkdir(value, { recursive: true })
      )
    );

    const payload = {
      run: {
        runId: "run_runtime_firewall",
        workspaceId: "wsp_runtime_firewall",
        taskVersionId: "tsv_runtime_firewall",
        sessionVersionId: "sev_runtime_firewall",
        title: "Runtime firewall test",
        targetPath: preparedWorkspace.hostPaths.targetPath,
        entrySurface: "dashboard",
        status: "QUEUED",
        statusReason: null,
        createdAt: "2026-07-10T10:00:00.000Z",
        updatedAt: "2026-07-10T10:00:00.000Z",
      },
      initialPrompt: "hello",
      requestedInitialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      credentialMounts: [],
      mcpBindings: [],
    };

    const remoteBinding = {
      bindingId: "mbd_remote_firewall",
      mcpId: "workspace:seedance-api",
      displayName: "Seedance Workspace Connector",
      source: "workspace-managed",
      transport: "http",
      ref: "https://mcp.workspace.internal/seedance",
      riskLevel: "medium",
      credentialId: null,
      authMode: null,
      authRef: null,
      networkPolicyRef: "np_seedance_workspace",
      approvalRequired: false,
    };
    const remotePolicy = {
      policyRef: "np_seedance_workspace",
      workspaceId: "wsp_runtime_firewall",
      displayName: "Seedance Workspace Policy",
      description: "allow managed seedance connector",
      status: "active",
      mode: "allowlist",
      allowedProtocols: ["https"],
      allowedHostPatterns: ["mcp.workspace.internal"],
      allowedPorts: [443],
      allowedPathPrefixes: ["/seedance"],
      requireTls: true,
      blockPrivateNetwork: false,
      tags: ["runtime", "managed"],
      createdAt: "2026-07-10T10:00:00.000Z",
      updatedAt: "2026-07-10T10:00:00.000Z",
    };

    const hostBridgeContext = {
      runId: payload.run.runId,
      workspaceId: payload.run.workspaceId,
      targetPath: preparedWorkspace.hostPaths.targetPath,
      initialPrompt: payload.initialPrompt,
      requestedInitialMessage: null,
      credentialMounts: [],
      mcpBindings: [remoteBinding],
      mcpNetworkPolicies: [remotePolicy],
    };

    const containerBridgeContext = {
      runId: payload.run.runId,
      workspaceId: payload.run.workspaceId,
      targetPath: preparedWorkspace.containerPaths.targetPath,
      initialPrompt: payload.initialPrompt,
      requestedInitialMessage: null,
      credentialMounts: [],
      mcpBindings: [remoteBinding],
      mcpNetworkPolicies: [remotePolicy],
    };

    const runtime = await materializeRunRuntime({
      payload,
      preparedWorkspace,
      hostBridgeContext,
      containerBridgeContext,
    });

    assert.deepEqual(runtime.containerLaunchPlan.capAdd, ["NET_ADMIN"]);
    assert.equal(runtime.containerLaunchPlan.egressFirewall.enabled, true);
    assert.equal(runtime.containerLaunchPlan.egressFirewall.allowDns, true);
    assert.equal(
      runtime.containerLaunchPlan.egressFirewall.targets.some(
        (target) =>
          target.host === "host.docker.internal" &&
          target.port === 3100 &&
          target.reasons.includes("runtime-api")
      ),
      true
    );
    assert.equal(
      runtime.containerLaunchPlan.egressFirewall.targets.some(
        (target) =>
          target.host === "mcp.workspace.internal" &&
          target.port === 443 &&
          target.reasons.includes("mcp-binding:mbd_remote_firewall")
      ),
      true
    );
    assert.equal(runtime.containerLaunchPlan.commandPreview.includes("--cap-add"), true);
    assert.equal(runtime.containerLaunchPlan.commandPreview.includes("NET_ADMIN"), true);
    assert.equal(runtime.containerLaunchPlan.commandPreview.includes("--user"), false);
    assert.equal(runtime.containerLaunchPlan.runtimeUser.uid, 21002);
    assert.equal(runtime.containerLaunchPlan.runtimeUser.gid, 21002);
    assert.equal(runtime.containerLaunchPlan.runtimeUser.appliesAtCreate, false);
    assert.equal(runtime.containerLaunchPlan.runtimeUser.dropRootInEntrypoint, true);
  } finally {
    if (originalWorkerApiBaseUrl == null) {
      delete process.env.LINGBAN_API_BASE_URL;
    } else {
      process.env.LINGBAN_API_BASE_URL = originalWorkerApiBaseUrl;
    }
    if (originalRuntimeApiBaseUrl == null) {
      delete process.env.LINGBAN_RUNTIME_API_BASE_URL;
    } else {
      process.env.LINGBAN_RUNTIME_API_BASE_URL = originalRuntimeApiBaseUrl;
    }
    if (originalRuntimeEgressFirewallEnabled == null) {
      delete process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED;
    } else {
      process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED =
        originalRuntimeEgressFirewallEnabled;
    }
    if (originalRuntimeEgressFirewallAllowDns == null) {
      delete process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ALLOW_DNS;
    } else {
      process.env.LINGBAN_RUNTIME_EGRESS_FIREWALL_ALLOW_DNS =
        originalRuntimeEgressFirewallAllowDns;
    }
    if (originalRunnerDropRootEnabled == null) {
      delete process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED;
    } else {
      process.env.LINGBAN_RUNNER_DROP_ROOT_ENABLED = originalRunnerDropRootEnabled;
    }
    if (originalRunnerUid == null) {
      delete process.env.LINGBAN_RUNNER_UID;
    } else {
      process.env.LINGBAN_RUNNER_UID = originalRunnerUid;
    }
    if (originalRunnerGid == null) {
      delete process.env.LINGBAN_RUNNER_GID;
    } else {
      process.env.LINGBAN_RUNNER_GID = originalRunnerGid;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("buildMaterializedMcpConfig accepts remote MCP bindings when runtime network policies are materialized", async () => {
  const { buildMaterializedMcpConfig } = await importContainerRuntimeModule();

  const config = buildMaterializedMcpConfig({
    bindings: [
      {
        bindingId: "mbd_remote_policy_ok",
        mcpId: "workspace:seedance-api",
        displayName: "Seedance Workspace Connector",
        source: "workspace-managed",
        transport: "http",
        ref: "https://mcp.workspace.internal/seedance",
        riskLevel: "medium",
        credentialId: null,
        authMode: null,
        authRef: null,
        networkPolicyRef: "np_seedance_workspace",
        approvalRequired: false,
      },
    ],
    policies: [
      {
        policyRef: "np_seedance_workspace",
        workspaceId: "wsp_runtime_materialize",
        displayName: "Seedance Workspace Policy",
        description: "allow managed seedance connector",
        status: "active",
        mode: "allowlist",
        allowedProtocols: ["https"],
        allowedHostPatterns: ["mcp.workspace.internal"],
        allowedPorts: [443],
        allowedPathPrefixes: ["/seedance"],
        requireTls: true,
        blockPrivateNetwork: false,
        tags: ["runtime", "managed"],
        createdAt: "2026-07-10T10:00:00.000Z",
        updatedAt: "2026-07-10T10:00:00.000Z",
      },
    ],
  });

  assert.equal(config.servers.mbd_remote_policy_ok.type, "remote-managed");
  assert.equal(config.servers.mbd_remote_policy_ok.url, "https://mcp.workspace.internal/seedance");
});

test("buildMaterializedMcpConfig rejects remote MCP bindings without a materialized runtime network policy", async () => {
  const { buildMaterializedMcpConfig } = await importContainerRuntimeModule();

  assert.throws(
    () =>
      buildMaterializedMcpConfig({
        bindings: [
          {
            bindingId: "mbd_remote_policy_missing",
            mcpId: "third-party:figma-mcp",
            displayName: "Figma MCP",
            source: "third-party",
            transport: "sse",
            ref: "https://third-party-mcp.example.org/figma/sse",
            riskLevel: "high",
            credentialId: null,
            authMode: null,
            authRef: null,
            networkPolicyRef: "np_figma_external",
            approvalRequired: true,
          },
        ],
        policies: [],
      }),
    /Runtime MCP policy validation failed:/
  );
});

test("buildMaterializedMcpConfig accepts stdio MCP bindings inside the configured allowlist", async () => {
  const { buildMaterializedMcpConfig } = await importContainerRuntimeModule();

  const config = buildMaterializedMcpConfig({
    bindings: [
      {
        bindingId: "mbd_stdio_allowed",
        mcpId: "workspace:stdio-allowed",
        displayName: "Allowed Local MCP",
        source: "workspace-managed",
        transport: "stdio",
        ref: "/workspace/target/tools/allowed-stdio-mcp.mjs",
        stdioPolicy: {
          refSha256: "a".repeat(64),
        },
        riskLevel: "medium",
        credentialId: null,
        authMode: null,
        authRef: null,
        networkPolicyRef: null,
        approvalRequired: false,
      },
    ],
    policies: [],
    stdioAllowedPathPrefixes: ["/workspace/target/tools"],
  });

  assert.equal(config.servers.mbd_stdio_allowed.type, "local-process");
  assert.equal(config.servers.mbd_stdio_allowed.command, "node");
        assert.deepEqual(config.servers.mbd_stdio_allowed.args, [
          "/workspace/target/tools/allowed-stdio-mcp.mjs",
        ]);
});

test("buildMaterializedMcpConfig rejects stdio MCP bindings outside the configured allowlist", async () => {
  const { buildMaterializedMcpConfig } = await importContainerRuntimeModule();

  assert.throws(
    () =>
      buildMaterializedMcpConfig({
        bindings: [
          {
            bindingId: "mbd_stdio_disallowed",
            mcpId: "workspace:stdio-disallowed",
            displayName: "Disallowed Local MCP",
            source: "workspace-managed",
            transport: "stdio",
            ref: "/workspace/runtime/tools/disallowed-stdio-mcp.mjs",
            riskLevel: "medium",
            credentialId: null,
            authMode: null,
            authRef: null,
            networkPolicyRef: null,
            approvalRequired: false,
          },
        ],
        policies: [],
        stdioAllowedPathPrefixes: ["/workspace/target/tools"],
      }),
    /STDIO_PATH_NOT_ALLOWED/
  );
});
