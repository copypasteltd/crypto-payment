import { createHash } from "node:crypto";

import {
  sessionPackManifestFileName,
  sessionPackRedactionMapFileName,
} from "./constants.js";
import { packSessionVersion, type SessionPackBundle } from "./pack.js";
import {
  sessionPackManifestSchema,
  sessionPackRedactionMapSchema,
  type SessionPackManifest,
  type SessionPackRedactionRule,
} from "./schema.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

type JsonPathSegment = number | string;

export interface SessionPackRedactionRuleReport {
  ruleId: string;
  targetKind: SessionPackRedactionRule["target"]["kind"];
  selector: string;
  matches: number;
  mutatedEntries: string[];
}

export interface SessionPackRedactionReport {
  ruleCount: number;
  matchedRuleCount: number;
  totalMatches: number;
  mutatedEntries: string[];
  rules: SessionPackRedactionRuleReport[];
}

export interface ApplySessionPackRedactionOptions {
  metadata?: Record<string, boolean | number | string>;
}

export interface ApplySessionPackRedactionResult {
  bundle: SessionPackBundle;
  report: SessionPackRedactionReport;
}

function decodeUtf8(content: Uint8Array) {
  return textDecoder.decode(content);
}

function tryDecodeUtf8(content: Uint8Array) {
  try {
    return decodeUtf8(content);
  } catch {
    return null;
  }
}

function encodeUtf8(content: string) {
  return textEncoder.encode(content);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEntrySelector(value: string) {
  return value.replace(/\\/g, "/").trim();
}

function maskText(value: string) {
  return Array.from(value, (character) => (/\s/.test(character) ? character : "*")).join("");
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function applyReplacementStrategy(
  value: string,
  rule: Pick<SessionPackRedactionRule, "replacement" | "strategy">
) {
  switch (rule.strategy) {
    case "mask":
      return maskText(value);
    case "remove":
      return "";
    case "replace":
      return rule.replacement ?? "";
    case "hash":
      return hashText(value);
  }
}

function replaceExactText(
  source: string,
  selector: string,
  rule: Pick<SessionPackRedactionRule, "replacement" | "strategy">
) {
  if (!selector) {
    return {
      content: source,
      matches: 0,
    };
  }

  const parts = source.split(selector);
  const matches = parts.length - 1;
  if (matches <= 0) {
    return {
      content: source,
      matches: 0,
    };
  }

  return {
    content: parts.join(applyReplacementStrategy(selector, rule)),
    matches,
  };
}

function replaceRegexMatches(
  source: string,
  pattern: RegExp,
  valueIndex: number,
  rule: Pick<SessionPackRedactionRule, "replacement" | "strategy">
) {
  let matches = 0;
  const content = source.replace(pattern, (...args) => {
    matches += 1;
    const groups = args.slice(1, -2);
    const originalValue = String(groups[valueIndex] ?? "");
    groups[valueIndex] = applyReplacementStrategy(originalValue, rule);
    return groups.join("");
  });

  return {
    content,
    matches,
  };
}

function buildFileSelectorRegex(selector: string) {
  const normalized = normalizeEntrySelector(selector);
  const wildcardPattern = escapeRegExp(normalized)
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*");
  return new RegExp(`^${wildcardPattern}$`, "i");
}

function matchesFileSelector(selector: string, entryPath: string) {
  const normalizedSelector = normalizeEntrySelector(selector);
  const normalizedEntryPath = normalizeEntrySelector(entryPath);
  if (!normalizedSelector.includes("*")) {
    return normalizedSelector === normalizedEntryPath;
  }
  return buildFileSelectorRegex(normalizedSelector).test(normalizedEntryPath);
}

function parseJsonSelector(selector: string) {
  const hashSeparator = selector.indexOf("#");
  if (hashSeparator > 0) {
    return {
      entryPath: normalizeEntrySelector(selector.slice(0, hashSeparator)),
      jsonPath: selector.slice(hashSeparator + 1).trim(),
    };
  }

  const colonSeparator = selector.indexOf(":");
  if (colonSeparator > 0) {
    return {
      entryPath: normalizeEntrySelector(selector.slice(0, colonSeparator)),
      jsonPath: selector.slice(colonSeparator + 1).trim(),
    };
  }

  return null;
}

function parseJsonPathSegments(jsonPath: string): JsonPathSegment[] {
  const normalized = jsonPath.trim();
  if (normalized === "$") {
    return [];
  }

  if (!normalized.startsWith("$")) {
    throw new Error(`Unsupported JSON path selector: ${jsonPath}`);
  }

  const segments: JsonPathSegment[] = [];
  let cursor = 1;

  while (cursor < normalized.length) {
    const current = normalized[cursor];
    if (current === ".") {
      cursor += 1;
      const start = cursor;
      while (cursor < normalized.length && /[A-Za-z0-9_-]/.test(normalized[cursor]!)) {
        cursor += 1;
      }
      if (cursor === start) {
        throw new Error(`Invalid JSON path selector: ${jsonPath}`);
      }
      segments.push(normalized.slice(start, cursor));
      continue;
    }

    if (current === "[") {
      cursor += 1;
      if (normalized[cursor] === '"' || normalized[cursor] === "'") {
        const quote = normalized[cursor]!;
        cursor += 1;
        const start = cursor;
        while (cursor < normalized.length && normalized[cursor] !== quote) {
          cursor += 1;
        }
        if (cursor >= normalized.length) {
          throw new Error(`Invalid JSON path selector: ${jsonPath}`);
        }
        segments.push(normalized.slice(start, cursor));
        cursor += 1;
      } else {
        const start = cursor;
        while (cursor < normalized.length && /[0-9]/.test(normalized[cursor]!)) {
          cursor += 1;
        }
        if (cursor === start) {
          throw new Error(`Invalid JSON path selector: ${jsonPath}`);
        }
        segments.push(Number.parseInt(normalized.slice(start, cursor), 10));
      }

      if (normalized[cursor] !== "]") {
        throw new Error(`Invalid JSON path selector: ${jsonPath}`);
      }
      cursor += 1;
      continue;
    }

    throw new Error(`Unsupported JSON path selector: ${jsonPath}`);
  }

  return segments;
}

function mutateJsonValueAtPath(
  source: unknown,
  segments: JsonPathSegment[],
  rule: SessionPackRedactionRule
) {
  if (segments.length === 0) {
    return {
      mutated: false,
      nextValue: source,
    };
  }

  let current = source as Record<string, unknown> | unknown[];

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return {
          mutated: false,
          nextValue: source,
        };
      }
      current = current[segment] as Record<string, unknown> | unknown[];
      continue;
    }

    if (
      current == null ||
      Array.isArray(current) ||
      typeof current !== "object" ||
      !(segment in current)
    ) {
      return {
        mutated: false,
        nextValue: source,
      };
    }
    current = current[segment] as Record<string, unknown> | unknown[];
  }

  const leaf = segments[segments.length - 1]!;
  if (typeof leaf === "number") {
    if (!Array.isArray(current) || leaf < 0 || leaf >= current.length) {
      return {
        mutated: false,
        nextValue: source,
      };
    }
    if (rule.strategy === "remove") {
      current.splice(leaf, 1);
      return {
        mutated: true,
        nextValue: source,
      };
    }
    current[leaf] = applyReplacementStrategy(
      typeof current[leaf] === "string" ? current[leaf] : JSON.stringify(current[leaf]),
      rule
    );
    return {
      mutated: true,
      nextValue: source,
    };
  }

  if (
    current == null ||
    Array.isArray(current) ||
    typeof current !== "object" ||
    !(leaf in current)
  ) {
    return {
      mutated: false,
      nextValue: source,
    };
  }

  if (rule.strategy === "remove") {
    delete current[leaf];
    return {
      mutated: true,
      nextValue: source,
    };
  }

  current[leaf] = applyReplacementStrategy(
    typeof current[leaf] === "string" ? String(current[leaf]) : JSON.stringify(current[leaf]),
    rule
  );
  return {
    mutated: true,
    nextValue: source,
  };
}

function applyJsonPathRule(
  files: Record<string, Uint8Array>,
  rule: SessionPackRedactionRule
): SessionPackRedactionRuleReport {
  const selector = parseJsonSelector(rule.target.selector);
  if (!selector) {
    return {
      ruleId: rule.rule_id,
      targetKind: rule.target.kind,
      selector: rule.target.selector,
      matches: 0,
      mutatedEntries: [],
    };
  }

  const content = files[selector.entryPath];
  if (!content) {
    return {
      ruleId: rule.rule_id,
      targetKind: rule.target.kind,
      selector: rule.target.selector,
      matches: 0,
      mutatedEntries: [],
    };
  }

  const decoded = tryDecodeUtf8(content);
  if (decoded == null) {
    return {
      ruleId: rule.rule_id,
      targetKind: rule.target.kind,
      selector: rule.target.selector,
      matches: 0,
      mutatedEntries: [],
    };
  }

  const parsed = JSON.parse(decoded) as unknown;
  const segments = parseJsonPathSegments(selector.jsonPath);
  const mutated = mutateJsonValueAtPath(parsed, segments, rule);
  if (!mutated.mutated) {
    return {
      ruleId: rule.rule_id,
      targetKind: rule.target.kind,
      selector: rule.target.selector,
      matches: 0,
      mutatedEntries: [],
    };
  }

  const trailingNewline = decoded.endsWith("\n") ? "\n" : "";
  files[selector.entryPath] = encodeUtf8(`${JSON.stringify(mutated.nextValue, null, 2)}${trailingNewline}`);
  return {
    ruleId: rule.rule_id,
    targetKind: rule.target.kind,
    selector: rule.target.selector,
    matches: 1,
    mutatedEntries: [selector.entryPath],
  };
}

function applyTextLikeRule(
  files: Record<string, Uint8Array>,
  rule: SessionPackRedactionRule
) {
  const mutatedEntries = new Set<string>();
  let matches = 0;

  for (const [entryPath, content] of Object.entries(files)) {
    if (entryPath === sessionPackRedactionMapFileName) {
      continue;
    }

    const decoded = tryDecodeUtf8(content);
    if (decoded == null) {
      continue;
    }

    let replaced = {
      content: decoded,
      matches: 0,
    };

    if (rule.target.kind === "text") {
      replaced = replaceExactText(decoded, rule.target.selector, rule);
    } else if (rule.target.kind === "header") {
      const linePattern = new RegExp(
        `(^|\\r?\\n)([ \\t]*${escapeRegExp(rule.target.selector)}\\s*:\\s*)([^\\r\\n]+)`,
        "gim"
      );
      const jsonPattern = new RegExp(
        `("${escapeRegExp(rule.target.selector)}"\\s*:\\s*")([^"]*)(")`,
        "gi"
      );
      const lineReplaced = replaceRegexMatches(decoded, linePattern, 2, rule);
      const jsonReplaced = replaceRegexMatches(lineReplaced.content, jsonPattern, 1, rule);
      replaced = {
        content: jsonReplaced.content,
        matches: lineReplaced.matches + jsonReplaced.matches,
      };
    } else {
      const cookiePattern = new RegExp(
        `(${escapeRegExp(rule.target.selector)}=)([^;\\s]+)`,
        "gi"
      );
      const jsonPattern = new RegExp(
        `("${escapeRegExp(rule.target.selector)}"\\s*:\\s*")([^"]*)(")`,
        "gi"
      );
      const cookieReplaced = replaceRegexMatches(decoded, cookiePattern, 1, rule);
      const jsonReplaced = replaceRegexMatches(cookieReplaced.content, jsonPattern, 1, rule);
      replaced = {
        content: jsonReplaced.content,
        matches: cookieReplaced.matches + jsonReplaced.matches,
      };
    }

    if (replaced.matches <= 0) {
      continue;
    }

    files[entryPath] = encodeUtf8(replaced.content);
    mutatedEntries.add(entryPath);
    matches += replaced.matches;
  }

  return {
    ruleId: rule.rule_id,
    targetKind: rule.target.kind,
    selector: rule.target.selector,
    matches,
    mutatedEntries: [...mutatedEntries].sort(),
  } satisfies SessionPackRedactionRuleReport;
}

function applyFilePathRule(
  files: Record<string, Uint8Array>,
  rule: SessionPackRedactionRule
) {
  const mutatedEntries = new Set<string>();
  let matches = 0;

  for (const entryPath of Object.keys(files)) {
    if (!matchesFileSelector(rule.target.selector, entryPath)) {
      continue;
    }

    if (rule.strategy === "remove") {
      delete files[entryPath];
      mutatedEntries.add(entryPath);
      matches += 1;
      continue;
    }

    const current = files[entryPath];
    if (!current) {
      continue;
    }

    const decoded = tryDecodeUtf8(current);
    const source = decoded ?? Buffer.from(current).toString("base64");
    files[entryPath] = encodeUtf8(applyReplacementStrategy(source, rule));
    mutatedEntries.add(entryPath);
    matches += 1;
  }

  return {
    ruleId: rule.rule_id,
    targetKind: rule.target.kind,
    selector: rule.target.selector,
    matches,
    mutatedEntries: [...mutatedEntries].sort(),
  } satisfies SessionPackRedactionRuleReport;
}

function readManifestInput(files: Record<string, Uint8Array>) {
  const manifestContent = files[sessionPackManifestFileName];
  if (!manifestContent) {
    throw new Error(`Session pack is missing ${sessionPackManifestFileName}`);
  }

  const manifest = sessionPackManifestSchema.parse(
    JSON.parse(decodeUtf8(manifestContent)) as unknown
  );
  const {
    manifest_version: _manifestVersion,
    files: _files,
    signature: _signature,
    ...manifestInput
  } = manifest;
  return manifestInput;
}

function buildRedactionReport(ruleReports: SessionPackRedactionRuleReport[]) {
  const mutatedEntries = new Set<string>();
  let totalMatches = 0;
  let matchedRuleCount = 0;

  for (const report of ruleReports) {
    totalMatches += report.matches;
    if (report.matches > 0) {
      matchedRuleCount += 1;
    }
    for (const entryPath of report.mutatedEntries) {
      mutatedEntries.add(entryPath);
    }
  }

  return {
    ruleCount: ruleReports.length,
    matchedRuleCount,
    totalMatches,
    mutatedEntries: [...mutatedEntries].sort(),
    rules: ruleReports,
  } satisfies SessionPackRedactionReport;
}

function applyRedactionRule(
  files: Record<string, Uint8Array>,
  rule: SessionPackRedactionRule
) {
  switch (rule.target.kind) {
    case "text":
    case "header":
    case "cookie":
      return applyTextLikeRule(files, rule);
    case "file-path":
      return applyFilePathRule(files, rule);
    case "json-path":
      return applyJsonPathRule(files, rule);
  }
}

export function applySessionPackRedaction(
  bundle: SessionPackBundle,
  options: ApplySessionPackRedactionOptions = {}
): ApplySessionPackRedactionResult {
  const redactionContent = bundle.files[sessionPackRedactionMapFileName];
  const redactionMap = redactionContent
    ? sessionPackRedactionMapSchema.parse(
        JSON.parse(decodeUtf8(redactionContent)) as unknown
      )
    : {
        version: "generated.v1",
        rules: [],
      };

  const nextFiles = Object.fromEntries(
    Object.entries(bundle.files).map(([entryPath, content]) => [entryPath, new Uint8Array(content)])
  ) as Record<string, Uint8Array>;
  const ruleReports = redactionMap.rules.map((rule) => applyRedactionRule(nextFiles, rule));
  const report = buildRedactionReport(ruleReports);
  const manifestInput = readManifestInput(nextFiles);
  const nextMetadata: SessionPackManifest["metadata"] = {
    ...(manifestInput.metadata ?? {}),
    ...(options.metadata ?? {}),
    redaction_applied: report.matchedRuleCount > 0,
    redaction_rule_count: report.ruleCount,
    redaction_match_count: report.totalMatches,
    redaction_matched_rule_count: report.matchedRuleCount,
  };

  const rebuiltBundle = packSessionVersion({
    manifest: {
      ...manifestInput,
      metadata: nextMetadata,
    },
    files: nextFiles,
  });

  return {
    bundle: rebuiltBundle,
    report,
  };
}
