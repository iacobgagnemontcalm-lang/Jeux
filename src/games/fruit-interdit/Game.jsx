import { useState, useCallback, useRef } from 'react';
import { submitCode, endSession, toLeaderboard } from './session.js';
import { FRUITS } from './constants.js';
import Timer from '../../components/Timer.jsx';
import Leaderboard from '../../components/Leaderboard.jsx';
import FruitCounts from '../../components/FruitCounts.jsx';

const REASON_TEXT = {
  invalid: 'Code invalide.',
  used: 'Code déjà utilisé.',
  'not-playing': 'La partie n’est pas active.',
  'time-up': 'Temps écoulé !',
  'no-session': 'Session introuvable.',
};

export default function Game({ pin, session, playerId }) {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);
  const endingRef = useRef(false);

  const me = session.players?.[playerId] || { points: 0, fruitCounts: {} };
  const leaderboard = toLeaderboard(session.players);

  const handleExpire = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    // Any client can flip the session to ended; it's idempotent.
    try {
      await endSession(pin);
    } catch {
      /* ignore */
    }
  }, [pin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = code.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const res = await submitCode(pin, playerId, value);
      if (res.ok) {
        const fruit = FRUITS[res.fruit];
        setFeedback({
          type: 'ok',
          text:
            `${fruit.emoji} ${fruit.label} +${res.awarded}` +
            (res.multiplier > 1 ? ` (combo ×${res.multiplier}!)` : ''),
        });
        setCode('');
      } else {
        setFeedback({ type: 'err', text: REASON_TEXT[res.reason] || 'Erreur.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen game">
      <div className="game__topbar">
        <Timer endsAt={session.endsAt} onExpire={handleExpire} />
        <div className="game__score">
          <span className="game__score-label">Vos points</span>
          <span className="game__score-value">{me.points || 0}</span>
        </div>
      </div>

      <form className="code-form" onSubmit={handleSubmit}>
        <input
          className="code-input"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          value={code}
          placeholder="Entrer un code (ex : MAN7)"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Valider
        </button>
      </form>

      {feedback && (
        <p className={`feedback feedback--${feedback.type}`}>{feedback.text}</p>
      )}

      <section className="game__section">
        <h3>Vos fruits</h3>
        <FruitCounts counts={me.fruitCounts} />
      </section>

      <section className="game__section">
        <Leaderboard players={leaderboard} meId={playerId} />
      </section>
    </div>
  );
}
