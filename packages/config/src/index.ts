import path from "node:path";
import { z } from "zod";

type EnvSource = Record<string, string | undefined>;

const nonEmptyStringSchema = z.string().trim().min(1);
const positiveIntegerSchema = z.number().int().positive();
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const storageDriverSchema = z.enum(["file", "postgres"]);
const authModeSchema = z.enum(["disabled", "required"]);
const runtimeLaunchModeSchema = z.enum(["local-process", "docker"]);
const runtimeDispatchModeSchema = z.enum(["embedded", "bullmq"]);
const objectStorageDriverSchema = z.enum(["filesystem", "s3"]);
const fileScanModeSchema = z.enum(["disabled", "builtin", "clamav"]);
const fileScanErrorPolicySchema = z.enum(["allow", "block"]);
const sessionPackSignatureAlgorithmSchema = z.enum(["sha256", "hmac-sha256", "ed25519"]);
const sessionPackSignatureDistributionTargetChannelSchema = z.enum([
  "api",
  "worker",
  "bridge",
  "external",
]);
const sessionPackSignatureDistributionTargetConfigSchema = z.object({
  targetId: nonEmptyStringSchema,
  displayName: nonEmptyStringSchema.default("Signature target"),
  displayNameZh: nonEmptyStringSchema.nullable().default(null),
  displayNameEn: nonEmptyStringSchema.nullable().default(null),
  channel: sessionPackSignatureDistributionTargetChannelSchema.default("external"),
  acceptedKeyIds: z.array(nonEmptyStringSchema).default([]),
  activeKeyId: nonEmptyStringSchema.nullable().default(null),
  lastReportedAt: z.string().datetime().nullable().default(null),
});
const credentialBrokerProviderSchema = z.enum([
  "local-envelope",
  "vault-transit-http",
  "aws-kms-envelope",
]);
const credentialLifecycleCallbackStatusSchema = z.enum(["disabled", "revoked"]);
const credentialLifecycleCallbackMethodSchema = z.enum(["POST"]);
const credentialLifecycleCallbackOauthClientAuthenticationSchema = z.discriminatedUnion(
  "method",
  [
    z.object({
      method: z.literal("client_secret_post"),
      clientId: nonEmptyStringSchema,
      clientSecret: nonEmptyStringSchema,
    }),
    z.object({
      method: z.literal("client_secret_basic"),
      clientId: nonEmptyStringSchema,
      clientSecret: nonEmptyStringSchema,
    }),
    z.object({
      method: z.literal("private_key_jwt"),
      clientId: nonEmptyStringSchema,
      privateKeyPem: nonEmptyStringSchema,
      keyId: nonEmptyStringSchema.nullable().default(null),
      issuer: nonEmptyStringSchema.nullable().default(null),
      subject: nonEmptyStringSchema.nullable().default(null),
      audience: z.string().url().nullable().default(null),
      assertionLifetimeSeconds: positiveIntegerSchema.default(300),
    }),
  ]
);
const credentialLifecycleCallbackAuthSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("none"),
  }),
  z.object({
    type: z.literal("bearer"),
    token: nonEmptyStringSchema,
    headerName: nonEmptyStringSchema.default("authorization"),
    scheme: nonEmptyStringSchema.default("Bearer"),
  }),
  z.object({
    type: z.literal("hmac-sha256"),
    secret: nonEmptyStringSchema,
    headerName: nonEmptyStringSchema.default("x-lingban-signature"),
    timestampHeaderName: nonEmptyStringSchema.default("x-lingban-signature-timestamp"),
    payloadHashHeaderName: nonEmptyStringSchema.default("x-lingban-payload-sha256"),
      signaturePrefix: nonEmptyStringSchema.default("sha256="),
      keyId: nonEmptyStringSchema.nullable().default(null),
      keyIdHeaderName: nonEmptyStringSchema.default("x-lingban-signature-key-id"),
    }),
    z.object({
      type: z.literal("oauth-client-credentials"),
      tokenUrl: z.string().url(),
      headerName: nonEmptyStringSchema.default("authorization"),
      scheme: nonEmptyStringSchema.default("Bearer"),
      scope: nonEmptyStringSchema.nullable().default(null),
      audience: nonEmptyStringSchema.nullable().default(null),
      resource: nonEmptyStringSchema.nullable().default(null),
      additionalBody: z.record(z.string(), nonEmptyStringSchema).default({}),
      tokenRequestTimeoutMs: positiveIntegerSchema.default(5_000),
      tokenDefaultExpiresInSeconds: positiveIntegerSchema.default(60),
      tokenRefreshSkewSeconds: positiveIntegerSchema.default(30),
      clientAuthentication: credentialLifecycleCallbackOauthClientAuthenticationSchema,
    }),
  ]);
const credentialLifecycleCallbackPayloadSchema = z.object({
  eventType: nonEmptyStringSchema.default("credential.lifecycle.changed"),
  eventVersion: positiveIntegerSchema.default(1),
  includeAttemptMetadata: z.boolean().default(true),
});
const credentialLifecycleCallbackTlsSchema = z
  .object({
    rejectUnauthorized: z.boolean().default(true),
    caPem: nonEmptyStringSchema.nullable().default(null),
    certPem: nonEmptyStringSchema.nullable().default(null),
    keyPem: nonEmptyStringSchema.nullable().default(null),
    passphrase: nonEmptyStringSchema.nullable().default(null),
    serverName: nonEmptyStringSchema.nullable().default(null),
  })
  .superRefine((value, context) => {
    const hasCert = Boolean(value.certPem);
    const hasKey = Boolean(value.keyPem);

    if (hasCert !== hasKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "certPem and keyPem must be provided together",
      });
    }
  });
const credentialLifecycleCallbackTransportSchema = z.object({
  callbackTls: credentialLifecycleCallbackTlsSchema.nullable().default(null),
  tokenTls: credentialLifecycleCallbackTlsSchema.nullable().default(null),
});
const credentialLifecycleCallbackConfigSchema = z.object({
  url: z.string().url(),
  method: credentialLifecycleCallbackMethodSchema.default("POST"),
  headers: z.record(z.string(), nonEmptyStringSchema).default({}),
  timeoutMs: positiveIntegerSchema.default(5_000),
  statuses: z
    .array(credentialLifecycleCallbackStatusSchema)
    .min(1)
    .default(["disabled", "revoked"]),
  auth: credentialLifecycleCallbackAuthSchema.default({
    type: "none",
  }),
  payload: credentialLifecycleCallbackPayloadSchema.default({
    eventType: "credential.lifecycle.changed",
    eventVersion: 1,
    includeAttemptMetadata: true,
  }),
  transport: credentialLifecycleCallbackTransportSchema.default({
    callbackTls: null,
    tokenTls: null,
  }),
});
const credentialLifecycleCallbacksSchema = z.record(
  z.string(),
  credentialLifecycleCallbackConfigSchema
);

function resolveStorageDriver(
  explicit: string | undefined,
  fallback: "file" | "postgres"
) {
  return storageDriverSchema.parse(explicit ?? fallback);
}

function readTrimmed(env: EnvSource, key: string) {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readPositiveInteger(env: EnvSource, key: string, fallback: number) {
  const value = readTrimmed(env, key);
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return positiveIntegerSchema.parse(parsed);
}

function readNonNegativeInteger(env: EnvSource, key: string, fallback: number) {
  const value = readTrimmed(env, key);
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return nonNegativeIntegerSchema.parse(parsed);
}

function readOptionalPositiveInteger(env: EnvSource, key: string) {
  const value = readTrimmed(env, key);
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return positiveIntegerSchema.parse(parsed);
}

function readBoolean(env: EnvSource, key: string, fallback: boolean) {
  const value = readTrimmed(env, key);
  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  throw new Error(`${key} must be a boolean-like value`);
}

function readCommandArgs(env: EnvSource, key: string) {
  const value = readTrimmed(env, key);
  if (!value) {
    return undefined;
  }

  if (value.startsWith("[")) {
    const parsed = JSON.parse(value) as unknown;
    return z.array(nonEmptyStringSchema).parse(parsed);
  }

  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readStringList(env: EnvSource, key: string, fallback: string[]) {
  const value = readTrimmed(env, key);
  if (!value) {
    return [...fallback];
  }

  if (value.startsWith("[")) {
    const parsed = JSON.parse(value) as unknown;
    return z.array(nonEmptyStringSchema).parse(parsed);
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readJsonObject(
  env: EnvSource,
  key: string
): Record<string, string> | undefined {
  const value = readTrimmed(env, key);
  if (!value) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;
  return z.record(z.string(), nonEmptyStringSchema).parse(parsed);
}

function resolveFromCwd(value: string | undefined, fallbackSegments: string[]) {
  return path.resolve(value ?? path.join(process.cwd(), ...fallbackSegments));
}

function resolveOptionalPath(value: string | undefined) {
  return value ? path.resolve(value) : undefined;
}

function resolveCurrentProcessUid() {
  return typeof process.getuid === "function" ? process.getuid() : undefined;
}

function resolveCurrentProcessGid() {
  return typeof process.getgid === "function" ? process.getgid() : undefined;
}

export type ApiRuntimeConfig = {
  host: string;
  port: number;
  storageRoot: string;
  databaseUrl?: string;
  catalogStore: "file" | "postgres";
  workshopCatalogStore: "file" | "postgres";
  creatorStore: "file" | "postgres";
  runsStore: "file" | "postgres";
  batchRunsStore: "file" | "postgres";
  runEventsStore: "file" | "postgres";
  internalCallbacksStore: "file" | "postgres";
  authStore: "file" | "postgres";
  uploadsStore: "file" | "postgres";
  runFilesStore: "file" | "postgres";
  bridgeRegistryStore: "file" | "postgres";
  credentialsStore: "file" | "postgres";
  mcpStore: "file" | "postgres";
  quotaStore: "file" | "postgres";
  billingStore: "file" | "postgres";
  notificationsStore: "file" | "postgres";
  favoritesStore: "file" | "postgres";
  recentStore: "file" | "postgres";
  searchStore: "file" | "postgres";
  sessionArchivesStore: "file" | "postgres";
  sessionPackSignatureEnabled: boolean;
  sessionPackSignatureRequireForImports: boolean;
  sessionPackSignatureAlgorithm: "sha256" | "hmac-sha256" | "ed25519";
  sessionPackSignatureKeyId?: string;
  sessionPackSignatureHmacSecret?: string;
  sessionPackSignatureHmacKeysByKeyId: Record<string, string>;
  sessionPackSignatureEd25519PrivateKeyPem?: string;
  sessionPackSignatureEd25519PublicKeyPem?: string;
  sessionPackSignatureEd25519PublicKeysByKeyId: Record<string, string>;
  sessionPackSignatureDistributionTargets: Array<{
    targetId: string;
    displayName: string;
    displayNameZh: string | null;
    displayNameEn: string | null;
    channel: "api" | "worker" | "bridge" | "external";
    acceptedKeyIds: string[];
    activeKeyId: string | null;
    lastReportedAt: string | null;
  }>;
  sessionPackSignatureDistributionStaleAfterMs: number;
  sessionPackGovernancePolicyRequireApprovedRedactionReviewForRedactedExport: boolean;
  sessionPackGovernancePolicyRequireApprovedRedactionReviewForPublish: boolean;
  sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForRedactedExport: boolean;
  sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForPublish: boolean;
  sessionPackGovernancePolicyRequireCompleteSecretCoverageForRedactedExport: boolean;
  sessionPackGovernancePolicyRequireCompleteSecretCoverageForPublish: boolean;
  sessionPackGovernancePolicyRequireVerifiedSignatureForInherit: boolean;
  sessionPackGovernancePolicyRequireVerifiedSignatureForPublish: boolean;
  sessionPackGovernancePolicyRequireVerifiedSignatureForRollback: boolean;
  sessionPackGovernancePolicyRequireSignatureKeyAcceptedForPublish: boolean;
  sessionPackGovernancePolicyRequireSignatureKeyAcceptedForRollback: boolean;
  sessionPackGovernancePolicyRequireSignatureKeyDistributionForPublish: boolean;
  sessionPackGovernancePolicyRequireSignatureKeyDistributionForRollback: boolean;
  sessionPackGovernancePolicyWarnOnActiveSigningKeyDistributionDrift: boolean;
  sessionPackGovernancePolicyWarnOnUnpublishWithLiveConsumers: boolean;
  authMode: "disabled" | "required";
  authAccessTokenTtlSeconds: number;
  authRefreshTokenTtlSeconds: number;
  objectStorageDriver: "filesystem" | "s3";
  objectStorageRoot: string;
  objectStorageBucket?: string;
  objectStorageRegion?: string;
  objectStorageEndpoint?: string;
  objectStorageAccessKeyId?: string;
  objectStorageSecretAccessKey?: string;
  objectStorageSessionToken?: string;
  objectStorageForcePathStyle: boolean;
  objectStorageSignedUrlTtlSeconds: number;
  uploadMaxBytes: number;
  downloadTicketTtlSeconds: number;
  storageRetentionSweepIntervalMs: number;
  downloadTicketRetentionSeconds: number;
  unattachedUploadTtlSeconds: number;
  expiredUploadRetentionSeconds: number;
  runFileLifecycleSweepIntervalMs: number;
  runFileArchiveHotRetentionSeconds: number;
  runFileArchivePrefix: string;
  runFileArchiveSources: string[];
  fileScanMode: "disabled" | "builtin" | "clamav";
  fileScanErrorPolicy: "allow" | "block";
  fileScanTimeoutMs: number;
  fileScanBlockedExtensions: string[];
  fileScanBlockedMimePrefixes: string[];
  fileScanBlockMacroEnabledOffice: boolean;
  fileScanClamavHost?: string;
  fileScanClamavPort: number;
  bridgeRegistrationStaleAfterMs: number;
  bridgeRegistrationSweepIntervalMs: number;
  workerOpsBaseUrl?: string;
  workerOpsToken?: string;
  workerOpsProbeTimeoutMs: number;
  bridgeControlProbeTimeoutMs: number;
  mcpProbeTimeoutMs: number;
  mcpStdioAllowedPathPrefixes: string[];
  mcpStdioRequireRefSha256: boolean;
  credentialBrokerProvider: "local-envelope" | "vault-transit-http" | "aws-kms-envelope";
  credentialBrokerActiveKeyId: string;
  credentialBrokerKeys: Record<string, string>;
  credentialBrokerLeaseTtlSeconds: number;
  credentialBrokerUsesDefaultKey: boolean;
  credentialBrokerRequestTimeoutMs: number;
  credentialBrokerAwsRegion?: string;
  credentialBrokerAwsKmsKeyId?: string;
  credentialBrokerAwsEndpoint?: string;
  credentialBrokerAwsAccessKeyId?: string;
  credentialBrokerAwsSecretAccessKey?: string;
  credentialBrokerAwsSessionToken?: string;
  credentialBrokerVaultBaseUrl?: string;
  credentialBrokerVaultToken?: string;
  credentialBrokerVaultNamespace?: string;
  credentialBrokerVaultTransitMount: string;
  credentialBrokerVaultKeyType: string;
  credentialLifecycleSweepIntervalMs: number;
  credentialLifecycleCallbacks: Record<
    string,
    {
      url: string;
      method: "POST";
      headers: Record<string, string>;
      timeoutMs: number;
      statuses: Array<"disabled" | "revoked">;
        auth:
          | {
              type: "none";
            }
          | {
            type: "bearer";
            token: string;
            headerName: string;
            scheme: string;
          }
        | {
            type: "hmac-sha256";
            secret: string;
            headerName: string;
            timestampHeaderName: string;
              payloadHashHeaderName: string;
              signaturePrefix: string;
              keyId: string | null;
              keyIdHeaderName: string;
            }
          | {
              type: "oauth-client-credentials";
              tokenUrl: string;
              headerName: string;
              scheme: string;
              scope: string | null;
              audience: string | null;
              resource: string | null;
              additionalBody: Record<string, string>;
              tokenRequestTimeoutMs: number;
              tokenDefaultExpiresInSeconds: number;
              tokenRefreshSkewSeconds: number;
              clientAuthentication:
                | {
                    method: "client_secret_post";
                    clientId: string;
                    clientSecret: string;
                  }
                | {
                    method: "client_secret_basic";
                    clientId: string;
                    clientSecret: string;
                  }
                | {
                    method: "private_key_jwt";
                    clientId: string;
                    privateKeyPem: string;
                    keyId: string | null;
                    issuer: string | null;
                    subject: string | null;
                    audience: string | null;
                    assertionLifetimeSeconds: number;
                  };
            };
        payload: {
          eventType: string;
          eventVersion: number;
          includeAttemptMetadata: boolean;
        };
        transport: {
          callbackTls: {
            rejectUnauthorized: boolean;
            caPem: string | null;
            certPem: string | null;
            keyPem: string | null;
            passphrase: string | null;
            serverName: string | null;
          } | null;
          tokenTls: {
            rejectUnauthorized: boolean;
            caPem: string | null;
            certPem: string | null;
            keyPem: string | null;
            passphrase: string | null;
            serverName: string | null;
          } | null;
        };
      }
    >;
  credentialLifecycleCallbackSweepIntervalMs: number;
  credentialLifecycleCallbackMaxAttempts: number;
  credentialLifecycleCallbackBackoffMs: number;
  bridgeCommand?: string;
  bridgeArgs?: string[];
  codexBin?: string;
  internalAuthToken?: string;
};

export function loadApiRuntimeConfig(env: EnvSource = process.env): ApiRuntimeConfig {
  const host = readTrimmed(env, "API_HOST") ?? "127.0.0.1";
  const port = readPositiveInteger(env, "API_PORT", 3100);
  const objectStorageDriver = objectStorageDriverSchema.parse(
    readTrimmed(env, "LINGBAN_OBJECT_STORAGE_DRIVER") ?? "filesystem"
  );
  const objectStorageBucket = readTrimmed(env, "LINGBAN_OBJECT_STORAGE_BUCKET");
  const objectStorageRegion = readTrimmed(env, "LINGBAN_OBJECT_STORAGE_REGION");

  if (objectStorageDriver === "s3" && !objectStorageBucket) {
    throw new Error("LINGBAN_OBJECT_STORAGE_BUCKET is required when driver=s3");
  }

  if (objectStorageDriver === "s3" && !objectStorageRegion) {
    throw new Error("LINGBAN_OBJECT_STORAGE_REGION is required when driver=s3");
  }

  const catalogStore = storageDriverSchema.parse(readTrimmed(env, "LINGBAN_CATALOG_STORE") ?? "file");
  const runsStore = storageDriverSchema.parse(readTrimmed(env, "LINGBAN_RUNS_STORE") ?? "file");
  const runEventsStore = storageDriverSchema.parse(
    readTrimmed(env, "LINGBAN_RUN_EVENTS_STORE") ?? "file"
  );
  const legacyAuxStoreFallback =
    runsStore === "postgres" || runEventsStore === "postgres" ? "postgres" : "file";
  const creatorStore = resolveStorageDriver(readTrimmed(env, "LINGBAN_CREATOR_STORE"), catalogStore);
  const authStore = resolveStorageDriver(readTrimmed(env, "LINGBAN_AUTH_STORE"), legacyAuxStoreFallback);
  const credentialBrokerProvider = credentialBrokerProviderSchema.parse(
    readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_PROVIDER") ?? "local-envelope"
  );
  const sessionPackSignatureEnabled = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_SIGNATURE_ENABLED",
    false
  );
  const sessionPackSignatureRequireForImports = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_SIGNATURE_REQUIRE_FOR_IMPORTS",
    false
  );
  const sessionPackSignatureAlgorithm = sessionPackSignatureAlgorithmSchema.parse(
    readTrimmed(env, "LINGBAN_SESSION_PACK_SIGNATURE_ALGORITHM") ?? "hmac-sha256"
  );
  const sessionPackSignatureKeyId = readTrimmed(env, "LINGBAN_SESSION_PACK_SIGNATURE_KEY_ID");
  const sessionPackSignatureHmacSecret = readTrimmed(
    env,
    "LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET"
  );
  const sessionPackSignatureHmacKeysByKeyId = {
    ...(readJsonObject(env, "LINGBAN_SESSION_PACK_SIGNATURE_HMAC_KEYS_JSON") ?? {}),
    ...(sessionPackSignatureKeyId && sessionPackSignatureHmacSecret
      ? {
          [sessionPackSignatureKeyId]: sessionPackSignatureHmacSecret,
        }
      : {}),
  };
  const sessionPackSignatureEd25519PrivateKeyPem = readTrimmed(
    env,
    "LINGBAN_SESSION_PACK_SIGNATURE_ED25519_PRIVATE_KEY_PEM"
  );
  const sessionPackSignatureEd25519PublicKeyPem = readTrimmed(
    env,
    "LINGBAN_SESSION_PACK_SIGNATURE_ED25519_PUBLIC_KEY_PEM"
  );
  const sessionPackSignatureEd25519PublicKeysByKeyId = {
    ...(readJsonObject(env, "LINGBAN_SESSION_PACK_SIGNATURE_ED25519_PUBLIC_KEYS_JSON") ?? {}),
    ...(sessionPackSignatureKeyId && sessionPackSignatureEd25519PublicKeyPem
      ? {
          [sessionPackSignatureKeyId]: sessionPackSignatureEd25519PublicKeyPem,
        }
      : {}),
  };
  const sessionPackSignatureDistributionTargets = z
    .array(sessionPackSignatureDistributionTargetConfigSchema)
    .parse(
      (() => {
        const raw = readTrimmed(
          env,
          "LINGBAN_SESSION_PACK_SIGNATURE_DISTRIBUTION_TARGETS_JSON"
        );
        if (!raw) {
          return [];
        }

        return JSON.parse(raw) as unknown;
      })()
    );
  const sessionPackSignatureDistributionStaleAfterMs = readPositiveInteger(
    env,
    "LINGBAN_SESSION_PACK_SIGNATURE_DISTRIBUTION_STALE_AFTER_MS",
    86_400_000
  );
  const sessionPackGovernancePolicyRequireApprovedRedactionReviewForRedactedExport = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_APPROVED_REDACTION_REVIEW_FOR_REDACTED_EXPORT",
    true
  );
  const sessionPackGovernancePolicyRequireApprovedRedactionReviewForPublish = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_APPROVED_REDACTION_REVIEW_FOR_PUBLISH",
    true
  );
  const sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForRedactedExport = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_SUCCESSFUL_REDACTION_PREVIEW_FOR_REDACTED_EXPORT",
    true
  );
  const sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForPublish = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_SUCCESSFUL_REDACTION_PREVIEW_FOR_PUBLISH",
    true
  );
  const sessionPackGovernancePolicyRequireCompleteSecretCoverageForRedactedExport = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_COMPLETE_SECRET_COVERAGE_FOR_REDACTED_EXPORT",
    true
  );
  const sessionPackGovernancePolicyRequireCompleteSecretCoverageForPublish = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_COMPLETE_SECRET_COVERAGE_FOR_PUBLISH",
    true
  );
  const sessionPackGovernancePolicyRequireVerifiedSignatureForInherit = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_VERIFIED_SIGNATURE_FOR_INHERIT",
    true
  );
  const sessionPackGovernancePolicyRequireVerifiedSignatureForPublish = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_VERIFIED_SIGNATURE_FOR_PUBLISH",
    true
  );
  const sessionPackGovernancePolicyRequireVerifiedSignatureForRollback = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_VERIFIED_SIGNATURE_FOR_ROLLBACK",
    true
  );
  const sessionPackGovernancePolicyRequireSignatureKeyAcceptedForPublish = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_SIGNATURE_KEY_ACCEPTED_FOR_PUBLISH",
    true
  );
  const sessionPackGovernancePolicyRequireSignatureKeyAcceptedForRollback = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_SIGNATURE_KEY_ACCEPTED_FOR_ROLLBACK",
    true
  );
  const sessionPackGovernancePolicyRequireSignatureKeyDistributionForPublish = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_SIGNATURE_KEY_DISTRIBUTION_FOR_PUBLISH",
    true
  );
  const sessionPackGovernancePolicyRequireSignatureKeyDistributionForRollback = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_REQUIRE_SIGNATURE_KEY_DISTRIBUTION_FOR_ROLLBACK",
    true
  );
  const sessionPackGovernancePolicyWarnOnActiveSigningKeyDistributionDrift = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_WARN_ON_ACTIVE_SIGNING_KEY_DISTRIBUTION_DRIFT",
    true
  );
  const sessionPackGovernancePolicyWarnOnUnpublishWithLiveConsumers = readBoolean(
    env,
    "LINGBAN_SESSION_PACK_POLICY_WARN_ON_UNPUBLISH_WITH_LIVE_CONSUMERS",
    true
  );
  const credentialBrokerAwsRegion =
    readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_AWS_REGION") ??
    readTrimmed(env, "AWS_REGION") ??
    readTrimmed(env, "AWS_DEFAULT_REGION");
  const credentialBrokerAwsKmsKeyId = readTrimmed(
    env,
    "LINGBAN_CREDENTIAL_BROKER_AWS_KMS_KEY_ID"
  );
  const credentialBrokerAwsEndpoint = readTrimmed(
    env,
    "LINGBAN_CREDENTIAL_BROKER_AWS_ENDPOINT"
  );
  const credentialBrokerAwsAccessKeyId =
    readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_AWS_ACCESS_KEY_ID") ??
    readTrimmed(env, "AWS_ACCESS_KEY_ID");
  const credentialBrokerAwsSecretAccessKey =
    readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_AWS_SECRET_ACCESS_KEY") ??
    readTrimmed(env, "AWS_SECRET_ACCESS_KEY");
  const credentialBrokerAwsSessionToken =
    readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_AWS_SESSION_TOKEN") ??
    readTrimmed(env, "AWS_SESSION_TOKEN");
  const credentialBrokerActiveKeyId =
    readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_ACTIVE_KEY_ID") ??
    (() => {
      if (credentialBrokerProvider === "vault-transit-http") {
        return "lingban-main";
      }

      if (credentialBrokerProvider === "aws-kms-envelope") {
        return credentialBrokerAwsKmsKeyId ?? "lingban-kms-main";
      }

      return "local-dev";
    })();
  const credentialBrokerKeys =
    credentialBrokerProvider === "local-envelope"
      ? readJsonObject(env, "LINGBAN_CREDENTIAL_BROKER_KEYS_JSON") ??
        (() => {
          const singleKey = readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_MASTER_KEY");
          if (singleKey) {
            return {
              [credentialBrokerActiveKeyId]: singleKey,
            };
          }

          return {
            [credentialBrokerActiveKeyId]: "lingban-dev-master-key",
          };
        })()
      : {};
  const credentialBrokerUsesDefaultKey =
    credentialBrokerProvider === "local-envelope" &&
    !readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_KEYS_JSON") &&
    !readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_MASTER_KEY");
  const credentialBrokerVaultBaseUrl = readTrimmed(
    env,
    "LINGBAN_CREDENTIAL_BROKER_VAULT_BASE_URL"
  );
  const credentialBrokerVaultToken = readTrimmed(
    env,
    "LINGBAN_CREDENTIAL_BROKER_VAULT_TOKEN"
  );
  const credentialBrokerVaultNamespace = readTrimmed(
    env,
    "LINGBAN_CREDENTIAL_BROKER_VAULT_NAMESPACE"
  );
  const credentialBrokerVaultTransitMount =
    readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_VAULT_TRANSIT_MOUNT") ?? "transit";
  const credentialBrokerVaultKeyType =
    readTrimmed(env, "LINGBAN_CREDENTIAL_BROKER_VAULT_KEY_TYPE") ?? "aes256-gcm96";
  const credentialLifecycleCallbacks = credentialLifecycleCallbacksSchema.parse(
    (() => {
      const raw = readTrimmed(env, "LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACKS_JSON");
      if (!raw) {
        return {};
      }

      return JSON.parse(raw) as unknown;
    })()
  );

  if (credentialBrokerProvider === "vault-transit-http" && !credentialBrokerVaultBaseUrl) {
    throw new Error(
      "LINGBAN_CREDENTIAL_BROKER_VAULT_BASE_URL is required when provider=vault-transit-http"
    );
  }

  if (credentialBrokerProvider === "vault-transit-http" && !credentialBrokerVaultToken) {
    throw new Error(
      "LINGBAN_CREDENTIAL_BROKER_VAULT_TOKEN is required when provider=vault-transit-http"
    );
  }

  if (credentialBrokerProvider === "aws-kms-envelope" && !credentialBrokerAwsRegion) {
    throw new Error(
      "LINGBAN_CREDENTIAL_BROKER_AWS_REGION or AWS_REGION is required when provider=aws-kms-envelope"
    );
  }

  if (credentialBrokerProvider === "aws-kms-envelope" && !credentialBrokerAwsKmsKeyId) {
    throw new Error(
      "LINGBAN_CREDENTIAL_BROKER_AWS_KMS_KEY_ID is required when provider=aws-kms-envelope"
    );
  }

  if (
    credentialBrokerProvider === "aws-kms-envelope" &&
    credentialBrokerAwsAccessKeyId &&
    !credentialBrokerAwsSecretAccessKey
  ) {
    throw new Error(
      "LINGBAN_CREDENTIAL_BROKER_AWS_SECRET_ACCESS_KEY is required when AWS access key id is configured"
    );
  }

  if (
    credentialBrokerProvider === "aws-kms-envelope" &&
    !credentialBrokerAwsAccessKeyId &&
    credentialBrokerAwsSecretAccessKey
  ) {
    throw new Error(
      "LINGBAN_CREDENTIAL_BROKER_AWS_ACCESS_KEY_ID is required when AWS secret access key is configured"
    );
  }
  const fileScanMode = fileScanModeSchema.parse(
    readTrimmed(env, "LINGBAN_FILE_SCAN_MODE") ?? "builtin"
  );
  const fileScanClamavHost = readTrimmed(env, "LINGBAN_FILE_SCAN_CLAMAV_HOST");

  if (fileScanMode === "clamav" && !fileScanClamavHost) {
    throw new Error("LINGBAN_FILE_SCAN_CLAMAV_HOST is required when file scan mode=clamav");
  }

  if (
    (sessionPackSignatureEnabled || sessionPackSignatureRequireForImports) &&
    sessionPackSignatureAlgorithm === "hmac-sha256" &&
    Object.keys(sessionPackSignatureHmacKeysByKeyId).length === 0
  ) {
    throw new Error(
      "LINGBAN_SESSION_PACK_SIGNATURE_HMAC_SECRET or LINGBAN_SESSION_PACK_SIGNATURE_HMAC_KEYS_JSON is required when session-pack signature algorithm=hmac-sha256"
    );
  }

  if (
    sessionPackSignatureEnabled &&
    sessionPackSignatureAlgorithm === "ed25519" &&
    !sessionPackSignatureEd25519PrivateKeyPem
  ) {
    throw new Error(
      "LINGBAN_SESSION_PACK_SIGNATURE_ED25519_PRIVATE_KEY_PEM is required when session-pack signature signing is enabled with algorithm=ed25519"
    );
  }

  if (
    sessionPackSignatureRequireForImports &&
    sessionPackSignatureAlgorithm === "ed25519" &&
    !sessionPackSignatureEd25519PrivateKeyPem &&
    !sessionPackSignatureEd25519PublicKeyPem &&
    Object.keys(sessionPackSignatureEd25519PublicKeysByKeyId).length === 0
  ) {
    throw new Error(
      "LINGBAN_SESSION_PACK_SIGNATURE_ED25519_PUBLIC_KEY_PEM, LINGBAN_SESSION_PACK_SIGNATURE_ED25519_PUBLIC_KEYS_JSON, or LINGBAN_SESSION_PACK_SIGNATURE_ED25519_PRIVATE_KEY_PEM is required when import verification uses algorithm=ed25519"
    );
  }

  return {
    host,
    port,
    storageRoot: resolveFromCwd(readTrimmed(env, "LINGBAN_DATA_DIR"), [".lingban-data", "api"]),
    databaseUrl: readTrimmed(env, "DATABASE_URL"),
    catalogStore,
    workshopCatalogStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_WORKSHOP_CATALOG_STORE"),
      catalogStore
    ),
    creatorStore,
    runsStore,
    batchRunsStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_BATCH_RUNS_STORE"),
      runsStore
    ),
    runEventsStore,
    internalCallbacksStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_INTERNAL_CALLBACKS_STORE"),
      runEventsStore
    ),
    authStore,
    uploadsStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_UPLOADS_STORE"),
      legacyAuxStoreFallback
    ),
    runFilesStore: resolveStorageDriver(readTrimmed(env, "LINGBAN_RUN_FILES_STORE"), runsStore),
    bridgeRegistryStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_BRIDGE_REGISTRY_STORE"),
      legacyAuxStoreFallback
    ),
    credentialsStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_CREDENTIALS_STORE"),
      legacyAuxStoreFallback
    ),
    mcpStore: resolveStorageDriver(readTrimmed(env, "LINGBAN_MCP_STORE"), catalogStore),
    quotaStore: resolveStorageDriver(readTrimmed(env, "LINGBAN_QUOTA_STORE"), creatorStore),
    billingStore: resolveStorageDriver(readTrimmed(env, "LINGBAN_BILLING_STORE"), creatorStore),
    notificationsStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_NOTIFICATIONS_STORE"),
      authStore
    ),
    favoritesStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_FAVORITES_STORE"),
      authStore
    ),
    recentStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_RECENT_STORE"),
      authStore
    ),
    searchStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_SEARCH_STORE"),
      authStore
    ),
    sessionArchivesStore: resolveStorageDriver(
      readTrimmed(env, "LINGBAN_SESSION_ARCHIVES_STORE"),
      runsStore
    ),
    sessionPackSignatureEnabled,
    sessionPackSignatureRequireForImports,
    sessionPackSignatureAlgorithm,
    sessionPackSignatureKeyId,
    sessionPackSignatureHmacSecret,
    sessionPackSignatureHmacKeysByKeyId,
    sessionPackSignatureEd25519PrivateKeyPem,
    sessionPackSignatureEd25519PublicKeyPem,
    sessionPackSignatureEd25519PublicKeysByKeyId,
    sessionPackSignatureDistributionTargets,
    sessionPackSignatureDistributionStaleAfterMs,
    sessionPackGovernancePolicyRequireApprovedRedactionReviewForRedactedExport,
    sessionPackGovernancePolicyRequireApprovedRedactionReviewForPublish,
    sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForRedactedExport,
    sessionPackGovernancePolicyRequireSuccessfulRedactionPreviewForPublish,
    sessionPackGovernancePolicyRequireCompleteSecretCoverageForRedactedExport,
    sessionPackGovernancePolicyRequireCompleteSecretCoverageForPublish,
    sessionPackGovernancePolicyRequireVerifiedSignatureForInherit,
    sessionPackGovernancePolicyRequireVerifiedSignatureForPublish,
    sessionPackGovernancePolicyRequireVerifiedSignatureForRollback,
    sessionPackGovernancePolicyRequireSignatureKeyAcceptedForPublish,
    sessionPackGovernancePolicyRequireSignatureKeyAcceptedForRollback,
    sessionPackGovernancePolicyRequireSignatureKeyDistributionForPublish,
    sessionPackGovernancePolicyRequireSignatureKeyDistributionForRollback,
    sessionPackGovernancePolicyWarnOnActiveSigningKeyDistributionDrift,
    sessionPackGovernancePolicyWarnOnUnpublishWithLiveConsumers,
    authMode: authModeSchema.parse(readTrimmed(env, "LINGBAN_AUTH_MODE") ?? "required"),
    authAccessTokenTtlSeconds: readPositiveInteger(env, "LINGBAN_AUTH_ACCESS_TTL_SECONDS", 900),
    authRefreshTokenTtlSeconds: readPositiveInteger(
      env,
      "LINGBAN_AUTH_REFRESH_TTL_SECONDS",
      60 * 60 * 24 * 30
    ),
    objectStorageDriver,
    objectStorageRoot: resolveFromCwd(readTrimmed(env, "LINGBAN_OBJECT_STORAGE_ROOT"), [
      ".lingban-data",
      "objects",
    ]),
    objectStorageBucket,
    objectStorageRegion,
    objectStorageEndpoint: readTrimmed(env, "LINGBAN_OBJECT_STORAGE_ENDPOINT"),
    objectStorageAccessKeyId: readTrimmed(env, "LINGBAN_OBJECT_STORAGE_ACCESS_KEY_ID"),
    objectStorageSecretAccessKey: readTrimmed(env, "LINGBAN_OBJECT_STORAGE_SECRET_ACCESS_KEY"),
    objectStorageSessionToken: readTrimmed(env, "LINGBAN_OBJECT_STORAGE_SESSION_TOKEN"),
    objectStorageForcePathStyle: readBoolean(
      env,
      "LINGBAN_OBJECT_STORAGE_FORCE_PATH_STYLE",
      false
    ),
    objectStorageSignedUrlTtlSeconds: readPositiveInteger(
      env,
      "LINGBAN_OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS",
      600
    ),
    uploadMaxBytes: readPositiveInteger(env, "LINGBAN_UPLOAD_MAX_BYTES", 52_428_800),
    downloadTicketTtlSeconds: readPositiveInteger(
      env,
      "LINGBAN_DOWNLOAD_TICKET_TTL_SECONDS",
      600
    ),
    storageRetentionSweepIntervalMs: readPositiveInteger(
      env,
      "LINGBAN_STORAGE_RETENTION_SWEEP_INTERVAL_MS",
      5 * 60 * 1000
    ),
    downloadTicketRetentionSeconds: readPositiveInteger(
      env,
      "LINGBAN_DOWNLOAD_TICKET_RETENTION_SECONDS",
      60 * 60
    ),
    unattachedUploadTtlSeconds: readPositiveInteger(
      env,
      "LINGBAN_UNATTACHED_UPLOAD_TTL_SECONDS",
      60 * 60 * 24
    ),
    expiredUploadRetentionSeconds: readPositiveInteger(
      env,
      "LINGBAN_EXPIRED_UPLOAD_RETENTION_SECONDS",
      60 * 60 * 24 * 7
    ),
    runFileLifecycleSweepIntervalMs: readPositiveInteger(
      env,
      "LINGBAN_RUN_FILE_LIFECYCLE_SWEEP_INTERVAL_MS",
      10 * 60 * 1000
    ),
    runFileArchiveHotRetentionSeconds: readPositiveInteger(
      env,
      "LINGBAN_RUN_FILE_ARCHIVE_HOT_RETENTION_SECONDS",
      60 * 60 * 24
    ),
    runFileArchivePrefix: readTrimmed(env, "LINGBAN_RUN_FILE_ARCHIVE_PREFIX") ?? "archive/run-files",
    runFileArchiveSources: readStringList(env, "LINGBAN_RUN_FILE_ARCHIVE_SOURCES", [
      "runtime-output",
      "archive",
      "log",
      "target-scan",
    ]),
    fileScanMode,
    fileScanErrorPolicy: fileScanErrorPolicySchema.parse(
      readTrimmed(env, "LINGBAN_FILE_SCAN_ERROR_POLICY") ?? "block"
    ),
    fileScanTimeoutMs: readPositiveInteger(
      env,
      "LINGBAN_FILE_SCAN_TIMEOUT_MS",
      10_000
    ),
    fileScanBlockedExtensions: readStringList(env, "LINGBAN_FILE_SCAN_BLOCKED_EXTENSIONS", [
      ".appimage",
      ".bat",
      ".cmd",
      ".com",
      ".cpl",
      ".dll",
      ".exe",
      ".hta",
      ".jar",
      ".js",
      ".jse",
      ".ksh",
      ".msi",
      ".ps1",
      ".psd1",
      ".psm1",
      ".scr",
      ".sh",
      ".vbs",
      ".wsf",
      ".wsh",
      ".zsh",
    ]),
    fileScanBlockedMimePrefixes: readStringList(
      env,
      "LINGBAN_FILE_SCAN_BLOCKED_MIME_PREFIXES",
      [
        "application/x-bat",
        "application/x-dosexec",
        "application/x-executable",
        "application/x-msdownload",
        "application/x-msi",
        "application/x-powershell",
        "application/x-sh",
        "application/x-shellscript",
        "text/x-powershell",
        "text/x-shellscript",
      ]
    ),
    fileScanBlockMacroEnabledOffice: readBoolean(
      env,
      "LINGBAN_FILE_SCAN_BLOCK_MACRO_OFFICE",
      true
    ),
    fileScanClamavHost,
    fileScanClamavPort: readPositiveInteger(
      env,
      "LINGBAN_FILE_SCAN_CLAMAV_PORT",
      3310
    ),
    bridgeRegistrationStaleAfterMs: readPositiveInteger(
      env,
      "LINGBAN_BRIDGE_REGISTRATION_STALE_AFTER_MS",
      20_000
    ),
    bridgeRegistrationSweepIntervalMs: readPositiveInteger(
      env,
      "LINGBAN_BRIDGE_REGISTRATION_SWEEP_INTERVAL_MS",
      5_000
    ),
    workerOpsBaseUrl: readTrimmed(env, "LINGBAN_WORKER_OPS_BASE_URL"),
    workerOpsToken: readTrimmed(env, "LINGBAN_WORKER_OPS_TOKEN"),
    workerOpsProbeTimeoutMs: readPositiveInteger(
      env,
      "LINGBAN_WORKER_OPS_PROBE_TIMEOUT_MS",
      1_000
    ),
    bridgeControlProbeTimeoutMs: readPositiveInteger(
      env,
      "LINGBAN_BRIDGE_CONTROL_PROBE_TIMEOUT_MS",
      1_000
    ),
    mcpProbeTimeoutMs: readPositiveInteger(
      env,
      "LINGBAN_MCP_PROBE_TIMEOUT_MS",
      3_000
    ),
    mcpStdioAllowedPathPrefixes: readStringList(
      env,
      "LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES",
      []
    ),
    mcpStdioRequireRefSha256: readBoolean(
      env,
      "LINGBAN_MCP_STDIO_REQUIRE_REF_SHA256",
      true
    ),
    credentialBrokerProvider,
    credentialBrokerActiveKeyId,
    credentialBrokerKeys,
    credentialBrokerLeaseTtlSeconds: readPositiveInteger(
      env,
      "LINGBAN_CREDENTIAL_BROKER_LEASE_TTL_SECONDS",
      300
    ),
    credentialBrokerUsesDefaultKey,
    credentialBrokerRequestTimeoutMs: readPositiveInteger(
      env,
      "LINGBAN_CREDENTIAL_BROKER_REQUEST_TIMEOUT_MS",
      5_000
    ),
    credentialBrokerAwsRegion,
    credentialBrokerAwsKmsKeyId,
    credentialBrokerAwsEndpoint,
    credentialBrokerAwsAccessKeyId,
    credentialBrokerAwsSecretAccessKey,
    credentialBrokerAwsSessionToken,
    credentialBrokerVaultBaseUrl,
    credentialBrokerVaultToken,
    credentialBrokerVaultNamespace,
    credentialBrokerVaultTransitMount,
    credentialBrokerVaultKeyType,
    credentialLifecycleSweepIntervalMs: readPositiveInteger(
      env,
      "LINGBAN_CREDENTIAL_LIFECYCLE_SWEEP_INTERVAL_MS",
      60_000
    ),
    credentialLifecycleCallbacks,
    credentialLifecycleCallbackSweepIntervalMs: readPositiveInteger(
      env,
      "LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_SWEEP_INTERVAL_MS",
      60_000
    ),
    credentialLifecycleCallbackMaxAttempts: readPositiveInteger(
      env,
      "LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_MAX_ATTEMPTS",
      8
    ),
    credentialLifecycleCallbackBackoffMs: readPositiveInteger(
      env,
      "LINGBAN_CREDENTIAL_LIFECYCLE_CALLBACK_BACKOFF_MS",
      5_000
    ),
    bridgeCommand: readTrimmed(env, "LINGBAN_BRIDGE_COMMAND"),
    bridgeArgs: readCommandArgs(env, "LINGBAN_BRIDGE_ARGS"),
    codexBin: readTrimmed(env, "CODEX_BIN"),
    internalAuthToken: readTrimmed(env, "LINGBAN_INTERNAL_AUTH_TOKEN"),
  } satisfies ApiRuntimeConfig;
}

export type WorkerRuntimeConfig = {
  runsRoot: string;
  containerBridgeCliPath?: string;
  apiBaseUrl: string;
  runtimeApiBaseUrl: string;
  runtimeEgressProxyEnabled: boolean;
  runtimeEgressAllowedBaseUrls: string[];
  runtimeEgressNoProxyHosts: string[];
  runtimeEgressFirewallEnabled: boolean;
  runtimeEgressFirewallAllowDns: boolean;
  internalAuthToken?: string;
  opsHost: string;
  opsPort: number;
  opsToken?: string;
  opsProbeTimeoutMs: number;
  runtimeDispatchMode: "embedded" | "bullmq";
  runtimeLaunchMode: "local-process" | "docker";
  maxConcurrentRuns: number;
  orphanRecoveryGraceMs: number;
  terminalWorkspaceTtlMs: number;
  redisUrl?: string;
  queuePrefix: string;
  runStartQueueName: string;
  runCleanupQueueName: string;
  runStartDlqQueueName: string;
  runCleanupDlqQueueName: string;
  runStartJobAttempts: number;
  runStartJobBackoffMs: number;
  runCleanupJobAttempts: number;
  runCleanupJobBackoffMs: number;
  dockerBin: string;
  runtimeStartupTimeoutMs: number;
  playwrightBrowsersPath: string;
  mcpStdioAllowedPathPrefixes: string[];
  bridgePort: number;
  runnerImage: string;
  runnerCpus: string;
  runnerMemory: string;
  runnerPidsLimit: number;
  runnerNetwork: string;
  runnerDropRootEnabled: boolean;
  runnerUid?: number;
  runnerGid?: number;
};

export function loadWorkerRuntimeConfig(env: EnvSource = process.env): WorkerRuntimeConfig {
  const apiBaseUrl = readTrimmed(env, "LINGBAN_API_BASE_URL") ?? "http://127.0.0.1:3100";
  const runnerDropRootRaw = readTrimmed(env, "LINGBAN_RUNNER_DROP_ROOT_ENABLED");
  const runnerDropRootRequested = runnerDropRootRaw
    ? readBoolean(env, "LINGBAN_RUNNER_DROP_ROOT_ENABLED", true)
    : true;
  const explicitRunnerUid = readOptionalPositiveInteger(env, "LINGBAN_RUNNER_UID");
  const explicitRunnerGid = readOptionalPositiveInteger(env, "LINGBAN_RUNNER_GID");
  if ((explicitRunnerUid == null) !== (explicitRunnerGid == null)) {
    throw new Error("LINGBAN_RUNNER_UID and LINGBAN_RUNNER_GID must be configured together");
  }

  const currentProcessUid = resolveCurrentProcessUid();
  const currentProcessGid = resolveCurrentProcessGid();
  const inferredRunnerUid =
    explicitRunnerUid ?? (currentProcessUid != null && currentProcessUid > 0 ? currentProcessUid : undefined);
  const inferredRunnerGid =
    explicitRunnerGid ?? (currentProcessGid != null && currentProcessGid > 0 ? currentProcessGid : undefined);
  if (
    runnerDropRootRaw &&
    runnerDropRootRequested &&
    (inferredRunnerUid == null || inferredRunnerGid == null)
  ) {
    throw new Error(
      "LINGBAN_RUNNER_DROP_ROOT_ENABLED requires a resolvable runtime uid/gid via LINGBAN_RUNNER_UID/GID or the current worker process identity"
    );
  }
  const runnerDropRootEnabled =
    runnerDropRootRequested && inferredRunnerUid != null && inferredRunnerGid != null;

  return {
    runsRoot: resolveFromCwd(readTrimmed(env, "LINGBAN_RUNS_DIR"), [
      ".lingban-data",
      "worker",
      "runs",
    ]),
    containerBridgeCliPath: resolveOptionalPath(readTrimmed(env, "LINGBAN_CONTAINER_BRIDGE_CLI")),
    apiBaseUrl,
    runtimeApiBaseUrl: readTrimmed(env, "LINGBAN_RUNTIME_API_BASE_URL") ?? apiBaseUrl,
    runtimeEgressProxyEnabled: readBoolean(
      env,
      "LINGBAN_RUNTIME_EGRESS_PROXY_ENABLED",
      false
    ),
    runtimeEgressAllowedBaseUrls: readStringList(
      env,
      "LINGBAN_RUNTIME_EGRESS_ALLOWED_BASE_URLS",
      []
    ),
    runtimeEgressNoProxyHosts: readStringList(
      env,
      "LINGBAN_RUNTIME_EGRESS_NO_PROXY_HOSTS",
      ["127.0.0.1", "localhost", "host.docker.internal"]
    ),
    runtimeEgressFirewallEnabled: readBoolean(
      env,
      "LINGBAN_RUNTIME_EGRESS_FIREWALL_ENABLED",
      false
    ),
    runtimeEgressFirewallAllowDns: readBoolean(
      env,
      "LINGBAN_RUNTIME_EGRESS_FIREWALL_ALLOW_DNS",
      true
    ),
    internalAuthToken: readTrimmed(env, "LINGBAN_INTERNAL_AUTH_TOKEN"),
    opsHost: readTrimmed(env, "LINGBAN_WORKER_OPS_HOST") ?? "127.0.0.1",
    opsPort: readPositiveInteger(env, "LINGBAN_WORKER_OPS_PORT", 3901),
    opsToken: readTrimmed(env, "LINGBAN_WORKER_OPS_TOKEN"),
    opsProbeTimeoutMs: readPositiveInteger(
      env,
      "LINGBAN_WORKER_OPS_PROBE_TIMEOUT_MS",
      1_000
    ),
    runtimeDispatchMode: runtimeDispatchModeSchema.parse(
      readTrimmed(env, "LINGBAN_RUNTIME_DISPATCH_MODE") ?? "embedded"
    ),
    runtimeLaunchMode: runtimeLaunchModeSchema.parse(
      readTrimmed(env, "LINGBAN_RUNTIME_LAUNCH_MODE") ?? "docker"
    ),
    maxConcurrentRuns: readPositiveInteger(env, "LINGBAN_RUNTIME_MAX_CONCURRENT_RUNS", 2),
    orphanRecoveryGraceMs: readPositiveInteger(
      env,
      "LINGBAN_RUNTIME_ORPHAN_GRACE_MS",
      15_000
    ),
    terminalWorkspaceTtlMs: readPositiveInteger(
      env,
      "LINGBAN_TERMINAL_WORKSPACE_TTL_MS",
      15 * 60 * 1000
    ),
    redisUrl: readTrimmed(env, "LINGBAN_REDIS_URL"),
    queuePrefix: readTrimmed(env, "LINGBAN_RUNTIME_QUEUE_PREFIX") ?? "lingban",
    runStartQueueName: readTrimmed(env, "LINGBAN_RUNTIME_START_QUEUE_NAME") ?? "run.start",
    runCleanupQueueName:
      readTrimmed(env, "LINGBAN_RUNTIME_CLEANUP_QUEUE_NAME") ?? "run.cleanup",
    runStartDlqQueueName:
      readTrimmed(env, "LINGBAN_RUNTIME_START_DLQ_QUEUE_NAME") ?? "run.start.dlq",
    runCleanupDlqQueueName:
      readTrimmed(env, "LINGBAN_RUNTIME_CLEANUP_DLQ_QUEUE_NAME") ?? "run.cleanup.dlq",
    runStartJobAttempts: readPositiveInteger(env, "LINGBAN_RUNTIME_START_JOB_ATTEMPTS", 3),
    runStartJobBackoffMs: readPositiveInteger(
      env,
      "LINGBAN_RUNTIME_START_JOB_BACKOFF_MS",
      2_000
    ),
    runCleanupJobAttempts: readPositiveInteger(
      env,
      "LINGBAN_RUNTIME_CLEANUP_JOB_ATTEMPTS",
      5
    ),
    runCleanupJobBackoffMs: readPositiveInteger(
      env,
      "LINGBAN_RUNTIME_CLEANUP_JOB_BACKOFF_MS",
      5_000
    ),
    dockerBin: readTrimmed(env, "LINGBAN_DOCKER_BIN") ?? "docker",
    runtimeStartupTimeoutMs: readPositiveInteger(
      env,
      "LINGBAN_RUNTIME_STARTUP_TIMEOUT_MS",
      15_000
    ),
    playwrightBrowsersPath: readTrimmed(env, "LINGBAN_PLAYWRIGHT_BROWSERS_PATH") ?? "/ms-playwright",
    mcpStdioAllowedPathPrefixes: readStringList(
      env,
      "LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES",
      []
    ),
    bridgePort: readPositiveInteger(env, "LINGBAN_BRIDGE_PORT", 3800),
    runnerImage: readTrimmed(env, "LINGBAN_RUNNER_IMAGE") ?? "ghcr.io/lingban/runner:latest",
    runnerCpus: readTrimmed(env, "LINGBAN_RUNNER_CPUS") ?? "2",
    runnerMemory: readTrimmed(env, "LINGBAN_RUNNER_MEMORY") ?? "4g",
    runnerPidsLimit: readPositiveInteger(env, "LINGBAN_RUNNER_PIDS_LIMIT", 512),
    runnerNetwork: readTrimmed(env, "LINGBAN_RUNNER_NETWORK") ?? "lingban-egress-default",
    runnerDropRootEnabled,
    runnerUid: inferredRunnerUid,
    runnerGid: inferredRunnerGid,
  } satisfies WorkerRuntimeConfig;
}

export type BridgeCliRuntimeConfig = {
  contextPath: string;
  runtimeConfigPath?: string;
  runtimeDir?: string;
  outputsPath?: string;
  registrationRefreshMs: number;
  codexRestartMaxAttempts: number;
  codexRestartBackoffMs: number;
  codexRestartResetWindowMs: number;
  externalControlUrl?: string;
  externalControlToken?: string;
  controlHost: string;
  controlPort: number;
  controlToken?: string;
  apiBaseUrl?: string;
  internalAuthToken?: string;
  codexBin?: string;
  codexArgs?: string[];
  mcpStdioAllowedPathPrefixes: string[];
};

export function loadBridgeCliRuntimeConfig(
  env: EnvSource = process.env,
  argv: string[] = process.argv.slice(2)
): BridgeCliRuntimeConfig {
  const contextPath = readTrimmed(env, "BRIDGE_CONTEXT_PATH") ?? argv[0];

  if (!contextPath) {
    throw new Error("BRIDGE_CONTEXT_PATH is required");
  }

  return {
    contextPath,
    runtimeConfigPath: readTrimmed(env, "RUNTIME_CONFIG_PATH"),
    runtimeDir: readTrimmed(env, "RUNTIME_DIR"),
    outputsPath: readTrimmed(env, "OUTPUTS_PATH"),
    registrationRefreshMs: readPositiveInteger(
      env,
      "LINGBAN_BRIDGE_REGISTRATION_REFRESH_MS",
      5_000
    ),
    codexRestartMaxAttempts: readNonNegativeInteger(
      env,
      "LINGBAN_BRIDGE_CODEX_RESTART_MAX_ATTEMPTS",
      2
    ),
    codexRestartBackoffMs: readNonNegativeInteger(
      env,
      "LINGBAN_BRIDGE_CODEX_RESTART_BACKOFF_MS",
      1_000
    ),
    codexRestartResetWindowMs: readNonNegativeInteger(
      env,
      "LINGBAN_BRIDGE_CODEX_RESTART_RESET_WINDOW_MS",
      30_000
    ),
    externalControlUrl: readTrimmed(env, "LINGBAN_BRIDGE_EXTERNAL_CONTROL_URL"),
    externalControlToken: readTrimmed(env, "LINGBAN_BRIDGE_EXTERNAL_CONTROL_TOKEN"),
    controlHost: readTrimmed(env, "BRIDGE_CONTROL_HOST") ?? "127.0.0.1",
    controlPort: readPositiveInteger(env, "BRIDGE_CONTROL_PORT", 3800),
    controlToken: readTrimmed(env, "LINGBAN_BRIDGE_CONTROL_TOKEN"),
    apiBaseUrl: readTrimmed(env, "LINGBAN_API_BASE_URL"),
    internalAuthToken: readTrimmed(env, "LINGBAN_INTERNAL_AUTH_TOKEN"),
    codexBin: readTrimmed(env, "CODEX_BIN"),
    codexArgs: readCommandArgs(env, "CODEX_ARGS_JSON"),
    mcpStdioAllowedPathPrefixes: readStringList(
      env,
      "LINGBAN_MCP_STDIO_ALLOWED_PATH_PREFIXES",
      []
    ),
  } satisfies BridgeCliRuntimeConfig;
}
