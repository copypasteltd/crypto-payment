CREATE TABLE IF NOT EXISTS lingban_internal_callbacks (
  idempotency_key TEXT PRIMARY KEY,
  request_kind TEXT NOT NULL,
  run_id TEXT NULL,
  trace_id TEXT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  response_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_internal_callbacks_run_processed_at
  ON lingban_internal_callbacks (run_id, processed_at DESC, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_lingban_internal_callbacks_request_kind_processed_at
  ON lingban_internal_callbacks (request_kind, processed_at DESC, idempotency_key);
