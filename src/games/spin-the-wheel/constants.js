// --- Spin the Wheel configuration (tune everything here) ---

// Fantasy roster slots each player must fill, and which NFL positions
// are eligible for each slot.
export const SLOTS = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX'];

export const SLOT_POSITIONS = {
  QB: ['QB'],
  RB1: ['RB'],
  RB2: ['RB'],
  WR1: ['WR'],
  WR2: ['WR'],
  TE: ['TE'],
  FLEX: ['RB', 'WR', 'TE'],
};

export const POSITIONS = ['QB', 'RB', 'WR', 'TE'];

// Each round everyone drafts a distinct player from the same team, so the
// player count can't exceed the smallest position list (4 QBs per team, see
// MAX_PER_POSITION in sleeper.js) — otherwise a round could dead-end with
// someone's last open slot having no player left to take.
export const MAX_PLAYERS = 4;

// Bonus multiplier applied to a player's projection when he was picked by
// typing his name (instead of choosing from the list).
export const NAME_BONUS = 1.2;

// Difficulty controls how close a typed name must be to count as correct.
// `threshold` is a 0..1 similarity score (see match.js). At 'extra' the
// (normalized) full name must be perfect.
export const DIFFICULTIES = {
  easy: { label: 'Facile', threshold: 0.5, hint: '50 % du nom suffit' },
  medium: { label: 'Moyen', threshold: 0.7, hint: '70 % du nom' },
  hard: { label: 'Difficile', threshold: 0.85, hint: '85 % du nom' },
  extra: { label: 'Extrême', threshold: 1, hint: 'Nom complet parfait' },
};
export const DIFFICULTY_KEYS = ['easy', 'medium', 'hard', 'extra'];
export const DEFAULT_DIFFICULTY = 'medium';

// How long the wheel animation runs on every screen (ms).
export const SPIN_MS = 5000;

// --- Roster helpers ---
export function openSlots(player) {
  return SLOTS.filter((slot) => !player?.roster?.[slot]);
}

export function rosterComplete(player) {
  return openSlots(player).length === 0;
}
