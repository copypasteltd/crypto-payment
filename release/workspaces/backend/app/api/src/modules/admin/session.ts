import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthSessionResponse } from "@lingban/contracts";
import { AppError } from "../../app/errors.js";

const ACCESS_COOKIE = "lingban_admin_access";
const REFRESH_COOKIE = "lingban_admin_refresh";
const CSRF_COOKIE = "lingban_admin_csrf";
const COOKIE_PATH = "/admin/v1";
const csrfSecret =
  process.env.LINGBAN_ADMIN_CSRF_SECRET?.trim() || randomBytes(32).toString("hex");

function readHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseCookies(request: FastifyRequest) {
  const result = new Map<string, string>();
  for (const segment of request.headers.cookie?.split(";") ?? []) {
    const separator = segment.indexOf("=");
    if (separator < 1) continue;
    const key = segment.slice(0, separator).trim();
    const rawValue = segment.slice(separator + 1).trim();
    try {
      result.set(key, decodeURIComponent(rawValue));
    } catch {
      result.set(key, rawValue);
    }
  }
  return result;
}

function cookieSecure() {
  const configured = process.env.LINGBAN_ADMIN_COOKIE_SECURE?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV === "production";
}

function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly: boolean; maxAgeSeconds: number }
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
    "SameSite=Strict",
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (cookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

function signCsrfPayload(payload: string) {
  return createHmac("sha256", csrfSecret).update(payload, "utf8").digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminCsrfToken(sessionId: string) {
  const payload = Buffer.from(
    JSON.stringify({ sessionId, nonce: randomBytes(24).toString("base64url") }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${signCsrfPayload(payload)}`;
}

export function validateAdminCsrfToken(token: string, expectedSessionId?: string) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !constantTimeEqual(signature, signCsrfPayload(payload))) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sessionId?: unknown;
      nonce?: unknown;
    };
    return (
      typeof parsed.sessionId === "string" &&
      typeof parsed.nonce === "string" &&
      (!expectedSessionId || parsed.sessionId === expectedSessionId)
    );
  } catch {
    return false;
  }
}

export function readAdminRefreshToken(request: FastifyRequest) {
  return parseCookies(request).get(REFRESH_COOKIE);
}

export function readAdminCsrfToken(request: FastifyRequest) {
  return parseCookies(request).get(CSRF_COOKIE);
}

export function requireAdminCsrf(request: FastifyRequest, expectedSessionId?: string) {
  const cookieToken = readAdminCsrfToken(request);
  const headerToken = readHeader(request.headers["x-admin-csrf"]);
  if (
    !cookieToken ||
    !headerToken ||
    !constantTimeEqual(cookieToken, headerToken) ||
    !validateAdminCsrfToken(cookieToken, expectedSessionId)
  ) {
    throw new AppError(403, "ADMIN_CSRF_INVALID", "Admin CSRF validation failed");
  }
  return cookieToken;
}

export function setAdminSessionCookies(
  reply: FastifyReply,
  session: AuthSessionResponse,
  csrfToken: string
) {
  const refreshMaxAge = Math.max(
    1,
    Math.floor((new Date(session.session.refreshTokenExpiresAt).getTime() - Date.now()) / 1000)
  );
  reply.header("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, session.tokens.accessToken, {
      httpOnly: true,
      maxAgeSeconds: session.tokens.expiresInSeconds,
    }),
    serializeCookie(REFRESH_COOKIE, session.tokens.refreshToken, {
      httpOnly: true,
      maxAgeSeconds: refreshMaxAge,
    }),
    serializeCookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      maxAgeSeconds: refreshMaxAge,
    }),
  ]);
}

export function setAdminCsrfCookie(reply: FastifyReply, csrfToken: string, maxAgeSeconds: number) {
  reply.header(
    "Set-Cookie",
    serializeCookie(CSRF_COOKIE, csrfToken, { httpOnly: false, maxAgeSeconds })
  );
}

export function clearAdminSessionCookies(reply: FastifyReply) {
  reply.header("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, "", { httpOnly: true, maxAgeSeconds: 0 }),
    serializeCookie(REFRESH_COOKIE, "", { httpOnly: true, maxAgeSeconds: 0 }),
    serializeCookie(CSRF_COOKIE, "", { httpOnly: false, maxAgeSeconds: 0 }),
  ]);
}
