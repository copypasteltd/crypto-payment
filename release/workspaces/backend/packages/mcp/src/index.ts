import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isIP } from "node:net";
import {
  mcpBindingSchema,
  mcpNetworkPolicySchema,
  type CredentialMount,
  type McpBinding,
  type McpBindingRecord,
  type McpNetworkPolicy,
  type McpRegistryEntry,
  type McpStdioPolicy,
} from "@lingban/contracts";

export function slugifyMcpKey(value: string) {
  return value
    .replace(/^mcp\./, "")
    .replace(/^(workspace:|third-party:)/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function buildMcpAuthDescriptor(mount: CredentialMount | null) {
  if (!mount) {
    return {
      authMode: null,
      authRef: null,
    } as const;
  }

  if (mount.mode === "env") {
    return {
      authMode: "env" as const,
      authRef: mount.envName,
    };
  }

  return {
    authMode: "file" as const,
    authRef: mount.mountPath,
  };
}

export function buildRuntimeMcpBinding(input: {
  entry: Pick<
    McpRegistryEntry,
    | "mcpId"
    | "displayName"
    | "source"
    | "transport"
    | "ref"
    | "stdioPolicy"
    | "riskLevel"
    | "defaultNetworkPolicyRef"
    | "approvalRequired"
  >;
  persistedBinding?: Pick<
    McpBindingRecord,
    "bindingId" | "credentialId" | "networkPolicyRef" | "approvalRequired"
  > | null;
  mount?: CredentialMount | null;
}): McpBinding {
  const auth = buildMcpAuthDescriptor(input.mount ?? null);

  return mcpBindingSchema.parse({
    bindingId:
      input.persistedBinding?.bindingId ?? `mbd_${slugifyMcpKey(input.entry.mcpId)}`,
    mcpId: input.entry.mcpId,
    displayName: input.entry.displayName,
    source: input.entry.source,
    transport: input.entry.transport,
    ref: input.entry.ref,
    stdioPolicy: input.entry.stdioPolicy ?? null,
    riskLevel: input.entry.riskLevel,
    credentialId: input.mount?.credentialId ?? input.persistedBinding?.credentialId ?? null,
    authMode: auth.authMode,
    authRef: auth.authRef,
    networkPolicyRef:
      input.persistedBinding?.networkPolicyRef ??
      input.entry.defaultNetworkPolicyRef ??
      null,
    approvalRequired:
      input.persistedBinding?.approvalRequired ?? input.entry.approvalRequired,
  });
}

const insecureProtocols = new Set(["http", "ws"]);

function normalizeHostnamePattern(pattern: string) {
  return pattern.trim().toLowerCase();
}

function isValidHostnamePattern(pattern: string) {
  if (!pattern || pattern === "*") {
    return false;
  }

  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(suffix);
  }

  return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i.test(pattern);
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((value) => Number.parseInt(value, 10));
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }

  if (parts[0] === 10) {
    return true;
  }

  if (parts[0] === 127) {
    return true;
  }

  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }

  return false;
}

function isPrivateIpv6(hostname: string) {
  const value = hostname.toLowerCase();
  return (
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb")
  );
}

export function isPrivateNetworkHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return isPrivateIpv4(normalized);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(normalized);
  }

  return false;
}

export function matchesMcpNetworkHostPattern(hostname: string, pattern: string) {
  const normalizedHostname = hostname.trim().toLowerCase();
  const normalizedPattern = normalizeHostnamePattern(pattern);
  if (!normalizedHostname || !normalizedPattern) {
    return false;
  }

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(1);
    return (
      normalizedHostname.endsWith(suffix) &&
      normalizedHostname.length > suffix.length
    );
  }

  return normalizedHostname === normalizedPattern;
}

function matchesPathPrefix(pathname: string, prefix: string) {
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) {
    return false;
  }

  if (normalizedPrefix === "/") {
    return true;
  }

  return (
    pathname === normalizedPrefix ||
    pathname.startsWith(
      normalizedPrefix.endsWith("/") ? normalizedPrefix : `${normalizedPrefix}/`
    )
  );
}

export function assertMcpNetworkPolicyShape(policy: McpNetworkPolicy) {
  const parsed = mcpNetworkPolicySchema.parse(policy);

  if (parsed.requireTls && parsed.allowedProtocols.some((item) => insecureProtocols.has(item))) {
    throw new Error(
      `Network policy ${parsed.policyRef} requires TLS and cannot allow insecure protocols`
    );
  }

  for (const pattern of parsed.allowedHostPatterns) {
    if (!isValidHostnamePattern(normalizeHostnamePattern(pattern))) {
      throw new Error(
        `Network policy ${parsed.policyRef} contains an invalid host pattern: ${pattern}`
      );
    }
  }

  for (const prefix of parsed.allowedPathPrefixes) {
    if (!prefix.startsWith("/")) {
      throw new Error(
        `Network policy ${parsed.policyRef} must use absolute path prefixes`
      );
    }
  }

  return parsed;
}

function normalizeFilesystemPathForComparison(value: string) {
  const normalized = value.replace(/\\/g, "/");
  const caseInsensitive =
    path.win32.isAbsolute(value) || /^[a-zA-Z]:\//.test(normalized) || normalized.startsWith("//");
  const next =
    normalized.length > 1 ? normalized.replace(/\/+$/g, "") : normalized;
  return caseInsensitive ? next.toLowerCase() : next;
}

function isAbsoluteFilesystemPath(value: string) {
  return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

function matchesFilesystemPathPrefix(targetPath: string, prefix: string) {
  const normalizedTarget = normalizeFilesystemPathForComparison(targetPath);
  const normalizedPrefix = normalizeFilesystemPathForComparison(prefix);
  if (!normalizedTarget || !normalizedPrefix) {
    return false;
  }

  return (
    normalizedTarget === normalizedPrefix ||
    normalizedTarget.startsWith(
      normalizedPrefix.endsWith("/") ? normalizedPrefix : `${normalizedPrefix}/`
    )
  );
}

export type McpStdioPathAllowlistEvaluation =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reasonCode:
        | "STDIO_ALLOWLIST_INVALID"
        | "STDIO_REF_INVALID"
        | "STDIO_NOT_ALLOWED"
        | "STDIO_PATH_NOT_ALLOWED";
      message: string;
    };

export function evaluateMcpStdioPathAllowlist(input: {
  targetPath: string;
  allowedPathPrefixes: string[];
}): McpStdioPathAllowlistEvaluation {
  if (!isAbsoluteFilesystemPath(input.targetPath)) {
    return {
      allowed: false,
      reasonCode: "STDIO_REF_INVALID",
      message: `stdio MCP target must use an absolute filesystem path: ${input.targetPath}`,
    };
  }

  for (const prefix of input.allowedPathPrefixes) {
    if (!isAbsoluteFilesystemPath(prefix)) {
      return {
        allowed: false,
        reasonCode: "STDIO_ALLOWLIST_INVALID",
        message: `stdio allowlist prefix must be an absolute path: ${prefix}`,
      };
    }
  }

  if (input.allowedPathPrefixes.length === 0) {
    return {
      allowed: false,
      reasonCode: "STDIO_NOT_ALLOWED",
      message: "stdio MCP execution is disabled because no allowlist prefixes are configured",
    };
  }

  if (
    !input.allowedPathPrefixes.some((prefix) =>
      matchesFilesystemPathPrefix(input.targetPath, prefix)
    )
  ) {
    return {
      allowed: false,
      reasonCode: "STDIO_PATH_NOT_ALLOWED",
      message: `stdio MCP target is outside the configured allowlist prefixes: ${input.targetPath}`,
    };
  }

  return {
    allowed: true,
  };
}

function normalizeSha256Hex(value: string) {
  return value.trim().toLowerCase();
}

export type McpStdioIntegrityEvaluation =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reasonCode:
        | "STDIO_REF_INVALID"
        | "STDIO_TARGET_NOT_FOUND"
        | "STDIO_TARGET_NOT_FILE"
        | "STDIO_DIGEST_MISMATCH";
      message: string;
    };

export async function evaluateMcpStdioIntegrity(input: {
  targetPath: string;
  policy: McpStdioPolicy | null | undefined;
  readFileImpl?: (targetPath: string) => Promise<Uint8Array>;
  statImpl?: (targetPath: string) => Promise<{ isFile(): boolean }>;
}): Promise<McpStdioIntegrityEvaluation> {
  if (!input.policy) {
    return {
      allowed: true,
    };
  }

  if (!isAbsoluteFilesystemPath(input.targetPath)) {
    return {
      allowed: false,
      reasonCode: "STDIO_REF_INVALID",
      message: `stdio MCP target must use an absolute filesystem path: ${input.targetPath}`,
    };
  }

  const statImpl =
    input.statImpl ??
    (async (targetPath: string) => await fs.stat(targetPath));
  const readFileImpl =
    input.readFileImpl ??
    (async (targetPath: string) => await fs.readFile(targetPath));

  let stat;
  try {
    stat = await statImpl(input.targetPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      allowed: false,
      reasonCode: "STDIO_TARGET_NOT_FOUND",
      message: `stdio MCP target does not exist or is not readable: ${input.targetPath} (${message})`,
    };
  }

  if (!stat.isFile()) {
    return {
      allowed: false,
      reasonCode: "STDIO_TARGET_NOT_FILE",
      message: `stdio MCP target must resolve to a regular file: ${input.targetPath}`,
    };
  }

  const fileBytes = await readFileImpl(input.targetPath);
  const actualSha256 = createHash("sha256").update(fileBytes).digest("hex");
  const expectedSha256 = normalizeSha256Hex(input.policy.refSha256);
  if (actualSha256 !== expectedSha256) {
    return {
      allowed: false,
      reasonCode: "STDIO_DIGEST_MISMATCH",
      message: `stdio MCP target digest mismatch for ${input.targetPath}: expected ${expectedSha256}, got ${actualSha256}`,
    };
  }

  return {
    allowed: true,
  };
}

export type McpNetworkPolicyEvaluation =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reasonCode:
        | "POLICY_INVALID"
        | "INVALID_URL"
        | "PROTOCOL_NOT_ALLOWED"
        | "TLS_REQUIRED"
        | "HOST_NOT_ALLOWED"
        | "PRIVATE_NETWORK_BLOCKED"
        | "PORT_NOT_ALLOWED"
        | "PATH_NOT_ALLOWED";
      message: string;
    };

export function evaluateMcpNetworkPolicy(input: {
  policy: McpNetworkPolicy;
  targetUrl: string;
}): McpNetworkPolicyEvaluation {
  let policy: McpNetworkPolicy;
  try {
    policy = assertMcpNetworkPolicyShape(input.policy);
  } catch (error) {
    return {
      allowed: false,
      reasonCode: "POLICY_INVALID",
      message: error instanceof Error ? error.message : "Network policy is invalid",
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.targetUrl);
  } catch {
    return {
      allowed: false,
      reasonCode: "INVALID_URL",
      message: `Target URL is invalid: ${input.targetUrl}`,
    };
  }

  const protocol = parsedUrl.protocol.replace(/:$/, "").toLowerCase();
  if (
    !policy.allowedProtocols.includes(
      protocol as (typeof policy.allowedProtocols)[number]
    )
  ) {
    return {
      allowed: false,
      reasonCode: "PROTOCOL_NOT_ALLOWED",
      message: `Protocol ${protocol} is not allowed by policy ${policy.policyRef}`,
    };
  }

  if (policy.requireTls && insecureProtocols.has(protocol)) {
    return {
      allowed: false,
      reasonCode: "TLS_REQUIRED",
      message: `Policy ${policy.policyRef} requires TLS`,
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    !policy.allowedHostPatterns.some((pattern) =>
      matchesMcpNetworkHostPattern(hostname, pattern)
    )
  ) {
    return {
      allowed: false,
      reasonCode: "HOST_NOT_ALLOWED",
      message: `Host ${hostname} is not allowed by policy ${policy.policyRef}`,
    };
  }

  if (policy.blockPrivateNetwork && isPrivateNetworkHostname(hostname)) {
    return {
      allowed: false,
      reasonCode: "PRIVATE_NETWORK_BLOCKED",
      message: `Host ${hostname} is blocked as a private-network target by policy ${policy.policyRef}`,
    };
  }

  if (policy.allowedPorts.length > 0) {
    const resolvedPort =
      parsedUrl.port.length > 0
        ? Number.parseInt(parsedUrl.port, 10)
        : protocol === "https" || protocol === "wss"
          ? 443
          : 80;

    if (!policy.allowedPorts.includes(resolvedPort)) {
      return {
        allowed: false,
        reasonCode: "PORT_NOT_ALLOWED",
        message: `Port ${resolvedPort} is not allowed by policy ${policy.policyRef}`,
      };
    }
  }

  if (
    policy.allowedPathPrefixes.length > 0 &&
    !policy.allowedPathPrefixes.some((prefix) =>
      matchesPathPrefix(parsedUrl.pathname || "/", prefix)
    )
  ) {
    return {
      allowed: false,
      reasonCode: "PATH_NOT_ALLOWED",
      message: `Path ${parsedUrl.pathname || "/"} is not allowed by policy ${policy.policyRef}`,
    };
  }

  return { allowed: true };
}

export type RuntimeMcpBindingPolicyIssue = {
  bindingId: string;
  mcpId: string;
  networkPolicyRef: string | null;
  reasonCode:
    | "STDIO_ALLOWLIST_INVALID"
    | "STDIO_REF_INVALID"
    | "STDIO_NOT_ALLOWED"
    | "STDIO_PATH_NOT_ALLOWED"
    | "POLICY_REQUIRED"
    | "POLICY_NOT_FOUND"
    | "POLICY_DISABLED"
    | "POLICY_INVALID"
    | "INVALID_URL"
    | "PROTOCOL_NOT_ALLOWED"
    | "TLS_REQUIRED"
    | "HOST_NOT_ALLOWED"
    | "PRIVATE_NETWORK_BLOCKED"
    | "PORT_NOT_ALLOWED"
    | "PATH_NOT_ALLOWED";
  message: string;
};

export type RuntimeMcpBindingStdioIntegrityIssue = {
  bindingId: string;
  mcpId: string;
  reasonCode:
    | "STDIO_REF_INVALID"
    | "STDIO_TARGET_NOT_FOUND"
    | "STDIO_TARGET_NOT_FILE"
    | "STDIO_DIGEST_MISMATCH";
  message: string;
};

export function validateRuntimeMcpBindings(input: {
  bindings: McpBinding[];
  policies: McpNetworkPolicy[];
  stdioAllowedPathPrefixes?: string[];
}) {
  const bindings = input.bindings.map((binding) => mcpBindingSchema.parse(binding));
  const policies = input.policies.map((policy) => mcpNetworkPolicySchema.parse(policy));
  const policyByRef = new Map(policies.map((policy) => [policy.policyRef, policy]));
  const issues: RuntimeMcpBindingPolicyIssue[] = [];
  const stdioAllowedPathPrefixes = input.stdioAllowedPathPrefixes ?? [];

  for (const binding of bindings) {
    if (binding.transport === "stdio") {
      if (binding.source !== "first-party") {
        const evaluation = evaluateMcpStdioPathAllowlist({
          targetPath: binding.ref,
          allowedPathPrefixes: stdioAllowedPathPrefixes,
        });
        if (!evaluation.allowed) {
          issues.push({
            bindingId: binding.bindingId,
            mcpId: binding.mcpId,
            networkPolicyRef: binding.networkPolicyRef,
            reasonCode: evaluation.reasonCode,
            message: evaluation.message,
          });
        }
      }
      continue;
    }

    if (!binding.networkPolicyRef) {
      issues.push({
        bindingId: binding.bindingId,
        mcpId: binding.mcpId,
        networkPolicyRef: null,
        reasonCode: "POLICY_REQUIRED",
        message: `Remote MCP ${binding.mcpId} is missing a runtime network policy`,
      });
      continue;
    }

    const policy = policyByRef.get(binding.networkPolicyRef);
    if (!policy) {
      issues.push({
        bindingId: binding.bindingId,
        mcpId: binding.mcpId,
        networkPolicyRef: binding.networkPolicyRef,
        reasonCode: "POLICY_NOT_FOUND",
        message: `Runtime network policy ${binding.networkPolicyRef} was not materialized for MCP ${binding.mcpId}`,
      });
      continue;
    }

    if (policy.status !== "active") {
      issues.push({
        bindingId: binding.bindingId,
        mcpId: binding.mcpId,
        networkPolicyRef: binding.networkPolicyRef,
        reasonCode: "POLICY_DISABLED",
        message: `Runtime network policy ${policy.policyRef} is ${policy.status} for MCP ${binding.mcpId}`,
      });
      continue;
    }

    const evaluation = evaluateMcpNetworkPolicy({
      policy,
      targetUrl: binding.ref,
    });
    if (!evaluation.allowed) {
      issues.push({
        bindingId: binding.bindingId,
        mcpId: binding.mcpId,
        networkPolicyRef: binding.networkPolicyRef,
        reasonCode: evaluation.reasonCode,
        message: evaluation.message,
      });
    }
  }

  return issues;
}

export function assertRuntimeMcpBindings(input: {
  bindings: McpBinding[];
  policies: McpNetworkPolicy[];
  stdioAllowedPathPrefixes?: string[];
}) {
  const issues = validateRuntimeMcpBindings(input);
  if (issues.length === 0) {
    return;
  }

  const summary = issues
    .map(
      (issue) =>
        `${issue.mcpId} (${issue.bindingId}) [${issue.reasonCode}]: ${issue.message}`
    )
    .join("; ");
  throw new Error(`Runtime MCP policy validation failed: ${summary}`);
}

export async function assertRuntimeMcpBindingStdioIntegrity(input: {
  bindings: McpBinding[];
  readFileImpl?: (targetPath: string) => Promise<Uint8Array>;
  statImpl?: (targetPath: string) => Promise<{ isFile(): boolean }>;
}) {
  const bindings = input.bindings.map((binding) => mcpBindingSchema.parse(binding));
  const issues: RuntimeMcpBindingStdioIntegrityIssue[] = [];

  for (const binding of bindings) {
    if (binding.transport !== "stdio" || !binding.stdioPolicy) {
      continue;
    }

    const evaluation = await evaluateMcpStdioIntegrity({
      targetPath: binding.ref,
      policy: binding.stdioPolicy,
      readFileImpl: input.readFileImpl,
      statImpl: input.statImpl,
    });
    if (!evaluation.allowed) {
      issues.push({
        bindingId: binding.bindingId,
        mcpId: binding.mcpId,
        reasonCode: evaluation.reasonCode,
        message: evaluation.message,
      });
    }
  }

  if (issues.length === 0) {
    return;
  }

  const summary = issues
    .map(
      (issue) =>
        `${issue.mcpId} (${issue.bindingId}) [${issue.reasonCode}]: ${issue.message}`
    )
    .join("; ");
  throw new Error(`Runtime MCP stdio integrity validation failed: ${summary}`);
}
