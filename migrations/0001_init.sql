CREATE TABLE benefits (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  audience TEXT NOT NULL,
  value TEXT,
  how_to_claim TEXT NOT NULL,
  region TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  valid_until TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  run_id TEXT NOT NULL
);
CREATE INDEX benefits_category ON benefits (category);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX runs_started_at ON runs (started_at);

CREATE TABLE run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX run_events_run ON run_events (run_id, id);
