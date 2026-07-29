import { useEffect, useState } from 'react';
import Wheel from './Wheel.jsx';
import Scoreboard from './Scoreboard.jsx';
import {
  spinScore,
  openVote,
  castVote,
  resolveVote,
  setPrediction,
  openEntry,
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
  MAX_PREDICTIONS,
  PREDICTION_BONUS,
  challengeById,
  formatResult,
  ordinalFr,
  pointLadder,
  pointsForRank,
  predictionsLeft,
  rankResults,
  stepForBase,
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
      {phase === 'predict' && (
        <PredictPhase pin={pin} session={session} playerId={playerId} isHost={isHost} />
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
        La roue décide combien vaut la 1ʳᵉ place. Chaque place suivante vaut un
        dixième de ce total en moins : 30 → 27 → 24, 20 → 18 → 16, 12 → 11 → 10.
      </p>

      <Wheel items={items} spin={spin} targetIndex={targetIndex} onSettled={() => setSettled(true)} icon="🎯" />

      {spin && settled && base && (
        <div className="cmb-result-card">
          <span className="cmb-result-card__big">{base} pts</span>
          <span className="cmb-result-card__sub">
            pour la 1ʳᵉ place · −{stepForBase(base)} par place
          </span>
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

// --- Phase 3: call your finishing position (optional, 3 times per Combine) ---
function PredictPhase({ pin, session, playerId, isHost }) {
  const challenge = challengeById(session.round?.challengeId);
  const base = session.round?.scoreBase || 0;
  const predictions = session.round?.predictions || {};
  const players = toPlayerList(session);
  const mine = predictions[playerId];
  const left = predictionsLeft(session, playerId);
  const spent = mine != null ? Math.max(0, left - 1) : left;
  const called = players.filter((p) => typeof predictions[p.id] === 'number').length;

  const choose = (pos) => {
    setPrediction(pin, session, playerId, mine === pos ? null : pos);
  };

  return (
    <section className="cmb-phase">
      <div className="cmb-challenge-head">
        <span className="cmb-challenge-head__emoji">{challenge?.emoji}</span>
        <div>
          <h2>{challenge?.label}</h2>
          <p className="muted">{base} pts pour la 1ʳᵉ place</p>
        </div>
      </div>

      <h3 className="cmb-predict__title">Votre pronostic 🔮</h3>
      <p className="muted cmb-hint">
        Annoncez la place exacte que vous allez terminer. Juste : +
        {PREDICTION_BONUS} pts. Raté : 0 pt. Vous avez droit à{' '}
        {MAX_PREDICTIONS} pronostics pour tout le Combine.
      </p>

      <div className="cmb-predict-grid">
        {players.map((_, i) => {
          const pos = i + 1;
          const isMine = mine === pos;
          return (
            <button
              key={pos}
              type="button"
              className={`cmb-predict__btn${isMine ? ' is-mine' : ''}`}
              disabled={left <= 0 && !isMine}
              onClick={() => choose(pos)}
            >
              {ordinalFr(pos)}
            </button>
          );
        })}
      </div>

      <p className="muted cmb-hint">
        {mine != null ? (
          <>
            Vous annoncez la <b>{ordinalFr(mine)}</b> place — touchez à nouveau
            pour annuler. Il vous restera {spent} pronostic{spent > 1 ? 's' : ''}.
          </>
        ) : left > 0 ? (
          <>
            Aucun pronostic pour ce défi — il vous en reste {left} sur{' '}
            {MAX_PREDICTIONS}.
          </>
        ) : (
          <>Vos {MAX_PREDICTIONS} pronostics sont déjà utilisés.</>
        )}
      </p>

      <p className="muted cmb-hint">
        {called} / {players.length} ont annoncé une place (les choix restent
        secrets jusqu'au podium)
      </p>

      {isHost ? (
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => openEntry(pin)}
        >
          Verrouiller → au défi !
        </button>
      ) : (
        <p className="muted waiting">
          L'hôte verrouillera les pronostics avant le défi…
        </p>
      )}
    </section>
  );
}

// --- Phase 4: enter the real-life results ---
function RankInput({ name, stored, count, onSave, big }) {
  return (
    <div className={`cmb-entry${big ? ' cmb-entry--big' : ''}`}>
      <span className="cmb-entry__name">{name}</span>
      <select
        className="cmb-rank-select"
        value={stored != null ? String(stored) : ''}
        onChange={(e) => {
          const num = parseInt(e.target.value, 10);
          if (Number.isFinite(num)) onSave(num);
        }}
      >
        <option value="" disabled>
          Place…
        </option>
        {Array.from({ length: count }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {ordinalFr(i + 1)}
          </option>
        ))}
      </select>
    </div>
  );
}

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
  const predictions = session.round?.predictions || {};
  const players = toPlayerList(session);
  const me = players.find((p) => p.id === playerId);
  const entered = players.filter((p) => typeof results[p.id] === 'number').length;
  const byRank = challenge?.entry === 'rank';
  const myCall = predictions[playerId];

  const inputFor = (p, big) =>
    byRank ? (
      <RankInput
        key={p.id}
        name={big ? `Votre place (${p.name})` : p.name}
        stored={results[p.id]}
        count={players.length}
        onSave={(v) => submitResult(pin, p.id, v)}
        big={big}
      />
    ) : (
      <ResultInput
        key={p.id}
        challenge={challenge}
        name={big ? `Votre résultat (${p.name})` : p.name}
        stored={results[p.id]}
        onSave={(v) => submitResult(pin, p.id, v)}
        big={big}
      />
    );

  return (
    <section className="cmb-phase">
      <div className="cmb-challenge-head">
        <span className="cmb-challenge-head__emoji">{challenge?.emoji}</span>
        <div>
          <h2>{challenge?.label}</h2>
          <p className="muted">
            {byRank ? (
              <>Entrez votre place au quiz · {base} pts pour la 1ʳᵉ place</>
            ) : (
              <>
                Résultat en {challenge?.unit} · {base} pts pour la 1ʳᵉ place ·{' '}
                {challenge?.direction === 'low'
                  ? 'le plus petit gagne'
                  : 'le plus grand gagne'}
              </>
            )}
          </p>
        </div>
      </div>

      {myCall != null && (
        <p className="cmb-predict-badge">
          🔮 Vous avez annoncé la {ordinalFr(myCall)} place
        </p>
      )}

      {me && inputFor(me, true)}

      <p className="muted cmb-hint">
        {entered} / {players.length} {byRank ? 'places entrées' : 'résultats entrés'}
      </p>

      {isHost && (
        <details className="cmb-host-panel" open>
          <summary>Entrer / corriger pour tout le monde</summary>
          <div className="cmb-entry-list">
            {players.map((p) => inputFor(p, false))}
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

// --- Phase 5: the podium for this challenge ---
function PodiumPhase({ pin, session, isHost }) {
  const challenge = challengeById(session.round?.challengeId);
  const results = session.round?.results || {};
  const points = session.round?.points || {};
  const predictions = session.round?.predictions || {};
  const bonuses = session.round?.bonuses || {};
  const base = session.round?.scoreBase || 0;
  const players = session.players || {};
  const ranked = rankResults(challenge, results);
  const index = session.challengeIndex || 0;
  const isLast = index + 1 >= TOTAL_CHALLENGES;
  const anyCall = ranked.some((r) => predictions[r.playerId] != null);

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
        {ranked.map((r) => {
          const call = predictions[r.playerId];
          const hit = bonuses[r.playerId] > 0;
          return (
            <li key={r.playerId} className={`cmb-podium__row cmb-pos--${r.rank}`}>
              <span className={`cmb-pos cmb-pos--${r.rank}`}>#{r.rank}</span>
              <span className="cmb-podium__name">
                {players[r.playerId]?.name || r.playerId}
                {call != null && (
                  <span className={`cmb-call${hit ? ' is-hit' : ' is-miss'}`}>
                    🔮 {ordinalFr(call)} {hit ? `+${PREDICTION_BONUS}` : '✗'}
                  </span>
                )}
              </span>
              <span className="cmb-podium__raw">{formatResult(challenge, r.value)}</span>
              <span className="cmb-podium__pts">
                +{points[r.playerId] ?? pointsForRank(base, r.rank)} pts
              </span>
            </li>
          );
        })}
      </ol>

      {anyCall && (
        <p className="muted cmb-hint">
          🔮 = pronostic annoncé avant le défi ({PREDICTION_BONUS} pts si la
          place est exacte)
        </p>
      )}

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
