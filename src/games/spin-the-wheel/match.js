// Fuzzy name matching for the "type the player's name" bonus.
// A guess is compared to every eligible player; the best score wins if it
// reaches the difficulty threshold.

// Lowercase, strip accents and punctuation, collapse spaces.
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Classic Levenshtein distance (iterative, two rows).
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Similarity in 0..1 — the share of characters "got right".
function similarity(a, b) {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  return 1 - levenshtein(a, b) / max;
}

// Score a guess against one player's full name.
// The last name alone also counts, capped at 0.75: "mahomes" passes on
// Facile/Moyen but Difficile/Extrême demand (almost) the full name.
export function scoreGuess(guess, fullName) {
  const g = normalizeName(guess);
  const full = normalizeName(fullName);
  if (!g || !full) return 0;
  const last = full.split(' ').slice(-1)[0];
  return Math.max(similarity(g, full), similarity(g, last) * 0.75);
}

// Find the best-matching player above the threshold, or null.
// `candidates` are { id, name, ... } objects (already filtered by position).
export function bestMatch(guess, candidates, threshold) {
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = scoreGuess(guess, c.name);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  if (best && bestScore >= threshold) return { player: best, score: bestScore };
  return null;
}
