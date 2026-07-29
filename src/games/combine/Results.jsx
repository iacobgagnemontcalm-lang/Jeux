import { Link } from 'react-router-dom';
import {
  standings,
  challengeById,
  rankResults,
  MAX_PREDICTIONS,
  PREDICTION_BONUS,
} from './constants.js';

export default function Results({ session, playerId }) {
  const rows = standings(session);
  const rounds = session.rounds || {};
  const players = session.players || {};
  const roundKeys = Object.keys(rounds).sort((a, b) => Number(a) - Number(b));
  const podium = rows.slice(0, 3);

  // Prediction tally: how many calls each player made and how many landed.
  const calls = rows
    .map((row) => {
      let used = 0;
      let hit = 0;
      for (const r of Object.values(rounds)) {
        if (typeof r?.predictions?.[row.playerId] === 'number') used += 1;
        if (r?.bonuses?.[row.playerId] > 0) hit += 1;
      }
      return { ...row, used, hit };
    })
    .filter((row) => row.used > 0);

  const medal = (pos) => (pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`);

  return (
    <div className="screen cmb-results">
      <header className="game-title">
        <span className="game-title__emoji">🏆</span>
        <h1>Classement final</h1>
      </header>

      <ol className="cmb-final-podium">
        {podium.map((row) => (
          <li key={row.playerId} className={`cmb-final cmb-final--${row.position}`}>
            <span className="cmb-final__medal">{medal(row.position)}</span>
            <span className="cmb-final__name">{row.name}</span>
            <span className="cmb-final__pts">{row.total} pts</span>
          </li>
        ))}
      </ol>

      <h2>Tous les joueurs</h2>
      <ol className="cmb-board__list">
        {rows.map((row) => (
          <li
            key={row.playerId}
            className={`cmb-board__row${row.playerId === playerId ? ' is-me' : ''}`}
          >
            <span className={`cmb-pos cmb-pos--${row.position}`}>#{row.position}</span>
            <span className="cmb-board__name">{row.name}</span>
            <span className="cmb-board__pts">{row.total} pts</span>
          </li>
        ))}
      </ol>

      {calls.length > 0 && (
        <section>
          <h2>Pronostics 🔮</h2>
          <div className="cmb-recap">
            {calls.map((row) => (
              <div key={row.playerId} className="cmb-recap__row">
                <span className="cmb-recap__emoji">🔮</span>
                <span className="cmb-recap__label">{row.name}</span>
                <span className="cmb-recap__base">
                  {row.used}/{MAX_PREDICTIONS} utilisés
                </span>
                <span className="cmb-recap__winner">
                  {row.hit} réussi{row.hit > 1 ? 's' : ''} · +
                  {row.hit * PREDICTION_BONUS} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {roundKeys.length > 0 && (
        <section>
          <h2>Défis joués</h2>
          <div className="cmb-recap">
            {roundKeys.map((k) => {
              const r = rounds[k];
              const c = challengeById(r.challengeId);
              const winner = rankResults(c, r.results || {})[0];
              return (
                <div key={k} className="cmb-recap__row">
                  <span className="cmb-recap__emoji">{c?.emoji}</span>
                  <span className="cmb-recap__label">{c?.label}</span>
                  <span className="cmb-recap__base">{r.scoreBase} pts</span>
                  <span className="cmb-recap__winner">
                    {winner ? `🥇 ${players[winner.playerId]?.name || winner.playerId}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Link to="/combine" className="btn btn--primary btn--big">
        Nouvelle partie
      </Link>
    </div>
  );
}
