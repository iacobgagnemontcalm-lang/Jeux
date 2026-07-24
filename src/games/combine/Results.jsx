import { Link } from 'react-router-dom';
import { standings, challengeById, rankResults } from './constants.js';

export default function Results({ session, playerId }) {
  const rows = standings(session);
  const rounds = session.rounds || {};
  const players = session.players || {};
  const roundKeys = Object.keys(rounds).sort((a, b) => Number(a) - Number(b));
  const podium = rows.slice(0, 3);

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
