CREATE TABLE IF NOT EXISTS lingban_credential_materializations (
  lease_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  lease_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_credential_materializations_run
  ON lingban_credential_materializations (run_id, issued_at, lease_id);

CREATE INDEX IF NOT EXISTS idx_lingban_credential_materializations_workspace
  ON lingban_credential_materializations (workspace_id, issued_at, lease_id);
