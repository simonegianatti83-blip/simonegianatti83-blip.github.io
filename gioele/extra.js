/* =====================================================================
   Gioele – EXTRA
   modalità notte e azioni con un tocco, sonno, statistiche dei pasti,
   checklist dei primi giorni, blocco con Face ID, backup automatico.
   ===================================================================== */
"use strict";

/* =====================================================================
   SONNO
   ===================================================================== */
const sonniOrd = () => attivi("sonno").sort((a, b) => b.inizio.localeCompare(a.inizio));
const sonnoInCorso = () => sonniOrd().find(x => !x.fine);
const durataMin = x => Math.max(0, Math.round(((x.fine ? daOraLocale(x.fine) : new Date()) - daOraLocale(x.inizio)) / 60000));
const hhmmDurata = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`;
/* minuti di sonno che cadono in un intervallo di tempo */
function sonnoTra(da, a) {
  return attivi("sonno").reduce((t, x) => {
    const i = Math.max(daOraLocale(x.inizio).getTime(), da), f = Math.min((x.fine ? daOraLocale(x.fine) : new Date()).getTime(), a);
    return t + Math.max(0, f - i) / 60000;
  }, 0);
}
async function addormentato(quando = oraLocale()) {
  if (sonnoInCorso()) return toast("Risulta già addormentato");
  S.sonno.push({ id: uid(), inizio: quando, fine: "", chi: mioNome(), creato: Date.now(), updatedAt: Date.now() });
  await salva(); toast("😴 Buon riposo! Si è addormentato alle " + quando.slice(11));
}
async function sveglio(quando = oraLocale()) {
  const x = sonnoInCorso(); if (!x) return toast("Non risulta addormentato");
  x.fine = quando < x.inizio ? oraLocale() : quando; x.updatedAt = Date.now();
  await salva(); toast(`☀️ Sveglio: ha dormito ${hhmmDurata(durataMin(x))}`);
}
function vSonno() {
  const ora = Date.now(), x = sonnoInCorso();
  const oggi0 = parseISO(oggiISO()).getTime();
  const giorni = []; for (let i = 0; i < 7; i++) { const d0 = oggi0 - i * 864e5; giorni.push({ iso: oggiISO(new Date(d0)), min: Math.round(sonnoTra(d0, d0 + 864e5)) }); }
  const lista = sonniOrd().slice(0, 40);
  return `<div class="card">
      ${x ? `<div style="font-size:22px;font-weight:800">😴 Dorme da ${hhmmDurata(durataMin(x))}</div><div class="small muted">Dalle ${x.inizio.slice(11)}${x.chi ? " · " + esc(x.chi) : ""}</div>
        <div class="btns"><button type="button" class="btn pri" data-act="sonno-sveglio">☀️ Si è svegliato</button></div>`
      : `<div style="font-size:20px;font-weight:800">☀️ Sveglio</div>${sonniOrd()[0] ? `<div class="small muted">Ultimo sonno: ${quandoBreve(sonniOrd()[0].inizio)}, ${hhmmDurata(durataMin(sonniOrd()[0]))}</div>` : ""}
        <div class="btns"><button type="button" class="btn pri" data-act="sonno-dorme">😴 Si è addormentato</button></div>`}
      <div class="slot"><span>Ultime 24 ore</span><b>${hhmmDurata(Math.round(sonnoTra(ora - 864e5, ora)))}</b></div>
      <div class="btns"><button type="button" class="btn sm" data-act="sonno-nuovo">✏️ Segna un sonno passato</button></div>
    </div>
    <div class="card"><b>Ultimi 7 giorni</b>${giorni.map(g => `<div class="slot"><span>${g.iso === oggiISO() ? "Oggi" : dataBreve(g.iso)}</span><span style="flex:1;margin:0 10px;align-self:center;height:8px;background:var(--line-2);border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:${Math.min(100, g.min / 1200 * 100)}%;background:var(--brand)"></span></span><b>${g.min ? hhmmDurata(g.min) : "–"}</b></div>`).join("")}</div>
    ${lista.length ? `<div class="card" style="padding:4px 12px">${lista.map(s => `<div class="slot" data-act="apri-sonno" data-id="${s.id}" style="cursor:pointer"><span><b>${quandoBreve(s.inizio)}</b> → ${s.fine ? s.fine.slice(11) : "<i>in corso</i>"}${s.chi ? `<br><span class="tiny">${esc(s.chi)}</span>` : ""}</span><b>${hhmmDurata(durataMin(s))}</b></div>`).join("")}</div>` : `<div class="empty">Nessun sonno segnato. Tocca “Si è addormentato” quando si addormenta e “Si è svegliato” al risveglio.</div>`}
    <div class="tiny">Un neonato dorme in media 14–17 ore al giorno, a pezzi di 2–4 ore. Dormire sempre a pancia in su.</div>`;
}
function formSonno(x = {}) {
  const nuovo = !x.id; x = { inizio: oraLocale(new Date(Date.now() - 3600000)), fine: oraLocale(), ...x };
  apriSheet("Sonno", `
    <label class="f">Si è addormentato<input type="datetime-local" name="inizio" value="${esc(x.inizio)}"></label>
    <label class="f">Si è svegliato (vuoto se dorme ancora)<input type="datetime-local" name="fine" value="${esc(x.fine || "")}"></label>
    <label class="f">Note<input type="text" name="note" value="${esc(x.note || "")}" placeholder="es. in carrozzina, dopo il bagnetto"></label>`,
  `${!nuovo ? `<button type="button" class="btn bad" data-act="elimina-voce" data-col="sonno" data-id="${x.id}">Elimina</button><span style="flex:1"></span>` : ""}<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm"), ini = f.elements.inizio.value, fin = f.elements.fine.value;
    if (!ini) throw errore("Inserisci quando si è addormentato", "inizio");
    if (fin && fin <= ini) throw errore("Il risveglio deve essere dopo l'addormentamento", "fine");
    salvaVoce("sonno", x, { inizio: ini, fine: fin, note: f.elements.note.value.trim(), chi: x.chi || mioNome(), updatedAt: Date.now() });
    await salva(); toast("Sonno salvato");
  });
}

/* =====================================================================
   STATISTICHE DEI PASTI
   ===================================================================== */
function statistichePasti() {
  const ora = Date.now(), l24 = pastiOrd().filter(p => ora - daOraLocale(p.quando) < 864e5).reverse();
  const inizi = l24.map(p => daOraLocale(p.quando).getTime());
  const intervalli = inizi.slice(1).map((t, i) => (t - inizi[i]) / 60000);
  const bib = l24.filter(p => p.ml);
  const g7 = []; for (let i = 1; i <= 7; i++) { const g = giornata(oggiISO(new Date(ora - i * 864e5))); if (g.n) g7.push(g); }
  return {
    n24: l24.length, ml24: bib.reduce((a, p) => a + p.ml, 0), minSeno24: l24.reduce((a, p) => a + (minutiPasto(p) || 0), 0),
    intMedio: intervalli.length ? Math.round(intervalli.reduce((a, b) => a + b, 0) / intervalli.length) : null,
    intMax: intervalli.length ? Math.round(Math.max(...intervalli)) : null,
    mlMedio: bib.length ? Math.round(bib.reduce((a, p) => a + p.ml, 0) / bib.length) : null,
    pastiGiorno7: g7.length ? (g7.reduce((a, g) => a + g.n, 0) / g7.length) : null,
    mlGiorno7: g7.length ? Math.round(g7.reduce((a, g) => a + g.ml, 0) / g7.length) : null, giorni7: g7.length
  };
}
function cardStatistichePasti() {
  const s = statistichePasti(); if (!s.n24 && !s.giorni7) return "";
  const r = regolaPasti(), ob = mlPerPasto();
  return `<div class="card"><b>📊 Statistiche</b>
    ${(u => `<div class="slot"><span>Ultime 24 ore</span><b>🤱 ${u.poppate} poppate${u.minuti ? ` (${u.minuti} min)` : ""} · 🍼 ${u.biberon} biberon${u.ml ? ` (${u.ml} ml)` : ""}</b></div>`)(ultime24())}
    ${s.intMedio ? `<div class="slot"><span>Tempo medio tra un pasto e l'altro</span><b>${hhmmDurata(s.intMedio)}</b></div><div class="slot"><span>Pausa più lunga</span><b>${hhmmDurata(s.intMax)}</b></div>` : ""}
    ${s.mlMedio ? `<div class="slot"><span>Rinforzo medio</span><b>${s.mlMedio} ml${ob ? ` <span class="chip ${s.mlMedio >= ob ? "ok" : ""}">indicati ${ob}</span>` : ""}</b></div>` : ""}
    ${s.giorni7 ? `<div class="slot"><span>Media dei giorni precedenti (${s.giorni7})</span><b>${fmt(s.pastiGiorno7, 1)} pasti · ${s.mlGiorno7} ml al giorno</b></div>` : ""}
    <div class="tiny" style="margin-top:6px">Riferimento della regola: almeno ${r.pastiMin} biberon di formula e ${r.senoMin}-${r.senoMax} poppate al seno al giorno, un pasto ogni ${hm(r.intervalloMin)} circa.</div></div>`;
}
/* ripete l'ultimo pasto all'ora attuale (stesso seno/ml/latte) */
async function ripetiUltimoPasto() {
  const u = pastiOrd()[0]; if (!u) return toast("Nessun pasto da ripetere");
  const ora = oraLocale(), min = minutiPasto(u);
  const nuovo = { quando: ora, fine: u.seno && min ? piuMinuti(ora, min) : "", seno: u.seno || "", minuti: u.seno ? min : null, minSx: u.minSx ?? null, minDx: u.minDx ?? null,
    primo: u.primo || "", finito: u.finito || "", ml: u.ml ? (mlPerPasto() > u.ml ? mlPerPasto() : u.ml) : null, latte: u.latte || "artificiale", chi: mioNome(), note: "", updatedAt: Date.now() };
  /* la poppata ripetuta inizia adesso: se finisce nel futuro, si parte da adesso meno la durata */
  if (nuovo.seno && min) { nuovo.quando = piuMinuti(ora, -min); nuovo.fine = ora; }
  salvaVoce("pasti", {}, nuovo); await salva(); ricordaAnnulla("pasti", S.pasti[S.pasti.length - 1].id);
  toast(`🔁 Pasto segnato: ${testoPastoCal(nuovo)}`, 4000);
}

/* =====================================================================
   CHECKLIST DEI PRIMI GIORNI (pratiche e cure)
   ===================================================================== */
const PRIMI_GIORNI = [
  { k: "pg_nascita", nome: "Dichiarazione di nascita", entro: 10, nota: "Entro 3 giorni in ospedale oppure entro 10 giorni in Comune." },
  { k: "pg_cf", nome: "Codice fiscale", nota: "Viene attribuito con la dichiarazione di nascita (Comune / Agenzia delle Entrate)." },
  { k: "pg_pediatra", nome: "Scelta del pediatra", nota: "Dr.ssa Lopez Rios: iscrizione all'ASST o online sul portale di Regione Lombardia." },
  { k: "pg_tessera", nome: "Tessera sanitaria", nota: "Arriva per posta a casa dopo l'iscrizione al Servizio Sanitario." },
  { k: "pg_assegno", nome: "Assegno unico (INPS)", entro: 120, nota: "Domanda entro 120 giorni dalla nascita per non perdere gli arretrati. Se ricevete già l'assegno per altri figli, va aggiornata la domanda." },
  { k: "pg_bonus", nome: "Bonus nuovi nati / altri bonus INPS", nota: "Verificare sul sito INPS i bonus previsti per l'anno di nascita e le scadenze (alcuni hanno termini brevi, es. 60 giorni)." },
  { k: "pg_congedo", nome: "Congedo di paternità (10 giorni lavorativi)", nota: "Da usare da 2 mesi prima a 5 mesi dopo la nascita: va comunicato al datore di lavoro." },
  { k: "pg_fse", nome: "Fascicolo Sanitario di Gioele", nota: "Con SPID/CIE di un genitore si vedono anche i documenti del figlio." },
  { k: "pg_cordone", nome: "Caduta del cordone ombelicale", nota: "Di solito tra 7 e 15 giorni; tenerlo pulito e asciutto." },
  { k: "pg_bagnetto", nome: "Primo bagnetto", nota: "Dopo la caduta del cordone." },
  { k: "pg_vitd", nome: "Inizio vitamina D", nota: "Dose e durata le indica la pediatra." },
  { k: "pg_nido", nome: "Iscrizione al nido", nota: "I bandi comunali di solito sono in primavera." }
];
function vPrimiGiorni() {
  const n = S.profilo.nascita;
  const fatti = PRIMI_GIORNI.filter(x => stato(x.k)?.fatto).length;
  return `<div class="notice info small">Pratiche e prime cure dopo la nascita: spunta quando sono fatte. Le scadenze sono indicative: verificate sempre sui siti ufficiali (Comune, INPS, ASST).</div>
    <div class="card"><b>${fatti} su ${PRIMI_GIORNI.length} fatte</b><div style="height:8px;background:var(--line-2);border-radius:4px;overflow:hidden;margin-top:6px"><div style="height:100%;width:${fatti / PRIMI_GIORNI.length * 100}%;background:var(--brand)"></div></div></div>
    ${PRIMI_GIORNI.map(x => {
      const c = stato(x.k), scad = n && x.entro ? dataDaGiorni(x.entro) : "";
      const chip = c?.fatto ? `<span class="chip ok">✓ ${dataBreve(c.fatto)}</span>` : scad ? `<span class="chip ${scad < oggiISO() ? "bad" : giorniA(scad) <= 15 ? "warn" : ""}">entro il ${dataBreve(scad)}</span>` : "";
      return `<div class="item" style="cursor:default"><label style="display:flex;gap:12px;align-items:flex-start;flex:1;cursor:pointer"><input type="checkbox" data-act="pg-spunta" data-k="${x.k}" ${c?.fatto ? "checked" : ""} style="width:22px;height:22px;margin-top:2px;flex:none">
        <span class="grow"><span class="t">${esc(x.nome)}</span><br><span class="m">${esc(x.nota)}</span>${chip ? `<br>${chip}` : ""}</span></label></div>`;
    }).join("")}`;
}
async function spuntaPrimiGiorni(k, si) {
  let c = S.check.find(x => x.id === k);
  if (!c) { c = { id: k, tipo: "pratica" }; S.check.push(c); }
  Object.assign(c, { fatto: si ? oggiISO() : "", updatedAt: Date.now(), deleted: false });
  await salva();
}

/* =====================================================================
   MODALITÀ NOTTE (schermo scuro, tasti grandi, un tocco = fatto)
   ===================================================================== */
let ultimaAzioneNotte = null;   // { col, id, testo } per "Annulla"
function ricordaAnnulla(col, id) { ultimaAzioneNotte = { col, id, quando: Date.now() }; }
async function annullaUltima() {
  const u = ultimaAzioneNotte; if (!u || Date.now() - u.quando > 5 * 60000) return toast("Niente da annullare");
  const x = S[u.col].find(y => y.id === u.id); if (x) { x.deleted = true; x.updatedAt = Date.now(); await salva(); }
  ultimaAzioneNotte = null; toast("Annullato"); disegnaNotte();
}
async function pannolinoSubito(tipo) {
  S.pannolini.push({ id: uid(), quando: oraLocale(), pipi: tipo !== "cacca", cacca: tipo !== "pipi", chi: mioNome(), creato: Date.now(), updatedAt: Date.now() });
  await salva(); ricordaAnnulla("pannolini", S.pannolini[S.pannolini.length - 1].id);
  toast(tipo === "pipi" ? "💧 Pipì segnata" : tipo === "cacca" ? "💩 Cacca segnata" : "💧💩 Segnato");
}
async function biberonSubito(ml) {
  ml = ml || mlPerPasto() || null;
  S.pasti.push({ id: uid(), quando: oraLocale(), fine: "", seno: "", minuti: null, minSx: null, minDx: null, ml, latte: ls.get("ultimoLatte", "artificiale"), chi: mioNome(), creato: Date.now(), updatedAt: Date.now() });
  await salva(); ricordaAnnulla("pasti", S.pasti[S.pasti.length - 1].id);
  toast(`🍼 Biberon ${ml || ""} ml segnato`);
}
/* fine poppata senza modulo (di notte): si salva subito */
async function finePoppataSubito() {
  const p = poppataInCorso(); if (!p) return;
  p[p.seno === "sx" ? "minSx" : "minDx"] += minutiSegmento(p);
  ls.del("poppataInCorso");
  const sx = Math.round(p.minSx), dx = Math.round(p.minDx), tot = Math.max(1, sx + dx);
  const seno = sx && dx ? "entrambi" : dx ? "dx" : "sx";
  const m1 = Math.ceil(tot / 2);
  S.pasti.push({ id: uid(), quando: p.inizio, fine: piuMinuti(p.inizio, tot), seno, minuti: tot,
    minSx: seno === "entrambi" ? ((p.primo || p.seno) === "sx" ? m1 : tot - m1) : seno === "sx" ? tot : null,
    minDx: seno === "entrambi" ? ((p.primo || p.seno) === "dx" ? m1 : tot - m1) : seno === "dx" ? tot : null,
    primo: seno === "entrambi" ? (p.primo || "sx") : "", finito: p.seno, ml: null, latte: ls.get("ultimoLatte", "artificiale"), chi: mioNome(), creato: Date.now(), updatedAt: Date.now() });
  await salva(); ricordaAnnulla("pasti", S.pasti[S.pasti.length - 1].id);
  toast(`🤱 Poppata salvata: ${tot} minuti`);
}
/* =====================================================================
   TEMA CHIARO / SCURO: automatico con alba e tramonto (Sondrio) o a scelta
   ===================================================================== */
const TEMI = { sole: "🌅 Automatico (alba e tramonto)", chiaro: "☀️ Sempre chiaro", scuro: "🌙 Sempre scuro", sistema: "📱 Come il telefono" };
/* alba e tramonto (formule NOAA, precisione di qualche minuto); Sondrio 46,17 N – 9,87 E */
function albaTramonto(d = new Date(), lat = 46.17, lon = 9.87) {
  const rad = Math.PI / 180, inizioAnno = Date.UTC(d.getFullYear(), 0, 1);
  const n = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - inizioAnno) / 864e5) + 1;
  const g = 2 * Math.PI / 365 * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec)) / rad;
  const aOra = m => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0) + m * 60000);
  return { alba: aOra(720 - 4 * (lon + ha) - eq), tramonto: aOra(720 - 4 * (lon - ha) - eq) };
}
function temaScelto() { const t = ls.get("tema", "sole"); return TEMI[t] ? t : "sole"; }
function temaScuroAdesso(ora = new Date()) {
  const t = temaScelto();
  if (t === "chiaro") return false;
  if (t === "scuro") return true;
  if (t === "sistema") return matchMedia("(prefers-color-scheme: dark)").matches;
  const { alba, tramonto } = albaTramonto(ora);
  return ora < alba || ora >= tramonto;
}
function applicaTema() {
  const n = document.getElementById("notte"); if (n && !n.hidden) return;   // la modalità notte resta nera
  const t = temaScelto(), scuro = temaScuroAdesso();
  if (t === "sistema") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = scuro ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", scuro ? "#0F3F3B" : "#0E746E");
}
const oraBreve = d => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
function cardTema() {
  const t = temaScelto(), { alba, tramonto } = albaTramonto();
  return `<h2>Aspetto</h2><div class="card small">
    <div class="btns" style="flex-direction:column;align-items:stretch">${Object.entries(TEMI).map(([k, v]) => `<button type="button" class="btn ${t === k ? "pri" : ""}" data-act="tema" data-tema="${k}">${t === k ? "✓ " : ""}${v}</button>`).join("")}</div>
    <div class="tiny" style="margin-top:8px">Oggi a Sondrio: alba alle <b>${oraBreve(alba)}</b>, tramonto alle <b>${oraBreve(tramonto)}</b>. ${t === "sole" ? `In automatico l'app è chiara di giorno e scura dal tramonto all'alba (adesso: <b>${temaScuroAdesso() ? "scura" : "chiara"}</b>).` : ""}</div></div>`;
}
try { applicaTema(); } catch (e) { console.warn(e); }
setInterval(() => { try { applicaTema(); } catch {} }, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) try { applicaTema(); } catch {} });

function apriNotte() {
  if (soloLettura()) return toast("Sei in sola lettura");
  let el = document.getElementById("notte");
  if (!el) { el = document.createElement("div"); el.id = "notte"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Modalità notte"); document.body.appendChild(el); }
  el.dataset.temaPrima = document.documentElement.dataset.theme || "";
  document.documentElement.dataset.theme = "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#000000");
  el.hidden = false; disegnaNotte(); ls.set("notteAperta", true);
}
function chiudiNotte() {
  const el = document.getElementById("notte"); if (!el) return;
  el.hidden = true;
  applicaTema();
  ls.set("notteAperta", false); render();
}
function disegnaNotte() {
  const el = document.getElementById("notte"); if (!el || el.hidden) return;
  const ora = new Date(), u = pastiOrd()[0], pp = poppataInCorso(), sn = sonnoInCorso(), ml = mlPerPasto(), vit = typeof vitDOggi === "function" ? vitDOggi() : null;
  const prox = prossimoPasto();
  const s = prossimoSeno();
  el.innerHTML = `<div class="notte-in">
    <div class="notte-testa"><div><div class="notte-ora">${pad(ora.getHours())}:${pad(ora.getMinutes())}</div>
      <div class="notte-sub">${prox ? (prox > ora ? `Prossimo pasto alle ${pad(prox.getHours())}:${pad(prox.getMinutes())} (tra ${traQuanto(prox - ora)})` : `<b style="color:#F0A24B">Ora del pasto</b> (previsto alle ${pad(prox.getHours())}:${pad(prox.getMinutes())})`) : ""}${u ? `<br>Ultimo: ${u.quando.slice(11)} · ${esc(testoPastoCal(u))}` : ""}</div></div>
      <button type="button" class="notte-esci" data-act="notte-chiudi" aria-label="Esci dalla modalità notte">✕</button></div>
    ${pp ? `<div class="notte-blocco"><div class="notte-grande">⏱️ ${Math.floor(pp.minSx + pp.minDx + minutiSegmento(pp))} min · seno ${pp.seno === "sx" ? "sinistro" : "destro"}</div>
        <div class="notte-griglia"><button type="button" class="nb" data-act="poppata-cambia">🔄 Cambia seno</button><button type="button" class="nb nb-pri" data-act="notte-fine-poppata">⏹️ Fine poppata</button></div></div>`
      : `<div class="notte-griglia">
        <button type="button" class="nb ${s === "sx" ? "nb-pri" : ""}" data-act="notte-poppata" data-seno="sx">🤱 Seno sinistro</button>
        <button type="button" class="nb ${s === "dx" ? "nb-pri" : ""}" data-act="notte-poppata" data-seno="dx">🤱 Seno destro</button>
        <button type="button" class="nb" data-act="notte-biberon">🍼 Biberon ${ml || ""}${ml ? " ml" : ""}</button>
        <button type="button" class="nb" data-act="notte-ripeti" ${u ? "" : "disabled"}>🔁 Ripeti ultimo</button></div>`}
    <div class="notte-griglia">
      <button type="button" class="nb" data-act="notte-pann" data-tipo="pipi">💧 Pipì</button>
      <button type="button" class="nb" data-act="notte-pann" data-tipo="cacca">💩 Cacca</button>
      <button type="button" class="nb" data-act="notte-pann" data-tipo="entrambi">💧💩 Entrambe</button>
      ${sn ? `<button type="button" class="nb" data-act="sonno-sveglio">☀️ Sveglio (dorme da ${hhmmDurata(durataMin(sn))})</button>` : `<button type="button" class="nb" data-act="sonno-dorme">😴 Si è addormentato</button>`}
      ${vit ? "" : `<button type="button" class="nb" data-act="vitd-data">💊 Vitamina D data</button>`}
      <button type="button" class="nb" data-act="notte-annulla" ${ultimaAzioneNotte && Date.now() - ultimaAzioneNotte.quando < 5 * 60000 ? "" : "disabled"}>↩️ Annulla l'ultimo</button>
    </div>
    <div class="notte-nota">Un tocco = segnato adesso. Per correggere l'ora, esci e apri la voce dall'elenco.</div></div>`;
}
setInterval(() => { const el = document.getElementById("notte"); if (el && !el.hidden) disegnaNotte(); }, 20000);

/* azioni da link (Comandi rapidi dell'iPhone, scorciatoie Android): …/gioele/#azione=pipi */
async function eseguiAzioneDaLink(az, par) {
  const azioni = {
    notte: () => apriNotte(), pipi: () => pannolinoSubito("pipi"), cacca: () => pannolinoSubito("cacca"), entrambi: () => pannolinoSubito("entrambi"),
    biberon: () => biberonSubito(num(par.get("ml"))), ripeti: () => ripetiUltimoPasto(), vitd: () => segnaVitaminaD(),
    dorme: () => addormentato(), sveglio: () => sveglio(), "seno-sx": () => avviaPoppata("sx"), "seno-dx": () => avviaPoppata("dx"), fine: () => finePoppataSubito()
  };
  if (!azioni[az]) return;
  if (soloLettura() && az !== "notte") return toast("Sei in sola lettura");
  await azioni[az]();
}

/* =====================================================================
   BLOCCO CON FACE ID / TOUCH ID (WebAuthn) + codice di riserva
   Resta tutto sul telefono: serve a non far vedere i dati a chi prende il telefono.
   ===================================================================== */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const daB64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function hashCodice(c) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gioele:" + c)); return b64u(h); }
const bloccoAttivo = () => !!ls.get("bloccoCred", null) || !!ls.get("bloccoPin", null);
async function attivaBlocco() {
  const pin = prompt("Scegli un codice di riserva (4-8 cifre), da usare se Face ID non funziona:");
  if (pin == null) return;
  if (!/^\d{4,8}$/.test(pin)) return toast("Il codice deve avere da 4 a 8 cifre", 4000);
  ls.set("bloccoPin", await hashCodice(pin));
  if (window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()) {
    try {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "Gioele" },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "gioele", displayName: "App Gioele" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" }, timeout: 60000 } });
      ls.set("bloccoCred", b64u(cred.rawId));
      toast("🔒 Blocco attivo con Face ID e codice di riserva", 4000);
    } catch (e) { toast("Face ID non attivato (" + e.name + "): resta il blocco con il codice", 5000); }
  } else toast("🔒 Blocco attivo con il codice (Face ID non disponibile su questo dispositivo)", 5000);
  render();
}
function disattivaBlocco() { if (!confirm("Togliere il blocco dell'app su questo telefono?")) return; ls.del("bloccoCred"); ls.del("bloccoPin"); toast("Blocco tolto"); render(); }
function mostraBlocco() {
  if (!bloccoAttivo() || document.getElementById("blocco")) return;
  const el = document.createElement("div"); el.id = "blocco";
  el.innerHTML = `<div class="blocco-in"><img src="icona-192.png" alt="" width="72" height="72" style="border-radius:18px">
    <h2 style="margin:14px 0 4px">Gioele</h2><div class="small" style="opacity:.8;margin-bottom:18px">App bloccata</div>
    ${ls.get("bloccoCred", null) ? `<button type="button" class="btn pri" id="sbloccaFace" style="font-size:18px;padding:14px 22px">🔓 Sblocca con Face ID</button>` : ""}
    <form id="sbloccaPin" style="margin-top:16px;display:flex;gap:8px;justify-content:center"><input type="password" inputmode="numeric" autocomplete="off" placeholder="Codice" aria-label="Codice di sblocco" style="width:140px;text-align:center;font-size:20px"><button class="btn">OK</button></form>
    <div id="bloccoErr" class="small" style="color:#F2776C;margin-top:8px"></div></div>`;
  document.body.appendChild(el);
  const ok = () => { el.remove(); ls.set("ultimoSblocco", Date.now()); };
  el.querySelector("#sbloccaFace")?.addEventListener("click", async () => {
    try {
      await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: daB64u(ls.get("bloccoCred")) }], userVerification: "required", timeout: 60000 } });
      ok();
    } catch (e) { el.querySelector("#bloccoErr").textContent = "Face ID non riuscito: usa il codice."; }
  });
  el.querySelector("#sbloccaPin").addEventListener("submit", async ev => {
    ev.preventDefault(); const v = ev.target.querySelector("input").value;
    if (await hashCodice(v) === ls.get("bloccoPin")) ok(); else { el.querySelector("#bloccoErr").textContent = "Codice sbagliato"; ev.target.querySelector("input").value = ""; }
  });
}
/* si richiede lo sblocco all'apertura e dopo 5 minuti in sottofondo */
let nascostaDa = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") nascostaDa = Date.now();
  else if (bloccoAttivo() && nascostaDa && Date.now() - nascostaDa > 5 * 60000) mostraBlocco();
});

/* =====================================================================
   BACKUP AUTOMATICO SETTIMANALE NELLA CARTELLA DRIVE
   ===================================================================== */
async function backupSettimanale() {
  if (!S.config.folderId || soloLettura()) return;
  if (S.config.ultimoBackup && Date.now() - S.config.ultimoBackup < 7 * 864e5) return;
  if (!S.config.backupFolderId) {
    const tr = await driveCerca(`name='Copie di sicurezza' and '${S.config.folderId}' in parents and trashed=false`, "files(id)");
    if (tr.length) S.config.backupFolderId = tr[0].id;
    else S.config.backupFolderId = (await gapi(`${DRIVE}/files?fields=id&supportsAllDrives=true`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Copie di sicurezza", mimeType: "application/vnd.google-apps.folder", parents: [S.config.folderId] }) })).id;
  }
  await driveCarica({ nome: `gioele-backup-${oggiISO()}.json`, mime: "application/json", parents: [S.config.backupFolderId], blob: new Blob([JSON.stringify(S)], { type: "application/json" }) });
  S.config.ultimoBackup = Date.now();
  /* si tengono le ultime 8 copie */
  const vecchie = (await driveCerca(`'${S.config.backupFolderId}' in parents and trashed=false and name contains 'gioele-backup-'`, "files(id,name)")).sort((a, b) => b.name.localeCompare(a.name)).slice(8);
  for (const f of vecchie) { try { await gapi(`${DRIVE}/files/${f.id}?supportsAllDrives=true`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) }); } catch {} }
}

/* =====================================================================
   SCHEDE IN "ALTRO": blocco e scorciatoie
   ===================================================================== */
function cardsAltroExtra() {
  const base = `${location.origin}${location.pathname}`;
  const scorc = [["notte", "🌙 Modalità notte"], ["biberon", "🍼 Biberon (ml del giorno)"], ["ripeti", "🔁 Ripeti l'ultimo pasto"], ["pipi", "💧 Pipì"], ["cacca", "💩 Cacca"], ["dorme", "😴 Si è addormentato"], ["sveglio", "☀️ Si è svegliato"], ["vitd", "💊 Vitamina D data"]];
  return `${cardTema()}
  <h2>Blocco dell'app</h2>
  <div class="card small">${bloccoAttivo() ? `🔒 <b>Attivo</b>: all'apertura (e dopo 5 minuti in sottofondo) l'app chiede Face ID o il codice.<div class="btns"><button type="button" class="btn bad" data-act="blocco-togli">Togli il blocco</button></div>`
    : `Protegge i dati sanitari e i documenti di Gioele con <b>Face ID</b> (o il codice) quando apri l'app su questo telefono.<div class="btns"><button type="button" class="btn" data-act="blocco-attiva">🔒 Attiva il blocco</button></div>`}</div>
  <h2>Azioni con un tocco</h2>
  <div class="card small">Ogni link segna subito l'azione aprendo l'app. Su Android tieni premuta l'icona di Gioele per le scorciatoie principali. Su iPhone, nell'app <b>Comandi</b>, crea un comando “Apri URL” con uno di questi indirizzi e mettilo sulla schermata Home o su “Tocca il retro” (Impostazioni → Accessibilità → Tocco). <i>Nota: su iPhone i Comandi aprono il link in Safari, che ha una memoria separata dall'app installata: su iPhone conviene usare la modalità notte.</i>
    ${scorc.map(([a, t]) => `<div class="slot"><span>${t}</span><button type="button" class="btn sm" data-act="copia-link" data-link="${esc(base + "#azione=" + a)}">📋 Copia link</button></div>`).join("")}</div>`;
}

/* =====================================================================
   AZIONI (dal gestore principale)
   ===================================================================== */
async function azioneExtra(act, b, e) {
  switch (act) {
    case "notte-apri": apriNotte(); return true;
    case "tema": ls.set("tema", b.dataset.tema); applicaTema(); render(); toast(TEMI[b.dataset.tema]); return true;
    case "notte-chiudi": chiudiNotte(); return true;
    case "notte-poppata": avviaPoppata(b.dataset.seno); disegnaNotte(); return true;
    case "notte-fine-poppata": await finePoppataSubito(); disegnaNotte(); return true;
    case "notte-biberon": await biberonSubito(); disegnaNotte(); return true;
    case "notte-ripeti": await ripetiUltimoPasto(); disegnaNotte(); return true;
    case "notte-pann": await pannolinoSubito(b.dataset.tipo); disegnaNotte(); return true;
    case "notte-annulla": await annullaUltima(); return true;
    case "ripeti-pasto": await ripetiUltimoPasto(); return true;
    case "sonno-dorme": await addormentato(); disegnaNotte(); return true;
    case "sonno-sveglio": await sveglio(); disegnaNotte(); return true;
    case "sonno-nuovo": formSonno(); return true;
    case "apri-sonno": formSonno(S.sonno.find(x => x.id === b.dataset.id)); return true;
    case "pg-spunta": await spuntaPrimiGiorni(b.dataset.k, b.checked); return true;
    case "blocco-attiva": await attivaBlocco(); return true;
    case "blocco-togli": disattivaBlocco(); return true;
    case "copia-link": try { await navigator.clipboard.writeText(b.dataset.link); toast("Link copiato"); } catch { prompt("Copia il link:", b.dataset.link); } return true;
  }
  return false;
}

/* avvio: link con azioni, blocco */
async function avvioExtra() {
  const h = new URLSearchParams(location.hash.slice(1));
  ls.del("ponte"); ls.del("ponteChiave");   // impostazioni di una versione precedente, non più usate
  mostraBlocco();
  const az = h.get("azione");
  if (az) { history.replaceState(null, "", location.pathname); await eseguiAzioneDaLink(az, h); render(); }
  else if (ls.get("notteAperta", false)) apriNotte();
}
window.addEventListener("hashchange", async () => {
  const h = new URLSearchParams(location.hash.slice(1)), az = h.get("azione");
  if (az) { history.replaceState(null, "", location.pathname); await eseguiAzioneDaLink(az, h); render(); }
});
