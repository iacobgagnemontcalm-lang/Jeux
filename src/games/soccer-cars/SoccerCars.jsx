import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SoccerGame } from './engine.js';

const IS_TOUCH =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// Bouton tactile: presse = actif, relâche/sort = inactif.
function TouchBtn({ label, className, onChange }) {
  const press = (e) => {
    e.preventDefault();
    onChange(true);
  };
  const release = (e) => {
    e.preventDefault();
    onChange(false);
  };
  return (
    <button
      type="button"
      className={`ts-touch-btn ${className || ''}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

function TouchPad({ side, onInput }) {
  return (
    <div className={`ts-touchpad ts-touchpad--${side}`}>
      <TouchBtn label="◀" onChange={(v) => onInput({ left: v })} />
      <TouchBtn
        label="🚀"
        className="ts-touch-btn--boost"
        onChange={(v) => onInput({ boost: v })}
      />
      <TouchBtn label="▶" onChange={(v) => onInput({ right: v })} />
    </div>
  );
}

function GameScreen({ mode, onQuit }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const game = new SoccerGame(canvasRef.current, {
      mode,
      onState: (s) => setOver(s === 'over'),
    });
    gameRef.current = game;
    window.__turboSoccer = game; // accès console (debug/tests)
    game.start();
    return () => {
      game.destroy();
      if (window.__turboSoccer === game) delete window.__turboSoccer;
    };
  }, [mode]);

  const rematch = () => {
    setOver(false);
    gameRef.current?.rematch();
  };

  return (
    <div className="ts-stage">
      <canvas ref={canvasRef} className="ts-canvas" />

      <button type="button" className="ts-quit" onClick={onQuit}>
        ✕ Quitter
      </button>

      {IS_TOUCH && !over && (
        <>
          <TouchPad side="left" onInput={(p) => gameRef.current?.setTouch(0, p)} />
          {mode === 'duo' && (
            <TouchPad
              side="right"
              onInput={(p) => gameRef.current?.setTouch(1, p)}
            />
          )}
        </>
      )}

      {over && (
        <div className="ts-over-actions">
          <button type="button" className="btn btn--primary btn--big" onClick={rematch}>
            🔄 Revanche
          </button>
          <button type="button" className="btn btn--big" onClick={onQuit}>
            Menu
          </button>
        </div>
      )}
    </div>
  );
}

export default function SoccerCars() {
  const [mode, setMode] = useState(null); // null = menu, 'solo' | 'duo' = en jeu

  if (mode) {
    return <GameScreen mode={mode} onQuit={() => setMode(null)} />;
  }

  return (
    <div className="screen">
      <Link to="/" className="back-link">
        ← Retour aux jeux
      </Link>

      <header className="hub-header">
        <h1>⚽ Turbo Soccer 🚗</h1>
        <p className="subtitle">
          Deux bolides, un ballon. Frappez le ballon avec le <strong>nez</strong> de
          votre voiture pour marquer dans le but adverse. 2 minutes, égalité ={' '}
          <strong>but en or</strong>!
        </p>
      </header>

      <div className="ts-menu-buttons">
        <button type="button" className="btn btn--primary btn--big" onClick={() => setMode('solo')}>
          🤖 1 joueur — contre le robot
        </button>
        <button type="button" className="btn btn--big" onClick={() => setMode('duo')}>
          🎮 2 joueurs — même clavier
        </button>
      </div>

      <div className="ts-controls-card">
        <h3>Contrôles</h3>
        <div className="ts-controls-grid">
          <div>
            <h4 className="ts-p1">🔵 Joueur 1 (Bleu)</h4>
            <p>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> (ou <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd>) pour
              conduire
              <br />
              <kbd>Maj gauche</kbd> ou <kbd>Espace</kbd> = turbo 🚀
            </p>
          </div>
          <div>
            <h4 className="ts-p2">🔴 Joueur 2 (Rouge)</h4>
            <p>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>←</kbd>
              <kbd>→</kbd> pour conduire
              <br />
              <kbd>Maj droite</kbd> = turbo 🚀
            </p>
          </div>
        </div>
        <p className="muted">
          💡 Un simple contact pousse le ballon, mais une frappe du{' '}
          <strong>nez à pleine vitesse</strong> (surtout avec le turbo) l'envoie en
          flèche! Le turbo se recharge tout seul.
          {IS_TOUCH && ' Sur écran tactile: la voiture avance seule, utilisez ◀ ▶ et 🚀.'}
        </p>
      </div>
    </div>
  );
}
