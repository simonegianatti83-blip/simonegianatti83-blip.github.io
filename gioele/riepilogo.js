/* =====================================================================
   Gioele – RIEPILOGO SANITARIO IN PDF (per pediatra e medici)
   Anamnesi + cronologia dalla nascita: ricoveri, pronto soccorso,
   visite specialistiche, esami di laboratorio (con valori fuori norma
   e andamento), esami strumentali, vaccinazioni, visite dal pediatra.
   Facoltativo: copia dei documenti in fondo, come allegati numerati.
   ===================================================================== */
"use strict";

function caricaPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  return caricaScript("../pdf-lib.min.js").then(() => window.PDFLib);
}

/* i caratteri standard del PDF non hanno emoji e alcuni simboli */
const EXTRA_WINANSI = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function pdfTesto(s) {
  return String(s ?? "")
    .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/→/g, "->").replace(/↑/g, "(alto)").replace(/↓/g, "(basso)")
    .replace(/÷/g, "-").replace(/\t/g, " ").replace(/\r/g, "")
    .replace(/[^\n\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, "")
    .replace(/ {2,}/g, " ");
}
const dIt = iso => { if (!iso) return ""; const [a, m, g] = iso.split("-"); return `${g}/${m}/${a}`; };

class Scrittore {
  constructor(pdf, lib, font, fontB) {
    this.pdf = pdf; this.lib = lib; this.f = font; this.fb = fontB;
    this.W = 595.28; this.H = 841.89; this.M = 46;
    this.col = { brand: lib.rgb(0.055, 0.455, 0.43), ink: lib.rgb(0.1, 0.16, 0.15), muted: lib.rgb(0.38, 0.45, 0.44), bad: lib.rgb(0.7, 0.12, 0.1), line: lib.rgb(0.82, 0.87, 0.86), soft: lib.rgb(0.93, 0.96, 0.955) };
    this.pagine = []; this.nuovaPagina();
  }
  nuovaPagina() { this.p = this.pdf.addPage([this.W, this.H]); this.pagine.push(this.p); this.y = this.H - this.M; }
  spazio(h) { if (this.y - h < this.M + 18) { this.nuovaPagina(); return true; } return false; }
  larghezza(t, size, font) { return font.widthOfTextAtSize(t, size); }
  spezza(testo, size, font, L) {
    const out = [];
    for (const par of pdfTesto(testo).split("\n")) {
      let riga = "";
      for (let parola of par.split(" ")) {
        while (this.larghezza(parola, size, font) > L) {   // parole lunghissime
          let n = parola.length; while (n > 1 && this.larghezza(parola.slice(0, n), size, font) > L) n--;
          if (riga) { out.push(riga); riga = ""; }
          out.push(parola.slice(0, n)); parola = parola.slice(n);
        }
        const prova = riga ? riga + " " + parola : parola;
        if (this.larghezza(prova, size, font) > L && riga) { out.push(riga); riga = parola; } else riga = prova;
      }
      out.push(riga);
    }
    return out;
  }
  testo(t, { size = 9.5, bold = false, color, indent = 0, gap = 2.6, larg } = {}) {
    if (!t) return;
    const font = bold ? this.fb : this.f, L = larg || this.W - 2 * this.M - indent;
    for (const r of this.spezza(t, size, font, L)) {
      this.spazio(size + gap); this.y -= size;
      if (r) this.p.drawText(r, { x: this.M + indent, y: this.y, size, font, color: color || this.col.ink });
      this.y -= gap;
    }
  }
  campo(etichetta, valore) {
    if (!valore) return;
    const font = this.fb, size = 9.5, w = 118;
    const righe = this.spezza(valore, size, this.f, this.W - 2 * this.M - w);
    this.spazio(size + 3);
    this.p.drawText(pdfTesto(etichetta), { x: this.M, y: this.y - size, size: 8.5, font, color: this.col.muted });
    for (const r of righe) { this.spazio(size + 3); this.y -= size; this.p.drawText(r, { x: this.M + w, y: this.y, size, font: this.f, color: this.col.ink }); this.y -= 3; }
  }
  titolo(t, sotto) {
    this.spazio(60); this.y -= 14;
    this.p.drawText(pdfTesto(t), { x: this.M, y: this.y - 12, size: 12.5, font: this.fb, color: this.col.brand });
    this.y -= 17;
    this.p.drawLine({ start: { x: this.M, y: this.y }, end: { x: this.W - this.M, y: this.y }, thickness: 0.8, color: this.col.brand });
    this.y -= 7;
    if (sotto) this.testo(sotto, { size: 8.5, color: this.col.muted });
  }
  /* tabella: colonne [{t, w}] (w in frazioni), righe di celle (stringa o {t, bold, color}) */
  tabella(colonne, righe) {
    const L = this.W - 2 * this.M, size = 8.8, pad = 4;
    const xs = []; let x = this.M; for (const c of colonne) { xs.push(x); x += c.w * L; }
    const intest = () => {
      const h = size + pad * 2;
      this.spazio(h + 20);
      this.p.drawRectangle({ x: this.M, y: this.y - h, width: L, height: h, color: this.col.soft });
      colonne.forEach((c, i) => this.p.drawText(pdfTesto(c.t), { x: xs[i] + pad, y: this.y - h + pad + 1.5, size: 8, font: this.fb, color: this.col.muted }));
      this.y -= h;
    };
    intest();
    for (const r of righe) {
      const celle = r.map((c, i) => {
        const o = typeof c === "object" && c ? c : { t: c };
        return { ...o, righe: this.spezza(o.t || "", size, o.bold ? this.fb : this.f, colonne[i].w * L - pad * 2) };
      });
      const h = Math.max(...celle.map(c => c.righe.length)) * (size + 2.4) + pad * 2 - 2;
      if (this.spazio(h)) intest();
      celle.forEach((c, i) => c.righe.forEach((riga, k) => riga && this.p.drawText(riga, {
        x: xs[i] + pad, y: this.y - pad - size - k * (size + 2.4) + 1.5, size, font: c.bold ? this.fb : this.f, color: c.color || this.col.ink })));
      this.y -= h;
      this.p.drawLine({ start: { x: this.M, y: this.y }, end: { x: this.W - this.M, y: this.y }, thickness: 0.4, color: this.col.line });
    }
    this.y -= 4;
  }
}

/* ---------- raccolta dei dati per sezione ---------- */
function datiRiepilogo(daISO) {
  const oggi = oggiISO();
  const nelPeriodo = x => (x.data || "") >= daISO && (x.data || "") <= oggi;
  const visite = visiteAttive().filter(v => v.stato !== "annullata" && nelPeriodo(v)).sort((a, b) => (a.data + (a.ora || "")).localeCompare(b.data + (b.ora || "")));
  const docs = docSanitari().filter(d => !d.data || nelPeriodo(d)).sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const docsDi = v => docs.filter(d => d.visitaId === v.id);
  const vis = t => visite.filter(v => t.includes(v.tipo));
  const sciolti = cats => docs.filter(d => cats.includes(d.categoria) && !visite.some(v => v.id === d.visitaId && ["ps", "ricovero", "ospedale", "specialista"].includes(v.tipo)));
  const prossime = visiteAttive().filter(v => v.stato !== "annullata" && v.data > oggi).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 6);
  return {
    ricoveri: [...vis(["ps", "ricovero", "ospedale"]).map(v => ({ v })), ...sciolti(["ps", "dimissione"]).map(d => ({ d }))],
    specialisti: [...vis(["specialista"]).map(v => ({ v })), ...sciolti(["visita"]).map(d => ({ d }))],
    laboratorio: docs.filter(d => d.categoria === "esami"),
    labSenzaDoc: vis(["esami"]).filter(v => !docsDi(v).some(d => ["esami", "imaging"].includes(d.categoria))),
    imaging: docs.filter(d => d.categoria === "imaging"),
    vaccini: [...vis(["vaccino"]).map(v => ({ v })), ...docs.filter(d => d.categoria === "vaccini" && !visite.some(v => v.id === d.visitaId && v.tipo === "vaccino")).map(d => ({ d }))],
    pediatra: vis(["pediatra", "bilancio"]),
    altri: vis(["altro"]),
    docs, docsDi, prossime
  };
}
const ordina = l => l.sort((a, b) => ((a.v || a.d).data || "").localeCompare((b.v || b.d).data || ""));
function quando(x) { return x.dataFine ? `dal ${dIt(x.data)}\nal ${dIt(x.dataFine)}` : dIt(x.data); }

/* ---------- creazione del PDF ---------- */
async function creaRiepilogoPdf({ da, allegati, note, avanzamento }) {
  const lib = await caricaPdfLib();
  const pdf = await lib.PDFDocument.create();
  pdf.setTitle("Riepilogo sanitario – Gioele"); pdf.setAuthor("Genitori di Gioele"); pdf.setCreator("App Gioele");
  const f = await pdf.embedFont(lib.StandardFonts.Helvetica), fb = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  const w = new Scrittore(pdf, lib, f, fb);
  const p = S.profilo, R = datiRiepilogo(da);
  const numAllegato = new Map();   // doc.id -> n
  if (allegati) R.docs.filter(d => (d.files || []).length).forEach((d, i) => numAllegato.set(d.id, i + 1));
  const rifDoc = d => numAllegato.has(d.id) ? ` [All. ${numAllegato.get(d.id)}]` : "";
  const elencoDoc = l => l.length ? "Documenti: " + l.map(d => d.titolo + rifDoc(d)).join("; ") : "";

  /* intestazione */
  w.p.drawRectangle({ x: 0, y: w.H - 92, width: w.W, height: 92, color: w.col.brand });
  w.p.drawText("Riepilogo sanitario", { x: w.M, y: w.H - 44, size: 21, font: fb, color: lib.rgb(1, 1, 1) });
  w.p.drawText(pdfTesto(`${p.cognome ? p.nome + " " + p.cognome : "Gioele"}${p.nascita ? " · nato il " + dIt(p.nascita) + " (" + eta(p.nascita) + ")" : ""}`), { x: w.M, y: w.H - 66, size: 11.5, font: f, color: lib.rgb(1, 1, 1) });
  w.p.drawText(pdfTesto(`Aggiornato al ${dIt(oggiISO())} · periodo ${da <= (p.nascita || da) ? "dalla nascita" : "dal " + dIt(da)} a oggi`), { x: w.M, y: w.H - 82, size: 8.5, font: f, color: lib.rgb(0.85, 0.95, 0.93) });
  w.y = w.H - 108;
  w.testo("Documento compilato dai genitori a partire dai referti in loro possesso. Non sostituisce la documentazione clinica originale" + (allegati ? ", riportata in copia negli allegati." : "."), { size: 8, color: w.col.muted });

  if (note) { w.titolo("Motivo del consulto / note dei genitori"); w.testo(note, { size: 10 }); }

  w.titolo("Dati del bambino");
  w.campo("Nome", [p.nome || "Gioele", p.cognome].filter(Boolean).join(" "));
  w.campo("Data di nascita", p.nascita ? `${dIt(p.nascita)}${p.luogoNascita ? " – " + p.luogoNascita : ""} (età ${eta(p.nascita)})` : "");
  w.campo("Codice fiscale", p.cf);
  const ts = docPersonali().find(d => d.categoria === "tessera" && d.numero && d.numero !== p.cf);
  if (ts) w.campo("Tessera sanitaria", `n. ${ts.numero}${ts.scadenza ? " (scade il " + dIt(ts.scadenza) + ")" : ""}`);
  w.campo("Gruppo sanguigno", p.sangue);
  w.campo("Pediatra di famiglia", `${PEDIATRA.nome} – ${PEDIATRA.studi.map(s => s.indirizzo).join(" / ")}`);
  w.campo("Genitori", p.genitori);

  w.titolo("Anamnesi");
  w.campo("Allergie / intolleranze", p.allergie || "Nessuna nota");
  w.campo("Gravidanza e parto", p.perinatale);
  w.campo("Alla nascita", [p.pesoNascita && "peso " + p.pesoNascita, p.settimane && p.settimane + " settimane", p.apgar && "Apgar " + p.apgar].filter(Boolean).join(" · "));
  w.campo("Patologie / problemi noti", p.patologie);
  w.campo("Interventi chirurgici", p.interventi);
  w.campo("Terapie in corso", p.terapie);
  w.campo("Familiarità", p.familiarita);
  w.campo("Sviluppo / altre note", p.note);
  const ultimi = R.ricoveri.length + R.specialisti.length + R.laboratorio.length + R.imaging.length;
  w.campo("Sintesi", `${R.ricoveri.length} tra ricoveri e accessi in ospedale/PS, ${R.specialisti.length} visite specialistiche, ${R.laboratorio.length} esami di laboratorio, ${R.imaging.length} esami strumentali, ${R.pediatra.length} visite/consulti dal pediatra${ultimi ? "" : ""}.`);

  /* ricoveri e PS */
  if (R.ricoveri.length) {
    w.titolo("Ricoveri e accessi al Pronto Soccorso", "In ordine cronologico.");
    w.tabella([{ t: "Data", w: .14 }, { t: "Tipo / struttura", w: .3 }, { t: "Motivo, diagnosi ed esito", w: .56 }], ordina(R.ricoveri).map(({ v, d }) => {
      if (v) return [quando(v), { t: `${{ ps: "Pronto soccorso", ricovero: "Ricovero", ospedale: "Ospedale" }[v.tipo]}\n${v.luogo || ""}${v.medico ? "\n" + v.medico : ""}`, bold: false },
        [v.motivo && "Motivo: " + v.motivo, v.esito && "Esito: " + v.esito, v.note, elencoDoc(R.docsDi(v))].filter(Boolean).join("\n")];
      const a = d.analisi || {};
      return [quando({ data: d.data, dataFine: a.dataFine }), `${d.categoria === "ps" ? "Pronto soccorso" : "Ricovero"}\n${d.struttura || a.struttura || ""}${a.reparto ? "\n" + a.reparto : ""}`,
        [a.motivo && "Motivo: " + a.motivo, a.diagnosi && "Diagnosi: " + a.diagnosi, a.codicePS && "Codice triage: " + a.codicePS, d.note, "Documento: " + d.titolo + rifDoc(d)].filter(Boolean).join("\n")];
    }));
  }

  /* visite specialistiche */
  if (R.specialisti.length) {
    w.titolo("Visite specialistiche");
    w.tabella([{ t: "Data", w: .14 }, { t: "Specialista", w: .3 }, { t: "Motivo, conclusioni e indicazioni", w: .56 }], ordina(R.specialisti).map(({ v, d }) => {
      if (v) return [dIt(v.data), `${v.medico || "—"}${v.luogo ? "\n" + v.luogo : ""}`, [v.motivo && "Motivo: " + v.motivo, v.esito && "Esito: " + v.esito, v.note, elencoDoc(R.docsDi(v))].filter(Boolean).join("\n")];
      const a = d.analisi || {};
      return [dIt(d.data), `${a.specialita || d.titolo}${d.struttura ? "\n" + d.struttura : ""}`, [a.motivo && "Motivo: " + a.motivo, a.diagnosi && "Conclusioni: " + a.diagnosi, d.note, "Documento: " + d.titolo + rifDoc(d)].filter(Boolean).join("\n")];
    }));
  }

  /* laboratorio */
  if (R.laboratorio.length || R.labSenzaDoc.length) {
    w.titolo("Esami di laboratorio", "Valori letti automaticamente dai referti: in rosso quelli fuori dall'intervallo di riferimento del laboratorio. Fa fede il referto originale.");
    const righe = [
      ...R.laboratorio.map(d => {
        const e = d.analisi?.esami || [], fuori = e.filter(x => x.fuori);
        const txt = !e.length ? (d.note || "Valori non letti automaticamente: vedere il referto.")
          : fuori.length ? "Fuori norma: " + fuori.map(x => `${x.nome} ${x.cmp || ""}${x.valore}${x.unita ? " " + x.unita : ""} (rif. ${x.rif})`).join("; ")
          : `Tutti i ${e.length} valori letti sono nei limiti di riferimento.`;
        return { data: d.data, r: [dIt(d.data), `${d.titolo}${d.struttura ? "\n" + d.struttura : ""}${rifDoc(d)}`, { t: txt + (e.length && d.note ? "\n" + d.note : ""), color: fuori.length ? w.col.bad : undefined }] };
      }),
      ...R.labSenzaDoc.map(v => ({ data: v.data, r: [dIt(v.data), v.luogo || v.medico || "Esami", [v.motivo, v.esito].filter(Boolean).join("\n") || "Referto non caricato"] }))
    ].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    w.tabella([{ t: "Data", w: .14 }, { t: "Esame / laboratorio", w: .3 }, { t: "Risultati", w: .56 }], righe.map(x => x.r));

    /* andamento dei parametri ripetuti */
    const serie = new Map();
    for (const d of R.laboratorio) for (const x of d.analisi?.esami || []) {
      const k = x.nome.toLowerCase().replace(/\s+/g, " ").replace(/[^a-zà-ú0-9 %#]/g, "").trim();
      if (!serie.has(k)) serie.set(k, { nome: x.nome, unita: x.unita, rif: x.rif, v: [] });
      serie.get(k).v.push({ data: d.data, valore: (x.cmp || "") + x.valore, fuori: x.fuori });
    }
    const ripetuti = [...serie.values()].filter(s => s.v.length >= 2);
    if (ripetuti.length) {
      const date = [...new Set(ripetuti.flatMap(s => s.v.map(x => x.data)))].sort().slice(-5);
      w.y -= 6; w.testo("Andamento dei parametri ripetuti (ultimi " + date.length + " prelievi; * = fuori norma)", { size: 9.5, bold: true });
      const wd = .62 / date.length;
      w.tabella([{ t: "Parametro (unità, rif.)", w: .38 }, ...date.map(d => ({ t: dIt(d), w: wd }))],
        ripetuti.slice(0, 40).map(s => [`${s.nome}${s.unita ? " (" + s.unita + ")" : ""}${s.rif ? "\nrif. " + s.rif : ""}`,
          ...date.map(dt => { const x = s.v.find(y => y.data === dt); return x ? { t: x.valore + (x.fuori ? " *" : ""), bold: x.fuori, color: x.fuori ? w.col.bad : undefined } : "–"; })]));
    }
  }

  /* imaging */
  if (R.imaging.length) {
    w.titolo("Esami strumentali (ecografie, radiografie, ECG…)");
    w.tabella([{ t: "Data", w: .14 }, { t: "Esame / struttura", w: .3 }, { t: "Conclusioni", w: .56 }],
      R.imaging.map(d => [dIt(d.data), `${d.titolo}${d.struttura ? "\n" + d.struttura : ""}${rifDoc(d)}`, [d.analisi?.diagnosi, d.note].filter(Boolean).join("\n") || "Vedere il referto."]));
  }

  /* vaccini */
  if (R.vaccini.length) {
    w.titolo("Vaccinazioni");
    w.tabella([{ t: "Data", w: .14 }, { t: "Vaccinazione", w: .4 }, { t: "Note", w: .46 }], ordina(R.vaccini).map(({ v, d }) => v
      ? [dIt(v.data), v.motivo || "Vaccinazione", [v.luogo, v.esito, v.note, elencoDoc(R.docsDi(v))].filter(Boolean).join("\n")]
      : [dIt(d.data), (d.analisi?.vaccini || []).join(", ") || d.titolo, [d.note, "Documento: " + d.titolo + rifDoc(d)].filter(Boolean).join("\n")]));
  }

  /* pediatra */
  if (R.pediatra.length) {
    w.titolo("Visite, bilanci di salute e consulti dal pediatra");
    w.tabella([{ t: "Data", w: .14 }, { t: "Tipo", w: .22 }, { t: "Motivo ed esito", w: .64 }], R.pediatra.map(v => [dIt(v.data),
      v.tipo === "bilancio" ? "Bilancio di salute" : /telefon/i.test(v.luogo || "") ? "Consulto telefonico" : "Visita",
      [v.motivo && "Motivo: " + v.motivo, v.esito && "Esito: " + v.esito, v.note, elencoDoc(R.docsDi(v))].filter(Boolean).join("\n") || "—"]));
  }
  if (R.altri.length) {
    w.titolo("Altre prestazioni");
    w.tabella([{ t: "Data", w: .14 }, { t: "Dove / chi", w: .3 }, { t: "Note", w: .56 }], R.altri.map(v => [dIt(v.data), [v.luogo, v.medico].filter(Boolean).join("\n"), [v.motivo, v.esito, v.note].filter(Boolean).join("\n")]));
  }
  if (R.prossime.length) {
    w.titolo("Prossimi appuntamenti");
    w.tabella([{ t: "Data", w: .2 }, { t: "Visita", w: .8 }], R.prossime.map(v => [`${dIt(v.data)}${v.ora ? " " + v.ora : ""}`, `${etichettaVisita(v)}${v.luogo ? " – " + v.luogo : ""}${v.motivo ? "\n" + v.motivo : ""}`]));
  }

  /* indice allegati */
  const lista = R.docs.filter(d => numAllegato.has(d.id));
  if (lista.length) {
    w.titolo("Allegati", "Copia dei documenti riportata nelle pagine seguenti.");
    w.tabella([{ t: "N.", w: .08 }, { t: "Data", w: .14 }, { t: "Documento", w: .78 }], lista.map(d => [String(numAllegato.get(d.id)), dIt(d.data), `${d.titolo}${d.struttura && !d.titolo.includes(d.struttura) ? " – " + d.struttura : ""}`]));
  }

  /* numeri di pagina del riepilogo */
  const tot = w.pagine.length;
  w.pagine.forEach((pg, i) => pg.drawText(pdfTesto(`Gioele – riepilogo sanitario del ${dIt(oggiISO())} · pagina ${i + 1} di ${tot}`), { x: w.M, y: 22, size: 7.5, font: f, color: w.col.muted }));

  /* allegati */
  const mancanti = [];
  for (const [i, d] of lista.entries()) {
    avanzamento && avanzamento(`Allego ${i + 1} di ${lista.length}: ${d.titolo}`, i / lista.length);
    const n = numAllegato.get(d.id), etichetta = pdfTesto(`Allegato ${n} – ${d.titolo}${d.data ? " – " + dIt(d.data) : ""}`);
    const timbro = pg => { const { width, height } = pg.getSize(); pg.drawRectangle({ x: 0, y: height - 16, width, height: 16, color: lib.rgb(1, 1, 1), opacity: .85 }); pg.drawText(etichetta.slice(0, 110), { x: 10, y: height - 11.5, size: 7.5, font: fb, color: w.col.brand }); };
    for (const fl of d.files) {
      let b; try { b = await blobAllegato(fl); } catch { b = null; }
      if (!b) { mancanti.push(d.titolo); continue; }
      try {
        if (fl.mime === "application/pdf") {
          let src;
          try { src = await lib.PDFDocument.load(await b.arrayBuffer(), { ignoreEncryption: true }); } catch { src = null; }
          if (src) { const pp = await pdf.copyPages(src, src.getPageIndices()); pp.forEach(pg => { pdf.addPage(pg); timbro(pg); }); }
          else { for (const jpg of await pdfInImmagini(b)) await paginaImmagine(pdf, lib, jpg, timbro); }
        } else await paginaImmagine(pdf, lib, b, timbro);
      } catch (e) { console.warn(e); mancanti.push(d.titolo); }
    }
  }
  const bytes = await pdf.save();
  return { bytes, mancanti, pagineRiepilogo: tot };
}
async function paginaImmagine(pdf, lib, blob, timbro) {
  let img;
  if (blob.type === "image/png") img = await pdf.embedPng(await blob.arrayBuffer());
  else if (blob.type === "image/jpeg") img = await pdf.embedJpg(await blob.arrayBuffer());
  else {   // altri formati: si converte in JPG
    const bm = await createImageBitmap(blob), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height;
    c.getContext("2d").drawImage(bm, 0, 0);
    img = await pdf.embedJpg(await (await new Promise(r => c.toBlob(r, "image/jpeg", .85))).arrayBuffer());
  }
  const W = 595.28, H = 841.89, m = 24, k = Math.min((W - 2 * m) / img.width, (H - 2 * m - 14) / img.height, 1.5);
  const pg = pdf.addPage([W, H]);
  pg.drawImage(img, { x: (W - img.width * k) / 2, y: (H - 14 - img.height * k) / 2, width: img.width * k, height: img.height * k });
  timbro(pg);
}
async function pdfInImmagini(blob) {   // PDF protetti: si allegano come immagini
  const lib = await libPdfjs(), doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise, out = [];
  for (let i = 1; i <= Math.min(doc.numPages, 15); i++) {
    const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1.6 }), c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    out.push(await new Promise(r => c.toBlob(r, "image/jpeg", .85)));
  }
  return out;
}
