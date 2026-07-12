CREATE TABLE IF NOT EXISTS lingban_mcp_network_policies (
  policy_ref TEXT PRIMARY KEY,
  workspace_id TEXT NULL,
  status TEXT NOT NULL,
  policy_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_network_policies_workspace
  ON lingban_mcp_network_policies (workspace_id, policy_ref ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_network_policies_status
  ON lingban_mcp_network_policies (status, policy_ref ASC);
