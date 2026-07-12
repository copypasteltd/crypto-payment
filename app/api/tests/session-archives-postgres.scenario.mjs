import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
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

const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-session-archives-pg-"));
const envBackup = new Map();
const envKeys = [
  "API_HOST",
  "API_PORT",
  "DATABASE_URL",
  "LINGBAN_DATA_DIR",
  "LINGBAN_AUTH_MODE",
  "LINGBAN_SESSION_ARCHIVES_STORE",
  "LINGBAN_RUNS_DIR",
  "LINGBAN_RUNTIME_LAUNCH_MODE",
  "LINGBAN_API_BASE_URL",
  "LINGBAN_INTERNAL_AUTH_TOKEN",
  "LINGBAN_OBJECT_STORAGE_ROOT",
  "CODEX_BIN",
];

for (const key of envKeys) {
  envBackup.set(key, process.env[key]);
}

let app = null;

try {
  const port = await allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const storageRoot = path.join(smokeRoot, "api-data");
  const objectStorageRoot = path.join(smokeRoot, "objects");
  const fakePool = createFakePostgresPool();

  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT = String(port);
  process.env.DATABASE_URL = "postgres://fake/lingban";
  process.env.LINGBAN_DATA_DIR = storageRoot;
  process.env.LINGBAN_AUTH_MODE = "disabled";
  process.env.LINGBAN_SESSION_ARCHIVES_STORE = "postgres";
  process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
  process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
  process.env.LINGBAN_API_BASE_URL = baseUrl;
  process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
  process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
  process.env.CODEX_BIN = process.execPath;

  const [
    {
      setApiDatabasePoolFactoryForTests,
      resetApiDatabaseForTests,
    },
    { resetApiRuntimeConfigForTests },
    { buildSessionArchiveRepository },
    { startApiServer },
    {
      packSessionVersion,
      serializeSessionPackBundle,
    },
  ] = await Promise.all([
    import("../dist/app/database.js"),
    import("../dist/app/runtime.js"),
    import("../dist/modules/sessions/repository.js"),
    import("../dist/index.js"),
    import("../../../packages/session-pack/dist/index.js"),
  ]);

  setApiDatabasePoolFactoryForTests(() => fakePool);
  resetApiRuntimeConfigForTests();
  app = await startApiServer();

  const importedBundle = packSessionVersion({
    manifest: {
      session_id: "ses_imported_pack_pg_smoke",
      session_version: "sev_imported_pack_pg_smoke",
      task_family: "tsv_imported_pack_pg_smoke",
      runtime_profile: {
        profile_id: "postgres-import-profile",
        runner_image: "lingban/runner:2026.07",
        browser_required: false,
        playwright_required: false,
      },
      slot_schema_version: "imported.v1",
      required_capabilities: {
        browser: false,
        filesystem: true,
        downloads: false,
        mcps: [],
        credentials: [],
      },
      artifact_contract: {
        outputs: [{ name: "output", kind: "directory", path_pattern: "output/**" }],
      },
      created_by: {
        user_id: "usr_import_owner",
        display_name: "Import Owner",
      },
      created_at: "2026-07-11T00:00:00.000Z",
      metadata: {
        imported_fixture: true,
      },
    },
    files: {
      "conversation.jsonl": `${JSON.stringify({
        role: "system",
        kind: "prompt",
        text: "Ask for missing inputs before starting.",
      })}\n`,
      "workspace-base.tar.zst": JSON.stringify({
        fixture: true,
        note: "postgres metadata smoke",
      }),
      "slot-schema.json": JSON.stringify(
        {
          version: "imported.v1",
          slots: [
            {
              key: "company_name",
              title: "Company name",
              type: "string",
              required: true,
              prompt: "Please provide the company legal name.",
            },
          ],
        },
        null,
        2
      ),
      "mcp-requirements.json": JSON.stringify(
        {
          connectors: [],
          credentials: [],
        },
        null,
        2
      ),
      "runtime-profile.json": JSON.stringify(
        {
          profile_id: "postgres-import-profile",
          runner_image: "lingban/runner:2026.07",
          browser_required: false,
          playwright_required: false,
        },
        null,
        2
      ),
      "redaction-map.json": JSON.stringify(
        {
          version: "imported.v1",
          rules: [],
        },
        null,
        2
      ),
    },
  });

  const importedArchive = serializeSessionPackBundle(importedBundle);

  const imported = await requestJson(`${baseUrl}/v1/sessions/import?workspaceContextKey=brand-lab`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
    },
    body: Buffer.from(importedArchive),
  });

  assert.equal(imported.sessionPack.sessionVersionId, "sev_imported_pack_pg_smoke");

  await app.close().catch(() => undefined);
  app = null;

  resetApiRuntimeConfigForTests();
  const freshRepository = buildSessionArchiveRepository();
  await freshRepository.init();

  const persistedRecord = freshRepository.getImportedArchiveBySessionVersionId(
    "sev_imported_pack_pg_smoke"
  );
  const persistedBytes = await freshRepository.readImportedArchiveBytes(
    "sev_imported_pack_pg_smoke"
  );
  const stateFilePath = path.join(storageRoot, "sessions", "session-archives-state.json");
  const stateFileExists = await stat(stateFilePath)
    .then(() => true)
    .catch(() => false);

  assert.ok(persistedRecord);
  assert.ok(persistedBytes);
  assert.equal(persistedRecord.archiveSource, "imported");
  assert.equal(persistedRecord.sessionVersionId, "sev_imported_pack_pg_smoke");
  assert.equal(stateFileExists, false);
  assert.equal(
    Buffer.compare(Buffer.from(persistedBytes), Buffer.from(importedArchive)),
    0
  );

  const objectArchivePath = path.join(
    objectStorageRoot,
    "session-archives",
    "sev_imported_pack_pg_smoke.session-pack.json.gz"
  );
  assert.equal(
    Buffer.compare(
      Buffer.from(await readFile(objectArchivePath)),
      Buffer.from(importedArchive)
    ),
    0
  );

  process.stdout.write(
    `${JSON.stringify({
      storage: "postgres",
      sessionArchivesStore: "postgres",
      importedCount: freshRepository.listImportedArchives().length,
      sessionVersionId: persistedRecord.sessionVersionId,
      archiveSource: persistedRecord.archiveSource,
      stateFileExists,
    })}\n`
  );

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
