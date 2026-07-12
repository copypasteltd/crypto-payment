CREATE TABLE IF NOT EXISTS lingban_batch_run_jobs (
  batch_job_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  service_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  job_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_batch_run_jobs_workspace
  ON lingban_batch_run_jobs (workspace_id, updated_at DESC, batch_job_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_batch_run_jobs_context
  ON lingban_batch_run_jobs (workspace_context_key, updated_at DESC, batch_job_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_batch_run_jobs_service
  ON lingban_batch_run_jobs (service_id, updated_at DESC, batch_job_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_batch_run_jobs_status
  ON lingban_batch_run_jobs (status, updated_at DESC, batch_job_id ASC);

CREATE TABLE IF NOT EXISTS lingban_batch_run_items (
  batch_item_id TEXT PRIMARY KEY,
  batch_job_id TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  run_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  item_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_batch_run_items_batch
  ON lingban_batch_run_items (batch_job_id, row_index ASC, batch_item_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_batch_run_items_status
  ON lingban_batch_run_items (status, updated_at DESC, batch_item_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_batch_run_items_run
  ON lingban_batch_run_items (run_id, updated_at DESC, batch_item_id ASC);
