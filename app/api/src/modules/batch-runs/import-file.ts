import path from "node:path";
import XLSX from "xlsx";
import {
  batchRunDraftItemInputSchema,
  importBatchRunFileInputSchema,
  importBatchRunFileResponseSchema,
  type BatchRunDraftItemInput,
  type BatchRunImportFileFormat,
  type BatchRunImportResolvedMapping,
  type ImportBatchRunFileInput,
  type ImportBatchRunFileResponse,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";

const IMPORT_FIELD_ALIASES = {
  title: ["title", "name", "run title", "instance title", "标题", "名称", "任务标题"],
  pathSuffix: [
    "path suffix",
    "path_suffix",
    "suffix",
    "slug",
    "folder",
    "目录后缀",
    "路径后缀",
  ],
  targetPath: ["target path", "target_path", "path", "路径", "目标路径"],
  initialMessage: [
    "initial message",
    "initial_message",
    "message",
    "prompt",
    "opening prompt",
    "首条消息",
    "提示词",
  ],
  rowKey: ["row key", "row_key", "key", "id", "row id", "行键", "行标识"],
} satisfies Record<
  keyof Omit<BatchRunImportResolvedMapping, "ignoreColumns" | "contextColumns">,
  string[]
>;

function normalizeHeader(input: string) {
  return input.trim().toLowerCase().replace(/[_\-\s/]+/g, "");
}

function inferFormat(
  fileName: string,
  explicitFormat?: BatchRunImportFileFormat | null
): BatchRunImportFileFormat {
  if (explicitFormat) {
    return explicitFormat;
  }

  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".csv") {
    return "csv";
  }
  if (extension === ".xlsx" || extension === ".xlsm" || extension === ".xls") {
    return "xlsx";
  }

  throw new AppError(
    400,
    "BATCH_RUN_IMPORT_FORMAT_UNSUPPORTED",
    `Unsupported batch import file type for ${fileName}`
  );
}

function decodeBase64Payload(raw: string) {
  const normalized = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  try {
    return Buffer.from(normalized, "base64");
  } catch {
    throw new AppError(
      400,
      "BATCH_RUN_IMPORT_BASE64_INVALID",
      "Batch import contentBase64 is not valid base64."
    );
  }
}

function toDisplayCellValue(value: unknown) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return String(value).trim();
}

function makeColumnName(candidate: string, index: number, seen: Set<string>) {
  const trimmed = candidate.trim() || `column_${index + 1}`;
  let next = trimmed;
  let suffix = 2;
  while (seen.has(next)) {
    next = `${trimmed}_${suffix}`;
    suffix += 1;
  }
  seen.add(next);
  return next;
}

function resolveSheet(workbook: XLSX.WorkBook, requestedSheetName?: string) {
  if (workbook.SheetNames.length === 0) {
    throw new AppError(
      400,
      "BATCH_RUN_IMPORT_WORKBOOK_EMPTY",
      "The uploaded workbook does not contain any sheets."
    );
  }

  const activeSheetName = requestedSheetName?.trim() || workbook.SheetNames[0];
  const sheet = workbook.Sheets[activeSheetName];
  if (!sheet) {
    throw new AppError(
      400,
      "BATCH_RUN_IMPORT_SHEET_NOT_FOUND",
      `Sheet ${activeSheetName} was not found in the uploaded workbook.`
    );
  }

  return {
    activeSheetName,
    sheet,
  };
}

function resolveEffectiveMapping(
  detectedColumns: string[],
  requested: ImportBatchRunFileInput["mapping"]
) {
  const requestedMapping = requested ?? { ignoreColumns: [] };
  const normalizedColumnMap = new Map<string, string>();
  for (const column of detectedColumns) {
    normalizedColumnMap.set(normalizeHeader(column), column);
  }

  const warnings: string[] = [];
  const requestedIgnoreColumns = requestedMapping.ignoreColumns ?? [];
  const resolved: BatchRunImportResolvedMapping = {
    title: null,
    pathSuffix: null,
    targetPath: null,
    initialMessage: null,
    rowKey: null,
    ignoreColumns: [],
    contextColumns: [],
  };

  for (const field of ["title", "pathSuffix", "targetPath", "initialMessage", "rowKey"] as const) {
    const requestedColumn = requestedMapping[field]?.trim();
    if (requestedColumn) {
      if (detectedColumns.includes(requestedColumn)) {
        resolved[field] = requestedColumn;
      } else {
        warnings.push(`Mapped column ${requestedColumn} for ${field} was not found in the file.`);
      }
      continue;
    }

    const matchedAlias = IMPORT_FIELD_ALIASES[field]
      .map((alias) => normalizedColumnMap.get(normalizeHeader(alias)) ?? null)
      .find((item) => item != null);
    resolved[field] = matchedAlias ?? null;
  }

  resolved.ignoreColumns = requestedIgnoreColumns.filter((column) => detectedColumns.includes(column));
  for (const ignoredColumn of requestedIgnoreColumns) {
    if (!detectedColumns.includes(ignoredColumn)) {
      warnings.push(`Ignored column ${ignoredColumn} was not found in the file.`);
    }
  }

  const reservedColumns = new Set<string>(
    [
      resolved.title,
      resolved.pathSuffix,
      resolved.targetPath,
      resolved.initialMessage,
      resolved.rowKey,
      ...resolved.ignoreColumns,
    ].filter((item): item is string => Boolean(item))
  );

  resolved.contextColumns = detectedColumns.filter((column) => !reservedColumns.has(column));

  return {
    resolved,
    warnings,
  };
}

function slugifyPathSegment(input: string) {
  const collapsed = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return collapsed || null;
}

export function importBatchRunFile(input: ImportBatchRunFileInput): ImportBatchRunFileResponse {
  const parsed = importBatchRunFileInputSchema.parse(input);
  const sourceFormat = inferFormat(parsed.fileName, parsed.format);
  const buffer = decodeBase64Payload(parsed.contentBase64);
  if (buffer.byteLength === 0) {
    throw new AppError(
      400,
      "BATCH_RUN_IMPORT_FILE_EMPTY",
      "The uploaded batch import file is empty."
    );
  }

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    dense: false,
    cellDates: false,
  });
  const { activeSheetName, sheet } = resolveSheet(workbook, parsed.sheetName);
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (matrix.length === 0) {
    return importBatchRunFileResponseSchema.parse({
      sourceFormat,
      fileName: parsed.fileName,
      sheetNames: workbook.SheetNames,
      activeSheetName,
      detectedColumns: [],
      effectiveMapping: {
        title: null,
        pathSuffix: null,
        targetPath: null,
        initialMessage: null,
        rowKey: null,
        ignoreColumns: [],
        contextColumns: [],
      },
      items: [],
      importedRowCount: 0,
      skippedRowCount: 0,
      truncated: false,
      warnings: ["The uploaded file did not contain any tabular rows."],
    });
  }

  const seenColumns = new Set<string>();
  const detectedColumns = (matrix[0] ?? []).map((cell, index) =>
    makeColumnName(toDisplayCellValue(cell), index, seenColumns)
  );
  const { resolved: effectiveMapping, warnings } = resolveEffectiveMapping(detectedColumns, parsed.mapping);
  const items: BatchRunDraftItemInput[] = [];
  let skippedRowCount = 0;
  const totalDataRowCount = Math.max(0, matrix.length - 1);
  const truncated = totalDataRowCount > parsed.previewLimit;

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const record = new Map<string, string>();
    let hasAnyValue = false;

    for (let columnIndex = 0; columnIndex < detectedColumns.length; columnIndex += 1) {
      const value = toDisplayCellValue(row[columnIndex] ?? "");
      record.set(detectedColumns[columnIndex], value);
      if (value.length > 0) {
        hasAnyValue = true;
      }
    }

    if (!hasAnyValue) {
      skippedRowCount += 1;
      continue;
    }

    if (items.length >= parsed.previewLimit) {
      skippedRowCount += 1;
      continue;
    }

    const context = Object.fromEntries(
      effectiveMapping.contextColumns
        .map((column) => [column, record.get(column)?.trim() ?? ""] as const)
        .filter((entry) => entry[1].length > 0)
    );
    const rowKey = effectiveMapping.rowKey ? record.get(effectiveMapping.rowKey)?.trim() || null : null;
    const pathSuffixValue = effectiveMapping.pathSuffix
      ? record.get(effectiveMapping.pathSuffix)?.trim() || null
      : null;
    const targetPathValue = effectiveMapping.targetPath
      ? record.get(effectiveMapping.targetPath)?.trim() || null
      : null;
    const derivedTitleSeed =
      (effectiveMapping.title ? record.get(effectiveMapping.title)?.trim() : "") ||
      rowKey ||
      pathSuffixValue ||
      targetPathValue ||
      "";
    const title = derivedTitleSeed || `Row ${rowIndex}`;
    const initialMessage = effectiveMapping.initialMessage
      ? record.get(effectiveMapping.initialMessage)?.trim() || null
      : null;
    const fallbackPathSuffix =
      pathSuffixValue ||
      slugifyPathSegment(title) ||
      slugifyPathSegment(rowKey ?? "") ||
      null;

    items.push(
      batchRunDraftItemInputSchema.parse({
        rowKey,
        title,
        targetPath: targetPathValue,
        pathSuffix: fallbackPathSuffix,
        initialMessage,
        context,
      })
    );
  }

  if (items.length === 0) {
    warnings.push("No usable rows were found after parsing the uploaded file.");
  }

  return importBatchRunFileResponseSchema.parse({
    sourceFormat,
    fileName: parsed.fileName,
    sheetNames: workbook.SheetNames,
    activeSheetName,
    detectedColumns,
    effectiveMapping,
    items,
    importedRowCount: items.length,
    skippedRowCount,
    truncated,
    warnings,
  });
}
