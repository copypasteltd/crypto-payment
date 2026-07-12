CREATE TABLE IF NOT EXISTS lingban_credential_lifecycle_callback_deliveries (
  delivery_id TEXT PRIMARY KEY,
  credential_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  target_status TEXT NOT NULL,
  status TEXT NOT NULL,
  next_attempt_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  delivery_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS lingban_credential_lifecycle_callback_deliveries_status_idx
  ON lingban_credential_lifecycle_callback_deliveries (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS lingban_credential_lifecycle_callback_deliveries_credential_idx
  ON lingban_credential_lifecycle_callback_deliveries (credential_id, created_at DESC);
