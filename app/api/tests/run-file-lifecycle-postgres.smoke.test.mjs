import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createFakePostgresPool } from "./support/fake-postgres-pool.mjs";

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

async function requestBytes(url, init = {}) {
  const response = await fetch(url, init);
  const body = Buffer.from(await response.arrayBuffer());

  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText}`
  );

  return body;
}

function resolveObjectPath(root, objectKey) {
  return path.join(root, ...objectKey.split("/"));
}

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-run-file-lifecycle-pg-"));
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
  "LINGBAN_RUN_FILE_LIFECYCLE_SWEEP_INTERVAL_MS",
  "LINGBAN_RUN_FILE_ARCHIVE_HOT_RETENTION_SECONDS",
  "LINGBAN_RUN_FILE_ARCHIVE_PREFIX",
  "CODEX_BIN",
];

for (const key of envKeys) {
  envBackup.set(key, process.env[key]);
}

let app = null;

try {
  const port = await allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const objectStorageRoot = path.join(smokeRoot, "objects");
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
  process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
  process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
  process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
  process.env.LINGBAN_API_BASE_URL = baseUrl;
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "run-file-lifecycle-pg-internal-token";
  process.env.LINGBAN_RUN_FILE_LIFECYCLE_SWEEP_INTERVAL_MS = "600000";
  process.env.LINGBAN_RUN_FILE_ARCHIVE_HOT_RETENTION_SECONDS = "3600";
  process.env.LINGBAN_RUN_FILE_ARCHIVE_PREFIX = "archive/run-files";
  process.env.CODEX_BIN = process.execPath;

  const [
    { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests },
    { resetApiRuntimeConfigForTests },
  ] = await Promise.all([
    import("../dist/app/database.js"),
    import("../dist/app/runtime.js"),
  ]);
  resetApiRuntimeConfigForTests();
  setApiDatabasePoolFactoryForTests(() => createFakePostgresPool());

  const [{ startApiServer }, { runsRepository }] = await Promise.all([
    import("../dist/index.js"),
    import("../dist/modules/runs/repository.js"),
  ]);
  app = await startApiServer();

  const register = await requestJson(`${baseUrl}/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "smoke-run-file-lifecycle-postgres@example.com",
      password: "TestPassword123!",
      displayName: "Smoke Run Lifecycle PG",
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
      title: "Run file lifecycle postgres smoke",
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
  const runtimeOutputPath = path.join(targetPath, "output", "postgres-report.txt");
  await mkdir(path.dirname(runtimeOutputPath), { recursive: true });
  await writeFile(runtimeOutputPath, "cold archive postgres smoke\n", "utf8");

  await requestJson(`${baseUrl}/v1/runs/${runId}/files/tree`, {
    headers: {
      authorization: authHeaders.authorization,
    },
  });

  const hotIndexed = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/indexed?source=runtime-output&storageTier=hot&downloadable=true&search=postgres-report.txt`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(hotIndexed.summary.matchedCount, 1);
  const hotObjectKey = hotIndexed.items[0].objectKey;

  await runsRepository.update(runId, (current) => ({
    ...current,
    run: {
      ...current.run,
      status: "FAILED",
      statusReason: "postgres terminal archive",
      updatedAt: "2026-07-09T07:00:00.000Z",
    },
    runtime: {
      ...(current.runtime ?? {}),
      finishedAt: "2026-07-09T07:00:00.000Z",
    },
  }));

  const archivedSweep = await requestJson(`${baseUrl}/internal/run-file-lifecycle/sweep`, {
    method: "POST",
    headers: {
      "x-lingban-internal-token": "run-file-lifecycle-pg-internal-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      runId,
      now: "2026-07-09T09:30:00.000Z",
    }),
  });
  assert.equal(archivedSweep.runsArchivedCount, 1);
  assert.equal(archivedSweep.filesArchivedCount, 1);

  const coldIndexed = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/indexed?source=runtime-output&storageTier=cold&downloadable=true&search=postgres-report.txt`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(coldIndexed.summary.matchedCount, 1);
  assert.equal(coldIndexed.items[0].storageTier, "cold");
  assert.equal(coldIndexed.items[0].archivedFromObjectKey, hotObjectKey);
  assert.notEqual(coldIndexed.items[0].objectKey, hotObjectKey);

  await assert.rejects(stat(resolveObjectPath(objectStorageRoot, hotObjectKey)));
  await assert.doesNotReject(stat(resolveObjectPath(objectStorageRoot, coldIndexed.items[0].objectKey)));

  await rm(targetPath, { recursive: true, force: true });

  const previewAfterCleanup = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/postgres-report.txt")}`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(previewAfterCleanup.mode, "text");
  assert.equal(previewAfterCleanup.content, "cold archive postgres smoke\n");

  const downloadAfterCleanup = await requestBytes(
    `${baseUrl}/v1/runs/${runId}/files/download?path=${encodeURIComponent("output/postgres-report.txt")}`,
    {
      headers: {
        authorization: authHeaders.authorization,
      },
    }
  );
  assert.equal(downloadAfterCleanup.toString("utf8"), "cold archive postgres smoke\n");

  await app?.close().catch(() => undefined);
  app = null;
  await resetApiDatabaseForTests();
  resetApiRuntimeConfigForTests();
} finally {
  await app?.close().catch(() => undefined);
  const { resetApiRuntimeConfigForTests } = await import("../dist/app/runtime.js");
  resetApiRuntimeConfigForTests();

  for (const [key, value] of envBackup.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  await rm(smokeRoot, { recursive: true, force: true });
}
