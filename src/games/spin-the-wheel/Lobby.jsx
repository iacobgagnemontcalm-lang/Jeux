import { useState } from 'react';
import { Link } from 'react-router-dom';
import { startSession, setDifficulty, toPlayerList } from './session.js';
import {
  DIFFICULTIES,
  DIFFICULTY_KEYS,
  DEFAULT_DIFFICULTY,
  MAX_PLAYERS,
  NAME_BONUS,
} from './constants.js';

export default function Lobby({ pin, session, playerId }) {
  const [busy, setBusy] = useState(false);
  const isHost = session.hostId === playerId;
  const players = toPlayerList(session);
  const difficulty = session.difficulty || DEFAULT_DIFFICULTY;
  const tooMany = players.length > MAX_PLAYERS;

  const handleStart = async () => {
    setBusy(true);
    try {
      await startSession(pin, players.map((p) => p.id));
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

      <section>
        <h2>Difficulté</h2>
        <p className="muted stw-diff-hint">
          Précision du nom exigée pour le bonus ×{NAME_BONUS} quand on nomme un
          joueur de mémoire.
        </p>
        <div className="stw-diff-grid">
          {DIFFICULTY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`stw-diff-btn${difficulty === key ? ' is-active' : ''}`}
              disabled={!isHost}
              onClick={() => setDifficulty(pin, key)}
            >
              <span className="stw-diff-btn__label">{DIFFICULTIES[key].label}</span>
              <span className="stw-diff-btn__hint">{DIFFICULTIES[key].hint}</span>
            </button>
          ))}
        </div>
        {!isHost && (
          <p className="muted stw-diff-hint">Seul l'hôte choisit la difficulté.</p>
        )}
      </section>

      <h2>Joueurs ({players.length}/{MAX_PLAYERS})</h2>
      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id} className={p.id === playerId ? 'is-me' : ''}>
            {p.name}
            {p.id === session.hostId && <span className="tag">Hôte</span>}
          </li>
        ))}
      </ul>

      {tooMany && (
        <p className="error-text">
          Maximum {MAX_PLAYERS} joueurs (chaque ronde, tout le monde pige
          dans la même équipe).
        </p>
      )}

      {isHost ? (
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={busy || players.length === 0 || tooMany}
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
