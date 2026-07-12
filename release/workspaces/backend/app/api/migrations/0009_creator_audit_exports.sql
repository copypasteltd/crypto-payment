CREATE TABLE IF NOT EXISTS lingban_creator_audit_exports (
  export_id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  export_format TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  export_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_audit_exports_package_created_at
  ON lingban_creator_audit_exports (package_id, created_at DESC, export_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_audit_exports_context_created_at
  ON lingban_creator_audit_exports (workspace_context_key, created_at DESC, export_id ASC);
