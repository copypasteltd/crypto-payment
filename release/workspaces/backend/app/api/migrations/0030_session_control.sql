CREATE TABLE IF NOT EXISTS lingban_run_agent_threads (
  run_id TEXT PRIMARY KEY REFERENCES lingban_runs(run_id) ON DELETE CASCADE,
  thread_id TEXT UNIQUE,
  protocol TEXT NOT NULL,
  connection_state TEXT NOT NULL,
  current_turn_id TEXT,
  current_turn_state TEXT,
  event_high_watermark BIGINT NOT NULL DEFAULT 0,
  provider_id TEXT,
  provider_binding_id TEXT,
  model TEXT,
  runtime_config_sha256 TEXT,
  codex_version TEXT,
  protocol_version TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  thread_json JSONB NOT NULL,
  CHECK (event_high_watermark >= 0),
  CHECK (runtime_config_sha256 IS NULL OR runtime_config_sha256 ~ '^[a-fA-F0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_lingban_run_agent_threads_state
  ON lingban_run_agent_threads (connection_state, updated_at DESC);

CREATE TABLE IF NOT EXISTS lingban_run_agent_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES lingban_runs(run_id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  thread_id TEXT,
  turn_id TEXT,
  item_id TEXT,
  source_request_id TEXT,
  payload_sha256 TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  UNIQUE (run_id, sequence),
  CHECK (sequence > 0),
  CHECK (payload_sha256 ~ '^[a-fA-F0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_lingban_run_agent_events_boundary
  ON lingban_run_agent_events (run_id, sequence ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_run_agent_events_turn
  ON lingban_run_agent_events (run_id, turn_id, sequence ASC);

CREATE TABLE IF NOT EXISTS lingban_session_capture_jobs (
  capture_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES lingban_runs(run_id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL,
  requested_by_user_id TEXT,
  mode TEXT NOT NULL,
  requested_turn_id TEXT,
  status TEXT NOT NULL,
  status_reason TEXT,
  error_code TEXT,
  diagnostic_id TEXT,
  workspace_selection_json JSONB NOT NULL,
  destination_session_id TEXT,
  create_draft BOOLEAN NOT NULL DEFAULT TRUE,
  idempotency_key TEXT NOT NULL,
  lease_generation INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  requested_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  UNIQUE (workspace_id, run_id, idempotency_key),
  CHECK (lease_generation >= 0),
  CHECK (attempt_count >= 0),
  CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_lingban_session_capture_jobs_claim
  ON lingban_session_capture_jobs (status, next_retry_at, requested_at ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_session_capture_jobs_run
  ON lingban_session_capture_jobs (run_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS lingban_session_captures (
  capture_id TEXT PRIMARY KEY REFERENCES lingban_session_capture_jobs(capture_id) ON DELETE RESTRICT,
  thread_id TEXT NOT NULL,
  through_turn_id TEXT NOT NULL,
  event_high_watermark BIGINT NOT NULL,
  barrier_reached_at TIMESTAMPTZ NOT NULL,
  capture_manifest_object_key TEXT NOT NULL,
  capture_manifest_sha256 TEXT NOT NULL UNIQUE,
  event_count BIGINT NOT NULL DEFAULT 0,
  message_count BIGINT NOT NULL DEFAULT 0,
  tool_event_count BIGINT NOT NULL DEFAULT 0,
  file_count BIGINT NOT NULL DEFAULT 0,
  artifact_count BIGINT NOT NULL DEFAULT 0,
  captured_bytes BIGINT NOT NULL DEFAULT 0,
  security_state TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  CHECK (event_high_watermark >= 0),
  CHECK (capture_manifest_sha256 ~ '^[a-fA-F0-9]{64}$'),
  CHECK (event_count >= 0 AND message_count >= 0 AND tool_event_count >= 0),
  CHECK (file_count >= 0 AND artifact_count >= 0 AND captured_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS lingban_session_capture_objects (
  capture_id TEXT NOT NULL REFERENCES lingban_session_captures(capture_id) ON DELETE RESTRICT,
  object_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (capture_id, object_type),
  UNIQUE (object_key),
  CHECK (sha256 ~ '^[a-fA-F0-9]{64}$'),
  CHECK (size_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS lingban_session_capture_access_audit (
  audit_id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL REFERENCES lingban_session_captures(capture_id) ON DELETE RESTRICT,
  workspace_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_sha256 TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  access_mode TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  record_json JSONB NOT NULL,
  CHECK (object_sha256 ~ '^[a-fA-F0-9]{64}$'),
  CHECK (char_length(reason) >= 8),
  CHECK (access_mode IN ('proxy', 'signed-url'))
);

CREATE INDEX IF NOT EXISTS idx_lingban_session_capture_access_audit_capture
  ON lingban_session_capture_access_audit (capture_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_lingban_session_capture_access_audit_workspace
  ON lingban_session_capture_access_audit (workspace_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS lingban_sessions (
  session_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  task_family TEXT,
  status TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL
);

CREATE OR REPLACE FUNCTION lingban_reject_session_capture_content_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SESSION_CAPTURE_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lingban_session_capture_immutable ON lingban_session_captures;
CREATE TRIGGER trg_lingban_session_capture_immutable
BEFORE UPDATE ON lingban_session_captures
FOR EACH ROW EXECUTE FUNCTION lingban_reject_session_capture_content_update();

DROP TRIGGER IF EXISTS trg_lingban_session_capture_object_immutable ON lingban_session_capture_objects;
CREATE TRIGGER trg_lingban_session_capture_object_immutable
BEFORE UPDATE ON lingban_session_capture_objects
FOR EACH ROW EXECUTE FUNCTION lingban_reject_session_capture_content_update();

CREATE INDEX IF NOT EXISTS idx_lingban_sessions_workspace_status
  ON lingban_sessions (workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS lingban_session_drafts (
  draft_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES lingban_sessions(session_id) ON DELETE RESTRICT,
  source_capture_id TEXT NOT NULL REFERENCES lingban_session_captures(capture_id) ON DELETE RESTRICT,
  parent_session_version_id TEXT,
  status TEXT NOT NULL,
  current_revision_id TEXT,
  created_by_user_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  UNIQUE (session_id, source_capture_id),
  CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_lingban_session_drafts_status
  ON lingban_session_drafts (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS lingban_session_draft_revisions (
  revision_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES lingban_session_drafts(draft_id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL,
  input_fingerprint TEXT NOT NULL,
  selection_json JSONB NOT NULL,
  redaction_map_json JSONB NOT NULL,
  candidate_object_key TEXT NOT NULL UNIQUE,
  candidate_sha256 TEXT NOT NULL UNIQUE,
  candidate_size_bytes BIGINT NOT NULL,
  validation_report_json JSONB NOT NULL,
  security_report_json JSONB NOT NULL,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  UNIQUE (draft_id, revision_number),
  UNIQUE (draft_id, input_fingerprint),
  CHECK (revision_number > 0),
  CHECK (input_fingerprint ~ '^[a-fA-F0-9]{64}$'),
  CHECK (candidate_sha256 ~ '^[a-fA-F0-9]{64}$'),
  CHECK (candidate_size_bytes >= 0)
);

ALTER TABLE lingban_session_drafts
  DROP CONSTRAINT IF EXISTS fk_lingban_session_drafts_current_revision;

ALTER TABLE lingban_session_drafts
  ADD CONSTRAINT fk_lingban_session_drafts_current_revision
  FOREIGN KEY (current_revision_id) REFERENCES lingban_session_draft_revisions(revision_id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS lingban_session_redaction_reviews (
  review_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES lingban_session_drafts(draft_id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES lingban_session_draft_revisions(revision_id) ON DELETE RESTRICT,
  decision TEXT NOT NULL,
  note TEXT,
  reviewed_by_user_id TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_session_redaction_reviews_revision
  ON lingban_session_redaction_reviews (revision_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS lingban_session_draft_replays (
  replay_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES lingban_session_drafts(draft_id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES lingban_session_draft_revisions(revision_id) ON DELETE RESTRICT,
  replay_status TEXT NOT NULL,
  candidate_sha256 TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  CHECK (candidate_sha256 ~ '^[a-fA-F0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_lingban_session_draft_replays_revision
  ON lingban_session_draft_replays (revision_id, finished_at DESC);

CREATE TABLE IF NOT EXISTS lingban_session_versions (
  session_version_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES lingban_sessions(session_id) ON DELETE RESTRICT,
  sealed_from_revision_id TEXT UNIQUE REFERENCES lingban_session_draft_revisions(revision_id) ON DELETE RESTRICT,
  sealed_from_replay_id TEXT REFERENCES lingban_session_draft_replays(replay_id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL DEFAULT 'captured',
  legacy_incomplete BOOLEAN NOT NULL DEFAULT FALSE,
  migration_report_object_key TEXT,
  parent_session_version_id TEXT,
  manifest_version TEXT NOT NULL,
  pack_object_key TEXT NOT NULL UNIQUE,
  pack_sha256 TEXT NOT NULL UNIQUE,
  pack_size_bytes BIGINT NOT NULL,
  signature_algorithm TEXT NOT NULL,
  signature_key_id TEXT NOT NULL,
  signature_value TEXT NOT NULL,
  content_state TEXT NOT NULL,
  sealed_by_user_id TEXT,
  sealed_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  CHECK (pack_sha256 ~ '^[a-fA-F0-9]{64}$'),
  CHECK (pack_size_bytes >= 0)
);

ALTER TABLE lingban_session_drafts
  DROP CONSTRAINT IF EXISTS fk_lingban_session_drafts_parent_version;

ALTER TABLE lingban_session_drafts
  ADD CONSTRAINT fk_lingban_session_drafts_parent_version
  FOREIGN KEY (parent_session_version_id) REFERENCES lingban_session_versions(session_version_id) ON DELETE RESTRICT;

ALTER TABLE lingban_session_versions
  DROP CONSTRAINT IF EXISTS fk_lingban_session_versions_parent;

ALTER TABLE lingban_session_versions
  ADD CONSTRAINT fk_lingban_session_versions_parent
  FOREIGN KEY (parent_session_version_id) REFERENCES lingban_session_versions(session_version_id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS lingban_session_version_lineage (
  parent_version_id TEXT NOT NULL REFERENCES lingban_session_versions(session_version_id) ON DELETE RESTRICT,
  child_version_id TEXT NOT NULL REFERENCES lingban_session_versions(session_version_id) ON DELETE RESTRICT,
  relation_type TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (parent_version_id, child_version_id),
  CHECK (parent_version_id <> child_version_id)
);

CREATE TABLE IF NOT EXISTS lingban_creator_package_session_bindings (
  binding_id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES lingban_creator_packages(package_id) ON DELETE RESTRICT,
  session_version_id TEXT NOT NULL REFERENCES lingban_session_versions(session_version_id) ON DELETE RESTRICT,
  binding_state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  UNIQUE (package_id, session_version_id),
  CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_creator_package_session_binding_active
  ON lingban_creator_package_session_bindings (package_id)
  WHERE binding_state = 'active';

CREATE TABLE IF NOT EXISTS lingban_service_session_bindings (
  binding_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES lingban_catalog_services(service_id) ON DELETE RESTRICT,
  workspace_context_key TEXT NOT NULL,
  entry_surface TEXT NOT NULL,
  task_version_id TEXT NOT NULL,
  session_version_id TEXT NOT NULL REFERENCES lingban_session_versions(session_version_id) ON DELETE RESTRICT,
  state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  UNIQUE (service_id, workspace_context_key, entry_surface, task_version_id, session_version_id),
  CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_service_session_binding_active
  ON lingban_service_session_bindings (service_id, workspace_context_key, entry_surface)
  WHERE state = 'active';

CREATE OR REPLACE FUNCTION lingban_reject_sealed_session_version_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.sealed_from_revision_id IS DISTINCT FROM OLD.sealed_from_revision_id
    OR NEW.sealed_from_replay_id IS DISTINCT FROM OLD.sealed_from_replay_id
    OR NEW.source_type IS DISTINCT FROM OLD.source_type
    OR NEW.legacy_incomplete IS DISTINCT FROM OLD.legacy_incomplete
    OR NEW.migration_report_object_key IS DISTINCT FROM OLD.migration_report_object_key
    OR NEW.parent_session_version_id IS DISTINCT FROM OLD.parent_session_version_id
    OR NEW.manifest_version IS DISTINCT FROM OLD.manifest_version
    OR NEW.pack_object_key IS DISTINCT FROM OLD.pack_object_key
    OR NEW.pack_sha256 IS DISTINCT FROM OLD.pack_sha256
    OR NEW.pack_size_bytes IS DISTINCT FROM OLD.pack_size_bytes
    OR NEW.signature_algorithm IS DISTINCT FROM OLD.signature_algorithm
    OR NEW.signature_key_id IS DISTINCT FROM OLD.signature_key_id
    OR NEW.signature_value IS DISTINCT FROM OLD.signature_value
    OR NEW.sealed_by_user_id IS DISTINCT FROM OLD.sealed_by_user_id
    OR NEW.sealed_at IS DISTINCT FROM OLD.sealed_at
    OR (NEW.record_json - 'contentState') IS DISTINCT FROM (OLD.record_json - 'contentState') THEN
    RAISE EXCEPTION 'SESSION_VERSION_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lingban_session_version_immutable ON lingban_session_versions;

CREATE TRIGGER trg_lingban_session_version_immutable
BEFORE UPDATE ON lingban_session_versions
FOR EACH ROW EXECUTE FUNCTION lingban_reject_sealed_session_version_content_update();
