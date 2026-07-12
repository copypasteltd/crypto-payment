import test from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { mtlsFixtures } from "./support/mtls-fixtures.mjs";

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

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function startMtlsLifecycleCallbackServer() {
  const port = await allocatePort();
  const tokenRequests = [];
  const callbackCalls = [];
  const accessToken = "seedance-mtls-access-token";

  const server = https.createServer(
    {
      key: mtlsFixtures.serverKeyPem,
      cert: mtlsFixtures.serverCertPem,
      ca: mtlsFixtures.caCertPem,
      requestCert: true,
      rejectUnauthorized: true,
    },
    async (request, response) => {
      assert.equal(request.socket.authorized, true);
      const peer = request.socket.getPeerCertificate();
      assert.equal(peer.subject?.CN, "Lingban Test Client");

      const url = new URL(request.url ?? "/", `https://127.0.0.1:${port}`);
      const rawBody = await readRequestBody(request);

      if (url.pathname === "/oauth/token") {
        const form = new URLSearchParams(rawBody);
        tokenRequests.push({
          authorization: request.headers.authorization ?? null,
          form: Object.fromEntries(form.entries()),
        });
        assert.equal(request.headers.authorization ?? null, null);
        assert.equal(form.get("grant_type"), "client_credentials");
        assert.equal(form.get("client_id"), "seedance-mtls-client");
        assert.equal(form.get("client_secret"), "seedance-mtls-secret");
        assert.equal(form.get("scope"), "callback.write");
        assert.equal(form.get("resource"), "seedance-callback");
        assert.equal(form.get("tenant"), "gamma");
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 300,
          })
        );
        return;
      }

      if (url.pathname === "/callbacks/credential") {
        const body = rawBody ? JSON.parse(rawBody) : {};
        callbackCalls.push({
          authorization: request.headers.authorization ?? null,
          eventType: request.headers["x-lingban-event-type"] ?? null,
          attempt: request.headers["x-lingban-delivery-attempt"] ?? null,
          body,
        });
        assert.equal(request.headers.authorization, `Bearer ${accessToken}`);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }

      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
    }
  );

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
    baseUrl: `https://127.0.0.1:${port}`,
    tokenRequests,
    callbackCalls,
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

test("credential lifecycle callback mTLS smoke: token endpoint and callback use mutual TLS", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-credential-callback-mtls-"));
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
    "LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACKS_JSON",
    "LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_BACKOFF_MS",
    "LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_MAX_ATTEMPTS",
  ];
  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;
  let mtlsServer = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const apiDataDir = path.join(smokeRoot, "api-data");
    mtlsServer = await startMtlsLifecycleCallbackServer();

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = apiDataDir;
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;
    process.env.LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_BACKOFF_MS = "100";
    process.env.LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_MAX_ATTEMPTS = "4";
    process.env.LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACKS_JSON = JSON.stringify({
      "seedance-mtls": {
        url: `${mtlsServer.baseUrl}/callbacks/credential`,
        statuses: ["disabled"],
        auth: {
          type: "oauth-client-credentials",
          tokenUrl: `${mtlsServer.baseUrl}/oauth/token`,
          scope: "callback.write",
          resource: "seedance-callback",
          additionalBody: {
            tenant: "gamma",
          },
          clientAuthentication: {
            method: "client_secret_post",
            clientId: "seedance-mtls-client",
            clientSecret: "seedance-mtls-secret",
          },
        },
        transport: {
          callbackTls: {
            rejectUnauthorized: true,
            caPem: mtlsFixtures.caCertPem,
            certPem: mtlsFixtures.clientCertPem,
            keyPem: mtlsFixtures.clientKeyPem,
          },
          tokenTls: {
            rejectUnauthorized: true,
            caPem: mtlsFixtures.caCertPem,
            certPem: mtlsFixtures.clientCertPem,
            keyPem: mtlsFixtures.clientKeyPem,
          },
        },
        payload: {
          eventType: "credential.lifecycle.disabled.mtls",
          eventVersion: 6,
        },
      },
    });

    const [{ startApiServer }, { resetApiRuntimeConfigForTests }] = await Promise.all([
      import("../dist/index.js"),
      import("../dist/app/runtime.js"),
    ]);
    resetApiRuntimeConfigForTests();
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "smoke-callbacks-mtls@example.com",
        password: "TestPassword123!",
        displayName: "Smoke Callback mTLS",
        workspaceName: "Smoke Callback mTLS Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    for (const suffix of ["001", "002"]) {
      const credential = await requestJson(`${baseUrl}/v1/credentials`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          scope: "workspace",
          displayName: `Seedance mTLS ${suffix}`,
          provider: "seedance-mtls",
          secretKind: "api-key",
          secretValue: `seedance-mtls-${suffix}`,
        }),
      });

      const suspended = await requestJson(
        `${baseUrl}/v1/credentials/${encodeURIComponent(credential.credentialId)}/suspend`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            impactAction: "allow-active-runs",
            note: "suspend with mtls callback transport",
          }),
        }
      );
      assert.equal(suspended.credential.status, "disabled");
    }

    assert.equal(mtlsServer.tokenRequests.length, 1);
    assert.equal(mtlsServer.callbackCalls.length, 2);
    assert.equal(mtlsServer.callbackCalls[0].eventType, "credential.lifecycle.disabled.mtls");
    assert.equal(mtlsServer.callbackCalls[0].attempt, "1");

    const callbackDiagnostics = await requestJson(`${baseUrl}/internal/credentials/callbacks`, {
      headers: {
        "x-lingban-internal-token": "smoke-internal-token",
      },
    });
    assert.equal(
      callbackDiagnostics.configuredProviders.some(
        (item) =>
          item.provider === "seedance-mtls" &&
          item.authMode === "oauth-client-credentials" &&
          item.callbackMtlsEnabled === true &&
          item.tokenMtlsEnabled === true &&
          item.payloadEventVersion === 6
      ),
      true
    );
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }

    if (mtlsServer) {
      await mtlsServer.close().catch(() => undefined);
    }

    try {
      const { resetApiRuntimeConfigForTests } = await import("../dist/app/runtime.js");
      resetApiRuntimeConfigForTests();
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
