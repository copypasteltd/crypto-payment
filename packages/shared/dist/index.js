import { randomUUID } from "node:crypto";
export function toErrorMessage(error, options = {}) {
    if (error instanceof Error) {
        if (options.abortMessage && error.name === "AbortError") {
            return options.abortMessage;
        }
        return error.message || error.name;
    }
    return String(error);
}
export const normalizeErrorMessage = toErrorMessage;
export function nowIso(date = new Date()) {
    return date.toISOString();
}
export function buildAtomicTempPath(filePath, uniqueSuffix = randomUUID()) {
    return `${filePath}.${uniqueSuffix}.tmp`;
}
//# sourceMappingURL=index.js.map