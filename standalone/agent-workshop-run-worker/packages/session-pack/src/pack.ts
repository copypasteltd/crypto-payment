import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

import {
  sessionPackArchiveFormatVersion,
  sessionPackInformationCollectionReviewFileName,
  sessionPackManifestFileName,
  sessionPackManifestVersion,
  sessionPackRedactionMapFileName,
  sessionPackRequiredRootFiles,
  sessionPackRuntimeAlternativeFiles,
} from "./constants.js";
import {
  encodeSessionPackManifestFile,
  signSessionPackManifest,
  type SessionPackSigningOptions,
} from "./signature.js";
import {
  sessionPackArchiveEnvelopeSchema,
  sessionPackInformationCollectionReviewFileSchema,
  sessionPackMcpRequirementsFileSchema,
  sessionPackManifestSchema,
  sessionPackRedactionMapSchema,
  sessionPackRuntimeConfigSchema,
  sessionPackRuntimeProfileSchema,
  sessionPackSlotSchemaFileSchema,
  type SessionPackFileIntegrity,
  type SessionPackManifest,
} from "./schema.js";

export type SessionPackInputContent = string | Uint8Array | ArrayBuffer;

export interface PackSessionVersionInput {
  manifest: Omit<SessionPackManifest, "manifest_version" | "files">;
  files: Record<string, SessionPackInputContent>;
  signature?: SessionPackSigningOptions;
}

export interface SessionPackBundle {
  manifest: SessionPackManifest;
  files: Record<string, Uint8Array>;
}

export type SessionPackValidationIssueCode =
  | "MANIFEST_MISSING"
  | "MANIFEST_INVALID_JSON"
  | "MANIFEST_SCHEMA_INVALID"
  | "REQUIRED_FILE_MISSING"
  | "RUNTIME_FILE_MISSING"
  | "MANIFEST_FILE_MISSING"
  | "FILE_HASH_MISMATCH"
  | "FILE_SIZE_MISMATCH"
  | "BUNDLE_MANIFEST_FILE_MISSING"
  | "SLOT_SCHEMA_INVALID"
  | "MCP_REQUIREMENTS_INVALID"
  | "RUNTIME_PROFILE_INVALID"
  | "RUNTIME_CONFIG_INVALID"
  | "REDACTION_MAP_INVALID"
  | "INFORMATION_COLLECTION_REVIEW_INVALID"
  | "ARCHIVE_INVALID_GZIP"
  | "ARCHIVE_INVALID_JSON"
  | "ARCHIVE_SCHEMA_INVALID";

export interface SessionPackValidationIssue {
  code: SessionPackValidationIssueCode;
  path?: string;
  message: string;
}

export interface SessionPackValidationResult {
  ok: boolean;
  manifest?: SessionPackManifest;
  entries: string[];
  issues: SessionPackValidationIssue[];
}

export interface WriteSessionPackBundleOptions {
  overwrite?: boolean;
}

export interface WriteSessionPackArchiveOptions {
  overwrite?: boolean;
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

function decodeText(value: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: true }).decode(value);
}

function toBytes(value: SessionPackInputContent): Uint8Array {
  if (typeof value === "string") {
    return encodeText(value);
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  return new Uint8Array(value);
}

function sha256Hex(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function buildInvalidRootFileIssue(
  code:
    | "SLOT_SCHEMA_INVALID"
    | "MCP_REQUIREMENTS_INVALID"
    | "RUNTIME_PROFILE_INVALID"
    | "RUNTIME_CONFIG_INVALID"
    | "REDACTION_MAP_INVALID"
    | "INFORMATION_COLLECTION_REVIEW_INVALID",
  entryPath: string,
  message: string
): SessionPackValidationIssue {
  return {
    code,
    path: entryPath,
    message,
  };
}

function parseJsonRootFile(
  entryPath: string,
  content: Uint8Array,
  parser: { safeParse(value: unknown): { success: true } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } },
  code:
    | "SLOT_SCHEMA_INVALID"
    | "MCP_REQUIREMENTS_INVALID"
    | "RUNTIME_PROFILE_INVALID"
    | "RUNTIME_CONFIG_INVALID"
    | "REDACTION_MAP_INVALID"
    | "INFORMATION_COLLECTION_REVIEW_INVALID"
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeText(content)) as unknown;
  } catch (error) {
    return [
      buildInvalidRootFileIssue(
        code,
        entryPath,
        error instanceof Error ? error.message : `Failed to parse ${entryPath}`
      ),
    ];
  }

  const result = parser.safeParse(parsed);
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) =>
    buildInvalidRootFileIssue(
      code,
      issue.path.length > 0 ? `${entryPath}.${issue.path.join(".")}` : entryPath,
      issue.message
    )
  );
}

function collectContentIssues(
  files: Record<string, Uint8Array>
): SessionPackValidationIssue[] {
  const issues: SessionPackValidationIssue[] = [];

  const slotSchemaContent = files["slot-schema.json"];
  if (slotSchemaContent) {
    issues.push(
      ...parseJsonRootFile(
        "slot-schema.json",
        slotSchemaContent,
        sessionPackSlotSchemaFileSchema,
        "SLOT_SCHEMA_INVALID"
      )
    );
  }

  const mcpRequirementsContent = files["mcp-requirements.json"];
  if (mcpRequirementsContent) {
    issues.push(
      ...parseJsonRootFile(
        "mcp-requirements.json",
        mcpRequirementsContent,
        sessionPackMcpRequirementsFileSchema,
        "MCP_REQUIREMENTS_INVALID"
      )
    );
  }

  const runtimeProfileContent = files["runtime-profile.json"];
  if (runtimeProfileContent) {
    issues.push(
      ...parseJsonRootFile(
        "runtime-profile.json",
        runtimeProfileContent,
        sessionPackRuntimeProfileSchema,
        "RUNTIME_PROFILE_INVALID"
      )
    );
  }

  const runtimeConfigContent = files["runtime-config.json"];
  if (runtimeConfigContent) {
    issues.push(
      ...parseJsonRootFile(
        "runtime-config.json",
        runtimeConfigContent,
        sessionPackRuntimeConfigSchema,
        "RUNTIME_CONFIG_INVALID"
      )
    );
  }

  const redactionMapContent = files[sessionPackRedactionMapFileName];
  if (redactionMapContent) {
    issues.push(
      ...parseJsonRootFile(
        sessionPackRedactionMapFileName,
        redactionMapContent,
        sessionPackRedactionMapSchema,
        "REDACTION_MAP_INVALID"
      )
    );
  }

  const informationCollectionReviewContent =
    files[sessionPackInformationCollectionReviewFileName];
  if (informationCollectionReviewContent) {
    issues.push(
      ...parseJsonRootFile(
        sessionPackInformationCollectionReviewFileName,
        informationCollectionReviewContent,
        sessionPackInformationCollectionReviewFileSchema,
        "INFORMATION_COLLECTION_REVIEW_INVALID"
      )
    );
  }

  return issues;
}

export function normalizeSessionPackEntryPath(entryPath: string) {
  const normalized = entryPath.replace(/\\/g, "/").trim();
  if (!normalized) {
    throw new Error("Session pack file path must not be empty.");
  }
  if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Session pack file path must be relative: ${entryPath}`);
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error(`Session pack file path contains an invalid segment: ${entryPath}`);
  }
  return normalized;
}

export function buildSessionPackFileIndex(files: Record<string, Uint8Array>) {
  const fileIndex: Record<string, SessionPackFileIntegrity> = {};
  for (const [entryPath, content] of Object.entries(files)) {
    if (entryPath === sessionPackManifestFileName) {
      continue;
    }
    fileIndex[entryPath] = {
      sha256: sha256Hex(content),
      size: content.byteLength,
      required: true,
    };
  }
  return fileIndex;
}

function collectLayoutIssues(
  manifest: SessionPackManifest,
  entryPaths: Iterable<string>,
  includeManifestEntryCheck: boolean
) {
  const entrySet = new Set(entryPaths);
  const issues: SessionPackValidationIssue[] = [];

  if (includeManifestEntryCheck && !entrySet.has(sessionPackManifestFileName)) {
    issues.push({
      code: "BUNDLE_MANIFEST_FILE_MISSING",
      path: sessionPackManifestFileName,
      message: "Session pack bundle is missing manifest.json.",
    });
  }

  for (const requiredFile of sessionPackRequiredRootFiles) {
    if (!entrySet.has(requiredFile)) {
      issues.push({
        code: "REQUIRED_FILE_MISSING",
        path: requiredFile,
        message: `Session pack is missing required file: ${requiredFile}`,
      });
    }
  }

  if (!sessionPackRuntimeAlternativeFiles.some((fileName) => entrySet.has(fileName))) {
    issues.push({
      code: "RUNTIME_FILE_MISSING",
      message: `Session pack requires one runtime file: ${sessionPackRuntimeAlternativeFiles.join(" or ")}`,
    });
  }

  for (const entryPath of Object.keys(manifest.files)) {
    if (!entrySet.has(entryPath)) {
      issues.push({
        code: "MANIFEST_FILE_MISSING",
        path: entryPath,
        message: `Manifest references a file that is missing from the pack: ${entryPath}`,
      });
    }
  }

  return issues;
}

function collectDirectoryEntries(rootDir: string, currentDir = rootDir): string[] {
  const children = readdirSync(currentDir, { withFileTypes: true });
  const entries: string[] = [];
  for (const child of children) {
    const absolutePath = path.join(currentDir, child.name);
    if (child.isDirectory()) {
      entries.push(...collectDirectoryEntries(rootDir, absolutePath));
      continue;
    }
    entries.push(path.relative(rootDir, absolutePath).replace(/\\/g, "/"));
  }
  return entries.sort();
}

function parseManifest(rawContent: string): SessionPackManifest | SessionPackValidationIssue[] {
  try {
    const parsed = JSON.parse(rawContent) as unknown;
    const manifestResult = sessionPackManifestSchema.safeParse(parsed);
    if (manifestResult.success) {
      return manifestResult.data;
    }
    return manifestResult.error.issues.map((issue) => ({
      code: "MANIFEST_SCHEMA_INVALID" as const,
      path: issue.path.join(".") || sessionPackManifestFileName,
      message: issue.message,
    }));
  } catch (error) {
    return [
      {
        code: "MANIFEST_INVALID_JSON" as const,
        path: sessionPackManifestFileName,
        message: error instanceof Error ? error.message : "Failed to parse manifest.json",
      },
    ];
  }
}

function buildValidationResult(
  manifest: SessionPackManifest | undefined,
  entries: string[],
  issues: SessionPackValidationIssue[]
): SessionPackValidationResult {
  return {
    ok: issues.length === 0,
    manifest,
    entries,
    issues,
  };
}

export function formatSessionPackValidationIssues(issues: SessionPackValidationIssue[]) {
  return issues
    .map((issue) => `${issue.code}${issue.path ? `(${issue.path})` : ""}: ${issue.message}`)
    .join("; ");
}

export function validateSessionPackBundle(bundle: SessionPackBundle): SessionPackValidationResult {
  const manifestResult = sessionPackManifestSchema.safeParse(bundle.manifest);
  if (!manifestResult.success) {
    return buildValidationResult(
      undefined,
      Object.keys(bundle.files).sort(),
      manifestResult.error.issues.map((issue) => ({
        code: "MANIFEST_SCHEMA_INVALID" as const,
        path: issue.path.join(".") || sessionPackManifestFileName,
        message: issue.message,
      }))
    );
  }

  const manifest = manifestResult.data;
  const entries = Object.keys(bundle.files).sort();
  const issues = collectLayoutIssues(manifest, entries, true);
  for (const [entryPath, integrity] of Object.entries(manifest.files)) {
    const content = bundle.files[entryPath];
    if (!content) {
      continue;
    }
    if (content.byteLength !== integrity.size) {
      issues.push({
        code: "FILE_SIZE_MISMATCH",
        path: entryPath,
        message: `Session pack file size mismatch for ${entryPath}: expected ${integrity.size}, received ${content.byteLength}`,
      });
    }
    const digest = sha256Hex(content);
    if (digest !== integrity.sha256) {
      issues.push({
        code: "FILE_HASH_MISMATCH",
        path: entryPath,
        message: `Session pack file hash mismatch for ${entryPath}: expected ${integrity.sha256}, received ${digest}`,
      });
    }
  }

  issues.push(...collectContentIssues(bundle.files));

  return buildValidationResult(manifest, entries, issues);
}

export function validateSessionPackDirectory(packDir: string): SessionPackValidationResult {
  const manifestPath = path.join(packDir, sessionPackManifestFileName);
  if (!existsSync(manifestPath)) {
    return buildValidationResult(undefined, [], [
      {
        code: "MANIFEST_MISSING",
        path: sessionPackManifestFileName,
        message: `Session pack directory is missing ${sessionPackManifestFileName}.`,
      },
    ]);
  }

  const entries = collectDirectoryEntries(packDir);
  const manifestParseResult = parseManifest(readFileSync(manifestPath, "utf8"));
  if (Array.isArray(manifestParseResult)) {
    return buildValidationResult(undefined, entries, manifestParseResult);
  }

  const manifest = manifestParseResult;
  const issues = collectLayoutIssues(manifest, entries, false);
  const fileContents: Record<string, Uint8Array> = {};
  for (const [entryPath, integrity] of Object.entries(manifest.files)) {
    const absolutePath = path.join(packDir, entryPath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    const stats = statSync(absolutePath);
    if (!stats.isFile()) {
      issues.push({
        code: "MANIFEST_FILE_MISSING",
        path: entryPath,
        message: `Manifest expects a file but found a non-file entry: ${entryPath}`,
      });
      continue;
    }
    fileContents[entryPath] = readFileSync(absolutePath);
    if (stats.size !== integrity.size) {
      issues.push({
        code: "FILE_SIZE_MISMATCH",
        path: entryPath,
        message: `Session pack file size mismatch for ${entryPath}: expected ${integrity.size}, received ${stats.size}`,
      });
    }
    const digest = sha256Hex(fileContents[entryPath]);
    if (digest !== integrity.sha256) {
      issues.push({
        code: "FILE_HASH_MISMATCH",
        path: entryPath,
        message: `Session pack file hash mismatch for ${entryPath}: expected ${integrity.sha256}, received ${digest}`,
      });
    }
  }

  for (const rootFile of ["slot-schema.json", "mcp-requirements.json", "runtime-profile.json", "runtime-config.json", sessionPackRedactionMapFileName]) {
    if (fileContents[rootFile]) {
      continue;
    }
    const absolutePath = path.join(packDir, rootFile);
    if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
      fileContents[rootFile] = readFileSync(absolutePath);
    }
  }

  issues.push(...collectContentIssues(fileContents));

  return buildValidationResult(manifest, entries, issues);
}

export function readSessionPackBundleFromDirectory(packDir: string): SessionPackBundle {
  const validation = validateSessionPackDirectory(packDir);
  if (!validation.ok || !validation.manifest) {
    const issueSummary =
      validation.issues.length > 0
        ? formatSessionPackValidationIssues(validation.issues)
        : `Failed to load session pack directory ${packDir}.`;
    throw new Error(`Session pack directory failed validation: ${issueSummary}`);
  }

  const files: Record<string, Uint8Array> = {};
  for (const entryPath of validation.entries) {
    const normalizedPath = normalizeSessionPackEntryPath(entryPath);
    files[normalizedPath] = readFileSync(path.join(packDir, normalizedPath));
  }

  return {
    manifest: validation.manifest,
    files,
  };
}

export function writeSessionPackBundleToDirectory(
  bundle: SessionPackBundle,
  packDir: string,
  options: WriteSessionPackBundleOptions = {}
) {
  const validation = validateSessionPackBundle(bundle);
  if (!validation.ok || !validation.manifest) {
    const issueSummary =
      validation.issues.length > 0
        ? formatSessionPackValidationIssues(validation.issues)
        : "Unknown validation failure.";
    throw new Error(`Session pack bundle failed validation: ${issueSummary}`);
  }

  const overwrite = options.overwrite ?? true;
  mkdirSync(packDir, { recursive: true });

  const writtenEntries: string[] = [];
  for (const [entryPath, content] of Object.entries(bundle.files)) {
    const normalizedPath = normalizeSessionPackEntryPath(entryPath);
    const absolutePath = path.join(packDir, normalizedPath);
    if (!overwrite && existsSync(absolutePath)) {
      throw new Error(`Session pack entry already exists and overwrite=false: ${normalizedPath}`);
    }
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
    writtenEntries.push(normalizedPath);
  }

  return writtenEntries.sort();
}

export function packSessionVersion(input: PackSessionVersionInput): SessionPackBundle {
  const normalizedFiles: Record<string, Uint8Array> = {};
  for (const [entryPath, content] of Object.entries(input.files)) {
    const normalizedPath = normalizeSessionPackEntryPath(entryPath);
    if (normalizedPath === sessionPackManifestFileName) {
      continue;
    }
    normalizedFiles[normalizedPath] = toBytes(content);
  }

  const fileIndex = buildSessionPackFileIndex(normalizedFiles);
  const unsignedManifest = sessionPackManifestSchema.parse({
    ...input.manifest,
    manifest_version: sessionPackManifestVersion,
    files: fileIndex,
  });
  const manifest = input.signature
    ? signSessionPackManifest(unsignedManifest, input.signature)
    : unsignedManifest;

  const bundle: SessionPackBundle = {
    manifest,
    files: {
      ...normalizedFiles,
      [sessionPackManifestFileName]: encodeSessionPackManifestFile(manifest),
    },
  };

  const validation = validateSessionPackBundle(bundle);
  if (!validation.ok) {
    const issueSummary = formatSessionPackValidationIssues(validation.issues);
    throw new Error(`Session pack bundle failed validation: ${issueSummary}`);
  }

  return bundle;
}

function buildSessionPackArchiveEnvelope(bundle: SessionPackBundle) {
  return sessionPackArchiveEnvelopeSchema.parse({
    format_version: sessionPackArchiveFormatVersion,
    manifest: bundle.manifest,
    files: Object.fromEntries(
      Object.entries(bundle.files).map(([entryPath, content]) => [
        entryPath,
        Buffer.from(content).toString("base64"),
      ])
    ),
  });
}

export function serializeSessionPackBundle(bundle: SessionPackBundle) {
  const validation = validateSessionPackBundle(bundle);
  if (!validation.ok || !validation.manifest) {
    const issueSummary =
      validation.issues.length > 0
        ? formatSessionPackValidationIssues(validation.issues)
        : "Unknown validation failure.";
    throw new Error(`Session pack bundle failed validation: ${issueSummary}`);
  }

  const envelope = buildSessionPackArchiveEnvelope(bundle);
  return new Uint8Array(
    gzipSync(Buffer.from(`${JSON.stringify(envelope)}\n`, "utf8"))
  );
}

export function deserializeSessionPackBundle(serialized: Uint8Array | ArrayBuffer) {
  let archiveJsonText: string;
  try {
    const inflated = gunzipSync(Buffer.from(serialized instanceof Uint8Array ? serialized : new Uint8Array(serialized)));
    archiveJsonText = inflated.toString("utf8");
  } catch (error) {
    throw new Error(
      `Session pack archive failed validation: ${formatSessionPackValidationIssues([
        {
          code: "ARCHIVE_INVALID_GZIP",
          message: error instanceof Error ? error.message : "Failed to gunzip session pack archive",
        },
      ])}`
    );
  }

  let parsedArchive: unknown;
  try {
    parsedArchive = JSON.parse(archiveJsonText) as unknown;
  } catch (error) {
    throw new Error(
      `Session pack archive failed validation: ${formatSessionPackValidationIssues([
        {
          code: "ARCHIVE_INVALID_JSON",
          message: error instanceof Error ? error.message : "Failed to parse session pack archive JSON",
        },
      ])}`
    );
  }

  const envelopeResult = sessionPackArchiveEnvelopeSchema.safeParse(parsedArchive);
  if (!envelopeResult.success) {
    throw new Error(
      `Session pack archive failed validation: ${formatSessionPackValidationIssues(
        envelopeResult.error.issues.map((issue) => ({
          code: "ARCHIVE_SCHEMA_INVALID" as const,
          path: issue.path.join(".") || "archive",
          message: issue.message,
        }))
      )}`
    );
  }

  const bundle: SessionPackBundle = {
    manifest: envelopeResult.data.manifest,
    files: Object.fromEntries(
      Object.entries(envelopeResult.data.files).map(([entryPath, content]) => [
        normalizeSessionPackEntryPath(entryPath),
        new Uint8Array(Buffer.from(content, "base64")),
      ])
    ),
  };

  const validation = validateSessionPackBundle(bundle);
  if (!validation.ok || !validation.manifest) {
    const issueSummary =
      validation.issues.length > 0
        ? formatSessionPackValidationIssues(validation.issues)
        : "Unknown validation failure.";
    throw new Error(`Session pack archive failed validation: ${issueSummary}`);
  }

  return bundle;
}

export function writeSessionPackBundleArchive(
  bundle: SessionPackBundle,
  archivePath: string,
  options: WriteSessionPackArchiveOptions = {}
) {
  const overwrite = options.overwrite ?? true;
  if (!overwrite && existsSync(archivePath)) {
    throw new Error(`Session pack archive already exists and overwrite=false: ${archivePath}`);
  }

  mkdirSync(path.dirname(archivePath), { recursive: true });
  const serialized = serializeSessionPackBundle(bundle);
  writeFileSync(archivePath, serialized);
  return archivePath;
}

export function readSessionPackBundleArchive(archivePath: string) {
  if (!existsSync(archivePath)) {
    throw new Error(`Session pack archive is missing: ${archivePath}`);
  }

  return deserializeSessionPackBundle(readFileSync(archivePath));
}
