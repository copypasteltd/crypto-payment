import http from "node:http";
import type {
  WorkerDaemonDiagnostics,
  WorkerOpsRouteDiagnostics,
  WorkerOpsServerDiagnostics,
  WorkerReadinessReport,
} from "./observability.js";

type WorkerOpsHttpServerOptions = {
  host?: string;
  port: number;
  authToken?: string;
  now?: () => string;
  getReadiness: () => WorkerReadinessReport | Promise<WorkerReadinessReport>;
  getDiagnostics: () => WorkerDaemonDiagnostics | Promise<WorkerDaemonDiagnostics>;
  getMetricsText: () => string | Promise<string>;
  processCapture?: (runId: string, captureId: string) => unknown | Promise<unknown>;
  stopRun?: (runId: string) => unknown | Promise<unknown>;
};

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(
  response: http.ServerResponse,
  statusCode: number,
  payload: string,
  contentType = "text/plain; charset=utf-8"
) {
  response.writeHead(statusCode, {
    "content-type": contentType,
  });
  response.end(payload);
}

export class WorkerOpsHttpServer {
  #server: http.Server;
  #host: string;
  #port: number;
  #authToken?: string;
  #now: () => string;
  #getReadiness: () => WorkerReadinessReport | Promise<WorkerReadinessReport>;
  #getDiagnostics: () => WorkerDaemonDiagnostics | Promise<WorkerDaemonDiagnostics>;
  #getMetricsText: () => string | Promise<string>;
  #processCapture?: (runId: string, captureId: string) => unknown | Promise<unknown>;
  #stopRun?: (runId: string) => unknown | Promise<unknown>;
  #startedAt: string | null = null;
  #inFlightRequests = 0;
  #requestsTotal = 0;
  #unauthorizedRequestsTotal = 0;
  #clientErrorsTotal = 0;
  #serverErrorsTotal = 0;
  #lastRequestAt: string | null = null;
  #lastErrorAt: string | null = null;
  #lastErrorMessage: string | null = null;
  #routeState = new Map<string, Omit<WorkerOpsRouteDiagnostics, "route">>();

  constructor(options: WorkerOpsHttpServerOptions) {
    this.#host = options.host ?? "127.0.0.1";
    this.#port = options.port;
    this.#authToken = options.authToken;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#getReadiness = options.getReadiness;
    this.#getDiagnostics = options.getDiagnostics;
    this.#getMetricsText = options.getMetricsText;
    this.#processCapture = options.processCapture;
    this.#stopRun = options.stopRun;
    this.#server = http.createServer(async (request, response) => {
      const route = this.#resolveRoute(request);
      const respondJson = (statusCode: number, payload: unknown) => {
        this.#recordResponse(route, statusCode);
        sendJson(response, statusCode, payload);
      };
      const respondText = (
        statusCode: number,
        payload: string,
        contentType = "text/plain; charset=utf-8"
      ) => {
        this.#recordResponse(route, statusCode);
        sendText(response, statusCode, payload, contentType);
      };

      this.#inFlightRequests += 1;
      try {
        if (!request.url || !request.method) {
          respondJson(400, { error: "missing request metadata" });
          return;
        }

        if (request.method === "GET" && request.url === "/health") {
          respondJson(200, { status: "ok" });
          return;
        }

        if (request.method === "GET" && request.url === "/readyz") {
          const readiness = await this.#getReadiness();
          respondJson(readiness.status === "ready" ? 200 : 503, readiness);
          return;
        }

        if (request.method === "GET" && request.url === "/diagnostics") {
          if (!this.#isAuthorized(request)) {
            respondJson(401, { error: "invalid ops token" });
            return;
          }

          const [diagnostics, readiness] = await Promise.all([
            this.#getDiagnostics(),
            this.#getReadiness(),
          ]);
          respondJson(200, {
            readiness,
            diagnostics,
            ops: this.getDiagnostics(),
          });
          return;
        }

        if (request.method === "GET" && request.url === "/metrics") {
          if (!this.#isAuthorized(request)) {
            respondJson(401, { error: "invalid ops token" });
            return;
          }

          const metrics = await this.#getMetricsText();
          respondText(200, metrics, "text/plain; version=0.0.4; charset=utf-8");
          return;
        }

        if (request.method === "POST" && request.url === "/captures/process") {
          if (!this.#isAuthorized(request)) {
            respondJson(401, { error: "invalid ops token" });
            return;
          }
          if (!this.#processCapture) {
            respondJson(503, { error: "capture processor unavailable" });
            return;
          }
          const body = await this.#readJsonBody(request);
          const runId = typeof body.runId === "string" ? body.runId.trim() : "";
          const captureId = typeof body.captureId === "string" ? body.captureId.trim() : "";
          if (!runId || !captureId) {
            respondJson(400, { error: "runId and captureId are required" });
            return;
          }
          const result = await this.#processCapture(runId, captureId);
          respondJson(202, { accepted: true, result });
          return;
        }

        if (request.method === "POST" && request.url === "/runs/stop") {
          if (!this.#isAuthorized(request)) {
            respondJson(401, { error: "invalid ops token" });
            return;
          }
          if (!this.#stopRun) {
            respondJson(503, { error: "run stop controller unavailable" });
            return;
          }
          const body = await this.#readJsonBody(request);
          const runId = typeof body.runId === "string" ? body.runId.trim() : "";
          if (!runId) {
            respondJson(400, { error: "runId is required" });
            return;
          }
          const result = await this.#stopRun(runId);
          respondJson(202, { accepted: true, result });
          return;
        }

        respondJson(404, { error: "not found" });
      } catch (error) {
        respondJson(500, {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.#inFlightRequests = Math.max(0, this.#inFlightRequests - 1);
      }
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

  get url() {
    const address = this.#server.address();
    if (address && typeof address !== "string") {
      return `http://${this.#host}:${address.port}`;
    }

    return `http://${this.#host}:${this.#port}`;
  }

  getDiagnostics(): WorkerOpsServerDiagnostics {
    const address = this.#server.address();
    const boundPort = address && typeof address !== "string" ? address.port : this.#port;

    return {
      started: this.#startedAt !== null,
      startedAt: this.#startedAt,
      host: this.#host,
      port: boundPort,
      url: this.url,
      authRequired: Boolean(this.#authToken),
      inFlightRequests: this.#inFlightRequests,
      requestsTotal: this.#requestsTotal,
      unauthorizedRequestsTotal: this.#unauthorizedRequestsTotal,
      clientErrorsTotal: this.#clientErrorsTotal,
      serverErrorsTotal: this.#serverErrorsTotal,
      lastRequestAt: this.#lastRequestAt,
      lastErrorAt: this.#lastErrorAt,
      lastErrorMessage: this.#lastErrorMessage,
      routes: Array.from(this.#routeState.entries())
        .map(([route, state]) => ({
          route,
          ...state,
        }))
        .sort((left, right) => left.route.localeCompare(right.route)),
    };
  }

  #resolveRoute(request: http.IncomingMessage) {
    const pathname = request.url?.split("?", 1)[0] ?? "";
    if (request.method === "GET" && pathname === "/health") {
      return "health";
    }
    if (request.method === "GET" && pathname === "/readyz") {
      return "readyz";
    }
    if (request.method === "GET" && pathname === "/diagnostics") {
      return "diagnostics";
    }
    if (request.method === "GET" && pathname === "/metrics") {
      return "metrics";
    }
    if (request.method === "POST" && pathname === "/captures/process") {
      return "captures.process";
    }
    if (request.method === "POST" && pathname === "/runs/stop") {
      return "runs.stop";
    }
    return "unknown";
  }

  #isAuthorized(request: http.IncomingMessage) {
    const headerValue = request.headers["x-lingban-worker-ops-token"];
    const providedToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return !this.#authToken || providedToken === this.#authToken;
  }

  async #readJsonBody(request: http.IncomingMessage) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;
      if (size > 64 * 1024) throw new Error("request body exceeds 64 KiB");
      chunks.push(buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    const parsed = raw ? JSON.parse(raw) as unknown : {};
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("request body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  }

  #recordResponse(route: string, statusCode: number) {
    const now = this.#now();
    this.#requestsTotal += 1;
    this.#lastRequestAt = now;

    const state = this.#routeState.get(route) ?? {
      requestsTotal: 0,
      clientErrorsTotal: 0,
      serverErrorsTotal: 0,
      unauthorizedTotal: 0,
      lastRequestAt: null,
      lastStatusCode: null,
    };

    state.requestsTotal += 1;
    state.lastRequestAt = now;
    state.lastStatusCode = statusCode;

    if (statusCode === 401) {
      this.#unauthorizedRequestsTotal += 1;
      state.unauthorizedTotal += 1;
    }

    if (statusCode >= 400 && statusCode < 500) {
      this.#clientErrorsTotal += 1;
      state.clientErrorsTotal += 1;
    }

    if (statusCode >= 500) {
      this.#serverErrorsTotal += 1;
      state.serverErrorsTotal += 1;
      this.#lastErrorAt = now;
      this.#lastErrorMessage = `HTTP ${statusCode} on ${route}`;
    } else if (statusCode >= 400) {
      this.#lastErrorAt = now;
      this.#lastErrorMessage = `HTTP ${statusCode} on ${route}`;
    }

    this.#routeState.set(route, state);
  }
}
