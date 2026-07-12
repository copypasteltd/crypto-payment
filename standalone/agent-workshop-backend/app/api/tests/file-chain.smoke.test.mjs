import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import XLSX from "xlsx";

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

async function waitForRun(baseUrl, runId, predicate, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const startedAt = Date.now();
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await requestJson(`${baseUrl}/v1/runs/${runId}`, options.requestInit);
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
          }
        : null
    )}`
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rmWithRetry(
  targetPath,
  options = {},
  retries = process.platform === "win32" ? 20 : 8
) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await rm(targetPath, options);
      return;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (
        attempt >= retries ||
        (code !== "EBUSY" && code !== "EPERM" && code !== "ENOTEMPTY")
      ) {
        throw error;
      }

      await sleep((process.platform === "win32" ? 250 : 150) * (attempt + 1));
    }
  }
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
  <w:body>
    <w:p>
      <w:r><w:t>${escapeXml(text)}</w:t></w:r>
    </w:p>
  </w:body>
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

async function createPptxBuffer(slides) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slides
    .map(
      (_, index) =>
        `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join("\n  ")}
</Types>`
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );
  zip.folder("ppt")?.file(
    "presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    ${slides
      .map(
        (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`
      )
      .join("\n    ")}
  </p:sldIdLst>
</p:presentation>`
  );
  zip.folder("ppt")?.folder("_rels")?.file(
    "presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slides
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`
    )
    .join("\n  ")}
</Relationships>`
  );

  for (const [index, slideTexts] of slides.entries()) {
    zip.folder("ppt")?.folder("slides")?.file(
      `slide${index + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          ${slideTexts
            .map(
              (text) => `<a:p><a:r><a:t>${escapeXml(text)}</a:t></a:r></a:p>`
            )
            .join("")}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

test("file chain smoke: upload preview and runtime output objectify", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-api-smoke-"));
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
  let runId = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const objectStorageRoot = path.join(smokeRoot, "objects");
    const targetPath = path.join(smokeRoot, "target");

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.CODEX_BIN = process.execPath;

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
        email: "smoke-file-chain@example.com",
        password: "TestPassword123!",
        displayName: "Smoke File Chain",
        workspaceName: "Smoke Workspace",
      }),
    });

    const authHeaders = {
      authorization: `Bearer ${register.tokens.accessToken}`,
      "content-type": "application/json",
    };

    const createRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        workspaceId: register.currentWorkspace.workspaceId,
        taskVersionId: "tsv_00000001",
        sessionVersionId: "sev_00000001",
        title: "File chain smoke",
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

    runId = createRun.run.runId;

    const createdUpload = await requestJson(`${baseUrl}/v1/runs/${runId}/uploads`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        fileName: "notes.txt",
        contentType: "text/plain; charset=utf-8",
        sizeBytes: 17,
      }),
    });

    const uploadContent = Buffer.from("uploaded smoke\n", "utf8");
    const putUpload = await fetch(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/content`,
      {
        method: "PUT",
        headers: {
          authorization: authHeaders.authorization,
          "content-type": "application/octet-stream",
        },
        body: uploadContent,
      }
    );
    assert.equal(putUpload.ok, true, `PUT upload failed: ${await putUpload.text()}`);

    const finalizedUpload = await requestJson(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/finalize`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          label: "Notes",
        }),
      }
    );

    const uploadedPath = path.relative(targetPath, finalizedUpload.attachment.path).replace(/\\/g, "/");
    const indexedUploads = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/indexed?source=user-upload`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(indexedUploads.mode, "indexed");
    assert.equal(indexedUploads.summary.matchedCount, 1);
    assert.equal(indexedUploads.summary.returnedCount, 1);
    assert.equal(indexedUploads.items[0].source, "user-upload");
    assert.equal(indexedUploads.items[0].logicalPath, `/uploads/${createdUpload.upload.uploadId}/notes.txt`);
    const uploadedPreview = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent(uploadedPath)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(uploadedPreview.mode, "text");
    assert.equal(uploadedPreview.file.source, "user-upload");
    assert.equal(uploadedPreview.content, "uploaded smoke\n");

    const uploadedTicket = await requestJson(`${baseUrl}/v1/runs/${runId}/download-tickets`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        path: uploadedPath,
      }),
    });
    assert.equal(uploadedTicket.ticket.sourceKind, "uploaded-object");

    const uploadedDownload = await fetch(new URL(uploadedTicket.downloadUrl, baseUrl));
    assert.equal(uploadedDownload.ok, true);
    assert.equal(await uploadedDownload.text(), "uploaded smoke\n");

    const runtimeFileAbsolutePath = path.join(targetPath, "output", "report.txt");
    await mkdir(path.dirname(runtimeFileAbsolutePath), { recursive: true });
    await writeFile(runtimeFileAbsolutePath, "runtime output smoke\n", "utf8");

    const tree = await requestJson(`${baseUrl}/v1/runs/${runId}/files/tree`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      tree.some((file) => file.path.endsWith("/output/report.txt")),
      true,
      "runtime output file should appear in tree scan"
    );

    const runtimePreview = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/report.txt")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );

    assert.equal(runtimePreview.mode, "text");
    assert.equal(runtimePreview.file.source, "runtime-output");
    assert.equal(
      runtimePreview.file.objectKey,
      `runs/${runId}/indexed/runtime-output/output/report.txt`
    );
    assert.match(runtimePreview.file.checksum, /^[0-9a-f]{64}$/);
    assert.equal(runtimePreview.content, "runtime output smoke\n");
    const indexedRuntimeOutputs = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/indexed?source=runtime-output&search=report`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(indexedRuntimeOutputs.summary.totalIndexedCount >= 1, true);
    assert.equal(indexedRuntimeOutputs.summary.matchedCount, 1);
    assert.equal(indexedRuntimeOutputs.items[0].logicalPath, "/output/report.txt");
    assert.equal(
      indexedRuntimeOutputs.items[0].objectKey,
      `runs/${runId}/indexed/runtime-output/output/report.txt`
    );

    const runtimeImageAbsolutePath = path.join(targetPath, "output", "preview.png");
    const runtimePdfAbsolutePath = path.join(targetPath, "output", "preview.pdf");
    const runtimeDocxAbsolutePath = path.join(targetPath, "output", "summary.docx");
    const runtimeXlsxAbsolutePath = path.join(targetPath, "output", "table.xlsx");
    const runtimePptxAbsolutePath = path.join(targetPath, "output", "slides.pptx");
    const runtimeImageContent = Buffer.from(
      "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6360000002000154A24F5D0000000049454E44AE426082",
      "hex"
    );
    const runtimePdfContent = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
      "utf8"
    );
    const runtimeDocxContent = await createDocxBuffer("office doc preview smoke");
    const runtimeXlsxContent = createXlsxBuffer([
      ["item", "value"],
      ["tax", "ready"],
      ["region", "TW"],
    ]);
    const runtimePptxContent = await createPptxBuffer([
      ["slide one", "agent workshop"],
      ["slide two", "preview smoke"],
    ]);
    await writeFile(runtimeImageAbsolutePath, runtimeImageContent);
    await writeFile(runtimePdfAbsolutePath, runtimePdfContent);
    await writeFile(runtimeDocxAbsolutePath, runtimeDocxContent);
    await writeFile(runtimeXlsxAbsolutePath, runtimeXlsxContent);
    await writeFile(runtimePptxAbsolutePath, runtimePptxContent);

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
        authorization: authHeaders.authorization,
      },
    });
    await assert.rejects(stat(legacyRuntimeImageObjectPath));

    const billingBeforeBinaryPreview = await requestJson(
      `${baseUrl}/v1/billing/entries?runId=${encodeURIComponent(runId)}`,
      {
        headers: {
          authorization: authHeaders.authorization,
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
          authorization: authHeaders.authorization,
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
    assert.equal(runtimeImagePreview.downloadExpiresAt != null, true);

    const runtimePdfPreview = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/preview.pdf")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
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
    assert.equal(runtimePdfPreview.downloadExpiresAt != null, true);

    const runtimeDocxPreview = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/summary.docx")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(runtimeDocxPreview.mode, "text");
    assert.equal(
      runtimeDocxPreview.file.mimeType,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    assert.match(runtimeDocxPreview.content ?? "", /office doc preview smoke/);

    const runtimeXlsxPreview = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/table.xlsx")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(runtimeXlsxPreview.mode, "text");
    assert.equal(
      runtimeXlsxPreview.file.mimeType,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    assert.match(runtimeXlsxPreview.content ?? "", /Sheet 1: Preview/);
    assert.match(runtimeXlsxPreview.content ?? "", /tax\tready/);

    const runtimePptxPreview = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/slides.pptx")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(runtimePptxPreview.mode, "text");
    assert.equal(
      runtimePptxPreview.file.mimeType,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    assert.match(runtimePptxPreview.content ?? "", /Slide 1/);
    assert.match(runtimePptxPreview.content ?? "", /preview smoke/);

    const indexedRuntimeBinaryOutputs = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/indexed?source=runtime-output&search=preview`,
      {
        headers: {
          authorization: authHeaders.authorization,
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
          authorization: authHeaders.authorization,
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
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      snapshotBackedByIndex.files.some((file) => file.path.endsWith("/output/report.txt")),
      true,
      "run snapshot should recover files from the indexed catalog when aggregate files are stale"
    );

    const listFilesBackedByIndex = await requestJson(`${baseUrl}/v1/runs/${runId}/files`, {
      headers: {
        authorization: authHeaders.authorization,
      },
    });
    assert.equal(
      listFilesBackedByIndex.some((file) => file.path.endsWith("/output/report.txt")),
      true,
      "run files endpoint should recover files from the indexed catalog when aggregate files are stale"
    );

    const runtimeTicket = await requestJson(`${baseUrl}/v1/runs/${runId}/download-tickets`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        path: "output/report.txt",
      }),
    });

    assert.equal(runtimeTicket.ticket.sourceKind, "object-store");
    assert.equal(
      runtimeTicket.ticket.objectKey,
      `runs/${runId}/indexed/runtime-output/output/report.txt`
    );

    const runtimeDownload = await fetch(new URL(runtimeTicket.downloadUrl, baseUrl));
    assert.equal(runtimeDownload.ok, true);
    assert.equal(
      runtimeDownload.headers.get("content-type"),
      "text/plain; charset=utf-8"
    );
    assert.equal(await runtimeDownload.text(), "runtime output smoke\n");

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
    assert.equal(objectStats.size, 21);
    assert.equal(await readFile(objectPath, "utf8"), "runtime output smoke\n");

    await requestJson(`${baseUrl}/v1/runs/${runId}/cancel`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        reason: "workspace removal verification",
      }),
    });
    await waitForRun(
      baseUrl,
      runId,
      (snapshot) =>
        snapshot.run.status === "CANCELLED" && Boolean(snapshot.runtime?.finishedAt),
      {
        requestInit: {
          headers: {
            authorization: authHeaders.authorization,
          },
        },
      }
    );

    await rmWithRetry(targetPath, { recursive: true, force: true });

    const indexedTreeAfterWorkspaceRemoval = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/tree`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(
      indexedTreeAfterWorkspaceRemoval.some((file) => file.path.endsWith("/output/report.txt")),
      true,
      "indexed tree should survive target workspace removal"
    );

    const runtimePreviewAfterWorkspaceRemoval = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/report.txt")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(runtimePreviewAfterWorkspaceRemoval.mode, "text");
    assert.equal(runtimePreviewAfterWorkspaceRemoval.file.source, "runtime-output");
    assert.equal(runtimePreviewAfterWorkspaceRemoval.content, "runtime output smoke\n");
    const runtimeDocxPreviewAfterWorkspaceRemoval = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/preview?path=${encodeURIComponent("output/summary.docx")}`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(runtimeDocxPreviewAfterWorkspaceRemoval.mode, "text");
    assert.match(runtimeDocxPreviewAfterWorkspaceRemoval.content ?? "", /office doc preview smoke/);
    const indexedAfterWorkspaceRemoval = await requestJson(
      `${baseUrl}/v1/runs/${runId}/files/indexed?prefix=/output&search=report`,
      {
        headers: {
          authorization: authHeaders.authorization,
        },
      }
    );
    assert.equal(indexedAfterWorkspaceRemoval.summary.matchedCount, 1);
    assert.equal(indexedAfterWorkspaceRemoval.items[0].logicalPath, "/output/report.txt");

    const runtimeTicketAfterWorkspaceRemoval = await requestJson(
      `${baseUrl}/v1/runs/${runId}/download-tickets`,
      {
        method: "POST",
        headers: authHeaders,
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
      "runtime output smoke\n"
    );
  } finally {
    if (app && runId) {
      try {
        const login = await requestJson(`http://127.0.0.1:${process.env.API_PORT}/v1/auth/login`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email: "smoke-file-chain@example.com",
            password: "TestPassword123!",
          }),
        });

        await fetch(`http://127.0.0.1:${process.env.API_PORT}/v1/runs/${runId}/cancel`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${login.tokens.accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            reason: "smoke cleanup",
          }),
        }).catch(() => undefined);
      } catch {
        // ignore cleanup auth failures
      }
    }

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

    await rmWithRetry(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
