import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useSession, getPlayerId } from './session.js';
import Lobby from './Lobby.jsx';
import Game from './Game.jsx';
import Results from './Results.jsx';

// Reads the live session and shows the right screen for its status.
export default function SessionView() {
  const { pin } = useParams();
  const navigate = useNavigate();
  const { session, loading } = useSession(pin);
  const playerId = getPlayerId();

  const isMember = Boolean(session?.players?.[playerId]);

  // If the session vanished, or we aren't a member of a lobby, go back to entry.
  useEffect(() => {
    if (loading) return;
    if (!session) return; // handled below with a message
    if (!isMember && session.status === 'lobby') {
      navigate('/fruit-interdit', { replace: true });
    }
  }, [loading, session, isMember, navigate]);

  if (loading) {
    return <div className="screen"><p className="muted">Chargement…</p></div>;
  }

  if (!session) {
    return (
      <div className="screen">
        <p className="error-text">Session {pin} introuvable.</p>
        <Link to="/fruit-interdit" className="btn">Retour</Link>
      </div>
    );
  }

  if (session.status === 'lobby') {
    return <Lobby pin={pin} session={session} playerId={playerId} />;
  }
  if (session.status === 'playing') {
    return <Game pin={pin} session={session} playerId={playerId} />;
  }
  return <Results pin={pin} session={session} playerId={playerId} />;
}
