import { createHash, createHmac, createPrivateKey, randomUUID, sign as signWithKey } from "node:crypto";
import * as http from "node:http";
import * as https from "node:https";
import type { ApiRuntimeConfig } from "@lingban/config";
import {
  credentialAuditEventSchema,
  type CredentialAuditEventAction,
  type CredentialStatus,
} from "@lingban/contracts";
import { nowIso, toErrorMessage } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { credentialAuditRepository } from "./audit-repository.js";
import { credentialLifecycleCallbackRepository } from "./callback-repository.js";
import type {
  CredentialLifecycleCallbackDelivery,
  CredentialLifecycleCallbackDeliveryStatus,
  StoredCredentialRecord,
} from "./storage-schema.js";

type LifecycleCallbackTargetStatus = Extract<CredentialStatus, "disabled" | "revoked">;

type DispatchLifecycleCallbackInput = {
  record: StoredCredentialRecord;
  nextStatus: LifecycleCallbackTargetStatus;
  action: CredentialAuditEventAction;
  actorUserId?: string | null;
  runId?: string | null;
  traceId?: string | null;
  reasonCode?: string | null;
  reasonDetail?: string | null;
};

type CredentialLifecycleCallbackMetrics = {
  deliveriesCreatedTotal: number;
  deliveriesAttemptedTotal: number;
  deliveriesSucceededTotal: number;
  deliveriesFailedTotal: number;
  deliveriesExhaustedTotal: number;
  sweepRunsTotal: number;
  sweepFailuresTotal: number;
};

type CredentialLifecycleCallbackLastSweep = {
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  dryRun: boolean;
  requestedProvider: string | null;
  requestedCredentialId: string | null;
  scannedCount: number;
  eligibleCount: number;
  attemptedCount: number;
  succeededCount: number;
  failedCount: number;
  exhaustedCount: number;
  errorMessage: string | null;
};

export type CredentialLifecycleCallbackDiagnostics = {
  sweeperActive: boolean;
  sweepIntervalMs: number;
  maxAttempts: number;
  backoffMs: number;
  configuredProviders: Array<{
    provider: string;
    url: string;
    method: "POST";
    timeoutMs: number;
    statuses: Array<"disabled" | "revoked">;
    headerNames: string[];
    authMode: "none" | "bearer" | "hmac-sha256" | "oauth-client-credentials";
    authHeaderNames: string[];
    callbackMtlsEnabled: boolean;
    tokenMtlsEnabled: boolean;
    payloadEventType: string;
    payloadEventVersion: number;
  }>;
  metrics: CredentialLifecycleCallbackMetrics;
  lastSweep: CredentialLifecycleCallbackLastSweep;
  recentDeliveries: CredentialLifecycleCallbackDelivery[];
};

type SweepNowOptions = {
  provider?: string;
  credentialId?: string;
  dryRun?: boolean;
};

type CallbackDispatchConfig = ApiRuntimeConfig["credentialLifecycleCallbacks"][string];
type CallbackDispatchAuthConfig = CallbackDispatchConfig["auth"];
type OauthClientCredentialsAuthConfig = Extract<
  CallbackDispatchAuthConfig,
  { type: "oauth-client-credentials" }
>;
type CachedOauthAccessToken = {
  accessToken: string;
  scheme: string;
  expiresAtMs: number;
};
type CallbackTlsConfig = NonNullable<CallbackDispatchConfig["transport"]["callbackTls"]>;
type RequestTransportTlsConfig = CallbackTlsConfig | null;
type HttpRequestInput = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  tls: RequestTransportTlsConfig;
};

function createEmptyLastSweep(): CredentialLifecycleCallbackLastSweep {
  return {
    startedAt: null,
    completedAt: null,
    durationMs: null,
    dryRun: false,
    requestedProvider: null,
    requestedCredentialId: null,
    scannedCount: 0,
    eligibleCount: 0,
    attemptedCount: 0,
    succeededCount: 0,
    failedCount: 0,
    exhaustedCount: 0,
    errorMessage: null,
  };
}

function buildCallbackUrlSummary(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return value;
  }
}

function truncateForAudit(value: string | null | undefined, maxLength = 300) {
  if (!value) {
    return null;
  }

  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function computeSha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function encodeBase64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function buildPrivateKeyJwtAssertion(
  tokenUrl: string,
  auth: Extract<
  OauthClientCredentialsAuthConfig["clientAuthentication"],
  { method: "private_key_jwt" }
>
) {
  const issuedAtSeconds = Math.floor(Date.now() / 1_000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    ...(auth.keyId ? { kid: auth.keyId } : {}),
  };
  const payload = {
    iss: auth.issuer ?? auth.clientId,
    sub: auth.subject ?? auth.clientId,
    aud: auth.audience ?? tokenUrl,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + auth.assertionLifetimeSeconds,
    jti: `clcca_${randomUUID()}`,
  };
  const signingInput = `${encodeBase64UrlJson(header)}.${encodeBase64UrlJson(payload)}`;
  const signature = signWithKey(
    "RSA-SHA256",
    Buffer.from(signingInput, "utf8"),
    createPrivateKey(auth.privateKeyPem)
  ).toString("base64url");
  return `${signingInput}.${signature}`;
}

function computeOauthTokenCacheExpiry(
  auth: OauthClientCredentialsAuthConfig,
  expiresInSeconds: number | null
) {
  const ttlSeconds = expiresInSeconds ?? auth.tokenDefaultExpiresInSeconds;
  const refreshSkewSeconds = Math.min(auth.tokenRefreshSkewSeconds, Math.max(0, ttlSeconds - 1));
  return Date.now() + Math.max(1, ttlSeconds - refreshSkewSeconds) * 1_000;
}

function resolveOAuthResponseStringField(
  payload: unknown,
  fieldName: string
) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as Record<string, unknown>)[fieldName];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveOAuthResponseExpiresInSeconds(
  payload: unknown,
  fieldName: string
) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as Record<string, unknown>)[fieldName];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function resolveTransportTlsConfig(
  transport: CallbackDispatchConfig["transport"],
  target: "callback" | "token"
) {
  if (target === "callback") {
    return transport.callbackTls;
  }

  return transport.tokenTls ?? transport.callbackTls;
}

async function sendHttpRequest(input: HttpRequestInput) {
  return await new Promise<{
    statusCode: number;
    statusMessage: string;
    responseText: string;
  }>((resolve, reject) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.url);
    } catch (error) {
      reject(error);
      return;
    }

    const isHttps = parsedUrl.protocol === "https:";
    const requestModule = isHttps ? https : http;
    const options: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : undefined,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: input.method,
      headers: input.headers,
    };

    if (isHttps && input.tls) {
      options.rejectUnauthorized = input.tls.rejectUnauthorized;
      options.ca = input.tls.caPem ?? undefined;
      options.cert = input.tls.certPem ?? undefined;
      options.key = input.tls.keyPem ?? undefined;
      options.passphrase = input.tls.passphrase ?? undefined;
      options.servername = input.tls.serverName ?? undefined;
    }

    const request = requestModule.request(options, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          statusMessage: response.statusMessage ?? "",
          responseText: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    request.once("error", reject);
    request.setTimeout(input.timeoutMs, () => {
      request.destroy(Object.assign(new Error("request timed out"), { code: "REQUEST_TIMEOUT" }));
    });

    if (input.body) {
      request.write(input.body);
    }

    request.end();
  });
}

function computeNextAttemptAt(attemptCount: number) {
  const config = getApiRuntimeConfig();
  const delayMs = config.credentialLifecycleCallbackBackoffMs * 2 ** Math.max(0, attemptCount - 1);
  return new Date(Date.now() + delayMs).toISOString();
}

function isEligibleDeliveryStatus(status: CredentialLifecycleCallbackDeliveryStatus) {
  return status === "pending" || status === "failed";
}

function isEligibleForAttempt(delivery: CredentialLifecycleCallbackDelivery, nowMs = Date.now()) {
  if (!isEligibleDeliveryStatus(delivery.status)) {
    return false;
  }

  if (delivery.attemptCount >= delivery.maxAttempts) {
    return false;
  }

  if (!delivery.nextAttemptAt) {
    return true;
  }

  const nextAttemptAtMs = Date.parse(delivery.nextAttemptAt);
  return Number.isFinite(nextAttemptAtMs) ? nextAttemptAtMs <= nowMs : true;
}

function buildLifecycleCallbackPayload(
  delivery: CredentialLifecycleCallbackDelivery,
  input: DispatchLifecycleCallbackInput,
  config: CallbackDispatchConfig
) {
  const payload = {
    eventType: config.payload.eventType,
    eventVersion: config.payload.eventVersion,
    deliveryId: delivery.deliveryId,
    occurredAt: delivery.updatedAt,
    action: input.action,
    targetStatus: input.nextStatus,
    provider: delivery.provider,
    credential: {
      credentialId: delivery.credentialId,
      workspaceId: delivery.workspaceId,
      ownerUserId: delivery.ownerUserId,
      scope: delivery.scope,
      displayName: delivery.displayName,
      provider: delivery.provider,
      secretKind: delivery.secretKind,
      mountMode: delivery.mountMode,
      brokerKind: delivery.brokerKind,
      activeKeyId: delivery.activeKeyId,
      secretVersion: delivery.secretVersion,
      redactedSecretRef: delivery.redactedSecretRef,
      statusBefore: delivery.statusBefore,
      statusAfter: delivery.statusAfter,
    },
    actor: {
      userId: input.actorUserId ?? null,
      runId: input.runId ?? null,
      traceId: input.traceId ?? null,
    },
    reason: {
      code: input.reasonCode ?? null,
      detail: input.reasonDetail ?? null,
    },
  };

  if (config.payload.includeAttemptMetadata) {
    return {
      ...payload,
      delivery: {
        attempt: delivery.attemptCount,
        maxAttempts: delivery.maxAttempts,
      },
    };
  }

  return payload;
}

async function requestOauthClientCredentialsAccessToken(
  auth: OauthClientCredentialsAuthConfig,
  tls: RequestTransportTlsConfig
) {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(auth.additionalBody)) {
    body.set(key, value);
  }

  body.set("grant_type", "client_credentials");
  if (auth.scope) {
    body.set("scope", auth.scope);
  }
  if (auth.audience) {
    body.set("audience", auth.audience);
  }
  if (auth.resource) {
    body.set("resource", auth.resource);
  }

  switch (auth.clientAuthentication.method) {
    case "client_secret_post":
      body.set("client_id", auth.clientAuthentication.clientId);
      body.set("client_secret", auth.clientAuthentication.clientSecret);
      break;
    case "client_secret_basic":
      headers.authorization = `Basic ${Buffer.from(
        `${auth.clientAuthentication.clientId}:${auth.clientAuthentication.clientSecret}`,
        "utf8"
      ).toString("base64")}`;
      break;
    case "private_key_jwt":
      body.set("client_id", auth.clientAuthentication.clientId);
      body.set(
        "client_assertion_type",
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
      );
      body.set(
        "client_assertion",
        buildPrivateKeyJwtAssertion(auth.tokenUrl, auth.clientAuthentication)
      );
      break;
  }

  try {
    const response = await sendHttpRequest({
      url: auth.tokenUrl,
      method: "POST",
      headers,
      body: body.toString(),
      timeoutMs: auth.tokenRequestTimeoutMs,
      tls,
    });
    const responseText = response.responseText;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const error = new Error(
        `oauth token endpoint responded ${response.statusCode} ${response.statusMessage}: ${truncateForAudit(responseText) ?? "<empty>"}`
      ) as Error & { code?: string; httpStatus?: number };
      error.code = `CALLBACK_OAUTH_HTTP_${response.statusCode}`;
      error.httpStatus = response.statusCode;
      throw error;
    }

    let payload: unknown = null;
    try {
      payload = responseText ? (JSON.parse(responseText) as unknown) : null;
    } catch (error) {
      const parseError = new Error(
        `oauth token endpoint returned invalid JSON: ${toErrorMessage(error)}`
      ) as Error & { code?: string };
      parseError.code = "CALLBACK_OAUTH_INVALID_JSON";
      throw parseError;
    }

    const accessToken = resolveOAuthResponseStringField(payload, "access_token");
    if (!accessToken) {
      const invalidResponseError = new Error(
        `oauth token endpoint response is missing access_token: ${truncateForAudit(responseText) ?? "<empty>"}`
      ) as Error & { code?: string };
      invalidResponseError.code = "CALLBACK_OAUTH_TOKEN_MISSING";
      throw invalidResponseError;
    }

    return {
      accessToken,
      scheme: resolveOAuthResponseStringField(payload, "token_type") ?? auth.scheme,
      expiresAtMs: computeOauthTokenCacheExpiry(
        auth,
        resolveOAuthResponseExpiresInSeconds(payload, "expires_in")
      ),
    } satisfies CachedOauthAccessToken;
  } catch (error) {
    if (
      error instanceof Error &&
      ("code" in error ? (error as Error & { code?: string }).code === "REQUEST_TIMEOUT" : false)
    ) {
      const timeoutError = new Error("oauth token request timed out") as Error & { code?: string };
      timeoutError.code = "CALLBACK_OAUTH_TIMEOUT";
      throw timeoutError;
    }

    throw error;
  }
}

async function buildLifecycleCallbackHeaders(input: {
  config: CallbackDispatchConfig;
  delivery: CredentialLifecycleCallbackDelivery;
  payloadBody: string;
  resolveOauthAccessToken: (config: CallbackDispatchConfig) => Promise<CachedOauthAccessToken>;
}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...input.config.headers,
    "x-lingban-delivery-id": input.delivery.deliveryId,
    "x-lingban-event-type": input.config.payload.eventType,
    "x-lingban-event-version": String(input.config.payload.eventVersion),
  };

  if (input.config.payload.includeAttemptMetadata) {
    headers["x-lingban-delivery-attempt"] = String(input.delivery.attemptCount);
    headers["x-lingban-delivery-max-attempts"] = String(input.delivery.maxAttempts);
  }

  switch (input.config.auth.type) {
    case "none":
      break;
    case "bearer":
      headers[input.config.auth.headerName] = `${input.config.auth.scheme} ${input.config.auth.token}`;
      break;
    case "hmac-sha256": {
      const timestamp = nowIso();
      const payloadHash = computeSha256Hex(input.payloadBody);
      const signature = createHmac("sha256", input.config.auth.secret)
        .update(`${timestamp}.${payloadHash}`)
        .digest("hex");
      headers[input.config.auth.timestampHeaderName] = timestamp;
      headers[input.config.auth.payloadHashHeaderName] = payloadHash;
      headers[input.config.auth.headerName] = `${input.config.auth.signaturePrefix}${signature}`;
      if (input.config.auth.keyId) {
        headers[input.config.auth.keyIdHeaderName] = input.config.auth.keyId;
      }
      break;
    }
    case "oauth-client-credentials": {
      const token = await input.resolveOauthAccessToken(input.config);
      headers[input.config.auth.headerName] = `${token.scheme} ${token.accessToken}`;
      break;
    }
  }

  return headers;
}

async function dispatchHttpCallback(input: {
  config: CallbackDispatchConfig;
  payloadBody: string;
  headers: Record<string, string>;
}) {
  try {
    const response = await sendHttpRequest({
      url: input.config.url,
      method: input.config.method,
      headers: input.headers,
      body: input.payloadBody,
      timeoutMs: input.config.timeoutMs,
      tls: resolveTransportTlsConfig(input.config.transport, "callback"),
    });
    const responseText = response.responseText;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const error = new Error(
        `callback responded ${response.statusCode} ${response.statusMessage}: ${truncateForAudit(responseText) ?? "<empty>"}`
      ) as Error & { code?: string; httpStatus?: number };
      error.code = `CALLBACK_HTTP_${response.statusCode}`;
      error.httpStatus = response.statusCode;
      throw error;
    }

    return {
      httpStatus: response.statusCode,
      responseText: truncateForAudit(responseText),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      ("code" in error ? (error as Error & { code?: string }).code === "REQUEST_TIMEOUT" : false)
    ) {
      const timeoutError = new Error("callback request timed out") as Error & {
        code?: string;
        httpStatus?: number;
      };
      timeoutError.code = "CALLBACK_TIMEOUT";
      throw timeoutError;
    }

    throw error;
  }
}

export class CredentialLifecycleCallbackManager {
  #sweeperActive = false;
  #sweepTimer: NodeJS.Timeout | null = null;
  #sweepInFlight: Promise<CredentialLifecycleCallbackLastSweep> | null = null;
  #oauthTokenCache = new WeakMap<object, CachedOauthAccessToken>();
  #metrics: CredentialLifecycleCallbackMetrics = {
    deliveriesCreatedTotal: 0,
    deliveriesAttemptedTotal: 0,
    deliveriesSucceededTotal: 0,
    deliveriesFailedTotal: 0,
    deliveriesExhaustedTotal: 0,
    sweepRunsTotal: 0,
    sweepFailuresTotal: 0,
  };
  #lastSweep: CredentialLifecycleCallbackLastSweep = createEmptyLastSweep();

  getDiagnostics(): CredentialLifecycleCallbackDiagnostics {
    const config = getApiRuntimeConfig();
    const configuredProviders = Object.entries(
      config.credentialLifecycleCallbacks
    ) as Array<[string, CallbackDispatchConfig]>;
    return {
      sweeperActive: this.#sweeperActive,
      sweepIntervalMs: config.credentialLifecycleCallbackSweepIntervalMs,
      maxAttempts: config.credentialLifecycleCallbackMaxAttempts,
      backoffMs: config.credentialLifecycleCallbackBackoffMs,
      configuredProviders: configuredProviders
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([provider, entry]) => ({
          provider,
          url: buildCallbackUrlSummary(entry.url),
          method: entry.method,
          timeoutMs: entry.timeoutMs,
          statuses: [...entry.statuses],
          headerNames: Object.keys(entry.headers).sort((left, right) => left.localeCompare(right)),
          authMode: entry.auth.type,
          authHeaderNames:
            entry.auth.type === "none"
              ? []
              : entry.auth.type === "bearer"
                ? [entry.auth.headerName]
                : entry.auth.type === "hmac-sha256"
                  ? [
                      entry.auth.headerName,
                      entry.auth.timestampHeaderName,
                      entry.auth.payloadHashHeaderName,
                      ...(entry.auth.keyId ? [entry.auth.keyIdHeaderName] : []),
                    ].sort((left, right) => left.localeCompare(right))
                  : [entry.auth.headerName],
          callbackMtlsEnabled: Boolean(
            entry.transport.callbackTls?.certPem && entry.transport.callbackTls?.keyPem
          ),
          tokenMtlsEnabled: Boolean(
            (entry.transport.tokenTls ?? entry.transport.callbackTls)?.certPem &&
              (entry.transport.tokenTls ?? entry.transport.callbackTls)?.keyPem
          ),
          payloadEventType: entry.payload.eventType,
          payloadEventVersion: entry.payload.eventVersion,
        })),
      metrics: {
        ...this.#metrics,
      },
      lastSweep: {
        ...this.#lastSweep,
      },
      recentDeliveries: credentialLifecycleCallbackRepository.list().slice(0, 20),
    };
  }

  async dispatchForTransition(input: DispatchLifecycleCallbackInput) {
    const config = this.#resolveConfigForProvider(input.record.provider, input.nextStatus);
    if (!config) {
      return null;
    }

    const createdAt = nowIso();
    const delivery = await credentialLifecycleCallbackRepository.save({
      deliveryId: `clcd_${randomUUID()}`,
      credentialId: input.record.credentialId,
      workspaceId: input.record.workspaceId,
      provider: input.record.provider,
      ownerUserId: input.record.ownerUserId,
      scope: input.record.scope,
      displayName: input.record.displayName,
      secretKind: input.record.secretKind,
      mountMode: input.record.mountMode,
      brokerKind: input.record.secretEnvelope?.brokerKind ?? input.record.brokerKind ?? null,
      activeKeyId: input.record.secretEnvelope?.keyId ?? input.record.activeKeyId ?? null,
      redactedSecretRef: input.record.redactedSecretRef ?? null,
      callbackUrl: config.url,
      callbackMethod: config.method,
      targetStatus: input.nextStatus,
      triggerAction: input.action,
      actorUserId: input.actorUserId ?? null,
      runId: input.runId ?? null,
      traceId: input.traceId ?? null,
      statusBefore: input.record.status,
      statusAfter: input.nextStatus,
      secretVersion: input.record.secretVersion,
      status: "pending",
      attemptCount: 0,
      maxAttempts: getApiRuntimeConfig().credentialLifecycleCallbackMaxAttempts,
      nextAttemptAt: createdAt,
      lastAttemptAt: null,
      completedAt: null,
      lastHttpStatus: null,
      lastErrorCode: null,
      lastErrorDetail: null,
      createdAt,
      updatedAt: createdAt,
    });
    this.#metrics.deliveriesCreatedTotal += 1;

    return await this.#attemptDelivery(delivery, input, config);
  }

  async sweepNow(options: SweepNowOptions = {}) {
    const startedAt = nowIso();
    const startedAtMs = Date.now();
    const dryRun = options.dryRun ?? false;
    const result: CredentialLifecycleCallbackLastSweep = {
      startedAt,
      completedAt: null,
      durationMs: null,
      dryRun,
      requestedProvider: options.provider ?? null,
      requestedCredentialId: options.credentialId ?? null,
      scannedCount: 0,
      eligibleCount: 0,
      attemptedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      exhaustedCount: 0,
      errorMessage: null,
    };

    this.#metrics.sweepRunsTotal += 1;

    try {
      const deliveries = credentialLifecycleCallbackRepository
        .list()
        .filter(
          (delivery) =>
            (!options.provider || delivery.provider === options.provider) &&
            (!options.credentialId || delivery.credentialId === options.credentialId)
        );
      result.scannedCount = deliveries.length;

      const eligible = deliveries.filter((delivery) => isEligibleForAttempt(delivery));
      result.eligibleCount = eligible.length;

      if (!dryRun) {
        for (const delivery of eligible) {
          result.attemptedCount += 1;
          const saved = await this.#retrySavedDelivery(delivery);
          if (saved.status === "succeeded") {
            result.succeededCount += 1;
          } else if (saved.status === "exhausted") {
            result.exhaustedCount += 1;
            result.failedCount += 1;
          } else if (saved.status === "failed") {
            result.failedCount += 1;
          }
        }
      }
    } catch (error) {
      result.errorMessage = toErrorMessage(error);
      this.#metrics.sweepFailuresTotal += 1;
    }

    result.completedAt = nowIso();
    result.durationMs = Math.max(0, Date.now() - startedAtMs);
    this.#lastSweep = result;
    return result;
  }

  #scheduleNextSweep() {
    if (!this.#sweeperActive) {
      return;
    }

    this.#sweepTimer = setTimeout(() => {
      this.#sweepInFlight = this.sweepNow()
        .catch(() => this.#lastSweep)
        .finally(() => {
          this.#sweepInFlight = null;
          this.#scheduleNextSweep();
        });
    }, getApiRuntimeConfig().credentialLifecycleCallbackSweepIntervalMs);
    this.#sweepTimer.unref?.();
  }

  startSweeper() {
    if (this.#sweeperActive) {
      return;
    }

    this.#sweeperActive = true;
    this.#sweepInFlight = this.sweepNow()
      .catch(() => this.#lastSweep)
      .finally(() => {
        this.#sweepInFlight = null;
        this.#scheduleNextSweep();
      });
  }

  async stopSweeper() {
    this.#sweeperActive = false;
    if (this.#sweepTimer) {
      clearTimeout(this.#sweepTimer);
      this.#sweepTimer = null;
    }

    await this.#sweepInFlight?.catch(() => undefined);
  }

  async #resolveOauthAccessToken(config: CallbackDispatchConfig) {
    if (config.auth.type !== "oauth-client-credentials") {
      throw new Error("OAuth access token can only be resolved for oauth-client-credentials auth");
    }

    const auth = config.auth;
    const cached = this.#oauthTokenCache.get(auth);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached;
    }

    const next = await requestOauthClientCredentialsAccessToken(
      auth,
      resolveTransportTlsConfig(config.transport, "token")
    );
    this.#oauthTokenCache.set(auth, next);
    return next;
  }

  #resolveConfigForProvider(provider: string, targetStatus: LifecycleCallbackTargetStatus) {
    const config = getApiRuntimeConfig().credentialLifecycleCallbacks[provider];
    if (!config) {
      return null;
    }

    return config.statuses.includes(targetStatus) ? config : null;
  }

  async #retrySavedDelivery(delivery: CredentialLifecycleCallbackDelivery) {
    const config = this.#resolveConfigForProvider(delivery.provider, delivery.targetStatus);
    if (!config) {
      const updatedAt = nowIso();
      const exhausted =
        delivery.attemptCount + 1 >= delivery.maxAttempts || delivery.maxAttempts <= 1;
      const next = await credentialLifecycleCallbackRepository.save({
        ...delivery,
        status: exhausted ? "exhausted" : "failed",
        updatedAt,
        lastAttemptAt: updatedAt,
        attemptCount: delivery.attemptCount + 1,
        nextAttemptAt: exhausted ? null : computeNextAttemptAt(delivery.attemptCount + 1),
        completedAt: exhausted ? updatedAt : delivery.completedAt,
        lastErrorCode: "CALLBACK_CONFIG_MISSING",
        lastErrorDetail: `No lifecycle callback config is available for provider ${delivery.provider}.`,
      });
      this.#metrics.deliveriesAttemptedTotal += 1;
      this.#metrics.deliveriesFailedTotal += 1;
      if (next.status === "exhausted") {
        this.#metrics.deliveriesExhaustedTotal += 1;
      }
      return next;
    }

    const input: DispatchLifecycleCallbackInput = {
      record: {
        credentialId: delivery.credentialId,
        workspaceId: delivery.workspaceId,
        ownerUserId: delivery.ownerUserId,
        scope: delivery.scope,
        displayName: delivery.displayName,
        provider: delivery.provider,
        secretKind: delivery.secretKind,
        mountMode: delivery.mountMode,
        status: delivery.statusBefore,
        brokerKind: delivery.brokerKind,
        activeKeyId: delivery.activeKeyId,
        secretVersion: delivery.secretVersion,
        redactedSecretRef: delivery.redactedSecretRef,
        expiresAt: null,
        lastRotatedAt: null,
        lastMaterializedAt: null,
        rotationDueAt: null,
        notes: null,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
        envName: null,
        mountPathTemplate: null,
        secretRef: null,
        secretEnvelope: null,
        lastMaterializationLeaseId: null,
        activeRunGraceIssuedAt: null,
      },
      nextStatus: delivery.targetStatus,
      action: delivery.triggerAction as CredentialAuditEventAction,
      actorUserId: delivery.actorUserId,
      runId: delivery.runId,
      traceId: delivery.traceId,
    };

    return await this.#attemptDelivery(delivery, input, config);
  }

  async #attemptDelivery(
    delivery: CredentialLifecycleCallbackDelivery,
    input: DispatchLifecycleCallbackInput,
    config: CallbackDispatchConfig
  ) {
    const attemptAt = nowIso();
    const inFlight = await credentialLifecycleCallbackRepository.save({
      ...delivery,
      attemptCount: delivery.attemptCount + 1,
      lastAttemptAt: attemptAt,
      updatedAt: attemptAt,
      nextAttemptAt: null,
    });

    this.#metrics.deliveriesAttemptedTotal += 1;

    try {
      const payloadBody = JSON.stringify(buildLifecycleCallbackPayload(inFlight, input, config));
      const response = await dispatchHttpCallback({
        config,
        payloadBody,
        headers: await buildLifecycleCallbackHeaders({
          config,
          delivery: inFlight,
          payloadBody,
          resolveOauthAccessToken: (callbackConfig) => this.#resolveOauthAccessToken(callbackConfig),
        }),
      });
      const completedAt = nowIso();
      const succeeded = await credentialLifecycleCallbackRepository.save({
        ...inFlight,
        status: "succeeded",
        completedAt,
        nextAttemptAt: null,
        lastHttpStatus: response.httpStatus,
        lastErrorCode: null,
        lastErrorDetail: response.responseText,
        updatedAt: completedAt,
      });
      this.#metrics.deliveriesSucceededTotal += 1;
      await this.#recordAuditEvent({
        delivery: succeeded,
        action: "lifecycle-callback-sent",
        outcome: "success",
        reasonCode: null,
        reasonDetail: `POST ${buildCallbackUrlSummary(succeeded.callbackUrl)} responded ${response.httpStatus}.`,
      });
      return succeeded;
    } catch (error) {
      const code =
        error instanceof Error && "code" in error && typeof error.code === "string"
          ? error.code
          : "CALLBACK_REQUEST_FAILED";
      const httpStatus =
        error instanceof Error && "httpStatus" in error && typeof error.httpStatus === "number"
          ? error.httpStatus
          : null;
      const message = truncateForAudit(toErrorMessage(error));
      const exhausted = inFlight.attemptCount >= inFlight.maxAttempts;
      const failedAt = nowIso();
      const failed = await credentialLifecycleCallbackRepository.save({
        ...inFlight,
        status: exhausted ? "exhausted" : "failed",
        nextAttemptAt: exhausted ? null : computeNextAttemptAt(inFlight.attemptCount),
        completedAt: exhausted ? failedAt : inFlight.completedAt,
        lastHttpStatus: httpStatus,
        lastErrorCode: code,
        lastErrorDetail: message,
        updatedAt: failedAt,
      });
      this.#metrics.deliveriesFailedTotal += 1;
      if (failed.status === "exhausted") {
        this.#metrics.deliveriesExhaustedTotal += 1;
      }
      await this.#recordAuditEvent({
        delivery: failed,
        action: "lifecycle-callback-failed",
        outcome: "blocked",
        reasonCode: code,
        reasonDetail: message,
      });
      return failed;
    }
  }

  async #recordAuditEvent(input: {
    delivery: CredentialLifecycleCallbackDelivery;
    action: Extract<CredentialAuditEventAction, "lifecycle-callback-sent" | "lifecycle-callback-failed">;
    outcome: "success" | "blocked";
    reasonCode: string | null;
    reasonDetail: string | null;
  }) {
    await credentialAuditRepository.save(
      credentialAuditEventSchema.parse({
        eventId: `cdae_${randomUUID()}`,
        credentialId: input.delivery.credentialId,
        workspaceId: input.delivery.workspaceId,
        actorUserId: input.delivery.actorUserId,
        runId: input.delivery.runId,
        leaseId: null,
        action: input.action,
        outcome: input.outcome,
        statusBefore: input.delivery.statusBefore,
        statusAfter: input.delivery.statusAfter,
        secretVersion: input.delivery.secretVersion,
        mountMode: null,
        reasonCode: input.reasonCode,
        reasonDetail: input.reasonDetail,
        traceId: input.delivery.traceId,
        occurredAt: nowIso(),
      })
    );
  }
}

export const credentialLifecycleCallbackManager = new CredentialLifecycleCallbackManager();
