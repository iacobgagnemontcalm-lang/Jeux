import { useState } from 'react';
import { useInstallPrompt } from '../pwa.jsx';

// Bouton « Installer l'app » : sur Chrome/Android il déclenche la vraie boîte
// d'installation ; sur iPhone/iPad (où elle n'existe pas) il explique le geste
// Partager → « Sur l'écran d'accueil ». Invisible si l'app tourne déjà
// installée, ou si le navigateur ne propose rien.
export default function InstallAppButton() {
  const { canPrompt, promptInstall, isStandalone, isIos } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (isStandalone) return null;
  if (!canPrompt && !isIos) return null;

  return (
    <div className="install-app">
      <button
        type="button"
        className="btn install-app__btn"
        onClick={() => (canPrompt ? promptInstall() : setShowIosHelp((v) => !v))}
      >
        📲 Installer l'app
      </button>
      {showIosHelp && !canPrompt && (
        <p className="install-app__help">
          Dans Safari : touchez <strong>Partager</strong> (le carré avec la
          flèche ↑) puis <strong>« Sur l'écran d'accueil »</strong>. L'app aura
          sa propre icône et s'ouvrira en plein écran.
        </p>
      )}
    </div>
  );
}
