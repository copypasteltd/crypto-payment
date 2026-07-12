import { randomUUID } from "node:crypto";

export type ErrorMessageOptions = {
  abortMessage?: string;
};

export function toErrorMessage(error: unknown, options: ErrorMessageOptions = {}) {
  if (error instanceof Error) {
    if (options.abortMessage && error.name === "AbortError") {
      return options.abortMessage;
    }

    return error.message || error.name;
  }

  return String(error);
}

export const normalizeErrorMessage = toErrorMessage;

export function nowIso(date: Date = new Date()) {
  return date.toISOString();
}

export function buildAtomicTempPath(filePath: string, uniqueSuffix: string = randomUUID()) {
  return `${filePath}.${uniqueSuffix}.tmp`;
}
