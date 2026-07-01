import { useEffect, useState } from 'react';
import {
  ref,
  get,
  set,
  update,
  onValue,
  serverTimestamp,
  runTransaction,
} from 'firebase/database';
import { db } from '../../firebase.js';
import { DURATION_SEC, MAX_COMBO, FRUITS } from './constants.js';
import { parseCode } from './codes.js';

// --- Player identity (anonymous, persisted per browser) ---
const PLAYER_ID_KEY = 'fi_player_id';

export function getPlayerId() {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

// --- PIN helpers ---
function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4 digits
}

// --- Session lifecycle ---

// Create a new session with a unique PIN; returns the PIN.
export async function createSession(hostId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const pin = randomPin();
    const sessionRef = ref(db, `sessions/${pin}`);
    const snap = await get(sessionRef);
    if (snap.exists()) continue;
    await set(sessionRef, {
      status: 'lobby',
      hostId,
      createdAt: serverTimestamp(),
      startedAt: null,
      endsAt: null,
    });
    return pin;
  }
  throw new Error('Impossible de générer un PIN disponible.');
}

export async function sessionExists(pin) {
  const snap = await get(ref(db, `sessions/${pin}/status`));
  return snap.exists();
}

// Join (or re-join) a session as a player. Allowed while in the lobby.
export async function joinSession(pin, playerId, name) {
  const statusSnap = await get(ref(db, `sessions/${pin}/status`));
  if (!statusSnap.exists()) return { ok: false, reason: 'no-session' };
  if (statusSnap.val() !== 'lobby') return { ok: false, reason: 'already-started' };

  const playerRef = ref(db, `sessions/${pin}/players/${playerId}`);
  const existing = await get(playerRef);
  if (existing.exists()) {
    // Re-joining: just refresh the name.
    await update(playerRef, { name: name.trim() });
  } else {
    await set(playerRef, {
      name: name.trim(),
      points: 0,
      fruitCounts: {},
      lastFruit: null,
      comboStreak: 0,
      joinedAt: serverTimestamp(),
    });
  }
  return { ok: true };
}

// Host starts the game: sets the 4-minute clock.
export async function startSession(pin) {
  const now = Date.now();
  await update(ref(db, `sessions/${pin}`), {
    status: 'playing',
    startedAt: now,
    endsAt: now + DURATION_SEC * 1000,
  });
}

// Flip a session to ended (called when the timer runs out).
export async function endSession(pin) {
  await update(ref(db, `sessions/${pin}`), { status: 'ended' });
}

// Submit a fruit code. Enforces one-time global use via a transaction, then
// awards points (with combo multiplier) atomically on the player's node.
export async function submitCode(pin, playerId, raw) {
  const parsed = parseCode(raw);
  if (!parsed) return { ok: false, reason: 'invalid' };
  const { code, fruit } = parsed;

  const sessionSnap = await get(ref(db, `sessions/${pin}`));
  if (!sessionSnap.exists()) return { ok: false, reason: 'no-session' };
  const s = sessionSnap.val();
  if (s.status !== 'playing') return { ok: false, reason: 'not-playing' };
  if (Date.now() >= s.endsAt) return { ok: false, reason: 'time-up' };

  // Claim the code globally. If it already exists, this code is spent.
  const codeRef = ref(db, `sessions/${pin}/usedCodes/${code}`);
  const claim = await runTransaction(codeRef, (current) =>
    current ? undefined : playerId,
  );
  if (!claim.committed) return { ok: false, reason: 'used' };

  // Award points + update combo on the player node.
  let awarded = 0;
  let multiplier = 1;
  await runTransaction(ref(db, `sessions/${pin}/players/${playerId}`), (p) => {
    if (!p) return p;
    const streak = p.lastFruit === fruit ? (p.comboStreak || 1) + 1 : 1;
    multiplier = Math.min(streak, MAX_COMBO);
    awarded = FRUITS[fruit].points * multiplier;
    const counts = { ...(p.fruitCounts || {}) };
    counts[fruit] = (counts[fruit] || 0) + 1;
    return {
      ...p,
      points: (p.points || 0) + awarded,
      fruitCounts: counts,
      lastFruit: fruit,
      comboStreak: streak,
    };
  });

  return { ok: true, fruit, awarded, multiplier };
}

// --- Live subscription hook ---
// Returns { session, loading }. session is the raw session object (or null).
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
    const unsub = onValue(ref(db, `sessions/${pin}`), (snap) => {
      setSession(snap.exists() ? snap.val() : null);
      setLoading(false);
    });
    return () => unsub();
  }, [pin]);

  return { session, loading };
}

// Convert a session's players object into a leaderboard array (sorted desc).
export function toLeaderboard(players) {
  return Object.entries(players || {})
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.points || 0) - (a.points || 0));
}
