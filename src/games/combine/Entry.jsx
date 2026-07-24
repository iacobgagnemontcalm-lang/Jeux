import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '../../auth.jsx';
import { createSession, sessionExists, joinSession } from './session.js';
import { getStoredName, getStoredPin, rememberSession } from './identity.js';

export default function Entry() {
  const navigate = useNavigate();
  const { uid } = usePlayer();
  const [name, setName] = useState(() => getStoredName());
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lastPin = getStoredPin();
  const lastName = getStoredName();
  const canResume = Boolean(lastPin && lastName);

  const setNameRemembered = (value) => {
    setName(value);
    rememberSession(value, null);
  };

  const go = (targetPin) => {
    rememberSession(name, targetPin);
    navigate(`/combine/${targetPin}`);
  };

  const handleCreate = async () => {
    if (!name.trim()) return setError('Entrez votre nom.');
    setError('');
    setBusy(true);
    try {
      const newPin = await createSession(name, uid);
      const res = await joinSession(newPin, name, uid);
      if (!res.ok) throw new Error('Impossible de rejoindre la session créée.');
      go(newPin);
    } catch (e) {
      setError(e.message || 'Erreur lors de la création.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (targetPin) => {
    if (!name.trim()) return setError('Entrez votre nom.');
    if (!targetPin.trim()) return setError('Entrez le PIN de la session.');
    setError('');
    setBusy(true);
    try {
      const cleanPin = targetPin.trim();
      if (!(await sessionExists(cleanPin))) {
        setError('Aucune session avec ce PIN.');
        return;
      }
      const res = await joinSession(cleanPin, name, uid);
      if (!res.ok) {
        setError(
          res.reason === 'already-started'
            ? 'La partie a commencé — rejoignez avec le nom exact que vous aviez.'
            : 'Session introuvable.',
        );
        return;
      }
      go(cleanPin);
    } catch (e) {
      setError(e.message || 'Erreur lors de la connexion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen entry">
      <Link to="/" className="back-link">← Jeux</Link>
      <header className="game-title">
        <span className="game-title__emoji">🏆</span>
        <h1>Combine</h1>
      </header>
      <p className="muted">
        Un mini-Combine à faire en vrai, entre amis&nbsp;: 8 défis, une roue de
        points avant chaque défi, un vote pour choisir l'épreuve, puis on entre
        les résultats. Votre nom est votre place&nbsp;: fermez l'onglet, revenez,
        entrez le même nom et le même PIN, et vous retrouvez vos points.
      </p>

      {canResume && (
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => handleJoin(lastPin)}
        >
          Reprendre la session {lastPin} · {lastName}
        </button>
      )}

      <label className="field">
        <span>Votre nom</span>
        <input
          type="text"
          value={name}
          maxLength={20}
          placeholder="Ex : Alex"
          onChange={(e) => setNameRemembered(e.target.value)}
        />
      </label>

      <div className="entry__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={handleCreate}
        >
          Nouvelle session
        </button>

        <div className="entry__divider"><span>ou</span></div>

        <label className="field">
          <span>Rejoindre avec un PIN</span>
          <input
            type="text"
            inputMode="numeric"
            value={pin}
            maxLength={6}
            placeholder="Ex : 4821"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => handleJoin(pin)}
        >
          Rejoindre
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
