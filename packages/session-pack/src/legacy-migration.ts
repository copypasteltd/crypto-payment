import { createHash } from "node:crypto";
import {
  sessionPackInformationCollectionReviewFileSchema,
  sessionPackMcpRequirementsFileSchema,
  sessionPackRedactionMapSchema,
  sessionPackRuntimeConfigSchema,
  sessionPackRuntimeProfileSchema,
  sessionPackSlotSchemaFileSchema,
} from "./schema.js";
import type { SessionPackBundle } from "./pack.js";
import {
  packTarZstdEntries,
  unpackTarZstdEntries,
  type SessionPackV2FileInput,
} from "./v2.js";

function sha256(content: Uint8Array | string) {
  return createHash("sha256").update(content).digest("hex");
}

function decodeJson(content: Uint8Array) {
  return JSON.parse(Buffer.from(content).toString("utf8")) as unknown;
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2) + "\n";
}

function toJsonlRecord(line: string, sequence: number, occurredAt: string) {
  let payload: unknown;
  try {
    payload = JSON.parse(line) as unknown;
  } catch {
    payload = { raw: line };
  }
  return JSON.stringify({
    sequence,
    eventType: "legacy/conversation",
    occurredAt,
    payloadSha256: sha256(line),
    payload,
    legacyIncomplete: true,
  });
}

export type LegacySessionPackMigrationReport = {
  schemaVersion: "lingban.session-pack-migration/v1";
  sourceManifestVersion: "lingban.session-pack/v1";
  targetManifestVersion: "lingban.session-pack/v2";
  sessionId: string;
  sessionVersionId: string;
  sourceArchiveSha256: string | null;
  sourceFileHashes: Record<string, string>;
  legacyIncomplete: true;
  incompleteReasons: string[];
  migratedAt: string;
};

export async function convertLegacySessionPackToV2(input: {
  bundle: SessionPackBundle;
  sourceArchive?: Uint8Array;
  migratedAt?: string;
}) {
  const { bundle } = input;
  const manifest = bundle.manifest;
  const migratedAt = input.migratedAt ?? manifest.created_at;
  const sourceArchiveSha256 = input.sourceArchive ? sha256(input.sourceArchive) : null;
  const sourceCaptureId = `cap_legacy_${(sourceArchiveSha256 ?? sha256(JSON.stringify(manifest))).slice(0, 32)}`;
  const incompleteReasons = [
    "legacy archive has no canonical App Server raw event stream",
    "legacy archive has no approval event stream",
    "legacy archive has no Capture Barrier evidence",
  ];

  const slotSchema = sessionPackSlotSchemaFileSchema.parse(decodeJson(bundle.files["slot-schema.json"]!));
  const mcpRequirements = sessionPackMcpRequirementsFileSchema.parse(
    decodeJson(bundle.files["mcp-requirements.json"]!)
  );
  const runtimeProfile = bundle.files["runtime-profile.json"]
    ? sessionPackRuntimeProfileSchema.parse(decodeJson(bundle.files["runtime-profile.json"]))
    : sessionPackRuntimeProfileSchema.parse(manifest.runtime_profile);
  const runtimeConfig = bundle.files["runtime-config.json"]
    ? sessionPackRuntimeConfigSchema.parse(decodeJson(bundle.files["runtime-config.json"]))
    : sessionPackRuntimeConfigSchema.parse({
        profile_id: runtimeProfile.profile_id,
        command: [],
        args: [],
        env: {},
      });
  const redactionMap = bundle.files["redaction-map.json"]
    ? sessionPackRedactionMapSchema.parse(decodeJson(bundle.files["redaction-map.json"]))
    : sessionPackRedactionMapSchema.parse({ version: "legacy-import/v1", secret_slot_keys: [], rules: [] });
  const informationReview = bundle.files["information-collection-review.json"]
    ? sessionPackInformationCollectionReviewFileSchema.parse(
        decodeJson(bundle.files["information-collection-review.json"])
      )
    : sessionPackInformationCollectionReviewFileSchema.parse({
        version: "legacy-import/v1",
        slot_schema_version: slotSchema.version,
        total_slots: slotSchema.slots.length,
        required_slots: slotSchema.slots.filter((slot) => slot.required).length,
        satisfied_slots: 0,
        total_answers: 0,
        slots: slotSchema.slots.map((slot) => ({
          key: slot.key,
          title: slot.title,
          type: slot.type,
          required: slot.required,
          secret: slot.secret,
          status: slot.required ? "missing" : "optional",
        })),
      });

  let workspaceArchive = bundle.files["workspace-base.tar.zst"]!;
  let workspaceEntries: Map<string, Uint8Array>;
  try {
    workspaceEntries = await unpackTarZstdEntries(workspaceArchive);
  } catch {
    incompleteReasons.push("legacy workspace snapshot format could not be restored as tar.zst");
    workspaceEntries = new Map();
    workspaceArchive = await packTarZstdEntries(workspaceEntries);
  }
  const workspaceFiles = [...workspaceEntries.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([entryPath, content]) => ({
      path: entryPath.replace(/^workspace\//, ""),
      sizeBytes: content.byteLength,
      sha256: sha256(content),
    }));
  const conversationText = Buffer.from(bundle.files["conversation.jsonl"]!).toString("utf8");
  const conversationLines = conversationText.split(/\r?\n/).filter((line) => line.trim());
  const agentEvents = conversationLines
    .map((line, index) => toJsonlRecord(line, index + 1, manifest.created_at))
    .join("\n");

  const report: LegacySessionPackMigrationReport = {
    schemaVersion: "lingban.session-pack-migration/v1",
    sourceManifestVersion: "lingban.session-pack/v1",
    targetManifestVersion: "lingban.session-pack/v2",
    sessionId: manifest.session_id,
    sessionVersionId: manifest.session_version,
    sourceArchiveSha256,
    sourceFileHashes: Object.fromEntries(
      Object.entries(bundle.files)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entryPath, content]) => [entryPath, sha256(content)])
    ),
    legacyIncomplete: true,
    incompleteReasons,
    migratedAt,
  };
  const files: Record<string, SessionPackV2FileInput> = {
    "capture-provenance.json": {
      content: json({
        source: "legacy-imported",
        sourceCaptureId,
        sourceArchiveSha256,
        originalSessionVersionId: manifest.session_version,
        legacyIncomplete: true,
        incompleteReasons,
      }),
      contentType: "application/json",
    },
    "agent-events.jsonl": { content: agentEvents ? `${agentEvents}\n` : "", contentType: "application/x-ndjson" },
    "conversation.jsonl": { content: bundle.files["conversation.jsonl"]!, contentType: "application/x-ndjson" },
    "tool-events.jsonl": { content: bundle.files["tool-events.jsonl"] ?? "", contentType: "application/x-ndjson" },
    "approval-events.jsonl": { content: "", contentType: "application/x-ndjson" },
    "workspace-base.tar.zst": { content: workspaceArchive, contentType: "application/zstd" },
    "workspace-inventory.json": {
      content: json({ schemaVersion: "lingban.workspace-inventory/v1", totalFiles: workspaceFiles.length, totalBytes: workspaceFiles.reduce((total, file) => total + file.sizeBytes, 0), files: workspaceFiles }),
      contentType: "application/json",
    },
    "artifact-index.json": { content: json({ outputs: manifest.artifact_contract.outputs }), contentType: "application/json" },
    "slot-schema.json": { content: json(slotSchema), contentType: "application/json" },
    "information-collection-review.json": { content: json(informationReview), contentType: "application/json" },
    "mcp-requirements.json": { content: json(mcpRequirements), contentType: "application/json" },
    "runtime-profile.json": { content: json(runtimeProfile), contentType: "application/json" },
    "runtime-config.json": { content: json(runtimeConfig), contentType: "application/json" },
    "provider-profile.json": { content: json({ source: "legacy-imported", providerId: null, model: null }), contentType: "application/json" },
    "validator-set.json": { content: bundle.files["validator-set.json"] ?? json({ validators: [] }), contentType: "application/json" },
    "redaction-map.json": { content: json(redactionMap), contentType: "application/json" },
    "validation-report.json": { content: json(report), contentType: "application/json" },
  };

  return {
    sourceCaptureId,
    files,
    report,
    metadata: {
      source: "legacy-imported",
      legacyIncomplete: true,
      sourceArchiveSha256,
      taskFamily: manifest.task_family,
    },
  };
}
