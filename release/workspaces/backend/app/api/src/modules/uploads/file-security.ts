import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import net from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import type { RunDownloadTicket, RunUploadRecord } from "@lingban/contracts";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { AppError } from "../../app/errors.js";
import { objectStore } from "./object-store.js";
import { uploadRepository } from "./repository.js";

const EICAR_SIGNATURE =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const BUILTIN_ENGINE = "builtin";
const CLAMAV_ENGINE = "clamav";
const DISABLED_ENGINE = "disabled";
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1024;
const HEAD_BYTES_LIMIT = 8 * 1024;
const ROLLING_TEXT_BYTES_LIMIT = 512;
const MACRO_OFFICE_EXTENSIONS = new Set([
  ".docm",
  ".dotm",
  ".ppam",
  ".potm",
  ".pptm",
  ".sldm",
  ".xlam",
  ".xlsb",
  ".xlsm",
]);

type FileSecurityScanStatus = "pending" | "clean" | "blocked" | "error" | "skipped";

type FileSecurityScanResult = {
  status: Exclude<FileSecurityScanStatus, "pending">;
  engine: string;
  reasonCode: string | null;
  detail: string | null;
  signature: string | null;
  scannedAt: string;
  sha256: string | null;
  sizeBytes: number | null;
  cacheHit: boolean;
};

type FileSecurityCacheEntry = {
  expiresAtMs: number;
  result: FileSecurityScanResult;
};

type FileSecurityScanMetrics = {
  scansTotal: number;
  cleanTotal: number;
  blockedTotal: number;
  errorTotal: number;
  skippedTotal: number;
  cacheHitsTotal: number;
  uploadBlocksTotal: number;
  accessBlocksTotal: number;
  staleTicketDenialsTotal: number;
  clamavRequestsTotal: number;
  clamavFailuresTotal: number;
  policyAllowOnErrorTotal: number;
  policyBlockOnErrorTotal: number;
};

type FileSecurityReadiness = {
  status: "ready" | "not_ready" | "disabled";
  detail: string | null;
  metadata?: Record<string, unknown>;
};

export type FileSecurityDiagnostics = {
  mode: "disabled" | "builtin" | "clamav";
  errorPolicy: "allow" | "block";
  timeoutMs: number;
  blockedExtensions: string[];
  blockedMimePrefixes: string[];
  blockMacroEnabledOffice: boolean;
  clamav: {
    host: string | null;
    port: number | null;
  };
  cache: {
    entryCount: number;
    ttlMs: number;
  };
  readiness: FileSecurityReadiness;
  metrics: FileSecurityScanMetrics;
};

type FileSecuritySubject = {
  fileName: string;
  contentType?: string | null;
  absolutePath?: string | null;
  objectKey?: string | null;
};

type BuiltinInspection = {
  sha256: string;
  sizeBytes: number;
  blockedReasonCode: string | null;
  blockedDetail: string | null;
  blockedSignature: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeExtension(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

function normalizeMimeType(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [base] = value.split(";", 1);
  return base?.trim().toLowerCase() || null;
}

function toBuffer(chunk: Buffer | Uint8Array | string) {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }

  if (typeof chunk === "string") {
    return Buffer.from(chunk);
  }

  return Buffer.from(chunk);
}

function matchesMachOMagic(head: Buffer) {
  if (head.length < 4) {
    return false;
  }

  const magic = head.readUInt32BE(0);
  return [
    0xfeedface,
    0xfeedfacf,
    0xcefaedfe,
    0xcffaedfe,
    0xcafebabe,
    0xbebafeca,
  ].includes(magic);
}

function createResult(
  status: Exclude<FileSecurityScanStatus, "pending">,
  engine: string,
  partial: Partial<Omit<FileSecurityScanResult, "status" | "engine" | "scannedAt" | "cacheHit">> = {}
): FileSecurityScanResult {
  return {
    status,
    engine,
    reasonCode: partial.reasonCode ?? null,
    detail: partial.detail ?? null,
    signature: partial.signature ?? null,
    scannedAt: nowIso(),
    sha256: partial.sha256 ?? null,
    sizeBytes: partial.sizeBytes ?? null,
    cacheHit: false,
  };
}

function getUploadSecurityDetails(upload: RunUploadRecord) {
  return {
    uploadId: upload.uploadId,
    fileName: upload.fileName,
    status: upload.status,
    scanStatus: upload.scanStatus,
    scanEngine: upload.scanEngine,
    scanReasonCode: upload.scanReasonCode,
    scanDetail: upload.scanDetail,
    scanSignature: upload.scanSignature,
    scannedAt: upload.scannedAt,
    sha256: upload.sha256,
  };
}

function getScanResultDetails(subject: FileSecuritySubject, result: FileSecurityScanResult) {
  return {
    fileName: subject.fileName,
    contentType: subject.contentType ?? null,
    absolutePath: subject.absolutePath ?? null,
    objectKey: subject.objectKey ?? null,
    scanStatus: result.status,
    scanEngine: result.engine,
    scanReasonCode: result.reasonCode,
    scanDetail: result.detail,
    scanSignature: result.signature,
    scannedAt: result.scannedAt,
    sha256: result.sha256,
    sizeBytes: result.sizeBytes,
  };
}

export class RunFileSecurityService {
  #cache = new Map<string, FileSecurityCacheEntry>();
  #metrics: FileSecurityScanMetrics = {
    scansTotal: 0,
    cleanTotal: 0,
    blockedTotal: 0,
    errorTotal: 0,
    skippedTotal: 0,
    cacheHitsTotal: 0,
    uploadBlocksTotal: 0,
    accessBlocksTotal: 0,
    staleTicketDenialsTotal: 0,
    clamavRequestsTotal: 0,
    clamavFailuresTotal: 0,
    policyAllowOnErrorTotal: 0,
    policyBlockOnErrorTotal: 0,
  };

  #getConfig() {
    return getApiRuntimeConfig();
  }

  #getNormalizedBlockedExtensions() {
    return new Set(
      this.#getConfig().fileScanBlockedExtensions.map((item) => normalizeExtension(item)).filter(Boolean)
    );
  }

  #getNormalizedBlockedMimePrefixes() {
    return this.#getConfig().fileScanBlockedMimePrefixes
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  #consumeCache(cacheKey?: string | null) {
    if (!cacheKey) {
      return null;
    }

    const cached = this.#cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.expiresAtMs <= Date.now()) {
      this.#cache.delete(cacheKey);
      return null;
    }

    this.#metrics.cacheHitsTotal += 1;
    return {
      ...cached.result,
      cacheHit: true,
    } satisfies FileSecurityScanResult;
  }

  #storeCache(cacheKey: string | null | undefined, result: FileSecurityScanResult) {
    if (!cacheKey || result.status === "error") {
      return;
    }

    while (this.#cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.#cache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.#cache.delete(oldestKey);
    }

    this.#cache.set(cacheKey, {
      expiresAtMs: Date.now() + DEFAULT_CACHE_TTL_MS,
      result: {
        ...result,
        cacheHit: false,
      },
    });
  }

  #recordScanMetric(status: Exclude<FileSecurityScanStatus, "pending">) {
    this.#metrics.scansTotal += 1;
    if (status === "clean") {
      this.#metrics.cleanTotal += 1;
      return;
    }

    if (status === "blocked") {
      this.#metrics.blockedTotal += 1;
      return;
    }

    if (status === "error") {
      this.#metrics.errorTotal += 1;
      return;
    }

    this.#metrics.skippedTotal += 1;
  }

  #resultBlocksByPolicy(result: FileSecurityScanResult) {
    const config = this.#getConfig();
    if (result.status === "blocked") {
      return true;
    }

    return result.status === "error" && config.fileScanErrorPolicy === "block";
  }

  isBlockingResult(result: FileSecurityScanResult) {
    return this.#resultBlocksByPolicy(result);
  }

  #recordPolicyDecision(result: FileSecurityScanResult) {
    if (result.status !== "error") {
      return;
    }

    if (this.#getConfig().fileScanErrorPolicy === "allow") {
      this.#metrics.policyAllowOnErrorTotal += 1;
      return;
    }

    this.#metrics.policyBlockOnErrorTotal += 1;
  }

  #checkMetadataPolicy(subject: FileSecuritySubject) {
    const config = this.#getConfig();
    const blockedExtensions = this.#getNormalizedBlockedExtensions();
    const blockedMimePrefixes = this.#getNormalizedBlockedMimePrefixes();
    const extension = normalizeExtension(path.extname(subject.fileName));
    const normalizedMime = normalizeMimeType(subject.contentType);

    if (extension && blockedExtensions.has(extension)) {
      return createResult("blocked", BUILTIN_ENGINE, {
        reasonCode: "blocked-extension",
        detail: `File extension ${extension} is blocked by policy.`,
      });
    }

    if (config.fileScanBlockMacroEnabledOffice && MACRO_OFFICE_EXTENSIONS.has(extension)) {
      return createResult("blocked", BUILTIN_ENGINE, {
        reasonCode: "macro-office",
        detail: `Macro-enabled Office file ${extension} is blocked by policy.`,
      });
    }

    if (normalizedMime) {
      const matched = blockedMimePrefixes.find((prefix) => normalizedMime.startsWith(prefix));
      if (matched) {
        return createResult("blocked", BUILTIN_ENGINE, {
          reasonCode: "blocked-mime",
          detail: `Content type ${normalizedMime} is blocked by policy.`,
          signature: matched,
        });
      }
    }

    return null;
  }

  async #inspectStream(
    source: NodeJS.ReadableStream
  ): Promise<BuiltinInspection> {
    const hash = createHash("sha256");
    let sizeBytes = 0;
    let head = Buffer.alloc(0);
    let rollingText = Buffer.alloc(0);
    let blockedReasonCode: string | null = null;
    let blockedDetail: string | null = null;
    let blockedSignature: string | null = null;

    for await (const rawChunk of source as AsyncIterable<Buffer | Uint8Array | string>) {
      const chunk = toBuffer(rawChunk);
      sizeBytes += chunk.byteLength;
      hash.update(chunk);

      if (head.byteLength < HEAD_BYTES_LIMIT) {
        head = Buffer.concat([head, chunk.subarray(0, HEAD_BYTES_LIMIT - head.byteLength)]);
      }

      const nextRolling = Buffer.concat([rollingText, chunk]);
      if (nextRolling.toString("latin1").includes(EICAR_SIGNATURE)) {
        blockedReasonCode = "eicar-signature";
        blockedDetail = "EICAR antivirus test signature detected in file content.";
        blockedSignature = EICAR_SIGNATURE;
      }

      rollingText =
        nextRolling.byteLength > ROLLING_TEXT_BYTES_LIMIT
          ? nextRolling.subarray(nextRolling.byteLength - ROLLING_TEXT_BYTES_LIMIT)
          : nextRolling;
    }

    if (!blockedReasonCode && head.byteLength >= 4) {
      if (head[0] === 0x4d && head[1] === 0x5a) {
        blockedReasonCode = "portable-executable";
        blockedDetail = "Windows PE executable header detected.";
      } else if (
        head[0] === 0x7f &&
        head[1] === 0x45 &&
        head[2] === 0x4c &&
        head[3] === 0x46
      ) {
        blockedReasonCode = "elf-binary";
        blockedDetail = "ELF executable header detected.";
      } else if (matchesMachOMagic(head)) {
        blockedReasonCode = "mach-o-binary";
        blockedDetail = "Mach-O executable header detected.";
      }
    }

    if (!blockedReasonCode && head.byteLength >= 2 && head[0] === 0x23 && head[1] === 0x21) {
      blockedReasonCode = "script-shebang";
      blockedDetail = "Executable script shebang detected.";
    }

    return {
      sha256: hash.digest("hex"),
      sizeBytes,
      blockedReasonCode,
      blockedDetail,
      blockedSignature,
    };
  }

  async #runBuiltinScan(
    subject: FileSecuritySubject,
    openStream: () => Promise<NodeJS.ReadableStream>
  ) {
    const metadataDecision = this.#checkMetadataPolicy(subject);
    if (metadataDecision) {
      return metadataDecision;
    }

    try {
      const inspected = await this.#inspectStream(await openStream());
      if (inspected.blockedReasonCode) {
        return createResult("blocked", BUILTIN_ENGINE, {
          reasonCode: inspected.blockedReasonCode,
          detail: inspected.blockedDetail,
          signature: inspected.blockedSignature,
          sha256: inspected.sha256,
          sizeBytes: inspected.sizeBytes,
        });
      }

      return createResult("clean", BUILTIN_ENGINE, {
        sha256: inspected.sha256,
        sizeBytes: inspected.sizeBytes,
      });
    } catch (error) {
      return createResult("error", BUILTIN_ENGINE, {
        reasonCode: "scan-read-failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async #probeClamav(command: string, expectedToken: string) {
    const config = this.#getConfig();
    if (config.fileScanMode !== "clamav") {
      return {
        status: "disabled",
        detail: null,
      } satisfies FileSecurityReadiness;
    }

    try {
      const response = await new Promise<string>((resolve, reject) => {
        const socket = net.createConnection({
          host: config.fileScanClamavHost,
          port: config.fileScanClamavPort,
        });
        let settled = false;
        let reply = "";

        const finish = (callback: () => void) => {
          if (settled) {
            return;
          }
          settled = true;
          callback();
        };

        socket.setTimeout(config.fileScanTimeoutMs, () => {
          finish(() => reject(new Error("ClamAV probe timed out")));
          socket.destroy();
        });
        socket.on("error", (error) => {
          finish(() => reject(error));
        });
        socket.on("data", (chunk) => {
          reply += Buffer.from(chunk).toString("utf8");
        });
        socket.on("end", () => {
          finish(() => resolve(reply.replace(/\0/g, "").trim()));
        });
        socket.on("connect", () => {
          socket.end(Buffer.from(command, "utf8"));
        });
      });

      if (!response.includes(expectedToken)) {
        return {
          status: "not_ready",
          detail: `Unexpected ClamAV response: ${response}`,
          metadata: {
            host: config.fileScanClamavHost ?? null,
            port: config.fileScanClamavPort,
          },
        } satisfies FileSecurityReadiness;
      }

      return {
        status: "ready",
        detail: null,
        metadata: {
          host: config.fileScanClamavHost ?? null,
          port: config.fileScanClamavPort,
        },
      } satisfies FileSecurityReadiness;
    } catch (error) {
      return {
        status: "not_ready",
        detail: error instanceof Error ? error.message : String(error),
        metadata: {
          host: config.fileScanClamavHost ?? null,
          port: config.fileScanClamavPort,
        },
      } satisfies FileSecurityReadiness;
    }
  }

  async #runClamavScan(
    subject: FileSecuritySubject,
    openStream: () => Promise<NodeJS.ReadableStream>
  ) {
    const config = this.#getConfig();
    this.#metrics.clamavRequestsTotal += 1;

    try {
      const response = await new Promise<string>((resolve, reject) => {
        const socket = net.createConnection({
          host: config.fileScanClamavHost,
          port: config.fileScanClamavPort,
        });
        let settled = false;
        let reply = "";

        const finish = (callback: () => void) => {
          if (settled) {
            return;
          }
          settled = true;
          callback();
        };

        socket.setTimeout(config.fileScanTimeoutMs, () => {
          finish(() => reject(new Error("ClamAV scan timed out")));
          socket.destroy();
        });
        socket.on("error", (error) => {
          finish(() => reject(error));
        });
        socket.on("data", (chunk) => {
          reply += Buffer.from(chunk).toString("utf8");
        });
        socket.on("end", () => {
          finish(() => resolve(reply.replace(/\0/g, "").trim()));
        });
        socket.on("connect", async () => {
          try {
            socket.write(Buffer.from("zINSTREAM\0", "utf8"));
            const stream = await openStream();

            for await (const rawChunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
              const chunk = toBuffer(rawChunk);
              const sizeBuffer = Buffer.allocUnsafe(4);
              sizeBuffer.writeUInt32BE(chunk.byteLength, 0);
              socket.write(sizeBuffer);
              socket.write(chunk);
            }

            const terminator = Buffer.alloc(4);
            terminator.writeUInt32BE(0, 0);
            socket.end(terminator);
          } catch (error) {
            finish(() => reject(error));
            socket.destroy();
          }
        });
      });

      if (response.endsWith("OK")) {
        return createResult("clean", CLAMAV_ENGINE);
      }

      if (response.endsWith("FOUND")) {
        const signature = response.replace(/^stream:\s*/i, "").replace(/\s+FOUND$/i, "").trim();
        return createResult("blocked", CLAMAV_ENGINE, {
          reasonCode: "clamav-signature",
          detail: `ClamAV detected malware signature ${signature}.`,
          signature,
        });
      }

      if (response.includes("ERROR")) {
        this.#metrics.clamavFailuresTotal += 1;
        return createResult("error", CLAMAV_ENGINE, {
          reasonCode: "clamav-error",
          detail: response,
        });
      }

      this.#metrics.clamavFailuresTotal += 1;
      return createResult("error", CLAMAV_ENGINE, {
        reasonCode: "clamav-unexpected-response",
        detail: `Unexpected ClamAV response: ${response}`,
      });
    } catch (error) {
      this.#metrics.clamavFailuresTotal += 1;
      return createResult("error", CLAMAV_ENGINE, {
        reasonCode: "clamav-unreachable",
        detail:
          error instanceof Error
            ? error.message
            : `Unable to reach ClamAV scanner for ${subject.fileName}`,
      });
    }
  }

  async #scanWithMode(
    subject: FileSecuritySubject,
    openStream: () => Promise<NodeJS.ReadableStream>,
    cacheKey?: string | null
  ) {
    const config = this.#getConfig();

    if (config.fileScanMode === "disabled") {
      const result = createResult("skipped", DISABLED_ENGINE, {
        detail: "File scanning is disabled by runtime configuration.",
      });
      this.#recordScanMetric(result.status);
      return result;
    }

    const cached = this.#consumeCache(cacheKey);
    if (cached) {
      return cached;
    }

    const builtinResult = await this.#runBuiltinScan(subject, openStream);
    if (builtinResult.status !== "clean" || config.fileScanMode === "builtin") {
      this.#recordScanMetric(builtinResult.status);
      this.#recordPolicyDecision(builtinResult);
      this.#storeCache(cacheKey, builtinResult);
      return builtinResult;
    }

    const clamavResult = await this.#runClamavScan(subject, openStream);
    const result = createResult(clamavResult.status, clamavResult.engine, {
      reasonCode: clamavResult.reasonCode,
      detail: clamavResult.detail,
      signature: clamavResult.signature,
      sha256: builtinResult.sha256,
      sizeBytes: builtinResult.sizeBytes,
    });
    this.#recordScanMetric(result.status);
    this.#recordPolicyDecision(result);
    this.#storeCache(cacheKey, result);
    return result;
  }

  async scanUploadBuffer(upload: Pick<RunUploadRecord, "uploadId" | "fileName" | "contentType">, content: Buffer) {
    const subject: FileSecuritySubject = {
      fileName: upload.fileName,
      contentType: upload.contentType,
    };

    return await this.#scanWithMode(
      subject,
      async () => Readable.from([content]),
      null
    );
  }

  async scanAbsolutePath(
    subject: Omit<FileSecuritySubject, "absolutePath"> & { absolutePath: string },
    options: { cacheKey?: string | null } = {}
  ) {
    return await this.#scanWithMode(
      subject,
      async () => createReadStream(subject.absolutePath),
      options.cacheKey ?? null
    );
  }

  async scanObjectKey(
    subject: Omit<FileSecuritySubject, "objectKey"> & { objectKey: string },
    options: { cacheKey?: string | null } = {}
  ) {
    return await this.#scanWithMode(
      subject,
      async () => await objectStore.createReadStream(subject.objectKey),
      options.cacheKey ?? null
    );
  }

  async ensureUploadAllowed(upload: RunUploadRecord) {
    if (upload.status === "blocked" || upload.scanStatus === "blocked") {
      this.#metrics.uploadBlocksTotal += 1;
      throw new AppError(
        409,
        "RUN_UPLOAD_SECURITY_BLOCKED",
        `Upload ${upload.fileName} is blocked by file security policy.`,
        {
          security: getUploadSecurityDetails(upload),
        }
      );
    }

    if (upload.scanStatus === "clean" || upload.scanStatus === "skipped") {
      return upload;
    }

    const result = await this.scanObjectKey(
      {
        fileName: upload.fileName,
        contentType: upload.contentType,
        objectKey: upload.objectKey,
      },
      {
        cacheKey: `upload:${upload.objectKey}`,
      }
    );

    const next = {
      ...upload,
      status: this.#resultBlocksByPolicy(result) ? "blocked" : upload.status,
      scanStatus: result.status,
      scanEngine: result.engine,
      scanReasonCode: result.reasonCode,
      scanDetail: result.detail,
      scanSignature: result.signature,
      scannedAt: result.scannedAt,
      sha256: upload.sha256 ?? result.sha256,
      storedSizeBytes: upload.storedSizeBytes ?? result.sizeBytes,
      updatedAt: nowIso(),
    } satisfies RunUploadRecord;

    await uploadRepository.updateUpload(next);

    if (this.#resultBlocksByPolicy(result)) {
      this.#metrics.uploadBlocksTotal += 1;
      throw this.createAccessDeniedError(
        {
          fileName: upload.fileName,
          contentType: upload.contentType,
          objectKey: upload.objectKey,
          absolutePath: upload.attachedPath,
        },
        result,
        "upload"
      );
    }

    return next;
  }

  createAccessDeniedError(
    subject: FileSecuritySubject,
    result: FileSecurityScanResult,
    operation: "upload" | "preview" | "read" | "download" | "download-ticket"
  ) {
    const details = {
      security: getScanResultDetails(subject, result),
      operation,
    };

    if (result.status === "blocked") {
      return new AppError(
        409,
        operation === "upload" ? "RUN_UPLOAD_SECURITY_BLOCKED" : "RUN_FILE_SECURITY_BLOCKED",
        `File ${subject.fileName} is blocked by file security policy.`,
        details
      );
    }

    return new AppError(
      503,
      operation === "upload" ? "RUN_UPLOAD_SECURITY_SCAN_FAILED" : "RUN_FILE_SECURITY_SCAN_FAILED",
      `File security scan failed for ${subject.fileName} and access is denied by policy.`,
      details
    );
  }

  assertAccessAllowed(
    subject: FileSecuritySubject,
    result: FileSecurityScanResult,
    operation: "upload" | "preview" | "read" | "download" | "download-ticket"
  ) {
    if (!this.#resultBlocksByPolicy(result)) {
      return;
    }

    if (operation === "upload") {
      this.#metrics.uploadBlocksTotal += 1;
    } else {
      this.#metrics.accessBlocksTotal += 1;
    }

    throw this.createAccessDeniedError(subject, result, operation);
  }

  async assertObjectTicketAllowed(ticket: RunDownloadTicket) {
    if (!ticket.objectKey) {
      return;
    }

    const upload = ticket.uploadId ? uploadRepository.getUpload(ticket.uploadId) : null;
    const subject: FileSecuritySubject = {
      fileName: ticket.fileName,
      contentType: ticket.mimeType,
      objectKey: ticket.objectKey,
      absolutePath: ticket.path,
    };
    const cacheKey =
      ticket.sourceKind === "uploaded-object" && upload ? `upload:${ticket.objectKey}` : null;
    const result = await this.scanObjectKey(
      {
        fileName: ticket.fileName,
        contentType: ticket.mimeType,
        objectKey: ticket.objectKey,
      },
      {
        cacheKey,
      }
    );

    if (ticket.checksum && result.sha256 && ticket.checksum !== result.sha256) {
      this.#metrics.staleTicketDenialsTotal += 1;
      throw new AppError(
        409,
        "DOWNLOAD_TICKET_STALE",
        `Download ticket ${ticket.ticketId} no longer matches the current file content.`,
        {
          expectedChecksum: ticket.checksum,
          actualChecksum: result.sha256,
          objectKey: ticket.objectKey,
          path: ticket.path,
        }
      );
    }

    this.assertAccessAllowed(subject, result, "download");
  }

  async checkReadiness(): Promise<FileSecurityReadiness> {
    const config = this.#getConfig();
    if (config.fileScanMode !== "clamav") {
      return {
        status: config.fileScanMode === "disabled" ? "disabled" : "ready",
        detail: null,
        metadata: {
          mode: config.fileScanMode,
        },
      };
    }

    return await this.#probeClamav("zPING\0", "PONG");
  }

  async getDiagnostics(): Promise<FileSecurityDiagnostics> {
    const config = this.#getConfig();
    return {
      mode: config.fileScanMode,
      errorPolicy: config.fileScanErrorPolicy,
      timeoutMs: config.fileScanTimeoutMs,
      blockedExtensions: [...this.#getNormalizedBlockedExtensions()].sort(),
      blockedMimePrefixes: [...this.#getNormalizedBlockedMimePrefixes()].sort(),
      blockMacroEnabledOffice: config.fileScanBlockMacroEnabledOffice,
      clamav: {
        host: config.fileScanClamavHost ?? null,
        port: config.fileScanMode === "clamav" ? config.fileScanClamavPort : null,
      },
      cache: {
        entryCount: this.#cache.size,
        ttlMs: DEFAULT_CACHE_TTL_MS,
      },
      readiness: await this.checkReadiness(),
      metrics: {
        ...this.#metrics,
      },
    };
  }
}

export const runFileSecurityService = new RunFileSecurityService();
