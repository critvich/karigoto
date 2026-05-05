CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  worker_code TEXT NOT NULL,
  preset TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'open',
  done_at TEXT,
  done_day TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_worker_created
ON tasks (worker_code, created_at DESC);

CREATE TABLE IF NOT EXISTS activities (
  worker_code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  worker_code TEXT NOT NULL,
  username TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
ON sessions (expires_at);
