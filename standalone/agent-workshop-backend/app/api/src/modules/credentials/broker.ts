import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  DecryptCommand,
  DescribeKeyCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import type { ApiRuntimeConfig } from "@lingban/config";
import type {
  CredentialBrokerKind,
  CredentialSecretEnvelope,
} from "@lingban/contracts";
import {
  awsKmsEnvelopeSecretEnvelopeSchema,
  localEnvelopeSecretEnvelopeSchema,
  vaultTransitSecretEnvelopeSchema,
} from "@lingban/contracts";
import { toErrorMessage } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "aes-256-gcm";
const DEFAULT_DEV_KEY_SEED = "lingban-credential-broker-dev-default-key";

type NormalizedBrokerKey = {
  keyId: string;
  keyBytes: Buffer;
};

type CredentialBrokerReadiness = {
  ready: boolean;
  detail: string | null;
  metadata?: Record<string, unknown>;
};

type SealSecretInput = {
  secretValue: string;
  aad: string;
};

type OpenSecretInput = {
  envelope: CredentialSecretEnvelope;
  aad: string;
};

export interface CredentialBrokerAdapter {
  provider: CredentialBrokerKind;
  activeKeyId: string;
  usesDefaultKey: boolean;
  sealSecret(input: SealSecretInput): Promise<CredentialSecretEnvelope>;
  openSecret(input: OpenSecretInput): Promise<string>;
  checkReadiness(): Promise<CredentialBrokerReadiness>;
}

function decodeKeyMaterial(raw: string) {
  if (raw.startsWith("base64:")) {
    return Buffer.from(raw.slice("base64:".length), "base64");
  }

  if (raw.startsWith("hex:")) {
    return Buffer.from(raw.slice("hex:".length), "hex");
  }

  return Buffer.from(raw, "utf8");
}

function normalizeKeyMaterial(raw: string) {
  const decoded = decodeKeyMaterial(raw);
  if (decoded.length === 32) {
    return decoded;
  }

  return createHash("sha256").update(decoded).digest();
}

function buildNormalizedBrokerKeys(config: ApiRuntimeConfig) {
  const entries = Object.entries(config.credentialBrokerKeys).map(([keyId, raw]) => ({
    keyId,
    keyBytes: normalizeKeyMaterial(raw),
  }));

  if (entries.length === 0) {
    return [
      {
        keyId: config.credentialBrokerActiveKeyId,
        keyBytes: createHash("sha256").update(DEFAULT_DEV_KEY_SEED).digest(),
      },
    ];
  }

  return entries;
}

function buildAwsKmsEncryptionContext(aad: string, keyId: string) {
  return {
    lingbanBroker: "credential",
    lingbanAadSha256: createHash("sha256").update(aad).digest("hex"),
    lingbanKeyId: keyId,
  };
}

function requireBinaryField(value: Uint8Array | undefined, fieldName: string) {
  if (!value || value.length === 0) {
    throw new Error(`AWS KMS response did not include ${fieldName}`);
  }

  return Buffer.from(value);
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

class LocalEnvelopeCredentialBroker implements CredentialBrokerAdapter {
  #activeKeyId: string;
  #keys = new Map<string, Buffer>();
  #usesDefaultKey: boolean;

  constructor(config: ApiRuntimeConfig) {
    this.#activeKeyId = config.credentialBrokerActiveKeyId;
    this.#usesDefaultKey = config.credentialBrokerUsesDefaultKey;

    for (const entry of buildNormalizedBrokerKeys(config)) {
      this.#keys.set(entry.keyId, entry.keyBytes);
    }

    if (!this.#keys.has(this.#activeKeyId)) {
      const fallback = createHash("sha256").update(DEFAULT_DEV_KEY_SEED).digest();
      this.#keys.set(this.#activeKeyId, fallback);
      this.#usesDefaultKey = true;
    }
  }

  get provider() {
    return "local-envelope" as const;
  }

  get activeKeyId() {
    return this.#activeKeyId;
  }

  get usesDefaultKey() {
    return this.#usesDefaultKey;
  }

  async sealSecret(input: SealSecretInput) {
    const keyBytes = this.#keys.get(this.#activeKeyId);
    if (!keyBytes) {
      throw new Error(`Credential broker key is not available: ${this.#activeKeyId}`);
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv(ENVELOPE_ALGORITHM, keyBytes, iv);
    cipher.setAAD(Buffer.from(input.aad, "utf8"));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(input.secretValue, "utf8")),
      cipher.final(),
    ]);

    return localEnvelopeSecretEnvelopeSchema.parse({
      version: ENVELOPE_VERSION,
      brokerKind: this.provider,
      algorithm: ENVELOPE_ALGORITHM,
      keyId: this.#activeKeyId,
      ivBase64: iv.toString("base64"),
      authTagBase64: cipher.getAuthTag().toString("base64"),
      ciphertextBase64: ciphertext.toString("base64"),
    });
  }

  async openSecret(input: OpenSecretInput) {
    const envelope = localEnvelopeSecretEnvelopeSchema.parse(input.envelope);
    const keyBytes = this.#keys.get(envelope.keyId);
    if (!keyBytes) {
      throw new Error(`Credential broker key is not available for decryption: ${envelope.keyId}`);
    }

    const decipher = createDecipheriv(
      envelope.algorithm,
      keyBytes,
      Buffer.from(envelope.ivBase64, "base64")
    );
    decipher.setAAD(Buffer.from(input.aad, "utf8"));
    decipher.setAuthTag(Buffer.from(envelope.authTagBase64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertextBase64, "base64")),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  }

  async checkReadiness() {
    return {
      ready: true,
      detail: null,
      metadata: {
        provider: this.provider,
        activeKeyId: this.#activeKeyId,
        usesDefaultKey: this.#usesDefaultKey,
      },
    } satisfies CredentialBrokerReadiness;
  }
}

class AwsKmsEnvelopeCredentialBroker implements CredentialBrokerAdapter {
  #client: KMSClient;
  #activeKeyId: string;
  #kmsKeyId: string;
  #kmsRegion: string;
  #kmsEndpoint: string | null;
  #timeoutMs: number;

  constructor(config: ApiRuntimeConfig) {
    if (!config.credentialBrokerAwsRegion) {
      throw new Error("AWS KMS broker requires credentialBrokerAwsRegion");
    }

    if (!config.credentialBrokerAwsKmsKeyId) {
      throw new Error("AWS KMS broker requires credentialBrokerAwsKmsKeyId");
    }

    this.#activeKeyId = config.credentialBrokerActiveKeyId;
    this.#kmsKeyId = config.credentialBrokerAwsKmsKeyId;
    this.#kmsRegion = config.credentialBrokerAwsRegion;
    this.#kmsEndpoint = config.credentialBrokerAwsEndpoint ?? null;
    this.#timeoutMs = config.credentialBrokerRequestTimeoutMs;
    this.#client = new KMSClient({
      region: this.#kmsRegion,
      endpoint: this.#kmsEndpoint ?? undefined,
      credentials:
        config.credentialBrokerAwsAccessKeyId && config.credentialBrokerAwsSecretAccessKey
          ? {
              accessKeyId: config.credentialBrokerAwsAccessKeyId,
              secretAccessKey: config.credentialBrokerAwsSecretAccessKey,
              sessionToken: config.credentialBrokerAwsSessionToken,
            }
          : undefined,
      maxAttempts: 1,
    });
  }

  get provider() {
    return "aws-kms-envelope" as const;
  }

  get activeKeyId() {
    return this.#activeKeyId;
  }

  get usesDefaultKey() {
    return false;
  }

  async sealSecret(input: SealSecretInput) {
    const encryptionContext = buildAwsKmsEncryptionContext(input.aad, this.#activeKeyId);
    const response = await this.#client.send(
      new GenerateDataKeyCommand({
        KeyId: this.#kmsKeyId,
        KeySpec: "AES_256",
        EncryptionContext: encryptionContext,
      }),
      {
        abortSignal: AbortSignal.timeout(this.#timeoutMs),
      }
    );
    const dataKey = requireBinaryField(response.Plaintext, "Plaintext");
    const encryptedDataKey = requireBinaryField(response.CiphertextBlob, "CiphertextBlob");

    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv(ENVELOPE_ALGORITHM, dataKey, iv);
      cipher.setAAD(Buffer.from(input.aad, "utf8"));
      const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(input.secretValue, "utf8")),
        cipher.final(),
      ]);

      return awsKmsEnvelopeSecretEnvelopeSchema.parse({
        version: ENVELOPE_VERSION,
        brokerKind: this.provider,
        algorithm: ENVELOPE_ALGORITHM,
        keyId: this.#activeKeyId,
        kmsKeyId: this.#kmsKeyId,
        kmsRegion: this.#kmsRegion,
        encryptedDataKeyBase64: encryptedDataKey.toString("base64"),
        ivBase64: iv.toString("base64"),
        authTagBase64: cipher.getAuthTag().toString("base64"),
        ciphertextBase64: ciphertext.toString("base64"),
      });
    } finally {
      dataKey.fill(0);
    }
  }

  async openSecret(input: OpenSecretInput) {
    const envelope = awsKmsEnvelopeSecretEnvelopeSchema.parse(input.envelope);
    if (envelope.kmsRegion !== this.#kmsRegion) {
      throw new Error(
        `AWS KMS broker region mismatch for ${envelope.keyId}: envelope=${envelope.kmsRegion} runtime=${this.#kmsRegion}`
      );
    }

    const response = await this.#client.send(
      new DecryptCommand({
        KeyId: envelope.kmsKeyId,
        CiphertextBlob: Buffer.from(envelope.encryptedDataKeyBase64, "base64"),
        EncryptionContext: buildAwsKmsEncryptionContext(input.aad, envelope.keyId),
      }),
      {
        abortSignal: AbortSignal.timeout(this.#timeoutMs),
      }
    );
    const dataKey = requireBinaryField(response.Plaintext, "Plaintext");

    try {
      const decipher = createDecipheriv(
        envelope.algorithm,
        dataKey,
        Buffer.from(envelope.ivBase64, "base64")
      );
      decipher.setAAD(Buffer.from(input.aad, "utf8"));
      decipher.setAuthTag(Buffer.from(envelope.authTagBase64, "base64"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertextBase64, "base64")),
        decipher.final(),
      ]);

      return plaintext.toString("utf8");
    } finally {
      dataKey.fill(0);
    }
  }

  async checkReadiness() {
    try {
      const response = await this.#client.send(
        new DescribeKeyCommand({
          KeyId: this.#kmsKeyId,
        }),
        {
          abortSignal: AbortSignal.timeout(this.#timeoutMs),
        }
      );
      const metadata = response.KeyMetadata;
      if (!metadata) {
        return {
          ready: false,
          detail: "AWS KMS DescribeKey response did not include KeyMetadata",
          metadata: {
            provider: this.provider,
            activeKeyId: this.#activeKeyId,
            kmsKeyId: this.#kmsKeyId,
            kmsRegion: this.#kmsRegion,
            kmsEndpoint: this.#kmsEndpoint,
          },
        } satisfies CredentialBrokerReadiness;
      }

      const keyState = metadata.KeyState ?? null;
      const enabled = metadata.Enabled ?? false;
      if (!enabled || (keyState && keyState !== "Enabled")) {
        return {
          ready: false,
          detail: `AWS KMS key is not enabled (${keyState ?? "unknown"})`,
          metadata: {
            provider: this.provider,
            activeKeyId: this.#activeKeyId,
            kmsKeyId: metadata.KeyId ?? this.#kmsKeyId,
            kmsRegion: this.#kmsRegion,
            kmsEndpoint: this.#kmsEndpoint,
            keyArn: metadata.Arn ?? null,
            keyState,
            enabled,
            keyManager: metadata.KeyManager ?? null,
          },
        } satisfies CredentialBrokerReadiness;
      }

      return {
        ready: true,
        detail: null,
        metadata: {
          provider: this.provider,
          activeKeyId: this.#activeKeyId,
          kmsKeyId: metadata.KeyId ?? this.#kmsKeyId,
          kmsRegion: this.#kmsRegion,
          kmsEndpoint: this.#kmsEndpoint,
          keyArn: metadata.Arn ?? null,
          keyState,
          enabled,
          keyManager: metadata.KeyManager ?? null,
          multiRegion: metadata.MultiRegion ?? null,
        },
      } satisfies CredentialBrokerReadiness;
    } catch (error) {
      return {
        ready: false,
        detail: toErrorMessage(error, { abortMessage: "request timed out" }),
        metadata: {
          provider: this.provider,
          activeKeyId: this.#activeKeyId,
          kmsKeyId: this.#kmsKeyId,
          kmsRegion: this.#kmsRegion,
          kmsEndpoint: this.#kmsEndpoint,
        },
      } satisfies CredentialBrokerReadiness;
    }
  }

}

class VaultTransitHttpCredentialBroker implements CredentialBrokerAdapter {
  #baseUrl: string;
  #token: string;
  #namespace: string | null;
  #mount: string;
  #activeKeyId: string;
  #keyType: string;
  #timeoutMs: number;

  constructor(config: ApiRuntimeConfig) {
    if (!config.credentialBrokerVaultBaseUrl) {
      throw new Error("Vault transit broker requires credentialBrokerVaultBaseUrl");
    }

    if (!config.credentialBrokerVaultToken) {
      throw new Error("Vault transit broker requires credentialBrokerVaultToken");
    }

    this.#baseUrl = trimTrailingSlash(config.credentialBrokerVaultBaseUrl);
    this.#token = config.credentialBrokerVaultToken;
    this.#namespace = config.credentialBrokerVaultNamespace ?? null;
    this.#mount = trimSlashes(config.credentialBrokerVaultTransitMount);
    this.#activeKeyId = config.credentialBrokerActiveKeyId;
    this.#keyType = config.credentialBrokerVaultKeyType;
    this.#timeoutMs = config.credentialBrokerRequestTimeoutMs;
  }

  get provider() {
    return "vault-transit-http" as const;
  }

  get activeKeyId() {
    return this.#activeKeyId;
  }

  get usesDefaultKey() {
    return false;
  }

  async sealSecret(input: SealSecretInput) {
    const response = await this.#requestVaultJson(
      "POST",
      `/v1/${this.#mount}/encrypt/${encodeURIComponent(this.#activeKeyId)}`,
      {
        plaintext: Buffer.from(input.secretValue, "utf8").toString("base64"),
        associated_data: Buffer.from(input.aad, "utf8").toString("base64"),
        type: this.#keyType,
      }
    );

    const ciphertext = this.#readNestedString(response, ["data", "ciphertext"]);
    if (!ciphertext) {
      throw new Error("Vault transit encrypt response did not include data.ciphertext");
    }

    return vaultTransitSecretEnvelopeSchema.parse({
      version: ENVELOPE_VERSION,
      brokerKind: this.provider,
      algorithm: "vault-transit",
      keyId: this.#activeKeyId,
      ciphertext,
    });
  }

  async openSecret(input: OpenSecretInput) {
    const envelope = vaultTransitSecretEnvelopeSchema.parse(input.envelope);
    const response = await this.#requestVaultJson(
      "POST",
      `/v1/${this.#mount}/decrypt/${encodeURIComponent(envelope.keyId)}`,
      {
        ciphertext: envelope.ciphertext,
        associated_data: Buffer.from(input.aad, "utf8").toString("base64"),
      }
    );
    const plaintextBase64 = this.#readNestedString(response, ["data", "plaintext"]);
    if (!plaintextBase64) {
      throw new Error("Vault transit decrypt response did not include data.plaintext");
    }

    return Buffer.from(plaintextBase64, "base64").toString("utf8");
  }

  async checkReadiness() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

      try {
        const response = await fetch(
          `${this.#baseUrl}/v1/sys/health?standbyok=true&perfstandbyok=true`,
          {
            method: "GET",
            headers: this.#buildHeaders(),
            signal: controller.signal,
          }
        );
        const text = await response.text();
        if (!response.ok) {
          return {
            ready: false,
            detail: `Vault health probe failed (${response.status} ${response.statusText}): ${text || "<empty>"}`,
            metadata: {
              provider: this.provider,
              baseUrl: this.#baseUrl,
              transitMount: this.#mount,
              keyId: this.#activeKeyId,
            },
          } satisfies CredentialBrokerReadiness;
        }

        return {
          ready: true,
          detail: null,
          metadata: {
            provider: this.provider,
            baseUrl: this.#baseUrl,
            transitMount: this.#mount,
            keyId: this.#activeKeyId,
            response: text ? (JSON.parse(text) as unknown) : null,
          },
        } satisfies CredentialBrokerReadiness;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      return {
        ready: false,
        detail: toErrorMessage(error, { abortMessage: "request timed out" }),
        metadata: {
          provider: this.provider,
          baseUrl: this.#baseUrl,
          transitMount: this.#mount,
          keyId: this.#activeKeyId,
        },
      } satisfies CredentialBrokerReadiness;
    }
  }

  async #requestVaultJson(
    method: "GET" | "POST",
    pathname: string,
    body?: Record<string, unknown>
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await fetch(`${this.#baseUrl}${pathname}`, {
        method,
        headers: this.#buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as unknown) : null;

      if (!response.ok) {
        throw new Error(
          `Vault broker ${method} ${pathname} failed (${response.status} ${response.statusText}): ${text || "<empty>"}`
        );
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  #buildHeaders() {
    return {
      "content-type": "application/json",
      "x-vault-token": this.#token,
      ...(this.#namespace ? { "x-vault-namespace": this.#namespace } : {}),
    };
  }

  #readNestedString(value: unknown, path: string[]) {
    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return null;
      }

      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === "string" && current.length > 0 ? current : null;
  }
}

function createCredentialBroker(kind: CredentialBrokerKind, config: ApiRuntimeConfig) {
  switch (kind) {
    case "local-envelope":
      return new LocalEnvelopeCredentialBroker(config);
    case "aws-kms-envelope":
      return new AwsKmsEnvelopeCredentialBroker(config);
    case "vault-transit-http":
      return new VaultTransitHttpCredentialBroker(config);
    default:
      throw new Error(`Unsupported credential broker provider: ${String(kind)}`);
  }
}

function buildCredentialBrokerSignature(kind: CredentialBrokerKind, config: ApiRuntimeConfig) {
  if (kind === "local-envelope") {
    return stableStringify({
      provider: kind,
      activeKeyId: config.credentialBrokerActiveKeyId,
      keys: config.credentialBrokerKeys,
      usesDefaultKey: config.credentialBrokerUsesDefaultKey,
    });
  }

  if (kind === "aws-kms-envelope") {
    return stableStringify({
      provider: kind,
      activeKeyId: config.credentialBrokerActiveKeyId,
      kmsKeyId: config.credentialBrokerAwsKmsKeyId ?? null,
      kmsRegion: config.credentialBrokerAwsRegion ?? null,
      kmsEndpoint: config.credentialBrokerAwsEndpoint ?? null,
      accessKeyId: config.credentialBrokerAwsAccessKeyId ?? null,
      secretAccessKey: config.credentialBrokerAwsSecretAccessKey ?? null,
      sessionToken: config.credentialBrokerAwsSessionToken ?? null,
      timeoutMs: config.credentialBrokerRequestTimeoutMs,
    });
  }

  return stableStringify({
    provider: kind,
    baseUrl: config.credentialBrokerVaultBaseUrl ?? null,
    namespace: config.credentialBrokerVaultNamespace ?? null,
    transitMount: config.credentialBrokerVaultTransitMount,
    activeKeyId: config.credentialBrokerActiveKeyId,
    keyType: config.credentialBrokerVaultKeyType,
    timeoutMs: config.credentialBrokerRequestTimeoutMs,
    token: config.credentialBrokerVaultToken ?? null,
  });
}

const cachedBrokers = new Map<
  CredentialBrokerKind,
  {
    signature: string;
    broker: CredentialBrokerAdapter;
  }
>();

export function getCredentialBrokerForKind(kind: CredentialBrokerKind) {
  const config = getApiRuntimeConfig();
  const signature = buildCredentialBrokerSignature(kind, config);
  const cached = cachedBrokers.get(kind);
  if (cached && cached.signature === signature) {
    return cached.broker;
  }

  const broker = createCredentialBroker(kind, config);
  cachedBrokers.set(kind, {
    signature,
    broker,
  });
  return broker;
}

export function getCredentialBroker() {
  return getCredentialBrokerForKind(getApiRuntimeConfig().credentialBrokerProvider);
}

export function resetCredentialBrokerForTests() {
  cachedBrokers.clear();
}
