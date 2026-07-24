import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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

async function seedBillingLedgerAuthState(storageRoot) {
  const { hashPassword } = await import("../dist/modules/auth/crypto.js");
  const createdAt = "2026-07-09T00:00:00.000Z";
  const workspaceId = "wsp_brand_content";

  const authState = {
    users: [
      {
        userId: "usr_billing_owner",
        email: "smoke-billing-ledger@example.com",
        displayName: "Smoke Billing Ledger",
        passwordHash: hashPassword("TestPassword123!"),
        createdAt,
        updatedAt: createdAt,
      },
    ],
    workspaces: [
      {
        workspaceId,
        slug: "billing-ledger-brand",
        name: "Billing Ledger Brand Workspace",
        type: "enterprise",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    memberships: [
      {
        workspaceId,
        userId: "usr_billing_owner",
        role: "owner",
        status: "active",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    sessions: [],
  };

  const authDir = path.join(storageRoot, "auth");
  await mkdir(authDir, { recursive: true });
  await writeFile(path.join(authDir, "auth-state.json"), JSON.stringify(authState, null, 2), "utf8");

  return {
    workspaceId,
  };
}

test("billing ledger smoke: execution points aggregate into billing entries, summary, and creator cost views", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-billing-ledger-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_ENABLE_DEMO_DATA",
    "LINGBAN_AUTH_MODE",
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
    const storageRoot = path.join(smokeRoot, "api-data");
    const { workspaceId } = await seedBillingLedgerAuthState(storageRoot);

    await mkdir(targetPath, { recursive: true });

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = storageRoot;
    process.env.LINGBAN_ENABLE_DEMO_DATA = "1";
    process.env.LINGBAN_AUTH_MODE = "required";
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    app = await startApiServer();

    const login = await requestJson(`${baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "smoke-billing-ledger@example.com",
        password: "TestPassword123!",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${login.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId,
        taskVersionId: "tsv_drama_storyboard@2026.07.4",
        sessionVersionId: "sev_creator_drama_suite@2026.07.2",
        title: "Billing ledger smoke",
        targetPath,
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
        catalogMetadata: {
          workspaceContextKey: "brand-lab",
          workspaceContextName: {
            zh: "Brand lab",
            en: "Brand lab",
          },
          workshopId: "creator-drama",
          workshopName: {
            zh: "Creator drama",
            en: "Creator drama",
          },
          serviceId: "drama-storyboard",
          serviceName: {
            zh: "Drama storyboard",
            en: "Drama storyboard",
          },
        },
      }),
    });

    const runId = createdRun.run.runId;
    const createdUpload = await requestJson(`${baseUrl}/v1/runs/${runId}/uploads`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        fileName: "billing.txt",
        contentType: "text/plain; charset=utf-8",
        sizeBytes: 18,
      }),
    });

    const uploadResponse = await fetch(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/content`,
      {
        method: "PUT",
        headers: {
          authorization: authHeaders.authorization,
          "content-type": "application/octet-stream",
        },
        body: Buffer.from("billing smoke data\n", "utf8"),
      }
    );
    assert.equal(uploadResponse.ok, true, `Upload failed: ${await uploadResponse.text()}`);

    const finalized = await requestJson(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/finalize`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          label: "Billing smoke",
        }),
      }
    );

    const relativeUploadPath = path
      .relative(targetPath, finalized.attachment.path)
      .replace(/\\/g, "/");

    const message = await requestJson(`${baseUrl}/v1/runs/${runId}/messages`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        text: "prepare billing records",
        attachments: [],
      }),
    });
    assert.equal(message.messages.at(-1).text, "prepare billing records");

    const preview = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent(relativeUploadPath)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(preview.mode, "text");

    const read = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/read?path=${encodeURIComponent(relativeUploadPath)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(read.file.path.endsWith("/billing.txt"), true);

    const directDownload = await fetch(
      `${baseUrl}/v1/runs/${runId}/files/download?path=${encodeURIComponent(relativeUploadPath)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    const directDownloadBody = await directDownload.text();
    assert.equal(
      directDownload.ok,
      true,
      `Direct file download failed: ${directDownloadBody}`
    );

    const ticket = await requestJson(`${baseUrl}/v1/runs/${runId}/download-tickets`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        path: relativeUploadPath,
      }),
    });
    assert.equal(ticket.ticket.path.endsWith("/billing.txt"), true);

    const auditExport = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/audit-exports`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          format: "json",
        }),
      }
    );
    assert.equal(auditExport.export.packageId, "creator-drama-suite");

    const cancelled = await requestJson(`${baseUrl}/v1/runs/${runId}/cancel`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        reason: "close billing smoke",
      }),
    });
    assert.equal(cancelled.run.status, "CANCELLED");

    const billingEntries = await requestJson(
      `${baseUrl}/v1/billing/entries?workspaceContextKey=${encodeURIComponent("brand-lab")}&packageId=${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    const billingSources = new Set(billingEntries.map((item) => item.source));
    assert.deepEqual(
      [...billingSources].sort(),
      [
        "audit-export",
        "download-ticket",
        "file-download",
        "file-preview",
        "file-read",
        "run-message",
        "run-upload",
        "runtime-estimate",
      ].sort()
    );
    assert.equal(
      billingEntries.every((item) => item.packageId === "creator-drama-suite"),
      true
    );

    const billingSummary = await requestJson(
      `${baseUrl}/v1/billing/summary?workspaceContextKey=${encodeURIComponent("brand-lab")}&packageId=${encodeURIComponent("creator-drama-suite")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    const summaryMetrics = new Map(
      billingSummary.metrics.map((item) => [item.metric, item])
    );
    assert.equal(billingSummary.totalEntriesCount >= 8, true);
    assert.equal(billingSummary.totalAmountUsd > 0, true);
    assert.equal(summaryMetrics.has("storage_bytes"), true);
    assert.equal(summaryMetrics.has("model_tokens"), true);
    assert.equal(summaryMetrics.has("download_bytes"), true);
    assert.equal(summaryMetrics.has("browser_minutes"), true);
    assert.equal(summaryMetrics.has("audit_exports"), true);

    const creatorCostSummary = await requestJson(
      `${baseUrl}/v1/packages/${encodeURIComponent("creator-drama-suite")}/governance/cost/summary?workspaceContextKey=${encodeURIComponent("brand-lab")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    const creatorRowIds = new Set(creatorCostSummary.rows.map((row) => row.id));
    assert.equal(creatorRowIds.has("cost-ledger-storage_bytes"), true);
    assert.equal(creatorRowIds.has("cost-ledger-model_tokens"), true);
    assert.equal(creatorRowIds.has("cost-ledger-download_bytes"), true);
    assert.equal(creatorRowIds.has("cost-ledger-browser_minutes"), true);
    assert.equal(creatorRowIds.has("cost-ledger-audit_exports"), true);
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
