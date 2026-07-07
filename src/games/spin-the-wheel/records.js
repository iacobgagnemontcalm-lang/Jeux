import { useEffect, useState } from 'react';
import { ref, get, set, onValue } from 'firebase/database';
import { db } from '../../firebase.js';

// Persistent per-name best scores, stored under wheelBests/$nameKey.
// The key is the normalized player name, so "Kevin", "kevin" and "Kévin"
// all share one record. The database rules only accept writes that RAISE
// the score, so a record can never be lowered (or erased) by a client.

const BASE = 'wheelBests';

// Normalize a display name into a Firebase-safe key: trim, lowercase,
// strip accents, collapse spaces, drop the characters keys can't contain.
export function nameKey(name) {
  const key = (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[.#$/[\]]/g, '');
  return key || null;
}

export function bestFor(bests, name) {
  const key = nameKey(name);
  return (key && bests?.[key]) || null;
}

// Record a finished game's total for this name. Resolves to
// { improved, best, prev } — or null when the score couldn't be checked or
// written (offline, rules not deployed, lost a race to a higher score);
// records are best-effort and must never block the results screen.
export async function recordBestScore(name, total) {
  const key = nameKey(name);
  if (!key || !db || !Number.isFinite(total)) return null;
  const score = Math.round(total * 10) / 10;
  const recordRef = ref(db, `${BASE}/${key}`);
  try {
    const snap = await get(recordRef);
    const prev = snap.exists() ? snap.val().score : null;
    if (prev != null && score <= prev) return { improved: false, best: prev };
    await set(recordRef, { name: name.trim(), score, at: Date.now() });
    return { improved: true, best: score, prev };
  } catch {
    return null;
  }
}

// Live map of all best scores: { nameKey: { name, score, at } }.
export function useBestScores() {
  const [bests, setBests] = useState({});
  useEffect(() => {
    if (!db) return undefined;
    const unsub = onValue(
      ref(db, BASE),
      (snap) => setBests(snap.val() || {}),
      () => setBests({}),
    );
    return () => unsub();
  }, []);
  return bests;
}
