import path from "node:path";
import type { RunConversationAttachment } from "@lingban/contracts";

export type ConversationFileReference = {
  sourcePath: string;
  label: string;
  kind: "image" | "video" | "file";
};

type EmbeddedCandidate = ConversationFileReference & {
  start: number | null;
  end: number | null;
};

const imagePattern = /\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i;
const videoPattern = /\.(?:mp4|webm|mov|m4v|ogv|ogg)(?:[?#].*)?$/i;
const remoteSourcePattern = /^(?:https?:|data:|blob:|\/\/|#)/i;

function decodeSource(value: string) {
  const trimmed = value.trim().replace(/^<|>$/g, "");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function inferKind(source: string): ConversationFileReference["kind"] {
  if (imagePattern.test(source)) return "image";
  if (videoPattern.test(source)) return "video";
  return "file";
}

function normalizeSegments(value: string) {
  const segments: string[] = [];
  for (const segment of value.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

export function normalizeConversationFilePath(source: string, targetPath: string) {
  let decoded = decodeSource(source).replace(/\\/g, "/").replace(/[?#].*$/, "");
  if (!decoded || remoteSourcePattern.test(decoded)) return null;
  if (/^file:\/\//i.test(decoded)) decoded = decoded.replace(/^file:\/\//i, "");

  const normalizedRoot = targetPath.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  let relative = decoded;
  if (normalizedRoot && (decoded === normalizedRoot || decoded.startsWith(`${normalizedRoot}/`))) {
    relative = decoded.slice(normalizedRoot.length);
  } else if (decoded === "/workspace/target" || decoded.startsWith("/workspace/target/")) {
    relative = decoded.slice("/workspace/target".length);
  } else if (/^(?:[A-Za-z]:)?\//.test(decoded)) {
    return null;
  }

  const normalized = normalizeSegments(relative.replace(/^\/+/, ""));
  return normalized && normalized.length <= 1024 ? normalized : null;
}

function fallbackLabel(source: string) {
  const normalized = source.replace(/\\/g, "/").replace(/[?#].*$/, "");
  return path.posix.basename(normalized) || "附件";
}

function stripMarkdownTitle(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end > 0 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.match(/^(.+?)\s+(?:"[^"]*"|'[^']*')\s*$/)?.[1] ?? trimmed;
}

function collectMarkdownCandidates(text: string) {
  const candidates: EmbeddedCandidate[] = [];
  const pattern = /!?\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const source = stripMarkdownTitle(match[2] ?? "");
    if (!imagePattern.test(source) && !videoPattern.test(source)) continue;
    candidates.push({
      sourcePath: source,
      label: (match[1] ?? "").trim() || fallbackLabel(source),
      kind: inferKind(source),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return candidates;
}

function collectHtmlCandidates(text: string) {
  const candidates: EmbeddedCandidate[] = [];
  const pattern = /<(?:img|video|source)\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const source = match[2] ?? "";
    if (!imagePattern.test(source) && !videoPattern.test(source)) continue;
    candidates.push({
      sourcePath: source,
      label: fallbackLabel(source),
      kind: inferKind(source),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return candidates;
}

function collectPathCandidates(text: string) {
  const candidates: EmbeddedCandidate[] = [];
  const pattern = /(?:^|[\s'"`(:])((?:\.\.\/|\.\/|\/workspace\/target\/|(?:[\w.-]+\/)+)?[\w.-]+\.(?:png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v|ogv|ogg)(?:[?#][^\s<>"'`]*)?)/gim;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const source = match[1] ?? "";
    candidates.push({
      sourcePath: source,
      label: fallbackLabel(source),
      kind: inferKind(source),
      start: null,
      end: null,
    });
  }
  return candidates;
}

function removeEmbeddedMarkup(text: string, candidates: EmbeddedCandidate[]) {
  const spans = candidates
    .filter((candidate) => candidate.start != null && candidate.end != null)
    .map((candidate) => ({ start: candidate.start!, end: candidate.end! }))
    .sort((left, right) => right.start - left.start);
  let result = text;
  for (const span of spans) {
    result = `${result.slice(0, span.start)}${result.slice(span.end)}`;
  }
  return result.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function redactConversationShareText(text: string, targetPath: string) {
  const targetVariants = [
    targetPath,
    targetPath.replace(/\\/g, "/"),
    targetPath.replace(/\//g, "\\"),
    "/workspace/target",
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  let redacted = text;
  for (const target of targetVariants) {
    redacted = redacted.split(target).join("[工作区]");
  }

  return redacted
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[已隐藏私钥]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/gi, "Bearer [已隐藏]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[已隐藏 API Key]")
    .replace(
      /\b(api[_-]?key|access[_-]?token|secret|password)\b\s*[:=]\s*([^\s,;]{8,})/gi,
      (_match, name: string) => `${name}=[已隐藏]`
    );
}

export function extractConversationShareContent(
  text: string,
  attachments: RunConversationAttachment[],
  targetPath: string
) {
  const embedded = [
    ...collectMarkdownCandidates(text),
    ...collectHtmlCandidates(text),
    ...collectPathCandidates(text),
  ];
  const acceptedEmbedded: EmbeddedCandidate[] = [];
  const references = new Map<string, ConversationFileReference>();

  for (const candidate of embedded) {
    const sourcePath = normalizeConversationFilePath(candidate.sourcePath, targetPath);
    if (!sourcePath) continue;
    acceptedEmbedded.push(candidate);
    references.set(sourcePath, {
      sourcePath,
      label: candidate.label,
      kind: candidate.kind,
    });
  }

  for (const attachment of attachments) {
    const sourcePath = normalizeConversationFilePath(attachment.path, targetPath);
    if (!sourcePath) continue;
    references.set(sourcePath, {
      sourcePath,
      label: attachment.label || fallbackLabel(sourcePath),
      kind: inferKind(sourcePath),
    });
  }

  return {
    text: redactConversationShareText(
      removeEmbeddedMarkup(text, acceptedEmbedded),
      targetPath
    ),
    references: [...references.values()],
  };
}
