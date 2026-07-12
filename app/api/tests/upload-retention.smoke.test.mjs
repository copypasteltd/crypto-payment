import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function resolveObjectPath(root, objectKey) {
  return path.join(root, ...objectKey.split("/"));
}

test("upload retention sweeper prunes expired tickets and stale unattached uploads", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-upload-retention-"));
  const envBackup = new Map();
  const envKeys = [
    "LINGBAN_DATA_DIR",
    "LINGBAN_OBJECT_STORAGE_DRIVER",
    "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_UPLOADS_STORE",
    "LINGBAN_STORAGE_RETENTION_SWEEP_INTERVAL_MS",
    "LINGBAN_DOWNLOAD_TICKET_RETENTION_SECONDS",
    "LINGBAN_UNATTACHED_UPLOAD_TTL_SECONDS",
    "LINGBAN_EXPIRED_UPLOAD_RETENTION_SECONDS",
  ];

  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  try {
    const objectStorageRoot = path.join(smokeRoot, "objects");
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
    process.env.LINGBAN_UPLOADS_STORE = "file";
    process.env.LINGBAN_STORAGE_RETENTION_SWEEP_INTERVAL_MS = "1000";
    process.env.LINGBAN_DOWNLOAD_TICKET_RETENTION_SECONDS = "3600";
    process.env.LINGBAN_UNATTACHED_UPLOAD_TTL_SECONDS = "86400";
    process.env.LINGBAN_EXPIRED_UPLOAD_RETENTION_SECONDS = "86400";

    const [
      { resetApiRuntimeConfigForTests },
      { initializeUploadInfrastructure },
      { uploadRepository },
      { objectStore },
      { uploadRetentionManager },
    ] = await Promise.all([
      import("../dist/app/runtime.js"),
      import("../dist/modules/uploads/service.js"),
      import("../dist/modules/uploads/repository.js"),
      import("../dist/modules/uploads/object-store.js"),
      import("../dist/modules/uploads/retention.js"),
    ]);

    resetApiRuntimeConfigForTests();
    await initializeUploadInfrastructure();

    const now = new Date("2026-07-09T12:00:00.000Z");
    const staleStored = await objectStore.putBuffer("runs/run_retention/uploads/stale.txt", {
      content: Buffer.from("stale upload\n", "utf8"),
      contentType: "text/plain; charset=utf-8",
    });
    const expiredStored = await objectStore.putBuffer("runs/run_retention/uploads/expired.txt", {
      content: Buffer.from("expired upload\n", "utf8"),
      contentType: "text/plain; charset=utf-8",
    });
    const attachedStored = await objectStore.putBuffer("runs/run_retention/uploads/attached.txt", {
      content: Buffer.from("attached upload\n", "utf8"),
      contentType: "text/plain; charset=utf-8",
    });

    await uploadRepository.createUpload({
      uploadId: "upl_stale",
      runId: "run_retention",
      workspaceId: "wsp_retention",
      fileName: "stale.txt",
      contentType: "text/plain; charset=utf-8",
      declaredSizeBytes: staleStored.sizeBytes,
      storedSizeBytes: staleStored.sizeBytes,
      sha256: staleStored.sha256,
      objectKey: staleStored.objectKey,
      status: "uploaded",
      attachedPath: null,
      attachedLabel: null,
      createdAt: "2026-07-07T09:00:00.000Z",
      updatedAt: "2026-07-07T09:00:00.000Z",
    });
    await uploadRepository.createUpload({
      uploadId: "upl_expired",
      runId: "run_retention",
      workspaceId: "wsp_retention",
      fileName: "expired.txt",
      contentType: "text/plain; charset=utf-8",
      declaredSizeBytes: expiredStored.sizeBytes,
      storedSizeBytes: expiredStored.sizeBytes,
      sha256: expiredStored.sha256,
      objectKey: expiredStored.objectKey,
      status: "expired",
      attachedPath: null,
      attachedLabel: null,
      createdAt: "2026-07-05T09:00:00.000Z",
      updatedAt: "2026-07-07T09:00:00.000Z",
    });
    await uploadRepository.createUpload({
      uploadId: "upl_attached",
      runId: "run_retention",
      workspaceId: "wsp_retention",
      fileName: "attached.txt",
      contentType: "text/plain; charset=utf-8",
      declaredSizeBytes: attachedStored.sizeBytes,
      storedSizeBytes: attachedStored.sizeBytes,
      sha256: attachedStored.sha256,
      objectKey: attachedStored.objectKey,
      status: "attached",
      attachedPath: "/workspace/uploads/upl_attached/attached.txt",
      attachedLabel: "Attached",
      createdAt: "2026-07-07T09:00:00.000Z",
      updatedAt: "2026-07-07T09:00:00.000Z",
    });

    await uploadRepository.createDownloadTicket({
      ticketId: "dlt_expired",
      runId: "run_retention",
      workspaceId: "wsp_retention",
      path: "/workspace/output/report.pdf",
      fileName: "report.pdf",
      mimeType: "application/pdf",
      sourceKind: "object-store",
      objectKey: "runs/run_retention/indexed/runtime-output/output/report.pdf",
      uploadId: null,
      createdAt: "2026-07-09T08:00:00.000Z",
      expiresAt: "2026-07-09T09:00:00.000Z",
      createdByUserId: "usr_retention",
    });
    await uploadRepository.createDownloadTicket({
      ticketId: "dlt_active",
      runId: "run_retention",
      workspaceId: "wsp_retention",
      path: "/workspace/output/live.pdf",
      fileName: "live.pdf",
      mimeType: "application/pdf",
      sourceKind: "object-store",
      objectKey: "runs/run_retention/indexed/runtime-output/output/live.pdf",
      uploadId: null,
      createdAt: "2026-07-09T11:00:00.000Z",
      expiresAt: "2026-07-09T15:00:00.000Z",
      createdByUserId: "usr_retention",
    });

    const report = await uploadRetentionManager.sweepNow({
      now,
    });
    assert.equal(report.expiredDownloadTicketsDeletedCount, 1);
    assert.equal(report.uploadsExpiredCount, 1);
    assert.equal(report.uploadRecordsDeletedCount, 1);
    assert.equal(report.uploadObjectsDeletedCount, 2);
    assert.equal(report.failureCount, 0);

    assert.equal(uploadRepository.getDownloadTicket("dlt_expired"), null);
    assert.notEqual(uploadRepository.getDownloadTicket("dlt_active"), null);
    assert.equal(uploadRepository.getUpload("upl_stale")?.status, "expired");
    assert.equal(uploadRepository.getUpload("upl_expired"), null);
    assert.equal(uploadRepository.getUpload("upl_attached")?.status, "attached");

    await assert.rejects(stat(resolveObjectPath(objectStorageRoot, staleStored.objectKey)));
    await assert.rejects(stat(resolveObjectPath(objectStorageRoot, expiredStored.objectKey)));
    await assert.doesNotReject(stat(resolveObjectPath(objectStorageRoot, attachedStored.objectKey)));

    const diagnostics = uploadRetentionManager.getDiagnostics();
    assert.equal(diagnostics.metrics.sweepRunsTotal >= 1, true);
    assert.equal(diagnostics.metrics.expiredDownloadTicketsDeletedTotal, 1);
    assert.equal(diagnostics.metrics.uploadsExpiredTotal, 1);
    assert.equal(diagnostics.metrics.uploadRecordsDeletedTotal, 1);
    assert.equal(diagnostics.metrics.uploadObjectsDeletedTotal, 2);
    assert.equal(diagnostics.lastSweep.errorMessage, null);
  } finally {
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
