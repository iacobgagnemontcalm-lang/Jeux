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
// Round model: the game is played in SLOTS.length rounds. Each round, one
// player (the spinner) spins a team, picks first, then every other player
// picks a *different* player from that same team, in seating order. The
// spinner advances by one seat each round, so the game's first player picks
// last in round 2, and so on.
//
// All of it derives from a single counter, `turnIndex` = total picks made:
//   round        = floor(turnIndex / nPlayers)
//   picksInRound = turnIndex % nPlayers
//   spinner      = order[round % nPlayers]
//   currentPick  = order[(round + picksInRound) % nPlayers]
// The last pick of a round burns the team (write-once `usedTeams`, so a
// double-tap can't commit twice) and clears the spin; the last pick of the
// last round ends the game.
export async function commitPick(pin, playerId, session, { slot, player, team, bonus }) {
  const n = (session.order || []).length;
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
  if (n > 0 && total % n === 0) {
    // Round complete: burn the team, clear the wheel for the next spinner.
    updates[`usedTeams/${team}`] = playerId;
    updates.spin = null;
    if (total >= SLOTS.length * n) updates.status = 'ended';
  }
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
