import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";

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

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function startFakeVaultTransitServer(options = {}) {
  const port = options.port ?? (await allocatePort());
  const token = options.token ?? "smoke-vault-token";
  const namespace = options.namespace ?? null;
  const mount = options.mount ?? "transit";
  const encryptCalls = [];
  const decryptCalls = [];
  const ciphertextLedger = new Map();
  let sequence = 1;

  const server = http.createServer(async (request, response) => {
    try {
      if ((request.headers["x-vault-token"] ?? "") !== token) {
        response.writeHead(403, { "content-type": "application/json" });
        response.end(JSON.stringify({ errors: ["invalid token"] }));
        return;
      }

      if (namespace && request.headers["x-vault-namespace"] !== namespace) {
        response.writeHead(403, { "content-type": "application/json" });
        response.end(JSON.stringify({ errors: ["invalid namespace"] }));
        return;
      }

      const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
      if (request.method === "GET" && url.pathname === "/v1/sys/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            initialized: true,
            sealed: false,
            standby: false,
          })
        );
        return;
      }

      const encryptPrefix = `/v1/${mount}/encrypt/`;
      if (request.method === "POST" && url.pathname.startsWith(encryptPrefix)) {
        const keyId = decodeURIComponent(url.pathname.slice(encryptPrefix.length));
        const body = await readJsonBody(request);
        assert.equal(typeof body.plaintext, "string");
        assert.equal(typeof body.associated_data, "string");

        const ciphertext = `vault:v1:${sequence++}:${keyId}`;
        ciphertextLedger.set(ciphertext, {
          keyId,
          plaintext: body.plaintext,
          associatedData: body.associated_data,
          type: body.type ?? null,
        });
        encryptCalls.push({
          keyId,
          plaintext: body.plaintext,
          associatedData: body.associated_data,
          type: body.type ?? null,
        });

        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            data: {
              ciphertext,
            },
          })
        );
        return;
      }

      const decryptPrefix = `/v1/${mount}/decrypt/`;
      if (request.method === "POST" && url.pathname.startsWith(decryptPrefix)) {
        const keyId = decodeURIComponent(url.pathname.slice(decryptPrefix.length));
        const body = await readJsonBody(request);
        const stored = ciphertextLedger.get(body.ciphertext);
        if (!stored || stored.keyId !== keyId || stored.associatedData !== body.associated_data) {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ errors: ["ciphertext mismatch"] }));
          return;
        }

        decryptCalls.push({
          keyId,
          ciphertext: body.ciphertext,
          associatedData: body.associated_data,
        });

        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            data: {
              plaintext: stored.plaintext,
            },
          })
        );
        return;
      }

      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ errors: ["not found"] }));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          errors: [error instanceof Error ? error.message : String(error)],
        })
      );
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    token,
    namespace,
    mount,
    encryptCalls,
    decryptCalls,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(undefined);
        });
      });
    },
  };
}

test("credential broker smoke: vault transit provider seals, rotates, materializes, and reports health", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-vault-broker-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_RUNS_DIR",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_API_BASE_URL",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "CODEX_BIN",
    "LINGBAN_CREDENTIAL_BROKER_PROVIDER",
    "LINGBAN_CREDENTIAL_BROKER_ACTIVE_KEY_ID",
    "LINGBAN_CREDENTIAL_BROKER_VAULT_BASE_URL",
    "LINGBAN_CREDENTIAL_BROKER_VAULT_TOKEN",
    "LINGBAN_CREDENTIAL_BROKER_VAULT_NAMESPACE",
    "LINGBAN_CREDENTIAL_BROKER_VAULT_TRANSIT_MOUNT",
  ];
  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;
  let fakeVault = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const targetPath = path.join(smokeRoot, "target");
    const apiDataDir = path.join(smokeRoot, "api-data");
    fakeVault = await startFakeVaultTransitServer({
      token: "smoke-vault-token",
      namespace: "smoke-team",
      mount: "transit",
    });

    await mkdir(targetPath, { recursive: true });

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = apiDataDir;
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;
    process.env.LINGBAN_CREDENTIAL_BROKER_PROVIDER = "vault-transit-http";
    process.env.LINGBAN_CREDENTIAL_BROKER_ACTIVE_KEY_ID = "lingban-smoke-key";
    process.env.LINGBAN_CREDENTIAL_BROKER_VAULT_BASE_URL = fakeVault.baseUrl;
    process.env.LINGBAN_CREDENTIAL_BROKER_VAULT_TOKEN = fakeVault.token;
    process.env.LINGBAN_CREDENTIAL_BROKER_VAULT_NAMESPACE = fakeVault.namespace ?? "";
    process.env.LINGBAN_CREDENTIAL_BROKER_VAULT_TRANSIT_MOUNT = fakeVault.mount;

    const [
      { startApiServer },
      { resetApiRuntimeConfigForTests },
      { resetCredentialBrokerForTests },
    ] = await Promise.all([
      import("../dist/index.js"),
      import("../dist/app/runtime.js"),
      import("../dist/modules/credentials/broker.js"),
    ]);
    resetApiRuntimeConfigForTests();
    resetCredentialBrokerForTests();
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "smoke-vault-broker@example.com",
        password: "TestPassword123!",
        displayName: "Smoke Vault Broker",
        workspaceName: "Smoke Vault Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const brokerHealth = await requestJson(`${baseUrl}/internal/credentials/broker/health`, {
      headers: {
        "x-lingban-internal-token": "smoke-internal-token",
      },
    });
    assert.equal(brokerHealth.provider, "vault-transit-http");
    assert.equal(brokerHealth.readiness.ready, true);

    const createdCredential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Vault Transit Seedance Key",
        provider: "seedance",
        secretKind: "api-key",
        secretValue: "seedance-vault-key-001",
        secretRef: "vault://seedance/transit",
        notes: "stored through external transit broker",
      }),
    });
    assert.equal(createdCredential.brokerKind, "vault-transit-http");
    assert.equal(createdCredential.activeKeyId, "lingban-smoke-key");
    assert.equal(fakeVault.encryptCalls.length, 1);

    const credentialsStatePath = path.join(
      apiDataDir,
      "credentials",
      "credentials-state.json"
    );
    const storedCredentialsState = JSON.parse(await readFile(credentialsStatePath, "utf8"));
    assert.equal(storedCredentialsState.credentials.length, 1);
    assert.equal(
      storedCredentialsState.credentials[0].secretEnvelope.brokerKind,
      "vault-transit-http"
    );
    assert.equal(
      storedCredentialsState.credentials[0].secretEnvelope.algorithm,
      "vault-transit"
    );
    assert.equal(
      typeof storedCredentialsState.credentials[0].secretEnvelope.ciphertext,
      "string"
    );
    assert.equal(
      "ciphertextBase64" in storedCredentialsState.credentials[0].secretEnvelope,
      false
    );

    const createRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000091_vault",
        sessionVersionId: "sev_00000091_vault",
        title: "Vault credential broker smoke",
        targetPath,
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [createdCredential.credentialId],
        },
      }),
    });

    const decryptCallsBeforeMaterialize = fakeVault.decryptCalls.length;

    const materializedSecrets = await requestJson(
      `${baseUrl}/internal/runs/${createRun.run.runId}/credentials/materialize`,
      {
        method: "POST",
        headers: {
          "x-lingban-internal-token": "smoke-internal-token",
          "x-lingban-trace-id": "trace_vault_materialize_01",
        },
      }
    );
    assert.equal(
      materializedSecrets.secrets[createdCredential.credentialId],
      "seedance-vault-key-001"
    );
    assert.equal(materializedSecrets.lease.brokerKind, "vault-transit-http");
    assert.equal(
      materializedSecrets.lease.brokerKindByCredentialId[createdCredential.credentialId],
      "vault-transit-http"
    );
    assert.equal(
      fakeVault.decryptCalls.length >= decryptCallsBeforeMaterialize + 1,
      true
    );

    const rotatedCredential = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/rotate`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          secretValue: "seedance-vault-key-002",
          secretRef: "vault://seedance/transit@v2",
          note: "rotate through vault transit broker",
        }),
      }
    );
    assert.equal(rotatedCredential.brokerKind, "vault-transit-http");
    assert.equal(rotatedCredential.secretVersion, 2);
    assert.equal(fakeVault.encryptCalls.length, 2);

    const decryptCallsBeforeRematerialize = fakeVault.decryptCalls.length;

    const rematerializedSecrets = await requestJson(
      `${baseUrl}/internal/runs/${createRun.run.runId}/credentials/materialize`,
      {
        method: "POST",
        headers: {
          "x-lingban-internal-token": "smoke-internal-token",
          "x-lingban-trace-id": "trace_vault_materialize_02",
        },
      }
    );
    assert.equal(
      rematerializedSecrets.secrets[createdCredential.credentialId],
      "seedance-vault-key-002"
    );
    assert.equal(
      rematerializedSecrets.lease.secretVersionByCredentialId[createdCredential.credentialId],
      2
    );
    assert.equal(
      fakeVault.decryptCalls.length >= decryptCallsBeforeRematerialize + 1,
      true
    );

    const auditEvents = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/audit-events?limit=12`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(auditEvents.some((event) => event.action === "created"), true);
    assert.equal(auditEvents.some((event) => event.action === "rotated"), true);
    assert.equal(
      auditEvents.filter((event) => event.action === "materialized").length >= 2,
      true
    );
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }

    if (fakeVault) {
      await fakeVault.close().catch(() => undefined);
    }

    try {
      const [{ resetApiRuntimeConfigForTests }, { resetCredentialBrokerForTests }] =
        await Promise.all([
          import("../dist/app/runtime.js"),
          import("../dist/modules/credentials/broker.js"),
        ]);
      resetApiRuntimeConfigForTests();
      resetCredentialBrokerForTests();
    } catch {
      // Ignore cleanup failures in smoke tests.
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
