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
