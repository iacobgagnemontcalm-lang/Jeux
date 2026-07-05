// Bot decision logic. Bots are driven by the host client (see Game.jsx):
// when it's a bot's turn the host spins (if needed) and picks for it.
import { SLOT_POSITIONS, BOTS } from './constants.js';
import { eligiblePlayers } from './sleeper.js';

// Choose a slot + player for a bot, given the round's team and the set of
// NFL player ids already taken this game/round. `openSlots` is the bot's list
// of unfilled roster slots. Returns { slot, player } or null when nothing is
// legally pickable (rare — the caller then skips with a no-op).
//
// Quality proxy: eligiblePlayers returns each position sorted best-first
// (depth chart, then Sleeper rank), so index 0 is the starter. Skill biases
// how far down the list a bot is willing to look:
//   noob (0)        → random open slot, random available player
//   connaisseur (.5)→ random open slot, one of its top ~2 available
//   expert (1)      → across all open slots, the best available starter
export function botChoose(level, openSlots, rosters, team, takenIds) {
  const skill = BOTS[level]?.skill ?? 0;

  // Per open slot: the still-available players, best-first.
  const options = openSlots
    .map((slot) => ({
      slot,
      list: eligiblePlayers(rosters, team, SLOT_POSITIONS[slot]).filter(
        (c) => !takenIds.has(c.id),
      ),
    }))
    .filter((o) => o.list.length);
  if (!options.length) return null;

  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (skill >= 1) {
    // Expert: pick the slot whose best available player ranks highest overall.
    // Rank = index in the *unfiltered* list, so a taken starter still lets the
    // next man count as "the starter".
    let best = null;
    for (const o of options) {
      const full = eligiblePlayers(rosters, team, SLOT_POSITIONS[o.slot]);
      const player = o.list[0];
      const rank = full.findIndex((c) => c.id === player.id);
      if (!best || rank < best.rank) best = { slot: o.slot, player, rank };
    }
    return { slot: best.slot, player: best.player };
  }

  const o = rand(options);
  if (skill >= 0.5) {
    // Connaisseur: one of this slot's top two available.
    return { slot: o.slot, player: rand(o.list.slice(0, 2)) };
  }
  // Noob: anyone available at a random slot.
  return { slot: o.slot, player: rand(o.list) };
}
