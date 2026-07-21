import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import XLSX from "xlsx";
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

  return {
    body,
    contentType: response.headers.get("content-type"),
  };
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function createDocxBuffer(text) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body>
</w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

function createXlsxBuffer(rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Preview");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-api-pg-smoke-"));
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
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
  process.env.CODEX_BIN = process.execPath;

  const { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests } = await import(
    "../dist/app/database.js"
  );
  setApiDatabasePoolFactoryForTests(() => createFakePostgresPool());

  const { startApiServer } = await import("../dist/index.js");
  const { runsRepository } = await import("../dist/modules/runs/repository.js");
  const { runFilesIndexRepository } = await import("../dist/modules/runs/file-index.js");
  const { objectStore } = await import("../dist/modules/uploads/object-store.js");
  app = await startApiServer();

  const register = await requestJson(`${baseUrl}/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "smoke-postgres-file-chain@example.com",
      password: "TestPassword123!",
      displayName: "Smoke Postgres File Chain",
      workspaceName: "Smoke Workspace",
    }),
  });

  const authHeaders = {
    authorization: `Bearer ${register.tokens.accessToken}`,
    "content-type": "application/json",
  };

  const refreshed = await requestJson(`${baseUrl}/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      refreshToken: register.tokens.refreshToken,
    }),
  });

  const currentAuthHeaders = {
    authorization: `Bearer ${refreshed.tokens.accessToken}`,
    "content-type": "application/json",
  };

  const workshops = await requestJson(
    `${baseUrl}/v1/workshops?workspaceContextKey=personal&entrySurface=h5`
  );
  assert.equal(Array.isArray(workshops), true);
  assert.equal(workshops.length > 0, true, "postgres-backed workshop catalog should return seed data");

  const workshopServices = await requestJson(
    `${baseUrl}/v1/workshops/${encodeURIComponent(workshops[0].workshopId)}/services?workspaceContextKey=personal&entrySurface=h5`
  );
  assert.equal(Array.isArray(workshopServices), true);
  assert.equal(
    workshopServices.length > 0,
    true,
    "postgres-backed workshop services should return seed data"
  );

  const launchTemplate = await requestJson(
    `${baseUrl}/v1/services/${encodeURIComponent(workshopServices[0].serviceId)}/launch-template`,
    {
      method: "POST",
      headers: currentAuthHeaders,
      body: JSON.stringify({
        workspaceContextKey: "personal",
        entrySurface: "h5",
      }),
    }
  );
  assert.equal(launchTemplate.serviceId, workshopServices[0].serviceId);
  assert.equal(launchTemplate.initialMessagePolicy, "system-collects-required-info");

  const creatorPackages = await requestJson(`${baseUrl}/v1/packages?workspaceContextKey=personal`, {
    headers: {
      authorization: currentAuthHeaders.authorization,
    },
  });
  assert.equal(Array.isArray(creatorPackages), true);
  assert.equal(
    creatorPackages.length,
    0,
    "a new personal workspace must not inherit another workspace's creator packages"
  );

  const createRun = await requestJson(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: currentAuthHeaders,
    body: JSON.stringify({
      workspaceId: register.currentWorkspace.workspaceId,
      taskVersionId: "tsv_00000001",
      sessionVersionId: "sev_00000001",
      title: "Postgres file chain smoke",
      targetPath,
      entrySurface: "h5",
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
    }),
  });

  const runId = createRun.run.runId;

  const createdUpload = await requestJson(`${baseUrl}/v1/runs/${runId}/uploads`, {
    method: "POST",
    headers: currentAuthHeaders,
    body: JSON.stringify({
      fileName: "pg-notes.txt",
      contentType: "text/plain; charset=utf-8",
      sizeBytes: 18,
    }),
  });

  const uploadPut = await fetch(
    `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/content`,
    {
      method: "PUT",
      headers: {
        authorization: currentAuthHeaders.authorization,
        "content-type": "application/octet-stream",
      },
      body: Buffer.from("postgres upload ok\n", "utf8"),
    }
  );
  assert.equal(uploadPut.ok, true, `PUT postgres upload failed: ${await uploadPut.text()}`);

  const finalizedUpload = await requestJson(
    `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/finalize`,
    {
      method: "POST",
      headers: currentAuthHeaders,
      body: JSON.stringify({
        label: "PG Notes",
      }),
    }
  );

  const uploadedPath = path
    .relative(targetPath, finalizedUpload.attachment.path)
    .replace(/\\/g, "/");
  const indexedUploads = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/indexed?source=user-upload`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(indexedUploads.summary.matchedCount, 1);
  assert.equal(indexedUploads.items[0].logicalPath, `/uploads/${createdUpload.upload.uploadId}/pg-notes.txt`);

  const runtimeFileAbsolutePath = path.join(targetPath, "output", "report.txt");
  await mkdir(path.dirname(runtimeFileAbsolutePath), { recursive: true });
  await writeFile(runtimeFileAbsolutePath, "postgres runtime output smoke\n", "utf8");

  const tree = await requestJson(`${baseUrl}/v1/runs/${runId}/files/tree`, {
    headers: {
      authorization: currentAuthHeaders.authorization,
    },
  });
  assert.equal(
    tree.some((file) => file.path.endsWith("/output/report.txt")),
    true,
    "runtime output file should appear in postgres-backed tree scan"
  );

  const runtimePreview = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/report.txt")}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(runtimePreview.mode, "text");
  assert.equal(runtimePreview.file.source, "runtime-output");
  assert.equal(runtimePreview.content, "postgres runtime output smoke\n");
  const indexedRuntimeOutputs = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/indexed?source=runtime-output&search=report`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(indexedRuntimeOutputs.summary.matchedCount, 1);
  assert.equal(indexedRuntimeOutputs.items[0].logicalPath, "/output/report.txt");

  const runtimeImageAbsolutePath = path.join(targetPath, "output", "preview.png");
  const runtimePdfAbsolutePath = path.join(targetPath, "output", "preview.pdf");
  const runtimeDocxAbsolutePath = path.join(targetPath, "output", "summary.docx");
  const runtimeXlsxAbsolutePath = path.join(targetPath, "output", "table.xlsx");
  const runtimeImageContent = Buffer.from(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6360000002000154A24F5D0000000049454E44AE426082",
    "hex"
  );
  const runtimePdfContent = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
    "utf8"
  );
  const runtimeDocxContent = await createDocxBuffer("postgres office doc preview");
  const runtimeXlsxContent = createXlsxBuffer([
    ["item", "value"],
    ["postgres", "ok"],
  ]);
  await writeFile(runtimeImageAbsolutePath, runtimeImageContent);
  await writeFile(runtimePdfAbsolutePath, runtimePdfContent);
  await writeFile(runtimeDocxAbsolutePath, runtimeDocxContent);
  await writeFile(runtimeXlsxAbsolutePath, runtimeXlsxContent);

  const runtimeImageStats = await stat(runtimeImageAbsolutePath);
  const legacyRuntimeImageObjectKey = `runs/${runId}/indexed/target-scan/output/preview.png`;
  const legacyRuntimeImageObjectPath = path.join(
    objectStorageRoot,
    "runs",
    runId,
    "indexed",
    "target-scan",
    "output",
    "preview.png"
  );
  const legacyRuntimeImageObject = await objectStore.putBuffer(legacyRuntimeImageObjectKey, {
    content: runtimeImageContent,
    contentType: "image/png",
  });
  await runFilesIndexRepository.upsertRunFile({
    runId,
    workspaceId: register.currentWorkspace.workspaceId,
    path: runtimeImageAbsolutePath.replace(/\\/g, "/"),
    logicalPath: "/output/preview.png",
    name: "preview.png",
    kind: "screenshot",
    sizeBytes: runtimeImageStats.size,
    updatedAt: runtimeImageStats.mtime.toISOString(),
    source: "target-scan",
    mimeType: "image/png",
    objectKey: legacyRuntimeImageObject.objectKey,
    uploadId: null,
    checksum: legacyRuntimeImageObject.sha256,
    previewMode: "image",
    previewable: true,
    downloadable: true,
    indexedAt: "2026-07-09T00:00:00.000Z",
  });

  await requestJson(`${baseUrl}/v1/runs/${runId}/files/tree`, {
    headers: {
      authorization: currentAuthHeaders.authorization,
    },
  });
  await assert.rejects(stat(legacyRuntimeImageObjectPath));

  const billingBeforeBinaryPreview = await requestJson(
    `${baseUrl}/v1/billing/entries?runId=${encodeURIComponent(runId)}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  const downloadTicketEntriesBeforeBinaryPreview = billingBeforeBinaryPreview.filter(
    (entry) => entry.source === "download-ticket"
  ).length;

  const runtimeImagePreview = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/preview.png")}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(runtimeImagePreview.mode, "image");
  assert.equal(runtimeImagePreview.file.source, "runtime-output");
  assert.equal(
    runtimeImagePreview.file.objectKey,
    `runs/${runId}/indexed/runtime-output/output/preview.png`
  );
  assert.equal(runtimeImagePreview.downloadUrl != null, true);
  assert.equal(runtimeImagePreview.downloadTicketId != null, true);

  const runtimePdfPreview = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/preview.pdf")}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(runtimePdfPreview.mode, "pdf");
  assert.equal(runtimePdfPreview.file.source, "runtime-output");
  assert.equal(
    runtimePdfPreview.file.objectKey,
    `runs/${runId}/indexed/runtime-output/output/preview.pdf`
  );
  assert.equal(runtimePdfPreview.downloadUrl != null, true);
  assert.equal(runtimePdfPreview.downloadTicketId != null, true);

  const runtimeDocxPreview = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/summary.docx")}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(runtimeDocxPreview.mode, "text");
  assert.match(runtimeDocxPreview.content ?? "", /postgres office doc preview/);

  const runtimeXlsxPreview = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/table.xlsx")}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(runtimeXlsxPreview.mode, "text");
  assert.match(runtimeXlsxPreview.content ?? "", /postgres\tok/);

  const indexedRuntimeBinaryOutputs = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/indexed?source=runtime-output&search=preview`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(indexedRuntimeBinaryOutputs.summary.matchedCount, 2);
  assert.deepEqual(
    indexedRuntimeBinaryOutputs.items.map((item) => item.logicalPath).sort(),
    ["/output/preview.pdf", "/output/preview.png"]
  );

  const runtimeImageDownload = await requestBytes(new URL(runtimeImagePreview.downloadUrl, baseUrl));
  assert.equal(runtimeImageDownload.contentType, "image/png");
  assert.deepEqual(runtimeImageDownload.body, runtimeImageContent);

  const runtimePdfDownload = await requestBytes(new URL(runtimePdfPreview.downloadUrl, baseUrl));
  assert.equal(runtimePdfDownload.contentType, "application/pdf");
  assert.deepEqual(runtimePdfDownload.body, runtimePdfContent);

  const billingAfterBinaryPreview = await requestJson(
    `${baseUrl}/v1/billing/entries?runId=${encodeURIComponent(runId)}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(
    billingAfterBinaryPreview.filter((entry) => entry.source === "download-ticket").length,
    downloadTicketEntriesBeforeBinaryPreview
  );
  assert.equal(
    billingAfterBinaryPreview.some(
      (entry) =>
        entry.source === "file-preview" && entry.sourceRef === runtimeImagePreview.file.path
    ),
    true
  );
  assert.equal(
    billingAfterBinaryPreview.some(
      (entry) =>
        entry.source === "file-preview" && entry.sourceRef === runtimePdfPreview.file.path
    ),
    true
  );

  await runsRepository.update(runId, (current) => ({
    ...current,
    files: [],
  }));

  const snapshotBackedByIndex = await requestJson(`${baseUrl}/v1/runs/${runId}`, {
    headers: {
      authorization: currentAuthHeaders.authorization,
    },
  });
  assert.equal(
    snapshotBackedByIndex.files.some((file) => file.path.endsWith("/output/report.txt")),
    true,
    "postgres-backed run snapshot should recover files from the indexed catalog when aggregate files are stale"
  );

  const listFilesBackedByIndex = await requestJson(`${baseUrl}/v1/runs/${runId}/files`, {
    headers: {
      authorization: currentAuthHeaders.authorization,
    },
  });
  assert.equal(
    listFilesBackedByIndex.some((file) => file.path.endsWith("/output/report.txt")),
    true,
    "postgres-backed run files endpoint should recover files from the indexed catalog when aggregate files are stale"
  );

  const uploadedPreview = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent(uploadedPath)}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(uploadedPreview.mode, "text");
  assert.equal(uploadedPreview.file.source, "user-upload");
  assert.equal(uploadedPreview.content, "postgres upload ok\n");

  await rm(targetPath, { recursive: true, force: true });

  const runtimePreviewAfterWorkspaceRemoval = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/report.txt")}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(runtimePreviewAfterWorkspaceRemoval.mode, "text");
  assert.equal(runtimePreviewAfterWorkspaceRemoval.content, "postgres runtime output smoke\n");
  const runtimeDocxPreviewAfterWorkspaceRemoval = await requestJson(
    `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/summary.docx")}`,
    {
      headers: {
        authorization: currentAuthHeaders.authorization,
      },
    }
  );
  assert.equal(runtimeDocxPreviewAfterWorkspaceRemoval.mode, "text");
  assert.match(runtimeDocxPreviewAfterWorkspaceRemoval.content ?? "", /postgres office doc preview/);

  const runtimeTicketAfterWorkspaceRemoval = await requestJson(
      `${baseUrl}/v1/runs/${runId}/download-tickets`,
      {
        method: "POST",
        headers: currentAuthHeaders,
        body: JSON.stringify({
          path: "output/report.txt",
        }),
    }
  );
  assert.equal(runtimeTicketAfterWorkspaceRemoval.ticket.sourceKind, "object-store");

  const runtimeDownloadAfterWorkspaceRemoval = await fetch(
    new URL(runtimeTicketAfterWorkspaceRemoval.downloadUrl, baseUrl)
  );
  assert.equal(runtimeDownloadAfterWorkspaceRemoval.ok, true);
  assert.equal(
    await runtimeDownloadAfterWorkspaceRemoval.text(),
    "postgres runtime output smoke\n"
  );

  const uploadedTicketAfterWorkspaceRemoval = await requestJson(
    `${baseUrl}/v1/runs/${runId}/download-tickets`,
    {
      method: "POST",
      headers: currentAuthHeaders,
      body: JSON.stringify({
        path: uploadedPath,
      }),
    }
  );
  assert.equal(uploadedTicketAfterWorkspaceRemoval.ticket.sourceKind, "uploaded-object");

  const uploadedDownloadAfterWorkspaceRemoval = await fetch(
    new URL(uploadedTicketAfterWorkspaceRemoval.downloadUrl, baseUrl)
  );
  assert.equal(uploadedDownloadAfterWorkspaceRemoval.ok, true);
  assert.equal(await uploadedDownloadAfterWorkspaceRemoval.text(), "postgres upload ok\n");

  const objectPath = path.join(
    objectStorageRoot,
    "runs",
    runId,
    "indexed",
    "runtime-output",
    "output",
    "report.txt"
  );
  const objectStats = await stat(objectPath);
  assert.equal(objectStats.size, 30);
  assert.equal(await readFile(objectPath, "utf8"), "postgres runtime output smoke\n");

  console.log(
    JSON.stringify({
      storage: "postgres",
      runId,
      workshopCount: workshops.length,
      serviceCount: workshopServices.length,
      creatorPackageCount: creatorPackages.length,
      treeCount: tree.length,
      indexedUploadCount: indexedUploads.summary.matchedCount,
      indexedRuntimeCount: indexedRuntimeOutputs.summary.matchedCount,
      indexedRuntimeBinaryCount: indexedRuntimeBinaryOutputs.summary.matchedCount,
      indexedSnapshotFileCount: snapshotBackedByIndex.files.length,
      previewMode: runtimePreview.mode,
      officePreviewMode: runtimeDocxPreview.mode,
      imagePreviewMode: runtimeImagePreview.mode,
      pdfPreviewMode: runtimePdfPreview.mode,
      ticketSourceKind: runtimeTicketAfterWorkspaceRemoval.ticket.sourceKind,
      uploadedTicketSourceKind: uploadedTicketAfterWorkspaceRemoval.ticket.sourceKind,
      objectPath,
    })
  );

  await resetApiDatabaseForTests();
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
