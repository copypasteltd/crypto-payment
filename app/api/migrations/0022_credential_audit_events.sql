CREATE TABLE IF NOT EXISTS lingban_credential_audit_events (
  event_id TEXT PRIMARY KEY,
  credential_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  run_id TEXT,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_credential_audit_events_credential
  ON lingban_credential_audit_events (credential_id, occurred_at DESC, event_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_credential_audit_events_workspace
  ON lingban_credential_audit_events (workspace_id, occurred_at DESC, event_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_credential_audit_events_run
  ON lingban_credential_audit_events (run_id, occurred_at DESC, event_id ASC);
