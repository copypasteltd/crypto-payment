import http from "node:http";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { Duplex, Readable } from "node:stream";
import {
  evaluateMcpNetworkPolicy,
} from "@lingban/mcp";
import type { McpNetworkPolicy } from "@lingban/contracts";

type BaselineAllowedUrl = {
  raw: string;
  url: URL;
};

export type RuntimeEgressPolicy = {
  baselineUrls: BaselineAllowedUrl[];
  mcpPolicies: McpNetworkPolicy[];
};

export type RuntimeEgressProxyDiagnostics = {
  started: boolean;
  startedAt: string | null;
  host: string;
  port: number;
  requestsTotal: number;
  connectRequestsTotal: number;
  blockedTotal: number;
  authFailuresTotal: number;
  failuresTotal: number;
  baselineUrlCount: number;
  activeMcpPolicyCount: number;
  lastRequestAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
};

type RuntimeEgressAccessDecision =
  | {
      allowed: true;
      matchedBy: string;
    }
  | {
      allowed: false;
      reason: string;
    };

type RuntimeEgressProxyServerOptions = {
  policy: RuntimeEgressPolicy;
  host: string;
  port?: number;
  username?: string;
  password?: string;
  now?: () => string;
};

const PROXY_HOP_BY_HOP_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const PROXY_HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function defaultPortForProtocol(protocol: string) {
  return protocol === "https:" || protocol === "wss:" ? 443 : 80;
}

function hasRequestBody(method: string) {
  return method !== "GET" && method !== "HEAD";
}

function normalizePort(url: URL) {
  return url.port.length > 0 ? Number.parseInt(url.port, 10) : defaultPortForProtocol(url.protocol);
}

function matchesPathPrefix(pathname: string, prefix: string) {
  if (prefix === "/") {
    return true;
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return (
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
  );
}

function matchesBaselineUrl(targetUrl: URL, baseline: BaselineAllowedUrl) {
  if (targetUrl.protocol !== baseline.url.protocol) {
    return false;
  }

  if (targetUrl.hostname.toLowerCase() !== baseline.url.hostname.toLowerCase()) {
    return false;
  }

  if (normalizePort(targetUrl) !== normalizePort(baseline.url)) {
    return false;
  }

  return matchesPathPrefix(targetUrl.pathname || "/", baseline.url.pathname || "/");
}

function sanitizeHeaders(
  headers: http.IncomingHttpHeaders,
  blocked: Set<string>
) {
  const next: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = rawKey.toLowerCase();
    if (!rawValue || blocked.has(key)) {
      continue;
    }

    next[key] = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
  }

  return next;
}

function resolveProxyTargetUrl(request: http.IncomingMessage) {
  const rawUrl = request.url ?? "";
  if (/^https?:\/\//i.test(rawUrl)) {
    return new URL(rawUrl);
  }

  const host = request.headers.host;
  if (!host) {
    throw new Error("Proxy request is missing an absolute target URL and Host header");
  }

  return new URL(`http://${host}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`);
}

function writeForwardedResponseHeaders(
  response: http.ServerResponse,
  headers: Headers
) {
  const next: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (!PROXY_HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      next[key] = value;
    }
  }

  response.writeHead(response.statusCode || 200, next);
}

function parseProxyAuthorization(headers: http.IncomingHttpHeaders) {
  const header = headers["proxy-authorization"];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) {
    return null;
  }

  const match = raw.match(/^Basic\s+(.+)$/i);
  if (!match) {
    return null;
  }

  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function buildProxyAuthHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function ensureProxyAuthorization(input: {
  headers: http.IncomingHttpHeaders;
  username?: string;
  password?: string;
}) {
  if (!input.username || !input.password) {
    return true;
  }

  const parsed = parseProxyAuthorization(input.headers);
  return (
    parsed?.username === input.username &&
    parsed?.password === input.password
  );
}

function writeProxyAuthRequired(response: http.ServerResponse, authHeader: string | null) {
  response.writeHead(407, {
    "content-type": "application/json; charset=utf-8",
    ...(authHeader ? { "proxy-authenticate": authHeader } : {}),
  });
  response.end(JSON.stringify({ error: "proxy authentication required" }));
}

function buildConnectAuthRequiredResponse(authHeader: string | null) {
  const authLine = authHeader ? `Proxy-Authenticate: ${authHeader}\r\n` : "";
  return `HTTP/1.1 407 Proxy Authentication Required\r\n${authLine}Connection: close\r\n\r\n`;
}

function writeConnectDenied(socket: Duplex, authHeader: string | null, message: string) {
  socket.end(
    `HTTP/1.1 403 Forbidden\r\ncontent-type: application/json; charset=utf-8\r\n${
      authHeader ? `Proxy-Authenticate: ${authHeader}\r\n` : ""
    }connection: close\r\n\r\n${JSON.stringify({ error: message })}`
  );
}

function buildProxyEnv(input: {
  host: string;
  port: number;
  username: string;
  password: string;
  noProxyHosts: string[];
}) {
  const proxyUrl = new URL(`http://${input.host}:${input.port}`);
  proxyUrl.username = input.username;
  proxyUrl.password = input.password;
  const proxyUrlString = proxyUrl.toString();
  const noProxy = input.noProxyHosts.join(",");
  return {
    HTTP_PROXY: proxyUrlString,
    HTTPS_PROXY: proxyUrlString,
    ALL_PROXY: proxyUrlString,
    http_proxy: proxyUrlString,
    https_proxy: proxyUrlString,
    all_proxy: proxyUrlString,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
  };
}

export function buildRuntimeEgressPolicy(input: {
  runtimeApiBaseUrl?: string;
  configuredAllowedBaseUrls?: string[];
  mcpPolicies?: McpNetworkPolicy[];
}) {
  const baselineUrls: BaselineAllowedUrl[] = [];
  const seen = new Set<string>();

  for (const rawCandidate of [
    ...(input.runtimeApiBaseUrl ? [input.runtimeApiBaseUrl] : []),
    ...(input.configuredAllowedBaseUrls ?? []),
  ]) {
    try {
      const url = new URL(rawCandidate);
      const key = url.toString();
      if (!seen.has(key)) {
        seen.add(key);
        baselineUrls.push({
          raw: rawCandidate,
          url,
        });
      }
    } catch {
      // ignore invalid baseline values; config validation happens at runtime use sites
    }
  }

  return {
    baselineUrls,
    mcpPolicies: [...(input.mcpPolicies ?? [])],
  } satisfies RuntimeEgressPolicy;
}

export function evaluateRuntimeEgressAccess(input: {
  policy: RuntimeEgressPolicy;
  targetUrl: string;
}) {
  let url: URL;
  try {
    url = new URL(input.targetUrl);
  } catch {
    return {
      allowed: false,
      reason: `target URL is invalid: ${input.targetUrl}`,
    } satisfies RuntimeEgressAccessDecision;
  }

  for (const baseline of input.policy.baselineUrls) {
    if (matchesBaselineUrl(url, baseline)) {
      return {
        allowed: true,
        matchedBy: `baseline:${baseline.raw}`,
      } satisfies RuntimeEgressAccessDecision;
    }
  }

  for (const mcpPolicy of input.policy.mcpPolicies) {
    if (mcpPolicy.status !== "active") {
      continue;
    }

    const evaluation = evaluateMcpNetworkPolicy({
      policy: mcpPolicy,
      targetUrl: url.toString(),
    });
    if (evaluation.allowed) {
      return {
        allowed: true,
        matchedBy: `mcp-policy:${mcpPolicy.policyRef}`,
      } satisfies RuntimeEgressAccessDecision;
    }
  }

  return {
    allowed: false,
    reason: `runtime egress target is not allowlisted: ${url.toString()}`,
  } satisfies RuntimeEgressAccessDecision;
}

export function buildRuntimeEgressProxyConfig(input: {
  launchMode: "local-process" | "docker";
  runtimeApiBaseUrl?: string;
  configuredAllowedBaseUrls?: string[];
  configuredNoProxyHosts?: string[];
  mcpPolicies?: McpNetworkPolicy[];
}) {
  const policy = buildRuntimeEgressPolicy({
    runtimeApiBaseUrl: input.runtimeApiBaseUrl,
    configuredAllowedBaseUrls: input.configuredAllowedBaseUrls,
    mcpPolicies: input.mcpPolicies,
  });

  const noProxyHosts = new Set([
    "127.0.0.1",
    "localhost",
    ...(input.launchMode === "docker" ? ["host.docker.internal"] : []),
    ...(input.configuredNoProxyHosts ?? []),
  ]);

  try {
    if (input.runtimeApiBaseUrl) {
      noProxyHosts.add(new URL(input.runtimeApiBaseUrl).hostname);
    }
  } catch {
    // ignore invalid runtime API base url here; API URL validation happens elsewhere
  }

  return {
    policy,
    noProxyHosts: [...noProxyHosts],
    envHost: input.launchMode === "docker" ? "host.docker.internal" : "127.0.0.1",
    listenHost: input.launchMode === "docker" ? "0.0.0.0" : "127.0.0.1",
  };
}

export class RuntimeEgressProxyServer {
  #server: http.Server;
  #policy: RuntimeEgressPolicy;
  #host: string;
  #port: number;
  #username: string;
  #password: string;
  #authHeader: string;
  #now: () => string;
  #startedAt: string | null = null;
  #requestsTotal = 0;
  #connectRequestsTotal = 0;
  #blockedTotal = 0;
  #authFailuresTotal = 0;
  #failuresTotal = 0;
  #lastRequestAt: string | null = null;
  #lastFailureAt: string | null = null;
  #lastFailureMessage: string | null = null;

  constructor(options: RuntimeEgressProxyServerOptions) {
    this.#policy = options.policy;
    this.#host = options.host;
    this.#port = options.port ?? 0;
    this.#username = options.username ?? "proxy";
    this.#password = options.password ?? randomUUID();
    this.#authHeader = buildProxyAuthHeader(this.#username, this.#password);
    this.#now = options.now ?? (() => new Date().toISOString());

    this.#server = http.createServer(async (request, response) => {
      this.#requestsTotal += 1;
      this.#lastRequestAt = this.#now();

      if (
        !ensureProxyAuthorization({
          headers: request.headers,
          username: this.#username,
          password: this.#password,
        })
      ) {
        this.#authFailuresTotal += 1;
        writeProxyAuthRequired(response, "Basic realm=\"lingban-egress-proxy\"");
        return;
      }

      const abortController = new AbortController();
      const onAborted = () => abortController.abort();
      const onResponseClosed = () => {
        if (!response.writableEnded) {
          abortController.abort();
        }
      };
      request.once("aborted", onAborted);
      response.once("close", onResponseClosed);

      try {
        const targetUrl = resolveProxyTargetUrl(request);
        const decision = evaluateRuntimeEgressAccess({
          policy: this.#policy,
          targetUrl: targetUrl.toString(),
        });
        if (!decision.allowed) {
          this.#blockedTotal += 1;
          response.writeHead(403, {
            "content-type": "application/json; charset=utf-8",
          });
          response.end(JSON.stringify({ error: decision.reason }));
          return;
        }

        const upstreamResponse = await fetch(targetUrl, {
          method: request.method ?? "GET",
          headers: sanitizeHeaders(request.headers, PROXY_HOP_BY_HOP_REQUEST_HEADERS),
          body:
            hasRequestBody(request.method ?? "GET")
              ? (Readable.toWeb(request) as globalThis.ReadableStream<Uint8Array>)
              : undefined,
          duplex: hasRequestBody(request.method ?? "GET") ? "half" : undefined,
          signal: abortController.signal,
          redirect: "manual",
        } as RequestInit & {
          duplex?: "half";
        });

        response.statusCode = upstreamResponse.status;
        response.statusMessage = upstreamResponse.statusText;
        writeForwardedResponseHeaders(response, upstreamResponse.headers);
        if (upstreamResponse.body) {
          await new Promise<void>((resolve, reject) => {
            const body = Readable.fromWeb(upstreamResponse.body as any);
            body.on("error", reject);
            body.on("end", resolve);
            body.pipe(response);
          });
        } else {
          response.end();
        }
      } catch (error) {
        this.#failuresTotal += 1;
        this.#lastFailureAt = this.#now();
        this.#lastFailureMessage = error instanceof Error ? error.message : String(error);
        if (!response.headersSent) {
          response.writeHead(502, {
            "content-type": "application/json; charset=utf-8",
          });
          response.end(JSON.stringify({ error: this.#lastFailureMessage }));
        } else {
          response.destroy(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        request.off("aborted", onAborted);
        response.off("close", onResponseClosed);
      }
    });

    this.#server.on("connect", (request, socket, head) => {
      void this.#handleConnect(request, socket, head);
    });
  }

  async start() {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.#server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        this.#server.off("error", onError);
        this.#startedAt = this.#now();
        resolve();
      };

      this.#server.once("error", onError);
      this.#server.once("listening", onListening);
      this.#server.listen(this.#port, this.#host);
    });
  }

  async stop() {
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  get port() {
    const address = this.#server.address();
    return address && typeof address !== "string" ? address.port : this.#port;
  }

  buildProxyEnv(noProxyHosts: string[], envHost: string) {
    return buildProxyEnv({
      host: envHost,
      port: this.port,
      username: this.#username,
      password: this.#password,
      noProxyHosts,
    });
  }

  getDiagnostics(): RuntimeEgressProxyDiagnostics {
    return {
      started: this.#startedAt !== null,
      startedAt: this.#startedAt,
      host: this.#host,
      port: this.port,
      requestsTotal: this.#requestsTotal,
      connectRequestsTotal: this.#connectRequestsTotal,
      blockedTotal: this.#blockedTotal,
      authFailuresTotal: this.#authFailuresTotal,
      failuresTotal: this.#failuresTotal,
      baselineUrlCount: this.#policy.baselineUrls.length,
      activeMcpPolicyCount: this.#policy.mcpPolicies.filter((policy) => policy.status === "active")
        .length,
      lastRequestAt: this.#lastRequestAt,
      lastFailureAt: this.#lastFailureAt,
      lastFailureMessage: this.#lastFailureMessage,
    };
  }

  async #handleConnect(
    request: http.IncomingMessage,
    socket: Duplex,
    head: Buffer
  ) {
    this.#connectRequestsTotal += 1;
    this.#lastRequestAt = this.#now();

    if (
      !ensureProxyAuthorization({
        headers: request.headers,
        username: this.#username,
        password: this.#password,
      })
    ) {
      this.#authFailuresTotal += 1;
      socket.end(
        buildConnectAuthRequiredResponse("Basic realm=\"lingban-egress-proxy\"")
      );
      return;
    }

    try {
      const authority = request.url ?? "";
      const separator = authority.lastIndexOf(":");
      if (separator <= 0) {
        throw new Error(`CONNECT authority is invalid: ${authority || "<empty>"}`);
      }

      const hostname = authority.slice(0, separator);
      const portText = authority.slice(separator + 1);
      const port = Number.parseInt(portText, 10);
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`CONNECT port is invalid: ${authority}`);
      }

      const targetUrl = new URL(`https://${hostname}:${port}/`);
      const decision = evaluateRuntimeEgressAccess({
        policy: this.#policy,
        targetUrl: targetUrl.toString(),
      });
      if (!decision.allowed) {
        this.#blockedTotal += 1;
        writeConnectDenied(socket, null, decision.reason);
        return;
      }

      const upstreamSocket = net.connect(port, hostname);
      upstreamSocket.once("connect", () => {
        socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length > 0) {
          upstreamSocket.write(head);
        }
        socket.pipe(upstreamSocket);
        upstreamSocket.pipe(socket);
      });

      const closeSockets = () => {
        upstreamSocket.destroy();
        socket.destroy();
      };

      upstreamSocket.once("error", (error) => {
        this.#failuresTotal += 1;
        this.#lastFailureAt = this.#now();
        this.#lastFailureMessage = error.message;
        closeSockets();
      });
      socket.once("error", () => closeSockets());
      socket.once("close", () => closeSockets());
      upstreamSocket.once("close", () => closeSockets());
    } catch (error) {
      this.#failuresTotal += 1;
      this.#lastFailureAt = this.#now();
      this.#lastFailureMessage = error instanceof Error ? error.message : String(error);
      socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    }
  }
}
