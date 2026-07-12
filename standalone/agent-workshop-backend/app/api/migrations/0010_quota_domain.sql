CREATE TABLE IF NOT EXISTS lingban_quota_policies (
  policy_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref_id TEXT NULL,
  metric TEXT NOT NULL,
  status TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  policy_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_quota_policies_workspace_metric
  ON lingban_quota_policies (workspace_id, metric, updated_at DESC, policy_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_quota_policies_scope
  ON lingban_quota_policies (scope_type, scope_ref_id, metric, policy_id);

CREATE TABLE IF NOT EXISTS lingban_quota_counters (
  counter_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref_id TEXT NULL,
  metric TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_ends_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  counter_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_quota_counters_policy_window
  ON lingban_quota_counters (policy_id, window_started_at DESC, counter_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_quota_counters_workspace_metric
  ON lingban_quota_counters (workspace_id, metric, updated_at DESC, counter_id ASC);

CREATE TABLE IF NOT EXISTS lingban_quota_events (
  event_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref_id TEXT NULL,
  metric TEXT NOT NULL,
  decision TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_quota_events_workspace_occurred_at
  ON lingban_quota_events (workspace_id, occurred_at DESC, event_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_quota_events_policy_occurred_at
  ON lingban_quota_events (policy_id, occurred_at DESC, event_id ASC);

CREATE TABLE IF NOT EXISTS lingban_quota_overrides (
  override_id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_ref_id TEXT NULL,
  metric TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  override_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_quota_overrides_workspace_status
  ON lingban_quota_overrides (workspace_id, status, requested_at DESC, override_id ASC);

CREATE INDEX IF NOT EXISTS idx_lingban_quota_overrides_policy_status
  ON lingban_quota_overrides (policy_id, status, requested_at DESC, override_id ASC);
