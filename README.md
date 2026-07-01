# Jeux 🎮

A web app that hosts multiple party games. The home screen lists the available
games as buttons; picking one opens it. The first game is **Fruit Interdit**.

Built with **React + Vite** and backed by **Firebase Realtime Database** for live,
cross-device sync (shared leaderboard, timer, code claiming).

## Fruit Interdit 🍅

A real-life scavenger hunt. Physical fruit are hidden with printed code stickers.
Players find them and type the code into the app to score. Each session lasts
**4 minutes**.

- **Codes** are a letter *prefix* + a number. The prefix picks the fruit; the number
  just makes each sticker unique. So `MANG1`, `MANG2`, … `MANG1000` are all mangoes.
- Each code can be scored **once ever per session** — there is only one physical
  `MANG1`, so the first person to enter it claims it and it is then spent.
- **Combo:** entering the *same fruit type back-to-back* multiplies its points
  (×2, ×3, … capped at ×5). A different fruit resets the streak.

### Fruits, prefixes & points (defaults)

| Fruit        | Prefix | Points |
| ------------ | ------ | ------ |
| Tomate       | `TOM`  | 1000   |
| Mangue       | `MANG` | 600    |
| Citron       | `LEM`  | 350    |
| Citron vert  | `LIME` | 350    |
| Pomme        | `APP`  | 200    |
| Myrtille     | `BLU`  | 100    |

All of this (prefixes, points, duration, combo cap) lives in
`src/games/fruit-interdit/constants.js`.

### Flow

1. A host opens the game, enters their name, taps **Nouvelle session** → gets a **PIN**.
2. Other players open the app, enter the PIN + their name, tap **Rejoindre**.
3. The host taps **Jouer ▶** to start the 4-minute clock.
4. Everyone hunts and enters codes. The screen shows the live **palmarès**
   (leaderboard), your own points, and your per-fruit tally.
5. When time runs out, the final palmarès is shown.

## Setup

You need a Firebase project (free "Spark" plan is enough).

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Realtime Database → Create database** (start in *test mode*).
3. **Project settings → Your apps → Web (`</>`)** — register an app and copy the
   config values.
4. Copy the env template and fill it in:
   ```bash
   cp .env.example .env
   # edit .env with your VITE_FIREBASE_* values
   ```
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open the printed URL. To test multiplayer, open it in two browser windows.

> The `VITE_FIREBASE_*` values are meant to be public in a web app — access is
> controlled by the database security rules, not by hiding the config.

## Deploy to a public URL

The project is already pinned to the Firebase project `jeux-a5490` (see
`.firebaserc`), so deploying is:

```bash
npm install -g firebase-tools   # once
firebase login                  # once, opens a browser
npm run build                   # produces dist/
firebase deploy                 # ships hosting + database rules
```

When it finishes you get a public URL like `https://jeux-a5490.web.app` (and
`https://jeux-a5490.firebaseapp.com`). Share it — players open it on their phones,
enter the PIN + their name, and join.

Useful variants:
- `firebase deploy --only hosting` — push just the app (skip rules).
- `firebase deploy --only database` — push just `database.rules.json` (see below).
- `firebase hosting:channel:deploy preview` — a temporary preview URL to test first.

`firebase.json` maps the built `dist/` to Firebase Hosting (with a SPA rewrite so
every route serves `index.html`) and points the database rules at
`database.rules.json`.

## Security rules

The Realtime Database is guarded by `database.rules.json`. What they do:

- The database root is **closed** (`.read/.write: false`); only `sessions/$pin` is
  reachable. You must know a session's PIN to read or write it — nobody can dump the
  whole database or list every session.
- Writes are **shape-validated**: `status` must be one of `lobby|playing|ended`,
  names are strings ≤ 30 chars, points/counts must be numbers, etc. This blocks
  malformed/garbage data.

**Important — what they do NOT do:** because the game is anonymous (no login, players
are just a per-browser id + a typed name), the rules can't tell one player from
another. A determined person who opens the console could write to the database
directly and inflate their score. That's an acceptable trade-off for a friendly,
private party game, and it's the same posture as Firebase "test mode" but safer
(closed root + validation, and it never expires).

If you later want to make cheating hard, enable **Anonymous Authentication** in the
Firebase console and change the rules so each player can only write their *own* node
(e.g. `".write": "auth != null && auth.uid == $playerId"`). That's a small,
self-contained follow-up — ask and I'll wire it up.

To publish rule changes: edit `database.rules.json`, then
`firebase deploy --only database` (or paste the file into
**Console → Realtime Database → Rules → Publish**).

## Adding another game

1. Add an entry to `GAMES` in `src/games/index.js` (id, name, description, path,
   emoji, accent, `enabled`).
2. Add a `<Route>` for its `path` in `src/App.jsx`.

The home screen renders one button per registry entry automatically.
