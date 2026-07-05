import { Routes, Route, Navigate } from 'react-router-dom';
import { isFirebaseConfigured } from './firebase.js';
import { usePlayer } from './auth.jsx';
import GameSelect from './pages/GameSelect.jsx';
import FruitInterdit from './games/fruit-interdit/FruitInterdit.jsx';
import SoccerCars from './games/soccer-cars/SoccerCars.jsx';
import SpinTheWheel from './games/spin-the-wheel/SpinTheWheel.jsx';

function Notice({ title, children }) {
  return (
    <div className="config-warning">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// Garde-fou pour les jeux qui ont besoin de Firebase (sync temps réel).
// Les jeux 100% locaux (ex: Turbo Soccer) ne passent pas par ici.
function RequireFirebase({ children }) {
  const { ready, error } = usePlayer();

  if (!isFirebaseConfigured) {
    return (
      <Notice title="Firebase n'est pas configuré">
        <p>
          Copiez <code>.env.example</code> vers <code>.env</code> et renseignez vos
          valeurs <code>VITE_FIREBASE_*</code>, puis relancez le serveur. Voir le
          <code> README.md</code>.
        </p>
      </Notice>
    );
  }

  if (error) {
    return (
      <Notice title="Authentification requise">
        <p>
          Activez le fournisseur <strong>Anonymous</strong> dans Firebase&nbsp;→
          Authentication → Sign-in method, puis rechargez la page. Voir le
          <code> README.md</code>.
        </p>
      </Notice>
    );
  }

  if (!ready) {
    return <p className="muted loading-center">Connexion…</p>;
  }

  return children;
}

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<GameSelect />} />
        <Route
          path="/fruit-interdit/*"
          element={
            <RequireFirebase>
              <FruitInterdit />
            </RequireFirebase>
          }
        />
        <Route path="/soccer-cars" element={<SoccerCars />} />
        <Route
          path="/spin-the-wheel/*"
          element={
            <RequireFirebase>
              <SpinTheWheel />
            </RequireFirebase>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
