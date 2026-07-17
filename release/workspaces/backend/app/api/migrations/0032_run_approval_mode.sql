ALTER TABLE lingban_runs
  ADD COLUMN IF NOT EXISTS approval_mode TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE lingban_runs
  ADD COLUMN IF NOT EXISTS approval_mode_updated_at TIMESTAMPTZ;

ALTER TABLE lingban_runs
  ADD COLUMN IF NOT EXISTS approval_mode_updated_by_user_id TEXT;

ALTER TABLE lingban_runs
  DROP CONSTRAINT IF EXISTS lingban_runs_approval_mode_check;

ALTER TABLE lingban_runs
  ADD CONSTRAINT lingban_runs_approval_mode_check
  CHECK (approval_mode IN ('manual', 'auto_all'));

CREATE INDEX IF NOT EXISTS idx_lingban_runs_approval_mode_updated
  ON lingban_runs (approval_mode, updated_at DESC);
