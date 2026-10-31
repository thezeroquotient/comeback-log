# Comeback Log

Offline-first gym tracker: a daily checkbox table, a sets and reps log, and weekly analytics.

- `index.html`: the app, no build step
- `logic.js`: every formula, the sync merge and CSV export. Test with `node --test`
- `sw.js`: offline support. Always bump `VERSION` on release; files update together only then
- `make-icons.py`: regenerates the icons

Data stays on the phone (localStorage). Sync is optional: paste a GitHub token with Gists read and write in Settings, and the phones share one private gist, `comeback-log.json`. No personal data lives in this repo.
