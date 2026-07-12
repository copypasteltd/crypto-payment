import { type RunSnapshot } from "@lingban/contracts";
import type { PostgresRepositoryOptions } from "./postgres-types.js";
import { type RunQueryRepository } from "./runs.js";
export declare abstract class CachedRunQueryRepository implements RunQueryRepository {
    #private;
    init(): Promise<void>;
    getSnapshot(runId: string): {
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
        messages: {
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
    } | null;
    listSnapshots(): {
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
        messages: {
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
    }[];
    upsertSnapshot(snapshot: RunSnapshot): Promise<{
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
        messages: {
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
    }>;
    clear(): Promise<void>;
    protected abstract loadAll(): Promise<RunSnapshot[]>;
    protected abstract persist(snapshot: RunSnapshot): Promise<void>;
    protected abstract clearStorage(): Promise<void>;
}
export declare class PostgresRunQueryRepository extends CachedRunQueryRepository {
    #private;
    constructor(options: PostgresRepositoryOptions);
    protected loadAll(): Promise<{
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
        messages: {
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
    }[]>;
    protected persist(_snapshot: RunSnapshot): Promise<void>;
    protected clearStorage(): Promise<void>;
}
//# sourceMappingURL=run-query-repository.d.ts.map