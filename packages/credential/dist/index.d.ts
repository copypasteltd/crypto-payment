import { type CredentialDetail, type CredentialMount, type CredentialSecretKind } from "@lingban/contracts";
export declare function slugifyCredentialKey(value: string): string;
export declare function toCredentialEnvName(credentialId: string): string;
export declare function inferCredentialMountMode(secretKind: CredentialSecretKind): CredentialDetail["mountMode"];
export declare function inferCredentialSecretFolder(secretKind: CredentialSecretKind): "browser" | "session" | "oauth" | "mcp" | "api";
export declare function buildCredentialMount(input: {
    credentialId: string;
    secretKind: CredentialSecretKind;
    mountMode?: CredentialDetail["mountMode"] | null;
    envName?: string | null;
    mountPathTemplate?: string | null;
}): CredentialMount;
export declare function buildCredentialMountFromRecord(record: Pick<CredentialDetail, "credentialId" | "secretKind" | "mountMode" | "envName" | "mountPathTemplate">): {
    credentialId: string;
    mode: "env";
    envName: string;
    readOnly: true;
} | {
    credentialId: string;
    mode: "file";
    mountPath: string;
    readOnly: true;
};
export declare function redactSecretRef(secretRef: string | null | undefined): string | null;
//# sourceMappingURL=index.d.ts.map