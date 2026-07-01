import { useNavigate } from 'react-router-dom';
import { GAMES } from '../games/index.js';

export default function GameSelect() {
  const navigate = useNavigate();

  return (
    <div className="screen game-select">
      <header className="hub-header">
        <h1>JEUX</h1>
        <p className="subtitle">Choisissez un jeu</p>
      </header>

      <div className="game-grid">
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            className="game-button"
            style={{ '--accent': game.accent }}
            disabled={!game.enabled}
            onClick={() => game.enabled && navigate(game.path)}
          >
            <span className="game-button__emoji">{game.emoji}</span>
            <span className="game-button__body">
              <span className="game-button__name">{game.name}</span>
              <span className="game-button__desc">{game.description}</span>
            </span>
            {!game.enabled && <span className="game-button__badge">Bientôt</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
