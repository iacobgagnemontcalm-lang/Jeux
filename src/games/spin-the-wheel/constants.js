// --- Spin the Wheel configuration (tune everything here) ---

// Fantasy roster slots each player must fill, and which NFL positions
// are eligible for each slot. DEF is the team defense (Sleeper models it as
// a "player" whose id is the team abbreviation).
export const SLOTS = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'DEF'];

export const SLOT_POSITIONS = {
  QB: ['QB'],
  RB1: ['RB'],
  RB2: ['RB'],
  WR1: ['WR'],
  WR2: ['WR'],
  TE: ['TE'],
  FLEX: ['RB', 'WR', 'TE'],
  K: ['K'],
  DEF: ['DEF'],
};

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

// Every NFL skill player can be drafted by only one player per game (in
// shared mode, only one per round-team). Kickers and defenses are exempt:
// teams carry a single DEF and usually one K, so those may be drafted by
// several players (see takenIds in Game.jsx).

// Bonus multiplier applied to a slot by finishing position projection: the
// player with the best projection at a given slot gets ×1.2, second ×1.1,
// everyone else ×1.0. Indexed by rank (0 = best). Stacks with NAME_BONUS.
export const RANK_BONUS = [1.2, 1.1];

// Bots the host can add in the lobby. `skill` biases how good a pick they
// make from the available players (see botChoose in bot.js); `nameRate` is
// their chance of "naming" a pick from memory, earning NAME_BONUS like a
// human who types the name right.
export const BOTS = {
  noob: { label: 'Recrue', emoji: '🤖', skill: 0, nameRate: 0.15 },
  connaisseur: { label: 'Connaisseur', emoji: '🤖', skill: 0.5, nameRate: 0.5 },
  expert: { label: 'Expert', emoji: '🤖', skill: 1, nameRate: 0.9 },
};
export const BOT_KEYS = ['noob', 'connaisseur', 'expert'];

// The two ways to play, chosen by the host in the lobby.
// - solo: on your turn you spin and the team is yours alone (original rules).
//   Every pick burns a team, so players × slots must fit in 32 teams → max 3.
// - shared: one spin per round, everyone drafts a distinct player from that
//   team, the spinner picks first and the spinner seat shifts each round.
//   Capped by the smallest unique-position list (4 QBs per team) → max 4.
export const MODES = {
  shared: {
    label: 'Équipe partagée',
    hint: 'Une équipe par ronde, tout le monde pige dedans',
    maxPlayers: 4,
  },
  solo: {
    label: 'Chacun son équipe',
    hint: 'À ton tour, tourne la roue et garde l\'équipe pour toi',
    maxPlayers: 3,
  },
};
export const MODE_KEYS = ['shared', 'solo'];
export const DEFAULT_MODE = 'shared';

// Bonus multiplier applied to a player's projection when he was picked by
// typing his name (instead of choosing from the list). The premium skill
// slots RB1 and WR1 pay more.
export const NAME_BONUS = 1.2;
export const NAME_BONUS_SLOTS = { RB1: 1.3, WR1: 1.3 };
export function nameBonus(slot) {
  return NAME_BONUS_SLOTS[slot] ?? NAME_BONUS;
}

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
