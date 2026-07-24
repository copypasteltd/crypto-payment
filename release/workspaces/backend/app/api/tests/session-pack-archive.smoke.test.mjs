import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";

const sessionPackSigningKeyId = "smoke-signing";
const sessionPackSigningSecret = "lingban-session-pack-smoke-secret";
const legacySessionPackSigningKeyId = "smoke-signing-legacy";
const legacySessionPackSigningSecret = "lingban-session-pack-legacy-secret";

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

async function requestBinary(url, init = {}) {
  const response = await fetch(url, init);
  const buffer = new Uint8Array(await response.arrayBuffer());

  assert.equal(
    response.ok,
    true,
    `${init.method ?? "GET"} ${url} failed: ${response.status} ${response.statusText}`
  );

  return {
    buffer,
    headers: response.headers,
  };
}

function resolveObjectPath(root, objectKey) {
  return path.join(root, objectKey.replace(/\//g, path.sep));
}

function assertBundleSignature(verifySessionPackManifestSignature, bundle, expectedAlgorithm = "hmac-sha256") {
  assert.equal(bundle.manifest.signature?.algorithm, expectedAlgorithm);
  assert.equal(bundle.manifest.signature?.key_id, sessionPackSigningKeyId);

  const result = verifySessionPackManifestSignature(bundle.manifest, {
    requireSignature: true,
    hmacSecretsByKeyId: {
      [sessionPackSigningKeyId]: sessionPackSigningSecret,
    },
  });

  assert.equal(result.ok, true, result.reason ?? "expected session-pack signature verification to succeed");
}

test("session-pack archives can be imported, queried, and exported", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-session-pack-smoke-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_ENABLE_DEMO_DATA",
    "LINGBAN_AUTH_MODE",
    "LINGBAN_RUNS_DIR",
    "LINGBAN_RUNTIME_LAUNCH_MODE",
    "LINGBAN_API_BASE_URL",
    "LINGBAN_INTERNAL_AUTH_TOKEN",
    "LINGBAN_OBJECT_STORAGE_ROOT",
    "LINGBAN_SESSION_PACK_SIGNATURE_ENABLED",
    "LINGBAN_SESSION_PACK_SIGNATURE_REQUIRE_FOR_IMPORTS",
    "LINGBAN_SESSION_PACK_SIGNATURE_ALGORITHM",
    "LINGBAN_SESSION_PACK_SIGNATURE_KEY_ID",
    "LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET",
    "LINGBAN_SESSION_PACK_SIGNATURE_HMAC_KEYS_JSON",
    "LINGBAN_SESSION_PACK_SIGNATURE_DISTRIBUTION_TARGETS_JSON",
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

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = storageRoot;
    process.env.LINGBAN_ENABLE_DEMO_DATA = "1";
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = objectStorageRoot;
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_ENABLED = "1";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_REQUIRE_FOR_IMPORTS = "1";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_ALGORITHM = "hmac-sha256";
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_KEY_ID = sessionPackSigningKeyId;
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET = sessionPackSigningSecret;
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_HMAC_KEYS_JSON = JSON.stringify({
      [legacySessionPackSigningKeyId]: legacySessionPackSigningSecret,
    });
    const distributionReportedAt = new Date().toISOString();
    process.env.LINGBAN_SESSION_PACK_SIGNATURE_DISTRIBUTION_TARGETS_JSON = JSON.stringify([
      {
        targetId: "worker-prod-a",
        displayName: "Worker Prod A",
        channel: "worker",
        acceptedKeyIds: [sessionPackSigningKeyId],
        activeKeyId: sessionPackSigningKeyId,
        lastReportedAt: distributionReportedAt,
      },
      {
        targetId: "bridge-prod-a",
        displayName: "Bridge Prod A",
        channel: "bridge",
        acceptedKeyIds: [sessionPackSigningKeyId],
        activeKeyId: sessionPackSigningKeyId,
        lastReportedAt: distributionReportedAt,
      },
    ]);
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    const {
      restoreWorkspaceBaseArchiveToDirectory,
      packSessionVersion,
      serializeSessionPackBundle,
      deserializeSessionPackBundle,
      verifySessionPackManifestSignature,
    } = await import("../../../packages/session-pack/dist/index.js");

    app = await startApiServer();

    const importedBundle = packSessionVersion({
      manifest: {
        session_id: "ses_imported_pack_20260710",
        session_version: "sev_imported_pack_2026_07_10",
        task_family: "tsv_imported_pack_2026_07_10",
        runtime_profile: {
          profile_id: "imported-profile",
          runner_image: "lingban/runner:2026.07",
          browser_required: true,
          playwright_required: true,
        },
        slot_schema_version: "imported.v1",
        required_capabilities: {
          browser: true,
          filesystem: true,
          downloads: true,
          mcps: [{ id: "browser-core", required: true }],
          credentials: [{ id: "cred_seedance", placement: "env", required: true }],
        },
        artifact_contract: {
          outputs: [{ name: "output", kind: "directory", path_pattern: "output/**" }],
        },
        created_by: {
          user_id: "usr_import_owner",
          display_name: "Import Owner",
        },
        created_at: "2026-07-10T03:00:00.000Z",
        metadata: {
          imported_fixture: true,
        },
      },
      files: {
        "conversation.jsonl": `${JSON.stringify({
          role: "system",
          kind: "prompt",
          text: "Please describe any missing inputs before execution. Use SECRET-7788 during export review for Acme Legal Name.",
        })}\n`,
        "workspace-base.tar.zst": JSON.stringify({
          fixture: true,
          note: "placeholder workspace base",
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
              {
                key: "tax_secret",
                title: "Tax filing secret",
                type: "string",
                required: true,
                secret: true,
                prompt: "Please provide the runtime tax secret for this flow.",
              },
            ],
          },
          null,
          2
        ),
        "mcp-requirements.json": JSON.stringify(
          {
            connectors: [
              { id: "browser-core", required: true },
              { id: "connector://seedance/private", required: false },
            ],
            credentials: [{ id: "cred_seedance", required: true }],
          },
          null,
          2
        ),
        "runtime-profile.json": JSON.stringify(
          {
            profile_id: "imported-profile",
            runner_image: "lingban/runner:2026.07",
            browser_required: true,
            playwright_required: true,
          },
          null,
          2
        ),
        "runtime-config.json": JSON.stringify(
          {
            profile_id: "imported-profile",
            env: {
              TAX_SECRET: "live-tax-secret",
            },
          },
          null,
          2
        ),
        "redaction-map.json": JSON.stringify(
          {
            version: "imported.v1",
            rules: [
              {
                rule_id: "mask-export-secret",
                target: {
                  kind: "text",
                  selector: "SECRET-7788",
                },
                strategy: "mask",
              },
              {
                rule_id: "replace-tax-secret",
                slot_key: "tax_secret",
                target: {
                  kind: "json-path",
                  selector: "runtime-config.json#$.env.TAX_SECRET",
                },
                strategy: "replace",
                replacement: "[REDACTED]",
              },
            ],
          },
          null,
          2
        ),
      },
      signature: {
        algorithm: "hmac-sha256",
        secret: sessionPackSigningSecret,
        keyId: sessionPackSigningKeyId,
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

    assert.equal(imported.sessionPack.sessionVersionId, "sev_imported_pack_2026_07_10");
    assert.equal(imported.archiveFileName, "sev_imported_pack_2026_07_10.session-pack.json.gz");
    assert.equal(imported.persistedArchive, true);
    assert.equal(imported.sessionPack.sessionId, "ses_imported_pack_20260710");
    assert.equal(imported.sessionPack.workspaceContextKeys.includes("brand-lab"), true);
    assert.deepEqual(imported.sessionPack.requiredBindings.firstPartyMcpIds, ["browser-core"]);
    assert.deepEqual(imported.sessionPack.requiredBindings.externalConnectorRefs, [
      "connector://seedance/private",
    ]);
    assert.deepEqual(imported.sessionPack.requiredBindings.credentialIds, ["cred_seedance"]);
    await assert.doesNotReject(
      stat(
        resolveObjectPath(
          objectStorageRoot,
          "session-archives/sev_imported_pack_2026_07_10.session-pack.json.gz"
        )
      )
    );
    await assert.rejects(
      stat(path.join(storageRoot, "sessions", "archives", "sev_imported_pack_2026_07_10.session-pack.json.gz"))
    );

    const detail = await requestJson(`${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10`);
    assert.equal(detail.sessionVersionId, "sev_imported_pack_2026_07_10");
    assert.equal(detail.sessionId, "ses_imported_pack_20260710");
    assert.equal(detail.runtimeProfile.browserRequired, true);
    assert.equal(detail.redactionSummary.totalRules, 2);
    assert.equal(detail.redactionSummary.secretSlotCount, 1);
    assert.equal(detail.redactionSummary.coveredSecretSlotCount, 1);
    assert.equal(detail.redactionSummary.uncoveredSecretSlotCount, 0);
    assert.equal(detail.redactionSummary.secretCoverageComplete, true);
    assert.deepEqual(detail.redactionSummary.schemaSecretSlotKeys, ["tax_secret"]);
    assert.deepEqual(detail.redactionSummary.curatedSecretSlotKeys, []);
    assert.equal(detail.redactionSummary.coveredSecretSlotKeys[0], "tax_secret");
    assert.equal(detail.redactionSummary.previewMatchedRuleCount, 2);
    assert.equal(detail.redactionSummary.previewTotalMatches, 2);
    assert.equal(detail.redactionSummary.previewUnmatchedRuleIds.length, 0);
    assert.equal(detail.redactionSummary.previewMutatedEntries.includes("conversation.jsonl"), true);
    assert.equal(detail.redactionSummary.previewMutatedEntries.includes("runtime-config.json"), true);
    assert.equal(detail.redactionSummary.previewError, null);
    assert.equal(detail.redactionSummary.rules[1]?.slotKey, "tax_secret");
    assert.equal(detail.redactionSummary.rules[1]?.linkedSecretSlot, true);
    assert.equal(detail.redactionSummary.rules[1]?.previewMatched, true);
    assert.equal(detail.redactionSummary.rules[1]?.previewMatchCount, 1);
    assert.equal(detail.redactionSummary.rules[1]?.previewMutatedEntries[0], "runtime-config.json");
    assert.equal(detail.governanceSummary.state, "imported");
    assert.equal(detail.governanceSummary.riskLevel, "none");
    assert.equal(detail.governanceSummary.totalDescendantCount, 0);
    assert.equal(detail.governanceSummary.liveConsumerCount, 0);
    assert.equal(detail.governanceSummary.flags.length, 0);
    assert.equal(detail.signatureSummary.status, "verified");
    assert.equal(detail.signatureSummary.algorithm, "hmac-sha256");
    assert.equal(detail.signatureSummary.keyId, sessionPackSigningKeyId);
    assert.equal(detail.signatureSummary.verificationRequired, true);
    assert.equal(detail.signatureSummary.matchesActiveSigningAlgorithm, true);
    assert.equal(detail.signatureSummary.matchesActiveSigningKey, true);
    assert.equal(detail.signatureSummary.signatureKeyAcceptedByKeyring, true);
    assert.equal(detail.signatureSummary.distributionState, "ready");
    assert.equal(detail.signatureSummary.manifestKeyDistributedToAllTargets, true);
    assert.equal(detail.signatureSummary.activeSigningKeyDistributedToAllTargets, true);
    assert.equal(detail.signatureSummary.distributionTargets.length, 2);
    assert.equal(detail.policySummary.requireApprovedRedactionReviewForPublish, true);
    assert.equal(detail.policySummary.requireSignatureKeyDistributionForPublish, true);
    assert.equal(
      detail.policySummary.actions.find((item) => item.action === "archive-redacted")?.decision,
      "block"
    );
    assert.equal(
      detail.policySummary.actions.find((item) => item.action === "publish")?.decision,
      "block"
    );
    assert.equal(
      detail.policySummary.actions.find((item) => item.action === "inherit")?.decision,
      "allow"
    );
    assert.equal(detail.policySummary.checks[0]?.code, "approved_redaction_review_required");

    const list = await requestJson(`${baseUrl}/v1/sessions?workspaceContextKey=brand-lab&q=imported`);
    assert.equal(
      list.some((item) => item.sessionVersionId === "sev_imported_pack_2026_07_10"),
      true
    );

    const importedDownload = await requestBinary(
      `${baseUrl}${imported.archiveDownloadPath}`
    );
    assert.equal(importedDownload.headers.get("content-type"), "application/gzip");
    assert.equal(
      importedDownload.headers.get("x-lingban-session-pack-source"),
      "imported"
    );
    assert.equal(
      Buffer.compare(Buffer.from(importedDownload.buffer), Buffer.from(importedArchive)),
      0
    );
    assertBundleSignature(
      verifySessionPackManifestSignature,
      deserializeSessionPackBundle(importedDownload.buffer)
    );
    const importedOriginalBundle = deserializeSessionPackBundle(importedDownload.buffer);
    assert.equal(
      Buffer.from(importedOriginalBundle.files["conversation.jsonl"]).toString("utf8").includes("SECRET-7788"),
      true
    );
    assert.equal(
      JSON.parse(Buffer.from(importedOriginalBundle.files["runtime-config.json"]).toString("utf8")).env.TAX_SECRET,
      "live-tax-secret"
    );

    const curatedRedactionMap = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/redaction-map`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          mapVersion: "curated.v2",
          curatedSecretSlotKeys: ["company_name"],
          rules: [
            {
              ruleId: "mask-export-secret",
              targetKind: "text",
              selector: "SECRET-7788",
              strategy: "mask",
              rationale: "Mask copied export markers",
            },
            {
              ruleId: "replace-tax-secret",
              slotKey: "tax_secret",
              targetKind: "json-path",
              selector: "runtime-config.json#$.env.TAX_SECRET",
              strategy: "replace",
              replacement: "[MASKED-TAX]",
              rationale: "Replace runtime tax secret",
            },
            {
              ruleId: "remove-runtime-profile-file",
              targetKind: "file-path",
              selector: "runtime-profile.json",
              strategy: "remove",
              rationale: "Remove runtime profile from redacted exports",
            },
            {
              ruleId: "mask-company-name",
              slotKey: "company_name",
              targetKind: "text",
              selector: "Acme Legal Name",
              strategy: "mask",
              rationale: "Mask company legal name for regulated export",
            },
          ],
        }),
      }
    );
    assert.equal(curatedRedactionMap.totalRules, 4);
    assert.equal(curatedRedactionMap.persistedArchive, true);
    assert.equal(curatedRedactionMap.sessionPack.redactionSummary.mapVersion, "curated.v2");
    assert.equal(curatedRedactionMap.sessionPack.redactionSummary.previewMatchedRuleCount, 4);
    assert.equal(curatedRedactionMap.sessionPack.redactionSummary.previewTotalMatches, 4);
    assert.equal(
      curatedRedactionMap.sessionPack.redactionSummary.previewMutatedEntries.includes("runtime-profile.json"),
      true
    );
    assert.deepEqual(curatedRedactionMap.sessionPack.redactionSummary.schemaSecretSlotKeys, ["tax_secret"]);
    assert.deepEqual(curatedRedactionMap.sessionPack.redactionSummary.curatedSecretSlotKeys, [
      "company_name",
    ]);
    assert.deepEqual(curatedRedactionMap.sessionPack.redactionSummary.secretSlotKeys, [
      "tax_secret",
      "company_name",
    ]);
    assert.equal(curatedRedactionMap.sessionPack.redactionSummary.secretSlotCount, 2);
    assert.equal(curatedRedactionMap.sessionPack.redactionSummary.coveredSecretSlotCount, 2);
    assert.equal(curatedRedactionMap.sessionPack.redactionSummary.uncoveredSecretSlotCount, 0);
    assert.equal(
      curatedRedactionMap.sessionPack.redactionSummary.rules.some(
        (rule) => rule.ruleId === "remove-runtime-profile-file" && rule.previewMatched === true
      ),
      true
    );
    assert.equal(
      curatedRedactionMap.sessionPack.redactionSummary.rules.some(
        (rule) => rule.ruleId === "mask-company-name" && rule.linkedSecretSlot === true
      ),
      true
    );

    const curatedDetail = await requestJson(`${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10`);
    assert.equal(curatedDetail.redactionSummary.totalRules, 4);
    assert.equal(curatedDetail.redactionSummary.mapVersion, "curated.v2");
    assert.equal(curatedDetail.redactionSummary.previewMatchedRuleCount, 4);
    assert.equal(curatedDetail.redactionSummary.previewTotalMatches, 4);
    assert.equal(curatedDetail.redactionSummary.previewUnmatchedRuleIds.length, 0);
    assert.deepEqual(curatedDetail.redactionSummary.curatedSecretSlotKeys, ["company_name"]);
    assert.equal(curatedDetail.redactionSummary.secretSlotCount, 2);
    assert.equal(curatedDetail.redactionSummary.coveredSecretSlotCount, 2);
    assert.equal(curatedDetail.redactionSummary.secretCoverageComplete, true);
    assert.equal(curatedDetail.redactionReview, null);
    assert.equal(
      curatedDetail.policySummary.actions.find((item) => item.action === "archive-redacted")?.decision,
      "block"
    );
    assert.equal(
      curatedDetail.policySummary.actions.find((item) => item.action === "publish")?.decision,
      "block"
    );

    const blockedRedactedDownload = await fetch(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/archive?redact=true`
    );
    assert.equal(blockedRedactedDownload.status, 409);
    assert.equal(
      (await blockedRedactedDownload.json()).error?.code,
      "SESSION_PACK_GOVERNANCE_POLICY_BLOCKED"
    );

    const blockedPublish = await fetch(`${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceContextKey: "brand-lab",
        serviceId: "poster-batch",
        entrySurface: "dashboard",
      }),
    });
    assert.equal(blockedPublish.status, 409);
    assert.equal(
      (await blockedPublish.json()).error?.code,
      "SESSION_PACK_GOVERNANCE_POLICY_BLOCKED"
    );

    const reviewedRedaction = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/redaction-review`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          decision: "approved",
          note: "Secret coverage and file removals verified for export.",
        }),
      }
    );
    assert.equal(reviewedRedaction.decision, "approved");
    assert.equal(reviewedRedaction.persistedArchive, true);
    assert.equal(reviewedRedaction.sessionPack.redactionReview.decision, "approved");
    assert.equal(
      reviewedRedaction.sessionPack.redactionReview.note,
      "Secret coverage and file removals verified for export."
    );
    assert.equal(reviewedRedaction.sessionPack.redactionReview.mapVersion, "curated.v2");
    assert.equal(reviewedRedaction.sessionPack.redactionReview.totalRules, 4);
    assert.equal(reviewedRedaction.sessionPack.redactionReview.previewMatchedRuleCount, 4);
    assert.equal(reviewedRedaction.sessionPack.redactionReview.secretCoverageComplete, true);
    assert.equal(
      reviewedRedaction.sessionPack.policySummary.actions.find((item) => item.action === "archive-redacted")?.decision,
      "allow"
    );
    assert.equal(
      reviewedRedaction.sessionPack.policySummary.actions.find((item) => item.action === "publish")?.decision,
      "allow"
    );

    const curatedDownload = await requestBinary(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/archive`
    );
    assert.equal(curatedDownload.headers.get("content-type"), "application/gzip");
    assert.equal(
      curatedDownload.headers.get("x-lingban-session-pack-source"),
      "imported"
    );
    const curatedBundle = deserializeSessionPackBundle(curatedDownload.buffer);
    assertBundleSignature(verifySessionPackManifestSignature, curatedBundle);
    const curatedRedactionFile = JSON.parse(
      Buffer.from(curatedBundle.files["redaction-map.json"]).toString("utf8")
    );
    assert.equal(curatedRedactionFile.version, "curated.v2");
    assert.deepEqual(curatedRedactionFile.secret_slot_keys, ["company_name"]);
    assert.equal(curatedRedactionFile.rules.length, 4);
    assert.equal(
      curatedRedactionFile.rules.some((rule) => rule.rule_id === "remove-runtime-profile-file"),
      true
    );
    assert.equal(
      curatedRedactionFile.rules.some((rule) => rule.rule_id === "mask-company-name"),
      true
    );
    assert.equal(
      Buffer.from(curatedBundle.files["conversation.jsonl"]).toString("utf8").includes("SECRET-7788"),
      true
    );
    assert.equal(
      JSON.parse(Buffer.from(curatedBundle.files["runtime-config.json"]).toString("utf8")).env.TAX_SECRET,
      "live-tax-secret"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(curatedBundle.files, "runtime-profile.json"),
      true
    );

    const redactedDownload = await requestBinary(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/archive?redact=true`
    );
    assert.equal(
      redactedDownload.headers.get("x-lingban-session-pack-redacted"),
      "true"
    );
    const redactedBundle = deserializeSessionPackBundle(redactedDownload.buffer);
    assertBundleSignature(verifySessionPackManifestSignature, redactedBundle);
    assert.equal(
      Buffer.from(redactedBundle.files["conversation.jsonl"]).toString("utf8").includes("SECRET-7788"),
      false
    );
    assert.equal(
      Buffer.from(redactedBundle.files["conversation.jsonl"]).toString("utf8").includes("***********"),
      true
    );
    assert.equal(
      Buffer.from(redactedBundle.files["conversation.jsonl"]).toString("utf8").includes("Acme Legal Name"),
      false
    );
    assert.equal(
      JSON.parse(Buffer.from(redactedBundle.files["runtime-config.json"]).toString("utf8")).env.TAX_SECRET,
      "[MASKED-TAX]"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(redactedBundle.files, "runtime-profile.json"),
      false
    );
    assert.equal(redactedBundle.manifest.metadata?.redaction_export, true);
    assert.equal(redactedBundle.manifest.metadata?.redaction_applied, true);

    const auditedDetail = await requestJson(`${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10`);
    assert.equal(auditedDetail.redactionReview.decision, "approved");
    assert.equal(
      auditedDetail.redactionReview.note,
      "Secret coverage and file removals verified for export."
    );
    assert.equal(auditedDetail.archiveExportAudit.totalExports, 3);
    assert.equal(auditedDetail.archiveExportAudit.plainExportCount, 2);
    assert.equal(auditedDetail.archiveExportAudit.redactedExportCount, 1);
    assert.equal(auditedDetail.archiveExportAudit.entries.length, 3);
    assert.equal(auditedDetail.archiveExportAudit.entries[0].redacted, true);
    assert.equal(auditedDetail.archiveExportAudit.entries[0].archiveSource, "imported");
    assert.equal(
      auditedDetail.archiveExportAudit.entries.some((entry) => entry.redacted === false),
      true
    );
    assert.equal(
      auditedDetail.archiveExportAudit.entries.some(
        (entry) => entry.workspaceContextKey === "brand-lab"
      ),
      true
    );
    assert.equal(
      auditedDetail.archiveExportAudit.entries.every(
        (entry) => entry.workspaceContextKey === null || entry.workspaceContextKey === "brand-lab"
      ),
      true
    );
    assert.equal(
      auditedDetail.archiveExportAudit.entries.every(
        (entry) => typeof entry.archiveSha256 === "string" && entry.archiveSha256.length === 64
      ),
      true
    );

    const legacyBundle = packSessionVersion({
      manifest: {
        session_id: "ses_imported_pack_legacy_20260710",
        session_version: "sev_imported_pack_legacy_2026_07_10",
        task_family: "tsv_imported_pack_legacy_2026_07_10",
        runtime_profile: {
          profile_id: "legacy-profile",
          runner_image: "lingban/runner:2026.07",
          browser_required: true,
          playwright_required: true,
        },
        slot_schema_version: "legacy.v1",
        required_capabilities: {
          browser: true,
          filesystem: true,
          downloads: true,
          mcps: [{ id: "browser-core", required: true }],
          credentials: [{ id: "cred_seedance", placement: "env", required: true }],
        },
        artifact_contract: {
          outputs: [{ name: "output", kind: "directory", path_pattern: "output/**" }],
        },
        created_by: {
          user_id: "usr_import_owner",
          display_name: "Import Owner",
        },
        created_at: "2026-07-10T03:10:00.000Z",
        metadata: {
          imported_fixture: true,
          legacy_key_rotation_case: true,
        },
      },
      files: {
        "conversation.jsonl": `${JSON.stringify({
          role: "system",
          kind: "prompt",
          text: "Legacy signing key fixture for distribution governance validation.",
        })}\n`,
        "workspace-base.tar.zst": JSON.stringify({
          fixture: true,
          note: "legacy signing key placeholder workspace base",
        }),
        "slot-schema.json": JSON.stringify(
          {
            version: "legacy.v1",
            slots: [
              {
                key: "tax_secret",
                title: "Tax filing secret",
                type: "string",
                required: true,
                secret: true,
                prompt: "Please provide the runtime tax secret for this flow.",
              },
            ],
          },
          null,
          2
        ),
        "mcp-requirements.json": JSON.stringify(
          {
            connectors: [{ id: "browser-core", required: true }],
            credentials: [{ id: "cred_seedance", required: true }],
          },
          null,
          2
        ),
        "runtime-profile.json": JSON.stringify(
          {
            profile_id: "legacy-profile",
            runner_image: "lingban/runner:2026.07",
            browser_required: true,
            playwright_required: true,
          },
          null,
          2
        ),
        "runtime-config.json": JSON.stringify(
          {
            profile_id: "legacy-profile",
            env: {
              TAX_SECRET: "legacy-tax-secret",
            },
          },
          null,
          2
        ),
        "redaction-map.json": JSON.stringify(
          {
            version: "legacy.v1",
            rules: [
              {
                rule_id: "replace-tax-secret",
                slot_key: "tax_secret",
                target: {
                  kind: "json-path",
                  selector: "runtime-config.json#$.env.TAX_SECRET",
                },
                strategy: "replace",
                replacement: "[REDACTED]",
              },
            ],
          },
          null,
          2
        ),
      },
      signature: {
        algorithm: "hmac-sha256",
        secret: legacySessionPackSigningSecret,
        keyId: legacySessionPackSigningKeyId,
      },
    });

    const legacyImported = await requestJson(
      `${baseUrl}/v1/sessions/import?workspaceContextKey=brand-lab`,
      {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
        },
        body: Buffer.from(serializeSessionPackBundle(legacyBundle)),
      }
    );
    assert.equal(legacyImported.sessionPack.sessionVersionId, "sev_imported_pack_legacy_2026_07_10");

    const legacyDetail = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_legacy_2026_07_10`
    );
    assert.equal(legacyDetail.signatureSummary.keyId, legacySessionPackSigningKeyId);
    assert.equal(legacyDetail.signatureSummary.signatureKeyAcceptedByKeyring, true);
    assert.equal(legacyDetail.signatureSummary.manifestKeyDistributedToAllTargets, false);
    assert.equal(legacyDetail.signatureSummary.distributionState, "partial");
    assert.equal(legacyDetail.signatureSummary.matchesActiveSigningKey, false);
    assert.equal(
      legacyDetail.policySummary.actions.find((item) => item.action === "publish")?.decision,
      "block"
    );
    assert.equal(
      legacyDetail.policySummary.actions.find((item) => item.action === "rollback")?.decision,
      "block"
    );
    assert.equal(
      legacyDetail.policySummary.checks.some(
        (check) => check.code === "signature_key_distribution_required"
      ),
      true
    );

    const blockedLegacyPublish = await fetch(
      `${baseUrl}/v1/sessions/sev_imported_pack_legacy_2026_07_10/publish`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          serviceId: "poster-batch",
          entrySurface: "dashboard",
        }),
      }
    );
    assert.equal(blockedLegacyPublish.status, 409);
    assert.equal(
      (await blockedLegacyPublish.json()).error?.code,
      "SESSION_PACK_GOVERNANCE_POLICY_BLOCKED"
    );

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "wsp_session_pack_smoke",
        taskVersionId: "tsv_tax_filing",
        sessionVersionId: "sev_chrome_tax_runner",
        title: "Session pack internal archive smoke",
        targetPath: path.join(smokeRoot, "internal-archive-run"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
      }),
    });
    const collectedMessage = await requestJson(`${baseUrl}/v1/runs/${createdRun.run.runId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "Please use the saved request context for the runtime-derived archive smoke.",
        attachments: [],
        slotValues: [
          {
            slotKey: "request_context",
            valueText: "Runtime-derived archive smoke context",
          },
        ],
      }),
    });
    const collectedAnswerId = collectedMessage.informationCollection.answers[0]?.answerId;
    assert.ok(collectedAnswerId, "expected information-collection answer id for runtime-derived archive");
    const reviewedMessage = await requestJson(
      `${baseUrl}/v1/runs/${createdRun.run.runId}/information-collection/reviews`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          answerId: collectedAnswerId,
          decision: "revise",
          note: "Archive smoke review revised.",
          replacementValueText: "Runtime-derived archive smoke context (reviewed)",
        }),
      }
    );
    assert.equal(reviewedMessage.informationCollection.pendingReviewCount, 0);
    assert.equal(reviewedMessage.informationCollection.approvedReviewCount, 1);
    assert.equal(reviewedMessage.informationCollection.answers.length, 2);
    assert.equal(
      reviewedMessage.informationCollection.answers.some(
        (answer) => answer.source === "manual-review" && answer.reviewStatus === "approved"
      ),
      true
    );
    assert.equal(
      reviewedMessage.informationCollection.answers.some(
        (answer) => answer.reviewStatus === "superseded" && answer.supersededByAnswerId
      ),
      true
    );
    assert.equal(
      reviewedMessage.informationCollection.slots.find((slot) => slot.key === "request_context")?.status,
      "satisfied"
    );
    await mkdir(path.join(createdRun.run.targetPath, "receipts"), { recursive: true });
    await writeFile(
      path.join(createdRun.run.targetPath, "receipts", "summary.txt"),
      "formal runtime-derived receipt\n",
      "utf8"
    );

    const importedInternalDownload = await requestBinary(
      `${baseUrl}/internal/runs/${createdRun.run.runId}/session-pack/archive`,
      {
        headers: {
          "x-lingban-internal-token": "smoke-internal-token",
        },
      }
    );
    assert.equal(
      importedInternalDownload.headers.get("x-lingban-session-pack-source"),
      "runtime-derived"
    );
    assert.equal(
      importedInternalDownload.headers.get("x-lingban-session-pack-file-name"),
      "sev_chrome_tax_runner.session-pack.json.gz"
    );
    const generatedInternalBundle = deserializeSessionPackBundle(importedInternalDownload.buffer);
    assert.equal(generatedInternalBundle.manifest.session_version, "sev_chrome_tax_runner");
    assert.equal(generatedInternalBundle.manifest.metadata?.runtime_derived, true);
    assert.equal(
      generatedInternalBundle.manifest.metadata?.runtime_source_run_id,
      createdRun.run.runId
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        generatedInternalBundle.files,
        "information-collection-review.json"
      ),
      true
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(generatedInternalBundle.files, "runtime-evidence.json"),
      true
    );
    const generatedInternalReview = JSON.parse(
      Buffer.from(generatedInternalBundle.files["information-collection-review.json"]).toString("utf8")
    );
    const generatedInternalRuntimeEvidence = JSON.parse(
      Buffer.from(generatedInternalBundle.files["runtime-evidence.json"]).toString("utf8")
    );
    assert.equal(generatedInternalReview.slot_schema_version, "generated.v1");
    assert.equal(generatedInternalReview.total_slots, 1);
    assert.equal(generatedInternalReview.satisfied_slots, 1);
    assert.equal(generatedInternalReview.total_answers, 2);
    assert.equal(generatedInternalReview.user_message_answer_count, 1);
    assert.equal(generatedInternalReview.manual_review_answer_count, 1);
    assert.equal(generatedInternalReview.revision_count, 1);
    assert.equal(generatedInternalReview.pending_review_count, 0);
    assert.equal(generatedInternalReview.approved_review_count, 1);
    assert.equal(generatedInternalReview.rejected_review_count, 0);
    assert.equal(generatedInternalReview.superseded_review_count, 1);
    assert.equal(generatedInternalReview.slots[0]?.key, "request_context");
    assert.equal(generatedInternalReview.slots[0]?.answer_count, 1);
    assert.equal(generatedInternalReview.slots[0]?.tracked_answer_count, 2);
    assert.equal(generatedInternalReview.slots[0]?.user_message_answer_count, 1);
    assert.equal(generatedInternalReview.slots[0]?.manual_review_answer_count, 1);
    assert.equal(generatedInternalReview.slots[0]?.revision_count, 1);
    assert.equal(generatedInternalReview.slots[0]?.approved_review_count, 1);
    assert.equal(generatedInternalReview.slots[0]?.superseded_review_count, 1);
    assert.equal(generatedInternalReview.slots[0]?.latest_source, "manual-review");
    assert.equal(
      String(generatedInternalReview.slots[0]?.latest_source_message_id ?? "").startsWith("review:"),
      true
    );
    assert.equal(generatedInternalReview.slots[0]?.effective_source, "manual-review");
    assert.equal(generatedInternalReview.slots[0]?.answers.length, 2);
    assert.equal(generatedInternalReview.slots[0]?.answers[0]?.source, "user-message");
    assert.equal(generatedInternalReview.slots[0]?.answers[0]?.review_status, "superseded");
    assert.equal(generatedInternalReview.slots[0]?.answers[1]?.source, "manual-review");
    assert.equal(generatedInternalReview.slots[0]?.answers[1]?.review_status, "approved");
    assert.equal(
      generatedInternalReview.slots[0]?.answers[1]?.supersedes_answer_id,
      collectedAnswerId
    );
    assert.equal(generatedInternalReview.slots[0]?.last_answer_text, undefined);
    assert.equal(generatedInternalRuntimeEvidence.totalRecords, 1);
    assert.equal(generatedInternalRuntimeEvidence.latestRunId, createdRun.run.runId);
    assert.equal(generatedInternalRuntimeEvidence.latestLaunchMode, "local-process");
    assert.equal(generatedInternalRuntimeEvidence.hasCurrentRunRecord, true);
    assert.equal(generatedInternalRuntimeEvidence.items[0]?.runId, createdRun.run.runId);
    assert.equal(generatedInternalRuntimeEvidence.items[0]?.targetPath, createdRun.run.targetPath);
    assert.equal(generatedInternalRuntimeEvidence.items[0]?.manifestRuntimeDerived, true);
    assert.equal(generatedInternalRuntimeEvidence.items[0]?.workspaceBaseCaptured, true);
    assertBundleSignature(verifySessionPackManifestSignature, generatedInternalBundle);
    const restoredRuntimeDerivedWorkspace = path.join(smokeRoot, "restored-runtime-derived-workspace");
    await restoreWorkspaceBaseArchiveToDirectory(
      generatedInternalBundle.files["workspace-base.tar.zst"],
      restoredRuntimeDerivedWorkspace
    );
    assert.equal(
      await readFile(
        path.join(restoredRuntimeDerivedWorkspace, "receipts", "summary.txt"),
        "utf8"
      ),
      "formal runtime-derived receipt\n"
    );

    const fallbackRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "wsp_session_pack_smoke",
        taskVersionId: "tsv_runtime_fallback",
        sessionVersionId: "sev_runtime_fallback_smoke",
        title: "Session pack internal fallback smoke",
        targetPath: path.join(smokeRoot, "internal-fallback-run"),
        entrySurface: "dashboard",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
      }),
    });
    await mkdir(path.join(fallbackRun.run.targetPath, "archive"), { recursive: true });
    await writeFile(
      path.join(fallbackRun.run.targetPath, "archive", "prompt-trace.json"),
      '{"captured":true}\n',
      "utf8"
    );
    await writeFile(
      path.join(fallbackRun.run.targetPath, "summary.md"),
      "# runtime fallback\n",
      "utf8"
    );

    const fallbackInternalDownload = await requestBinary(
      `${baseUrl}/internal/runs/${fallbackRun.run.runId}/session-pack/archive`,
      {
        headers: {
          "x-lingban-internal-token": "smoke-internal-token",
        },
      }
    );
    assert.equal(
      fallbackInternalDownload.headers.get("x-lingban-session-pack-source"),
      "runtime-fallback"
    );
    assert.equal(
      fallbackInternalDownload.headers.get("x-lingban-session-pack-file-name"),
      "sev_runtime_fallback_smoke.session-pack.json.gz"
    );
    const fallbackBundle = deserializeSessionPackBundle(fallbackInternalDownload.buffer);
    assert.equal(fallbackBundle.manifest.session_version, "sev_runtime_fallback_smoke");
    assert.equal(fallbackBundle.manifest.metadata?.runtime_fallback, true);
    assertBundleSignature(verifySessionPackManifestSignature, fallbackBundle);
    const restoredFallbackWorkspace = path.join(smokeRoot, "restored-fallback-workspace");
    await restoreWorkspaceBaseArchiveToDirectory(
      fallbackBundle.files["workspace-base.tar.zst"],
      restoredFallbackWorkspace
    );
    assert.equal(
      await readFile(
        path.join(restoredFallbackWorkspace, "archive", "prompt-trace.json"),
        "utf8"
      ),
      '{"captured":true}\n'
    );
    assert.equal(
      await readFile(path.join(restoredFallbackWorkspace, "summary.md"), "utf8"),
      "# runtime fallback\n"
    );

    const roundTrippedImported = deserializeSessionPackBundle(importedDownload.buffer);
    assert.equal(
      roundTrippedImported.manifest.session_version,
      "sev_imported_pack_2026_07_10"
    );
    assertBundleSignature(verifySessionPackManifestSignature, roundTrippedImported);

    const inherited = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/inherit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          reason: "fork for workspace delivery",
        }),
      }
    );

    assert.equal(inherited.createdDraft, true);
    assert.equal(
      inherited.inheritedFromSessionVersionId,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(inherited.sessionPack.sessionId, "ses_imported_pack_20260710");
    assert.equal(
      inherited.sessionPack.lineageParentVersionId,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(inherited.sessionPack.persistedArchive, true);
    assert.equal(
      inherited.sessionPack.sessionVersionId.startsWith("sev_imported_pack_2026_07_10_draft_"),
      true
    );

    const inheritedDownload = await requestBinary(`${baseUrl}${inherited.archiveDownloadPath}`);
    assert.equal(
      inheritedDownload.headers.get("x-lingban-session-pack-source"),
      "imported"
    );
    const inheritedBundle = deserializeSessionPackBundle(inheritedDownload.buffer);
    assert.equal(
      inheritedBundle.manifest.source?.lineage_parent_version_id,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(
      inheritedBundle.manifest.metadata?.inherited_from_session_version,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(inheritedBundle.manifest.metadata?.inherited_draft, true);
    assert.equal(inheritedBundle.manifest.session_id, "ses_imported_pack_20260710");
    assert.equal(
      inheritedBundle.manifest.session_version,
      inherited.sessionPack.sessionVersionId
    );
    assertBundleSignature(verifySessionPackManifestSignature, inheritedBundle);

    const parentLineage = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/lineage`
    );
    assert.equal(parentLineage.focus.sessionVersionId, "sev_imported_pack_2026_07_10");
    assert.equal(parentLineage.ancestors.length, 0);
    assert.equal(parentLineage.descendants.length, 1);
    assert.equal(parentLineage.descendants[0].relation, "lineage_child");
    assert.equal(
      parentLineage.descendants[0].sessionVersionId,
      inherited.sessionPack.sessionVersionId
    );
    assert.equal(
      parentLineage.descendants[0].viaSessionVersionId,
      "sev_imported_pack_2026_07_10"
    );

    const inheritedLineage = await requestJson(
      `${baseUrl}/v1/sessions/${inherited.sessionPack.sessionVersionId}/lineage`
    );
    assert.equal(
      inheritedLineage.focus.sessionVersionId,
      inherited.sessionPack.sessionVersionId
    );
    assert.equal(inheritedLineage.descendants.length, 0);
    assert.equal(inheritedLineage.ancestors.length, 1);
    assert.equal(inheritedLineage.ancestors[0].relation, "lineage_parent");
    assert.equal(
      inheritedLineage.ancestors[0].sessionVersionId,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(
      inheritedLineage.ancestors[0].viaSessionVersionId,
      inherited.sessionPack.sessionVersionId
    );

    const consumerInherited = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/inherit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          inheritMode: "consumer",
          newSessionId: "ses_imported_pack_consumer_smoke",
          newSessionVersionId: "sev_imported_pack_consumer_smoke",
          reason: "consumer run smoke",
        }),
      }
    );

    assert.equal(consumerInherited.createdDraft, false);
    assert.equal(consumerInherited.inheritMode, "consumer");
    assert.equal(
      consumerInherited.inheritedFromSessionVersionId,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(
      consumerInherited.sessionPack.lineageParentVersionId,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(
      consumerInherited.sessionPack.sessionVersionId,
      "sev_imported_pack_consumer_smoke"
    );
    assert.equal(consumerInherited.sessionPack.inheritMode, "consumer");
    assert.equal(consumerInherited.sessionPack.consumerRunId, null);
    assert.equal(consumerInherited.sessionPack.consumerWorkspaceId, null);
    assert.equal(consumerInherited.sessionPack.consumerEntrySurface, null);
    assert.equal(consumerInherited.sessionPack.consumerTargetPath, null);

    const consumerInheritedDownload = await requestBinary(
      `${baseUrl}${consumerInherited.archiveDownloadPath}`
    );
    const consumerInheritedBundle = deserializeSessionPackBundle(
      consumerInheritedDownload.buffer
    );
    assert.equal(consumerInheritedBundle.manifest.session_id, "ses_imported_pack_consumer_smoke");
    assert.equal(
      consumerInheritedBundle.manifest.session_version,
      "sev_imported_pack_consumer_smoke"
    );
    assert.equal(consumerInheritedBundle.manifest.metadata?.inherit_mode, "consumer");
    assert.equal(consumerInheritedBundle.manifest.metadata?.consumer_inherit, true);
    assert.equal(
      consumerInheritedBundle.manifest.metadata?.inherited_from_session_version,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(
      consumerInheritedBundle.manifest.source?.lineage_parent_version_id,
      "sev_imported_pack_2026_07_10"
    );
    assertBundleSignature(verifySessionPackManifestSignature, consumerInheritedBundle);

    const importedGovernanceDetail = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10`
    );
    assert.equal(importedGovernanceDetail.consumerGovernance.totalConsumerVersions, 1);
    assert.equal(
      importedGovernanceDetail.consumerGovernance.items[0]?.sessionVersionId,
      "sev_imported_pack_consumer_smoke"
    );
    assert.equal(importedGovernanceDetail.consumerGovernance.items[0]?.depth, 1);
    assert.equal(
      importedGovernanceDetail.consumerGovernance.items[0]?.viaSessionVersionId,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(importedGovernanceDetail.consumerGovernance.items[0]?.isCurrent, false);
    assert.equal(importedGovernanceDetail.governanceSummary.state, "imported");
    assert.equal(importedGovernanceDetail.governanceSummary.riskLevel, "high");
    assert.equal(importedGovernanceDetail.governanceSummary.totalDescendantCount, 2);
    assert.equal(importedGovernanceDetail.governanceSummary.draftDescendantCount, 1);
    assert.equal(importedGovernanceDetail.governanceSummary.consumerDescendantCount, 1);
    assert.equal(importedGovernanceDetail.governanceSummary.liveConsumerCount, 1);
    assert.equal(importedGovernanceDetail.governanceSummary.unpublishedConsumerCount, 1);
    assert.equal(
      importedGovernanceDetail.governanceSummary.flags.includes("unpublished_with_live_consumers"),
      true
    );
    assert.equal(
      importedGovernanceDetail.governanceSummary.flags.includes("draft_descendants_present"),
      true
    );
    assert.equal(
      importedGovernanceDetail.governanceSummary.flags.includes("consumer_descendants_present"),
      true
    );

    const consumerInheritedDetail = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_consumer_smoke`
    );
    assert.equal(consumerInheritedDetail.consumerGovernance.totalConsumerVersions, 1);
    assert.equal(
      consumerInheritedDetail.consumerGovernance.items[0]?.sessionVersionId,
      "sev_imported_pack_consumer_smoke"
    );
    assert.equal(consumerInheritedDetail.consumerGovernance.items[0]?.isCurrent, true);
    assert.equal(consumerInheritedDetail.consumerGovernance.items[0]?.depth, 0);
    assert.equal(consumerInheritedDetail.governanceSummary.state, "consumer-derived");
    assert.equal(consumerInheritedDetail.governanceSummary.riskLevel, "medium");
    assert.equal(consumerInheritedDetail.governanceSummary.liveConsumerCount, 1);
    assert.equal(consumerInheritedDetail.governanceSummary.consumerDescendantCount, 0);
    assert.equal(
      consumerInheritedDetail.governanceSummary.flags.includes("live_consumer_versions_visible"),
      true
    );

    const runtimeDerivedDownload = await requestBinary(
      `${baseUrl}/v1/sessions/sev_chrome_tax_runner/archive`
    );
    assert.equal(
      runtimeDerivedDownload.headers.get("x-lingban-session-pack-source"),
      "runtime-derived"
    );

    const runtimeDerivedBundle = deserializeSessionPackBundle(runtimeDerivedDownload.buffer);
    assert.equal(runtimeDerivedBundle.manifest.session_version, "sev_chrome_tax_runner");
    assert.equal(runtimeDerivedBundle.manifest.metadata?.runtime_derived, true);
    assert.equal(
      runtimeDerivedBundle.manifest.metadata?.runtime_source_run_id,
      createdRun.run.runId
    );
    assert.equal(
      runtimeDerivedBundle.manifest.source?.creator_package_id,
      "chrome-tax-runner"
    );
    assertBundleSignature(verifySessionPackManifestSignature, runtimeDerivedBundle);
    const runtimeDerivedDetail = await requestJson(`${baseUrl}/v1/sessions/sev_chrome_tax_runner`);
    assert.equal(runtimeDerivedDetail.persistedArchive, true);
    assert.equal(runtimeDerivedDetail.archiveSource, "runtime-derived");
    assert.equal(runtimeDerivedDetail.runtimeSourceRunId, createdRun.run.runId);
    assert.equal(runtimeDerivedDetail.runtimeSourceTargetPath, createdRun.run.targetPath);
    assert.equal(runtimeDerivedDetail.governanceSummary.state, "runtime-derived");
    assert.equal(runtimeDerivedDetail.governanceSummary.riskLevel, "low");
    assert.equal(runtimeDerivedDetail.governanceSummary.runtimeEvidenceCount, 1);
    assert.equal(runtimeDerivedDetail.governanceSummary.hasCurrentRuntimeEvidence, true);
    assert.equal(
      runtimeDerivedDetail.governanceSummary.flags.includes("runtime_evidence_present"),
      true
    );
    assert.equal(runtimeDerivedDetail.runtimeEvidenceSummary.totalRecords, 1);
    assert.equal(runtimeDerivedDetail.runtimeEvidenceSummary.latestRunId, createdRun.run.runId);
    assert.equal(runtimeDerivedDetail.runtimeEvidenceSummary.currentRunId, createdRun.run.runId);
    assert.equal(runtimeDerivedDetail.runtimeEvidenceSummary.hasCurrentRunRecord, true);
    assert.equal(
      runtimeDerivedDetail.runtimeEvidenceSummary.items[0]?.archiveSource,
      "runtime-derived"
    );
    assert.equal(
      runtimeDerivedDetail.runtimeEvidenceSummary.items[0]?.targetPath,
      createdRun.run.targetPath
    );
    assert.equal(
      runtimeDerivedDetail.runtimeEvidenceSummary.items[0]?.archiveFileName,
      "sev_chrome_tax_runner.session-pack.json.gz"
    );
    assert.equal(
      typeof runtimeDerivedDetail.runtimeEvidenceSummary.items[0]?.archiveSha256,
      "string"
    );
    assert.equal(runtimeDerivedDetail.signatureSummary.status, "verified");
    assert.equal(runtimeDerivedDetail.signatureSummary.algorithm, "hmac-sha256");
    assert.equal(runtimeDerivedDetail.signatureSummary.keyId, sessionPackSigningKeyId);
    assert.equal(runtimeDerivedDetail.signatureSummary.matchesActiveSigningAlgorithm, true);
    assert.equal(runtimeDerivedDetail.signatureSummary.matchesActiveSigningKey, true);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slotSchemaVersion, "generated.v1");
    assert.equal(runtimeDerivedDetail.informationCollectionReview.totalSlots, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.satisfiedSlots, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.totalAnswers, 2);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.userMessageAnswerCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.manualReviewAnswerCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.revisionCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.pendingReviewCount, 0);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.approvedReviewCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.rejectedReviewCount, 0);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.supersededReviewCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.key, "request_context");
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.status, "satisfied");
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.answerCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.trackedAnswerCount, 2);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.userMessageAnswerCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.manualReviewAnswerCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.revisionCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.approvedReviewCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.supersededReviewCount, 1);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.latestSource, "manual-review");
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.effectiveSource, "manual-review");
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.answers.length, 2);
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.answers[0]?.source, "user-message");
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.answers[0]?.reviewStatus, "superseded");
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.answers[1]?.source, "manual-review");
    assert.equal(runtimeDerivedDetail.informationCollectionReview.slots[0]?.answers[1]?.reviewStatus, "approved");
    await assert.doesNotReject(
      stat(
        resolveObjectPath(
          objectStorageRoot,
          "session-archives/sev_chrome_tax_runner.session-pack.json.gz"
        )
      )
    );
    await rm(createdRun.run.targetPath, { recursive: true, force: true });
    const runtimeDerivedPersistedDownload = await requestBinary(
      `${baseUrl}/v1/sessions/sev_chrome_tax_runner/archive`
    );
    assert.equal(
      runtimeDerivedPersistedDownload.headers.get("x-lingban-session-pack-source"),
      "runtime-derived"
    );
    const runtimeDerivedPersistedBundle = deserializeSessionPackBundle(
      runtimeDerivedPersistedDownload.buffer
    );
    const restoredRuntimeDerivedPersistedWorkspace = path.join(
      smokeRoot,
      "restored-runtime-derived-persisted-workspace"
    );
    await restoreWorkspaceBaseArchiveToDirectory(
      runtimeDerivedPersistedBundle.files["workspace-base.tar.zst"],
      restoredRuntimeDerivedPersistedWorkspace
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        runtimeDerivedPersistedBundle.files,
        "information-collection-review.json"
      ),
      true
    );
    assertBundleSignature(verifySessionPackManifestSignature, runtimeDerivedPersistedBundle);
    assert.equal(
      await readFile(
        path.join(restoredRuntimeDerivedPersistedWorkspace, "receipts", "summary.txt"),
        "utf8"
      ),
      "formal runtime-derived receipt\n"
    );
    const generatedDownload = await requestBinary(
      `${baseUrl}/v1/sessions/sev_creator_drama_suite/archive`
    );
    assert.equal(
      generatedDownload.headers.get("x-lingban-session-pack-source"),
      "generated"
    );
    const generatedBundle = deserializeSessionPackBundle(generatedDownload.buffer);
    assert.equal(generatedBundle.manifest.session_version, "sev_creator_drama_suite");
    assert.equal(generatedBundle.manifest.metadata?.generated_descriptor, true);
    assertBundleSignature(verifySessionPackManifestSignature, generatedBundle);

    const published = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/publish`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          serviceId: "poster-batch",
          entrySurface: "dashboard",
        }),
      }
    );

    assert.equal(published.publishedSessionVersionId, "sev_imported_pack_2026_07_10");
    assert.equal(published.publishedTargets.length, 1);
    assert.equal(
      published.publishedTargets[0].templateKey,
      "poster-batch:brand-lab:dashboard"
    );
    assert.equal(
      published.publishedTargets[0].sessionVersionId,
      "sev_imported_pack_2026_07_10"
    );

    const publishedDetail = await requestJson(`${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10`);
    assert.equal(publishedDetail.publishedTargetCount, 1);
    assert.equal(
      publishedDetail.publishedTargets[0].templateKey,
      "poster-batch:brand-lab:dashboard"
    );
    assert.equal(publishedDetail.linkedServiceIds.includes("poster-batch"), true);
    assert.equal(publishedDetail.governanceSummary.state, "published");
    assert.equal(publishedDetail.governanceSummary.riskLevel, "low");
    assert.equal(
      publishedDetail.governanceSummary.flags.includes("published_targets_attached"),
      true
    );
    assert.equal(
      publishedDetail.governanceSummary.flags.includes("unpublished_with_live_consumers"),
      false
    );

    const publishedLaunchTemplate = await requestJson(
      `${baseUrl}/v1/services/poster-batch/launch-template`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          entrySurface: "dashboard",
        }),
      }
    );
    assert.equal(publishedLaunchTemplate.sessionVersionId, "sev_imported_pack_2026_07_10");
    assert.equal(publishedLaunchTemplate.taskVersionId, "tsv_poster_batch");

    const unpublished = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/unpublish`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          serviceId: "poster-batch",
          entrySurface: "dashboard",
        }),
      }
    );

    assert.equal(unpublished.unpublishedSessionVersionId, "sev_imported_pack_2026_07_10");
    assert.equal(unpublished.unpublishedTargets.length, 1);
    assert.equal(
      unpublished.unpublishedTargets[0].templateKey,
      "poster-batch:brand-lab:dashboard"
    );
    assert.equal(unpublished.sessionPack.publishedTargetCount, 0);
    const unpublishedDetail = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10`
    );
    assert.equal(unpublishedDetail.publishedTargetCount, 0);
    assert.equal(unpublishedDetail.governanceSummary.state, "imported");
    assert.equal(unpublishedDetail.governanceSummary.riskLevel, "high");
    assert.equal(
      unpublishedDetail.governanceSummary.flags.includes("unpublished_with_live_consumers"),
      true
    );

    const missingLaunchTemplateResponse = await fetch(
      `${baseUrl}/v1/services/poster-batch/launch-template`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          entrySurface: "dashboard",
        }),
      }
    );
    assert.equal(missingLaunchTemplateResponse.status, 404);

    await requestJson(`${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceContextKey: "brand-lab",
        serviceId: "poster-batch",
        entrySurface: "dashboard",
      }),
    });

    const rolledBack = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10/rollback`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          serviceId: "poster-batch",
          rollbackToSessionVersionId: "sev_brand_poster_suite",
          entrySurface: "dashboard",
        }),
      }
    );

    assert.equal(
      rolledBack.rolledBackFromSessionVersionId,
      "sev_imported_pack_2026_07_10"
    );
    assert.equal(rolledBack.rolledBackToSessionVersionId, "sev_brand_poster_suite");
    assert.equal(rolledBack.publishedTargets.length, 1);
    assert.equal(
      rolledBack.publishedTargets[0].sessionVersionId,
      "sev_brand_poster_suite"
    );

    const restoredLaunchTemplate = await requestJson(
      `${baseUrl}/v1/services/poster-batch/launch-template`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceContextKey: "brand-lab",
          entrySurface: "dashboard",
        }),
      }
    );
    assert.equal(restoredLaunchTemplate.sessionVersionId, "sev_brand_poster_suite");

    const importedAfterRollback = await requestJson(
      `${baseUrl}/v1/sessions/sev_imported_pack_2026_07_10`
    );
    assert.equal(importedAfterRollback.publishedTargetCount, 0);
  } finally {
    if (app) {
      await app.close().catch(() => undefined);
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
});
