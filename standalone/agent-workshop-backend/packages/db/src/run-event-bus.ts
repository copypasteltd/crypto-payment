import { randomUUID } from "node:crypto";
import { bridgeEventSchema, type BridgeEvent } from "@lingban/contracts";
import {
  runEventEnvelopeSchema,
  type RunEventBus,
  type RunEventEnvelope,
  type RunEventListener,
} from "./runs.js";
import type { PostgresRepositoryOptions } from "./postgres-types.js";

export function inferRunIdFromBridgeEvent(event: BridgeEvent) {
  switch (event.type) {
    case "run.status.changed":
    case "informationCollection.updated":
    case "files.synced":
    case "file.changed":
    case "heartbeat":
    case "run.failed":
    case "agent.runtime.event":
    case "agent.thread.state":
      return event.runId;
    case "conversation.message":
      return event.message.runId;
    case "approval.requested":
      return event.approval.runId;
    case "artifact.ready":
      return event.artifact.runId;
    case "mcp.call":
      return event.call.runId;
  }
}

export function inferOccurredAtFromBridgeEvent(event: BridgeEvent) {
  switch (event.type) {
    case "run.status.changed":
    case "informationCollection.updated":
    case "files.synced":
    case "file.changed":
    case "heartbeat":
    case "run.failed":
    case "agent.runtime.event":
    case "agent.thread.state":
      return event.occurredAt;
    case "conversation.message":
      return event.message.createdAt;
    case "approval.requested":
      return event.approval.requestedAt;
    case "artifact.ready":
      return event.artifact.file.updatedAt;
    case "mcp.call":
      return event.call.occurredAt;
  }
}

export abstract class CachedRunEventBus implements RunEventBus {
  #events = new Map<string, RunEventEnvelope[]>();
  #listeners = new Map<string, Set<RunEventListener>>();

  async init() {
    const events = await this.loadAll();
    this.#events.clear();

    for (const envelope of events) {
      const history = this.#events.get(envelope.runId) ?? [];
      history.push(envelope);
      this.#events.set(envelope.runId, history);
    }
  }

  async append(event: BridgeEvent) {
    const parsed = bridgeEventSchema.parse(event);
    const runId = inferRunIdFromBridgeEvent(parsed);
    const envelope = runEventEnvelopeSchema.parse({
      eventId: `evt_${randomUUID()}`,
      runId,
      event: parsed,
    });

    const history = this.#events.get(runId) ?? [];
    history.push(envelope);
    this.#events.set(runId, history);
    await this.persist(envelope);

    for (const listener of this.#listeners.get(runId) ?? []) {
      listener(envelope);
    }

    return envelope;
  }

  async appendMany(events: BridgeEvent[]) {
    const envelopes: RunEventEnvelope[] = [];

    for (const event of events) {
      envelopes.push(await this.append(event));
    }

    return envelopes;
  }

  list(runId: string) {
    return [...(this.#events.get(runId) ?? [])];
  }

  subscribe(runId: string, listener: RunEventListener) {
    const listeners = this.#listeners.get(runId) ?? new Set<RunEventListener>();
    listeners.add(listener);
    this.#listeners.set(runId, listeners);

    return () => {
      const current = this.#listeners.get(runId);
      if (!current) {
        return;
      }

      current.delete(listener);
      if (current.size === 0) {
        this.#listeners.delete(runId);
      }
    };
  }

  protected abstract loadAll(): Promise<RunEventEnvelope[]>;
  protected abstract persist(envelope: RunEventEnvelope): Promise<void>;
}

export class PostgresRunEventBus extends CachedRunEventBus {
  #options: PostgresRepositoryOptions;

  constructor(options: PostgresRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadAll() {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{
      event_id: string;
      run_id: string;
      event_json: BridgeEvent;
    }>(
      `
      SELECT event_id, run_id, event_json
      FROM lingban_run_events
      ORDER BY occurred_at ASC, event_id ASC
      `
    );

    return result.rows.map((row) => ({
      eventId: row.event_id,
      runId: row.run_id,
      event: bridgeEventSchema.parse(row.event_json),
    }));
  }

  protected async persist(envelope: RunEventEnvelope) {
    const queryable = await this.#getQueryable();
    const occurredAt = inferOccurredAtFromBridgeEvent(envelope.event);

    await queryable.query(
      `
      INSERT INTO lingban_run_events (event_id, run_id, event_type, occurred_at, event_json)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (event_id) DO NOTHING
      `,
      [
        envelope.eventId,
        envelope.runId,
        envelope.event.type,
        occurredAt,
        JSON.stringify(envelope.event),
      ]
    );
  }
}
