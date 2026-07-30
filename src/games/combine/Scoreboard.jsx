import { standings } from './constants.js';

// The always-on standings: every nickname with its running total and current
// position (#1, #2, …). Shown on every screen of the game so the score and
// placement are visible at all times.
export default function Scoreboard({ session, me, title = 'Classement' }) {
  const rows = standings(session);
  if (!rows.length) return null;

  return (
    <section className="cmb-board">
      <h2 className="cmb-board__title">{title}</h2>
      <ol className="cmb-board__list">
        {rows.map((row) => (
          <li
            key={row.playerId}
            className={`cmb-board__row${row.playerId === me ? ' is-me' : ''}`}
          >
            <span className={`cmb-pos cmb-pos--${row.position}`}>#{row.position}</span>
            <span className="cmb-board__name">{row.name}</span>
            <span className="cmb-board__pts">{row.total} pts</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
