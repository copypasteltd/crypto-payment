import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
} from "node:crypto";

import { sessionPackManifestFileName } from "./constants.js";
import {
  sessionPackManifestSchema,
  sessionPackSignatureSchema,
  type SessionPackManifest,
  type SessionPackSignature,
} from "./schema.js";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type SessionPackSigningOptions =
  | {
      algorithm: "sha256";
      keyId?: string;
    }
  | {
      algorithm: "hmac-sha256";
      secret: string;
      keyId?: string;
    }
  | {
      algorithm: "ed25519";
      privateKeyPem: string;
      publicKeyPem?: string;
      keyId?: string;
    };

export interface SessionPackSignatureVerificationOptions {
  requireSignature?: boolean;
  hmacSecret?: string;
  hmacSecretsByKeyId?: Record<string, string>;
  ed25519PublicKeyPem?: string;
  ed25519PrivateKeyPem?: string;
  ed25519PublicKeysByKeyId?: Record<string, string>;
}

export interface SessionPackSignatureVerificationResult {
  ok: boolean;
  verified: boolean;
  missing: boolean;
  reason?: string;
  signature?: SessionPackSignature | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortJsonValue(value: unknown): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortJsonValue(value[key])])
    ) as JsonValue;
  }

  return value as JsonValue;
}

function stripSignature(manifest: SessionPackManifest) {
  const { signature: _signature, ...unsignedManifest } = manifest;
  return unsignedManifest;
}

function normalizeHex(value: string) {
  return value.trim().toLowerCase();
}

function resolveHmacSecret(
  options: SessionPackSignatureVerificationOptions,
  keyId: string | undefined
) {
  if (keyId) {
    return options.hmacSecretsByKeyId?.[keyId] ?? null;
  }

  return options.hmacSecret ?? null;
}

function resolveEd25519PublicKey(
  options: SessionPackSignatureVerificationOptions,
  keyId: string | undefined
) {
  if (keyId) {
    const keyed = options.ed25519PublicKeysByKeyId?.[keyId];
    if (keyed) {
      return keyed;
    }
  }

  if (options.ed25519PublicKeyPem) {
    return options.ed25519PublicKeyPem;
  }

  if (options.ed25519PrivateKeyPem) {
    return createPublicKey(createPrivateKey(options.ed25519PrivateKeyPem));
  }

  return null;
}

export function canonicalizeSessionPackManifestForSignature(manifest: SessionPackManifest) {
  return new TextEncoder().encode(JSON.stringify(sortJsonValue(stripSignature(manifest))));
}

export function encodeSessionPackManifestFile(manifest: SessionPackManifest) {
  return new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
}

export function createSessionPackManifestSignature(
  manifest: SessionPackManifest,
  options: SessionPackSigningOptions
) {
  const payload = canonicalizeSessionPackManifestForSignature(manifest);

  switch (options.algorithm) {
    case "sha256":
      return sessionPackSignatureSchema.parse({
        algorithm: "sha256",
        value: createHash("sha256").update(payload).digest("hex"),
        key_id: options.keyId,
      });
    case "hmac-sha256":
      return sessionPackSignatureSchema.parse({
        algorithm: "hmac-sha256",
        value: createHmac("sha256", options.secret).update(payload).digest("hex"),
        key_id: options.keyId,
      });
    case "ed25519":
      return sessionPackSignatureSchema.parse({
        algorithm: "ed25519",
        value: signBytes(null, payload, createPrivateKey(options.privateKeyPem)).toString("base64"),
        key_id: options.keyId,
      });
  }
}

export function signSessionPackManifest(
  manifest: SessionPackManifest,
  options: SessionPackSigningOptions
) {
  return sessionPackManifestSchema.parse({
    ...stripSignature(manifest),
    signature: createSessionPackManifestSignature(manifest, options),
  });
}

export function signSessionPackBundle(
  bundle: {
    manifest: SessionPackManifest;
    files: Record<string, Uint8Array>;
  },
  options: SessionPackSigningOptions
) {
  const manifest = signSessionPackManifest(bundle.manifest, options);
  return {
    manifest,
    files: {
      ...bundle.files,
      [sessionPackManifestFileName]: encodeSessionPackManifestFile(manifest),
    },
  };
}

export function verifySessionPackManifestSignature(
  manifest: SessionPackManifest,
  options: SessionPackSignatureVerificationOptions = {}
): SessionPackSignatureVerificationResult {
  const signature = manifest.signature ?? null;

  if (!signature) {
    if (options.requireSignature) {
      return {
        ok: false,
        verified: false,
        missing: true,
        reason: "Manifest signature is required but missing.",
        signature,
      };
    }

    return {
      ok: true,
      verified: false,
      missing: true,
      signature,
    };
  }

  const payload = canonicalizeSessionPackManifestForSignature(manifest);

  try {
    switch (signature.algorithm) {
      case "sha256": {
        const expected = createHash("sha256").update(payload).digest("hex");
        const ok = normalizeHex(expected) === normalizeHex(signature.value);
        return {
          ok,
          verified: ok,
          missing: false,
          reason: ok ? undefined : "Manifest sha256 signature does not match the canonical manifest payload.",
          signature,
        };
      }
      case "hmac-sha256": {
        const secret = resolveHmacSecret(options, signature.key_id);
        if (!secret) {
          return {
            ok: false,
            verified: false,
            missing: false,
            reason: signature.key_id
              ? `No HMAC secret is configured for session-pack signature key ${signature.key_id}.`
              : "No default HMAC secret is configured for session-pack signature verification.",
            signature,
          };
        }

        const expected = createHmac("sha256", secret).update(payload).digest("hex");
        const ok = normalizeHex(expected) === normalizeHex(signature.value);
        return {
          ok,
          verified: ok,
          missing: false,
          reason: ok
            ? undefined
            : "Manifest hmac-sha256 signature does not match the canonical manifest payload.",
          signature,
        };
      }
      case "ed25519": {
        const publicKey = resolveEd25519PublicKey(options, signature.key_id);
        if (!publicKey) {
          return {
            ok: false,
            verified: false,
            missing: false,
            reason: signature.key_id
              ? `No Ed25519 public key is configured for session-pack signature key ${signature.key_id}.`
              : "No Ed25519 public key is configured for session-pack signature verification.",
            signature,
          };
        }

        const ok = verifyBytes(
          null,
          payload,
          publicKey,
          Buffer.from(signature.value, "base64")
        );
        return {
          ok,
          verified: ok,
          missing: false,
          reason: ok ? undefined : "Manifest Ed25519 signature does not match the canonical manifest payload.",
          signature,
        };
      }
    }
  } catch (error) {
    return {
      ok: false,
      verified: false,
      missing: false,
      reason:
        error instanceof Error
          ? error.message
          : "Unknown session-pack signature verification failure.",
      signature,
    };
  }
}
