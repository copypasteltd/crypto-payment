import { z } from "zod";
export declare const clientRealtimeMessageSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"runs.subscribe">;
    runId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"runs.sendMessage">;
    runId: z.ZodString;
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
    type: z.ZodLiteral<"runs.approve">;
    runId: z.ZodString;
    payload: z.ZodObject<{
        approvalId: z.ZodOptional<z.ZodString>;
        approved: z.ZodBoolean;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"runs.cancel">;
    runId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "type">;
export declare const serverRealtimeMessageSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"runs.snapshot">;
    payload: z.ZodObject<{
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
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"runs.event">;
    payload: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"runs.ack">;
    runId: z.ZodString;
    ok: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"runs.error">;
    runId: z.ZodOptional<z.ZodString>;
    error: z.ZodString;
}, z.core.$strip>], "type">;
export type ClientRealtimeMessage = z.infer<typeof clientRealtimeMessageSchema>;
export type ServerRealtimeMessage = z.infer<typeof serverRealtimeMessageSchema>;
//# sourceMappingURL=realtime.d.ts.map