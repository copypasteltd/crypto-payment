import { createHash, createHmac, randomUUID, sign as signPayload } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  createSessionDraftInputSchema,
  createSessionDraftReplayInputSchema,
  createSessionDraftRevisionInputSchema,
  creatorPackageSessionBindingSchema,
  sealSessionDraftInputSchema,
  sealedSessionVersionRecordSchema,
  sessionAssetRecordSchema,
  sessionDraftRecordSchema,
  sessionDraftReplayRecordSchema,
  sessionDraftRevisionSchema,
  sessionRedactionReviewRecordSchema,
  submitSessionRedactionReviewInputSchema,
  type CreateSessionDraftInput,
  type CreateSessionDraftReplayInput,
  type CreateSessionDraftRevisionInput,
  type SessionDraftReplayCheck,
  type SessionPackRedactionRuleInput,
  type SealSessionDraftInput,
  type SubmitSessionRedactionReviewInput,
} from "@lingban/contracts";
import {
  buildSessionPackV2SignaturePayload,
  filterWorkspaceTarZstd,
  packSessionVersionV2,
  packTarZstdEntries,
  sessionPackInformationCollectionReviewFileSchema,
  sessionPackMcpRequirementsFileSchema,
  sessionPackRedactionMapSchema,
  sessionPackRuntimeConfigSchema,
  sessionPackRuntimeProfileSchema,
  sessionPackSlotSchemaFileSchema,
  unpackSessionVersionV2,
  unpackTarZstdEntries,
  validateSessionVersionV2Files,
  type SessionPackV2FileInput,
} from "@lingban/session-pack";
import { nowIso } from "@lingban/shared";
import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { creatorRepository } from "../creator/repository.js";
import { runsService } from "../runs/service.js";
import { sessionCaptureService } from "../session-captures/service.js";
import { ObjectStoreImmutableConflictError, objectStore } from "../uploads/object-store.js";
import { sessionAssetRepository } from "./repository.js";
import { registerSealedSessionVersion } from "./version-registry.js";
import { sessionControlMetrics } from "../session-control/metrics.js";

function requireSessionPackV2WriteEnabled() {
  if (!getApiRuntimeConfig().sessionPackV2WriteEnabled) {
    throw new AppError(503, "SESSION_PACK_V2_WRITE_DISABLED", "Session Pack v2 writes are disabled");
  }
}

async function readObject(objectKey: string) {
  const chunks: Buffer[] = [];
  const stream = await objectStore.createReadStream(objectKey);
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function replacementFor(value: string, rule: SessionPackRedactionRuleInput) {
  if (rule.strategy === "remove") return "";
  if (rule.strategy === "replace") return rule.replacement ?? "[REDACTED]";
  if (rule.strategy === "hash") return `sha256:${createHash("sha256").update(value).digest("hex")}`;
  return "*".repeat(Math.min(Math.max(value.length, 8), 64));
}

function redactText(text: string, rule: SessionPackRedactionRuleInput) {
  if (!rule.selector) return { text, matches: 0 };
  const matches = text.split(rule.selector).length - 1;
  return {
    text: matches > 0 ? text.split(rule.selector).join(replacementFor(rule.selector, rule)) : text,
    matches,
  };
}

type JsonSelectorToken = string | number | "*";

function parseJsonSelector(selector: string): { recursiveKey: string | null; tokens: JsonSelectorToken[] } | null {
  if (selector.startsWith("/")) {
    return {
      recursiveKey: null,
      tokens: selector.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~")),
    };
  }
  const recursive = /^\$\.\.([A-Za-z_$][\w$-]*)$/.exec(selector);
  if (recursive) return { recursiveKey: recursive[1]!, tokens: [] };
  if (!selector.startsWith("$.")) return null;
  const tokens: JsonSelectorToken[] = [];
  const source = selector.slice(2);
  for (const segment of source.split(".")) {
    const match = /^([A-Za-z_$][\w$-]*)(.*)$/.exec(segment);
    if (!match) return null;
    tokens.push(match[1]!);
    let suffix = match[2]!;
    while (suffix) {
      const bracket = /^\[(\*|\d+)\](.*)$/.exec(suffix);
      if (!bracket) return null;
      tokens.push(bracket[1] === "*" ? "*" : Number(bracket[1]));
      suffix = bracket[2]!;
    }
  }
  return { recursiveKey: null, tokens };
}

function applyJsonRule(source: string, rule: SessionPackRedactionRuleInput, pretty = true) {
  const selector = parseJsonSelector(rule.selector);
  if (!selector) return { text: source, matches: 0, handled: false };
  let root: unknown;
  try {
    root = JSON.parse(source) as unknown;
  } catch {
    return { text: source, matches: 0, handled: true };
  }

  const locations: Array<{ parent: Record<string, unknown> | unknown[]; key: string | number }> = [];
  const collectRecursive = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(collectRecursive);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === selector.recursiveKey) locations.push({ parent: value as Record<string, unknown>, key });
      collectRecursive(child);
    }
  };
  const collectPath = (value: unknown, index: number) => {
    const token = selector.tokens[index];
    if (token === undefined) return;
    const isLeaf = index === selector.tokens.length - 1;
    if (token === "*") {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (isLeaf) locations.push({ parent: value as Record<string, unknown>, key });
        else collectPath(child, index + 1);
      }
      return;
    }
    if (Array.isArray(value) && typeof token === "number" && token >= 0 && token < value.length) {
      if (isLeaf) locations.push({ parent: value, key: token });
      else collectPath(value[token], index + 1);
      return;
    }
    if (value && typeof value === "object" && typeof token === "string" && Object.prototype.hasOwnProperty.call(value, token)) {
      const record = value as Record<string, unknown>;
      if (isLeaf) locations.push({ parent: record, key: token });
      else collectPath(record[token], index + 1);
    }
  };

  if (selector.recursiveKey) collectRecursive(root);
  else if (selector.tokens.length > 0) collectPath(root, 0);
  const arrayRemovals = new Map<unknown[], number[]>();
  for (const location of locations) {
    const current = location.parent[location.key as never];
    if (rule.strategy === "remove") {
      if (Array.isArray(location.parent) && typeof location.key === "number") {
        const indexes = arrayRemovals.get(location.parent) ?? [];
        indexes.push(location.key);
        arrayRemovals.set(location.parent, indexes);
      } else {
        delete (location.parent as Record<string, unknown>)[String(location.key)];
      }
    } else {
      location.parent[location.key as never] = replacementFor(String(current ?? ""), rule) as never;
    }
  }
  for (const [array, indexes] of arrayRemovals) {
    for (const index of [...indexes].sort((left, right) => right - left)) array.splice(index, 1);
  }
  return {
    text: pretty ? JSON.stringify(root, null, 2) + "\n" : JSON.stringify(root),
    matches: locations.length,
    handled: true,
  };
}

function applyJsonlRule(source: string, rule: SessionPackRedactionRuleInput) {
  let matches = 0;
  let handled = true;
  const output: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const result = applyJsonRule(line, rule, false);
    output.push(result.text);
    matches += result.matches;
    handled = handled && result.handled;
  }
  return { text: output.length > 0 ? `${output.join("\n")}\n` : "", matches, handled };
}

function scanSensitiveText(entryPath: string, text: string) {
  const patterns = [
    { code: "OPENAI_STYLE_KEY", pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
    { code: "AWS_ACCESS_KEY", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
    { code: "JWT_TOKEN", pattern: /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g },
    { code: "BEARER_TOKEN", pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}/gi },
    { code: "AUTHORIZATION_HEADER", pattern: /\bAuthorization\s*:\s*[^\s]{12,}/gi },
    { code: "COOKIE_HEADER", pattern: /\b(?:Cookie|Set-Cookie)\s*:\s*[^\r\n]{12,}/gi },
    { code: "PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
    { code: "SECRET_ASSIGNMENT", pattern: /\b(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*[^\s]{8,}/gi },
    { code: "JSON_SECRET_FIELD", pattern: /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|cookie|authorization)"\s*:\s*"[^"\r\n]{8,}"/gi },
  ];
  return patterns.flatMap(({ code, pattern }) => [...text.matchAll(pattern)].map(() => ({ entryPath, code })));
}

async function applyRedactionAndSelection(
  workspaceArchive: Uint8Array,
  files: Record<string, SessionPackV2FileInput>,
  input: CreateSessionDraftRevisionInput
) {
  const filtered = await filterWorkspaceTarZstd(workspaceArchive, input.workspaceSelection);
  let workspaceEntries = filtered.entries;
  const report: Array<{ ruleId: string; matches: number; handled: boolean }> = [];

  for (const rule of input.redactionRules) {
    let matches = 0;
    let handled = true;
    if (rule.targetKind === "file-path") {
      const next = new Map(workspaceEntries);
      for (const [entryPath] of workspaceEntries) {
        const logicalPath = entryPath.replace(/^workspace\//, "");
        if (logicalPath === rule.selector || logicalPath.startsWith(`${rule.selector.replace(/\/$/, "")}/`)) {
          matches += 1;
          if (rule.strategy === "remove") next.delete(entryPath);
          else handled = false;
        }
      }
      workspaceEntries = next;
    } else if (rule.targetKind === "text" || rule.targetKind === "header" || rule.targetKind === "cookie") {
      for (const [entryPath, descriptor] of Object.entries(files)) {
        if (typeof descriptor.content !== "string") continue;
        const result = redactText(descriptor.content, rule);
        descriptor.content = result.text;
        matches += result.matches;
      }
      for (const [entryPath, content] of workspaceEntries) {
        if (content.byteLength > 2 * 1024 * 1024 || content.includes(0)) continue;
        const source = Buffer.from(content).toString("utf8");
        const result = redactText(source, rule);
        if (result.matches > 0) workspaceEntries.set(entryPath, Buffer.from(result.text, "utf8"));
        matches += result.matches;
      }
    } else if (rule.targetKind === "json-path") {
      for (const [entryPath, descriptor] of Object.entries(files)) {
        if (typeof descriptor.content !== "string") continue;
        const result = entryPath.endsWith(".jsonl")
          ? applyJsonlRule(descriptor.content, rule)
          : applyJsonRule(descriptor.content, rule);
        descriptor.content = result.text;
        matches += result.matches;
        handled = handled && result.handled;
      }
      for (const [entryPath, content] of workspaceEntries) {
        if (!entryPath.toLowerCase().endsWith(".json") || content.byteLength > 2 * 1024 * 1024 || content.includes(0)) continue;
        const result = applyJsonRule(Buffer.from(content).toString("utf8"), rule);
        if (result.matches > 0) workspaceEntries.set(entryPath, Buffer.from(result.text, "utf8"));
        matches += result.matches;
        handled = handled && result.handled;
      }
    } else {
      handled = false;
    }
    report.push({ ruleId: rule.ruleId, matches, handled });
  }

  const findings = [
    ...Object.entries(files).flatMap(([entryPath, descriptor]) =>
      typeof descriptor.content === "string" ? scanSensitiveText(entryPath, descriptor.content) : []
    ),
    ...[...workspaceEntries.entries()].flatMap(([entryPath, content]) =>
      content.byteLength <= 2 * 1024 * 1024 && !content.includes(0)
        ? scanSensitiveText(entryPath, Buffer.from(content).toString("utf8"))
        : []
    ),
  ];
  return {
    workspaceArchive: await packTarZstdEntries(workspaceEntries),
    workspaceEntries,
    report,
    findings,
    passed: report.every((item) => item.handled) && findings.length === 0,
  };
}

type WorkspaceInventoryFile = {
  path: string;
  sizeBytes: number;
  sha256: string;
  modifiedAt: string;
};

type WorkspaceInventory = {
  schemaVersion: string;
  targetPath: string;
  totalFiles: number;
  totalBytes: number;
  files: WorkspaceInventoryFile[];
};

function buildCandidateWorkspaceInventory(
  entries: Map<string, Uint8Array>,
  sourceInventoryContent: Buffer,
  targetPath: string
): WorkspaceInventory {
  const source = JSON.parse(sourceInventoryContent.toString("utf8")) as Partial<WorkspaceInventory>;
  const sourceByPath = new Map((source.files ?? []).map((item) => [item.path, item]));
  const files = [...entries.entries()]
    .map(([entryPath, content]) => {
      const logicalPath = entryPath.replace(/^workspace\//, "");
      return {
        path: logicalPath,
        sizeBytes: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
        modifiedAt: sourceByPath.get(logicalPath)?.modifiedAt ?? "1970-01-01T00:00:00.000Z",
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  return {
    schemaVersion: "lingban.workspace-inventory/v1",
    targetPath,
    totalFiles: files.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    files,
  };
}

function countJsonl(content: Uint8Array) {
  let count = 0;
  for (const [index, line] of Buffer.from(content).toString("utf8").split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      JSON.parse(line);
      count += 1;
    } catch (error) {
      throw new Error(`Invalid JSONL record at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return count;
}

function toJson(value: unknown) {
  return JSON.stringify(value, null, 2) + "\n";
}

function buildSlotSchemaFile(snapshot: ReturnType<typeof runsService.getRun>) {
  const slots = snapshot.informationCollection.slots.map((slot) => ({
    key: slot.key,
    title: slot.title,
    type: slot.type,
    required: slot.required,
    secret: slot.secret,
    repeatable: slot.repeatable,
    ...(slot.prompt ? { prompt: slot.prompt } : {}),
    ...(slot.description ? { description: slot.description } : {}),
    ...(slot.placeholder ? { placeholder: slot.placeholder } : {}),
    choices: slot.choices.map((choice) => ({
      value: choice.value,
      ...(choice.label ? { label: choice.label } : {}),
    })),
    accepts: slot.accepts,
  }));
  return sessionPackSlotSchemaFileSchema.parse({
    version: snapshot.informationCollection.slotSchemaVersion ?? "captured.v2",
    slots: slots.length > 0 ? slots : [{
      key: "request_context",
      title: "Request context",
      type: "string",
      required: false,
      secret: false,
      repeatable: false,
      prompt: "Describe the request context for this session instance.",
      choices: [],
      accepts: [],
    }],
  });
}

function maxNullableIso(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function buildInformationCollectionReviewFile(snapshot: ReturnType<typeof runsService.getRun>) {
  const collection = snapshot.informationCollection;
  const slots = collection.slots.map((slot) => {
    const answers = collection.answers.filter((answer) => answer.slotKey === slot.key);
    const latest = answers.at(-1) ?? null;
    const effective = [...answers].reverse().find((answer) => answer.reviewStatus !== "rejected" && answer.reviewStatus !== "superseded") ?? null;
    return {
      key: slot.key,
      title: slot.title,
      type: slot.type,
      required: slot.required,
      secret: slot.secret,
      status: slot.status,
      answer_count: slot.answerCount,
      tracked_answer_count: answers.length,
      user_message_answer_count: answers.filter((answer) => answer.source === "user-message").length,
      manual_review_answer_count: answers.filter((answer) => answer.source === "manual-review").length,
      revision_count: answers.filter((answer) => answer.supersedesAnswerId != null).length,
      pending_review_count: answers.filter((answer) => answer.reviewStatus === "pending").length,
      approved_review_count: answers.filter((answer) => answer.reviewStatus === "approved").length,
      rejected_review_count: answers.filter((answer) => answer.reviewStatus === "rejected").length,
      superseded_review_count: answers.filter((answer) => answer.reviewStatus === "superseded").length,
      last_answered_at: maxNullableIso(answers.map((answer) => answer.createdAt)),
      last_reviewed_at: maxNullableIso(answers.map((answer) => answer.reviewedAt)),
      latest_answer_id: latest?.answerId ?? null,
      latest_source: latest?.source ?? null,
      latest_source_message_id: latest?.sourceMessageId ?? null,
      effective_answer_id: effective?.answerId ?? null,
      effective_source: effective?.source ?? null,
      effective_source_message_id: effective?.sourceMessageId ?? null,
      answers: answers.map((answer) => ({
        answer_id: answer.answerId,
        kind: answer.kind,
        source: answer.source,
        source_message_id: answer.sourceMessageId,
        review_status: answer.reviewStatus,
        reviewed_at: answer.reviewedAt,
        reviewed_by_user_id: answer.reviewedByUserId,
        supersedes_answer_id: answer.supersedesAnswerId,
        superseded_by_answer_id: answer.supersededByAnswerId,
        created_at: answer.createdAt,
      })),
    };
  });
  return sessionPackInformationCollectionReviewFileSchema.parse({
    version: "review.v2",
    slot_schema_version: collection.slotSchemaVersion,
    total_slots: slots.length,
    required_slots: slots.filter((slot) => slot.required).length,
    satisfied_slots: slots.filter((slot) => slot.status === "satisfied").length,
    total_answers: collection.answers.length,
    user_message_answer_count: collection.answers.filter((answer) => answer.source === "user-message").length,
    manual_review_answer_count: collection.answers.filter((answer) => answer.source === "manual-review").length,
    revision_count: collection.answers.filter((answer) => answer.supersedesAnswerId != null).length,
    pending_review_count: collection.pendingReviewCount,
    approved_review_count: collection.approvedReviewCount,
    rejected_review_count: collection.rejectedReviewCount,
    superseded_review_count: collection.answers.filter((answer) => answer.reviewStatus === "superseded").length,
    latest_answered_at: maxNullableIso(collection.answers.map((answer) => answer.createdAt)),
    latest_reviewed_at: maxNullableIso(collection.answers.map((answer) => answer.reviewedAt)),
    slots,
  });
}

export class SessionDraftService {
  async getSession(sessionId: string) {
    const session = await sessionAssetRepository.getSession(sessionId);
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND", `Session not found: ${sessionId}`);
    return session;
  }

  async listVersions(sessionId: string) {
    await this.getSession(sessionId);
    return sessionAssetRepository.listVersions(sessionId);
  }

  async getVersion(sessionVersionId: string) {
    const version = await sessionAssetRepository.getVersion(sessionVersionId);
    if (!version) throw new AppError(404, "SESSION_VERSION_NOT_FOUND", `Session version not found: ${sessionVersionId}`);
    const session = await this.getSession(version.sessionId);
    return { session, version };
  }

  async getPackageBindings(packageId: string) {
    const pkg = creatorRepository.getPackageById(packageId);
    if (!pkg) throw new AppError(404, "CREATOR_PACKAGE_NOT_FOUND", `Creator package not found: ${packageId}`);
    const [active, candidate] = await Promise.all([
      sessionAssetRepository.getPackageBinding(packageId, "active"),
      sessionAssetRepository.getPackageBinding(packageId, "candidate"),
    ]);
    return { active, candidate };
  }

  async createFromCapture(captureId: string, input: CreateSessionDraftInput, userId: string | null) {
    requireSessionPackV2WriteEnabled();
    const parsed = createSessionDraftInputSchema.parse(input);
    const capture = await sessionCaptureService.get(captureId);
    if (capture.status !== "CAPTURED" || capture.securityState === "blocked") {
      throw new AppError(409, "SESSION_CAPTURE_NOT_READY", `Capture is unavailable for draft creation: ${capture.status}`);
    }
    const at = nowIso();
    let session = parsed.sessionId ? await sessionAssetRepository.getSession(parsed.sessionId) : null;
    if (parsed.sessionId && !session) throw new AppError(404, "SESSION_NOT_FOUND", `Session not found: ${parsed.sessionId}`);
    if (session && session.workspaceId !== capture.workspaceId) throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    if (!session) {
      session = await sessionAssetRepository.createSession(sessionAssetRecordSchema.parse({
        sessionId: `ses_${randomUUID()}`,
        workspaceId: capture.workspaceId,
        name: parsed.sessionName ?? runsService.getRun(capture.runId).run.title,
        description: parsed.sessionDescription,
        taskFamily: parsed.taskFamily,
        status: "active",
        createdByUserId: userId,
        createdAt: at,
        updatedAt: at,
      }));
    }
    const draft = await sessionAssetRepository.createDraft(sessionDraftRecordSchema.parse({
      draftId: `sdf_${randomUUID()}`,
      sessionId: session.sessionId,
      sourceCaptureId: captureId,
      parentSessionVersionId: parsed.parentSessionVersionId,
      status: "editing",
      createdByUserId: userId,
      createdAt: at,
      updatedAt: at,
    }));
    return { session, draft };
  }

  async get(draftId: string) {
    const draft = await sessionAssetRepository.getDraft(draftId);
    if (!draft) throw new AppError(404, "SESSION_DRAFT_NOT_FOUND", `Session draft not found: ${draftId}`);
    const session = await sessionAssetRepository.getSession(draft.sessionId);
    return {
      session,
      draft,
      revisions: await sessionAssetRepository.listRevisions(draftId),
      reviews: await sessionAssetRepository.listReviews(draftId),
      replays: await sessionAssetRepository.listReplays(draftId),
      versions: await sessionAssetRepository.listVersions(draft.sessionId),
    };
  }

  async list(workspaceId: string) {
    return sessionAssetRepository.listDrafts(workspaceId);
  }

  async createRevision(draftId: string, input: CreateSessionDraftRevisionInput, userId: string | null) {
    requireSessionPackV2WriteEnabled();
    const buildStartedAt = Date.now();
    const parsed = createSessionDraftRevisionInputSchema.parse(input);
    const detail = await this.get(draftId);
    const capture = await sessionCaptureService.get(detail.draft.sourceCaptureId);
    if (capture.workspaceId !== detail.session?.workspaceId) throw new AppError(404, "SESSION_DRAFT_NOT_FOUND", "Session draft not found");
    const objectByType = new Map(capture.objects.map((object) => [object.objectType, object]));
    const requiredTypes = ["raw_events", "thread", "workspace", "inventory", "manifest"] as const;
    for (const type of requiredTypes) if (!objectByType.has(type)) throw new AppError(409, "SESSION_CAPTURE_OBJECT_MISSING", `Capture object missing: ${type}`);
    const [rawEvents, thread, workspaceArchive, inventoryArchive] = await Promise.all([
      readObject(objectByType.get("raw_events")!.objectKey),
      readObject(objectByType.get("thread")!.objectKey),
      readObject(objectByType.get("workspace")!.objectKey),
      readObject(objectByType.get("inventory")!.objectKey),
    ]);
    const sourceInventoryContent = gunzipSync(inventoryArchive);
    const snapshot = runsService.getRun(capture.runId);
    const startJob = runsService.getStartRunJobPayload(capture.runId);
    const runtimeProfileId = `runtime:${snapshot.runtime.launchMode ?? "standard"}:${snapshot.run.taskVersionId}`;
    const browserRequired = startJob.mcpBindings.some((binding) => /browser|playwright/i.test(`${binding.displayName} ${binding.ref}`));
    const mcpRequirements = sessionPackMcpRequirementsFileSchema.parse({
      connectors: startJob.mcpBindings.map((binding) => ({
        id: binding.mcpId,
        name: binding.displayName,
        protocol: binding.transport,
        risk_level: binding.riskLevel,
        required: true,
      })),
      credentials: startJob.credentialMounts.map((mount) => ({
        id: mount.credentialId,
        placement: mount.mode,
        required: true,
      })),
    });
    const runtimeProfile = sessionPackRuntimeProfileSchema.parse({
      profile_id: runtimeProfileId,
      browser_required: browserRequired,
      playwright_required: browserRequired,
    });
    const runtimeConfig = sessionPackRuntimeConfigSchema.parse({
      profile_id: runtimeProfileId,
      entrypoint: "codex app-server",
      command: [],
      args: [],
      env: {},
      working_directory: snapshot.run.targetPath,
    });
    const redactionMap = sessionPackRedactionMapSchema.parse({
      version: "lingban.redaction-map/v2",
      secret_slot_keys: snapshot.informationCollection.slots.filter((slot) => slot.secret).map((slot) => slot.key),
      rules: parsed.redactionRules.map((rule) => ({
        rule_id: rule.ruleId,
        ...(rule.slotKey ? { slot_key: rule.slotKey } : {}),
        target: { kind: rule.targetKind, selector: rule.selector },
        strategy: rule.strategy,
        ...(rule.replacement ? { replacement: rule.replacement } : {}),
        ...(rule.rationale ? { rationale: rule.rationale } : {}),
      })),
    });
    const providerProfile = snapshot.provider
      ? {
          providerId: snapshot.provider.providerId,
          model: snapshot.provider.model,
          adapterMode: snapshot.provider.adapterMode,
          apiStyle: snapshot.provider.apiStyle,
        }
      : null;
    const validatorSet = {
      validators: ["manifest-hash", "workspace-inventory", "sensitive-content", "replay-required"],
    };
    const inputFingerprint = stableHash({
      captureHash: capture.captureManifestSha256,
      workspaceSelection: parsed.workspaceSelection,
      redactionRules: parsed.redactionRules,
      mcpRequirements,
      runtimeProfile,
      runtimeConfig,
      providerProfile,
      validatorSet,
    });
    const existingRevision = detail.revisions.find((item) => item.inputFingerprint === inputFingerprint);
    if (existingRevision) return { draft: detail.draft, revision: existingRevision };
    const revisionNumber = (detail.revisions[0]?.revisionNumber ?? 0) + 1;
    const revisionId = `sdr_${inputFingerprint}`;
    const at = capture.capturedAt ?? capture.requestedAt;
    const files: Record<string, SessionPackV2FileInput> = {
      "capture-provenance.json": { content: gunzipSync(thread), contentType: "application/json" },
      "agent-events.jsonl": { content: gunzipSync(rawEvents), contentType: "application/x-ndjson" },
      "conversation.jsonl": { content: snapshot.messages.map((message) => JSON.stringify(message)).join("\n") + "\n", contentType: "application/x-ndjson" },
      "tool-events.jsonl": { content: gunzipSync(rawEvents).toString("utf8").split("\n").filter((line) => /command|tool|mcp|fileChange/i.test(line)).join("\n") + "\n", contentType: "application/x-ndjson" },
      "approval-events.jsonl": { content: snapshot.approvals.map((approval) => JSON.stringify(approval)).join("\n") + "\n", contentType: "application/x-ndjson" },
      "workspace-inventory.json": { content: sourceInventoryContent, contentType: "application/json" },
      "artifact-index.json": { content: toJson(snapshot.artifacts), contentType: "application/json" },
      "slot-schema.json": { content: toJson(buildSlotSchemaFile(snapshot)), contentType: "application/json" },
      "information-collection-review.json": { content: toJson(buildInformationCollectionReviewFile(snapshot)), contentType: "application/json" },
      "mcp-requirements.json": { content: toJson(mcpRequirements), contentType: "application/json" },
      "runtime-profile.json": { content: toJson(runtimeProfile), contentType: "application/json" },
      "runtime-config.json": { content: toJson(runtimeConfig), contentType: "application/json" },
      "provider-profile.json": { content: toJson(providerProfile), contentType: "application/json" },
      "validator-set.json": { content: toJson(validatorSet), contentType: "application/json" },
      "redaction-map.json": { content: toJson(redactionMap), contentType: "application/json" },
      "validation-report.json": { content: toJson({ valid: false, state: "building", generatedAt: at }), contentType: "application/json" },
    };
    const redaction = await applyRedactionAndSelection(workspaceArchive, files, parsed);
    files["workspace-base.tar.zst"] = { content: redaction.workspaceArchive, contentType: "application/zstd" };
    files["workspace-inventory.json"] = {
      content: toJson(buildCandidateWorkspaceInventory(
        redaction.workspaceEntries,
        sourceInventoryContent,
        parsed.workspaceSelection.targetPath
      )),
      contentType: "application/json",
    };
    const packValidation = await validateSessionVersionV2Files(files);
    const validationReport = {
      valid: redaction.passed && packValidation.ok,
      requiredFileCount: Object.keys(files).length,
      redaction: redaction.report,
      sensitiveFindings: redaction.findings,
      packIssues: packValidation.issues,
      generatedAt: at,
    };
    files["validation-report.json"] = { content: toJson(validationReport), contentType: "application/json" };
    const packed = await packSessionVersionV2({
      sessionId: detail.draft.sessionId,
      sourceCaptureId: capture.captureId,
      sourceRevisionId: revisionId,
      parentSessionVersionId: detail.draft.parentSessionVersionId,
      createdAt: at,
      metadata: { draftId, revisionNumber },
      files,
    });
    const objectKey = `session-drafts/${draftId}/revisions/${revisionId}/${packed.sha256}.session-pack.tar.zst`;
    let stored;
    try {
      stored = await objectStore.putBufferImmutable(objectKey, {
        content: Buffer.from(packed.archive),
        contentType: "application/zstd",
      });
    } catch (error) {
      if (error instanceof ObjectStoreImmutableConflictError) {
        throw new AppError(409, "SESSION_DRAFT_HASH_MISMATCH", "Immutable candidate pack object conflict");
      }
      throw error;
    }
    if (stored.sha256 !== packed.sha256) throw new AppError(409, "SESSION_DRAFT_HASH_MISMATCH", "Candidate pack hash verification failed");
    const revision = sessionDraftRevisionSchema.parse({
      revisionId,
      draftId,
      revisionNumber,
      inputFingerprint,
      workspaceSelection: parsed.workspaceSelection,
      redactionRules: parsed.redactionRules,
      candidateObjectKey: objectKey,
      candidateSha256: packed.sha256,
      candidateSizeBytes: packed.sizeBytes,
      validationReport,
      securityReport: { passed: validationReport.valid, findings: redaction.findings, packIssues: packValidation.issues },
      createdByUserId: userId,
      createdAt: at,
    });
    const nextDraft = sessionDraftRecordSchema.parse({ ...detail.draft, status: "redaction_pending", currentRevisionId: revisionId, version: detail.draft.version + 1, updatedAt: at });
    const updated = await sessionAssetRepository.addRevision(nextDraft, revision, parsed.expectedVersion);
    if (!updated) throw new AppError(409, "SESSION_DRAFT_REVISION_CONFLICT", `Draft changed concurrently: ${draftId}`);
    sessionControlMetrics.draftBuilt((Date.now() - buildStartedAt) / 1000, redaction.findings.length);
    return { draft: updated, revision };
  }

  async reviewRedaction(draftId: string, input: SubmitSessionRedactionReviewInput, userId: string | null) {
    const parsed = submitSessionRedactionReviewInputSchema.parse(input);
    const detail = await this.get(draftId);
    const revision = detail.revisions.find((item) => item.revisionId === parsed.revisionId);
    if (!revision || detail.draft.currentRevisionId !== revision.revisionId) throw new AppError(409, "SESSION_DRAFT_REVISION_CONFLICT", "Review must target the current revision");
    if (parsed.decision === "approved" && revision.securityReport.passed !== true) throw new AppError(409, "SESSION_REDACTION_COVERAGE_INCOMPLETE", "Sensitive-content validation must pass before approval");
    const at = nowIso();
    const review = sessionRedactionReviewRecordSchema.parse({ reviewId: `srw_${randomUUID()}`, draftId, revisionId: revision.revisionId, decision: parsed.decision, note: parsed.note, reviewedByUserId: userId, reviewedAt: at });
    const next = sessionDraftRecordSchema.parse({ ...detail.draft, status: parsed.decision === "approved" ? "ready_to_seal" : "editing", version: detail.draft.version + 1, updatedAt: at });
    const updated = await sessionAssetRepository.addReview(review, next, parsed.expectedVersion);
    if (!updated) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Draft changed concurrently: ${draftId}`);
    return { draft: updated, review };
  }

  async replay(draftId: string, input: CreateSessionDraftReplayInput, userId: string | null) {
    const parsed = createSessionDraftReplayInputSchema.parse(input);
    const detail = await this.get(draftId);
    const revision = detail.revisions.find((item) => item.revisionId === parsed.revisionId);
    if (!revision || detail.draft.currentRevisionId !== revision.revisionId) {
      throw new AppError(409, "SESSION_DRAFT_REVISION_CONFLICT", "Replay must target the current revision");
    }

    const startedAt = nowIso();
    const checks: SessionDraftReplayCheck[] = [];
    let restoredFileCount = 0;
    let restoredBytes = 0;
    let eventCount = 0;
    let conversationMessageCount = 0;
    let toolEventCount = 0;
    let approvalEventCount = 0;
    const addCheck = (
      checkId: string,
      passed: boolean,
      detailText: string,
      expected: unknown = null,
      actual: unknown = null
    ) => checks.push({
      checkId,
      status: passed ? "passed" : "failed",
      detail: detailText,
      expected,
      actual,
    });

    try {
      const candidateArchive = await readObject(revision.candidateObjectKey);
      const candidateSha256 = createHash("sha256").update(candidateArchive).digest("hex");
      const archiveHashMatches = candidateSha256 === revision.candidateSha256;
      addCheck(
        "candidate-archive-hash",
        archiveHashMatches,
        archiveHashMatches ? "Candidate archive hash matches the immutable revision reference" : "Candidate archive hash mismatch",
        revision.candidateSha256,
        candidateSha256
      );
      if (!archiveHashMatches) throw new Error("Candidate archive hash mismatch");

      const candidate = await unpackSessionVersionV2(candidateArchive);
      addCheck(
        "manifest-revision-binding",
        candidate.manifest.sourceRevisionId === revision.revisionId,
        "Manifest source revision binding was verified",
        revision.revisionId,
        candidate.manifest.sourceRevisionId
      );

      const packFiles = Object.fromEntries(
        [...candidate.files.entries()]
          .filter(([entryPath]) => entryPath !== "manifest.json")
          .map(([entryPath, content]) => [entryPath, { content }])
      );
      const packValidation = await validateSessionVersionV2Files(packFiles);
      addCheck(
        "pack-schema",
        packValidation.ok,
        packValidation.ok ? "Required files, JSON, JSONL and file schemas passed" : "Session Pack schema validation failed",
        [],
        packValidation.issues
      );

      const workspaceArchive = candidate.files.get("workspace-base.tar.zst");
      const inventoryContent = candidate.files.get("workspace-inventory.json");
      if (!workspaceArchive || !inventoryContent) throw new Error("Workspace replay inputs are missing");
      const workspaceEntries = await unpackTarZstdEntries(workspaceArchive);
      const inventory = JSON.parse(Buffer.from(inventoryContent).toString("utf8")) as Partial<WorkspaceInventory>;
      if (!Array.isArray(inventory.files)) throw new Error("Workspace inventory files are invalid");
      const actualFiles = [...workspaceEntries.entries()]
        .map(([entryPath, content]) => ({
          path: entryPath.replace(/^workspace\//, ""),
          sizeBytes: content.byteLength,
          sha256: createHash("sha256").update(content).digest("hex"),
        }))
        .sort((left, right) => left.path.localeCompare(right.path));
      const expectedFiles = inventory.files
        .map((file) => ({ path: file.path, sizeBytes: file.sizeBytes, sha256: file.sha256 }))
        .sort((left, right) => left.path.localeCompare(right.path));
      restoredFileCount = actualFiles.length;
      restoredBytes = actualFiles.reduce((total, file) => total + file.sizeBytes, 0);
      const inventoryMatches = stableHash(actualFiles) === stableHash(expectedFiles)
        && inventory.totalFiles === restoredFileCount
        && inventory.totalBytes === restoredBytes;
      addCheck(
        "workspace-inventory",
        inventoryMatches,
        inventoryMatches ? "Restored workspace files match the candidate inventory" : "Restored workspace differs from the candidate inventory",
        { fileCount: inventory.totalFiles, totalBytes: inventory.totalBytes, fingerprint: stableHash(expectedFiles) },
        { fileCount: restoredFileCount, totalBytes: restoredBytes, fingerprint: stableHash(actualFiles) }
      );

      eventCount = countJsonl(candidate.files.get("agent-events.jsonl") ?? new Uint8Array());
      conversationMessageCount = countJsonl(candidate.files.get("conversation.jsonl") ?? new Uint8Array());
      toolEventCount = countJsonl(candidate.files.get("tool-events.jsonl") ?? new Uint8Array());
      approvalEventCount = countJsonl(candidate.files.get("approval-events.jsonl") ?? new Uint8Array());
      addCheck(
        "event-streams",
        true,
        "Agent, conversation, tool and approval JSONL streams were restored and parsed",
        null,
        { eventCount, conversationMessageCount, toolEventCount, approvalEventCount }
      );
    } catch (error) {
      addCheck(
        "restore-completion",
        false,
        error instanceof Error ? error.message : String(error)
      );
    }

    const finishedAt = nowIso();
    const failed = checks.find((check) => check.status === "failed") ?? null;
    const replay = sessionDraftReplayRecordSchema.parse({
      replayId: `replay_${randomUUID()}`,
      draftId,
      revisionId: revision.revisionId,
      mode: "restore-validation",
      validatorVersion: "session-replay/v1",
      status: failed ? "failed" : "passed",
      candidateSha256: revision.candidateSha256,
      checks,
      restoredFileCount,
      restoredBytes,
      eventCount,
      conversationMessageCount,
      toolEventCount,
      approvalEventCount,
      failureCode: failed?.checkId ?? null,
      createdByUserId: userId,
      startedAt,
      finishedAt,
    });
    const next = sessionDraftRecordSchema.parse({
      ...detail.draft,
      version: detail.draft.version + 1,
      updatedAt: finishedAt,
    });
    const updated = await sessionAssetRepository.addReplay(replay, next, parsed.expectedVersion);
    if (!updated) throw new AppError(409, "RESOURCE_VERSION_CONFLICT", `Draft changed concurrently: ${draftId}`);
    sessionControlMetrics.replayCompleted(
      replay.status,
      Math.max(0, Date.parse(replay.finishedAt) - Date.parse(replay.startedAt)) / 1000
    );
    return { draft: updated, replay };
  }

  async seal(draftId: string, input: SealSessionDraftInput, userId: string | null) {
    requireSessionPackV2WriteEnabled();
    if (!getApiRuntimeConfig().sessionVersionImmutabilityEnforced) {
      throw new AppError(
        503,
        "SESSION_VERSION_IMMUTABILITY_DISABLED",
        "Session version sealing requires immutability enforcement"
      );
    }
    const parsed = sealSessionDraftInputSchema.parse(input);
    const detail = await this.get(draftId);
    if (detail.draft.status !== "ready_to_seal" || detail.draft.currentRevisionId !== parsed.revisionId) throw new AppError(409, "SESSION_REVIEW_REQUIRED", "Draft requires an approved current revision");
    const revision = detail.revisions.find((item) => item.revisionId === parsed.revisionId)!;
    const approved = detail.reviews.some((review) => review.revisionId === revision.revisionId && review.decision === "approved");
    if (!approved || revision.securityReport.passed !== true) throw new AppError(409, "SESSION_REVIEW_REQUIRED", "Draft review or security validation is incomplete");
    const replay = detail.replays.find((item) => item.replayId === parsed.replayId);
    if (!replay || replay.revisionId !== revision.revisionId || replay.candidateSha256 !== revision.candidateSha256 || replay.status !== "passed") {
      throw new AppError(409, "SESSION_REPLAY_GATE_REQUIRED", "A passed Replay Gate for the current revision is required");
    }
    const config = getApiRuntimeConfig();
    if (!config.sessionPackSignatureEnabled || !config.sessionPackSignatureKeyId) throw new AppError(409, "SESSION_SIGNING_POLICY_REQUIRED", "Session Pack signing must be configured before sealing");
    const candidate = await unpackSessionVersionV2(await readObject(revision.candidateObjectKey));
    const sessionVersionId = `sev_${randomUUID()}`;
    const at = nowIso();
    const files = Object.fromEntries([...candidate.files.entries()].filter(([entryPath]) => entryPath !== "manifest.json").map(([entryPath, content]) => [entryPath, { content }]));
    const packInput = { sessionId: detail.draft.sessionId, sessionVersionId, sourceCaptureId: detail.draft.sourceCaptureId, sourceRevisionId: revision.revisionId, parentSessionVersionId: detail.draft.parentSessionVersionId, createdAt: at, metadata: { signingPolicyId: parsed.signingPolicyId, replayId: replay.replayId }, files };
    const unsignedPacked = await packSessionVersionV2(packInput);
    const signaturePayload = buildSessionPackV2SignaturePayload(unsignedPacked.manifest);
    let signatureAlgorithm: "hmac-sha256" | "ed25519";
    let signatureValue: string;
    if (config.sessionPackSignatureAlgorithm === "ed25519" && config.sessionPackSignatureEd25519PrivateKeyPem) {
      signatureAlgorithm = "ed25519";
      signatureValue = signPayload(null, signaturePayload, config.sessionPackSignatureEd25519PrivateKeyPem).toString("base64");
    } else if (config.sessionPackSignatureHmacSecret || config.sessionPackSignatureHmacKeysByKeyId[config.sessionPackSignatureKeyId]) {
      signatureAlgorithm = "hmac-sha256";
      signatureValue = createHmac(
        "sha256",
        config.sessionPackSignatureHmacSecret
          ?? config.sessionPackSignatureHmacKeysByKeyId[config.sessionPackSignatureKeyId]
      ).update(signaturePayload).digest("hex");
    } else {
      throw new AppError(409, "SESSION_SIGNING_POLICY_REQUIRED", "Configured Session Pack signing key is unavailable");
    }
    const packed = await packSessionVersionV2({
      ...packInput,
      signature: {
        algorithm: signatureAlgorithm,
        keyId: config.sessionPackSignatureKeyId,
        value: signatureValue,
      },
    });
    const objectKey = `session-versions/${sessionVersionId}/${packed.sha256}.session-pack.tar.zst`;
    let stored;
    try {
      stored = await objectStore.putBufferImmutable(objectKey, {
        content: Buffer.from(packed.archive),
        contentType: "application/zstd",
      });
    } catch (error) {
      if (error instanceof ObjectStoreImmutableConflictError) {
        throw new AppError(409, "SESSION_VERSION_HASH_MISMATCH", "Immutable sealed pack object conflict");
      }
      throw error;
    }
    if (stored.sha256 !== packed.sha256) throw new AppError(409, "SESSION_VERSION_HASH_MISMATCH", "Sealed pack hash verification failed");
    const version = sealedSessionVersionRecordSchema.parse({ sessionVersionId, sessionId: detail.draft.sessionId, sealedFromRevisionId: revision.revisionId, sealedFromReplayId: replay.replayId, parentSessionVersionId: detail.draft.parentSessionVersionId, manifestVersion: "lingban.session-pack/v2", packObjectKey: objectKey, packSha256: packed.sha256, packSizeBytes: packed.sizeBytes, signatureAlgorithm, signatureKeyId: config.sessionPackSignatureKeyId, signatureValue, contentState: "sealed", sealedByUserId: userId, sealedAt: at });
    const nextDraft = sessionDraftRecordSchema.parse({ ...detail.draft, status: "sealed", version: detail.draft.version + 1, updatedAt: at });
    const saved = await sessionAssetRepository.sealVersion({ version, draft: nextDraft, expectedDraftVersion: parsed.expectedVersion, lineage: detail.draft.parentSessionVersionId ? { parentVersionId: detail.draft.parentSessionVersionId, childVersionId: sessionVersionId, relationType: "derived", reason: "sealed from session draft", createdAt: at } : null });
    if (!saved) throw new AppError(409, "SESSION_VERSION_ALREADY_SEALED", `Draft changed concurrently: ${draftId}`);
    registerSealedSessionVersion(saved);
    sessionControlMetrics.versionSealed();
    return { draft: nextDraft, version: saved };
  }

  async bindPackage(packageId: string, input: { sessionVersionId: string; state: "candidate" | "active" | "inactive"; expectedVersion: number }) {
    if (!getApiRuntimeConfig().creatorExplicitSessionBindingEnabled) {
      throw new AppError(
        503,
        "CREATOR_EXPLICIT_SESSION_BINDING_DISABLED",
        "Explicit Creator Package session binding is disabled"
      );
    }
    const pkg = creatorRepository.getPackageById(packageId);
    if (!pkg) throw new AppError(404, "CREATOR_PACKAGE_NOT_FOUND", `Creator package not found: ${packageId}`);
    const version = await sessionAssetRepository.getVersion(input.sessionVersionId);
    if (!version) throw new AppError(404, "SESSION_VERSION_NOT_FOUND", `Session version not found: ${input.sessionVersionId}`);
    if (input.state === "active" && version.legacyIncomplete) {
      throw new AppError(
        409,
        "LEGACY_SESSION_REPLAY_REQUIRED",
        "Legacy-imported Session Versions require a captured revision and passed Replay Gate before activation"
      );
    }
    const at = nowIso();
    const binding = creatorPackageSessionBindingSchema.parse({ bindingId: `cpsb_${randomUUID()}`, packageId, sessionVersionId: version.sessionVersionId, state: input.state, version: input.expectedVersion + 1, createdAt: at, updatedAt: at });
    const saved = await sessionAssetRepository.putPackageBinding(binding, input.expectedVersion);
    if (!saved) throw new AppError(409, "CREATOR_PACKAGE_SESSION_BINDING_CONFLICT", `Package binding changed concurrently: ${packageId}`);
    await creatorRepository.savePackage({ ...pkg, currentSessionVersionId: input.state === "active" ? version.sessionVersionId : pkg.currentSessionVersionId, candidateSessionVersionId: input.state === "candidate" ? version.sessionVersionId : pkg.candidateSessionVersionId });
    return saved;
  }
}

export const sessionDraftService = new SessionDraftService();
