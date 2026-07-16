import {
  createHash,
  createHmac,
  createPublicKey,
  sign as signPayload,
  timingSafeEqual,
  verify as verifyPayload,
} from "node:crypto";
import {
  legacySessionArchiveMigrationItemSchema,
  migrateLegacySessionArchivesInputSchema,
  migrateLegacySessionArchivesResponseSchema,
  sealedSessionVersionRecordSchema,
  sessionAssetRecordSchema,
  type LegacySessionArchiveMigrationItem,
  type MigrateLegacySessionArchivesInput,
} from "@lingban/contracts";
import {
  buildSessionPackV2SignaturePayload,
  convertLegacySessionPackToV2,
  deserializeSessionPackBundle,
  packSessionVersionV2,
  unpackSessionVersionV2,
} from "@lingban/session-pack";
import { nowIso } from "@lingban/shared";
import { AppError } from "../../app/errors.js";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { sessionAssetRepository } from "../session-drafts/repository.js";
import { registerSealedSessionVersion } from "../session-drafts/version-registry.js";
import { sessionArchiveRepository } from "../sessions/repository.js";
import { sessionCatalogService } from "../sessions/service.js";
import { ObjectStoreImmutableConflictError, objectStore } from "../uploads/object-store.js";
import { sessionControlMetrics } from "../session-control/metrics.js";

function sha256(content: Uint8Array | string) {
  return createHash("sha256").update(content).digest("hex");
}

function requireSigningConfig() {
  const config = getApiRuntimeConfig();
  if (!config.sessionPackV2WriteEnabled) {
    throw new AppError(503, "SESSION_PACK_V2_WRITE_DISABLED", "Session Pack v2 writes are disabled");
  }
  if (!config.sessionVersionImmutabilityEnforced) {
    throw new AppError(503, "SESSION_VERSION_IMMUTABILITY_DISABLED", "Legacy migration requires immutability enforcement");
  }
  if (!config.sessionPackSignatureEnabled || !config.sessionPackSignatureKeyId) {
    throw new AppError(503, "SESSION_PACK_SIGNING_UNAVAILABLE", "Session Pack signing is required for legacy migration");
  }
  return config;
}

function signManifest(payload: Uint8Array, config: ReturnType<typeof getApiRuntimeConfig>) {
  if (config.sessionPackSignatureAlgorithm === "hmac-sha256") {
    if (!config.sessionPackSignatureHmacSecret) {
      throw new AppError(503, "SESSION_PACK_SIGNING_UNAVAILABLE", "HMAC signing secret is unavailable");
    }
    return {
      algorithm: "hmac-sha256" as const,
      value: createHmac("sha256", config.sessionPackSignatureHmacSecret).update(payload).digest("hex"),
    };
  }
  if (config.sessionPackSignatureAlgorithm === "ed25519") {
    if (!config.sessionPackSignatureEd25519PrivateKeyPem) {
      throw new AppError(503, "SESSION_PACK_SIGNING_UNAVAILABLE", "Ed25519 private key is unavailable");
    }
    return {
      algorithm: "ed25519" as const,
      value: signPayload(null, payload, config.sessionPackSignatureEd25519PrivateKeyPem).toString("base64"),
    };
  }
  throw new AppError(503, "SESSION_PACK_SIGNING_UNAVAILABLE", "Legacy migration requires HMAC-SHA256 or Ed25519 signing");
}

function verifyManifestSignature(
  payload: Uint8Array,
  signature: { algorithm: "hmac-sha256" | "ed25519"; keyId: string; value: string },
  config: ReturnType<typeof getApiRuntimeConfig>
) {
  if (signature.algorithm === "hmac-sha256") {
    const secret = config.sessionPackSignatureHmacKeysByKeyId[signature.keyId]
      ?? (signature.keyId === config.sessionPackSignatureKeyId ? config.sessionPackSignatureHmacSecret : undefined);
    if (!secret) throw new AppError(409, "SESSION_VERSION_SIGNATURE_KEY_UNAVAILABLE", `HMAC verification key is unavailable: ${signature.keyId}`);
    const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"), "utf8");
    const actual = Buffer.from(signature.value, "utf8");
    if (actual.byteLength !== expected.byteLength || !timingSafeEqual(actual, expected)) {
      throw new AppError(409, "SESSION_VERSION_SIGNATURE_INVALID", "Imported Session Pack HMAC signature is invalid");
    }
    return;
  }
  const key = config.sessionPackSignatureEd25519PublicKeysByKeyId[signature.keyId]
    ?? (signature.keyId === config.sessionPackSignatureKeyId
      ? config.sessionPackSignatureEd25519PublicKeyPem
        ?? (config.sessionPackSignatureEd25519PrivateKeyPem
          ? createPublicKey(config.sessionPackSignatureEd25519PrivateKeyPem)
          : undefined)
      : undefined);
  if (!key) throw new AppError(409, "SESSION_VERSION_SIGNATURE_KEY_UNAVAILABLE", `Ed25519 verification key is unavailable: ${signature.keyId}`);
  if (!verifyPayload(null, payload, key, Buffer.from(signature.value, "base64"))) {
    throw new AppError(409, "SESSION_VERSION_SIGNATURE_INVALID", "Imported Session Pack Ed25519 signature is invalid");
  }
}

export class LegacySessionMigrationService {
  async importArchive(
    archive: Uint8Array,
    actor: { workspaceId: string; workspaceContextKey: string; userId: string | null }
  ) {
    try {
      return await this.importV2Archive(archive, actor);
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "SESSION_PACK_V2_INVALID") throw error;
    }
    const legacy = await sessionCatalogService.importSessionPackArchive(archive, {
      workspaceContextKey: actor.workspaceContextKey,
      importedByUserId: actor.userId,
    });
    const migration = await this.migrate(
      { sessionVersionIds: [legacy.sessionPack.sessionVersionId], dryRun: false },
      actor
    );
    const migrated = await sessionAssetRepository.getVersion(legacy.sessionPack.sessionVersionId);
    if (!migrated || migration.failed > 0) {
      throw new AppError(
        409,
        "LEGACY_SESSION_MIGRATION_FAILED",
        migration.items[0]?.detail ?? "Legacy Session Pack migration failed"
      );
    }
    return migrated;
  }

  async importV2Archive(archive: Uint8Array, actor: { workspaceId: string; userId: string | null }) {
    const config = getApiRuntimeConfig();
    const unpacked = await unpackSessionVersionV2(archive).catch((error) => {
      throw new AppError(400, "SESSION_PACK_V2_INVALID", "Session Pack v2 archive validation failed", error);
    });
    const manifest = unpacked.manifest;
    if (!manifest.sessionId || !manifest.sessionVersionId) {
      throw new AppError(400, "SESSION_PACK_V2_IDENTITY_REQUIRED", "Imported Session Pack v2 requires sessionId and sessionVersionId");
    }
    if (!manifest.signature) {
      throw new AppError(409, "SESSION_VERSION_SIGNATURE_REQUIRED", "Imported Session Pack v2 requires an embedded signature");
    }
    verifyManifestSignature(buildSessionPackV2SignaturePayload(manifest), manifest.signature, config);
    const archiveSha256 = sha256(archive);
    const existing = await sessionAssetRepository.getVersion(manifest.sessionVersionId);
    if (existing) {
      if (existing.packSha256 !== archiveSha256) {
        throw new AppError(409, "SESSION_VERSION_HASH_MISMATCH", "Session Version ID already exists with different archive content");
      }
      return existing;
    }
    if (!config.sessionPackV2WriteEnabled || !config.sessionVersionImmutabilityEnforced) {
      throw new AppError(503, "SESSION_PACK_V2_WRITE_DISABLED", "Session Pack v2 import writes are disabled");
    }
    const packObjectKey = `session-versions/${manifest.sessionVersionId}/${archiveSha256}.session-pack.tar.zst`;
    await objectStore.putBufferImmutable(packObjectKey, {
      content: Buffer.from(archive),
      contentType: "application/zstd",
    });
    const replayId = typeof manifest.metadata.replayId === "string" ? manifest.metadata.replayId : null;
    const legacyIncomplete = manifest.metadata.legacyIncomplete === true
      || !manifest.sourceRevisionId
      || !replayId;
    const taskFamily = typeof manifest.metadata.taskFamily === "string"
      ? manifest.metadata.taskFamily
      : null;
    const session = sessionAssetRecordSchema.parse({
      sessionId: manifest.sessionId,
      workspaceId: actor.workspaceId,
      name: `Imported Session ${manifest.sessionVersionId}`,
      description: "Imported from a verified Session Pack v2 archive.",
      taskFamily,
      status: "active",
      createdByUserId: actor.userId,
      createdAt: manifest.createdAt,
      updatedAt: nowIso(),
    });
    const version = sealedSessionVersionRecordSchema.parse({
      sessionVersionId: manifest.sessionVersionId,
      sessionId: manifest.sessionId,
      sealedFromRevisionId: null,
      sealedFromReplayId: null,
      sourceType: "external-imported",
      legacyIncomplete,
      migrationReportObjectKey: null,
      parentSessionVersionId: null,
      manifestVersion: "lingban.session-pack/v2",
      packObjectKey,
      packSha256: archiveSha256,
      packSizeBytes: archive.byteLength,
      signatureAlgorithm: manifest.signature.algorithm,
      signatureKeyId: manifest.signature.keyId,
      signatureValue: manifest.signature.value,
      contentState: "sealed",
      sealedByUserId: actor.userId,
      sealedAt: manifest.createdAt,
    });
    const saved = await sessionAssetRepository.importDetachedVersion({ session, version });
    registerSealedSessionVersion(saved);
    return saved;
  }

  async migrate(input: MigrateLegacySessionArchivesInput, actor: { workspaceId: string; userId: string | null }) {
    const parsed = migrateLegacySessionArchivesInputSchema.parse(input);
    await sessionArchiveRepository.init();
    const selected = new Set(parsed.sessionVersionIds);
    const records = sessionArchiveRepository
      .listImportedArchives()
      .filter((record) => selected.size === 0 || selected.has(record.sessionVersionId));
    const items: LegacySessionArchiveMigrationItem[] = [];

    for (const record of records) {
      try {
        const existing = await sessionAssetRepository.getVersion(record.sessionVersionId);
        if (existing) {
          items.push(legacySessionArchiveMigrationItemSchema.parse({
            sessionVersionId: record.sessionVersionId,
            status: "skipped",
            sourceArchiveSha256: record.archiveSha256,
            targetPackSha256: existing.packSha256,
            migrationReportObjectKey: existing.migrationReportObjectKey,
            legacyIncomplete: existing.legacyIncomplete,
            detail: existing.sourceType === "legacy-imported"
              ? "Legacy archive was already migrated"
              : "Session Version ID is already owned by a captured version",
          }));
          continue;
        }
        const archive = await sessionArchiveRepository.readImportedArchiveBytes(record.sessionVersionId);
        if (!archive) throw new Error("Legacy archive bytes are unavailable");
        const actualArchiveSha256 = sha256(archive);
        if (actualArchiveSha256 !== record.archiveSha256) {
          throw new Error(`Legacy archive SHA-256 mismatch: expected ${record.archiveSha256}, received ${actualArchiveSha256}`);
        }
        const bundle = deserializeSessionPackBundle(archive);
        const converted = await convertLegacySessionPackToV2({
          bundle,
          sourceArchive: archive,
          migratedAt: record.importedAt,
        });
        const baseInput = {
          sessionId: bundle.manifest.session_id,
          sessionVersionId: bundle.manifest.session_version,
          sourceCaptureId: converted.sourceCaptureId,
          sourceRevisionId: null,
          parentSessionVersionId: bundle.manifest.source?.lineage_parent_version_id ?? null,
          createdAt: bundle.manifest.created_at,
          metadata: converted.metadata,
          files: converted.files,
        };
        const unsigned = await packSessionVersionV2(baseInput);
        const config = requireSigningConfig();
        const signature = signManifest(buildSessionPackV2SignaturePayload(unsigned.manifest), config);
        const packed = await packSessionVersionV2({
          ...baseInput,
          signature: {
            algorithm: signature.algorithm,
            keyId: config.sessionPackSignatureKeyId!,
            value: signature.value,
          },
        });
        if (parsed.dryRun) {
          items.push(legacySessionArchiveMigrationItemSchema.parse({
            sessionVersionId: record.sessionVersionId,
            status: "planned",
            sourceArchiveSha256: actualArchiveSha256,
            targetPackSha256: packed.sha256,
            legacyIncomplete: true,
            detail: converted.report.incompleteReasons.join("; "),
          }));
          continue;
        }
        const packObjectKey = `session-versions/${record.sessionVersionId}/${packed.sha256}.session-pack.tar.zst`;
        await objectStore.putBufferImmutable(packObjectKey, {
          content: Buffer.from(packed.archive),
          contentType: "application/zstd",
        });
        const requestedParentSessionVersionId = bundle.manifest.source?.lineage_parent_version_id ?? null;
        const localParentSessionVersionId = requestedParentSessionVersionId
          && await sessionAssetRepository.getVersion(requestedParentSessionVersionId)
          ? requestedParentSessionVersionId
          : null;
        const migrationReport = {
          ...converted.report,
          targetPackSha256: packed.sha256,
          targetPackSizeBytes: packed.sizeBytes,
          targetPackObjectKey: packObjectKey,
          signatureAlgorithm: signature.algorithm,
          signatureKeyId: config.sessionPackSignatureKeyId,
          requestedParentSessionVersionId,
          resolvedParentSessionVersionId: localParentSessionVersionId,
        };
        const reportBytes = Buffer.from(`${JSON.stringify(migrationReport, null, 2)}\n`, "utf8");
        const reportSha256 = sha256(reportBytes);
        const migrationReportObjectKey = `session-migrations/legacy/${record.sessionVersionId}/${reportSha256}.json`;
        await objectStore.putBufferImmutable(migrationReportObjectKey, {
          content: reportBytes,
          contentType: "application/json",
        });
        const sealedAt = nowIso();
        const session = sessionAssetRecordSchema.parse({
          sessionId: bundle.manifest.session_id,
          workspaceId: actor.workspaceId,
          name: `Legacy Session ${bundle.manifest.session_version}`,
          description: "Imported from Session Pack v1; incomplete provenance is retained in the migration report.",
          taskFamily: bundle.manifest.task_family,
          status: "active",
          createdByUserId: actor.userId,
          createdAt: record.importedAt,
          updatedAt: sealedAt,
        });
        const version = sealedSessionVersionRecordSchema.parse({
          sessionVersionId: record.sessionVersionId,
          sessionId: session.sessionId,
          sealedFromRevisionId: null,
          sealedFromReplayId: null,
          sourceType: "legacy-imported",
          legacyIncomplete: true,
          migrationReportObjectKey,
          parentSessionVersionId: localParentSessionVersionId,
          manifestVersion: "lingban.session-pack/v2",
          packObjectKey,
          packSha256: packed.sha256,
          packSizeBytes: packed.sizeBytes,
          signatureAlgorithm: signature.algorithm,
          signatureKeyId: config.sessionPackSignatureKeyId,
          signatureValue: signature.value,
          contentState: "sealed",
          sealedByUserId: actor.userId,
          sealedAt,
        });
        const saved = await sessionAssetRepository.importDetachedVersion({ session, version });
        registerSealedSessionVersion(saved);
        items.push(legacySessionArchiveMigrationItemSchema.parse({
          sessionVersionId: saved.sessionVersionId,
          status: "migrated",
          sourceArchiveSha256: actualArchiveSha256,
          targetPackSha256: saved.packSha256,
          migrationReportObjectKey,
          legacyIncomplete: true,
          detail: converted.report.incompleteReasons.join("; "),
        }));
      } catch (error) {
        if (error instanceof ObjectStoreImmutableConflictError) throw error;
        items.push(legacySessionArchiveMigrationItemSchema.parse({
          sessionVersionId: record.sessionVersionId,
          status: "failed",
          sourceArchiveSha256: record.archiveSha256,
          legacyIncomplete: true,
          detail: error instanceof Error ? error.message : String(error),
        }));
      }
    }

    for (const item of items) sessionControlMetrics.legacyMigration(item.status);
    return migrateLegacySessionArchivesResponseSchema.parse({
      dryRun: parsed.dryRun,
      total: items.length,
      planned: items.filter((item) => item.status === "planned").length,
      migrated: items.filter((item) => item.status === "migrated").length,
      skipped: items.filter((item) => item.status === "skipped").length,
      failed: items.filter((item) => item.status === "failed").length,
      items,
    });
  }
}

export const legacySessionMigrationService = new LegacySessionMigrationService();
