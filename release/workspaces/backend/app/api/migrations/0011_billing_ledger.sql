CREATE TABLE IF NOT EXISTS lingban_billing_entries (
  entry_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  package_id TEXT NULL,
  service_id TEXT NULL,
  run_id TEXT NULL,
  metric TEXT NOT NULL,
  source TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  entry_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_billing_entries_workspace_occurred_at
  ON lingban_billing_entries (workspace_id, occurred_at DESC, entry_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_billing_entries_package_occurred_at
  ON lingban_billing_entries (package_id, occurred_at DESC, entry_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_billing_entries_run_occurred_at
  ON lingban_billing_entries (run_id, occurred_at DESC, entry_id ASC);
