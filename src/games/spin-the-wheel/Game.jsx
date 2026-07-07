import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { writeSpin, commitPick, toPlayerList, deriveTurn } from './session.js';
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  SLOTS,
  SLOT_POSITIONS,
  NAME_BONUS,
  SPIN_MS,
  BOTS,
  nameBonus,
  openSlots,
} from './constants.js';
import { TEAMS, remainingTeams } from './teams.js';
import { fetchRosters, eligiblePlayers } from './sleeper.js';
import { bestMatch } from './match.js';
import { botChoose } from './bot.js';
import Wheel from './Wheel.jsx';

function TeamChip({ abbr }) {
  const team = TEAMS[abbr];
  if (!team) return null;
  return (
    <span className="stw-team-chip" style={{ '--team': team.color }}>
      {abbr}
    </span>
  );
}

// Everyone's roster progress, in turn order.
function RosterBoard({ players, currentUid, meId }) {
  return (
    <div className="stw-rosters">
      {players.map((p) => (
        <div
          key={p.id}
          className={
            'stw-roster-card' +
            (p.id === currentUid ? ' is-current' : '') +
            (p.id === meId ? ' is-me' : '')
          }
        >
          <div className="stw-roster-card__name">
            {p.id === currentUid && <span className="stw-turn-dot" />}
            {p.name}
          </div>
          <ul className="stw-roster-card__slots">
            {SLOTS.map((slot) => {
              const pick = p.roster?.[slot];
              return (
                <li key={slot} className={pick ? 'is-filled' : ''}>
                  <span className="stw-slot-label">{slot}</span>
                  {pick ? (
                    <span className="stw-slot-pick">
                      <TeamChip abbr={pick.team} />
                      {pick.name}
                      {pick.bonus && <span className="stw-bonus">×{nameBonus(slot)}</span>}
                    </span>
                  ) : (
                    <span className="stw-slot-empty">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function Game({ pin, session, playerId }) {
  const players = toPlayerList(session);
  const { n, solo, turnIndex, round, picksInRound, spinnerUid, currentUid } =
    deriveTurn(session);
  const spinnerPlayer = session.players?.[spinnerUid];
  const currentPlayer = session.players?.[currentUid];
  const isSpinner = spinnerUid === playerId;
  const isMyPick = currentUid === playerId;
  const currentIsBot = Boolean(currentPlayer?.bot);
  const isHost = session.hostId === playerId;
  const me = session.players?.[playerId];
  const difficulty =
    DIFFICULTIES[session.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
  const spin = session.spin || null;
  const remaining = remainingTeams(session.usedTeams);

  // NFL players already off-limits for this pick. A player can be drafted only
  // once ever, so in solo mode nobody on the spun team may already be owned; in
  // shared mode teams never repeat, so any roster entry on the spun team was
  // taken earlier this same round. Kickers and defenses are exempt — a team
  // carries a single DEF and usually one K, so those can be drafted by
  // several players.
  const takenIds = new Set();
  if (spin) {
    players.forEach((p) =>
      Object.values(p.roster || {}).forEach((pk) => {
        if (pk.team === spin.team && pk.pos !== 'K' && pk.pos !== 'DEF') {
          takenIds.add(pk.id);
        }
      }),
    );
  }

  // --- NFL rosters (Sleeper), needed for the pick lists & name matching ---
  const [rosters, setRosters] = useState(null);
  const [rosterError, setRosterError] = useState(false);
  const [rosterTry, setRosterTry] = useState(0);
  useEffect(() => {
    let alive = true;
    setRosterError(false);
    fetchRosters()
      .then((r) => alive && setRosters(r))
      .catch(() => alive && setRosterError(true));
    return () => {
      alive = false;
    };
  }, [rosterTry]);

  // --- Spin / pick local state ---
  const [settledNonce, setSettledNonce] = useState(null);
  const [busy, setBusy] = useState(false);
  const [slot, setSlot] = useState(null);
  const [mode, setMode] = useState(null); // null | 'guess' | 'list'
  const [guess, setGuess] = useState('');
  const [guessFailed, setGuessFailed] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [guessDeadline, setGuessDeadline] = useState(null);
  const [timeLeftMs, setTimeLeftMs] = useState(null);

  // New spin (or new turn): reset the pick panel.
  useEffect(() => {
    setSlot(null);
    setMode(null);
    setGuess('');
    setGuessFailed(false);
    setFeedback(null);
    setGuessDeadline(null);
    setTimeLeftMs(null);
  }, [spin?.nonce, turnIndex]);

  const settled = Boolean(spin) && settledNonce === spin.nonce;
  const myPickPhase = isMyPick && spin && settled;
  const myOpenSlots = openSlots(me);
  const positions = slot ? SLOT_POSITIONS[slot] : [];
  // Players already drafted this round are off the menu — and off the
  // name-guess pool (they're kept aside for a clearer "déjà pris" message).
  const allEligible =
    myPickPhase && slot && rosters
      ? eligiblePlayers(rosters, spin.team, positions)
      : [];
  const candidates = allEligible.filter((c) => !takenIds.has(c.id));
  const takenCandidates = allEligible.filter((c) => takenIds.has(c.id));

  // Expert shot clock: the countdown starts the moment the pick phase opens
  // (wheel settled on your turn, rosters ready) — choosing a slot eats into
  // the same 10 seconds and switching slots does not re-arm it. Running out
  // of time forfeits the guess to the list (no bonus).
  const guessTimerMs = difficulty.guessTimerMs || 0;
  const guessOpen = myPickPhase && Boolean(rosters) && !guessFailed;
  useEffect(() => {
    if (!guessTimerMs || !guessOpen || guessDeadline) return;
    setGuessDeadline(Date.now() + guessTimerMs);
    setTimeLeftMs(guessTimerMs);
  }, [guessTimerMs, guessOpen, guessDeadline]);

  // Tick the clock; paused while a pick is committing (busy) so a guess
  // submitted at the buzzer isn't clobbered by the timeout.
  useEffect(() => {
    if (!guessDeadline || guessFailed || busy) return undefined;
    const id = setInterval(() => {
      const left = guessDeadline - Date.now();
      if (left > 0) {
        setTimeLeftMs(left);
        return;
      }
      setTimeLeftMs(0);
      setGuessFailed(true);
      setMode('list');
      setFeedback({
        type: 'err',
        text: '⏱ Temps écoulé ! Choisissez dans la liste (sans bonus).',
      });
    }, 100);
    return () => clearInterval(id);
  }, [guessDeadline, guessFailed, busy]);

  const handleSpin = async () => {
    if (busy || !remaining.length) return;
    setBusy(true);
    try {
      const team = remaining[Math.floor(Math.random() * remaining.length)];
      await writeSpin(pin, playerId, team);
    } finally {
      setBusy(false);
    }
  };

  const pick = async (player, bonus) => {
    if (busy) return;
    setBusy(true);
    try {
      await commitPick(pin, playerId, session, {
        slot,
        player,
        team: spin.team,
        bonus,
      });
    } catch {
      setFeedback({ type: 'err', text: 'Erreur — réessayez.' });
    } finally {
      setBusy(false);
    }
  };

  const handleGuess = async (e) => {
    e.preventDefault();
    if (!guess.trim() || busy) return;
    const m = bestMatch(guess, candidates, difficulty.threshold);
    if (m) {
      setFeedback({
        type: 'ok',
        text: `🎯 ${m.player.name} — bonus ×${nameBonus(slot)} !`,
      });
      await pick(m.player, true);
    } else {
      const taken = bestMatch(guess, takenCandidates, difficulty.threshold);
      setGuessFailed(true);
      setMode('list');
      setFeedback({
        type: 'err',
        text: taken
          ? `${taken.player.name} est déjà pris ! Choisissez dans la liste (sans bonus).`
          : 'Raté ! Choisissez dans la liste (sans bonus).',
      });
    }
  };

  // --- Host drives the bots ---
  // Bots have no client of their own, so the host's device spins and picks for
  // whichever bot is on the clock. Actions are keyed by turn+nonce so each
  // fires once; short delays keep it feeling human and let the wheel animate.
  const botActRef = useRef('');
  useEffect(() => {
    if (!isHost || !rosters || !currentIsBot || session.status !== 'playing') {
      return undefined;
    }
    const level = currentPlayer.bot;

    // Bot needs to spin first (it's the spinner and the wheel is idle).
    if (!spin) {
      if (spinnerUid !== currentUid || !remaining.length) return undefined;
      const sig = `spin:${turnIndex}`;
      if (botActRef.current === sig) return undefined;
      const t = setTimeout(() => {
        botActRef.current = sig;
        const team = remaining[Math.floor(Math.random() * remaining.length)];
        writeSpin(pin, currentUid, team).catch(() => {});
      }, 800);
      return () => clearTimeout(t);
    }

    // Wheel has settled: make the bot's pick.
    if (!settled) return undefined;
    const sig = `pick:${turnIndex}:${spin.nonce}`;
    if (botActRef.current === sig) return undefined;
    const t = setTimeout(() => {
      botActRef.current = sig;
      botChoose(level, openSlots(currentPlayer), rosters, spin.team, takenIds)
        .then((choice) => {
          if (!choice) return undefined; // no legal pick (extremely rare); wait it out
          // Bots "name" their pick from memory at their level's rate, earning
          // the ×NAME_BONUS exactly like a human who types the name right.
          const bonus = Math.random() < (BOTS[level]?.nameRate ?? 0);
          return commitPick(pin, currentUid, session, {
            slot: choice.slot,
            player: choice.player,
            team: spin.team,
            bonus,
          });
        })
        .catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [
    isHost,
    rosters,
    currentIsBot,
    currentUid,
    spinnerUid,
    spin?.nonce,
    settled,
    turnIndex,
    session.status,
  ]);

  // --- Status line ---
  const roundLabel = `Ronde ${Math.min(round + 1, SLOTS.length)}/${SLOTS.length}`;
  let statusText;
  if (!spin) {
    statusText = isSpinner
      ? 'À vous de jouer ! Faites tourner la roue.'
      : `${spinnerPlayer?.name || '…'} fait tourner la roue…`;
  } else if (!settled) {
    statusText = 'La roue tourne…';
  } else {
    const teamName = TEAMS[spin.team]?.name || spin.team;
    const counter = solo ? '' : ` (${picksInRound + 1}/${n})`;
    statusText = isMyPick
      ? `${teamName} — à vous de choisir !${counter}`
      : `${teamName} — ${currentPlayer?.name || '…'} choisit…${counter}`;
  }

  return (
    <div className="screen stw-game">
      <Link to="/" className="back-link">← Jeux</Link>

      <div className="stw-topbar">
        <span className="stw-topbar__turn">{statusText}</span>
        <span className="stw-topbar__diff">
          {roundLabel} · {difficulty.label} · bonus ×{NAME_BONUS}
        </span>
      </div>

      <Wheel
        teams={remaining}
        spin={spin}
        onSettled={(s) => setSettledNonce(s.nonce)}
      />

      {isSpinner && !spin && (
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={busy || !remaining.length}
          onClick={handleSpin}
        >
          🎡 Tourner la roue
        </button>
      )}

      {myPickPhase && (
        <div className="stw-pick">
          <div className="stw-pick__team">
            <TeamChip abbr={spin.team} />
            <strong>{TEAMS[spin.team]?.name}</strong>
            {guessTimerMs > 0 && !guessFailed && timeLeftMs != null && (
              <span
                className={`stw-timer${timeLeftMs <= 3000 ? ' is-low' : ''}`}
              >
                ⏱ {Math.ceil(timeLeftMs / 1000)} s
              </span>
            )}
          </div>

          <h3>1. Choisissez la case à remplir</h3>
          <div className="stw-slot-grid">
            {myOpenSlots.map((s) => (
              <button
                key={s}
                type="button"
                className={`stw-slot-btn${slot === s ? ' is-active' : ''}`}
                onClick={() => {
                  setSlot(s);
                  if (!guessFailed) setMode(null);
                  setFeedback(null);
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {!slot && feedback && (
            <p className={`feedback feedback--${feedback.type}`}>
              {feedback.text}
            </p>
          )}

          {slot && rosterError && (
            <p className="error-text">
              Impossible de charger les effectifs NFL.{' '}
              <button
                type="button"
                className="btn"
                onClick={() => setRosterTry((n) => n + 1)}
              >
                Réessayer
              </button>
            </p>
          )}
          {slot && !rosters && !rosterError && (
            <p className="muted">Chargement des effectifs NFL…</p>
          )}

          {slot && rosters && (
            <>
              <h3>2. Nommez un joueur ({positions.join(' / ')})</h3>
              {difficulty.noDelete && !guessFailed && (
                <p className="muted stw-diff-hint">
                  Mode Expert : chaque lettre est définitive — impossible
                  d'effacer.
                </p>
              )}
              {!guessFailed && (
                <form className="stw-guess" onSubmit={handleGuess}>
                  <input
                    className="stw-guess__input"
                    type="text"
                    autoComplete="off"
                    placeholder={`Nom du joueur (bonus ×${nameBonus(slot)})`}
                    value={guess}
                    onChange={(e) => {
                      const v = e.target.value;
                      // Expert: characters are final — refuse any edit that
                      // erases or rewrites what's already typed.
                      if (difficulty.noDelete && !v.startsWith(guess)) return;
                      setGuess(v);
                    }}
                    onKeyDown={(e) => {
                      if (
                        difficulty.noDelete &&
                        (e.key === 'Backspace' || e.key === 'Delete')
                      ) {
                        e.preventDefault();
                      }
                    }}
                    onFocus={() => setMode('guess')}
                  />
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={busy || !guess.trim()}
                  >
                    🎯
                  </button>
                </form>
              )}
              {mode !== 'list' && !guessFailed && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setMode('list')}
                >
                  📋 Voir la liste (sans bonus)
                </button>
              )}
              {feedback && (
                <p className={`feedback feedback--${feedback.type}`}>
                  {feedback.text}
                </p>
              )}
              {mode === 'list' && (
                <ul className="stw-candidates">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="stw-candidate"
                        disabled={busy}
                        onClick={() => pick(c, false)}
                      >
                        <span className="stw-candidate__pos">{c.pos}</span>
                        {c.name}
                      </button>
                    </li>
                  ))}
                  {candidates.length === 0 && (
                    <li className="muted">
                      {takenCandidates.length
                        ? 'Tous les joueurs à ce poste sont déjà pris — choisissez une autre case.'
                        : 'Aucun joueur trouvé à ce poste.'}
                    </li>
                  )}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <section className="game__section">
        <h3>Alignements</h3>
        <RosterBoard players={players} currentUid={currentUid} meId={playerId} />
      </section>
    </div>
  );
}
