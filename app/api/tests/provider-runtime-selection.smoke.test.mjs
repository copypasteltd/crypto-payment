import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate port"));
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

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();

  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText} ${text}`
  );

  return text ? JSON.parse(text) : null;
}

async function waitForRun(baseUrl, runId, predicate, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const startedAt = Date.now();
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await requestJson(`${baseUrl}/v1/runs/${runId}`, {
      headers: options.headers,
    });
    lastSnapshot = snapshot;
    if (predicate(snapshot)) {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `Timed out waiting for run ${runId}: ${JSON.stringify(
      lastSnapshot
        ? {
            status: lastSnapshot.run?.status ?? null,
            runtime: lastSnapshot.runtime ?? null,
            provider: lastSnapshot.provider ?? null,
            files: lastSnapshot.files?.map((file) => file.path) ?? [],
            messages: lastSnapshot.messages?.slice(-5).map((message) => message.text) ?? [],
          }
        : null
    )}`
  );
}

test("provider runtime smoke: admin-configured provider resolves into codex runtime env", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-provider-runtime-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_OBJECT_STORAGE_DRIVER",
    "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_RUNS_DIR",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_RUNTIME_DISPATCH_MODE",
    "LINGBAN_RUNTIME_STARTUP_TIMEOUT_MS",
    "LINGBAN_TERMINAL_WORKSPACE_TTL_MS",
    "LINGBAN_API_BASE_URL",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_PLATFORM_ADMIN_EMAILS",
    "CODEX_BIN",
    "CODEX_RUNTIME_PROTOCOL",
    "LINGBAN_BRIDGE_ARGS",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const objectStorageRoot = path.join(smokeRoot, "objects");
    const runsRoot = path.join(smokeRoot, "worker-runs");
    const targetPath = path.join(smokeRoot, "workspace-provider");
    const fakeCodexScriptPath = fileURLToPath(
      new URL("./support/fake-codex-provider-env.mjs", import.meta.url)
    );

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
    process.env.LINGBAN_RUNS_DIR = runsRoot;
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_RUNTIME_STARTUP_TIMEOUT_MS = "8000";
    process.env.LINGBAN_TERMINAL_WORKSPACE_TTL_MS = "60000";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "provider-runtime-internal-token";
    process.env.LINGBAN_AUTH_MODE = "required";
    process.env.LINGBAN_PLATFORM_ADMIN_EMAILS = "provider-runtime@example.com";
    process.env.CODEX_BIN = process.execPath;
    process.env.CODEX_RUNTIME_PROTOCOL = "legacy-pty";
    process.env.LINGBAN_BRIDGE_ARGS = JSON.stringify([fakeCodexScriptPath]);

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "provider-runtime@example.com",
        password: "TestPassword123!",
        displayName: "Provider Runtime",
        workspaceName: "Provider Runtime Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const provider = await requestJson(`${baseUrl}/v1/providers`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        displayName: "Third-party OpenAI Proxy",
        description: "smoke provider",
        baseUrl: "https://third-party-openai.example.com/v1",
        defaultModel: "gpt-4.1",
        models: [
          {
            model: "gpt-4.1",
            enabled: true,
            isDefault: true,
            capabilities: {
              stream: true,
              toolCalling: true,
              responsesApi: true,
              longSession: true,
            },
          },
          {
            model: "gpt-4.1-mini",
            enabled: true,
            isDefault: false,
            capabilities: {
              stream: true,
              toolCalling: true,
              responsesApi: true,
              longSession: true,
            },
          },
        ],
        allowCustomModel: false,
      }),
    });

    const credential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Third-party provider key",
        provider: "third-party-openai",
        secretKind: "api-key",
        mountMode: "env",
        envName: "THIRD_PARTY_PROVIDER_KEY",
        secretValue: "provider-live-key-001",
        secretRef: "vault://third-party-openai/key",
        notes: "provider runtime credential",
      }),
    });

    const binding = await requestJson(`${baseUrl}/v1/provider-bindings`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        providerId: provider.providerId,
        credentialId: credential.credentialId,
        enabled: true,
        isDefault: true,
        allowUserOverride: true,
        notes: "default provider binding",
      }),
    });

    assert.equal(binding.providerId, provider.providerId);
    assert.equal(binding.credentialId, credential.credentialId);

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_provider_runtime",
        sessionVersionId: "sev_provider_runtime",
        title: "Provider runtime smoke",
        targetPath,
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
        providerSelection: {
          providerId: provider.providerId,
          model: "gpt-4.1-mini",
        },
      }),
    });

    const runId = createdRun.run.runId;
    const succeededSnapshot = await waitForRun(
      baseUrl,
      runId,
      (snapshot) => snapshot.run.status === "SUCCEEDED" && snapshot.runtime.exitCode === 0,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(succeededSnapshot.provider.providerId, provider.providerId);
    assert.equal(succeededSnapshot.provider.bindingId, binding.bindingId);
    assert.equal(succeededSnapshot.provider.model, "gpt-4.1-mini");
    assert.equal(
      succeededSnapshot.provider.runtimeEnv.OPENAI_BASE_URL,
      "https://third-party-openai.example.com/v1"
    );
    assert.equal(
      succeededSnapshot.provider.runtimeEnv.OPENAI_MODEL,
      "gpt-4.1-mini"
    );

    const preview = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/provider-env.json")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(preview.mode, "text");
    const providerEnv = JSON.parse(preview.content);
    assert.deepEqual(providerEnv, {
      baseUrl: "https://third-party-openai.example.com/v1",
      model: "gpt-4.1-mini",
      apiKey: "provider-live-key-001",
      apiKeyPresent: true,
    });
  } finally {
    if (app) {
      await app.close();
    }

    for (const [key, value] of envBackup) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
