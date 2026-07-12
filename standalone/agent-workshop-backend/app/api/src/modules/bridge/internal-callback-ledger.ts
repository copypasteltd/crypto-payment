import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import { buildAtomicTempPath } from "@lingban/shared";
import path from "node:path";
import { z } from "zod";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { bridgeRegistry } from "./registry.js";
import { buildBridgeRegistrationRepository } from "./repository.js";

const internalCallbackRequestKindSchema = z.enum([
  "runs.events",
  "runs.status",
  "runs.runtime",
  "runs.artifacts",
]);

const internalCallbackReceiptSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(240),
  requestKind: internalCallbackRequestKindSchema,
  runId: z.string().trim().min(1).max(120).nullable().default(null),
  traceId: z.string().trim().min(1).max(240).nullable().default(null),
  processedAt: z.string().trim().min(1),
  response: z.unknown(),
});

const internalCallbackLedgerStateSchema = z.object({
  receipts: z.array(internalCallbackReceiptSchema).default([]),
});

export type InternalCallbackRequestKind = z.infer<typeof internalCallbackRequestKindSchema>;
export type InternalCallbackReceipt = z.infer<typeof internalCallbackReceiptSchema>;

export interface InternalCallbackLedger {
  init(): Promise<void>;
  get(idempotencyKey: string): Promise<InternalCallbackReceipt | null>;
  put(receipt: InternalCallbackReceipt): Promise<void>;
}

class FileBackedInternalCallbackLedger implements InternalCallbackLedger {
  #initialized = false;
  #receipts = new Map<string, InternalCallbackReceipt>();
  #statePath: string;

  constructor(storageDir = resolveApiStorageDir("bridge")) {
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "internal-callback-ledger.json");
  }

  async init() {
    if (this.#initialized) {
      return;
    }

    try {
      const raw = readFileSync(this.#statePath, "utf8");
      const parsed = internalCallbackLedgerStateSchema.parse(JSON.parse(raw) as unknown);
      this.#receipts = new Map(parsed.receipts.map((receipt) => [receipt.idempotencyKey, receipt]));
    } catch {
      this.#receipts = new Map();
    }

    this.#initialized = true;
  }

  async get(idempotencyKey: string) {
    await this.init();
    return this.#receipts.get(idempotencyKey) ?? null;
  }

  async put(receipt: InternalCallbackReceipt) {
    await this.init();
    const parsed = internalCallbackReceiptSchema.parse(receipt);
    if (this.#receipts.has(parsed.idempotencyKey)) {
      return;
    }

    this.#receipts.set(parsed.idempotencyKey, parsed);
    const tempPath = buildAtomicTempPath(this.#statePath);
    const payload = internalCallbackLedgerStateSchema.parse({
      receipts: [...this.#receipts.values()],
    });
    await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
    renameSync(tempPath, this.#statePath);
  }
}

class PostgresInternalCallbackLedger implements InternalCallbackLedger {
  async init() {
    await ensureApiDatabaseReady();
  }

  async get(idempotencyKey: string) {
    await this.init();
    const pool = getApiDatabasePool();
    const result = await pool.query<{
      idempotency_key: string;
      request_kind: InternalCallbackRequestKind;
      run_id: string | null;
      trace_id: string | null;
      processed_at: Date | string;
      response_json: unknown;
    }>(
      `
      SELECT idempotency_key, request_kind, run_id, trace_id, processed_at, response_json
      FROM lingban_internal_callbacks
      WHERE idempotency_key = $1
      `,
      [idempotencyKey]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return internalCallbackReceiptSchema.parse({
      idempotencyKey: row.idempotency_key,
      requestKind: row.request_kind,
      runId: row.run_id,
      traceId: row.trace_id,
      processedAt:
        row.processed_at instanceof Date
          ? row.processed_at.toISOString()
          : new Date(row.processed_at).toISOString(),
      response: row.response_json,
    });
  }

  async put(receipt: InternalCallbackReceipt) {
    await this.init();
    const parsed = internalCallbackReceiptSchema.parse(receipt);
    const pool = getApiDatabasePool();
    await pool.query(
      `
      INSERT INTO lingban_internal_callbacks (
        idempotency_key,
        request_kind,
        run_id,
        trace_id,
        processed_at,
        response_json
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (idempotency_key) DO NOTHING
      `,
      [
        parsed.idempotencyKey,
        parsed.requestKind,
        parsed.runId,
        parsed.traceId,
        parsed.processedAt,
        JSON.stringify(parsed.response),
      ]
    );
  }
}

function buildInternalCallbackLedger(): InternalCallbackLedger {
  const config = getApiRuntimeConfig();
  return config.internalCallbacksStore === "postgres"
    ? new PostgresInternalCallbackLedger()
    : new FileBackedInternalCallbackLedger();
}

export async function initializeBridgeInfrastructure() {
  await internalCallbackLedger.init();
  bridgeRegistry.configure({
    repository: buildBridgeRegistrationRepository(),
  });
  await bridgeRegistry.init({
    forceReload: true,
  });
}

export const internalCallbackLedger = buildInternalCallbackLedger();
