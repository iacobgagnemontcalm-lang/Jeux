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

## Deploy (optional)

```bash
npm run build
npm install -g firebase-tools   # once
firebase login                  # once
firebase use --add              # pick your project, once
firebase deploy                 # ships hosting + database rules
```

`firebase.json` deploys the built `dist/` to Firebase Hosting and publishes the
Realtime Database rules from `database.rules.json`.

### Security rules

`database.rules.json` is intentionally open under `sessions/` so the demo works with
no auth (players are anonymous, identified by a per-browser id + the name they type).
Tighten these before any public/production use.

## Adding another game

1. Add an entry to `GAMES` in `src/games/index.js` (id, name, description, path,
   emoji, accent, `enabled`).
2. Add a `<Route>` for its `path` in `src/App.jsx`.

The home screen renders one button per registry entry automatically.
