import { type QueryKey } from "@tanstack/react-query";
import { type ApproveRunInput, type RunSnapshot, type SendRunMessageInput } from "@lingban/contracts";
type Transport = "idle" | "ws" | "sse";
export type RunStreamState = {
    connected: boolean;
    transport: Transport;
    sendMessage(input: SendRunMessageInput): boolean;
    approve(input: ApproveRunInput): boolean;
    sendMessageAwaitAck(input: SendRunMessageInput): Promise<void>;
    approveAwaitAck(input: ApproveRunInput): Promise<void>;
};
type QueryKeyFactory = QueryKey | ((runId: string) => QueryKey);
export type CreateRunStreamHookOptions = {
    baseUrl: string;
    getAccessToken: () => string | null | undefined;
    detailQueryKey: (runId: string) => QueryKey;
    filesQueryKey: (runId: string) => QueryKey;
    listQueryKey?: QueryKeyFactory;
};
export declare function upsertRunSnapshot(list: RunSnapshot[] | undefined, snapshot: RunSnapshot): {
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
            reviewStatus: "approved" | "pending" | "rejected" | "superseded";
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
        role: "system" | "user" | "agent";
        kind: "text" | "prompt" | "status" | "approval" | "result";
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
        state: "approved" | "pending" | "rejected";
        requestedAt: string;
        decidedAt: string | null;
        note: string | null;
    }[];
}[];
export declare function createUseRunStream(options: CreateRunStreamHookOptions): (runId: string | null, enabled?: boolean) => RunStreamState;
export {};
//# sourceMappingURL=index.d.ts.map