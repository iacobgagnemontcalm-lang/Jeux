import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '../../auth.jsx';
import { createSession, sessionExists, joinSession } from './session.js';

const NAME_KEY = 'fi_player_name';

export default function Entry() {
  const navigate = useNavigate();
  const { uid } = usePlayer();
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const rememberName = (value) => {
    setName(value);
    localStorage.setItem(NAME_KEY, value.trim());
  };

  const handleCreate = async () => {
    if (!name.trim()) return setError('Entrez votre nom.');
    setError('');
    setBusy(true);
    try {
      const newPin = await createSession(uid);
      const res = await joinSession(newPin, uid, name);
      if (!res.ok) throw new Error('Impossible de rejoindre la session créée.');
      navigate(`/fruit-interdit/${newPin}`);
    } catch (e) {
      setError(e.message || 'Erreur lors de la création.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) return setError('Entrez votre nom.');
    if (!pin.trim()) return setError('Entrez le PIN de la session.');
    setError('');
    setBusy(true);
    try {
      const cleanPin = pin.trim();
      if (!(await sessionExists(cleanPin))) {
        setError('Aucune session avec ce PIN.');
        return;
      }
      const res = await joinSession(cleanPin, uid, name);
      if (!res.ok) {
        setError(
          res.reason === 'already-started'
            ? 'La partie a déjà commencé.'
            : 'Session introuvable.',
        );
        return;
      }
      navigate(`/fruit-interdit/${cleanPin}`);
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
        <span className="game-title__emoji">🍓</span>
        <h1>Fruit Interdit</h1>
      </header>

      <label className="field">
        <span>Votre nom</span>
        <input
          type="text"
          value={name}
          maxLength={20}
          placeholder="Ex : Alex"
          onChange={(e) => rememberName(e.target.value)}
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
          onClick={handleJoin}
        >
          Rejoindre
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
