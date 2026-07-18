import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';

// --- Installation (PWA) -----------------------------------------------------
// Chrome/Android annoncent qu'une installation est possible via l'événement
// `beforeinstallprompt`. Il peut partir très tôt, avant que React ne monte :
// on le capture donc ici, au chargement du module (importé en premier par
// main.jsx), et les composants s'y abonnent ensuite.

let deferredPrompt = null;
const listeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // pas de mini-bannière auto : on affiche notre bouton
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Hook : { canPrompt, promptInstall, isStandalone, isIos }
export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad "desktop"

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome === 'accepted';
  };

  return { canPrompt, promptInstall, isStandalone, isIos };
}

// --- Service worker ---------------------------------------------------------

export function registerServiceWorker() {
  if (!import.meta.env.PROD) return; // en dev, Vite sert les modules à la volée
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Pas bloquant : sans service worker l'app marche, elle n'est juste pas
      // installable ni disponible hors-ligne.
    });
  });
}

// --- Identité par jeu -------------------------------------------------------
// Sur les routes de Spin the Wheel, l'app installable devient « Spin the
// Wheel » : son manifest, son icône et son nom. Installée depuis là, elle a sa
// propre icône sur l'écran d'accueil et s'ouvre directement dans le jeu.

const IDENTITIES = {
  jeux: {
    title: 'Jeux',
    manifest: './manifest.webmanifest',
    appleIcon: './icons/jeux-apple-180.png',
    themeColor: '#072019',
  },
  wheel: {
    title: 'Spin the Wheel',
    manifest: './manifest-wheel.webmanifest',
    appleIcon: './icons/wheel-apple-180.png',
    themeColor: '#0a1830',
  },
};

export function PwaIdentity() {
  const { pathname } = useLocation();
  const id = pathname.startsWith('/spin-the-wheel') ? IDENTITIES.wheel : IDENTITIES.jeux;

  useEffect(() => {
    document.title = id.title;
    const set = (selector, attr, value) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    set('link[rel="manifest"]', 'href', id.manifest);
    set('link[rel="apple-touch-icon"]', 'href', id.appleIcon);
    set('meta[name="apple-mobile-web-app-title"]', 'content', id.title);
    set('meta[name="theme-color"]', 'content', id.themeColor);
  }, [id]);

  return null;
}
