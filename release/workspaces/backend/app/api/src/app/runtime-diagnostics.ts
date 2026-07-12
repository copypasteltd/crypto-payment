import {
  bridgeControlProbeCollectionSchema,
  bridgeControlProbeSchema,
  internalRuntimeDiagnosticsReportSchema,
  workerOpsRuntimeProbeSchema,
  type BridgeRegistryConnectionDiagnostics,
  type InternalRuntimeDiagnosticsReport,
} from "@lingban/contracts";
import { nowIso, toErrorMessage } from "@lingban/shared";
import { getApiRuntimeConfig } from "./runtime.js";
import { runsService } from "../modules/runs/service.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `GET ${url} failed (${response.status} ${response.statusText}): ${text || "<empty>"}`
      );
    }

    return text ? (JSON.parse(text) as unknown) : null;
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeWorkerOpsPayload(payload: unknown) {
  const root = asRecord(payload);
  const readiness = asRecord(root?.readiness);
  const diagnostics = asRecord(root?.diagnostics);
  const components = asRecord(diagnostics?.components);
  const queueEvents = asRecord(diagnostics?.queueEvents);
  const startQueueEvents = asRecord(queueEvents?.start);
  const cleanupQueueEvents = asRecord(queueEvents?.cleanup);

  return {
    started: asBoolean(diagnostics?.started),
    activeRunsCount: asNumber(diagnostics?.activeRunsCount ?? readiness?.activeRunsCount),
    readinessStatus: asString(readiness?.status),
    components: {
      startQueue: asBoolean(components?.startQueue),
      cleanupQueue: asBoolean(components?.cleanupQueue),
      startWorker: asBoolean(components?.startWorker),
      cleanupWorker: asBoolean(components?.cleanupWorker),
      startQueueEvents: asBoolean(components?.startQueueEvents),
      cleanupQueueEvents: asBoolean(components?.cleanupQueueEvents),
    },
    lastRecoveryErrorMessage: asString(diagnostics?.lastRecoveryErrorMessage),
    lastErrorMessage: asString(diagnostics?.lastErrorMessage),
    lastStartQueueEvent: asString(startQueueEvents?.lastEventName),
    lastCleanupQueueEvent: asString(cleanupQueueEvents?.lastEventName),
  } satisfies Record<string, unknown>;
}

function summarizeBridgeRuntimePayload(payload: unknown) {
  const root = asRecord(payload);
  const controlServer = asRecord(root?.controlServer);
  const session = asRecord(controlServer?.session);
  const fileWatcher = asRecord(controlServer?.fileWatcher);
  const artifactPublisher = asRecord(controlServer?.artifactPublisher);
  const controlHttp = asRecord(root?.controlHttp);
  const metrics = asRecord(root?.metrics);

  return {
    shuttingDown: asBoolean(root?.shuttingDown),
    pendingEventQueueCount: asNumber(root?.pendingEventQueueCount),
    sessionStatus: asString(session?.status),
    sessionRunning: asBoolean(session?.running),
    fileWatcherRunning: asBoolean(fileWatcher?.running),
    fileSyncCount: asNumber(fileWatcher?.syncCount),
    artifactFlushCount: asNumber(artifactPublisher?.flushCount),
    publishedArtifactsTotal: asNumber(artifactPublisher?.publishedArtifactsTotal),
    controlHttpStarted: asBoolean(controlHttp?.started),
    controlHttpRequestsTotal: asNumber(controlHttp?.requestsTotal),
    forwardedEventsTotal: asNumber(metrics?.forwardedEventsTotal),
    lastForwardedEventFailureMessage: asString(root?.lastForwardedEventFailureMessage),
  } satisfies Record<string, unknown>;
}

export async function probeWorkerOpsRuntime() {
  const config = getApiRuntimeConfig();
  const baseUrl = config.workerOpsBaseUrl ? trimTrailingSlash(config.workerOpsBaseUrl) : null;

  if (!baseUrl) {
    return workerOpsRuntimeProbeSchema.parse({
      configured: false,
      baseUrl: null,
      status: "disabled",
      readinessStatus: null,
      diagnosticsAvailable: false,
      probedAt: null,
      durationMs: null,
      error: null,
      summary: {},
    });
  }

  const startedAt = Date.now();
  const headers: Record<string, string> = {};
  if (config.workerOpsToken) {
    headers["x-lingban-worker-ops-token"] = config.workerOpsToken;
  }

  try {
    const payload = await fetchJsonWithTimeout(
      `${baseUrl}/diagnostics`,
      {
        method: "GET",
        headers,
      },
      config.workerOpsProbeTimeoutMs
    );
    const root = asRecord(payload);
    const readiness = asRecord(root?.readiness);
    const readinessStatus = readiness?.status === "ready" || readiness?.status === "not_ready"
      ? readiness.status
      : null;

    return workerOpsRuntimeProbeSchema.parse({
      configured: true,
      baseUrl,
      status: readinessStatus === "ready" ? "ready" : "not_ready",
      readinessStatus,
      diagnosticsAvailable: Boolean(root),
      probedAt: nowIso(),
      durationMs: Math.max(0, Date.now() - startedAt),
      error: null,
      summary: summarizeWorkerOpsPayload(payload),
    });
  } catch (error) {
    return workerOpsRuntimeProbeSchema.parse({
      configured: true,
      baseUrl,
      status: "unreachable",
      readinessStatus: null,
      diagnosticsAvailable: false,
      probedAt: nowIso(),
      durationMs: Math.max(0, Date.now() - startedAt),
      error: toErrorMessage(error, { abortMessage: "probe request timed out" }),
      summary: {},
    });
  }
}

async function probeBridgeControl(
  connection: BridgeRegistryConnectionDiagnostics
) {
  const config = getApiRuntimeConfig();
  const baseUrl = trimTrailingSlash(connection.control!.baseUrl);
  const startedAt = Date.now();
  const headers: Record<string, string> = {};

  if (connection.control?.authToken) {
    headers["x-lingban-control-token"] = connection.control.authToken;
  }

  try {
    const payload = await fetchJsonWithTimeout(
      `${baseUrl}/diagnostics`,
      {
        method: "GET",
        headers,
      },
      config.bridgeControlProbeTimeoutMs
    );
    const root = asRecord(payload);
    const controlServer = asRecord(root?.controlServer);
    const controlHttp = asRecord(root?.controlHttp);
    const session = asRecord(controlServer?.session);
    const shuttingDown = asBoolean(root?.shuttingDown);
    const sessionRunning = asBoolean(session?.running);
    const controlHttpStarted = asBoolean(controlHttp?.started);
    const status =
      shuttingDown === true || sessionRunning === false || controlHttpStarted === false
        ? "not_ready"
        : "ready";

    return bridgeControlProbeSchema.parse({
      runId: connection.runId,
      bridgeId: connection.bridgeId,
      baseUrl,
      status,
      diagnosticsAvailable: Boolean(root),
      probedAt: nowIso(),
      durationMs: Math.max(0, Date.now() - startedAt),
      error: null,
      summary: summarizeBridgeRuntimePayload(payload),
    });
  } catch (error) {
    return bridgeControlProbeSchema.parse({
      runId: connection.runId,
      bridgeId: connection.bridgeId,
      baseUrl,
      status: "unreachable",
      diagnosticsAvailable: false,
      probedAt: nowIso(),
      durationMs: Math.max(0, Date.now() - startedAt),
      error: toErrorMessage(error, { abortMessage: "probe request timed out" }),
      summary: {},
    });
  }
}

async function buildBridgeControlProbes(
  connections: BridgeRegistryConnectionDiagnostics[],
  options: {
    includeItems?: boolean;
  } = {}
) {
  const candidates = connections.filter((connection) => Boolean(connection.control?.baseUrl));

  if (options.includeItems === false) {
    return bridgeControlProbeCollectionSchema.parse({
      configuredCount: candidates.length,
      probedCount: 0,
      readyCount: 0,
      notReadyCount: 0,
      unreachableCount: 0,
      items: [],
    });
  }

  const items = await Promise.all(candidates.map((connection) => probeBridgeControl(connection)));

  return bridgeControlProbeCollectionSchema.parse({
    configuredCount: candidates.length,
    probedCount: items.length,
    readyCount: items.filter((item) => item.status === "ready").length,
    notReadyCount: items.filter((item) => item.status === "not_ready").length,
    unreachableCount: items.filter((item) => item.status === "unreachable").length,
    items,
  });
}

export async function buildInternalRuntimeDiagnosticsReport(options: {
  includeBridgeControlProbes?: boolean;
} = {}): Promise<InternalRuntimeDiagnosticsReport> {
  const baseDiagnostics = runsService.getInternalRuntimeDiagnostics();
  const [workerOps, bridgeControlProbes] = await Promise.all([
    probeWorkerOpsRuntime(),
    buildBridgeControlProbes(baseDiagnostics.bridgeRegistry.connections, {
      includeItems: options.includeBridgeControlProbes ?? true,
    }),
  ]);

  return internalRuntimeDiagnosticsReportSchema.parse({
    ...baseDiagnostics,
    workerOps,
    bridgeControlProbes,
  });
}
