import { z } from "zod";
import { type BridgeEvent, type CreateRunInput, type RunApproval, type RunArtifact, type RunConversationMessage, type RunFileEntry, type RunRecord, type RunSnapshot, type StartRunJobPayload } from "@lingban/contracts";
export declare const runAggregateSchema: z.ZodObject<{
    run: z.ZodObject<{
        runId: z.ZodString;
        workspaceId: z.ZodString;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        requestedByUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        title: z.ZodString;
        targetPath: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        catalogMetadata: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
            workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workshopName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
            serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            serviceName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        status: z.ZodEnum<{
            CREATED: "CREATED";
            READY: "READY";
            QUEUED: "QUEUED";
            STARTING: "STARTING";
            RUNNING: "RUNNING";
            WAITING_APPROVAL: "WAITING_APPROVAL";
            SUCCEEDED: "SUCCEEDED";
            FAILED: "FAILED";
            CANCELLED: "CANCELLED";
        }>;
        statusReason: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    runtime: z.ZodDefault<z.ZodObject<{
        launchMode: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "local-process": "local-process";
            docker: "docker";
        }>>>;
        containerName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        readyAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        exitCode: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        exitSignal: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    informationCollection: z.ZodDefault<z.ZodObject<{
        prompt: z.ZodDefault<z.ZodString>;
        slotSchemaVersion: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            in_progress: "in_progress";
            completed: "completed";
        }>>;
        requiredCount: z.ZodDefault<z.ZodNumber>;
        satisfiedCount: z.ZodDefault<z.ZodNumber>;
        missingCount: z.ZodDefault<z.ZodNumber>;
        userMessageCount: z.ZodDefault<z.ZodNumber>;
        attachmentCount: z.ZodDefault<z.ZodNumber>;
        pendingReviewCount: z.ZodDefault<z.ZodNumber>;
        approvedReviewCount: z.ZodDefault<z.ZodNumber>;
        rejectedReviewCount: z.ZodDefault<z.ZodNumber>;
        lastUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        slots: z.ZodDefault<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            title: z.ZodString;
            type: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                datetime: "datetime";
                file: "file";
                date: "date";
                enum: "enum";
                directory: "directory";
                json: "json";
            }>;
            required: z.ZodDefault<z.ZodBoolean>;
            secret: z.ZodDefault<z.ZodBoolean>;
            repeatable: z.ZodDefault<z.ZodBoolean>;
            prompt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            placeholder: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            choices: z.ZodDefault<z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            accepts: z.ZodDefault<z.ZodArray<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                optional: "optional";
                missing: "missing";
                satisfied: "satisfied";
            }>>;
            attachmentCount: z.ZodDefault<z.ZodNumber>;
            answerCount: z.ZodDefault<z.ZodNumber>;
            lastAnswerText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            lastSatisfiedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
            answerId: z.ZodString;
            slotKey: z.ZodString;
            slotType: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                datetime: "datetime";
                file: "file";
                date: "date";
                enum: "enum";
                directory: "directory";
                json: "json";
            }>;
            kind: z.ZodEnum<{
                text: "text";
                attachment: "attachment";
            }>;
            source: z.ZodDefault<z.ZodEnum<{
                "user-message": "user-message";
                "manual-review": "manual-review";
            }>>;
            sourceMessageId: z.ZodString;
            valueText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            attachmentPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            attachmentLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewStatus: z.ZodDefault<z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                superseded: "superseded";
            }>>;
            reviewedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewNote: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            supersedesAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            supersededByAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            createdAt: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    messages: z.ZodArray<z.ZodObject<{
        messageId: z.ZodString;
        runId: z.ZodString;
        role: z.ZodEnum<{
            system: "system";
            user: "user";
            agent: "agent";
        }>;
        kind: z.ZodEnum<{
            prompt: "prompt";
            status: "status";
            approval: "approval";
            result: "result";
            text: "text";
        }>;
        text: z.ZodString;
        attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            label: z.ZodString;
            slotKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        slotValues: z.ZodDefault<z.ZodArray<z.ZodObject<{
            slotKey: z.ZodString;
            valueText: z.ZodString;
        }, z.core.$strip>>>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    files: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            output: "output";
            input: "input";
            receipt: "receipt";
            archive: "archive";
            log: "log";
            screenshot: "screenshot";
        }>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    artifacts: z.ZodArray<z.ZodObject<{
        artifactId: z.ZodString;
        runId: z.ZodString;
        label: z.ZodString;
        file: z.ZodObject<{
            path: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<{
                output: "output";
                input: "input";
                receipt: "receipt";
                archive: "archive";
                log: "log";
                screenshot: "screenshot";
            }>;
            sizeBytes: z.ZodNullable<z.ZodNumber>;
            updatedAt: z.ZodString;
        }, z.core.$strip>;
        status: z.ZodEnum<{
            pending: "pending";
            ready: "ready";
        }>;
        downloadUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    approvals: z.ZodArray<z.ZodObject<{
        approvalId: z.ZodString;
        runId: z.ZodString;
        kind: z.ZodDefault<z.ZodEnum<{
            general: "general";
            "quota-override": "quota-override";
            "mcp-access": "mcp-access";
        }>>;
        relatedResourceRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        prompt: z.ZodString;
        state: z.ZodEnum<{
            pending: "pending";
            approved: "approved";
            rejected: "rejected";
        }>;
        requestedAt: z.ZodString;
        decidedAt: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    input: z.ZodObject<{
        workspaceId: z.ZodString;
        taskVersionId: z.ZodString;
        sessionVersionId: z.ZodString;
        requestedByUserId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        targetPath: z.ZodString;
        entrySurface: z.ZodEnum<{
            dashboard: "dashboard";
            h5: "h5";
            "mini-program": "mini-program";
        }>;
        initialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        bindings: z.ZodDefault<z.ZodObject<{
            firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
            credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        catalogMetadata: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
            workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workshopName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
            serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            serviceName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    startJob: z.ZodObject<{
        run: z.ZodObject<{
            runId: z.ZodString;
            workspaceId: z.ZodString;
            taskVersionId: z.ZodString;
            sessionVersionId: z.ZodString;
            requestedByUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            title: z.ZodString;
            targetPath: z.ZodString;
            entrySurface: z.ZodEnum<{
                dashboard: "dashboard";
                h5: "h5";
                "mini-program": "mini-program";
            }>;
            catalogMetadata: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                workspaceContextName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                    zh: z.ZodString;
                    en: z.ZodString;
                }, z.core.$strip>>>;
                workshopId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                workshopName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                    zh: z.ZodString;
                    en: z.ZodString;
                }, z.core.$strip>>>;
                serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                serviceName: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                    zh: z.ZodString;
                    en: z.ZodString;
                }, z.core.$strip>>>;
            }, z.core.$strip>>>;
            status: z.ZodEnum<{
                CREATED: "CREATED";
                READY: "READY";
                QUEUED: "QUEUED";
                STARTING: "STARTING";
                RUNNING: "RUNNING";
                WAITING_APPROVAL: "WAITING_APPROVAL";
                SUCCEEDED: "SUCCEEDED";
                FAILED: "FAILED";
                CANCELLED: "CANCELLED";
            }>;
            statusReason: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>;
        initialPrompt: z.ZodString;
        requestedInitialMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        bindings: z.ZodDefault<z.ZodObject<{
            firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
            credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        credentialMounts: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            credentialId: z.ZodString;
            mode: z.ZodLiteral<"env">;
            envName: z.ZodString;
            readOnly: z.ZodLiteral<true>;
        }, z.core.$strip>, z.ZodObject<{
            credentialId: z.ZodString;
            mode: z.ZodLiteral<"file">;
            mountPath: z.ZodString;
            readOnly: z.ZodLiteral<true>;
        }, z.core.$strip>], "mode">>>;
        mcpBindings: z.ZodDefault<z.ZodArray<z.ZodObject<{
            bindingId: z.ZodString;
            mcpId: z.ZodString;
            displayName: z.ZodString;
            source: z.ZodEnum<{
                "first-party": "first-party";
                "workspace-managed": "workspace-managed";
                "third-party": "third-party";
            }>;
            transport: z.ZodEnum<{
                stdio: "stdio";
                http: "http";
                sse: "sse";
                websocket: "websocket";
            }>;
            ref: z.ZodString;
            riskLevel: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
                critical: "critical";
            }>;
            stdioPolicy: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodObject<{
                refSha256: z.ZodString;
            }, z.core.$strip>>>>;
            credentialId: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            authMode: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodEnum<{
                env: "env";
                file: "file";
            }>>>>;
            authRef: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            networkPolicyRef: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
            approvalRequired: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>>;
        mcpNetworkPolicies: z.ZodDefault<z.ZodArray<z.ZodObject<{
            policyRef: z.ZodString;
            workspaceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            displayName: z.ZodString;
            description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            status: z.ZodEnum<{
                active: "active";
                disabled: "disabled";
            }>;
            mode: z.ZodDefault<z.ZodEnum<{
                allowlist: "allowlist";
            }>>;
            allowedProtocols: z.ZodArray<z.ZodEnum<{
                http: "http";
                https: "https";
                ws: "ws";
                wss: "wss";
            }>>;
            allowedHostPatterns: z.ZodArray<z.ZodString>;
            allowedPorts: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
            allowedPathPrefixes: z.ZodDefault<z.ZodArray<z.ZodString>>;
            requireTls: z.ZodDefault<z.ZodBoolean>;
            blockPrivateNetwork: z.ZodDefault<z.ZodBoolean>;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type RunAggregate = {
    run: RunRecord;
    runtime?: RunSnapshot["runtime"];
    informationCollection?: RunSnapshot["informationCollection"];
    input: CreateRunInput;
    startJob: StartRunJobPayload;
    messages: RunConversationMessage[];
    files: RunFileEntry[];
    artifacts: RunArtifact[];
    approvals: RunApproval[];
};
export declare function projectRunSnapshot(aggregate: {
    run: RunSnapshot["run"];
    runtime?: RunSnapshot["runtime"];
    informationCollection?: RunSnapshot["informationCollection"];
    messages: RunConversationMessage[];
    files: RunFileEntry[];
    artifacts: RunArtifact[];
    approvals: RunApproval[];
}): {
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
};
export interface RunsRepository {
    init(): Promise<void>;
    save(aggregate: RunAggregate): Promise<RunAggregate>;
    get(runId: string): RunAggregate | null;
    list(): RunAggregate[];
    update(runId: string, updater: (current: RunAggregate) => RunAggregate): Promise<RunAggregate | null>;
    clear(): Promise<void>;
}
export declare const runEventEnvelopeSchema: z.ZodObject<{
    eventId: z.ZodString;
    runId: z.ZodString;
    event: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"run.status.changed">;
        runId: z.ZodString;
        status: z.ZodEnum<{
            CREATED: "CREATED";
            READY: "READY";
            QUEUED: "QUEUED";
            STARTING: "STARTING";
            RUNNING: "RUNNING";
            WAITING_APPROVAL: "WAITING_APPROVAL";
            SUCCEEDED: "SUCCEEDED";
            FAILED: "FAILED";
            CANCELLED: "CANCELLED";
        }>;
        occurredAt: z.ZodString;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"conversation.message">;
        message: z.ZodObject<{
            messageId: z.ZodString;
            runId: z.ZodString;
            role: z.ZodEnum<{
                system: "system";
                user: "user";
                agent: "agent";
            }>;
            kind: z.ZodEnum<{
                prompt: "prompt";
                status: "status";
                approval: "approval";
                result: "result";
                text: "text";
            }>;
            text: z.ZodString;
            attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                label: z.ZodString;
                slotKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            slotValues: z.ZodDefault<z.ZodArray<z.ZodObject<{
                slotKey: z.ZodString;
                valueText: z.ZodString;
            }, z.core.$strip>>>;
            createdAt: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"approval.requested">;
        approval: z.ZodObject<{
            approvalId: z.ZodString;
            runId: z.ZodString;
            kind: z.ZodDefault<z.ZodEnum<{
                general: "general";
                "quota-override": "quota-override";
                "mcp-access": "mcp-access";
            }>>;
            relatedResourceRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            prompt: z.ZodString;
            state: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
            }>;
            requestedAt: z.ZodString;
            decidedAt: z.ZodNullable<z.ZodString>;
            note: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"informationCollection.updated">;
        runId: z.ZodString;
        informationCollection: z.ZodObject<{
            prompt: z.ZodDefault<z.ZodString>;
            slotSchemaVersion: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            status: z.ZodDefault<z.ZodEnum<{
                pending: "pending";
                in_progress: "in_progress";
                completed: "completed";
            }>>;
            requiredCount: z.ZodDefault<z.ZodNumber>;
            satisfiedCount: z.ZodDefault<z.ZodNumber>;
            missingCount: z.ZodDefault<z.ZodNumber>;
            userMessageCount: z.ZodDefault<z.ZodNumber>;
            attachmentCount: z.ZodDefault<z.ZodNumber>;
            pendingReviewCount: z.ZodDefault<z.ZodNumber>;
            approvedReviewCount: z.ZodDefault<z.ZodNumber>;
            rejectedReviewCount: z.ZodDefault<z.ZodNumber>;
            lastUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            slots: z.ZodDefault<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                title: z.ZodString;
                type: z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    datetime: "datetime";
                    file: "file";
                    date: "date";
                    enum: "enum";
                    directory: "directory";
                    json: "json";
                }>;
                required: z.ZodDefault<z.ZodBoolean>;
                secret: z.ZodDefault<z.ZodBoolean>;
                repeatable: z.ZodDefault<z.ZodBoolean>;
                prompt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                description: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                placeholder: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                choices: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    value: z.ZodString;
                    label: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                }, z.core.$strip>>>;
                accepts: z.ZodDefault<z.ZodArray<z.ZodString>>;
                status: z.ZodDefault<z.ZodEnum<{
                    optional: "optional";
                    missing: "missing";
                    satisfied: "satisfied";
                }>>;
                attachmentCount: z.ZodDefault<z.ZodNumber>;
                answerCount: z.ZodDefault<z.ZodNumber>;
                lastAnswerText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                lastSatisfiedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            }, z.core.$strip>>>;
            answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
                answerId: z.ZodString;
                slotKey: z.ZodString;
                slotType: z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    datetime: "datetime";
                    file: "file";
                    date: "date";
                    enum: "enum";
                    directory: "directory";
                    json: "json";
                }>;
                kind: z.ZodEnum<{
                    text: "text";
                    attachment: "attachment";
                }>;
                source: z.ZodDefault<z.ZodEnum<{
                    "user-message": "user-message";
                    "manual-review": "manual-review";
                }>>;
                sourceMessageId: z.ZodString;
                valueText: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                attachmentPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                attachmentLabel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                reviewStatus: z.ZodDefault<z.ZodEnum<{
                    pending: "pending";
                    approved: "approved";
                    rejected: "rejected";
                    superseded: "superseded";
                }>>;
                reviewedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                reviewedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                reviewNote: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                supersedesAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                supersededByAnswerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                createdAt: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        occurredAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"artifact.ready">;
        artifact: z.ZodObject<{
            artifactId: z.ZodString;
            runId: z.ZodString;
            label: z.ZodString;
            file: z.ZodObject<{
                path: z.ZodString;
                name: z.ZodString;
                kind: z.ZodEnum<{
                    output: "output";
                    input: "input";
                    receipt: "receipt";
                    archive: "archive";
                    log: "log";
                    screenshot: "screenshot";
                }>;
                sizeBytes: z.ZodNullable<z.ZodNumber>;
                updatedAt: z.ZodString;
            }, z.core.$strip>;
            status: z.ZodEnum<{
                pending: "pending";
                ready: "ready";
            }>;
            downloadUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"mcp.call">;
        call: z.ZodObject<{
            mcpId: z.ZodString;
            bindingId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            toolName: z.ZodString;
            requestId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            status: z.ZodEnum<{
                error: "error";
                rejected: "rejected";
                success: "success";
                cancelled: "cancelled";
            }>;
            startedAt: z.ZodString;
            finishedAt: z.ZodString;
            durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
            inputSummary: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            outputSummary: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            errorMessage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            inputBytes: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
            outputBytes: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
            callId: z.ZodString;
            runId: z.ZodString;
            workspaceId: z.ZodString;
            requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            serviceId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            taskVersionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            sessionVersionId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            entrySurface: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
                dashboard: "dashboard";
                h5: "h5";
                "mini-program": "mini-program";
            }>>>;
            displayName: z.ZodString;
            source: z.ZodEnum<{
                "first-party": "first-party";
                "workspace-managed": "workspace-managed";
                "third-party": "third-party";
            }>;
            transport: z.ZodEnum<{
                stdio: "stdio";
                http: "http";
                sse: "sse";
                websocket: "websocket";
            }>;
            ref: z.ZodString;
            riskLevel: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
                critical: "critical";
            }>;
            networkPolicyRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            approvalRequired: z.ZodDefault<z.ZodBoolean>;
            occurredAt: z.ZodString;
            recordedAt: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"files.synced">;
        runId: z.ZodString;
        files: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<{
                output: "output";
                input: "input";
                receipt: "receipt";
                archive: "archive";
                log: "log";
                screenshot: "screenshot";
            }>;
            sizeBytes: z.ZodNullable<z.ZodNumber>;
            updatedAt: z.ZodString;
        }, z.core.$strip>>;
        occurredAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"file.changed">;
        runId: z.ZodString;
        file: z.ZodObject<{
            path: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<{
                output: "output";
                input: "input";
                receipt: "receipt";
                archive: "archive";
                log: "log";
                screenshot: "screenshot";
            }>;
            sizeBytes: z.ZodNullable<z.ZodNumber>;
            updatedAt: z.ZodString;
        }, z.core.$strip>;
        occurredAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"heartbeat">;
        runId: z.ZodString;
        occurredAt: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"run.failed">;
        runId: z.ZodString;
        occurredAt: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>], "type">;
}, z.core.$strip>;
export type RunEventEnvelope = z.infer<typeof runEventEnvelopeSchema>;
export type RunEventListener = (envelope: RunEventEnvelope) => void;
export interface RunEventBus {
    init(): Promise<void>;
    append(event: BridgeEvent): Promise<RunEventEnvelope>;
    appendMany(events: BridgeEvent[]): Promise<RunEventEnvelope[]>;
    list(runId: string): RunEventEnvelope[];
    subscribe(runId: string, listener: RunEventListener): () => void;
}
export interface RunMessageRepository {
    append(message: RunConversationMessage): Promise<RunConversationMessage>;
    listByRunId(runId: string): Promise<RunConversationMessage[]>;
}
export interface RunArtifactRepository {
    upsert(artifact: RunArtifact): Promise<RunArtifact>;
    listByRunId(runId: string): Promise<RunArtifact[]>;
}
export interface RunApprovalRepository {
    create(approval: RunApproval): Promise<RunApproval>;
    update(approval: RunApproval): Promise<RunApproval>;
    listByRunId(runId: string): Promise<RunApproval[]>;
    listPending(): Promise<RunApproval[]>;
}
export interface RunFileRepository {
    replaceForRun(runId: string, files: RunFileEntry[]): Promise<void>;
    listByRunId(runId: string): Promise<RunFileEntry[]>;
}
export interface RunQueryRepository {
    init(): Promise<void>;
    getSnapshot(runId: string): RunSnapshot | null;
    listSnapshots(): RunSnapshot[];
    upsertSnapshot(snapshot: RunSnapshot): Promise<RunSnapshot>;
    clear(): Promise<void>;
}
//# sourceMappingURL=runs.d.ts.map