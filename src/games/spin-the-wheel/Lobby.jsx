import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  startSession,
  setDifficulty,
  setMode,
  setEra,
  setYearRange,
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
  ERAS,
  ERA_KEYS,
  DEFAULT_ERA,
  MIN_HISTORY_SEASON,
  lastCompletedSeason,
  historyRange,
  BOTS,
  BOT_KEYS,
  NAME_BONUS,
  nameBonus,
} from './constants.js';
import { useBestScores, bestFor } from './records.js';

export default function Lobby({ pin, session, playerId }) {
  const [busy, setBusy] = useState(false);
  const isHost = session.hostId === playerId;
  const players = toPlayerList(session);
  const difficulty = session.difficulty || DEFAULT_DIFFICULTY;
  const mode = session.mode || DEFAULT_MODE;
  const era = session.era || DEFAULT_ERA;
  const { from: yearFrom, to: yearTo } = historyRange(session);
  const allYears = [];
  for (let y = MIN_HISTORY_SEASON; y <= lastCompletedSeason(); y += 1) {
    allYears.push(y);
  }
  const bests = useBestScores();
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
        <h2>Époque</h2>
        <div className="stw-diff-grid">
          {ERA_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`stw-diff-btn${era === key ? ' is-active' : ''}`}
              disabled={!isHost}
              onClick={() => setEra(pin, key)}
            >
              <span className="stw-diff-btn__label">{ERAS[key].label}</span>
              <span className="stw-diff-btn__hint">{ERAS[key].hint}</span>
            </button>
          ))}
        </div>
        {era === 'historical' && (
          <>
            <div className="stw-year-range">
              <label>
                De{' '}
                <select
                  value={yearFrom}
                  disabled={!isHost}
                  onChange={(e) =>
                    setYearRange(pin, Number(e.target.value), yearTo)
                  }
                >
                  {allYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label>
                à{' '}
                <select
                  value={yearTo}
                  disabled={!isHost}
                  onChange={(e) =>
                    setYearRange(pin, yearFrom, Number(e.target.value))
                  }
                >
                  {allYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted stw-diff-hint">
              Chaque tour : la roue des années, puis la roue des équipes. Les
              points sont les vrais points fantasy (PPR) de la saison tirée —
              données Sleeper, disponibles depuis {MIN_HISTORY_SEASON}.
            </p>
          </>
        )}
      </section>

      <section>
        <h2>Difficulté</h2>
        <p className="muted stw-diff-hint">
          Précision du nom exigée pour le bonus ×{NAME_BONUS} quand on nomme un
          joueur de mémoire (×{nameBonus('RB1')} sur RB1 et WR1).
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
            {!p.bot && bestFor(bests, p.name) && (
              <span className="stw-best">
                🏅 {bestFor(bests, p.name).score.toFixed(1)} pts
              </span>
            )}
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
