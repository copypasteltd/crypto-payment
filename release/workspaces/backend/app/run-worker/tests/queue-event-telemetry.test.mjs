import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function importQueueEventTelemetryModule() {
  const moduleUrl = pathToFileURL(path.resolve("dist/queue-event-telemetry.js")).href;
  return import(moduleUrl);
}

test("BullmqQueueEventTelemetry records queue event counters and last-event details", async () => {
  const { BullmqQueueEventTelemetry } = await importQueueEventTelemetryModule();
  const startEmitter = new EventEmitter();
  const cleanupEmitter = new EventEmitter();
  const stamps = [
    "2026-07-09T12:00:00.000Z",
    "2026-07-09T12:00:01.000Z",
    "2026-07-09T12:00:02.000Z",
    "2026-07-09T12:00:03.000Z",
  ];

  const telemetry = new BullmqQueueEventTelemetry({
    now: () => stamps.shift() ?? "2026-07-09T12:00:59.000Z",
  });

  telemetry.attach("start", startEmitter);
  telemetry.attach("cleanup", cleanupEmitter);

  startEmitter.emit("added", { jobId: "run_start_001" }, "evt_1");
  startEmitter.emit("stalled", { jobId: "run_start_001" }, "evt_2");
  cleanupEmitter.emit(
    "failed",
    { jobId: "run_cleanup_001", failedReason: "permission denied", prev: "active" },
    "evt_3"
  );
  cleanupEmitter.emit("error", new Error("redis stream dropped"));

  const diagnostics = telemetry.getDiagnostics();
  assert.equal(diagnostics.start.counts.added, 1);
  assert.equal(diagnostics.start.counts.stalled, 1);
  assert.equal(diagnostics.start.lastEventName, "stalled");
  assert.equal(diagnostics.start.lastJobId, "run_start_001");
  assert.equal(diagnostics.start.lastEventId, "evt_2");
  assert.equal(diagnostics.start.lastEventAt, "2026-07-09T12:00:01.000Z");

  assert.equal(diagnostics.cleanup.counts.failed, 1);
  assert.equal(diagnostics.cleanup.counts.error, 1);
  assert.equal(diagnostics.cleanup.lastEventName, "error");
  assert.equal(diagnostics.cleanup.lastJobId, null);
  assert.equal(diagnostics.cleanup.lastFailedReason, null);
  assert.equal(diagnostics.cleanup.lastErrorMessage, "redis stream dropped");
  assert.equal(diagnostics.cleanup.lastEventAt, "2026-07-09T12:00:03.000Z");
});
