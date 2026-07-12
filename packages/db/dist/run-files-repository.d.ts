import { type RunFileRecord } from "@lingban/contracts";
import type { PostgresRepositoryOptions } from "./postgres-types.js";
export interface RunFilesIndexRepository {
    init(): Promise<void>;
    listRunFiles(runId: string): RunFileRecord[];
    getRunFile(runId: string, filePath: string): RunFileRecord | null;
    replaceRunFiles(runId: string, files: RunFileRecord[]): Promise<void>;
    upsertRunFile(file: RunFileRecord): Promise<RunFileRecord>;
    clear(): Promise<void>;
}
export declare abstract class CachedRunFilesIndexRepository implements RunFilesIndexRepository {
    #private;
    init(): Promise<void>;
    listRunFiles(runId: string): {
        path: string;
        name: string;
        kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
        sizeBytes: number | null;
        updatedAt: string;
        runId: string;
        workspaceId: string;
        logicalPath: string;
        source: "archive" | "log" | "target-scan" | "user-upload" | "runtime-output";
        mimeType: string | null;
        objectKey: string | null;
        uploadId: string | null;
        checksum: string | null;
        previewMode: "text" | "none" | "image" | "pdf" | "download";
        previewable: boolean;
        downloadable: boolean;
        storageTier: "hot" | "cold";
        archivedAt: string | null;
        archivedFromObjectKey: string | null;
        archiveReason: "terminal-retention" | "manual" | null;
        indexedAt: string;
    }[];
    getRunFile(runId: string, filePath: string): {
        path: string;
        name: string;
        kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
        sizeBytes: number | null;
        updatedAt: string;
        runId: string;
        workspaceId: string;
        logicalPath: string;
        source: "archive" | "log" | "target-scan" | "user-upload" | "runtime-output";
        mimeType: string | null;
        objectKey: string | null;
        uploadId: string | null;
        checksum: string | null;
        previewMode: "text" | "none" | "image" | "pdf" | "download";
        previewable: boolean;
        downloadable: boolean;
        storageTier: "hot" | "cold";
        archivedAt: string | null;
        archivedFromObjectKey: string | null;
        archiveReason: "terminal-retention" | "manual" | null;
        indexedAt: string;
    } | null;
    replaceRunFiles(runId: string, files: RunFileRecord[]): Promise<void>;
    upsertRunFile(file: RunFileRecord): Promise<{
        path: string;
        name: string;
        kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
        sizeBytes: number | null;
        updatedAt: string;
        runId: string;
        workspaceId: string;
        logicalPath: string;
        source: "archive" | "log" | "target-scan" | "user-upload" | "runtime-output";
        mimeType: string | null;
        objectKey: string | null;
        uploadId: string | null;
        checksum: string | null;
        previewMode: "text" | "none" | "image" | "pdf" | "download";
        previewable: boolean;
        downloadable: boolean;
        storageTier: "hot" | "cold";
        archivedAt: string | null;
        archivedFromObjectKey: string | null;
        archiveReason: "terminal-retention" | "manual" | null;
        indexedAt: string;
    }>;
    clear(): Promise<void>;
    protected abstract loadAll(): Promise<RunFileRecord[]>;
    protected abstract persistRun(runId: string, files: RunFileRecord[]): Promise<void>;
    protected abstract clearStorage(): Promise<void>;
}
export declare class PostgresRunFilesIndexRepository extends CachedRunFilesIndexRepository {
    #private;
    constructor(options: PostgresRepositoryOptions);
    protected loadAll(): Promise<{
        path: string;
        name: string;
        kind: "output" | "input" | "receipt" | "archive" | "log" | "screenshot";
        sizeBytes: number | null;
        updatedAt: string;
        runId: string;
        workspaceId: string;
        logicalPath: string;
        source: "archive" | "log" | "target-scan" | "user-upload" | "runtime-output";
        mimeType: string | null;
        objectKey: string | null;
        uploadId: string | null;
        checksum: string | null;
        previewMode: "text" | "none" | "image" | "pdf" | "download";
        previewable: boolean;
        downloadable: boolean;
        storageTier: "hot" | "cold";
        archivedAt: string | null;
        archivedFromObjectKey: string | null;
        archiveReason: "terminal-retention" | "manual" | null;
        indexedAt: string;
    }[]>;
    protected persistRun(runId: string, files: RunFileRecord[]): Promise<void>;
    protected clearStorage(): Promise<void>;
}
//# sourceMappingURL=run-files-repository.d.ts.map