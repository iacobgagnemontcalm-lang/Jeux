// Combine — a real-life mini-Combine you run with friends: 8 challenges,
// a scoring wheel before each one, a vote to pick the challenge, then you
// go do it for real and type the results back in.

// Wheel animation duration (ms) — kept in sync with the CSS transition.
export const SPIN_MS = 3600;

// How many players the scoring is tuned for (12 = 30,28,…,8 with base 30).
export const MAX_PLAYERS = 12;

// The eight challenges, in their canonical order. `direction` says whether a
// bigger raw result is better ('high') or a smaller one is ('low', e.g. a time).
// `entry: 'rank'` means players type their placing (1ʳᵉ, 2ᵉ, …) instead of a
// raw measurement.
export const CHALLENGES = [
  { id: 'bench', label: 'Bench Press', emoji: '🏋️', unit: 'répétitions', short: 'reps', direction: 'high', step: 1 },
  { id: 'dash', label: '40 yds Dash', emoji: '🏃', unit: 'secondes', short: 's', direction: 'low', step: 0.01 },
  { id: 'broad', label: 'Broad Jump', emoji: '🦵', unit: 'mètres', short: 'm', direction: 'high', step: 0.01 },
  { id: 'throw', label: 'Longest Throw', emoji: '🏈', unit: 'mètres', short: 'm', direction: 'high', step: 0.1 },
  { id: 'punt', label: 'Longest Punt', emoji: '🦶', unit: 'mètres', short: 'm', direction: 'high', step: 0.1 },
  { id: 'precision', label: 'Precision Throws', emoji: '🎯', unit: 'points', short: 'pts', direction: 'high', step: 1 },
  { id: 'parcours', label: 'Parcours', emoji: '🚧', unit: 'secondes', short: 's', direction: 'low', step: 0.01 },
  { id: 'quiz', label: 'Quiz', emoji: '🧠', unit: 'position au quiz', short: '', direction: 'low', step: 1, entry: 'rank' },
];

export const TOTAL_CHALLENGES = CHALLENGES.length;

export function challengeById(id) {
  return CHALLENGES.find((c) => c.id === id) || null;
}

// The scoring wheel: it lands on a base value, then each place below the top
// is worth one "step" less (never below 0). The step scales with the base —
// a tenth of it — so the ladders are 30/27/24…, 20/18/16… and 12/11/10….
export const SCORE_BASES = [30, 20, 12];

export const SCORE_COLORS = {
  30: '#ffcb37', // gold
  20: '#ff8c3b', // orange
  12: '#c9873f', // bronze
};

export function stepForBase(base) {
  return Math.max(1, Math.round((base || 0) / 10));
}

export function pointsForRank(base, rank) {
  return Math.max(0, base - stepForBase(base) * (rank - 1));
}

// Preview of the point ladder for a base and a player count: [30,28,26,…].
export function pointLadder(base, count) {
  return Array.from({ length: count }, (_, i) => pointsForRank(base, i + 1));
}

// --- Ranking a challenge's raw results into positions (ties share a rank) ---
// `results` is { playerId: number }. Returns [{ playerId, value, rank }] sorted
// best-first, using standard competition ranking (1, 2, 2, 4, …).
export function rankResults(challenge, results) {
  const dir = challenge?.direction === 'low' ? 1 : -1;
  const entries = Object.entries(results || {}).filter(
    ([, v]) => typeof v === 'number' && Number.isFinite(v),
  );
  entries.sort((a, b) => (a[1] - b[1]) * dir);
  const ranked = [];
  let rank = 0;
  let prev = null;
  let seen = 0;
  for (const [playerId, value] of entries) {
    seen += 1;
    if (prev === null || value !== prev) {
      rank = seen;
      prev = value;
    }
    ranked.push({ playerId, value, rank });
  }
  return ranked;
}

// Points awarded this round from a base + the ranked results.
export function computeRoundPoints(base, ranked) {
  const points = {};
  for (const r of ranked) points[r.playerId] = pointsForRank(base, r.rank);
  return points;
}

// --- Position predictions ---
// Before each challenge a player may call their exact finishing position.
// Nail it and it is worth PREDICTION_BONUS points; miss and it is worth
// nothing. Each player gets MAX_PREDICTIONS calls for the whole Combine.
export const MAX_PREDICTIONS = 3;
export const PREDICTION_BONUS = 5;

// How many predictions a player has already spent (committed rounds only).
export function predictionsUsed(session, playerId) {
  return Object.values(session?.rounds || {}).filter(
    (r) => typeof r?.predictions?.[playerId] === 'number',
  ).length;
}

export function predictionsLeft(session, playerId) {
  return Math.max(0, MAX_PREDICTIONS - predictionsUsed(session, playerId));
}

// Bonus points from the calls: { playerId: PREDICTION_BONUS } for exact hits.
export function computePredictionBonuses(ranked, predictions) {
  const bonuses = {};
  for (const r of ranked) {
    if (predictions?.[r.playerId] === r.rank) bonuses[r.playerId] = PREDICTION_BONUS;
  }
  return bonuses;
}

// "1ʳᵉ", "2ᵉ", "3ᵉ", …
export function ordinalFr(n) {
  return n === 1 ? '1ʳᵉ' : `${n}ᵉ`;
}

// A raw result the way it should read on screen: a placing for rank-entry
// challenges (the Quiz), the plain number + unit for everything else.
export function formatResult(challenge, value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (challenge?.entry === 'rank') return ordinalFr(value);
  return `${value}${challenge?.short ? ` ${challenge.short}` : ''}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Challenge ids already played (committed to `rounds`).
export function playedIds(session) {
  return Object.values(session?.rounds || {}).map((r) => r.challengeId);
}

// The two random challenge options + the "Random" option for the vote.
export function sampleOptions(session) {
  const played = playedIds(session);
  const remaining = CHALLENGES.filter((c) => !played.includes(c.id)).map((c) => c.id);
  const picks = shuffle(remaining).slice(0, Math.min(2, remaining.length));
  return [...picks, 'random'];
}

// Resolve the "Random" option to a concrete, not-yet-played challenge id.
export function randomRemaining(session) {
  const played = playedIds(session);
  const remaining = CHALLENGES.filter((c) => !played.includes(c.id)).map((c) => c.id);
  const pool = remaining.length ? remaining : CHALLENGES.map((c) => c.id);
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Overall standings from the committed rounds ---
// Returns [{ playerId, name, total, position }] sorted best-first, positions
// with ties (so two players on 24 pts are both "#2").
export function standings(session) {
  const players = session?.players || {};
  const rounds = session?.rounds || {};
  const totals = {};
  for (const pid of Object.keys(players)) totals[pid] = 0;
  for (const r of Object.values(rounds)) {
    for (const [pid, pts] of Object.entries(r.points || {})) {
      totals[pid] = (totals[pid] || 0) + pts;
    }
  }
  const rows = Object.entries(players).map(([playerId, p]) => ({
    playerId,
    name: p.name,
    total: totals[playerId] || 0,
  }));
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  let position = 0;
  let prev = null;
  let seen = 0;
  for (const row of rows) {
    seen += 1;
    if (prev === null || row.total !== prev) {
      position = seen;
      prev = row.total;
    }
    row.position = position;
  }
  return rows;
}
