import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

async function importBridgeRegistry() {
  return import(new URL("../dist/modules/bridge/registry.js", import.meta.url));
}

async function startMockControlServer() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/control") {
      response.writeHead(404).end();
      return;
    }

    const chunks = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    requests.push({
      headers: request.headers,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });

    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({ ok: true, received: requests.at(-1)?.body?.type ?? null }));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind mock control server");
  }

  return {
    server,
    requests,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

test("bridge registry can dispatch commands through registered HTTP control metadata", async () => {
  const { bridgeRegistry } = await importBridgeRegistry();
  const mock = await startMockControlServer();

  try {
    const connection = bridgeRegistry.register({
      bridgeId: "brg_http_control",
      runId: "run_http_control",
      workspaceId: "wsp_http_control",
      targetPath: "/workspace/target",
      control: {
        baseUrl: mock.baseUrl,
        authToken: "registry-control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
    await bridgeRegistry.flushPersistence();

    assert.equal(connection.controllerAttached, true);

    const result = await bridgeRegistry.dispatch("run_http_control", {
      type: "ping",
    });

    assert.deepEqual(result, {
      ok: true,
      received: "ping",
    });
    assert.equal(mock.requests.length, 1);
    assert.equal(mock.requests[0].body.type, "ping");
    assert.equal(mock.requests[0].headers["x-lingban-control-token"], "registry-control-token");
  } finally {
    bridgeRegistry.unregister("run_http_control");
    await bridgeRegistry.flushPersistence();
    await new Promise((resolve, reject) => {
      mock.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("bridge registry flushes queued commands when HTTP registration arrives", async () => {
  const { InMemoryBridgeRegistry } = await importBridgeRegistry();
  const registry = new InMemoryBridgeRegistry();
  const mock = await startMockControlServer();

  try {
    const queued = await registry.dispatch("run_http_late_register", {
      type: "ping",
    });

    assert.deepEqual(queued, {
      ok: true,
      queued: true,
      command: "ping",
    });

    registry.register({
      bridgeId: "brg_http_late_register",
      runId: "run_http_late_register",
      workspaceId: "wsp_http_late_register",
      targetPath: "/workspace/target",
      control: {
        baseUrl: mock.baseUrl,
        authToken: "registry-control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
    await registry.flushPersistence();

    const startedAt = Date.now();
    while (mock.requests.length === 0 && Date.now() - startedAt < 2_000) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assert.equal(mock.requests.length, 1);
    assert.equal(mock.requests[0].body.type, "ping");
  } finally {
    registry.unregister("run_http_late_register");
    await registry.flushPersistence();
    await new Promise((resolve, reject) => {
      mock.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("bridge registry evicts stale registrations based on lastSeenAt heartbeat", async () => {
  const { InMemoryBridgeRegistry } = await importBridgeRegistry();
  let now = "2026-07-09T04:00:00.000Z";
  const registry = new InMemoryBridgeRegistry({
    now: () => now,
    staleAfterMs: 1_000,
  });

  registry.register({
    bridgeId: "brg_http_stale",
    runId: "run_http_stale",
    workspaceId: "wsp_http_stale",
    targetPath: "/workspace/target",
    control: {
      baseUrl: "http://127.0.0.1:39997",
      authToken: "registry-control-token",
    },
    supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
    connectedAt: "2026-07-09T03:59:00.000Z",
    lastSeenAt: "2026-07-09T04:00:00.000Z",
  });

  const fresh = registry.get("run_http_stale");
  assert.ok(fresh);
  assert.equal(fresh.lastSeenAt, "2026-07-09T04:00:00.000Z");
  assert.equal(fresh.controllerAttached, true);

  now = "2026-07-09T04:00:02.500Z";

  const stale = registry.get("run_http_stale");
  assert.equal(stale, null);

  const queued = await registry.dispatch("run_http_stale", {
    type: "ping",
  });
  assert.deepEqual(queued, {
    ok: true,
    queued: true,
    command: "ping",
  });
});

test("bridge registry diagnostics summarize pending commands and sweep state", async () => {
  const { InMemoryBridgeRegistry } = await importBridgeRegistry();
  let now = "2026-07-09T04:10:00.000Z";
  const registry = new InMemoryBridgeRegistry({
    now: () => now,
    staleAfterMs: 1_000,
    sweepIntervalMs: 20,
  });
  const mock = await startMockControlServer();

  try {
    const queued = await registry.dispatch("run_http_diag_pending", {
      type: "ping",
    });
    assert.deepEqual(queued, {
      ok: true,
      queued: true,
      command: "ping",
    });

    registry.register({
      bridgeId: "brg_http_diag",
      runId: "run_http_diag",
      workspaceId: "wsp_http_diag",
      targetPath: "/workspace/target",
      control: {
        baseUrl: mock.baseUrl,
        authToken: "registry-control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T04:10:00.000Z",
      lastSeenAt: "2026-07-09T04:10:00.000Z",
    });
    await registry.flushPersistence();

    const initial = registry.getDiagnostics();
    assert.equal(initial.registeredConnectionsCount, 1);
    assert.equal(initial.controllerAttachedCount, 1);
    assert.equal(initial.pendingRunsCount, 1);
    assert.equal(initial.pendingCommandsCount, 1);
    assert.equal(initial.metrics.registrationsTotal, 1);
    assert.equal(initial.metrics.queuedCommandsTotal, 1);
    assert.equal(initial.metrics.forwardedCommandsTotal, 0);
    assert.equal(initial.sweeperActive, false);

    now = "2026-07-09T04:10:02.500Z";
    registry.startSweeper();
    await new Promise((resolve) => setTimeout(resolve, 80));
    await registry.stopSweeper();
    await registry.flushPersistence();

    const afterSweep = registry.getDiagnostics();
    assert.equal(afterSweep.sweeperActive, false);
    assert.equal(afterSweep.registeredConnectionsCount, 0);
    assert.equal(afterSweep.metrics.staleEvictionsTotal, 1);
    assert.equal(afterSweep.metrics.sweepRunsTotal >= 1, true);
    assert.equal(afterSweep.metrics.sweepEvictionsTotal >= 1, true);
    assert.equal(afterSweep.lastSweep.finishedAt !== null, true);
    assert.equal(afterSweep.lastSweep.error, null);
  } finally {
    registry.unregister("run_http_diag");
    registry.unregister("run_http_diag_pending");
    await registry.flushPersistence();
    await new Promise((resolve, reject) => {
      mock.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
