CREATE TABLE IF NOT EXISTS lingban_users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_users_email
  ON lingban_users (email);

CREATE TABLE IF NOT EXISTS lingban_workspaces (
  workspace_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  workspace_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_workspaces_slug
  ON lingban_workspaces (slug);

CREATE TABLE IF NOT EXISTS lingban_workspace_memberships (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lingban_workspace_memberships_user_status
  ON lingban_workspace_memberships (user_id, status, workspace_id);

CREATE TABLE IF NOT EXISTS lingban_auth_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  current_workspace_id TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_auth_sessions_access_token_hash
  ON lingban_auth_sessions (access_token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_auth_sessions_refresh_token_hash
  ON lingban_auth_sessions (refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_lingban_auth_sessions_user_id
  ON lingban_auth_sessions (user_id, created_at DESC, session_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_auth_sessions_workspace_id
  ON lingban_auth_sessions (current_workspace_id, updated_at DESC, session_id ASC);
