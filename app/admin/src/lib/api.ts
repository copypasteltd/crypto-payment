import type { AdminBootstrap } from "./types";

const API_BASE = (import.meta.env.VITE_ADMIN_API_BASE_URL || "/admin/v1").replace(/\/$/, "");
let csrfToken = "";
let refreshPromise: Promise<AdminBootstrap> | null = null;

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly details: unknown
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: { code?: string; message?: string; details?: unknown } }
    | null;
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
    const adminError = new AdminApiError(
      response.status,
      error?.code || "ADMIN_REQUEST_FAILED",
      error?.message || `Request failed with status ${response.status}`,
      response.headers.get("x-request-id"),
      error?.details ?? null
    );
    throw adminError;
  }
  const result = payload as T;
  if (result && typeof result === "object" && "csrfToken" in result) {
    csrfToken = String((result as unknown as AdminBootstrap).csrfToken || "");
  }
  return result;
}

async function sendRequest(path: string, init: RequestInit) {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Request-Id", requestId());
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

async function requestWithRefresh<T>(path: string, init: RequestInit, allowRefresh: boolean): Promise<T> {
  const response = await sendRequest(path, init);
  const canRefresh = path !== "/auth/login" && path !== "/auth/refresh";

  if (response.status === 401 && allowRefresh && canRefresh) {
    if (!refreshPromise) {
      refreshPromise = requestWithRefresh<AdminBootstrap>("/auth/refresh", { method: "POST" }, false)
        .finally(() => { refreshPromise = null; });
    }
    await refreshPromise;
    return requestWithRefresh<T>(path, init, false);
  }

  if (response.status === 401 && path !== "/auth/login") expireAdminSession();
  return parseResponse<T>(response);
}

export function adminRequest<T>(path: string, init: RequestInit = {}) {
  return requestWithRefresh<T>(path, init, true);
}

export function setAdminCsrfToken(value: string) {
  csrfToken = value;
}

export function clearAdminCsrfToken() {
  csrfToken = "";
}

export const adminApi = {
  session: () => adminRequest<AdminBootstrap>("/auth/session"),
  login: (email: string, password: string) =>
    adminRequest<AdminBootstrap>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  refresh: () => adminRequest<AdminBootstrap>("/auth/refresh", { method: "POST" }),
  logout: () => adminRequest<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};
