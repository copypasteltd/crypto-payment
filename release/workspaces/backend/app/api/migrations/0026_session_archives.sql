CREATE TABLE IF NOT EXISTS lingban_session_archives (
  session_version_id TEXT PRIMARY KEY,
  archive_source TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  runtime_source_run_id TEXT NULL,
  archive_record_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS lingban_session_archives_updated_idx
  ON lingban_session_archives (updated_at DESC, session_version_id ASC);
