import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { writeSpin, commitPick, toPlayerList } from './session.js';
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  SLOTS,
  SLOT_POSITIONS,
  NAME_BONUS,
  openSlots,
} from './constants.js';
import { TEAMS, remainingTeams } from './teams.js';
import { fetchRosters, eligiblePlayers } from './sleeper.js';
import { bestMatch } from './match.js';
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
                      {pick.bonus && <span className="stw-bonus">×{NAME_BONUS}</span>}
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
  const order = session.order || [];
  const n = order.length;
  // turnIndex = total picks made. See commitPick in session.js for the round
  // model (one team per round, spinner picks first, seat order shifts).
  const turnIndex = session.turnIndex || 0;
  const round = n ? Math.floor(turnIndex / n) : 0;
  const picksInRound = n ? turnIndex % n : 0;
  const spinnerUid = n ? order[round % n] : null;
  const currentUid = n ? order[(round + picksInRound) % n] : null;
  const spinnerPlayer = session.players?.[spinnerUid];
  const currentPlayer = session.players?.[currentUid];
  const isSpinner = spinnerUid === playerId;
  const isMyPick = currentUid === playerId;
  const me = session.players?.[playerId];
  const difficulty =
    DIFFICULTIES[session.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
  const spin = session.spin || null;
  const remaining = remainingTeams(session.usedTeams);

  // NFL players already drafted from this round's team (teams never repeat
  // across rounds, so any roster entry on that team was picked this round).
  const takenIds = new Set();
  if (spin) {
    players.forEach((p) =>
      Object.values(p.roster || {}).forEach((pk) => {
        if (pk.team === spin.team) takenIds.add(pk.id);
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

  // New spin (or new turn): reset the pick panel.
  useEffect(() => {
    setSlot(null);
    setMode(null);
    setGuess('');
    setGuessFailed(false);
    setFeedback(null);
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
        text: `🎯 ${m.player.name} — bonus ×${NAME_BONUS} !`,
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
    statusText = isMyPick
      ? `${teamName} — à vous de choisir ! (${picksInRound + 1}/${n})`
      : `${teamName} — ${currentPlayer?.name || '…'} choisit… (${picksInRound + 1}/${n})`;
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
              {!guessFailed && (
                <form className="stw-guess" onSubmit={handleGuess}>
                  <input
                    className="stw-guess__input"
                    type="text"
                    autoComplete="off"
                    placeholder="Nom du joueur (bonus ×1.2)"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
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
