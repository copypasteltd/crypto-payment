import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
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

async function requestJsonExpectFailure(url, init = {}, expectedStatus = 409) {
  const response = await fetch(url, init);
  const text = await response.text();

  assert.equal(
    response.status,
    expectedStatus,
    `${init.method ?? "GET"} ${url} expected ${expectedStatus}, got ${response.status} ${response.statusText}: ${text}`
  );

  return text ? JSON.parse(text) : null;
}

test("quota execution points smoke: upload, message and download approvals can be retried", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-quota-execution-"));
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

    await mkdir(targetPath, { recursive: true });

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const register = await requestJson(`${baseUrl}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "smoke-quota-execution@example.com",
        password: "TestPassword123!",
        displayName: "Smoke Quota Execution",
        workspaceName: "Quota Execution Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    for (const metric of ["storage_bytes", "model_tokens", "download_bytes"]) {
      await requestJson(`${baseUrl}/v1/quotas/policies`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          scopeType: "workspace",
          scopeRefId: register.currentWorkspace.workspaceId,
          metric,
          windowType: "daily",
          limitValue: 100000,
          softLimitValue: 0,
          hardLimitValue: 100000,
          actionOnSoftLimit: "require_approval",
          actionOnHardLimit: "block",
        }),
      });
    }

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_quota_exec",
        sessionVersionId: "sev_quota_exec",
        title: "Quota execution smoke",
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
        fileName: "quota.txt",
        contentType: "text/plain; charset=utf-8",
        sizeBytes: 12,
      }),
    });

    const uploadFailure = await requestJsonExpectFailure(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/content`,
      {
        method: "PUT",
        headers: {
          authorization: authHeaders.authorization,
          "content-type": "application/octet-stream",
        },
        body: Buffer.from("quota smoke\n", "utf8"),
      }
    );
    assert.equal(uploadFailure.error.code, "RUN_UPLOAD_QUOTA_APPROVAL_REQUIRED");

    await requestJson(
      `${baseUrl}/v1/quotas/overrides/${uploadFailure.error.details.overrideId}/approve`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          note: "approve upload",
        }),
      }
    );

    const uploadRetry = await fetch(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/content`,
      {
        method: "PUT",
        headers: {
          authorization: authHeaders.authorization,
          "content-type": "application/octet-stream",
        },
        body: Buffer.from("quota smoke\n", "utf8"),
      }
    );
    assert.equal(uploadRetry.ok, true, `Upload retry failed: ${await uploadRetry.text()}`);

    const finalized = await requestJson(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/finalize`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          label: "Quota smoke",
        }),
      }
    );

    const relativeUploadPath = path
      .relative(targetPath, finalized.attachment.path)
      .replace(/\\/g, "/");

    const messageFailure = await requestJsonExpectFailure(`${baseUrl}/v1/runs/${runId}/messages`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        text: "hello quota",
        attachments: [],
      }),
    });
    assert.equal(messageFailure.error.code, "RUN_MESSAGE_QUOTA_APPROVAL_REQUIRED");

    await requestJson(
      `${baseUrl}/v1/quotas/overrides/${messageFailure.error.details.overrideId}/approve`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          note: "approve message",
        }),
      }
    );

    const messageRetry = await requestJson(`${baseUrl}/v1/runs/${runId}/messages`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        text: "hello quota",
        attachments: [],
      }),
    });
    assert.equal(messageRetry.messages.at(-1).text, "hello quota");

    const downloadFailure = await requestJsonExpectFailure(
      `${baseUrl}/v1/runs/${runId}/download-tickets`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          path: relativeUploadPath,
        }),
      }
    );
    assert.equal(downloadFailure.error.code, "RUN_DOWNLOAD_QUOTA_APPROVAL_REQUIRED");

    await requestJson(
      `${baseUrl}/v1/quotas/overrides/${downloadFailure.error.details.overrideId}/approve`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          note: "approve download",
        }),
      }
    );

    const ticket = await requestJson(`${baseUrl}/v1/runs/${runId}/download-tickets`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        path: relativeUploadPath,
      }),
    });
    assert.equal(ticket.ticket.path.endsWith("/quota.txt"), true);

    const snapshot = await requestJson(`${baseUrl}/v1/runs/${runId}`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      snapshot.approvals.filter((approval) => approval.kind === "quota-override").length >= 3,
      true
    );

    const autoTargetPath = path.join(smokeRoot, "auto-target");
    await mkdir(autoTargetPath, { recursive: true });
    const autoRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_quota_exec_auto",
        sessionVersionId: "sev_quota_exec_auto",
        title: "Automatic approval quota smoke",
        targetPath: autoTargetPath,
        entrySurface: "dashboard",
        approvalMode: "auto_all",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
      }),
    });
    const autoRunId = autoRun.run.runId;

    const autoMessage = await requestJson(`${baseUrl}/v1/runs/${autoRunId}/messages`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ text: "automatic quota approval", attachments: [] }),
    });
    assert.equal(autoMessage.run.approvalMode, "auto_all");
    assert.equal(
      autoMessage.approvals.some(
        (approval) =>
          approval.kind === "quota-override" &&
          approval.state === "approved" &&
          approval.decisionMode === "auto_all"
      ),
      true
    );

    const autoUpload = await requestJson(`${baseUrl}/v1/runs/${autoRunId}/uploads`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        fileName: "auto.txt",
        label: "Automatic approval upload",
        contentType: "text/plain",
      }),
    });
    const autoUploadResponse = await fetch(
      `${baseUrl}/v1/runs/${autoRunId}/uploads/${autoUpload.upload.uploadId}/content`,
      {
        method: "PUT",
        headers: {
          authorization: authHeaders.authorization,
          "content-type": "application/octet-stream",
        },
        body: Buffer.from("automatic approval\n", "utf8"),
      }
    );
    assert.equal(autoUploadResponse.ok, true, await autoUploadResponse.text());

    const autoFinalized = await requestJson(
      `${baseUrl}/v1/runs/${autoRunId}/uploads/${autoUpload.upload.uploadId}/finalize`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ label: "Automatic approval upload" }),
      }
    );
    const autoRelativePath = path
      .relative(autoTargetPath, autoFinalized.attachment.path)
      .replace(/\\/g, "/");
    const autoTicket = await requestJson(`${baseUrl}/v1/runs/${autoRunId}/download-tickets`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ path: autoRelativePath }),
    });
    assert.equal(autoTicket.ticket.path.endsWith("/auto.txt"), true);
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
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
