import { ZodError } from "zod";

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function normalizeErrorPayload(error: unknown) {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      payload: {
        error: {
          code: "VALIDATION_ERROR",
          message: "请求参数不合法",
          details: error.flatten(),
        },
      },
    };
  }

  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      payload: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      },
    };
  }

  return {
    statusCode: 500,
    payload: {
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "未知服务端错误",
      },
    },
  };
}
