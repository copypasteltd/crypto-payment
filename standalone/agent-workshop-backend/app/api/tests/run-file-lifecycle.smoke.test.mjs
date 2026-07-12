import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";

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

async function requestText(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();

  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText} ${text}`
  );

  return {
    body: text,
    headers: response.headers,
  };
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

test("run file lifecycle archives terminal run objects into cold tier and preserves access after workspace cleanup", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-run-file-lifecycle-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
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
    const missingCodexBin = path.join(smokeRoot, "missing-codex-bin");

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "run-file-lifecycle-internal-token";
    process.env.LINGBAN_RUN_FILE_LIFECYCLE_SWEEP_INTERVAL_MS = "600000";
    process.env.LINGBAN_RUN_FILE_ARCHIVE_HOT_RETENTION_SECONDS = "3600";
    process.env.LINGBAN_RUN_FILE_ARCHIVE_PREFIX = "archive/run-files";
    // This smoke validates cold-tier file access behavior and should not depend on a live Codex runtime mutating the workspace.
    process.env.CODEX_BIN = missingCodexBin;

    const [{ startApiServer }, { resetApiRuntimeConfigForTests }, { runsRepository }] =
      await Promise.all([
      import("../dist/index.js"),
      import("../dist/app/runtime.js"),
      import("../dist/modules/runs/repository.js"),
      ]);
    resetApiRuntimeConfigForTests();
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "smoke-run-file-lifecycle@example.com",
        password: "TestPassword123!",
        displayName: "Smoke Run Lifecycle",
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
        title: "Run file lifecycle smoke",
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
    const runtimeOutputPath = path.join(targetPath, "output", "report.txt");
    await mkdir(path.dirname(runtimeOutputPath), { recursive: true });
    await writeFile(runtimeOutputPath, "cold archive smoke\n", "utf8");

    await requestJson(`${baseUrl}/v1/runs/${runId}/files/tree`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });

    const hotIndexed = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/indexed?source=runtime-output&storageTier=hot&downloadable=true&search=report.txt`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(hotIndexed.summary.matchedCount, 1);
    assert.equal(hotIndexed.items[0].storageTier, "hot");
    const hotObjectKey = hotIndexed.items[0].objectKey;

    await runsRepository.update(runId, (current) => ({
      ...current,
      run: {
        ...current.run,
        status: "SUCCEEDED",
        updatedAt: "2026-07-09T07:00:00.000Z",
      },
      runtime: {
        ...(current.runtime ?? {}),
        finishedAt: "2026-07-09T07:00:00.000Z",
      },
    }));

    const dryRunSweep = await requestJson(`${baseUrl}/internal/run-file-lifecycle/sweep`, {
      method: "POST",
      headers: {
        "x-lingban-internal-token": "run-file-lifecycle-internal-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dryRun: true,
        runId,
        now: "2026-07-09T09:30:00.000Z",
      }),
    });
    assert.equal(dryRunSweep.runsArchivedCount, 1);
    assert.equal(dryRunSweep.filesArchivedCount, 1);

    const archivedSweep = await requestJson(`${baseUrl}/internal/run-file-lifecycle/sweep`, {
      method: "POST",
      headers: {
        "x-lingban-internal-token": "run-file-lifecycle-internal-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        runId,
        now: "2026-07-09T09:30:00.000Z",
      }),
    });
    assert.equal(archivedSweep.runsArchivedCount, 1);
    assert.equal(archivedSweep.filesArchivedCount, 1);
    assert.equal(archivedSweep.failureCount, 0);

    const lifecycleDiagnostics = await requestJson(`${baseUrl}/internal/run-file-lifecycle`, {
      headers: {
        "x-lingban-internal-token": "run-file-lifecycle-internal-token",
      },
    });
    assert.equal(lifecycleDiagnostics.hotRetentionSeconds, 3600);
    assert.equal(lifecycleDiagnostics.metrics.runsArchivedTotal >= 1, true);
    assert.equal(lifecycleDiagnostics.metrics.filesArchivedTotal >= 1, true);
    assert.equal(lifecycleDiagnostics.lastSweep.requestedRunId, runId);

    const coldIndexed = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/indexed?source=runtime-output&storageTier=cold&downloadable=true&search=report.txt`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(coldIndexed.summary.matchedCount, 1);
    assert.equal(coldIndexed.summary.byStorageTier[0].key, "cold");
    assert.equal(coldIndexed.items[0].storageTier, "cold");
    assert.equal(coldIndexed.items[0].archiveReason, "terminal-retention");
    assert.equal(coldIndexed.items[0].archivedAt, "2026-07-09T09:30:00.000Z");
    assert.equal(coldIndexed.items[0].archivedFromObjectKey, hotObjectKey);
    assert.notEqual(coldIndexed.items[0].objectKey, hotObjectKey);

    await assert.rejects(stat(resolveObjectPath(objectStorageRoot, hotObjectKey)));
    await assert.doesNotReject(stat(resolveObjectPath(objectStorageRoot, coldIndexed.items[0].objectKey)));

    await rm(targetPath, { recursive: true, force: true });

    const indexedTreeAfterCleanup = await requestJson(`${baseUrl}/v1/runs/${runId}/files/tree`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      indexedTreeAfterCleanup.some((entry) => entry.path.endsWith("/output/report.txt")),
      true
    );

    const previewAfterCleanup = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/report.txt")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(previewAfterCleanup.mode, "text");
    assert.equal(previewAfterCleanup.content, "cold archive smoke\n");
    assert.equal(previewAfterCleanup.file.storageTier, "cold");

    const downloadAfterCleanup = await requestBytes(
      `${baseUrl}/v1/runs/${runId}/files/download?path=${encodeURIComponent("output/report.txt")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(downloadAfterCleanup.toString("utf8"), "cold archive smoke\n");

    const metrics = await requestText(`${baseUrl}/internal/metrics`, {
      headers: {
        "x-lingban-internal-token": "run-file-lifecycle-internal-token",
      },
    });
    assert.equal(
      metrics.body.includes("lingban_run_file_lifecycle_sweeper_active 1"),
      true
    );
    assert.equal(
      metrics.body.includes("lingban_run_file_lifecycle_hot_retention_seconds 3600"),
      true
    );
    assert.equal(
      metrics.body.includes('lingban_run_file_lifecycle_events_total{metric="filesArchivedTotal"}'),
      true
    );
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
});
