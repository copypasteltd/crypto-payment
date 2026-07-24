import path from "node:path";
import { promises as fs } from "node:fs";
import JSZip from "jszip";
import mammoth from "mammoth";
import XLSX from "xlsx";
import type { RunFilePreviewMode } from "@lingban/contracts";

export const MAX_TEXT_PREVIEW_BYTES = 256 * 1024;

const WORD_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroenabled.12",
]);

const SPREADSHEET_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel",
]);

const PRESENTATION_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
]);

export type TextPreview = {
  content: string;
  truncated: boolean;
};

function normalizeMimeType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function normalizeTextPreviewContent(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function truncateTextPreview(content: string): TextPreview {
  const normalized = normalizeTextPreviewContent(content);
  const buffer = Buffer.from(normalized, "utf8");
  const truncated = buffer.byteLength > MAX_TEXT_PREVIEW_BYTES;

  return {
    content: truncated
      ? buffer.subarray(0, MAX_TEXT_PREVIEW_BYTES).toString("utf8")
      : normalized,
    truncated,
  };
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    );
}

function readSlideNumber(fileName: string) {
  const matched = /slide(\d+)\.xml$/i.exec(fileName);
  return matched ? Number.parseInt(matched[1] ?? "0", 10) : Number.MAX_SAFE_INTEGER;
}

async function readBufferFromStream(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  try {
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } finally {
    if ("destroy" in stream && typeof stream.destroy === "function") {
      stream.destroy();
    }
  }

  return Buffer.concat(chunks);
}

function isWordPreviewMimeType(mimeType: string | null) {
  return mimeType != null && WORD_PREVIEW_MIME_TYPES.has(mimeType);
}

function isSpreadsheetPreviewMimeType(mimeType: string | null) {
  return mimeType != null && SPREADSHEET_PREVIEW_MIME_TYPES.has(mimeType);
}

function isPresentationPreviewMimeType(mimeType: string | null) {
  return mimeType != null && PRESENTATION_PREVIEW_MIME_TYPES.has(mimeType);
}

async function extractWordPreview(buffer: Buffer) {
  const extracted = await mammoth.extractRawText({
    buffer,
  });

  return truncateTextPreview(extracted.value);
}

function extractSpreadsheetPreview(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
    cellText: true,
  });
  const maxSheets = 3;
  const maxRows = 40;
  const maxCols = 12;
  const blocks: string[] = [];
  let truncated = workbook.SheetNames.length > maxSheets;

  for (const [sheetIndex, sheetName] of workbook.SheetNames.slice(0, maxSheets).entries()) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: "",
    });

    blocks.push(`# Sheet ${sheetIndex + 1}: ${sheetName}`);

    if (rows.length > maxRows) {
      truncated = true;
    }

    for (const row of rows.slice(0, maxRows)) {
      if (row.length > maxCols) {
        truncated = true;
      }

      const cells = row.slice(0, maxCols).map((value) => String(value ?? "").trim());
      blocks.push(cells.join("\t").replace(/\t+$/g, ""));
    }

    if (rows.length === 0) {
      blocks.push("(empty sheet)");
    }
  }

  const base = truncateTextPreview(blocks.join("\n").trim());
  return {
    content: base.content,
    truncated: base.truncated || truncated,
  };
}

async function extractPresentationPreview(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((fileName) => /^ppt\/slides\/slide\d+\.xml$/i.test(fileName))
    .sort((left, right) => readSlideNumber(left) - readSlideNumber(right));
  const blocks: string[] = [];

  for (const [slideIndex, fileName] of slideFiles.entries()) {
    const xml = await zip.file(fileName)?.async("string");
    if (!xml) {
      continue;
    }

    const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXmlEntities(match[1] ?? "").trim())
      .filter(Boolean);

    if (texts.length === 0) {
      continue;
    }

    blocks.push(`# Slide ${slideIndex + 1}`);
    blocks.push(texts.join("\n"));
  }

  return truncateTextPreview(blocks.join("\n\n").trim());
}

export function toPosixPath(value: string) {
  return value.replace(/\\/g, "/");
}

export function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export function normalizeAbsoluteFilePath(value: string) {
  return toPosixPath(path.resolve(value));
}

export function resolvePathWithinRoot(rootPath: string, requestedPath?: string) {
  const root = path.resolve(rootPath);
  const raw = requestedPath?.trim();
  const candidate =
    !raw || raw === "/"
      ? root
      : path.resolve(path.isAbsolute(raw) ? raw : path.join(root, raw));
  const relative = path.relative(root, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return candidate;
}

export function createLogicalPath(rootPath: string, absolutePath: string) {
  const relative = toPosixPath(path.relative(path.resolve(rootPath), path.resolve(absolutePath)));
  if (!relative || relative === ".") {
    return "/";
  }

  const isDirectoryLike = /[\\/]$/.test(absolutePath);
  const normalized = isDirectoryLike ? ensureTrailingSlash(relative) : relative;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function normalizeLogicalPrefix(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const raw = toPosixPath(value.trim());
  if (raw === "/") {
    return "/";
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function guessFileMimeType(filePath: string, explicitMimeType?: string | null) {
  if (explicitMimeType?.trim()) {
    return explicitMimeType.trim();
  }

  const normalized = filePath.toLowerCase();
  if (normalized.endsWith(".json")) return "application/json; charset=utf-8";
  if (normalized.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (normalized.endsWith(".html")) return "text/html; charset=utf-8";
  if (normalized.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (normalized.endsWith(".txt") || normalized.endsWith(".log")) return "text/plain; charset=utf-8";
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".mp4") || normalized.endsWith(".m4v")) return "video/mp4";
  if (normalized.endsWith(".webm")) return "video/webm";
  if (normalized.endsWith(".mov")) return "video/quicktime";
  if (normalized.endsWith(".ogv") || normalized.endsWith(".ogg")) return "video/ogg";
  if (normalized.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (normalized.endsWith(".docm")) {
    return "application/vnd.ms-word.document.macroEnabled.12";
  }
  if (normalized.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (normalized.endsWith(".xlsm")) {
    return "application/vnd.ms-excel.sheet.macroEnabled.12";
  }
  if (normalized.endsWith(".xls")) {
    return "application/vnd.ms-excel";
  }
  if (normalized.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (normalized.endsWith(".pptm")) {
    return "application/vnd.ms-powerpoint.presentation.macroEnabled.12";
  }
  return "application/octet-stream";
}

export function isOfficePreviewMimeType(mimeType: string | null | undefined) {
  const normalized = normalizeMimeType(mimeType);
  return (
    isWordPreviewMimeType(normalized) ||
    isSpreadsheetPreviewMimeType(normalized) ||
    isPresentationPreviewMimeType(normalized)
  );
}

export function inferFilePreviewMode(
  filePath: string,
  mimeType: string | null | undefined
): RunFilePreviewMode {
  const normalizedMimeType =
    normalizeMimeType(mimeType) ?? normalizeMimeType(guessFileMimeType(filePath));

  if (normalizedMimeType?.startsWith("text/")) {
    return "text";
  }

  if (
    normalizedMimeType === "application/json; charset=utf-8" ||
    normalizedMimeType === "text/csv; charset=utf-8" ||
    isOfficePreviewMimeType(normalizedMimeType)
  ) {
    return "text";
  }

  if (normalizedMimeType === "application/pdf") {
    return "pdf";
  }

  if (normalizedMimeType?.startsWith("image/")) {
    return "image";
  }

  if (normalizedMimeType?.startsWith("video/")) {
    return "video";
  }

  return "download";
}

export async function readTextPreviewFromPath(absolutePath: string) {
  const content = await fs.readFile(absolutePath);
  const truncated = content.byteLength > MAX_TEXT_PREVIEW_BYTES;

  return {
    content: content.subarray(0, MAX_TEXT_PREVIEW_BYTES).toString("utf8"),
    truncated,
  };
}

export async function readTextPreviewFromStream(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  let sizeBytes = 0;

  try {
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = MAX_TEXT_PREVIEW_BYTES + 1 - sizeBytes;
      if (remaining <= 0) {
        break;
      }

      const slice = buffer.byteLength > remaining ? buffer.subarray(0, remaining) : buffer;
      chunks.push(Buffer.from(slice));
      sizeBytes += slice.byteLength;

      if (sizeBytes > MAX_TEXT_PREVIEW_BYTES) {
        break;
      }
    }
  } finally {
    if ("destroy" in stream && typeof stream.destroy === "function") {
      stream.destroy();
    }
  }

  const combined = Buffer.concat(chunks);
  const truncated = combined.byteLength > MAX_TEXT_PREVIEW_BYTES;

  return {
    content: combined.subarray(0, MAX_TEXT_PREVIEW_BYTES).toString("utf8"),
    truncated,
  };
}

export async function extractOfficePreviewFromPath(
  absolutePath: string,
  mimeType: string | null | undefined
) {
  const buffer = await fs.readFile(absolutePath);
  return extractOfficePreviewFromBuffer(buffer, mimeType);
}

export async function extractOfficePreviewFromStream(
  stream: NodeJS.ReadableStream,
  mimeType: string | null | undefined
) {
  const buffer = await readBufferFromStream(stream);
  return extractOfficePreviewFromBuffer(buffer, mimeType);
}

export async function extractOfficePreviewFromBuffer(
  buffer: Buffer,
  mimeType: string | null | undefined
) {
  const normalizedMimeType = normalizeMimeType(mimeType);

  if (isWordPreviewMimeType(normalizedMimeType)) {
    return extractWordPreview(buffer);
  }

  if (isSpreadsheetPreviewMimeType(normalizedMimeType)) {
    return extractSpreadsheetPreview(buffer);
  }

  if (isPresentationPreviewMimeType(normalizedMimeType)) {
    return extractPresentationPreview(buffer);
  }

  throw new Error(`Unsupported office preview mime type: ${mimeType ?? "unknown"}`);
}

export const guessRunFileMimeType = guessFileMimeType;
export const inferRunFilePreviewMode = inferFilePreviewMode;
