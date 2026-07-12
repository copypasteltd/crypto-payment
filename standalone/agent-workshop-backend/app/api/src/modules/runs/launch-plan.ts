import {
  startRunJobPayloadSchema,
  type CreateRunBinding,
  type CredentialDetail,
  type CredentialMount,
  type McpBindingRecord,
  type McpNetworkPolicy,
  type McpRegistryEntry,
  type RunRecord,
  type StartRunJobPayload,
} from "@lingban/contracts";
import {
  buildCredentialMount,
  buildCredentialMountFromRecord,
  slugifyCredentialKey,
} from "@lingban/credential";
import { buildRuntimeMcpBinding, slugifyMcpKey } from "@lingban/mcp";

type LegacyMcpEntry = Pick<
  McpRegistryEntry,
  | "mcpId"
  | "displayName"
  | "source"
  | "transport"
  | "ref"
  | "stdioPolicy"
  | "riskLevel"
  | "defaultCredentialId"
  | "defaultNetworkPolicyRef"
  | "approvalRequired"
>;

const firstPartyMcpCatalog: Record<string, LegacyMcpEntry> = {
  "mcp.browser.playwright": {
    mcpId: "mcp.browser.playwright",
    displayName: "Playwright Browser",
    source: "first-party",
    transport: "stdio",
    ref: "/workspace/mcp/playwright-browser-helper.js",
    stdioPolicy: null,
    riskLevel: "high",
    defaultCredentialId: "cred_browser_storage_state",
    defaultNetworkPolicyRef: "np_browser_playwright",
    approvalRequired: true,
  },
  "mcp.image.gpt-image-2": {
    mcpId: "mcp.image.gpt-image-2",
    displayName: "GPT Image 2",
    source: "first-party",
    transport: "stdio",
    ref: "/workspace/mcp/imagegen-helper.js",
    stdioPolicy: null,
    riskLevel: "medium",
    defaultCredentialId: "cred_openai_image_api_key",
    defaultNetworkPolicyRef: "np_image_gpt_image_2",
    approvalRequired: false,
  },
};

const externalConnectorCatalog: Record<string, LegacyMcpEntry> = {
  "workspace:seedance-api": {
    mcpId: "workspace:seedance-api",
    displayName: "Seedance Workspace Connector",
    source: "workspace-managed",
    transport: "http",
    ref: "https://mcp.workspace.internal/seedance",
    stdioPolicy: null,
    riskLevel: "medium",
    defaultCredentialId: "cred_seedance_api_key",
    defaultNetworkPolicyRef: "np_seedance_workspace",
    approvalRequired: false,
  },
  "workspace:notion-sse": {
    mcpId: "workspace:notion-sse",
    displayName: "Notion Workspace Connector",
    source: "workspace-managed",
    transport: "sse",
    ref: "https://mcp.workspace.internal/notion/sse",
    stdioPolicy: null,
    riskLevel: "medium",
    defaultCredentialId: "cred_workspace_notion_token",
    defaultNetworkPolicyRef: "np_notion_workspace",
    approvalRequired: false,
  },
  "third-party:figma-mcp": {
    mcpId: "third-party:figma-mcp",
    displayName: "Figma MCP",
    source: "third-party",
    transport: "sse",
    ref: "https://third-party-mcp.example.org/figma/sse",
    stdioPolicy: null,
    riskLevel: "high",
    defaultCredentialId: "cred_figma_pat",
    defaultNetworkPolicyRef: "np_figma_external",
    approvalRequired: true,
  },
  "third-party:asset-library": {
    mcpId: "third-party:asset-library",
    displayName: "Asset Library MCP",
    source: "third-party",
    transport: "http",
    ref: "https://third-party-mcp.example.org/assets",
    stdioPolicy: null,
    riskLevel: "high",
    defaultCredentialId: "cred_asset_library_api_key",
    defaultNetworkPolicyRef: "np_asset_library_external",
    approvalRequired: true,
  },
};

function inferLegacyCredentialSecretKind(
  credentialId: string
): CredentialDetail["secretKind"] {
  const slug = slugifyCredentialKey(credentialId);

  if (slug.includes("storage-state") || slug.includes("browser")) {
    return "browser-storage-state";
  }

  if (slug.includes("cookie") || slug.includes("session")) {
    return "session-cookie";
  }

  if (slug.includes("oauth")) {
    return "oauth-token";
  }

  if (slug.includes("json")) {
    return "json-file";
  }

  return "api-key";
}

function resolveCredentialMount(
  credentialId: string,
  credentialsById: Map<string, CredentialDetail>
): CredentialMount {
  const known = credentialsById.get(credentialId);
  if (known) {
    return buildCredentialMountFromRecord(known);
  }

  return buildCredentialMount({
    credentialId,
    secretKind: inferLegacyCredentialSecretKind(credentialId),
  });
}

function findCredentialMount(
  credentialId: string | null | undefined,
  mountsById: Map<string, CredentialMount>
) {
  if (!credentialId) {
    return null;
  }

  return mountsById.get(credentialId) ?? null;
}

function inferExternalEntry(ref: string): LegacyMcpEntry {
  const known = externalConnectorCatalog[ref];
  if (known) {
    return known;
  }

  const slug = slugifyMcpKey(ref);
  if (ref.startsWith("workspace:")) {
    return {
      mcpId: ref,
      displayName: ref,
      source: "workspace-managed",
      transport: "http",
      ref: `https://mcp.workspace.internal/${slug}`,
      stdioPolicy: null,
      riskLevel: "medium",
      defaultCredentialId: null,
      defaultNetworkPolicyRef: `np_${slug}`,
      approvalRequired: false,
    };
  }

  return {
    mcpId: ref,
    displayName: ref,
    source: "third-party",
    transport: ref.includes("ws") ? "websocket" : ref.includes("sse") ? "sse" : "http",
    ref: `https://third-party-mcp.example.org/${slug}`,
    stdioPolicy: null,
    riskLevel: "high",
    defaultCredentialId: null,
    defaultNetworkPolicyRef: `np_${slug}`,
    approvalRequired: true,
  };
}

function resolvePreferredCredentialId(
  ref: string,
  bindings: CreateRunBinding,
  entryDefaultCredentialId: string | null | undefined,
  persistedBinding: McpBindingRecord | undefined
) {
  return (
    persistedBinding?.credentialId ??
    entryDefaultCredentialId ??
    bindings.credentialIds.find((credentialId) =>
      slugifyCredentialKey(credentialId).includes(slugifyMcpKey(ref))
    ) ??
    null
  );
}

function resolveMcpBindings(input: {
  bindings: CreateRunBinding;
  mountsById: Map<string, CredentialMount>;
  registryEntries: McpRegistryEntry[];
  bindingRecords: McpBindingRecord[];
}) {
  const resolved = [];
  const registryEntryById = new Map(input.registryEntries.map((entry) => [entry.mcpId, entry]));
  const bindingByMcpId = new Map(input.bindingRecords.map((binding) => [binding.mcpId, binding]));

  for (const mcpId of input.bindings.firstPartyMcpIds) {
    const entry = registryEntryById.get(mcpId) ??
      firstPartyMcpCatalog[mcpId] ?? {
        mcpId,
        displayName: mcpId,
        source: "first-party" as const,
        transport: "stdio" as const,
        ref: `/workspace/mcp/${slugifyMcpKey(mcpId)}.js`,
        stdioPolicy: null,
        riskLevel: "medium" as const,
        defaultCredentialId: null,
        defaultNetworkPolicyRef: `np_${slugifyMcpKey(mcpId)}`,
        approvalRequired: false,
      };
    const persistedBinding = bindingByMcpId.get(mcpId);
    const mount = findCredentialMount(
      resolvePreferredCredentialId(
        mcpId,
        input.bindings,
        entry.defaultCredentialId,
        persistedBinding
      ),
      input.mountsById
    );

    resolved.push(
      buildRuntimeMcpBinding({
        entry,
        persistedBinding,
        mount,
      })
    );
  }

  for (const connectorRef of input.bindings.externalConnectorRefs) {
    const entry = registryEntryById.get(connectorRef) ?? inferExternalEntry(connectorRef);
    const persistedBinding = bindingByMcpId.get(connectorRef);
    const mount = findCredentialMount(
      resolvePreferredCredentialId(
        connectorRef,
        input.bindings,
        entry.defaultCredentialId,
        persistedBinding
      ),
      input.mountsById
    );

    resolved.push(
      buildRuntimeMcpBinding({
        entry,
        persistedBinding,
        mount,
      })
    );
  }

  return resolved;
}

export function buildStartRunJobPayload(params: {
  run: RunRecord;
  initialPrompt: string;
  requestedInitialMessage: string | null;
  bindings: CreateRunBinding;
  credentials?: CredentialDetail[];
  registryEntries?: McpRegistryEntry[];
  bindingRecords?: McpBindingRecord[];
  networkPolicies?: McpNetworkPolicy[];
}): StartRunJobPayload {
  const credentialIds = Array.from(new Set<string>(params.bindings.credentialIds));
  const credentialsById = new Map(
    (params.credentials ?? []).map((credential) => [credential.credentialId, credential])
  );
  const mounts = credentialIds.map((credentialId) =>
    resolveCredentialMount(credentialId, credentialsById)
  );
  const mountsById = new Map(mounts.map((mount) => [mount.credentialId, mount]));
  const mcpBindings = resolveMcpBindings({
    bindings: params.bindings,
    mountsById,
    registryEntries: params.registryEntries ?? [],
    bindingRecords: params.bindingRecords ?? [],
  });

  return startRunJobPayloadSchema.parse({
    run: params.run,
    initialPrompt: params.initialPrompt,
    requestedInitialMessage: params.requestedInitialMessage,
    bindings: params.bindings,
    credentialMounts: mounts,
    mcpBindings,
    mcpNetworkPolicies: params.networkPolicies ?? [],
  });
}
