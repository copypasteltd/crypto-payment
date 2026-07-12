import { type SessionPackManifest, type SessionPackSignature } from "./schema.js";
export type SessionPackSigningOptions = {
    algorithm: "sha256";
    keyId?: string;
} | {
    algorithm: "hmac-sha256";
    secret: string;
    keyId?: string;
} | {
    algorithm: "ed25519";
    privateKeyPem: string;
    publicKeyPem?: string;
    keyId?: string;
};
export interface SessionPackSignatureVerificationOptions {
    requireSignature?: boolean;
    hmacSecret?: string;
    hmacSecretsByKeyId?: Record<string, string>;
    ed25519PublicKeyPem?: string;
    ed25519PrivateKeyPem?: string;
    ed25519PublicKeysByKeyId?: Record<string, string>;
}
export interface SessionPackSignatureVerificationResult {
    ok: boolean;
    verified: boolean;
    missing: boolean;
    reason?: string;
    signature?: SessionPackSignature | null;
}
export declare function canonicalizeSessionPackManifestForSignature(manifest: SessionPackManifest): Uint8Array<ArrayBufferLike>;
export declare function encodeSessionPackManifestFile(manifest: SessionPackManifest): Uint8Array<ArrayBufferLike>;
export declare function createSessionPackManifestSignature(manifest: SessionPackManifest, options: SessionPackSigningOptions): {
    algorithm: "sha256" | "hmac-sha256" | "ed25519";
    value: string;
    key_id?: string | undefined;
};
export declare function signSessionPackManifest(manifest: SessionPackManifest, options: SessionPackSigningOptions): {
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
            kind: "file" | "directory" | "report" | "receipt" | "archive" | "image" | "document";
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
export declare function signSessionPackBundle(bundle: {
    manifest: SessionPackManifest;
    files: Record<string, Uint8Array>;
}, options: SessionPackSigningOptions): {
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
                kind: "file" | "directory" | "report" | "receipt" | "archive" | "image" | "document";
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
    files: {
        "manifest.json": Uint8Array<ArrayBufferLike>;
    };
};
export declare function verifySessionPackManifestSignature(manifest: SessionPackManifest, options?: SessionPackSignatureVerificationOptions): SessionPackSignatureVerificationResult;
//# sourceMappingURL=signature.d.ts.map