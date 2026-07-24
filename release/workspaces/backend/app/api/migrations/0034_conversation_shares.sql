CREATE TABLE IF NOT EXISTS lingban_conversation_shares (
  share_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  capture_id TEXT,
  access_scope TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  record_json JSONB NOT NULL,
  UNIQUE (workspace_id, run_id, idempotency_key),
  CHECK (source_type IN ('run', 'session_capture')),
  CHECK (access_scope IN ('public_link', 'workspace', 'invited_users')),
  CHECK (status IN ('active', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_lingban_conversation_shares_run
  ON lingban_conversation_shares (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lingban_conversation_shares_workspace
  ON lingban_conversation_shares (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lingban_conversation_share_access (
  access_id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES lingban_conversation_shares(share_id) ON DELETE CASCADE,
  access_type TEXT NOT NULL,
  file_id TEXT,
  actor_user_id TEXT,
  viewer_type TEXT NOT NULL,
  client_fingerprint TEXT,
  accessed_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  CHECK (access_type IN ('view', 'file')),
  CHECK (viewer_type IN ('anonymous', 'authenticated')),
  CHECK (client_fingerprint IS NULL OR client_fingerprint ~ '^[a-fA-F0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_lingban_conversation_share_access_share
  ON lingban_conversation_share_access (share_id, accessed_at DESC);
