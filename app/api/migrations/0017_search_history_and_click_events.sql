CREATE TABLE IF NOT EXISTS lingban_search_history_entries (
  history_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  query TEXT NOT NULL,
  resource_types_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  history_json JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS lingban_search_history_entries_user_context_query_uidx
  ON lingban_search_history_entries (user_id, workspace_context_key, normalized_query);

CREATE INDEX IF NOT EXISTS lingban_search_history_entries_updated_idx
  ON lingban_search_history_entries (updated_at DESC, query ASC);

CREATE TABLE IF NOT EXISTS lingban_search_click_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_context_key TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  query TEXT NOT NULL,
  document_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  source_surface TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  event_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS lingban_search_click_events_query_idx
  ON lingban_search_click_events (user_id, workspace_context_key, normalized_query, occurred_at DESC);

CREATE INDEX IF NOT EXISTS lingban_search_click_events_document_idx
  ON lingban_search_click_events (document_id, occurred_at DESC);
