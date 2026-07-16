import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("filesystem object store conditionally creates immutable objects and rejects conflicting bytes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lingban-immutable-object-"));
  const previousDriver = process.env.LINGBAN_OBJECT_STORAGE_DRIVER;
  const previousRoot = process.env.LINGBAN_OBJECT_STORAGE_ROOT;
  try {
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = root;
    const { objectStore, ObjectStoreImmutableConflictError } = await import("../dist/modules/uploads/object-store.js");
    const objectKey = "session-versions/sev_test/content.pack";
    const content = Buffer.from("immutable session pack", "utf8");
    const first = await objectStore.putBufferImmutable(objectKey, { content, contentType: "application/octet-stream" });
    const replayed = await objectStore.putBufferImmutable(objectKey, { content, contentType: "application/octet-stream" });
    assert.deepEqual(replayed, first);
    await assert.rejects(
      objectStore.putBufferImmutable(objectKey, {
        content: Buffer.from("conflicting session pack", "utf8"),
        contentType: "application/octet-stream",
      }),
      ObjectStoreImmutableConflictError
    );
  } finally {
    if (previousDriver === undefined) delete process.env.LINGBAN_OBJECT_STORAGE_DRIVER;
    else process.env.LINGBAN_OBJECT_STORAGE_DRIVER = previousDriver;
    if (previousRoot === undefined) delete process.env.LINGBAN_OBJECT_STORAGE_ROOT;
    else process.env.LINGBAN_OBJECT_STORAGE_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
