import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync, verify } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";

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

function decodeJwtSegment(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

async function startOAuthCallbackServer() {
  const port = await allocatePort();
  const tokenRequests = [];
  const callbackCalls = [];
  const basicClientId = "seedance-basic-client";
  const basicClientSecret = "seedance-basic-secret";
  const basicAccessToken = "seedance-basic-access-token";
  const jwtClientId = "seedance-jwt-client";
  const jwtAccessToken = "seedance-jwt-access-token";
  const jwtKeyId = "seedance-jwt-key-v1";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwtPrivateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const rawBody = await readRequestBody(request);

    if (url.pathname === "/oauth/basic/token") {
      const form = new URLSearchParams(rawBody);
      tokenRequests.push({
        path: url.pathname,
        authorization: request.headers.authorization ?? null,
        form: Object.fromEntries(form.entries()),
      });
      assert.equal(
        request.headers.authorization,
        `Basic ${Buffer.from(`${basicClientId}:${basicClientSecret}`, "utf8").toString("base64")}`
      );
      assert.equal(form.get("grant_type"), "client_credentials");
      assert.equal(form.get("scope"), "workflows.write");
      assert.equal(form.get("audience"), "https://seedance.example/callbacks");
      assert.equal(form.get("tenant"), "alpha");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          access_token: basicAccessToken,
          token_type: "Bearer",
          expires_in: 300,
        })
      );
      return;
    }

    if (url.pathname === "/oauth/jwt/token") {
      const form = new URLSearchParams(rawBody);
      tokenRequests.push({
        path: url.pathname,
        authorization: request.headers.authorization ?? null,
        form: Object.fromEntries(form.entries()),
      });
      assert.equal(request.headers.authorization ?? null, null);
      assert.equal(form.get("grant_type"), "client_credentials");
      assert.equal(form.get("resource"), "credential-callback");
      assert.equal(form.get("tenant"), "beta");
      assert.equal(form.get("client_id"), jwtClientId);
      assert.equal(
        form.get("client_assertion_type"),
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
      );

      const clientAssertion = form.get("client_assertion");
      assert.equal(typeof clientAssertion, "string");
      const [headerSegment, payloadSegment, signatureSegment] = clientAssertion.split(".");
      const header = decodeJwtSegment(headerSegment);
      const payload = decodeJwtSegment(payloadSegment);
      assert.equal(header.alg, "RS256");
      assert.equal(header.kid, jwtKeyId);
      assert.equal(payload.iss, "seedance-jwt-issuer");
      assert.equal(payload.sub, "seedance-jwt-subject");
      assert.equal(payload.aud, `http://127.0.0.1:${port}/oauth/jwt/token`);
      assert.equal(payload.jti.startsWith("clcca_"), true);
      assert.equal(
        verify(
          "RSA-SHA256",
          Buffer.from(`${headerSegment}.${payloadSegment}`, "utf8"),
          publicKey,
          Buffer.from(signatureSegment, "base64url")
        ),
        true
      );

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          access_token: jwtAccessToken,
          token_type: "Bearer",
          expires_in: 240,
        })
      );
      return;
    }

    if (url.pathname === "/callbacks/oauth-basic" || url.pathname === "/callbacks/oauth-jwt") {
      const body = rawBody ? JSON.parse(rawBody) : {};
      callbackCalls.push({
        path: url.pathname,
        authorization: request.headers.authorization ?? null,
        eventType: request.headers["x-lingban-event-type"] ?? null,
        attempt: request.headers["x-lingban-delivery-attempt"] ?? null,
        body,
      });
      const expectedToken =
        url.pathname === "/callbacks/oauth-basic" ? basicAccessToken : jwtAccessToken;
      assert.equal(request.headers.authorization, `Bearer ${expectedToken}`);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
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
    tokenRequests,
    callbackCalls,
    basicClientId,
    basicClientSecret,
    jwtClientId,
    jwtKeyId,
    jwtPrivateKeyPem,
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

test("credential lifecycle callback oauth smoke: client credentials and private_key_jwt auth", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-credential-callback-oauth-"));
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
  let oauthServer = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const apiDataDir = path.join(smokeRoot, "api-data");
    oauthServer = await startOAuthCallbackServer();

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
      "seedance-oauth-basic": {
        url: `${oauthServer.baseUrl}/callbacks/oauth-basic`,
        statuses: ["disabled"],
        auth: {
          type: "oauth-client-credentials",
          tokenUrl: `${oauthServer.baseUrl}/oauth/basic/token`,
          scope: "workflows.write",
          audience: "https://seedance.example/callbacks",
          additionalBody: {
            tenant: "alpha",
          },
          clientAuthentication: {
            method: "client_secret_basic",
            clientId: oauthServer.basicClientId,
            clientSecret: oauthServer.basicClientSecret,
          },
        },
        payload: {
          eventType: "credential.lifecycle.disabled.oauth",
          eventVersion: 4,
        },
      },
      "seedance-oauth-jwt": {
        url: `${oauthServer.baseUrl}/callbacks/oauth-jwt`,
        statuses: ["revoked"],
        auth: {
          type: "oauth-client-credentials",
          tokenUrl: `${oauthServer.baseUrl}/oauth/jwt/token`,
          resource: "credential-callback",
          additionalBody: {
            tenant: "beta",
          },
          clientAuthentication: {
            method: "private_key_jwt",
            clientId: oauthServer.jwtClientId,
            privateKeyPem: oauthServer.jwtPrivateKeyPem,
            keyId: oauthServer.jwtKeyId,
            issuer: "seedance-jwt-issuer",
            subject: "seedance-jwt-subject",
            assertionLifetimeSeconds: 300,
          },
        },
        payload: {
          eventType: "credential.lifecycle.revoked.oauth",
          eventVersion: 5,
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
        email: "smoke-callbacks-oauth@example.com",
        password: "TestPassword123!",
        displayName: "Smoke Callback OAuth",
        workspaceName: "Smoke Callback OAuth Workspace",
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
          displayName: `Seedance OAuth Basic ${suffix}`,
          provider: "seedance-oauth-basic",
          secretKind: "api-key",
          secretValue: `seedance-oauth-basic-${suffix}`,
        }),
      });

      const suspended = await requestJson(
        `${baseUrl}/v1/credentials/${encodeURIComponent(credential.credentialId)}/suspend`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            impactAction: "allow-active-runs",
            note: "suspend with oauth client credentials callback",
          }),
        }
      );
      assert.equal(suspended.credential.status, "disabled");
    }

    const jwtCredential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Seedance OAuth JWT",
        provider: "seedance-oauth-jwt",
        secretKind: "api-key",
        secretValue: "seedance-oauth-jwt-001",
      }),
    });

    const revoked = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(jwtCredential.credentialId)}/revoke`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          impactAction: "allow-active-runs",
          note: "revoke with private_key_jwt callback auth",
        }),
      }
    );
    assert.equal(revoked.credential.status, "revoked");

    assert.equal(
      oauthServer.tokenRequests.filter((entry) => entry.path === "/oauth/basic/token").length,
      1
    );
    assert.equal(
      oauthServer.tokenRequests.filter((entry) => entry.path === "/oauth/jwt/token").length,
      1
    );
    assert.equal(
      oauthServer.callbackCalls.filter((entry) => entry.path === "/callbacks/oauth-basic").length,
      2
    );
    assert.equal(
      oauthServer.callbackCalls.filter((entry) => entry.path === "/callbacks/oauth-jwt").length,
      1
    );

    const callbackDiagnostics = await requestJson(`${baseUrl}/internal/credentials/callbacks`, {
      headers: {
        "x-lingban-internal-token": "smoke-internal-token",
      },
    });
    assert.equal(
      callbackDiagnostics.configuredProviders.some(
        (item) =>
          item.provider === "seedance-oauth-basic" &&
          item.authMode === "oauth-client-credentials" &&
          item.authHeaderNames.includes("authorization") &&
          item.payloadEventVersion === 4
      ),
      true
    );
    assert.equal(
      callbackDiagnostics.configuredProviders.some(
        (item) =>
          item.provider === "seedance-oauth-jwt" &&
          item.authMode === "oauth-client-credentials" &&
          item.payloadEventType === "credential.lifecycle.revoked.oauth"
      ),
      true
    );
    assert.equal(
      callbackDiagnostics.recentDeliveries.filter((item) => item.status === "succeeded").length >= 3,
      true
    );
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }

    if (oauthServer) {
      await oauthServer.close().catch(() => undefined);
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
