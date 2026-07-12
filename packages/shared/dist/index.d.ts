export type ErrorMessageOptions = {
    abortMessage?: string;
};
export declare function toErrorMessage(error: unknown, options?: ErrorMessageOptions): string;
export declare const normalizeErrorMessage: typeof toErrorMessage;
export declare function nowIso(date?: Date): string;
export declare function buildAtomicTempPath(filePath: string, uniqueSuffix?: string): string;
//# sourceMappingURL=index.d.ts.map