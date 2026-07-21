import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { bridgeEventSchema, type BridgeEvent } from "@lingban/contracts";
import {
  CachedRunEventBus,
  inferRunIdFromBridgeEvent,
  PostgresRunEventBus,
  runEventEnvelopeSchema,
  type RunEventBus,
  type RunEventEnvelope,
} from "@lingban/db";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";

class InMemoryRunEventBus extends CachedRunEventBus {
  #storageDir: string;

  constructor(storageDir = resolveApiStorageDir("events")) {
    super();
    this.#storageDir = storageDir;
    mkdirSync(this.#storageDir, { recursive: true });
  }

  #getEventLogPath(runId: string) {
    return path.join(this.#storageDir, `${runId}.jsonl`);
  }

  protected async loadAll() {
    const files = readdirSync(this.#storageDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    const envelopes: RunEventEnvelope[] = [];

    for (const fileName of files) {
      const absolutePath = path.join(this.#storageDir, fileName);
      const lines = readFileSync(absolutePath, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const rawEnvelope = JSON.parse(line) as Partial<RunEventEnvelope>;
        const envelope = runEventEnvelopeSchema.parse({
          ...rawEnvelope,
          eventId: rawEnvelope.eventId ?? `evt_${randomUUID()}`,
        });
        const parsedEvent = bridgeEventSchema.parse(envelope.event);
        envelopes.push({
          eventId: envelope.eventId,
          runId: inferRunIdFromBridgeEvent(parsedEvent),
          event: parsedEvent,
        });
      }
    }

    return envelopes;
  }

  protected async persist(envelope: RunEventEnvelope) {
    appendFileSync(this.#getEventLogPath(envelope.runId), `${JSON.stringify(envelope)}\n`, "utf8");
  }

  protected async deletePersisted(runId: string) {
    try {
      unlinkSync(this.#getEventLogPath(runId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function buildRunEventBus(): RunEventBus {
  const config = getApiRuntimeConfig();
  return config.runEventsStore === "postgres"
    ? new PostgresRunEventBus({
        ensureReady: ensureApiDatabaseReady,
        getQueryable: getApiDatabasePool,
      })
    : new InMemoryRunEventBus();
}

export const runEventBus = buildRunEventBus();
