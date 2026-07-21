import {
  credentialMountSchema,
  type CredentialDetail,
  type CredentialMount,
  type CredentialSecretKind,
} from "@lingban/contracts";

export function slugifyCredentialKey(value: string) {
  return value
    .replace(/^cred_/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function toCredentialEnvName(credentialId: string) {
  return `LB_${slugifyCredentialKey(credentialId).replace(/-/g, "_").toUpperCase()}`;
}

export function inferCredentialMountMode(
  secretKind: CredentialSecretKind
): CredentialDetail["mountMode"] {
  switch (secretKind) {
    case "json-file":
    case "browser-storage-state":
    case "session-cookie":
      return "file";
    default:
      return "env";
  }
}

export function inferCredentialSecretFolder(secretKind: CredentialSecretKind) {
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

function inferCredentialFileExtension(secretKind: CredentialSecretKind) {
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

function applyMountPathTemplate(template: string, credentialId: string) {
  const slug = slugifyCredentialKey(credentialId);
  return template
    .replaceAll("{credentialId}", credentialId)
    .replaceAll("{slug}", slug);
}

export function buildCredentialMount(input: {
  credentialId: string;
  secretKind: CredentialSecretKind;
  mountMode?: CredentialDetail["mountMode"] | null;
  envName?: string | null;
  mountPathTemplate?: string | null;
}): CredentialMount {
  const mountMode = input.mountMode ?? inferCredentialMountMode(input.secretKind);

  if (mountMode === "env") {
    return credentialMountSchema.parse({
      credentialId: input.credentialId,
      mode: "env",
      envName: input.envName ?? toCredentialEnvName(input.credentialId),
      readOnly: true,
    });
  }

  const defaultMountPath = `/workspace/secrets/${inferCredentialSecretFolder(
    input.secretKind
  )}/${slugifyCredentialKey(input.credentialId)}.${inferCredentialFileExtension(input.secretKind)}`;

  return credentialMountSchema.parse({
    credentialId: input.credentialId,
    mode: "file",
    mountPath: input.mountPathTemplate
      ? applyMountPathTemplate(input.mountPathTemplate, input.credentialId)
      : defaultMountPath,
    readOnly: true,
  });
}

export function buildCredentialMountFromRecord(record: Pick<
  CredentialDetail,
  "credentialId" | "secretKind" | "mountMode" | "envName" | "mountPathTemplate"
>) {
  return buildCredentialMount({
    credentialId: record.credentialId,
    secretKind: record.secretKind,
    mountMode: record.mountMode,
    envName: record.envName,
    mountPathTemplate: record.mountPathTemplate,
  });
}

export function redactSecretRef(secretRef: string | null | undefined) {
  if (!secretRef) {
    return null;
  }

  const trimmed = secretRef.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***`;
  }

  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}
