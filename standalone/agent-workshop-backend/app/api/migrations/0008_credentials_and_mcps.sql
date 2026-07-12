CREATE TABLE IF NOT EXISTS lingban_credentials (
  credential_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  credential_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_credentials_workspace_status
  ON lingban_credentials (workspace_id, status, credential_id);

CREATE INDEX IF NOT EXISTS idx_lingban_credentials_owner
  ON lingban_credentials (owner_user_id, credential_id);

CREATE TABLE IF NOT EXISTS lingban_mcp_registry (
  mcp_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  mcp_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_registry_workspace_status
  ON lingban_mcp_registry (workspace_id, status, mcp_id);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_registry_workspace_risk
  ON lingban_mcp_registry (workspace_id, risk_level, mcp_id);

CREATE TABLE IF NOT EXISTS lingban_mcp_bindings (
  binding_id TEXT PRIMARY KEY,
  mcp_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_ref TEXT NULL,
  status TEXT NOT NULL,
  credential_id TEXT NULL,
  binding_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_bindings_mcp_status
  ON lingban_mcp_bindings (mcp_id, status, binding_id);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_bindings_workspace_scope
  ON lingban_mcp_bindings (workspace_id, scope, binding_id);

CREATE INDEX IF NOT EXISTS idx_lingban_mcp_bindings_credential
  ON lingban_mcp_bindings (credential_id, binding_id);
