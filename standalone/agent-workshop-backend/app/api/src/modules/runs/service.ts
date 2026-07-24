import {
  approveRunInputSchema,
  bridgeEventSchema,
  createRunInputSchema,
  internalRuntimeDiagnosticsSchema,
  reviewRunInformationAnswerInputSchema,
  runApprovalSchema,
  runArtifactSchema,
  runConversationMessageSchema,
  runLifecycleSchema,
  runRuntimeMetadataSchema,
  runRuntimeUpdateSchema,
  runFileEntrySchema,
  type ListRunsQuery,
  runSnapshotSchema,
  sendRunMessageInputSchema,
  startRunJobPayloadSchema,
  updateRunApprovalModeInputSchema,
  type ApproveRunInput,
  type BridgeEvent,
  type CreateRunInput,
  type InternalRuntimeDiagnostics,
  type RunApproval,
  type RunApprovalDecisionMode,
  type RunArtifact,
  type RunConversationMessage,
  type RunControlCommand,
  type RunFileRecord,
  type RunInformationCollection,
  type RunInformationCollectionAnswer,
  type RunStopMode,
  type RunRuntimeMetadata,
  type RunRuntimeRecoveryCandidate,
  type RunRuntimeUpdate,
  type RunFileEntry,
  type RunRecord,
  type ResolvedRunProvider,
  type ReviewRunInformationAnswerInput,
  type RunSnapshot,
  type RunStatus,
  type UpdateRunApprovalModeInput,
  type SendRunMessageInput,
  type StartRunJobPayload,
  type SessionCaptureSummary,
  agentRuntimeEventRecordSchema,
  agentThreadRecordSchema,
} from "@lingban/contracts";
import { inferRunIdFromBridgeEvent, type AgentRuntimeRepository, type RunQueryRepository } from "@lingban/db";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  applyUserMessageToInformationCollection,
  canTransitionRunStatus,
  createInformationCollectionPrompt,
  createRunInformationCollection,
  createRunRecord,
  matchesRunListQuery,
  reviewInformationCollectionAnswer,
  resolveInformationCollectionSlotValues,
  summarizeRunSnapshots,
  transitionRunStatus,
} from "@lingban/domain-models";
import { nowIso, toErrorMessage } from "@lingban/shared";
import { AppError } from "../../app/errors.js";
import { billingService } from "../billing/service.js";
import { bridgeRegistry } from "../bridge/registry.js";
import { credentialsService } from "../credentials/service.js";
import { mcpService } from "../mcp/service.js";
import { mcpCallAuditService } from "../mcp/call-audit-service.js";
import { providersService } from "../providers/service.js";
import { runEventBus } from "../realtime/event-bus.js";
import { quotaService } from "../quotas/service.js";
import { sessionCatalogService } from "../sessions/service.js";
import { appendQuotaApprovalFeedback, appendRunSystemMessage } from "./approval-feedback.js";
import { runFileAccessService } from "./file-access.js";
import { runFileIndexService } from "./file-index.js";
import { buildStartRunJobPayload } from "./launch-plan.js";
import { buildRunQuotaUsageContext } from "./quota-usage.js";
import { runQueryRepository } from "./query-repository.js";
import { runsRepository, type RunAggregate } from "./repository.js";
import { EmbeddedRunOrchestrator } from "./runtime-orchestrator.js";
import { agentRuntimeRepository } from "../agent-runtime/repository.js";
import { sessionCaptureRepository } from "../session-captures/repository.js";
import { objectStore } from "../uploads/object-store.js";
import { uploadRepository } from "../uploads/repository.js";
import {
  ensureSealedSessionVersionVerified,
  getSealedSessionVersion,
  tryResolveSealedInformationCollectionTemplate,
} from "../session-drafts/version-registry.js";

let runSequence = 1;
let messageSequence = 1;
let artifactSequence = 1;
let approvalSequence = 1;
let bootstrapped = false;
const TERMINAL_STATUSES = new Set<RunStatus>(["SUCCEEDED", "FAILED", "CANCELLED"]);
const RECOVERABLE_QUEUE_STATUSES = new Set<RunStatus>(["CREATED", "READY", "QUEUED", "STARTING"]);
const ORPHANED_RUNTIME_STATUSES = new Set<RunStatus>(["RUNNING", "WAITING_APPROVAL"]);
const STARTUP_GATING_APPROVAL_KINDS = new Set<RunApproval["kind"]>(["quota-override", "mcp-access"]);
const NON_REJECTED_MCP_CALL_STATUSES = new Set(["success", "error", "cancelled"]);

type RunsRepositoryLike = Pick<
  typeof runsRepository,
  "init" | "get" | "list" | "save" | "update" | "clear"
>;

type RunEventBusLike = Pick<typeof runEventBus, "init" | "append" | "appendMany" | "deleteRun">;
type AgentRuntimeRepositoryLike = Pick<
  AgentRuntimeRepository,
  "getThreadByRunId" | "upsertThread" | "appendEvent" | "listEvents" | "deleteRun"
>;

type UploadRepositoryLike = Pick<
  typeof uploadRepository,
  "listUploadsByRun" | "listDownloadTickets" | "deleteUpload" | "deleteDownloadTicket"
>;

type ObjectStoreLike = Pick<typeof objectStore, "deleteObject">;
type SessionCaptureRepositoryLike = Pick<typeof sessionCaptureRepository, "listByRunId">;

type RunFileIndexServiceLike = Pick<
  typeof runFileIndexService,
  "init" | "replaceFromEntries" | "upsertFromEntry" | "list"
>;

type RunFileAccessServiceLike = Pick<typeof runFileAccessService, "statRunFile">;

type RunQueryRepositoryLike = Pick<
  RunQueryRepository,
  "init" | "getSnapshot" | "listSnapshots" | "upsertSnapshot"
>;

type BridgeRegistryLike = Pick<typeof bridgeRegistry, "get" | "dispatch" | "getDiagnostics">;

type RunRuntimeControl = Pick<
  EmbeddedRunOrchestrator,
  "startRun" | "requestStop" | "requestWorkspaceCleanup" | "requestSessionCapture" | "getDiagnostics" | "recover" | "shutdown"
>;

export type RunsServiceDependencies = {
  runsRepository: RunsRepositoryLike;
  runEventBus: RunEventBusLike;
  runFileIndexService: RunFileIndexServiceLike;
  runFileAccessService: RunFileAccessServiceLike;
  runQueryRepository?: RunQueryRepositoryLike | null;
  bridgeRegistry: BridgeRegistryLike;
  runtimeControl: RunRuntimeControl;
  agentRuntimeRepository?: AgentRuntimeRepositoryLike;
  uploadRepository?: UploadRepositoryLike;
  objectStore?: ObjectStoreLike;
  sessionCaptureRepository?: SessionCaptureRepositoryLike;
};

function dispatchBridgeCommandDetached(
  registry: BridgeRegistryLike,
  runId: string,
  command: RunControlCommand
) {
  void registry.dispatch(runId, command).catch((error) => {
    console.error(
      `[lingban-runs-service] failed to dispatch detached bridge command ${command.type} for ${runId}: ${toErrorMessage(error)}`
    );
  });
}

function createEmptyRecoveryActionCounts() {
  return {
    "enqueue-start": 0,
    "await-bridge": 0,
    "mark-orphan-failed": 0,
    "schedule-cleanup": 0,
    ignore: 0,
  } satisfies InternalRuntimeDiagnostics["recovery"]["actionCounts"];
}

function parseCounter(value: string | undefined, prefix: string) {
  if (!value?.startsWith(prefix)) {
    return 0;
  }

  const suffix = value.slice(prefix.length);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bootstrapSequences(repository: RunsRepositoryLike) {
  let maxRun = 0;
  let maxMessage = 0;
  let maxArtifact = 0;
  let maxApproval = 0;

  for (const aggregate of repository.list()) {
    maxRun = Math.max(maxRun, parseCounter(aggregate.run.runId, "run_"));

    for (const message of aggregate.messages) {
      maxMessage = Math.max(maxMessage, parseCounter(message.messageId, "msg_"));
    }

    for (const artifact of aggregate.artifacts) {
      maxArtifact = Math.max(maxArtifact, parseCounter(artifact.artifactId, "art_"));
    }

    for (const approval of aggregate.approvals) {
      maxApproval = Math.max(maxApproval, parseCounter(approval.approvalId, "apr_"));
    }
  }

  runSequence = maxRun + 1;
  messageSequence = maxMessage + 1;
  artifactSequence = maxArtifact + 1;
  approvalSequence = maxApproval + 1;
}

function nextRunId() {
  return `run_${String(runSequence++).padStart(8, "0")}`;
}

function resolveCreatorSourceTargetPath(runId: string) {
  const configuredRunsRoot = process.env.LINGBAN_RUNS_DIR?.trim();
  const runsRoot = configuredRunsRoot
    ? path.resolve(configuredRunsRoot)
    : path.resolve(process.cwd(), ".lingban-data", "worker", "runs");
  return path.join(runsRoot, runId, "target");
}

function nextMessageId() {
  return `msg_${String(messageSequence++).padStart(8, "0")}`;
}

function nextArtifactId() {
  return `art_${String(artifactSequence++).padStart(8, "0")}`;
}

function nextApprovalId() {
  return `apr_${String(approvalSequence++).padStart(8, "0")}`;
}

function buildMcpCallBillingEntryId(callId: string) {
  const safe = callId.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `ble_mcp_call_${safe}`.slice(0, 160);
}

function isTerminalStatus(status: RunStatus) {
  return TERMINAL_STATUSES.has(status);
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") || value.endsWith("\\") ? value : `${value}/`;
}

function estimateMessageTokens(input: SendRunMessageInput) {
  const attachmentText = input.attachments
    .map((attachment) => `${attachment.label}\n${attachment.path}`)
    .join("\n");
  const slotValueText = (input.slotValues ?? [])
    .map((slotValue) => `${slotValue.slotKey}\n${slotValue.valueText}`)
    .join("\n");
  const bytes =
    Buffer.byteLength(input.text, "utf8") +
    Buffer.byteLength(attachmentText, "utf8") +
    Buffer.byteLength(slotValueText, "utf8");
  return Math.max(1, Math.ceil(bytes / 4));
}

function createMessage(
  runId: string,
  role: RunConversationMessage["role"],
  kind: RunConversationMessage["kind"],
  text: string,
  attachments: RunConversationMessage["attachments"] = [],
  slotValues: RunConversationMessage["slotValues"] = []
): RunConversationMessage {
  return runConversationMessageSchema.parse({
    messageId: nextMessageId(),
    runId,
    role,
    kind,
    text,
    attachments,
    slotValues,
    createdAt: nowIso(),
  });
}

function createSeedFiles(runId: string, targetPath: string): RunFileEntry[] {
  const updatedAt = nowIso();
  const rootPath = ensureTrailingSlash(targetPath);

  return [
    runFileEntrySchema.parse({
      path: `${rootPath}receipts/`,
      name: "receipts",
      kind: "receipt",
      sizeBytes: null,
      updatedAt,
    }),
    runFileEntrySchema.parse({
      path: `${rootPath}output/`,
      name: "output",
      kind: "output",
      sizeBytes: null,
      updatedAt,
    }),
    runFileEntrySchema.parse({
      path: `${rootPath}archive/`,
      name: "archive",
      kind: "archive",
      sizeBytes: null,
      updatedAt,
    }),
  ];
}

function createSeedArtifact(runId: string, file: RunFileEntry): RunArtifact {
  return runArtifactSchema.parse({
    artifactId: nextArtifactId(),
    runId,
    label: file.name,
    file,
    status: "pending",
    downloadUrl: null,
  });
}

function createApproval(
  runId: string,
  options: {
    prompt: string;
    kind?: RunApproval["kind"];
    relatedResourceRef?: string | null;
  }
): RunApproval {
  return runApprovalSchema.parse({
    approvalId: nextApprovalId(),
    runId,
    kind: options.kind ?? "general",
    relatedResourceRef: options.relatedResourceRef ?? null,
    prompt: options.prompt,
    state: "pending",
    requestedAt: nowIso(),
    decidedAt: null,
    decisionMode: null,
    decidedByUserId: null,
    note: null,
  });
}

function automaticallyApproveRecord(
  approval: RunApproval,
  decidedByUserId: string | null,
  decidedAt = nowIso()
) {
  return runApprovalSchema.parse({
    ...approval,
    state: "approved",
    decidedAt,
    decisionMode: "auto_all",
    decidedByUserId,
    note: "Automatically approved by the instance approval policy.",
  });
}

function createInformationCollectionReviewMessage(
  runId: string,
  answer: Pick<RunInformationCollectionAnswer, "slotKey" | "kind">,
  decision: ReviewRunInformationAnswerInput["decision"],
  resultingCollection: RunInformationCollection
) {
  const slotDescriptor = `${answer.slotKey} (${answer.kind})`;
  const needsMoreInformation =
    decision !== "approve" &&
    resultingCollection.slots.some(
      (slot) => slot.key === answer.slotKey && slot.required && slot.status !== "satisfied"
    );

  const text =
    decision === "approve"
      ? `Manual review approved the structured answer for ${slotDescriptor}.`
      : decision === "reject"
        ? needsMoreInformation
          ? `Manual review rejected the structured answer for ${slotDescriptor}. More information is still required before the slot is complete.`
          : `Manual review rejected the structured answer for ${slotDescriptor}.`
        : `Manual review revised the structured answer for ${slotDescriptor}.`;

  return createMessage(runId, "system", "status", text);
}

async function buildInitialInformationCollection(
  run: RunRecord,
  prompt: string
): Promise<RunInformationCollection> {
  if (run.sessionBootstrapMode === "blank" || !run.sessionVersionId) {
    return createRunInformationCollection({
      prompt,
      slotSchemaVersion: null,
      slots: [],
    });
  }

  const sealedTemplate = await tryResolveSealedInformationCollectionTemplate(run.sessionVersionId);
  const legacyTemplate = sealedTemplate ? null : await sessionCatalogService.tryResolveInformationCollectionTemplate(
      run.sessionVersionId,
      {
        workspaceContextKey: run.catalogMetadata?.workspaceContextKey ?? null,
        userId: run.requestedByUserId ?? null,
      }
    );
  const templateSlots = sealedTemplate?.slots ?? legacyTemplate?.slots ?? [];

  return createRunInformationCollection({
    prompt,
    slotSchemaVersion: sealedTemplate?.version ?? legacyTemplate?.slotSchemaVersion ?? null,
    slots:
      templateSlots.map((slot) => ({
        key: slot.key,
        title: slot.title,
        type: slot.type,
        required: slot.required,
        secret: slot.secret,
        repeatable: slot.repeatable,
        prompt: slot.prompt ?? null,
        description: slot.description ?? null,
        placeholder: slot.placeholder ?? null,
        choices: (slot.choices ?? []).map((choice) => ({
          value: choice.value,
          label: choice.label ?? null,
        })),
        accepts: slot.accepts ?? [],
      })),
  });
}

function requiresStartupApproval(kind: RunApproval["kind"]) {
  return STARTUP_GATING_APPROVAL_KINDS.has(kind);
}

function createMcpAccessApproval(
  runId: string,
  entry: {
    mcpId: string;
    displayName: string;
    source: string;
    transport: string;
    ref: string;
    riskLevel: string;
  }
) {
  return createApproval(runId, {
    prompt:
      `Approve MCP access before execution starts.\n` +
      `MCP: ${entry.displayName}\n` +
      `ID: ${entry.mcpId}\n` +
      `Source: ${entry.source}\n` +
      `Transport: ${entry.transport}\n` +
      `Risk: ${entry.riskLevel}\n` +
      `Ref: ${entry.ref}`,
    kind: "mcp-access",
    relatedResourceRef: entry.mcpId,
  });
}

function buildMcpStartupApprovals(
  runId: string,
  resolvedMcpContext: {
    registryEntries: Array<{
      mcpId: string;
      displayName: string;
      source: string;
      transport: string;
      ref: string;
      riskLevel: string;
      approvalRequired: boolean;
    }>;
    bindingRecords: Array<{
      mcpId: string;
      approvalRequired: boolean;
    }>;
  }
) {
  const bindingByMcpId = new Map(
    resolvedMcpContext.bindingRecords.map((binding) => [binding.mcpId, binding])
  );

  return resolvedMcpContext.registryEntries.flatMap((entry) => {
    const binding = bindingByMcpId.get(entry.mcpId);
    const approvalRequired = binding?.approvalRequired ?? entry.approvalRequired;

    return approvalRequired
      ? [
          createMcpAccessApproval(runId, {
            mcpId: entry.mcpId,
            displayName: entry.displayName,
            source: entry.source,
            transport: entry.transport,
            ref: entry.ref,
            riskLevel: entry.riskLevel,
          }),
        ]
      : [];
  });
}

function upsertByKey<T extends Record<string, unknown>>(items: T[], key: keyof T, value: T) {
  const index = items.findIndex((item) => item[key] === value[key]);
  if (index === -1) {
    return [...items, value];
  }

  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function mergeRuntimeMetadata(
  current: RunRuntimeMetadata | undefined,
  patch: RunRuntimeUpdate
): RunRuntimeMetadata {
  const base = runRuntimeMetadataSchema.parse(current ?? {});

  return runRuntimeMetadataSchema.parse({
    ...base,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    ),
  });
}

function toSnapshotFileEntry(file: RunFileRecord): RunFileEntry {
  return runFileEntrySchema.parse({
    path: file.path,
    name: file.name,
    kind: file.kind,
    sizeBytes: file.sizeBytes,
    updatedAt: file.updatedAt,
  });
}

export class RunsService {
  #runsRepository: RunsRepositoryLike;
  #runEventBus: RunEventBusLike;
  #runFileIndexService: RunFileIndexServiceLike;
  #runFileAccessService: RunFileAccessServiceLike;
  #runQueryRepository: RunQueryRepositoryLike | null;
  #bridgeRegistry: BridgeRegistryLike;
  #runtimeControl: RunRuntimeControl;
  #agentRuntimeRepository: AgentRuntimeRepositoryLike;
  #uploadRepository: UploadRepositoryLike;
  #objectStore: ObjectStoreLike;
  #sessionCaptureRepository: SessionCaptureRepositoryLike;
  #releaseOperations = new Map<string, Promise<RunSnapshot>>();

  constructor(dependencies: RunsServiceDependencies) {
    this.#runsRepository = dependencies.runsRepository;
    this.#runEventBus = dependencies.runEventBus;
    this.#runFileIndexService = dependencies.runFileIndexService;
    this.#runFileAccessService = dependencies.runFileAccessService;
    this.#runQueryRepository = dependencies.runQueryRepository ?? null;
    this.#bridgeRegistry = dependencies.bridgeRegistry;
    this.#runtimeControl = dependencies.runtimeControl;
    this.#agentRuntimeRepository = dependencies.agentRuntimeRepository ?? agentRuntimeRepository;
    this.#uploadRepository = dependencies.uploadRepository ?? uploadRepository;
    this.#objectStore = dependencies.objectStore ?? objectStore;
    this.#sessionCaptureRepository = dependencies.sessionCaptureRepository ?? sessionCaptureRepository;
  }

  #requireAggregate(runId: string) {
    const aggregate = this.#runsRepository.get(runId);

    if (!aggregate) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    return aggregate;
  }

  #resolveSnapshotFiles(runId: string, fallback: RunFileEntry[]) {
    const indexedFiles = this.#runFileIndexService.list(runId);
    if (indexedFiles.length > 0) {
      return indexedFiles.map((file) => toSnapshotFileEntry(file));
    }

    return fallback;
  }

  #decorateSnapshot(snapshot: RunSnapshot) {
    return runSnapshotSchema.parse({
      ...snapshot,
      files: this.#resolveSnapshotFiles(snapshot.run.runId, snapshot.files),
    });
  }

  #buildSnapshot(aggregate: {
    run: RunSnapshot["run"];
    runtime?: RunSnapshot["runtime"];
    lifecycle?: RunSnapshot["lifecycle"];
    provider?: RunSnapshot["provider"];
    informationCollection?: RunSnapshot["informationCollection"];
    messages: RunConversationMessage[];
    files: RunFileEntry[];
    artifacts: RunArtifact[];
    approvals: RunApproval[];
  }): RunSnapshot {
    const parsed = runSnapshotSchema.parse(aggregate);
    if (parsed.lifecycle.runtimeStatus === "NOT_STARTED") {
      if (isTerminalStatus(parsed.run.status)) {
        const released = Boolean(parsed.runtime.finishedAt) || !parsed.runtime.startedAt;
        parsed.lifecycle = runLifecycleSchema.parse({
          ...parsed.lifecycle,
          runtimeStatus: released ? "RELEASED" : "ORPHANED",
          releasedAt: released ? parsed.runtime.finishedAt ?? parsed.run.updatedAt : null,
          billingStoppedAt: released ? parsed.runtime.finishedAt ?? parsed.run.updatedAt : null,
          releaseFailure: released ? null : "Historical terminal run has no verified runtime release timestamp.",
        });
      } else if (parsed.runtime.startedAt || parsed.runtime.readyAt) {
        parsed.lifecycle = runLifecycleSchema.parse({
          ...parsed.lifecycle,
          runtimeStatus: "ACTIVE",
        });
      }
    }
    return this.#decorateSnapshot(parsed);
  }

  async #upsertQuerySnapshot(aggregate: {
    run: RunSnapshot["run"];
    runtime?: RunSnapshot["runtime"];
    lifecycle?: RunSnapshot["lifecycle"];
    provider?: RunSnapshot["provider"];
    informationCollection?: RunSnapshot["informationCollection"];
    messages: RunConversationMessage[];
    files: RunFileEntry[];
    artifacts: RunArtifact[];
    approvals: RunApproval[];
  }) {
    const snapshot = this.#buildSnapshot(aggregate);
    if (this.#runQueryRepository) {
      await this.#runQueryRepository.upsertSnapshot(snapshot);
    }

    return snapshot;
  }

  #listReadSnapshots() {
    if (!this.#runQueryRepository) {
      return this.#runsRepository.list().map((aggregate) => this.#buildSnapshot(aggregate));
    }

    return this.#runQueryRepository
      .listSnapshots()
      .map((snapshot) => this.#decorateSnapshot(snapshot));
  }

  #buildRuntimeRecoveryCandidate(runId: string): RunRuntimeRecoveryCandidate {
    const aggregate = this.#requireAggregate(runId);
    const snapshot = this.#buildSnapshot(aggregate);
    const registeredBridge = this.#bridgeRegistry.get(runId);
    const bridge = {
      registered: Boolean(registeredBridge),
      controllerAttached: registeredBridge?.controllerAttached ?? false,
      connectedAt: registeredBridge?.connectedAt ?? null,
      lastSeenAt: registeredBridge?.lastSeenAt ?? null,
    };
    const runtimeFinishedAtMs = snapshot.runtime.finishedAt
      ? Date.parse(snapshot.runtime.finishedAt)
      : Number.NaN;
    const bridgeLastSeenAtMs = bridge.lastSeenAt ? Date.parse(bridge.lastSeenAt) : Number.NaN;
    const bridgeRegisteredAfterRuntimeFinished =
      bridge.registered &&
      Number.isFinite(runtimeFinishedAtMs) &&
      Number.isFinite(bridgeLastSeenAtMs) &&
      bridgeLastSeenAtMs > runtimeFinishedAtMs;

    let action: RunRuntimeRecoveryCandidate["action"] = "ignore";
    let reason: string | null = null;
    let startJob: StartRunJobPayload | null = null;

    if (snapshot.lifecycle.recordStatus === "DELETED") {
      action = "ignore";
      reason = "run record has been permanently deleted";
    } else if (isTerminalStatus(snapshot.run.status)) {
      action = "schedule-cleanup";
      reason = `run is already terminal (${snapshot.run.status})`;
    } else if (RECOVERABLE_QUEUE_STATUSES.has(snapshot.run.status)) {
      if (bridge.registered) {
        action = "await-bridge";
        reason = `run is ${snapshot.run.status} and already has an active bridge registration`;
      } else {
        action = "enqueue-start";
        reason = `run is ${snapshot.run.status} and should be re-enqueued for worker startup recovery`;
        startJob = startRunJobPayloadSchema.parse(aggregate.startJob);
      }
    } else if (ORPHANED_RUNTIME_STATUSES.has(snapshot.run.status)) {
      if (snapshot.runtime.finishedAt && !bridgeRegisteredAfterRuntimeFinished) {
        action = "enqueue-start";
        reason =
          `run is ${snapshot.run.status}, its previous runtime finished at ` +
          `${snapshot.runtime.finishedAt}, and it should be re-enqueued for runtime recovery`;
        startJob = this.#buildRuntimeStartJobPayload(aggregate);
      } else if (bridge.registered) {
        action = "await-bridge";
        reason = `run is ${snapshot.run.status} and bridge registration is active`;
      } else {
        action = "mark-orphan-failed";
        reason =
          `run is ${snapshot.run.status} but no active bridge registration is present during worker recovery`;
      }
    }

    return {
      snapshot,
      bridge,
      action,
      reason,
      startJob,
    };
  }

  #applyRunStatus(run: RunSnapshot["run"], status: RunStatus, at: string, reason?: string | null) {
    if (run.status === status) {
      return {
        ...run,
        statusReason: reason ?? run.statusReason,
        updatedAt: at,
      };
    }

    if (!canTransitionRunStatus(run.status, status)) {
      throw new AppError(
        409,
        "RUN_STATUS_INVALID",
        `Invalid run status transition: ${run.status} -> ${status}`
      );
    }

    return transitionRunStatus(run, status, {
      at,
      reason: reason ?? null,
    });
  }

  #assertRunInteractive(snapshot: RunSnapshot, operation: string) {
    if (isTerminalStatus(snapshot.run.status) || snapshot.lifecycle.runtimeStatus === "STOP_REQUESTED" || snapshot.lifecycle.runtimeStatus === "STOPPING") {
      throw new AppError(
        409,
        "RUN_NOT_ACTIVE",
        `${operation} is unavailable while run ${snapshot.run.runId} is ${snapshot.run.status}/${snapshot.lifecycle.runtimeStatus}.`
      );
    }
    if (snapshot.lifecycle.recordStatus !== "ACTIVE") {
      throw new AppError(
        409,
        "RUN_RECORD_NOT_ACTIVE",
        `${operation} is unavailable while run record ${snapshot.run.runId} is ${snapshot.lifecycle.recordStatus}.`
      );
    }
  }

  async #releaseRuntime(runId: string, mode: RunStopMode) {
    const current = this.#buildSnapshot(this.#requireAggregate(runId));
    if (current.lifecycle.runtimeStatus === "RELEASED") {
      return current;
    }
    const inFlight = this.#releaseOperations.get(runId);
    if (inFlight) {
      return await inFlight;
    }

    const operation = this.#performRuntimeRelease(runId, mode).finally(() => {
      if (this.#releaseOperations.get(runId) === operation) {
        this.#releaseOperations.delete(runId);
      }
    });
    this.#releaseOperations.set(runId, operation);
    return await operation;
  }

  async #performRuntimeRelease(runId: string, mode: RunStopMode) {
    const stoppingAt = nowIso();
    const stopping = await this.#runsRepository.update(runId, (current) => ({
      ...current,
      lifecycle: runLifecycleSchema.parse({
        ...current.lifecycle,
        runtimeStatus: "STOPPING",
        stopMode: mode,
        stopReason: current.lifecycle?.stopReason ?? current.run.statusReason ?? "Runtime release requested",
        stopRequestedAt: current.lifecycle?.stopRequestedAt ?? stoppingAt,
        releaseOperationId: current.lifecycle?.releaseOperationId ?? `rop_${randomUUID()}`,
        cleanupAttemptCount: (current.lifecycle?.cleanupAttemptCount ?? 0) + 1,
        releaseFailure: null,
      }),
      run: {
        ...current.run,
        updatedAt: stoppingAt,
      },
    }));
    if (!stopping) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    await this.#upsertQuerySnapshot(stopping);

    try {
      await this.#runtimeControl.requestStop(runId, { force: mode === "force" });
      const releasedAt = nowIso();
      const released = await this.#runsRepository.update(runId, (current) => ({
        ...current,
        runtime: mergeRuntimeMetadata(current.runtime, {
          finishedAt: current.runtime?.finishedAt ?? releasedAt,
        }),
        lifecycle: runLifecycleSchema.parse({
          ...current.lifecycle,
          runtimeStatus: "RELEASED",
          releasedAt,
          billingStoppedAt: current.lifecycle?.billingStoppedAt ?? releasedAt,
          releaseFailure: null,
        }),
        run: {
          ...current.run,
          updatedAt: releasedAt,
        },
      }));
      if (!released) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
      await this.#upsertQuerySnapshot(released);
      await billingService.recordRunRuntimeEstimate(released).catch(() => undefined);
      return this.#buildSnapshot(released);
    } catch (error) {
      const failedAt = nowIso();
      const failed = await this.#runsRepository.update(runId, (current) => ({
        ...current,
        lifecycle: runLifecycleSchema.parse({
          ...current.lifecycle,
          runtimeStatus: "RELEASE_FAILED",
          releaseFailure: toErrorMessage(error),
          billingStoppedAt: current.lifecycle?.billingStoppedAt ?? current.lifecycle?.stopRequestedAt ?? failedAt,
        }),
        run: {
          ...current.run,
          updatedAt: failedAt,
        },
      }));
      if (!failed) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
      await this.#upsertQuerySnapshot(failed);
      return this.#buildSnapshot(failed);
    }
  }

  async #emitEvent(event: BridgeEvent) {
    await this.#runEventBus.append(bridgeEventSchema.parse(event));
  }

  async #emitEvents(events: BridgeEvent[]) {
    await this.#runEventBus.appendMany(events.map((event) => bridgeEventSchema.parse(event)));
  }

  async createRun(input: CreateRunInput) {
    const requestedInput = createRunInputSchema.parse(input);
    const runId = nextRunId();
    const parsed = createRunInputSchema.parse({
      ...requestedInput,
      targetPath:
        requestedInput.runPurpose === "creator_source"
          ? resolveCreatorSourceTargetPath(runId)
          : requestedInput.targetPath,
    });
    let usesSealedV2Session = false;
    if (
      parsed.sessionVersionId &&
      (parsed.catalogMetadata?.workspaceContextKey || parsed.catalogMetadata?.serviceId)
    ) {
      try {
        sessionCatalogService.requireSessionPack(parsed.sessionVersionId, {
          workspaceContextKey: parsed.catalogMetadata?.workspaceContextKey ?? null,
          serviceId: parsed.catalogMetadata?.serviceId ?? null,
        });
      } catch (error) {
        if (!getSealedSessionVersion(parsed.sessionVersionId)) throw error;
        await ensureSealedSessionVersionVerified(parsed.sessionVersionId);
        usesSealedV2Session = true;
      }
    }
    let effectiveInput = parsed;
    if (
      parsed.sessionVersionId &&
      !usesSealedV2Session &&
      parsed.catalogMetadata?.workspaceContextKey &&
      parsed.catalogMetadata?.serviceId
    ) {
      const consumerSessionPack = await sessionCatalogService.ensureConsumerSessionPackForRun(
        parsed.sessionVersionId,
        {
          workspaceContextKey: parsed.catalogMetadata.workspaceContextKey,
          workspaceId: parsed.workspaceId,
          runId,
          serviceId: parsed.catalogMetadata.serviceId,
          workshopId: parsed.catalogMetadata.workshopId ?? null,
          entrySurface: parsed.entrySurface,
          targetPath: parsed.targetPath,
          inheritedByUserId: parsed.requestedByUserId ?? null,
        }
      );
      effectiveInput = createRunInputSchema.parse({
        ...parsed,
        sessionVersionId: consumerSessionPack.sessionVersionId,
      });
    }
    const createdAt = nowIso();
    let run = createRunRecord({
      runId,
      createdAt,
      input: effectiveInput,
    });
    const quotaPreview = quotaService.previewRunCreate({
      runId: run.runId,
      workspaceId: run.workspaceId,
      workspaceContextKey: run.catalogMetadata?.workspaceContextKey ?? null,
      requestedByUserId: run.requestedByUserId ?? null,
      serviceId: run.catalogMetadata?.serviceId ?? null,
      taskVersionId: run.taskVersionId,
      sessionVersionId: run.sessionVersionId,
      entrySurface: run.entrySurface,
    });

    if (quotaPreview.decision === "block") {
      await quotaService.commitRunCreateDecision(quotaPreview, {
        runId: run.runId,
        approvalId: null,
        workspaceContextKey: run.catalogMetadata?.workspaceContextKey ?? null,
        packageIds: quotaPreview.internal.overrideDraft?.packageId
          ? [quotaPreview.internal.overrideDraft.packageId]
          : [],
      });
      throw new AppError(
        409,
        "RUN_QUOTA_BLOCKED",
        quotaPreview.summary?.en ?? "Run creation blocked by quota policy.",
        quotaPreview
      );
    }

    const systemPrompt = createInformationCollectionPrompt(run);
    const informationCollection = await buildInitialInformationCollection(run, systemPrompt);
    const resolvedProvider = providersService.resolveRunProvider({
      workspaceId: run.workspaceId,
      requestedByUserId: run.requestedByUserId ?? null,
      selection: effectiveInput.providerSelection ?? null,
    });
    if (run.runPurpose === "creator_source" && !resolvedProvider) {
      throw new AppError(
        409,
        "PROVIDER_BINDING_UNAVAILABLE",
        `Creator Source Run requires an enabled Provider binding for workspace ${run.workspaceId}`,
        { workspaceId: run.workspaceId, runPurpose: run.runPurpose }
      );
    }
    const resolvedMcpContext = await mcpService.resolveRunContext({
      runId: run.runId,
      workspaceId: run.workspaceId,
      requestedByUserId: run.requestedByUserId ?? null,
      sessionVersionId: run.sessionVersionId,
      bindings: parsed.bindings,
    });
    const resolvedCredentialIds = new Set(resolvedMcpContext.effectiveBindings.credentialIds);
    if (resolvedProvider?.credentialId) {
      resolvedCredentialIds.add(resolvedProvider.credentialId);
    }
    const resolvedCredentials = await credentialsService.resolveRunCredentials({
      workspaceId: run.workspaceId,
      requestedByUserId: run.requestedByUserId ?? null,
      credentialIds: [...resolvedCredentialIds],
      platformCredentialIds:
        resolvedProvider?.bindingScope === "platform"
          ? [resolvedProvider.credentialId]
          : [],
    });
    const startJob = buildStartRunJobPayload({
      run,
      initialPrompt: systemPrompt,
      requestedInitialMessage: effectiveInput.initialMessage,
      bindings: resolvedMcpContext.effectiveBindings,
      provider: resolvedProvider,
      credentials: resolvedCredentials,
      registryEntries: resolvedMcpContext.registryEntries,
      bindingRecords: resolvedMcpContext.bindingRecords,
      networkPolicies: resolvedMcpContext.networkPolicies,
    });
    const mcpStartupApprovals = buildMcpStartupApprovals(run.runId, resolvedMcpContext);
    const files = createSeedFiles(run.runId, run.targetPath);
    const quotaWarningMessage =
      quotaPreview.decision === "warn" && quotaPreview.summary
        ? createMessage(run.runId, "system", "status", quotaPreview.summary.en)
        : null;
    const quotaApproval =
      quotaPreview.decision === "require_approval"
        ? createApproval(run.runId, {
            prompt: quotaService.buildQuotaApprovalPrompt(quotaPreview),
            kind: "quota-override",
            relatedResourceRef: quotaPreview.overrideId,
          })
        : null;
    const requestedStartupApprovals = [
      ...(quotaApproval ? [quotaApproval] : []),
      ...mcpStartupApprovals,
    ];
    const startupApprovals = run.approvalMode === "auto_all"
      ? requestedStartupApprovals.map((approval) =>
          automaticallyApproveRecord(approval, run.requestedByUserId ?? null, createdAt)
        )
      : requestedStartupApprovals;

    if (startupApprovals.some((approval) => approval.state === "pending")) {
      run = this.#applyRunStatus(
        run,
        "WAITING_APPROVAL",
        createdAt,
        quotaPreview.decision === "require_approval"
          ? quotaPreview.summary?.en ?? "Quota approval is required before run start."
          : mcpStartupApprovals.length === 1
            ? "MCP access approval is required before run start."
            : "Multiple MCP access approvals are required before run start."
      );
    }

    const aggregate = await this.#runsRepository.save({
      run,
      lifecycle: runLifecycleSchema.parse({}),
      provider: resolvedProvider,
      informationCollection,
      input: effectiveInput,
      startJob,
      messages: [
        createMessage(run.runId, "system", "prompt", systemPrompt),
        ...(quotaWarningMessage ? [quotaWarningMessage] : []),
      ],
      files,
      artifacts: files.map((file) => createSeedArtifact(run.runId, file)),
      approvals: startupApprovals,
    });
    await this.#upsertQuerySnapshot(aggregate);
    await this.#runFileIndexService.replaceFromEntries(
      {
        runId: run.runId,
        workspaceId: run.workspaceId,
        targetPath: run.targetPath,
      },
      files
    );
    await quotaService.commitRunCreateDecision(quotaPreview, {
      runId: run.runId,
      approvalId: quotaApproval?.approvalId ?? null,
      workspaceContextKey: run.catalogMetadata?.workspaceContextKey ?? null,
      packageIds: quotaPreview.internal.overrideDraft?.packageId
        ? [quotaPreview.internal.overrideDraft.packageId]
        : [],
    });

    if (quotaApproval && run.approvalMode === "auto_all") {
      await quotaService.applyRunApprovalDecision({
        approval: quotaApproval,
        approved: true,
        decidedByUserId: run.requestedByUserId ?? null,
        note: "Automatically approved by the instance approval policy.",
      });
    }

    await this.#emitEvent({
      type: "conversation.message",
      message: aggregate.messages[0],
    });

    if (quotaWarningMessage) {
      await this.#emitEvent({
        type: "conversation.message",
        message: quotaWarningMessage,
      });
    }

    for (const approval of aggregate.approvals.filter((item) =>
      requiresStartupApproval(item.kind)
    )) {
      await this.#emitEvent({
        type: "approval.requested",
        approval,
      });
    }

    if (aggregate.run.status !== "WAITING_APPROVAL") {
      void this.#runtimeControl.startRun(run.runId).catch(() => undefined);
    }

    return {
      run: aggregate.run,
      nextPrompt: systemPrompt,
      informationCollection: aggregate.informationCollection,
    };
  }

  getRun(runId: string): RunSnapshot {
    const snapshot = this.getRunIncludingDeleted(runId);
    if (snapshot.lifecycle.recordStatus === "DELETED") {
      throw new AppError(410, "RUN_DELETED", `Run has been deleted: ${runId}`);
    }
    return snapshot;
  }

  getRunIncludingDeleted(runId: string): RunSnapshot {
    return this.#buildSnapshot(this.#requireAggregate(runId));
  }

  getStartRunJobPayload(runId: string): StartRunJobPayload {
    const aggregate = this.#requireAggregate(runId);
    return this.#buildRuntimeStartJobPayload(aggregate);
  }

  #buildRuntimeStartJobPayload(aggregate: RunAggregate) {
    const shouldResume =
      ORPHANED_RUNTIME_STATUSES.has(aggregate.run.status) &&
      Boolean(aggregate.runtime?.finishedAt) &&
      Boolean(aggregate.agentThread?.threadId);
    return startRunJobPayloadSchema.parse({
      ...aggregate.startJob,
      run: aggregate.run,
      resumeThreadId: shouldResume ? aggregate.agentThread?.threadId ?? null : null,
      resumeThroughTurnId: shouldResume ? aggregate.agentThread?.currentTurnId ?? null : null,
      resumeThroughTurnState: shouldResume
        ? aggregate.agentThread?.currentTurnState ?? null
        : null,
    });
  }

  getRuntimeRecoveryCandidate(runId: string): RunRuntimeRecoveryCandidate {
    return this.#buildRuntimeRecoveryCandidate(runId);
  }

  listRuntimeRecoveryCandidates(): RunRuntimeRecoveryCandidate[] {
    return this.#runsRepository
      .list()
      .map((aggregate) => this.#buildRuntimeRecoveryCandidate(aggregate.run.runId));
  }

  getInternalRuntimeDiagnostics(): InternalRuntimeDiagnostics {
    const candidates = this.listRuntimeRecoveryCandidates();
    const actionCounts = createEmptyRecoveryActionCounts();

    for (const candidate of candidates) {
      actionCounts[candidate.action] += 1;
    }

    return internalRuntimeDiagnosticsSchema.parse({
      bridgeRegistry: this.#bridgeRegistry.getDiagnostics(),
      runtimeOrchestrator: this.#runtimeControl.getDiagnostics(),
      recovery: {
        candidatesCount: candidates.length,
        actionCounts,
      },
    });
  }

  listRuns(
    query: ListRunsQuery = {},
    options: {
      workspaceId?: string | null;
      workspaceContextKey?: string | null;
    } = {}
  ): RunSnapshot[] {
    return this.#listReadSnapshots()
      .filter((snapshot) => {
        if (query.recordStatus) {
          if (snapshot.lifecycle.recordStatus !== query.recordStatus) return false;
        } else if (snapshot.lifecycle.recordStatus !== "ACTIVE") {
          return false;
        }
        if (options.workspaceId && snapshot.run.workspaceId !== options.workspaceId) {
          return false;
        }

        return matchesRunListQuery(snapshot, query, {
          workspaceContextKey: options.workspaceContextKey,
        });
      });
  }

  getRunsSummary(
    query: ListRunsQuery = {},
    options: {
      workspaceId?: string | null;
      workspaceContextKey?: string | null;
    } = {}
  ) {
    return summarizeRunSnapshots(this.listRuns(query, options), {
      workspaceContextKey: options.workspaceContextKey,
    });
  }

  listFiles(runId: string) {
    const aggregate = this.#requireAggregate(runId);
    return this.#resolveSnapshotFiles(runId, aggregate.files);
  }

  async sendMessage(
    runId: string,
    input: SendRunMessageInput,
    options: { requestedByUserId?: string | null } = {}
  ): Promise<RunSnapshot> {
    const parsed = sendRunMessageInputSchema.parse(input);
    const aggregate = this.#requireAggregate(runId);
    this.#assertRunInteractive(this.#buildSnapshot(aggregate), "Sending a message");
    await Promise.all(
      parsed.attachments.map(async (attachment) => {
        await this.#runFileAccessService.statRunFile(runId, attachment.path);
      })
    );

    const estimatedTokenDelta = estimateMessageTokens(parsed);
    const quotaUsage = buildRunQuotaUsageContext(aggregate.run, {
      metric: "model_tokens",
      delta: estimatedTokenDelta,
      requestedByUserId: options.requestedByUserId ?? null,
      note: `Estimated message send usage: ${estimatedTokenDelta} model tokens.`,
    });
    const consumedOverride = await quotaService.consumeApprovedUsageOverride(quotaUsage);
    let quotaPreview = consumedOverride ? null : quotaService.previewUsage(quotaUsage);

    if (quotaPreview?.decision === "block") {
      await quotaService.commitUsageDecision(quotaPreview, {
        note: `Message send blocked by quota policy. Estimated model tokens: ${estimatedTokenDelta}.`,
      });
      await appendRunSystemMessage(
        runId,
        quotaPreview.summary?.en ?? "Message send blocked by quota policy.",
        "status",
        {
          runsRepository: this.#runsRepository,
          runEventBus: this.#runEventBus,
          runQueryRepository: this.#runQueryRepository,
        }
      );
      throw new AppError(
        409,
        "RUN_MESSAGE_QUOTA_BLOCKED",
        quotaPreview.summary?.en ?? "Message send blocked by quota policy.",
        quotaPreview
      );
    }

    if (quotaPreview?.decision === "require_approval") {
      const feedback = await appendQuotaApprovalFeedback({
        runId,
        prompt: quotaService.buildQuotaApprovalPrompt(quotaPreview),
        relatedResourceRef: quotaPreview.overrideId,
        messageText:
          `${quotaPreview.summary?.en ?? "Quota approval is required before sending the message."} ` +
          "Approve the pending request and resend the message.",
      }, {
        runsRepository: this.#runsRepository,
        runEventBus: this.#runEventBus,
        runQueryRepository: this.#runQueryRepository,
      });
      await quotaService.commitUsageDecision(quotaPreview, {
        approvalId: feedback.approval.approvalId,
        note:
          `Message send is waiting for quota approval. ` +
          `Estimated model tokens: ${estimatedTokenDelta}.`,
      });
      if (feedback.approval.state === "approved") {
        await quotaService.applyRunApprovalDecision({
          approval: feedback.approval,
          approved: true,
          decidedByUserId:
            aggregate.run.approvalModeUpdatedByUserId ?? aggregate.run.requestedByUserId ?? null,
          note: feedback.approval.note,
        });
        await quotaService.consumeApprovedUsageOverride(quotaUsage);
        quotaPreview = null;
      } else {
        throw new AppError(
          409,
          "RUN_MESSAGE_QUOTA_APPROVAL_REQUIRED",
          quotaPreview.summary?.en ?? "Quota approval is required before sending the message.",
          {
            ...quotaPreview,
            approvalId: feedback.approval.approvalId,
          }
        );
      }
    }

    const updated = await this.#runsRepository.update(runId, (current) => {
      const at = nowIso();
      const currentCollection =
        current.informationCollection ??
        createRunInformationCollection({
          prompt: createInformationCollectionPrompt(current.run),
        });
      const resolvedSlotValues = resolveInformationCollectionSlotValues(currentCollection, {
        text: parsed.text,
        attachments: parsed.attachments,
        slotValues: parsed.slotValues,
      });
      const message = createMessage(
        runId,
        "user",
        "text",
        parsed.text,
        parsed.attachments,
        resolvedSlotValues
      );

      return {
        ...current,
        run: {
          ...current.run,
          updatedAt: at,
        },
        informationCollection: applyUserMessageToInformationCollection(
          currentCollection,
          {
            text: parsed.text,
            attachments: parsed.attachments,
            slotValues: resolvedSlotValues,
            sourceMessageId: message.messageId,
            at,
          }
        ),
        messages: [...current.messages, message],
      };
    });

    if (!updated) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    const updatedInformationCollection = updated.informationCollection;
    if (!updatedInformationCollection) {
      throw new AppError(
        500,
        "RUN_INFORMATION_COLLECTION_MISSING",
        `Information collection state missing after message send: ${runId}`
      );
    }

    await this.#upsertQuerySnapshot(updated);

    await this.#emitEvent({
      type: "conversation.message",
      message: updated.messages.at(-1)!,
    });
    await this.#emitEvent({
      type: "informationCollection.updated",
      runId,
      informationCollection: updatedInformationCollection,
      occurredAt: updatedInformationCollection.lastUpdatedAt ?? updated.run.updatedAt,
    });

    dispatchBridgeCommandDetached(this.#bridgeRegistry, runId, {
      type: "sendMessage",
      payload: parsed,
    });

    if (quotaPreview) {
      await quotaService.commitUsageDecision(quotaPreview, {
        note: `Message send consumed estimated model tokens: ${estimatedTokenDelta}.`,
      });

      if (quotaPreview.decision === "warn" && quotaPreview.summary) {
        await appendRunSystemMessage(runId, quotaPreview.summary.en, "status", {
          runsRepository: this.#runsRepository,
          runEventBus: this.#runEventBus,
          runQueryRepository: this.#runQueryRepository,
        });
      }
    }

    const { delta, ...billingBase } = quotaUsage;
    await billingService.recordUsage({
      ...billingBase,
      quantity: delta,
      source: "run-message",
      sourceRef: `${runId}:${updated.messages.at(-1)?.messageId ?? "latest"}`,
      costBasis: "estimated",
      note: `Estimated billing usage recorded for message send in run ${runId}.`,
    });

    return this.getRun(runId);
  }

  async reviewInformationAnswer(
    runId: string,
    input: ReviewRunInformationAnswerInput,
    options: {
      reviewedByUserId?: string | null;
    } = {}
  ): Promise<RunSnapshot> {
    const parsed = reviewRunInformationAnswerInputSchema.parse(input);
    const aggregate = this.#requireAggregate(runId);
    this.#assertRunInteractive(this.#buildSnapshot(aggregate), "Reviewing collected information");
    const currentCollection =
      aggregate.informationCollection ??
      createRunInformationCollection({
        prompt: createInformationCollectionPrompt(aggregate.run),
      });
    const currentAnswer = currentCollection.answers.find((answer) => answer.answerId === parsed.answerId);

    if (!currentAnswer) {
      throw new AppError(
        404,
        "RUN_INFORMATION_COLLECTION_ANSWER_NOT_FOUND",
        `Information collection answer not found: ${parsed.answerId}`
      );
    }

    if (currentAnswer.reviewStatus === "superseded") {
      throw new AppError(
        409,
        "RUN_INFORMATION_COLLECTION_ANSWER_SUPERSEDED",
        `Information collection answer is already superseded: ${parsed.answerId}`
      );
    }

    if (parsed.decision === "revise" && currentAnswer.kind === "text") {
      if (!parsed.replacementValueText?.trim()) {
        throw new AppError(
          409,
          "RUN_INFORMATION_COLLECTION_REVIEW_INVALID",
          `Text answer revisions require replacementValueText: ${parsed.answerId}`
        );
      }
    }

    if (parsed.decision === "revise" && currentAnswer.kind === "attachment") {
      const replacementPath = parsed.replacementAttachmentPath?.trim();
      if (!replacementPath) {
        throw new AppError(
          409,
          "RUN_INFORMATION_COLLECTION_REVIEW_INVALID",
          `Attachment answer revisions require replacementAttachmentPath: ${parsed.answerId}`
        );
      }

      await this.#runFileAccessService.statRunFile(runId, replacementPath);
    }

    const reviewedAt = nowIso();
    let nextCollection: RunInformationCollection | null = null;
    let reviewMessage: RunConversationMessage | null = null;

    const updated = await this.#runsRepository.update(runId, (current) => {
      const baseCollection =
        current.informationCollection ??
        createRunInformationCollection({
          prompt: createInformationCollectionPrompt(current.run),
        });
      const reviewedCollection = reviewInformationCollectionAnswer(baseCollection, {
        answerId: parsed.answerId,
        decision: parsed.decision,
        at: reviewedAt,
        reviewedByUserId: options.reviewedByUserId ?? null,
        note: parsed.note ?? null,
        replacementValueText: parsed.replacementValueText,
        replacementAttachmentPath: parsed.replacementAttachmentPath,
        replacementAttachmentLabel: parsed.replacementAttachmentLabel,
      });
      nextCollection = reviewedCollection;
      reviewMessage = createInformationCollectionReviewMessage(
        runId,
        currentAnswer,
        parsed.decision,
        reviewedCollection
      );

      return {
        ...current,
        run: {
          ...current.run,
          updatedAt: reviewedAt,
        },
        informationCollection: reviewedCollection,
        messages: reviewMessage ? [...current.messages, reviewMessage] : current.messages,
      };
    });

    if (!updated || !nextCollection) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    const reviewedInformationCollection = updated.informationCollection;
    if (!reviewedInformationCollection) {
      throw new AppError(
        500,
        "RUN_INFORMATION_COLLECTION_MISSING",
        `Information collection state missing after review: ${runId}`
      );
    }

    await this.#upsertQuerySnapshot(updated);

    const events: BridgeEvent[] = [
      {
        type: "informationCollection.updated",
        runId,
        informationCollection: reviewedInformationCollection,
        occurredAt: reviewedInformationCollection.lastUpdatedAt ?? reviewedAt,
      },
    ];

    if (reviewMessage) {
      events.unshift({
        type: "conversation.message",
        message: reviewMessage,
      });
    }

    await this.#emitEvents(events);

    return this.#buildSnapshot(updated);
  }

  async setApprovalMode(
    runId: string,
    input: UpdateRunApprovalModeInput,
    options: { updatedByUserId?: string | null } = {}
  ): Promise<RunSnapshot> {
    const parsed = updateRunApprovalModeInputSchema.parse(input);
    const current = this.#requireAggregate(runId);
    if (isTerminalStatus(current.run.status)) {
      throw new AppError(
        409,
        "RUN_APPROVAL_MODE_TERMINAL",
        `Approval mode cannot be changed after run ${runId} has reached ${current.run.status}.`
      );
    }

    if (current.run.approvalMode === parsed.approvalMode) {
      return this.#buildSnapshot(current);
    }

    const at = nowIso();
    const modeMessage = createMessage(
      runId,
      "system",
      "approval",
      parsed.approvalMode === "auto_all"
        ? "Automatic approval enabled for this instance. All approval requests will be accepted automatically."
        : "Automatic approval disabled for this instance. Future approval requests require manual confirmation."
    );
    const updated = await this.#runsRepository.update(runId, (aggregate) => ({
      ...aggregate,
      run: {
        ...aggregate.run,
        approvalMode: parsed.approvalMode,
        approvalModeUpdatedAt: at,
        approvalModeUpdatedByUserId: options.updatedByUserId ?? null,
        updatedAt: at,
      },
      messages: [...aggregate.messages, modeMessage],
    }));
    if (!updated) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);

    await this.#upsertQuerySnapshot(updated);
    await this.#emitEvent({ type: "conversation.message", message: modeMessage });

    if (parsed.approvalMode === "auto_all") {
      for (const approval of updated.approvals.filter((item) => item.state === "pending")) {
        try {
          await this.approve(
            runId,
            {
              approvalId: approval.approvalId,
              approved: true,
              note: "Automatically approved when automatic approval was enabled.",
            },
            {
              decidedByUserId: options.updatedByUserId ?? null,
              decisionMode: "auto_all",
              preserveStatus: approval.kind === "general",
              awaitBridgeDispatch: approval.kind === "general",
            }
          );
        } catch (error) {
          console.error(
            `[lingban-runs-service] failed to drain approval ${approval.approvalId} for ${runId}: ${toErrorMessage(error)}`
          );
          if (approval.kind === "general") {
            await this.decideApprovalWithoutStatusTransition(
              runId,
              {
                approvalId: approval.approvalId,
                approved: true,
                note: "Automatically approved after runtime reconciliation.",
              },
              {
                decidedByUserId: options.updatedByUserId ?? null,
                decisionMode: "auto_all",
              }
            );
          }
        }
      }
    }

    const registration = this.#bridgeRegistry.get(runId);
    if (registration?.supportedCommands.includes("setApprovalMode")) {
      await this.#bridgeRegistry.dispatch(runId, {
        type: "setApprovalMode",
        payload: parsed,
      }).catch((error) => {
        console.error(
          `[lingban-runs-service] failed to synchronize approval mode for ${runId}: ${toErrorMessage(error)}`
        );
      });
    }

    return this.getRun(runId);
  }

  async approve(
    runId: string,
    input: ApproveRunInput,
    options: {
      decidedByUserId?: string | null;
      preserveStatus?: boolean;
      decisionMode?: RunApprovalDecisionMode;
      awaitBridgeDispatch?: boolean;
    } = {}
  ): Promise<RunSnapshot> {
    const parsed = approveRunInputSchema.parse(input);
    const currentBeforeDecision = this.#requireAggregate(runId);
    this.#assertRunInteractive(this.#buildSnapshot(currentBeforeDecision), "Approving a request");
    const pendingBeforeDecision = parsed.approvalId
      ? currentBeforeDecision.approvals.find(
          (approval) => approval.approvalId === parsed.approvalId && approval.state === "pending"
        )
      : currentBeforeDecision.approvals.find((approval) => approval.state === "pending");
    const bridgeDispatchedBeforePersistence = Boolean(
      options.awaitBridgeDispatch && pendingBeforeDecision?.kind === "general"
    );

    if (bridgeDispatchedBeforePersistence) {
      await this.#bridgeRegistry.dispatch(runId, {
        type: "approve",
        payload: parsed,
      });
    }
    let decidedApproval: RunApproval | null = null;
    let decidedApprovalKind: RunApproval["kind"] | null = null;
    let previousStatus: RunStatus | null = null;
    let statusChanged = false;
    let remainingStartupApprovals = 0;

    const updated = await this.#runsRepository.update(runId, (current) => {
      previousStatus = current.run.status;
      const at = nowIso();
      const pendingApproval =
        parsed.approvalId != null
          ? current.approvals.find(
              (approval) =>
                approval.approvalId === parsed.approvalId && approval.state === "pending"
            )
          : current.approvals.find((approval) => approval.state === "pending");

      if (!pendingApproval) {
        throw new AppError(404, "APPROVAL_NOT_FOUND", `Pending approval not found: ${parsed.approvalId ?? "first-pending"}`);
      }
      decidedApproval = pendingApproval;
      decidedApprovalKind = pendingApproval.kind;
      remainingStartupApprovals = current.approvals.filter(
        (approval) =>
          approval.approvalId !== pendingApproval.approvalId &&
          approval.state === "pending" &&
          requiresStartupApproval(approval.kind)
      ).length;

      const keepWaitingForAdditionalApprovals =
        !options.preserveStatus &&
        parsed.approved &&
        current.run.status === "WAITING_APPROVAL" &&
        requiresStartupApproval(pendingApproval.kind) &&
        remainingStartupApprovals > 0;
      const shouldStartApprovedRun =
        !options.preserveStatus &&
        parsed.approved &&
        current.run.status === "WAITING_APPROVAL" &&
        requiresStartupApproval(pendingApproval.kind) &&
        remainingStartupApprovals === 0;

      const run =
        options.preserveStatus || keepWaitingForAdditionalApprovals
          ? {
              ...current.run,
              updatedAt: at,
              statusReason: keepWaitingForAdditionalApprovals
                ? "Approval granted. Additional approvals are still required before execution can start."
                : parsed.approved
                  ? "Approval granted for a gated action."
                  : "Approval rejected for a gated action.",
            }
          : this.#applyRunStatus(
              current.run,
              parsed.approved
                ? (shouldStartApprovedRun ? "STARTING" : "RUNNING")
                : "CANCELLED",
              at,
              parsed.approved
                ? (shouldStartApprovedRun
                  ? "Approval granted. Execution is starting."
                  : "Approval granted. Execution resumed.")
                : "Approval rejected. Execution stopped."
            );
      statusChanged = current.run.status !== run.status;

      return {
        ...current,
        run,
        approvals: current.approvals.map((approval) => {
          if (pendingApproval && approval.approvalId === pendingApproval.approvalId) {
            return runApprovalSchema.parse({
              ...approval,
              state: parsed.approved ? "approved" : "rejected",
              decidedAt: at,
              decisionMode: options.decisionMode ?? "manual",
              decidedByUserId: options.decidedByUserId ?? null,
              note: parsed.note ?? null,
            });
          }

          return approval;
        }),
        messages: [
          ...current.messages,
          createMessage(
            runId,
            "system",
            "approval",
            parsed.approved
              ? "Approval granted. The run will continue."
              : "Approval rejected. The run has been stopped."
          ),
        ],
      };
    });

    if (!updated) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    await this.#upsertQuerySnapshot(updated);

    if (decidedApproval) {
      await quotaService.applyRunApprovalDecision({
        approval: decidedApproval,
        approved: parsed.approved,
        decidedByUserId: options.decidedByUserId ?? null,
        note: parsed.note ?? null,
      });
    }

    const events: BridgeEvent[] = [
      {
        type: "conversation.message",
        message: updated.messages.at(-1)!,
      },
    ];

    if (!options.preserveStatus && statusChanged) {
      events.unshift({
        type: "run.status.changed",
        runId,
        status: updated.run.status,
        occurredAt: updated.run.updatedAt,
        reason: updated.run.statusReason,
      });
    }

    await this.#emitEvents(events);

    const shouldStartPendingQuotaRun =
      decidedApprovalKind != null &&
      requiresStartupApproval(decidedApprovalKind) &&
      parsed.approved &&
      previousStatus === "WAITING_APPROVAL" &&
      remainingStartupApprovals === 0;

    if (shouldStartPendingQuotaRun) {
      void this.#runtimeControl.startRun(runId).catch(() => undefined);
    } else if (
      decidedApprovalKind !== "quota-override" &&
      decidedApprovalKind !== "mcp-access" &&
      !bridgeDispatchedBeforePersistence
    ) {
      dispatchBridgeCommandDetached(this.#bridgeRegistry, runId, {
        type: "approve",
        payload: parsed,
      });
    }

    if (!options.preserveStatus && isTerminalStatus(updated.run.status)) {
      await billingService.recordRunRuntimeEstimate(updated).catch(() => undefined);
      await this.#runtimeControl.requestStop(runId).catch(() => undefined);
    }

    return this.#buildSnapshot(updated);
  }

  async decideApprovalWithoutStatusTransition(
    runId: string,
    input: ApproveRunInput,
    options: {
      decidedByUserId?: string | null;
      decisionMode?: RunApprovalDecisionMode;
    } = {}
  ): Promise<RunSnapshot> {
    const parsed = approveRunInputSchema.parse(input);
    let decidedApproval: RunApproval | null = null;

    const updated = await this.#runsRepository.update(runId, (current) => {
      const at = nowIso();
      const pendingApproval =
        parsed.approvalId != null
          ? current.approvals.find(
              (approval) =>
                approval.approvalId === parsed.approvalId && approval.state === "pending"
            )
          : current.approvals.find((approval) => approval.state === "pending");

      if (!pendingApproval) {
        throw new AppError(
          404,
          "APPROVAL_NOT_FOUND",
          `Pending approval not found: ${parsed.approvalId ?? "first-pending"}`
        );
      }
      decidedApproval = pendingApproval;

      return {
        ...current,
        run: {
          ...current.run,
          updatedAt: at,
          statusReason: parsed.approved
            ? "Approval granted for a gated action."
            : "Approval rejected for a gated action.",
        },
        approvals: current.approvals.map((approval) => {
          if (approval.approvalId === pendingApproval.approvalId) {
            return runApprovalSchema.parse({
              ...approval,
              state: parsed.approved ? "approved" : "rejected",
              decidedAt: at,
              decisionMode: options.decisionMode ?? "manual",
              decidedByUserId: options.decidedByUserId ?? null,
              note: parsed.note ?? null,
            });
          }

          return approval;
        }),
        messages: [
          ...current.messages,
          createMessage(
            runId,
            "system",
            "approval",
            parsed.approved
              ? "Approval granted for the gated action."
              : "Approval rejected for the gated action."
          ),
        ],
      };
    });

    if (!updated) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    await this.#upsertQuerySnapshot(updated);

    if (decidedApproval) {
      await quotaService.applyRunApprovalDecision({
        approval: decidedApproval,
        approved: parsed.approved,
        decidedByUserId: options.decidedByUserId ?? null,
        note: parsed.note ?? null,
      });
    }

    await this.#emitEvent({
      type: "conversation.message",
      message: updated.messages.at(-1)!,
    });

    return this.#buildSnapshot(updated);
  }

  async stop(
    runId: string,
    options: {
      reason?: string;
      mode?: RunStopMode;
      requestedByUserId?: string | null;
    } = {}
  ): Promise<RunSnapshot> {
    const mode = options.mode ?? "graceful";
    const reason = options.reason ?? (mode === "force" ? "Run force-terminated by an administrator" : "Run cancelled by user");
    const currentSnapshot = this.#buildSnapshot(this.#requireAggregate(runId));
    if (currentSnapshot.lifecycle.recordStatus === "DELETED") {
      throw new AppError(410, "RUN_DELETED", `Run has been deleted: ${runId}`);
    }
    if (
      isTerminalStatus(currentSnapshot.run.status) &&
      currentSnapshot.lifecycle.runtimeStatus === "RELEASED"
    ) {
      return currentSnapshot;
    }
    if (
      isTerminalStatus(currentSnapshot.run.status) &&
      ["STOP_REQUESTED", "STOPPING"].includes(currentSnapshot.lifecycle.runtimeStatus)
    ) {
      return await this.#releaseRuntime(runId, currentSnapshot.lifecycle.stopMode ?? mode);
    }

    const updated = await this.#runsRepository.update(runId, (current) => {
      const at = nowIso();
      const shouldFinalizePreStartRuntime =
        !current.runtime?.startedAt &&
        !current.runtime?.finishedAt &&
        (
          current.run.status === "CREATED" ||
          current.run.status === "READY" ||
          current.run.status === "QUEUED" ||
          current.run.status === "STARTING" ||
          current.run.status === "WAITING_APPROVAL"
        );
      const run =
        current.run.status === "CANCELLED" ||
        current.run.status === "FAILED" ||
        current.run.status === "SUCCEEDED"
          ? {
              ...current.run,
              updatedAt: at,
              statusReason: reason ?? current.run.statusReason,
            }
          : this.#applyRunStatus(current.run, "CANCELLED", at, reason);

      const lifecycle = runLifecycleSchema.parse({
        ...current.lifecycle,
        runtimeStatus: "STOP_REQUESTED",
        stopMode: mode,
        stopReason: reason,
        stopRequestedAt: current.lifecycle?.stopRequestedAt ?? at,
        stopRequestedByUserId: options.requestedByUserId ?? current.lifecycle?.stopRequestedByUserId ?? null,
        releaseOperationId: current.lifecycle?.releaseOperationId ?? `rop_${randomUUID()}`,
        releaseFailure: null,
      });

      return {
        ...current,
        run,
        lifecycle,
        runtime: shouldFinalizePreStartRuntime
          ? mergeRuntimeMetadata(current.runtime, {
              finishedAt: at,
              exitCode: null,
              exitSignal: null,
            })
          : current.runtime,
        messages: [
          ...current.messages,
          createMessage(runId, "system", "status", reason),
        ],
      };
    });

    if (!updated) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    await this.#upsertQuerySnapshot(updated);

    await this.#emitEvents([
      {
        type: "run.status.changed",
        runId,
        status: "CANCELLED",
        occurredAt: updated.run.updatedAt,
        reason: updated.run.statusReason,
      },
      {
        type: "conversation.message",
        message: updated.messages.at(-1)!,
      },
    ]);

    if (mode === "graceful") {
      dispatchBridgeCommandDetached(this.#bridgeRegistry, runId, {
        type: "cancel",
        reason,
      });
    }

    return await this.#releaseRuntime(runId, mode);
  }

  async cancel(
    runId: string,
    reason?: string,
    options: { requestedByUserId?: string | null } = {}
  ): Promise<RunSnapshot> {
    return await this.stop(runId, {
      reason,
      mode: "graceful",
      requestedByUserId: options.requestedByUserId,
    });
  }

  async forceTerminate(
    runId: string,
    reason: string,
    requestedByUserId?: string | null
  ): Promise<RunSnapshot> {
    return await this.stop(runId, {
      reason,
      mode: "force",
      requestedByUserId,
    });
  }

  async finalizeAfterSessionCapture(runId: string, captureId: string): Promise<RunSnapshot> {
    const currentSnapshot = this.getRun(runId);
    if (
      TERMINAL_STATUSES.has(currentSnapshot.run.status) &&
      currentSnapshot.lifecycle.runtimeStatus === "RELEASED"
    ) return currentSnapshot;
    const at = nowIso();
    const updated = await this.#runsRepository.update(runId, (current) => {
      if (current.run.status !== "RUNNING" && current.run.status !== "WAITING_APPROVAL") {
        throw new AppError(409, "RUN_FINALIZE_NOT_ALLOWED", `Run cannot be finalized from ${current.run.status}`);
      }
      const message = createMessage(
        runId,
        "system",
        "status",
        `Run finalized after verified terminal session capture ${captureId}.`
      );
      return {
        ...current,
        run: this.#applyRunStatus(
          current.run,
          "SUCCEEDED",
          at,
          `Verified terminal session capture: ${captureId}`
        ),
        lifecycle: runLifecycleSchema.parse({
          ...current.lifecycle,
          runtimeStatus: "STOP_REQUESTED",
          stopMode: "graceful",
          stopReason: `Verified terminal session capture: ${captureId}`,
          stopRequestedAt: current.lifecycle?.stopRequestedAt ?? at,
          releaseOperationId: current.lifecycle?.releaseOperationId ?? `rop_${randomUUID()}`,
          releaseFailure: null,
        }),
        messages: [...current.messages, message],
      };
    });
    if (!updated) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    await this.#upsertQuerySnapshot(updated);
    await this.#emitEvents([
      {
        type: "run.status.changed",
        runId,
        status: updated.run.status,
        occurredAt: at,
        reason: updated.run.statusReason,
      },
      {
        type: "conversation.message",
        message: updated.messages.at(-1)!,
      },
    ]);
    return await this.#releaseRuntime(runId, "graceful");
  }

  async archiveRun(
    runId: string,
    options: { requestedByUserId?: string | null } = {}
  ): Promise<RunSnapshot> {
    const snapshot = this.getRun(runId);
    if (!isTerminalStatus(snapshot.run.status) || snapshot.lifecycle.runtimeStatus !== "RELEASED") {
      throw new AppError(
        409,
        "RUN_ARCHIVE_NOT_READY",
        `Run ${runId} must be terminal and released before it can be archived.`
      );
    }
    if (snapshot.lifecycle.recordStatus === "ARCHIVED") return snapshot;
    const at = nowIso();
    const updated = await this.#runsRepository.update(runId, (current) => ({
      ...current,
      lifecycle: runLifecycleSchema.parse({
        ...current.lifecycle,
        recordStatus: "ARCHIVED",
        archivedAt: at,
        archivedByUserId: options.requestedByUserId ?? null,
      }),
      run: { ...current.run, updatedAt: at },
    }));
    if (!updated) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    await this.#upsertQuerySnapshot(updated);
    return this.#buildSnapshot(updated);
  }

  async restoreRun(
    runId: string,
    options: { requestedByUserId?: string | null } = {}
  ): Promise<RunSnapshot> {
    const snapshot = this.#buildSnapshot(this.#requireAggregate(runId));
    if (snapshot.lifecycle.recordStatus !== "ARCHIVED") {
      throw new AppError(409, "RUN_RESTORE_NOT_ALLOWED", `Run ${runId} is not archived.`);
    }
    const at = nowIso();
    const updated = await this.#runsRepository.update(runId, (current) => ({
      ...current,
      lifecycle: runLifecycleSchema.parse({
        ...current.lifecycle,
        recordStatus: "ACTIVE",
        archivedAt: null,
        archivedByUserId: null,
      }),
      run: { ...current.run, updatedAt: at },
    }));
    if (!updated) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    await this.#upsertQuerySnapshot(updated);
    return this.#buildSnapshot(updated);
  }

  async deleteRun(
    runId: string,
    options: {
      reason: string;
      confirmation: string;
      requestedByUserId?: string | null;
    }
  ): Promise<{
    runId: string;
    deletedAt: string;
    deletedUploads: number;
    deletedDownloadTickets: number;
    retainedSessionCaptures: number;
  }> {
    if (options.confirmation !== runId) {
      throw new AppError(400, "RUN_DELETE_CONFIRMATION_MISMATCH", "Run deletion confirmation does not match the run ID.");
    }
    const snapshot = this.#buildSnapshot(this.#requireAggregate(runId));
    if (!isTerminalStatus(snapshot.run.status) || snapshot.lifecycle.runtimeStatus !== "RELEASED") {
      throw new AppError(
        409,
        "RUN_DELETE_NOT_READY",
        `Run ${runId} must be terminal and released before deletion.`
      );
    }
    if (snapshot.lifecycle.recordStatus === "DELETED") {
      return {
        runId,
        deletedAt: snapshot.lifecycle.deletedAt ?? snapshot.run.updatedAt,
        deletedUploads: 0,
        deletedDownloadTickets: 0,
        retainedSessionCaptures: snapshot.sessionCaptures.length,
      };
    }

    const persistedSessionCaptures = await this.#sessionCaptureRepository.listByRunId(runId);
    const blockingCaptureIds = persistedSessionCaptures
      .filter((capture) => !["CAPTURED", "FAILED", "CANCELLED"].includes(capture.status))
      .map((capture) => capture.captureId);
    if (blockingCaptureIds.length > 0) {
      throw new AppError(
        409,
        "RUN_DELETE_CAPTURE_PENDING",
        `Run ${runId} has unfinished Session Captures: ${blockingCaptureIds.join(", ")}.`
      );
    }
    const retainedSessionCaptures = Math.max(
      snapshot.sessionCaptures.length,
      persistedSessionCaptures.length
    );
    const uploads = this.#uploadRepository.listUploadsByRun(runId);
    const downloadTickets = this.#uploadRepository
      .listDownloadTickets()
      .filter((ticket) => ticket.runId === runId);

    const requestedAt = nowIso();
    const pending = await this.#runsRepository.update(runId, (current) => ({
      ...current,
      lifecycle: runLifecycleSchema.parse({
        ...current.lifecycle,
        recordStatus: "DELETION_PENDING",
        deletionRequestedAt: requestedAt,
        deletionRequestedByUserId: options.requestedByUserId ?? null,
        deletionFailure: null,
      }),
      run: { ...current.run, updatedAt: requestedAt, statusReason: options.reason },
    }));
    if (!pending) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    await this.#upsertQuerySnapshot(pending);

    try {
      await this.#runtimeControl.requestWorkspaceCleanup(runId);
      await this.#runFileIndexService.replaceFromEntries(
        {
          runId,
          workspaceId: pending.run.workspaceId,
          targetPath: pending.run.targetPath,
        },
        []
      );
      for (const upload of uploads) {
        await this.#objectStore.deleteObject(upload.objectKey);
        await this.#uploadRepository.deleteUpload(upload.uploadId);
      }
      for (const ticket of downloadTickets) {
        await this.#uploadRepository.deleteDownloadTicket(ticket.ticketId);
      }
      await this.#agentRuntimeRepository.deleteRun(runId);
      await this.#runEventBus.deleteRun(runId);
    } catch (error) {
      const failed = await this.#runsRepository.update(runId, (current) => ({
        ...current,
        lifecycle: runLifecycleSchema.parse({
          ...current.lifecycle,
          recordStatus: snapshot.lifecycle.recordStatus,
          deletionFailure: toErrorMessage(error),
        }),
      }));
      if (failed) await this.#upsertQuerySnapshot(failed);
      throw new AppError(503, "RUN_DELETE_CLEANUP_FAILED", `Run deletion cleanup failed: ${toErrorMessage(error)}`);
    }

    const deletedAt = nowIso();
    const deleted = await this.#runsRepository.update(runId, (current) => {
      const deletedRun = {
        ...current.run,
        requestedByUserId: null,
        title: "Deleted run",
        targetPath: `/deleted/${runId}`,
        approvalModeUpdatedAt: null,
        approvalModeUpdatedByUserId: null,
        catalogMetadata: null,
        statusReason: "Run data permanently deleted",
        updatedAt: deletedAt,
      };
      const emptyBindings = {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      };
      const deletedInput = createRunInputSchema.parse({
        ...current.input,
        requestedByUserId: undefined,
        title: deletedRun.title,
        targetPath: deletedRun.targetPath,
        initialMessage: null,
        bindings: emptyBindings,
        providerSelection: null,
        catalogMetadata: null,
      });

      return {
        ...current,
        lifecycle: runLifecycleSchema.parse({
          ...current.lifecycle,
          recordStatus: "DELETED",
          stopReason: null,
          stopRequestedByUserId: null,
          releaseFailure: null,
          archivedByUserId: null,
          deletionRequestedByUserId: null,
          deletedAt,
          deletionFailure: null,
        }),
        run: deletedRun,
        runtime: runRuntimeMetadataSchema.parse({}),
        provider: null,
        informationCollection: createRunInformationCollection({ prompt: "Run data deleted." }),
        input: deletedInput,
        startJob: startRunJobPayloadSchema.parse({
          ...current.startJob,
          run: deletedRun,
          initialPrompt: "Run data deleted.",
          requestedInitialMessage: null,
          bindings: emptyBindings,
          credentialMounts: [],
          mcpBindings: [],
          mcpNetworkPolicies: [],
          provider: null,
        }),
        messages: [],
        files: [],
        artifacts: [],
        approvals: [],
        agentThread: null,
        sessionCaptures: [],
      };
    });
    if (!deleted) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    await this.#upsertQuerySnapshot(deleted);
    return {
      runId,
      deletedAt,
      deletedUploads: uploads.length,
      deletedDownloadTickets: downloadTickets.length,
      retainedSessionCaptures,
    };
  }

  async reconcileRuntime(runId: string): Promise<RunSnapshot> {
    const snapshot = this.#buildSnapshot(this.#requireAggregate(runId));
    if (!isTerminalStatus(snapshot.run.status)) {
      throw new AppError(409, "RUN_RECONCILE_NOT_TERMINAL", `Run ${runId} is still active.`);
    }
    if (snapshot.lifecycle.runtimeStatus === "RELEASED") return snapshot;
    return await this.#releaseRuntime(runId, snapshot.lifecycle.stopMode ?? "force");
  }

  async syncRunStatus(runId: string, status: RunStatus, reason?: string | null, occurredAt?: string) {
    const at = occurredAt ?? nowIso();
    const updated = await this.#runsRepository.update(runId, (current) => ({
      ...current,
      run: this.#applyRunStatus(current.run, status, at, reason ?? null),
    }));

    if (!updated) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    await this.#upsertQuerySnapshot(updated);

    await this.#emitEvent({
      type: "run.status.changed",
      runId,
      status,
      occurredAt: at,
      reason: reason ?? null,
    });

    return this.#buildSnapshot(updated);
  }

  async syncArtifacts(runId: string, artifacts: RunArtifact[]) {
    const parsedArtifacts = artifacts.map((artifact) => runArtifactSchema.parse(artifact));
    const updated = await this.#runsRepository.update(runId, (current) => ({
      ...current,
      artifacts: parsedArtifacts.reduce(
        (result, artifact) => upsertByKey(result, "artifactId", artifact),
        current.artifacts
      ),
    }));

    if (!updated) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    await this.#upsertQuerySnapshot(updated);

    await this.#emitEvents(
      parsedArtifacts.map((artifact) => ({
        type: "artifact.ready" as const,
        artifact,
      }))
    );

    return this.#buildSnapshot(updated);
  }

  async syncRunRuntime(runId: string, runtime: RunRuntimeUpdate) {
    const parsedRuntime = runRuntimeUpdateSchema.parse(runtime);
    const updated = await this.#runsRepository.update(runId, (current) => ({
      ...current,
      runtime: mergeRuntimeMetadata(current.runtime, parsedRuntime),
      lifecycle: runLifecycleSchema.parse({
        ...current.lifecycle,
        runtimeStatus: parsedRuntime.finishedAt
          ? "RELEASED"
          : parsedRuntime.startedAt || parsedRuntime.readyAt
            ? "ACTIVE"
            : current.lifecycle?.runtimeStatus ?? "NOT_STARTED",
        releasedAt: parsedRuntime.finishedAt ?? current.lifecycle?.releasedAt ?? null,
        billingStoppedAt: parsedRuntime.finishedAt ?? current.lifecycle?.billingStoppedAt ?? null,
        releaseFailure: parsedRuntime.finishedAt ? null : current.lifecycle?.releaseFailure ?? null,
      }),
    }));

    if (!updated) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    await this.#upsertQuerySnapshot(updated);

    return this.#buildSnapshot(updated);
  }

  async syncSessionCaptures(runId: string, captures: SessionCaptureSummary[]) {
    const updated = await this.#runsRepository.update(runId, (current) => ({
      ...current,
      sessionCaptures: captures,
    }));
    if (!updated) throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    await this.#upsertQuerySnapshot(updated);
    return this.#buildSnapshot(updated);
  }

  async requestSessionCaptureExecution(runId: string, captureId: string) {
    const recovery = this.#buildRuntimeRecoveryCandidate(runId);
    if (recovery.action === "enqueue-start") {
      await this.#runtimeControl.startRun(runId);
      return {
        deferred: true as const,
        reason: recovery.reason ?? "runtime recovery was requested before session capture",
      };
    }
    if (recovery.action === "mark-orphan-failed") {
      throw new AppError(
        409,
        "RUN_CAPTURE_RUNTIME_UNAVAILABLE",
        recovery.reason ?? `Runtime is unavailable for capture ${captureId}`
      );
    }
    await this.#runtimeControl.requestSessionCapture(runId, captureId);
    return { deferred: false as const, reason: null };
  }

  async ingestBridgeEvents(runId: string, events: BridgeEvent[]) {
    const approvalContext = this.#requireAggregate(runId).run;
    const parsedEvents = events.map((event) => {
      const parsedEvent = bridgeEventSchema.parse(event);
      if (
        parsedEvent.type === "approval.requested" &&
        parsedEvent.approval.decisionMode === "auto_all" &&
        !parsedEvent.approval.decidedByUserId
      ) {
        return bridgeEventSchema.parse({
          ...parsedEvent,
          approval: {
            ...parsedEvent.approval,
            decidedByUserId:
              approvalContext.approvalModeUpdatedByUserId ??
              approvalContext.requestedByUserId ??
              null,
          },
        });
      }
      return parsedEvent;
    });
    for (const event of parsedEvents) {
      if (inferRunIdFromBridgeEvent(event) !== runId) {
        throw new AppError(409, "RUN_EVENT_SCOPE_MISMATCH", `Bridge event does not belong to run ${runId}`);
      }
    }
    const updated = await this.#runsRepository.update(runId, (current) => {
      let next = {
        ...current,
      };

      for (const event of parsedEvents) {
        switch (event.type) {
          case "run.status.changed":
            next = {
              ...next,
              run: this.#applyRunStatus(
                next.run,
                event.status,
                event.occurredAt,
                event.reason ?? null
              ),
            };
            break;
          case "conversation.message":
            if (!next.messages.some((message) => message.messageId === event.message.messageId)) {
              next = {
                ...next,
                messages: [...next.messages, event.message],
              };
            }
            break;
          case "approval.requested":
            next = {
              ...next,
              approvals: upsertByKey(next.approvals, "approvalId", event.approval),
            };
            break;
          case "artifact.ready":
            next = {
              ...next,
              artifacts: upsertByKey(next.artifacts, "artifactId", event.artifact),
            };
            break;
          case "mcp.call":
            break;
          case "files.synced":
            next = {
              ...next,
              files: event.files,
            };
            break;
          case "file.changed":
            next = {
              ...next,
              files: upsertByKey(next.files, "path", event.file),
            };
            break;
          case "run.failed":
            next = {
              ...next,
              run: this.#applyRunStatus(next.run, "FAILED", event.occurredAt, event.error),
            };
            break;
          case "agent.thread.state":
            next = {
              ...next,
              agentThread: event.thread,
            };
            break;
          case "agent.runtime.event":
            break;
          case "heartbeat":
            break;
        }
      }

      return next;
    });

    if (!updated) {
      throw new AppError(404, "RUN_NOT_FOUND", `Run not found: ${runId}`);
    }

    await this.#upsertQuerySnapshot(updated);

    for (const event of parsedEvents) {
      if (event.type === "agent.runtime.event") {
        await this.#agentRuntimeRepository.appendEvent(agentRuntimeEventRecordSchema.parse({
          ...event,
          eventId: `aev_${randomUUID()}`,
          receivedAt: nowIso(),
        }));
      }
      if (event.type === "agent.thread.state") {
        const existing = await this.#agentRuntimeRepository.getThreadByRunId(runId);
        await this.#agentRuntimeRepository.upsertThread(agentThreadRecordSchema.parse({
          ...event.thread,
          runId,
          providerId: updated.provider?.providerId ?? null,
          providerBindingId: updated.provider?.bindingId ?? null,
          model: updated.provider?.model ?? null,
          runtimeConfigSha256: existing?.runtimeConfigSha256 ?? null,
          startedAt: existing?.startedAt ?? event.occurredAt,
          updatedAt: event.occurredAt,
          stoppedAt:
            event.thread.connectionState === "stopped" || event.thread.connectionState === "failed"
              ? event.occurredAt
              : null,
        }));
      }
    }

    await this.#emitEvents(parsedEvents);

    if (updated.run.approvalMode === "auto_all") {
      for (const event of parsedEvents) {
        if (event.type !== "approval.requested" || event.approval.state !== "pending") {
          continue;
        }

        try {
          await this.approve(
            runId,
            {
              approvalId: event.approval.approvalId,
              approved: true,
              note: "Automatically approved by the instance approval policy.",
            },
            {
              decidedByUserId: updated.run.approvalModeUpdatedByUserId,
              decisionMode: "auto_all",
              preserveStatus: true,
              awaitBridgeDispatch: true,
            }
          );
        } catch (error) {
          console.error(
            `[lingban-runs-service] failed to auto-approve ${event.approval.approvalId} for ${runId}: ${toErrorMessage(error)}`
          );
        }
      }
    }

    for (const event of parsedEvents) {
      switch (event.type) {
        case "mcp.call": {
          const recorded = await mcpCallAuditService.recordCallForRun(updated.run, event.call);

          if (recorded.isFirstSeen && NON_REJECTED_MCP_CALL_STATUSES.has(recorded.record.status)) {
            await quotaService.recordUsage({
              workspaceId: recorded.record.workspaceId,
              workspaceContextKey: recorded.record.workspaceContextKey,
              requestedByUserId: recorded.record.requestedByUserId,
              serviceId: recorded.record.serviceId,
              taskVersionId: recorded.record.taskVersionId,
              sessionVersionId: recorded.record.sessionVersionId,
              entrySurface: recorded.record.entrySurface,
              packageIds: [],
              metric: "mcp_calls",
              delta: 1,
              runId: recorded.record.runId,
              note: `Recorded MCP call ${recorded.record.callId} for ${recorded.record.mcpId}.`,
            });
            await billingService.recordUsage({
              workspaceId: recorded.record.workspaceId,
              workspaceContextKey: recorded.record.workspaceContextKey,
              requestedByUserId: recorded.record.requestedByUserId,
              serviceId: recorded.record.serviceId,
              taskVersionId: recorded.record.taskVersionId,
              sessionVersionId: recorded.record.sessionVersionId,
              entrySurface: recorded.record.entrySurface,
              packageIds: [],
              metric: "mcp_calls",
              quantity: 1,
              source: "mcp-call",
              sourceRef: recorded.record.callId,
              runId: recorded.record.runId,
              note:
                `Recorded MCP call ${recorded.record.mcpId}:${recorded.record.toolName} ` +
                `(${recorded.record.status}).`,
              costBasis: "actual",
              entryId: buildMcpCallBillingEntryId(recorded.record.callId),
            });
          }
          break;
        }
        case "files.synced":
          await this.#runFileIndexService.replaceFromEntries(
            {
              runId,
              workspaceId: updated.run.workspaceId,
              targetPath: updated.run.targetPath,
            },
            event.files
          );
          break;
        case "file.changed":
          await this.#runFileIndexService.upsertFromEntry(
            {
              runId,
              workspaceId: updated.run.workspaceId,
              targetPath: updated.run.targetPath,
            },
            event.file
          );
          break;
        default:
          break;
      }
    }

    return this.#buildSnapshot(updated);
  }
}

let defaultRunOrchestrator: EmbeddedRunOrchestrator | null = null;

function getDefaultRunOrchestrator() {
  if (!defaultRunOrchestrator) {
    throw new Error("Default run orchestrator has not been initialized.");
  }

  return defaultRunOrchestrator;
}

export function createRunsServiceDependencies(): RunsServiceDependencies {
  return {
    runsRepository,
    runEventBus,
    runFileIndexService,
    runFileAccessService,
    runQueryRepository,
    bridgeRegistry,
    runtimeControl: {
      startRun: (runId) => getDefaultRunOrchestrator().startRun(runId),
      requestStop: (runId, options) => getDefaultRunOrchestrator().requestStop(runId, options),
      requestWorkspaceCleanup: (runId) => getDefaultRunOrchestrator().requestWorkspaceCleanup(runId),
      requestSessionCapture: (runId, captureId) =>
        getDefaultRunOrchestrator().requestSessionCapture(runId, captureId),
      getDiagnostics: () => getDefaultRunOrchestrator().getDiagnostics(),
      recover: () => getDefaultRunOrchestrator().recover(),
      shutdown: () => getDefaultRunOrchestrator().shutdown(),
    },
    agentRuntimeRepository,
  };
}

export const defaultRunsServiceDependencies = createRunsServiceDependencies();
export const runsService = new RunsService(defaultRunsServiceDependencies);

export async function initializeRunsInfrastructure() {
  const bootstrapTasks = [
    defaultRunsServiceDependencies.runsRepository.init(),
    defaultRunsServiceDependencies.runEventBus.init(),
    defaultRunsServiceDependencies.runFileIndexService.init(),
  ];

  if (defaultRunsServiceDependencies.runQueryRepository) {
    bootstrapTasks.push(defaultRunsServiceDependencies.runQueryRepository.init());
  }

  await Promise.all(bootstrapTasks);

  if (!bootstrapped) {
    bootstrapSequences(defaultRunsServiceDependencies.runsRepository);
    bootstrapped = true;
  }
}

export async function recoverRunsRuntimeAfterStartup() {
  const releaseCandidates = runsService
    .listRuns()
    .filter(
      (snapshot) =>
        isTerminalStatus(snapshot.run.status) &&
        snapshot.lifecycle.runtimeStatus !== "RELEASED"
    );
  for (const candidate of releaseCandidates) {
    await runsService.reconcileRuntime(candidate.run.runId).catch((error) => {
      console.error(
        `[lingban-runs-service] failed to reconcile terminal runtime ${candidate.run.runId} during startup: ${toErrorMessage(error)}`
      );
    });
  }
  await defaultRunsServiceDependencies.runtimeControl.recover();
}

export async function shutdownRunsRuntime() {
  await defaultRunsServiceDependencies.runtimeControl.shutdown();
}

export const runOrchestrator = new EmbeddedRunOrchestrator({
  getRunSnapshot: (runId) => runsService.getRun(runId),
  getStartRunJobPayload: (runId) => runsService.getStartRunJobPayload(runId),
  listRuns: () => runsService.listRuns(),
  syncRunRuntime: (runId, runtime) => runsService.syncRunRuntime(runId, runtime),
  ingestBridgeEvents: (runId, events) => runsService.ingestBridgeEvents(runId, events),
});
defaultRunOrchestrator = runOrchestrator;
