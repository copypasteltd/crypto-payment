import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
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

function buildDataKey(sequence, keyId, encryptionContext) {
  return createHash("sha256")
    .update(`kms-datakey:${sequence}:${keyId}:${JSON.stringify(encryptionContext)}`)
    .digest();
}

async function startFakeAwsKmsServer(options = {}) {
  const port = options.port ?? (await allocatePort());
  const region = options.region ?? "ap-northeast-1";
  const keyId = options.keyId ?? "arn:aws:kms:ap-northeast-1:123456789012:key/lingban-smoke";
  const accessKeyId = options.accessKeyId ?? "smoke-access-key";
  const generateCalls = [];
  const decryptCalls = [];
  const describeCalls = [];
  const ciphertextLedger = new Map();
  let sequence = 1;

  const server = http.createServer(async (request, response) => {
    try {
      const authorization = String(request.headers.authorization ?? "");
      assert.equal(
        authorization.includes(`Credential=${accessKeyId}/`),
        true,
        "AWS SigV4 authorization header missing expected access key id"
      );

      const target = String(request.headers["x-amz-target"] ?? "");
      const body = await readJsonBody(request);

      if (request.method !== "POST" || request.url !== "/") {
        response.writeHead(404, { "content-type": "application/x-amz-json-1.1" });
        response.end(JSON.stringify({ message: "not found" }));
        return;
      }

      if (target === "TrentService.DescribeKey") {
        describeCalls.push({
          keyId: body.KeyId,
        });
        assert.equal(body.KeyId, keyId);

        response.writeHead(200, {
          "content-type": "application/x-amz-json-1.1",
          "x-amzn-requestid": `req-describe-${describeCalls.length}`,
        });
        response.end(
          JSON.stringify({
            KeyMetadata: {
              AWSAccountId: "123456789012",
              Arn: keyId,
              Description: "Lingban smoke KMS key",
              Enabled: true,
              KeyId: keyId,
              KeyManager: "CUSTOMER",
              KeySpec: "SYMMETRIC_DEFAULT",
              KeyState: "Enabled",
              KeyUsage: "ENCRYPT_DECRYPT",
              MultiRegion: false,
              Origin: "AWS_KMS",
            },
          })
        );
        return;
      }

      if (target === "TrentService.GenerateDataKey") {
        assert.equal(body.KeyId, keyId);
        assert.equal(body.KeySpec, "AES_256");
        assert.equal(typeof body.EncryptionContext, "object");

        const plaintext = buildDataKey(sequence, body.KeyId, body.EncryptionContext);
        const ciphertextBlob = Buffer.from(`kms:${sequence}:${body.KeyId}`, "utf8").toString(
          "base64"
        );
        ciphertextLedger.set(ciphertextBlob, {
          keyId: body.KeyId,
          plaintextBase64: plaintext.toString("base64"),
          encryptionContext: body.EncryptionContext,
        });
        generateCalls.push({
          keyId: body.KeyId,
          keySpec: body.KeySpec,
          encryptionContext: body.EncryptionContext,
          ciphertextBlob,
        });
        sequence += 1;

        response.writeHead(200, {
          "content-type": "application/x-amz-json-1.1",
          "x-amzn-requestid": `req-generate-${generateCalls.length}`,
        });
        response.end(
          JSON.stringify({
            CiphertextBlob: ciphertextBlob,
            KeyId: body.KeyId,
            Plaintext: plaintext.toString("base64"),
          })
        );
        return;
      }

      if (target === "TrentService.Decrypt") {
        const stored = ciphertextLedger.get(body.CiphertextBlob);
        assert.notEqual(stored, undefined);
        assert.equal(body.KeyId, stored.keyId);
        assert.deepEqual(body.EncryptionContext, stored.encryptionContext);
        decryptCalls.push({
          keyId: body.KeyId,
          encryptionContext: body.EncryptionContext,
          ciphertextBlob: body.CiphertextBlob,
        });

        response.writeHead(200, {
          "content-type": "application/x-amz-json-1.1",
          "x-amzn-requestid": `req-decrypt-${decryptCalls.length}`,
        });
        response.end(
          JSON.stringify({
            KeyId: body.KeyId,
            Plaintext: stored.plaintextBase64,
          })
        );
        return;
      }

      response.writeHead(400, { "content-type": "application/x-amz-json-1.1" });
      response.end(JSON.stringify({ message: `unsupported target ${target}` }));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/x-amz-json-1.1" });
      response.end(
        JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
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
    region,
    keyId,
    accessKeyId,
    generateCalls,
    decryptCalls,
    describeCalls,
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

test("credential broker smoke: aws kms provider seals, rotates, materializes, and reports health", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-aws-kms-broker-"));
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
    "LINGBAN_CREDENTIAL_BROKER_AWS_REGION",
    "LINGBAN_CREDENTIAL_BROKER_AWS_KMS_KEY_ID",
    "LINGBAN_CREDENTIAL_BROKER_AWS_ENDPOINT",
    "LINGBAN_CREDENTIAL_BROKER_AWS_ACCESS_KEY_ID",
    "LINGBAN_CREDENTIAL_BROKER_AWS_SECRET_ACCESS_KEY",
    "LINGBAN_CREDENTIAL_BROKER_AWS_SESSION_TOKEN",
  ];
  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;
  let fakeKms = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const targetPath = path.join(smokeRoot, "target");
    const apiDataDir = path.join(smokeRoot, "api-data");
    fakeKms = await startFakeAwsKmsServer({
      region: "ap-northeast-1",
      keyId: "arn:aws:kms:ap-northeast-1:123456789012:key/lingban-smoke-kms",
      accessKeyId: "smoke-access-key",
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
    process.env.LINGBAN_CREDENTIAL_BROKER_PROVIDER = "aws-kms-envelope";
    process.env.LINGBAN_CREDENTIAL_BROKER_ACTIVE_KEY_ID = "lingban-kms-main";
    process.env.LINGBAN_CREDENTIAL_BROKER_AWS_REGION = fakeKms.region;
    process.env.LINGBAN_CREDENTIAL_BROKER_AWS_KMS_KEY_ID = fakeKms.keyId;
    process.env.LINGBAN_CREDENTIAL_BROKER_AWS_ENDPOINT = fakeKms.baseUrl;
    process.env.LINGBAN_CREDENTIAL_BROKER_AWS_ACCESS_KEY_ID = fakeKms.accessKeyId;
    process.env.LINGBAN_CREDENTIAL_BROKER_AWS_SECRET_ACCESS_KEY = "smoke-secret-access-key";
    process.env.LINGBAN_CREDENTIAL_BROKER_AWS_SESSION_TOKEN = "smoke-session-token";

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
        email: "smoke-aws-kms-broker@example.com",
        password: "TestPassword123!",
        displayName: "Smoke AWS KMS Broker",
        workspaceName: "Smoke AWS KMS Workspace",
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
    assert.equal(brokerHealth.provider, "aws-kms-envelope");
    assert.equal(brokerHealth.readiness.ready, true);
    assert.equal(brokerHealth.readiness.metadata.kmsKeyId, fakeKms.keyId);
    assert.equal(brokerHealth.readiness.metadata.kmsRegion, fakeKms.region);
    assert.equal(fakeKms.describeCalls.length, 1);

    const createdCredential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "AWS KMS Seedance Key",
        provider: "seedance",
        secretKind: "api-key",
        secretValue: "seedance-aws-kms-key-001",
        secretRef: "aws-kms://seedance/key",
        notes: "stored through aws kms envelope broker",
      }),
    });
    assert.equal(createdCredential.brokerKind, "aws-kms-envelope");
    assert.equal(createdCredential.activeKeyId, "lingban-kms-main");
    assert.equal(fakeKms.generateCalls.length, 1);

    const credentialsStatePath = path.join(
      apiDataDir,
      "credentials",
      "credentials-state.json"
    );
    const storedCredentialsState = JSON.parse(await readFile(credentialsStatePath, "utf8"));
    assert.equal(storedCredentialsState.credentials.length, 1);
    assert.equal(
      storedCredentialsState.credentials[0].secretEnvelope.brokerKind,
      "aws-kms-envelope"
    );
    assert.equal(
      storedCredentialsState.credentials[0].secretEnvelope.kmsKeyId,
      fakeKms.keyId
    );
    assert.equal(
      storedCredentialsState.credentials[0].secretEnvelope.kmsRegion,
      fakeKms.region
    );
    assert.equal(
      typeof storedCredentialsState.credentials[0].secretEnvelope.encryptedDataKeyBase64,
      "string"
    );

    const createRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000092_kms",
        sessionVersionId: "sev_00000092_kms",
        title: "AWS KMS credential broker smoke",
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

    const decryptCallsBeforeMaterialize = fakeKms.decryptCalls.length;

    const materializedSecrets = await requestJson(
      `${baseUrl}/internal/runs/${createRun.run.runId}/credentials/materialize`,
      {
        method: "POST",
        headers: {
          "x-lingban-internal-token": "smoke-internal-token",
          "x-lingban-trace-id": "trace_kms_materialize_01",
        },
      }
    );
    assert.equal(
      materializedSecrets.secrets[createdCredential.credentialId],
      "seedance-aws-kms-key-001"
    );
    assert.equal(materializedSecrets.lease.brokerKind, "aws-kms-envelope");
    assert.equal(
      materializedSecrets.lease.brokerKindByCredentialId[createdCredential.credentialId],
      "aws-kms-envelope"
    );
    assert.equal(
      fakeKms.decryptCalls.length >= decryptCallsBeforeMaterialize + 1,
      true
    );

    const rotatedCredential = await requestJson(
      `${baseUrl}/v1/credentials/${encodeURIComponent(createdCredential.credentialId)}/rotate`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          secretValue: "seedance-aws-kms-key-002",
          secretRef: "aws-kms://seedance/key@v2",
          note: "rotate through aws kms envelope broker",
        }),
      }
    );
    assert.equal(rotatedCredential.brokerKind, "aws-kms-envelope");
    assert.equal(rotatedCredential.secretVersion, 2);
    assert.equal(fakeKms.generateCalls.length, 2);

    const decryptCallsBeforeRematerialize = fakeKms.decryptCalls.length;

    const rematerializedSecrets = await requestJson(
      `${baseUrl}/internal/runs/${createRun.run.runId}/credentials/materialize`,
      {
        method: "POST",
        headers: {
          "x-lingban-internal-token": "smoke-internal-token",
          "x-lingban-trace-id": "trace_kms_materialize_02",
        },
      }
    );
    assert.equal(
      rematerializedSecrets.secrets[createdCredential.credentialId],
      "seedance-aws-kms-key-002"
    );
    assert.equal(
      rematerializedSecrets.lease.secretVersionByCredentialId[createdCredential.credentialId],
      2
    );
    assert.equal(
      fakeKms.decryptCalls.length >= decryptCallsBeforeRematerialize + 1,
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

    if (fakeKms) {
      await fakeKms.close().catch(() => undefined);
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
