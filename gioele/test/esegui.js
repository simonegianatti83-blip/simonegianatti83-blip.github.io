/* =====================================================================
   Prove automatiche dell'app Gioele
   Avvia un piccolo server sulla cartella del sito, esegue ogni prova in un
   browser (Chromium, iPhone/iPad/computer simulati, Google simulato) e
   controlla che non ci siano errori e che i risultati attesi compaiano.

   Uso:   cd gioele/test && npm install && npx playwright install chromium && node esegui.js
          node esegui.js peso notte        (solo alcune prove)
   ===================================================================== */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const { spawn } = require("child_process");

const RADICE = path.resolve(__dirname, "../..");   // cartella del sito (simonegianatti83-blip.github.io)
const PORTA = 8765;
const TIPI = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".pdf": "application/pdf", ".gz": "application/gzip", ".css": "text/css", ".txt": "text/plain" };

/* risultato atteso nell'uscita di ogni prova (oltre a "nessun errore") */
const PROVE = {
  "documenti-lettura": ['"cat":"esami"', '"cat":"dimissione"', '"cat":"ps"', "Immacolata Concezione", "Ferie natalizie", "PDF pronto"],
  "documenti-personali": ["categoria=tessera", "RSSGLE24C14I829W", "categoria=nascita", "data=2024-03-20"],
  "crescita": ["peso nascita 3,3464 kg: 50°", "peso 12 mesi 9,6479 (atteso 50°): 50°", "testa nascita 34,46 (50°): 50°"],
  "salute": ["esa1: ✓", "bil1: ✓", "dose precompilata: 2,5 ml", "avviso: ⚠️", "Importo letto: 11,40", "pdf emergenze nel visualizzatore: true", "PDF pronto"],
  "pannolini": ["avviso feci chiare: Feci molto chiare", "dettagli cacca nascosti con sola pipì: true", '"pipi":1,"cacca":1'],
  "pasti-seni": ["campo ora di fine presente: 0", "seno entrambi sx 12 dx 15 primo dx fine 09:27", "seno sx sx 20 dx null primo - fine 13:30", "seno dx sx null dx 18 primo - fine 00:08", "Totale: 27 minuti (sinistro 12′ + destro 15′)", "riaperta: sx 12 dx 15", "cronometro: sx 8 dx 12 | primo dx"],
  "moduli-errori": ["campo evidenziato: minSx", "messaggio visibile: true", "scritto 55: 55", "3) dopo Invio foglio aperto: true", "4) dopo Salva foglio aperto: false", "campo: minSx"],
  "peso": ["+80 g", "rispetto al 24 nov 2026", "−4,6%", "calo oltre il 10%"],
  "notte-sonno-faceid": ["pipì con un tocco: 1", "dopo Annulla: 0", "sonno: true", "notte chiusa, tema ripristinato: true", "link #azione=cacca: true", "sbloccata con Face ID: true", "codice sbagliato: Codice sbagliato", "sbloccata con codice: true"],
  "backup": ["1) backup dopo il collegamento: [ 'gioele-backup-", "seconda sincronizzazione (nessun nuovo backup): 1", "token scaduto, stato: serve-accesso"],
  "allegati-rete": ["vecchio file convertito: FOTO-DI-PROVA", "1) rete caduta, stato: ok | avviso: 1 file non ancora caricati", "foto su Drive: false", "2) dopo il nuovo tentativo, stato: ok | foto su Drive: true", "contenuto su Drive: FOTO-DI-PROVA", "accesso ancora valido: true"],
  "sync-tre-persone": ['Silvia vede: {"misure":1', '"sola":true', "scritture della nonna: nessuna", "Simone vede la febbre di Silvia: 1"],
  "calendario-import": ["2a sinc. (niente doppioni): 2 visite", "titolo evento U1: Visita oculistica Gioele", "annullata"],
  "calendario-pasti": ["1) pasto segnato:", "2) dopo la correzione: [ 'E", "10:30-10:55", "visite importate per errore dal calendario: 0"],
  "calendario-vitd": ["✅ Vitamina D a Gioele – assunta", "modifiche in più alla sinc. successiva: 0", "visite importate per errore: 0"],
  "ostetrica": ["tipo: ostetrica | luogo: A domicilio | medico: Ostetrica", "elenco medici con ostetrica: true", "foglio chiuso: true", "consultorio luogo: Consultorio familiare", "elenco visite: true", "dal calendario: ostetrica,consultorio,pediatra", "voci ostetrica/consultorio 2, PDF pronto: true"],
  "esplora-tutto": ["ERRORI: nessuno"],
  "visualizzatore": ["foglio aperto: true", "pagine disegnate: 1", "immagine mostrata 1", "riepilogo nel visualizzatore: pagine 1"],
  "offline": ["offline, apro l'app → titolo: Gioele – Salute", "rete lentissima: app aperta in"],
  "desktop": ["telefono: barra in basso = true", "barra laterale = 236px", "larghezza 810: barra in basso", "larghezza 1080: barra laterale"]
};

function server() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(RADICE, p);
    if (!f.startsWith(RADICE)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, dati) => {
      if (err) { res.writeHead(404); return res.end("non trovato"); }
      res.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(dati);
    });
  }).listen(PORTA);
}

function esegui(nome, cartella) {
  return new Promise(ok => {
    const t0 = Date.now(); let uscita = "";
    const pr = spawn(process.execPath, [path.join(__dirname, nome + ".js")], { cwd: cartella, env: { ...process.env, NODE_PATH: [path.join(__dirname, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(path.delimiter) } });
    const stop = setTimeout(() => { uscita += "\nTEMPO SCADUTO"; pr.kill("SIGKILL"); }, 300000);
    pr.stdout.on("data", d => uscita += d); pr.stderr.on("data", d => uscita += d);
    pr.on("close", codice => { clearTimeout(stop); ok({ codice, uscita, secondi: ((Date.now() - t0) / 1000).toFixed(0) }); });
  });
}

(async () => {
  const scelte = process.argv.slice(2);
  const nomi = Object.keys(PROVE).filter(n => !scelte.length || scelte.some(s => n.includes(s)));
  const srv = server();
  /* ogni prova lavora in una cartella temporanea con una copia dei documenti di prova */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gioele-prove-"));
  for (const f of fs.readdirSync(path.join(__dirname, "documenti"))) fs.copyFileSync(path.join(__dirname, "documenti", f), path.join(tmp, f));
  let falliti = 0;
  for (const n of nomi) {
    const r = await esegui(n, tmp);
    const problemi = [];
    if (r.codice !== 0) problemi.push("uscita con codice " + r.codice);
    if (/TimeoutError|TEMPO SCADUTO|ReferenceError|TypeError/.test(r.uscita)) problemi.push("errore o tempo scaduto");
    for (const m of r.uscita.matchAll(/errori: (\[[^\n]*)/g)) if (!/^\[\s*\](\s*\[\s*\])?\s*$/.test(m[1])) problemi.push("errori nella pagina: " + m[1].slice(0, 200));
    for (const atteso of PROVE[n]) if (!r.uscita.includes(atteso)) problemi.push("manca: " + atteso);
    if (problemi.length) { falliti++; console.log(`✗ ${n} (${r.secondi}s)\n   - ${problemi.join("\n   - ")}\n--- uscita ---\n${r.uscita.slice(-3000)}\n--------------`); }
    else console.log(`✓ ${n} (${r.secondi}s)`);
  }
  srv.close();
  console.log(`\n${nomi.length - falliti} prove superate su ${nomi.length}`);
  process.exit(falliti ? 1 : 0);
})();
