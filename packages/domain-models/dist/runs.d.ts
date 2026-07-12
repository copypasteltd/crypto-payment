import { type RunConversationAttachment, type RunConversationSlotValue, type BridgeEvent, type CreateRunInput, type ListRunsQuery, type RunAttentionMode, type RunInformationCollection, type RunInformationCollectionSlot, type RunListSummary, type RunListViewStatus, type RunRecord, type RunSnapshot, type RunStatus } from "@lingban/contracts";
export declare const runStatusTransitions: Record<RunStatus, readonly RunStatus[]>;
export declare function canTransitionRunStatus(from: RunStatus, to: RunStatus): boolean;
export declare function resolveRunListViewStatus(status: RunStatus): RunListViewStatus;
export declare function resolveRunAttentionMode(snapshot: RunSnapshot): RunAttentionMode;
export declare function resolveRunListTags(snapshot: RunSnapshot, options?: {
    workspaceContextKey?: string | null;
}): string[];
export declare function matchesRunListQuery(snapshot: RunSnapshot, query?: ListRunsQuery, options?: {
    workspaceContextKey?: string | null;
}): boolean;
export declare function summarizeRunSnapshots(snapshots: RunSnapshot[], options?: {
    workspaceContextKey?: string | null;
}): RunListSummary;
export declare function assertRunStatusTransition(from: RunStatus, to: RunStatus): void;
export declare function createRunRecord(params: {
    runId: string;
    createdAt: string;
    input: CreateRunInput;
}): RunRecord;
export declare function transitionRunStatus(run: RunRecord, nextStatus: RunStatus, options: {
    at: string;
    reason?: string | null;
}): RunRecord;
export declare function applyBridgeEventToRunSnapshot(snapshot: RunSnapshot, event: BridgeEvent): RunSnapshot;
export declare function applyBridgeEventsToRunSnapshot(snapshot: RunSnapshot, events: BridgeEvent[]): {
    run: {
        runId: string;
        workspaceId: string;
        taskVersionId: string;
        sessionVersionId: string;
        title: string;
        targetPath: string;
        entrySurface: "dashboard" | "h5" | "mini-program";
        catalogMetadata: {
            workspaceContextKey: string | null;
            workspaceContextName: {
                zh: string;
                en: string;
            } | null;
            workshopId: string | null;
            workshopName: {
                zh: string;
                en: string;
            } | null;
            serviceId: string | null;
            serviceName: {
                zh: string;
                en: string;
            } | null;
        } | null;
        status: "CREATED" | "READY" | "QUEUED" | "STARTING" | "RUNNING" | "WAITING_APPROVAL" | "SUCCEEDED" | "FAILED" | "CANCELLED";
        statusReason: string | null;
        createdAt: string;
        updatedAt: string;
        requestedByUserId?: string | null | undefined;
    };
    runtime: {
        launchMode: "local-process" | "docker" | null;
        containerName: string | null;
        startedAt: string | null;
        readyAt: string | null;
        finishedAt: string | null;
        exitCode: number | null;
        exitSignal: string | null;
    };
    informationCollection: {
        prompt: string;
        slotSchemaVersion: string | null;
        status: "pending" | "in_progress" | "completed";
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
            type: "string" | "number" | "boolean" | "datetime" | "file" | "date" | "enum" | "directory" | "json";
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
            slotType: "string" | "number" | "boolean" | "datetime" | "file" | "date" | "enum" | "directory" | "json";
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
    messages: {
        messageId: string;
        runId: string;
        role: "user" | "system" | "agent";
        kind: "status" | "approval" | "prompt" | "text" | "result";
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
    }[];
    files: {
        path: string;
        name: string;
        kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
        sizeBytes: number | null;
        updatedAt: string;
    }[];
    artifacts: {
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
    }[];
    approvals: {
        approvalId: string;
        runId: string;
        kind: "general" | "quota-override" | "mcp-access";
        relatedResourceRef: string | null;
        prompt: string;
        state: "pending" | "approved" | "rejected";
        requestedAt: string;
        decidedAt: string | null;
        note: string | null;
    }[];
};
export declare function createInformationCollectionPrompt(run: RunRecord): string;
export declare function createRunInformationCollection(params: {
    prompt: string;
    slotSchemaVersion?: string | null;
    slots?: Array<Pick<RunInformationCollectionSlot, "key" | "title" | "type" | "required" | "secret" | "repeatable" | "prompt" | "description" | "placeholder" | "choices" | "accepts">>;
}): RunInformationCollection;
export declare function resolveInformationCollectionSlotValues(collection: RunInformationCollection, options: {
    text?: string;
    attachments?: RunConversationAttachment[];
    slotValues?: RunConversationSlotValue[];
}): {
    slotKey: string;
    valueText: string;
}[];
export declare function applyUserMessageToInformationCollection(collection: RunInformationCollection, options: {
    text?: string;
    attachments?: RunConversationAttachment[];
    slotValues?: RunConversationSlotValue[];
    sourceMessageId?: string;
    at: string;
}): RunInformationCollection;
export declare function reviewInformationCollectionAnswer(collection: RunInformationCollection, options: {
    answerId: string;
    decision: "approve" | "reject" | "revise";
    at: string;
    reviewedByUserId?: string | null;
    note?: string | null;
    replacementValueText?: string;
    replacementAttachmentPath?: string;
    replacementAttachmentLabel?: string;
}): RunInformationCollection;
//# sourceMappingURL=runs.d.ts.map