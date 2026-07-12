import { randomUUID } from "node:crypto";
import { bridgeEventSchema } from "@lingban/contracts";
import { runEventEnvelopeSchema, } from "./runs.js";
export function inferRunIdFromBridgeEvent(event) {
    switch (event.type) {
        case "run.status.changed":
        case "informationCollection.updated":
        case "files.synced":
        case "file.changed":
        case "heartbeat":
        case "run.failed":
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
export function inferOccurredAtFromBridgeEvent(event) {
    switch (event.type) {
        case "run.status.changed":
        case "informationCollection.updated":
        case "files.synced":
        case "file.changed":
        case "heartbeat":
        case "run.failed":
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
export class CachedRunEventBus {
    #events = new Map();
    #listeners = new Map();
    async init() {
        const events = await this.loadAll();
        this.#events.clear();
        for (const envelope of events) {
            const history = this.#events.get(envelope.runId) ?? [];
            history.push(envelope);
            this.#events.set(envelope.runId, history);
        }
    }
    async append(event) {
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
    async appendMany(events) {
        const envelopes = [];
        for (const event of events) {
            envelopes.push(await this.append(event));
        }
        return envelopes;
    }
    list(runId) {
        return [...(this.#events.get(runId) ?? [])];
    }
    subscribe(runId, listener) {
        const listeners = this.#listeners.get(runId) ?? new Set();
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
}
export class PostgresRunEventBus extends CachedRunEventBus {
    #options;
    constructor(options) {
        super();
        this.#options = options;
    }
    async #getQueryable() {
        await this.#options.ensureReady?.();
        return this.#options.getQueryable();
    }
    async loadAll() {
        const queryable = await this.#getQueryable();
        const result = await queryable.query(`
      SELECT event_id, run_id, event_json
      FROM lingban_run_events
      ORDER BY occurred_at ASC, event_id ASC
      `);
        return result.rows.map((row) => ({
            eventId: row.event_id,
            runId: row.run_id,
            event: bridgeEventSchema.parse(row.event_json),
        }));
    }
    async persist(envelope) {
        const queryable = await this.#getQueryable();
        const occurredAt = inferOccurredAtFromBridgeEvent(envelope.event);
        await queryable.query(`
      INSERT INTO lingban_run_events (event_id, run_id, event_type, occurred_at, event_json)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (event_id) DO NOTHING
      `, [
            envelope.eventId,
            envelope.runId,
            envelope.event.type,
            occurredAt,
            JSON.stringify(envelope.event),
        ]);
    }
}
//# sourceMappingURL=run-event-bus.js.map