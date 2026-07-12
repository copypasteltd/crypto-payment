import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { sessionPackWorkspaceBaseFileName, workspaceBaseArchiveFormatVersion, } from "./constants.js";
function normalizeWorkspaceBaseEntryPath(entryPath) {
    const normalized = entryPath.replace(/\\/g, "/").trim();
    if (!normalized) {
        throw new Error(`${sessionPackWorkspaceBaseFileName} entry path must not be empty.`);
    }
    if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
        throw new Error(`${sessionPackWorkspaceBaseFileName} entry path must be relative: ${entryPath}`);
    }
    const segments = normalized.split("/");
    if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
        throw new Error(`${sessionPackWorkspaceBaseFileName} entry path contains an invalid segment: ${entryPath}`);
    }
    return normalized;
}
function toBytes(value) {
    return value instanceof Uint8Array ? value : new Uint8Array(value);
}
function sha256Hex(value) {
    return createHash("sha256").update(value).digest("hex");
}
function buildWorkspaceBaseEnvelopeBytes(entries, metadata = {}) {
    const envelope = {
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
function parseLegacyWorkspaceBasePlaceholder(serialized) {
    try {
        const text = Buffer.from(serialized).toString("utf8").trim();
        if (!text) {
            return {
                formatVersion: workspaceBaseArchiveFormatVersion,
                metadata: {},
                entries: [],
                legacyPlaceholder: true,
            };
        }
        const parsed = JSON.parse(text);
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
        };
    }
    catch {
        return null;
    }
}
function parseWorkspaceBaseArchiveEnvelope(serialized) {
    let inflatedText;
    try {
        inflatedText = gunzipSync(Buffer.from(serialized)).toString("utf8");
    }
    catch (error) {
        const legacyEnvelope = parseLegacyWorkspaceBasePlaceholder(serialized);
        if (legacyEnvelope) {
            return legacyEnvelope;
        }
        throw new Error(`${sessionPackWorkspaceBaseFileName} failed to decompress: ${error instanceof Error ? error.message : "Unknown gzip failure"}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(inflatedText);
    }
    catch (error) {
        throw new Error(`${sessionPackWorkspaceBaseFileName} failed to parse archive JSON: ${error instanceof Error ? error.message : "Unknown JSON parse failure"}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${sessionPackWorkspaceBaseFileName} archive must be a JSON object.`);
    }
    const envelope = parsed;
    if (envelope.format_version !== workspaceBaseArchiveFormatVersion) {
        throw new Error(`${sessionPackWorkspaceBaseFileName} archive exposes an unsupported format: ${typeof envelope.format_version === "string" ? envelope.format_version : "unknown"}`);
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
            throw new Error(`${sessionPackWorkspaceBaseFileName} entry ${normalizedPath} exposes an invalid kind.`);
        }
        if (entry.kind === "file" && typeof entry.content_base64 !== "string") {
            throw new Error(`${sessionPackWorkspaceBaseFileName} file entry ${normalizedPath} is missing content_base64.`);
        }
        return {
            path: normalizedPath,
            kind: entry.kind,
            contentBase64: entry.content_base64,
            sha256: entry.sha256,
            size: entry.size,
        };
    });
    return {
        formatVersion: workspaceBaseArchiveFormatVersion,
        metadata: envelope.metadata && typeof envelope.metadata === "object" && !Array.isArray(envelope.metadata)
            ? envelope.metadata
            : {},
        entries,
        legacyPlaceholder: false,
    };
}
async function collectWorkspaceBaseArchiveEntries(rootDir, currentDir, entries) {
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
            throw new Error(`${sessionPackWorkspaceBaseFileName} does not support non-file entries: ${absolutePath}`);
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
export function createEmptyWorkspaceBaseArchive(metadata = {}) {
    return buildWorkspaceBaseEnvelopeBytes([], metadata);
}
export async function createWorkspaceBaseArchiveFromDirectory(rootDir, options = {}) {
    const ignoreMissingRoot = options.ignoreMissingRoot ?? false;
    const metadata = options.metadata ?? {};
    let stats;
    try {
        stats = await fs.stat(rootDir);
    }
    catch (error) {
        if (error?.code === "ENOENT" && ignoreMissingRoot) {
            return createEmptyWorkspaceBaseArchive({
                ...metadata,
                missing_root: true,
            });
        }
        throw error;
    }
    if (!stats.isDirectory()) {
        throw new Error(`${sessionPackWorkspaceBaseFileName} source root must be a directory: ${rootDir}`);
    }
    const entries = [];
    await collectWorkspaceBaseArchiveEntries(rootDir, rootDir, entries);
    return buildWorkspaceBaseEnvelopeBytes(entries, metadata);
}
export function deserializeWorkspaceBaseArchive(serialized) {
    return parseWorkspaceBaseArchiveEnvelope(toBytes(serialized));
}
export async function restoreWorkspaceBaseArchiveToDirectory(serialized, targetDir) {
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
            throw new Error(`${sessionPackWorkspaceBaseFileName} file size mismatch during restore: ${entry.path}`);
        }
        if (entry.sha256 && sha256Hex(content) !== entry.sha256) {
            throw new Error(`${sessionPackWorkspaceBaseFileName} file hash mismatch during restore: ${entry.path}`);
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
export async function restoreWorkspaceBaseArchiveFileToDirectory(archivePath, targetDir) {
    const content = await fs.readFile(archivePath);
    return restoreWorkspaceBaseArchiveToDirectory(content, targetDir);
}
//# sourceMappingURL=workspace-base.js.map