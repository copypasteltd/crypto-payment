import type { AdminBootstrap } from "./types";
import i18n from "../i18n";
import { toast } from "./toast";

const API_BASE = (import.meta.env.VITE_ADMIN_API_BASE_URL || "/admin/v1").replace(/\/$/, "");
let csrfToken = "";
let refreshPromise: Promise<AdminBootstrap> | null = null;

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly details: unknown,
    readonly path: string,
    readonly method: string
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export type AdminRequestInit = RequestInit & {
  feedback?: {
    silentError?: boolean;
  };
};

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function detailMessages(details: unknown): string[] {
  if (Array.isArray(details)) {
    return details.flatMap((item) => detailMessages(item)).slice(0, 4);
  }
  if (typeof details === "string" && details.trim()) return [details.trim()];
  if (!details || typeof details !== "object") return [];
  const record = details as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const path = Array.isArray(record.path) ? record.path.join(".") : typeof record.path === "string" ? record.path : "";
  const direct = message ? [`${path ? `${path}: ` : ""}${message}`] : [];
  const nested = Object.entries(record)
    .filter(([key]) => key !== "message" && key !== "path" && !/(api.?key|secret|password|token)/i.test(key))
    .flatMap(([, value]) => detailMessages(value));
  return [...direct, ...nested].slice(0, 4);
}

function notifyApiError(error: AdminApiError) {
  const details = detailMessages(error.details);
  const description = [error.message, ...details.filter((item) => item !== error.message)].join("；");
  toast.error(i18n.t("common:toast.requestFailed", { defaultValue: "请求失败" }), {
    description,
    meta: {
      code: error.code,
      requestId: error.requestId,
      status: error.status || null,
      path: `${error.method} ${error.path}`,
    },
    dedupeKey: `api:${error.method}:${error.path}:${error.code}:${description}`,
    dedupeMs: 30_000,
  });
}

async function parseResponse<T>(response: Response, context: { path: string; method: string; requestId: string; silentError: boolean }): Promise<T> {
  const raw = await response.text();
  const payload = (raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null) as
    | T
    | { error?: { code?: string; message?: string; details?: unknown } }
    | null;
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
    const adminError = new AdminApiError(
      response.status,
      error?.code || "ADMIN_REQUEST_FAILED",
      error?.message || (raw && !/<html/i.test(raw) ? raw.slice(0, 500) : `Request failed with status ${response.status}`),
      response.headers.get("x-request-id") || context.requestId,
      error?.details ?? null,
      context.path,
      context.method
    );
    if (!context.silentError) notifyApiError(adminError);
    throw adminError;
  }
  const result = payload as T;
  if (result && typeof result === "object" && "csrfToken" in result) {
    csrfToken = String((result as unknown as AdminBootstrap).csrfToken || "");
  }
  return result;
}

async function sendRequest(path: string, init: RequestInit, clientRequestId: string) {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Request-Id", clientRequestId);
  headers.set("X-Client-Release", import.meta.env.VITE_ADMIN_RELEASE || "development");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
    headers.set("X-Admin-CSRF", csrfToken);
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });
}

function expireAdminSession() {
  csrfToken = "";
  window.dispatchEvent(new Event("lingban-admin-auth-expired"));
}

async function requestWithRefresh<T>(path: string, init: AdminRequestInit, allowRefresh: boolean): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const feedback = init.feedback;
  const requestInit = { ...init } as AdminRequestInit;
  delete requestInit.feedback;
  const clientRequestId = requestId();
  let response: Response;
  try {
    response = await sendRequest(path, requestInit, clientRequestId);
  } catch (error) {
    const networkError = new AdminApiError(
      0,
      "ADMIN_NETWORK_ERROR",
      error instanceof Error ? error.message : "Network request failed",
      clientRequestId,
      null,
      path,
      method
    );
    if (!feedback?.silentError) notifyApiError(networkError);
    throw networkError;
  }
  const canRefresh = path !== "/auth/login" && path !== "/auth/refresh";

  if (response.status === 401 && allowRefresh && canRefresh) {
    if (!refreshPromise) {
      refreshPromise = requestWithRefresh<AdminBootstrap>("/auth/refresh", { method: "POST", feedback: { silentError: true } }, false)
        .finally(() => { refreshPromise = null; });
    }
    try {
      await refreshPromise;
    } catch (error) {
      if (!feedback?.silentError && error instanceof AdminApiError) notifyApiError(error);
      throw error;
    }
    return requestWithRefresh<T>(path, init, false);
  }

  if (response.status === 401 && path !== "/auth/login") expireAdminSession();
  return parseResponse<T>(response, { path, method, requestId: clientRequestId, silentError: Boolean(feedback?.silentError) });
}

export function adminRequest<T>(path: string, init: AdminRequestInit = {}) {
  return requestWithRefresh<T>(path, init, true);
}

export function setAdminCsrfToken(value: string) {
  csrfToken = value;
}

export function clearAdminCsrfToken() {
  csrfToken = "";
}

export const adminApi = {
  session: () => adminRequest<AdminBootstrap>("/auth/session", { feedback: { silentError: true } }),
  login: (email: string, password: string) =>
    adminRequest<AdminBootstrap>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  refresh: () => adminRequest<AdminBootstrap>("/auth/refresh", { method: "POST", feedback: { silentError: true } }),
  logout: () => adminRequest<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};
