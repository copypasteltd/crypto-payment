import type { McpBinding } from "@lingban/contracts";
import type {
  ContainerEgressFirewallPlan,
  ContainerEgressFirewallTarget,
} from "./specs.js";

function defaultPortForProtocol(protocol: string) {
  return protocol === "https:" || protocol === "wss:" ? 443 : 80;
}

function addUrlTarget(
  targets: Map<string, ContainerEgressFirewallTarget>,
  urlString: string,
  reason: string
) {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return;
  }

  const host = url.hostname.trim().toLowerCase();
  const port =
    url.port.length > 0 ? Number.parseInt(url.port, 10) : defaultPortForProtocol(url.protocol);
  if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) {
    return;
  }

  const key = `${host}:${port}`;
  const existing = targets.get(key);
  if (existing) {
    if (!existing.reasons.includes(reason)) {
      existing.reasons.push(reason);
      existing.reasons.sort((left, right) => left.localeCompare(right));
    }
    return;
  }

  targets.set(key, {
    host,
    port,
    reasons: [reason],
  });
}

export function buildContainerEgressFirewallPlan(input: {
  enabled: boolean;
  allowDns: boolean;
  runtimeApiBaseUrl?: string;
  bindings?: McpBinding[];
}): ContainerEgressFirewallPlan {
  if (!input.enabled) {
    return {
      enabled: false,
      allowDns: input.allowDns,
      targets: [],
    };
  }

  const targets = new Map<string, ContainerEgressFirewallTarget>();

  if (input.runtimeApiBaseUrl) {
    addUrlTarget(targets, input.runtimeApiBaseUrl, "runtime-api");
  }

  for (const binding of input.bindings ?? []) {
    if (binding.transport === "stdio") {
      continue;
    }

    addUrlTarget(targets, binding.ref, `mcp-binding:${binding.bindingId}`);
  }

  return {
    enabled: true,
    allowDns: input.allowDns,
    targets: [...targets.values()].sort((left, right) => {
      const leftKey = `${left.host}:${left.port}`;
      const rightKey = `${right.host}:${right.port}`;
      return leftKey.localeCompare(rightKey);
    }),
  };
}

export function extractFirewallTargetsFromProxyEnv(
  proxyEnv?: Partial<Record<string, string>>
): ContainerEgressFirewallTarget[] {
  if (!proxyEnv) {
    return [];
  }

  const targets = new Map<string, ContainerEgressFirewallTarget>();
  for (const [envKey, rawValue] of Object.entries(proxyEnv)) {
    if (!rawValue || !/^(HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)$/i.test(envKey)) {
      continue;
    }

    addUrlTarget(targets, rawValue, "runtime-egress-proxy");
  }

  return [...targets.values()].sort((left, right) => {
    const leftKey = `${left.host}:${left.port}`;
    const rightKey = `${right.host}:${right.port}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function buildContainerEgressFirewallEnv(input: {
  plan: ContainerEgressFirewallPlan;
  proxyEnv?: Partial<Record<string, string>>;
}): Record<string, string> {
  if (!input.plan.enabled) {
    return {};
  }

  const mergedTargets = new Map<string, ContainerEgressFirewallTarget>();
  for (const target of input.plan.targets) {
    mergedTargets.set(`${target.host}:${target.port}`, {
      host: target.host,
      port: target.port,
      reasons: [...target.reasons],
    });
  }

  for (const target of extractFirewallTargetsFromProxyEnv(input.proxyEnv)) {
    const key = `${target.host}:${target.port}`;
    const existing = mergedTargets.get(key);
    if (existing) {
      for (const reason of target.reasons) {
        if (!existing.reasons.includes(reason)) {
          existing.reasons.push(reason);
        }
      }
      existing.reasons.sort((left, right) => left.localeCompare(right));
      continue;
    }

    mergedTargets.set(key, {
      host: target.host,
      port: target.port,
      reasons: [...target.reasons],
    });
  }

  return {
    LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED: "true",
    LINGBAN_RUNTIME_EGRESS_FIREWALL_ALLOW_DNS: input.plan.allowDns ? "true" : "false",
    LINGBAN_RUNTIME_EGRESS_FIREWALL_TARGETS_JSON: JSON.stringify(
      [...mergedTargets.values()].sort((left, right) => {
        const leftKey = `${left.host}:${left.port}`;
        const rightKey = `${right.host}:${right.port}`;
        return leftKey.localeCompare(rightKey);
      })
    ),
  };
}
