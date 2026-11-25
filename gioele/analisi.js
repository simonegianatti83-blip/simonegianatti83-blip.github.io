/* =====================================================================
   Gioele – LETTURA AUTOMATICA DEI DOCUMENTI
   1) estrae il testo: dai PDF digitali (Fascicolo Sanitario) con pdf.js,
      da foto e PDF scansionati con l'OCR (Tesseract, lingua italiana);
   2) capisce che documento è (esami del sangue, visita, pronto soccorso,
      ricovero, ecografia/RX, vaccinazioni, ricetta, impegnativa, certificato);
   3) ricava data, struttura, reparto, specialità, diagnosi e i valori
      degli esami di laboratorio (segnando quelli fuori dai limiti).
   Tutto avviene sul telefono: il testo non viene inviato a nessuno.
   ===================================================================== */
"use strict";

/* ---------- caricamento librerie (solo quando servono) ---------- */
let _pdfjs = null;
async function libPdfjs() {
  if (_pdfjs) return _pdfjs;
  await import("../compat.mjs");
  _pdfjs = await import("../pdf.min.mjs");
  _pdfjs.GlobalWorkerOptions.workerSrc = new URL("../pdf.worker.app.mjs", location.href).href;
  return _pdfjs;
}
function caricaScript(src) {
  return new Promise((ok, ko) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return ok();
    const s = document.createElement("script"); s.src = src; s.dataset.src = src;
    s.onload = ok; s.onerror = () => { s.remove(); ko(new Error("Impossibile caricare " + src + " (sei offline?)")); };
    document.head.appendChild(s);
  });
}
let _ocr = null, _ocrProgresso = null;
async function workerOcr() {
  if (_ocr) return _ocr;
  _ocr = (async () => {
    await caricaScript("ocr/tesseract.min.js");
    const base = new URL("ocr/", location.href).href;
    return Tesseract.createWorker("ita", 1, {
      workerPath: base + "worker.min.js", corePath: base, langPath: base + "lang",
      logger: m => _ocrProgresso && _ocrProgresso(m)
    });
  })();
  try { return await _ocr; } catch (e) { _ocr = null; throw e; }
}
async function ocr(immagine, avanzamento) {
  const w = await workerOcr();
  _ocrProgresso = m => { if (m.status === "recognizing text" && avanzamento) avanzamento(m.progress); };
  try { const r = await w.recognize(immagine); return r.data.text || ""; }
  finally { _ocrProgresso = null; }
}

/* ---------- estrazione del testo ---------- */
function righeDaItems(items) {
  const righe = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    let r = righe.find(r => Math.abs(r.y - y) <= 2.5);
    if (!r) { r = { y, parti: [] }; righe.push(r); }
    r.parti.push({ x: it.transform[4], s: it.str, w: it.width || 0 });
  }
  righe.sort((a, b) => b.y - a.y);
  return righe.map(r => {
    r.parti.sort((a, b) => a.x - b.x);
    let s = "", fine = null;
    for (const p of r.parti) {
      if (fine != null) { const gap = p.x - fine; if (gap > 9) s += "   "; else if (gap > 1.2 && !s.endsWith(" ")) s += " "; }
      s += p.s; fine = p.x + p.w;
    }
    return s.replace(/\s+$/, "");
  }).filter(Boolean).join("\n");
}
async function testoDaPdf(blob, avanzamento) {
  const lib = await libPdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const parti = [];
  for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
    const pg = await doc.getPage(i);
    parti.push(righeDaItems((await pg.getTextContent()).items));
  }
  let testo = parti.join("\n"), metodo = "pdf";
  if (testo.replace(/\s/g, "").length < 80) {   // PDF scansionato: si legge l'immagine
    metodo = "ocr"; testo = "";
    const n = Math.min(doc.numPages, 4);
    for (let i = 1; i <= n; i++) {
      const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 2 });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      testo += await ocr(c, p => avanzamento && avanzamento(`Leggo la scansione, pagina ${i} di ${n}`, (i - 1 + p) / n)) + "\n";
    }
  }
  return { testo, metodo, pagine: doc.numPages };
}
async function testoDaImmagine(blob, avanzamento, etichetta) {
  let src = blob;
  if (!/^image\/(jpeg|png|webp|bmp|gif)$/.test(blob.type)) {   // es. HEIC: si prova a convertirla
    try { const bm = await createImageBitmap(blob); const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; c.getContext("2d").drawImage(bm, 0, 0); src = c; }
    catch { throw new Error("Formato immagine non leggibile: fai una foto in JPG"); }
  }
  return ocr(src, p => avanzamento && avanzamento(etichetta, p));
}
/* legge tutti i file del documento (max 6 immagini) */
async function estraiTestoFiles(files, avanzamento) {
  let testo = "", metodo = "pdf";
  const img = files.filter(f => /^image\//.test(f.mime)).slice(0, 6);
  for (const f of files.filter(f => f.mime === "application/pdf")) {
    avanzamento && avanzamento("Leggo il PDF…", 0);
    const r = await testoDaPdf(f.blob, avanzamento); testo += r.testo + "\n"; if (r.metodo === "ocr") metodo = "ocr";
  }
  for (const [i, f] of img.entries()) {
    metodo = "ocr";
    testo += await testoDaImmagine(f.blob, avanzamento, img.length > 1 ? `Leggo la foto ${i + 1} di ${img.length}` : "Leggo la foto") + "\n";
  }
  return { testo, metodo };
}

/* ---------- riconoscimento del tipo di documento ---------- */
const REGOLE_DOC = [
  { cat: "esami", tipo: "esami", parole: [["emocromo", 4], ["emoglobina", 3], ["leucocit", 3], ["piastrin", 3], ["ematocrito", 3], ["eritrocit", 2], ["globuli (rossi|bianchi)", 2], ["neutrofil", 2], ["linfocit", 2], ["ferritina", 3], ["sideremia", 3], ["glicemia", 2], ["creatinina", 2], ["transaminasi", 2], ["proteina c.? reattiva", 3], ["\\bpcr\\b", 2], ["\\bv\\.?e\\.?s\\.?\\b", 2], ["\\btsh\\b", 2], ["valori? di riferimento", 4], ["intervallo di riferimento", 4], ["range di riferimento", 4], ["laboratorio", 2], ["prelievo", 2], ["esame (chimico.fisico )?(delle )?urine", 3], ["urinocoltura", 3], ["sierolog", 2], ["medicina di laboratorio", 4], ["patologia clinica", 3], ["\\bmg/dl\\b", 2], ["\\bg/dl\\b", 2], ["10\\^?[39]/[lµu]", 2], ["unit[aà] di misura", 2]] },
  { cat: "ps", tipo: "ps", parole: [["pronto soccorso", 5], ["verbale di (accesso|pronto soccorso|p\\.?s\\.?)", 5], ["triage", 4], ["codice (colore|di priorit[aà]|bianco|verde|azzurro|giallo|arancione|rosso)", 4], ["osservazione breve", 3], ["ora (di )?arrivo", 3], ["modalit[aà] (di )?arrivo", 3], ["dimess[oa] a domicilio", 2], ["esito (dell')?accesso", 3]] },
  { cat: "dimissione", tipo: "ricovero", parole: [["lettera di dimissione", 7], ["ricover", 3], ["degenza", 4], ["data (di )?ammissione", 4], ["data (di )?(ingresso|accettazione)", 2], ["data (di )?dimissione", 3], ["diagnosi (principale )?(alla |di )?dimissione", 5], ["decorso (clinico|post)", 4], ["\\bsdo\\b", 3], ["day hospital", 3], ["terapia (alla|a domicilio|consigliata)", 2]] },
  { cat: "imaging", tipo: "esami", parole: [["ecografi", 4], ["radiografi", 4], ["\\brx\\b", 3], ["risonanza magnetica", 4], ["\\brmn?\\b", 2], ["\\btac\\b", 3], ["\\btc\\b", 1], ["tomografia", 3], ["radiolog", 3], ["ecocardiogra", 4], ["elettrocardiogramma", 4], ["\\becg\\b", 3], ["elettroencefalogramma", 4], ["\\beeg\\b", 3], ["doppler", 3], ["proiezion", 2], ["mezzo di contrasto", 2], ["diagnostica per immagini", 4], ["\\bmsk\\b", 1]] },
  { cat: "vaccini", tipo: "vaccino", parole: [["vaccinazion", 4], ["vaccin", 2], ["certificato vaccinale", 6], ["anagrafe vaccinale", 5], ["esavalente", 4], ["\\bmprv?\\b", 3], ["pneumococc", 2], ["meningococc", 2], ["rotavirus", 2], ["lotto", 1], ["richiamo", 2], ["dose", 1]] },
  { cat: "ricetta", tipo: "", parole: [["ricetta (elettronica|medica)", 4], ["promemoria per l.assistito", 3], ["\\bnre\\b", 3], ["farmac", 2], ["confezion", 3], ["posologia", 3], ["\\bmg\\b", 1], ["compress", 2], ["sciroppo", 2], ["supposte", 2]] },
  { cat: "impegnativa", tipo: "", parole: [["impegnativa", 6], ["quesito diagnostico", 5], ["classe di priorit", 4], ["priorit[aà]\\s*[:\\s]\\s*[ubdp]\\b", 3], ["prestazion[ei] richiest", 4], ["codice (della )?prestazione", 3], ["prescrizione", 1]] },
  { cat: "certificato", tipo: "", parole: [["certificat", 4], ["si certifica", 5], ["idoneit", 3], ["riammissione", 4], ["attivit[aà] sportiva", 3], ["comunit[aà] (scolastica|infantile)", 2]] },
  { cat: "visita", tipo: "specialista", parole: [["visita", 2], ["esame obiettivo", 4], ["\\be\\.?o\\.?\\s*:", 2], ["anamnesi", 2], ["conclusion[ie]", 2], ["si consiglia", 2], ["(controllo|rivalutazione) (tra|fra)", 3], ["ambulatorio di", 2], ["specialistic", 3], ["consulenza", 3], ["referto (di )?visita", 5], ["obiettivit[aà]", 3]] }
];
const SPECIALITA = [
  ["otorino|orl\\b", "Otorinolaringoiatria"], ["oculist|oftalm|ortottic", "Oculistica"], ["cardiolog|ecocardio", "Cardiologia"],
  ["dermatolog", "Dermatologia"], ["ortoped", "Ortopedia"], ["neuropsichiatr|\\bnpi\\b", "Neuropsichiatria infantile"],
  ["neurolog", "Neurologia"], ["gastroenterolog", "Gastroenterologia"], ["allergolog", "Allergologia"], ["pneumolog", "Pneumologia"],
  ["nefrolog", "Nefrologia"], ["urolog", "Urologia"], ["chirurgi", "Chirurgia"], ["endocrinolog|auxolog", "Endocrinologia"],
  ["logoped", "Logopedia"], ["fisiatr|riabilitaz", "Fisiatria"], ["odontoiatr|ortodon|dentist", "Odontoiatria"],
  ["audiolog|audiometr", "Audiologia"], ["ematolog", "Ematologia"], ["reumatolog", "Reumatologia"], ["immunolog", "Immunologia"],
  ["genetic", "Genetica medica"], ["infettiv", "Malattie infettive"], ["neonatolog|\\btin\\b|nido", "Neonatologia"], ["pediatri", "Pediatria"]
];
function conta(testo, re) { const m = testo.match(new RegExp(re, "gi")); return m ? Math.min(m.length, 3) : 0; }

function classificaTesto(testo) {
  const t = testo.toLowerCase();
  const punti = REGOLE_DOC.map(r => ({ ...r, p: r.parole.reduce((s, [re, w]) => s + conta(t, re) * w, 0) })).sort((a, b) => b.p - a.p);
  let [a, b] = punti;
  /* intestazioni che dicono già tutto */
  if (/lettera di dimissione/.test(t)) a = punti.find(x => x.cat === "dimissione");
  else if (/verbale di (accesso al )?pronto soccorso|pronto soccorso/.test(t) && punti.find(x => x.cat === "ps").p >= 9) a = punti.find(x => x.cat === "ps");
  if (a.p < 4) return { cat: "referto", tipoVisita: "", conf: "bassa" };
  const conf = a.p >= 10 && a.p >= (b.p || 0) * 1.6 ? "alta" : a.p >= 6 ? "media" : "bassa";
  return { cat: a.cat, tipoVisita: a.tipo, conf };
}

/* ---------- date ---------- */
const MESI_LUNGHI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
function trovaDate(testo) {
  const out = [], oggi = new Date(); oggi.setHours(23, 59);
  const add = (g, m, a, idx) => {
    a = +a; if (a < 100) a += a > 50 ? 1900 : 2000;
    if (m < 1 || m > 12 || g < 1 || g > 31 || a < 1990) return;
    const d = new Date(a, m - 1, g); if (d > oggi || d.getMonth() !== m - 1) return;
    const prima = testo.slice(Math.max(0, idx - 45), idx).toLowerCase();
    out.push({ iso: `${a}-${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}`, idx, prima });
  };
  for (const m of testo.matchAll(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/g)) add(+m[1], +m[2], m[3], m.index);
  for (const m of testo.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(${MESI_LUNGHI.join("|")})\\s+(\\d{4})\\b`, "gi"))) add(+m[1], MESI_LUNGHI.indexOf(m[2].toLowerCase()) + 1, m[3], m.index);
  return out;
}
function scegliData(date, nascita, cat) {
  const valide = date.filter(d => d.iso !== nascita && !/(nat[oa]|nascita|n\.\s*il|data di n)\W*$/.test(d.prima) && !/(stampa|stampato|firmat|scadenza|validit)[^\n]{0,25}$/.test(d.prima));
  if (!valide.length) return {};
  const chiave = (re) => valide.find(d => re.test(d.prima));
  let data, dataFine;
  if (cat === "dimissione") {
    data = chiave(/(ammission|ingresso|ricover|accettazion|dal)[^\n]{0,30}$/);
    dataFine = chiave(/(dimission|uscita|\bal)[^\n]{0,30}$/);
  }
  if (!data) data = chiave(/(prelievo|accettazion|esecuzion|visita|ingresso|ammission|accesso|arrivo|vaccinazion|somministrazion|esame|referto del|data referto|data:)[^\n]{0,30}$/);
  if (!data) data = valide.slice().sort((a, b) => b.iso.localeCompare(a.iso))[0];
  if (dataFine && dataFine.iso < data.iso) dataFine = null;
  return { data: data?.iso || "", dataFine: dataFine && dataFine.iso !== data.iso ? dataFine.iso : "" };
}

/* ---------- altre informazioni ---------- */
function pulisciRiga(s, max = 90) { return s.replace(/\s{2,}/g, " ").replace(/^[\s:.\-–]+|[\s:.\-–]+$/g, "").slice(0, max); }
function trovaStruttura(testo) {
  const righe = testo.split("\n").slice(0, 40);
  if (/valtellina/i.test(testo) && /asst|azienda socio/i.test(testo)) return "ASST Valtellina e Alto Lario";
  const r = righe.find(l => /\b(ASST|ATS|Azienda|Ospedale|Presidio|Policlinico|IRCCS|Fondazione|Istituto|Laboratorio|Poliambulatorio|Casa di cura|Centro medico|Clinica|Studio medico)\b/i.test(l));
  return r ? pulisciRiga(r, 70) : "";
}
function trovaReparto(testo) {
  const m = testo.match(/\b(?:U\.?O\.?C?\.?|S\.?C\.?|S\.?S\.?D?\.?|Unit[aà] Operativa(?: Complessa| Semplice)?|Struttura Complessa|Reparto|Divisione|Servizio)\s*(?:di\s+)?([A-Za-zÀ-ú' ]{4,45})/i);
  return m ? pulisciRiga(m[1], 45).replace(/\s+(Direttore|Primario|Resp).*$/i, "") : "";
}
function trovaSpecialita(testo) {
  const t = testo.toLowerCase();
  const c = SPECIALITA.map(([re, n]) => ({ n, k: conta(t, re) })).filter(x => x.k).sort((a, b) => b.k - a.k);
  const senzaPed = c.filter(x => x.n !== "Pediatria");
  return (senzaPed[0] || c[0])?.n || "";
}
function trovaDopo(testo, etichette, max = 260, unaRiga = false) {
  const re = new RegExp(`(?:^|\\n|\\s)(?:${etichette})\\s*[:\\-–.]?[ \\t]*\\n?([\\s\\S]{4,${max + 80}})`, "i");
  const m = testo.match(re); if (!m) return "";
  let s = unaRiga ? m[1].split("\n")[0]
    : m[1].split(/\n\s*\n|\n\s*[A-ZÀ-Úa-zà-ú][A-Za-zÀ-ú'.]*(?: [A-Za-zÀ-ú'.]+){0,4}\s*:|\n\s*(?:Terapia|Esame obiettivo|Anamnesi|Data|Firma|Il medico|Dott|Controllo|Si consiglia)/)[0];
  return pulisciRiga(s.replace(/\n/g, " "), max);
}
function trovaImaging(testo) {
  const m = testo.match(/\b(ecografia|radiografia|rx|risonanza magnetica|rmn?|tac|tc|ecocardiogramma|elettrocardiogramma|ecg|eeg|ecodoppler)\b[^\S\n]*(?:del(?:la|lo|l'|le|i)?|di|dell')?[^\S\n]*([a-zà-ú' ]{3,35})?/i);
  if (!m) return "";
  const nomi = { rx: "Radiografia", rm: "Risonanza magnetica", rmn: "Risonanza magnetica", tac: "TAC", tc: "TAC", ecg: "Elettrocardiogramma", eeg: "Elettroencefalogramma" };
  const tipo = nomi[m[1].toLowerCase()] || m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const parte = (m[2] || "").trim().split(/\s{2,}|\s(?:in|con|per|eseguit|del|data|a\b)/)[0].trim();
  return parte && parte.length > 2 && !/^(paziente|sig|nato|data)/i.test(parte) ? `${tipo} ${/^[aeiou]/i.test(parte) ? "dell'" : "di "}${parte}`.replace("di l'", "dell'") : tipo;
}

/* ---------- valori di laboratorio ---------- */
const NUM = "\\d+(?:[.,]\\d+)?";
const aNum = s => parseFloat(String(s).replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
function estraiValori(testo) {
  const out = [], visti = new Set();
  for (const riga0 of testo.split("\n")) {
    const riga = riga0.replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
    if (riga.length < 6 || riga.length > 140 || /\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}/.test(riga)) continue;
    const mNome = riga.match(/^([A-Za-zÀ-ú][A-Za-zÀ-ú0-9 .,'()%#+\/\-]{1,55}?)\s*[:=]?\s+([<>]?\s?\*?\s?\d)/);
    if (!mNome) continue;
    let nome = mNome[1].replace(/[\s.:\-]+$/, "").trim();
    if (nome.length < 2 || !/[a-zà-ú]{2}/i.test(nome) || /^(?:(?:pag|tel|fax|cap|via|codice|cod|nr|prot|ora|data|et[aà]|sesso|peso|altezza|referto|richiesta|campione|esame|risultato)\b|n\.)/i.test(nome)) continue;
    const resto = riga.slice(mNome[0].length - 1 - (mNome[2].length - 1));
    const mVal = resto.match(new RegExp(`^\\s*([<>])?\\s*\\*?\\s*(${NUM})\\s*(\\*|H\\b|L\\b|↑|↓|\\+|alto|basso)?\\s*(.*)$`, "i"));
    if (!mVal) continue;
    const valore = aNum(mVal[2]); if (isNaN(valore)) continue;
    let coda = mVal[4] || "", min = null, max = null, unita = "";
    const mRange = coda.match(new RegExp(`[\\[(]?\\s*(${NUM})\\s*(?:-|–|÷|a)\\s*(${NUM})\\s*[\\])]?`));
    const mSoglia = coda.match(new RegExp(`(<|>|≤|≥|<=|>=|inferiore a|superiore a|fino a)\\s*(${NUM})`, "i"));
    if (mRange) { min = aNum(mRange[1]); max = aNum(mRange[2]); unita = coda.slice(0, mRange.index); }
    else if (mSoglia) { const v = aNum(mSoglia[2]); if (/<|≤|inferiore|fino/.test(mSoglia[1])) max = v; else min = v; unita = coda.slice(0, mSoglia.index); }
    else continue;   // senza intervallo di riferimento non lo considero un valore di laboratorio
    if (min != null && max != null && min > max) continue;
    unita = unita.replace(/[\[(]\s*$/, "").trim().slice(0, 16);
    if (unita && !/^[a-zA-Zµ%\/\^0-9.*·x ]+$/.test(unita)) unita = "";
    const flag = (mVal[3] || "").toLowerCase();
    let fuori = (min != null && valore < min) || (max != null && valore > max);
    if (/^(\*|h|l|↑|↓|alto|basso)$/.test(flag)) fuori = true;
    const k = nome.toLowerCase();
    if (visti.has(k)) continue; visti.add(k);
    out.push({ nome, valore: mVal[2].replace(/\s/g, ""), cmp: mVal[1] || "", unita, min, max, fuori,
      rif: min != null && max != null ? `${mRange[1]}–${mRange[2]}` : mSoglia ? `${mSoglia[1]} ${mSoglia[2]}` : "" });
    if (out.length >= 120) break;
  }
  return out;
}

/* ---------- analisi completa ---------- */
function analizzaTesto(testo, nascita) {
  const cls = classificaTesto(testo);
  const { data, dataFine } = scegliData(trovaDate(testo), nascita, cls.cat);
  const an = { ...cls, data, dataFine, struttura: trovaStruttura(testo), reparto: trovaReparto(testo), specialita: trovaSpecialita(testo) };
  an.diagnosi = trovaDopo(testo, "diagnosi(?: principale| di dimissione| alla dimissione| conclusiva| finale)?|conclusion[ie](?: diagnostiche)?|conclusione diagnostica|giudizio diagnostico|impressione diagnostica");
  an.motivo = trovaDopo(testo, "motivo (?:dell'accesso|della visita|del ricovero|della richiesta)|quesito(?: diagnostico| clinico)?|problema principale|sintomo principale|disturbo riferito", 160, true);
  if (cls.cat === "ps") { const m = testo.match(/codice\s*(?:colore|di\s*priorit[aà]|triage)?\s*(?:in\s*uscita|di\s*uscita|in\s*ingresso|d'ingresso)?\s*[:\-]?\s*(bianco|verde|azzurro|giallo|arancione|rosso|[1-5]\b)/i); if (m) an.codicePS = m[1].toLowerCase(); }
  if (cls.cat === "esami") an.esami = estraiValori(testo);
  if (cls.cat === "imaging") an.imaging = trovaImaging(testo);
  if (cls.cat === "vaccini") { const v = [...new Set((testo.match(/\b(esavalente|pneumococc\w*|meningococc\w* ?[ab]?|rotavirus|morbillo|parotite|rosolia|varicella|mprv?|tetano|difterite|pertosse|polio\w*|epatite ?[ab]|influenza\w*|covid\w*|hpv|dtpa?)\b/gi) || []).map(x => x.toLowerCase()))]; an.vaccini = v.slice(0, 12); }
  an.titolo = titoloDa(an);
  return an;
}
function titoloDa(an) {
  const corto = s => (s || "").replace(/^(ASST|Azienda Socio Sanitaria Territoriale)\s*/i, "ASST ").split(/\s{2,}| - /)[0].slice(0, 40);
  switch (an.cat) {
    case "esami": {
      const e = an.esami || [];
      if (e.some(x => /emoglobin|leucocit|piastrin|emocromo|eritrocit/i.test(x.nome)) || !e.length) return "Esami del sangue";
      if (e.some(x => /urin|ph|peso specifico/i.test(x.nome))) return "Esame urine";
      return "Esami di laboratorio";
    }
    case "ps": return "Accesso al Pronto Soccorso" + (an.struttura ? " – " + corto(an.struttura) : "");
    case "dimissione": return "Ricovero" + (an.reparto ? " – " + an.reparto : an.struttura ? " – " + corto(an.struttura) : "");
    case "imaging": return an.imaging || "Esame strumentale";
    case "visita": return "Visita " + (an.specialita && an.specialita !== "Pediatria" ? an.specialita.toLowerCase() : "specialistica");
    case "vaccini": return "Vaccinazioni";
    case "ricetta": return "Ricetta";
    case "impegnativa": return "Impegnativa" + (an.motivo ? " – " + an.motivo.slice(0, 40) : "");
    case "certificato": return "Certificato";
    default: return "";
  }
}
/* punto di ingresso usato dall'app */
async function analizzaFiles(files, nascita, avanzamento) {
  const { testo, metodo } = await estraiTestoFiles(files, avanzamento);
  const an = analizzaTesto(testo, nascita);
  return { ...an, metodo, caratteri: testo.replace(/\s/g, "").length, testo: testo.replace(/[ \t]{2,}/g, "  ").slice(0, 8000) };
}

/* =====================================================================
   DOCUMENTI PERSONALI (non sanitari): certificato di nascita, tessera
   sanitaria, carta d'identità, passaporto, residenza, ISEE, esenzioni…
   ===================================================================== */
const REGOLE_PERS = [
  { cat: "nascita", parole: [["atto di nascita", 6], ["certificato di nascita", 7], ["estratto (per riassunto )?(dell'|dal )?(atto|registro)", 3], ["registr[oi] (degli atti )?di nascita", 5], ["ufficiale dello stato civile", 4], ["stato civile", 2], ["[eè] nat[oa]", 2], ["nascita", 1]] },
  { cat: "tessera", parole: [["tessera sanitaria", 7], ["tessera europea", 5], ["\\bteam\\b", 2], ["codice fiscale", 3], ["ministero dell.economia", 3], ["agenzia (delle )?entrate", 3], ["\\b80380\\d{10,}", 4]] },
  { cat: "identita", parole: [["carta (d.|di )identit", 7], ["\\bcie\\b", 3], ["identity card", 5], ["statura", 2], ["cittadinanza", 2], ["valida per l.espatrio", 4], ["\\bc[a-z]\\d{5}[a-z]{2}\\b", 4]] },
  { cat: "passaporto", parole: [["passaporto", 7], ["passport", 6], ["p<ita", 6]] },
  { cat: "residenza", parole: [["certificato di residenza", 7], ["residenza", 3], ["stato di famiglia", 7], ["certificato anagrafico", 5], ["anagrafe", 2]] },
  { cat: "isee", parole: [["\\bisee\\b", 6], ["\\bdsu\\b", 4], ["assegno unico", 6], ["\\binps\\b", 3], ["bonus (nido|asilo)", 5]] },
  { cat: "esenzione", parole: [["esenzione", 5], ["invalidit", 4], ["legge 104", 6], ["104/92", 6], ["handicap", 3], ["indennit[aà] di (frequenza|accompagnamento)", 5]] },
  { cat: "assicurazione", parole: [["polizza", 5], ["assicura", 4], ["contraente", 3], ["massimale", 3]] },
  { cat: "scuola", parole: [["iscrizione", 3], ["asilo nido", 5], ["scuola (dell.infanzia|primaria|materna)", 5], ["istituto comprensivo", 5], ["anno scolastico", 4], ["educativ", 2]] }
];
const TITOLI_PERS = { nascita: "Certificato di nascita", tessera: "Tessera sanitaria", identita: "Carta d'identità", passaporto: "Passaporto", residenza: "Certificato di residenza / stato di famiglia",
  isee: "ISEE / assegno unico", esenzione: "Esenzione / invalidità", assicurazione: "Polizza assicurativa", scuola: "Iscrizione nido / scuola" };
function tutteLeDate(testo) {   // come trovaDate, ma tiene anche le date future (scadenze)
  const out = [];
  const add = (g, m, a, idx) => {
    a = +a; if (a < 100) a += a > 50 ? 1900 : 2000;
    if (m < 1 || m > 12 || g < 1 || g > 31 || a < 1990 || a > 2100) return;
    const d = new Date(a, m - 1, g); if (d.getMonth() !== m - 1) return;
    out.push({ iso: `${a}-${String(m).padStart(2, "0")}-${String(g).padStart(2, "0")}`, idx, prima: testo.slice(Math.max(0, idx - 45), idx).toLowerCase() });
  };
  for (const m of testo.matchAll(/\b(\d{1,2})[\/.\-\s](\d{1,2})[\/.\-\s](\d{4})\b/g)) add(+m[1], +m[2], m[3], m.index);
  for (const m of testo.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(${MESI_LUNGHI.join("|")})\\s+(\\d{4})\\b`, "gi"))) add(+m[1], MESI_LUNGHI.indexOf(m[2].toLowerCase()) + 1, m[3], m.index);
  return out;
}
/* codice fiscale: corregge gli scambi tipici dell'OCR e verifica il carattere di controllo */
const CF_DISPARI = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };
function cfValido(cf) {
  let s = 0;
  for (let i = 0; i < 15; i++) { const c = cf[i]; s += i % 2 === 0 ? CF_DISPARI[c] : (/\d/.test(c) ? +c : c.charCodeAt(0) - 65); }
  return String.fromCharCode(65 + (s % 26)) === cf[15];
}
const CF_RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
/* data di nascita contenuta nel codice fiscale (per capire se il codice è di Gioele o di un genitore) */
const CF_MESI = "ABCDEHLMPRST", CF_OMO = "LMNPQRSTUV";
function dataDaCF(cf) {
  const n = s => [...s].map(c => /\d/.test(c) ? c : String(CF_OMO.indexOf(c))).join("");
  const aa = +n(cf.slice(6, 8)), mm = CF_MESI.indexOf(cf[8]) + 1; let gg = +n(cf.slice(9, 11));
  if (!mm || isNaN(aa) || isNaN(gg)) return null;
  if (gg > 40) gg -= 40;
  return { aa, mm, gg };
}
function cfCoerente(cf, nascita) {   // true / false / null (non verificabile)
  if (!cf || !nascita || !CF_RE.test(cf)) return null;
  const d = dataDaCF(cf); if (!d) return false;
  const [a, m, g] = nascita.split("-").map(Number);
  return d.aa === a % 100 && d.mm === m && d.gg === g;
}
/* corregge gli scambi tipici dell'OCR (I/1, O/0, B/8…) secondo la posizione nel codice */
function correggiCF(c) {
  const aLettera = { 0: "O", 1: "I", 2: "Z", 4: "A", 5: "S", 6: "G", 8: "B" }, aCifra = { O: "0", D: "0", I: "1", B: "8", G: "6", Z: "2" };
  const posLettere = new Set([0, 1, 2, 3, 4, 5, 8, 11, 15]);
  return [...c].map((ch, k) => posLettere.has(k) ? (aLettera[ch] || ch) : (aCifra[ch] || ch)).join("");
}
/* Cerca il codice fiscale SOLO dove è indicato come tale ("Codice fiscale", "Cod. fisc.", "C.F.", "CF").
   Se nel documento ce ne sono più di uno (es. genitore e figlio), sceglie quello con la data di nascita di Gioele.
   Senza etichetta accetta solo un codice scritto per intero, isolato e con il carattere di controllo giusto. */
function trovaCodiceFiscale(T, nascita) {
  const candidati = [];
  const etichetta = /(?:CODICE\s*FISCALE|COD\.?\s*FISC(?:ALE)?\.?|C\.\s?F\.?|\bCF\b|FISCAL\s*CODE|TAX\s*CODE)\s*(?:DEL\s+\w+\s*)?[:.\-]?\s*(?:N\.?|NR\.?|N°)?\s*/g;
  for (const m of T.matchAll(etichetta)) {
    const dopo = T.slice(m.index + m[0].length, m.index + m[0].length + 30).split("\n")[0];
    /* il codice può essere scritto con qualche spazio in mezzo: si prendono i primi 16 caratteri utili */
    const grezzo = dopo.replace(/[^A-Z0-9]/g, "").slice(0, 16);
    if (grezzo.length < 16) continue;
    const corr = correggiCF(grezzo);
    if (CF_RE.test(corr)) candidati.push({ cf: corr, ok: cfValido(corr), etichetta: true });
  }
  if (!candidati.length) {
    for (const m of T.matchAll(/(?:^|[^A-Z0-9])([A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z])(?![A-Z0-9])/g))
      if (cfValido(m[1])) candidati.push({ cf: m[1], ok: true, etichetta: false });
  }
  if (!candidati.length) return null;
  if (nascita) {   // si tiene solo il codice di Gioele
    const suo = candidati.find(c => cfCoerente(c.cf, nascita));
    return suo ? { cf: suo.cf, verificato: true } : null;
  }
  const diversi = [...new Map(candidati.map(c => [c.cf, c])).values()];
  if (diversi.length === 1) return { cf: diversi[0].cf, verificato: diversi[0].ok };
  /* più codici e data di nascita sconosciuta: il bambino è il più giovane; da far confermare */
  const yy = new Date().getFullYear() % 100;
  const chiave = c => { const d = dataDaCF(c.cf); if (!d) return ""; return `${d.aa <= yy ? 2000 + d.aa : 1900 + d.aa}-${String(d.mm).padStart(2, "0")}-${String(d.gg).padStart(2, "0")}`; };
  const piuGiovane = diversi.sort((x, y) => chiave(y).localeCompare(chiave(x)))[0];
  return { cf: piuGiovane.cf, verificato: false };
}
function analizzaTestoPersonale(testo, nascita) {
  const t = testo.toLowerCase(), T = testo.toUpperCase();
  const punti = REGOLE_PERS.map(r => ({ ...r, p: r.parole.reduce((s, [re, w]) => s + conta(t, re) * w, 0) })).sort((a, b) => b.p - a.p);
  const a = punti[0], b = punti[1];
  const an = a.p >= 4 ? { cat: a.cat, conf: a.p >= 9 && a.p >= b.p * 1.6 ? "alta" : a.p >= 6 ? "media" : "bassa" } : { cat: "altro_pers", conf: "bassa" };
  /* codice fiscale (con correzione degli errori tipici dell'OCR: O/0, I/1) */
  const cf = trovaCodiceFiscale(T, nascita || analizzaNascitaDa(testo));
  if (cf) { an.cf = cf.cf; an.cfVerificato = cf.verificato; }
  /* numero del documento */
  const num = {
    tessera: /\b(80\d{18})\b/,
    identita: /\b(C[A-Z]\s?\d{5}\s?[A-Z]{2})\b/,
    passaporto: /\b([A-Z]{2}\d{7})\b/
  }[an.cat];
  const mNum = num && T.match(num);
  if (mNum) an.numero = mNum[1].replace(/\s/g, "");
  else {
    /* il codice fiscale ha il suo campo: non va scambiato per il numero del documento */
    const eCF = v => v.length === 16 && CF_RE.test(correggiCF(v.toUpperCase()));
    for (const m of testo.matchAll(/(?:\bnumero|\bn\.|\bnr\.?|\bn°)\s*(?:del(?:la|l')?\s*)?(?:documento|tessera|polizza|atto|pratica|protocollo|registro)?\s*[:.]?\s*([A-Z0-9][A-Z0-9\/\-]{1,24})/gi))
      if (/\d/.test(m[1]) && !eCF(m[1])) { an.numero = m[1]; break; }
  }
  /* date */
  const date = tutteLeDate(testo);
  const dopo = re => date.find(d => re.test(d.prima));
  const scad = dopo(/(scadenza|scade|valid[ao]? (fino|sino) al?|expiry|date of expiry|fino al)[^\n]{0,30}$/);
  const ril = dopo(/(rilascio|rilasciat[oa]|emissione|emess[oa]|data di emissione|issue|del)[^\n]{0,30}$/);
  const nasc = dopo(/(nat[oa]|nascita|birth|nato\/a)[^\n]{0,30}$/);
  if (scad) an.scadenza = scad.iso;
  if (ril && ril.iso !== nasc?.iso && ril.iso !== scad?.iso) an.rilascio = ril.iso;
  if (nasc) an.nascita = nasc.iso;
  if (!an.rilascio && !["tessera", "identita", "passaporto"].includes(an.cat)) {   // certificati: la data più recente che non sia la nascita
    const oggi = new Date().toISOString().slice(0, 10);
    const r = date.filter(d => d.iso <= oggi && d.iso !== an.nascita && !/(nat[oa]|nascita)[^\n]{0,30}$/.test(d.prima)).sort((x, y) => y.iso.localeCompare(x.iso))[0];
    if (r) an.rilascio = r.iso;
  }
  if (!an.scadenza && ["tessera", "identita", "passaporto"].includes(an.cat)) {   // la data più lontana nel futuro è di solito la scadenza
    const fut = date.filter(d => d.iso > new Date().toISOString().slice(0, 10)).sort((x, y) => y.iso.localeCompare(x.iso))[0];
    if (fut) an.scadenza = fut.iso;
  }
  const luogo = testo.match(/nat[oa]\s+(?:a|in)\s+([A-ZÀ-Úa-zà-ú' ]{2,40}?)\s*(?:\(\s*[A-Z]{2}\s*\))?\s*(?:il|in data|,|\n)/i);
  if (luogo) an.luogoNascita = luogo[1].trim().replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w+/g, w => w.toLowerCase());
  const comune = testo.match(/\bcomune di\s+([A-ZÀ-Úa-zà-ú' ]{2,35})/i);
  an.ente = an.cat === "tessera" ? "Agenzia delle Entrate / Ministero Economia" : an.cat === "isee" ? "INPS" : comune ? "Comune di " + comune[1].trim().split(/\s{2,}|\n/)[0].replace(/\B\w+/g, w => w.toLowerCase()) : "";
  an.titolo = TITOLI_PERS[an.cat] || "";
  return an;
}
/* se Gioele non ha ancora la data di nascita, la si prende dal documento ("nato il …") */
function analizzaNascitaDa(testo) {
  const d = tutteLeDate(testo).find(x => /(nat[oa]|nascita|birth)[^\n]{0,30}$/.test(x.prima));
  return d ? d.iso : "";
}
async function analizzaFilesPersonali(files, avanzamento, nascita) {
  const { testo, metodo } = await estraiTestoFiles(files, avanzamento);
  return { ...analizzaTestoPersonale(testo, nascita), metodo, caratteri: testo.replace(/\s/g, "").length, testo: testo.replace(/[ \t]{2,}/g, "  ").slice(0, 4000) };
}
