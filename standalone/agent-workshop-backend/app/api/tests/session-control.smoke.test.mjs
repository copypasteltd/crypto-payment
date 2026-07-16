import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

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

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

test("session control flow builds, reviews, replays, seals, and verifies an immutable v2 Session Pack", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-session-control-"));
  const keys = [
    "API_HOST", "API_PORT", "LINGBAN_DATA_DIR", "LINGBAN_AUTH_MODE",
    "LINGBAN_OBJECT_STORAGE_DRIVER", "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_RUNTIME_LAUNCH_MODE", "LINGBAN_RUNTIME_DISPATCH_MODE",
    "LINGBAN_SESSION_PACK_SIGNATURE_ENABLED", "LINGBAN_SESSION_PACK_SIGNATURE_ALGORITHM",
    "LINGBAN_SESSION_PACK_SIGNATURE_KEY_ID", "LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET",
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  let app = null;
  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "data");
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_OBJECT_STORAGE_DRIVER = "filesystem";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_RUNTIME_DISPATCH_MODE = "embedded";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_ENABLED = "true";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_ALGORITHM = "hmac-sha256";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_KEY_ID = "session-control-test-key";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET = "session-control-test-secret-at-least-32-bytes";

    const [{ startApiServer }, { sessionCaptureRecordSchema }, sessionPack] = await Promise.all([
      import("../dist/index.js"),
      import("../../../packages/contracts/dist/index.js"),
      import("../../../packages/session-pack/dist/index.js"),
    ]);
    app = await startApiServer();
    const [{ sessionCaptureRepository }, { sessionCaptureService }, { objectStore }, versionRegistry] = await Promise.all([
      import("../dist/modules/session-captures/repository.js"),
      import("../dist/modules/session-captures/service.js"),
      import("../dist/modules/uploads/object-store.js"),
      import("../dist/modules/session-drafts/version-registry.js"),
    ]);

    const targetPath = path.join(smokeRoot, "target");
    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "wsp_session_control",
        taskVersionId: "tsv_session_control",
        sessionVersionId: "sev_session_control_source",
        title: "Session control source run",
        targetPath,
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: { firstPartyMcpIds: [], externalConnectorRefs: [], credentialIds: [] },
      }),
    });
    const runId = createdRun.run.runId;
    const captureId = "cap_session_control";
    const capturedAt = "2026-07-17T08:00:00.000Z";
    const workspaceEntries = new Map([
      ["workspace/report.txt", Buffer.from("final report\n", "utf8")],
      ["workspace/config.json", Buffer.from('{"apiKey":"sk-1234567890abcdefghijklmnop"}\n', "utf8")],
    ]);
    const workspaceArchive = await sessionPack.packTarZstdEntries(workspaceEntries);
    const inventoryFiles = [...workspaceEntries.entries()].map(([entryPath, content]) => ({
      path: entryPath.replace(/^workspace\//, ""),
      sizeBytes: content.byteLength,
      sha256: sha256(content),
      modifiedAt: capturedAt,
    }));
    const boundary = {
      threadId: "thread_session_control",
      throughTurnId: "turn_session_control",
      eventHighWatermark: 2,
      barrierReachedAt: capturedAt,
    };
    const rawEvents = gzipSync(Buffer.from([
      JSON.stringify({ sequence: 1, eventType: "thread/started", payload: { threadId: boundary.threadId } }),
      JSON.stringify({ sequence: 2, eventType: "turn/completed", payload: { turnId: boundary.throughTurnId } }),
    ].join("\n") + "\n"));
    const thread = gzipSync(Buffer.from(JSON.stringify({ thread: { threadId: boundary.threadId }, boundary, runId, capturedAt }, null, 2)));
    const inventory = gzipSync(Buffer.from(JSON.stringify({
      schemaVersion: "lingban.workspace-inventory/v1",
      targetPath: "/workspace/target",
      totalFiles: inventoryFiles.length,
      totalBytes: inventoryFiles.reduce((total, file) => total + file.sizeBytes, 0),
      files: inventoryFiles,
    }, null, 2)));
    const payloads = [
      ["raw_events", rawEvents, "application/gzip"],
      ["thread", thread, "application/gzip"],
      ["workspace", Buffer.from(workspaceArchive), "application/zstd"],
      ["inventory", inventory, "application/gzip"],
      ["manifest", Buffer.from(JSON.stringify({ captureId, boundary })), "application/json"],
    ];
    const objects = [];
    for (const [objectType, content, contentType] of payloads) {
      const digest = sha256(content);
      const objectKey = `session-captures/${captureId}/${objectType}/${digest}`;
      await objectStore.putBufferImmutable(objectKey, { content, contentType });
      objects.push({ objectType, objectKey, sha256: digest, sizeBytes: content.byteLength, contentType });
    }
    const captureManifestSha256 = sha256(Buffer.from(JSON.stringify(objects)));
    await sessionCaptureRepository.create({
      idempotencyKey: "session-control-captured",
      requestedTurnId: boundary.throughTurnId,
      record: sessionCaptureRecordSchema.parse({
        captureId,
        runId,
        workspaceId: "wsp_session_control",
        requestedByUserId: null,
        mode: "checkpoint",
        requestedThroughTurnId: boundary.throughTurnId,
        status: "CAPTURED",
        workspaceSelection: {
          targetPath: "/workspace/target",
          includeGlobs: ["**/*"],
          excludeGlobs: [".git/**", "**/node_modules/**", "**/.env*"],
          includeArtifacts: true,
          maxFiles: 100,
          maxBytes: 1024 * 1024,
        },
        boundary,
        destinationSessionId: null,
        createDraft: false,
        securityState: "clean",
        objects,
        captureManifestSha256,
        eventCount: 2,
        messageCount: 0,
        toolEventCount: 0,
        fileCount: 2,
        artifactCount: 0,
        capturedBytes: objects.reduce((total, object) => total + object.sizeBytes, 0),
        version: 1,
        requestedAt: capturedAt,
        updatedAt: capturedAt,
        capturedAt,
      }),
    });

    const deniedRawDownload = await requestJson(
      `${baseUrl}/v1/session-captures/${captureId}/objects/raw_events/download`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Security investigation access" }),
      },
      401
    );
    assert.equal(deniedRawDownload.error.code, "SESSION_CAPTURE_STRONG_AUTH_REQUIRED");

    const rawAccess = await sessionCaptureService.authorizeObjectDownload({
      captureId,
      objectType: "raw_events",
      actorUserId: "usr_session_control_reviewer",
      reason: "Security investigation access",
    });
    assert.equal(rawAccess.audit.accessMode, "proxy");
    assert.equal(rawAccess.downloadUrl, null);
    const rawAccessAudit = await sessionCaptureService.listObjectAccessAudit(captureId);
    assert.equal(rawAccessAudit.length, 1);
    assert.equal(rawAccessAudit[0].objectSha256, objects[0].sha256);

    const createdDraft = await requestJson(`${baseUrl}/v1/session-captures/${captureId}/drafts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: null,
        sessionName: "Verified filing session",
        sessionDescription: "Session control smoke",
        taskFamily: "tax-filing",
        parentSessionVersionId: null,
        idempotencyKey: "session-control-create-draft",
      }),
    });
    const draftId = createdDraft.draft.draftId;
    const revisionResult = await requestJson(`${baseUrl}/v1/session-drafts/${draftId}/revisions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: createdDraft.draft.version,
        workspaceSelection: {
          targetPath: "/workspace/target",
          includeGlobs: ["**/*"],
          excludeGlobs: [".git/**", "**/node_modules/**", "**/.env*"],
          includeArtifacts: true,
          maxFiles: 100,
          maxBytes: 1024 * 1024,
        },
        redactionRules: [{
          ruleId: "remove-api-key",
          targetKind: "json-path",
          selector: "$.apiKey",
          strategy: "remove",
          rationale: "Credentials are resolved at runtime",
        }],
      }),
    });
    assert.equal(revisionResult.revision.securityReport.passed, true);
    const reviewResult = await requestJson(`${baseUrl}/v1/session-drafts/${draftId}/redaction-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: revisionResult.draft.version,
        revisionId: revisionResult.revision.revisionId,
        decision: "approved",
        note: "Security review passed",
      }),
    });

    const blockedSeal = await requestJson(`${baseUrl}/v1/session-drafts/${draftId}/seal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: reviewResult.draft.version,
        revisionId: revisionResult.revision.revisionId,
        replayId: "replay_missing_gate",
        signingPolicyId: "test-signing-policy",
      }),
    }, 409);
    assert.equal(blockedSeal.error.code, "SESSION_REPLAY_GATE_REQUIRED");

    const replayResult = await requestJson(`${baseUrl}/v1/session-drafts/${draftId}/replay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: reviewResult.draft.version,
        revisionId: revisionResult.revision.revisionId,
      }),
    });
    assert.equal(replayResult.replay.status, "passed");
    assert.equal(replayResult.replay.restoredFileCount, 2);

    const sealedResult = await requestJson(`${baseUrl}/v1/session-drafts/${draftId}/seal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion: replayResult.draft.version,
        revisionId: revisionResult.revision.revisionId,
        replayId: replayResult.replay.replayId,
        signingPolicyId: "test-signing-policy",
      }),
    });
    assert.equal(sealedResult.version.sealedFromReplayId, replayResult.replay.replayId);
    assert.equal(sealedResult.version.signatureAlgorithm, "hmac-sha256");
    await versionRegistry.ensureSealedSessionVersionVerified(sealedResult.version.sessionVersionId);

    const detail = await requestJson(`${baseUrl}/v1/session-drafts/${draftId}`);
    assert.equal(detail.replays.length, 1);
    assert.equal(detail.versions.length, 1);
    assert.equal(detail.draft.status, "sealed");
    const versionList = await requestJson(`${baseUrl}/v1/sessions/${createdDraft.session.sessionId}/versions`);
    assert.equal(versionList.items[0].sessionVersionId, sealedResult.version.sessionVersionId);
    const versionDetail = await requestJson(`${baseUrl}/v1/session-versions/${sealedResult.version.sessionVersionId}`);
    assert.equal(versionDetail.sealedFromReplayId, replayResult.replay.replayId);

    const sealedStream = await objectStore.createReadStream(sealedResult.version.packObjectKey);
    const sealedChunks = [];
    for await (const chunk of sealedStream) sealedChunks.push(Buffer.from(chunk));
    const sealedPack = await sessionPack.unpackSessionVersionV2(Buffer.concat(sealedChunks));
    const externalInput = {
      sessionId: "ses_external_control",
      sessionVersionId: "sev_external_control",
      sourceCaptureId: sealedPack.manifest.sourceCaptureId,
      sourceRevisionId: sealedPack.manifest.sourceRevisionId,
      createdAt: "2026-07-17T09:00:00.000Z",
      metadata: { replayId: replayResult.replay.replayId, taskFamily: "external-control" },
      files: Object.fromEntries(
        [...sealedPack.files]
          .filter(([entryPath]) => entryPath !== "manifest.json")
          .map(([entryPath, content]) => [entryPath, { content }])
      ),
    };
    const externalUnsigned = await sessionPack.packSessionVersionV2(externalInput);
    const externalSignature = createHmac("sha256", "session-control-test-secret-at-least-32-bytes")
      .update(sessionPack.buildSessionPackV2SignaturePayload(externalUnsigned.manifest))
      .digest("hex");
    const externalPack = await sessionPack.packSessionVersionV2({
      ...externalInput,
      signature: { algorithm: "hmac-sha256", keyId: "session-control-test-key", value: externalSignature },
    });
    const externalImported = await requestJson(`${baseUrl}/v1/session-versions/import`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from(externalPack.archive),
    });
    assert.equal(externalImported.sourceType, "external-imported");
    assert.equal(externalImported.legacyIncomplete, false);
    await versionRegistry.ensureSealedSessionVersionVerified("sev_external_control");

    const legacyWorkspace = await sessionPack.packTarZstdEntries(new Map([
      ["workspace/legacy.txt", Buffer.from("legacy data\n")],
    ]));
    const legacyBundle = sessionPack.packSessionVersion({
      manifest: {
        session_id: "ses_legacy_control",
        session_version: "sev_legacy_control",
        task_family: "legacy-control",
        runtime_profile: { profile_id: "legacy.runtime" },
        slot_schema_version: "legacy.slots.v1",
        required_capabilities: {},
        artifact_contract: { outputs: [] },
        created_by: { user_id: "usr_legacy_control" },
        created_at: "2026-07-01T00:00:00.000Z",
      },
      files: {
        "conversation.jsonl": '{"role":"user","content":"legacy request"}\n',
        "workspace-base.tar.zst": legacyWorkspace,
        "slot-schema.json": JSON.stringify({
          version: "legacy.slots.v1",
          slots: [{ key: "request", title: "Request", type: "string", required: false, secret: false, repeatable: false, choices: [], accepts: [] }],
        }),
        "mcp-requirements.json": JSON.stringify({ connectors: [], credentials: [] }),
        "runtime-profile.json": JSON.stringify({ profile_id: "legacy.runtime" }),
      },
    });
    const legacyArchive = sessionPack.serializeSessionPackBundle(legacyBundle);
    await requestJson(`${baseUrl}/v1/sessions/import?workspaceContextKey=personal:legacy-control`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from(legacyArchive),
    });
    const legacyFacade = await requestJson(`${baseUrl}/v1/session-versions/sev_legacy_control`);
    assert.equal(legacyFacade.sourceType, "legacy-facade");
    assert.equal(legacyFacade.manifestVersion, "lingban.session-pack/v1");
    const migrationPlan = await requestJson(`${baseUrl}/v1/session-migrations/legacy-archives`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionVersionIds: ["sev_legacy_control"], dryRun: true }),
    });
    assert.equal(migrationPlan.planned, 1);
    const migration = await requestJson(`${baseUrl}/v1/session-migrations/legacy-archives`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionVersionIds: ["sev_legacy_control"], dryRun: false }),
    });
    assert.equal(migration.migrated, 1);
    const migratedVersion = await requestJson(`${baseUrl}/v1/session-versions/sev_legacy_control`);
    assert.equal(migratedVersion.sourceType, "legacy-imported");
    assert.equal(migratedVersion.legacyIncomplete, true);
    assert.equal(migratedVersion.sealedFromReplayId, null);
    await versionRegistry.ensureSealedSessionVersionVerified("sev_legacy_control");
    const repeatedMigration = await requestJson(`${baseUrl}/v1/session-migrations/legacy-archives`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionVersionIds: ["sev_legacy_control"], dryRun: false }),
    });
    assert.equal(repeatedMigration.skipped, 1);

    const unifiedLegacyBundle = sessionPack.packSessionVersion({
      manifest: {
        ...legacyBundle.manifest,
        session_id: "ses_legacy_unified",
        session_version: "sev_legacy_unified",
      },
      files: Object.fromEntries(
        Object.entries(legacyBundle.files)
          .filter(([entryPath]) => entryPath !== "manifest.json")
          .map(([entryPath, content]) => [entryPath, content])
      ),
    });
    const unifiedImported = await requestJson(`${baseUrl}/v1/session-versions/import`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from(sessionPack.serializeSessionPackBundle(unifiedLegacyBundle)),
    });
    assert.equal(unifiedImported.sourceType, "legacy-imported");
    assert.equal(unifiedImported.legacyIncomplete, true);
  } finally {
    if (app) await app.close();
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(smokeRoot, { recursive: true, force: true });
  }
});
