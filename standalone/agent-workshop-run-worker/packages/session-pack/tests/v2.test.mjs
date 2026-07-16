import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  packSessionVersionV2,
  packTarZstdEntries,
  unpackSessionVersionV2,
  unpackTarZstdEntries,
  validateSessionVersionV2Files,
  buildSessionPackV2SignaturePayload,
  convertLegacySessionPackToV2,
  packSessionVersion,
} from "../dist/index.js";

async function buildValidFiles() {
  const workspaceContent = Buffer.from("verified workspace\n", "utf8");
  const workspaceArchive = await packTarZstdEntries(new Map([
    ["workspace/report.txt", workspaceContent],
  ]));
  return {
    "capture-provenance.json": { content: "{}\n", contentType: "application/json" },
    "agent-events.jsonl": { content: "{\"sequence\":1}\n", contentType: "application/x-ndjson" },
    "conversation.jsonl": { content: "{\"sequence\":1,\"role\":\"user\"}\n", contentType: "application/x-ndjson" },
    "tool-events.jsonl": { content: "", contentType: "application/x-ndjson" },
    "approval-events.jsonl": { content: "", contentType: "application/x-ndjson" },
    "workspace-base.tar.zst": { content: workspaceArchive, contentType: "application/zstd" },
    "workspace-inventory.json": { content: JSON.stringify({ schemaVersion: "lingban.workspace-inventory/v1", targetPath: "/workspace/target", totalFiles: 1, totalBytes: workspaceContent.byteLength, files: [] }) },
    "artifact-index.json": { content: "[]\n" },
    "slot-schema.json": { content: JSON.stringify({ version: "test.v1", slots: [{ key: "request", title: "Request", type: "string", required: false, secret: false, repeatable: false, choices: [], accepts: [] }] }) },
    "information-collection-review.json": { content: JSON.stringify({ version: "review.v1", slots: [] }) },
    "mcp-requirements.json": { content: JSON.stringify({ connectors: [], credentials: [] }) },
    "runtime-profile.json": { content: JSON.stringify({ profile_id: "runtime.test", browser_required: false, playwright_required: false }) },
    "runtime-config.json": { content: JSON.stringify({ profile_id: "runtime.test", command: [], args: [], env: {}, working_directory: "/workspace/target" }) },
    "provider-profile.json": { content: "null\n" },
    "validator-set.json": { content: JSON.stringify({ validators: ["manifest-hash", "workspace-inventory"] }) },
    "redaction-map.json": { content: JSON.stringify({ version: "redaction.v1", secret_slot_keys: [], rules: [] }) },
    "validation-report.json": { content: JSON.stringify({ valid: true }) },
  };
}

test("Session Pack v2 produces a deterministic complete tar.zst archive and verifies every file", async () => {
  const input = {
    sessionId: "ses_v2_test",
    sourceCaptureId: "cap_v2_test",
    createdAt: "2026-07-17T00:00:00.000Z",
    files: await buildValidFiles(),
  };
  const first = await packSessionVersionV2(input);
  const second = await packSessionVersionV2(input);
  assert.equal(first.sha256, second.sha256);
  assert.deepEqual([...first.archive.slice(0, 4)], [0x28, 0xb5, 0x2f, 0xfd]);
  const unpacked = await unpackSessionVersionV2(first.archive);
  assert.equal(unpacked.manifest.manifestVersion, "lingban.session-pack/v2");
  assert.equal(Buffer.from(unpacked.files.get("agent-events.jsonl")).toString("utf8"), "{\"sequence\":1}\n");
});

test("Session Pack v2 validator reports missing, malformed JSONL, and schema-invalid files", async () => {
  const files = await buildValidFiles();
  delete files["approval-events.jsonl"];
  files["agent-events.jsonl"] = { content: "{invalid}\n" };
  files["slot-schema.json"] = { content: JSON.stringify({ version: "test.v1", slots: [] }) };
  const result = await validateSessionVersionV2Files(files);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === "REQUIRED_FILE_MISSING" && issue.path === "approval-events.jsonl"), true);
  assert.equal(result.issues.some((issue) => issue.code === "JSONL_INVALID"), true);
  assert.equal(result.issues.some((issue) => issue.code === "SCHEMA_INVALID" && issue.path.startsWith("slot-schema.json")), true);
});

test("Session Pack v2 reader rejects files absent from the signed manifest", async () => {
  const packed = await packSessionVersionV2({
    sessionId: "ses_v2_rogue",
    sourceCaptureId: "cap_v2_rogue",
    createdAt: "2026-07-17T00:00:00.000Z",
    files: await buildValidFiles(),
  });
  const entries = await unpackTarZstdEntries(packed.archive);
  entries.set("undeclared.txt", Buffer.from("not declared"));
  const altered = await packTarZstdEntries(entries);
  await assert.rejects(() => unpackSessionVersionV2(altered), /undeclared file/);
});

test("Session Pack v2 reader enforces extraction entry limits", async () => {
  const archive = await packTarZstdEntries(new Map([
    ["first.txt", Buffer.from("1")],
    ["second.txt", Buffer.from("2")],
  ]));
  await assert.rejects(() => unpackTarZstdEntries(archive, { maxEntries: 1 }), /entry limit exceeded/);
});

test("Session Pack v2 embeds a detached signature over the canonical unsigned manifest", async () => {
  const baseInput = {
    sessionId: "ses_v2_signed",
    sessionVersionId: "sev_v2_signed",
    sourceCaptureId: "cap_v2_signed",
    sourceRevisionId: "sdr_v2_signed",
    createdAt: "2026-07-17T00:00:00.000Z",
    metadata: { policy: "production" },
    files: await buildValidFiles(),
  };
  const unsigned = await packSessionVersionV2(baseInput);
  const secret = "session-pack-v2-test-secret";
  const value = createHmac("sha256", secret)
    .update(buildSessionPackV2SignaturePayload(unsigned.manifest))
    .digest("hex");
  const signed = await packSessionVersionV2({
    ...baseInput,
    signature: { algorithm: "hmac-sha256", keyId: "key_v2_test", value },
  });
  const unpacked = await unpackSessionVersionV2(signed.archive);
  assert.deepEqual(unpacked.manifest.signature, {
    algorithm: "hmac-sha256",
    keyId: "key_v2_test",
    value,
  });
  assert.equal(
    createHmac("sha256", secret)
      .update(buildSessionPackV2SignaturePayload(unpacked.manifest))
      .digest("hex"),
    value
  );
});

test("legacy v1 conversion preserves canonical content and records incomplete provenance", async () => {
  const workspaceArchive = await packTarZstdEntries(new Map([
    ["workspace/legacy.txt", Buffer.from("legacy workspace\n")],
  ]));
  const legacy = packSessionVersion({
    manifest: {
      session_id: "ses_legacy_migration",
      session_version: "sev_legacy_migration",
      task_family: "legacy-tax",
      runtime_profile: { profile_id: "legacy.runtime" },
      slot_schema_version: "legacy.slots.v1",
      required_capabilities: {},
      artifact_contract: { outputs: [] },
      created_by: { user_id: "usr_legacy_creator" },
      created_at: "2026-07-01T00:00:00.000Z",
    },
    files: {
      "conversation.jsonl": '{"role":"user","content":"file tax"}\n',
      "workspace-base.tar.zst": workspaceArchive,
      "slot-schema.json": JSON.stringify({
        version: "legacy.slots.v1",
        slots: [{ key: "request", title: "Request", type: "string", required: false, secret: false, repeatable: false, choices: [], accepts: [] }],
      }),
      "mcp-requirements.json": JSON.stringify({ connectors: [], credentials: [] }),
      "runtime-profile.json": JSON.stringify({ profile_id: "legacy.runtime" }),
    },
  });
  const converted = await convertLegacySessionPackToV2({ bundle: legacy });
  const packed = await packSessionVersionV2({
    sessionId: legacy.manifest.session_id,
    sessionVersionId: legacy.manifest.session_version,
    sourceCaptureId: converted.sourceCaptureId,
    createdAt: legacy.manifest.created_at,
    metadata: converted.metadata,
    files: converted.files,
  });
  const unpacked = await unpackSessionVersionV2(packed.archive);
  assert.equal(unpacked.manifest.metadata.legacyIncomplete, true);
  assert.equal(
    Buffer.from(unpacked.files.get("conversation.jsonl")).toString("utf8"),
    Buffer.from(legacy.files["conversation.jsonl"]).toString("utf8")
  );
  assert.equal(converted.report.incompleteReasons.length >= 3, true);
});
