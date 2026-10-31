# Comeback Log

Offline-first gym tracker: a daily checkbox table, a sets and reps log, and weekly analytics.

- `index.html`: the app, no build step
- `logic.js`: every formula, the sync merge and CSV export. Test with `node --test`
- `sw.js`: offline support. Always bump `VERSION` on release; files update together only then
- `make-icons.py`: regenerates the icons

- `api/`: the Cloudflare Worker and D1 database that hold the data

Each device keeps a copy (localStorage) so the app works offline, and syncs through the Worker whenever it's online. The private link's key is a Worker secret and lives in `.private-key` locally. It is never committed. No personal data lives in this repo.
