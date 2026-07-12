import { type CredentialMount, type McpBinding, type McpBindingRecord, type McpNetworkPolicy, type McpRegistryEntry, type McpStdioPolicy } from "@lingban/contracts";
export declare function slugifyMcpKey(value: string): string;
export declare function buildMcpAuthDescriptor(mount: CredentialMount | null): {
    readonly authMode: null;
    readonly authRef: null;
} | {
    authMode: "env";
    authRef: string;
} | {
    authMode: "file";
    authRef: string;
};
export declare function buildRuntimeMcpBinding(input: {
    entry: Pick<McpRegistryEntry, "mcpId" | "displayName" | "source" | "transport" | "ref" | "stdioPolicy" | "riskLevel" | "defaultNetworkPolicyRef" | "approvalRequired">;
    persistedBinding?: Pick<McpBindingRecord, "bindingId" | "credentialId" | "networkPolicyRef" | "approvalRequired"> | null;
    mount?: CredentialMount | null;
}): McpBinding;
export declare function isPrivateNetworkHostname(hostname: string): boolean;
export declare function matchesMcpNetworkHostPattern(hostname: string, pattern: string): boolean;
export declare function assertMcpNetworkPolicyShape(policy: McpNetworkPolicy): {
    policyRef: string;
    workspaceId: string | null;
    displayName: string;
    description: string | null;
    status: "active" | "disabled";
    mode: "allowlist";
    allowedProtocols: ("http" | "ws" | "https" | "wss")[];
    allowedHostPatterns: string[];
    allowedPorts: number[];
    allowedPathPrefixes: string[];
    requireTls: boolean;
    blockPrivateNetwork: boolean;
    tags: string[];
    createdAt: string;
    updatedAt: string;
};
export type McpStdioPathAllowlistEvaluation = {
    allowed: true;
} | {
    allowed: false;
    reasonCode: "STDIO_ALLOWLIST_INVALID" | "STDIO_REF_INVALID" | "STDIO_NOT_ALLOWED" | "STDIO_PATH_NOT_ALLOWED";
    message: string;
};
export declare function evaluateMcpStdioPathAllowlist(input: {
    targetPath: string;
    allowedPathPrefixes: string[];
}): McpStdioPathAllowlistEvaluation;
export type McpStdioIntegrityEvaluation = {
    allowed: true;
} | {
    allowed: false;
    reasonCode: "STDIO_REF_INVALID" | "STDIO_TARGET_NOT_FOUND" | "STDIO_TARGET_NOT_FILE" | "STDIO_DIGEST_MISMATCH";
    message: string;
};
export declare function evaluateMcpStdioIntegrity(input: {
    targetPath: string;
    policy: McpStdioPolicy | null | undefined;
    readFileImpl?: (targetPath: string) => Promise<Uint8Array>;
    statImpl?: (targetPath: string) => Promise<{
        isFile(): boolean;
    }>;
}): Promise<McpStdioIntegrityEvaluation>;
export type McpNetworkPolicyEvaluation = {
    allowed: true;
} | {
    allowed: false;
    reasonCode: "POLICY_INVALID" | "INVALID_URL" | "PROTOCOL_NOT_ALLOWED" | "TLS_REQUIRED" | "HOST_NOT_ALLOWED" | "PRIVATE_NETWORK_BLOCKED" | "PORT_NOT_ALLOWED" | "PATH_NOT_ALLOWED";
    message: string;
};
export declare function evaluateMcpNetworkPolicy(input: {
    policy: McpNetworkPolicy;
    targetUrl: string;
}): McpNetworkPolicyEvaluation;
export type RuntimeMcpBindingPolicyIssue = {
    bindingId: string;
    mcpId: string;
    networkPolicyRef: string | null;
    reasonCode: "STDIO_ALLOWLIST_INVALID" | "STDIO_REF_INVALID" | "STDIO_NOT_ALLOWED" | "STDIO_PATH_NOT_ALLOWED" | "POLICY_REQUIRED" | "POLICY_NOT_FOUND" | "POLICY_DISABLED" | "POLICY_INVALID" | "INVALID_URL" | "PROTOCOL_NOT_ALLOWED" | "TLS_REQUIRED" | "HOST_NOT_ALLOWED" | "PRIVATE_NETWORK_BLOCKED" | "PORT_NOT_ALLOWED" | "PATH_NOT_ALLOWED";
    message: string;
};
export type RuntimeMcpBindingStdioIntegrityIssue = {
    bindingId: string;
    mcpId: string;
    reasonCode: "STDIO_REF_INVALID" | "STDIO_TARGET_NOT_FOUND" | "STDIO_TARGET_NOT_FILE" | "STDIO_DIGEST_MISMATCH";
    message: string;
};
export declare function validateRuntimeMcpBindings(input: {
    bindings: McpBinding[];
    policies: McpNetworkPolicy[];
    stdioAllowedPathPrefixes?: string[];
}): RuntimeMcpBindingPolicyIssue[];
export declare function assertRuntimeMcpBindings(input: {
    bindings: McpBinding[];
    policies: McpNetworkPolicy[];
    stdioAllowedPathPrefixes?: string[];
}): void;
export declare function assertRuntimeMcpBindingStdioIntegrity(input: {
    bindings: McpBinding[];
    readFileImpl?: (targetPath: string) => Promise<Uint8Array>;
    statImpl?: (targetPath: string) => Promise<{
        isFile(): boolean;
    }>;
}): Promise<void>;
//# sourceMappingURL=index.d.ts.map