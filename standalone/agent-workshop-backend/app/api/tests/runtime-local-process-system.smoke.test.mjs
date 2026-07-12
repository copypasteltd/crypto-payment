import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function waitForRun(baseUrl, runId, predicate, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await requestJson(`${baseUrl}/v1/runs/${runId}`);
    lastSnapshot = snapshot;
    if (predicate(snapshot)) {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `Timed out waiting for run ${runId}: ${JSON.stringify(
      lastSnapshot
        ? {
            status: lastSnapshot.run?.status ?? null,
            statusReason: lastSnapshot.run?.statusReason ?? null,
            runtime: lastSnapshot.runtime ?? null,
            files: lastSnapshot.files?.map((file) => file.path) ?? [],
            artifacts:
              lastSnapshot.artifacts?.map((artifact) => ({
                label: artifact.label,
                status: artifact.status,
                path: artifact.file?.path ?? null,
              })) ?? [],
            messages:
              lastSnapshot.messages?.slice(-5).map((message) => ({
                role: message.role,
                kind: message.kind,
                text: message.text,
              })) ?? [],
          }
        : null
    )}`
  );
}

function createRunInput(targetPath, title) {
  return {
    workspaceId: "wsp_system_local_process",
    taskVersionId: "tsv_system_local_process",
    sessionVersionId: "sev_system_local_process",
    title,
    targetPath,
    entrySurface: "dashboard",
    initialMessage: null,
    bindings: {
      firstPartyMcpIds: [],
      externalConnectorRefs: [],
      credentialIds: [],
    },
  };
}

test("runtime system smoke: local-process API->worker->bridge chain supports run completion and cancel", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-runtime-system-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_OBJECT_STORAGE_DRIVER",
    "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_RUNS_DIR",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_RUNTIME_DISPATCH_MODE",
    "LINGBAN_RUNTIME_STARTUP_TIMEOUT_MS",
    "LINGBAN_TERMINAL_WORKSPACE_TTL_MS",
    "LINGBAN_API_BASE_URL",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_AUTH_MODE",
    "CODEX_BIN",
    "LINGBAN_BRIDGE_ARGS",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  let app = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const objectStorageRoot = path.join(smokeRoot, "objects");
    const runsRoot = path.join(smokeRoot, "worker-runs");
    const fakeCodexScriptPath = fileURLToPath(
      new URL(
        process.platform === "win32"
          ? "./support/fake-codex-local-process.ps1"
          : "./support/fake-codex-local-process.mjs",
        import.meta.url
      )
    );
    const successTargetPath = path.join(smokeRoot, "workspace-success");
    const cancelTargetPath = path.join(smokeRoot, "workspace-cancel");

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
    process.env.LINGBAN_RUNS_DIR = runsRoot;
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_RUNTIME_STARTUP_TIMEOUT_MS = "8000";
    process.env.LINGBAN_TERMINAL_WORKSPACE_TTL_MS = "60000";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "runtime-system-internal-token";
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.CODEX_BIN = process.platform === "win32" ? "powershell.exe" : process.execPath;
    process.env.LINGBAN_BRIDGE_ARGS =
      process.platform === "win32"
        ? JSON.stringify(["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", fakeCodexScriptPath])
        : JSON.stringify([fakeCodexScriptPath]);

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createRunInput(successTargetPath, "Runtime local-process success smoke")),
    });

    const successRunId = createdRun.run.runId;
    const runningSnapshot = await waitForRun(
      baseUrl,
      successRunId,
      (snapshot) => snapshot.run.status === "RUNNING" && Boolean(snapshot.runtime.readyAt)
    );

    assert.equal(runningSnapshot.runtime.launchMode, "local-process");
    assert.equal(Boolean(runningSnapshot.runtime.startedAt), true);
    assert.equal(Boolean(runningSnapshot.runtime.readyAt), true);

    await requestJson(`${baseUrl}/v1/runs/${successRunId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "Please finalize the runtime smoke now",
        attachments: [],
      }),
    });

    const succeededSnapshot = await waitForRun(
      baseUrl,
      successRunId,
      (snapshot) =>
        snapshot.run.status === "SUCCEEDED" &&
        snapshot.runtime.finishedAt &&
        snapshot.artifacts.some((artifact) => artifact.label === "artifact-note.txt")
    );

    assert.equal(succeededSnapshot.runtime.launchMode, "local-process");
    assert.equal(succeededSnapshot.runtime.exitCode, 0);
    assert.equal(Boolean(succeededSnapshot.runtime.finishedAt), true);
    assert.equal(
      succeededSnapshot.messages.some((message) => message.text.includes("fake-codex: boot")),
      true
    );
    assert.equal(
      succeededSnapshot.messages.some((message) =>
        message.text.includes("fake-codex: user message consumed -> Please finalize the runtime smoke now")
      ),
      true
    );
    assert.equal(
      succeededSnapshot.files.some((file) => file.path.endsWith("/output/report.txt")),
      true
    );
    assert.equal(
      succeededSnapshot.files.some((file) => file.path.endsWith("/notes/from-user.txt")),
      true
    );
    assert.equal(
      succeededSnapshot.artifacts.some(
        (artifact) => artifact.label === "artifact-note.txt" && artifact.status === "ready"
      ),
      true
    );

    const previewReport = await requestJson(
      `${baseUrl}/v1/runs/${successRunId}/files/preview?path=${encodeURIComponent("output/report.txt")}`
    );
    assert.equal(previewReport.mode, "text");
    assert.equal(previewReport.file.source, "runtime-output");
    assert.equal(previewReport.content, "system smoke report\n");

    const previewUserNote = await requestJson(
      `${baseUrl}/v1/runs/${successRunId}/files/preview?path=${encodeURIComponent("notes/from-user.txt")}`
    );
    assert.equal(previewUserNote.mode, "text");
    assert.equal(previewUserNote.content, "Please finalize the runtime smoke now\n");

    const reportTicket = await requestJson(`${baseUrl}/v1/runs/${successRunId}/download-tickets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        path: "output/report.txt",
      }),
    });
    assert.equal(reportTicket.ticket.sourceKind, "object-store");
    const reportDownload = await fetch(new URL(reportTicket.downloadUrl, baseUrl));
    assert.equal(reportDownload.ok, true);
    assert.equal(await reportDownload.text(), "system smoke report\n");

    const successRunRoot = path.join(runsRoot, successRunId);
    await access(path.join(successRunRoot, "logs", "bridge.stdout.log"));
    const bridgeStdout = await readFile(
      path.join(successRunRoot, "logs", "bridge.stdout.log"),
      "utf8"
    );
    assert.equal(typeof bridgeStdout, "string");

    const createdCancelRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createRunInput(cancelTargetPath, "Runtime local-process cancel smoke")),
    });

    const cancelRunId = createdCancelRun.run.runId;
    await waitForRun(baseUrl, cancelRunId, (snapshot) => snapshot.run.status === "RUNNING");

    await requestJson(`${baseUrl}/v1/runs/${cancelRunId}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reason: "system smoke cancel",
      }),
    });

    const cancelledSnapshot = await waitForRun(
      baseUrl,
      cancelRunId,
      (snapshot) => snapshot.run.status === "CANCELLED" && Boolean(snapshot.runtime.finishedAt)
    );

    assert.equal(cancelledSnapshot.run.statusReason, "system smoke cancel");
    assert.equal(cancelledSnapshot.runtime.launchMode, "local-process");
    assert.equal(Boolean(cancelledSnapshot.runtime.finishedAt), true);
    assert.equal(
      cancelledSnapshot.messages.some((message) => message.text.includes("system smoke cancel")),
      true
    );
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
    }

    for (const key of envKeys) {
      const previous = envBackup.get(key);
      if (previous == null) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }

    await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
