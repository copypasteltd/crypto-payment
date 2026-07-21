import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Failed to allocate port"));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
    server.once("error", reject);
  });
}

async function requestJson(url, init = {}, expectedStatus = 200) {
  const response = await fetch(url, init);
  const text = await response.text();
  assert.equal(response.status, expectedStatus, `${init.method ?? "GET"} ${url}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

test("run lifecycle HTTP API closes, archives, restores, and deletes a persisted run", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lingban-run-lifecycle-http-"));
  const keys = ["API_HOST", "API_PORT", "LINGBAN_DATA_DIR", "LINGBAN_AUTH_MODE", "LINGBAN_RUNTIME_DISPATCH_MODE", "LINGBAN_RUNTIME_LAUNCH_MODE", "LINGBAN_RUNS_ROOT"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  let app = null;
  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(root, "data");
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_RUNS_ROOT = path.join(root, "runs");

    const [{ startApiServer }, contracts, db, { runsRepository }] = await Promise.all([
      import("../dist/index.js"),
      import("../../../packages/contracts/dist/index.js"),
      import("../../../packages/db/dist/index.js"),
      import("../dist/modules/runs/repository.js"),
    ]);
    app = await startApiServer();
    const at = "2026-07-21T09:00:00.000Z";
    const input = contracts.createRunInputSchema.parse({
      workspaceId: "wsp_lifecycle_http",
      taskVersionId: "tsv_lifecycle_http",
      sessionVersionId: "sev_lifecycle_http",
      title: "Lifecycle HTTP",
      targetPath: path.join(root, "runs", "run_lifecycle_http", "target"),
      entrySurface: "h5",
      bindings: { firstPartyMcpIds: [], externalConnectorRefs: [], credentialIds: [] },
    });
    const run = contracts.runRecordSchema.parse({
      runId: "run_lifecycle_http",
      workspaceId: input.workspaceId,
      taskVersionId: input.taskVersionId,
      sessionVersionId: input.sessionVersionId,
      title: input.title,
      targetPath: input.targetPath,
      entrySurface: input.entrySurface,
      status: "RUNNING",
      statusReason: null,
      createdAt: at,
      updatedAt: at,
    });
    await runsRepository.save(db.runAggregateSchema.parse({
      run,
      lifecycle: { runtimeStatus: "ACTIVE" },
      input,
      startJob: { run, initialPrompt: "Lifecycle HTTP smoke", requestedInitialMessage: null, bindings: input.bindings },
      messages: [],
      files: [],
      artifacts: [],
      approvals: [],
    }));

    const stopped = await requestJson(`${baseUrl}/v1/runs/${run.runId}/stop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "HTTP lifecycle stop" }),
    });
    assert.equal(stopped.run.status, "CANCELLED");
    assert.equal(stopped.lifecycle.runtimeStatus, "RELEASED");

    await requestJson(`${baseUrl}/v1/runs/${run.runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "blocked", attachments: [], slotValues: [] }),
    }, 409);

    const archived = await requestJson(`${baseUrl}/v1/runs/${run.runId}/archive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "HTTP lifecycle archive" }),
    });
    assert.equal(archived.lifecycle.recordStatus, "ARCHIVED");
    assert.equal((await requestJson(`${baseUrl}/v1/runs`)).length, 0);
    assert.equal((await requestJson(`${baseUrl}/v1/runs?recordStatus=ARCHIVED`)).length, 1);

    const restored = await requestJson(`${baseUrl}/v1/runs/${run.runId}/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(restored.lifecycle.recordStatus, "ACTIVE");

    const deleted = await requestJson(`${baseUrl}/v1/runs/${run.runId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "HTTP lifecycle permanent deletion",
        confirmation: run.runId,
      }),
    });
    assert.equal(deleted.runId, run.runId);
    const repeatedDelete = await requestJson(`${baseUrl}/v1/runs/${run.runId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "HTTP lifecycle idempotent deletion",
        confirmation: run.runId,
      }),
    });
    assert.equal(repeatedDelete.deletedAt, deleted.deletedAt);
    await requestJson(`${baseUrl}/v1/runs/${run.runId}`, {}, 410);
  } finally {
    if (app) await app.close();
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
