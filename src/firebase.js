import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Config is read from Vite env vars (see .env.example). These values are meant to be
// public in a Firebase web app; the Realtime Database rules are what protect the data.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Helpful early warning if the .env file was not filled in.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.databaseURL,
);

// Only initialise when configured, so a missing .env shows the config warning
// instead of crashing the whole app at load time.
export const db = isFirebaseConfigured
  ? getDatabase(initializeApp(firebaseConfig))
  : null;
