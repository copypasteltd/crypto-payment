import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createFakePostgresPool } from "./support/fake-postgres-pool.mjs";

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate port"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
    server.once("error", reject);
  });
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();

  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText} ${text}`
  );

  return text ? JSON.parse(text) : null;
}

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-api-search-pg-"));
const envBackup = new Map();
const envKeys = [
  "API_HOST",
  "API_PORT",
  "DATABASE_URL",
  "LINGBAN_DATA_DIR",
  "LINGBAN_CATALOG_STORE",
  "LINGBAN_WORKSHOP_CATALOG_STORE",
  "LINGBAN_CREATOR_STORE",
  "LINGBAN_RUNS_STORE",
  "LINGBAN_RUN_EVENTS_STORE",
  "LINGBAN_AUTH_STORE",
  "LINGBAN_UPLOADS_STORE",
  "LINGBAN_RUN_FILES_STORE",
  "LINGBAN_FAVORITES_STORE",
  "LINGBAN_RECENT_STORE",
  "LINGBAN_SEARCH_STORE",
];

for (const key of envKeys) {
  envBackup.set(key, process.env[key]);
}

let app = null;

try {
  const port = await allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const fakePool = createFakePostgresPool();

  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT = String(port);
  process.env.DATABASE_URL = "postgres://fake/lingban";
  process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
  process.env.LINGBAN_CATALOG_STORE = "file";
  process.env.LINGBAN_WORKSHOP_CATALOG_STORE = "postgres";
  process.env.LINGBAN_CREATOR_STORE = "postgres";
  process.env.LINGBAN_RUNS_STORE = "postgres";
  process.env.LINGBAN_RUN_EVENTS_STORE = "postgres";
  process.env.LINGBAN_AUTH_STORE = "postgres";
  process.env.LINGBAN_UPLOADS_STORE = "postgres";
  process.env.LINGBAN_RUN_FILES_STORE = "postgres";
  process.env.LINGBAN_FAVORITES_STORE = "postgres";
  process.env.LINGBAN_RECENT_STORE = "postgres";
  process.env.LINGBAN_SEARCH_STORE = "postgres";

  const [
    { setApiDatabasePoolFactoryForTests, resetApiDatabaseForTests },
    { resetApiRuntimeConfigForTests },
    { startApiServer },
  ] = await Promise.all([
    import("../dist/app/database.js"),
    import("../dist/app/runtime.js"),
    import("../dist/index.js"),
  ]);

  setApiDatabasePoolFactoryForTests(() => fakePool);
  resetApiRuntimeConfigForTests();
  app = await startApiServer();

  const register = await requestJson(`${baseUrl}/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "smoke-postgres-search@example.com",
      password: "TestPassword123!",
      displayName: "Smoke Postgres Search",
      workspaceName: "Search Workspace",
    }),
  });

  const authHeaders = {
    authorization: `Bearer ${register.tokens.accessToken}`,
  };

  const workshops = await requestJson(
    `${baseUrl}/v1/workshops?workspaceContextKey=personal&entrySurface=h5`,
    {
      headers: authHeaders,
    }
  );
  assert.equal(Array.isArray(workshops), true);
  assert.equal(workshops.length > 0, true, "expected seeded workshop catalog");

  const targetWorkshop = workshops[0];
  const query = targetWorkshop.workshopId;
  const queryPrefix = query.slice(0, Math.min(4, query.length));

  const searchResults = await requestJson(
    `${baseUrl}/v1/search?q=${encodeURIComponent(query)}&limit=8&entrySurface=h5`,
    {
      headers: authHeaders,
    }
  );
  assert.equal(searchResults.totalCount > 0, true);

  const workshopResult = searchResults.items.find(
    (item) =>
      item.resourceType === "workshop" &&
      item.resourceId === targetWorkshop.workshopId
  );
  assert.ok(
    workshopResult,
    `expected workshop result for ${targetWorkshop.workshopId}`
  );

  const suggestionsBeforeClick = await requestJson(
    `${baseUrl}/v1/search/suggestions?q=${encodeURIComponent(queryPrefix)}&limit=6`,
    {
      headers: authHeaders,
    }
  );
  assert.ok(
    suggestionsBeforeClick.items.some((item) =>
      item.resourceTypes.includes("workshop")
    )
  );

  const clickedSearchResult = await requestJson(`${baseUrl}/v1/search/clicks`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      documentId: workshopResult.documentId,
      entrySurface: "h5",
    }),
  });
  assert.equal(clickedSearchResult.resourceType, "workshop");
  assert.equal(clickedSearchResult.resourceId, targetWorkshop.workshopId);
  assert.equal(clickedSearchResult.history.query, query);

  const searchHistory = await requestJson(
    `${baseUrl}/v1/search/history?limit=6&q=${encodeURIComponent(queryPrefix)}`,
    {
      headers: authHeaders,
    }
  );
  assert.equal(searchHistory.totalCount, 1);
  assert.equal(searchHistory.items[0].query, query);
  assert.ok(searchHistory.items[0].resourceTypes.includes("workshop"));

  const suggestionsAfterClick = await requestJson(
    `${baseUrl}/v1/search/suggestions?q=${encodeURIComponent(queryPrefix)}&limit=6`,
    {
      headers: authHeaders,
    }
  );
  assert.ok(
    suggestionsAfterClick.items.some((item) => item.text.en === query),
    `expected history suggestion ${query}`
  );

  process.stdout.write(
    `${JSON.stringify({
      storage: "postgres",
      workshopId: targetWorkshop.workshopId,
      documentId: workshopResult.documentId,
      historyQuery: searchHistory.items[0].query,
      suggestionCount: suggestionsAfterClick.items.length,
    })}\n`
  );

  await app.close().catch(() => undefined);
  app = null;
  await resetApiDatabaseForTests();
  resetApiRuntimeConfigForTests();
} finally {
  if (app) {
    await app.close().catch(() => undefined);
  }

  try {
    const [{ resetApiDatabaseForTests }, { resetApiRuntimeConfigForTests }] = await Promise.all([
      import("../dist/app/database.js"),
      import("../dist/app/runtime.js"),
    ]);
    await resetApiDatabaseForTests();
    resetApiRuntimeConfigForTests();
  } catch {
    // Ignore cleanup failures in smoke scenarios.
  }

  for (const [key, value] of envBackup) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
}
