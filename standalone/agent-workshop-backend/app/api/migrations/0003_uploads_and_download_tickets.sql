CREATE TABLE IF NOT EXISTS lingban_run_uploads (
  upload_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  file_name TEXT NOT NULL,
  object_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  upload_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_run_uploads_run_created_at
  ON lingban_run_uploads (run_id, created_at ASC, upload_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_run_uploads_workspace_created_at
  ON lingban_run_uploads (workspace_id, created_at ASC, upload_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_run_uploads_object_key
  ON lingban_run_uploads (object_key);

CREATE TABLE IF NOT EXISTS lingban_download_tickets (
  ticket_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  ticket_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_download_tickets_run_id
  ON lingban_download_tickets (run_id, created_at ASC, ticket_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_download_tickets_workspace_id
  ON lingban_download_tickets (workspace_id, created_at ASC, ticket_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_download_tickets_expires_at
  ON lingban_download_tickets (expires_at ASC, ticket_id ASC);
