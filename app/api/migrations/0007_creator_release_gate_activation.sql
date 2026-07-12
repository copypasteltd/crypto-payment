CREATE TABLE IF NOT EXISTS lingban_creator_release_gates (
  gate_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  status TEXT NOT NULL,
  gate_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_release_gates_release_status
  ON lingban_creator_release_gates (release_id, status, gate_id);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_release_gates_package_status
  ON lingban_creator_release_gates (package_id, status, gate_id);

CREATE TABLE IF NOT EXISTS lingban_creator_release_activations (
  activation_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  state TEXT NOT NULL,
  activation_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_release_activations_release_state
  ON lingban_creator_release_activations (release_id, state, activation_id);

CREATE INDEX IF NOT EXISTS idx_lingban_creator_release_activations_package_state
  ON lingban_creator_release_activations (package_id, state, activation_id);
