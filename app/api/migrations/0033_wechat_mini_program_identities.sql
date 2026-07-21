CREATE TABLE IF NOT EXISTS lingban_auth_external_identities (
  provider TEXT NOT NULL,
  app_id TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  union_id TEXT NULL,
  user_id TEXT NOT NULL REFERENCES lingban_users (user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider, app_id, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_lingban_auth_external_identities_user
  ON lingban_auth_external_identities (user_id, provider, app_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lingban_auth_external_identities_union
  ON lingban_auth_external_identities (provider, app_id, union_id)
  WHERE union_id IS NOT NULL;
