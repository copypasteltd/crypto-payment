CREATE TABLE IF NOT EXISTS lingban_me_favorite_workshops (
  favorite_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  workshop_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  favorite_json JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS lingban_me_favorite_workshops_user_context_workshop_uidx
  ON lingban_me_favorite_workshops (user_id, workspace_context_key, workshop_id);

CREATE INDEX IF NOT EXISTS lingban_me_favorite_workshops_updated_idx
  ON lingban_me_favorite_workshops (updated_at DESC, workshop_id ASC);
