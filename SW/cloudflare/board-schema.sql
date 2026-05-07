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

CREATE TABLE IF NOT EXISTS accounts (
  code TEXT PRIMARY KEY,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_status
ON accounts (status, requested_at DESC);

CREATE TABLE IF NOT EXISTS tv_display_state (
  id TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  subheadline TEXT NOT NULL DEFAULT '',
  status_label TEXT NOT NULL DEFAULT '',
  status_value TEXT NOT NULL DEFAULT '',
  metric_one_label TEXT NOT NULL DEFAULT '',
  metric_one_value TEXT NOT NULL DEFAULT '',
  metric_two_label TEXT NOT NULL DEFAULT '',
  metric_two_value TEXT NOT NULL DEFAULT '',
  metric_three_label TEXT NOT NULL DEFAULT '',
  metric_three_value TEXT NOT NULL DEFAULT '',
  announcement TEXT NOT NULL DEFAULT '',
  ticker TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'image',
  media_alt TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_detail TEXT NOT NULL DEFAULT '',
  playlist_json TEXT NOT NULL DEFAULT '[]',
  slide_duration_seconds INTEGER NOT NULL DEFAULT 12,
  transition_style TEXT NOT NULL DEFAULT 'fade',
  theme TEXT NOT NULL DEFAULT 'day',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  source_type TEXT NOT NULL DEFAULT 'link',
  url TEXT NOT NULL,
  r2_key TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_created
ON media_assets (created_at DESC);
