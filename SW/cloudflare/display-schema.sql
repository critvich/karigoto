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
