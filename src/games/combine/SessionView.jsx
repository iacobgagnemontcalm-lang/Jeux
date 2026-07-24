import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useSession } from './session.js';
import { getStoredName, nameKey } from './identity.js';
import Lobby from './Lobby.jsx';
import Game from './Game.jsx';
import Results from './Results.jsx';

// Reads the live session and shows the right screen for its status. The
// current player is identified by the remembered username, so a reload lands
// back on the same player node.
export default function SessionView() {
  const { pin } = useParams();
  const navigate = useNavigate();
  const { session, loading } = useSession(pin);
  const playerId = nameKey(getStoredName());
  const isMember = Boolean(playerId && session?.players?.[playerId]);

  useEffect(() => {
    if (loading || !session) return;
    // Not (yet) a member — send them to the entry to join with a name.
    if (!isMember) navigate('/combine', { replace: true });
  }, [loading, session, isMember, navigate]);

  if (loading) {
    return <div className="screen"><p className="muted">Chargement…</p></div>;
  }

  if (!session) {
    return (
      <div className="screen">
        <p className="error-text">Session {pin} introuvable.</p>
        <Link to="/combine" className="btn">Retour</Link>
      </div>
    );
  }

  if (!isMember) {
    return <div className="screen"><p className="muted">Connexion…</p></div>;
  }

  if (session.status === 'lobby') {
    return <Lobby pin={pin} session={session} playerId={playerId} />;
  }
  if (session.status === 'playing') {
    return <Game pin={pin} session={session} playerId={playerId} />;
  }
  return <Results session={session} playerId={playerId} />;
}
