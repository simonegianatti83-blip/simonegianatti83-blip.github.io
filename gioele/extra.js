/* =====================================================================
   Gioele – EXTRA
   modalità notte e azioni con un tocco, sonno, statistiche dei pasti,
   checklist dei primi giorni, blocco con Face ID, backup automatico,
   collegamento "sempre attivo" tramite Google Apps Script (ponte).
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
    <div class="slot"><span>Ultime 24 ore</span><b>${nPasti(s.n24)}${s.ml24 ? ` · ${s.ml24} ml` : ""}${s.minSeno24 ? ` · ${s.minSeno24} min al seno` : ""}</b></div>
    ${s.intMedio ? `<div class="slot"><span>Tempo medio tra un pasto e l'altro</span><b>${hhmmDurata(s.intMedio)}</b></div><div class="slot"><span>Pausa più lunga</span><b>${hhmmDurata(s.intMax)}</b></div>` : ""}
    ${s.mlMedio ? `<div class="slot"><span>Rinforzo medio</span><b>${s.mlMedio} ml${ob ? ` <span class="chip ${s.mlMedio >= ob ? "ok" : ""}">indicati ${ob}</span>` : ""}</b></div>` : ""}
    ${s.giorni7 ? `<div class="slot"><span>Media dei giorni precedenti (${s.giorni7})</span><b>${fmt(s.pastiGiorno7, 1)} pasti · ${s.mlGiorno7} ml al giorno</b></div>` : ""}
    <div class="tiny" style="margin-top:6px">Riferimento della regola: ${r.pastiMin}-${r.pastiMax} pasti al giorno, ogni ${hm(r.intervalloMin)} circa.</div></div>`;
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
  if (el.dataset.temaPrima) document.documentElement.dataset.theme = el.dataset.temaPrima; else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0E746E");
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
   COLLEGAMENTO SEMPRE ATTIVO (ponte Google Apps Script)
   Lo script gira sull'account Google di Simone e fa le richieste a Drive e
   Calendar al posto dell'app: niente accesso che scade ogni ora.
   ===================================================================== */
const ponte = () => ls.get("ponte", null);   // { url, chiave }
async function gapiPonte(url, opt = {}) {
  const p = ponte();
  let corpo = "", tipo = opt.headers?.["Content-Type"] || "";
  if (opt.body instanceof FormData) { const r = new Response(opt.body); tipo = r.headers.get("content-type"); corpo = b64Buf(await r.arrayBuffer()); }
  else if (opt.body != null) corpo = b64Buf(new TextEncoder().encode(String(opt.body)));
  let r;
  try { r = await fetch(p.url, { method: "POST", body: JSON.stringify({ chiave: p.chiave, url, metodo: opt.method || "GET", tipo, corpo }), headers: { "Content-Type": "text/plain;charset=utf-8" } }); }
  catch (e) { throw new Error("Collegamento sempre attivo non raggiungibile (sei offline?)"); }
  let j; try { j = await r.json(); } catch { throw new Error("Risposta non valida dal collegamento sempre attivo: controlla l'indirizzo dello script"); }
  if (j.errore) throw new Error("Collegamento sempre attivo: " + j.errore);
  const bytes = Uint8Array.from(atob(j.corpo || ""), c => c.charCodeAt(0));
  if (j.stato >= 400) {
    let msg = "Errore " + j.stato;
    try { msg = JSON.parse(new TextDecoder().decode(bytes)).error?.message || msg; } catch {}
    throw new Error(msg);
  }
  if (j.stato === 204 || !bytes.length) return null;
  if (opt.blob) return new Blob([bytes], { type: (j.tipo || "").split(";")[0] || "application/octet-stream" });
  const testo = new TextDecoder().decode(bytes);
  return (j.tipo || "").includes("json") ? JSON.parse(testo) : testo;
}
function b64Buf(buf) { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
function codicePonte(chiave) {
  return `/* Gioele – collegamento sempre attivo (Google Apps Script)
   Fa da ponte tra l'app e il tuo Google Drive / Google Calendar.
   Accetta SOLO richieste con la chiave qui sotto e SOLO verso la cartella
   e il calendario di Gioele. Non condividere la chiave fuori dalla famiglia. */
const CHIAVE = "${chiave}";
const CARTELLA = "${S.config.folderId || ""}";
const CALENDARIO = "${S.config.calendarId || ""}";

function doGet() { return risposta({ ok: true, app: "Gioele" }); }

function doPost(e) {
  try {
    const r = JSON.parse(e.postData.contents);
    if (r.chiave !== CHIAVE) return risposta({ errore: "chiave non valida" });
    if (!permesso(r)) return risposta({ errore: "richiesta non permessa" });
    const p = { method: String(r.metodo || "GET").toLowerCase(), headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
    if (r.corpo) { p.payload = Utilities.base64Decode(r.corpo); p.contentType = r.tipo || "application/octet-stream"; }
    const res = UrlFetchApp.fetch(r.url, p);
    const h = res.getHeaders();
    return risposta({ stato: res.getResponseCode(), tipo: h["Content-Type"] || h["content-type"] || "", corpo: Utilities.base64Encode(res.getContent()) });
  } catch (err) { return risposta({ errore: String(err) }); }
}

function permesso(r) {
  const u = String(r.url);
  if (u.indexOf("https://www.googleapis.com/oauth2/v3/userinfo") === 0) return true;
  let m = u.match(/^https:\\/\\/www\\.googleapis\\.com\\/calendar\\/v3\\/calendars\\/([^/?]+)/);
  if (m) return decodeURIComponent(m[1]) === CALENDARIO;
  if (u.indexOf("https://www.googleapis.com/calendar/v3/users/me/calendarList") === 0) return true;
  m = u.match(/^https:\\/\\/www\\.googleapis\\.com\\/(upload\\/)?drive\\/v3\\/files\\/([\\w-]+)/);
  if (m) return nellaCartella(m[2]);
  if (/^https:\\/\\/www\\.googleapis\\.com\\/drive\\/v3\\/files\\?/.test(u)) {
    const q = decodeURIComponent((u.match(/[?&]q=([^&]*)/) || [])[1] || "").replace(/\\+/g, " ");
    if (r.metodo === "POST") return genitoreNellaCartella(r);
    return q.indexOf("'" + CARTELLA + "' in parents") >= 0 || /^name='gioele-dati\\.json' and trashed=false$/.test(q) || q.indexOf(" in parents") > 0 && nellaCartella((q.match(/'([\\w-]+)' in parents/) || [])[1]);
  }
  if (/^https:\\/\\/www\\.googleapis\\.com\\/upload\\/drive\\/v3\\/files\\?/.test(u)) return genitoreNellaCartella(r);
  return false;
}
function genitoreNellaCartella(r) {
  try {
    const testo = Utilities.newBlob(Utilities.base64Decode(r.corpo || "")).getDataAsString();
    const m = testo.match(/"parents"\\s*:\\s*\\[\\s*"([\\w-]+)"/);
    return !!m && nellaCartella(m[1]);
  } catch (e) { return false; }
}
function nellaCartella(id) {
  if (!id) return false;
  if (id === CARTELLA) return true;
  try {
    let corrente = [id];
    for (let livello = 0; livello < 5 && corrente.length; livello++) {
      const prossimi = [];
      for (const x of corrente) {
        const it = (livello === 0 ? (function () { try { return DriveApp.getFolderById(x).getParents(); } catch (e) { return DriveApp.getFileById(x).getParents(); } })() : DriveApp.getFolderById(x).getParents());
        while (it.hasNext()) { const f = it.next().getId(); if (f === CARTELLA) return true; prossimi.push(f); }
      }
      corrente = prossimi;
    }
  } catch (e) {}
  return false;
}
function risposta(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;
}
const MANIFEST_PONTE = `{
  "timeZone": "Europe/Rome",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email"
  ],
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }
}`;
function cardPonte() {
  const p = ponte();
  if (p) return `<div class="card"><b>⚡ Collegamento sempre attivo: attivo</b>
      <div class="small muted" style="margin-top:4px">Le modifiche arrivano a Drive e al calendario senza dover rifare l'accesso ogni ora.</div>
      <div class="btns"><button type="button" class="btn" data-act="ponte-prova">🔍 Prova</button><button type="button" class="btn" data-act="ponte-link">💬 Manda a Silvia</button><button type="button" class="btn bad" data-act="ponte-togli">Disattiva su questo telefono</button></div></div>`;
  if (!S.config.folderId || !S.config.calendarId) return `<div class="card small"><b>⚡ Collegamento sempre attivo</b><br>Prima collega Google (sopra): serve la cartella e il calendario di Gioele.</div>`;
  return `<div class="card"><b>⚡ Collegamento sempre attivo (consigliato)</b>
    <div class="small muted" style="margin-top:4px">Oggi l'accesso a Google dura un'ora: poi le modifiche non arrivano a Silvia e al calendario finché non tocchi “Accedi”. Con un piccolo script sul tuo account Google l'app resta sempre collegata. Si fa una volta sola, dal computer (10 minuti).</div>
    <details style="margin-top:8px"><summary><b>Come si attiva</b></summary><ol class="steps small">
      <li>Tocca <b>“Prepara lo script”</b> qui sotto: l'app crea il codice con una chiave segreta.</li>
      <li>Sul computer vai su <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> (con il tuo account Google) → nuovo progetto, nome “Gioele ponte”.</li>
      <li>Cancella tutto in <b>Codice.gs</b> e incolla il <b>codice</b>. In <b>Impostazioni progetto</b> spunta “Mostra il file manifest appsscript.json”, aprilo e sostituiscilo con il <b>manifest</b>.</li>
      <li><b>Esegui il deployment → Nuovo deployment → Applicazione web</b>: “Esegui come: Me”, “Chi ha accesso: Chiunque”. Autorizza (Avanzate → Vai a Gioele ponte).</li>
      <li>Copia l'<b>URL dell'applicazione web</b> (finisce con /exec) e incollalo qui sotto, poi “Attiva”.</li></ol></details>
    <div class="btns"><button type="button" class="btn" data-act="ponte-prepara">🧩 Prepara lo script</button></div>
    <div id="ponteCodice"></div>
    <label class="f">URL dello script (…/exec)<input type="url" id="inPonteUrl" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
    <div class="btns"><button type="button" class="btn pri" data-act="ponte-attiva">⚡ Attiva</button></div></div>`;
}
async function preparaPonte() {
  let k = ls.get("ponteChiave", "");
  if (!k) { k = b64u(crypto.getRandomValues(new Uint8Array(24))); ls.set("ponteChiave", k); }
  const codice = codicePonte(k);
  $("#ponteCodice").innerHTML = `<label class="f">Codice (Codice.gs)<textarea readonly style="min-height:120px;font-family:monospace;font-size:12px">${esc(codice)}</textarea></label>
    <div class="btns"><button type="button" class="btn sm" data-act="ponte-copia" data-cosa="codice">📋 Copia il codice</button><button type="button" class="btn sm" data-act="ponte-copia" data-cosa="manifest">📋 Copia il manifest</button><button type="button" class="btn sm" data-act="ponte-invia">💬 Mandalo al computer</button></div>
    <label class="f">Manifest (appsscript.json)<textarea readonly style="min-height:90px;font-family:monospace;font-size:12px">${esc(MANIFEST_PONTE)}</textarea></label>`;
}
async function attivaPonte() {
  const url = ($("#inPonteUrl")?.value || "").trim(), chiave = ls.get("ponteChiave", "");
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error("L'indirizzo deve essere quello dell'applicazione web (https://script.google.com/macros/s/…/exec)");
  if (!chiave) throw new Error("Prima tocca “Prepara lo script”");
  ls.set("ponte", { url, chiave });
  try { await gapi("https://www.googleapis.com/oauth2/v3/userinfo"); }
  catch (e) { ls.del("ponte"); throw e; }
  ls.set("collegato", true); toast("⚡ Collegamento sempre attivo: funziona!", 4000); render(); sincronizza(false);
}
const linkPonte = () => { const p = ponte(); return `${location.origin}${location.pathname}#ponte=${encodeURIComponent(p.url)}&chiave=${encodeURIComponent(p.chiave)}`; };

/* =====================================================================
   SCHEDE IN "ALTRO": blocco, scorciatoie, ponte
   ===================================================================== */
function cardsAltroExtra() {
  const base = `${location.origin}${location.pathname}`;
  const scorc = [["notte", "🌙 Modalità notte"], ["biberon", "🍼 Biberon (ml del giorno)"], ["ripeti", "🔁 Ripeti l'ultimo pasto"], ["pipi", "💧 Pipì"], ["cacca", "💩 Cacca"], ["dorme", "😴 Si è addormentato"], ["sveglio", "☀️ Si è svegliato"], ["vitd", "💊 Vitamina D data"]];
  return `<h2>Collegamento sempre attivo</h2>${cardPonte()}
  <h2>Blocco dell'app</h2>
  <div class="card small">${bloccoAttivo() ? `🔒 <b>Attivo</b>: all'apertura (e dopo 5 minuti in sottofondo) l'app chiede Face ID o il codice.<div class="btns"><button type="button" class="btn bad" data-act="blocco-togli">Togli il blocco</button></div>`
    : `Protegge i dati sanitari e i documenti di Gioele con <b>Face ID</b> (o il codice) quando apri l'app su questo telefono.<div class="btns"><button type="button" class="btn" data-act="blocco-attiva">🔒 Attiva il blocco</button></div>`}</div>
  <h2>Azioni con un tocco</h2>
  <div class="card small">Ogni link segna subito l'azione aprendo l'app. Su Android tieni premuta l'icona di Gioele per le scorciatoie principali. Su iPhone, nell'app <b>Comandi</b>, crea un comando “Apri URL” con uno di questi indirizzi e mettilo sulla schermata Home o su “Tocca il retro” (Impostazioni → Accessibilità → Tocco). <i>Nota: su iPhone i Comandi aprono il link in Safari: funziona bene se anche Safari è collegato a Google (o con il collegamento sempre attivo).</i>
    ${scorc.map(([a, t]) => `<div class="slot"><span>${t}</span><button type="button" class="btn sm" data-act="copia-link" data-link="${esc(base + "#azione=" + a)}">📋 Copia link</button></div>`).join("")}</div>`;
}

/* =====================================================================
   AZIONI (dal gestore principale)
   ===================================================================== */
async function azioneExtra(act, b, e) {
  switch (act) {
    case "notte-apri": apriNotte(); return true;
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
    case "ponte-prepara": await preparaPonte(); return true;
    case "ponte-copia": { const t = b.dataset.cosa === "manifest" ? MANIFEST_PONTE : codicePonte(ls.get("ponteChiave", "")); try { await navigator.clipboard.writeText(t); toast("Copiato"); } catch { toast("Copia non riuscita: seleziona il testo e copialo a mano", 4000); } return true; }
    case "ponte-invia": condividi({ titolo: "Gioele – script ponte", testo: "CODICE (Codice.gs):\n\n" + codicePonte(ls.get("ponteChiave", "")) + "\n\nMANIFEST (appsscript.json):\n\n" + MANIFEST_PONTE }); return true;
    case "ponte-attiva": b.disabled = true; try { await attivaPonte(); } catch (err) { toast(err.message, 6000); } finally { b.disabled = false; } return true;
    case "ponte-prova": try { await gapi("https://www.googleapis.com/oauth2/v3/userinfo"); toast("⚡ Funziona"); } catch (err) { toast(err.message, 6000); } return true;
    case "ponte-link": condividi({ titolo: "Gioele – collegamento sempre attivo", testo: `Apri questo link sul tuo telefono per collegare l'app Gioele senza dover rifare l'accesso (è personale, non inoltrarlo):\n${linkPonte()}` }); return true;
    case "ponte-togli": if (confirm("Disattivare il collegamento sempre attivo su questo telefono? Tornerai all'accesso Google normale.")) { ls.del("ponte"); render(); } return true;
  }
  return false;
}

/* avvio: link con azioni o con il collegamento, blocco */
async function avvioExtra() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("ponte") && h.get("chiave")) {
    ls.set("ponte", { url: h.get("ponte"), chiave: h.get("chiave") }); ls.set("collegato", true);
    history.replaceState(null, "", location.pathname); toast("⚡ Collegamento sempre attivo impostato", 4000); render(); sincronizza(false);
  }
  mostraBlocco();
  const az = h.get("azione");
  if (az) { history.replaceState(null, "", location.pathname); await eseguiAzioneDaLink(az, h); render(); }
  else if (ls.get("notteAperta", false)) apriNotte();
}
window.addEventListener("hashchange", async () => {
  const h = new URLSearchParams(location.hash.slice(1)), az = h.get("azione");
  if (az) { history.replaceState(null, "", location.pathname); await eseguiAzioneDaLink(az, h); render(); }
});
