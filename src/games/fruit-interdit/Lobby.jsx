import { useState } from 'react';
import { Link } from 'react-router-dom';
import { startSession, toLeaderboard } from './session.js';
import { DURATION_SEC } from './constants.js';

export default function Lobby({ pin, session, playerId }) {
  const [busy, setBusy] = useState(false);
  const isHost = session.hostId === playerId;
  const players = toLeaderboard(session.players).sort((a, b) =>
    (a.joinedAt || 0) - (b.joinedAt || 0),
  );

  const handleStart = async () => {
    setBusy(true);
    try {
      await startSession(pin);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen lobby">
      <Link to="/" className="back-link">← Jeux</Link>

      <div className="pin-badge">
        <span className="pin-badge__label">PIN de la session</span>
        <span className="pin-badge__value">{pin}</span>
        <span className="pin-badge__hint">Partagez-le pour que d'autres rejoignent</span>
      </div>

      <h2>Joueurs ({players.length})</h2>
      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id} className={p.id === playerId ? 'is-me' : ''}>
            {p.name}
            {p.id === session.hostId && <span className="tag">Hôte</span>}
          </li>
        ))}
      </ul>

      <p className="muted">Durée de la partie : {Math.round(DURATION_SEC / 60)} min</p>

      {isHost ? (
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={busy || players.length === 0}
          onClick={handleStart}
        >
          Jouer ▶
        </button>
      ) : (
        <p className="muted waiting">En attente du démarrage par l'hôte…</p>
      )}
    </div>
  );
}
