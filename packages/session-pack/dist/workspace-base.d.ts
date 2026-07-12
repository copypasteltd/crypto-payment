import { workspaceBaseArchiveFormatVersion } from "./constants.js";
export interface WorkspaceBaseArchiveEntry {
    path: string;
    kind: "file" | "directory";
    contentBase64?: string;
    sha256?: string;
    size?: number;
}
export interface WorkspaceBaseArchiveEnvelope {
    formatVersion: typeof workspaceBaseArchiveFormatVersion;
    metadata: Record<string, unknown>;
    entries: WorkspaceBaseArchiveEntry[];
    legacyPlaceholder: boolean;
}
export interface CreateWorkspaceBaseArchiveOptions {
    ignoreMissingRoot?: boolean;
    metadata?: Record<string, unknown>;
}
export interface RestoreWorkspaceBaseArchiveResult {
    formatVersion: typeof workspaceBaseArchiveFormatVersion;
    restoredDirectoriesCount: number;
    restoredFilesCount: number;
    metadata: Record<string, unknown>;
    legacyPlaceholder: boolean;
}
export declare function createEmptyWorkspaceBaseArchive(metadata?: Record<string, unknown>): Uint8Array<ArrayBuffer>;
export declare function createWorkspaceBaseArchiveFromDirectory(rootDir: string, options?: CreateWorkspaceBaseArchiveOptions): Promise<Uint8Array<ArrayBuffer>>;
export declare function deserializeWorkspaceBaseArchive(serialized: Uint8Array | ArrayBuffer): {
    formatVersion: "lingban.workspace-base/v1";
    metadata: {
        legacy_placeholder?: undefined;
    };
    entries: never[];
    legacyPlaceholder: true;
} | {
    formatVersion: "lingban.workspace-base/v1";
    metadata: {
        legacy_placeholder: object;
    };
    entries: never[];
    legacyPlaceholder: true;
} | {
    formatVersion: "lingban.workspace-base/v1";
    metadata: Record<string, unknown>;
    entries: {
        path: string;
        kind: "file" | "directory";
        contentBase64: string | undefined;
        sha256: string | undefined;
        size: number | undefined;
    }[];
    legacyPlaceholder: false;
};
export declare function restoreWorkspaceBaseArchiveToDirectory(serialized: Uint8Array | ArrayBuffer, targetDir: string): Promise<RestoreWorkspaceBaseArchiveResult>;
export declare function restoreWorkspaceBaseArchiveFileToDirectory(archivePath: string, targetDir: string): Promise<RestoreWorkspaceBaseArchiveResult>;
//# sourceMappingURL=workspace-base.d.ts.map