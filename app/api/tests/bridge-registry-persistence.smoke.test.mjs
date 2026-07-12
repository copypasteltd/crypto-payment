import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

async function importBridgeRegistryModule() {
  return import(new URL("../dist/modules/bridge/registry.js", import.meta.url));
}

async function importBridgeRepositoryModule() {
  return import(new URL("../dist/modules/bridge/repository.js", import.meta.url));
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

test("bridge registry reloads persisted HTTP registrations and can dispatch after reload", async () => {
  const [{ InMemoryBridgeRegistry }, { FileBackedBridgeRegistrationRepository }] = await Promise.all([
    importBridgeRegistryModule(),
    importBridgeRepositoryModule(),
  ]);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-bridge-registry-"));
  const mock = await startMockControlServer();

  try {
    const repositoryA = new FileBackedBridgeRegistrationRepository(tempRoot);
    const registryA = new InMemoryBridgeRegistry({
      repository: repositoryA,
      now: () => "2026-07-09T05:00:00.500Z",
      staleAfterMs: 60_000,
    });

    await registryA.init({ forceReload: true });

    registryA.register({
      bridgeId: "brg_persisted_http",
      runId: "run_persisted_http",
      workspaceId: "wsp_persisted_http",
      targetPath: "/workspace/target",
      control: {
        baseUrl: mock.baseUrl,
        authToken: "persisted-control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T05:00:00.000Z",
      lastSeenAt: "2026-07-09T05:00:00.000Z",
    });
    await registryA.flushPersistence();

    const repositoryB = new FileBackedBridgeRegistrationRepository(tempRoot);
    const registryB = new InMemoryBridgeRegistry({
      repository: repositoryB,
      now: () => "2026-07-09T05:00:00.500Z",
      staleAfterMs: 60_000,
    });

    await registryB.init({ forceReload: true });
    const restored = registryB.get("run_persisted_http");
    assert.ok(restored);
    assert.equal(restored.bridgeId, "brg_persisted_http");
    assert.equal(restored.lastSeenAt, "2026-07-09T05:00:00.000Z");
    assert.equal(restored.controllerAttached, true);

    const result = await registryB.dispatch("run_persisted_http", {
      type: "ping",
    });

    assert.deepEqual(result, {
      ok: true,
      received: "ping",
    });
    assert.equal(mock.requests.length, 1);
    assert.equal(mock.requests[0].headers["x-lingban-control-token"], "persisted-control-token");

    registryB.unregister("run_persisted_http");
    await registryB.flushPersistence();

    const repositoryC = new FileBackedBridgeRegistrationRepository(tempRoot);
    const registryC = new InMemoryBridgeRegistry({
      repository: repositoryC,
      now: () => "2026-07-09T05:00:01.000Z",
      staleAfterMs: 60_000,
    });
    await registryC.init({ forceReload: true });
    assert.equal(registryC.get("run_persisted_http"), null);
  } finally {
    await new Promise((resolve, reject) => {
      mock.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});

test("bridge registry persists stale eviction triggered by lookup", async () => {
  const [{ InMemoryBridgeRegistry }, { FileBackedBridgeRegistrationRepository }] = await Promise.all([
    importBridgeRegistryModule(),
    importBridgeRepositoryModule(),
  ]);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-bridge-registry-stale-get-"));

  try {
    const repositoryA = new FileBackedBridgeRegistrationRepository(tempRoot);
    const registryA = new InMemoryBridgeRegistry({
      repository: repositoryA,
      now: () => "2026-07-09T05:10:00.000Z",
      staleAfterMs: 1_000,
    });

    await registryA.init({ forceReload: true });
    registryA.register({
      bridgeId: "brg_stale_lookup",
      runId: "run_stale_lookup",
      workspaceId: "wsp_stale_lookup",
      targetPath: "/workspace/stale-lookup",
      control: {
        baseUrl: "http://127.0.0.1:39996",
        authToken: "stale-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T05:09:58.000Z",
      lastSeenAt: "2026-07-09T05:09:58.000Z",
    });
    await registryA.flushPersistence();

    const repositoryB = new FileBackedBridgeRegistrationRepository(tempRoot);
    const registryB = new InMemoryBridgeRegistry({
      repository: repositoryB,
      now: () => "2026-07-09T05:10:01.500Z",
      staleAfterMs: 1_000,
    });
    await registryB.init({ forceReload: true });

    assert.equal(registryB.get("run_stale_lookup"), null);
    await registryB.flushPersistence();

    const repositoryC = new FileBackedBridgeRegistrationRepository(tempRoot);
    const registryC = new InMemoryBridgeRegistry({
      repository: repositoryC,
      now: () => "2026-07-09T05:10:01.500Z",
      staleAfterMs: 1_000,
    });
    await registryC.init({ forceReload: true });
    assert.equal(registryC.get("run_stale_lookup"), null);
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});

test("bridge registry background sweeper removes stale persisted registrations", async () => {
  const [{ InMemoryBridgeRegistry }, { FileBackedBridgeRegistrationRepository }] = await Promise.all([
    importBridgeRegistryModule(),
    importBridgeRepositoryModule(),
  ]);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-bridge-registry-sweeper-"));
  let now = "2026-07-09T05:20:00.000Z";

  try {
    const repositoryA = new FileBackedBridgeRegistrationRepository(tempRoot);
    const registryA = new InMemoryBridgeRegistry({
      repository: repositoryA,
      now: () => now,
      staleAfterMs: 1_000,
      sweepIntervalMs: 20,
    });

    await registryA.init({ forceReload: true });
    registryA.register({
      bridgeId: "brg_stale_sweeper",
      runId: "run_stale_sweeper",
      workspaceId: "wsp_stale_sweeper",
      targetPath: "/workspace/stale-sweeper",
      control: {
        baseUrl: "http://127.0.0.1:39995",
        authToken: "sweeper-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T05:20:00.000Z",
      lastSeenAt: "2026-07-09T05:20:00.000Z",
    });
    await registryA.flushPersistence();

    registryA.startSweeper();
    now = "2026-07-09T05:20:02.500Z";
    await new Promise((resolve) => setTimeout(resolve, 80));
    await registryA.stopSweeper();
    await registryA.flushPersistence();

    const repositoryB = new FileBackedBridgeRegistrationRepository(tempRoot);
    const registryB = new InMemoryBridgeRegistry({
      repository: repositoryB,
      now: () => now,
      staleAfterMs: 1_000,
    });
    await registryB.init({ forceReload: true });
    assert.equal(registryB.get("run_stale_sweeper"), null);
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
