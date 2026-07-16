import { createHash, createHmac, createPublicKey, timingSafeEqual, verify as verifyPayload } from "node:crypto";
import type { SealedSessionVersionRecord } from "@lingban/contracts";
import {
  buildSessionPackV2SignaturePayload,
  sessionPackSlotSchemaFileSchema,
  unpackSessionVersionV2,
  type SessionPackSlotSchemaFile,
} from "@lingban/session-pack";
import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { objectStore } from "../uploads/object-store.js";
import { sessionAssetRepository } from "./repository.js";

const versions = new Map<string, SealedSessionVersionRecord>();
const slotSchemaCache = new Map<string, Promise<SessionPackSlotSchemaFile | null>>();
const verificationCache = new Map<string, Promise<void>>();

async function readObject(objectKey: string) {
  const stream = await objectStore.createReadStream(objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function initializeSealedSessionVersionRegistry() {
  versions.clear();
  slotSchemaCache.clear();
  verificationCache.clear();
  for (const version of await sessionAssetRepository.listAllVersions()) {
    versions.set(version.sessionVersionId, version);
  }
}

export function registerSealedSessionVersion(version: SealedSessionVersionRecord) {
  versions.set(version.sessionVersionId, version);
  slotSchemaCache.delete(version.sessionVersionId);
  verificationCache.delete(version.sessionVersionId);
}

async function verifySealedArchive(version: SealedSessionVersionRecord, archive: Buffer) {
  const archiveSha256 = createHash("sha256").update(archive).digest("hex");
  if (archive.byteLength !== version.packSizeBytes || archiveSha256 !== version.packSha256) {
    throw new Error("Sealed Session Pack object size or SHA-256 does not match its immutable record");
  }
  const bundle = await unpackSessionVersionV2(archive);
  const embeddedSignature = bundle.manifest.signature;
  if (
    !embeddedSignature ||
    embeddedSignature.algorithm !== version.signatureAlgorithm ||
    embeddedSignature.keyId !== version.signatureKeyId ||
    embeddedSignature.value !== version.signatureValue
  ) {
    throw new Error("Sealed Session Pack manifest signature does not match its immutable record");
  }
  const config = getApiRuntimeConfig();
  const signedPayload = buildSessionPackV2SignaturePayload(bundle.manifest);
  if (version.signatureAlgorithm === "hmac-sha256") {
    const secret = config.sessionPackSignatureHmacKeysByKeyId[version.signatureKeyId]
      ?? (version.signatureKeyId === config.sessionPackSignatureKeyId ? config.sessionPackSignatureHmacSecret : undefined);
    if (!secret) throw new Error(`HMAC verification key is unavailable: ${version.signatureKeyId}`);
    const expected = Buffer.from(createHmac("sha256", secret).update(signedPayload).digest("hex"), "utf8");
    const actual = Buffer.from(version.signatureValue, "utf8");
    if (actual.byteLength !== expected.byteLength || !timingSafeEqual(actual, expected)) {
      throw new Error("Sealed Session Pack HMAC signature is invalid");
    }
  } else {
    const configuredKey = config.sessionPackSignatureEd25519PublicKeysByKeyId[version.signatureKeyId]
      ?? (version.signatureKeyId === config.sessionPackSignatureKeyId
        ? config.sessionPackSignatureEd25519PublicKeyPem
          ?? (config.sessionPackSignatureEd25519PrivateKeyPem
            ? createPublicKey(config.sessionPackSignatureEd25519PrivateKeyPem)
            : undefined)
        : undefined);
    if (!configuredKey) throw new Error(`Ed25519 verification key is unavailable: ${version.signatureKeyId}`);
    if (!verifyPayload(null, signedPayload, configuredKey, Buffer.from(version.signatureValue, "base64"))) {
      throw new Error("Sealed Session Pack Ed25519 signature is invalid");
    }
  }
}

export async function ensureSealedSessionVersionVerified(sessionVersionId: string) {
  const version = requireSealedSessionVersion(sessionVersionId);
  let pending = verificationCache.get(sessionVersionId);
  if (!pending) {
    pending = readObject(version.packObjectKey).then((archive) => verifySealedArchive(version, archive));
    verificationCache.set(sessionVersionId, pending);
  }
  try {
    await pending;
    return version;
  } catch (error) {
    verificationCache.delete(sessionVersionId);
    throw new AppError(
      409,
      "SESSION_VERSION_SIGNATURE_INVALID",
      `Sealed Session Version verification failed: ${sessionVersionId}`,
      error
    );
  }
}

export async function tryResolveSealedInformationCollectionTemplate(sessionVersionId: string) {
  const version = versions.get(sessionVersionId);
  if (!version) return null;
  let pending = slotSchemaCache.get(sessionVersionId);
  if (!pending) {
    pending = (async () => {
      const archive = await readObject(version.packObjectKey);
      await verifySealedArchive(version, archive);
      const bundle = await unpackSessionVersionV2(archive);
      const content = bundle.files.get("slot-schema.json");
      if (!content) return null;
      return sessionPackSlotSchemaFileSchema.parse(
        JSON.parse(Buffer.from(content).toString("utf8")) as unknown
      );
    })();
    slotSchemaCache.set(sessionVersionId, pending);
  }
  try {
    return await pending;
  } catch (error) {
    slotSchemaCache.delete(sessionVersionId);
    throw new AppError(
      409,
      "SESSION_VERSION_SLOT_SCHEMA_INVALID",
      `Session version slot schema is invalid: ${sessionVersionId}`,
      error
    );
  }
}

export function getSealedSessionVersion(sessionVersionId: string) {
  return versions.get(sessionVersionId) ?? null;
}

export function requireSealedSessionVersion(sessionVersionId: string) {
  const version = getSealedSessionVersion(sessionVersionId);
  if (!version) {
    throw new AppError(404, "SESSION_VERSION_NOT_FOUND", `Session version not found: ${sessionVersionId}`);
  }
  return version;
}
