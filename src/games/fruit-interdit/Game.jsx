import { useState, useCallback, useRef, useEffect } from 'react';
import { submitCode, endSession, toLeaderboard } from './session.js';
import {
  FRUITS,
  FRUIT_KEYS,
  SECRET_CODE,
  SECRET_CODE_CATEGORIES,
  SECRET_CODE_REVEAL_SEC,
} from './constants.js';
import Timer from '../../components/Timer.jsx';
import Leaderboard from '../../components/Leaderboard.jsx';
import FruitCounts from '../../components/FruitCounts.jsx';
import Announcement from '../../components/Announcement.jsx';

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

  // Secret code reveal: either this player collected enough different fruit
  // categories, or the timer dropped below the reveal threshold (then
  // everyone sees it).
  const foundEnoughFruits =
    FRUIT_KEYS.filter((key) => (me.fruitCounts || {})[key] > 0).length >=
    SECRET_CODE_CATEGORIES;
  const [timeReveal, setTimeReveal] = useState(
    () =>
      !!session.endsAt &&
      session.endsAt - Date.now() <= SECRET_CODE_REVEAL_SEC * 1000,
  );
  useEffect(() => {
    if (timeReveal || !session.endsAt) return undefined;
    const revealAt = session.endsAt - SECRET_CODE_REVEAL_SEC * 1000;
    const check = () => {
      if (Date.now() >= revealAt) setTimeReveal(true);
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [session.endsAt, timeReveal]);
  const showSecretCode = foundEnoughFruits || timeReveal;

  // Watch every player's node for a broadcast announcement and show new ones.
  const [announce, setAnnounce] = useState(null);
  const seenAnnRef = useRef(null);
  useEffect(() => {
    const anns = Object.values(session.players || {})
      .map((p) => p.announce)
      .filter(Boolean);
    if (seenAnnRef.current === null) seenAnnRef.current = new Set();
    // Ignore stale announcements (from before this device loaded), but still show
    // one from the last ~15s even if the page just opened. Each shows only once.
    const RECENT_MS = 15000;
    anns.forEach((a) => {
      if (Date.now() - a.at > RECENT_MS) seenAnnRef.current.add(a.at);
    });
    const fresh = anns
      .filter((a) => !seenAnnRef.current.has(a.at))
      .sort((x, y) => y.at - x.at);
    if (fresh.length) {
      fresh.forEach((a) => seenAnnRef.current.add(a.at));
      setAnnounce(fresh[0]);
    }
  }, [session.players]);

  useEffect(() => {
    if (!announce) return undefined;
    const t = setTimeout(() => setAnnounce(null), 6000);
    return () => clearTimeout(t);
  }, [announce]);

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
        if (res.kind === 'special') {
          setFeedback({
            type: 'ok',
            text: `${res.announcement.emoji} +${res.awarded}`,
          });
        } else {
          const fruit = FRUITS[res.fruit];
          setFeedback({
            type: 'ok',
            text:
              `${fruit.emoji} ${fruit.label} +${res.awarded}` +
              (res.multiplier > 1 ? ` (combo ×${res.multiplier}!)` : ''),
          });
        }
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
      <Announcement announce={announce} />
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

      {showSecretCode && (
        <div className="secret-code">
          <span className="secret-code__label">
            {foundEnoughFruits
              ? `🏆 ${SECRET_CODE_CATEGORIES} catégories trouvées ! Code secret :`
              : '⏳ Code secret révélé :'}
          </span>
          <span className="secret-code__value">{SECRET_CODE}</span>
        </div>
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
