import { useEffect, useState } from 'react';
import Wheel from './Wheel.jsx';
import Scoreboard from './Scoreboard.jsx';
import {
  spinScore,
  openVote,
  castVote,
  resolveVote,
  submitResult,
  revealPodium,
  nextChallenge,
  toPlayerList,
} from './session.js';
import {
  TOTAL_CHALLENGES,
  SCORE_BASES,
  SCORE_COLORS,
  SPIN_MS,
  challengeById,
  pointLadder,
  pointsForRank,
  rankResults,
} from './constants.js';

const OPTION_RANDOM = 'random';

export default function Game({ pin, session, playerId }) {
  const isHost = session.hostId === playerId;
  const phase = session.round?.phase || 'spin';
  const index = session.challengeIndex || 0;

  return (
    <div className="screen cmb-game">
      <div className="cmb-topbar">
        <span className="cmb-topbar__challenge">
          Défi {index + 1} / {TOTAL_CHALLENGES}
        </span>
        <span className="cmb-topbar__pin">PIN {pin}</span>
      </div>

      <Scoreboard session={session} me={playerId} />

      {phase === 'spin' && (
        <SpinPhase pin={pin} session={session} isHost={isHost} />
      )}
      {phase === 'vote' && (
        <VotePhase pin={pin} session={session} playerId={playerId} isHost={isHost} />
      )}
      {phase === 'enter' && (
        <EnterPhase pin={pin} session={session} playerId={playerId} isHost={isHost} />
      )}
      {phase === 'podium' && (
        <PodiumPhase pin={pin} session={session} isHost={isHost} />
      )}
    </div>
  );
}

// --- Phase 1: the scoring wheel ---
function SpinPhase({ pin, session, isHost }) {
  const spin = session.round?.scoreSpin || null;
  const base = session.round?.scoreBase || null;
  const players = toPlayerList(session);
  const [settled, setSettled] = useState(false);

  // Re-arm the "settled" gate on every new spin.
  useEffect(() => {
    if (!spin) {
      setSettled(false);
      return;
    }
    if (Date.now() - (spin.at || 0) >= SPIN_MS) setSettled(true);
  }, [spin?.nonce]);

  const items = SCORE_BASES.map((b) => ({
    key: String(b),
    label: String(b),
    color: SCORE_COLORS[b],
  }));
  const targetIndex = spin ? spin.target : null;

  return (
    <section className="cmb-phase">
      <h2>Roue des points</h2>
      <p className="muted cmb-hint">
        La roue décide combien vaut la 1ʳᵉ place. Chaque place suivante vaut 2
        points de moins.
      </p>

      <Wheel items={items} spin={spin} targetIndex={targetIndex} onSettled={() => setSettled(true)} icon="🎯" />

      {spin && settled && base && (
        <div className="cmb-result-card">
          <span className="cmb-result-card__big">{base} pts</span>
          <span className="cmb-result-card__sub">pour la 1ʳᵉ place</span>
          <div className="cmb-ladder">
            {pointLadder(base, players.length).map((p, i) => (
              <span key={i} className="cmb-ladder__step">
                <b>#{i + 1}</b> {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {isHost ? (
        !spin ? (
          <button type="button" className="btn btn--primary btn--big" onClick={() => spinScore(pin)}>
            Tourner la roue 🎡
          </button>
        ) : settled ? (
          <button
            type="button"
            className="btn btn--primary btn--big"
            onClick={() => openVote(pin, session)}
          >
            Continuer → vote
          </button>
        ) : (
          <p className="muted waiting">La roue tourne…</p>
        )
      ) : (
        <p className="muted waiting">
          {spin ? 'La roue tourne…' : "L'hôte va tourner la roue…"}
        </p>
      )}
    </section>
  );
}

// --- Phase 2: vote for the challenge ---
function VotePhase({ pin, session, playerId, isHost }) {
  const base = session.round?.scoreBase || 0;
  const options = session.round?.options || [];
  const votes = session.round?.votes || {};
  const myVote = votes[playerId];
  const players = toPlayerList(session);

  const counts = options.map((_, i) =>
    Object.values(votes).filter((v) => v === i).length,
  );
  const totalVotes = Object.keys(votes).length;

  const optionMeta = (opt) => {
    if (opt === OPTION_RANDOM) {
      return { emoji: '🎲', label: 'Aléatoire', sub: 'Un défi surprise' };
    }
    const c = challengeById(opt);
    return { emoji: c?.emoji || '❓', label: c?.label || opt, sub: c?.unit || '' };
  };

  return (
    <section className="cmb-phase">
      <h2>Quel défi ?</h2>
      <p className="muted cmb-hint">
        Cette manche : <b>{base} pts</b> pour la 1ʳᵉ place. Votez pour l'épreuve.
      </p>

      <div className="cmb-options">
        {options.map((opt, i) => {
          const m = optionMeta(opt);
          return (
            <button
              key={`${opt}-${i}`}
              type="button"
              className={`cmb-option${myVote === i ? ' is-mine' : ''}`}
              onClick={() => castVote(pin, playerId, i)}
            >
              <span className="cmb-option__emoji">{m.emoji}</span>
              <span className="cmb-option__label">{m.label}</span>
              <span className="cmb-option__sub">{m.sub}</span>
              <span className="cmb-option__count">{counts[i]} vote{counts[i] > 1 ? 's' : ''}</span>
            </button>
          );
        })}
      </div>

      <p className="muted cmb-hint">
        {totalVotes} / {players.length} ont voté{myVote == null ? ' — à vous !' : ''}
      </p>

      {isHost ? (
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => resolveVote(pin, session)}
        >
          Révéler le choix
        </button>
      ) : (
        <p className="muted waiting">L'hôte révélera le défi choisi…</p>
      )}
    </section>
  );
}

// --- Phase 3: enter the real-life results ---
function ResultInput({ challenge, name, stored, onSave, big }) {
  const [value, setValue] = useState(stored != null ? String(stored) : '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(stored != null ? String(stored) : '');
    setSaved(false);
  }, [stored]);

  const save = () => {
    const num = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(num)) return;
    onSave(num);
    setSaved(true);
  };

  return (
    <div className={`cmb-entry${big ? ' cmb-entry--big' : ''}`}>
      <span className="cmb-entry__name">{name}</span>
      <input
        type="number"
        inputMode="decimal"
        step={challenge?.step || 1}
        value={value}
        placeholder={challenge?.short || ''}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
      />
      <button type="button" className="btn cmb-entry__save" onClick={save}>
        {saved || (stored != null && String(stored) === value.replace(',', '.')) ? '✓' : 'OK'}
      </button>
    </div>
  );
}

function EnterPhase({ pin, session, playerId, isHost }) {
  const challenge = challengeById(session.round?.challengeId);
  const base = session.round?.scoreBase || 0;
  const results = session.round?.results || {};
  const players = toPlayerList(session);
  const me = players.find((p) => p.id === playerId);
  const entered = players.filter((p) => typeof results[p.id] === 'number').length;

  return (
    <section className="cmb-phase">
      <div className="cmb-challenge-head">
        <span className="cmb-challenge-head__emoji">{challenge?.emoji}</span>
        <div>
          <h2>{challenge?.label}</h2>
          <p className="muted">
            Résultat en {challenge?.unit} · {base} pts pour la 1ʳᵉ place ·{' '}
            {challenge?.direction === 'low' ? 'le plus petit gagne' : 'le plus grand gagne'}
          </p>
        </div>
      </div>

      {me && (
        <ResultInput
          challenge={challenge}
          name={`Votre résultat (${me.name})`}
          stored={results[playerId]}
          onSave={(v) => submitResult(pin, playerId, v)}
          big
        />
      )}

      <p className="muted cmb-hint">{entered} / {players.length} résultats entrés</p>

      {isHost && (
        <details className="cmb-host-panel" open>
          <summary>Entrer / corriger pour tout le monde</summary>
          <div className="cmb-entry-list">
            {players.map((p) => (
              <ResultInput
                key={p.id}
                challenge={challenge}
                name={p.name}
                stored={results[p.id]}
                onSave={(v) => submitResult(pin, p.id, v)}
              />
            ))}
          </div>
        </details>
      )}

      {isHost ? (
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={entered === 0}
          onClick={() => revealPodium(pin, session)}
        >
          Calculer le classement
        </button>
      ) : (
        <p className="muted waiting">L'hôte calculera le classement quand tout le monde aura entré…</p>
      )}
    </section>
  );
}

// --- Phase 4: the podium for this challenge ---
function PodiumPhase({ pin, session, isHost }) {
  const challenge = challengeById(session.round?.challengeId);
  const results = session.round?.results || {};
  const points = session.round?.points || {};
  const base = session.round?.scoreBase || 0;
  const players = session.players || {};
  const ranked = rankResults(challenge, results);
  const index = session.challengeIndex || 0;
  const isLast = index + 1 >= TOTAL_CHALLENGES;

  return (
    <section className="cmb-phase">
      <div className="cmb-challenge-head">
        <span className="cmb-challenge-head__emoji">{challenge?.emoji}</span>
        <div>
          <h2>Podium — {challenge?.label}</h2>
          <p className="muted">{base} pts pour la 1ʳᵉ place</p>
        </div>
      </div>

      <ol className="cmb-podium">
        {ranked.map((r) => (
          <li key={r.playerId} className={`cmb-podium__row cmb-pos--${r.rank}`}>
            <span className={`cmb-pos cmb-pos--${r.rank}`}>#{r.rank}</span>
            <span className="cmb-podium__name">{players[r.playerId]?.name || r.playerId}</span>
            <span className="cmb-podium__raw">
              {r.value} {challenge?.short}
            </span>
            <span className="cmb-podium__pts">+{points[r.playerId] ?? pointsForRank(base, r.rank)} pts</span>
          </li>
        ))}
      </ol>

      {isHost ? (
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => nextChallenge(pin, session)}
        >
          {isLast ? 'Voir le classement final 🏆' : 'Défi suivant →'}
        </button>
      ) : (
        <p className="muted waiting">
          {isLast ? "En attente du classement final…" : "En attente du défi suivant…"}
        </p>
      )}
    </section>
  );
}
