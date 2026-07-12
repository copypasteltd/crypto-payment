import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

async function importSessionPackMaterializerModule() {
  return import(new URL("../dist/services/session-pack-materializer.js", import.meta.url));
}

async function importSessionPackModule() {
  return import("@lingban/session-pack");
}

test("materializeRunSessionPack downloads, validates, and writes canonical bundle files", async () => {
  const { materializeRunSessionPack } = await importSessionPackMaterializerModule();
  const {
    createWorkspaceBaseArchiveFromDirectory,
    packSessionVersion,
    serializeSessionPackBundle,
  } = await importSessionPackModule();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lingban-run-session-pack-"));
  const preparedWorkspace = {
    runId: "run_session_pack_materialize",
    workspaceId: "wsp_session_pack_materialize",
    hostPaths: {
      runRootPath: path.join(root, "run"),
      targetPath: path.join(root, "run", "target"),
      inputsPath: path.join(root, "run", "inputs"),
      outputsPath: path.join(root, "run", "outputs"),
      statePath: path.join(root, "run", "state"),
      runtimePath: path.join(root, "run", "runtime"),
      codexHomePath: path.join(root, "run", "codex-home"),
      homePath: path.join(root, "run", "home"),
      tmpPath: path.join(root, "run", "tmp"),
      browserProfilePath: path.join(root, "run", "browser-profile"),
      mcpPath: path.join(root, "run", "mcp"),
      secretsPath: path.join(root, "run", "secrets"),
      logsPath: path.join(root, "run", "logs"),
    },
    containerPaths: {
      workspaceRoot: "/workspace",
      targetPath: "/workspace/target",
      inputsPath: "/workspace/inputs",
      outputsPath: "/workspace/outputs",
      statePath: "/workspace/state",
      runtimePath: "/workspace/runtime",
      codexHomePath: "/workspace/codex-home",
      homePath: "/workspace/home",
      tmpPath: "/workspace/tmp",
      browserProfilePath: "/workspace/browser-profile",
      mcpPath: "/workspace/mcp",
      secretsPath: "/workspace/secrets",
      logsPath: "/workspace/logs",
    },
  };

  try {
    await Promise.all(
      Object.values(preparedWorkspace.hostPaths).map((value) =>
        fs.mkdir(value, { recursive: true })
      )
    );
    const workspaceBaseSource = path.join(root, "workspace-base-source");
    await fs.mkdir(path.join(workspaceBaseSource, "archive"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceBaseSource, "archive", "receipt.txt"),
      "workspace base receipt\n",
      "utf8"
    );
    await fs.writeFile(path.join(workspaceBaseSource, "notes.md"), "# seeded\n", "utf8");
    const workspaceBaseArchive = await createWorkspaceBaseArchiveFromDirectory(
      workspaceBaseSource,
      {
        metadata: {
          fixture: true,
        },
      }
    );

    const bundle = packSessionVersion({
      manifest: {
        session_id: "ses_materialize_20260710",
        session_version: "sev_materialize_2026_07_10",
        task_family: "tsv_materialize_2026_07_10",
        runtime_profile: {
          profile_id: "materialize-profile",
        },
        slot_schema_version: "materialize.v1",
        required_capabilities: {
          browser: false,
          filesystem: true,
          downloads: true,
          mcps: [],
          credentials: [],
        },
        artifact_contract: {
          outputs: [{ name: "output", kind: "directory", path_pattern: "output/**" }],
        },
        created_by: {
          user_id: "usr_materializer",
          display_name: "Materializer Test",
        },
        created_at: "2026-07-10T12:00:00.000Z",
      },
      files: {
        "conversation.jsonl": `${JSON.stringify({
          role: "system",
          kind: "prompt",
          text: "Collect missing information.",
        })}\n`,
        "workspace-base.tar.zst": workspaceBaseArchive,
        "slot-schema.json": JSON.stringify({
          version: "materialize.v1",
          slots: [
            {
              key: "company_name",
              title: "Company name",
              type: "string",
              required: false,
              prompt: "Provide the company name.",
            },
          ],
        }),
        "mcp-requirements.json": JSON.stringify({
          connectors: [],
          credentials: [],
        }),
        "runtime-profile.json": JSON.stringify({
          profile_id: "materialize-profile",
          browser_required: false,
          playwright_required: false,
        }),
      },
    });
    const archive = serializeSessionPackBundle(bundle);

    const materialized = await materializeRunSessionPack({
      runId: "run_session_pack_materialize",
      preparedWorkspace,
      apiConnector: {
        async downloadRunSessionPackArchive(runId) {
          assert.equal(runId, "run_session_pack_materialize");
          return {
            content: archive,
            fileName: "sev_materialize_2026_07_10.session-pack.json.gz",
            source: "imported",
            contentType: "application/gzip",
          };
        },
      },
    });

    assert.equal(materialized.sessionVersionId, "sev_materialize_2026_07_10");
    assert.equal(materialized.source, "imported");
    assert.equal(materialized.archiveFileName, "sev_materialize_2026_07_10.session-pack.json.gz");
    assert.equal(materialized.containerPaths.unpackedPath, "/workspace/runtime/session-pack/unpacked");

    const archiveBytes = await fs.readFile(materialized.hostPaths.archivePath);
    assert.equal(Buffer.compare(archiveBytes, Buffer.from(archive)), 0);

    const manifestText = await fs.readFile(materialized.hostPaths.manifestPath, "utf8");
    assert.equal(manifestText.includes("\"session_version\": \"sev_materialize_2026_07_10\""), true);

    const workspaceBaseBytes = await fs.readFile(materialized.hostPaths.workspaceBasePath);
    assert.equal(workspaceBaseBytes.byteLength > 0, true);
    assert.equal(
      await fs.readFile(
        path.join(preparedWorkspace.hostPaths.targetPath, "archive", "receipt.txt"),
        "utf8"
      ),
      "workspace base receipt\n"
    );
    assert.equal(
      await fs.readFile(path.join(preparedWorkspace.hostPaths.targetPath, "notes.md"), "utf8"),
      "# seeded\n"
    );

    const metadata = JSON.parse(
      await fs.readFile(materialized.hostPaths.metadataPath, "utf8")
    );
    assert.equal(metadata.sessionVersionId, "sev_materialize_2026_07_10");
    assert.equal(metadata.entries.includes("conversation.jsonl"), true);
    assert.equal(metadata.entries.includes("manifest.json"), true);
    assert.equal(metadata.workspaceBaseRestore.restoredFilesCount, 2);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
