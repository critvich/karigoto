CREATE TABLE IF NOT EXISTS tv_display_audio (
  id TEXT PRIMARY KEY,
  muted INTEGER NOT NULL DEFAULT 1 CHECK (muted IN (0, 1)),
  updated_at TEXT NOT NULL
);
