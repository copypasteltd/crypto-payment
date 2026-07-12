import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function computeSha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return {
    raw,
    parsed: raw ? JSON.parse(raw) : {},
  };
}

async function startLifecycleCallbackServer() {
  const port = await allocatePort();
  const calls = [];
  const failCounts = new Map([["/callbacks/seedance-retry", 1]]);
  const seedanceBearerToken = "seedance-bearer-token";
  const seedanceRetryHmacSecret = "seedance-retry-hmac-secret";
  const seedanceRetryHmacKeyId = "seedance-retry-key-v1";

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const { raw, parsed } = await readJsonBody(request);
    const authorizationHeader = request.headers.authorization ?? null;
    const callbackSecretHeader = request.headers["x-callback-secret"] ?? null;
    const signatureHeader = request.headers["x-lingban-signature"] ?? null;
    const signatureTimestampHeader =
      request.headers["x-lingban-signature-timestamp"] ?? null;
    const payloadHashHeader = request.headers["x-lingban-payload-sha256"] ?? null;
    const signatureKeyIdHeader =
      request.headers["x-lingban-signature-key-id"] ?? null;

    if (url.pathname === "/callbacks/seedance") {
      assert.equal(authorizationHeader, `Bearer ${seedanceBearerToken}`);
    }

    if (url.pathname === "/callbacks/seedance-retry") {
      assert.equal(typeof signatureHeader, "string");
      assert.equal(typeof signatureTimestampHeader, "string");
      assert.equal(payloadHashHeader, computeSha256Hex(raw));
      assert.equal(signatureKeyIdHeader, seedanceRetryHmacKeyId);
      const expectedSignature =
        "sha256=" +
        createHmac("sha256", seedanceRetryHmacSecret)
          .update(`${signatureTimestampHeader}.${payloadHashHeader}`)
          .digest("hex");
      assert.equal(signatureHeader, expectedSignature);
    }

    calls.push({
      path: url.pathname,
      method: request.method ?? "GET",
      headers: {
        callbackSecret: request.headers["x-callback-secret"] ?? null,
        contentType: request.headers["content-type"] ?? null,
        authorization: authorizationHeader,
        deliveryId: request.headers["x-lingban-delivery-id"] ?? null,
        eventType: request.headers["x-lingban-event-type"] ?? null,
        eventVersion: request.headers["x-lingban-event-version"] ?? null,
        attempt: request.headers["x-lingban-delivery-attempt"] ?? null,
        maxAttempts: request.headers["x-lingban-delivery-max-attempts"] ?? null,
        signature: signatureHeader,
        signatureTimestamp: signatureTimestampHeader,
        payloadHash: payloadHashHeader,
        signatureKeyId: signatureKeyIdHeader,
      },
      body: parsed,
      rawBody: raw,
    });

    const remainingFailures = failCounts.get(url.pathname) ?? 0;
    if (remainingFailures > 0) {
      failCounts.set(url.pathname, remainingFailures - 1);
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "retry later" }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
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
    calls,
    seedanceBearerToken,
    seedanceRetryHmacSecret,
    seedanceRetryHmacKeyId,
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

test("credential lifecycle callback smoke: dispatch, failure audit, and retry sweep", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-credential-callback-"));
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
  let callbackServer = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const apiDataDir = path.join(smokeRoot, "api-data");
    callbackServer = await startLifecycleCallbackServer();

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
      seedance: {
        url: `${callbackServer.baseUrl}/callbacks/seedance`,
        headers: {
          "x-callback-secret": "seedance-secret",
        },
        auth: {
          type: "bearer",
          token: callbackServer.seedanceBearerToken,
        },
        payload: {
          eventType: "credential.lifecycle.disabled",
          eventVersion: 2,
        },
        statuses: ["disabled", "revoked"],
        timeoutMs: 1500,
      },
      "seedance-retry": {
        url: `${callbackServer.baseUrl}/callbacks/seedance-retry`,
        headers: {
          "x-callback-secret": "seedance-retry-secret",
        },
        auth: {
          type: "hmac-sha256",
          secret: callbackServer.seedanceRetryHmacSecret,
          keyId: callbackServer.seedanceRetryHmacKeyId,
        },
        payload: {
          eventType: "credential.lifecycle.revoked",
          eventVersion: 3,
        },
        statuses: ["revoked"],
        timeoutMs: 1500,
      },
    });

    const [
      { startApiServer },
      { resetApiRuntimeConfigForTests },
    ] = await Promise.all([
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
        email: "smoke-callbacks@example.com",
        password: "TestPassword123!",
        displayName: "Smoke Callbacks",
        workspaceName: "Smoke Callback Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const suspendableCredential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Seedance Suspendable Key",
        provider: "seedance",
        secretKind: "api-key",
        secretValue: "seedance-callback-key-001",
        secretRef: "vault://seedance/callback",
      }),
    });

    const suspended = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(suspendableCredential.credentialId)}/suspend`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          impactAction: "allow-active-runs",
          note: "suspend and notify provider",
        }),
      }
    );
    assert.equal(suspended.credential.status, "disabled");

    const suspendCallbackCall = callbackServer.calls.find(
      (call) =>
        call.path === "/callbacks/seedance" &&
        call.body.credential?.credentialId === suspendableCredential.credentialId
    );
    assert.equal(Boolean(suspendCallbackCall), true);
    assert.equal(suspendCallbackCall.headers.callbackSecret, "seedance-secret");
    assert.equal(
      suspendCallbackCall.headers.authorization,
      `Bearer ${callbackServer.seedanceBearerToken}`
    );
    assert.equal(suspendCallbackCall.headers.eventType, "credential.lifecycle.disabled");
    assert.equal(suspendCallbackCall.headers.eventVersion, "2");
    assert.equal(suspendCallbackCall.headers.attempt, "1");
    assert.equal(suspendCallbackCall.headers.maxAttempts, "4");
    assert.equal(suspendCallbackCall.body.targetStatus, "disabled");
    assert.equal(suspendCallbackCall.body.eventType, "credential.lifecycle.disabled");
    assert.equal(suspendCallbackCall.body.eventVersion, 2);
    assert.equal(suspendCallbackCall.body.delivery.attempt, 1);
    assert.equal(
      suspendCallbackCall.body.credential.redactedSecretRef,
      suspended.credential.redactedSecretRef
    );

    const suspendAuditEvents = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(suspendableCredential.credentialId)}/audit-events?limit=12`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      suspendAuditEvents.some((event) => event.action === "lifecycle-callback-sent"),
      true
    );

    const retryCredential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Seedance Retry Key",
        provider: "seedance-retry",
        secretKind: "api-key",
        secretValue: "seedance-callback-key-002",
        secretRef: "vault://seedance/retry",
      }),
    });

    const revoked = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(retryCredential.credentialId)}/revoke`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          impactAction: "allow-active-runs",
          note: "revoke and retry callback on failure",
        }),
      }
    );
    assert.equal(revoked.credential.status, "revoked");

    const firstRetryCallCount = callbackServer.calls.filter(
      (call) =>
        call.path === "/callbacks/seedance-retry" &&
        call.body.credential?.credentialId === retryCredential.credentialId
    ).length;
    assert.equal(firstRetryCallCount, 1);

    const failedAuditEvents = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(retryCredential.credentialId)}/audit-events?limit=20`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      failedAuditEvents.some((event) => event.action === "lifecycle-callback-failed"),
      true
    );

    const callbackDiagnostics = await requestJson(`${baseUrl}/internal/credentials/callbacks`, {
      headers: {
        "x-lingban-internal-token": "smoke-internal-token",
      },
    });
    assert.equal(
      callbackDiagnostics.configuredProviders.some((item) => item.provider === "seedance-retry"),
      true
    );
    assert.equal(
      callbackDiagnostics.configuredProviders.some(
        (item) =>
          item.provider === "seedance" &&
          item.authMode === "bearer" &&
          item.payloadEventType === "credential.lifecycle.disabled"
      ),
      true
    );
    assert.equal(
      callbackDiagnostics.configuredProviders.some(
        (item) =>
          item.provider === "seedance-retry" &&
          item.authMode === "hmac-sha256" &&
          item.authHeaderNames.includes("x-lingban-signature")
      ),
      true
    );
    assert.equal(
      callbackDiagnostics.recentDeliveries.some(
        (item) =>
          item.credentialId === retryCredential.credentialId &&
          item.status === "failed"
      ),
      true
    );

    const callbackStatePath = path.join(
      apiDataDir,
      "credentials",
      "credential-lifecycle-callback-deliveries-state.json"
    );
    const callbackStateBeforeRetry = JSON.parse(await readFile(callbackStatePath, "utf8"));
    const failedDeliveryBeforeRetry = callbackStateBeforeRetry.deliveries.find(
      (delivery) =>
        delivery.credentialId === retryCredential.credentialId &&
        delivery.status === "failed"
    );
    assert.equal(
      Boolean(failedDeliveryBeforeRetry),
      true
    );
    if (failedDeliveryBeforeRetry?.nextAttemptAt) {
      const retryDelayMs = Math.max(
        0,
        Date.parse(failedDeliveryBeforeRetry.nextAttemptAt) - Date.now()
      );
      if (Number.isFinite(retryDelayMs) && retryDelayMs > 0) {
        await sleep(retryDelayMs + 50);
      }
    }

    const retrySweep = await requestJson(`${baseUrl}/internal/credentials/callbacks/sweep`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lingban-internal-token": "smoke-internal-token",
      },
      body: JSON.stringify({
        credentialId: retryCredential.credentialId,
      }),
    });
    assert.equal(retrySweep.eligibleCount >= 1, true);
    assert.equal(retrySweep.succeededCount, 1);

    const secondRetryCallCount = callbackServer.calls.filter(
      (call) =>
        call.path === "/callbacks/seedance-retry" &&
        call.body.credential?.credentialId === retryCredential.credentialId
    ).length;
    assert.equal(secondRetryCallCount, 2);
    const successfulRetryCall = callbackServer.calls.find(
      (call) =>
        call.path === "/callbacks/seedance-retry" &&
        call.body.credential?.credentialId === retryCredential.credentialId &&
        call.headers.attempt === "2"
    );
    assert.equal(Boolean(successfulRetryCall), true);
    assert.equal(successfulRetryCall.headers.signatureKeyId, callbackServer.seedanceRetryHmacKeyId);
    assert.equal(successfulRetryCall.body.eventType, "credential.lifecycle.revoked");
    assert.equal(successfulRetryCall.body.eventVersion, 3);

    const callbackStateAfterRetry = JSON.parse(await readFile(callbackStatePath, "utf8"));
    assert.equal(
      callbackStateAfterRetry.deliveries.some(
        (delivery) =>
          delivery.credentialId === retryCredential.credentialId &&
          delivery.status === "succeeded"
      ),
      true
    );

    const recoveredAuditEvents = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(retryCredential.credentialId)}/audit-events?limit=20`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      recoveredAuditEvents.some((event) => event.action === "lifecycle-callback-sent"),
      true
    );
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }

    if (callbackServer) {
      await callbackServer.close().catch(() => undefined);
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
