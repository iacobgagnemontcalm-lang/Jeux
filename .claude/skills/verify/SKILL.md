---
name: verify
description: Run this app locally against Firebase emulators and drive it in a headless browser to verify changes end-to-end.
---

# Verifying Jeux changes at runtime

Vite + React app; the Firebase games (Fruit Interdit, Spin the Wheel) need
Firebase Auth (anonymous) + Realtime Database. Verify against local emulators —
never against the production database.

## Launch recipe (all from a scratch dir, nothing committed)

1. **Emulators** — firebase-tools needs an explicit emulators config and a
   rules path *relative to the config file* (copy `database.rules.json` next
   to it). The repo's own `firebase.json` has no `emulators` block, so auth
   won't start with it.

   ```json
   { "database": { "rules": "database.rules.json" },
     "emulators": { "auth": { "host": "127.0.0.1", "port": 9099 },
                    "database": { "host": "127.0.0.1", "port": 9000 } } }
   ```

   `npx -y firebase-tools@13 emulators:start --only auth,database --project demo-jeux --config ./firebase-emu.json`
   (demo- project prefix avoids any real credentials; wait for "All emulators ready").

2. **Point the app at them** — create `.env.local` (gitignored) with dummy
   `VITE_FIREBASE_*` values (`VITE_FIREBASE_DATABASE_URL=https://demo-jeux-default-rtdb.firebaseio.com`)
   plus `VITE_USE_EMULATORS=1`, and add a temporary shim in `src/firebase.js`:
   `connectDatabaseEmulator(db, '127.0.0.1', 9000)` /
   `connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })`
   guarded by that env var. **Revert the shim before committing.**

3. **Dev server** — `npm run dev -- --port 5173 --strictPort`.

4. **Drive with playwright-core** (`executablePath: '/opt/pw-browsers/chromium'`
   in the remote env).

## Gotchas

- **HashRouter**: routes live behind `/#/` — use
  `http://127.0.0.1:5173/#/spin-the-wheel`, not `/spin-the-wheel` (that lands
  on the game-select page).
- **Sleeper API**: the Results screen also fetches
  `https://api.sleeper.app/projections/nfl/player/<id>?...` per picked player —
  stub with `{ "stats": { "pts_ppr": 100 } }`. Spin the Wheel fetches `https://api.sleeper.app/v1/players/nfl`
  (~10 MB, external). Stub it with `page.route` returning a small fixture — one
  set of players per team (fields: `team`, `position`, `status: 'Active'`,
  `full_name`, `depth_chart_order`, `search_rank`); team DEF entries are keyed
  by the team abbreviation. Team abbrs come from `src/games/spin-the-wheel/teams.js`.
- **Success toasts get wiped**: after a pick commits, the turn advances and the
  pick panel resets, erasing feedback. Assert on the roster board
  (`.stw-roster-card`), which is persistent — e.g. bonus shows as `×1.2`/`×1.3`
  in the slot row.
- The wheel spin animation takes 5 s (`SPIN_MS`); wait for the
  "1. Choisissez la case" text instead of sleeping.
- A single player can host and play a full shared-mode game alone — no second
  browser context needed.
