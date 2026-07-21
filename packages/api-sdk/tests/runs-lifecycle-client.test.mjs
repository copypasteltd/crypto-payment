import assert from "node:assert/strict";
import test from "node:test";
import { createRunsApiClient } from "../dist/index.js";

const snapshot = {
  run: {
    runId: "run_lifecycle_sdk",
    workspaceId: "wsp_lifecycle_sdk",
    taskVersionId: "tsv_lifecycle_sdk",
    sessionVersionId: "sev_lifecycle_sdk",
    title: "Lifecycle SDK",
    targetPath: "/workspace/lifecycle-sdk",
    entrySurface: "dashboard",
    status: "CANCELLED",
    statusReason: "stopped",
    createdAt: "2026-07-21T08:00:00.000Z",
    updatedAt: "2026-07-21T08:01:00.000Z",
  },
  runtime: {},
  lifecycle: { runtimeStatus: "RELEASED" },
  messages: [],
  files: [],
  artifacts: [],
  approvals: [],
};

test("createRunsApiClient serializes lifecycle operations", async () => {
  const requests = [];
  const client = createRunsApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "access-token",
    fetcher: async (url, init = {}) => {
      requests.push({ url: String(url), method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null });
      if (init.method === "DELETE") {
        return new Response(JSON.stringify({
          runId: snapshot.run.runId,
          deletedAt: "2026-07-21T08:02:00.000Z",
          deletedUploads: 1,
          deletedDownloadTickets: 1,
          retainedSessionCaptures: 1,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (String(url).includes("/v1/runs?")) {
        return new Response(JSON.stringify([snapshot]), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify(snapshot), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  await client.listRuns({ recordStatus: "ARCHIVED" });
  await client.stopRun(snapshot.run.runId, "stop from SDK test");
  await client.archiveRun(snapshot.run.runId, "archive from SDK test");
  await client.restoreRun(snapshot.run.runId);
  await client.deleteRun(snapshot.run.runId, "delete from SDK test");

  assert.match(requests[0].url, /recordStatus=ARCHIVED/);
  assert.deepEqual(requests[1], {
    url: `https://api.example.test/v1/runs/${snapshot.run.runId}/stop`,
    method: "POST",
    body: { reason: "stop from SDK test", mode: "graceful" },
  });
  assert.equal(requests[2].url.endsWith("/archive"), true);
  assert.equal(requests[3].url.endsWith("/restore"), true);
  assert.deepEqual(requests[4].body, {
    reason: "delete from SDK test",
    confirmation: snapshot.run.runId,
  });
});
