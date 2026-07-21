import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

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
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
    server.once("error", reject);
  });
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  assert.equal(response.ok, true, `${init.method ?? "GET"} ${url} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

test("creator can create a Session Project and launch a blank Source Run", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-creator-source-run-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST", "API_PORT", "LINGBAN_DATA_DIR", "LINGBAN_AUTH_MODE",
    "LINGBAN_RUNS_DIR", "LINGBAN_RUNTIME_LAUNCH_MODE", "LINGBAN_API_BASE_URL",
    "LINGBAN_RUNTIME_API_BASE_URL", "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_OBJECT_STORAGE_ROOT", "LINGBAN_PLATFORM_ADMIN_EMAILS",
    "LINGBAN_CREDENTIAL_BROKER_MASTER_KEY", "CODEX_BIN",
  ];
  for (const key of envKeys) envBackup.set(key, process.env[key]);

  let app = null;
  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_AUTH_MODE = "required";
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_RUNTIME_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "creator-source-smoke-token";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.LINGBAN_PLATFORM_ADMIN_EMAILS = "creator-source-run@example.com";
    process.env.LINGBAN_CREDENTIAL_BROKER_MASTER_KEY = "creator-source-smoke-master-key";
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const auth = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        email: "creator-source-run@example.com",
        password: "TestPassword123!",
        displayName: "Creator Source Test",
        workspaceName: "Creator Source Workspace",
      }),
    });
    const headers = {
      authorization: `Bearer ${auth.tokens.accessToken}`,
      "content-type": "application/json",
      "idempotency-key": "creator-source-smoke-request",
    };
    const provider = await requestJson(`${baseUrl}/v1/providers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        displayName: "Creator Source Provider",
        baseUrl: "https://creator-source-provider.example.com/v1",
        defaultModel: "gpt-creator-source",
      }),
    });
    const credential = await requestJson(`${baseUrl}/v1/credentials`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        scope: "workspace",
        displayName: "Creator Source Provider Key",
        provider: provider.providerId,
        secretKind: "api-key",
        mountMode: "env",
        envName: "OPENAI_API_KEY",
        secretValue: "creator-source-provider-key",
      }),
    });
    const providerBinding = await requestJson(`${baseUrl}/v1/provider-bindings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        providerId: provider.providerId,
        credentialId: credential.credentialId,
        enabled: true,
        isDefault: true,
      }),
    });
    assert.equal(providerBinding.scope, "workspace");

    const project = await requestJson(`${baseUrl}/v1/creator/session-projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Blank Codex recording", description: "Source Run regression coverage" }),
    });
    assert.match(project.sessionProjectId, /^spj_/);
    assert.equal(project.status, "DRAFT");
    assert.equal(project.sourceRunId, null);
    const replayedProject = await requestJson(`${baseUrl}/v1/creator/session-projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Blank Codex recording", description: "Source Run regression coverage" }),
    });
    assert.equal(replayedProject.sessionProjectId, project.sessionProjectId);

    const launched = await requestJson(`${baseUrl}/v1/creator/source-runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionProjectId: project.sessionProjectId,
        title: project.name,
        approvalMode: "auto_all",
      }),
    });
    assert.equal(launched.run.runPurpose, "creator_source");
    assert.equal(launched.run.sessionBootstrapMode, "blank");
    assert.equal(launched.run.sessionProjectId, project.sessionProjectId);
    assert.equal(launched.run.taskVersionId, null);
    assert.equal(launched.run.sessionVersionId, null);
    assert.equal(launched.run.catalogMetadata, null);
    assert.equal(launched.run.approvalMode, "auto_all");
    assert.equal(
      launched.run.targetPath,
      path.join(smokeRoot, "worker-runs", launched.run.runId, "target")
    );
    assert.equal(launched.sessionProject.status, "RECORDING");
    assert.equal(launched.sessionProject.sourceRunId, launched.run.runId);
    assert.match(launched.nextPrompt, /Creator Session/);
    const replayedLaunch = await requestJson(`${baseUrl}/v1/creator/source-runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionProjectId: project.sessionProjectId,
        title: project.name,
        approvalMode: "auto_all",
      }),
    });
    assert.equal(replayedLaunch.run.runId, launched.run.runId);

    const projects = await requestJson(`${baseUrl}/v1/creator/session-projects`, {
      headers: { authorization: headers.authorization },
    });
    assert.equal(projects.total, 1);
    assert.equal(projects.items[0].sourceRunId, launched.run.runId);

    const snapshot = await requestJson(`${baseUrl}/v1/runs/${launched.run.runId}`, {
      headers: { authorization: headers.authorization },
    });
    assert.equal(snapshot.run.sessionBootstrapMode, "blank");
    assert.equal(snapshot.informationCollection.requiredCount, 0);
    assert.equal(snapshot.provider.bindingScope, "workspace");
  } finally {
    if (app) await app.close();
    for (const [key, value] of envBackup.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(smokeRoot, { recursive: true, force: true });
  }
});
