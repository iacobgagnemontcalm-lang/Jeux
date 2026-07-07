import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toPlayerList } from './session.js';
import { SLOTS, RANK_BONUS, nameBonus } from './constants.js';
import { TEAMS } from './teams.js';
import { fetchProjection } from './sleeper.js';
import { recordBestScore, useBestScores, bestFor } from './records.js';

function TeamChip({ abbr }) {
  const team = TEAMS[abbr];
  if (!team) return null;
  return (
    <span className="stw-team-chip" style={{ '--team': team.color }}>
      {abbr}
    </span>
  );
}

export default function Results({ session, playerId }) {
  // Memoized on the session snapshot: pickedIds feeds the fetch effect below,
  // so its identity must not change on unrelated re-renders.
  const players = useMemo(() => toPlayerList(session), [session]);

  // Every NFL player picked in this session (7 per participant).
  const pickedIds = useMemo(() => {
    const ids = new Set();
    players.forEach((p) =>
      SLOTS.forEach((slot) => {
        const pick = p.roster?.[slot];
        if (pick?.id) ids.add(pick.id);
      }),
    );
    return [...ids];
  }, [players]);

  // Sleeper season projections, one request per picked player (cached).
  const [proj, setProj] = useState(null); // { sleeperId: points }
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(false);
    Promise.all(pickedIds.map((id) => fetchProjection(id)))
      .then((values) => {
        if (!alive) return;
        const map = {};
        pickedIds.forEach((id, i) => {
          map[id] = values[i];
        });
        setProj(map);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [pickedIds, attempt]);

  const scored = useMemo(() => {
    if (!proj) return null;

    // Points of a pick before the head-to-head rank bonus: the Sleeper
    // projection, times the slot's name bonus if the player was named from
    // memory (×1.2, or ×1.3 at RB1/WR1).
    const pickPoints = (pick, slot) => {
      if (!pick) return 0;
      const base = proj[pick.id] || 0;
      return pick.bonus ? base * nameBonus(slot) : base;
    };

    // Head-to-head bonus: at each slot, rank the players by that pick's points
    // and reward the winner (×1.2), runner-up (×1.1), rest ×1.0. Ties share the
    // better multiplier. rankMult[slot][playerId] → multiplier.
    const rankMult = {};
    SLOTS.forEach((slot) => {
      rankMult[slot] = {};
      const owned = players
        .filter((p) => p.roster?.[slot])
        .map((p) => ({ id: p.id, pts: pickPoints(p.roster[slot], slot) }))
        .sort((a, b) => b.pts - a.pts);
      let rank = 0;
      owned.forEach((o, i) => {
        if (i > 0 && o.pts < owned[i - 1].pts) rank = i; // ties keep the rank
        rankMult[slot][o.id] = RANK_BONUS[rank] ?? 1;
      });
    });

    return players
      .map((p) => {
        const rows = SLOTS.map((slot) => {
          const pick = p.roster?.[slot];
          if (!pick) return { slot, pick: null, points: 0 };
          const base = proj[pick.id] || 0;
          const named = pick.bonus ? base * nameBonus(slot) : base;
          const rankMultiplier = rankMult[slot][p.id] || 1;
          return {
            slot,
            pick,
            base,
            rankMultiplier,
            points: named * rankMultiplier,
          };
        });
        const total = rows.reduce((sum, r) => sum + r.points, 0);
        return { ...p, rows, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [proj, players]);

  const winner = scored?.[0];

  // Personal best scores (per player name). Each human records their own
  // total once the projections are in; the write is best-effort and the
  // database only accepts improvements.
  const bests = useBestScores();
  const [myRecord, setMyRecord] = useState(null);
  const recordedRef = useRef(false);
  useEffect(() => {
    if (!scored || recordedRef.current) return;
    const me = scored.find((p) => p.id === playerId);
    if (!me || me.bot) return;
    recordedRef.current = true;
    recordBestScore(me.name, me.total).then((r) => r && setMyRecord(r));
  }, [scored, playerId]);

  return (
    <div className="screen results stw-results">
      <h1 className="results__title">Terminé !</h1>

      {!proj && !error && (
        <p className="muted loading-center">
          Récupération des projections Sleeper…
        </p>
      )}
      {error && (
        <p className="error-text">
          Impossible de charger les projections.{' '}
          <button
            type="button"
            className="btn"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Réessayer
          </button>
        </p>
      )}

      {winner && (
        <div className="results__winner">
          🏆 <strong>{winner.name}</strong> remporte la partie avec{' '}
          {winner.total.toFixed(1)} points projetés
        </div>
      )}

      {scored &&
        scored.map((p, rank) => {
          const isMe = p.id === playerId;
          const newRecord = isMe && myRecord?.improved;
          const best = p.bot ? null : bestFor(bests, p.name);
          return (
          <div
            key={p.id}
            className={`stw-result-card${isMe ? ' is-me' : ''}`}
          >
            <div className="stw-result-card__head">
              <span className="stw-result-card__rank">#{rank + 1}</span>
              <span className="stw-result-card__name">{p.name}</span>
              <span className="stw-result-card__total">
                {p.total.toFixed(1)} pts
              </span>
            </div>
            {newRecord ? (
              <div className="stw-record stw-record--new">
                🎉 Nouveau record personnel : {myRecord.best.toFixed(1)} pts
                {myRecord.prev != null && ` (ancien : ${myRecord.prev.toFixed(1)})`}
              </div>
            ) : (
              best && (
                <div className="stw-record">
                  🏅 Record de {best.name} : {best.score.toFixed(1)} pts
                </div>
              )
            )}
            <table className="stw-result-table">
              <tbody>
                {p.rows.map(({ slot, pick, base, points, rankMultiplier }) => (
                  <tr key={slot}>
                    <td className="stw-slot-label">{slot}</td>
                    <td>
                      {pick ? (
                        <>
                          <TeamChip abbr={pick.team} />
                          {pick.name}
                          {pick.bonus && (
                            <span className="stw-bonus">×{nameBonus(slot)}</span>
                          )}
                          {rankMultiplier > 1 && (
                            <span className="stw-rank-bonus">
                              {rankMultiplier >= RANK_BONUS[0] ? '🥇' : '🥈'} ×
                              {rankMultiplier}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="stw-slot-empty">—</span>
                      )}
                    </td>
                    <td className="stw-result-pts">
                      {pick ? (
                        <>
                          {points.toFixed(1)}
                          {pick.bonus && (
                            <span className="stw-result-base">
                              {' '}
                              ({base.toFixed(1)})
                            </span>
                          )}
                        </>
                      ) : (
                        '0.0'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          );
        })}

      <Link to="/" className="btn btn--big">Retour aux jeux</Link>
    </div>
  );
}
