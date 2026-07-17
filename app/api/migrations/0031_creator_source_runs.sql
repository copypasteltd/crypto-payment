CREATE TABLE IF NOT EXISTS lingban_session_projects (
  session_project_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  source_run_id TEXT UNIQUE REFERENCES lingban_runs(run_id) ON DELETE RESTRICT,
  current_capture_id TEXT,
  current_draft_id TEXT,
  current_session_version_id TEXT,
  package_id TEXT,
  workshop_id TEXT,
  service_id TEXT,
  source_provider_selection JSONB,
  source_bindings JSONB NOT NULL DEFAULT '{"firstPartyMcpIds":[],"externalConnectorRefs":[],"credentialIds":[]}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  CHECK (version > 0),
  CHECK (status IN (
    'DRAFT', 'RECORDING', 'CAPTURED', 'EDITING', 'REPLAYING',
    'READY_TO_SEAL', 'SEALED', 'PACKAGED', 'PUBLISHED', 'ARCHIVED'
  ))
);

ALTER TABLE lingban_session_projects
  ADD COLUMN IF NOT EXISTS source_provider_selection JSONB;
ALTER TABLE lingban_session_projects
  ADD COLUMN IF NOT EXISTS source_bindings JSONB NOT NULL DEFAULT '{"firstPartyMcpIds":[],"externalConnectorRefs":[],"credentialIds":[]}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_lingban_session_projects_workspace_updated
  ON lingban_session_projects (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lingban_session_projects_context_status
  ON lingban_session_projects (workspace_context_key, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS lingban_service_task_versions (
  task_version_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  workshop_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  session_project_id TEXT NOT NULL REFERENCES lingban_session_projects(session_project_id) ON DELETE RESTRICT,
  session_version_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  content_sha256 TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  CHECK (version_number > 0),
  UNIQUE (service_id, version_number),
  UNIQUE (service_id, content_sha256)
);

CREATE INDEX IF NOT EXISTS idx_lingban_task_versions_service_created
  ON lingban_service_task_versions (service_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lingban_task_versions_project
  ON lingban_service_task_versions (session_project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lingban_idempotency_records (
  operation_scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (operation_scope, idempotency_key),
  CHECK (state IN ('pending', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_lingban_idempotency_updated
  ON lingban_idempotency_records (updated_at DESC);

ALTER TABLE lingban_runs ADD COLUMN IF NOT EXISTS run_purpose TEXT;
ALTER TABLE lingban_runs ADD COLUMN IF NOT EXISTS session_bootstrap_mode TEXT;
ALTER TABLE lingban_runs ADD COLUMN IF NOT EXISTS session_project_id TEXT;
ALTER TABLE lingban_runs ADD COLUMN IF NOT EXISTS task_version_id TEXT;
ALTER TABLE lingban_runs ADD COLUMN IF NOT EXISTS session_version_id TEXT;
ALTER TABLE lingban_runs ADD COLUMN IF NOT EXISTS workspace_context_key TEXT;
ALTER TABLE lingban_runs ADD COLUMN IF NOT EXISTS service_id TEXT;

UPDATE lingban_runs
SET run_purpose = COALESCE(run_purpose, 'service_consumer'),
    session_bootstrap_mode = COALESCE(session_bootstrap_mode, 'sealed_version'),
    task_version_id = COALESCE(task_version_id, aggregate_json #>> '{run,taskVersionId}'),
    session_version_id = COALESCE(session_version_id, aggregate_json #>> '{run,sessionVersionId}'),
    workspace_context_key = COALESCE(workspace_context_key, aggregate_json #>> '{run,catalogMetadata,workspaceContextKey}'),
    service_id = COALESCE(service_id, aggregate_json #>> '{run,catalogMetadata,serviceId}');

CREATE INDEX IF NOT EXISTS idx_lingban_runs_purpose_updated
  ON lingban_runs (run_purpose, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lingban_runs_session_project
  ON lingban_runs (session_project_id, updated_at DESC)
  WHERE session_project_id IS NOT NULL;
