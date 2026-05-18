# Worker Board Setup

`SW/workerboard.html` is a generic worker board page. The first worker board is:

- `SW/workerboard.html?worker=BRBO`

## What it supports

- Public task posting
- Preset task categories per worker
- A current activity panel per worker
- Owner-only edit/delete/activity controls
- A worker registry so more 4-letter workers can be added later

## Add another worker later

Add another entry inside `SW/js/workerboard-config.js`:

```txt
workers: {
  BRBO: { ... },
  ABCD: {
    code: "ABCD",
    title: "ABCD Task Board",
    description: "Public task board for ABCD.",
    ownerEmail: "abcd@example.com",
    presetOptions: [...]
  }
}
```

The page navigation will automatically show the new worker code.

## Demo vs live mode

- `demo` mode stores each worker board separately in browser local storage.
- `firebase` mode stores each worker under `workers/{WORKER_CODE}/...`.

## Firebase note

When you are ready for live shared data, set `storageMode` to `firebase` and fill in the Firebase config fields in `SW/js/workerboard-config.js`.

## TV display

The company TV screen is:

- `SW/tvdisplay.html`

The admin dashboard is:

- `SW/tvadmin.html`

The dashboard signs in with the existing Cloudflare Worker admin credentials. It uses the password field on the page and sends the configured admin username from `SW/js/tvdisplay-config.js`.

Apply `SW/cloudflare/display-schema.sql` to the D1 database, or re-run `SW/cloudflare/board-schema.sql`, before publishing the Worker update.

If you already created the first display table before the promotional media fields were added, run `SW/cloudflare/display-promo-migration.sql` once on the same D1 database. If you already ran that promotional migration and only need the media browser/playlist additions, run `SW/cloudflare/display-library-migration.sql` once.

If your task board D1 database was created before edited timestamps were added, run `SW/cloudflare/board-migration-edited-at.sql` once on the same D1 database.

The display is built for promotional media. The admin dashboard can upload media, link existing media, curate the loop order, set slide durations, publish promo copy, set CTA text, choose ticker text, and select a display theme.

Uploads require a Cloudflare R2 bucket binding named `MEDIA_BUCKET` on the Worker. Linked media works without R2.

The Worker exposes:

- `GET /api/display` for the TV screen
- `PATCH /api/display` for the signed-in admin dashboard
- `GET /api/display/media` for the shared media browser
- `POST /api/display/media/link` for linked media
- `POST /api/display/media/upload` for R2-backed uploads
- `GET /api/display/media/{id}/content` for uploaded media playback
