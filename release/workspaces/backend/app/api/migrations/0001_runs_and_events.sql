CREATE TABLE IF NOT EXISTS lingban_runs (
  run_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  target_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  aggregate_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_runs_workspace_created_at
  ON lingban_runs (workspace_id, created_at DESC, run_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_runs_status_updated_at
  ON lingban_runs (status, updated_at DESC, run_id ASC);

CREATE TABLE IF NOT EXISTS lingban_run_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_run_events_run_occurred_at
  ON lingban_run_events (run_id, occurred_at ASC, event_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_run_events_type_occurred_at
  ON lingban_run_events (event_type, occurred_at DESC, event_id ASC);
