// Service worker : rend l'app installable et fait fonctionner la coquille
// hors-ligne. Les données de jeu restent en temps réel (Firebase / Sleeper) —
// on ne met en cache que les fichiers de l'app elle-même.
//
// Stratégies :
//  - navigations (HTML)      → réseau d'abord, cache en secours (hors-ligne) ;
//  - fichiers du même domaine → cache d'abord, mise à jour en arrière-plan ;
//  - tout le reste (Firebase, API Sleeper…) → jamais intercepté.

const CACHE = 'jeux-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './manifest-wheel.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firebase, Sleeper… → direct

  // Pages : réseau d'abord pour toujours servir la dernière version publiée,
  // avec l'index en cache comme secours hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Assets (JS/CSS hashés par Vite, icônes…) : cache d'abord — un fichier hashé
  // ne change jamais — et on remplit le cache au premier chargement.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
