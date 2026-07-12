import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const importedSessionPackRecordSchema: z.ZodObject<{
    sessionVersionId: z.ZodString;
    workspaceContextKeys: z.ZodArray<z.ZodString>;
    requiredBindings: z.ZodObject<{
        firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    archiveSource: z.ZodDefault<z.ZodEnum<{
        generated: "generated";
        imported: "imported";
        "runtime-derived": "runtime-derived";
    }>>;
    archivePath: z.ZodString;
    archiveSizeBytes: z.ZodNumber;
    archiveSha256: z.ZodString;
    archiveFileName: z.ZodString;
    importedAt: z.ZodString;
    importedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    runtimeSourceRunId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    runtimeSourceTargetPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    runtimeSourceUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    archiveExports: z.ZodDefault<z.ZodArray<z.ZodObject<{
        exportId: z.ZodString;
        exportedAt: z.ZodString;
        exportedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        redacted: z.ZodDefault<z.ZodBoolean>;
        archiveSource: z.ZodDefault<z.ZodEnum<{
            generated: "generated";
            imported: "imported";
            "runtime-derived": "runtime-derived";
        }>>;
        archiveFileName: z.ZodString;
        archiveSizeBytes: z.ZodDefault<z.ZodNumber>;
        archiveSha256: z.ZodString;
    }, z.core.$strip>>>;
    runtimeEvidenceEntries: z.ZodDefault<z.ZodArray<z.ZodObject<{
        evidenceId: z.ZodString;
        capturedAt: z.ZodString;
        archiveSource: z.ZodDefault<z.ZodEnum<{
            generated: "generated";
            imported: "imported";
            "runtime-derived": "runtime-derived";
        }>>;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        targetPath: z.ZodString;
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
        runtimeProfileId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        runnerImage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        manifestRuntimeDerived: z.ZodDefault<z.ZodBoolean>;
        runtimeSourceUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        archiveSha256: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        archiveFileName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        workspaceBaseCaptured: z.ZodDefault<z.ZodBoolean>;
        workspaceBaseCaptureError: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    updatedAt: z.ZodString;
    manifest: z.ZodObject<{
        manifest_version: z.ZodLiteral<"lingban.session-pack/v1">;
        session_id: z.ZodString;
        session_version: z.ZodString;
        task_family: z.ZodString;
        runtime_profile: z.ZodObject<{
            profile_id: z.ZodString;
            runner_image: z.ZodOptional<z.ZodString>;
            node_version: z.ZodOptional<z.ZodString>;
            python_version: z.ZodOptional<z.ZodString>;
            browser_required: z.ZodOptional<z.ZodBoolean>;
            playwright_required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
        slot_schema_version: z.ZodString;
        required_capabilities: z.ZodObject<{
            browser: z.ZodOptional<z.ZodBoolean>;
            filesystem: z.ZodOptional<z.ZodBoolean>;
            downloads: z.ZodOptional<z.ZodBoolean>;
            apis: z.ZodOptional<z.ZodArray<z.ZodString>>;
            mcps: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodOptional<z.ZodString>;
                protocol: z.ZodOptional<z.ZodString>;
                risk_level: z.ZodOptional<z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                    critical: "critical";
                }>>;
                required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>>>;
            credentials: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                placement: z.ZodOptional<z.ZodEnum<{
                    file: "file";
                    env: "env";
                    "browser-state": "browser-state";
                }>>;
                required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>>>;
        }, z.core.$strict>;
        artifact_contract: z.ZodObject<{
            outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                kind: z.ZodEnum<{
                    file: "file";
                    directory: "directory";
                    report: "report";
                    receipt: "receipt";
                    archive: "archive";
                    image: "image";
                    document: "document";
                }>;
                required: z.ZodOptional<z.ZodBoolean>;
                path_pattern: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>>;
        }, z.core.$strict>;
        created_by: z.ZodObject<{
            user_id: z.ZodString;
            display_name: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        created_at: z.ZodString;
        source: z.ZodOptional<z.ZodObject<{
            workspace_id: z.ZodOptional<z.ZodString>;
            creator_package_id: z.ZodOptional<z.ZodString>;
            creator_release_id: z.ZodOptional<z.ZodString>;
            lineage_parent_version_id: z.ZodOptional<z.ZodString>;
            rollback_from_version_id: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        files: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            sha256: z.ZodString;
            size: z.ZodNumber;
            required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
        signature: z.ZodOptional<z.ZodObject<{
            algorithm: z.ZodEnum<{
                sha256: "sha256";
                "hmac-sha256": "hmac-sha256";
                ed25519: "ed25519";
            }>;
            value: z.ZodString;
            key_id: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
    }, z.core.$strict>;
}, z.core.$strip>;
export declare const sessionArchiveStateSchema: z.ZodObject<{
    archives: z.ZodDefault<z.ZodArray<z.ZodObject<{
        sessionVersionId: z.ZodString;
        workspaceContextKeys: z.ZodArray<z.ZodString>;
        requiredBindings: z.ZodObject<{
            firstPartyMcpIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            externalConnectorRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
            credentialIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
        archiveSource: z.ZodDefault<z.ZodEnum<{
            generated: "generated";
            imported: "imported";
            "runtime-derived": "runtime-derived";
        }>>;
        archivePath: z.ZodString;
        archiveSizeBytes: z.ZodNumber;
        archiveSha256: z.ZodString;
        archiveFileName: z.ZodString;
        importedAt: z.ZodString;
        importedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        runtimeSourceRunId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        runtimeSourceTargetPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        runtimeSourceUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        archiveExports: z.ZodDefault<z.ZodArray<z.ZodObject<{
            exportId: z.ZodString;
            exportedAt: z.ZodString;
            exportedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workspaceContextKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            redacted: z.ZodDefault<z.ZodBoolean>;
            archiveSource: z.ZodDefault<z.ZodEnum<{
                generated: "generated";
                imported: "imported";
                "runtime-derived": "runtime-derived";
            }>>;
            archiveFileName: z.ZodString;
            archiveSizeBytes: z.ZodDefault<z.ZodNumber>;
            archiveSha256: z.ZodString;
        }, z.core.$strip>>>;
        runtimeEvidenceEntries: z.ZodDefault<z.ZodArray<z.ZodObject<{
            evidenceId: z.ZodString;
            capturedAt: z.ZodString;
            archiveSource: z.ZodDefault<z.ZodEnum<{
                generated: "generated";
                imported: "imported";
                "runtime-derived": "runtime-derived";
            }>>;
            runId: z.ZodString;
            workspaceId: z.ZodString;
            requestedByUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            targetPath: z.ZodString;
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
            runtimeProfileId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            runnerImage: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            manifestRuntimeDerived: z.ZodDefault<z.ZodBoolean>;
            runtimeSourceUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            archiveSha256: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            archiveFileName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            workspaceBaseCaptured: z.ZodDefault<z.ZodBoolean>;
            workspaceBaseCaptureError: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
        updatedAt: z.ZodString;
        manifest: z.ZodObject<{
            manifest_version: z.ZodLiteral<"lingban.session-pack/v1">;
            session_id: z.ZodString;
            session_version: z.ZodString;
            task_family: z.ZodString;
            runtime_profile: z.ZodObject<{
                profile_id: z.ZodString;
                runner_image: z.ZodOptional<z.ZodString>;
                node_version: z.ZodOptional<z.ZodString>;
                python_version: z.ZodOptional<z.ZodString>;
                browser_required: z.ZodOptional<z.ZodBoolean>;
                playwright_required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>;
            slot_schema_version: z.ZodString;
            required_capabilities: z.ZodObject<{
                browser: z.ZodOptional<z.ZodBoolean>;
                filesystem: z.ZodOptional<z.ZodBoolean>;
                downloads: z.ZodOptional<z.ZodBoolean>;
                apis: z.ZodOptional<z.ZodArray<z.ZodString>>;
                mcps: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodOptional<z.ZodString>;
                    protocol: z.ZodOptional<z.ZodString>;
                    risk_level: z.ZodOptional<z.ZodEnum<{
                        low: "low";
                        medium: "medium";
                        high: "high";
                        critical: "critical";
                    }>>;
                    required: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$strict>>>;
                credentials: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    placement: z.ZodOptional<z.ZodEnum<{
                        file: "file";
                        env: "env";
                        "browser-state": "browser-state";
                    }>>;
                    required: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$strict>>>;
            }, z.core.$strict>;
            artifact_contract: z.ZodObject<{
                outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        file: "file";
                        directory: "directory";
                        report: "report";
                        receipt: "receipt";
                        archive: "archive";
                        image: "image";
                        document: "document";
                    }>;
                    required: z.ZodOptional<z.ZodBoolean>;
                    path_pattern: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>>>;
            }, z.core.$strict>;
            created_by: z.ZodObject<{
                user_id: z.ZodString;
                display_name: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>;
            created_at: z.ZodString;
            source: z.ZodOptional<z.ZodObject<{
                workspace_id: z.ZodOptional<z.ZodString>;
                creator_package_id: z.ZodOptional<z.ZodString>;
                creator_release_id: z.ZodOptional<z.ZodString>;
                lineage_parent_version_id: z.ZodOptional<z.ZodString>;
                rollback_from_version_id: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
            files: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
                sha256: z.ZodString;
                size: z.ZodNumber;
                required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>>>;
            signature: z.ZodOptional<z.ZodObject<{
                algorithm: z.ZodEnum<{
                    sha256: "sha256";
                    "hmac-sha256": "hmac-sha256";
                    ed25519: "ed25519";
                }>;
                value: z.ZodString;
                key_id: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
        }, z.core.$strict>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ImportedSessionPackRecord = z.infer<typeof importedSessionPackRecordSchema>;
export type SessionArchiveState = z.infer<typeof sessionArchiveStateSchema>;
export interface SessionArchiveRecordRepository {
    init(): Promise<void>;
    listImportedArchives(): ImportedSessionPackRecord[];
    getImportedArchiveBySessionVersionId(sessionVersionId: string): ImportedSessionPackRecord | null;
    saveImportedArchiveRecord(record: ImportedSessionPackRecord): Promise<ImportedSessionPackRecord>;
}
export declare abstract class CachedSessionArchiveRecordRepository implements SessionArchiveRecordRepository {
    #private;
    init(): Promise<void>;
    listImportedArchives(): {
        sessionVersionId: string;
        workspaceContextKeys: string[];
        requiredBindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
        archiveSource: "generated" | "imported" | "runtime-derived";
        archivePath: string;
        archiveSizeBytes: number;
        archiveSha256: string;
        archiveFileName: string;
        importedAt: string;
        importedByUserId: string | null;
        runtimeSourceRunId: string | null;
        runtimeSourceTargetPath: string | null;
        runtimeSourceUpdatedAt: string | null;
        archiveExports: {
            exportId: string;
            exportedAt: string;
            exportedByUserId: string | null;
            workspaceContextKey: string | null;
            redacted: boolean;
            archiveSource: "generated" | "imported" | "runtime-derived";
            archiveFileName: string;
            archiveSizeBytes: number;
            archiveSha256: string;
        }[];
        runtimeEvidenceEntries: {
            evidenceId: string;
            capturedAt: string;
            archiveSource: "generated" | "imported" | "runtime-derived";
            runId: string;
            workspaceId: string;
            requestedByUserId: string | null;
            targetPath: string;
            launchMode: "local-process" | "docker" | null;
            containerName: string | null;
            startedAt: string | null;
            readyAt: string | null;
            finishedAt: string | null;
            exitCode: number | null;
            exitSignal: string | null;
            runtimeProfileId: string | null;
            runnerImage: string | null;
            manifestRuntimeDerived: boolean;
            runtimeSourceUpdatedAt: string | null;
            archiveSha256: string | null;
            archiveFileName: string | null;
            workspaceBaseCaptured: boolean;
            workspaceBaseCaptureError: string | null;
        }[];
        updatedAt: string;
        manifest: {
            manifest_version: "lingban.session-pack/v1";
            session_id: string;
            session_version: string;
            task_family: string;
            runtime_profile: {
                profile_id: string;
                runner_image?: string | undefined;
                node_version?: string | undefined;
                python_version?: string | undefined;
                browser_required?: boolean | undefined;
                playwright_required?: boolean | undefined;
            };
            slot_schema_version: string;
            required_capabilities: {
                browser?: boolean | undefined;
                filesystem?: boolean | undefined;
                downloads?: boolean | undefined;
                apis?: string[] | undefined;
                mcps?: {
                    id: string;
                    name?: string | undefined;
                    protocol?: string | undefined;
                    risk_level?: "low" | "medium" | "high" | "critical" | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                credentials?: {
                    id: string;
                    placement?: "file" | "env" | "browser-state" | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
            };
            artifact_contract: {
                outputs: {
                    name: string;
                    kind: "file" | "directory" | "receipt" | "archive" | "image" | "report" | "document";
                    required?: boolean | undefined;
                    path_pattern?: string | undefined;
                }[];
            };
            created_by: {
                user_id: string;
                display_name?: string | undefined;
            };
            created_at: string;
            files: Record<string, {
                sha256: string;
                size: number;
                required?: boolean | undefined;
            }>;
            source?: {
                workspace_id?: string | undefined;
                creator_package_id?: string | undefined;
                creator_release_id?: string | undefined;
                lineage_parent_version_id?: string | undefined;
                rollback_from_version_id?: string | undefined;
            } | undefined;
            signature?: {
                algorithm: "sha256" | "hmac-sha256" | "ed25519";
                value: string;
                key_id?: string | undefined;
            } | undefined;
            metadata?: Record<string, string | number | boolean> | undefined;
        };
    }[];
    getImportedArchiveBySessionVersionId(sessionVersionId: string): {
        sessionVersionId: string;
        workspaceContextKeys: string[];
        requiredBindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
        archiveSource: "generated" | "imported" | "runtime-derived";
        archivePath: string;
        archiveSizeBytes: number;
        archiveSha256: string;
        archiveFileName: string;
        importedAt: string;
        importedByUserId: string | null;
        runtimeSourceRunId: string | null;
        runtimeSourceTargetPath: string | null;
        runtimeSourceUpdatedAt: string | null;
        archiveExports: {
            exportId: string;
            exportedAt: string;
            exportedByUserId: string | null;
            workspaceContextKey: string | null;
            redacted: boolean;
            archiveSource: "generated" | "imported" | "runtime-derived";
            archiveFileName: string;
            archiveSizeBytes: number;
            archiveSha256: string;
        }[];
        runtimeEvidenceEntries: {
            evidenceId: string;
            capturedAt: string;
            archiveSource: "generated" | "imported" | "runtime-derived";
            runId: string;
            workspaceId: string;
            requestedByUserId: string | null;
            targetPath: string;
            launchMode: "local-process" | "docker" | null;
            containerName: string | null;
            startedAt: string | null;
            readyAt: string | null;
            finishedAt: string | null;
            exitCode: number | null;
            exitSignal: string | null;
            runtimeProfileId: string | null;
            runnerImage: string | null;
            manifestRuntimeDerived: boolean;
            runtimeSourceUpdatedAt: string | null;
            archiveSha256: string | null;
            archiveFileName: string | null;
            workspaceBaseCaptured: boolean;
            workspaceBaseCaptureError: string | null;
        }[];
        updatedAt: string;
        manifest: {
            manifest_version: "lingban.session-pack/v1";
            session_id: string;
            session_version: string;
            task_family: string;
            runtime_profile: {
                profile_id: string;
                runner_image?: string | undefined;
                node_version?: string | undefined;
                python_version?: string | undefined;
                browser_required?: boolean | undefined;
                playwright_required?: boolean | undefined;
            };
            slot_schema_version: string;
            required_capabilities: {
                browser?: boolean | undefined;
                filesystem?: boolean | undefined;
                downloads?: boolean | undefined;
                apis?: string[] | undefined;
                mcps?: {
                    id: string;
                    name?: string | undefined;
                    protocol?: string | undefined;
                    risk_level?: "low" | "medium" | "high" | "critical" | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                credentials?: {
                    id: string;
                    placement?: "file" | "env" | "browser-state" | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
            };
            artifact_contract: {
                outputs: {
                    name: string;
                    kind: "file" | "directory" | "receipt" | "archive" | "image" | "report" | "document";
                    required?: boolean | undefined;
                    path_pattern?: string | undefined;
                }[];
            };
            created_by: {
                user_id: string;
                display_name?: string | undefined;
            };
            created_at: string;
            files: Record<string, {
                sha256: string;
                size: number;
                required?: boolean | undefined;
            }>;
            source?: {
                workspace_id?: string | undefined;
                creator_package_id?: string | undefined;
                creator_release_id?: string | undefined;
                lineage_parent_version_id?: string | undefined;
                rollback_from_version_id?: string | undefined;
            } | undefined;
            signature?: {
                algorithm: "sha256" | "hmac-sha256" | "ed25519";
                value: string;
                key_id?: string | undefined;
            } | undefined;
            metadata?: Record<string, string | number | boolean> | undefined;
        };
    } | null;
    saveImportedArchiveRecord(record: ImportedSessionPackRecord): Promise<{
        sessionVersionId: string;
        workspaceContextKeys: string[];
        requiredBindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
        archiveSource: "generated" | "imported" | "runtime-derived";
        archivePath: string;
        archiveSizeBytes: number;
        archiveSha256: string;
        archiveFileName: string;
        importedAt: string;
        importedByUserId: string | null;
        runtimeSourceRunId: string | null;
        runtimeSourceTargetPath: string | null;
        runtimeSourceUpdatedAt: string | null;
        archiveExports: {
            exportId: string;
            exportedAt: string;
            exportedByUserId: string | null;
            workspaceContextKey: string | null;
            redacted: boolean;
            archiveSource: "generated" | "imported" | "runtime-derived";
            archiveFileName: string;
            archiveSizeBytes: number;
            archiveSha256: string;
        }[];
        runtimeEvidenceEntries: {
            evidenceId: string;
            capturedAt: string;
            archiveSource: "generated" | "imported" | "runtime-derived";
            runId: string;
            workspaceId: string;
            requestedByUserId: string | null;
            targetPath: string;
            launchMode: "local-process" | "docker" | null;
            containerName: string | null;
            startedAt: string | null;
            readyAt: string | null;
            finishedAt: string | null;
            exitCode: number | null;
            exitSignal: string | null;
            runtimeProfileId: string | null;
            runnerImage: string | null;
            manifestRuntimeDerived: boolean;
            runtimeSourceUpdatedAt: string | null;
            archiveSha256: string | null;
            archiveFileName: string | null;
            workspaceBaseCaptured: boolean;
            workspaceBaseCaptureError: string | null;
        }[];
        updatedAt: string;
        manifest: {
            manifest_version: "lingban.session-pack/v1";
            session_id: string;
            session_version: string;
            task_family: string;
            runtime_profile: {
                profile_id: string;
                runner_image?: string | undefined;
                node_version?: string | undefined;
                python_version?: string | undefined;
                browser_required?: boolean | undefined;
                playwright_required?: boolean | undefined;
            };
            slot_schema_version: string;
            required_capabilities: {
                browser?: boolean | undefined;
                filesystem?: boolean | undefined;
                downloads?: boolean | undefined;
                apis?: string[] | undefined;
                mcps?: {
                    id: string;
                    name?: string | undefined;
                    protocol?: string | undefined;
                    risk_level?: "low" | "medium" | "high" | "critical" | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                credentials?: {
                    id: string;
                    placement?: "file" | "env" | "browser-state" | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
            };
            artifact_contract: {
                outputs: {
                    name: string;
                    kind: "file" | "directory" | "receipt" | "archive" | "image" | "report" | "document";
                    required?: boolean | undefined;
                    path_pattern?: string | undefined;
                }[];
            };
            created_by: {
                user_id: string;
                display_name?: string | undefined;
            };
            created_at: string;
            files: Record<string, {
                sha256: string;
                size: number;
                required?: boolean | undefined;
            }>;
            source?: {
                workspace_id?: string | undefined;
                creator_package_id?: string | undefined;
                creator_release_id?: string | undefined;
                lineage_parent_version_id?: string | undefined;
                rollback_from_version_id?: string | undefined;
            } | undefined;
            signature?: {
                algorithm: "sha256" | "hmac-sha256" | "ed25519";
                value: string;
                key_id?: string | undefined;
            } | undefined;
            metadata?: Record<string, string | number | boolean> | undefined;
        };
    }>;
    protected replaceCachedImportedArchiveRecord(record: ImportedSessionPackRecord): void;
    protected updateState(mutator: (state: SessionArchiveState) => SessionArchiveState): Promise<void>;
    protected abstract loadState(): Promise<SessionArchiveState>;
    protected abstract writeState(state: SessionArchiveState): Promise<void>;
}
export interface PostgresSessionArchiveRecordRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresSessionArchiveRecordRepository extends CachedSessionArchiveRecordRepository {
    #private;
    constructor(options: PostgresSessionArchiveRecordRepositoryOptions);
    protected loadState(): Promise<{
        archives: {
            sessionVersionId: string;
            workspaceContextKeys: string[];
            requiredBindings: {
                firstPartyMcpIds: string[];
                externalConnectorRefs: string[];
                credentialIds: string[];
            };
            archiveSource: "generated" | "imported" | "runtime-derived";
            archivePath: string;
            archiveSizeBytes: number;
            archiveSha256: string;
            archiveFileName: string;
            importedAt: string;
            importedByUserId: string | null;
            runtimeSourceRunId: string | null;
            runtimeSourceTargetPath: string | null;
            runtimeSourceUpdatedAt: string | null;
            archiveExports: {
                exportId: string;
                exportedAt: string;
                exportedByUserId: string | null;
                workspaceContextKey: string | null;
                redacted: boolean;
                archiveSource: "generated" | "imported" | "runtime-derived";
                archiveFileName: string;
                archiveSizeBytes: number;
                archiveSha256: string;
            }[];
            runtimeEvidenceEntries: {
                evidenceId: string;
                capturedAt: string;
                archiveSource: "generated" | "imported" | "runtime-derived";
                runId: string;
                workspaceId: string;
                requestedByUserId: string | null;
                targetPath: string;
                launchMode: "local-process" | "docker" | null;
                containerName: string | null;
                startedAt: string | null;
                readyAt: string | null;
                finishedAt: string | null;
                exitCode: number | null;
                exitSignal: string | null;
                runtimeProfileId: string | null;
                runnerImage: string | null;
                manifestRuntimeDerived: boolean;
                runtimeSourceUpdatedAt: string | null;
                archiveSha256: string | null;
                archiveFileName: string | null;
                workspaceBaseCaptured: boolean;
                workspaceBaseCaptureError: string | null;
            }[];
            updatedAt: string;
            manifest: {
                manifest_version: "lingban.session-pack/v1";
                session_id: string;
                session_version: string;
                task_family: string;
                runtime_profile: {
                    profile_id: string;
                    runner_image?: string | undefined;
                    node_version?: string | undefined;
                    python_version?: string | undefined;
                    browser_required?: boolean | undefined;
                    playwright_required?: boolean | undefined;
                };
                slot_schema_version: string;
                required_capabilities: {
                    browser?: boolean | undefined;
                    filesystem?: boolean | undefined;
                    downloads?: boolean | undefined;
                    apis?: string[] | undefined;
                    mcps?: {
                        id: string;
                        name?: string | undefined;
                        protocol?: string | undefined;
                        risk_level?: "low" | "medium" | "high" | "critical" | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                    credentials?: {
                        id: string;
                        placement?: "file" | "env" | "browser-state" | undefined;
                        required?: boolean | undefined;
                    }[] | undefined;
                };
                artifact_contract: {
                    outputs: {
                        name: string;
                        kind: "file" | "directory" | "receipt" | "archive" | "image" | "report" | "document";
                        required?: boolean | undefined;
                        path_pattern?: string | undefined;
                    }[];
                };
                created_by: {
                    user_id: string;
                    display_name?: string | undefined;
                };
                created_at: string;
                files: Record<string, {
                    sha256: string;
                    size: number;
                    required?: boolean | undefined;
                }>;
                source?: {
                    workspace_id?: string | undefined;
                    creator_package_id?: string | undefined;
                    creator_release_id?: string | undefined;
                    lineage_parent_version_id?: string | undefined;
                    rollback_from_version_id?: string | undefined;
                } | undefined;
                signature?: {
                    algorithm: "sha256" | "hmac-sha256" | "ed25519";
                    value: string;
                    key_id?: string | undefined;
                } | undefined;
                metadata?: Record<string, string | number | boolean> | undefined;
            };
        }[];
    }>;
    saveImportedArchiveRecord(record: ImportedSessionPackRecord): Promise<{
        sessionVersionId: string;
        workspaceContextKeys: string[];
        requiredBindings: {
            firstPartyMcpIds: string[];
            externalConnectorRefs: string[];
            credentialIds: string[];
        };
        archiveSource: "generated" | "imported" | "runtime-derived";
        archivePath: string;
        archiveSizeBytes: number;
        archiveSha256: string;
        archiveFileName: string;
        importedAt: string;
        importedByUserId: string | null;
        runtimeSourceRunId: string | null;
        runtimeSourceTargetPath: string | null;
        runtimeSourceUpdatedAt: string | null;
        archiveExports: {
            exportId: string;
            exportedAt: string;
            exportedByUserId: string | null;
            workspaceContextKey: string | null;
            redacted: boolean;
            archiveSource: "generated" | "imported" | "runtime-derived";
            archiveFileName: string;
            archiveSizeBytes: number;
            archiveSha256: string;
        }[];
        runtimeEvidenceEntries: {
            evidenceId: string;
            capturedAt: string;
            archiveSource: "generated" | "imported" | "runtime-derived";
            runId: string;
            workspaceId: string;
            requestedByUserId: string | null;
            targetPath: string;
            launchMode: "local-process" | "docker" | null;
            containerName: string | null;
            startedAt: string | null;
            readyAt: string | null;
            finishedAt: string | null;
            exitCode: number | null;
            exitSignal: string | null;
            runtimeProfileId: string | null;
            runnerImage: string | null;
            manifestRuntimeDerived: boolean;
            runtimeSourceUpdatedAt: string | null;
            archiveSha256: string | null;
            archiveFileName: string | null;
            workspaceBaseCaptured: boolean;
            workspaceBaseCaptureError: string | null;
        }[];
        updatedAt: string;
        manifest: {
            manifest_version: "lingban.session-pack/v1";
            session_id: string;
            session_version: string;
            task_family: string;
            runtime_profile: {
                profile_id: string;
                runner_image?: string | undefined;
                node_version?: string | undefined;
                python_version?: string | undefined;
                browser_required?: boolean | undefined;
                playwright_required?: boolean | undefined;
            };
            slot_schema_version: string;
            required_capabilities: {
                browser?: boolean | undefined;
                filesystem?: boolean | undefined;
                downloads?: boolean | undefined;
                apis?: string[] | undefined;
                mcps?: {
                    id: string;
                    name?: string | undefined;
                    protocol?: string | undefined;
                    risk_level?: "low" | "medium" | "high" | "critical" | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
                credentials?: {
                    id: string;
                    placement?: "file" | "env" | "browser-state" | undefined;
                    required?: boolean | undefined;
                }[] | undefined;
            };
            artifact_contract: {
                outputs: {
                    name: string;
                    kind: "file" | "directory" | "receipt" | "archive" | "image" | "report" | "document";
                    required?: boolean | undefined;
                    path_pattern?: string | undefined;
                }[];
            };
            created_by: {
                user_id: string;
                display_name?: string | undefined;
            };
            created_at: string;
            files: Record<string, {
                sha256: string;
                size: number;
                required?: boolean | undefined;
            }>;
            source?: {
                workspace_id?: string | undefined;
                creator_package_id?: string | undefined;
                creator_release_id?: string | undefined;
                lineage_parent_version_id?: string | undefined;
                rollback_from_version_id?: string | undefined;
            } | undefined;
            signature?: {
                algorithm: "sha256" | "hmac-sha256" | "ed25519";
                value: string;
                key_id?: string | undefined;
            } | undefined;
            metadata?: Record<string, string | number | boolean> | undefined;
        };
    }>;
    protected writeState(state: SessionArchiveState): Promise<void>;
}
//# sourceMappingURL=session-archives-repository.d.ts.map