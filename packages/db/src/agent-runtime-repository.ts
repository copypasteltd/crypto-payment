import {
  agentRuntimeEventRecordSchema,
  agentThreadRecordSchema,
  type AgentRuntimeEventRecord,
  type AgentThreadRecord,
} from "@lingban/contracts";
import type { PostgresRepositoryOptions } from "./postgres-types.js";

export interface AgentRuntimeRepository {
  getThreadByRunId(runId: string): Promise<AgentThreadRecord | null>;
  upsertThread(thread: AgentThreadRecord): Promise<AgentThreadRecord>;
  appendEvent(event: AgentRuntimeEventRecord): Promise<AgentRuntimeEventRecord>;
  listEvents(runId: string, options?: { afterSequence?: number; throughSequence?: number }): Promise<AgentRuntimeEventRecord[]>;
}

export class InMemoryAgentRuntimeRepository implements AgentRuntimeRepository {
  #threads = new Map<string, AgentThreadRecord>();
  #events = new Map<string, Map<number, AgentRuntimeEventRecord>>();

  async getThreadByRunId(runId: string) {
    return this.#threads.get(runId) ?? null;
  }

  async upsertThread(thread: AgentThreadRecord) {
    const parsed = agentThreadRecordSchema.parse(thread);
    this.#threads.set(parsed.runId, parsed);
    return parsed;
  }

  async appendEvent(event: AgentRuntimeEventRecord) {
    const parsed = agentRuntimeEventRecordSchema.parse(event);
    const events = this.#events.get(parsed.runId) ?? new Map<number, AgentRuntimeEventRecord>();
    const existing = events.get(parsed.sequence);
    if (existing && existing.payloadSha256 !== parsed.payloadSha256) {
      throw new Error(`AGENT_EVENT_SEQUENCE_CONFLICT:${parsed.runId}:${parsed.sequence}`);
    }
    if (existing) return existing;
    events.set(parsed.sequence, parsed);
    this.#events.set(parsed.runId, events);
    return parsed;
  }

  async listEvents(runId: string, options: { afterSequence?: number; throughSequence?: number } = {}) {
    return [...(this.#events.get(runId)?.values() ?? [])]
      .filter((event) => event.sequence > (options.afterSequence ?? 0))
      .filter((event) => event.sequence <= (options.throughSequence ?? Number.MAX_SAFE_INTEGER))
      .sort((left, right) => left.sequence - right.sequence);
  }
}

export class PostgresAgentRuntimeRepository implements AgentRuntimeRepository {
  #options: PostgresRepositoryOptions;

  constructor(options: PostgresRepositoryOptions) {
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  async getThreadByRunId(runId: string) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ thread_json: AgentThreadRecord }>(
      "SELECT thread_json FROM lingban_run_agent_threads WHERE run_id = $1",
      [runId]
    );
    return result.rows[0] ? agentThreadRecordSchema.parse(result.rows[0].thread_json) : null;
  }

  async upsertThread(thread: AgentThreadRecord) {
    const parsed = agentThreadRecordSchema.parse(thread);
    const queryable = await this.#getQueryable();
    await queryable.query(
      `
      INSERT INTO lingban_run_agent_threads (
        run_id, thread_id, protocol, connection_state, current_turn_id,
        current_turn_state, event_high_watermark, provider_id, provider_binding_id,
        model, runtime_config_sha256, codex_version, protocol_version, started_at,
        updated_at, stopped_at, last_event_at, thread_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18::jsonb
      )
      ON CONFLICT (run_id) DO UPDATE SET
        thread_id = EXCLUDED.thread_id,
        protocol = EXCLUDED.protocol,
        connection_state = EXCLUDED.connection_state,
        current_turn_id = EXCLUDED.current_turn_id,
        current_turn_state = EXCLUDED.current_turn_state,
        event_high_watermark = EXCLUDED.event_high_watermark,
        provider_id = EXCLUDED.provider_id,
        provider_binding_id = EXCLUDED.provider_binding_id,
        model = EXCLUDED.model,
        runtime_config_sha256 = EXCLUDED.runtime_config_sha256,
        codex_version = EXCLUDED.codex_version,
        protocol_version = EXCLUDED.protocol_version,
        updated_at = EXCLUDED.updated_at,
        stopped_at = EXCLUDED.stopped_at,
        last_event_at = EXCLUDED.last_event_at,
        thread_json = EXCLUDED.thread_json
      `,
      [
        parsed.runId,
        parsed.threadId,
        parsed.protocol,
        parsed.connectionState,
        parsed.currentTurnId,
        parsed.currentTurnState,
        parsed.eventHighWatermark,
        parsed.providerId,
        parsed.providerBindingId,
        parsed.model,
        parsed.runtimeConfigSha256,
        parsed.codexVersion,
        parsed.protocolVersion,
        parsed.startedAt,
        parsed.updatedAt,
        parsed.stoppedAt,
        parsed.lastEventAt,
        JSON.stringify(parsed),
      ]
    );
    return parsed;
  }

  async appendEvent(event: AgentRuntimeEventRecord) {
    const parsed = agentRuntimeEventRecordSchema.parse(event);
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ payload_sha256: string; payload_json: unknown }>(
      `
      INSERT INTO lingban_run_agent_events (
        event_id, run_id, sequence, event_type, occurred_at, received_at,
        thread_id, turn_id, item_id, source_request_id, payload_sha256, payload_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      ON CONFLICT (run_id, sequence) DO NOTHING
      RETURNING payload_sha256, payload_json
      `,
      [
        parsed.eventId,
        parsed.runId,
        parsed.sequence,
        parsed.eventType,
        parsed.occurredAt,
        parsed.receivedAt,
        parsed.threadId,
        parsed.turnId,
        parsed.itemId,
        parsed.sourceRequestId,
        parsed.payloadSha256,
        JSON.stringify(parsed.payload),
      ]
    );

    if (result.rowCount === 0) {
      const existing = await queryable.query<{ payload_sha256: string }>(
        "SELECT payload_sha256 FROM lingban_run_agent_events WHERE run_id = $1 AND sequence = $2",
        [parsed.runId, parsed.sequence]
      );
      if (existing.rows[0]?.payload_sha256 !== parsed.payloadSha256) {
        throw new Error(`AGENT_EVENT_SEQUENCE_CONFLICT:${parsed.runId}:${parsed.sequence}`);
      }
    }

    return parsed;
  }

  async listEvents(runId: string, options: { afterSequence?: number; throughSequence?: number } = {}) {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{
      event_id: string;
      run_id: string;
      sequence: string | number;
      event_type: string;
      occurred_at: Date | string;
      received_at: Date | string;
      thread_id: string | null;
      turn_id: string | null;
      item_id: string | null;
      source_request_id: string | null;
      payload_sha256: string;
      payload_json: unknown;
    }>(
      `
      SELECT event_id, run_id, sequence, event_type, occurred_at, received_at,
             thread_id, turn_id, item_id, source_request_id, payload_sha256, payload_json
      FROM lingban_run_agent_events
      WHERE run_id = $1 AND sequence > $2 AND sequence <= $3
      ORDER BY sequence ASC
      `,
      [runId, options.afterSequence ?? 0, options.throughSequence ?? Number.MAX_SAFE_INTEGER]
    );

    return result.rows.map((row) => agentRuntimeEventRecordSchema.parse({
      eventId: row.event_id,
      runId: row.run_id,
      sequence: Number(row.sequence),
      eventType: row.event_type,
      occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : new Date(row.occurred_at).toISOString(),
      receivedAt: row.received_at instanceof Date ? row.received_at.toISOString() : new Date(row.received_at).toISOString(),
      threadId: row.thread_id,
      turnId: row.turn_id,
      itemId: row.item_id,
      sourceRequestId: row.source_request_id,
      payloadSha256: row.payload_sha256,
      payload: row.payload_json,
    }));
  }
}
