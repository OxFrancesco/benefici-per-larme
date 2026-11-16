CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX questions_user ON questions (user_id, at);
