CREATE TABLE IF NOT EXISTS lingban_workshop_contexts (
  context_key TEXT PRIMARY KEY,
  runtime_workspace_id TEXT NOT NULL,
  context_json JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_workshop_contexts_runtime_workspace_id
  ON lingban_workshop_contexts (runtime_workspace_id);

CREATE TABLE IF NOT EXISTS lingban_catalog_workshops (
  workshop_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  workshop_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_catalog_workshops_scope_status
  ON lingban_catalog_workshops (scope, status, workshop_id);

CREATE TABLE IF NOT EXISTS lingban_catalog_services (
  service_id TEXT PRIMARY KEY,
  workshop_id TEXT NOT NULL,
  status TEXT NOT NULL,
  service_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_catalog_services_workshop_status
  ON lingban_catalog_services (workshop_id, status, service_id);

CREATE TABLE IF NOT EXISTS lingban_catalog_launch_templates (
  template_key TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  entry_surface TEXT NOT NULL,
  template_json JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_catalog_launch_templates_lookup
  ON lingban_catalog_launch_templates (service_id, workspace_context_key, entry_surface);
