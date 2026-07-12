import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applySessionPackRedaction,
  createEmptyWorkspaceBaseArchive,
  createWorkspaceBaseArchiveFromDirectory,
  deserializeSessionPackBundle,
  deserializeWorkspaceBaseArchive,
  packSessionVersion,
  readSessionPackBundleFromDirectory,
  readSessionPackBundleArchive,
  signSessionPackBundle,
  restoreWorkspaceBaseArchiveToDirectory,
  serializeSessionPackBundle,
  sessionPackManifestFileName,
  validateSessionPackBundle,
  validateSessionPackDirectory,
  verifySessionPackManifestSignature,
  writeSessionPackBundleArchive,
  writeSessionPackBundleToDirectory,
} from "../dist/index.js";

function createBaseManifest() {
  return {
    session_id: "chrome-tax-filer",
    session_version: "2026.07.10",
    task_family: "tax-filing",
    runtime_profile: {
      profile_id: "default-runner",
      runner_image: "lingban/runner:local",
      node_version: "22",
      python_version: "3.12",
      browser_required: true,
      playwright_required: true,
    },
    slot_schema_version: "1.0.0",
    required_capabilities: {
      browser: true,
      filesystem: true,
      downloads: true,
      mcps: [{ id: "chrome", protocol: "platform-managed", required: true }],
      credentials: [{ id: "tax-portal", placement: "browser-state", required: true }],
    },
    artifact_contract: {
      outputs: [{ name: "filing-receipt", kind: "receipt", required: true, path_pattern: "outputs/**/*.pdf" }],
    },
    created_by: {
      user_id: "creator-001",
      display_name: "Lingban Creator",
    },
    created_at: "2026-07-10T11:30:00.000Z",
    source: {
      workspace_id: "workspace-main",
      creator_package_id: "chrome-tax-runner",
    },
  };
}

function createBaseFiles() {
  return {
    "conversation.jsonl": '{"role":"system","content":"start"}\n',
    "workspace-base.tar.zst": createEmptyWorkspaceBaseArchive({
      fixture: true,
    }),
    "slot-schema.json": JSON.stringify({
      version: "1.0.0",
      slots: [{ key: "tax_year", title: "Tax year", type: "string", required: true }],
    }),
    "mcp-requirements.json": JSON.stringify({
      connectors: [{ id: "chrome", required: true }],
    }),
    "runtime-profile.json": JSON.stringify({
      profile_id: "default-runner",
      browser_required: true,
    }),
  };
}

function writeBundleToDirectory(bundle) {
  const packDir = mkdtempSync(path.join(tmpdir(), "lingban-session-pack-"));
  for (const [entryPath, content] of Object.entries(bundle.files)) {
    const absolutePath = path.join(packDir, entryPath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  return packDir;
}

test("packSessionVersion builds a valid canonical session pack bundle", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
  });

  assert.ok(bundle.files[sessionPackManifestFileName], "manifest.json should be emitted");
  assert.ok(bundle.manifest.files["conversation.jsonl"], "manifest should index canonical files");

  const validation = validateSessionPackBundle(bundle);
  assert.equal(validation.ok, true);
  assert.equal(validation.issues.length, 0);
});

test("packSessionVersion can sign manifests with sha256 and verify them without external keys", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
    signature: {
      algorithm: "sha256",
    },
  });

  assert.equal(bundle.manifest.signature?.algorithm, "sha256");
  assert.equal(
    verifySessionPackManifestSignature(bundle.manifest, {
      requireSignature: true,
    }).ok,
    true
  );
});

test("hmac-signed manifests fail verification after manifest mutation", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
    signature: {
      algorithm: "hmac-sha256",
      secret: "session-pack-smoke-secret",
      keyId: "smoke-key",
    },
  });

  assert.equal(
    verifySessionPackManifestSignature(bundle.manifest, {
      requireSignature: true,
      hmacSecretsByKeyId: {
        "smoke-key": "session-pack-smoke-secret",
      },
    }).ok,
    true
  );

  const tamperedManifest = {
    ...bundle.manifest,
    metadata: {
      ...(bundle.manifest.metadata ?? {}),
      tampered: true,
    },
  };

  const result = verifySessionPackManifestSignature(tamperedManifest, {
    requireSignature: true,
    hmacSecretsByKeyId: {
      "smoke-key": "session-pack-smoke-secret",
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /hmac-sha256/i);
});

test("signSessionPackBundle supports Ed25519 signing and verification", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
  });

  const signedBundle = signSessionPackBundle(bundle, {
    algorithm: "ed25519",
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    keyId: "ed25519-smoke",
  });

  const result = verifySessionPackManifestSignature(signedBundle.manifest, {
    requireSignature: true,
    ed25519PublicKeysByKeyId: {
      "ed25519-smoke": publicKey.export({ format: "pem", type: "spki" }).toString(),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(signedBundle.manifest.signature?.algorithm, "ed25519");
});

test("packSessionVersion rejects bundles that do not include a runtime file", () => {
  const files = createBaseFiles();
  delete files["runtime-profile.json"];

  assert.throws(
    () =>
      packSessionVersion({
        manifest: createBaseManifest(),
        files,
      }),
    /RUNTIME_FILE_MISSING/
  );
});

test("applySessionPackRedaction masks text matches and annotates manifest metadata", () => {
  const bundle = packSessionVersion({
    manifest: {
      ...createBaseManifest(),
      metadata: {
        export_secret: "SECRET-7788",
      },
    },
    files: {
      ...createBaseFiles(),
      "conversation.jsonl":
        '{"role":"system","content":"Use SECRET-7788 for the export walkthrough."}\n',
      "redaction-map.json": JSON.stringify(
        {
          version: "1.0.0",
          rules: [
            {
              rule_id: "mask-export-secret",
              target: {
                kind: "text",
                selector: "SECRET-7788",
              },
              strategy: "mask",
            },
          ],
        },
        null,
        2
      ),
    },
  });

  const redacted = applySessionPackRedaction(bundle, {
    metadata: {
      redaction_export: true,
    },
  });
  const conversation = Buffer.from(redacted.bundle.files["conversation.jsonl"]).toString("utf8");

  assert.equal(conversation.includes("SECRET-7788"), false);
  assert.equal(conversation.includes("***********"), true);
  assert.equal(redacted.bundle.manifest.metadata?.redaction_export, true);
  assert.equal(redacted.bundle.manifest.metadata?.redaction_applied, true);
  assert.equal(redacted.bundle.manifest.metadata?.redaction_rule_count, 1);
  assert.equal(redacted.report.totalMatches, 2);
  assert.deepEqual(redacted.report.mutatedEntries.sort(), ["conversation.jsonl", "manifest.json"]);
});

test("applySessionPackRedaction can rewrite JSON-path values and remove targeted files", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: {
      ...createBaseFiles(),
      "runtime-config.json": JSON.stringify(
        {
          profile_id: "default-runner",
          env: {
            TAX_SECRET: "live-tax-secret",
          },
        },
        null,
        2
      ),
      "notes.txt": "keep this local scratch note\n",
      "redaction-map.json": JSON.stringify(
        {
          version: "1.0.0",
          rules: [
            {
              rule_id: "replace-tax-secret",
              target: {
                kind: "json-path",
                selector: "runtime-config.json#$.env.TAX_SECRET",
              },
              strategy: "replace",
              replacement: "[REDACTED]",
            },
            {
              rule_id: "remove-scratch-note",
              target: {
                kind: "file-path",
                selector: "notes.txt",
              },
              strategy: "remove",
            },
          ],
        },
        null,
        2
      ),
    },
  });

  const redacted = applySessionPackRedaction(bundle);
  const runtimeConfig = JSON.parse(
    Buffer.from(redacted.bundle.files["runtime-config.json"]).toString("utf8")
  );

  assert.equal(runtimeConfig.env.TAX_SECRET, "[REDACTED]");
  assert.equal(Object.prototype.hasOwnProperty.call(redacted.bundle.files, "notes.txt"), false);
  assert.equal(redacted.report.rules[0]?.matches, 1);
  assert.equal(redacted.report.rules[1]?.matches, 1);
});

test("validateSessionPackDirectory detects tampered file contents", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
  });
  const packDir = writeBundleToDirectory(bundle);

  writeFileSync(path.join(packDir, "conversation.jsonl"), '{"role":"system","content":"mutated"}\n');

  const validation = validateSessionPackDirectory(packDir);
  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue) => issue.code === "FILE_HASH_MISMATCH"));
});

test("writeSessionPackBundleToDirectory and readSessionPackBundleFromDirectory round-trip canonical bundles", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
  });
  const packDir = mkdtempSync(path.join(tmpdir(), "lingban-session-pack-roundtrip-"));

  const writtenEntries = writeSessionPackBundleToDirectory(bundle, packDir);
  assert.ok(writtenEntries.includes(sessionPackManifestFileName));

  const loadedBundle = readSessionPackBundleFromDirectory(packDir);
  assert.deepEqual(loadedBundle.manifest, bundle.manifest);
  assert.deepEqual(Object.keys(loadedBundle.files).sort(), Object.keys(bundle.files).sort());

  for (const [entryPath, content] of Object.entries(bundle.files)) {
    assert.deepEqual(Array.from(loadedBundle.files[entryPath]), Array.from(content));
  }
});

test("readSessionPackBundleFromDirectory rejects directories that fail validation", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
  });
  const packDir = writeBundleToDirectory(bundle);

  writeFileSync(path.join(packDir, "conversation.jsonl"), '{"role":"system","content":"tampered-again"}\n');

  assert.throws(() => readSessionPackBundleFromDirectory(packDir), /FILE_HASH_MISMATCH/);
});

test("serializeSessionPackBundle and deserializeSessionPackBundle round-trip archive bytes", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
  });

  const serialized = serializeSessionPackBundle(bundle);
  assert.ok(serialized.byteLength > 0);

  const restored = deserializeSessionPackBundle(serialized);
  assert.deepEqual(restored.manifest, bundle.manifest);
  assert.deepEqual(Object.keys(restored.files).sort(), Object.keys(bundle.files).sort());
});

test("writeSessionPackBundleArchive and readSessionPackBundleArchive round-trip archive files", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: createBaseFiles(),
  });
  const archivePath = path.join(
    mkdtempSync(path.join(tmpdir(), "lingban-session-pack-archive-")),
    "chrome-tax-filer.pack"
  );

  writeSessionPackBundleArchive(bundle, archivePath);
  const restored = readSessionPackBundleArchive(archivePath);

  assert.deepEqual(restored.manifest, bundle.manifest);
  assert.deepEqual(Object.keys(restored.files).sort(), Object.keys(bundle.files).sort());
});

test("packSessionVersion rejects invalid slot-schema.json content", () => {
  assert.throws(
    () =>
      packSessionVersion({
        manifest: createBaseManifest(),
        files: {
          ...createBaseFiles(),
          "slot-schema.json": JSON.stringify({
            version: "1.0.0",
            slots: [{ key: "tax_year", type: "string" }],
          }),
        },
      }),
    /SLOT_SCHEMA_INVALID/
  );
});

test("packSessionVersion rejects invalid redaction-map.json content", () => {
  assert.throws(
    () =>
      packSessionVersion({
        manifest: createBaseManifest(),
        files: {
          ...createBaseFiles(),
          "redaction-map.json": JSON.stringify({
            version: "1.0.0",
            rules: [
              {
                rule_id: "mask-tax-id",
                target: {
                  kind: "text",
                  selector: "$.company.tax_id",
                },
                strategy: "replace",
              },
            ],
          }),
        },
      }),
    /REDACTION_MAP_INVALID/
  );
});

test("packSessionVersion accepts information-collection-review.json summaries", () => {
  const bundle = packSessionVersion({
    manifest: createBaseManifest(),
    files: {
      ...createBaseFiles(),
      "information-collection-review.json": JSON.stringify(
        {
          version: "review.v1",
          slot_schema_version: "1.0.0",
          total_slots: 1,
          required_slots: 1,
          satisfied_slots: 1,
          total_answers: 1,
          user_message_answer_count: 1,
          manual_review_answer_count: 0,
          revision_count: 0,
          pending_review_count: 0,
          approved_review_count: 1,
          rejected_review_count: 0,
          superseded_review_count: 0,
          latest_answered_at: "2026-07-10T11:35:00.000Z",
          latest_reviewed_at: "2026-07-10T11:36:00.000Z",
          slots: [
            {
              key: "tax_year",
              title: "Tax year",
              type: "string",
              required: true,
              secret: false,
              status: "satisfied",
              answer_count: 1,
              tracked_answer_count: 1,
              user_message_answer_count: 1,
              manual_review_answer_count: 0,
              revision_count: 0,
              pending_review_count: 0,
              approved_review_count: 1,
              rejected_review_count: 0,
              superseded_review_count: 0,
              last_answered_at: "2026-07-10T11:35:00.000Z",
              last_reviewed_at: "2026-07-10T11:36:00.000Z",
              latest_answer_id: "ica_msg_tax_year_text_1",
              latest_source: "user-message",
              latest_source_message_id: "msg_tax_year",
              effective_answer_id: "ica_msg_tax_year_text_1",
              effective_source: "user-message",
              effective_source_message_id: "msg_tax_year",
              answers: [
                {
                  answer_id: "ica_msg_tax_year_text_1",
                  kind: "text",
                  source: "user-message",
                  source_message_id: "msg_tax_year",
                  review_status: "approved",
                  reviewed_at: "2026-07-10T11:36:00.000Z",
                  reviewed_by_user_id: "usr_tax_reviewer",
                  supersedes_answer_id: null,
                  superseded_by_answer_id: null,
                  created_at: "2026-07-10T11:35:00.000Z",
                },
              ],
            },
          ],
        },
        null,
        2
      ),
    },
  });

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      bundle.files,
      "information-collection-review.json"
    ),
    true
  );
});

test("packSessionVersion rejects invalid information-collection-review.json content", () => {
  assert.throws(
    () =>
      packSessionVersion({
        manifest: createBaseManifest(),
        files: {
          ...createBaseFiles(),
          "information-collection-review.json": JSON.stringify({
            version: "review.v1",
            total_slots: -1,
            slots: [],
          }),
        },
      }),
    /INFORMATION_COLLECTION_REVIEW_INVALID/
  );
});

test("workspace base archives round-trip directory trees", async () => {
  const sourceRoot = mkdtempSync(path.join(tmpdir(), "lingban-workspace-base-src-"));
  const targetRoot = mkdtempSync(path.join(tmpdir(), "lingban-workspace-base-dst-"));

  mkdirSync(path.join(sourceRoot, "inputs", "nested"), { recursive: true });
  mkdirSync(path.join(sourceRoot, "empty-dir"), { recursive: true });
  writeFileSync(path.join(sourceRoot, "inputs", "nested", "brief.txt"), "hello workspace base\n");
  writeFileSync(path.join(sourceRoot, "receipts.json"), '{"ok":true}\n');

  const archive = await createWorkspaceBaseArchiveFromDirectory(sourceRoot, {
    metadata: {
      fixture: true,
    },
  });
  const envelope = deserializeWorkspaceBaseArchive(archive);

  assert.equal(envelope.entries.some((entry) => entry.path === "inputs/nested/brief.txt"), true);
  assert.equal(envelope.entries.some((entry) => entry.path === "empty-dir"), true);

  const restored = await restoreWorkspaceBaseArchiveToDirectory(archive, targetRoot);
  assert.equal(restored.restoredFilesCount, 2);
  assert.equal(restored.restoredDirectoriesCount >= 2, true);
  assert.equal(readFileSync(path.join(targetRoot, "inputs", "nested", "brief.txt"), "utf8"), "hello workspace base\n");
  assert.equal(readFileSync(path.join(targetRoot, "receipts.json"), "utf8"), '{"ok":true}\n');
  assert.equal((await fs.stat(path.join(targetRoot, "empty-dir"))).isDirectory(), true);
});

test("workspace base archives accept legacy placeholder payloads as empty snapshots", async () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "lingban-workspace-base-legacy-"));
  const archive = Buffer.from(
    JSON.stringify({
      fixture: true,
      note: "legacy placeholder",
    }),
    "utf8"
  );

  const restored = await restoreWorkspaceBaseArchiveToDirectory(archive, targetRoot);
  assert.equal(restored.legacyPlaceholder, true);
  assert.equal(restored.restoredFilesCount, 0);
  assert.equal(restored.restoredDirectoriesCount, 0);
});
