import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { usePlayer } from '../../auth.jsx';
import { useSession } from './session.js';
import Lobby from './Lobby.jsx';
import Game from './Game.jsx';
import Results from './Results.jsx';

// Reads the live session and shows the right screen for its status.
export default function SessionView() {
  const { pin } = useParams();
  const navigate = useNavigate();
  const { session, loading } = useSession(pin);
  const playerId = usePlayer().uid;

  const isMember = Boolean(session?.players?.[playerId]);

  useEffect(() => {
    if (loading) return;
    if (!session) return; // handled below with a message
    if (!isMember && session.status === 'lobby') {
      navigate('/spin-the-wheel', { replace: true });
    }
  }, [loading, session, isMember, navigate]);

  if (loading) {
    return <div className="screen"><p className="muted">Chargement…</p></div>;
  }

  if (!session) {
    return (
      <div className="screen">
        <p className="error-text">Session {pin} introuvable.</p>
        <Link to="/spin-the-wheel" className="btn">Retour</Link>
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
