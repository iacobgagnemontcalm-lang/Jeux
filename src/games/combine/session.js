import { useEffect, useState } from 'react';
import { ref, get, set, update, onValue, serverTimestamp } from 'firebase/database';
import { db } from '../../firebase.js';
import { nameKey } from './identity.js';
import {
  SCORE_BASES,
  TOTAL_CHALLENGES,
  sampleOptions,
  randomRemaining,
  rankResults,
  computeRoundPoints,
  computePredictionBonuses,
  predictionsLeft,
  challengeById,
} from './constants.js';

// All Combine sessions live under combineSessions/$pin. Unlike the other
// games, the player key is the *name slug* (see identity.js), so rejoining
// with the same username returns the same player node.
const BASE = 'combineSessions';

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4 digits
}

// --- Session lifecycle ---

export async function createSession(hostName, hostUid) {
  const hostId = nameKey(hostName);
  if (!hostId) throw new Error('Nom invalide.');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const pin = randomPin();
    const sessionRef = ref(db, `${BASE}/${pin}`);
    const snap = await get(sessionRef);
    if (snap.exists()) continue;
    await update(sessionRef, {
      status: 'lobby',
      hostId,
      hostUid: hostUid || null,
      challengeIndex: 0,
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

// Join (or rejoin) by name. Existing names rejoin at any time — that is the
// whole point. A brand-new name is only allowed while still in the lobby.
export async function joinSession(pin, name, uid) {
  const playerId = nameKey(name);
  if (!playerId) return { ok: false, reason: 'bad-name' };

  const statusSnap = await get(ref(db, `${BASE}/${pin}/status`));
  if (!statusSnap.exists()) return { ok: false, reason: 'no-session' };
  const status = statusSnap.val();

  const playerRef = ref(db, `${BASE}/${pin}/players/${playerId}`);
  const existing = await get(playerRef);

  if (!existing.exists() && status !== 'lobby') {
    return { ok: false, reason: 'already-started' };
  }

  if (existing.exists()) {
    await update(playerRef, { name: name.trim(), uid: uid || null });
  } else {
    await set(playerRef, {
      name: name.trim(),
      uid: uid || null,
      joinedAt: Date.now(),
    });
  }
  return { ok: true, playerId };
}

// Host starts: freeze the turn/display order and open the first scoring spin.
export async function startSession(pin, playerIds) {
  await update(ref(db, `${BASE}/${pin}`), {
    status: 'playing',
    order: playerIds,
    challengeIndex: 0,
    rounds: null,
    round: { phase: 'spin' },
    startedAt: Date.now(),
  });
}

// --- Round flow (all host-driven except votes and result entry) ---

// 1. Scoring wheel. Pick the base up front so late joiners see the same wheel;
// every client animates toward `target`.
export async function spinScore(pin) {
  const target = Math.floor(Math.random() * SCORE_BASES.length);
  await update(ref(db, `${BASE}/${pin}`), {
    'round/scoreBase': SCORE_BASES[target],
    'round/scoreSpin': {
      target,
      nonce: Math.floor(Math.random() * 1e9),
      at: Date.now(),
    },
  });
}

// 2. Open the vote: two random challenges + "Random".
export async function openVote(pin, session) {
  await update(ref(db, `${BASE}/${pin}`), {
    'round/phase': 'vote',
    'round/options': sampleOptions(session),
    'round/votes': null,
    'round/challengeId': null,
  });
}

// A player casts (or changes) their vote.
export async function castVote(pin, playerId, optionIndex) {
  await update(ref(db, `${BASE}/${pin}`), {
    [`round/votes/${playerId}`]: optionIndex,
  });
}

// 3. Resolve the vote to a challenge and open the prediction window. Plurality
// wins; ties (including "nobody voted") are broken at random by the host.
export async function resolveVote(pin, session) {
  const options = session.round?.options || [];
  const votes = session.round?.votes || {};
  const counts = options.map(() => 0);
  for (const idx of Object.values(votes)) {
    if (idx >= 0 && idx < counts.length) counts[idx] += 1;
  }
  const max = Math.max(0, ...counts);
  const top = counts
    .map((c, i) => [c, i])
    .filter(([c]) => c === max)
    .map(([, i]) => i);
  const chosen = top[Math.floor(Math.random() * top.length)];
  const optionValue = options[chosen];
  const challengeId = optionValue === 'random' ? randomRemaining(session) : optionValue;

  await update(ref(db, `${BASE}/${pin}`), {
    'round/phase': 'predict',
    'round/challengeId': challengeId,
    'round/predictions': null,
    'round/results': null,
    'round/points': null,
    'round/bonuses': null,
  });
}

// A player calls (or takes back) the exact position they think they will
// finish this challenge in. `position` of null clears the call — nothing is
// spent until the round is committed. Free to change until that player has
// entered their own result for the challenge.
export async function setPrediction(pin, session, playerId, position) {
  if (typeof session?.round?.results?.[playerId] === 'number') return;
  if (position != null && predictionsLeft(session, playerId) <= 0) return;
  await update(ref(db, `${BASE}/${pin}`), {
    [`round/predictions/${playerId}`]: position,
  });
}

// 4. Predictions are locked in — open the result entry.
export async function openEntry(pin) {
  await update(ref(db, `${BASE}/${pin}`), { 'round/phase': 'enter' });
}

// A player enters (or corrects) their own raw result.
export async function submitResult(pin, playerId, value) {
  await update(ref(db, `${BASE}/${pin}`), {
    [`round/results/${playerId}`]: value,
  });
}

// 5. Compute the points for this challenge and commit them to `rounds`
// (idempotent: recomputing overwrites the same round slot, so tapping twice
// never double-counts). `points` is the placing points plus any prediction
// bonus, so the standings need no special case.
export async function revealPodium(pin, session) {
  const index = session.challengeIndex || 0;
  const challenge = challengeById(session.round?.challengeId);
  const base = session.round?.scoreBase || 0;
  const results = session.round?.results || {};
  const predictions = session.round?.predictions || {};
  const ranked = rankResults(challenge, results);
  const placePoints = computeRoundPoints(base, ranked);
  const bonuses = computePredictionBonuses(ranked, predictions);
  const points = { ...placePoints };
  for (const [pid, bonus] of Object.entries(bonuses)) {
    points[pid] = (points[pid] || 0) + bonus;
  }

  await update(ref(db, `${BASE}/${pin}`), {
    [`rounds/${index}`]: {
      challengeId: challenge?.id || null,
      scoreBase: base,
      results,
      predictions,
      bonuses,
      points,
    },
    'round/points': points,
    'round/bonuses': bonuses,
    'round/phase': 'podium',
  });
}

// 6. Advance to the next challenge, or end the game after the eighth.
export async function nextChallenge(pin, session) {
  const nextIndex = (session.challengeIndex || 0) + 1;
  if (nextIndex >= TOTAL_CHALLENGES) {
    await update(ref(db, `${BASE}/${pin}`), { status: 'ended' });
    return;
  }
  await update(ref(db, `${BASE}/${pin}`), {
    challengeIndex: nextIndex,
    round: { phase: 'spin' },
  });
}

export async function endSession(pin) {
  await update(ref(db, `${BASE}/${pin}`), { status: 'ended' });
}

// --- Live subscription ---
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

// Players as an array in display order (falls back to join order in lobby).
export function toPlayerList(session) {
  const players = session?.players || {};
  const order = session?.order;
  if (Array.isArray(order) && order.length) {
    return order.filter((id) => players[id]).map((id) => ({ id, ...players[id] }));
  }
  return Object.entries(players)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}
