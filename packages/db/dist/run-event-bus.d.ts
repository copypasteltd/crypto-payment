import { type BridgeEvent } from "@lingban/contracts";
import { type RunEventBus, type RunEventEnvelope, type RunEventListener } from "./runs.js";
import type { PostgresRepositoryOptions } from "./postgres-types.js";
export declare function inferRunIdFromBridgeEvent(event: BridgeEvent): string;
export declare function inferOccurredAtFromBridgeEvent(event: BridgeEvent): string;
export declare abstract class CachedRunEventBus implements RunEventBus {
    #private;
    init(): Promise<void>;
    append(event: BridgeEvent): Promise<{
        eventId: string;
        runId: string;
        event: {
            type: "run.status.changed";
            runId: string;
            status: "CREATED" | "READY" | "QUEUED" | "STARTING" | "RUNNING" | "WAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "CANCELLED";
            occurredAt: string;
            reason?: string | null | undefined;
        } | {
            type: "conversation.message";
            message: {
                messageId: string;
                runId: string;
                role: "system" | "user" | "agent";
                kind: "status" | "prompt" | "text" | "approval" | "result";
                text: string;
                attachments: {
                    path: string;
                    label: string;
                    slotKey: string | null;
                }[];
                slotValues: {
                    slotKey: string;
                    valueText: string;
                }[];
                createdAt: string;
            };
        } | {
            type: "approval.requested";
            approval: {
                approvalId: string;
                runId: string;
                kind: "general" | "quota-override" | "mcp-access";
                relatedResourceRef: string | null;
                prompt: string;
                state: "pending" | "approved" | "rejected";
                requestedAt: string;
                decidedAt: string | null;
                note: string | null;
            };
        } | {
            type: "informationCollection.updated";
            runId: string;
            informationCollection: {
                prompt: string;
                slotSchemaVersion: string | null;
                status: "pending" | "completed" | "in_progress";
                requiredCount: number;
                satisfiedCount: number;
                missingCount: number;
                userMessageCount: number;
                attachmentCount: number;
                pendingReviewCount: number;
                approvedReviewCount: number;
                rejectedReviewCount: number;
                lastUpdatedAt: string | null;
                slots: {
                    key: string;
                    title: string;
                    type: "string" | "number" | "boolean" | "datetime" | "date" | "file" | "enum" | "directory" | "json";
                    required: boolean;
                    secret: boolean;
                    repeatable: boolean;
                    prompt: string | null;
                    description: string | null;
                    placeholder: string | null;
                    choices: {
                        value: string;
                        label: string | null;
                    }[];
                    accepts: string[];
                    status: "optional" | "missing" | "satisfied";
                    attachmentCount: number;
                    answerCount: number;
                    lastAnswerText: string | null;
                    lastSatisfiedAt: string | null;
                }[];
                answers: {
                    answerId: string;
                    slotKey: string;
                    slotType: "string" | "number" | "boolean" | "datetime" | "date" | "file" | "enum" | "directory" | "json";
                    kind: "text" | "attachment";
                    source: "user-message" | "manual-review";
                    sourceMessageId: string;
                    valueText: string | null;
                    attachmentPath: string | null;
                    attachmentLabel: string | null;
                    reviewStatus: "pending" | "approved" | "rejected" | "superseded";
                    reviewedAt: string | null;
                    reviewedByUserId: string | null;
                    reviewNote: string | null;
                    supersedesAnswerId: string | null;
                    supersededByAnswerId: string | null;
                    createdAt: string;
                }[];
            };
            occurredAt: string;
        } | {
            type: "artifact.ready";
            artifact: {
                artifactId: string;
                runId: string;
                label: string;
                file: {
                    path: string;
                    name: string;
                    kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                    sizeBytes: number | null;
                    updatedAt: string;
                };
                status: "pending" | "ready";
                downloadUrl?: string | null | undefined;
            };
        } | {
            type: "mcp.call";
            call: {
                mcpId: string;
                bindingId: string | null;
                toolName: string;
                requestId: string | null;
                status: "error" | "success" | "cancelled" | "rejected";
                startedAt: string;
                finishedAt: string;
                durationMs: number | null;
                inputSummary: string | null;
                outputSummary: string | null;
                errorMessage: string | null;
                inputBytes: number | null;
                outputBytes: number | null;
                callId: string;
                runId: string;
                workspaceId: string;
                requestedByUserId: string | null;
                workspaceContextKey: string | null;
                serviceId: string | null;
                taskVersionId: string | null;
                sessionVersionId: string | null;
                entrySurface: "dashboard" | "h5" | "mini-program" | null;
                displayName: string;
                source: "first-party" | "workspace-managed" | "third-party";
                transport: "stdio" | "http" | "sse" | "websocket";
                ref: string;
                riskLevel: "low" | "medium" | "high" | "critical";
                networkPolicyRef: string | null;
                approvalRequired: boolean;
                occurredAt: string;
                recordedAt: string;
            };
        } | {
            type: "files.synced";
            runId: string;
            files: {
                path: string;
                name: string;
                kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                sizeBytes: number | null;
                updatedAt: string;
            }[];
            occurredAt: string;
        } | {
            type: "file.changed";
            runId: string;
            file: {
                path: string;
                name: string;
                kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                sizeBytes: number | null;
                updatedAt: string;
            };
            occurredAt: string;
        } | {
            type: "heartbeat";
            runId: string;
            occurredAt: string;
        } | {
            type: "run.failed";
            runId: string;
            occurredAt: string;
            error: string;
        };
    }>;
    appendMany(events: BridgeEvent[]): Promise<{
        eventId: string;
        runId: string;
        event: {
            type: "run.status.changed";
            runId: string;
            status: "CREATED" | "READY" | "QUEUED" | "STARTING" | "RUNNING" | "WAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "CANCELLED";
            occurredAt: string;
            reason?: string | null | undefined;
        } | {
            type: "conversation.message";
            message: {
                messageId: string;
                runId: string;
                role: "system" | "user" | "agent";
                kind: "status" | "prompt" | "text" | "approval" | "result";
                text: string;
                attachments: {
                    path: string;
                    label: string;
                    slotKey: string | null;
                }[];
                slotValues: {
                    slotKey: string;
                    valueText: string;
                }[];
                createdAt: string;
            };
        } | {
            type: "approval.requested";
            approval: {
                approvalId: string;
                runId: string;
                kind: "general" | "quota-override" | "mcp-access";
                relatedResourceRef: string | null;
                prompt: string;
                state: "pending" | "approved" | "rejected";
                requestedAt: string;
                decidedAt: string | null;
                note: string | null;
            };
        } | {
            type: "informationCollection.updated";
            runId: string;
            informationCollection: {
                prompt: string;
                slotSchemaVersion: string | null;
                status: "pending" | "completed" | "in_progress";
                requiredCount: number;
                satisfiedCount: number;
                missingCount: number;
                userMessageCount: number;
                attachmentCount: number;
                pendingReviewCount: number;
                approvedReviewCount: number;
                rejectedReviewCount: number;
                lastUpdatedAt: string | null;
                slots: {
                    key: string;
                    title: string;
                    type: "string" | "number" | "boolean" | "datetime" | "date" | "file" | "enum" | "directory" | "json";
                    required: boolean;
                    secret: boolean;
                    repeatable: boolean;
                    prompt: string | null;
                    description: string | null;
                    placeholder: string | null;
                    choices: {
                        value: string;
                        label: string | null;
                    }[];
                    accepts: string[];
                    status: "optional" | "missing" | "satisfied";
                    attachmentCount: number;
                    answerCount: number;
                    lastAnswerText: string | null;
                    lastSatisfiedAt: string | null;
                }[];
                answers: {
                    answerId: string;
                    slotKey: string;
                    slotType: "string" | "number" | "boolean" | "datetime" | "date" | "file" | "enum" | "directory" | "json";
                    kind: "text" | "attachment";
                    source: "user-message" | "manual-review";
                    sourceMessageId: string;
                    valueText: string | null;
                    attachmentPath: string | null;
                    attachmentLabel: string | null;
                    reviewStatus: "pending" | "approved" | "rejected" | "superseded";
                    reviewedAt: string | null;
                    reviewedByUserId: string | null;
                    reviewNote: string | null;
                    supersedesAnswerId: string | null;
                    supersededByAnswerId: string | null;
                    createdAt: string;
                }[];
            };
            occurredAt: string;
        } | {
            type: "artifact.ready";
            artifact: {
                artifactId: string;
                runId: string;
                label: string;
                file: {
                    path: string;
                    name: string;
                    kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                    sizeBytes: number | null;
                    updatedAt: string;
                };
                status: "pending" | "ready";
                downloadUrl?: string | null | undefined;
            };
        } | {
            type: "mcp.call";
            call: {
                mcpId: string;
                bindingId: string | null;
                toolName: string;
                requestId: string | null;
                status: "error" | "success" | "cancelled" | "rejected";
                startedAt: string;
                finishedAt: string;
                durationMs: number | null;
                inputSummary: string | null;
                outputSummary: string | null;
                errorMessage: string | null;
                inputBytes: number | null;
                outputBytes: number | null;
                callId: string;
                runId: string;
                workspaceId: string;
                requestedByUserId: string | null;
                workspaceContextKey: string | null;
                serviceId: string | null;
                taskVersionId: string | null;
                sessionVersionId: string | null;
                entrySurface: "dashboard" | "h5" | "mini-program" | null;
                displayName: string;
                source: "first-party" | "workspace-managed" | "third-party";
                transport: "stdio" | "http" | "sse" | "websocket";
                ref: string;
                riskLevel: "low" | "medium" | "high" | "critical";
                networkPolicyRef: string | null;
                approvalRequired: boolean;
                occurredAt: string;
                recordedAt: string;
            };
        } | {
            type: "files.synced";
            runId: string;
            files: {
                path: string;
                name: string;
                kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                sizeBytes: number | null;
                updatedAt: string;
            }[];
            occurredAt: string;
        } | {
            type: "file.changed";
            runId: string;
            file: {
                path: string;
                name: string;
                kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                sizeBytes: number | null;
                updatedAt: string;
            };
            occurredAt: string;
        } | {
            type: "heartbeat";
            runId: string;
            occurredAt: string;
        } | {
            type: "run.failed";
            runId: string;
            occurredAt: string;
            error: string;
        };
    }[]>;
    list(runId: string): {
        eventId: string;
        runId: string;
        event: {
            type: "run.status.changed";
            runId: string;
            status: "CREATED" | "READY" | "QUEUED" | "STARTING" | "RUNNING" | "WAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "CANCELLED";
            occurredAt: string;
            reason?: string | null | undefined;
        } | {
            type: "conversation.message";
            message: {
                messageId: string;
                runId: string;
                role: "system" | "user" | "agent";
                kind: "status" | "prompt" | "text" | "approval" | "result";
                text: string;
                attachments: {
                    path: string;
                    label: string;
                    slotKey: string | null;
                }[];
                slotValues: {
                    slotKey: string;
                    valueText: string;
                }[];
                createdAt: string;
            };
        } | {
            type: "approval.requested";
            approval: {
                approvalId: string;
                runId: string;
                kind: "general" | "quota-override" | "mcp-access";
                relatedResourceRef: string | null;
                prompt: string;
                state: "pending" | "approved" | "rejected";
                requestedAt: string;
                decidedAt: string | null;
                note: string | null;
            };
        } | {
            type: "informationCollection.updated";
            runId: string;
            informationCollection: {
                prompt: string;
                slotSchemaVersion: string | null;
                status: "pending" | "completed" | "in_progress";
                requiredCount: number;
                satisfiedCount: number;
                missingCount: number;
                userMessageCount: number;
                attachmentCount: number;
                pendingReviewCount: number;
                approvedReviewCount: number;
                rejectedReviewCount: number;
                lastUpdatedAt: string | null;
                slots: {
                    key: string;
                    title: string;
                    type: "string" | "number" | "boolean" | "datetime" | "date" | "file" | "enum" | "directory" | "json";
                    required: boolean;
                    secret: boolean;
                    repeatable: boolean;
                    prompt: string | null;
                    description: string | null;
                    placeholder: string | null;
                    choices: {
                        value: string;
                        label: string | null;
                    }[];
                    accepts: string[];
                    status: "optional" | "missing" | "satisfied";
                    attachmentCount: number;
                    answerCount: number;
                    lastAnswerText: string | null;
                    lastSatisfiedAt: string | null;
                }[];
                answers: {
                    answerId: string;
                    slotKey: string;
                    slotType: "string" | "number" | "boolean" | "datetime" | "date" | "file" | "enum" | "directory" | "json";
                    kind: "text" | "attachment";
                    source: "user-message" | "manual-review";
                    sourceMessageId: string;
                    valueText: string | null;
                    attachmentPath: string | null;
                    attachmentLabel: string | null;
                    reviewStatus: "pending" | "approved" | "rejected" | "superseded";
                    reviewedAt: string | null;
                    reviewedByUserId: string | null;
                    reviewNote: string | null;
                    supersedesAnswerId: string | null;
                    supersededByAnswerId: string | null;
                    createdAt: string;
                }[];
            };
            occurredAt: string;
        } | {
            type: "artifact.ready";
            artifact: {
                artifactId: string;
                runId: string;
                label: string;
                file: {
                    path: string;
                    name: string;
                    kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                    sizeBytes: number | null;
                    updatedAt: string;
                };
                status: "pending" | "ready";
                downloadUrl?: string | null | undefined;
            };
        } | {
            type: "mcp.call";
            call: {
                mcpId: string;
                bindingId: string | null;
                toolName: string;
                requestId: string | null;
                status: "error" | "success" | "cancelled" | "rejected";
                startedAt: string;
                finishedAt: string;
                durationMs: number | null;
                inputSummary: string | null;
                outputSummary: string | null;
                errorMessage: string | null;
                inputBytes: number | null;
                outputBytes: number | null;
                callId: string;
                runId: string;
                workspaceId: string;
                requestedByUserId: string | null;
                workspaceContextKey: string | null;
                serviceId: string | null;
                taskVersionId: string | null;
                sessionVersionId: string | null;
                entrySurface: "dashboard" | "h5" | "mini-program" | null;
                displayName: string;
                source: "first-party" | "workspace-managed" | "third-party";
                transport: "stdio" | "http" | "sse" | "websocket";
                ref: string;
                riskLevel: "low" | "medium" | "high" | "critical";
                networkPolicyRef: string | null;
                approvalRequired: boolean;
                occurredAt: string;
                recordedAt: string;
            };
        } | {
            type: "files.synced";
            runId: string;
            files: {
                path: string;
                name: string;
                kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                sizeBytes: number | null;
                updatedAt: string;
            }[];
            occurredAt: string;
        } | {
            type: "file.changed";
            runId: string;
            file: {
                path: string;
                name: string;
                kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                sizeBytes: number | null;
                updatedAt: string;
            };
            occurredAt: string;
        } | {
            type: "heartbeat";
            runId: string;
            occurredAt: string;
        } | {
            type: "run.failed";
            runId: string;
            occurredAt: string;
            error: string;
        };
    }[];
    subscribe(runId: string, listener: RunEventListener): () => void;
    protected abstract loadAll(): Promise<RunEventEnvelope[]>;
    protected abstract persist(envelope: RunEventEnvelope): Promise<void>;
}
export declare class PostgresRunEventBus extends CachedRunEventBus {
    #private;
    constructor(options: PostgresRepositoryOptions);
    protected loadAll(): Promise<{
        eventId: string;
        runId: string;
        event: {
            type: "run.status.changed";
            runId: string;
            status: "CREATED" | "READY" | "QUEUED" | "STARTING" | "RUNNING" | "WAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "CANCELLED";
            occurredAt: string;
            reason?: string | null | undefined;
        } | {
            type: "conversation.message";
            message: {
                messageId: string;
                runId: string;
                role: "system" | "user" | "agent";
                kind: "status" | "prompt" | "text" | "approval" | "result";
                text: string;
                attachments: {
                    path: string;
                    label: string;
                    slotKey: string | null;
                }[];
                slotValues: {
                    slotKey: string;
                    valueText: string;
                }[];
                createdAt: string;
            };
        } | {
            type: "approval.requested";
            approval: {
                approvalId: string;
                runId: string;
                kind: "general" | "quota-override" | "mcp-access";
                relatedResourceRef: string | null;
                prompt: string;
                state: "pending" | "approved" | "rejected";
                requestedAt: string;
                decidedAt: string | null;
                note: string | null;
            };
        } | {
            type: "informationCollection.updated";
            runId: string;
            informationCollection: {
                prompt: string;
                slotSchemaVersion: string | null;
                status: "pending" | "completed" | "in_progress";
                requiredCount: number;
                satisfiedCount: number;
                missingCount: number;
                userMessageCount: number;
                attachmentCount: number;
                pendingReviewCount: number;
                approvedReviewCount: number;
                rejectedReviewCount: number;
                lastUpdatedAt: string | null;
                slots: {
                    key: string;
                    title: string;
                    type: "string" | "number" | "boolean" | "datetime" | "date" | "file" | "enum" | "directory" | "json";
                    required: boolean;
                    secret: boolean;
                    repeatable: boolean;
                    prompt: string | null;
                    description: string | null;
                    placeholder: string | null;
                    choices: {
                        value: string;
                        label: string | null;
                    }[];
                    accepts: string[];
                    status: "optional" | "missing" | "satisfied";
                    attachmentCount: number;
                    answerCount: number;
                    lastAnswerText: string | null;
                    lastSatisfiedAt: string | null;
                }[];
                answers: {
                    answerId: string;
                    slotKey: string;
                    slotType: "string" | "number" | "boolean" | "datetime" | "date" | "file" | "enum" | "directory" | "json";
                    kind: "text" | "attachment";
                    source: "user-message" | "manual-review";
                    sourceMessageId: string;
                    valueText: string | null;
                    attachmentPath: string | null;
                    attachmentLabel: string | null;
                    reviewStatus: "pending" | "approved" | "rejected" | "superseded";
                    reviewedAt: string | null;
                    reviewedByUserId: string | null;
                    reviewNote: string | null;
                    supersedesAnswerId: string | null;
                    supersededByAnswerId: string | null;
                    createdAt: string;
                }[];
            };
            occurredAt: string;
        } | {
            type: "artifact.ready";
            artifact: {
                artifactId: string;
                runId: string;
                label: string;
                file: {
                    path: string;
                    name: string;
                    kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                    sizeBytes: number | null;
                    updatedAt: string;
                };
                status: "pending" | "ready";
                downloadUrl?: string | null | undefined;
            };
        } | {
            type: "mcp.call";
            call: {
                mcpId: string;
                bindingId: string | null;
                toolName: string;
                requestId: string | null;
                status: "error" | "success" | "cancelled" | "rejected";
                startedAt: string;
                finishedAt: string;
                durationMs: number | null;
                inputSummary: string | null;
                outputSummary: string | null;
                errorMessage: string | null;
                inputBytes: number | null;
                outputBytes: number | null;
                callId: string;
                runId: string;
                workspaceId: string;
                requestedByUserId: string | null;
                workspaceContextKey: string | null;
                serviceId: string | null;
                taskVersionId: string | null;
                sessionVersionId: string | null;
                entrySurface: "dashboard" | "h5" | "mini-program" | null;
                displayName: string;
                source: "first-party" | "workspace-managed" | "third-party";
                transport: "stdio" | "http" | "sse" | "websocket";
                ref: string;
                riskLevel: "low" | "medium" | "high" | "critical";
                networkPolicyRef: string | null;
                approvalRequired: boolean;
                occurredAt: string;
                recordedAt: string;
            };
        } | {
            type: "files.synced";
            runId: string;
            files: {
                path: string;
                name: string;
                kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                sizeBytes: number | null;
                updatedAt: string;
            }[];
            occurredAt: string;
        } | {
            type: "file.changed";
            runId: string;
            file: {
                path: string;
                name: string;
                kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
                sizeBytes: number | null;
                updatedAt: string;
            };
            occurredAt: string;
        } | {
            type: "heartbeat";
            runId: string;
            occurredAt: string;
        } | {
            type: "run.failed";
            runId: string;
            occurredAt: string;
            error: string;
        };
    }[]>;
    protected persist(envelope: RunEventEnvelope): Promise<void>;
}
//# sourceMappingURL=run-event-bus.d.ts.map