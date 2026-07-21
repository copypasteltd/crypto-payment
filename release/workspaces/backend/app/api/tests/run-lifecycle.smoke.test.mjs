import assert from "node:assert/strict";
import test from "node:test";

const at = "2026-07-21T08:00:00.000Z";

async function createFixture(options = {}) {
  const [{ RunsService }, contracts, db] = await Promise.all([
    import("../dist/modules/runs/service.js"),
    import("../../../packages/contracts/dist/index.js"),
    import("../../../packages/db/dist/index.js"),
  ]);
  const input = contracts.createRunInputSchema.parse({
    workspaceId: "wsp_lifecycle",
    taskVersionId: "tsv_lifecycle",
    sessionVersionId: "sev_lifecycle",
    title: "Lifecycle run",
    targetPath: "/workspace/lifecycle",
    entrySurface: "dashboard",
    bindings: { firstPartyMcpIds: [], externalConnectorRefs: [], credentialIds: [] },
  });
  const run = contracts.runRecordSchema.parse({
    runId: options.runId ?? "run_lifecycle",
    workspaceId: input.workspaceId,
    runPurpose: input.runPurpose,
    sessionBootstrapMode: input.sessionBootstrapMode,
    sessionProjectId: null,
    taskVersionId: input.taskVersionId,
    sessionVersionId: input.sessionVersionId,
    draftRevisionId: null,
    requestedByUserId: "usr_lifecycle",
    title: input.title,
    targetPath: input.targetPath,
    entrySurface: input.entrySurface,
    approvalMode: "manual",
    catalogMetadata: null,
    status: "RUNNING",
    statusReason: null,
    createdAt: at,
    updatedAt: at,
  });
  let aggregate = db.runAggregateSchema.parse({
    run,
    lifecycle: contracts.runLifecycleSchema.parse({ runtimeStatus: "ACTIVE" }),
    input,
    startJob: {
      run,
      initialPrompt: "Run lifecycle smoke test",
      requestedInitialMessage: null,
      bindings: input.bindings,
    },
    messages: [],
    files: [{ path: "/workspace/lifecycle/result.txt", name: "result.txt", kind: "output", sizeBytes: 6, updatedAt: at }],
    artifacts: [],
    approvals: [],
  });
  const stopCalls = [];
  const cleanupCalls = [];
  const deletedRuntimeData = [];
  const deletedObjects = [];
  const deletedUploads = [];
  const deletedDownloadTickets = [];
  const uploads = [{ uploadId: "upl_lifecycle", runId: aggregate.run.runId, objectKey: "uploads/lifecycle.txt" }];
  const downloadTickets = [{ ticketId: "dlt_lifecycle", runId: aggregate.run.runId }];
  let stopError = options.stopError ?? null;
  let cleanupError = options.cleanupError ?? null;
  const events = [];
  const service = new RunsService({
    runsRepository: {
      async init() {},
      get(runId) { return aggregate.run.runId === runId ? aggregate : null; },
      list() { return [aggregate]; },
      async save(next) { aggregate = db.runAggregateSchema.parse(next); return aggregate; },
      async update(runId, updater) {
        if (aggregate.run.runId !== runId) return null;
        aggregate = db.runAggregateSchema.parse(updater(aggregate));
        return aggregate;
      },
      async clear() {},
    },
    runEventBus: {
      async init() {},
      async append(event) { events.push(event); return { eventId: `evt_${events.length}`, runId: aggregate.run.runId, event }; },
      async appendMany(next) { return await Promise.all(next.map((event) => this.append(event))); },
      async deleteRun(runId) { deletedRuntimeData.push(`events:${runId}`); },
    },
    runFileIndexService: {
      async init() {},
      list() { return []; },
      async replaceFromEntries(_run, files) { aggregate = { ...aggregate, files }; return files; },
      async upsertFromEntry() {},
    },
    runFileAccessService: { async statRunFile() { return null; } },
    runQueryRepository: null,
    bridgeRegistry: {
      get() { return null; },
      async dispatch() { return null; },
      getDiagnostics() { return { connections: [] }; },
    },
    runtimeControl: {
      async startRun() {},
      async requestStop(runId, stopOptions) {
        stopCalls.push({ runId, force: stopOptions?.force ?? false });
        if (stopError) throw stopError;
      },
      async requestWorkspaceCleanup(runId) {
        cleanupCalls.push(runId);
        if (cleanupError) throw cleanupError;
      },
      async requestSessionCapture() {},
      getDiagnostics() { return {}; },
      async recover() {},
      async shutdown() {},
    },
    agentRuntimeRepository: {
      async getThreadByRunId() { return null; },
      async upsertThread(value) { return value; },
      async appendEvent(value) { return value; },
      async listEvents() { return []; },
      async deleteRun(runId) { deletedRuntimeData.push(`agent:${runId}`); },
    },
    uploadRepository: {
      listUploadsByRun(runId) { return uploads.filter((item) => item.runId === runId); },
      listDownloadTickets() { return downloadTickets; },
      async deleteUpload(uploadId) { deletedUploads.push(uploadId); },
      async deleteDownloadTicket(ticketId) { deletedDownloadTickets.push(ticketId); },
    },
    objectStore: { async deleteObject(objectKey) { deletedObjects.push(objectKey); } },
    sessionCaptureRepository: {
      async listByRunId() { return options.sessionCaptures ?? []; },
    },
  });
  return {
    service,
    stopCalls,
    cleanupCalls,
    deletedRuntimeData,
    deletedObjects,
    deletedUploads,
    deletedDownloadTickets,
    getAggregate() { return aggregate; },
    events,
    setStopError(value) { stopError = value; },
    setCleanupError(value) { cleanupError = value; },
  };
}

test("run lifecycle stops, releases, archives, restores, and deletes a run", async () => {
  const fixture = await createFixture();
  const stopped = await fixture.service.stop("run_lifecycle", {
    reason: "Lifecycle test stop",
    requestedByUserId: "usr_lifecycle",
  });
  assert.equal(stopped.run.status, "CANCELLED");
  assert.equal(stopped.lifecycle.runtimeStatus, "RELEASED");
  assert.equal(stopped.lifecycle.stopMode, "graceful");
  assert.equal(fixture.stopCalls.length, 1);
  assert.equal(fixture.stopCalls[0].force, false);

  await assert.rejects(
    fixture.service.sendMessage("run_lifecycle", { text: "should fail", attachments: [], slotValues: [] }),
    (error) => error?.code === "RUN_NOT_ACTIVE"
  );

  const archived = await fixture.service.archiveRun("run_lifecycle", { requestedByUserId: "usr_lifecycle" });
  assert.equal(archived.lifecycle.recordStatus, "ARCHIVED");
  assert.equal(fixture.service.listRuns().length, 0);
  assert.equal(fixture.service.listRuns({ recordStatus: "ARCHIVED" }).length, 1);

  const restored = await fixture.service.restoreRun("run_lifecycle", { requestedByUserId: "usr_lifecycle" });
  assert.equal(restored.lifecycle.recordStatus, "ACTIVE");

  const deleted = await fixture.service.deleteRun("run_lifecycle", {
    reason: "Lifecycle smoke permanent deletion",
    confirmation: "run_lifecycle",
    requestedByUserId: "usr_lifecycle",
  });
  assert.equal(deleted.runId, "run_lifecycle");
  assert.deepEqual(fixture.cleanupCalls, ["run_lifecycle"]);
  assert.deepEqual(fixture.deletedRuntimeData, ["agent:run_lifecycle", "events:run_lifecycle"]);
  assert.deepEqual(fixture.deletedObjects, ["uploads/lifecycle.txt"]);
  assert.deepEqual(fixture.deletedUploads, ["upl_lifecycle"]);
  assert.deepEqual(fixture.deletedDownloadTickets, ["dlt_lifecycle"]);
  assert.equal(fixture.service.listRuns({ recordStatus: "DELETED" })[0].messages.length, 0);
  assert.equal(fixture.getAggregate().run.title, "Deleted run");
  assert.equal(fixture.getAggregate().run.requestedByUserId, null);
  assert.deepEqual(fixture.getAggregate().input.bindings.credentialIds, []);
  assert.equal(fixture.getAggregate().startJob.provider, null);
  assert.equal(fixture.service.getRuntimeRecoveryCandidate("run_lifecycle").action, "ignore");
  assert.throws(() => fixture.service.getRun("run_lifecycle"), (error) => error?.code === "RUN_DELETED");
});

test("run lifecycle exposes release failure and supports force reconciliation", async () => {
  const fixture = await createFixture({ runId: "run_release_failure", stopError: new Error("worker unavailable") });
  const failed = await fixture.service.forceTerminate(
    "run_release_failure",
    "Admin force termination test",
    "usr_admin"
  );
  assert.equal(failed.run.status, "CANCELLED");
  assert.equal(failed.lifecycle.runtimeStatus, "RELEASE_FAILED");
  assert.match(failed.lifecycle.releaseFailure, /worker unavailable/);
  assert.equal(fixture.stopCalls[0].force, true);

  fixture.setStopError(null);
  const reconciled = await fixture.service.reconcileRuntime("run_release_failure");
  assert.equal(reconciled.lifecycle.runtimeStatus, "RELEASED");
  assert.equal(reconciled.lifecycle.cleanupAttemptCount, 2);
  assert.equal(fixture.stopCalls[1].force, true);
});

test("concurrent stop requests share one runtime release operation", async () => {
  const fixture = await createFixture({ runId: "run_concurrent_stop" });
  const [first, second] = await Promise.all([
    fixture.service.stop("run_concurrent_stop", { reason: "First stop request" }),
    fixture.service.stop("run_concurrent_stop", { reason: "Second stop request" }),
  ]);
  assert.equal(first.lifecycle.runtimeStatus, "RELEASED");
  assert.equal(second.lifecycle.runtimeStatus, "RELEASED");
  assert.equal(fixture.stopCalls.length, 1);
});

test("failed permanent cleanup restores list visibility and can be retried", async () => {
  const fixture = await createFixture({
    runId: "run_delete_retry",
    cleanupError: new Error("worker cleanup unavailable"),
  });
  await fixture.service.stop("run_delete_retry", { reason: "Prepare deletion retry" });
  await assert.rejects(
    fixture.service.deleteRun("run_delete_retry", {
      reason: "Delete with unavailable cleanup",
      confirmation: "run_delete_retry",
    }),
    (error) => error?.code === "RUN_DELETE_CLEANUP_FAILED"
  );
  const visible = fixture.service.getRun("run_delete_retry");
  assert.equal(visible.lifecycle.recordStatus, "ACTIVE");
  assert.match(visible.lifecycle.deletionFailure, /worker cleanup unavailable/);

  fixture.setCleanupError(null);
  const deleted = await fixture.service.deleteRun("run_delete_retry", {
    reason: "Retry permanent deletion",
    confirmation: "run_delete_retry",
  });
  assert.equal(deleted.runId, "run_delete_retry");
});

test("permanent deletion waits for unfinished Session Capture jobs", async () => {
  const fixture = await createFixture({
    runId: "run_capture_pending",
    sessionCaptures: [{ captureId: "cap_pending", status: "UPLOADING" }],
  });
  await fixture.service.stop("run_capture_pending", { reason: "Prepare capture gate" });
  await assert.rejects(
    fixture.service.deleteRun("run_capture_pending", {
      reason: "Deletion must wait for capture",
      confirmation: "run_capture_pending",
    }),
    (error) => error?.code === "RUN_DELETE_CAPTURE_PENDING"
  );
  assert.deepEqual(fixture.cleanupCalls, []);
});
