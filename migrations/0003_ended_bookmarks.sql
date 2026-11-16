ALTER TABLE benefits ADD COLUMN ended_at INTEGER;
ALTER TABLE benefits ADD COLUMN ended_reason TEXT;
ALTER TABLE benefits ADD COLUMN ended_run_id TEXT;
ALTER TABLE benefits ADD COLUMN checked_at INTEGER;

CREATE TABLE bookmarks (
  user_id TEXT NOT NULL,
  benefit_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, benefit_id)
);

-- Which forces and specialties a benefit applies to, as a JSON array of corps ids.
ALTER TABLE benefits ADD COLUMN corps TEXT NOT NULL DEFAULT '["esercito"]';
