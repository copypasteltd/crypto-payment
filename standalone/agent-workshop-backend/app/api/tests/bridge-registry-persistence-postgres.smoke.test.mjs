import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

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

test("bridge registry persists and reloads HTTP registrations through postgres-backed storage", async () => {
  const envBackup = new Map();
  const envKeys = ["DATABASE_URL", "LINGBAN_BRIDGE_REGISTRY_STORE"];
  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  const mock = await startMockControlServer();

  try {
    process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/lingban_workshop";
    process.env.LINGBAN_BRIDGE_REGISTRY_STORE = "postgres";

    const [
      { InMemoryBridgeRegistry },
      { PostgresBridgeRegistrationRepository },
      { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests },
      { resetApiRuntimeConfigForTests },
      { createFakePostgresPool },
    ] = await Promise.all([
      import("../dist/modules/bridge/registry.js"),
      import("../dist/modules/bridge/repository.js"),
      import("../dist/app/database.js"),
      import("../dist/app/runtime.js"),
      import("./support/fake-postgres-pool.mjs"),
    ]);

    resetApiRuntimeConfigForTests();
    setApiDatabasePoolFactoryForTests(() => createFakePostgresPool());

    const repositoryA = new PostgresBridgeRegistrationRepository();
    const registryA = new InMemoryBridgeRegistry({
      repository: repositoryA,
      now: () => "2026-07-09T05:10:00.500Z",
      staleAfterMs: 60_000,
    });
    await registryA.init({ forceReload: true });

    registryA.register({
      bridgeId: "brg_postgres_http",
      runId: "run_postgres_http",
      workspaceId: "wsp_postgres_http",
      targetPath: "/workspace/target",
      control: {
        baseUrl: mock.baseUrl,
        authToken: "postgres-control-token",
      },
      supportedCommands: ["sendMessage", "approve", "cancel", "ping", "syncFiles", "flushArtifacts"],
      connectedAt: "2026-07-09T05:10:00.000Z",
      lastSeenAt: "2026-07-09T05:10:00.000Z",
    });
    await registryA.flushPersistence();

    const repositoryB = new PostgresBridgeRegistrationRepository();
    const registryB = new InMemoryBridgeRegistry({
      repository: repositoryB,
      now: () => "2026-07-09T05:10:00.500Z",
      staleAfterMs: 60_000,
    });
    await registryB.init({ forceReload: true });

    const restored = registryB.get("run_postgres_http");
    assert.ok(restored);
    assert.equal(restored.bridgeId, "brg_postgres_http");
    assert.equal(restored.controllerAttached, true);

    const result = await registryB.dispatch("run_postgres_http", {
      type: "ping",
    });
    assert.deepEqual(result, {
      ok: true,
      received: "ping",
    });
    assert.equal(mock.requests.length, 1);
    assert.equal(mock.requests[0].headers["x-lingban-control-token"], "postgres-control-token");

    registryB.unregister("run_postgres_http");
    await registryB.flushPersistence();

    const repositoryC = new PostgresBridgeRegistrationRepository();
    const registryC = new InMemoryBridgeRegistry({
      repository: repositoryC,
      now: () => "2026-07-09T05:10:01.000Z",
      staleAfterMs: 60_000,
    });
    await registryC.init({ forceReload: true });
    assert.equal(registryC.get("run_postgres_http"), null);

  } finally {
    try {
      const [{ resetApiDatabaseForTests }, { resetApiRuntimeConfigForTests }] = await Promise.all([
        import("../dist/app/database.js"),
        import("../dist/app/runtime.js"),
      ]);
      await resetApiDatabaseForTests();
      resetApiRuntimeConfigForTests();
    } catch {
      // ignore cleanup failures
    }

    for (const [key, value] of envBackup) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

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
