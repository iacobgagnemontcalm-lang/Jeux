import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { writeSpin, commitPick, toPlayerList, deriveTurn } from './session.js';
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  DEFAULT_ERA,
  SLOTS,
  SLOT_POSITIONS,
  NAME_BONUS,
  SPIN_MS,
  BOTS,
  nameBonus,
  openSlots,
  historyRange,
} from './constants.js';
import { TEAMS, TEAM_KEYS, remainingTeams } from './teams.js';
import { fetchRosters, eligiblePlayers } from './sleeper.js';
import { fetchSeasonRosters, yearColor } from './history.js';
import { bestMatch } from './match.js';
import { botChoose } from './bot.js';
import Wheel from './Wheel.jsx';

const teamItems = (abbrs) =>
  abbrs.map((abbr) => ({ key: abbr, label: abbr, color: TEAMS[abbr].color }));

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
                      {pick.year && (
                        <span className="stw-year-tag">{pick.year}</span>
                      )}
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
  const historical = (session.era || DEFAULT_ERA) === 'historical';
  const { years } = historyRange(session);
  // In historical mode a team-season is the unit, so the full 32-team wheel
  // always shows; the spin itself avoids already-used (year, team) combos.
  const remaining = historical ? TEAM_KEYS : remainingTeams(session.usedTeams);

  // NFL players already off-limits for this pick. A player can be drafted only
  // once ever, so in solo mode nobody on the spun team may already be owned; in
  // shared mode teams never repeat, so any roster entry on the spun team was
  // taken earlier this same round. Kickers and defenses are exempt — a team
  // carries a single DEF and usually one K, so those can be drafted by
  // several players. In historical mode the same id in a DIFFERENT season is a
  // different card, so the year must match too.
  const takenIds = new Set();
  if (spin) {
    players.forEach((p) =>
      Object.values(p.roster || {}).forEach((pk) => {
        if (
          pk.team === spin.team &&
          (pk.year || null) === (spin.year || null) &&
          pk.pos !== 'K' &&
          pk.pos !== 'DEF'
        ) {
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
    if (historical) return undefined; // current-era rosters not needed
    let alive = true;
    setRosterError(false);
    fetchRosters()
      .then((r) => alive && setRosters(r))
      .catch(() => alive && setRosterError(true));
    return () => {
      alive = false;
    };
  }, [rosterTry, historical]);

  // Historical: the spun season's rosters (with real points), fetched per
  // spin — the ~10 s double-wheel animation hides the download.
  const [seasonData, setSeasonData] = useState({ year: null, buckets: null, error: false });
  useEffect(() => {
    if (!historical || !spin?.year) return undefined;
    let alive = true;
    setSeasonData({ year: spin.year, buckets: null, error: false });
    fetchSeasonRosters(spin.year)
      .then(
        (b) =>
          alive && setSeasonData({ year: spin.year, buckets: b, error: false }),
      )
      .catch(
        () =>
          alive && setSeasonData({ year: spin.year, buckets: null, error: true }),
      );
    return () => {
      alive = false;
    };
  }, [historical, spin?.year, rosterTry]);

  // Whichever roster source the era calls for.
  const activeRosters = historical
    ? (spin && seasonData.year === spin.year && seasonData.buckets) || null
    : rosters;
  const activeError = historical ? seasonData.error : rosterError;

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
    myPickPhase && slot && activeRosters
      ? eligiblePlayers(activeRosters, spin.team, positions)
      : [];
  const candidates = allEligible.filter((c) => !takenIds.has(c.id));
  const takenCandidates = allEligible.filter((c) => takenIds.has(c.id));

  // Expert shot clock: the countdown starts the moment the pick phase opens
  // (wheel settled on your turn, rosters ready) — choosing a slot eats into
  // the same 10 seconds and switching slots does not re-arm it. Running out
  // of time forfeits the guess to the list (no bonus).
  const guessTimerMs = difficulty.guessTimerMs || 0;
  const guessOpen = myPickPhase && Boolean(activeRosters) && !guessFailed;
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

  // What the next spin should land on. Current era: a team still on the
  // wheel. Historical: a random year from the range, then a team whose
  // (year, team) combo hasn't been burned yet — if that season is fully
  // used (tiny ranges), another year is tried.
  const spinTarget = () => {
    if (!historical) {
      if (!remaining.length) return null;
      return {
        team: remaining[Math.floor(Math.random() * remaining.length)],
        year: null,
      };
    }
    const shuffled = [...years].sort(() => Math.random() - 0.5);
    for (const year of shuffled) {
      const pool = TEAM_KEYS.filter(
        (abbr) => !session.usedTeams?.[`${year}_${abbr}`],
      );
      if (pool.length) {
        return { team: pool[Math.floor(Math.random() * pool.length)], year };
      }
    }
    return null;
  };

  const handleSpin = async () => {
    if (busy) return;
    const target = spinTarget();
    if (!target) return;
    setBusy(true);
    try {
      await writeSpin(pin, playerId, target.team, target.year);
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
        year: spin.year || null,
        pts: historical ? player.pts ?? 0 : undefined,
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
    if (!isHost || !currentIsBot || session.status !== 'playing') {
      return undefined;
    }
    const level = currentPlayer.bot;

    // Bot needs to spin first (it's the spinner and the wheel is idle).
    // No roster data required for this — historical rosters only load once
    // the year is known anyway.
    if (!spin) {
      if (spinnerUid !== currentUid) return undefined;
      const sig = `spin:${turnIndex}`;
      if (botActRef.current === sig) return undefined;
      const t = setTimeout(() => {
        const target = spinTarget();
        if (!target) return;
        botActRef.current = sig;
        writeSpin(pin, currentUid, target.team, target.year).catch(() => {});
      }, 800);
      return () => clearTimeout(t);
    }

    // Wheel has settled and the rosters are in: make the bot's pick.
    if (!settled || !activeRosters) return undefined;
    const sig = `pick:${turnIndex}:${spin.nonce}`;
    if (botActRef.current === sig) return undefined;
    const t = setTimeout(() => {
      botActRef.current = sig;
      botChoose(level, openSlots(currentPlayer), activeRosters, spin.team, takenIds)
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
            year: spin.year || null,
            pts: historical ? choice.player.pts ?? 0 : undefined,
          });
        })
        .catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [
    isHost,
    activeRosters,
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
    statusText = historical ? 'Les roues tournent…' : 'La roue tourne…';
  } else {
    const teamName = TEAMS[spin.team]?.name || spin.team;
    const spunLabel = spin.year ? `${teamName} ${spin.year}` : teamName;
    const counter = solo ? '' : ` (${picksInRound + 1}/${n})`;
    statusText = isMyPick
      ? `${spunLabel} — à vous de choisir !${counter}`
      : `${spunLabel} — ${currentPlayer?.name || '…'} choisit…${counter}`;
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

      {historical ? (
        // Two chained wheels: the year settles first, then the team wheel
        // starts (delayMs), and only ITS settling opens the pick phase.
        <div className="stw-wheels">
          <Wheel
            items={years.map((y) => ({
              key: String(y),
              label: String(y),
              color: yearColor(y),
            }))}
            spin={spin}
            targetKey={spin?.year ? String(spin.year) : null}
            icon="📅"
          />
          <Wheel
            items={teamItems(remaining)}
            spin={spin}
            targetKey={spin?.team}
            delayMs={SPIN_MS}
            onSettled={(s) => setSettledNonce(s.nonce)}
          />
        </div>
      ) : (
        <Wheel
          items={teamItems(remaining)}
          spin={spin}
          targetKey={spin?.team}
          onSettled={(s) => setSettledNonce(s.nonce)}
        />
      )}

      {isSpinner && !spin && (
        <button
          type="button"
          className="btn btn--primary btn--big"
          disabled={busy || (historical ? !years.length : !remaining.length)}
          onClick={handleSpin}
        >
          {historical ? '🎡 Tourner les roues' : '🎡 Tourner la roue'}
        </button>
      )}

      {historical && spin && activeError && (
        <p className="error-text">
          Impossible de charger la saison {spin.year}.{' '}
          {/* Visible to everyone (a stuck bot needs the host to retry). */}
          <button
            type="button"
            className="btn"
            onClick={() => setRosterTry((k) => k + 1)}
          >
            Réessayer
          </button>
        </p>
      )}

      {myPickPhase && (
        <div className="stw-pick">
          <div className="stw-pick__team">
            <TeamChip abbr={spin.team} />
            <strong>{TEAMS[spin.team]?.name}</strong>
            {spin.year && <span className="stw-year-tag">{spin.year}</span>}
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

          {slot && !historical && activeError && (
            <p className="error-text">
              Impossible de charger les effectifs NFL.{' '}
              <button
                type="button"
                className="btn"
                onClick={() => setRosterTry((k) => k + 1)}
              >
                Réessayer
              </button>
            </p>
          )}
          {slot && !activeRosters && !activeError && (
            <p className="muted">
              {historical
                ? `Chargement de la saison ${spin.year}…`
                : 'Chargement des effectifs NFL…'}
            </p>
          )}

          {slot && activeRosters && (
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
