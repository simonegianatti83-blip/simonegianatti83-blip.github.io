/* Gioele – service worker: app disponibile anche offline + riceve i file
   condivisi dal telefono (menu "Condividi" → Gioele).
   Per pubblicare una nuova versione cambia il numero qui sotto. */
const VERSIONE = "gioele-v28";
const FILE_APP = ["./", "./index.html", "./manifest.webmanifest",
  "./icona-192.png", "./icona-512.png", "./icona-maskable-512.png", "./apple-touch-icon.png",
  "./analisi.js", "./riepilogo.js", "./oms.js", "./salute.js", "./pasti.js", "./extra.js"];
/* librerie pesanti (lettura PDF, OCR, creazione PDF): salvate sul telefono al primo uso */
const AL_PRIMO_USO = /\/(gioele\/ocr\/|pdf\.min\.mjs|pdf\.worker\.(min|app)\.mjs|compat\.mjs|pdf-lib\.min\.js)/;

/* con poco segnale non si aspetta all'infinito: dopo qualche secondo si usa la copia salvata */
const ATTESA_RETE_MS = 4000;
function conTimeout(promessa, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error("timeout")), ms);
    promessa.then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); ko(err); });
  });
}
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIONE)
    .then(c => c.addAll(FILE_APP.map(u => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x.startsWith("gioele-") && x !== VERSIONE && !x.endsWith("-librerie")).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

/* stesso database della pagina: qui si usa solo l'archivio "inbox" */
function apriDB() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open("gioele-salute", 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const s of ["kv", "file", "inbox"]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
async function mettiInInbox(voce) {
  const db = await apriDB();
  await new Promise((ok, ko) => {
    const t = db.transaction("inbox", "readwrite");
    t.objectStore("inbox").put(voce, Date.now() + "-" + Math.random().toString(36).slice(2));
    t.oncomplete = ok; t.onerror = () => ko(t.error);
  });
}

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method === "POST" && url.pathname.endsWith("/ricevi")) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const files = fd.getAll("file").filter(f => f && f.size);
        await mettiInInbox({ titolo: fd.get("title") || "", testo: fd.get("text") || "", files });
      } catch (err) { /* se fallisce si apre comunque l'app */ }
      return Response.redirect(new URL("./?ricevuto=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    const radice = new URL("./", self.registration.scope).pathname;
    const eApp = url.pathname === radice || url.pathname === radice + "index.html";
    e.respondWith(conTimeout(fetch(req, { cache: "no-store" }), ATTESA_RETE_MS)
      .then(res => { if (res.ok && eApp) { const c = res.clone(); caches.open(VERSIONE).then(x => x.put("./index.html", c)); } return res; })
      .catch(() => eApp ? caches.match("./index.html") : caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))));
    return;
  }
  if (AL_PRIMO_USO.test(url.pathname)) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(VERSIONE + "-librerie").then(x => x.put(req, c)); }
      return res;
    })));
    return;
  }
  /* file dell'app: prima la rete (aggiornamenti subito), poi la copia salvata */
  const rete = fetch(req).then(res => {
    if (res.ok && url.pathname.startsWith(new URL("./", self.registration.scope).pathname)) { const c = res.clone(); caches.open(VERSIONE).then(x => x.put(req, c)); }
    return res;
  });
  e.respondWith(conTimeout(rete, ATTESA_RETE_MS)
    .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || rete)));
});
