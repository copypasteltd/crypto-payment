import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { processSessionCapture } from "../dist/services/session-capture/capture-orchestrator.js";

test("processSessionCapture builds content-addressed evidence and a zstd workspace archive", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "lingban-capture-"));
  const targetPath = path.join(root, "target");
  const runtimePath = path.join(root, "runtime");
  await mkdir(path.join(targetPath, "reports"), { recursive: true });
  await writeFile(path.join(targetPath, "reports", "result.txt"), "captured output\n", "utf8");

  const uploaded = [];
  const lease = {
    captureId: "cap_test_capture",
    runId: "run_test_capture",
    workerId: "worker_test",
    leaseGeneration: 1,
    leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
    workspaceSelection: {
      targetPath,
      includeGlobs: ["**/*"],
      excludeGlobs: ["**/.env"],
      includeArtifacts: true,
      maxFiles: 100,
      maxBytes: 1024 * 1024,
    },
    requestedBoundaryTurnId: null,
  };
  const apiConnector = {
    async acquireSessionCaptureLease() { return lease; },
    async submitSessionCaptureBarrier(_lease, boundary) { return { boundary }; },
    async getSessionCaptureEvidence() {
      return {
        capture: { workspaceId: "wsp_test_capture" },
        thread: { threadId: "thr_test" },
        events: [{ eventId: "aev_1", eventType: "item/completed", sequence: 1 }],
        run: { messages: [{ messageId: "msg_1" }], artifacts: [] },
      };
    },
    async uploadSessionCaptureObject(_lease, object, content) {
      const stored = {
        objectType: object.objectType,
        objectKey: `session-captures/cap_test_capture/${object.objectType}/${object.sha256}`,
        sha256: object.sha256,
        sizeBytes: content.byteLength,
        contentType: object.contentType,
      };
      uploaded.push({ stored, content: Buffer.from(content) });
      return { capture: {}, object: stored };
    },
    async completeSessionCapture(_runId, _captureId, input) { return input; },
    async failSessionCapture() { throw new Error("capture should not fail"); },
  };
  const handle = {
    controller: {
      async handle(command) {
        if (command.type === "captureBarrier") {
          return {
            boundary: {
              threadId: "thr_test",
              throughTurnId: "turn_test",
              eventHighWatermark: 1,
              barrierReachedAt: new Date().toISOString(),
            },
          };
        }
        return { ok: true };
      },
    },
  };

  try {
    const completed = await processSessionCapture({
      runId: lease.runId,
      captureId: lease.captureId,
      workerId: lease.workerId,
      targetPath,
      runtimePath,
      handle,
      apiConnector,
    });
    assert.equal(uploaded.length, 5);
    assert.deepEqual(uploaded.map((entry) => entry.stored.objectType), [
      "raw_events", "thread", "workspace", "inventory", "manifest",
    ]);
    assert.deepEqual([...uploaded.find((entry) => entry.stored.objectType === "workspace").content.subarray(0, 4)], [0x28, 0xb5, 0x2f, 0xfd]);
    assert.equal(completed.fileCount, 1);
    assert.equal(completed.objects.length, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
