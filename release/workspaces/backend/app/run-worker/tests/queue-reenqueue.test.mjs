import assert from "node:assert/strict";
import test from "node:test";
import { enqueueRunStartJob } from "../dist/index.js";

function createPayload(runId) {
  return {
    run: {
      runId,
      workspaceId: "wsp_queue_test",
      runPurpose: "creator_source",
      sessionBootstrapMode: "blank",
      sessionProjectId: "spj_queue_test",
      taskVersionId: null,
      sessionVersionId: null,
      draftRevisionId: null,
      requestedByUserId: "usr_queue_test",
      title: "Queue recovery",
      targetPath: "/tmp/queue-recovery",
      entrySurface: "dashboard",
      approvalMode: "manual",
      approvalModeUpdatedAt: null,
      approvalModeUpdatedByUserId: null,
      catalogMetadata: null,
      status: "RUNNING",
      statusReason: null,
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
    },
    initialPrompt: "Recover the interrupted run",
    deferInitialTurn: true,
    requestedInitialMessage: null,
    bindings: {
      firstPartyMcpIds: [],
      externalConnectorRefs: [],
      credentialIds: [],
    },
    credentialMounts: [],
    mcpBindings: [],
    mcpNetworkPolicies: [],
    provider: null,
  };
}

test("enqueueRunStartJob replaces a terminal job with the same run id", async () => {
  const calls = [];
  let removed = false;
  const queue = {
    async getJob() {
      return {
        async getState() {
          return "failed";
        },
        async remove() {
          removed = true;
        },
      };
    },
    async add(name, payload, options) {
      calls.push({ name, payload, options });
      return { id: options.jobId };
    },
    async close() {},
  };

  await enqueueRunStartJob(queue, createPayload("run_queue_retry"));

  assert.equal(removed, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.jobId, "run_queue_retry");
});

test("enqueueRunStartJob reuses an active job", async () => {
  let addCalls = 0;
  const existing = {
    async getState() {
      return "active";
    },
    async remove() {
      throw new Error("active job must not be removed");
    },
  };
  const queue = {
    async getJob() {
      return existing;
    },
    async add() {
      addCalls += 1;
    },
    async close() {},
  };

  const returned = await enqueueRunStartJob(queue, createPayload("run_queue_active"));

  assert.equal(returned, existing);
  assert.equal(addCalls, 0);
});
