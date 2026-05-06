ALTER TABLE tv_display_state ADD COLUMN media_url TEXT NOT NULL DEFAULT '';
ALTER TABLE tv_display_state ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image';
ALTER TABLE tv_display_state ADD COLUMN media_alt TEXT NOT NULL DEFAULT '';
ALTER TABLE tv_display_state ADD COLUMN cta_label TEXT NOT NULL DEFAULT '';
ALTER TABLE tv_display_state ADD COLUMN cta_detail TEXT NOT NULL DEFAULT '';
ALTER TABLE tv_display_state ADD COLUMN playlist_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE tv_display_state ADD COLUMN slide_duration_seconds INTEGER NOT NULL DEFAULT 12;
ALTER TABLE tv_display_state ADD COLUMN transition_style TEXT NOT NULL DEFAULT 'fade';

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
