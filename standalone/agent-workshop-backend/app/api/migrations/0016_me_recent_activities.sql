CREATE TABLE IF NOT EXISTS lingban_me_recent_activities (
  activity_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  interaction TEXT NOT NULL,
  source_surface TEXT NOT NULL,
  workshop_id TEXT NULL,
  service_id TEXT NULL,
  run_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  activity_json JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS lingban_me_recent_activities_user_context_resource_uidx
  ON lingban_me_recent_activities (user_id, workspace_context_key, resource_type, resource_id);

CREATE INDEX IF NOT EXISTS lingban_me_recent_activities_updated_idx
  ON lingban_me_recent_activities (updated_at DESC, resource_type ASC, resource_id ASC);
