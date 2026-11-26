/* =====================================================================
   Gioele – PASTI: poppate al seno e rinforzi (latte in ml)
   Quantità indicata per pasto = giorno di vita × incremento (regola
   data dalla pediatra/punto nascita, modificabile), 6-7 pasti nelle 24 ore.
   ===================================================================== */
"use strict";

const REGOLA_PASTI_BASE = { incremento: 10, nascitaGiorno1: false, pastiMin: 6, pastiMax: 7, maxMl: null, intervalloMin: 210, intervalloDa: "inizio", avvisoPasto: true };
function regolaPasti() {
  const c = { ...(S.config.pasti || {}) };
  if (!c.confermato) delete c.nascitaGiorno1;   // impostazione vecchia mai scelta a mano: vale la nuova (nascita non conta)
  return { ...REGOLA_PASTI_BASE, ...c };
}
const pastiOrd = () => attivi("pasti").sort((a, b) => b.quando.localeCompare(a.quando));
const SENI = { "": "—", sx: "Sinistro", dx: "Destro", entrambi: "Entrambi" };
const LATTI = { artificiale: "latte artificiale", materno: "latte materno tirato" };

/* giorni di vita usati per il calcolo: il giorno della nascita conta 0 (o 1° se scelto in "Regola") */
function giornoDiVita(iso = oggiISO()) {
  const g = giorniDiVita(iso); if (g == null || g < 0) return null;
  return g + (regolaPasti().nascitaGiorno1 ? 1 : 0);
}
function etGiorno(iso = oggiISO()) {
  const g = giornoDiVita(iso); if (g == null) return "";
  return regolaPasti().nascitaGiorno1 ? `${g}° giorno` : g === 0 ? "giorno della nascita" : g === 1 ? "1 giorno di vita" : `${g} giorni di vita`;
}
function mlPerPasto(iso = oggiISO()) {
  const r = regolaPasti(), g = giornoDiVita(iso); if (g == null) return null;
  const ml = Math.max(0, g) * r.incremento;
  return r.maxMl ? Math.min(ml, r.maxMl) : ml;
}
function giornata(iso) {
  const l = pastiOrd().filter(p => p.quando.startsWith(iso)).reverse();
  return {
    iso, pasti: l, n: l.length,
    ml: l.reduce((a, p) => a + (p.ml || 0), 0),
    minuti: l.reduce((a, p) => a + (minutiPasto(p) || 0), 0),
    poppate: l.filter(p => p.seno).length, rinforzi: l.filter(p => p.ml).length,
    obiettivo: mlPerPasto(iso)
  };
}
function prossimoSeno() {
  const u = pastiOrd().find(p => p.seno); if (!u) return "";
  const fine = u.finito || (u.seno === "entrambi" ? "" : u.seno);
  return fine === "sx" ? "dx" : fine === "dx" ? "sx" : "";
}
const nPasti = n => n + (n === 1 ? " pasto" : " pasti");
const hhmm = dt => dt ? dt.slice(11, 16) : "";
/* minuti tra due orari HH:MM (se la fine è "prima" dell'inizio si è passati la mezzanotte) */
function minutiTra(da, a) { if (!da || !a) return null; let m = min(a) - min(da); if (m < 0) m += 1440; return m; }
function piuMinuti(dt, m) { const d = daOraLocale(dt); d.setMinutes(d.getMinutes() + m); return oraLocale(d); }
const minutiPasto = p => p.minuti ?? (((p.minSx || 0) + (p.minDx || 0)) || null);
const orarioPasto = p => { const f = p.fine ? hhmm(p.fine) : minutiPasto(p) ? hhmm(piuMinuti(p.quando, minutiPasto(p))) : ""; return hhmm(p.quando) + (f && p.seno ? "–" + f : ""); };
const traQuanto = ms => { const m = Math.round(ms / 60000); return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + pad(m % 60) + " min"; };

/* ---------- cronometro della poppata (resta sul telefono) ---------- */
const poppataInCorso = () => ls.get("poppataInCorso", null);
function minutiSegmento(p) { return (Date.now() - new Date(p.dal).getTime()) / 60000; }
function avviaPoppata(seno) { ls.set("poppataInCorso", { inizio: oraLocale(), dal: new Date().toISOString(), seno, minSx: 0, minDx: 0 }); render(); }
function cambiaSeno() {
  const p = poppataInCorso(); if (!p) return;
  p[p.seno === "sx" ? "minSx" : "minDx"] += minutiSegmento(p);
  if (!p.primo) { p.primo = p.seno; p.minPrimo = p.minSx + p.minDx; }
  p.seno = p.seno === "sx" ? "dx" : "sx"; p.dal = new Date().toISOString();
  ls.set("poppataInCorso", p); render();
}
function finePoppata() {
  const p = poppataInCorso(); if (!p) return;
  p[p.seno === "sx" ? "minSx" : "minDx"] += minutiSegmento(p);
  ls.del("poppataInCorso");
  const minSx = Math.round(p.minSx), minDx = Math.round(p.minDx);
  formPasto({}, { quando: p.inizio, fine: piuMinuti(p.inizio, Math.max(1, Math.round(p.minSx + p.minDx))), seno: minSx && minDx ? "entrambi" : minDx ? "dx" : "sx", primo: p.primo || p.seno, finito: p.seno });
}
function boxCronometro() {
  const p = poppataInCorso();
  if (!p) {
    const s = prossimoSeno();
    return `<div class="card"><b>⏱️ Cronometro poppata</b>${s ? `<div class="small muted">Ultima volta ha finito col ${s === "dx" ? "sinistro" : "destro"}: oggi tocca al <b>${s === "sx" ? "sinistro" : "destro"}</b>.</div>` : ""}
      <div class="btns"><button type="button" class="btn ${s === "sx" ? "pri" : ""}" data-act="poppata-avvia" data-seno="sx">▶️ Seno sinistro</button><button type="button" class="btn ${s === "dx" ? "pri" : ""}" data-act="poppata-avvia" data-seno="dx">▶️ Seno destro</button></div></div>`;
  }
  const tot = p.minSx + p.minDx + minutiSegmento(p);
  return `<div class="card" style="border-color:var(--brand)"><b>⏱️ Poppata in corso – seno ${p.seno === "sx" ? "sinistro" : "destro"}</b>
    <div style="font-size:30px;font-weight:800" id="timerPoppata" data-dal="${esc(p.dal)}" data-base="${p.minSx + p.minDx}">${Math.floor(tot)} min</div>
    <div class="small muted">Iniziata alle ${p.inizio.slice(11)}${p.minSx ? ` · sinistro ${Math.round(p.minSx)} min` : ""}${p.minDx ? ` · destro ${Math.round(p.minDx)} min` : ""}</div>
    <div class="btns"><button type="button" class="btn" data-act="poppata-cambia">🔄 Passa al ${p.seno === "sx" ? "destro" : "sinistro"}</button><button type="button" class="btn pri" data-act="poppata-fine">⏹️ Fine</button><button type="button" class="btn bad" data-act="poppata-annulla">Annulla</button></div></div>`;
}
setInterval(() => {   // aggiorna i minuti del cronometro senza ridisegnare la pagina
  const el = document.getElementById("timerPoppata"); if (!el) return;
  el.textContent = Math.floor(+el.dataset.base + (Date.now() - new Date(el.dataset.dal).getTime()) / 60000) + " min";
}, 15000);

/* ---------- grafico: ml di rinforzo al giorno rispetto all'indicazione ---------- */
function graficoPasti(giorni = 7, { larg = 380, alt = 190, perStampa = false } = {}) {
  giorni = Math.max(1, Math.min(giorni, (giorniDiVita() ?? giorni) + 1));   // niente giorni prima della nascita
  const gg = []; for (let i = giorni - 1; i >= 0; i--) gg.push(giornata(oggiISO(new Date(Date.now() - i * 864e5))));
  const r = regolaPasti();
  const maxV = Math.max(50, ...gg.map(g => g.ml), ...gg.map(g => (g.obiettivo || 0) * r.pastiMax)) * 1.1;
  const pl = 36, pr = 8, pt = 10, pb = 34, W = larg - pl - pr, H = alt - pt - pb, bw = W / giorni;
  const Y = v => pt + H - v / maxV * H;
  const c = perStampa ? { g: "#e3ebea", t: "#455", b: "#0E746E", o: "#C2410C" } : { g: "var(--line-2)", t: "var(--ink-3)", b: "var(--brand)", o: "#E8590C" };
  let s = `<svg viewBox="0 0 ${larg} ${alt}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" role="img" aria-label="Rinforzi al giorno">`;
  if (perStampa) s += `<rect width="${larg}" height="${alt}" fill="#fff"/>`;
  const passo = maxV > 600 ? 200 : maxV > 250 ? 100 : 50;
  for (let v = 0; v <= maxV; v += passo) s += `<line x1="${pl}" x2="${pl + W}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c.g}"/><text x="${pl - 5}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="${c.t}">${v}</text>`;
  gg.forEach((g, i) => {
    const x = pl + i * bw, d = parseISO(g.iso);
    if (g.obiettivo) { const a = Y(g.obiettivo * r.pastiMax), b = Y(g.obiettivo * r.pastiMin); s += `<rect x="${x + 2}" y="${a}" width="${bw - 4}" height="${Math.max(1, b - a)}" fill="${c.o}" fill-opacity=".18"/>`; }
    if (g.ml) s += `<rect x="${x + bw * .2}" y="${Y(g.ml)}" width="${bw * .6}" height="${pt + H - Y(g.ml)}" rx="3" fill="${c.b}"/>`;
    s += `<text x="${x + bw / 2}" y="${alt - 20}" font-size="10" text-anchor="middle" fill="${c.t}">${d.getDate()}/${d.getMonth() + 1}</text><text x="${x + bw / 2}" y="${alt - 7}" font-size="10" text-anchor="middle" fill="${c.t}">${nPasti(g.n)}</text>`;
  });
  return s + `</svg>`;
}

/* ---------- vista ---------- */
function vPasti() {
  if (!S.profilo.nascita) return `<div class="notice warn">Serve la data di nascita di Gioele per calcolare le quantità. <button type="button" class="btn sm pri" data-act="pasti-nascita">Gioele è nato il 22/11/2026</button> oppure <a href="#" data-act="profilo">inseriscila qui</a>.</div>`;
  const r = regolaPasti(), oggi = giornata(oggiISO()), gdv = giornoDiVita(), ml = mlPerPasto();
  const ultimo = pastiOrd()[0], da = ultimo ? Date.now() - daOraLocale(ultimo.quando) : null;
  const in24 = pastiOrd().filter(p => Date.now() - daOraLocale(p.quando) < 864e5).length;
  const giorni = []; for (let i = 0; i < 10; i++) { const iso = oggiISO(new Date(Date.now() - i * 864e5)), g = giornata(iso); if (g.n || i === 0 || pannoliniGiorno(iso).lista.length) giorni.push(g); }
  const descr = p => [p.seno && `🤱 ${p.seno === "entrambi" && p.primo ? (p.primo === "sx" ? "sinistro → destro" : "destro → sinistro") : SENI[p.seno].toLowerCase()}${minutiPasto(p) ? ` ${minutiPasto(p)}′` : ""}${p.minSx && p.minDx ? ` (sx ${p.minSx}′, dx ${p.minDx}′)` : ""}`,
    p.ml && `🍼 ${p.ml} ml${p.latte ? " " + (p.latte === "materno" ? "materno" : "artificiale") : ""}`, p.note].filter(Boolean).join(" · ");
  return `<div class="card">
      <div class="small muted">${etGiorno()} · regola: ${r.incremento} ml in più ogni giorno</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">
        <div><div class="tiny">Per pasto</div><div style="font-size:26px;font-weight:800">${ml} ml</div></div>
        <div><div class="tiny">Nelle 24 ore (${r.pastiMin}-${r.pastiMax} pasti)</div><div style="font-size:26px;font-weight:800">${ml * r.pastiMin}–${ml * r.pastiMax} ml</div></div>
      </div>
      <div class="slot"><span>Oggi</span><b>${nPasti(oggi.n)}${oggi.ml ? ` · ${oggi.ml} ml di rinforzo` : ""}${oggi.minuti ? ` · ${oggi.minuti} min al seno` : ""}</b></div>
      <div class="slot"><span>Ultime 24 ore</span><b>${nPasti(in24)} ${in24 < r.pastiMin ? `<span class="chip warn">meno di ${r.pastiMin}</span>` : in24 > r.pastiMax + 2 ? `<span class="chip">molti</span>` : `<span class="chip ok">ok</span>`}</b></div>
      ${ultimo ? `<div class="slot"><span>Ultimo pasto</span><b>${traQuanto(da)} fa (${ultimo.quando.slice(11)})</b></div>` : ""}
      ${ultimo ? `<div style="margin-top:8px">${rigaProssimoPasto(true)}</div>` : ""}
      <div class="btns"><button type="button" class="btn pri" data-act="nuovo-pasto">🍼 Segna un pasto</button><button type="button" class="btn sm" data-act="pasti-regola">⚙️ Regola</button></div>
    </div>
    ${boxCronometro()}
    ${boxPannolini()}
    <div class="card" style="padding:8px">${graficoPasti(7)}<div class="tiny" style="padding:0 6px">Barre: ml di rinforzo al giorno. Fascia arancione: quantità indicata dalla regola (${r.pastiMin}–${r.pastiMax} pasti × ml per pasto).</div></div>
    ${giorni.map(g => { const pn = pannoliniGiorno(g.iso);
      const voci = [...g.pasti.map(p => ({ q: p.quando, html: `<div class="slot" data-act="apri-pasto" data-id="${p.id}" style="cursor:pointer"><span><b>${orarioPasto(p)}</b> ${esc(descr(p))}${p.chi ? `<br><span class="tiny">${esc(p.chi)}</span>` : ""}</span>${p.ml && g.obiettivo ? `<span class="chip ${p.ml >= g.obiettivo ? "ok" : ""}">${p.ml}/${g.obiettivo}</span>` : ""}</div>` })),
        ...pn.lista.map(x => ({ q: x.quando, html: `<div class="slot" data-act="apri-pannolino" data-id="${x.id}" style="cursor:pointer"><span><b>${x.quando.slice(11)}</b> ${esc(descrPannolino(x))}${x.chi ? `<br><span class="tiny">${esc(x.chi)}</span>` : ""}</span>${COLORI_ALLARME.includes(x.colore) ? `<span class="chip bad">⚠️</span>` : ""}</div>` }))]
        .sort((a, b) => b.q.localeCompare(a.q));
      return `<h2 style="font-size:16px">${g.iso === oggiISO() ? "Oggi" : dataBreve(g.iso)} <span class="tiny">· ${etGiorno(g.iso)} · ${nPasti(g.n)}${g.ml ? " · " + g.ml + " ml" : ""} · 💧 ${pn.pipi} · 💩 ${pn.cacca}${g.obiettivo ? " · indicati " + g.obiettivo + " ml a pasto" : ""}</span></h2>
      ${voci.length ? `<div class="card" style="padding:4px 12px">${voci.map(v => v.html).join("")}</div>` : `<div class="tiny">Niente segnato.</div>`}`; }).join("")}
    <div class="tiny" style="margin-top:12px">La regola dei ${r.incremento} ml al giorno e il numero di pasti sono quelli che ci hai indicato: segui sempre le indicazioni della pediatra, che possono cambiare con il peso e la crescita (modificale con “⚙️ Regola”). Se Gioele mangia molto meno del solito, bagna pochi pannolini o è molto sonnolento, senti la pediatra.</div>`;
}
function formPasto(p = {}, preset = {}) {
  p = { quando: oraLocale(), chi: mioNome(), latte: ls.get("ultimoLatte", "artificiale"), ...preset, ...p };
  const nuovo = !p.id, ob = mlPerPasto(p.quando.slice(0, 10));
  const fineIni = p.fine ? hhmm(p.fine) : !nuovo && minutiPasto(p) ? hhmm(piuMinuti(p.quando, minutiPasto(p))) : "";
  apriSheet("Pasto", `
    <label class="f">Poppata al seno<select name="seno">${Object.entries(SENI).map(([k, t]) => `<option value="${k}" ${(p.seno || "") === k ? "selected" : ""}>${k ? t : "Nessuna (solo biberon)"}</option>`).join("")}</select></label>
    <label class="f">Data<input type="date" name="data" value="${esc(p.quando.slice(0, 10))}"></label>
    <div class="grid2"><label class="f">Ora di inizio<input type="time" name="inizio" value="${esc(hhmm(p.quando))}"></label>
    <label class="f" id="rigaFine">Ora di fine<input type="time" name="fine" value="${esc(fineIni)}"></label></div>
    <div id="rigaEntrambi">
      <label class="f">Ha iniziato dal seno<select name="primo"><option value="sx" ${p.primo !== "dx" ? "selected" : ""}>Sinistro</option><option value="dx" ${p.primo === "dx" ? "selected" : ""}>Destro</option></select></label>
    </div>
    <div id="durataPasto" class="small" style="margin-top:8px"></div>
    <label class="f" for="inMl">Rinforzo (ml)${ob ? ` – indicati ${ob} ml` : ""}</label>
    <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
      <button type="button" class="btn" data-act="pasto-ml-piu" data-d="-10" style="min-width:64px;font-size:19px" aria-label="Togli 10 ml">−10</button>
      <input type="number" id="inMl" inputmode="numeric" min="0" max="500" step="1" name="ml" value="${p.ml ?? ""}" placeholder="– ml –" style="text-align:center;font-size:22px;font-weight:700">
      <button type="button" class="btn" data-act="pasto-ml-piu" data-d="10" style="min-width:64px;font-size:19px" aria-label="Aggiungi 10 ml">+10</button>
    </div>
    <div class="btns" style="margin-top:6px">${ob ? [ob - 10, ob, ob + 10].filter(v => v > 0).map(v => `<button type="button" class="btn sm ${v === ob ? "pri" : ""}" data-act="pasto-ml" data-ml="${v}">${v} ml</button>`).join("") : ""}<button type="button" class="btn sm" data-act="pasto-ml" data-ml="">nessun rinforzo</button></div>
    <label class="f">Tipo di latte del rinforzo<select name="latte">${Object.entries(LATTI).map(([k, t]) => `<option value="${k}" ${p.latte === k ? "selected" : ""}>${t[0].toUpperCase() + t.slice(1)}</option>`).join("")}</select></label>
    <div class="grid2"><label class="f">Chi<input type="text" name="chi" value="${esc(p.chi || "")}"></label>
    <label class="f">Note<input type="text" name="note" value="${esc(p.note || "")}" placeholder="es. rigurgito, singhiozzo"></label></div>`,
  `${!nuovo ? `<button type="button" class="btn bad" data-act="elimina-voce" data-col="pasti" data-id="${p.id}">Elimina</button><span style="flex:1"></span>` : ""}<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm"), v = n => f.elements[n].value.trim();
    const seno = v("seno"), data = v("data") || oggiISO(), inizio = v("inizio"), fine = v("fine"), ml = num(v("ml"));
    if (!inizio) throw errore("Inserisci l'ora di inizio", "inizio");
    if (seno && !fine) throw errore("Inserisci l'ora di fine della poppata", "fine");
    if (!seno && !ml) throw errore("Scegli la poppata al seno oppure inserisci i ml di rinforzo", "ml");
    const quando = `${data}T${inizio}`, minuti = seno ? minutiTra(inizio, fine) : null;
    if (seno && minuti === 0) throw errore("L'ora di fine è uguale a quella di inizio", "fine");
    if (minuti > 120 && !confirm(`La poppata risulta di ${minuti} minuti (dalle ${inizio} alle ${fine}). È giusto?`)) return false;
    const dati = { quando, fine: seno ? piuMinuti(quando, minuti) : (fine ? piuMinuti(quando, minutiTra(inizio, fine)) : ""), seno, minuti,
      minSx: null, minDx: null, primo: "", cambio: "", finito: "", ml, latte: v("latte"), chi: v("chi"), note: v("note"), updatedAt: Date.now() };
    if (seno === "sx") { dati.minSx = minuti; dati.finito = "sx"; }
    if (seno === "dx") { dati.minDx = minuti; dati.finito = "dx"; }
    if (seno === "entrambi") {   // la durata si divide a metà tra i due seni
      dati.primo = v("primo");
      const secondo = dati.primo === "sx" ? "dx" : "sx"; dati.finito = secondo;
      const m1 = Math.ceil(minuti / 2);
      dati[dati.primo === "sx" ? "minSx" : "minDx"] = m1; dati[secondo === "sx" ? "minSx" : "minDx"] = minuti - m1;
    }
    if (dati.ml) ls.set("ultimoLatte", dati.latte);
    salvaVoce("pasti", p, dati); await salva(); toast("Pasto segnato");
  });
  const f = $("#sheetForm");
  const agg = () => {
    const seno = f.elements.seno.value, ini = f.elements.inizio.value, fin = f.elements.fine.value;
    $("#rigaEntrambi").classList.toggle("hidden", seno !== "entrambi");
    $("#rigaFine").firstChild.textContent = seno ? "Ora di fine" : "Ora di fine (facoltativa)";
    const m = minutiTra(ini, fin);
    let t = "";
    if (seno && m != null) {
      t = `⏱️ Durata: <b>${m} minuti</b>`;
      if (seno === "entrambi") { const m1 = Math.ceil(m / 2), pr = f.elements.primo.value; t += ` → metà per seno: ${pr === "sx" ? "sinistro" : "destro"} ${m1}′, ${pr === "sx" ? "destro" : "sinistro"} ${m - m1}′`; }
      if (min(fin) < min(ini)) t += " · finita dopo mezzanotte";
    }
    $("#durataPasto").innerHTML = t;
  };
  ["seno", "inizio", "fine", "primo"].forEach(n => { f.elements[n].addEventListener("input", agg); f.elements[n].addEventListener("change", agg); }); agg();
}
function formRegolaPasti() {
  const r = regolaPasti();
  apriSheet("Regola dei pasti", `
    <p class="small muted">Quantità per pasto = giorno di vita × ml in più al giorno. Cambiala quando la pediatra vi dà nuove indicazioni.</p>
    <div class="grid2"><label class="f">ml in più ogni giorno<input type="text" inputmode="numeric" name="incremento" value="${r.incremento}"></label>
    <label class="f">Massimo ml per pasto<input type="text" inputmode="numeric" name="maxMl" value="${r.maxMl ?? ""}" placeholder="nessuno"></label></div>
    <div class="grid2"><label class="f">Pasti al giorno da<input type="text" inputmode="numeric" name="pastiMin" value="${r.pastiMin}"></label>
    <label class="f">a<input type="text" inputmode="numeric" name="pastiMax" value="${r.pastiMax}"></label></div>
    <label class="check"><input type="checkbox" name="nascitaGiorno1" ${r.nascitaGiorno1 ? "checked" : ""}> Conta anche il giorno della nascita (se spuntato il ${S.profilo.nascita ? dataBreve(S.profilo.nascita) : "giorno della nascita"} vale già ${r.incremento} ml; se non spuntato vale 0 ml e si parte con ${r.incremento} ml il giorno dopo)</label>
    <div class="tiny" style="margin-top:6px">Oggi con queste impostazioni: ${etGiorno()} → ${mlPerPasto()} ml a pasto.</div>
    <h3 style="font-size:15px;margin:16px 0 0">Promemoria del prossimo pasto</h3>
    <div class="grid2"><label class="f">Ogni (ore:minuti)<input type="time" name="intervallo" value="${pad(Math.floor(r.intervalloMin / 60))}:${pad(r.intervalloMin % 60)}"></label>
    <label class="f">Contando dal<select name="intervalloDa"><option value="inizio" ${r.intervalloDa !== "fine" ? "selected" : ""}>inizio dell'ultimo pasto</option><option value="fine" ${r.intervalloDa === "fine" ? "selected" : ""}>fine dell'ultimo pasto</option></select></label></div>
    <label class="check"><input type="checkbox" name="avvisoPasto" ${r.avvisoPasto !== false ? "checked" : ""}> Avviso nel calendario Google “${NOME_CALENDARIO}” all'ora del prossimo pasto</label>`,
  `<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm"), v = n => num(f.elements[n].value);
    S.config.pasti = { incremento: v("incremento") || 10, maxMl: v("maxMl") || null, pastiMin: v("pastiMin") || 6, pastiMax: Math.max(v("pastiMax") || 7, v("pastiMin") || 6), nascitaGiorno1: f.elements.nascitaGiorno1.checked, confermato: true,
      intervalloMin: f.elements.intervallo.value ? min(f.elements.intervallo.value) || 210 : 210, intervalloDa: f.elements.intervalloDa.value, avvisoPasto: f.elements.avvisoPasto.checked };
    await salva(); toast("Regola salvata");
  });
}

/* =====================================================================
   PANNOLINI: pipì e cacca
   ===================================================================== */
const pannoliniOrd = () => attivi("pannolini").sort((a, b) => b.quando.localeCompare(a.quando));
const COLORI_CACCA = {
  "": "—", meconio: "Nero-verdastro (meconio)", verde: "Verde", senape: "Giallo senape", giallo: "Giallo", marrone: "Marrone",
  chiaro: "Bianco / grigio chiaro / color stucco", sangue: "Con sangue / rossa"
};
const CONSISTENZE = { "": "—", liquida: "Liquida", molle: "Morbida / grumosa", formata: "Formata", dura: "Dura" };
const COLORI_ALLARME = ["chiaro", "sangue"];
/* indicazione ricevuta: almeno 1 pipì ogni 24 ore */
const PIPI_MIN_24H = 1;
const pipiAttese = () => PIPI_MIN_24H;
/* l'avviso ha senso solo se i pannolini si segnano da almeno 24 ore */
const tracciatoDa24h = () => { const l = pannoliniOrd(); return l.length > 0 && Date.now() - daOraLocale(l[l.length - 1].quando) >= 864e5; };
function pannoliniGiorno(iso) {
  const l = pannoliniOrd().filter(x => x.quando.startsWith(iso)).reverse();
  return { lista: l, pipi: l.filter(x => x.pipi).length, cacca: l.filter(x => x.cacca).length };
}
function descrPannolino(x) {
  return [x.pipi && "💧 pipì", x.cacca && `💩 cacca${x.colore ? " " + COLORI_CACCA[x.colore].toLowerCase() : ""}${x.consistenza ? ", " + CONSISTENZE[x.consistenza].toLowerCase() : ""}`, x.note].filter(Boolean).join(" · ");
}
function pannolinoRapido(tipo) {   // apre il modulo con l'ora attuale, da correggere se serve
  formPannolino({}, { pipi: tipo !== "cacca", cacca: tipo !== "pipi" });
}
function formPannolino(x = {}, preset = {}) {
  x = { quando: oraLocale(), pipi: true, cacca: false, chi: mioNome(), ...preset, ...x };
  const nuovo = !x.id;
  apriSheet(x.pipi && x.cacca ? "Pipì e cacca" : x.cacca ? "Cacca" : "Pipì", `
    <div class="grid2"><label class="f">Data<input type="date" name="data" value="${esc(x.quando.slice(0, 10))}"></label>
    <label class="f">Ora<input type="time" name="ora" value="${esc(hhmm(x.quando))}"></label></div>
    <div class="btns" style="margin-top:12px">
      <label class="btn" style="flex:1"><input type="checkbox" name="pipi" ${x.pipi ? "checked" : ""} style="width:22px;height:22px"> 💧 Pipì</label>
      <label class="btn" style="flex:1"><input type="checkbox" name="cacca" ${x.cacca ? "checked" : ""} style="width:22px;height:22px"> 💩 Cacca</label>
    </div>
    <div id="dettagliCacca">
      <label class="f">Colore<select name="colore">${Object.entries(COLORI_CACCA).map(([k, t]) => `<option value="${k}" ${x.colore === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="f">Consistenza<select name="consistenza">${Object.entries(CONSISTENZE).map(([k, t]) => `<option value="${k}" ${x.consistenza === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <div id="avvisoCacca"></div>
    </div>
    <div class="grid2"><label class="f">Chi<input type="text" name="chi" value="${esc(x.chi || "")}"></label>
    <label class="f">Note<input type="text" name="note" value="${esc(x.note || "")}" placeholder="es. arrossamento"></label></div>`,
  `${!nuovo ? `<button type="button" class="btn bad" data-act="elimina-voce" data-col="pannolini" data-id="${x.id}">Elimina</button><span style="flex:1"></span>` : ""}<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm");
    if (!f.elements.ora.value) throw errore("Inserisci l'ora", "ora");
    const dati = { quando: `${f.elements.data.value || oggiISO()}T${f.elements.ora.value}`, pipi: f.elements.pipi.checked, cacca: f.elements.cacca.checked,
      colore: f.elements.cacca.checked ? f.elements.colore.value : "", consistenza: f.elements.cacca.checked ? f.elements.consistenza.value : "",
      chi: f.elements.chi.value.trim(), note: f.elements.note.value.trim(), updatedAt: Date.now() };
    if (!dati.pipi && !dati.cacca) throw new Error("Spunta pipì, cacca o entrambe");
    salvaVoce("pannolini", x, dati); await salva(); toast(dati.pipi && dati.cacca ? "💧💩 Segnato" : dati.pipi ? "💧 Pipì segnata" : "💩 Cacca segnata");
  });
  const f = $("#sheetForm");
  const agg = () => {
    $("#dettagliCacca").classList.toggle("hidden", !f.elements.cacca.checked);
    $("#avvisoCacca").innerHTML = COLORI_ALLARME.includes(f.elements.colore.value)
      ? `<div class="notice bad small">${f.elements.colore.value === "chiaro" ? "Feci molto chiare (bianche, grigie, color stucco) in un neonato vanno segnalate <b>subito</b> alla pediatra, anche se Gioele sta bene." : "Sangue nelle feci: senti la pediatra (o la guardia medica 116117 fuori orario)."}</div>` : "";
  };
  ["cacca", "colore"].forEach(n => f.elements[n].addEventListener("change", agg)); agg();
}
function boxPannolini() {
  const gdv = giorniDiVita() == null ? null : giorniDiVita() + 1, oggi = pannoliniGiorno(oggiISO()), att = pipiAttese(gdv);
  const in24 = pannoliniOrd().filter(x => Date.now() - daOraLocale(x.quando) < 864e5);
  const pipi24 = in24.filter(x => x.pipi).length, cacca24 = in24.filter(x => x.cacca).length;
  const ultimaPipi = pannoliniOrd().find(x => x.pipi), ultimaCacca = pannoliniOrd().find(x => x.cacca);
  const allarme = pannoliniOrd().find(x => COLORI_ALLARME.includes(x.colore) && Date.now() - daOraLocale(x.quando) < 3 * 864e5);
  return `<div class="card"><b>🧷 Pannolini</b>
      <div class="btns"><button type="button" class="btn pri" data-act="pannolino-rapido" data-tipo="pipi">💧 Pipì</button><button type="button" class="btn pri" data-act="pannolino-rapido" data-tipo="cacca">💩 Cacca</button><button type="button" class="btn" data-act="pannolino-rapido" data-tipo="entrambi">💧💩 Entrambe</button><button type="button" class="btn sm" data-act="nuovo-pannolino">✏️ Con dettagli</button></div>
      <div class="slot"><span>Oggi</span><b>💧 ${oggi.pipi} · 💩 ${oggi.cacca}</b></div>
      <div class="slot"><span>Ultime 24 ore</span><b>💧 ${pipi24} ${att && pipi24 < att && tracciatoDa24h() ?`<span class="chip bad">nessuna pipì da 24 ore</span>` : pipi24 ? `<span class="chip ok">ok</span>` : ""} · 💩 ${cacca24}</b></div>
      ${ultimaPipi || ultimaCacca ? `<div class="slot"><span>Ultima</span><b>${ultimaPipi ? `💧 ${traQuanto(Date.now() - daOraLocale(ultimaPipi.quando))} fa` : ""}${ultimaPipi && ultimaCacca ? " · " : ""}${ultimaCacca ? `💩 ${traQuanto(Date.now() - daOraLocale(ultimaCacca.quando))} fa` : ""}</b></div>` : ""}
      ${allarme ? `<div class="notice bad small">Negli ultimi giorni avete segnato feci ${allarme.colore === "chiaro" ? "molto chiare" : "con sangue"}: se non l'avete già fatto, sentite la pediatra.</div>` : ""}
      <div class="tiny" style="margin-top:6px">Ci vuole almeno 1 pipì ogni 24 ore: se passano 24 ore senza, senti la pediatra. Le prime cacche sono scure (meconio), poi verdi e dal 4°-5° giorno gialle. Pochi pannolini bagnati o feci chiare: senti la pediatra.</div>
    </div>`;
}

/* =====================================================================
   PROSSIMO PASTO (ogni 3 h 30 dall'ultimo) e VITAMINA D
   ===================================================================== */
const hm = minuti => `${Math.floor(minuti / 60)}:${pad(minuti % 60)}`;
function prossimoPasto() {
  const u = pastiOrd()[0]; if (!u) return null;
  const r = regolaPasti();
  const base = r.intervalloDa === "fine" && u.fine ? u.fine : u.quando;
  const d = daOraLocale(base); d.setMinutes(d.getMinutes() + r.intervalloMin);
  return d;
}
function rigaProssimoPasto(grande = false) {
  const d = prossimoPasto(); if (!d) return "";
  const diff = d - Date.now(), ora = `${pad(d.getHours())}:${pad(d.getMinutes())}${oggiISO(d) !== oggiISO() ? " di domani" : ""}`;
  const testo = diff > 0 ? `🍼 Prossimo pasto alle <b>${ora}</b> (tra ${traQuanto(diff)})` : `🍼 <b>Ora del pasto!</b> Previsto alle ${ora} (${traQuanto(-diff)} fa)`;
  return grande ? `<div class="notice ${diff > 0 ? "info" : "warn"}" style="font-size:16px">${testo}</div>` : testo;
}
/* evento "prossimo pasto" nel calendario Google: uno solo, spostato a ogni nuovo pasto (da qualsiasi telefono) */
async function allineaProssimoPasto(cal) {
  if (regolaPasti().avvisoPasto === false) return;
  const j = await gapi(`${CAL}/calendars/${cal}/events?${qs({ privateExtendedProperty: "gioele=prossimoPasto", maxResults: 10, singleEvents: true })}`);
  const evs = (j.items || []).filter(e => e.status !== "cancelled");
  for (const e of evs.slice(1)) { try { await gapi(`${CAL}/calendars/${cal}/events/${e.id}`, { method: "DELETE" }); } catch {} }
  const d = prossimoPasto(), ev0 = evs[0];
  if (!d || Date.now() - d > 6 * 36e5) {   // nessun pasto recente: niente promemoria
    if (ev0) { try { await gapi(`${CAL}/calendars/${cal}/events/${ev0.id}`, { method: "DELETE" }); } catch {} }
    return;
  }
  const sig = oraLocale(d), u = pastiOrd()[0], r = regolaPasti();
  if (ev0 && ev0.extendedProperties?.private?.sig === sig) return;
  const fine = new Date(d.getTime() + 15 * 60000);
  const ev = {
    summary: "🍼 Pasto Gioele", transparency: "transparent",
    description: `${hm(r.intervalloMin)} dopo l'ultimo pasto (${u.quando.slice(11)}${u.chi ? ", " + u.chi : ""}). Indicati ${mlPerPasto()} ml di rinforzo. Promemoria automatico dell'app Gioele: si sposta da solo quando segnate un nuovo pasto.`,
    start: { dateTime: sig + ":00", timeZone: "Europe/Rome" }, end: { dateTime: oraLocale(fine) + ":00", timeZone: "Europe/Rome" },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
    extendedProperties: { private: { gioele: "prossimoPasto", sig } }
  };
  if (ev0) await gapi(`${CAL}/calendars/${cal}/events/${ev0.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) });
  else await gapi(`${CAL}/calendars/${cal}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) });
}
const VIT_D = "Vitamina D";
const vitDOggi = () => attivi("dosi").filter(d => /vitamina\s*d/i.test(d.farmaco) && d.quando.startsWith(oggiISO())).sort((a, b) => a.quando.localeCompare(b.quando))[0];
function cardVitaminaD() {
  if (!S.profilo.nascita) return "";
  const v = vitDOggi();
  return v ? `<div class="notice info small">💊 Vitamina D di oggi: <b>✓ data alle ${v.quando.slice(11)}</b>${v.chi ? " (" + esc(v.chi) + ")" : ""}${v.dose ? " · " + esc(v.dose) : ""}</div>`
    : `<div class="notice warn small" style="display:flex;gap:10px;align-items:center;justify-content:space-between">💊 Vitamina D di oggi: <b>da dare</b><button type="button" class="btn sm pri" data-act="vitd-data">Data ✓</button></div>`;
}
async function segnaVitaminaD() {
  const ab = farmaciAbituali().find(f => /vitamina\s*d/i.test(f.nome));
  S.dosi.push({ id: uid(), farmaco: ab ? ab.nome : VIT_D, dose: ab?.dose || "", quando: oraLocale(), chi: mioNome(), creato: Date.now(), updatedAt: Date.now() });
  await salva(); toast("💊 Vitamina D segnata");
}
/* riquadro in Home */
function cardHomePasti() {
  if (!S.profilo.nascita || giorniDiVita() > 400) return "";
  const r = regolaPasti(), oggi = giornata(oggiISO()), ultimo = pastiOrd()[0], p = poppataInCorso();
  return `${rigaProssimoPasto(true)}${cardVitaminaD()}<div class="notice info small" data-act="vai-salute" data-sez="pasti" style="cursor:pointer">🍼 <b>Oggi ${oggi.n} su ${r.pastiMin}-${r.pastiMax} pasti</b>${oggi.ml ? ` · ${oggi.ml} ml di rinforzo` : ""} · indicati <b>${mlPerPasto()} ml</b> a pasto (${etGiorno()})${ultimo ? `<br>Ultimo pasto: ${traQuanto(Date.now() - daOraLocale(ultimo.quando))} fa` : ""}<br>🧷 Oggi 💧 ${pannoliniGiorno(oggiISO()).pipi} pipì · 💩 ${pannoliniGiorno(oggiISO()).cacca} cacche${p ? `<br>⏱️ Poppata in corso (seno ${p.seno === "sx" ? "sinistro" : "destro"})` : ""}</div>`;
}
async function azionePasti(act, b) {
  switch (act) {
    case "nuovo-pasto": formPasto(); return true;
    case "vitd-data": await segnaVitaminaD(); return true;
    case "pannolino-rapido": await pannolinoRapido(b.dataset.tipo); return true;
    case "nuovo-pannolino": formPannolino(); return true;
    case "apri-pannolino": formPannolino(S.pannolini.find(x => x.id === b.dataset.id)); return true;
    case "apri-pasto": formPasto(S.pasti.find(x => x.id === b.dataset.id)); return true;
    case "pasto-ml": { const el = $("#sheetForm").elements.ml; el.value = b.dataset.ml; el.classList.remove("campo-errore"); return true; }
    case "pasto-ml-piu": { const el = $("#sheetForm").elements.ml, base = num(el.value) ?? (mlPerPasto() || 0); el.value = Math.max(0, base + Number(b.dataset.d)); el.classList.remove("campo-errore"); return true; }
    case "pasti-regola": formRegolaPasti(); return true;
    case "poppata-avvia": avviaPoppata(b.dataset.seno); return true;
    case "poppata-cambia": cambiaSeno(); return true;
    case "poppata-fine": finePoppata(); return true;
    case "poppata-annulla": if (confirm("Annullare la poppata in corso senza salvarla?")) { ls.del("poppataInCorso"); render(); } return true;
    case "pasti-nascita": S.profilo.nascita = "2026-11-22"; S.profilo.updatedAt = Date.now(); await salva(); return true;
  }
  return false;
}
