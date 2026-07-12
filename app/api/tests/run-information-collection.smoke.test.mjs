import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

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

test("run information collection tracks slot schema and attachment slot bindings", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-run-collection-"));
  const envBackup = new Map();
  const envKeys = [
    "API_HOST",
    "API_PORT",
    "LINGBAN_DATA_DIR",
    "LINGBAN_AUTH_MODE",
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
  let runId = null;

  try {
    const port = await allocatePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const targetPath = path.join(smokeRoot, "run-target");

    process.env.API_HOST = "127.0.0.1";
    process.env.API_PORT = String(port);
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "api-data");
    process.env.LINGBAN_AUTH_MODE = "disabled";
    process.env.LINGBAN_RUNS_DIR = path.join(smokeRoot, "worker-runs");
    process.env.LINGBAN_RUNTIME_LAUNCH_MODE = "local-process";
    process.env.LINGBAN_API_BASE_URL = baseUrl;
    process.env.LINGBAN_INTERNAL_AUTH_TOKEN = "smoke-internal-token";
    process.env.LINGBAN_OBJECT_STORAGE_ROOT = path.join(smokeRoot, "objects");
    process.env.CODEX_BIN = process.execPath;

    const { startApiServer } = await import("../dist/index.js");
    const {
      packSessionVersion,
      serializeSessionPackBundle,
    } = await import("../../../packages/session-pack/dist/index.js");

    app = await startApiServer();

    const bundle = packSessionVersion({
      manifest: {
        session_id: "ses_collection_smoke",
        session_version: "sev_collection_smoke",
        task_family: "tsv_collection_smoke",
        runtime_profile: {
          profile_id: "collection-smoke",
          browser_required: true,
        },
        slot_schema_version: "imported.v1",
        required_capabilities: {
          browser: true,
          filesystem: true,
          downloads: true,
        },
        artifact_contract: {
          outputs: [{ name: "output", kind: "directory", path_pattern: "output/**" }],
        },
        created_by: {
          user_id: "usr_collection_smoke",
        },
        created_at: "2026-07-11T08:00:00.000Z",
      },
      files: {
        "conversation.jsonl": `${JSON.stringify({
          role: "system",
          kind: "prompt",
          text: "Collect missing filing information before execution.",
        })}\n`,
        "workspace-base.tar.zst": JSON.stringify({
          fixture: true,
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
                prompt: "Provide the company legal name.",
              },
              {
                key: "filing_materials",
                title: "Filing materials",
                type: "file",
                required: true,
                repeatable: true,
                accepts: ["pdf", "png"],
                prompt: "Upload the filing materials.",
              },
              {
                key: "notes",
                title: "Notes",
                type: "string",
                required: false,
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
            profile_id: "collection-smoke",
            browser_required: true,
          },
          null,
          2
        ),
      },
    });

    await requestJson(`${baseUrl}/v1/sessions/import?workspaceContextKey=brand-lab`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
      },
      body: Buffer.from(serializeSessionPackBundle(bundle)),
    });

    const createdRun = await requestJson(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "wsp_collection_smoke",
        taskVersionId: "tsv_collection_smoke",
        sessionVersionId: "sev_collection_smoke",
        title: "Collection smoke",
        targetPath,
        entrySurface: "h5",
        initialMessage: null,
        bindings: {
          firstPartyMcpIds: [],
          externalConnectorRefs: [],
          credentialIds: [],
        },
      }),
    });

    runId = createdRun.run.runId;
    assert.equal(createdRun.informationCollection.slotSchemaVersion, "imported.v1");
    assert.equal(createdRun.informationCollection.requiredCount, 2);
    assert.equal(createdRun.informationCollection.missingCount, 2);
    assert.equal(createdRun.informationCollection.status, "pending");

    const initialSnapshot = await requestJson(`${baseUrl}/v1/runs/${runId}`);
    assert.equal(initialSnapshot.informationCollection.slotSchemaVersion, "imported.v1");
    assert.equal(initialSnapshot.informationCollection.requiredCount, 2);
    assert.equal(initialSnapshot.informationCollection.satisfiedCount, 0);
    assert.equal(initialSnapshot.informationCollection.missingCount, 2);
    assert.equal(initialSnapshot.informationCollection.answers.length, 0);
    assert.equal(initialSnapshot.informationCollection.pendingReviewCount, 0);
    assert.equal(initialSnapshot.informationCollection.approvedReviewCount, 0);
    assert.equal(initialSnapshot.informationCollection.rejectedReviewCount, 0);
    assert.equal(
      initialSnapshot.informationCollection.slots.find((slot) => slot.key === "company_name")?.status,
      "missing"
    );
    assert.equal(
      initialSnapshot.informationCollection.slots.find((slot) => slot.key === "filing_materials")?.status,
      "missing"
    );
    assert.equal(
      initialSnapshot.informationCollection.slots.find((slot) => slot.key === "notes")?.status,
      "optional"
    );

    const createdUpload = await requestJson(`${baseUrl}/v1/runs/${runId}/uploads`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileName: "vat-form.pdf",
        contentType: "application/pdf",
        sizeBytes: 11,
      }),
    });

    const putResponse = await fetch(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/content`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/octet-stream",
        },
        body: Buffer.from("pdf-fixture", "utf8"),
      }
    );
    assert.equal(putResponse.ok, true, `PUT upload failed: ${await putResponse.text()}`);

    const finalizedUpload = await requestJson(
      `${baseUrl}/v1/runs/${runId}/uploads/${createdUpload.upload.uploadId}/finalize`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          label: "VAT form",
        }),
      }
    );

    const messageSnapshot = await requestJson(`${baseUrl}/v1/runs/${runId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "I uploaded the filing material.",
        attachments: [
          {
            path: finalizedUpload.attachment.path,
            label: finalizedUpload.attachment.label,
            slotKey: "filing_materials",
          },
        ],
      }),
    });

    assert.equal(messageSnapshot.informationCollection.userMessageCount, 1);
    assert.equal(messageSnapshot.informationCollection.attachmentCount, 1);
    assert.equal(messageSnapshot.messages.at(-1)?.slotValues.length, 0);
    assert.equal(messageSnapshot.informationCollection.satisfiedCount, 1);
    assert.equal(messageSnapshot.informationCollection.missingCount, 1);
    assert.equal(messageSnapshot.informationCollection.status, "in_progress");
    assert.equal(messageSnapshot.informationCollection.answers.length, 1);
    assert.equal(messageSnapshot.informationCollection.pendingReviewCount, 1);
    assert.equal(
      messageSnapshot.informationCollection.slots.find((slot) => slot.key === "filing_materials")?.status,
      "satisfied"
    );
    assert.equal(
      messageSnapshot.informationCollection.slots.find((slot) => slot.key === "filing_materials")?.attachmentCount,
      1
    );
    assert.equal(
      messageSnapshot.informationCollection.slots.find((slot) => slot.key === "company_name")?.status,
      "missing"
    );
    assert.equal(
      messageSnapshot.informationCollection.answers[0]?.kind,
      "attachment"
    );
    assert.equal(
      messageSnapshot.informationCollection.answers[0]?.slotKey,
      "filing_materials"
    );
    assert.equal(
      messageSnapshot.informationCollection.answers[0]?.attachmentPath,
      finalizedUpload.attachment.path
    );

    const inferredTextSnapshot = await requestJson(`${baseUrl}/v1/runs/${runId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "Harbor Finance Limited",
        attachments: [],
      }),
    });

    assert.equal(inferredTextSnapshot.informationCollection.userMessageCount, 2);
    assert.equal(inferredTextSnapshot.informationCollection.attachmentCount, 1);
    assert.equal(inferredTextSnapshot.messages.at(-1)?.slotValues.length, 1);
    assert.equal(
      inferredTextSnapshot.messages.at(-1)?.slotValues[0]?.slotKey,
      "company_name"
    );
    assert.equal(
      inferredTextSnapshot.messages.at(-1)?.slotValues[0]?.valueText,
      "Harbor Finance Limited"
    );
    assert.equal(inferredTextSnapshot.informationCollection.satisfiedCount, 2);
    assert.equal(inferredTextSnapshot.informationCollection.missingCount, 0);
    assert.equal(inferredTextSnapshot.informationCollection.status, "completed");
    assert.equal(inferredTextSnapshot.informationCollection.answers.length, 2);
    assert.equal(inferredTextSnapshot.informationCollection.pendingReviewCount, 2);
    assert.equal(
      inferredTextSnapshot.informationCollection.slots.find((slot) => slot.key === "company_name")?.status,
      "satisfied"
    );
    assert.equal(
      inferredTextSnapshot.informationCollection.slots.find((slot) => slot.key === "company_name")?.answerCount,
      1
    );
    assert.equal(
      inferredTextSnapshot.informationCollection.slots.find((slot) => slot.key === "company_name")?.lastAnswerText,
      "Harbor Finance Limited"
    );
    assert.equal(
      inferredTextSnapshot.informationCollection.answers[1]?.kind,
      "text"
    );
    assert.equal(
      inferredTextSnapshot.informationCollection.answers[1]?.slotKey,
      "company_name"
    );
    assert.equal(
      inferredTextSnapshot.informationCollection.answers[1]?.valueText,
      "Harbor Finance Limited"
    );

    const structuredTextSnapshot = await requestJson(`${baseUrl}/v1/runs/${runId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "I also need a manual confirmation step before final submission.",
        attachments: [],
        slotValues: [
          {
            slotKey: "notes",
            valueText: "Manual confirmation is required before final submission.",
          },
        ],
      }),
    });

    assert.equal(structuredTextSnapshot.informationCollection.userMessageCount, 3);
    assert.equal(structuredTextSnapshot.messages.at(-1)?.slotValues.length, 1);
    assert.equal(
      structuredTextSnapshot.messages.at(-1)?.slotValues[0]?.slotKey,
      "notes"
    );
    assert.equal(
      structuredTextSnapshot.informationCollection.slots.find((slot) => slot.key === "notes")?.status,
      "satisfied"
    );
    assert.equal(
      structuredTextSnapshot.informationCollection.slots.find((slot) => slot.key === "notes")?.answerCount,
      1
    );
    assert.equal(
      structuredTextSnapshot.informationCollection.slots.find((slot) => slot.key === "notes")?.lastAnswerText,
      "Manual confirmation is required before final submission."
    );
    assert.equal(structuredTextSnapshot.informationCollection.answers.length, 3);
    assert.equal(
      structuredTextSnapshot.informationCollection.answers[2]?.slotKey,
      "notes"
    );
    assert.equal(
      structuredTextSnapshot.informationCollection.answers[2]?.valueText,
      "Manual confirmation is required before final submission."
    );
    assert.equal(structuredTextSnapshot.informationCollection.pendingReviewCount, 3);
    assert.equal(structuredTextSnapshot.informationCollection.approvedReviewCount, 0);
    assert.equal(structuredTextSnapshot.informationCollection.rejectedReviewCount, 0);

    const attachmentAnswerId = structuredTextSnapshot.informationCollection.answers[0]?.answerId;
    const companyNameAnswerId = structuredTextSnapshot.informationCollection.answers[1]?.answerId;
    const notesAnswerId = structuredTextSnapshot.informationCollection.answers[2]?.answerId;

    assert.ok(attachmentAnswerId, "expected attachment answer id");
    assert.ok(companyNameAnswerId, "expected company name answer id");
    assert.ok(notesAnswerId, "expected notes answer id");

    const approvedAttachmentSnapshot = await requestJson(
      `${baseUrl}/v1/runs/${runId}/information-collection/reviews`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          answerId: attachmentAnswerId,
          decision: "approve",
          note: "Attachment reviewed by operations.",
        }),
      }
    );

    assert.equal(approvedAttachmentSnapshot.informationCollection.pendingReviewCount, 2);
    assert.equal(approvedAttachmentSnapshot.informationCollection.approvedReviewCount, 1);
    assert.equal(approvedAttachmentSnapshot.informationCollection.rejectedReviewCount, 0);
    assert.equal(
      approvedAttachmentSnapshot.informationCollection.answers[0]?.reviewStatus,
      "approved"
    );

    const revisedCompanySnapshot = await requestJson(
      `${baseUrl}/v1/runs/${runId}/information-collection/reviews`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          answerId: companyNameAnswerId,
          decision: "revise",
          note: "Manual normalization applied.",
          replacementValueText: "Harbor Finance Holdings Limited",
        }),
      }
    );

    assert.equal(revisedCompanySnapshot.informationCollection.pendingReviewCount, 1);
    assert.equal(revisedCompanySnapshot.informationCollection.approvedReviewCount, 2);
    assert.equal(revisedCompanySnapshot.informationCollection.answers.length, 4);
    assert.equal(
      revisedCompanySnapshot.informationCollection.answers[1]?.reviewStatus,
      "superseded"
    );
    assert.equal(
      revisedCompanySnapshot.informationCollection.answers[3]?.source,
      "manual-review"
    );
    assert.equal(
      revisedCompanySnapshot.informationCollection.answers[3]?.reviewStatus,
      "approved"
    );
    assert.equal(
      revisedCompanySnapshot.informationCollection.answers[3]?.supersedesAnswerId,
      companyNameAnswerId
    );
    assert.equal(
      revisedCompanySnapshot.informationCollection.slots.find((slot) => slot.key === "company_name")
        ?.lastAnswerText,
      "Harbor Finance Holdings Limited"
    );

    const rejectedNotesSnapshot = await requestJson(
      `${baseUrl}/v1/runs/${runId}/information-collection/reviews`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          answerId: notesAnswerId,
          decision: "reject",
          note: "This note should not be kept in the final intake state.",
        }),
      }
    );

    assert.equal(rejectedNotesSnapshot.informationCollection.pendingReviewCount, 0);
    assert.equal(rejectedNotesSnapshot.informationCollection.approvedReviewCount, 2);
    assert.equal(rejectedNotesSnapshot.informationCollection.rejectedReviewCount, 1);
    assert.equal(
      rejectedNotesSnapshot.informationCollection.answers[2]?.reviewStatus,
      "rejected"
    );
    assert.equal(
      rejectedNotesSnapshot.informationCollection.slots.find((slot) => slot.key === "notes")?.status,
      "optional"
    );
    assert.equal(
      rejectedNotesSnapshot.informationCollection.slots.find((slot) => slot.key === "notes")
        ?.answerCount,
      0
    );
    assert.equal(rejectedNotesSnapshot.informationCollection.status, "completed");
  } finally {
    if (app && runId) {
      await fetch(`${baseUrlForEnv(process.env.API_PORT)}/v1/runs/${runId}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "smoke cleanup",
        }),
      }).catch(() => undefined);
    }

    if (app) {
      await app.close().catch(() => undefined);
    }

    for (const key of envKeys) {
      const previous = envBackup.get(key);
      if (previous == null) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }

    await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});

function baseUrlForEnv(port) {
  return `http://127.0.0.1:${port}`;
}
