import { z } from "zod";
export declare const bridgeCommandTypeSchema: z.ZodEnum<{
    approve: "approve";
    sendMessage: "sendMessage";
    cancel: "cancel";
    ping: "ping";
    syncFiles: "syncFiles";
    flushArtifacts: "flushArtifacts";
}>;
export declare const bridgeRegistrationSchema: z.ZodObject<{
    bridgeId: z.ZodString;
    runId: z.ZodString;
    workspaceId: z.ZodString;
    targetPath: z.ZodString;
    control: z.ZodOptional<z.ZodObject<{
        baseUrl: z.ZodString;
        authToken: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    supportedCommands: z.ZodDefault<z.ZodArray<z.ZodEnum<{
        approve: "approve";
        sendMessage: "sendMessage";
        cancel: "cancel";
        ping: "ping";
        syncFiles: "syncFiles";
        flushArtifacts: "flushArtifacts";
    }>>>;
    connectedAt: z.ZodString;
    lastSeenAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const runControlCommandSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"sendMessage">;
    payload: z.ZodObject<{
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
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"approve">;
    payload: z.ZodObject<{
        approvalId: z.ZodOptional<z.ZodString>;
        approved: z.ZodBoolean;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"cancel">;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"ping">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"syncFiles">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"flushArtifacts">;
}, z.core.$strip>], "type">;
export declare const bridgeEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
export declare const bridgeEventsIngestSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    }, z.core.$strip>], "type">>;
}, z.core.$strip>;
export declare const runStatusUpdateSchema: z.ZodObject<{
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
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    occurredAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const artifactSyncSchema: z.ZodObject<{
    artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const runRuntimeRecoveryActionSchema: z.ZodEnum<{
    "enqueue-start": "enqueue-start";
    "await-bridge": "await-bridge";
    "mark-orphan-failed": "mark-orphan-failed";
    "schedule-cleanup": "schedule-cleanup";
    ignore: "ignore";
}>;
export declare const runRuntimeRecoveryBridgeStateSchema: z.ZodObject<{
    registered: z.ZodBoolean;
    controllerAttached: z.ZodBoolean;
    connectedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastSeenAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const runRuntimeRecoveryCandidateSchema: z.ZodObject<{
    snapshot: z.ZodObject<{
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
    }, z.core.$strip>;
    bridge: z.ZodObject<{
        registered: z.ZodBoolean;
        controllerAttached: z.ZodBoolean;
        connectedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        lastSeenAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
    action: z.ZodEnum<{
        "enqueue-start": "enqueue-start";
        "await-bridge": "await-bridge";
        "mark-orphan-failed": "mark-orphan-failed";
        "schedule-cleanup": "schedule-cleanup";
        ignore: "ignore";
    }>;
    reason: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    startJob: z.ZodDefault<z.ZodNullable<z.ZodObject<{
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
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const runRuntimeRecoveryListSchema: z.ZodObject<{
    candidates: z.ZodArray<z.ZodObject<{
        snapshot: z.ZodObject<{
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
        }, z.core.$strip>;
        bridge: z.ZodObject<{
            registered: z.ZodBoolean;
            controllerAttached: z.ZodBoolean;
            connectedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            lastSeenAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>;
        action: z.ZodEnum<{
            "enqueue-start": "enqueue-start";
            "await-bridge": "await-bridge";
            "mark-orphan-failed": "mark-orphan-failed";
            "schedule-cleanup": "schedule-cleanup";
            ignore: "ignore";
        }>;
        reason: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        startJob: z.ZodDefault<z.ZodNullable<z.ZodObject<{
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
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const bridgeRegistryConnectionDiagnosticsSchema: z.ZodObject<{
    bridgeId: z.ZodString;
    runId: z.ZodString;
    workspaceId: z.ZodString;
    targetPath: z.ZodString;
    control: z.ZodOptional<z.ZodObject<{
        baseUrl: z.ZodString;
        authToken: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    supportedCommands: z.ZodDefault<z.ZodArray<z.ZodEnum<{
        approve: "approve";
        sendMessage: "sendMessage";
        cancel: "cancel";
        ping: "ping";
        syncFiles: "syncFiles";
        flushArtifacts: "flushArtifacts";
    }>>>;
    connectedAt: z.ZodString;
    lastSeenAt: z.ZodString;
    controllerAttached: z.ZodBoolean;
    pendingCommandsCount: z.ZodDefault<z.ZodNumber>;
    stale: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const bridgeRegistryPersistenceErrorSchema: z.ZodObject<{
    operation: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        save: "save";
        delete: "delete";
    }>>>;
    occurredAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    message: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const bridgeRegistryLastSweepSchema: z.ZodObject<{
    startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    evictedCount: z.ZodDefault<z.ZodNumber>;
    error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const bridgeRegistryMetricsSchema: z.ZodObject<{
    registrationsTotal: z.ZodDefault<z.ZodNumber>;
    unregistrationsTotal: z.ZodDefault<z.ZodNumber>;
    queuedCommandsTotal: z.ZodDefault<z.ZodNumber>;
    forwardedCommandsTotal: z.ZodDefault<z.ZodNumber>;
    staleEvictionsTotal: z.ZodDefault<z.ZodNumber>;
    persistedDeleteQueueTotal: z.ZodDefault<z.ZodNumber>;
    persistenceSaveFailuresTotal: z.ZodDefault<z.ZodNumber>;
    persistenceDeleteFailuresTotal: z.ZodDefault<z.ZodNumber>;
    sweepRunsTotal: z.ZodDefault<z.ZodNumber>;
    sweepEvictionsTotal: z.ZodDefault<z.ZodNumber>;
    sweepFailuresTotal: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const bridgeRegistryDiagnosticsSchema: z.ZodObject<{
    initialized: z.ZodBoolean;
    repositoryKind: z.ZodDefault<z.ZodEnum<{
        file: "file";
        unknown: "unknown";
        postgres: "postgres";
    }>>;
    sweeperActive: z.ZodBoolean;
    staleAfterMs: z.ZodNumber;
    sweepIntervalMs: z.ZodNumber;
    registeredConnectionsCount: z.ZodDefault<z.ZodNumber>;
    controllerAttachedCount: z.ZodDefault<z.ZodNumber>;
    pendingRunsCount: z.ZodDefault<z.ZodNumber>;
    pendingCommandsCount: z.ZodDefault<z.ZodNumber>;
    staleCandidatesCount: z.ZodDefault<z.ZodNumber>;
    persistencePendingCount: z.ZodDefault<z.ZodNumber>;
    metrics: z.ZodObject<{
        registrationsTotal: z.ZodDefault<z.ZodNumber>;
        unregistrationsTotal: z.ZodDefault<z.ZodNumber>;
        queuedCommandsTotal: z.ZodDefault<z.ZodNumber>;
        forwardedCommandsTotal: z.ZodDefault<z.ZodNumber>;
        staleEvictionsTotal: z.ZodDefault<z.ZodNumber>;
        persistedDeleteQueueTotal: z.ZodDefault<z.ZodNumber>;
        persistenceSaveFailuresTotal: z.ZodDefault<z.ZodNumber>;
        persistenceDeleteFailuresTotal: z.ZodDefault<z.ZodNumber>;
        sweepRunsTotal: z.ZodDefault<z.ZodNumber>;
        sweepEvictionsTotal: z.ZodDefault<z.ZodNumber>;
        sweepFailuresTotal: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
    lastPersistenceError: z.ZodObject<{
        operation: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            save: "save";
            delete: "delete";
        }>>>;
        occurredAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        message: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
    lastSweep: z.ZodObject<{
        startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        evictedCount: z.ZodDefault<z.ZodNumber>;
        error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
    connections: z.ZodDefault<z.ZodArray<z.ZodObject<{
        bridgeId: z.ZodString;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        targetPath: z.ZodString;
        control: z.ZodOptional<z.ZodObject<{
            baseUrl: z.ZodString;
            authToken: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        supportedCommands: z.ZodDefault<z.ZodArray<z.ZodEnum<{
            approve: "approve";
            sendMessage: "sendMessage";
            cancel: "cancel";
            ping: "ping";
            syncFiles: "syncFiles";
            flushArtifacts: "flushArtifacts";
        }>>>;
        connectedAt: z.ZodString;
        lastSeenAt: z.ZodString;
        controllerAttached: z.ZodBoolean;
        pendingCommandsCount: z.ZodDefault<z.ZodNumber>;
        stale: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const runtimeOrchestratorDiagnosticsSchema: z.ZodObject<{
    dispatchMode: z.ZodEnum<{
        embedded: "embedded";
        bullmq: "bullmq";
    }>;
    maxConcurrentRuns: z.ZodNumber;
    orphanRecoveryGraceMs: z.ZodNumber;
    terminalWorkspaceTtlMs: z.ZodNumber;
    runStartQueueEnabled: z.ZodBoolean;
    runCleanupQueueEnabled: z.ZodBoolean;
    activeRunsCount: z.ZodDefault<z.ZodNumber>;
    launchingRunsCount: z.ZodDefault<z.ZodNumber>;
    scheduledRunsCount: z.ZodDefault<z.ZodNumber>;
    queueDepth: z.ZodDefault<z.ZodNumber>;
    stopRequestedCount: z.ZodDefault<z.ZodNumber>;
    orphanRecoveryTimersCount: z.ZodDefault<z.ZodNumber>;
    cleanupTimersCount: z.ZodDefault<z.ZodNumber>;
    drainInProgress: z.ZodBoolean;
    activeRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    launchingRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    scheduledRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    queuedRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const runtimeRecoveryDiagnosticsSchema: z.ZodObject<{
    candidatesCount: z.ZodDefault<z.ZodNumber>;
    actionCounts: z.ZodObject<{
        "enqueue-start": z.ZodDefault<z.ZodNumber>;
        "await-bridge": z.ZodDefault<z.ZodNumber>;
        "mark-orphan-failed": z.ZodDefault<z.ZodNumber>;
        "schedule-cleanup": z.ZodDefault<z.ZodNumber>;
        ignore: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const internalRuntimeDiagnosticsSchema: z.ZodObject<{
    bridgeRegistry: z.ZodObject<{
        initialized: z.ZodBoolean;
        repositoryKind: z.ZodDefault<z.ZodEnum<{
            file: "file";
            unknown: "unknown";
            postgres: "postgres";
        }>>;
        sweeperActive: z.ZodBoolean;
        staleAfterMs: z.ZodNumber;
        sweepIntervalMs: z.ZodNumber;
        registeredConnectionsCount: z.ZodDefault<z.ZodNumber>;
        controllerAttachedCount: z.ZodDefault<z.ZodNumber>;
        pendingRunsCount: z.ZodDefault<z.ZodNumber>;
        pendingCommandsCount: z.ZodDefault<z.ZodNumber>;
        staleCandidatesCount: z.ZodDefault<z.ZodNumber>;
        persistencePendingCount: z.ZodDefault<z.ZodNumber>;
        metrics: z.ZodObject<{
            registrationsTotal: z.ZodDefault<z.ZodNumber>;
            unregistrationsTotal: z.ZodDefault<z.ZodNumber>;
            queuedCommandsTotal: z.ZodDefault<z.ZodNumber>;
            forwardedCommandsTotal: z.ZodDefault<z.ZodNumber>;
            staleEvictionsTotal: z.ZodDefault<z.ZodNumber>;
            persistedDeleteQueueTotal: z.ZodDefault<z.ZodNumber>;
            persistenceSaveFailuresTotal: z.ZodDefault<z.ZodNumber>;
            persistenceDeleteFailuresTotal: z.ZodDefault<z.ZodNumber>;
            sweepRunsTotal: z.ZodDefault<z.ZodNumber>;
            sweepEvictionsTotal: z.ZodDefault<z.ZodNumber>;
            sweepFailuresTotal: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>;
        lastPersistenceError: z.ZodObject<{
            operation: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
                save: "save";
                delete: "delete";
            }>>>;
            occurredAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            message: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>;
        lastSweep: z.ZodObject<{
            startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
            evictedCount: z.ZodDefault<z.ZodNumber>;
            error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>;
        connections: z.ZodDefault<z.ZodArray<z.ZodObject<{
            bridgeId: z.ZodString;
            runId: z.ZodString;
            workspaceId: z.ZodString;
            targetPath: z.ZodString;
            control: z.ZodOptional<z.ZodObject<{
                baseUrl: z.ZodString;
                authToken: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            supportedCommands: z.ZodDefault<z.ZodArray<z.ZodEnum<{
                approve: "approve";
                sendMessage: "sendMessage";
                cancel: "cancel";
                ping: "ping";
                syncFiles: "syncFiles";
                flushArtifacts: "flushArtifacts";
            }>>>;
            connectedAt: z.ZodString;
            lastSeenAt: z.ZodString;
            controllerAttached: z.ZodBoolean;
            pendingCommandsCount: z.ZodDefault<z.ZodNumber>;
            stale: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    runtimeOrchestrator: z.ZodObject<{
        dispatchMode: z.ZodEnum<{
            embedded: "embedded";
            bullmq: "bullmq";
        }>;
        maxConcurrentRuns: z.ZodNumber;
        orphanRecoveryGraceMs: z.ZodNumber;
        terminalWorkspaceTtlMs: z.ZodNumber;
        runStartQueueEnabled: z.ZodBoolean;
        runCleanupQueueEnabled: z.ZodBoolean;
        activeRunsCount: z.ZodDefault<z.ZodNumber>;
        launchingRunsCount: z.ZodDefault<z.ZodNumber>;
        scheduledRunsCount: z.ZodDefault<z.ZodNumber>;
        queueDepth: z.ZodDefault<z.ZodNumber>;
        stopRequestedCount: z.ZodDefault<z.ZodNumber>;
        orphanRecoveryTimersCount: z.ZodDefault<z.ZodNumber>;
        cleanupTimersCount: z.ZodDefault<z.ZodNumber>;
        drainInProgress: z.ZodBoolean;
        activeRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        launchingRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        scheduledRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        queuedRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    recovery: z.ZodObject<{
        candidatesCount: z.ZodDefault<z.ZodNumber>;
        actionCounts: z.ZodObject<{
            "enqueue-start": z.ZodDefault<z.ZodNumber>;
            "await-bridge": z.ZodDefault<z.ZodNumber>;
            "mark-orphan-failed": z.ZodDefault<z.ZodNumber>;
            "schedule-cleanup": z.ZodDefault<z.ZodNumber>;
            ignore: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const remoteRuntimeProbeStatusSchema: z.ZodEnum<{
    ready: "ready";
    disabled: "disabled";
    not_ready: "not_ready";
    unreachable: "unreachable";
}>;
export declare const workerOpsRuntimeProbeSchema: z.ZodObject<{
    configured: z.ZodBoolean;
    baseUrl: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<{
        ready: "ready";
        disabled: "disabled";
        not_ready: "not_ready";
        unreachable: "unreachable";
    }>;
    readinessStatus: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        ready: "ready";
        not_ready: "not_ready";
    }>>>;
    diagnosticsAvailable: z.ZodDefault<z.ZodBoolean>;
    probedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    summary: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const bridgeControlProbeSchema: z.ZodObject<{
    runId: z.ZodString;
    bridgeId: z.ZodString;
    baseUrl: z.ZodString;
    status: z.ZodEnum<{
        ready: "ready";
        not_ready: "not_ready";
        unreachable: "unreachable";
    }>;
    diagnosticsAvailable: z.ZodDefault<z.ZodBoolean>;
    probedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    summary: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const bridgeControlProbeCollectionSchema: z.ZodObject<{
    configuredCount: z.ZodDefault<z.ZodNumber>;
    probedCount: z.ZodDefault<z.ZodNumber>;
    readyCount: z.ZodDefault<z.ZodNumber>;
    notReadyCount: z.ZodDefault<z.ZodNumber>;
    unreachableCount: z.ZodDefault<z.ZodNumber>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        runId: z.ZodString;
        bridgeId: z.ZodString;
        baseUrl: z.ZodString;
        status: z.ZodEnum<{
            ready: "ready";
            not_ready: "not_ready";
            unreachable: "unreachable";
        }>;
        diagnosticsAvailable: z.ZodDefault<z.ZodBoolean>;
        probedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        summary: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const internalRuntimeDiagnosticsReportSchema: z.ZodObject<{
    bridgeRegistry: z.ZodObject<{
        initialized: z.ZodBoolean;
        repositoryKind: z.ZodDefault<z.ZodEnum<{
            file: "file";
            unknown: "unknown";
            postgres: "postgres";
        }>>;
        sweeperActive: z.ZodBoolean;
        staleAfterMs: z.ZodNumber;
        sweepIntervalMs: z.ZodNumber;
        registeredConnectionsCount: z.ZodDefault<z.ZodNumber>;
        controllerAttachedCount: z.ZodDefault<z.ZodNumber>;
        pendingRunsCount: z.ZodDefault<z.ZodNumber>;
        pendingCommandsCount: z.ZodDefault<z.ZodNumber>;
        staleCandidatesCount: z.ZodDefault<z.ZodNumber>;
        persistencePendingCount: z.ZodDefault<z.ZodNumber>;
        metrics: z.ZodObject<{
            registrationsTotal: z.ZodDefault<z.ZodNumber>;
            unregistrationsTotal: z.ZodDefault<z.ZodNumber>;
            queuedCommandsTotal: z.ZodDefault<z.ZodNumber>;
            forwardedCommandsTotal: z.ZodDefault<z.ZodNumber>;
            staleEvictionsTotal: z.ZodDefault<z.ZodNumber>;
            persistedDeleteQueueTotal: z.ZodDefault<z.ZodNumber>;
            persistenceSaveFailuresTotal: z.ZodDefault<z.ZodNumber>;
            persistenceDeleteFailuresTotal: z.ZodDefault<z.ZodNumber>;
            sweepRunsTotal: z.ZodDefault<z.ZodNumber>;
            sweepEvictionsTotal: z.ZodDefault<z.ZodNumber>;
            sweepFailuresTotal: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>;
        lastPersistenceError: z.ZodObject<{
            operation: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
                save: "save";
                delete: "delete";
            }>>>;
            occurredAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            message: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>;
        lastSweep: z.ZodObject<{
            startedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            finishedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
            evictedCount: z.ZodDefault<z.ZodNumber>;
            error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>;
        connections: z.ZodDefault<z.ZodArray<z.ZodObject<{
            bridgeId: z.ZodString;
            runId: z.ZodString;
            workspaceId: z.ZodString;
            targetPath: z.ZodString;
            control: z.ZodOptional<z.ZodObject<{
                baseUrl: z.ZodString;
                authToken: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            supportedCommands: z.ZodDefault<z.ZodArray<z.ZodEnum<{
                approve: "approve";
                sendMessage: "sendMessage";
                cancel: "cancel";
                ping: "ping";
                syncFiles: "syncFiles";
                flushArtifacts: "flushArtifacts";
            }>>>;
            connectedAt: z.ZodString;
            lastSeenAt: z.ZodString;
            controllerAttached: z.ZodBoolean;
            pendingCommandsCount: z.ZodDefault<z.ZodNumber>;
            stale: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    runtimeOrchestrator: z.ZodObject<{
        dispatchMode: z.ZodEnum<{
            embedded: "embedded";
            bullmq: "bullmq";
        }>;
        maxConcurrentRuns: z.ZodNumber;
        orphanRecoveryGraceMs: z.ZodNumber;
        terminalWorkspaceTtlMs: z.ZodNumber;
        runStartQueueEnabled: z.ZodBoolean;
        runCleanupQueueEnabled: z.ZodBoolean;
        activeRunsCount: z.ZodDefault<z.ZodNumber>;
        launchingRunsCount: z.ZodDefault<z.ZodNumber>;
        scheduledRunsCount: z.ZodDefault<z.ZodNumber>;
        queueDepth: z.ZodDefault<z.ZodNumber>;
        stopRequestedCount: z.ZodDefault<z.ZodNumber>;
        orphanRecoveryTimersCount: z.ZodDefault<z.ZodNumber>;
        cleanupTimersCount: z.ZodDefault<z.ZodNumber>;
        drainInProgress: z.ZodBoolean;
        activeRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        launchingRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        scheduledRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        queuedRunIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    recovery: z.ZodObject<{
        candidatesCount: z.ZodDefault<z.ZodNumber>;
        actionCounts: z.ZodObject<{
            "enqueue-start": z.ZodDefault<z.ZodNumber>;
            "await-bridge": z.ZodDefault<z.ZodNumber>;
            "mark-orphan-failed": z.ZodDefault<z.ZodNumber>;
            "schedule-cleanup": z.ZodDefault<z.ZodNumber>;
            ignore: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    workerOps: z.ZodObject<{
        configured: z.ZodBoolean;
        baseUrl: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<{
            ready: "ready";
            disabled: "disabled";
            not_ready: "not_ready";
            unreachable: "unreachable";
        }>;
        readinessStatus: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            ready: "ready";
            not_ready: "not_ready";
        }>>>;
        diagnosticsAvailable: z.ZodDefault<z.ZodBoolean>;
        probedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        summary: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>;
    bridgeControlProbes: z.ZodObject<{
        configuredCount: z.ZodDefault<z.ZodNumber>;
        probedCount: z.ZodDefault<z.ZodNumber>;
        readyCount: z.ZodDefault<z.ZodNumber>;
        notReadyCount: z.ZodDefault<z.ZodNumber>;
        unreachableCount: z.ZodDefault<z.ZodNumber>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            runId: z.ZodString;
            bridgeId: z.ZodString;
            baseUrl: z.ZodString;
            status: z.ZodEnum<{
                ready: "ready";
                not_ready: "not_ready";
                unreachable: "unreachable";
            }>;
            diagnosticsAvailable: z.ZodDefault<z.ZodBoolean>;
            probedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            durationMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
            error: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            summary: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type BridgeRegistration = z.infer<typeof bridgeRegistrationSchema>;
export type BridgeCommandType = z.infer<typeof bridgeCommandTypeSchema>;
export type RunControlCommand = z.infer<typeof runControlCommandSchema>;
export type BridgeEvent = z.infer<typeof bridgeEventSchema>;
export type BridgeEventsIngest = z.infer<typeof bridgeEventsIngestSchema>;
export type RunStatusUpdate = z.infer<typeof runStatusUpdateSchema>;
export type ArtifactSync = z.infer<typeof artifactSyncSchema>;
export type RunRuntimeRecoveryAction = z.infer<typeof runRuntimeRecoveryActionSchema>;
export type RunRuntimeRecoveryBridgeState = z.infer<typeof runRuntimeRecoveryBridgeStateSchema>;
export type RunRuntimeRecoveryCandidate = z.infer<typeof runRuntimeRecoveryCandidateSchema>;
export type RunRuntimeRecoveryList = z.infer<typeof runRuntimeRecoveryListSchema>;
export type BridgeRegistryConnectionDiagnostics = z.infer<typeof bridgeRegistryConnectionDiagnosticsSchema>;
export type BridgeRegistryPersistenceError = z.infer<typeof bridgeRegistryPersistenceErrorSchema>;
export type BridgeRegistryLastSweep = z.infer<typeof bridgeRegistryLastSweepSchema>;
export type BridgeRegistryMetrics = z.infer<typeof bridgeRegistryMetricsSchema>;
export type BridgeRegistryDiagnostics = z.infer<typeof bridgeRegistryDiagnosticsSchema>;
export type RuntimeOrchestratorDiagnostics = z.infer<typeof runtimeOrchestratorDiagnosticsSchema>;
export type RuntimeRecoveryDiagnostics = z.infer<typeof runtimeRecoveryDiagnosticsSchema>;
export type InternalRuntimeDiagnostics = z.infer<typeof internalRuntimeDiagnosticsSchema>;
export type RemoteRuntimeProbeStatus = z.infer<typeof remoteRuntimeProbeStatusSchema>;
export type WorkerOpsRuntimeProbe = z.infer<typeof workerOpsRuntimeProbeSchema>;
export type BridgeControlProbe = z.infer<typeof bridgeControlProbeSchema>;
export type BridgeControlProbeCollection = z.infer<typeof bridgeControlProbeCollectionSchema>;
export type InternalRuntimeDiagnosticsReport = z.infer<typeof internalRuntimeDiagnosticsReportSchema>;
export { bridgeSessionContextSchema, credentialMountSchema, mcpBindingSchema, } from "./runtime.js";
export type { BridgeSessionContext, CredentialMount, McpBinding } from "./runtime.js";
//# sourceMappingURL=bridge.d.ts.map