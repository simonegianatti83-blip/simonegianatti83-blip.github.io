/* Archivio ODG – service worker: conserva l'app sul dispositivo per l'uso offline.
   Online: la pagina viene sempre presa fresca dal sito (così gli aggiornamenti arrivano subito).
   Offline: si usa la copia salvata sul dispositivo.
   Per pubblicare una nuova versione dell'app, cambia il numero qui sotto. */
const VERSIONE = "archivio-odg-v19";
const FILE_APP = [
  "./", "./index.html", "./manifest.webmanifest",
  "./apple-touch-icon.png", "./icona-192.png",
  "./icona-512.png", "./icona-maskable-512.png", "./odg_esempio.json",
  "./compat.mjs", "./pdf.min.mjs", "./pdf.worker.app.mjs", "./pdf.worker.min.mjs"
];
const ATTESA_RETE_MS = 3500;   // oltre questo tempo senza risposta si usa la copia salvata

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSIONE)
      // cache:"reload" scavalca le copie vecchie in memoria: si salvano i file appena pubblicati
      .then(c => c.addAll(FILE_APP.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function conTimeout(promessa, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error("timeout")), ms);
    promessa.then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); ko(err); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // La pagina dell'app: prima la rete (versione aggiornata), poi la copia salvata.
  if (req.mode === "navigate") {
    e.respondWith(
      conTimeout(fetch(req, { cache: "no-store" }), ATTESA_RETE_MS)
        .then(res => {
          const p = new URL(req.url).pathname;
          if (res.ok && (p.endsWith("/") || p.endsWith("/index.html"))) {
            const copia = res.clone(); caches.open(VERSIONE).then(c => c.put("./index.html", copia));
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Icone e altri file: prima la copia salvata, poi la rete.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSIONE).then(c => c.put(req, copia)); }
      return res;
    }))
  );
});
