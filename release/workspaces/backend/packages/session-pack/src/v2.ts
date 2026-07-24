import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import tar from "tar-stream";
import { ZstdCodec } from "zstd-codec";
import { minimatch } from "minimatch";
import { z } from "zod";
import {
  sessionPackInformationCollectionReviewFileSchema,
  sessionPackMcpRequirementsFileSchema,
  sessionPackRedactionMapSchema,
  sessionPackRuntimeConfigSchema,
  sessionPackRuntimeProfileSchema,
  sessionPackSlotSchemaFileSchema,
} from "./schema.js";

export const sessionPackV2ManifestVersion = "lingban.session-pack/v2" as const;

export const sessionPackV2RequiredRootFiles = [
  "capture-provenance.json",
  "agent-events.jsonl",
  "conversation.jsonl",
  "tool-events.jsonl",
  "approval-events.jsonl",
  "workspace-base.tar.zst",
  "workspace-inventory.json",
  "artifact-index.json",
  "slot-schema.json",
  "information-collection-review.json",
  "mcp-requirements.json",
  "runtime-profile.json",
  "runtime-config.json",
  "provider-profile.json",
  "validator-set.json",
  "redaction-map.json",
  "validation-report.json",
] as const;

export type SessionPackV2ValidationIssue = {
  code: "REQUIRED_FILE_MISSING" | "JSON_INVALID" | "JSONL_INVALID" | "SCHEMA_INVALID" | "WORKSPACE_ARCHIVE_INVALID";
  path: string;
  message: string;
};

export type SessionPackV2FileInput = {
  content: Uint8Array | string;
  contentType?: string;
  required?: boolean;
};

export type SessionPackV2Manifest = {
  manifestVersion: typeof sessionPackV2ManifestVersion;
  sessionId: string | null;
  sessionVersionId: string | null;
  sourceCaptureId: string;
  sourceRevisionId: string | null;
  parentSessionVersionId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
  signature?: SessionPackV2Signature;
  files: Array<{
    path: string;
    sha256: string;
    sizeBytes: number;
    contentType: string;
    required: boolean;
  }>;
};

export type SessionPackV2Signature = {
  algorithm: "hmac-sha256" | "ed25519";
  keyId: string;
  value: string;
};

export type PackSessionV2Input = {
  sessionId?: string | null;
  sessionVersionId?: string | null;
  sourceCaptureId: string;
  sourceRevisionId?: string | null;
  parentSessionVersionId?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
  signature?: SessionPackV2Signature;
  files: Record<string, SessionPackV2FileInput>;
  compressionLevel?: number;
};

export type SessionPackArchiveLimits = {
  maxArchiveBytes: number;
  maxExpandedBytes: number;
  maxEntries: number;
  maxPathLength: number;
  maxCompressionRatio: number;
};

export const defaultSessionPackArchiveLimits: SessionPackArchiveLimits = {
  maxArchiveBytes: 2 * 1024 * 1024 * 1024,
  maxExpandedBytes: 2 * 1024 * 1024 * 1024,
  maxEntries: 100_100,
  maxPathLength: 1_024,
  maxCompressionRatio: 1_000,
};

const sessionPackV2ManifestSchema = z.object({
  manifestVersion: z.literal(sessionPackV2ManifestVersion),
  sessionId: z.string().min(1).nullable(),
  sessionVersionId: z.string().min(1).nullable(),
  sourceCaptureId: z.string().min(1),
  sourceRevisionId: z.string().min(1).nullable(),
  parentSessionVersionId: z.string().min(1).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  metadata: z.record(z.string(), z.unknown()),
  signature: z.object({
    algorithm: z.enum(["hmac-sha256", "ed25519"]),
    keyId: z.string().min(1),
    value: z.string().min(1),
  }).strict().optional(),
  files: z.array(z.object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    sizeBytes: z.number().int().nonnegative(),
    contentType: z.string().min(1),
    required: z.boolean(),
  }).strict()),
}).strict();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)])
  );
}

export function buildSessionPackV2SignaturePayload(manifest: SessionPackV2Manifest) {
  const { signature: _signature, ...unsignedManifest } = manifest;
  return Buffer.from(JSON.stringify(canonicalize(unsignedManifest)), "utf8");
}

let codecRuntimePromise: Promise<{ Simple: new () => { compress(content: Uint8Array, level?: number): Uint8Array; decompress(content: Uint8Array): Uint8Array | null } }> | null = null;

function getCodecRuntime() {
  if (!codecRuntimePromise) {
    codecRuntimePromise = new Promise((resolve, reject) => {
      try {
        ZstdCodec.run(resolve);
      } catch (error) {
        reject(error);
      }
    });
  }
  return codecRuntimePromise;
}

const nativeZstdUnavailableCodes = new Set(["ENOENT", "EACCES"]);

async function runNativeZstd(
  content: Uint8Array,
  args: string[],
  maxOutputBytes: number
): Promise<Uint8Array | null> {
  const binary = process.env.LINGBAN_ZSTD_BIN?.trim() || "zstd";
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["-q", "-c", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outputBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(error);
    };

    child.once("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      if (error.code && nativeZstdUnavailableCodes.has(error.code)) {
        resolve(null);
        return;
      }
      reject(error);
    });
    child.stdout.on("data", (chunk: Buffer | Uint8Array) => {
      if (settled) return;
      const buffer = Buffer.from(chunk);
      outputBytes += buffer.byteLength;
      if (outputBytes > maxOutputBytes) {
        fail(new Error(`Session Pack zstd output limit exceeded: ${maxOutputBytes}`));
        return;
      }
      chunks.push(buffer);
    });
    child.stderr.on("data", (chunk: Buffer | Uint8Array) => {
      if (stderrBytes >= 64 * 1024) return;
      const remaining = 64 * 1024 - stderrBytes;
      const buffer = Buffer.from(chunk).subarray(0, remaining);
      stderrBytes += buffer.byteLength;
      stderrChunks.push(buffer);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        const detail = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(new Error(`Session Pack zstd process failed with exit code ${code}${detail ? `: ${detail}` : ""}`));
        return;
      }
      resolve(new Uint8Array(Buffer.concat(chunks, outputBytes)));
    });
    child.stdin.once("error", (error) => fail(error));
    child.stdin.end(Buffer.from(content));
  });
}

async function compressZstd(content: Uint8Array, compressionLevel: number) {
  const level = Math.max(1, Math.min(19, Math.trunc(compressionLevel)));
  const native = await runNativeZstd(
    content,
    [`-${level}`],
    defaultSessionPackArchiveLimits.maxArchiveBytes
  );
  if (native) return native;
  const runtime = await getCodecRuntime();
  return new Uint8Array(new runtime.Simple().compress(content, level));
}

async function decompressZstd(content: Uint8Array, maxOutputBytes: number) {
  const native = await runNativeZstd(content, ["-d"], maxOutputBytes);
  if (native) return native;
  const runtime = await getCodecRuntime();
  const decompressed = new runtime.Simple().decompress(content);
  if (!decompressed) throw new Error("Failed to decompress tar.zst archive");
  if (decompressed.byteLength > maxOutputBytes) {
    throw new Error(`Session Pack expanded size limit exceeded: ${maxOutputBytes}`);
  }
  return new Uint8Array(decompressed);
}

function toBuffer(content: Uint8Array | string) {
  return typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
}

function sha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

function validateEntryPath(entryPath: string, maxPathLength = defaultSessionPackArchiveLimits.maxPathLength) {
  if (!entryPath || entryPath.length > maxPathLength || entryPath.startsWith("/") || entryPath.includes("\\") || entryPath.split("/").includes("..")) {
    throw new Error(`Invalid Session Pack v2 path: ${entryPath}`);
  }
  return entryPath;
}

async function buildTar(files: Map<string, Buffer>) {
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    pack.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    pack.on("error", reject);
    pack.on("end", () => resolve(Buffer.concat(chunks)));
  });
  for (const [entryPath, content] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    await new Promise<void>((resolve, reject) => {
      pack.entry({
        name: entryPath,
        size: content.byteLength,
        mode: 0o644,
        uid: 0,
        gid: 0,
        mtime: new Date(0),
        type: "file",
      }, content, (error) => error ? reject(error) : resolve());
    });
  }
  pack.finalize();
  return completed;
}

async function extractTar(content: Uint8Array, limits: SessionPackArchiveLimits) {
  const extract = tar.extract();
  const files = new Map<string, Uint8Array>();
  let totalBytes = 0;
  let totalEntries = 0;
  const completed = new Promise<void>((resolve, reject) => {
    extract.on("entry", (header, stream, next) => {
      try {
        const entryPath = validateEntryPath(header.name, limits.maxPathLength);
        totalEntries += 1;
        if (totalEntries > limits.maxEntries) throw new Error(`Session Pack archive entry limit exceeded: ${limits.maxEntries}`);
        if (files.has(entryPath)) throw new Error(`Duplicate Session Pack archive path: ${entryPath}`);
        if (header.type !== "file") {
          throw new Error(`Unsupported Session Pack archive entry type ${header.type}: ${entryPath}`);
        }
        const declaredSize = Number(header.size ?? 0);
        if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) throw new Error(`Invalid archive entry size: ${entryPath}`);
        totalBytes += declaredSize;
        if (totalBytes > limits.maxExpandedBytes) throw new Error(`Session Pack expanded size limit exceeded: ${limits.maxExpandedBytes}`);
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("error", reject);
        stream.on("end", () => {
          files.set(entryPath, new Uint8Array(Buffer.concat(chunks)));
          next();
        });
        stream.resume();
      } catch (error) {
        reject(error);
      }
    });
    extract.on("finish", resolve);
    extract.on("error", reject);
  });
  extract.end(Buffer.from(content));
  await completed;
  return files;
}

export async function unpackTarZstdEntries(
  archive: Uint8Array,
  limitOverrides: Partial<SessionPackArchiveLimits> = {}
) {
  const limits = { ...defaultSessionPackArchiveLimits, ...limitOverrides };
  if (archive.byteLength > limits.maxArchiveBytes) throw new Error(`Session Pack archive size limit exceeded: ${limits.maxArchiveBytes}`);
  const decompressed = await decompressZstd(archive, limits.maxExpandedBytes);
  if (archive.byteLength > 0 && decompressed.byteLength > 64 * 1024 * 1024 && decompressed.byteLength / archive.byteLength > limits.maxCompressionRatio) {
    throw new Error(`Session Pack compression ratio limit exceeded: ${limits.maxCompressionRatio}`);
  }
  return extractTar(decompressed, limits);
}

export async function packTarZstdEntries(entries: Map<string, Uint8Array>, compressionLevel = 9) {
  const tarEntries = new Map([...entries.entries()].map(([entryPath, content]) => [
    validateEntryPath(entryPath),
    Buffer.from(content),
  ]));
  const tarContent = await buildTar(tarEntries);
  return compressZstd(tarContent, compressionLevel);
}

export async function filterWorkspaceTarZstd(
  archive: Uint8Array,
  options: { includeGlobs: string[]; excludeGlobs: string[] }
) {
  const entries = await unpackTarZstdEntries(archive);
  const filtered = new Map<string, Uint8Array>();
  for (const [entryPath, content] of entries) {
    const logicalPath = entryPath.replace(/^workspace\//, "");
    const included = options.includeGlobs.some((pattern) => minimatch(logicalPath, pattern, { dot: true }));
    const excluded = options.excludeGlobs.some((pattern) => minimatch(logicalPath, pattern, { dot: true }));
    if (included && !excluded) filtered.set(entryPath, content);
  }
  return { archive: await packTarZstdEntries(filtered), entries: filtered };
}

export async function validateSessionVersionV2Files(files: Record<string, SessionPackV2FileInput>) {
  const issues: SessionPackV2ValidationIssue[] = [];
  for (const entryPath of sessionPackV2RequiredRootFiles) {
    if (!files[entryPath]) {
      issues.push({ code: "REQUIRED_FILE_MISSING", path: entryPath, message: `Required Session Pack v2 file is missing: ${entryPath}` });
    }
  }

  const schemas = new Map<string, { safeParse(value: unknown): { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } } }>([
    ["slot-schema.json", sessionPackSlotSchemaFileSchema],
    ["information-collection-review.json", sessionPackInformationCollectionReviewFileSchema],
    ["mcp-requirements.json", sessionPackMcpRequirementsFileSchema],
    ["runtime-profile.json", sessionPackRuntimeProfileSchema],
    ["runtime-config.json", sessionPackRuntimeConfigSchema],
    ["redaction-map.json", sessionPackRedactionMapSchema],
  ]);
  const jsonFiles = sessionPackV2RequiredRootFiles.filter((entryPath) => entryPath.endsWith(".json"));
  for (const entryPath of jsonFiles) {
    const descriptor = files[entryPath];
    if (!descriptor) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(toBuffer(descriptor.content).toString("utf8")) as unknown;
    } catch (error) {
      issues.push({ code: "JSON_INVALID", path: entryPath, message: error instanceof Error ? error.message : `Invalid JSON: ${entryPath}` });
      continue;
    }
    const schema = schemas.get(entryPath);
    if (!schema) continue;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error?.issues ?? []) {
        issues.push({
          code: "SCHEMA_INVALID",
          path: issue.path.length ? `${entryPath}.${issue.path.join(".")}` : entryPath,
          message: issue.message,
        });
      }
    }
  }

  for (const entryPath of sessionPackV2RequiredRootFiles.filter((value) => value.endsWith(".jsonl"))) {
    const descriptor = files[entryPath];
    if (!descriptor) continue;
    const lines = toBuffer(descriptor.content).toString("utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      try {
        JSON.parse(line);
      } catch (error) {
        issues.push({
          code: "JSONL_INVALID",
          path: `${entryPath}:${index + 1}`,
          message: error instanceof Error ? error.message : `Invalid JSONL record: ${entryPath}:${index + 1}`,
        });
      }
    });
  }

  const workspace = files["workspace-base.tar.zst"];
  if (workspace) {
    try {
      await unpackTarZstdEntries(toBuffer(workspace.content));
    } catch (error) {
      issues.push({
        code: "WORKSPACE_ARCHIVE_INVALID",
        path: "workspace-base.tar.zst",
        message: error instanceof Error ? error.message : "Workspace archive is invalid",
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

export async function packSessionVersionV2(input: PackSessionV2Input) {
  const validation = await validateSessionVersionV2Files(input.files);
  if (!validation.ok) {
    throw new Error(`Session Pack v2 validation failed: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  const files = new Map<string, Buffer>();
  const manifestFiles: SessionPackV2Manifest["files"] = [];
  for (const [rawPath, descriptor] of Object.entries(input.files)) {
    const entryPath = validateEntryPath(rawPath);
    if (entryPath === "manifest.json") throw new Error("manifest.json is generated by the v2 packer");
    const content = toBuffer(descriptor.content);
    files.set(entryPath, content);
    manifestFiles.push({
      path: entryPath,
      sha256: sha256(content),
      sizeBytes: content.byteLength,
      contentType: descriptor.contentType ?? "application/octet-stream",
      required: descriptor.required ?? true,
    });
  }
  manifestFiles.sort((left, right) => left.path.localeCompare(right.path));
  const manifest: SessionPackV2Manifest = {
    manifestVersion: sessionPackV2ManifestVersion,
    sessionId: input.sessionId ?? null,
    sessionVersionId: input.sessionVersionId ?? null,
    sourceCaptureId: input.sourceCaptureId,
    sourceRevisionId: input.sourceRevisionId ?? null,
    parentSessionVersionId: input.parentSessionVersionId ?? null,
    createdAt: input.createdAt,
    metadata: input.metadata ?? {},
    ...(input.signature ? { signature: input.signature } : {}),
    files: manifestFiles,
  };
  files.set("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8"));
  const tarContent = await buildTar(files);
  const archive = Buffer.from(await compressZstd(tarContent, input.compressionLevel ?? 9));
  return {
    archive: new Uint8Array(archive),
    sha256: sha256(archive),
    sizeBytes: archive.byteLength,
    manifest,
  };
}

export async function unpackSessionVersionV2(archive: Uint8Array) {
  const files = await unpackTarZstdEntries(archive);
  const manifestContent = files.get("manifest.json");
  if (!manifestContent) throw new Error("Session Pack v2 manifest.json is missing");
  const manifest = sessionPackV2ManifestSchema.parse(JSON.parse(Buffer.from(manifestContent).toString("utf8"))) as SessionPackV2Manifest;
  const declaredPaths = new Set<string>();
  for (const descriptor of manifest.files) {
    validateEntryPath(descriptor.path);
    if (descriptor.path === "manifest.json" || declaredPaths.has(descriptor.path)) {
      throw new Error(`Session Pack v2 manifest contains a duplicate or reserved path: ${descriptor.path}`);
    }
    declaredPaths.add(descriptor.path);
    const content = files.get(descriptor.path);
    if (!content || content.byteLength !== descriptor.sizeBytes || sha256(content) !== descriptor.sha256) {
      throw new Error(`Session Pack v2 file verification failed: ${descriptor.path}`);
    }
  }
  const actualPaths = [...files.keys()].filter((entryPath) => entryPath !== "manifest.json");
  const undeclaredPath = actualPaths.find((entryPath) => !declaredPaths.has(entryPath));
  if (undeclaredPath) throw new Error(`Session Pack v2 archive contains an undeclared file: ${undeclaredPath}`);
  const packFiles = Object.fromEntries(
    actualPaths.map((entryPath) => [entryPath, { content: files.get(entryPath)! }])
  );
  const validation = await validateSessionVersionV2Files(packFiles);
  if (!validation.ok) {
    throw new Error(`Session Pack v2 content validation failed: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  return { manifest, files };
}
