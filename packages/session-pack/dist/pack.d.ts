import { type SessionPackSigningOptions } from "./signature.js";
import { type SessionPackManifest } from "./schema.js";
export type SessionPackInputContent = string | Uint8Array | ArrayBuffer;
export interface PackSessionVersionInput {
    manifest: Omit<SessionPackManifest, "manifest_version" | "files">;
    files: Record<string, SessionPackInputContent>;
    signature?: SessionPackSigningOptions;
}
export interface SessionPackBundle {
    manifest: SessionPackManifest;
    files: Record<string, Uint8Array>;
}
export type SessionPackValidationIssueCode = "MANIFEST_MISSING" | "MANIFEST_INVALID_JSON" | "MANIFEST_SCHEMA_INVALID" | "REQUIRED_FILE_MISSING" | "RUNTIME_FILE_MISSING" | "MANIFEST_FILE_MISSING" | "FILE_HASH_MISMATCH" | "FILE_SIZE_MISMATCH" | "BUNDLE_MANIFEST_FILE_MISSING" | "SLOT_SCHEMA_INVALID" | "MCP_REQUIREMENTS_INVALID" | "RUNTIME_PROFILE_INVALID" | "RUNTIME_CONFIG_INVALID" | "REDACTION_MAP_INVALID" | "INFORMATION_COLLECTION_REVIEW_INVALID" | "ARCHIVE_INVALID_GZIP" | "ARCHIVE_INVALID_JSON" | "ARCHIVE_SCHEMA_INVALID";
export interface SessionPackValidationIssue {
    code: SessionPackValidationIssueCode;
    path?: string;
    message: string;
}
export interface SessionPackValidationResult {
    ok: boolean;
    manifest?: SessionPackManifest;
    entries: string[];
    issues: SessionPackValidationIssue[];
}
export interface WriteSessionPackBundleOptions {
    overwrite?: boolean;
}
export interface WriteSessionPackArchiveOptions {
    overwrite?: boolean;
}
export declare function normalizeSessionPackEntryPath(entryPath: string): string;
export declare function buildSessionPackFileIndex(files: Record<string, Uint8Array>): Record<string, {
    sha256: string;
    size: number;
    required?: boolean | undefined;
}>;
export declare function formatSessionPackValidationIssues(issues: SessionPackValidationIssue[]): string;
export declare function validateSessionPackBundle(bundle: SessionPackBundle): SessionPackValidationResult;
export declare function validateSessionPackDirectory(packDir: string): SessionPackValidationResult;
export declare function readSessionPackBundleFromDirectory(packDir: string): SessionPackBundle;
export declare function writeSessionPackBundleToDirectory(bundle: SessionPackBundle, packDir: string, options?: WriteSessionPackBundleOptions): string[];
export declare function packSessionVersion(input: PackSessionVersionInput): SessionPackBundle;
export declare function serializeSessionPackBundle(bundle: SessionPackBundle): Uint8Array<ArrayBuffer>;
export declare function deserializeSessionPackBundle(serialized: Uint8Array | ArrayBuffer): SessionPackBundle;
export declare function writeSessionPackBundleArchive(bundle: SessionPackBundle, archivePath: string, options?: WriteSessionPackArchiveOptions): string;
export declare function readSessionPackBundleArchive(archivePath: string): SessionPackBundle;
//# sourceMappingURL=pack.d.ts.map