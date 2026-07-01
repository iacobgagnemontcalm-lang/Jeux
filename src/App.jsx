import { Routes, Route, Navigate } from 'react-router-dom';
import { isFirebaseConfigured } from './firebase.js';
import { usePlayer } from './auth.jsx';
import GameSelect from './pages/GameSelect.jsx';
import FruitInterdit from './games/fruit-interdit/FruitInterdit.jsx';

function Notice({ title, children }) {
  return (
    <div className="app-shell">
      <div className="config-warning">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function App() {
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
    return (
      <div className="app-shell">
        <p className="muted loading-center">Connexion…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<GameSelect />} />
        <Route path="/fruit-interdit/*" element={<FruitInterdit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
