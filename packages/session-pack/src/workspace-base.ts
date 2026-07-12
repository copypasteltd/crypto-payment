import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  sessionPackWorkspaceBaseFileName,
  workspaceBaseArchiveFormatVersion,
} from "./constants.js";

export interface WorkspaceBaseArchiveEntry {
  path: string;
  kind: "file" | "directory";
  contentBase64?: string;
  sha256?: string;
  size?: number;
}

export interface WorkspaceBaseArchiveEnvelope {
  formatVersion: typeof workspaceBaseArchiveFormatVersion;
  metadata: Record<string, unknown>;
  entries: WorkspaceBaseArchiveEntry[];
  legacyPlaceholder: boolean;
}

export interface CreateWorkspaceBaseArchiveOptions {
  ignoreMissingRoot?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RestoreWorkspaceBaseArchiveResult {
  formatVersion: typeof workspaceBaseArchiveFormatVersion;
  restoredDirectoriesCount: number;
  restoredFilesCount: number;
  metadata: Record<string, unknown>;
  legacyPlaceholder: boolean;
}

type WorkspaceBaseArchiveEnvelopeJson = {
  format_version: typeof workspaceBaseArchiveFormatVersion;
  metadata?: Record<string, unknown>;
  entries: Array<{
    path: string;
    kind: "file" | "directory";
    content_base64?: string;
    sha256?: string;
    size?: number;
  }>;
};

function normalizeWorkspaceBaseEntryPath(entryPath: string) {
  const normalized = entryPath.replace(/\\/g, "/").trim();
  if (!normalized) {
    throw new Error(`${sessionPackWorkspaceBaseFileName} entry path must not be empty.`);
  }
  if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`${sessionPackWorkspaceBaseFileName} entry path must be relative: ${entryPath}`);
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error(
      `${sessionPackWorkspaceBaseFileName} entry path contains an invalid segment: ${entryPath}`
    );
  }
  return normalized;
}

function toBytes(value: Uint8Array | ArrayBuffer) {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function sha256Hex(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function buildWorkspaceBaseEnvelopeBytes(
  entries: WorkspaceBaseArchiveEntry[],
  metadata: Record<string, unknown> = {}
) {
  const envelope: WorkspaceBaseArchiveEnvelopeJson = {
    format_version: workspaceBaseArchiveFormatVersion,
    metadata,
    entries: entries.map((entry) => ({
      path: normalizeWorkspaceBaseEntryPath(entry.path),
      kind: entry.kind,
      content_base64: entry.contentBase64,
      sha256: entry.sha256,
      size: entry.size,
    })),
  };

  return new Uint8Array(gzipSync(Buffer.from(`${JSON.stringify(envelope)}\n`, "utf8")));
}

function parseLegacyWorkspaceBasePlaceholder(serialized: Uint8Array) {
  try {
    const text = Buffer.from(serialized).toString("utf8").trim();
    if (!text) {
      return {
        formatVersion: workspaceBaseArchiveFormatVersion,
        metadata: {},
        entries: [],
        legacyPlaceholder: true,
      } satisfies WorkspaceBaseArchiveEnvelope;
    }

    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return {
      formatVersion: workspaceBaseArchiveFormatVersion,
      metadata: {
        legacy_placeholder: parsed,
      },
      entries: [],
      legacyPlaceholder: true,
    } satisfies WorkspaceBaseArchiveEnvelope;
  } catch {
    return null;
  }
}

function parseWorkspaceBaseArchiveEnvelope(serialized: Uint8Array) {
  let inflatedText: string;
  try {
    inflatedText = gunzipSync(Buffer.from(serialized)).toString("utf8");
  } catch (error) {
    const legacyEnvelope = parseLegacyWorkspaceBasePlaceholder(serialized);
    if (legacyEnvelope) {
      return legacyEnvelope;
    }
    throw new Error(
      `${sessionPackWorkspaceBaseFileName} failed to decompress: ${
        error instanceof Error ? error.message : "Unknown gzip failure"
      }`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(inflatedText) as unknown;
  } catch (error) {
    throw new Error(
      `${sessionPackWorkspaceBaseFileName} failed to parse archive JSON: ${
        error instanceof Error ? error.message : "Unknown JSON parse failure"
      }`
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${sessionPackWorkspaceBaseFileName} archive must be a JSON object.`);
  }

  const envelope = parsed as Partial<WorkspaceBaseArchiveEnvelopeJson>;
  if (envelope.format_version !== workspaceBaseArchiveFormatVersion) {
    throw new Error(
      `${sessionPackWorkspaceBaseFileName} archive exposes an unsupported format: ${
        typeof envelope.format_version === "string" ? envelope.format_version : "unknown"
      }`
    );
  }
  if (!Array.isArray(envelope.entries)) {
    throw new Error(`${sessionPackWorkspaceBaseFileName} archive is missing entries[].`);
  }

  const entries = envelope.entries.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${sessionPackWorkspaceBaseFileName} archive contains an invalid entry.`);
    }
    const normalizedPath = normalizeWorkspaceBaseEntryPath(entry.path ?? "");
    if (entry.kind !== "file" && entry.kind !== "directory") {
      throw new Error(
        `${sessionPackWorkspaceBaseFileName} entry ${normalizedPath} exposes an invalid kind.`
      );
    }
    if (entry.kind === "file" && typeof entry.content_base64 !== "string") {
      throw new Error(
        `${sessionPackWorkspaceBaseFileName} file entry ${normalizedPath} is missing content_base64.`
      );
    }

    return {
      path: normalizedPath,
      kind: entry.kind,
      contentBase64: entry.content_base64,
      sha256: entry.sha256,
      size: entry.size,
    } satisfies WorkspaceBaseArchiveEntry;
  });

  return {
    formatVersion: workspaceBaseArchiveFormatVersion,
    metadata:
      envelope.metadata && typeof envelope.metadata === "object" && !Array.isArray(envelope.metadata)
        ? envelope.metadata
        : {},
    entries,
    legacyPlaceholder: false,
  } satisfies WorkspaceBaseArchiveEnvelope;
}

async function collectWorkspaceBaseArchiveEntries(
  rootDir: string,
  currentDir: string,
  entries: WorkspaceBaseArchiveEntry[]
): Promise<void> {
  const children = await fs.readdir(currentDir, { withFileTypes: true });
  children.sort((left, right) => left.name.localeCompare(right.name));

  for (const child of children) {
    const absolutePath = path.join(currentDir, child.name);
    const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, "/");
    const normalizedPath = normalizeWorkspaceBaseEntryPath(relativePath);

    if (child.isDirectory()) {
      entries.push({
        path: normalizedPath,
        kind: "directory",
      });
      await collectWorkspaceBaseArchiveEntries(rootDir, absolutePath, entries);
      continue;
    }

    if (!child.isFile()) {
      throw new Error(
        `${sessionPackWorkspaceBaseFileName} does not support non-file entries: ${absolutePath}`
      );
    }

    const content = await fs.readFile(absolutePath);
    entries.push({
      path: normalizedPath,
      kind: "file",
      contentBase64: content.toString("base64"),
      sha256: sha256Hex(content),
      size: content.byteLength,
    });
  }
}

export function createEmptyWorkspaceBaseArchive(metadata: Record<string, unknown> = {}) {
  return buildWorkspaceBaseEnvelopeBytes([], metadata);
}

export async function createWorkspaceBaseArchiveFromDirectory(
  rootDir: string,
  options: CreateWorkspaceBaseArchiveOptions = {}
) {
  const ignoreMissingRoot = options.ignoreMissingRoot ?? false;
  const metadata = options.metadata ?? {};

  let stats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stats = await fs.stat(rootDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT" && ignoreMissingRoot) {
      return createEmptyWorkspaceBaseArchive({
        ...metadata,
        missing_root: true,
      });
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error(
      `${sessionPackWorkspaceBaseFileName} source root must be a directory: ${rootDir}`
    );
  }

  const entries: WorkspaceBaseArchiveEntry[] = [];
  await collectWorkspaceBaseArchiveEntries(rootDir, rootDir, entries);
  return buildWorkspaceBaseEnvelopeBytes(entries, metadata);
}

export function deserializeWorkspaceBaseArchive(serialized: Uint8Array | ArrayBuffer) {
  return parseWorkspaceBaseArchiveEnvelope(toBytes(serialized));
}

export async function restoreWorkspaceBaseArchiveToDirectory(
  serialized: Uint8Array | ArrayBuffer,
  targetDir: string
): Promise<RestoreWorkspaceBaseArchiveResult> {
  const envelope = deserializeWorkspaceBaseArchive(serialized);

  await fs.mkdir(targetDir, { recursive: true });
  const directories = envelope.entries
    .filter((entry) => entry.kind === "directory")
    .sort((left, right) => left.path.length - right.path.length);
  const files = envelope.entries.filter((entry) => entry.kind === "file");

  for (const entry of directories) {
    await fs.mkdir(path.join(targetDir, entry.path), { recursive: true });
  }

  for (const entry of files) {
    const absolutePath = path.join(targetDir, entry.path);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const content = Buffer.from(entry.contentBase64 ?? "", "base64");
    if (typeof entry.size === "number" && content.byteLength !== entry.size) {
      throw new Error(
        `${sessionPackWorkspaceBaseFileName} file size mismatch during restore: ${entry.path}`
      );
    }
    if (entry.sha256 && sha256Hex(content) !== entry.sha256) {
      throw new Error(
        `${sessionPackWorkspaceBaseFileName} file hash mismatch during restore: ${entry.path}`
      );
    }
    await fs.writeFile(absolutePath, content);
  }

  return {
    formatVersion: envelope.formatVersion,
    restoredDirectoriesCount: directories.length,
    restoredFilesCount: files.length,
    metadata: envelope.metadata,
    legacyPlaceholder: envelope.legacyPlaceholder,
  };
}

export async function restoreWorkspaceBaseArchiveFileToDirectory(
  archivePath: string,
  targetDir: string
) {
  const content = await fs.readFile(archivePath);
  return restoreWorkspaceBaseArchiveToDirectory(content, targetDir);
}
