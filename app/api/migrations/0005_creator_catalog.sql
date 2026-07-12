CREATE TABLE IF NOT EXISTS lingban_creator_packages (
  package_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  package_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_packages_state
  ON lingban_creator_packages (state, package_id);

CREATE TABLE IF NOT EXISTS lingban_creator_releases (
  release_id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  state TEXT NOT NULL,
  release_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_releases_package_state
  ON lingban_creator_releases (package_id, state, release_id);

CREATE TABLE IF NOT EXISTS lingban_creator_replays (
  replay_id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  state TEXT NOT NULL,
  replay_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_replays_package_state
  ON lingban_creator_replays (package_id, state, replay_id);
