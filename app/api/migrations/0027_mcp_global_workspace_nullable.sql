ALTER TABLE lingban_mcp_registry
  ALTER COLUMN workspace_id DROP NOT NULL;

ALTER TABLE lingban_mcp_bindings
  ALTER COLUMN workspace_id DROP NOT NULL;
