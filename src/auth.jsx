import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase.js';

// Provides the current player's stable id (the Firebase anonymous auth uid).
// Every browser gets its own anonymous account the first time it loads the app.
const PlayerContext = createContext({ uid: null, ready: false, error: null });

export function PlayerProvider({ children }) {
  const [uid, setUid] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setReady(true);
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        setReady(true);
      }
    });
    // Kick off (or resume) the anonymous sign-in.
    signInAnonymously(auth).catch((e) => {
      setError(e);
      setReady(true);
    });
    return unsub;
  }, []);

  return (
    <PlayerContext.Provider value={{ uid, ready, error }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
