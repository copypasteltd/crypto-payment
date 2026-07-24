import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFakePostgresPool } from "./support/fake-postgres-pool.mjs";
import { allocateFetchPort as allocatePort } from "./support/allocate-fetch-port.mjs";

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

async function requestError(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-file-security-pg-"));
const envBackup = new Map();
const envKeys = [
  "API_HOST",
  "API_PORT",
  "DATABASE_URL",
  "LINGBAN_DATA_DIR",
  "LINGBAN_CATALOG_STORE",
  "LINGBAN_WORKSHOP_CATALOG_STORE",
  "LINGBAN_CREATOR_STORE",
  "LINGBAN_RUNS_STORE",
  "LINGBAN_RUN_EVENTS_STORE",
  "LINGBAN_AUTH_STORE",
  "LINGBAN_UPLOADS_STORE",
  "LINGBAN_RUN_FILES_STORE",
  "LINGBAN_OBJECT_STORAGE_DRIVER",
  "LINGBAN_OBJECT_STORAGE_ROOT",
  "LINGBAN_RUNS_DIR",
  "LINGBAN_RUNTIME_LAUNCH_MODE",
  "LINGBAN_API_BASE_URL",
  "LINGBAN_INTERNAL_AUTH_TOKEN",
  "LINGBAN_FILE_SCAN_MODE",
  "LINGBAN_FILE_SCAN_ERROR_POLICY",
  "CODEX_BIN",
];

for (const key of envKeys) {
  envBackup.set(key, process.env[key]);
}

let app = null;

try {
  const port = await allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetPath = path.join(smokeRoot, "target");

  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT = String(port);
  process.env.DATABASE_URL = "postgres://fake/lingban";
  process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
  process.env.LINGBAN_CATALOG_STORE = "file";
  process.env.LINGBAN_WORKSHOP_CATALOG_STORE = "postgres";
  process.env.LINGBAN_CREATOR_STORE = "postgres";
  process.env.LINGBAN_RUNS_STORE = "postgres";
  process.env.LINGBAN_RUN_EVENTS_STORE = "postgres";
  process.env.LINGBAN_AUTH_STORE = "postgres";
  process.env.LINGBAN_UPLOADS_STORE = "postgres";
  process.env.LINGBAN_RUN_FILES_STORE = "postgres";
  process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
  process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
  process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
  process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
  process.env.LINGBAN_API_BASE_URL = baseUrl;
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "file-security-pg-internal-token";
  process.env.LINGBAN_FILE_SCAN_MODE = "builtin";
  process.env.LINGBAN_FILE_SCAN_ERROR_POLICY = "block";
  process.env.CODEX_BIN = process.execPath;

  const { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests } = await import(
    "../dist/app/database.js"
  );
  setApiDatabasePoolFactoryForTests(() => createFakePostgresPool());

  const { startApiServer } = await import("../dist/index.js");
  app = await startApiServer();

  const register = await requestJson(`${baseUrl}/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "smoke-file-security-postgres@example.com",
      password: "TestPassword123!",
      displayName: "Smoke File Security PG",
      workspaceName: "Smoke Workspace",
    }),
  });

  const authHeaders = {
    authorization: `Bearer ${register.tokens.accessToken}`,
    "content-type": "application/json",
  };

  const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      workspaceId: register.currentWorkspace.workspaceId,
      taskVersionId: "tsv_00000001",
      sessionVersionId: "sev_00000001",
      title: "File security postgres smoke",
      targetPath,
      entrySurface: "dashboard",
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
    }),
  });

  const runId = createdRun.run.runId;
  const createdUpload = await requestJson(`${baseUrl}/v1/runs/${runId}/uploads`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      fileName: "malware.exe",
      contentType: "application/x-msdownload",
      sizeBytes: 8,
    }),
  });

  const blockedUpload = await requestError(
    `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/content`,
    {
      method: "PUT",
      headers: {
        authorization: authHeaders.authorization,
        "content-type": "application/octet-stream",
      },
      body: Buffer.from("MZpgtest", "utf8"),
    }
  );
  assert.equal(blockedUpload.status, 409);
  assert.equal(blockedUpload.body.error.code, "RUN_UPLOAD_SECURITY_BLOCKED");

  const uploads = await requestJson(`${baseUrl}/v1/runs/${runId}/uploads`, {
    headers: {
      authorization: authHeaders.authorization,
    },
  });
  assert.equal(uploads[0].status, "blocked");
  assert.equal(uploads[0].scanStatus, "blocked");

  const blockedOutputPath = path.join(targetPath, "output", "payload.sh");
  await mkdir(path.dirname(blockedOutputPath), { recursive: true });
  await writeFile(blockedOutputPath, "#!/bin/sh\necho postgres\n", "utf8");

  const blockedPreview = await requestError(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/payload.sh")}`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(blockedPreview.status, 409);
  assert.equal(blockedPreview.body.error.code, "RUN_FILE_SECURITY_BLOCKED");

  const diagnostics = await requestJson(`${baseUrl}/internal/file-security`, {
    headers: {
      "x-lingban-internal-token": "file-security-pg-internal-token",
    },
  });
  assert.equal(diagnostics.mode, "builtin");
  assert.equal(diagnostics.metrics.blockedTotal >= 2, true);

  resetApiDatabaseForTests();
} finally {
  if (app) {
    await app.close();
  }

  try {
    const { resetApiDatabaseForTests, setApiDatabasePoolFactoryForTests } = await import(
      "../dist/app/database.js"
    );
    setApiDatabasePoolFactoryForTests(null);
    resetApiDatabaseForTests();
  } catch {
    // ignore cleanup failures
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
