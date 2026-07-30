// Historical seasons from the Sleeper API: real end-of-season fantasy
// points, and — crucially — the team each player suited up for THAT season,
// which is how past rosters are rebuilt without any extra data source.
// Same public, key-less, CORS-enabled API as sleeper.js.
import { POSITIONS } from './constants.js';
import { TEAMS } from './teams.js';
import { readCache, writeCache, pickPoints } from './sleeper.js';

// Finished seasons never change, so cache them for a long time; the version
// in the key lets a future format change invalidate old entries.
const CACHE_PREFIX = 'stw_hist_v1_';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Same browsable-on-a-phone caps as the current-era rosters, but ordered by
// real points instead of depth chart (there is no historical depth chart).
const MAX_PER_POSITION = { QB: 4, RB: 8, WR: 10, TE: 6, K: 2, DEF: 1 };

// Franchises that moved since 2010: Sleeper tags old seasons with the
// abbreviation of the time; fold those into the current wheel wedge so the
// 2013 Raiders land on the LV segment.
const TEAM_ALIASES = { OAK: 'LV', SD: 'LAC', STL: 'LAR', LA: 'LAR' };

function seasonUrl(year) {
  const params = new URLSearchParams({
    season_type: 'regular',
    order_by: 'pts_ppr',
  });
  POSITIONS.forEach((pos) => params.append('position[]', pos));
  return `https://api.sleeper.app/stats/nfl/${year}?${params}`;
}

// Reduce the season rows to the same shape as sleeper.js rosters —
// { ABBR: { QB: [{id, name, pos, pts}], ... } } — plus each player's real
// PPR points for the season, ready for scoring without another fetch.
function reduceSeason(rows) {
  const buckets = {};
  for (const abbr of Object.keys(TEAMS)) {
    buckets[abbr] = Object.fromEntries(POSITIONS.map((pos) => [pos, []]));
  }
  let kept = 0;
  for (const row of rows) {
    const abbr = TEAM_ALIASES[row?.team] || row?.team;
    const pos = row?.player?.position || row?.player?.fantasy_positions?.[0];
    if (!buckets[abbr] || !POSITIONS.includes(pos)) continue;
    const pts = pickPoints(row.stats);
    if (pts == null || pts <= 0) continue;
    const id = String(row.player_id || '');
    const name =
      pos === 'DEF'
        ? TEAMS[abbr]?.name || abbr
        : row.player?.full_name ||
          [row.player?.first_name, row.player?.last_name]
            .filter(Boolean)
            .join(' ');
    if (!id || !name) continue;
    buckets[abbr][pos].push({ id, name, pos, pts: Math.round(pts * 10) / 10 });
    kept += 1;
  }
  if (!kept) return null;
  for (const abbr of Object.keys(buckets)) {
    for (const pos of POSITIONS) {
      buckets[abbr][pos] = buckets[abbr][pos]
        .sort((a, b) => b.pts - a.pts)
        .slice(0, MAX_PER_POSITION[pos]);
    }
  }
  return buckets;
}

// Fetch (or reuse) one season's per-team rosters with real points. Rejects
// when Sleeper has nothing for that year so the UI can offer a retry.
export async function fetchSeasonRosters(year) {
  const key = CACHE_PREFIX + year;
  const cached = readCache(key, CACHE_TTL_MS);
  if (cached) return cached;
  const res = await fetch(seasonUrl(year));
  if (!res.ok) throw new Error(`Sleeper stats ${year}: HTTP ${res.status}`);
  const rows = await res.json();
  const buckets = Array.isArray(rows) ? reduceSeason(rows) : null;
  if (!buckets) throw new Error(`Sleeper stats ${year}: empty season`);
  writeCache(key, buckets);
  return buckets;
}

// A distinct, stable color per year wedge (golden-angle hue walk keeps
// neighboring years visually apart).
export function yearColor(year) {
  const hue = Math.round((year * 137.508) % 360);
  return `hsl(${hue} 62% 40%)`;
}
