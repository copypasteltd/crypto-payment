import { type CreatorAuditExportRecord, type CreatorPackageDetail, type CreatorReleaseActivation, type CreatorReleaseGate, type CreatorReleaseSummary, type CreatorReplaySummary } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const creatorStateSchema: z.ZodObject<{
    packages: z.ZodArray<z.ZodObject<{
        packageId: z.ZodString;
        title: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        source: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        state: z.ZodEnum<{
            ready: "ready";
            audited: "audited";
            pending_release: "pending_release";
        }>;
        statusLabel: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        tone: z.ZodEnum<{
            active: "active";
            success: "success";
            warn: "warn";
        }>;
        ownerLabel: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        updatedAt: z.ZodString;
        releaseChannel: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        workspaceContextKeys: z.ZodArray<z.ZodString>;
        linkedWorkshopIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        linkedServiceIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        session: z.ZodObject<{
            summary: z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        runtime: z.ZodObject<{
            summary: z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        connectors: z.ZodObject<{
            summary: z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        release: z.ZodObject<{
            summary: z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        versionLine: z.ZodDefault<z.ZodArray<z.ZodString>>;
        dependencies: z.ZodDefault<z.ZodArray<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    releases: z.ZodArray<z.ZodObject<{
        releaseId: z.ZodString;
        packageId: z.ZodString;
        targetWorkspaceContextKey: z.ZodString;
        state: z.ZodEnum<{
            private: "private";
            staged: "staged";
            production: "production";
        }>;
        channelLabel: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        gateSummary: z.ZodDefault<z.ZodArray<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    replays: z.ZodArray<z.ZodObject<{
        replayId: z.ZodString;
        packageId: z.ZodString;
        sourceRunId: z.ZodString;
        state: z.ZodEnum<{
            ready: "ready";
            running: "running";
            failed: "failed";
        }>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    releaseGates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        gateId: z.ZodString;
        releaseId: z.ZodString;
        packageId: z.ZodString;
        gateType: z.ZodEnum<{
            desensitization: "desensitization";
            replay: "replay";
            credential: "credential";
            manual_approval: "manual_approval";
        }>;
        status: z.ZodEnum<{
            pending: "pending";
            running: "running";
            failed: "failed";
            passed: "passed";
            waived: "waived";
        }>;
        requiredRole: z.ZodEnum<{
            owner: "owner";
            admin: "admin";
            operator: "operator";
            creator: "creator";
            viewer: "viewer";
        }>;
        resultSummary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        evidenceRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        checklist: z.ZodDefault<z.ZodArray<z.ZodObject<{
            itemId: z.ZodString;
            label: z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>;
            status: z.ZodEnum<{
                pending: "pending";
                failed: "failed";
                passed: "passed";
                waived: "waived";
            }>;
            note: z.ZodDefault<z.ZodNullable<z.ZodObject<{
                zh: z.ZodString;
                en: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        recommendedActions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        decidedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        decidedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        updatedAt: z.ZodString;
    }, z.core.$strip>>>;
    activations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        activationId: z.ZodString;
        releaseId: z.ZodString;
        packageId: z.ZodString;
        targetWorkspaceContextKey: z.ZodString;
        state: z.ZodEnum<{
            active: "active";
            failed: "failed";
            rolled_back: "rolled_back";
        }>;
        rolloutMode: z.ZodEnum<{
            private: "private";
            staged: "staged";
            production: "production";
        }>;
        effectiveAt: z.ZodString;
        note: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>>>;
        activatedByUserId: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>>;
    auditExports: z.ZodDefault<z.ZodArray<z.ZodObject<{
        exportId: z.ZodString;
        packageId: z.ZodString;
        workspaceContextKey: z.ZodString;
        format: z.ZodEnum<{
            json: "json";
            csv: "csv";
        }>;
        status: z.ZodEnum<{
            ready: "ready";
            failed: "failed";
        }>;
        fileName: z.ZodString;
        mimeType: z.ZodString;
        objectKey: z.ZodString;
        sizeBytes: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        sha256: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        recordCount: z.ZodDefault<z.ZodNumber>;
        summary: z.ZodObject<{
            zh: z.ZodString;
            en: z.ZodString;
        }, z.core.$strip>;
        createdByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const creatorPackageIdParamsSchema: z.ZodObject<{
    packageId: z.ZodString;
}, z.core.$strip>;
export declare const creatorReleaseIdParamsSchema: z.ZodObject<{
    packageId: z.ZodString;
    releaseId: z.ZodString;
}, z.core.$strip>;
export declare const creatorReplayIdParamsSchema: z.ZodObject<{
    packageId: z.ZodString;
    replayId: z.ZodString;
}, z.core.$strip>;
export declare const creatorReleaseGateIdParamsSchema: z.ZodObject<{
    releaseId: z.ZodString;
    gateId: z.ZodString;
}, z.core.$strip>;
export declare const creatorReleaseIdOnlyParamsSchema: z.ZodObject<{
    releaseId: z.ZodString;
}, z.core.$strip>;
export declare const creatorGovernanceSectionParamsSchema: z.ZodObject<{
    packageId: z.ZodString;
    section: z.ZodEnum<{
        members: "members";
        audit: "audit";
        cost: "cost";
    }>;
}, z.core.$strip>;
export declare const creatorReleaseActivationIdParamsSchema: z.ZodObject<{
    releaseId: z.ZodString;
    activationId: z.ZodString;
}, z.core.$strip>;
export declare const creatorAuditExportIdParamsSchema: z.ZodObject<{
    packageId: z.ZodString;
    exportId: z.ZodString;
}, z.core.$strip>;
export type CreatorState = z.infer<typeof creatorStateSchema>;
export interface CreatorRepository {
    init(): Promise<void>;
    listPackages(): CreatorPackageDetail[];
    getPackageById(packageId: string): CreatorPackageDetail | null;
    listReleases(): CreatorReleaseSummary[];
    getReleaseById(releaseId: string): CreatorReleaseSummary | null;
    listReleasesByPackage(packageId: string): CreatorReleaseSummary[];
    listReplays(): CreatorReplaySummary[];
    listReplaysByPackage(packageId: string): CreatorReplaySummary[];
    listReleaseGates(): CreatorReleaseGate[];
    listReleaseGatesByRelease(releaseId: string): CreatorReleaseGate[];
    listReleaseActivations(): CreatorReleaseActivation[];
    listReleaseActivationsByRelease(releaseId: string): CreatorReleaseActivation[];
    listAuditExports(): CreatorAuditExportRecord[];
    listAuditExportsByPackage(packageId: string): CreatorAuditExportRecord[];
    getAuditExportById(exportId: string): CreatorAuditExportRecord | null;
    savePackage(pkg: CreatorPackageDetail): Promise<void>;
    saveRelease(release: CreatorReleaseSummary): Promise<void>;
    saveReplay(replay: CreatorReplaySummary): Promise<void>;
    saveReleaseGate(gate: CreatorReleaseGate): Promise<void>;
    saveReleaseActivation(activation: CreatorReleaseActivation): Promise<void>;
    saveAuditExport(record: CreatorAuditExportRecord): Promise<void>;
}
export declare abstract class CachedCreatorRepository implements CreatorRepository {
    #private;
    init(): Promise<void>;
    listPackages(): {
        packageId: string;
        title: {
            zh: string;
            en: string;
        };
        source: {
            zh: string;
            en: string;
        };
        state: "ready" | "audited" | "pending_release";
        statusLabel: {
            zh: string;
            en: string;
        };
        tone: "success" | "active" | "warn";
        ownerLabel: {
            zh: string;
            en: string;
        };
        updatedAt: string;
        releaseChannel: {
            zh: string;
            en: string;
        };
        workspaceContextKeys: string[];
        linkedWorkshopIds: string[];
        linkedServiceIds: string[];
        session: {
            summary: {
                zh: string;
                en: string;
            };
            items: {
                zh: string;
                en: string;
            }[];
        };
        runtime: {
            summary: {
                zh: string;
                en: string;
            };
            items: {
                zh: string;
                en: string;
            }[];
        };
        connectors: {
            summary: {
                zh: string;
                en: string;
            };
            items: {
                zh: string;
                en: string;
            }[];
        };
        release: {
            summary: {
                zh: string;
                en: string;
            };
            items: {
                zh: string;
                en: string;
            }[];
        };
        versionLine: string[];
        dependencies: {
            zh: string;
            en: string;
        }[];
    }[];
    getPackageById(packageId: string): {
        packageId: string;
        title: {
            zh: string;
            en: string;
        };
        source: {
            zh: string;
            en: string;
        };
        state: "ready" | "audited" | "pending_release";
        statusLabel: {
            zh: string;
            en: string;
        };
        tone: "success" | "active" | "warn";
        ownerLabel: {
            zh: string;
            en: string;
        };
        updatedAt: string;
        releaseChannel: {
            zh: string;
            en: string;
        };
        workspaceContextKeys: string[];
        linkedWorkshopIds: string[];
        linkedServiceIds: string[];
        session: {
            summary: {
                zh: string;
                en: string;
            };
            items: {
                zh: string;
                en: string;
            }[];
        };
        runtime: {
            summary: {
                zh: string;
                en: string;
            };
            items: {
                zh: string;
                en: string;
            }[];
        };
        connectors: {
            summary: {
                zh: string;
                en: string;
            };
            items: {
                zh: string;
                en: string;
            }[];
        };
        release: {
            summary: {
                zh: string;
                en: string;
            };
            items: {
                zh: string;
                en: string;
            }[];
        };
        versionLine: string[];
        dependencies: {
            zh: string;
            en: string;
        }[];
    } | null;
    listReleases(): {
        releaseId: string;
        packageId: string;
        targetWorkspaceContextKey: string;
        state: "private" | "staged" | "production";
        channelLabel: {
            zh: string;
            en: string;
        };
        gateSummary: {
            zh: string;
            en: string;
        }[];
        updatedAt: string;
    }[];
    getReleaseById(releaseId: string): {
        releaseId: string;
        packageId: string;
        targetWorkspaceContextKey: string;
        state: "private" | "staged" | "production";
        channelLabel: {
            zh: string;
            en: string;
        };
        gateSummary: {
            zh: string;
            en: string;
        }[];
        updatedAt: string;
    } | null;
    listReleasesByPackage(packageId: string): {
        releaseId: string;
        packageId: string;
        targetWorkspaceContextKey: string;
        state: "private" | "staged" | "production";
        channelLabel: {
            zh: string;
            en: string;
        };
        gateSummary: {
            zh: string;
            en: string;
        }[];
        updatedAt: string;
    }[];
    listReplays(): {
        replayId: string;
        packageId: string;
        sourceRunId: string;
        state: "running" | "failed" | "ready";
        summary: {
            zh: string;
            en: string;
        };
        updatedAt: string;
    }[];
    listReplaysByPackage(packageId: string): {
        replayId: string;
        packageId: string;
        sourceRunId: string;
        state: "running" | "failed" | "ready";
        summary: {
            zh: string;
            en: string;
        };
        updatedAt: string;
    }[];
    listReleaseGates(): {
        gateId: string;
        releaseId: string;
        packageId: string;
        gateType: "desensitization" | "replay" | "credential" | "manual_approval";
        status: "pending" | "running" | "failed" | "passed" | "waived";
        requiredRole: "owner" | "admin" | "operator" | "creator" | "viewer";
        resultSummary: {
            zh: string;
            en: string;
        };
        evidenceRef: string | null;
        checklist: {
            itemId: string;
            label: {
                zh: string;
                en: string;
            };
            status: "pending" | "failed" | "passed" | "waived";
            note: {
                zh: string;
                en: string;
            } | null;
        }[];
        recommendedActions: {
            zh: string;
            en: string;
        }[];
        decidedByUserId: string | null;
        decidedAt: string | null;
        updatedAt: string;
    }[];
    listReleaseGatesByRelease(releaseId: string): {
        gateId: string;
        releaseId: string;
        packageId: string;
        gateType: "desensitization" | "replay" | "credential" | "manual_approval";
        status: "pending" | "running" | "failed" | "passed" | "waived";
        requiredRole: "owner" | "admin" | "operator" | "creator" | "viewer";
        resultSummary: {
            zh: string;
            en: string;
        };
        evidenceRef: string | null;
        checklist: {
            itemId: string;
            label: {
                zh: string;
                en: string;
            };
            status: "pending" | "failed" | "passed" | "waived";
            note: {
                zh: string;
                en: string;
            } | null;
        }[];
        recommendedActions: {
            zh: string;
            en: string;
        }[];
        decidedByUserId: string | null;
        decidedAt: string | null;
        updatedAt: string;
    }[];
    listReleaseActivations(): {
        activationId: string;
        releaseId: string;
        packageId: string;
        targetWorkspaceContextKey: string;
        state: "active" | "failed" | "rolled_back";
        rolloutMode: "private" | "staged" | "production";
        effectiveAt: string;
        note: {
            zh: string;
            en: string;
        } | null;
        activatedByUserId: string;
        updatedAt: string;
    }[];
    listReleaseActivationsByRelease(releaseId: string): {
        activationId: string;
        releaseId: string;
        packageId: string;
        targetWorkspaceContextKey: string;
        state: "active" | "failed" | "rolled_back";
        rolloutMode: "private" | "staged" | "production";
        effectiveAt: string;
        note: {
            zh: string;
            en: string;
        } | null;
        activatedByUserId: string;
        updatedAt: string;
    }[];
    listAuditExports(): {
        exportId: string;
        packageId: string;
        workspaceContextKey: string;
        format: "json" | "csv";
        status: "failed" | "ready";
        fileName: string;
        mimeType: string;
        objectKey: string;
        sizeBytes: number | null;
        sha256: string | null;
        recordCount: number;
        summary: {
            zh: string;
            en: string;
        };
        createdByUserId: string | null;
        createdAt: string;
        updatedAt: string;
    }[];
    listAuditExportsByPackage(packageId: string): {
        exportId: string;
        packageId: string;
        workspaceContextKey: string;
        format: "json" | "csv";
        status: "failed" | "ready";
        fileName: string;
        mimeType: string;
        objectKey: string;
        sizeBytes: number | null;
        sha256: string | null;
        recordCount: number;
        summary: {
            zh: string;
            en: string;
        };
        createdByUserId: string | null;
        createdAt: string;
        updatedAt: string;
    }[];
    getAuditExportById(exportId: string): {
        exportId: string;
        packageId: string;
        workspaceContextKey: string;
        format: "json" | "csv";
        status: "failed" | "ready";
        fileName: string;
        mimeType: string;
        objectKey: string;
        sizeBytes: number | null;
        sha256: string | null;
        recordCount: number;
        summary: {
            zh: string;
            en: string;
        };
        createdByUserId: string | null;
        createdAt: string;
        updatedAt: string;
    } | null;
    savePackage(pkg: CreatorPackageDetail): Promise<void>;
    saveRelease(release: CreatorReleaseSummary): Promise<void>;
    saveReplay(replay: CreatorReplaySummary): Promise<void>;
    saveReleaseGate(gate: CreatorReleaseGate): Promise<void>;
    saveReleaseActivation(activation: CreatorReleaseActivation): Promise<void>;
    saveAuditExport(record: CreatorAuditExportRecord): Promise<void>;
    protected replaceState(state: CreatorState): Promise<void>;
    protected getState(): {
        packages: {
            packageId: string;
            title: {
                zh: string;
                en: string;
            };
            source: {
                zh: string;
                en: string;
            };
            state: "ready" | "audited" | "pending_release";
            statusLabel: {
                zh: string;
                en: string;
            };
            tone: "success" | "active" | "warn";
            ownerLabel: {
                zh: string;
                en: string;
            };
            updatedAt: string;
            releaseChannel: {
                zh: string;
                en: string;
            };
            workspaceContextKeys: string[];
            linkedWorkshopIds: string[];
            linkedServiceIds: string[];
            session: {
                summary: {
                    zh: string;
                    en: string;
                };
                items: {
                    zh: string;
                    en: string;
                }[];
            };
            runtime: {
                summary: {
                    zh: string;
                    en: string;
                };
                items: {
                    zh: string;
                    en: string;
                }[];
            };
            connectors: {
                summary: {
                    zh: string;
                    en: string;
                };
                items: {
                    zh: string;
                    en: string;
                }[];
            };
            release: {
                summary: {
                    zh: string;
                    en: string;
                };
                items: {
                    zh: string;
                    en: string;
                }[];
            };
            versionLine: string[];
            dependencies: {
                zh: string;
                en: string;
            }[];
        }[];
        releases: {
            releaseId: string;
            packageId: string;
            targetWorkspaceContextKey: string;
            state: "private" | "staged" | "production";
            channelLabel: {
                zh: string;
                en: string;
            };
            gateSummary: {
                zh: string;
                en: string;
            }[];
            updatedAt: string;
        }[];
        replays: {
            replayId: string;
            packageId: string;
            sourceRunId: string;
            state: "running" | "failed" | "ready";
            summary: {
                zh: string;
                en: string;
            };
            updatedAt: string;
        }[];
        releaseGates: {
            gateId: string;
            releaseId: string;
            packageId: string;
            gateType: "desensitization" | "replay" | "credential" | "manual_approval";
            status: "pending" | "running" | "failed" | "passed" | "waived";
            requiredRole: "owner" | "admin" | "operator" | "creator" | "viewer";
            resultSummary: {
                zh: string;
                en: string;
            };
            evidenceRef: string | null;
            checklist: {
                itemId: string;
                label: {
                    zh: string;
                    en: string;
                };
                status: "pending" | "failed" | "passed" | "waived";
                note: {
                    zh: string;
                    en: string;
                } | null;
            }[];
            recommendedActions: {
                zh: string;
                en: string;
            }[];
            decidedByUserId: string | null;
            decidedAt: string | null;
            updatedAt: string;
        }[];
        activations: {
            activationId: string;
            releaseId: string;
            packageId: string;
            targetWorkspaceContextKey: string;
            state: "active" | "failed" | "rolled_back";
            rolloutMode: "private" | "staged" | "production";
            effectiveAt: string;
            note: {
                zh: string;
                en: string;
            } | null;
            activatedByUserId: string;
            updatedAt: string;
        }[];
        auditExports: {
            exportId: string;
            packageId: string;
            workspaceContextKey: string;
            format: "json" | "csv";
            status: "failed" | "ready";
            fileName: string;
            mimeType: string;
            objectKey: string;
            sizeBytes: number | null;
            sha256: string | null;
            recordCount: number;
            summary: {
                zh: string;
                en: string;
            };
            createdByUserId: string | null;
            createdAt: string;
            updatedAt: string;
        }[];
    };
    protected updateState(mutator: (state: CreatorState) => CreatorState): Promise<void>;
    protected abstract loadState(): Promise<CreatorState>;
    protected abstract writeState(state: CreatorState): Promise<void>;
}
export interface PostgresCreatorRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresCreatorRepository extends CachedCreatorRepository {
    #private;
    constructor(options: PostgresCreatorRepositoryOptions);
    protected loadState(): Promise<{
        packages: {
            packageId: string;
            title: {
                zh: string;
                en: string;
            };
            source: {
                zh: string;
                en: string;
            };
            state: "ready" | "audited" | "pending_release";
            statusLabel: {
                zh: string;
                en: string;
            };
            tone: "success" | "active" | "warn";
            ownerLabel: {
                zh: string;
                en: string;
            };
            updatedAt: string;
            releaseChannel: {
                zh: string;
                en: string;
            };
            workspaceContextKeys: string[];
            linkedWorkshopIds: string[];
            linkedServiceIds: string[];
            session: {
                summary: {
                    zh: string;
                    en: string;
                };
                items: {
                    zh: string;
                    en: string;
                }[];
            };
            runtime: {
                summary: {
                    zh: string;
                    en: string;
                };
                items: {
                    zh: string;
                    en: string;
                }[];
            };
            connectors: {
                summary: {
                    zh: string;
                    en: string;
                };
                items: {
                    zh: string;
                    en: string;
                }[];
            };
            release: {
                summary: {
                    zh: string;
                    en: string;
                };
                items: {
                    zh: string;
                    en: string;
                }[];
            };
            versionLine: string[];
            dependencies: {
                zh: string;
                en: string;
            }[];
        }[];
        releases: {
            releaseId: string;
            packageId: string;
            targetWorkspaceContextKey: string;
            state: "private" | "staged" | "production";
            channelLabel: {
                zh: string;
                en: string;
            };
            gateSummary: {
                zh: string;
                en: string;
            }[];
            updatedAt: string;
        }[];
        replays: {
            replayId: string;
            packageId: string;
            sourceRunId: string;
            state: "running" | "failed" | "ready";
            summary: {
                zh: string;
                en: string;
            };
            updatedAt: string;
        }[];
        releaseGates: {
            gateId: string;
            releaseId: string;
            packageId: string;
            gateType: "desensitization" | "replay" | "credential" | "manual_approval";
            status: "pending" | "running" | "failed" | "passed" | "waived";
            requiredRole: "owner" | "admin" | "operator" | "creator" | "viewer";
            resultSummary: {
                zh: string;
                en: string;
            };
            evidenceRef: string | null;
            checklist: {
                itemId: string;
                label: {
                    zh: string;
                    en: string;
                };
                status: "pending" | "failed" | "passed" | "waived";
                note: {
                    zh: string;
                    en: string;
                } | null;
            }[];
            recommendedActions: {
                zh: string;
                en: string;
            }[];
            decidedByUserId: string | null;
            decidedAt: string | null;
            updatedAt: string;
        }[];
        activations: {
            activationId: string;
            releaseId: string;
            packageId: string;
            targetWorkspaceContextKey: string;
            state: "active" | "failed" | "rolled_back";
            rolloutMode: "private" | "staged" | "production";
            effectiveAt: string;
            note: {
                zh: string;
                en: string;
            } | null;
            activatedByUserId: string;
            updatedAt: string;
        }[];
        auditExports: {
            exportId: string;
            packageId: string;
            workspaceContextKey: string;
            format: "json" | "csv";
            status: "failed" | "ready";
            fileName: string;
            mimeType: string;
            objectKey: string;
            sizeBytes: number | null;
            sha256: string | null;
            recordCount: number;
            summary: {
                zh: string;
                en: string;
            };
            createdByUserId: string | null;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    protected writeState(state: CreatorState): Promise<void>;
}
//# sourceMappingURL=creator-repository.d.ts.map