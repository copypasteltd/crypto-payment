import { z } from "zod";
import { bridgeIdSchema, isoDatetimeSchema, runIdSchema, workspaceIdSchema, } from "./common.js";
import { approveRunInputSchema, runApprovalSchema, runArtifactSchema, runConversationMessageSchema, runFileEntrySchema, runInformationCollectionSchema, runSnapshotSchema, runStatusSchema, sendRunMessageInputSchema, startRunJobPayloadSchema, } from "./runs.js";
import { mcpCallRecordSchema } from "./mcp.js";
export const bridgeCommandTypeSchema = z.enum([
    "sendMessage",
    "approve",
    "cancel",
    "ping",
    "syncFiles",
    "flushArtifacts",
]);
export const bridgeRegistrationSchema = z.object({
    bridgeId: bridgeIdSchema,
    runId: runIdSchema,
    workspaceId: workspaceIdSchema,
    targetPath: z.string().min(1),
    control: z
        .object({
        baseUrl: z.string().url(),
        authToken: z.string().min(1).optional(),
    })
        .optional(),
    supportedCommands: z.array(bridgeCommandTypeSchema).default([
        "sendMessage",
        "approve",
        "cancel",
        "ping",
        "syncFiles",
        "flushArtifacts",
    ]),
    connectedAt: isoDatetimeSchema,
    lastSeenAt: isoDatetimeSchema.optional(),
});
export const runControlCommandSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("sendMessage"),
        payload: sendRunMessageInputSchema,
    }),
    z.object({
        type: z.literal("approve"),
        payload: approveRunInputSchema,
    }),
    z.object({
        type: z.literal("cancel"),
        reason: z.string().min(1).optional(),
    }),
    z.object({
        type: z.literal("ping"),
    }),
    z.object({
        type: z.literal("syncFiles"),
    }),
    z.object({
        type: z.literal("flushArtifacts"),
    }),
]);
export const bridgeEventSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("run.status.changed"),
        runId: runIdSchema,
        status: runStatusSchema,
        occurredAt: isoDatetimeSchema,
        reason: z.string().nullable().optional(),
    }),
    z.object({
        type: z.literal("conversation.message"),
        message: runConversationMessageSchema,
    }),
    z.object({
        type: z.literal("approval.requested"),
        approval: runApprovalSchema,
    }),
    z.object({
        type: z.literal("informationCollection.updated"),
        runId: runIdSchema,
        informationCollection: runInformationCollectionSchema,
        occurredAt: isoDatetimeSchema,
    }),
    z.object({
        type: z.literal("artifact.ready"),
        artifact: runArtifactSchema,
    }),
    z.object({
        type: z.literal("mcp.call"),
        call: mcpCallRecordSchema,
    }),
    z.object({
        type: z.literal("files.synced"),
        runId: runIdSchema,
        files: z.array(runFileEntrySchema),
        occurredAt: isoDatetimeSchema,
    }),
    z.object({
        type: z.literal("file.changed"),
        runId: runIdSchema,
        file: runFileEntrySchema,
        occurredAt: isoDatetimeSchema,
    }),
    z.object({
        type: z.literal("heartbeat"),
        runId: runIdSchema,
        occurredAt: isoDatetimeSchema,
    }),
    z.object({
        type: z.literal("run.failed"),
        runId: runIdSchema,
        occurredAt: isoDatetimeSchema,
        error: z.string().min(1),
    }),
]);
export const bridgeEventsIngestSchema = z.object({
    events: z.array(bridgeEventSchema).min(1),
});
export const runStatusUpdateSchema = z.object({
    status: runStatusSchema,
    reason: z.string().min(1).nullable().optional(),
    occurredAt: isoDatetimeSchema.optional(),
});
export const artifactSyncSchema = z.object({
    artifacts: z.array(runArtifactSchema).default([]),
});
export const runRuntimeRecoveryActionSchema = z.enum([
    "enqueue-start",
    "await-bridge",
    "mark-orphan-failed",
    "schedule-cleanup",
    "ignore",
]);
export const runRuntimeRecoveryBridgeStateSchema = z.object({
    registered: z.boolean(),
    controllerAttached: z.boolean(),
    connectedAt: isoDatetimeSchema.nullable().default(null),
    lastSeenAt: isoDatetimeSchema.nullable().default(null),
});
export const runRuntimeRecoveryCandidateSchema = z.object({
    snapshot: runSnapshotSchema,
    bridge: runRuntimeRecoveryBridgeStateSchema,
    action: runRuntimeRecoveryActionSchema,
    reason: z.string().min(1).nullable().default(null),
    startJob: startRunJobPayloadSchema.nullable().default(null),
});
export const runRuntimeRecoveryListSchema = z.object({
    candidates: z.array(runRuntimeRecoveryCandidateSchema),
});
const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const bridgeRegistryConnectionDiagnosticsSchema = bridgeRegistrationSchema.extend({
    lastSeenAt: isoDatetimeSchema,
    controllerAttached: z.boolean(),
    pendingCommandsCount: nonNegativeIntegerSchema.default(0),
    stale: z.boolean().default(false),
});
export const bridgeRegistryPersistenceErrorSchema = z.object({
    operation: z.enum(["save", "delete"]).nullable().default(null),
    occurredAt: isoDatetimeSchema.nullable().default(null),
    message: z.string().min(1).nullable().default(null),
});
export const bridgeRegistryLastSweepSchema = z.object({
    startedAt: isoDatetimeSchema.nullable().default(null),
    finishedAt: isoDatetimeSchema.nullable().default(null),
    durationMs: nonNegativeIntegerSchema.nullable().default(null),
    evictedCount: nonNegativeIntegerSchema.default(0),
    error: z.string().min(1).nullable().default(null),
});
export const bridgeRegistryMetricsSchema = z.object({
    registrationsTotal: nonNegativeIntegerSchema.default(0),
    unregistrationsTotal: nonNegativeIntegerSchema.default(0),
    queuedCommandsTotal: nonNegativeIntegerSchema.default(0),
    forwardedCommandsTotal: nonNegativeIntegerSchema.default(0),
    staleEvictionsTotal: nonNegativeIntegerSchema.default(0),
    persistedDeleteQueueTotal: nonNegativeIntegerSchema.default(0),
    persistenceSaveFailuresTotal: nonNegativeIntegerSchema.default(0),
    persistenceDeleteFailuresTotal: nonNegativeIntegerSchema.default(0),
    sweepRunsTotal: nonNegativeIntegerSchema.default(0),
    sweepEvictionsTotal: nonNegativeIntegerSchema.default(0),
    sweepFailuresTotal: nonNegativeIntegerSchema.default(0),
});
export const bridgeRegistryDiagnosticsSchema = z.object({
    initialized: z.boolean(),
    repositoryKind: z.enum(["file", "postgres", "unknown"]).default("unknown"),
    sweeperActive: z.boolean(),
    staleAfterMs: z.number().int().positive(),
    sweepIntervalMs: z.number().int().positive(),
    registeredConnectionsCount: nonNegativeIntegerSchema.default(0),
    controllerAttachedCount: nonNegativeIntegerSchema.default(0),
    pendingRunsCount: nonNegativeIntegerSchema.default(0),
    pendingCommandsCount: nonNegativeIntegerSchema.default(0),
    staleCandidatesCount: nonNegativeIntegerSchema.default(0),
    persistencePendingCount: nonNegativeIntegerSchema.default(0),
    metrics: bridgeRegistryMetricsSchema,
    lastPersistenceError: bridgeRegistryPersistenceErrorSchema,
    lastSweep: bridgeRegistryLastSweepSchema,
    connections: z.array(bridgeRegistryConnectionDiagnosticsSchema).default([]),
});
export const runtimeOrchestratorDiagnosticsSchema = z.object({
    dispatchMode: z.enum(["embedded", "bullmq"]),
    maxConcurrentRuns: z.number().int().positive(),
    orphanRecoveryGraceMs: nonNegativeIntegerSchema,
    terminalWorkspaceTtlMs: nonNegativeIntegerSchema,
    runStartQueueEnabled: z.boolean(),
    runCleanupQueueEnabled: z.boolean(),
    activeRunsCount: nonNegativeIntegerSchema.default(0),
    launchingRunsCount: nonNegativeIntegerSchema.default(0),
    scheduledRunsCount: nonNegativeIntegerSchema.default(0),
    queueDepth: nonNegativeIntegerSchema.default(0),
    stopRequestedCount: nonNegativeIntegerSchema.default(0),
    orphanRecoveryTimersCount: nonNegativeIntegerSchema.default(0),
    cleanupTimersCount: nonNegativeIntegerSchema.default(0),
    drainInProgress: z.boolean(),
    activeRunIds: z.array(runIdSchema).default([]),
    launchingRunIds: z.array(runIdSchema).default([]),
    scheduledRunIds: z.array(runIdSchema).default([]),
    queuedRunIds: z.array(runIdSchema).default([]),
});
export const runtimeRecoveryDiagnosticsSchema = z.object({
    candidatesCount: nonNegativeIntegerSchema.default(0),
    actionCounts: z.object({
        "enqueue-start": nonNegativeIntegerSchema.default(0),
        "await-bridge": nonNegativeIntegerSchema.default(0),
        "mark-orphan-failed": nonNegativeIntegerSchema.default(0),
        "schedule-cleanup": nonNegativeIntegerSchema.default(0),
        ignore: nonNegativeIntegerSchema.default(0),
    }),
});
export const internalRuntimeDiagnosticsSchema = z.object({
    bridgeRegistry: bridgeRegistryDiagnosticsSchema,
    runtimeOrchestrator: runtimeOrchestratorDiagnosticsSchema,
    recovery: runtimeRecoveryDiagnosticsSchema,
});
export const remoteRuntimeProbeStatusSchema = z.enum([
    "ready",
    "not_ready",
    "unreachable",
    "disabled",
]);
export const workerOpsRuntimeProbeSchema = z.object({
    configured: z.boolean(),
    baseUrl: z.string().url().nullable().default(null),
    status: remoteRuntimeProbeStatusSchema,
    readinessStatus: z.enum(["ready", "not_ready"]).nullable().default(null),
    diagnosticsAvailable: z.boolean().default(false),
    probedAt: isoDatetimeSchema.nullable().default(null),
    durationMs: nonNegativeIntegerSchema.nullable().default(null),
    error: z.string().min(1).nullable().default(null),
    summary: z.record(z.string(), z.unknown()).default({}),
});
export const bridgeControlProbeSchema = z.object({
    runId: runIdSchema,
    bridgeId: bridgeIdSchema,
    baseUrl: z.string().url(),
    status: remoteRuntimeProbeStatusSchema.exclude(["disabled"]),
    diagnosticsAvailable: z.boolean().default(false),
    probedAt: isoDatetimeSchema.nullable().default(null),
    durationMs: nonNegativeIntegerSchema.nullable().default(null),
    error: z.string().min(1).nullable().default(null),
    summary: z.record(z.string(), z.unknown()).default({}),
});
export const bridgeControlProbeCollectionSchema = z.object({
    configuredCount: nonNegativeIntegerSchema.default(0),
    probedCount: nonNegativeIntegerSchema.default(0),
    readyCount: nonNegativeIntegerSchema.default(0),
    notReadyCount: nonNegativeIntegerSchema.default(0),
    unreachableCount: nonNegativeIntegerSchema.default(0),
    items: z.array(bridgeControlProbeSchema).default([]),
});
export const internalRuntimeDiagnosticsReportSchema = internalRuntimeDiagnosticsSchema.extend({
    workerOps: workerOpsRuntimeProbeSchema,
    bridgeControlProbes: bridgeControlProbeCollectionSchema,
});
export { bridgeSessionContextSchema, credentialMountSchema, mcpBindingSchema, } from "./runtime.js";
//# sourceMappingURL=bridge.js.map