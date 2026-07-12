import {
  sessionVersionIdSchema,
  taskVersionIdSchema,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";

function normalizeVersionLineCandidate(
  versionLine: string[],
  kind: "task" | "session"
) {
  const directPrefix = kind === "task" ? "tsv_" : "sev_";
  const keyedPrefix = kind === "task" ? "task=" : "session=";

  const raw =
    versionLine.find((item) => item.startsWith(directPrefix)) ??
    versionLine.find((item) => item.startsWith(keyedPrefix));

  if (!raw) {
    return null;
  }

  const candidate = raw.startsWith(keyedPrefix) ? raw.slice(keyedPrefix.length) : raw;
  return candidate.split("@", 1)[0]?.trim() || null;
}

export function findVersionLineRef(
  versionLine: string[],
  kind: "task"
): string | null;
export function findVersionLineRef(
  versionLine: string[],
  kind: "session"
): string | null;
export function findVersionLineRef(
  versionLine: string[],
  kind: "task" | "session"
) {
  const candidate = normalizeVersionLineCandidate(versionLine, kind);
  if (!candidate) {
    return null;
  }

  const parsed =
    kind === "task"
      ? taskVersionIdSchema.safeParse(candidate)
      : sessionVersionIdSchema.safeParse(candidate);

  return parsed.success ? parsed.data : null;
}

export function requireVersionLineRef(
  versionLine: string[],
  kind: "task",
  options?: {
    packageId?: string;
  }
): string;
export function requireVersionLineRef(
  versionLine: string[],
  kind: "session",
  options?: {
    packageId?: string;
  }
): string;
export function requireVersionLineRef(
  versionLine: string[],
  kind: "task" | "session",
  options?: {
    packageId?: string;
  }
) {
  const candidate = normalizeVersionLineCandidate(versionLine, kind);
  const parsed =
    kind === "task"
      ? taskVersionIdSchema.safeParse(candidate)
      : sessionVersionIdSchema.safeParse(candidate);
  const resolved = parsed.success ? parsed.data : null;
  if (resolved) {
    return resolved;
  }

  const packageLabel = options?.packageId ? ` ${options.packageId}` : "";
  throw new AppError(
    409,
    "CREATOR_PACKAGE_VERSION_REF_INVALID",
    `Creator package${packageLabel} is missing a valid ${kind} version reference`
  );
}
