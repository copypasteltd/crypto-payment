CREATE TABLE IF NOT EXISTS lingban_mcp_health_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  mcp_id TEXT NOT NULL,
  binding_id TEXT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  probed_at TIMESTAMPTZ NOT NULL,
  snapshot_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_health_snapshots_mcp
  ON lingban_mcp_health_snapshots (mcp_id, probed_at DESC, snapshot_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_health_snapshots_binding
  ON lingban_mcp_health_snapshots (binding_id, probed_at DESC, snapshot_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_health_snapshots_workspace
  ON lingban_mcp_health_snapshots (workspace_id, probed_at DESC, snapshot_id ASC);
