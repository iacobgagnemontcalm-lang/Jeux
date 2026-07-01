import { Link } from 'react-router-dom';
import { toLeaderboard } from './session.js';
import Leaderboard from '../../components/Leaderboard.jsx';
import FruitCounts from '../../components/FruitCounts.jsx';

export default function Results({ session, playerId }) {
  const leaderboard = toLeaderboard(session.players);
  const winner = leaderboard[0];
  const me = session.players?.[playerId];

  return (
    <div className="screen results">
      <h1 className="results__title">Terminé !</h1>

      {winner && (
        <div className="results__winner">
          🏆 <strong>{winner.name}</strong> remporte la partie avec{' '}
          {winner.points || 0} points
        </div>
      )}

      <Leaderboard players={leaderboard} meId={playerId} title="Palmarès final" />

      {me && (
        <section className="game__section">
          <h3>Vos fruits</h3>
          <FruitCounts counts={me.fruitCounts} />
        </section>
      )}

      <Link to="/" className="btn btn--big">Retour aux jeux</Link>
    </div>
  );
}
