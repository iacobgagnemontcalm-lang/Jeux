import { useEffect, useState } from 'react';
import {
  ref,
  get,
  set,
  update,
  onValue,
  serverTimestamp,
} from 'firebase/database';
import { db } from '../../firebase.js';
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_MODE,
  BOTS,
  SLOTS,
  openSlots,
  rosterComplete,
} from './constants.js';

// Same session system as Fruit Interdit (PIN + lobby + anonymous auth uid as
// playerId), stored under its own top-level node: wheelSessions/$pin.

const BASE = 'wheelSessions';

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4 digits
}

// --- Session lifecycle ---

export async function createSession(hostId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const pin = randomPin();
    const sessionRef = ref(db, `${BASE}/${pin}`);
    const snap = await get(sessionRef);
    if (snap.exists()) continue;
    // update() (not set()) writes each field as its own leaf path, which the
    // security rules grant per-field; a set() on the parent node would be denied.
    await update(sessionRef, {
      status: 'lobby',
      hostId,
      difficulty: DEFAULT_DIFFICULTY,
      mode: DEFAULT_MODE,
      createdAt: serverTimestamp(),
    });
    return pin;
  }
  throw new Error('Impossible de générer un PIN disponible.');
}

export async function sessionExists(pin) {
  const snap = await get(ref(db, `${BASE}/${pin}/status`));
  return snap.exists();
}

export async function joinSession(pin, playerId, name) {
  const statusSnap = await get(ref(db, `${BASE}/${pin}/status`));
  if (!statusSnap.exists()) return { ok: false, reason: 'no-session' };
  if (statusSnap.val() !== 'lobby') return { ok: false, reason: 'already-started' };

  const playerRef = ref(db, `${BASE}/${pin}/players/${playerId}`);
  const existing = await get(playerRef);
  if (existing.exists()) {
    await update(playerRef, { name: name.trim() });
  } else {
    await set(playerRef, {
      name: name.trim(),
      joinedAt: serverTimestamp(),
    });
  }
  return { ok: true };
}

// Host picks the name-guess difficulty in the lobby.
export async function setDifficulty(pin, difficulty) {
  await update(ref(db, `${BASE}/${pin}`), { difficulty });
}

// Host picks the game mode in the lobby (see MODES in constants.js).
export async function setMode(pin, mode) {
  await update(ref(db, `${BASE}/${pin}`), { mode });
}

// Host adds a bot player (its own node keyed by a bot_ id; the database rules
// let any authed user write bot_* nodes so the host can drive them).
export async function addBot(pin, level) {
  const botId = `bot_${Math.random().toString(36).slice(2, 8)}`;
  const label = BOTS[level]?.label || 'Bot';
  await set(ref(db, `${BASE}/${pin}/players/${botId}`), {
    name: `${BOTS[level]?.emoji || '🤖'} ${label}`,
    bot: level,
    joinedAt: Date.now(),
  });
}

export async function removeBot(pin, botId) {
  await set(ref(db, `${BASE}/${pin}/players/${botId}`), null);
}

// Derive whose turn it is from the single `turnIndex` counter (= total picks
// made). Both modes share the counter; see commitPick for the round model.
export function deriveTurn(session) {
  const order = session?.order || [];
  const n = order.length;
  const solo = (session?.mode || DEFAULT_MODE) === 'solo';
  const turnIndex = session?.turnIndex || 0;
  const round = n ? Math.floor(turnIndex / n) : 0;
  const picksInRound = n ? turnIndex % n : 0;
  const spinnerUid = solo
    ? n
      ? order[turnIndex % n]
      : null
    : n
      ? order[round % n]
      : null;
  const currentUid = solo
    ? spinnerUid
    : n
      ? order[(round + picksInRound) % n]
      : null;
  return { n, solo, turnIndex, round, picksInRound, spinnerUid, currentUid };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Host starts the game: shuffle the turn order (first player is random).
export async function startSession(pin, playerIds) {
  await update(ref(db, `${BASE}/${pin}`), {
    status: 'playing',
    order: shuffle(playerIds),
    turnIndex: 0,
    startedAt: Date.now(),
  });
}

// The current player spins: every client animates the wheel toward the same
// team. `nonce` distinguishes consecutive spins.
export async function writeSpin(pin, playerId, team) {
  await update(ref(db, `${BASE}/${pin}`), {
    spin: {
      team,
      by: playerId,
      nonce: Math.floor(Math.random() * 1e9),
      at: Date.now(),
    },
  });
}

// Commit a pick — one atomic multi-path update.
//
// The game is played in SLOTS.length rounds, and everything derives from a
// single counter, `turnIndex` = total picks made:
//   round        = floor(turnIndex / nPlayers)
//   picksInRound = turnIndex % nPlayers
//
// 'shared' mode: each round one player (the spinner) spins a team, picks
// first, then every other player picks a *different* player from that same
// team, in seating order. The spinner seat advances each round, so the
// game's first player picks last in round 2, and so on:
//   spinner      = order[round % nPlayers]
//   currentPick  = order[(round + picksInRound) % nPlayers]
// The last pick of a round burns the team and clears the spin.
//
// 'solo' mode: the spun team belongs to the current player alone —
//   spinner = currentPick = order[turnIndex % nPlayers]
// and every pick burns its team.
//
// `usedTeams` is write-once in the rules, so a double-tap can't commit the
// same team twice. The last pick of the last round ends the game.
export async function commitPick(pin, playerId, session, { slot, player, team, bonus }) {
  const n = (session.order || []).length;
  const solo = (session.mode || DEFAULT_MODE) === 'solo';
  const total = (session.turnIndex || 0) + 1; // picks made once this commits

  const updates = {
    [`players/${playerId}/roster/${slot}`]: {
      id: player.id,
      name: player.name,
      pos: player.pos,
      team,
      bonus: Boolean(bonus),
    },
    turnIndex: total,
  };
  if (solo || (n > 0 && total % n === 0)) {
    // The team is spent: clear the wheel for the next spin.
    updates[`usedTeams/${team}`] = playerId;
    updates.spin = null;
  }
  if (total >= SLOTS.length * n) updates.status = 'ended';
  await update(ref(db, `${BASE}/${pin}`), updates);
}

export async function endSession(pin) {
  await update(ref(db, `${BASE}/${pin}`), { status: 'ended' });
}

// --- Live subscription hook ---
export function useSession(pin) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pin) {
      setSession(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = onValue(ref(db, `${BASE}/${pin}`), (snap) => {
      setSession(snap.exists() ? snap.val() : null);
      setLoading(false);
    });
    return () => unsub();
  }, [pin]);

  return { session, loading };
}

// Players as an array in turn order (falls back to join order in the lobby).
export function toPlayerList(session) {
  const players = session?.players || {};
  const order = session?.order;
  if (Array.isArray(order) && order.length) {
    return order
      .filter((id) => players[id])
      .map((id) => ({ id, ...players[id] }));
  }
  return Object.entries(players)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

export { SLOTS, openSlots, rosterComplete };
