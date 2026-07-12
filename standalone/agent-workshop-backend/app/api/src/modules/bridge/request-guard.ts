import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { AppError } from "../../app/errors.js";
import {
  internalCallbackLedger,
  type InternalCallbackRequestKind,
} from "./internal-callback-ledger.js";

function readHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function readOptionalTraceId(request: FastifyRequest) {
  return readHeaderValue(request.headers["x-lingban-trace-id"]) ?? `trace_${randomUUID()}`;
}

export function readOptionalIdempotencyKey(request: FastifyRequest) {
  return readHeaderValue(request.headers["x-lingban-idempotency-key"]) ?? null;
}

export async function withInternalIdempotency<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  options: {
    requestKind: InternalCallbackRequestKind;
    runId?: string | null;
  },
  execute: () => Promise<T>
) {
  const traceId = readOptionalTraceId(request);
  reply.header("x-lingban-trace-id", traceId);

  const idempotencyKey = readOptionalIdempotencyKey(request);
  if (!idempotencyKey) {
    return execute();
  }

  const existing = await internalCallbackLedger.get(idempotencyKey);
  if (existing) {
    if (
      existing.requestKind !== options.requestKind ||
      (existing.runId ?? null) !== (options.runId ?? null)
    ) {
      throw new AppError(
        409,
        "INTERNAL_CALLBACK_IDEMPOTENCY_CONFLICT",
        `Idempotency key ${idempotencyKey} is already bound to a different callback`
      );
    }

    reply.header("x-lingban-idempotency-status", "replayed");
    return existing.response as T;
  }

  const response = await execute();
  await internalCallbackLedger.put({
    idempotencyKey,
    requestKind: options.requestKind,
    runId: options.runId ?? null,
    traceId,
    processedAt: new Date().toISOString(),
    response,
  });
  reply.header("x-lingban-idempotency-status", "stored");
  return response;
}
