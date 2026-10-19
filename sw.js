/* Archivio ODG – service worker: conserva l'app sul dispositivo per l'uso offline.
   Per pubblicare una nuova versione dell'app, cambia il numero qui sotto. */
const VERSIONE = "archivio-odg-v4";
const FILE_APP = [
  "./", "./index.html", "./manifest.webmanifest",
  "./apple-touch-icon.png", "./icona-192.png",
  "./icona-512.png", "./icona-maskable-512.png", "./odg_esempio.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE_APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Prima il dispositivo, poi la rete: l'app si apre sempre, anche senza connessione.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSIONE).then(c => c.put(req, copia)); }
        return res;
      }).catch(() => req.mode === "navigate" ? caches.match("./index.html") : Response.error());
    })
  );
});
