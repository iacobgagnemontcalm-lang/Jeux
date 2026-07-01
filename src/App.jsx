import { Routes, Route, Navigate } from 'react-router-dom';
import { isFirebaseConfigured } from './firebase.js';
import GameSelect from './pages/GameSelect.jsx';
import FruitInterdit from './games/fruit-interdit/FruitInterdit.jsx';

function ConfigWarning() {
  return (
    <div className="config-warning">
      <h2>Firebase n'est pas configuré</h2>
      <p>
        Copiez <code>.env.example</code> vers <code>.env</code> et renseignez vos
        valeurs <code>VITE_FIREBASE_*</code>, puis relancez le serveur. Voir le
        <code> README.md</code>.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      {!isFirebaseConfigured && <ConfigWarning />}
      <Routes>
        <Route path="/" element={<GameSelect />} />
        <Route path="/fruit-interdit/*" element={<FruitInterdit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
