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

test("Creator writes a draft Workshop, Service, and immutable Task Version", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-catalog-write-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST", "API_PORT", "LINGBAN_DATA_DIR", "LINGBAN_AUTH_MODE",
    "LINGBAN_RUNS_DIR", "LINGBAN_RUNTIME_LAUNCH_MODE", "LINGBAN_API_BASE_URL",
    "LINGBAN_RUNTIME_API_BASE_URL", "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_OBJECT_STORAGE_ROOT", "CODEX_BIN",
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
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "catalog-write-smoke-token";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    const { sessionProjectsRepository } = await import("../dist/modules/session-projects/repository.js");
    app = await startApiServer();

    const auth = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        email: "catalog-write@example.com",
        password: "TestPassword123!",
        displayName: "Catalog Creator",
        workspaceName: "Creator Catalog Workspace",
      }),
    });
    const headers = {
      authorization: `Bearer ${auth.tokens.accessToken}`,
      "content-type": "application/json",
      "idempotency-key": "catalog-write-smoke-request",
    };

    const project = await requestJson(`${baseUrl}/v1/creator/session-projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Catalog workflow", description: "Catalog write coverage" }),
    });
    const sealedProject = {
      ...project,
      status: "SEALED",
      currentSessionVersionId: "sev_catalog_write_smoke",
      version: project.version + 1,
      updatedAt: new Date().toISOString(),
    };
    const persistedProject = await sessionProjectsRepository.update(sealedProject, project.version);
    assert.equal(persistedProject.status, "SEALED");

    const bundleRequestBody = {
      sessionProjectId: project.sessionProjectId,
      displayName: { zh: "目录写入测试", en: "Catalog Write Test" },
      summary: { zh: "验证正式目录写链", en: "Validates the formal catalog write chain" },
      audience: { zh: "Creator", en: "Creators" },
      nextStepSummary: { zh: "创建 Release", en: "Create a Release" },
      scope: "personal",
      visibility: "workspace",
      coverAssetUrl: "/assets/logo.svg",
      tagList: ["test", "catalog"],
      service: {
        displayName: { zh: "目录测试服务", en: "Catalog Test Service" },
        summary: { zh: "完整对话服务", en: "Full conversation service" },
        authRequirementText: { zh: "工作区凭证", en: "Workspace credentials" },
        estimatedDuration: "05-15 min",
        targetPathHint: "/workspace/catalog-output/",
        outputContractSummary: { zh: "输出到 Target Path", en: "Writes to Target Path" },
        requiredBindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
        linkedInstanceHint: null,
      },
    };
    const bundle = await requestJson(`${baseUrl}/v1/workshops`, {
      method: "POST",
      headers,
      body: JSON.stringify(bundleRequestBody),
    });

    assert.match(bundle.workshop.workshopId, /^wks_/);
    assert.match(bundle.service.serviceId, /^svc_/);
    assert.match(bundle.taskVersion.taskVersionId, /^tsv_/);
    assert.equal(bundle.workshop.status, "draft");
    assert.equal(bundle.service.status, "draft");
    assert.equal(bundle.taskVersion.sessionVersionId, "sev_catalog_write_smoke");
    assert.equal(
      bundle.taskVersion.targetRoot,
      `${auth.currentWorkspace.root.replace(/\/$/, "")}/runs/${bundle.service.serviceId}`
    );
    assert.equal(bundle.taskVersion.contentSha256.length, 64);
    const replayedBundle = await requestJson(`${baseUrl}/v1/workshops`, {
      method: "POST",
      headers,
      body: JSON.stringify(bundleRequestBody),
    });
    assert.equal(replayedBundle.workshop.workshopId, bundle.workshop.workshopId);

    const versions = await requestJson(`${baseUrl}/v1/services/${bundle.service.serviceId}/versions`, { headers });
    assert.equal(versions.length, 1);
    assert.equal(versions[0].contentSha256, bundle.taskVersion.contentSha256);

    const updatedProject = await requestJson(`${baseUrl}/v1/creator/session-projects/${project.sessionProjectId}`, { headers });
    assert.equal(updatedProject.workshopId, bundle.workshop.workshopId);
    assert.equal(updatedProject.serviceId, bundle.service.serviceId);

    const visibleWorkshops = await requestJson(`${baseUrl}/v1/workshops?workspaceContextKey=${encodeURIComponent(auth.currentWorkspace.contextKey)}`, { headers });
    assert.equal(visibleWorkshops.some((item) => item.workshopId === bundle.workshop.workshopId), false);
  } finally {
    if (app) await app.close();
    for (const [key, value] of envBackup.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(smokeRoot, { recursive: true, force: true });
  }
});
