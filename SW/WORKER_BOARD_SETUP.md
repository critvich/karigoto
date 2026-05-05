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
