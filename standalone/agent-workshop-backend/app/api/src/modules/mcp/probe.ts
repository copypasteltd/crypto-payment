import type {
  McpHealthStatus,
  McpRegistryEntry,
} from "@lingban/contracts";

export type McpProbeResult = {
  status: McpHealthStatus;
  detail: string | null;
  errorCode: string | null;
  httpStatus: number | null;
  latencyMs: number | null;
  toolCount: number | null;
  toolNames?: string[];
};

function latencySince(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function resolveAcceptHeader(transport: McpRegistryEntry["transport"]) {
  switch (transport) {
    case "sse":
      return "text/event-stream";
    case "http":
      return "application/json, text/plain;q=0.9, */*;q=0.8";
    case "websocket":
    case "stdio":
    default:
      return "*/*";
  }
}

function summarizeFetchError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return {
        detail: "Probe request timed out",
        errorCode: "PROBE_TIMEOUT",
      };
    }

    return {
      detail: error.message,
      errorCode: "PROBE_REQUEST_FAILED",
    };
  }

  return {
    detail: String(error),
    errorCode: "PROBE_REQUEST_FAILED",
  };
}

async function maybeExtractTools(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return { toolCount: null, toolNames: [] as string[] };
  }

  try {
    const payload = (await response.clone().json()) as unknown;
    if (
      payload &&
      typeof payload === "object" &&
      Array.isArray((payload as { tools?: unknown[] }).tools)
    ) {
      const tools = (payload as { tools: unknown[] }).tools;
      const toolNames = [...new Set(tools.map((tool) => {
        if (typeof tool === "string") return tool.trim();
        if (!tool || typeof tool !== "object") return "";
        const record = tool as { name?: unknown; id?: unknown };
        const value = record.name ?? record.id;
        return typeof value === "string" ? value.trim() : "";
      }).filter(Boolean))].slice(0, 500);
      return { toolCount: tools.length, toolNames };
    }
  } catch {
    return { toolCount: null, toolNames: [] as string[] };
  }

  return { toolCount: null, toolNames: [] as string[] };
}

async function probeHttpLikeTarget(input: {
  entry: Pick<McpRegistryEntry, "transport" | "ref">;
  timeoutMs: number;
}) {
  const startedAt = performance.now();

  try {
    const response = await fetch(input.entry.ref, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: resolveAcceptHeader(input.entry.transport),
        "user-agent": "lingban-mcp-probe/1.0",
      },
      signal: AbortSignal.timeout(input.timeoutMs),
    });

    const latencyMs = latencySince(startedAt);
    const { toolCount, toolNames } = await maybeExtractTools(response);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (response.status >= 200 && response.status < 300) {
      if (
        input.entry.transport === "sse" &&
        !contentType.includes("text/event-stream")
      ) {
        return {
          status: "degraded",
          detail: `SSE endpoint responded with unexpected content-type: ${contentType || "unknown"}`,
          errorCode: "PROBE_PROTOCOL_MISMATCH",
          httpStatus: response.status,
          latencyMs,
          toolCount,
          toolNames,
        } satisfies McpProbeResult;
      }

      return {
        status: "healthy",
        detail: null,
        errorCode: null,
        httpStatus: response.status,
        latencyMs,
        toolCount,
        toolNames,
      } satisfies McpProbeResult;
    }

    if (response.status >= 300 && response.status < 400) {
      return {
        status: "degraded",
        detail: `Probe received redirect response and did not follow it`,
        errorCode: "PROBE_REDIRECTED",
        httpStatus: response.status,
        latencyMs,
        toolCount,
        toolNames,
      } satisfies McpProbeResult;
    }

    if (response.status === 401 || response.status === 403 || response.status === 407) {
      return {
        status: "degraded",
        detail: `Endpoint is reachable but rejected the probe request`,
        errorCode: "PROBE_AUTH_REQUIRED",
        httpStatus: response.status,
        latencyMs,
        toolCount,
        toolNames,
      } satisfies McpProbeResult;
    }

    return {
      status: "unhealthy",
      detail: `Probe returned HTTP ${response.status}`,
      errorCode: "PROBE_HTTP_ERROR",
      httpStatus: response.status,
      latencyMs,
      toolCount,
      toolNames,
    } satisfies McpProbeResult;
  } catch (error) {
    const summary = summarizeFetchError(error);
    return {
      status: "unhealthy",
      detail: summary.detail,
      errorCode: summary.errorCode,
      httpStatus: null,
      latencyMs: latencySince(startedAt),
      toolCount: null,
    } satisfies McpProbeResult;
  }
}

async function probeWebSocketTarget(input: {
  entry: Pick<McpRegistryEntry, "ref">;
  timeoutMs: number;
}) {
  const startedAt = performance.now();

  return await new Promise<McpProbeResult>((resolve) => {
    let settled = false;
    const socket = new WebSocket(input.entry.ref);

    const finish = (result: McpProbeResult) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // Ignore close failures after probe completion.
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        status: "unhealthy",
        detail: "WebSocket probe timed out",
        errorCode: "PROBE_TIMEOUT",
        httpStatus: null,
        latencyMs: latencySince(startedAt),
        toolCount: null,
      });
    }, input.timeoutMs);

    socket.addEventListener("open", () => {
      finish({
        status: "healthy",
        detail: null,
        errorCode: null,
        httpStatus: null,
        latencyMs: latencySince(startedAt),
        toolCount: null,
      });
    });

    socket.addEventListener("error", () => {
      finish({
        status: "unhealthy",
        detail: "WebSocket probe failed before handshake completed",
        errorCode: "PROBE_WEBSOCKET_ERROR",
        httpStatus: null,
        latencyMs: latencySince(startedAt),
        toolCount: null,
      });
    });
  });
}

export async function probeMcpTarget(input: {
  entry: Pick<McpRegistryEntry, "transport" | "ref">;
  timeoutMs: number;
}) {
  switch (input.entry.transport) {
    case "http":
    case "sse":
      return await probeHttpLikeTarget(input);
    case "websocket":
      return await probeWebSocketTarget({
        entry: {
          ref: input.entry.ref,
        },
        timeoutMs: input.timeoutMs,
      });
    case "stdio":
    default:
      return {
        status: "unsupported",
        detail: "Local-process MCP probing is not available from the API host",
        errorCode: "PROBE_UNSUPPORTED_TRANSPORT",
        httpStatus: null,
        latencyMs: null,
        toolCount: null,
      } satisfies McpProbeResult;
  }
}
