import { useState } from 'react';
import { Link } from 'react-router-dom';
import { startSession, toPlayerList } from './session.js';
import { CHALLENGES, MAX_PLAYERS, SCORE_BASES } from './constants.js';

export default function Lobby({ pin, session, playerId }) {
  const [busy, setBusy] = useState(false);
  const isHost = session.hostId === playerId;
  const players = toPlayerList(session);
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
        <h2>Les 8 défis</h2>
        <ul className="cmb-challenge-list">
          {CHALLENGES.map((c) => (
            <li key={c.id}>
              <span className="cmb-challenge__emoji">{c.emoji}</span>
              <span className="cmb-challenge__label">{c.label}</span>
              <span className="cmb-challenge__unit">{c.unit}</span>
            </li>
          ))}
        </ul>
        <p className="muted cmb-hint">
          Avant chaque défi, la roue tire {SCORE_BASES.join(', ')} pour la 1ʳᵉ
          place, puis −2 par place. Deux défis au hasard (+ Aléatoire) sont
          proposés au vote.
        </p>
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
          Maximum {MAX_PLAYERS} joueurs — retirez des joueurs pour démarrer.
        </p>
      )}

      {isHost ? (
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={busy || players.length === 0 || tooMany}
          onClick={handleStart}
        >
          Démarrer ▶
        </button>
      ) : (
        <p className="muted waiting">En attente du démarrage par l'hôte…</p>
      )}
    </div>
  );
}
