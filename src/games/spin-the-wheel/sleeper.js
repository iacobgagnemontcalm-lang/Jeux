// Sleeper API client: NFL rosters (for the pick lists) and season
// projections (for the final scores). Public API, no key, CORS-enabled.
import { POSITIONS } from './constants.js';
import { TEAMS } from './teams.js';

const PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';
const ROSTER_CACHE_KEY = 'stw_rosters_v3';
const ROSTER_TTL_MS = 24 * 60 * 60 * 1000; // refetch the big players dump daily
const PROJ_CACHE_KEY = 'stw_proj_v2';
const PROJ_TTL_MS = 6 * 60 * 60 * 1000;

// Keep the lists short enough to browse on a phone (depth players project ~0
// points anyway). Teams carry a single DEF and usually one kicker.
const MAX_PER_POSITION = { QB: 4, RB: 8, WR: 10, TE: 6, K: 2, DEF: 1 };

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || Date.now() - at > ttl) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full/blocked: just skip caching */
  }
}

// Reduce the huge players dump (~10 MB) to
// { ABBR: { QB: [{id, name, pos}], RB: [...], WR: [...], TE: [...] } }
// sorted by depth chart, capped per position.
function reduceRosters(all) {
  const buckets = {};
  for (const abbr of Object.keys(TEAMS)) {
    buckets[abbr] = Object.fromEntries(POSITIONS.map((pos) => [pos, []]));
  }
  for (const [id, p] of Object.entries(all)) {
    if (!p || !buckets[p.team] || !POSITIONS.includes(p.position)) continue;
    // Team defenses (id = team abbr) carry no status; keep them.
    if (p.position !== 'DEF' && p.status && p.status !== 'Active') continue;
    const name =
      p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ');
    if (!name) continue;
    buckets[p.team][p.position].push({
      id,
      name,
      pos: p.position,
      depth: p.depth_chart_order ?? 99,
      rank: p.search_rank ?? 9999999,
    });
  }
  for (const abbr of Object.keys(buckets)) {
    for (const pos of POSITIONS) {
      buckets[abbr][pos] = buckets[abbr][pos]
        .sort((a, b) => a.depth - b.depth || a.rank - b.rank)
        .slice(0, MAX_PER_POSITION[pos])
        .map(({ id, name, pos: position }) => ({ id, name, pos: position }));
    }
  }
  return buckets;
}

// Fetch (or reuse) the per-team rosters. The reduced form is ~60 KB and is
// cached in localStorage so only the first load of the day pays the download.
export async function fetchRosters() {
  const cached = readCache(ROSTER_CACHE_KEY, ROSTER_TTL_MS);
  if (cached) return cached;
  const res = await fetch(PLAYERS_URL);
  if (!res.ok) throw new Error(`Sleeper players: HTTP ${res.status}`);
  const rosters = reduceRosters(await res.json());
  writeCache(ROSTER_CACHE_KEY, rosters);
  return rosters;
}

// Players eligible for a slot on a given team, in list order.
export function eligiblePlayers(rosters, teamAbbr, positions) {
  const team = rosters?.[teamAbbr];
  if (!team) return [];
  return positions.flatMap((pos) => team[pos] || []);
}

// --- Projections ---

// The NFL season is labeled by its starting year; before March we're still
// scoring the previous season's label.
export function currentSeason() {
  const now = new Date();
  return now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
}

function pickPoints(stats) {
  if (!stats) return null;
  const pts = stats.pts_ppr ?? stats.pts_half_ppr ?? stats.pts_std;
  return typeof pts === 'number' ? pts : null;
}

async function fetchSeasonProjection(playerId, season) {
  const url =
    `https://api.sleeper.app/projections/nfl/player/${playerId}` +
    `?season_type=regular&season=${season}&grouping=season`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data) return null;
  // grouping=season returns one object; without it (or on older seasons) the
  // API may return weekly entries — sum those.
  if (Array.isArray(data)) {
    let total = 0;
    let found = false;
    for (const week of data) {
      const pts = pickPoints(week?.stats ?? week);
      if (pts != null) {
        total += pts;
        found = true;
      }
    }
    return found ? total : null;
  }
  return pickPoints(data.stats ?? data);
}

// Season PPR projection for a player, trying the current season then the
// previous one (offseason gaps). Returns 0 when Sleeper has nothing.
export async function fetchProjection(playerId) {
  const cache = readCache(PROJ_CACHE_KEY, PROJ_TTL_MS) || {};
  if (typeof cache[playerId] === 'number') return cache[playerId];
  const season = currentSeason();
  let pts = null;
  try {
    pts = await fetchSeasonProjection(playerId, season);
    if (pts == null) pts = await fetchSeasonProjection(playerId, season - 1);
  } catch {
    /* network hiccup: fall through to 0 */
  }
  const value = pts ?? 0;
  const fresh = readCache(PROJ_CACHE_KEY, PROJ_TTL_MS) || {};
  fresh[playerId] = value;
  writeCache(PROJ_CACHE_KEY, fresh);
  return value;
}
