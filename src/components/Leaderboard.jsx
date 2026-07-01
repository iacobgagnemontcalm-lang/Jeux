const MEDALS = ['🥇', '🥈', '🥉'];

// Renders the ranked list of players ("palmarès"). `meId` highlights the viewer.
export default function Leaderboard({ players, meId, title = 'Palmarès' }) {
  return (
    <div className="leaderboard">
      <h3 className="leaderboard__title">{title}</h3>
      <ol className="leaderboard__list">
        {players.length === 0 && (
          <li className="leaderboard__empty">Aucun joueur pour l'instant.</li>
        )}
        {players.map((p, i) => (
          <li
            key={p.id}
            className={`leaderboard__row${p.id === meId ? ' leaderboard__row--me' : ''}`}
          >
            <span className="leaderboard__rank">{MEDALS[i] || i + 1}</span>
            <span className="leaderboard__name">{p.name}</span>
            <span className="leaderboard__points">{p.points || 0}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
