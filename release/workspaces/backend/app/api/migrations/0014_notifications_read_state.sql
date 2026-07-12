CREATE TABLE IF NOT EXISTS lingban_notification_read_receipts (
  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES lingban_users (user_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES lingban_workspaces (workspace_id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL,
  receipt_json JSONB NOT NULL,
  PRIMARY KEY (user_id, workspace_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_lingban_notification_read_receipts_workspace_user
  ON lingban_notification_read_receipts (workspace_id, user_id, read_at DESC, notification_id ASC);

CREATE TABLE IF NOT EXISTS lingban_notification_read_cursors (
  user_id TEXT NOT NULL REFERENCES lingban_users (user_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES lingban_workspaces (workspace_id) ON DELETE CASCADE,
  marked_all_read_at TIMESTAMPTZ NOT NULL,
  cursor_json JSONB NOT NULL,
  PRIMARY KEY (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_lingban_notification_read_cursors_workspace_user
  ON lingban_notification_read_cursors (workspace_id, user_id, marked_all_read_at DESC);
