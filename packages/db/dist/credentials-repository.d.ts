import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";
export declare const storedCredentialRecordSchema: z.ZodObject<{
    credentialId: z.ZodString;
    workspaceId: z.ZodString;
    ownerUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    scope: z.ZodEnum<{
        user: "user";
        workspace: "workspace";
    }>;
    displayName: z.ZodString;
    provider: z.ZodString;
    secretKind: z.ZodEnum<{
        "api-key": "api-key";
        "access-token": "access-token";
        "oauth-token": "oauth-token";
        "json-file": "json-file";
        "browser-storage-state": "browser-storage-state";
        "session-cookie": "session-cookie";
    }>;
    mountMode: z.ZodEnum<{
        env: "env";
        file: "file";
    }>;
    status: z.ZodEnum<{
        active: "active";
        disabled: "disabled";
        revoked: "revoked";
        "needs-rotation": "needs-rotation";
    }>;
    brokerKind: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "local-envelope": "local-envelope";
        "vault-transit-http": "vault-transit-http";
        "aws-kms-envelope": "aws-kms-envelope";
    }>>>;
    activeKeyId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    secretVersion: z.ZodDefault<z.ZodNumber>;
    expiresAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastRotatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    lastMaterializedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    rotationDueAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    envName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    mountPathTemplate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    redactedSecretRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secretRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    secretEnvelope: z.ZodDefault<z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
        version: z.ZodLiteral<1>;
        brokerKind: z.ZodLiteral<"local-envelope">;
        algorithm: z.ZodLiteral<"aes-256-gcm">;
        keyId: z.ZodString;
        ivBase64: z.ZodString;
        authTagBase64: z.ZodString;
        ciphertextBase64: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        version: z.ZodLiteral<1>;
        brokerKind: z.ZodLiteral<"vault-transit-http">;
        algorithm: z.ZodLiteral<"vault-transit">;
        keyId: z.ZodString;
        ciphertext: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        version: z.ZodLiteral<1>;
        brokerKind: z.ZodLiteral<"aws-kms-envelope">;
        algorithm: z.ZodLiteral<"aes-256-gcm">;
        keyId: z.ZodString;
        kmsKeyId: z.ZodString;
        kmsRegion: z.ZodString;
        encryptedDataKeyBase64: z.ZodString;
        ivBase64: z.ZodString;
        authTagBase64: z.ZodString;
        ciphertextBase64: z.ZodString;
    }, z.core.$strip>], "brokerKind">>>;
    lastMaterializationLeaseId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    activeRunGraceIssuedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const credentialsStateSchema: z.ZodObject<{
    credentials: z.ZodDefault<z.ZodArray<z.ZodObject<{
        credentialId: z.ZodString;
        workspaceId: z.ZodString;
        ownerUserId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scope: z.ZodEnum<{
            user: "user";
            workspace: "workspace";
        }>;
        displayName: z.ZodString;
        provider: z.ZodString;
        secretKind: z.ZodEnum<{
            "api-key": "api-key";
            "access-token": "access-token";
            "oauth-token": "oauth-token";
            "json-file": "json-file";
            "browser-storage-state": "browser-storage-state";
            "session-cookie": "session-cookie";
        }>;
        mountMode: z.ZodEnum<{
            env: "env";
            file: "file";
        }>;
        status: z.ZodEnum<{
            active: "active";
            disabled: "disabled";
            revoked: "revoked";
            "needs-rotation": "needs-rotation";
        }>;
        brokerKind: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "local-envelope": "local-envelope";
            "vault-transit-http": "vault-transit-http";
            "aws-kms-envelope": "aws-kms-envelope";
        }>>>;
        activeKeyId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        secretVersion: z.ZodDefault<z.ZodNumber>;
        expiresAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        lastRotatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        lastMaterializedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        rotationDueAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        notes: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        envName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        mountPathTemplate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        redactedSecretRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        secretRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        secretEnvelope: z.ZodDefault<z.ZodNullable<z.ZodDiscriminatedUnion<[z.ZodObject<{
            version: z.ZodLiteral<1>;
            brokerKind: z.ZodLiteral<"local-envelope">;
            algorithm: z.ZodLiteral<"aes-256-gcm">;
            keyId: z.ZodString;
            ivBase64: z.ZodString;
            authTagBase64: z.ZodString;
            ciphertextBase64: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            version: z.ZodLiteral<1>;
            brokerKind: z.ZodLiteral<"vault-transit-http">;
            algorithm: z.ZodLiteral<"vault-transit">;
            keyId: z.ZodString;
            ciphertext: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            version: z.ZodLiteral<1>;
            brokerKind: z.ZodLiteral<"aws-kms-envelope">;
            algorithm: z.ZodLiteral<"aes-256-gcm">;
            keyId: z.ZodString;
            kmsKeyId: z.ZodString;
            kmsRegion: z.ZodString;
            encryptedDataKeyBase64: z.ZodString;
            ivBase64: z.ZodString;
            authTagBase64: z.ZodString;
            ciphertextBase64: z.ZodString;
        }, z.core.$strip>], "brokerKind">>>;
        lastMaterializationLeaseId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        activeRunGraceIssuedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const credentialIdParamsSchema: z.ZodObject<{
    credentialId: z.ZodString;
}, z.core.$strip>;
export type StoredCredentialRecord = z.infer<typeof storedCredentialRecordSchema>;
export type CredentialsState = z.infer<typeof credentialsStateSchema>;
export interface CredentialsRepository {
    init(): Promise<void>;
    list(): StoredCredentialRecord[];
    getById(credentialId: string): StoredCredentialRecord | null;
    save(record: StoredCredentialRecord): Promise<StoredCredentialRecord>;
}
export declare abstract class CachedCredentialsRepository implements CredentialsRepository {
    #private;
    init(): Promise<void>;
    list(): {
        credentialId: string;
        workspaceId: string;
        ownerUserId: string | null;
        scope: "user" | "workspace";
        displayName: string;
        provider: string;
        secretKind: "api-key" | "access-token" | "oauth-token" | "json-file" | "browser-storage-state" | "session-cookie";
        mountMode: "file" | "env";
        status: "revoked" | "active" | "disabled" | "needs-rotation";
        brokerKind: "local-envelope" | "vault-transit-http" | "aws-kms-envelope" | null;
        activeKeyId: string | null;
        secretVersion: number;
        expiresAt: string | null;
        lastRotatedAt: string | null;
        lastMaterializedAt: string | null;
        rotationDueAt: string | null;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
        envName: string | null;
        mountPathTemplate: string | null;
        secretRef: string | null;
        secretEnvelope: {
            version: 1;
            brokerKind: "local-envelope";
            algorithm: "aes-256-gcm";
            keyId: string;
            ivBase64: string;
            authTagBase64: string;
            ciphertextBase64: string;
        } | {
            version: 1;
            brokerKind: "vault-transit-http";
            algorithm: "vault-transit";
            keyId: string;
            ciphertext: string;
        } | {
            version: 1;
            brokerKind: "aws-kms-envelope";
            algorithm: "aes-256-gcm";
            keyId: string;
            kmsKeyId: string;
            kmsRegion: string;
            encryptedDataKeyBase64: string;
            ivBase64: string;
            authTagBase64: string;
            ciphertextBase64: string;
        } | null;
        lastMaterializationLeaseId: string | null;
        activeRunGraceIssuedAt: string | null;
        redactedSecretRef?: string | null | undefined;
    }[];
    getById(credentialId: string): {
        credentialId: string;
        workspaceId: string;
        ownerUserId: string | null;
        scope: "user" | "workspace";
        displayName: string;
        provider: string;
        secretKind: "api-key" | "access-token" | "oauth-token" | "json-file" | "browser-storage-state" | "session-cookie";
        mountMode: "file" | "env";
        status: "revoked" | "active" | "disabled" | "needs-rotation";
        brokerKind: "local-envelope" | "vault-transit-http" | "aws-kms-envelope" | null;
        activeKeyId: string | null;
        secretVersion: number;
        expiresAt: string | null;
        lastRotatedAt: string | null;
        lastMaterializedAt: string | null;
        rotationDueAt: string | null;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
        envName: string | null;
        mountPathTemplate: string | null;
        secretRef: string | null;
        secretEnvelope: {
            version: 1;
            brokerKind: "local-envelope";
            algorithm: "aes-256-gcm";
            keyId: string;
            ivBase64: string;
            authTagBase64: string;
            ciphertextBase64: string;
        } | {
            version: 1;
            brokerKind: "vault-transit-http";
            algorithm: "vault-transit";
            keyId: string;
            ciphertext: string;
        } | {
            version: 1;
            brokerKind: "aws-kms-envelope";
            algorithm: "aes-256-gcm";
            keyId: string;
            kmsKeyId: string;
            kmsRegion: string;
            encryptedDataKeyBase64: string;
            ivBase64: string;
            authTagBase64: string;
            ciphertextBase64: string;
        } | null;
        lastMaterializationLeaseId: string | null;
        activeRunGraceIssuedAt: string | null;
        redactedSecretRef?: string | null | undefined;
    } | null;
    save(record: StoredCredentialRecord): Promise<{
        credentialId: string;
        workspaceId: string;
        ownerUserId: string | null;
        scope: "user" | "workspace";
        displayName: string;
        provider: string;
        secretKind: "api-key" | "access-token" | "oauth-token" | "json-file" | "browser-storage-state" | "session-cookie";
        mountMode: "file" | "env";
        status: "revoked" | "active" | "disabled" | "needs-rotation";
        brokerKind: "local-envelope" | "vault-transit-http" | "aws-kms-envelope" | null;
        activeKeyId: string | null;
        secretVersion: number;
        expiresAt: string | null;
        lastRotatedAt: string | null;
        lastMaterializedAt: string | null;
        rotationDueAt: string | null;
        notes: string | null;
        createdAt: string;
        updatedAt: string;
        envName: string | null;
        mountPathTemplate: string | null;
        secretRef: string | null;
        secretEnvelope: {
            version: 1;
            brokerKind: "local-envelope";
            algorithm: "aes-256-gcm";
            keyId: string;
            ivBase64: string;
            authTagBase64: string;
            ciphertextBase64: string;
        } | {
            version: 1;
            brokerKind: "vault-transit-http";
            algorithm: "vault-transit";
            keyId: string;
            ciphertext: string;
        } | {
            version: 1;
            brokerKind: "aws-kms-envelope";
            algorithm: "aes-256-gcm";
            keyId: string;
            kmsKeyId: string;
            kmsRegion: string;
            encryptedDataKeyBase64: string;
            ivBase64: string;
            authTagBase64: string;
            ciphertextBase64: string;
        } | null;
        lastMaterializationLeaseId: string | null;
        activeRunGraceIssuedAt: string | null;
        redactedSecretRef?: string | null | undefined;
    }>;
    protected replaceState(state: CredentialsState): Promise<void>;
    protected getState(): {
        credentials: {
            credentialId: string;
            workspaceId: string;
            ownerUserId: string | null;
            scope: "user" | "workspace";
            displayName: string;
            provider: string;
            secretKind: "api-key" | "access-token" | "oauth-token" | "json-file" | "browser-storage-state" | "session-cookie";
            mountMode: "file" | "env";
            status: "revoked" | "active" | "disabled" | "needs-rotation";
            brokerKind: "local-envelope" | "vault-transit-http" | "aws-kms-envelope" | null;
            activeKeyId: string | null;
            secretVersion: number;
            expiresAt: string | null;
            lastRotatedAt: string | null;
            lastMaterializedAt: string | null;
            rotationDueAt: string | null;
            notes: string | null;
            createdAt: string;
            updatedAt: string;
            envName: string | null;
            mountPathTemplate: string | null;
            secretRef: string | null;
            secretEnvelope: {
                version: 1;
                brokerKind: "local-envelope";
                algorithm: "aes-256-gcm";
                keyId: string;
                ivBase64: string;
                authTagBase64: string;
                ciphertextBase64: string;
            } | {
                version: 1;
                brokerKind: "vault-transit-http";
                algorithm: "vault-transit";
                keyId: string;
                ciphertext: string;
            } | {
                version: 1;
                brokerKind: "aws-kms-envelope";
                algorithm: "aes-256-gcm";
                keyId: string;
                kmsKeyId: string;
                kmsRegion: string;
                encryptedDataKeyBase64: string;
                ivBase64: string;
                authTagBase64: string;
                ciphertextBase64: string;
            } | null;
            lastMaterializationLeaseId: string | null;
            activeRunGraceIssuedAt: string | null;
            redactedSecretRef?: string | null | undefined;
        }[];
    };
    protected updateState(mutator: (state: CredentialsState) => CredentialsState): Promise<void>;
    protected abstract loadState(): Promise<CredentialsState>;
    protected abstract writeState(state: CredentialsState): Promise<void>;
}
export interface PostgresCredentialsRepositoryOptions extends PostgresRepositoryOptions {
    withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}
export declare class PostgresCredentialsRepository extends CachedCredentialsRepository {
    #private;
    constructor(options: PostgresCredentialsRepositoryOptions);
    protected loadState(): Promise<{
        credentials: {
            credentialId: string;
            workspaceId: string;
            ownerUserId: string | null;
            scope: "user" | "workspace";
            displayName: string;
            provider: string;
            secretKind: "api-key" | "access-token" | "oauth-token" | "json-file" | "browser-storage-state" | "session-cookie";
            mountMode: "file" | "env";
            status: "revoked" | "active" | "disabled" | "needs-rotation";
            brokerKind: "local-envelope" | "vault-transit-http" | "aws-kms-envelope" | null;
            activeKeyId: string | null;
            secretVersion: number;
            expiresAt: string | null;
            lastRotatedAt: string | null;
            lastMaterializedAt: string | null;
            rotationDueAt: string | null;
            notes: string | null;
            createdAt: string;
            updatedAt: string;
            envName: string | null;
            mountPathTemplate: string | null;
            secretRef: string | null;
            secretEnvelope: {
                version: 1;
                brokerKind: "local-envelope";
                algorithm: "aes-256-gcm";
                keyId: string;
                ivBase64: string;
                authTagBase64: string;
                ciphertextBase64: string;
            } | {
                version: 1;
                brokerKind: "vault-transit-http";
                algorithm: "vault-transit";
                keyId: string;
                ciphertext: string;
            } | {
                version: 1;
                brokerKind: "aws-kms-envelope";
                algorithm: "aes-256-gcm";
                keyId: string;
                kmsKeyId: string;
                kmsRegion: string;
                encryptedDataKeyBase64: string;
                ivBase64: string;
                authTagBase64: string;
                ciphertextBase64: string;
            } | null;
            lastMaterializationLeaseId: string | null;
            activeRunGraceIssuedAt: string | null;
            redactedSecretRef?: string | null | undefined;
        }[];
    }>;
    protected writeState(state: CredentialsState): Promise<void>;
}
//# sourceMappingURL=credentials-repository.d.ts.map