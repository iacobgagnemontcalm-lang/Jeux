// Bot decision logic. Bots are driven by the host client (see Game.jsx):
// when it's a bot's turn the host spins (if needed) and picks for it.
import { SLOT_POSITIONS, BOTS } from './constants.js';
import { eligiblePlayers, fetchProjection } from './sleeper.js';

// How deep into each position's depth chart a skilled bot scouts. The best
// projection is almost always near the top of the depth chart, and this caps
// the number of Sleeper projection fetches per bot turn (they're cached).
const SCOUT_DEPTH = 3;

// Choose a slot + player for a bot, given the round's team and the set of
// NFL player ids already taken this game/round. `openSlots` is the bot's list
// of unfilled roster slots. Returns { slot, player } or null when nothing is
// legally pickable (rare — the caller then skips with a no-op).
//
// Skill decides how the bot drafts:
//   noob (0)        → random open slot, random available player
//   connaisseur (.5)→ scouts Sleeper projections, picks one of the top 3
//   expert (1)      → scouts Sleeper projections, always takes the best
// Skilled bots assign each candidate to the most restrictive open slot he
// fits (RB1 before FLEX), keeping FLEX free for later rounds.
export async function botChoose(level, openSlots, rosters, team, takenIds) {
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

  // Noob: anyone available at a random slot, no scouting.
  if (skill < 0.5) {
    const o = rand(options);
    return { slot: o.slot, player: rand(o.list) };
  }

  // Available players per position, best-first, capped to SCOUT_DEPTH.
  const posAvail = {};
  const availableAt = (pos) => {
    if (!posAvail[pos]) {
      posAvail[pos] = (rosters?.[team]?.[pos] || [])
        .filter((c) => !takenIds.has(c.id))
        .slice(0, SCOUT_DEPTH);
    }
    return posAvail[pos];
  };

  // Unique candidates with their preferred slot: the most restrictive open
  // slot they fit (fewest eligible positions), so FLEX is used last.
  const byId = new Map();
  for (const o of options) {
    const restrict = SLOT_POSITIONS[o.slot].length;
    for (const pos of SLOT_POSITIONS[o.slot]) {
      availableAt(pos).forEach((player, depth) => {
        const seen = byId.get(player.id);
        if (!seen || restrict < seen.restrict) {
          byId.set(player.id, { player, slot: o.slot, restrict, depth });
        }
      });
    }
  }

  const cands = [...byId.values()];
  const points = await Promise.all(cands.map((c) => fetchProjection(c.player.id)));
  cands.forEach((c, i) => {
    c.pts = points[i];
  });
  // Best projection first; the depth chart breaks ties (and carries the pick
  // when Sleeper has no projections, e.g. deep in the offseason).
  cands.sort((a, b) => b.pts - a.pts || a.depth - b.depth);

  const c = skill >= 1 ? cands[0] : rand(cands.slice(0, 3));
  return { slot: c.slot, player: c.player };
}
