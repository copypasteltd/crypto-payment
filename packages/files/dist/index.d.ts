import type { RunFilePreviewMode } from "@lingban/contracts";
export declare const MAX_TEXT_PREVIEW_BYTES: number;
export type TextPreview = {
    content: string;
    truncated: boolean;
};
export declare function toPosixPath(value: string): string;
export declare function ensureTrailingSlash(value: string): string;
export declare function normalizeAbsoluteFilePath(value: string): string;
export declare function resolvePathWithinRoot(rootPath: string, requestedPath?: string): string | null;
export declare function createLogicalPath(rootPath: string, absolutePath: string): string;
export declare function normalizeLogicalPrefix(value: string | undefined): string | null;
export declare function guessFileMimeType(filePath: string, explicitMimeType?: string | null): string;
export declare function isOfficePreviewMimeType(mimeType: string | null | undefined): boolean;
export declare function inferFilePreviewMode(filePath: string, mimeType: string | null | undefined): RunFilePreviewMode;
export declare function readTextPreviewFromPath(absolutePath: string): Promise<{
    content: string;
    truncated: boolean;
}>;
export declare function readTextPreviewFromStream(stream: NodeJS.ReadableStream): Promise<{
    content: string;
    truncated: boolean;
}>;
export declare function extractOfficePreviewFromPath(absolutePath: string, mimeType: string | null | undefined): Promise<TextPreview>;
export declare function extractOfficePreviewFromStream(stream: NodeJS.ReadableStream, mimeType: string | null | undefined): Promise<TextPreview>;
export declare function extractOfficePreviewFromBuffer(buffer: Buffer, mimeType: string | null | undefined): Promise<TextPreview>;
export declare const guessRunFileMimeType: typeof guessFileMimeType;
export declare const inferRunFilePreviewMode: typeof inferFilePreviewMode;
//# sourceMappingURL=index.d.ts.map