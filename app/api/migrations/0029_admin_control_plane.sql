CREATE TABLE IF NOT EXISTS lingban_admin_resource_states (
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  state_json JSONB NOT NULL,
  PRIMARY KEY (resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_lingban_admin_resource_states_status
  ON lingban_admin_resource_states (resource_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS lingban_admin_audit_events (
  event_id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_admin_audit_events_resource
  ON lingban_admin_audit_events (resource_type, resource_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_lingban_admin_audit_events_actor
  ON lingban_admin_audit_events (actor_user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS lingban_admin_settings (
  setting_key TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  setting_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS lingban_admin_operations (
  operation_id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  operation_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_admin_operations_resource
  ON lingban_admin_operations (resource_type, resource_id, expires_at DESC);
