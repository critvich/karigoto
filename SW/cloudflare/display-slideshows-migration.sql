CREATE TABLE IF NOT EXISTS display_slideshows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  playlist_json TEXT NOT NULL DEFAULT '[]',
  ticker TEXT NOT NULL DEFAULT '',
  slide_duration_seconds INTEGER NOT NULL DEFAULT 12,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_display_slideshows_updated
ON display_slideshows (updated_at DESC);
