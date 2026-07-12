CREATE TABLE IF NOT EXISTS lingban_mcp_governance_events (
  event_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  run_id TEXT NULL,
  mcp_id TEXT NOT NULL,
  binding_id TEXT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_governance_events_workspace
  ON lingban_mcp_governance_events (workspace_id, occurred_at DESC, event_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_governance_events_run
  ON lingban_mcp_governance_events (run_id, occurred_at DESC, event_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_governance_events_mcp
  ON lingban_mcp_governance_events (mcp_id, occurred_at DESC, event_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_governance_events_action
  ON lingban_mcp_governance_events (action, occurred_at DESC, event_id ASC);
