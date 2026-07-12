CREATE TABLE IF NOT EXISTS lingban_run_files (
  run_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  logical_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime_type TEXT NULL,
  object_key TEXT NULL,
  upload_id TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL,
  file_json JSONB NOT NULL,
  PRIMARY KEY (run_id, logical_path)
);

CREATE INDEX IF NOT EXISTS idx_lingban_run_files_workspace_run
  ON lingban_run_files (workspace_id, run_id, logical_path);

CREATE INDEX IF NOT EXISTS idx_lingban_run_files_run_indexed_at
  ON lingban_run_files (run_id, indexed_at DESC, logical_path);

CREATE INDEX IF NOT EXISTS idx_lingban_run_files_object_key
  ON lingban_run_files (object_key);

CREATE INDEX IF NOT EXISTS idx_lingban_run_files_upload_id
  ON lingban_run_files (upload_id);
