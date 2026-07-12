CREATE TABLE IF NOT EXISTS lingban_bridge_registrations (
  run_id TEXT PRIMARY KEY,
  bridge_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  target_path TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  bridge_json JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_bridge_registrations_bridge_id
  ON lingban_bridge_registrations (bridge_id);

CREATE INDEX IF NOT EXISTS idx_lingban_bridge_registrations_workspace_last_seen
  ON lingban_bridge_registrations (workspace_id, last_seen_at DESC, run_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_bridge_registrations_last_seen
  ON lingban_bridge_registrations (last_seen_at DESC, run_id ASC);
