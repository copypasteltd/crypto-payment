CREATE TABLE IF NOT EXISTS lingban_mcp_call_audits (
  call_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  mcp_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  call_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_call_audits_run
  ON lingban_mcp_call_audits (run_id, occurred_at DESC, call_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_call_audits_workspace
  ON lingban_mcp_call_audits (workspace_id, occurred_at DESC, call_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_call_audits_mcp
  ON lingban_mcp_call_audits (mcp_id, occurred_at DESC, call_id ASC);
