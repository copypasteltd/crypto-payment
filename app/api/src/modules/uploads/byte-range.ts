export type ResolvedByteRange = {
  start: number;
  end: number;
  length: number;
};

export class ByteRangeNotSatisfiableError extends Error {
  readonly sizeBytes: number;

  constructor(sizeBytes: number) {
    super(`Requested byte range is not satisfiable for a ${sizeBytes}-byte resource`);
    this.name = "ByteRangeNotSatisfiableError";
    this.sizeBytes = sizeBytes;
  }
}

export function resolveByteRange(
  rangeHeader: string | undefined,
  sizeBytes: number | null | undefined
): ResolvedByteRange | null {
  if (!rangeHeader || sizeBytes == null || sizeBytes < 0) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match || rangeHeader.includes(",")) {
    throw new ByteRangeNotSatisfiableError(sizeBytes);
  }

  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (!startText && !endText) {
    throw new ByteRangeNotSatisfiableError(sizeBytes);
  }

  let start: number;
  let end: number;
  if (!startText) {
    const suffixLength = Number.parseInt(endText, 10);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0 || sizeBytes === 0) {
      throw new ByteRangeNotSatisfiableError(sizeBytes);
    }
    start = Math.max(0, sizeBytes - suffixLength);
    end = sizeBytes - 1;
  } else {
    start = Number.parseInt(startText, 10);
    end = endText ? Number.parseInt(endText, 10) : sizeBytes - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= sizeBytes ||
      end < start
    ) {
      throw new ByteRangeNotSatisfiableError(sizeBytes);
    }
    end = Math.min(end, sizeBytes - 1);
  }

  return {
    start,
    end,
    length: end - start + 1,
  };
}
