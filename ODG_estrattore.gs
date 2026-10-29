/**
 * ODG ARCHIVIO – Estrattore da Gmail (v8: testo integrale, PDF caricati dall'app, email complete,
 *   cartella "Da importare" per i PDF degli anni passati, avviso Telegram alle 9 e alle 18)
 * ------------------------------------------------------------
 * Legge le email dell'Ufficio Informatica VVF Sondrio, prende ogni PDF
 * allegato (ODG, DDS, COMUNICAZIONI) e anche i PDF dentro gli allegati .zip,
 * ne estrae il TESTO COMPLETO e costruisce "odg_database.json" nella cartella
 * Drive "ODG Archivio". Quel file si importa nella web app "Archivio ODG".
 *
 * Perché il testo è completo: la lettura (OCR) di Google Drive elabora solo le
 * prime 10 pagine di un PDF e file fino a 2 MB. Lo script quindi divide ogni
 * PDF in blocchi da massimo 10 pagine e sotto i 2 MB, li legge uno per uno e
 * ricompone il testo intero. Nessun limite di lunghezza.
 *
 * INSTALLAZIONE (una volta sola, ~3 minuti):
 *  1. Vai su https://script.google.com  →  Nuovo progetto
 *  2. Incolla tutto questo file al posto del codice presente, salva.
 *  3. Menu a sinistra "Servizi" (+)  →  aggiungi "Drive API"  →  Aggiungi.
 *  4. In alto scegli la funzione "aggiorna" e premi Esegui.
 *     Autorizza l'accesso (Gmail, Drive, connessione esterna) quando richiesto.
 *  5. Scegli la funzione "installaAggiornamentoAutomatico" e premi Esegui:
 *     da quel momento lo script gira da solo ogni ora.
 *  6. (Per l'app) "Esegui il deployment" → "Nuovo deployment" → tipo "App web",
 *     Esegui come: Me, Chi ha accesso: Chiunque → copia l'"URL app web" (/exec)
 *     e incollalo nell'app: Dati → Collega a Google.
 *
 * AGGIORNARE LO SCRIPT SENZA CAMBIARE IL LINK DELL'APP:
 *  incolla la nuova versione, salva, poi "Esegui il deployment" → "Gestisci
 *  deployment" → matita → Versione: "Nuova versione" → "Esegui il deployment".
 *
 * Se avevi già usato la versione precedente: esegui una volta "azzeraDatabase",
 * poi "aggiorna", così tutti i documenti vengono riletti per intero.
 *
 * PDF DEGLI ANNI PASSATI (email cancellate): trascina i PDF (anche .zip) nella
 * cartella Drive "ODG Archivio/Da importare". A ogni giro lo script li legge,
 * li aggiunge all'archivio e li sposta in "Caricati dall'app". Quelli già
 * presenti finiscono in "Da importare/Già presenti", gli altri file in
 * "Da importare/Non riconosciuti".
 *
 * AVVISO SUL TELEFONO CON TELEGRAM (alle 9 e alle 18, solo se ci sono documenti nuovi):
 *  1. In Telegram cerca @BotFather → Avvia → scrivi /newbot → dai un nome
 *     (es. Archivio ODG) e un nome utente che finisce con "bot". BotFather ti
 *     risponde con un TOKEN (tipo 123456789:AAH...).
 *  2. Incolla il token qui sotto in TELEGRAM_TOKEN, tra gli apici, e salva.
 *  3. In Telegram apri il tuo nuovo bot (link nel messaggio di BotFather) e premi Avvia.
 *  4. Qui esegui "attivaAvvisi": arriva subito un messaggio di prova.
 *  Dopo l'attivazione il token resta salvato: quando aggiorni lo script non
 *  serve reinserirlo. Per spegnere: "disattivaAvvisi".
 *
 * La prima esecuzione elabora i documenti a blocchi (Google limita ogni
 * esecuzione a 6 minuti): con il trigger orario l'archivio storico si
 * completa da solo. Puoi anche rilanciare "aggiorna" a mano.
 */

// ===================== CONFIGURAZIONE =====================
const CONFIG = {
  QUERY: 'from:informatica.sondrio@vigilfuoco.it has:attachment',
  MITTENTE: 'informatica.sondrio@vigilfuoco.it',
  CARTELLA: 'ODG Archivio',          // cartella Drive di destinazione
  FILE_DB: 'odg_database.json',      // database per la web app
  SALVA_PDF: true,                   // salva anche una copia dei PDF in Drive
  LEGGI_ZIP: true,                   // legge anche i PDF dentro gli allegati .zip
  PAGINE_PER_BLOCCO: 10,             // limite OCR di Google Drive
  MAX_BYTE_BLOCCO: 1.9 * 1024 * 1024,// limite OCR di Google Drive (2 MB)
  TEMPO_MAX_MS: 4.5 * 60 * 1000,     // si ferma prima del limite di 6 minuti
  BLOCCO_THREAD: 50,
  CARTELLA_CARICATI: 'Caricati dall\'app',  // PDF aggiunti dai dispositivi
  CARTELLA_IMPORTA: 'Da importare',         // trascina qui i PDF da aggiungere in blocco
  AVVISI_ORE: [9, 18],                      // ore dell'avviso sul telefono (ora italiana)
  APP_URL: 'https://simonegianatti83-blip.github.io/',
  PDF_LIB: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'
};
// ==========================================================

const VERSIONE_SCRIPT = 8;

// Token del bot Telegram (vedi istruzioni in alto). Dopo "attivaAvvisi" resta salvato.
const TELEGRAM_TOKEN = '';   // l'app la usa per capire se lo script è aggiornato

const MESI = { gen:1, feb:2, mar:3, apr:4, mag:5, giu:6, lug:7, ago:8, set:9, ott:10, nov:11, dic:12 };

async function aggiorna() {
  const inizio = Date.now();
  const cartella = cartellaPrincipale_();
  const cartellaPdf = CONFIG.SALVA_PDF ? sottocartella_(cartella, 'PDF') : null;
  const db = leggiDb_(cartella);
  const visti = new Set(db.documenti.map(d => d.id));
  const caricatiPerNome = {};
  db.documenti.forEach(d => { if (d.origine === 'caricato' && d.file) caricatiPerNome[d.file] = d; });
  const aggiunti = [], modifiche = {}, nuoveEmail = {};
  const modifica = (id, campi) => { modifiche[id] = Object.assign(modifiche[id] || {}, campi); };
  let nuovi = 0, letti = 0, interrotto = false;

  // 1) PDF caricati dall'app senza testo (scansioni): li legge Google con l'OCR
  for (const d of db.documenti) {
    if (!d.daOcr) continue;
    if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) { interrotto = true; break; }
    try {
      const blob = DriveApp.getFileById(idDaUrl_(d.pdf)).getBlob();
      const r = await estraiTestoCompleto_(blob, d.file);
      modifica(d.id, { testo: r.testo, pagine: r.pagine || d.pagine, testoCompleto: r.completo, daOcr: false });
      letti++;
    } catch (e) {
      console.warn('OCR non riuscito: ' + d.file + ' – ' + e);
      modifica(d.id, { daOcr: false, testoCompleto: false });
    }
  }

  // 2) Email nuove
  for (let start = 0; !interrotto; start += CONFIG.BLOCCO_THREAD) {
    const threads = GmailApp.search(CONFIG.QUERY, start, CONFIG.BLOCCO_THREAD);
    if (!threads.length) break;

    for (const thread of threads) {
      for (const msg of thread.getMessages()) {
        if (msg.getFrom().indexOf(CONFIG.MITTENTE) === -1) continue;
        // Testo dell'email (anche per quelle già in archivio): l'app la mostra al suo interno
        if (!db.email[msg.getId()] && !nuoveEmail[msg.getId()]) {
          if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) { interrotto = true; break; }
          try { nuoveEmail[msg.getId()] = infoEmail_(msg); } catch (e) {}
        }

        for (const voce of pdfDelMessaggio_(msg)) {
          const id = msg.getId() + '|' + voce.chiave;
          if (visti.has(id)) continue;
          // Stesso PDF già caricato a mano dall'app: aggiunge solo i dati dell'email
          const gia = caricatiPerNome[voce.nome];
          if (gia) {
            modifica(gia.id, { oggettoEmail: msg.getSubject(),
              dataEmail: Utilities.formatDate(msg.getDate(), 'Europe/Rome', "yyyy-MM-dd'T'HH:mm"),
              gmail: linkEmail_(msg.getId()) });
            visti.add(id); continue;
          }
          if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) { interrotto = true; break; }

          const meta = analizzaNome_(voce.nome, msg, voce.zip);
          let estratto = { testo: '', pagine: null, pagineLette: 0, completo: false };
          try { estratto = await estraiTestoCompleto_(voce.blob, voce.nome); }
          catch (e) { console.warn('Testo non estratto: ' + voce.nome + ' – ' + e); }

          let pdfUrl = '';
          if (cartellaPdf) pdfUrl = salvaPdf_(cartellaPdf, voce.blob, voce.nome);

          aggiunti.push({
            id: id,
            tipo: meta.tipo,
            numero: meta.numero,
            data: meta.data,
            titolo: meta.titolo,
            file: voce.nome,
            allegatoDi: voce.zip || '',
            testo: estratto.testo,
            pagine: estratto.pagine,
            testoCompleto: estratto.completo,
            oggettoEmail: msg.getSubject(),
            dataEmail: Utilities.formatDate(msg.getDate(), 'Europe/Rome', "yyyy-MM-dd'T'HH:mm"),
            gmail: linkEmail_(msg.getId()),
            pdf: pdfUrl
          });
          visti.add(id);
          nuovi++;
        }
        if (interrotto) break;
      }
      if (interrotto) break;
    }
  }

  // 3) PDF trascinati nella cartella "Da importare" (anni passati, email cancellate)
  let importati = 0, imp = null;
  if (!interrotto) {
    imp = await importaDaCartella_(cartella, db, inizio);
    importati = imp.aggiunti.length; aggiunti.push.apply(aggiunti, imp.aggiunti);
    if (imp.interrotto) interrotto = true;
  } else sottocartella_(cartella, CONFIG.CARTELLA_IMPORTA);

  const finale = salvaUnendo_(cartella, aggiunti, modifiche, !interrotto, nuoveEmail);
  if (imp) for (const f of imp.spostare) { try { f.moveTo(imp.caricati); } catch (e) { console.warn('Non spostato: ' + f.getName()); } }
  if (importati) console.log('PDF importati dalla cartella "' + CONFIG.CARTELLA_IMPORTA + '": ' + importati);
  const incompleti = finale.documenti.filter(d => d.testoCompleto === false).length;
  if (letti) console.log('PDF caricati dall\'app letti con OCR: ' + letti);
  console.log('Nuovi documenti: ' + nuovi + ' – totale: ' + finale.documenti.length +
              ' – con testo incompleto: ' + incompleti +
              (interrotto ? ' (continua alla prossima esecuzione)' : ' (archivio completo)'));
}

/**
 * Link privato per l'app: restituisce l'archivio (odg_database.json) così l'app
 * lo scarica da sola, senza passare dall'app File.
 * Si attiva con: Esegui il deployment → Nuovo deployment → App web
 * (Esegui come: Me · Chi ha accesso: Chiunque). L'indirizzo /exec che ottieni è
 * lungo e casuale: chi non lo conosce non può scaricare niente. Non condividerlo.
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.pdf) return json_(pdfPerApp_(p.pdf));
  const db = leggiDb_(cartellaPrincipale_());
  db.versioneScript = VERSIONE_SCRIPT;
  db.account = accountGoogle_();
  return json_(db);
}

/** Riceve dall'app i PDF caricati dal dispositivo (e le eliminazioni). */
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); }
  catch (x) { return json_({ ok: false, errore: 'Richiesta non valida' }); }
  try {
    if (req.azione === 'carica') return json_(caricaDaApp_(req));
    if (req.azione === 'elimina') return json_(eliminaDaApp_(req));
    return json_({ ok: false, errore: 'Azione sconosciuta' });
  } catch (err) {
    return json_({ ok: false, errore: String(err) });
  }
}

function caricaDaApp_(r) {
  let nome = String(r.nome || 'documento.pdf').replace(/[\\/]/g, '_');
  if (!/\.pdf$/i.test(nome)) nome += '.pdf';
  const cartella = cartellaPrincipale_();
  const blob = Utilities.newBlob(Utilities.base64Decode(r.base64), 'application/pdf', nome);
  const url = salvaPdf_(sottocartella_(cartella, CONFIG.CARTELLA_CARICATI), blob, nome);
  const testo = pulisci_(r.testo || '');
  const doc = {
    id: 'caricato|' + nome,
    tipo: ['ODG', 'DDS', 'COMUNICAZIONE', 'ALTRO'].indexOf(r.tipo) >= 0 ? r.tipo : 'ALTRO',
    numero: (r.numero === null || r.numero === '' || isNaN(r.numero)) ? null : Number(r.numero),
    data: /^\d{4}-\d{2}-\d{2}$/.test(r.data || '') ? r.data : Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd'),
    titolo: String(r.titolo || nome.replace(/\.pdf$/i, '')),
    file: nome, allegatoDi: '', testo: testo, pagine: r.pagine || null,
    testoCompleto: testo ? true : null, daOcr: !testo, origine: 'caricato',
    oggettoEmail: '', dataEmail: '', gmail: '', pdf: url,
    caricatoIl: new Date().toISOString()
  };
  const lock = LockService.getScriptLock(); lock.waitLock(60000);
  try {
    const db = leggiDb_(cartella);
    const esistente = db.documenti.find(d => d.id === doc.id || d.file === nome);
    if (esistente) return { ok: true, doc: esistente, gia: true };
    db.documenti.push(doc);
    db.eliminati = (db.eliminati || []).filter(id => id !== doc.id);
    db.aggiornato = new Date().toISOString();
    scriviDb_(cartella, db);
    return { ok: true, doc: doc };
  } finally { lock.releaseLock(); }
}

function eliminaDaApp_(r) {
  const cartella = cartellaPrincipale_();
  const lock = LockService.getScriptLock(); lock.waitLock(60000);
  try {
    const db = leggiDb_(cartella);
    const d = db.documenti.find(x => x.id === r.id);
    if (!d) return { ok: true };
    if (d.origine !== 'caricato') return { ok: false, errore: 'Si possono eliminare solo i PDF caricati dall\'app' };
    db.documenti = db.documenti.filter(x => x !== d);
    db.eliminati = db.eliminati || [];
    if (db.eliminati.indexOf(d.id) < 0) db.eliminati.push(d.id);
    db.aggiornato = new Date().toISOString();
    scriviDb_(cartella, db);
    try { DriveApp.getFileById(idDaUrl_(d.pdf)).setTrashed(true); } catch (e) {}
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** Invia all'app un PDF dell'archivio (solo file dentro la cartella "ODG Archivio"). */
function pdfPerApp_(id) {
  try {
    const f = DriveApp.getFileById(id);
    const radice = cartellaPrincipale_().getId();
    let dentro = false;
    const genitori = f.getParents();
    while (genitori.hasNext() && !dentro) {
      const g = genitori.next();
      if (g.getId() === radice) dentro = true;
      const nonni = g.getParents();
      while (nonni.hasNext()) if (nonni.next().getId() === radice) dentro = true;
    }
    if (!dentro) return { ok: false, errore: 'Il file non fa parte della cartella ODG Archivio' };
    return { ok: true, nome: f.getName(), base64: Utilities.base64Encode(f.getBlob().getBytes()) };
  } catch (err) { return { ok: false, errore: 'PDF non trovato su Drive (' + String(err).slice(0, 120) + ')' }; }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Crea il trigger che esegue "aggiorna" ogni ora. */
function installaAggiornamentoAutomatico() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'aggiorna')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('aggiorna').timeBased().everyHours(1).create();
  console.log('Aggiornamento automatico attivo (ogni ora).');
}

// ------------------------------------------------ avviso sul telefono (Telegram)

/** Esegui una volta (dopo aver premuto Avvia nel bot): collega la chat, programma 9 e 18, manda una prova. */
function attivaAvvisi() {
  const pr = PropertiesService.getScriptProperties();
  const token = (TELEGRAM_TOKEN || '').trim() || pr.getProperty('tg_token');
  if (!token || !/^\d+:[\w-]{20,}$/.test(token))
    throw new Error('Incolla in TELEGRAM_TOKEN il token che ti ha dato @BotFather, salva e riesegui.');
  const me = telegram_(token, 'getMe', {});
  const agg = telegram_(token, 'getUpdates', {});
  const chat = (agg || []).map(u => (u.message || u.my_chat_member || {}).chat).filter(c => c && c.type === 'private').pop();
  if (!chat && !pr.getProperty('tg_chat'))
    throw new Error('Apri in Telegram il bot @' + me.username + ', premi "Avvia" (o scrivigli "ciao") e poi riesegui attivaAvvisi.');
  pr.setProperty('tg_token', token);
  if (chat) pr.setProperty('tg_chat', String(chat.id));
  pr.deleteProperty('ntfy_canale');
  if (!pr.getProperty('avviso_ultimo')) pr.setProperty('avviso_ultimo', new Date().toISOString());
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'avvisaNuovi')
    .forEach(t => ScriptApp.deleteTrigger(t));
  for (const h of CONFIG.AVVISI_ORE)
    ScriptApp.newTrigger('avvisaNuovi').timeBased().atHour(h).nearMinute(0).everyDays(1)
      .inTimezone('Europe/Rome').create();
  inviaAvviso_('✅ Avvisi Archivio ODG attivi',
    'Riceverai un messaggio verso le ' + CONFIG.AVVISI_ORE.join(' e verso le ') + ' solo quando arrivano documenti nuovi.');
  console.log('AVVISI ATTIVI con il bot @' + me.username + ' (chat ' + pr.getProperty('tg_chat') + '). Ti è arrivato un messaggio di prova in Telegram.');
}

/** Spegne gli avvisi. */
function disattivaAvvisi() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'avvisaNuovi')
    .forEach(t => ScriptApp.deleteTrigger(t));
  console.log('Avvisi disattivati.');
}

/** Gira alle 9 e alle 18: legge le email arrivate e avvisa solo se ci sono documenti nuovi. */
async function avvisaNuovi() {
  const pr = PropertiesService.getScriptProperties();
  if (!pr.getProperty('tg_chat')) return;
  try { await aggiorna(); } catch (e) { console.warn('Aggiornamento prima dell\'avviso non riuscito: ' + e); }
  const ultimo = pr.getProperty('avviso_ultimo') || new Date().toISOString();
  const db = leggiDb_(cartellaPrincipale_());
  const nuovi = db.documenti.filter(d => d.aggiuntoIl && d.aggiuntoIl > ultimo && d.origine !== 'caricato');
  // il prossimo avviso parte dall'ultimo documento visto qui (nessun doppione, nessun buco)
  const visto = db.documenti.reduce((m, d) => (d.aggiuntoIl && d.aggiuntoIl > m ? d.aggiuntoIl : m), ultimo);
  if (!nuovi.length) { pr.setProperty('avviso_ultimo', visto); console.log('Nessun documento nuovo: nessun avviso.'); return; }

  // solo i tipi presenti, senza numeri né conteggi
  const nomi = { ODG: 'ODG', DDS: 'DDS', COMUNICAZIONE: 'Comunicazioni' };
  const tipi = [];
  for (const d of nuovi) {
    const t = nomi[d.tipo] || 'Documenti';
    if (tipi.indexOf(t) < 0) tipi.push(t);
  }
  const ordine = ['ODG', 'DDS', 'Comunicazioni', 'Documenti'];
  tipi.sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
  const elenco = tipi.length > 1 ? tipi.slice(0, -1).join(', ') + ' e ' + tipi[tipi.length - 1] : tipi[0];
  inviaAvviso_('🔔 Archivio ODG', 'Ci sono nuovi ' + elenco);
  pr.setProperty('avviso_ultimo', visto);   // solo dopo l'invio riuscito: se fallisce, riprova al giro dopo
  console.log('Avviso inviato: ' + elenco);
}

/** Prova manuale: manda subito un messaggio. */
function provaAvviso() {
  inviaAvviso_('Prova Archivio ODG', 'Se leggi questo messaggio gli avvisi funzionano.');
  console.log('Messaggio di prova inviato.');
}

function inviaAvviso_(titolo, testo) {
  const pr = PropertiesService.getScriptProperties();
  const token = pr.getProperty('tg_token'), chat = pr.getProperty('tg_chat');
  if (!token || !chat) throw new Error('Esegui prima "attivaAvvisi"');
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  telegram_(token, 'sendMessage', {
    chat_id: chat, parse_mode: 'HTML', text: '<b>' + esc(titolo) + '</b>\n' + esc(testo),
    reply_markup: { inline_keyboard: [[{ text: 'Apri l\'archivio', url: CONFIG.APP_URL }]] }
  });
}

function telegram_(token, metodo, dati) {
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + metodo, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(dati), muteHttpExceptions: true
  });
  let j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (!j.ok) throw new Error('Telegram (' + metodo + ') ha risposto ' + r.getResponseCode() + ': ' +
    (j.description || r.getContentText().slice(0, 200)) + (r.getResponseCode() === 401 ? ' – controlla il token' : ''));
  return j.result;
}

/** Ricomincia da zero (cancella il database, non i PDF salvati). */
function azzeraDatabase() {
  const it = cartellaPrincipale_().getFilesByName(CONFIG.FILE_DB);
  while (it.hasNext()) it.next().setTrashed(true);
  console.log('Database azzerato: esegui "aggiorna" per ricostruirlo.');
}

/** Rilegge solo i documenti il cui testo risulta incompleto. */
async function rileggiIncompleti() {
  const inizio = Date.now();
  const cartella = cartellaPrincipale_();
  const db = leggiDb_(cartella);
  const modifiche = {};
  let sistemati = 0;
  for (const d of db.documenti) {
    if (d.testoCompleto !== false || !d.pdf) continue;
    if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) break;
    try {
      const blob = DriveApp.getFileById(idDaUrl_(d.pdf)).getBlob();
      const e = await estraiTestoCompleto_(blob, d.file);
      if (e.testo.length >= (d.testo || '').length) {
        modifiche[d.id] = { testo: e.testo, pagine: e.pagine, testoCompleto: e.completo }; sistemati++;
      }
    } catch (err) { console.warn('Non riletto: ' + d.file + ' – ' + err); }
  }
  salvaUnendo_(cartella, [], modifiche);
  console.log('Documenti riletti: ' + sistemati);
}

// ------------------------------------------------------- allegati del messaggio

/** Tutti i PDF del messaggio: allegati diretti + PDF dentro i .zip. */
function pdfDelMessaggio_(msg) {
  const out = [];
  for (const att of msg.getAttachments({ includeInlineImages: false })) {
    const nome = att.getName() || '';
    if (/\.pdf$/i.test(nome)) {
      out.push({ nome: nome, chiave: nome, blob: att.copyBlob().setName(nome), zip: '' });
    } else if (CONFIG.LEGGI_ZIP && /\.zip$/i.test(nome)) {
      try {
        const zipBlob = att.copyBlob().setContentType('application/zip');
        for (const f of Utilities.unzip(zipBlob)) {
          const interno = (f.getName() || '').split('/').pop();
          if (!/\.pdf$/i.test(interno)) continue;
          out.push({ nome: interno, chiave: nome + '/' + f.getName(),
                     blob: f.setContentType('application/pdf').setName(interno), zip: nome });
        }
      } catch (e) { console.warn('Zip non leggibile: ' + nome + ' – ' + e); }
    }
  }
  return out;
}

// ------------------------------------------------------- estrazione testo

/** Testo integrale del PDF: divide in blocchi da ≤10 pagine e ≤2 MB e li legge tutti. */
async function estraiTestoCompleto_(blob, nome) {
  let blocchi, pagine = null;
  try {
    caricaPdfLib_();
    const r = await dividiPdf_(blob, nome);
    blocchi = r.blocchi; pagine = r.pagine;
  } catch (e) {
    // Se il PDF non si può dividere (es. protetto), lo legge intero: per i PDF
    // fino a 10 pagine il risultato è comunque completo.
    console.warn('Divisione non riuscita, lettura diretta: ' + nome + ' – ' + e);
    blocchi = [{ blob: blob, pagine: null }];
  }

  const parti = [];
  let lette = 0, completo = true;
  for (let i = 0; i < blocchi.length; i++) {
    const b = blocchi[i];
    try {
      parti.push(ocr_(b.blob, nome + ' (parte ' + (i + 1) + ')'));
      lette += b.pagine || 0;
      if (b.pagine && b.pagine > CONFIG.PAGINE_PER_BLOCCO) completo = false;
      if (b.blob.getBytes().length > 2 * 1024 * 1024) completo = false;
    } catch (e) {
      completo = false;
      console.warn('Blocco ' + (i + 1) + ' non letto: ' + nome + ' – ' + e);
    }
  }
  // Pagine sconosciute (PDF non divisibile): il testo è sicuramente completo solo
  // se il PDF ha ≤10 pagine, cosa che qui non si può verificare → "da verificare".
  if (pagine === null) completo = completo ? null : false;
  return { testo: pulisci_(parti.join('\n\n')), pagine: pagine, pagineLette: lette,
           completo: completo };
}

/** Converte un PDF in Google Doc (con OCR), ne legge il testo e cancella la copia. */
function ocr_(blob, nome) {
  let fileId;
  if (Drive.Files.create) {            // Drive API v3
    fileId = Drive.Files.create(
      { name: 'tmp_' + nome, mimeType: 'application/vnd.google-apps.document' },
      blob, { ocrLanguage: 'it' }).id;
  } else {                             // Drive API v2
    fileId = Drive.Files.insert(
      { title: 'tmp_' + nome, mimeType: 'application/vnd.google-apps.document' },
      blob, { ocr: true, ocrLanguage: 'it' }).id;
  }
  try {
    return DocumentApp.openById(fileId).getBody().getText();
  } finally {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
  }
}

/** Carica la libreria pdf-lib (serve solo per dividere i PDF in blocchi). */
function caricaPdfLib_() {
  if (typeof PDFLib !== 'undefined') return;
  // Apps Script non ha setTimeout (pdf-lib lo usa per "fare una pausa"):
  // lo sostituiamo con un'esecuzione immediata.
  if (typeof globalThis.setTimeout !== 'function') {
    globalThis.setTimeout = function (fn, ms) { if (ms) Utilities.sleep(ms); fn(); return 0; };
  }
  const codice = UrlFetchApp.fetch(CONFIG.PDF_LIB).getContentText();
  (0, eval)(codice);   // eval globale: definisce PDFLib
}

/** Divide un PDF in blocchi di ≤10 pagine; un blocco >2 MB viene diviso ancora. */
async function dividiPdf_(blob, nome) {
  const sorgente = await PDFLib.PDFDocument.load(new Uint8Array(blob.getBytes()),
                                                 { ignoreEncryption: true });
  const n = sorgente.getPageCount();
  if (n <= CONFIG.PAGINE_PER_BLOCCO && blob.getBytes().length <= CONFIG.MAX_BYTE_BLOCCO) {
    return { pagine: n, blocchi: [{ blob: blob, pagine: n }] };
  }
  const blocchi = [];
  async function crea(da, a) {                 // pagine [da, a)
    const doc = await PDFLib.PDFDocument.create();
    const idx = []; for (let i = da; i < a; i++) idx.push(i);
    (await doc.copyPages(sorgente, idx)).forEach(p => doc.addPage(p));
    const bytes = await doc.save();
    const b = Utilities.newBlob(Array.from(new Int8Array(bytes)), 'application/pdf',
                                nome.replace(/\.pdf$/i, '') + '_p' + (da + 1) + '-' + a + '.pdf');
    if (b.getBytes().length > CONFIG.MAX_BYTE_BLOCCO && a - da > 1) {
      const meta = da + Math.ceil((a - da) / 2);
      await crea(da, meta); await crea(meta, a);
    } else {
      blocchi.push({ blob: b, pagine: a - da });
    }
  }
  for (let i = 0; i < n; i += CONFIG.PAGINE_PER_BLOCCO) {
    await crea(i, Math.min(n, i + CONFIG.PAGINE_PER_BLOCCO));
  }
  return { pagine: n, blocchi: blocchi };
}

// ------------------------------------------------------------------ helper

/**
 * Cartella "Da importare": ogni PDF viene letto, aggiunto all'archivio come
 * documento caricato e spostato in "Caricati dall'app". Gli .zip vengono
 * aperti e i PDF che contengono vengono rimessi nella cartella per il giro.
 */
async function importaDaCartella_(cartella, db, inizio) {
  const da = sottocartella_(cartella, CONFIG.CARTELLA_IMPORTA);
  const caricati = sottocartella_(cartella, CONFIG.CARTELLA_CARICATI);
  const nomiPresenti = new Set(db.documenti.map(d => d.file).filter(Boolean));
  const idPresenti = new Set(db.documenti.map(d => d.id));
  const aggiunti = [], spostare = [];
  let interrotto = false;

  // prima gli zip: estrae i PDF nella stessa cartella
  const zips = da.getFiles();
  while (zips.hasNext()) {
    const f = zips.next();
    if (!/\.zip$/i.test(f.getName())) continue;
    if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) return { aggiunti, spostare, caricati, interrotto: true };
    try {
      const zipNome = f.getName();
      for (const x of Utilities.unzip(f.getBlob().setContentType('application/zip'))) {
        const interno = (x.getName() || '').split('/').pop();
        if (!/\.pdf$/i.test(interno) || nomiPresenti.has(interno)) continue;
        // il nome dello zip dà numero e data agli allegati (come per le email)
        const m = analizzaNome_(interno, null, '');
        const nomeFinale = m.tipo === 'ALTRO' && analizzaNome_(zipNome.replace(/\.zip$/i, '.pdf'), null, '').tipo !== 'ALTRO'
          ? zipNome.replace(/\.zip$/i, '') + ' [allegato] ' + interno : interno;
        da.createFile(x.setContentType('application/pdf').setName(nomeFinale));
      }
      f.moveTo(sottocartella_(da, 'Zip elaborati'));
    } catch (e) { console.warn('Zip non leggibile: ' + f.getName() + ' – ' + e); f.moveTo(sottocartella_(da, 'Non riconosciuti')); }
  }

  const files = da.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const nome = f.getName();
    if (!/\.pdf$/i.test(nome) && f.getMimeType() !== 'application/pdf') {
      if (!/\.zip$/i.test(nome)) f.moveTo(sottocartella_(da, 'Non riconosciuti'));
      continue;
    }
    const id = 'caricato|' + nome;
    if (nomiPresenti.has(nome) || idPresenti.has(id)) { f.moveTo(sottocartella_(da, 'Già presenti')); continue; }
    if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) { interrotto = true; break; }

    let estratto = { testo: '', pagine: null, completo: false };
    try { estratto = await estraiTestoCompleto_(f.getBlob().setContentType('application/pdf'), nome); }
    catch (e) { console.warn('Testo non estratto: ' + nome + ' – ' + e); }
    const meta = analizzaNome_(nome, null, '');
    const zip = nome.match(/^(.*) \[allegato\] /);
    if (zip) { const mz = analizzaNome_(zip[1] + '.pdf', null, '');
      if (mz.tipo !== 'ALTRO') { meta.tipo = mz.tipo; meta.numero = mz.numero; meta.data = mz.data; meta.dataSicura = true; meta.titolo = 'Allegato: ' + nome.slice(zip[0].length).replace(/\.pdf$/i, ''); } }
    if (!meta.dataSicura) { const dt = dataDaTesto_(estratto.testo); if (dt) meta.data = dt;
      else meta.data = Utilities.formatDate(f.getDateCreated(), 'Europe/Rome', 'yyyy-MM-dd'); }

    spostare.push(f);   // si sposta in "Caricati dall'app" solo dopo aver salvato l'archivio
    aggiunti.push({
      id: id, tipo: meta.tipo, numero: meta.numero, data: meta.data, titolo: meta.titolo,
      file: nome, allegatoDi: zip ? zip[1] + '.zip' : '', testo: estratto.testo, pagine: estratto.pagine,
      testoCompleto: estratto.completo, daOcr: false, origine: 'caricato', importato: true,
      oggettoEmail: '', dataEmail: '', gmail: '', pdf: f.getUrl(), caricatoIl: new Date().toISOString()
    });
    nomiPresenti.add(nome); idPresenti.add(id);
  }
  return { aggiunti, spostare, caricati, interrotto };
}

/** Data del documento cercata nelle prime righe del testo (es. "Sondrio, 12 marzo 2023" o "12/03/2023"). */
function dataDaTesto_(testo) {
  const t = String(testo || '').slice(0, 4000);
  const MESI_LUNGHI = { gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6, luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12 };
  const a = t.match(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2}|19\d{2})\b/i);
  const b = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2}|19\d{2})\b/);
  const pa = a ? t.indexOf(a[0]) : Infinity, pb = b ? t.indexOf(b[0]) : Infinity;
  let g, m, y;
  if (pa <= pb && a) { g = +a[1]; m = MESI_LUNGHI[a[2].toLowerCase()]; y = +a[3]; }
  else if (b) { g = +b[1]; m = +b[2]; y = +b[3]; }
  else return '';
  if (!(m >= 1 && m <= 12 && g >= 1 && g <= 31)) return '';
  return y + '-' + pad_(m) + '-' + pad_(g);
}

function analizzaNome_(nome, msg, zip) {
  const base = nome.replace(/\.pdf$/i, '').trim();
  const re = /^(ODG|DDS|COMUNICAZIONE|COMUNICAZIONI|DG)[_\s]*(\d+)[_\s]*del[_\s]*(\d{1,2})[_\s]*([a-z]{3})[a-z]*[_\s]*(\d{4})\s*-?\s*(.*)$/i;
  // I PDF dentro uno zip prendono numero e data dal nome dello zip.
  const m = base.match(re) || (zip ? zip.replace(/\.zip$/i, '').trim().match(re) : null);
  if (m) {
    const mese = MESI[m[4].toLowerCase()] || 1;
    let tipo = m[1].toUpperCase();
    if (tipo.indexOf('COMUNICAZION') === 0) tipo = 'COMUNICAZIONE';
    if (tipo === 'DG') tipo = 'ODG';
    const titolo = base.match(re) ? (m[6] || base) : ('Allegato: ' + base);
    return {
      tipo: tipo,
      numero: parseInt(m[2], 10),
      data: m[5] + '-' + pad_(mese) + '-' + pad_(parseInt(m[3], 10)),
      titolo: titolo.replace(/''/g, '"').trim(),
      dataSicura: true
    };
  }
  const t = base.match(/\b(ODG|DDS|COMUNICAZ\w*)\b/i);
  const n = base.match(/(\d{1,4})/);
  return {
    tipo: t ? (t[1].toUpperCase().indexOf('COMUNICAZ') === 0 ? 'COMUNICAZIONE' : t[1].toUpperCase()) : 'ALTRO',
    numero: n ? parseInt(n[1], 10) : null,
    data: msg ? Utilities.formatDate(msg.getDate(), 'Europe/Rome', 'yyyy-MM-dd') : '',
    titolo: base.replace(/_/g, ' '),
    dataSicura: !!msg
  };
}

function salvaPdf_(cartella, blob, nome) {
  try {
    const it = cartella.getFilesByName(nome);   // niente doppioni
    if (it.hasNext()) return it.next().getUrl();
    return cartella.createFile(blob.copyBlob().setName(nome)).getUrl();
  } catch (e) { return ''; }
}

function pulisci_(s) {
  return String(s || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function cartellaPrincipale_() {
  const it = DriveApp.getFoldersByName(CONFIG.CARTELLA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.CARTELLA);
}

function sottocartella_(padre, nome) {
  const it = padre.getFoldersByName(nome);
  return it.hasNext() ? it.next() : padre.createFolder(nome);
}

/** Scrive il database rileggendolo un attimo prima, così non si perde ciò che
 *  l'app ha caricato nel frattempo. Un blocco evita scritture contemporanee. */
function salvaUnendo_(cartella, aggiunti, modifiche, completo, nuoveEmail) {
  const lock = LockService.getScriptLock(); lock.waitLock(60000);
  try {
    const db = leggiDb_(cartella);
    const ids = new Set(db.documenti.map(d => d.id));
    const ora = new Date().toISOString();
    for (const d of aggiunti) if (!ids.has(d.id)) { if (!d.aggiuntoIl) d.aggiuntoIl = ora; db.documenti.push(d); }
    for (const d of db.documenti) if (modifiche[d.id]) Object.assign(d, modifiche[d.id]);
    if (nuoveEmail) Object.assign(db.email, nuoveEmail);
    db.aggiornato = new Date().toISOString();
    if (completo !== undefined) db.completo = completo;
    scriviDb_(cartella, db);
    return db;
  } finally { lock.releaseLock(); }
}

/** Indirizzo Gmail del proprietario dell'archivio (serve per aprire l'email giusta). */
function accountGoogle_() {
  try { return cartellaPrincipale_().getOwner().getEmail(); } catch (e) { return ''; }
}
let ACCOUNT_CACHE_ = null;
function linkEmail_(idMsg) {
  if (ACCOUNT_CACHE_ === null) ACCOUNT_CACHE_ = accountGoogle_();
  return 'https://mail.google.com/mail/' + (ACCOUNT_CACHE_ ? '?authuser=' + encodeURIComponent(ACCOUNT_CACHE_) : 'u/0/') + '#all/' + idMsg;
}

/** Dati dell'email da mostrare nell'app (testo limitato per non appesantire l'archivio). */
function infoEmail_(msg) {
  const testo = String(msg.getPlainBody() || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return {
    oggetto: msg.getSubject(),
    data: Utilities.formatDate(msg.getDate(), 'Europe/Rome', "yyyy-MM-dd'T'HH:mm"),
    mittente: msg.getFrom(),
    testo: testo.length > 6000 ? testo.slice(0, 6000) + '…' : testo
  };
}

function idDaUrl_(url) { return (String(url || '').match(/[-\w]{25,}/) || [])[0]; }

function leggiDb_(cartella) {
  const it = cartella.getFilesByName(CONFIG.FILE_DB);
  if (it.hasNext()) {
    try {
      const db = JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
      db.documenti = db.documenti || []; db.eliminati = db.eliminati || []; db.email = db.email || {};
      return db;
    } catch (e) {}
  }
  return { formato: 'odg-archivio-1', aggiornato: null, completo: false, documenti: [], eliminati: [], email: {} };
}

/** Scrive il database come file (anche oltre 10 MB, con il testo integrale). */
function scriviDb_(cartella, db) {
  db.documenti.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.numero || 0) - (a.numero || 0));
  const blob = Utilities.newBlob(JSON.stringify(db), 'application/json', CONFIG.FILE_DB);
  const it = cartella.getFilesByName(CONFIG.FILE_DB);
  if (it.hasNext()) {
    const id = it.next().getId();
    if (Drive.Files.create) Drive.Files.update({}, id, blob);           // v3
    else Drive.Files.update({ title: CONFIG.FILE_DB }, id, blob);       // v2
  } else {
    cartella.createFile(blob);
  }
}

function pad_(n) { return (n < 10 ? '0' : '') + n; }
