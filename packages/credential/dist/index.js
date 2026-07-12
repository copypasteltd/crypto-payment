import { credentialMountSchema, } from "@lingban/contracts";
export function slugifyCredentialKey(value) {
    return value
        .replace(/^cred_/, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}
export function toCredentialEnvName(credentialId) {
    return `LB_${slugifyCredentialKey(credentialId).replace(/-/g, "_").toUpperCase()}`;
}
export function inferCredentialMountMode(secretKind) {
    switch (secretKind) {
        case "json-file":
        case "browser-storage-state":
        case "session-cookie":
            return "file";
        default:
            return "env";
    }
}
export function inferCredentialSecretFolder(secretKind) {
    switch (secretKind) {
        case "browser-storage-state":
            return "browser";
        case "session-cookie":
            return "session";
        case "oauth-token":
            return "oauth";
        case "json-file":
            return "mcp";
        default:
            return "api";
    }
}
function inferCredentialFileExtension(secretKind) {
    switch (secretKind) {
        case "json-file":
        case "browser-storage-state":
            return "json";
        case "session-cookie":
            return "txt";
        default:
            return "secret";
    }
}
function applyMountPathTemplate(template, credentialId) {
    const slug = slugifyCredentialKey(credentialId);
    return template
        .replaceAll("{credentialId}", credentialId)
        .replaceAll("{slug}", slug);
}
export function buildCredentialMount(input) {
    const mountMode = input.mountMode ?? inferCredentialMountMode(input.secretKind);
    if (mountMode === "env") {
        return credentialMountSchema.parse({
            credentialId: input.credentialId,
            mode: "env",
            envName: input.envName ?? toCredentialEnvName(input.credentialId),
            readOnly: true,
        });
    }
    const defaultMountPath = `/workspace/secrets/${inferCredentialSecretFolder(input.secretKind)}/${slugifyCredentialKey(input.credentialId)}.${inferCredentialFileExtension(input.secretKind)}`;
    return credentialMountSchema.parse({
        credentialId: input.credentialId,
        mode: "file",
        mountPath: input.mountPathTemplate
            ? applyMountPathTemplate(input.mountPathTemplate, input.credentialId)
            : defaultMountPath,
        readOnly: true,
    });
}
export function buildCredentialMountFromRecord(record) {
    return buildCredentialMount({
        credentialId: record.credentialId,
        secretKind: record.secretKind,
        mountMode: record.mountMode,
        envName: record.envName,
        mountPathTemplate: record.mountPathTemplate,
    });
}
export function redactSecretRef(secretRef) {
    if (!secretRef) {
        return null;
    }
    const trimmed = secretRef.trim();
    if (trimmed.length <= 8) {
        return `${trimmed.slice(0, 2)}***`;
    }
    return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}
//# sourceMappingURL=index.js.map