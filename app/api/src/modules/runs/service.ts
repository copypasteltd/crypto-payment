import {
  approveRunInputSchema,
  bridgeEventSchema,
  createRunInputSchema,
  internalRuntimeDiagnosticsSchema,
  reviewRunInformationAnswerInputSchema,
  runApprovalSchema,
  runArtifactSchema,
  runConversationMessageSchema,
  runRuntimeMetadataSchema,
  runRuntimeUpdateSchema,
  runFileEntrySchema,
  type ListRunsQuery,
  runSnapshotSchema,
  sendRunMessageInputSchema,
  startRunJobPayloadSchema,
  type ApproveRunInput,
  type BridgeEvent,
  type CreateRunInput,
  type InternalRuntimeDiagnostics,
  type RunApproval,
  type RunArtifact,
  type RunConversationMessage,
  type RunControlCommand,
  type RunFileRecord,
  type RunInformationCollection,
  type RunInformationCollectionAnswer,
  type RunRuntimeMetadata,
  type RunRuntimeRecoveryCandidate,
  type RunRuntimeUpdate,
  type RunFileEntry,
  type RunRecord,
  type ResolvedRunProvider,
  type ReviewRunInformationAnswerInput,
  type RunSnapshot,
  type RunStatus,
  type SendRunMessageInput,
  type StartRunJobPayload,
  type SessionCaptureSummary,
  agentRuntimeEventRecordSchema,
  agentThreadRecordSchema,
} from "@lingban/contracts";
import { inferRunIdFromBridgeEvent, type AgentRuntimeRepository, type RunQueryRepository } from "@lingban/db";
import { randomUUID } from "node:crypto";
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
import { runsRepository } from "./repository.js";
import { EmbeddedRunOrchestrator } from "./runtime-orchestrator.js";
import { agentRuntimeRepository } from "../agent-runtime/repository.js";
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

type RunEventBusLike = Pick<typeof runEventBus, "init" | "append" | "appendMany">;
type AgentRuntimeRepositoryLike = Pick<
  AgentRuntimeRepository,
  "getThreadByRunId" | "upsertThread" | "appendEvent" | "listEvents"
>;

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
  "startRun" | "requestStop" | "requestSessionCapture" | "getDiagnostics" | "recover" | "shutdown"
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
    note: null,
  });
}

function createSeedApproval(runId: string): RunApproval {
  return createApproval(runId, {
    prompt: "Confirm any sensitive operation before execution continues.",
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

  constructor(dependencies: RunsServiceDependencies) {
    this.#runsRepository = dependencies.runsRepository;
    this.#runEventBus = dependencies.runEventBus;
    this.#runFileIndexService = dependencies.runFileIndexService;
    this.#runFileAccessService = dependencies.runFileAccessService;
    this.#runQueryRepository = dependencies.runQueryRepository ?? null;
    this.#bridgeRegistry = dependencies.bridgeRegistry;
    this.#runtimeControl = dependencies.runtimeControl;
    this.#agentRuntimeRepository = dependencies.agentRuntimeRepository ?? agentRuntimeRepository;
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
    provider?: RunSnapshot["provider"];
    informationCollection?: RunSnapshot["informationCollection"];
    messages: RunConversationMessage[];
    files: RunFileEntry[];
    artifacts: RunArtifact[];
    approvals: RunApproval[];
  }): RunSnapshot {
    return this.#decorateSnapshot(runSnapshotSchema.parse(aggregate));
  }

  async #upsertQuerySnapshot(aggregate: {
    run: RunSnapshot["run"];
    runtime?: RunSnapshot["runtime"];
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

    let action: RunRuntimeRecoveryCandidate["action"] = "ignore";
    let reason: string | null = null;
    let startJob: StartRunJobPayload | null = null;

    if (isTerminalStatus(snapshot.run.status)) {
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
      if (bridge.registered) {
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

  async #emitEvent(event: BridgeEvent) {
    await this.#runEventBus.append(bridgeEventSchema.parse(event));
  }

  async #emitEvents(events: BridgeEvent[]) {
    await this.#runEventBus.appendMany(events.map((event) => bridgeEventSchema.parse(event)));
  }

  async createRun(input: CreateRunInput) {
    const parsed = createRunInputSchema.parse(input);
    const runId = nextRunId();
    let usesSealedV2Session = false;
    if (parsed.catalogMetadata?.workspaceContextKey || parsed.catalogMetadata?.serviceId) {
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
    if (!usesSealedV2Session && parsed.catalogMetadata?.workspaceContextKey && parsed.catalogMetadata?.serviceId) {
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
    const startupApprovals = [
      ...(quotaApproval ? [quotaApproval] : []),
      ...mcpStartupApprovals,
    ];

    if (startupApprovals.length > 0) {
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
      approvals:
        startupApprovals.length > 0
          ? startupApprovals
          : [createSeedApproval(run.runId)],
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
    return this.#buildSnapshot(this.#requireAggregate(runId));
  }

  getStartRunJobPayload(runId: string): StartRunJobPayload {
    const aggregate = this.#requireAggregate(runId);
    return startRunJobPayloadSchema.parse({
      ...aggregate.startJob,
      run: aggregate.run,
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
    const quotaPreview = consumedOverride ? null : quotaService.previewUsage(quotaUsage);

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

  async approve(
    runId: string,
    input: ApproveRunInput,
    options: {
      decidedByUserId?: string | null;
      preserveStatus?: boolean;
    } = {}
  ): Promise<RunSnapshot> {
    const parsed = approveRunInputSchema.parse(input);
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
      decidedApprovalKind !== "mcp-access"
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
    options: { decidedByUserId?: string | null } = {}
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

  async cancel(runId: string, reason?: string): Promise<RunSnapshot> {
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
          : this.#applyRunStatus(current.run, "CANCELLED", at, reason ?? "Run cancelled by user");

      return {
        ...current,
        run,
        runtime: shouldFinalizePreStartRuntime
          ? mergeRuntimeMetadata(current.runtime, {
              finishedAt: at,
              exitCode: null,
              exitSignal: null,
            })
          : current.runtime,
        messages: [
          ...current.messages,
          createMessage(runId, "system", "status", reason ?? "Run cancelled."),
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

    dispatchBridgeCommandDetached(this.#bridgeRegistry, runId, {
      type: "cancel",
      reason,
    });
    await billingService.recordRunRuntimeEstimate(updated).catch(() => undefined);
    await this.#runtimeControl.requestStop(runId).catch(() => undefined);

    return this.#buildSnapshot(updated);
  }

  async finalizeAfterSessionCapture(runId: string, captureId: string): Promise<RunSnapshot> {
    const currentSnapshot = this.getRun(runId);
    if (TERMINAL_STATUSES.has(currentSnapshot.run.status)) return currentSnapshot;
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
    await billingService.recordRunRuntimeEstimate(updated).catch(() => undefined);
    await this.#runtimeControl.requestStop(runId).catch((error) => {
      console.error(`[lingban-runs-service] failed to stop finalized runtime ${runId}: ${toErrorMessage(error)}`);
    });
    return this.#buildSnapshot(updated);
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

    if (isTerminalStatus(status)) {
      await billingService.recordRunRuntimeEstimate(updated).catch(() => undefined);
      void this.#runtimeControl.requestStop(runId).catch(() => undefined);
    }

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
    return this.#runtimeControl.requestSessionCapture(runId, captureId);
  }

  async ingestBridgeEvents(runId: string, events: BridgeEvent[]) {
    const parsedEvents = events.map((event) => bridgeEventSchema.parse(event));
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

    if (isTerminalStatus(updated.run.status)) {
      await billingService.recordRunRuntimeEstimate(updated).catch(() => undefined);
      void this.#runtimeControl.requestStop(runId).catch(() => undefined);
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
      requestStop: (runId) => getDefaultRunOrchestrator().requestStop(runId),
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
