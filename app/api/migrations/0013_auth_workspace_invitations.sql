CREATE TABLE IF NOT EXISTS lingban_workspace_invitations (
  invitation_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES lingban_workspaces (workspace_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL REFERENCES lingban_users (user_id) ON DELETE RESTRICT,
  accepted_by_user_id TEXT NULL REFERENCES lingban_users (user_id) ON DELETE SET NULL,
  accept_token_hash TEXT NOT NULL,
  accept_token_preview TEXT NULL,
  note TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_workspace_invitations_workspace_status
  ON lingban_workspace_invitations (workspace_id, status, created_at DESC, invitation_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_workspace_invitations_email_status
  ON lingban_workspace_invitations (email, status, created_at DESC, invitation_id ASC);
