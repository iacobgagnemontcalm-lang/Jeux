import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import { PlayerProvider } from './auth.jsx';
import { registerServiceWorker } from './pwa.jsx';
import './styles/app.css';

// Rend l'app installable (icône sur l'écran d'accueil + coquille hors-ligne).
registerServiceWorker();

// L'app native des stores (Capacitor) s'appelle « Spin the Wheel » : au
// lancement, elle ouvre directement le jeu. Fait avant le rendu pour que le
// HashRouter démarre sur la bonne route.
if (Capacitor.isNativePlatform() && !window.location.hash) {
  window.location.hash = '#/spin-the-wheel';
}

// HashRouter (URLs like /#/fruit-interdit/1234) needs no server-side rewrite, so
// deep links and refreshes work on any static host, including GitHub Pages sub-paths.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <PlayerProvider>
        <App />
      </PlayerProvider>
    </HashRouter>
  </React.StrictMode>,
);
