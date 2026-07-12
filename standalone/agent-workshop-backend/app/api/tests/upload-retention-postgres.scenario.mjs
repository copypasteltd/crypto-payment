import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFakePostgresPool } from "./support/fake-postgres-pool.mjs";

function resolveObjectPath(root, objectKey) {
  return path.join(root, ...objectKey.split("/"));
}

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-upload-retention-pg-"));
const envBackup = new Map();
const envKeys = [
  "DATABASE_URL",
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
  const fakePool = createFakePostgresPool();

  process.env.DATABASE_URL = "postgres://fake/lingban";
  process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
  process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
  process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
  process.env.LINGBAN_UPLOADS_STORE = "postgres";
  process.env.LINGBAN_STORAGE_RETENTION_SWEEP_INTERVAL_MS = "1000";
  process.env.LINGBAN_DOWNLOAD_TICKET_RETENTION_SECONDS = "3600";
  process.env.LINGBAN_UNATTACHED_UPLOAD_TTL_SECONDS = "86400";
  process.env.LINGBAN_EXPIRED_UPLOAD_RETENTION_SECONDS = "86400";

  const [
    { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests },
    { resetApiRuntimeConfigForTests },
    { initializeUploadInfrastructure },
    { uploadRepository },
    { objectStore },
    { uploadRetentionManager },
  ] = await Promise.all([
    import("../dist/app/database.js"),
    import("../dist/app/runtime.js"),
    import("../dist/modules/uploads/service.js"),
    import("../dist/modules/uploads/repository.js"),
    import("../dist/modules/uploads/object-store.js"),
    import("../dist/modules/uploads/retention.js"),
  ]);

  setApiDatabasePoolFactoryForTests(() => fakePool);
  resetApiRuntimeConfigForTests();
  await initializeUploadInfrastructure();

  const now = new Date("2026-07-09T12:00:00.000Z");
  const staleStored = await objectStore.putBuffer("runs/run_retention_pg/uploads/stale.txt", {
    content: Buffer.from("stale upload\n", "utf8"),
    contentType: "text/plain; charset=utf-8",
  });
  const expiredStored = await objectStore.putBuffer("runs/run_retention_pg/uploads/expired.txt", {
    content: Buffer.from("expired upload\n", "utf8"),
    contentType: "text/plain; charset=utf-8",
  });

  await uploadRepository.createUpload({
    uploadId: "upl_stale_pg",
    runId: "run_retention_pg",
    workspaceId: "wsp_retention_pg",
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
    uploadId: "upl_expired_pg",
    runId: "run_retention_pg",
    workspaceId: "wsp_retention_pg",
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
  await uploadRepository.createDownloadTicket({
    ticketId: "dlt_expired_pg",
    runId: "run_retention_pg",
    workspaceId: "wsp_retention_pg",
    path: "/workspace/output/report.pdf",
    fileName: "report.pdf",
    mimeType: "application/pdf",
    sourceKind: "object-store",
    objectKey: "runs/run_retention_pg/indexed/runtime-output/output/report.pdf",
    uploadId: null,
    createdAt: "2026-07-09T08:00:00.000Z",
    expiresAt: "2026-07-09T09:00:00.000Z",
    createdByUserId: "usr_retention_pg",
  });

  const report = await uploadRetentionManager.sweepNow({
    now,
  });
  assert.equal(report.expiredDownloadTicketsDeletedCount, 1);
  assert.equal(report.uploadsExpiredCount, 1);
  assert.equal(report.uploadRecordsDeletedCount, 1);
  assert.equal(report.uploadObjectsDeletedCount, 2);
  assert.equal(report.failureCount, 0);

  assert.equal(uploadRepository.getDownloadTicket("dlt_expired_pg"), null);
  assert.equal(uploadRepository.getUpload("upl_stale_pg")?.status, "expired");
  assert.equal(uploadRepository.getUpload("upl_expired_pg"), null);

  await assert.rejects(stat(resolveObjectPath(objectStorageRoot, staleStored.objectKey)));
  await assert.rejects(stat(resolveObjectPath(objectStorageRoot, expiredStored.objectKey)));

  console.log(
    JSON.stringify({
      storage: "postgres",
      expiredDownloadTicketsDeletedCount: report.expiredDownloadTicketsDeletedCount,
      uploadsExpiredCount: report.uploadsExpiredCount,
      uploadRecordsDeletedCount: report.uploadRecordsDeletedCount,
      uploadObjectsDeletedCount: report.uploadObjectsDeletedCount,
    })
  );

  await resetApiDatabaseForTests();
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
