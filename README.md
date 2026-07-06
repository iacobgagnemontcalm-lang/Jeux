# Jeux 🎮

A web app that hosts multiple party games. The home screen lists the available
games as buttons; picking one opens it. Current games: **Fruit Interdit**,
**Turbo Soccer** and **Spin the Wheel**.

Built with **React + Vite** and backed by **Firebase Realtime Database** for live,
cross-device sync (shared leaderboard, timer, code claiming).

## Fruit Interdit 🍅

A real-life scavenger hunt. Physical fruit are hidden with printed code stickers.
Players find them and type the code into the app to score. Each session lasts
**4 minutes**.

- **Codes** are a letter *prefix* + a number. The prefix picks the fruit; the number
  just makes each sticker unique. So `MAN1`, `MAN2`, … `MAN1000` are all mangoes.
- Each code can be scored **once ever per session** — there is only one physical
  `MAN1`, so the first person to enter it claims it and it is then spent.
- **Combo:** entering the *same fruit type back-to-back* multiplies its points
  (×2, ×3, … capped at ×5). A different fruit resets the streak.

### Fruits, prefixes & points (defaults)

| Fruit        | Prefix | Points |
| ------------ | ------ | ------ |
| Tomate       | `TOM`  | 1000   |
| Mangue       | `MAN`  | 600    |
| Citron vert  | `LIM`  | 500    |
| Citron       | `LEM`  | 350    |
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

## Turbo Soccer ⚽🚗

A local arcade game (no Firebase needed): two cars face off in a soccer arena,
one goal on each side. Push the ball around, but the real weapon is the **nose
hit** — striking the ball with the front bumper at speed sends it flying, and
even more so with the turbo. First to lead when the 2-minute clock runs out
wins; a tie goes to **golden goal** (next goal wins).

- **Modes:** 1 player (vs a simple AI) or 2 players on the same keyboard.
- **Player 1 (blue):** `WASD`/`ZQSD` (physical position, so it works on AZERTY
  too) + `Left Shift` or `Space` for turbo.
- **Player 2 (red):** arrow keys + `Right Shift` for turbo.
- **Touch devices:** on-screen ◀ ▶ 🚀 buttons; the car accelerates by itself.
- Turbo drains a gauge that recharges over time.

Everything lives in `src/games/soccer-cars/` — `engine.js` (canvas physics +
rendering, no dependencies) and `SoccerCars.jsx` (menu + screen + touch
controls).

## Spin the Wheel 🏈

A turn-based NFL fantasy draft on a wheel, using the same PIN/lobby session
system as Fruit Interdit (Firebase required). Up to **4 players**.

- The host creates a session and picks, in the lobby, the **mode**, the
  **difficulty** (Facile / Moyen / Difficile / Extrême) and optionally adds
  **bots** to play against (Recrue / Connaisseur / Expert).
- **Two modes:**
  - **Équipe partagée** (max 4): the game runs in **9 rounds** (one per roster
    slot). Each round one player — the *spinner* — **spins the wheel** of the
    remaining teams, then **everyone drafts a distinct player from that same
    team**: the spinner picks first, the others in seat order. The spinner seat
    shifts each round, so the (random) first player picks last in round 2.
  - **Chacun son équipe** (max 3): on your turn you spin and the team is yours
    alone — pick one player, then it's the next player's turn.
- Each pick fills one of your open roster slots — **QB, RB1, RB2, WR1, WR2,
  TE, FLEX, K or DEF** (FLEX = RB/WR/TE). Every NFL skill player can be
  drafted only once — except **kickers and defenses**, which several players
  may draft (a team only carries one DEF and usually one K). Two ways to pick:
  - **Name the player from memory** — if your spelling is close enough for the
    difficulty (50% / 70% / 85% / 100% of the name), that player scores a
    **×1.2 bonus** at the end (**×1.3** on the premium RB1 and WR1 slots).
    A miss forces you to pick from the list.
  - **Pick from the list** (players at that position, from the Sleeper depth
    chart) — no bonus.
- When every roster is full, the game pulls each player's **season projection
  from the Sleeper API** (PPR). Two bonuses stack on top: the name bonus
  (×1.2, or ×1.3 at RB1/WR1), and a **head-to-head slot bonus** — at each slot
  the player with the best projection scores ×1.2, the runner-up ×1.1,
  everyone else ×1.0. Highest total wins.
- **Bots** are driven by the host's device. Experts scout the Sleeper
  projections and always draft the best available player; Connaisseurs scout
  too but pick one of the top three; Recrues pick at random. Bots also "name"
  their pick from memory — earning the ×1.2 name bonus — at a rate matching
  their level (Recrue 15%, Connaisseur 50%, Expert 90%).

Rosters and projections come from the public [Sleeper API](https://docs.sleeper.com)
(no key needed). Everything lives in `src/games/spin-the-wheel/`; the realtime
state is stored under `wheelSessions/$pin` (see `database.rules.json` — deploy
the rules with `firebase deploy --only database` before the first game).

## Setup

You need a Firebase project (free "Spark" plan is enough).

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Realtime Database → Create database** (start in *test mode*).
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
   Players sign in silently with an anonymous account; the security rules use it to
   stop people from editing each other's data or stealing claimed codes.
4. **Project settings → Your apps → Web (`</>`)** — register an app and copy the
   config values.
5. Copy the env template and fill it in:
   ```bash
   cp .env.example .env
   # edit .env with your VITE_FIREBASE_* values
   ```
6. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open the printed URL. To test multiplayer, open it in two browser windows.

> If you see **"Authentification requise"** in the app, step 3 (enable Anonymous)
> wasn't done yet — enable it, then reload.

> The `VITE_FIREBASE_*` values are meant to be public in a web app — access is
> controlled by the database security rules, not by hiding the config.

## Deploy to a public URL

The app is a static site that talks to Firebase for data + auth, so you can host it
anywhere. Two options:

### Option A — Netlify (easiest, no terminal, auto-deploys)

The repo includes `netlify.toml`, so Netlify configures itself.

1. Go to <https://app.netlify.com> and sign up / log in **with GitHub**.
2. **Add new site → Import an existing project → GitHub**, authorize, and pick this
   repository.
3. If asked for a branch, choose the branch that has the code. Build command and
   publish folder come from `netlify.toml` (`npm run build` → `dist`) — leave them.
4. **Deploy**. After a minute you get a public URL like
   `https://your-site-name.netlify.app`. Every future push auto-deploys.

The Firebase web config is committed in `.env.production`, so Netlify's build already
has it — no environment variables to set.

> If anonymous sign-in fails on the Netlify domain, add your `*.netlify.app` domain in
> Firebase → **Authentication → Settings → Authorized domains**.

Render works the same way (New → Static Site, build `npm run build`, publish `dist`,
add a rewrite `/*` → `/index.html`).

### Option B — Firebase Hosting (via terminal)

This puts the app on `https://jeux-a5490.web.app`. You only do the "once" steps a
single time; after that, deploying is one command.

**Step 1 — install the Firebase command-line tool (once).** In a terminal:

```bash
npm install -g firebase-tools
```

If that fails with a permissions error, try `sudo npm install -g firebase-tools`.

**Step 2 — log in (once).** This opens your browser to sign in to the same Google
account you used for the Firebase console:

```bash
firebase login
```

**Step 3 — build the app.** This compiles everything into a `dist/` folder:

```bash
npm run build
```

**Step 4 — deploy.** The project is already pointed at your Firebase project
`jeux-a5490` (that's what `.firebaserc` is for), so you just run:

```bash
firebase deploy
```

When it finishes, the terminal prints a **Hosting URL** like
`https://jeux-a5490.web.app`. That's your public link — open it on your phone, or
share it so others can join a session with the PIN + their name.

**To update the live site later**, repeat only steps 3 and 4 (`npm run build` then
`firebase deploy`). Handy variants:
- `firebase deploy --only hosting` — push just the app (skip the database rules).
- `firebase deploy --only database` — push just the database rules.

> Under the hood, `firebase.json` uploads the built `dist/` folder to Firebase
> Hosting (with a rewrite so every page loads the app) and publishes the database
> rules from `database.rules.json`.

## Security rules

The Realtime Database is guarded by `database.rules.json`, which relies on the
Anonymous Authentication you enabled in setup. What they enforce:

- **The database root is closed.** Only `sessions/$pin` is reachable, and only to a
  signed-in (anonymous) user. You must know a session's PIN to read or write it —
  nobody can dump the whole database or list every session.
- **You can only edit your own player.** `players/$playerId` is writable only by the
  matching signed-in user, so nobody can change another player's name or points.
- **Codes can't be stolen or re-used.** A `usedCodes` entry can only be written if it
  doesn't already exist, so the first person to claim a code keeps it.
- **Writes are shape-validated:** `status` must be `lobby|playing|ended`, names ≤ 30
  chars, points/counts must be non-negative numbers, etc. Blocks malformed data.

**One honest limitation:** scoring happens on the player's device, and a player *does*
own their own node — so a very determined person could still open the browser console
and inflate *their own* score (they cannot touch anyone else's). Fully preventing that
would require moving scoring to a Cloud Function (server-side), which is a bigger,
optional upgrade. For a friendly party game, the current rules are a solid baseline.

To publish rule changes: edit `database.rules.json`, then
`firebase deploy --only database` (or paste the file into
**Console → Realtime Database → Rules → Publish**).

## Adding another game

1. Add an entry to `GAMES` in `src/games/index.js` (id, name, description, path,
   emoji, accent, `enabled`).
2. Add a `<Route>` for its `path` in `src/App.jsx`.

The home screen renders one button per registry entry automatically.
