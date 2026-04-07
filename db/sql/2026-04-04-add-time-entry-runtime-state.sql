ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS runtime_state jsonb;
