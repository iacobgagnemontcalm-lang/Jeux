import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  startSession,
  setDifficulty,
  setMode,
  addBot,
  removeBot,
  toPlayerList,
} from './session.js';
import {
  DIFFICULTIES,
  DIFFICULTY_KEYS,
  DEFAULT_DIFFICULTY,
  MODES,
  MODE_KEYS,
  DEFAULT_MODE,
  BOTS,
  BOT_KEYS,
  NAME_BONUS,
} from './constants.js';

export default function Lobby({ pin, session, playerId }) {
  const [busy, setBusy] = useState(false);
  const isHost = session.hostId === playerId;
  const players = toPlayerList(session);
  const difficulty = session.difficulty || DEFAULT_DIFFICULTY;
  const mode = session.mode || DEFAULT_MODE;
  const maxPlayers = MODES[mode].maxPlayers;
  const tooMany = players.length > maxPlayers;

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
        <h2>Mode de jeu</h2>
        <div className="stw-diff-grid">
          {MODE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`stw-diff-btn${mode === key ? ' is-active' : ''}`}
              disabled={!isHost}
              onClick={() => setMode(pin, key)}
            >
              <span className="stw-diff-btn__label">{MODES[key].label}</span>
              <span className="stw-diff-btn__hint">
                {MODES[key].hint} · max {MODES[key].maxPlayers} joueurs
              </span>
            </button>
          ))}
        </div>
      </section>

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
          <p className="muted stw-diff-hint">
            Seul l'hôte choisit le mode et la difficulté.
          </p>
        )}
      </section>

      <h2>Joueurs ({players.length}/{maxPlayers})</h2>
      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id} className={p.id === playerId ? 'is-me' : ''}>
            {p.name}
            {p.id === session.hostId && <span className="tag">Hôte</span>}
            {p.bot && <span className="tag stw-tag-bot">Bot</span>}
            {isHost && p.bot && (
              <button
                type="button"
                className="stw-bot-remove"
                onClick={() => removeBot(pin, p.id)}
                aria-label="Retirer le bot"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {isHost && (
        <div className="stw-add-bots">
          <span className="muted stw-diff-hint">Ajouter un bot :</span>
          <div className="stw-bot-btns">
            {BOT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="btn stw-bot-add"
                disabled={players.length >= maxPlayers}
                onClick={() => addBot(pin, key)}
              >
                {BOTS[key].emoji} {BOTS[key].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tooMany && (
        <p className="error-text">
          Maximum {maxPlayers} joueurs en mode {MODES[mode].label} — changez de
          mode ou retirez des joueurs.
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
