/* =====================================================================
   Gioele – SEZIONE SALUTE E FUNZIONI DI FAMIGLIA
   crescita (percentili OMS), vaccini, bilanci di salute, screening neonatali,
   registro farmaci, diario febbre/sintomi, tappe dello sviluppo,
   domande per la visita, spese mediche (730), scheda emergenze.
   ===================================================================== */
"use strict";

/* ---------- utilità ---------- */
const oraLocale = (d = new Date()) => `${oggiISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const daOraLocale = s => { const [d, t = "00:00"] = s.split("T"); const x = parseISO(d); const [h, m] = t.split(":").map(Number); x.setHours(h, m); return x; };
const quandoBreve = s => { const d = daOraLocale(s), oggi = oggiISO(), ieri = oggiISO(new Date(Date.now() - 864e5)); const g = oggiISO(d); return `${g === oggi ? "oggi" : g === ieri ? "ieri" : d.getDate() + " " + MESI[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const giorniDiVita = (iso = oggiISO()) => S.profilo.nascita ? Math.round((parseISO(iso) - parseISO(S.profilo.nascita)) / 864e5) : null;
const dataDaGiorni = g => { const d = parseISO(S.profilo.nascita); d.setDate(d.getDate() + g); return oggiISO(d); };
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : n; };
const fmt = (n, dec = 1) => n == null ? "" : n.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const euro = n => (n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const attivi = k => (S[k] || []).filter(x => !x.deleted);
const mioNome = () => ls.get("mioNome", "") || (G.email ? G.email.split("@")[0] : "");
function etaAlGiorno(g) {
  if (g == null) return "";
  if (g === 0) return "alla nascita";
  if (g < 60) return g + (g === 1 ? " giorno" : " giorni");
  const m = Math.floor(g / 30.4375);
  if (m < 24) return m + " mesi";
  const a = Math.floor(m / 12), r = m % 12;
  return a + " anni" + (r ? " e " + r + " mesi" : "");
}
const etaMesi = mesi => mesi < 1 ? Math.round(mesi * 30) + " giorni" : mesi < 24 ? mesi + (mesi === 1 ? " mese" : " mesi") : (mesi % 12 ? (mesi / 12).toFixed(1).replace(".", ",") : mesi / 12) + " anni";

/* =====================================================================
   CRESCITA – percentili OMS
   ===================================================================== */
const IND = {
  peso: { nome: "Peso", unita: "kg", dec: 2 },
  lunghezza: { nome: "Lunghezza / altezza", unita: "cm", dec: 1 },
  testa: { nome: "Circonferenza della testa", unita: "cm", dec: 1 }
};
function lmsAl(ind, giorno) {
  const t = OMS_MASCHI[ind]; if (!t || giorno < 0 || giorno > t[t.length - 1][0]) return null;
  let i = t.findIndex(r => r[0] >= giorno);
  if (t[i][0] === giorno || i === 0) return t[i].slice(1);
  const [g0, ...a] = t[i - 1], [g1, ...b] = t[i], k = (giorno - g0) / (g1 - g0);
  return a.map((v, j) => v + (b[j] - v) * k);
}
const valoreAZ = ([L, M, Sg], z) => L === 0 ? M * Math.exp(Sg * z) : M * Math.pow(1 + L * Sg * z, 1 / L);
const zDiValore = ([L, M, Sg], x) => L === 0 ? Math.log(x / M) / Sg : (Math.pow(x / M, L) - 1) / (L * Sg);
function normCdf(z) {   // funzione di ripartizione normale (Abramowitz-Stegun)
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
function percentile(ind, giorno, valore) {
  const lms = lmsAl(ind, giorno); if (!lms || !valore) return null;
  const z = zDiValore(lms, valore), p = normCdf(z) * 100;
  return { z, p, testo: p < 0.1 ? "< 0,1°" : p > 99.9 ? "> 99,9°" : (p < 10 || p > 90 ? fmt(p, 1) : Math.round(p)) + "°" };
}
const Z_CURVE = [[-1.881, "3°"], [-1.036, "15°"], [0, "50°"], [1.036, "85°"], [1.881, "97°"]];
const misureOrd = () => attivi("misure").sort((a, b) => a.data.localeCompare(b.data));
/* ---------- variazione del peso ---------- */
const grammi = kg => Math.round(kg * 1000);
const conSegno = n => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n).toLocaleString("it-IT");
/* peso di nascita: la misura del giorno della nascita (o del giorno dopo) */
function pesoNascita() {
  if (!S.profilo.nascita) return null;
  return misureOrd().find(m => m.peso && giorniDiVita(m.data) <= 1) || null;
}
/* confronto di un peso (in kg, alla data indicata) con la pesata precedente e con la nascita */
function confrontoPeso(data, peso, escludiId) {
  if (!peso || !data) return null;
  const prec = misureOrd().filter(m => m.peso && m.data < data && m.id !== escludiId).pop();
  const out = { peso };
  if (prec) {
    const giorni = Math.round((parseISO(data) - parseISO(prec.data)) / 864e5);
    out.prec = prec; out.diff = grammi(peso) - grammi(prec.peso); out.giorni = giorni;
    if (giorni > 0) { out.alGiorno = Math.round(out.diff / giorni); out.allaSettimana = Math.round(out.diff / giorni * 7); }
  }
  const n = pesoNascita(), g = giorniDiVita(data);
  if (n && n.id !== escludiId && n.data < data && g != null && g <= 42) {
    out.nascita = n; out.diffNascita = grammi(peso) - grammi(n.peso); out.percNascita = (peso - n.peso) / n.peso * 100;
  }
  return out;
}
function testoConfronto(c, breve = false) {
  if (!c || (!c.prec && !c.nascita)) return "";
  const parti = [];
  if (c.prec) {
    const col = c.diff > 0 ? "var(--ok)" : c.diff < 0 ? "var(--bad)" : "var(--ink-2)";
    parti.push(breve ? `<span style="color:${col};font-weight:700">${conSegno(c.diff)} g</span>`
      : `<b style="color:${col}">${conSegno(c.diff)} g</b> rispetto al ${dataBreve(c.prec.data)} (${fmt(c.prec.peso, 3).replace(/0+$/, "").replace(/,$/, "")} kg)${c.giorni > 0 ? `, in ${c.giorni} ${c.giorni === 1 ? "giorno" : "giorni"}: <b>${conSegno(c.alGiorno)} g al giorno</b>${c.giorni >= 2 ? ` (circa ${conSegno(c.allaSettimana)} g alla settimana)` : ""}` : ""}`);
  }
  if (c.nascita && !breve) {
    const p = c.percNascita;
    let nota = "";
    if (p < -10) nota = ` <span class="chip bad">calo oltre il 10%: sentite la pediatra</span>`;
    else if (p < 0) nota = `<br><span class="tiny">Nei primi giorni un calo fino a circa il 10% è normale; di solito il peso di nascita si recupera entro 2 settimane.</span>`;
    else nota = ` <span class="chip ok">peso di nascita recuperato</span>`;
    parti.push(`Dalla nascita (${fmt(c.nascita.peso, 3).replace(/0+$/, "").replace(/,$/, "")} kg): <b>${conSegno(c.diffNascita)} g</b> (${p >= 0 ? "+" : "−"}${fmt(Math.abs(p), 1)}%)${nota}`);
  }
  return parti.join("<br>");
}

/* grafico SVG: curve dei percentili + punti di Gioele */
function graficoCrescita(ind, { larg = 380, alt = 270, perStampa = false } = {}) {
  const punti = misureOrd().filter(m => m[ind]).map(m => ({ g: giorniDiVita(m.data), v: m[ind] })).filter(p => p.g != null && p.g >= 0 && p.g <= 1856);
  const oggiG = giorniDiVita() ?? 0;
  const maxG = Math.min(1856, Math.max(92, Math.ceil((Math.max(oggiG, ...punti.map(p => p.g)) + 45) / 30.4375) * 30.4375));
  const passi = []; for (let g = 0; g <= maxG; g += maxG > 400 ? 14 : 3) passi.push(Math.round(g));
  const curve = Z_CURVE.map(([z, et]) => ({ et, z, pts: passi.map(g => [g, valoreAZ(lmsAl(ind, g), z)]) }));
  const tutti = [...curve.flatMap(c => c.pts.map(p => p[1])), ...punti.map(p => p.v)];
  let yMin = Math.min(...tutti), yMax = Math.max(...tutti); const marg = (yMax - yMin) * 0.06; yMin -= marg; yMax += marg;
  const pl = 44, pr = 34, pt = 12, pb = 30, W = larg - pl - pr, H = alt - pt - pb;
  const X = g => pl + g / maxG * W, Y = v => pt + H - (v - yMin) / (yMax - yMin) * H;
  const col = perStampa ? { asse: "#9aa", testo: "#455", curva: "#0E746E", punto: "#C2410C", griglia: "#e3ebea" } : { asse: "var(--line)", testo: "var(--ink-3)", curva: "var(--brand)", punto: "#E8590C", griglia: "var(--line-2)" };
  const mesiTot = maxG / 30.4375, passoM = mesiTot <= 4 ? 1 : mesiTot <= 13 ? 2 : mesiTot <= 25 ? 3 : 6;
  let s = `<svg viewBox="0 0 ${larg} ${alt}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" role="img" aria-label="${esc(IND[ind].nome)} sulle curve OMS">`;
  if (perStampa) s += `<rect width="${larg}" height="${alt}" fill="#fff"/>`;
  const passoY = (yMax - yMin) > 40 ? 10 : (yMax - yMin) > 16 ? 5 : (yMax - yMin) > 6 ? 2 : 1;
  for (let v = Math.ceil(yMin / passoY) * passoY; v <= yMax; v += passoY) s += `<line x1="${pl}" x2="${pl + W}" y1="${Y(v)}" y2="${Y(v)}" stroke="${col.griglia}"/><text x="${pl - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="${col.testo}">${v}</text>`;
  for (let m = 0; m <= mesiTot + 0.01; m += passoM) s += `<line x1="${X(m * 30.4375)}" x2="${X(m * 30.4375)}" y1="${pt}" y2="${pt + H}" stroke="${col.griglia}"/><text x="${X(m * 30.4375)}" y="${alt - 10}" font-size="11" text-anchor="middle" fill="${col.testo}">${m < 24 ? m + "m" : m / 12 + "a"}</text>`;
  for (const c of curve) {
    s += `<polyline fill="none" stroke="${col.curva}" stroke-width="${c.z === 0 ? 2 : 1.2}" stroke-opacity="${c.z === 0 ? .9 : .45}" ${Math.abs(c.z) > 1.5 ? 'stroke-dasharray="4 3"' : ""} points="${c.pts.map(p => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ")}"/>`;
    const u = c.pts[c.pts.length - 1]; s += `<text x="${pl + W + 3}" y="${Y(u[1]) + 4}" font-size="10" fill="${col.testo}">${c.et}</text>`;
  }
  if (punti.length > 1) s += `<polyline fill="none" stroke="${col.punto}" stroke-width="2" points="${punti.map(p => X(p.g).toFixed(1) + "," + Y(p.v).toFixed(1)).join(" ")}"/>`;
  for (const p of punti) s += `<circle cx="${X(p.g)}" cy="${Y(p.v)}" r="4.5" fill="${col.punto}" stroke="#fff" stroke-width="1.5"/>`;
  s += `<text x="${pl}" y="${pt + 10}" font-size="11" fill="${col.testo}">${IND[ind].unita}</text></svg>`;
  return s;
}

function vCrescita() {
  const m = misureOrd(), ultima = m[m.length - 1];
  if (!S.profilo.nascita) return `<div class="notice warn">Per calcolare i percentili serve la data di nascita di Gioele. <a href="#" data-act="profilo">Inseriscila qui</a>.</div>`;
  const sez = ls.get("indCrescita", "peso");
  const righe = m.slice().reverse().map(x => {
    const g = giorniDiVita(x.data);
    const cell = k => x[k] ? `${fmt(x[k], k === "peso" ? 2 : 1)}<br><span class="tiny">${percentile(k, g, x[k])?.testo || ""}</span>${k === "peso" ? (() => { const c = confrontoPeso(x.data, x.peso, x.id); return c?.prec ? `<br><span class="tiny">${testoConfronto(c, true)}${c.giorni > 0 ? ` in ${c.giorni} g` : ""}</span>` : ""; })() : ""}` : "–";
    return `<tr data-act="apri-misura" data-id="${x.id}" style="cursor:pointer"><td>${dataBreve(x.data)}<br><span class="tiny">${etaAlGiorno(g)}</span></td><td>${cell("peso")}</td><td>${cell("lunghezza")}</td><td>${cell("testa")}</td></tr>`;
  }).join("");
  return `<div class="card">
      ${ultima ? `<div class="small muted">Ultima misura: ${dataBreve(ultima.data)} (${etaAlGiorno(giorniDiVita(ultima.data))})</div>${(() => { const up = misureOrd().filter(m => m.peso).pop(); const c = up && confrontoPeso(up.data, up.peso, up.id); const t = testoConfronto(c); return t ? `<div class="small" style="margin-top:6px">⚖️ Ultimo peso ${fmt(up.peso, 3).replace(/0+$/, "").replace(/,$/, "")} kg (${dataBreve(up.data)}): ${t}</div>${c?.allaSettimana != null && giorniDiVita() <= 130 && (!c.nascita || c.percNascita >= 0) ? `<div class="tiny" style="margin-top:4px">Indicazione comune nei primi 3-4 mesi, dopo il recupero del peso di nascita: circa 150–200 g a settimana (circa 20–30 g al giorno). Ogni bambino ha il suo ritmo: valuta la pediatra.</div>` : ""}` : ""; })()}` : `<div class="small muted">Nessuna misura ancora. Inserisci quelle della nascita (le trovi nel foglio di dimissione) e di ogni controllo.</div>`}
      <div class="btns"><button type="button" class="btn pri" data-act="nuova-misura">📏 Aggiungi misure</button></div>
    </div>
    <div class="toolbar" style="gap:6px">${Object.entries(IND).map(([k, v]) => `<button type="button" class="btn sm ${sez === k ? "pri" : ""}" data-act="ind-crescita" data-ind="${k}">${v.nome.split(" /")[0].replace("Circonferenza della testa", "Testa")}</button>`).join("")}</div>
    <div class="card" style="padding:8px">${graficoCrescita(sez)}
      <div class="tiny" style="padding:0 6px">Curve OMS per maschi (3°, 15°, 50°, 85°, 97° percentile); in arancione Gioele. Il percentile indica quanti bambini su 100 della stessa età hanno un valore più basso.</div></div>
    ${m.length ? `<div class="card" style="padding:6px 8px;overflow-x:auto"><table class="tab"><thead><tr><th>Data</th><th>Peso kg</th><th>Lungh. cm</th><th>Testa cm</th></tr></thead><tbody>${righe}</tbody></table></div>` : ""}
    <div class="tiny">Standard di crescita OMS 2006 (0–5 anni). Valutare la crescita spetta alla pediatra: conta l'andamento nel tempo più del singolo percentile.</div>`;
}
function formMisura(x = {}) {
  const nuovo = !x.id;
  apriSheet(nuovo ? "Nuove misure" : "Misure", `
    <label class="f">Data<input type="date" name="data" value="${esc(x.data || oggiISO())}"></label>
    <div class="grid2"><label class="f">Peso (kg)<input type="text" inputmode="decimal" name="peso" value="${x.peso ? fmt(x.peso, 3).replace(/0+$/, "").replace(/,$/, "") : ""}" placeholder="es. 3,450"></label>
    <label class="f">Lunghezza (cm)<input type="text" inputmode="decimal" name="lunghezza" value="${x.lunghezza ? fmt(x.lunghezza, 1) : ""}" placeholder="es. 51,5"></label></div>
    <label class="f">Circonferenza della testa (cm)<input type="text" inputmode="decimal" name="testa" value="${x.testa ? fmt(x.testa, 1) : ""}" placeholder="es. 35"></label>
    <div id="anteprimaPerc" class="small" style="margin-top:10px"></div>
    <label class="f">Note<input type="text" name="note" value="${esc(x.note || "")}" placeholder="es. bilancio 1 mese, pesato dalla pediatra"></label>
    <div class="tiny" style="margin-top:6px">Il peso si può scrivere anche in grammi (es. 3450).</div>`,
  `${!nuovo ? `<button type="button" class="btn bad" data-act="elimina-voce" data-col="misure" data-id="${x.id}">Elimina</button><span style="flex:1"></span>` : ""}<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm"); let peso = num(f.elements.peso.value);
    if (peso > 100) peso = peso / 1000;   // scritto in grammi
    const dati = { data: f.elements.data.value, peso, lunghezza: num(f.elements.lunghezza.value), testa: num(f.elements.testa.value), note: f.elements.note.value.trim(), updatedAt: Date.now() };
    if (!dati.data) throw new Error("Indica la data");
    if (!dati.peso && !dati.lunghezza && !dati.testa) throw new Error("Inserisci almeno una misura");
    const c = dati.peso ? confrontoPeso(dati.data, dati.peso, x.id) : null;
    salvaVoce("misure", x, dati); await salva();
    toast(c?.prec ? `Misure salvate · peso ${c.diff >= 0 ? "+" : "−"}${Math.abs(c.diff)} g dal ${dataBreve(c.prec.data)}${c.giorni > 0 ? ` (${conSegno(c.alGiorno)} g al giorno)` : ""}` : "Misure salvate", 5000);
  });
  const f = $("#sheetForm");
  const anteprima = () => {
    const g = giorniDiVita(f.elements.data.value); if (g == null) return;
    let peso = num(f.elements.peso.value); if (peso > 100) peso /= 1000;
    const v = { peso, lunghezza: num(f.elements.lunghezza.value), testa: num(f.elements.testa.value) };
    const conf = v.peso ? testoConfronto(confrontoPeso(f.elements.data.value, v.peso, x.id)) : "";
    $("#anteprimaPerc").innerHTML = (conf ? `<div class="notice info small" style="margin:0 0 8px">⚖️ ${conf}</div>` : "") + Object.keys(IND).filter(k => v[k]).map(k => `${IND[k].nome}: <b>${percentile(k, g, v[k])?.testo || "fuori tabella"}</b> percentile`).join("<br>");
  };
  ["data", "peso", "lunghezza", "testa"].forEach(n => f.elements[n].addEventListener("input", anteprima)); anteprima();
}

/* =====================================================================
   VACCINI, BILANCI DI SALUTE, SCREENING NEONATALI (calendari indicativi)
   ===================================================================== */
const M = 30.4375;
const VACCINI = [
  { k: "rsv", nome: "Anticorpo anti-RSV (nirsevimab)", g: 0, nota: "Protegge dalla bronchiolite. Per i nati tra ottobre e marzo di solito si fa in ospedale alla nascita; per gli altri all'inizio dell'inverno." },
  { k: "esa1", nome: "Esavalente – 1ª dose", g: 61, nota: "Difterite, tetano, pertosse, polio, Haemophilus b, epatite B." },
  { k: "pcv1", nome: "Pneumococco – 1ª dose", g: 61 },
  { k: "rota1", nome: "Rotavirus – 1ª dose (gocce in bocca)", g: 61, nota: "Il ciclo va iniziato presto: entro le 12 settimane di vita." },
  { k: "menb1", nome: "Meningococco B – 1ª dose", g: 76 },
  { k: "menb2", nome: "Meningococco B – 2ª dose", g: 106 },
  { k: "esa2", nome: "Esavalente – 2ª dose", g: 121 },
  { k: "pcv2", nome: "Pneumococco – 2ª dose", g: 121 },
  { k: "rota2", nome: "Rotavirus – 2ª dose", g: 121 },
  { k: "rota3", nome: "Rotavirus – 3ª dose (solo con il vaccino a 3 dosi)", g: 151, facoltativo: true },
  { k: "flu", nome: "Influenza (prima volta)", g: 183, nota: "Consigliata dai 6 mesi ai 6 anni, ogni autunno; la prima volta 2 dosi a distanza di 4 settimane." },
  { k: "esa3", nome: "Esavalente – 3ª dose", g: Math.round(11 * M) },
  { k: "pcv3", nome: "Pneumococco – 3ª dose", g: Math.round(11 * M) },
  { k: "mprv1", nome: "Morbillo, parotite, rosolia, varicella (MPRV) – 1ª dose", g: Math.round(13 * M) },
  { k: "menacwy1", nome: "Meningococco ACWY (o C)", g: Math.round(13 * M) },
  { k: "menb3", nome: "Meningococco B – richiamo", g: Math.round(13 * M) },
  { k: "dtpa6", nome: "Difterite, tetano, pertosse, polio – richiamo", g: Math.round(6 * 365.25) },
  { k: "mprv2", nome: "MPRV – 2ª dose", g: Math.round(6 * 365.25) },
  { k: "hpv", nome: "Papillomavirus (HPV)", g: Math.round(11.5 * 365.25) },
  { k: "menacwy2", nome: "Meningococco ACWY – adolescenti", g: Math.round(12.5 * 365.25) },
  { k: "dtpa14", nome: "Difterite, tetano, pertosse, polio – richiamo adolescenti", g: Math.round(14 * 365.25) }
];
const BILANCI = [
  { k: "bil1", nome: "Primo bilancio di salute", da: 15, a: 45 },
  { k: "bil2", nome: "Bilancio dei 2-3 mesi", da: 61, a: 91 },
  { k: "bil3", nome: "Bilancio dei 4-6 mesi", da: 120, a: 183 },
  { k: "bil4", nome: "Bilancio dei 7-9 mesi", da: 213, a: 274 },
  { k: "bil5", nome: "Bilancio dei 10-12 mesi", da: 304, a: 366 },
  { k: "bil6", nome: "Bilancio dei 15-18 mesi", da: 457, a: 548 },
  { k: "bil7", nome: "Bilancio dei 2 anni", da: 700, a: 820 },
  { k: "bil8", nome: "Bilancio dei 3 anni", da: 1061, a: 1186 },
  { k: "bil9", nome: "Bilancio dei 5-6 anni", da: 1826, a: 2190 },
  { k: "bil10", nome: "Bilancio degli 8 anni", da: 2922, a: 3105 },
  { k: "bil11", nome: "Bilancio dei 10 anni", da: 3652, a: 3835 },
  { k: "bil12", nome: "Bilancio dei 12-14 anni", da: 4383, a: 5113 }
];
const SCREENING = [
  { k: "scr_met", nome: "Screening metabolico esteso", quando: "48–72 ore di vita, in ospedale", nota: "Poche gocce di sangue dal tallone. Se non vi chiamano, l'esito è nella norma." },
  { k: "scr_udito", nome: "Screening dell'udito (otoemissioni)", quando: "prima della dimissione dal punto nascita" },
  { k: "scr_sat", nome: "Saturimetria (screening delle cardiopatie)", quando: "24–48 ore di vita" },
  { k: "scr_occhi", nome: "Riflesso rosso (occhi)", quando: "alla nascita e ai primi bilanci di salute" },
  { k: "scr_anche", nome: "Ecografia delle anche", quando: "entro i 3 mesi (di solito tra 4 e 12 settimane)" }
];
const ESITI = { "": "Da fare / non so", normale: "Fatto – nella norma", ricontrollo: "Fatto – da ricontrollare", fatto: "Fatto" };
const stato = k => attivi("check").find(c => c.id === k) || null;

/* un bilancio è fatto se c'è una visita "bilancio" nella sua finestra */
function bilancioFatto(b) {
  const c = stato(b.k); if (c?.fatto) return { data: c.fatto, manuale: true };
  if (!S.profilo.nascita) return null;
  const da = dataDaGiorni(b.da - 10), a = dataDaGiorni(b.a + 20);
  const v = visiteAttive().find(v => v.tipo === "bilancio" && v.stato !== "annullata" && v.data >= da && v.data <= a);
  return v ? { data: v.data, visita: v, futura: v.data > oggiISO() } : null;
}
function rigaCalendario({ k, nome, data, finoA, fatto, nota, sotto, facoltativo, tipo }) {
  const oggi = oggiISO();
  let chip;
  if (fatto?.futura) chip = `<span class="chip brand">Prenotato: ${dataBreve(fatto.data)}</span>`;
  else if (fatto) chip = `<span class="chip ok">✓ ${dataBreve(fatto.data)}</span>`;
  else if (stato(k)?.appuntamento) chip = `<span class="chip brand">Appuntamento: ${dataBreve(stato(k).appuntamento)}</span>`;
  else if ((finoA || data) < oggi) chip = `<span class="chip ${facoltativo ? "" : "warn"}">Da verificare</span>`;
  else if (data <= oggiISO(new Date(Date.now() + 30 * 864e5))) chip = `<span class="chip warn">In arrivo</span>`;
  else chip = `<span class="chip">Previsto</span>`;
  return `<button class="item" data-act="apri-check" data-k="${k}" data-tipo="${tipo}">
    <div class="grow"><div class="t">${esc(nome)}</div>
      <div class="m">${finoA ? `tra ${dataBreve(data)} e ${dataBreve(finoA)}` : `dal ${dataBreve(data)}`}${sotto ? " · " + esc(sotto) : ""}</div>
      ${nota ? `<div class="tiny">${esc(nota)}</div>` : ""}
      <div style="margin-top:4px">${chip}</div></div></button>`;
}
function vVaccini() {
  if (!S.profilo.nascita) return `<div class="notice warn">Per calcolare il calendario serve la data di nascita. <a href="#" data-act="profilo">Inseriscila qui</a>.</div>`;
  const tutti = ls.get("vacciniTutti", false), gOggi = giorniDiVita();
  const lista = VACCINI.filter(v => tutti || v.g <= gOggi + 400 || !stato(v.k)?.fatto && v.g <= gOggi + 400);
  return `<div class="notice warn small">Calendario <b>indicativo</b> (Piano nazionale vaccini). Le date vere sono nella convocazione dell'ASST Valtellina e Alto Lario o te le dà la pediatra. Tocca una voce per segnarla come fatta.</div>
    ${lista.map(v => rigaCalendario({ k: v.k, nome: v.nome, data: dataDaGiorni(v.g), fatto: stato(v.k)?.fatto ? { data: stato(v.k).fatto } : null, nota: v.nota, sotto: v.g === 0 ? "alla nascita" : "a " + etaAlGiorno(v.g), facoltativo: v.facoltativo, tipo: "vaccino" })).join("")}
    <div class="btns"><button type="button" class="btn sm" data-act="vaccini-tutti">${tutti ? "Mostra solo i prossimi" : "Mostra tutto il calendario fino all'adolescenza"}</button></div>`;
}
function vBilanci() {
  if (!S.profilo.nascita) return `<div class="notice warn">Serve la data di nascita. <a href="#" data-act="profilo">Inseriscila qui</a>.</div>`;
  const gOggi = giorniDiVita();
  return `<div class="notice info small">I bilanci di salute sono le visite di controllo programmate dalla pediatra a età precise (crescita, sviluppo, vista, udito…). Età <b>indicative</b>: le stabilisce la pediatra. Quando inserisci una visita di tipo “Bilancio di salute” viene segnata qui da sola.</div>
    ${BILANCI.filter(b => b.da <= gOggi + 800).map(b => rigaCalendario({ k: b.k, nome: b.nome, data: dataDaGiorni(b.da), finoA: dataDaGiorni(b.a), fatto: bilancioFatto(b), tipo: "bilancio" })).join("")}
    <div class="btns"><button type="button" class="btn sm pri" data-act="nuova-visita-bil">+ Prenota / segna un bilancio</button>
      <a class="btn sm" href="tel:${PEDIATRA.prenotazioni.tel}">📞 Prenota ${PEDIATRA.prenotazioni.label}</a></div>`;
}
function vScreening() {
  return `<div class="notice info small">Controlli fatti a tutti i neonati, di solito nel punto nascita. Segna l'esito e collega il referto, se te l'hanno dato.</div>
    ${SCREENING.map(s => { const c = stato(s.k); const chip = c?.esito ? `<span class="chip ${c.esito === "ricontrollo" ? "warn" : "ok"}">${ESITI[c.esito]}${c.fatto ? " · " + dataBreve(c.fatto) : ""}</span>` : `<span class="chip">Da segnare</span>`;
      return `<button class="item" data-act="apri-check" data-k="${s.k}" data-tipo="screening"><div class="grow"><div class="t">${esc(s.nome)}</div><div class="m">${esc(s.quando)}</div>${s.nota ? `<div class="tiny">${esc(s.nota)}</div>` : ""}<div style="margin-top:4px">${chip}</div></div></button>`; }).join("")}`;
}
function formCheck(k, tipo) {
  const voce = [...VACCINI, ...BILANCI, ...SCREENING].find(x => x.k === k); if (!voce) return;
  const c = stato(k) || {};
  const docs = docSanitari().sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  apriSheet(voce.nome, `
    ${voce.nota ? `<p class="small muted">${esc(voce.nota)}</p>` : ""}
    ${tipo === "screening" ? `<label class="f">Esito<select name="esito">${Object.entries(ESITI).filter(([e]) => e !== "fatto").map(([e, t]) => `<option value="${e}" ${c.esito === e ? "selected" : ""}>${t}</option>`).join("")}</select></label>` : ""}
    <div class="grid2"><label class="f">Fatto il<input type="date" name="fatto" value="${esc(c.fatto || "")}"></label>
    ${tipo !== "screening" ? `<label class="f">Appuntamento il<input type="date" name="appuntamento" value="${esc(c.appuntamento || "")}"></label>` : ""}</div>
    ${tipo === "vaccino" ? `<label class="f">Nome del vaccino / lotto<input type="text" name="prodotto" value="${esc(c.prodotto || "")}" placeholder="es. Hexyon, lotto A1234"></label>` : ""}
    <label class="f">Referto / certificato collegato<select name="docId"><option value="">— nessuno —</option>${docs.map(d => `<option value="${d.id}" ${c.docId === d.id ? "selected" : ""}>${dataBreve(d.data)} · ${esc(d.titolo)}</option>`).join("")}</select></label>
    <label class="f">Note<textarea name="note">${esc(c.note || "")}</textarea></label>
    ${tipo === "bilancio" && bilancioFatto(voce)?.visita ? `<div class="notice info small">Collegato alla visita del ${dataBreve(bilancioFatto(voce).data)}.</div>` : ""}`,
  `<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm"), v = n => f.elements[n]?.value.trim() || "";
    const dati = { fatto: v("fatto"), appuntamento: v("appuntamento"), prodotto: v("prodotto"), docId: v("docId"), note: v("note"), esito: tipo === "screening" ? v("esito") : (v("fatto") ? "fatto" : ""), tipo, updatedAt: Date.now() };
    if (tipo === "screening" && dati.esito && !dati.fatto) dati.fatto = "";
    const old = S.check.find(x => x.id === k);
    if (old) Object.assign(old, dati, { deleted: false }); else S.check.push({ id: k, ...dati });
    await salva(); toast("Salvato");
  });
}
/* promemoria nel calendario Google (vaccini e bilanci dei prossimi 4 mesi) */
function promemoriaDovuti() {
  if (!S.profilo.nascita) return [];
  const oggi = oggiISO(), entro = oggiISO(new Date(Date.now() + 120 * 864e5)), out = [];
  for (const v of VACCINI) {
    const c = stato(v.k), d = c?.appuntamento || dataDaGiorni(v.g);
    if (c?.fatto || v.facoltativo || d < oggi || d > entro) continue;
    out.push({ k: v.k, data: d, titolo: `💉 Gioele: ${v.nome}${c?.appuntamento ? "" : " (data indicativa)"}`, testo: `${v.nota || ""}\nCalendario indicativo: verifica la convocazione dell'ASST o chiedi alla pediatra.` });
  }
  for (const b of BILANCI) {
    const c = stato(b.k), da = dataDaGiorni(b.da);
    if (bilancioFatto(b) || dataDaGiorni(b.a) < oggi || da > entro) continue;
    const d = c?.appuntamento || (da < oggi ? oggi : da);
    out.push({ k: b.k, data: d, titolo: `📏 Gioele: ${b.nome} – da prenotare`, testo: `Da fare tra il ${dataBreve(da)} e il ${dataBreve(dataDaGiorni(b.a))}.\nPrenotazioni pediatra: ${PEDIATRA.prenotazioni.label} (lun-ven 9-11).` });
  }
  return out;
}
async function allineaPromemoria(cal) {
  const dovuti = new Map(promemoriaDovuti().map(p => [p.k, p]));
  for (const c of S.check.filter(c => c.calEventId && !dovuti.has(c.id))) {   // non più necessari
    try { await gapi(`${CAL}/calendars/${cal}/events/${c.calEventId}`, { method: "DELETE" }); } catch (e) { if (!/not found|deleted|410|404/i.test(e.message)) throw e; }
    c.calEventId = ""; c.calSig = ""; c.updatedAt = Date.now();
  }
  for (const p of dovuti.values()) {
    const fine = parseISO(p.data); fine.setDate(fine.getDate() + 1);
    const ev = { summary: p.titolo, description: p.testo, start: { date: p.data }, end: { date: oggiISO(fine) }, transparency: "transparent", reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 7 * 1440 }, { method: "popup", minutes: 1440 }] }, extendedProperties: { private: { gioele: "promemoria" } } };
    const sig = JSON.stringify(ev);
    let c = S.check.find(x => x.id === p.k);
    if (c && c.calEventId && c.calSig === sig) continue;
    if (!c) { c = { id: p.k, updatedAt: Date.now() }; S.check.push(c); }
    let r;
    if (c.calEventId) { try { r = await gapi(`${CAL}/calendars/${cal}/events/${c.calEventId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) }); } catch (e) { if (!/not found|404|410/i.test(e.message)) throw e; } }
    if (!r) r = await gapi(`${CAL}/calendars/${cal}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) });
    c.calEventId = r.id; c.calSig = sig; c.updatedAt = Date.now();
  }
}

/* =====================================================================
   REGISTRO FARMACI
   ===================================================================== */
const farmaciAbituali = () => attivi("farmaci").sort((a, b) => a.nome.localeCompare(b.nome));
const dosiOrd = () => attivi("dosi").sort((a, b) => b.quando.localeCompare(a.quando));
const chiave = s => (s || "").trim().toLowerCase();
function infoFarmaco(nome) {
  const ab = farmaciAbituali().find(f => chiave(f.nome) === chiave(nome));
  const dosi = dosiOrd().filter(d => chiave(d.farmaco) === chiave(nome));
  const ultima = dosi[0];
  const in24 = dosi.filter(d => Date.now() - daOraLocale(d.quando) < 864e5).length;
  let prossima = null;
  if (ultima && ab?.intervalloOre) prossima = new Date(daOraLocale(ultima.quando).getTime() + ab.intervalloOre * 36e5);
  return { ab, ultima, in24, prossima };
}
function vFarmaci() {
  const dosi = dosiOrd(), nomi = [...new Set(dosi.filter(d => Date.now() - daOraLocale(d.quando) < 7 * 864e5).map(d => d.farmaco))];
  const schede = nomi.map(n => {
    const i = infoFarmaco(n), ora = new Date();
    const pronto = !i.prossima || i.prossima <= ora;
    const troppe = i.ab?.maxGiorno && i.in24 >= i.ab.maxGiorno;
    return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>💊 ${esc(n)}</b>
      ${troppe ? `<span class="chip bad">${i.in24} dosi in 24 ore (max ${i.ab.maxGiorno})</span>` : i.prossima ? `<span class="chip ${pronto ? "ok" : "warn"}">${pronto ? "Si può ridare" : "Prossima dalle " + pad(i.prossima.getHours()) + ":" + pad(i.prossima.getMinutes()) + (oggiISO(i.prossima) !== oggiISO() ? " di domani" : "")}</span>` : ""}</div>
      <div class="small muted">Ultima dose: <b>${esc(i.ultima.dose || "")}</b> ${quandoBreve(i.ultima.quando)}${i.ultima.chi ? " · " + esc(i.ultima.chi) : ""} · ${i.in24} ${i.in24 === 1 ? "dose" : "dosi"} nelle ultime 24 ore</div>
      <div class="btns"><button type="button" class="btn sm pri" data-act="nuova-dose" data-farmaco="${esc(n)}">+ Nuova dose</button></div></div>`;
  }).join("");
  return `<div class="btns" style="margin-top:0"><button type="button" class="btn pri" data-act="nuova-dose">💊 Ho dato un farmaco</button><button type="button" class="btn" data-act="farmaci-abituali">⚙️ Farmaci e dosi indicate dalla pediatra</button></div>
    <div class="tiny" style="margin:8px 0 12px">Registra ogni dose: lo vede subito anche l'altro genitore (con Google collegato), così non si danno doppie dosi. Le dosi e gli intervalli li decide la pediatra: l'app li ricorda soltanto.</div>
    ${schede || `<div class="empty">Nessun farmaco negli ultimi 7 giorni.</div>`}
    ${dosi.length ? `<h2>Storico</h2><div class="card" style="padding:6px 12px">${dosi.slice(0, 40).map(d => `<div class="slot" data-act="apri-dose" data-id="${d.id}" style="cursor:pointer"><span><b>${esc(d.farmaco)}</b> ${esc(d.dose || "")}<br><span class="tiny">${esc(d.chi || "")}${d.note ? " · " + esc(d.note) : ""}</span></span><span class="small">${quandoBreve(d.quando)}</span></div>`).join("")}</div>` : ""}`;
}
function formDose(d = {}, preset = {}) {
  d = { quando: oraLocale(), chi: mioNome(), ...preset, ...d };
  const nuovo = !d.id;
  const nomi = [...new Set([...farmaciAbituali().map(f => f.nome), ...attivi("dosi").map(x => x.farmaco)])];
  apriSheet(nuovo ? "Dose di farmaco" : "Dose", `
    <label class="f">Farmaco<input type="text" name="farmaco" list="dlFarmaci" value="${esc(d.farmaco || "")}" placeholder="es. Tachipirina gocce"></label>
    <datalist id="dlFarmaci">${nomi.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="grid2"><label class="f">Dose<input type="text" name="dose" value="${esc(d.dose || "")}" placeholder="es. 2,5 ml"></label>
    <label class="f">Quando<input type="datetime-local" name="quando" value="${esc(d.quando)}"></label></div>
    <label class="f">Chi l'ha data<input type="text" name="chi" list="dlChi" value="${esc(d.chi || "")}"></label>
    <datalist id="dlChi">${[...new Set(["Simone", "Silvia", ...attivi("dosi").map(x => x.chi).filter(Boolean)])].map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <label class="f">Note<input type="text" name="note" value="${esc(d.note || "")}" placeholder="es. febbre 38,6"></label>
    <div id="avvisoDose"></div>`,
  `${!nuovo ? `<button type="button" class="btn bad" data-act="elimina-voce" data-col="dosi" data-id="${d.id}">Elimina</button><span style="flex:1"></span>` : ""}<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm"), v = n => f.elements[n].value.trim();
    if (!v("farmaco")) throw new Error("Scrivi il nome del farmaco");
    if (v("chi")) ls.set("mioNome", ls.get("mioNome", "") || v("chi"));
    salvaVoce("dosi", d, { farmaco: v("farmaco"), dose: v("dose"), quando: v("quando") || oraLocale(), chi: v("chi"), note: v("note"), updatedAt: Date.now() });
    await salva(); toast("Dose registrata");
  });
  const f = $("#sheetForm");
  const controlla = () => {
    const i = infoFarmaco(f.elements.farmaco.value); let a = "";
    if (i.ab && !f.elements.dose.value && nuovo) f.elements.dose.value = i.ab.dose || "";
    const q = daOraLocale(f.elements.quando.value || oraLocale());
    if (i.ultima && i.ultima.id !== d.id && i.ab?.intervalloOre) {
      const ore = (q - daOraLocale(i.ultima.quando)) / 36e5;
      if (ore >= 0 && ore < i.ab.intervalloOre) a += `⚠️ L'ultima dose (${quandoBreve(i.ultima.quando)}${i.ultima.chi ? ", " + esc(i.ultima.chi) : ""}) è di ${fmt(ore, 1)} ore fa: la pediatra ha indicato almeno ${i.ab.intervalloOre} ore tra una dose e l'altra.<br>`;
    } else if (i.ultima && i.ultima.id !== d.id) a += `Ultima dose: ${quandoBreve(i.ultima.quando)}${i.ultima.chi ? " (" + esc(i.ultima.chi) + ")" : ""}.<br>`;
    if (i.ab?.maxGiorno && nuovo && i.in24 >= i.ab.maxGiorno) a += `⚠️ Già ${i.in24} dosi nelle ultime 24 ore (massimo indicato: ${i.ab.maxGiorno}).`;
    $("#avvisoDose").innerHTML = a ? `<div class="notice ${a.includes("⚠️") ? "warn" : "info"} small">${a}</div>` : "";
  };
  ["farmaco", "quando"].forEach(n => f.elements[n].addEventListener("input", controlla)); controlla();
}
function formFarmaciAbituali() {
  const l = farmaciAbituali();
  apriSheet("Farmaci e dosi indicate", `
    <p class="small muted">Scrivi qui i farmaci che usate con la dose e l'intervallo <b>indicati dalla pediatra</b> (anche in base al peso). L'app avviserà se una dose arriva troppo presto.</p>
    ${l.map(f => `<div class="slot"><span><b>${esc(f.nome)}</b> ${esc(f.dose || "")}<br><span class="tiny">${f.intervalloOre ? "ogni " + f.intervalloOre + " ore almeno" : ""}${f.maxGiorno ? " · max " + f.maxGiorno + " al giorno" : ""}${f.note ? " · " + esc(f.note) : ""}</span></span><button type="button" class="btn sm bad" data-act="elimina-voce" data-col="farmaci" data-id="${f.id}">Togli</button></div>`).join("") || `<div class="tiny">Nessun farmaco salvato.</div>`}
    <h3 style="font-size:15px;margin:16px 0 0">Aggiungi</h3>
    <label class="f">Nome<input type="text" name="nome" placeholder="es. Tachipirina 100 mg/ml gocce"></label>
    <div class="grid2"><label class="f">Dose indicata<input type="text" name="dose" placeholder="es. 2,5 ml"></label>
    <label class="f">Ore minime tra 2 dosi<input type="text" inputmode="decimal" name="intervalloOre" placeholder="es. 6"></label></div>
    <div class="grid2"><label class="f">Max dosi in 24 ore<input type="text" inputmode="numeric" name="maxGiorno" placeholder="es. 4"></label>
    <label class="f">Note<input type="text" name="note" placeholder="es. solo se > 38,5"></label></div>`,
  `<button class="btn" value="annulla" formnovalidate>Chiudi</button><button class="btn pri" value="ok">Aggiungi</button>`,
  async () => {
    const f = $("#sheetForm"), v = n => f.elements[n].value.trim();
    if (!v("nome")) throw new Error("Scrivi il nome del farmaco");
    S.farmaci.push({ id: uid(), nome: v("nome"), dose: v("dose"), intervalloOre: num(v("intervalloOre")), maxGiorno: num(v("maxGiorno")), note: v("note"), updatedAt: Date.now() });
    await salva(); setTimeout(formFarmaciAbituali, 30);
  });
}

/* =====================================================================
   DIARIO FEBBRE E SINTOMI
   ===================================================================== */
const SINTOMI = ["tosse", "raffreddore", "mal d'orecchio", "mal di gola", "vomito", "diarrea", "inappetenza", "eruzione cutanea", "pianto inconsolabile", "sonnolenza", "respiro affannoso", "congiuntivite"];
const diarioOrd = () => attivi("diario").sort((a, b) => b.quando.localeCompare(a.quando));
function graficoFebbre(giorni = 7, { larg = 380, alt = 200, perStampa = false } = {}) {
  const da = Date.now() - giorni * 864e5;
  const p = diarioOrd().filter(x => x.temp && daOraLocale(x.quando) >= da).map(x => ({ t: daOraLocale(x.quando).getTime(), v: x.temp })).sort((a, b) => a.t - b.t);
  const dosi = attivi("dosi").map(x => daOraLocale(x.quando).getTime()).filter(t => t >= da);
  const pl = 38, pr = 10, pt = 10, pb = 26, W = larg - pl - pr, H = alt - pt - pb, a = Date.now();
  const yMin = 35.5, yMax = Math.max(40.5, ...p.map(x => x.v + .2));
  const X = t => pl + (t - da) / (a - da) * W, Y = v => pt + H - (v - yMin) / (yMax - yMin) * H;
  const c = perStampa ? { g: "#e3ebea", t: "#455", l: "#C2410C", f: "#B42318", d: "#0E746E" } : { g: "var(--line-2)", t: "var(--ink-3)", l: "#E8590C", f: "var(--bad)", d: "var(--brand)" };
  let s = `<svg viewBox="0 0 ${larg} ${alt}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" role="img" aria-label="Temperatura degli ultimi ${giorni} giorni">`;
  if (perStampa) s += `<rect width="${larg}" height="${alt}" fill="#fff"/>`;
  for (let v = 36; v <= yMax; v++) s += `<line x1="${pl}" x2="${pl + W}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c.g}"/><text x="${pl - 5}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="${c.t}">${v}°</text>`;
  s += `<line x1="${pl}" x2="${pl + W}" y1="${Y(38)}" y2="${Y(38)}" stroke="${c.f}" stroke-dasharray="5 4"/><text x="${pl + 4}" y="${Y(38) - 4}" font-size="10" fill="${c.f}">febbre 38°</text>`;
  for (let i = 0; i <= giorni; i++) { const t = new Date(da + i * 864e5); t.setHours(0, 0, 0, 0); if (t.getTime() < da) continue; s += `<text x="${X(t.getTime())}" y="${alt - 8}" font-size="10" text-anchor="middle" fill="${c.t}">${t.getDate()}/${t.getMonth() + 1}</text>`; }
  for (const t of dosi) s += perStampa ? `<path d="M${X(t) - 4} ${pt + H} l4 -8 l4 8z" fill="${c.d}"/>` : `<text x="${X(t)}" y="${pt + H - 3}" font-size="12" text-anchor="middle">💊</text>`;
  if (p.length > 1) s += `<polyline fill="none" stroke="${c.l}" stroke-width="2" points="${p.map(x => X(x.t).toFixed(1) + "," + Y(x.v).toFixed(1)).join(" ")}"/>`;
  for (const x of p) s += `<circle cx="${X(x.t)}" cy="${Y(x.v)}" r="4" fill="${x.v >= 38 ? c.f : c.l}" stroke="#fff" stroke-width="1.2"/>`;
  return s + `</svg>`;
}
function vFebbre() {
  const d = diarioOrd();
  return `<div class="btns" style="margin-top:0"><button type="button" class="btn pri" data-act="nuova-febbre">🌡️ Misura / sintomo</button><button type="button" class="btn" data-act="nuova-dose">💊 Farmaco</button></div>
    <div class="card" style="padding:8px;margin-top:12px">${graficoFebbre(7)}<div class="tiny" style="padding:0 6px">Ultimi 7 giorni · 💊 = dose di farmaco registrata</div></div>
    ${d.length ? d.slice(0, 50).map(x => `<button class="item" data-act="apri-febbre" data-id="${x.id}"><div class="ico" style="font-size:15px;font-weight:800;${x.temp >= 38 ? "background:var(--bad-soft);color:var(--bad)" : ""}">${x.temp ? fmt(x.temp, 1) + "°" : "📝"}</div><div class="grow"><div class="t">${quandoBreve(x.quando)}</div><div class="m">${esc([(x.sintomi || []).join(", "), x.note].filter(Boolean).join(" · ") || (x.temp ? "temperatura" : ""))}</div></div></button>`).join("") : `<div class="empty">Nessuna annotazione. Quando Gioele sta poco bene, segna qui temperatura e sintomi: alla pediatra servirà sapere com'è andata.</div>`}
    <div class="tiny">Nel neonato sotto i 3 mesi una temperatura di 38° o più va sempre segnalata subito alla pediatra o alla guardia medica.</div>`;
}
function formFebbre(x = {}) {
  x = { quando: oraLocale(), sintomi: [], ...x };
  const nuovo = !x.id;
  apriSheet(nuovo ? "Temperatura e sintomi" : "Annotazione", `
    <div class="grid2"><label class="f">Quando<input type="datetime-local" name="quando" value="${esc(x.quando)}"></label>
    <label class="f">Temperatura (°C)<input type="text" inputmode="decimal" name="temp" value="${x.temp ? fmt(x.temp, 1) : ""}" placeholder="es. 38,2"></label></div>
    <div class="f" style="margin-top:11px;font-size:13.5px;font-weight:700;color:var(--ink-2)">Sintomi</div>
    <div class="btns" style="margin-top:6px">${SINTOMI.map(s => `<label class="chip" style="font-size:14px;padding:6px 10px;cursor:pointer"><input type="checkbox" name="sintomi" value="${esc(s)}" ${x.sintomi.includes(s) ? "checked" : ""}> ${esc(s)}</label>`).join("")}</div>
    <label class="f">Note<textarea name="note" placeholder="es. beve poco, 4 pannolini bagnati">${esc(x.note || "")}</textarea></label>
    <div id="avvisoFebbre"></div>`,
  `${!nuovo ? `<button type="button" class="btn bad" data-act="elimina-voce" data-col="diario" data-id="${x.id}">Elimina</button><span style="flex:1"></span>` : ""}<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm");
    const dati = { quando: f.elements.quando.value || oraLocale(), temp: num(f.elements.temp.value), sintomi: [...f.querySelectorAll("input[name=sintomi]:checked")].map(i => i.value), note: f.elements.note.value.trim(), updatedAt: Date.now() };
    if (!dati.temp && !dati.sintomi.length && !dati.note) throw new Error("Inserisci la temperatura o almeno un sintomo");
    if (dati.temp && (dati.temp < 34 || dati.temp > 43)) throw new Error("Temperatura non plausibile: controlla il valore");
    salvaVoce("diario", x, dati); await salva(); toast("Annotazione salvata");
  });
  const f = $("#sheetForm");
  const avviso = () => {
    const t = num(f.elements.temp.value), g = giorniDiVita();
    $("#avvisoFebbre").innerHTML = t >= 38 && g != null && g < 91 ? `<div class="notice bad small">Gioele ha meno di 3 mesi: con 38° o più chiama subito la pediatra (${PEDIATRA.consulti.label}) o, fuori orario, la guardia medica 116117. <a href="#" data-act="emergenza">Numeri utili</a></div>`
      : t >= 39.5 ? `<div class="notice warn small">Febbre alta: se è abbattuto, respira male o non beve, senti la pediatra o la guardia medica (116117).</div>` : "";
  };
  f.elements.temp.addEventListener("input", avviso); avviso();
}

/* =====================================================================
   TAPPE DELLO SVILUPPO
   ===================================================================== */
const TAPPE = [
  ["sorriso", "Primo sorriso", 1, 3], ["testa", "Tiene su la testa", 2, 4], ["ride", "Prima risata", 3, 5], ["afferra", "Afferra un oggetto", 3, 5],
  ["gira", "Si gira da solo", 4, 6], ["pappa", "Prima pappa", 4, 7], ["seduto", "Sta seduto da solo", 6, 9], ["dente", "Primo dentino", 5, 12],
  ["gattona", "Gattona", 7, 11], ["ciao", "Fa ciao con la mano", 8, 12], ["piedi", "Sta in piedi con appoggio", 8, 12], ["parola", "Prima parola", 10, 14],
  ["passi", "Primi passi", 9, 18], ["frase", "Mette insieme due parole", 18, 30], ["pannolino", "Senza pannolino di giorno", 24, 40], ["bici", "Va in bici senza rotelle", 48, 84]
];
function vTappe() {
  const fatte = attivi("tappe");
  const libere = fatte.filter(t => !t.chiave).sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  return `<div class="tiny" style="margin-bottom:10px">Età tipiche solo indicative: ogni bambino ha i suoi tempi. Se qualcosa ti preoccupa, parlane alla pediatra ai bilanci di salute.</div>
    ${TAPPE.map(([k, nome, da, a]) => { const t = fatte.find(x => x.chiave === k); const f0 = t?.files?.[0];
      return `<button class="item" data-act="apri-tappa" data-k="${k}"><div class="ico" ${f0 && /^image\//.test(f0.mime) ? `data-thumb="${f0.fid}"` : ""}>${t ? "⭐" : "○"}</div><div class="grow"><div class="t">${esc(nome)}</div><div class="m">${t?.data ? `${dataBreve(t.data)} · a ${etaAlGiorno(giorniDiVita(t.data))}` : `di solito tra ${etaMesi(da)} e ${etaMesi(a)}`}</div>${t?.note ? `<div class="tiny">${esc(t.note)}</div>` : ""}</div></button>`; }).join("")}
    ${libere.map(t => `<button class="item" data-act="apri-tappa" data-id="${t.id}"><div class="ico">⭐</div><div class="grow"><div class="t">${esc(t.titolo)}</div><div class="m">${t.data ? dataBreve(t.data) : ""}</div></div></button>`).join("")}
    <div class="btns"><button type="button" class="btn" data-act="apri-tappa">+ Altra tappa o ricordo</button></div>`;
}
function formTappa(k, id) {
  const def = TAPPE.find(t => t[0] === k);
  const t = id ? S.tappe.find(x => x.id === id) : attivi("tappe").find(x => x.chiave === k) || {};
  modoDoc = "tappa";
  bozzaFiles = (t.files || []).map(f => ({ ...f }));
  apriSheet(def ? def[1] : (t.titolo || "Tappa o ricordo"), `
    ${def ? "" : `<label class="f">Titolo<input type="text" name="titolo" value="${esc(t.titolo || "")}" placeholder="es. Primo bagnetto al mare"></label>`}
    <label class="f">Data<input type="date" name="data" value="${esc(t.data || oggiISO())}"></label>
    <label class="f">Note<textarea name="note" placeholder="Com'è andata…">${esc(t.note || "")}</textarea></label>
    <div class="files" id="bozzaFiles"></div>
    <div class="btns"><button type="button" class="btn sm" data-act="scatta">📷 Foto</button><button type="button" class="btn sm" data-act="scegli">🖼️ Dalla galleria</button></div>`,
  `${t.id ? `<button type="button" class="btn bad" data-act="elimina-voce" data-col="tappe" data-id="${t.id}">Elimina</button><span style="flex:1"></span>` : ""}<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm");
    for (const x of bozzaFiles) if (x.blob) await fileSet(x.fid, x.blob);
    const dati = { chiave: def ? k : "", titolo: def ? def[1] : (f.elements.titolo.value.trim() || "Ricordo"), data: f.elements.data.value, note: f.elements.note.value.trim(),
      files: bozzaFiles.map(({ fid, nome, mime, size, driveId }) => ({ fid, nome, mime, size, ...(driveId ? { driveId } : {}) })), updatedAt: Date.now() };
    salvaVoce("tappe", t, dati); await salva(); toast("⭐ Salvato");
  });
  disegnaBozza();
}

/* =====================================================================
   DOMANDE PER LA PROSSIMA VISITA
   ===================================================================== */
const domandeAperte = () => attivi("domande").filter(d => !d.fatta).sort((a, b) => (a.creato || 0) - (b.creato || 0));
function cardDomande(compatta = false) {
  const ap = domandeAperte(), chiuse = attivi("domande").filter(d => d.fatta).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return `<div class="card"><b>❓ Domande per la prossima visita</b>
    ${ap.length ? ap.map(d => `<div class="slot"><label style="display:flex;gap:8px;align-items:flex-start;flex:1"><input type="checkbox" data-act="domanda-fatta" data-id="${d.id}" style="width:20px;height:20px;margin-top:2px"> <span>${esc(d.testo)}</span></label><button type="button" class="btn sm" data-act="apri-domanda" data-id="${d.id}" aria-label="Modifica">✏️</button></div>`).join("") : `<div class="small muted" style="margin-top:6px">Annota qui i dubbi appena ti vengono: alla visita li avrai pronti.</div>`}
    <div style="display:flex;gap:8px;margin-top:10px"><input type="text" id="nuovaDomanda" placeholder="es. Quanta vitamina D?" style="flex:1"><button type="button" class="btn pri" data-act="aggiungi-domanda">Aggiungi</button></div>
    ${!compatta && chiuse.length ? `<details style="margin-top:10px"><summary class="small">Domande già fatte (${chiuse.length})</summary>${chiuse.slice(0, 30).map(d => `<div class="slot" data-act="apri-domanda" data-id="${d.id}" style="cursor:pointer"><span>${esc(d.testo)}${d.risposta ? `<br><span class="tiny">↳ ${esc(d.risposta)}</span>` : ""}</span></div>`).join("")}</details>` : ""}
  </div>`;
}
function formDomanda(d) {
  apriSheet("Domanda", `
    <label class="f">Domanda<textarea name="testo">${esc(d.testo)}</textarea></label>
    <label class="f">Risposta del medico<textarea name="risposta" placeholder="Cosa ha risposto…">${esc(d.risposta || "")}</textarea></label>
    <label class="check"><input type="checkbox" name="fatta" ${d.fatta ? "checked" : ""}> Già chiesta</label>`,
  `<button type="button" class="btn bad" data-act="elimina-voce" data-col="domande" data-id="${d.id}">Elimina</button><span style="flex:1"></span><button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm");
    Object.assign(d, { testo: f.elements.testo.value.trim() || d.testo, risposta: f.elements.risposta.value.trim(), fatta: f.elements.fatta.checked || !!f.elements.risposta.value.trim(), updatedAt: Date.now() });
    await salva();
  });
}

/* =====================================================================
   SPESE MEDICHE (730)
   ===================================================================== */
const TIPI_SPESA = { farmaci: "💊 Farmaci (farmacia)", visita: "🩺 Visite specialistiche", ticket: "🎫 Ticket SSN", esami: "🧪 Esami e analisi", dispositivi: "🩹 Dispositivi medici", altro: "📎 Altro" };
const speseOrd = () => attivi("spese").sort((a, b) => (b.data || "").localeCompare(a.data || ""));
function vSpese() {
  const anni = [...new Set([new Date().getFullYear(), ...attivi("spese").map(s => +(s.data || "").slice(0, 4)).filter(Boolean)])].sort((a, b) => b - a);
  const anno = ls.get("annoSpese", anni[0]);
  const l = speseOrd().filter(s => (s.data || "").startsWith(String(anno)));
  const tot = l.reduce((a, s) => a + (s.importo || 0), 0);
  const perTipo = Object.keys(TIPI_SPESA).map(k => [k, l.filter(s => s.tipo === k).reduce((a, s) => a + (s.importo || 0), 0)]).filter(x => x[1]);
  const nonTracc = l.filter(s => !s.tracciabile && !["farmaci", "dispositivi", "ticket"].includes(s.tipo));
  return `<div class="toolbar"><select id="annoSpese">${anni.map(a => `<option ${a === anno ? "selected" : ""}>${a}</option>`).join("")}</select>
      <button type="button" class="btn" data-act="spese-csv">⬇️ Elenco per il 730</button></div>
    <div class="card"><div class="small muted">Totale spese sanitarie ${anno}</div><div style="font-size:28px;font-weight:800">${euro(tot)}</div>
      ${perTipo.map(([k, v]) => `<div class="slot"><span>${TIPI_SPESA[k]}</span><b>${euro(v)}</b></div>`).join("")}
      <div class="tiny" style="margin-top:8px">Detrazione indicativa: 19% della parte che supera la franchigia di 129,11 € (la franchigia si calcola sul totale delle spese sanitarie del genitore che le porta in detrazione, sue e dei figli a carico). Per Gioele, in genere: ${euro(Math.max(0, tot - 129.11) * 0.19)} se queste fossero le uniche spese. Verifica con il CAF o il commercialista.</div>
      ${nonTracc.length ? `<div class="notice warn small">${nonTracc.length} spese senza pagamento tracciabile: per visite ed esami privati serve pagare con carta/bancomat/bonifico per poterle detrarre.</div>` : ""}
    </div>
    ${l.length ? l.map(s => `<button class="item" data-act="apri-spesa" data-id="${s.id}"><div class="ico" ${s.files?.[0] && /^image\//.test(s.files[0].mime) ? `data-thumb="${s.files[0].fid}"` : ""}>${(TIPI_SPESA[s.tipo] || "📎").split(" ")[0]}</div><div class="grow"><div class="t">${euro(s.importo)} · ${esc(s.descrizione || TIPI_SPESA[s.tipo]?.replace(/^\S+\s/, "") || "Spesa")}</div><div class="m">${dataBreve(s.data)}${s.struttura ? " · " + esc(s.struttura) : ""}</div></div></button>`).join("") : `<div class="empty">Nessuna spesa nel ${anno}. Fotografa scontrini della farmacia (chiedi sempre lo “scontrino parlante” con il codice fiscale di Gioele), ricevute di visite e ticket.</div>`}`;
}
function formSpesa(s = {}) {
  s = { data: oggiISO(), tipo: "farmaci", tracciabile: true, ...s };
  const nuovo = !s.id;
  modoDoc = "spesa";
  bozzaFiles = (s.files || []).map(f => ({ ...f }));
  bozzaAnalisi = null;
  apriSheet(nuovo ? "Nuova spesa" : "Spesa", `
    <div class="files" id="bozzaFiles"></div>
    <div class="btns"><button type="button" class="btn sm" data-act="scatta">📷 Fotografa scontrino / ricevuta</button><button type="button" class="btn sm" data-act="scegli">📁 File / PDF</button></div>
    <div id="boxAnalisi"></div>
    <div class="grid2"><label class="f">Data<input type="date" name="data" value="${esc(s.data)}"></label>
    <label class="f">Importo (€)<input type="text" inputmode="decimal" name="importo" value="${s.importo ? fmt(s.importo, 2) : ""}" placeholder="es. 12,50"></label></div>
    <label class="f">Tipo<select name="tipo">${Object.entries(TIPI_SPESA).map(([k, t]) => `<option value="${k}" ${s.tipo === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="f">Descrizione<input type="text" name="descrizione" value="${esc(s.descrizione || "")}" placeholder="es. Tachipirina, visita ortopedica"></label>
    <label class="f">Farmacia / struttura<input type="text" name="struttura" value="${esc(s.struttura || "")}"></label>
    <label class="check"><input type="checkbox" name="tracciabile" ${s.tracciabile ? "checked" : ""}> Pagato con carta, bancomat o bonifico (tracciabile)</label>
    <label class="f">Note<input type="text" name="note" value="${esc(s.note || "")}"></label>`,
  `${!nuovo ? `<button type="button" class="btn bad" data-act="elimina-voce" data-col="spese" data-id="${s.id}">Elimina</button><span style="flex:1"></span>` : ""}<button class="btn" value="annulla" formnovalidate>Annulla</button><button class="btn pri" value="ok">Salva</button>`,
  async () => {
    const f = $("#sheetForm"), v = n => f.elements[n].value.trim();
    const importo = num(v("importo")); if (!importo) throw new Error("Indica l'importo");
    for (const x of bozzaFiles) if (x.blob) await fileSet(x.fid, x.blob);
    salvaVoce("spese", s, { data: v("data"), importo, tipo: v("tipo"), descrizione: v("descrizione"), struttura: v("struttura"), tracciabile: f.elements.tracciabile.checked, note: v("note"),
      files: bozzaFiles.map(({ fid, nome, mime, size, driveId }) => ({ fid, nome, mime, size, ...(driveId ? { driveId } : {}) })), testo: bozzaAnalisi?.testo || s.testo || "", updatedAt: Date.now() });
    ls.set("annoSpese", +v("data").slice(0, 4));
    await salva(); toast("Spesa salvata");
  });
  ["data", "importo", "tipo", "descrizione", "struttura"].forEach(n => $("#sheetForm").elements[n].addEventListener("input", e => { e.target.dataset.toccato = "1"; }));
  disegnaBozza();
}
function analizzaTestoSpesa(testo) {
  const t = testo.toLowerCase(), an = {};
  const imp = s => parseFloat(s.replace(/\.(?=\d{3}[,.])/g, "").replace(",", "."));
  const m = testo.match(/(?:totale\s*(?:complessivo|euro|eur|€|da pagare)?|importo\s*(?:pagato|totale)?|tot\.?\s*eur|pagamento\s*(?:elettronico|contante)?)\s*[:€]?\s*(?:eur|€)?\s*(\d{1,4}(?:[.]\d{3})*[,.]\d{2})\b/i);
  if (m) an.importo = imp(m[1]);
  else { const tutti = [...testo.matchAll(/\b(\d{1,4}[,.]\d{2})\b/g)].map(x => imp(x[1])).filter(x => x > 0 && x < 5000); if (tutti.length) an.importo = Math.max(...tutti); }
  const d = tutteLeDate(testo).filter(x => x.iso <= oggiISO()).sort((a, b) => b.iso.localeCompare(a.iso))[0]; if (d) an.data = d.iso;
  an.tipo = /farmacia|parafarmacia|farmac/.test(t) ? "farmaci" : /ticket|ssn|servizio sanitario/.test(t) ? "ticket" : /visita|ambulatorio|specialist/.test(t) ? "visita" : /analisi|laboratorio|prelievo|ecografia|radiograf/.test(t) ? "esami" : /dispositivo|termometro|aerosol|ced\b/.test(t) ? "dispositivi" : "";
  an.tracciabile = /bancomat|carta|pos\b|visa|mastercard|maestro|pagamento elettronico|bonifico|contactless/.test(t) ? true : /contanti|contante/.test(t) ? false : null;
  const r = testo.split("\n").map(x => x.trim()).find(x => /farmacia|studio|poliambulatorio|centro|laboratorio|asst|ospedale|clinica/i.test(x));
  if (r) an.struttura = r.replace(/\s{2,}/g, " ").slice(0, 60);
  const cf = trovaCodiceFiscale(testo.toUpperCase(), S.profilo.nascita);
  an.cfGioele = !!cf; an.cfDichiarato = /codice fiscale|c\.f\.|cf\b/i.test(testo);
  return an;
}
async function analizzaBozzaSpesa() {
  const daLeggere = [];
  for (const x of bozzaFiles) { const b = x.blob || await fileGet(x.fid); if (b) daLeggere.push({ mime: x.mime, blob: b }); }
  if (!daLeggere.length) return;
  const mio = ++analisiInCorso;
  try {
    disegnaAnalisi({ testo: "Leggo lo scontrino…", p: 0 });
    const { testo } = await estraiTestoFiles(daLeggere, (t, p) => { if (mio === analisiInCorso) disegnaAnalisi({ testo: t, p }); });
    if (mio !== analisiInCorso || !$("#boxAnalisi")) return;
    const a = analizzaTestoSpesa(testo); bozzaAnalisi = { ...a, testo: testo.slice(0, 3000) };
    const f = $("#sheetForm"), metti = (n, v) => { const el = f.elements[n]; if (el && v != null && v !== "" && !el.dataset.toccato) el.value = v; };
    metti("importo", a.importo ? fmt(a.importo, 2) : ""); metti("data", a.data); metti("tipo", a.tipo); metti("struttura", a.struttura);
    if (a.tracciabile != null) f.elements.tracciabile.checked = a.tracciabile;
    $("#boxAnalisi").innerHTML = `<div class="notice ${a.importo ? "info" : "warn"} small">🔎 ${a.importo ? `Importo letto: <b>${euro(a.importo)}</b>` : "Importo non trovato: scrivilo tu"}${a.data ? ` · ${dataBreve(a.data)}` : ""}${a.tipo ? ` · ${TIPI_SPESA[a.tipo].replace(/^\S+\s/, "")}` : ""}
      ${a.tipo === "farmaci" ? (a.cfGioele ? "<br>✓ C'è il codice fiscale di Gioele: detraibile." : a.cfDichiarato ? "<br>⚠️ Lo scontrino ha un codice fiscale ma non sembra quello di Gioele: va bene se è del genitore che porta la spesa in detrazione." : "<br>⚠️ Non vedo il codice fiscale: senza “scontrino parlante” la spesa in farmacia non è detraibile.") : ""}</div>`;
  } catch (e) { if ($("#boxAnalisi")) $("#boxAnalisi").innerHTML = `<div class="notice warn small">Non sono riuscito a leggere lo scontrino: compila tu i campi.</div>`; }
  finally { if (mio === analisiInCorso) analisiInCorso = 0; }
}
function esportaSpeseCsv() {
  const anno = ls.get("annoSpese", new Date().getFullYear());
  const l = speseOrd().filter(s => (s.data || "").startsWith(String(anno))).reverse();
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const righe = [["Data", "Importo", "Tipo", "Descrizione", "Struttura", "Tracciabile", "Note"].join(";"),
    ...l.map(s => [dataBreve(s.data), fmt(s.importo, 2), (TIPI_SPESA[s.tipo] || "").replace(/^\S+\s/, ""), s.descrizione, s.struttura, s.tracciabile ? "sì" : "no", s.note].map(q).join(";")),
    ["", fmt(l.reduce((a, s) => a + s.importo, 0), 2), "TOTALE"].map(q).join(";")];
  const file = new File(["﻿" + righe.join("\r\n")], `Spese sanitarie Gioele ${anno}.csv`, { type: "text/csv" });
  if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: file.name }).catch(() => {});
  else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); }
}

/* =====================================================================
   SCHEDA EMERGENZE
   ===================================================================== */
const NUMERI_UTILI = [
  ["Emergenza (ambulanza, soccorso)", "112"],
  ["Guardia medica (continuità assistenziale, notti e festivi)", "116117"],
  ["Centro Antiveleni – Ospedale Niguarda Milano (24 ore)", "02 6610 1029"]
];
function datiEmergenza() {
  const p = S.profilo, ult = misureOrd().filter(m => m.peso).pop();
  return {
    nome: [p.nome || "Gioele", p.cognome].filter(Boolean).join(" "),
    nascita: p.nascita ? `${dataBreve(p.nascita)} (${eta(p.nascita)})` : "",
    peso: ult ? `${fmt(ult.peso, 2)} kg (${dataBreve(ult.data)})` : "",
    righe: [["Allergie", p.allergie || "Nessuna nota"], ["Patologie", p.patologie], ["Terapie in corso", p.terapie], ["Gruppo sanguigno", p.sangue], ["Codice fiscale", p.cf], ["Genitori / contatti", p.genitori]].filter(r => r[1])
  };
}
function schedaEmergenza() {
  const e = datiEmergenza();
  apriSheet("🆘 Scheda emergenze", `
    <div class="card" style="margin-top:12px;border-color:var(--bad)">
      <div style="font-size:22px;font-weight:800">${esc(e.nome)}</div>
      <div class="small">${e.nascita ? "Nato il " + esc(e.nascita) : ""}${e.peso ? " · peso " + esc(e.peso) : ""}</div>
      <dl class="kv">${e.righe.map(([k, v]) => `<dt>${esc(k)}</dt><dd ${k === "Allergie" ? 'style="font-weight:700"' : ""}>${esc(v)}</dd>`).join("")}</dl>
      ${!S.profilo.genitori ? `<div class="notice warn small">Aggiungi i numeri dei genitori nella <a href="#" data-act="profilo">scheda di Gioele</a> (campo “Genitori / contatti”).</div>` : ""}
    </div>
    <h3 style="font-size:16px;margin:14px 0 6px">Numeri utili</h3>
    ${NUMERI_UTILI.map(([n, t]) => `<a class="btn" style="width:100%;justify-content:space-between;margin-bottom:6px" href="tel:${t.replace(/\s/g, "")}"><span>${esc(n)}</span><b style="white-space:nowrap">📞 ${t}</b></a>`).join("")}
    <a class="btn" style="width:100%;justify-content:space-between;margin-bottom:6px" href="tel:${PEDIATRA.consulti.tel}"><span>Pediatra ${esc(PEDIATRA.breve)} (consulti 8:30–9:30, 14–14:30)</span><b style="white-space:nowrap">📞 ${PEDIATRA.consulti.label}</b></a>
    <a class="btn" style="width:100%;justify-content:space-between" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Pronto Soccorso Ospedale di Sondrio, Via Stelvio 25, Sondrio")}"><span>Pronto Soccorso – Ospedale di Sondrio, Via Stelvio 25</span><b>🗺️</b></a>
    <div class="tiny" style="margin-top:8px">Da dare a nonni e baby-sitter: crea il PDF da stampare o inviare.</div>`,
  `<button class="btn" value="annulla" formnovalidate>Chiudi</button><button type="button" class="btn" data-act="emergenza-testo">💬 Invia testo</button><button type="button" class="btn pri" data-act="emergenza-pdf">📄 PDF</button>`, null);
}
function testoEmergenza() {
  const e = datiEmergenza();
  return [`🆘 ${e.nome}`, e.nascita && `Nato il ${e.nascita}`, e.peso && `Peso: ${e.peso}`, ...e.righe.map(([k, v]) => `${k}: ${v}`), "",
    ...NUMERI_UTILI.map(([n, t]) => `${n}: ${t}`), `Pediatra ${PEDIATRA.nome}: ${PEDIATRA.consulti.label}`, "Pronto Soccorso: Ospedale di Sondrio, Via Stelvio 25"].filter(x => x !== false && x !== undefined).join("\n");
}
async function pdfEmergenza() {
  const lib = await caricaPdfLib(), pdf = await lib.PDFDocument.create();
  const f = await pdf.embedFont(lib.StandardFonts.Helvetica), fb = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  const w = new Scrittore(pdf, lib, f, fb), e = datiEmergenza();
  w.p.drawRectangle({ x: 0, y: w.H - 80, width: w.W, height: 80, color: lib.rgb(0.7, 0.14, 0.1) });
  w.p.drawText("SCHEDA EMERGENZE", { x: w.M, y: w.H - 40, size: 22, font: fb, color: lib.rgb(1, 1, 1) });
  w.p.drawText(pdfTesto(`${e.nome}${e.nascita ? " · nato il " + e.nascita : ""}`), { x: w.M, y: w.H - 62, size: 12, font: f, color: lib.rgb(1, 1, 1) });
  w.y = w.H - 100;
  if (e.peso) w.campo("Peso", e.peso);
  for (const [k, v] of e.righe) w.campo(k, v);
  w.titolo("Numeri utili");
  for (const [n, t] of NUMERI_UTILI) w.campo(t, n);
  w.campo(PEDIATRA.consulti.label, `Pediatra ${PEDIATRA.nome} – consulti 8:30-9:30 e 14:00-14:30`);
  w.campo(PEDIATRA.prenotazioni.label, "Prenotazioni pediatra (lun-ven 9-11)");
  w.campo("Pronto Soccorso", "Ospedale di Sondrio, Via Stelvio 25, Sondrio");
  w.titolo("Cosa dire al 112");
  w.testo("Nome e età del bambino, cosa è successo e da quando, se respira e se è cosciente, eventuali allergie, indirizzo preciso dove vi trovate.", { size: 10 });
  w.y -= 8; w.testo(`Aggiornata al ${dataBreve(oggiISO())}.`, { size: 8, color: w.col.muted });
  const file = new File([await pdf.save()], `Scheda emergenze ${e.nome}.pdf`, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: file.name }); return; } catch (err) { if (err.name === "AbortError") return; } }
  mostraFile(file, file.name);
}

/* =====================================================================
   VISTA "SALUTE" E AZIONI
   ===================================================================== */
const SEZ_SALUTE = { pasti: "🍼 Pasti e pannolini", sonno: "😴 Sonno", crescita: "📏 Crescita", vaccini: "💉 Vaccini", bilanci: "🩺 Bilanci", screening: "👶 Screening", farmaci: "💊 Farmaci", febbre: "🌡️ Febbre", tappe: "⭐ Tappe", pratiche: "📋 Primi giorni" };
let sezSalute = ls.get("sezSalute", "pasti");
function vSalute() {
  const viste = { pasti: vPasti, sonno: vSonno, pratiche: vPrimiGiorni, crescita: vCrescita, vaccini: vVaccini, bilanci: vBilanci, screening: vScreening, farmaci: vFarmaci, febbre: vFebbre, tappe: vTappe };
  return `${typeof bannerGoogle === "function" ? bannerGoogle() : ""}
    <div class="chips-sez">${Object.entries(SEZ_SALUTE).map(([k, t]) => `<button type="button" class="btn sm ${k === sezSalute ? "pri" : ""}" data-act="sez-salute" data-sez="${k}" ${k === sezSalute ? 'aria-current="true"' : ""}>${t}</button>`).join("")}</div>
    ${(viste[sezSalute] || vCrescita)()}`;
}
function fabSalute() {
  ({ pasti: () => formPasto(), sonno: () => formSonno(), pratiche: () => toast("Spunta le voci dell'elenco quando sono fatte"), crescita: () => formMisura(), vaccini: () => formVisita({}, { tipo: "vaccino" }), bilanci: () => formVisita({}, { tipo: "bilancio" }), screening: () => formDoc(),
    farmaci: () => formDose(), febbre: () => formFebbre(), tappe: () => formTappa() }[sezSalute] || (() => formMisura()))();
}
/* salva una voce nuova o modificata in una raccolta */
function salvaVoce(col, vecchia, dati) {
  if (vecchia && vecchia.id && S[col].some(x => x.id === vecchia.id)) Object.assign(S[col].find(x => x.id === vecchia.id), dati);
  else S[col].push({ id: uid(), creato: Date.now(), creatoDa: G.email || "", ...dati });
}
/* home: riquadri rapidi */
function cardHomeSalute() {
  const prossimi = promemoriaDovuti().filter(p => p.data <= oggiISO(new Date(Date.now() + 45 * 864e5))).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3);
  const ultimaT = diarioOrd().find(x => x.temp && Date.now() - daOraLocale(x.quando) < 2 * 864e5);
  const dosi24 = attivi("dosi").filter(d => Date.now() - daOraLocale(d.quando) < 864e5);
  const ap = domandeAperte().length;
  return `<div class="btns" style="margin-top:4px">
      <button type="button" class="btn pri" data-act="nuovo-pasto">🍼 Pasto</button>
      <button type="button" class="btn" data-act="nuovo-pannolino">🧷 Pannolino</button>
      <button type="button" class="btn" data-act="${typeof sonnoInCorso === "function" && sonnoInCorso() ? "sonno-sveglio" : "sonno-dorme"}">${typeof sonnoInCorso === "function" && sonnoInCorso() ? "☀️ Sveglio" : "😴 Dorme"}</button>
      <button type="button" class="btn" data-act="notte-apri">🌙 Notte</button>
      <button type="button" class="btn" data-act="nuova-dose">💊 Farmaco</button>
      <button type="button" class="btn" data-act="nuova-febbre">🌡️ Febbre</button>
      <button type="button" class="btn" data-act="nuova-misura">📏 Misure</button>
      <button type="button" class="btn bad" data-act="emergenza">🆘 Emergenze</button></div>
    ${cardHomePasti()}
    ${ultimaT || dosi24.length ? `<div class="notice ${ultimaT?.temp >= 38 ? "warn" : "info"} small" data-act="vai-salute" data-sez="${dosi24.length ? "farmaci" : "febbre"}" style="cursor:pointer">${ultimaT ? `🌡️ Ultima temperatura: <b>${fmt(ultimaT.temp, 1)}°</b> ${quandoBreve(ultimaT.quando)}. ` : ""}${dosi24.length ? `💊 ${dosi24.length} ${dosi24.length === 1 ? "dose" : "dosi"} nelle ultime 24 ore, l'ultima: ${esc(dosiOrd()[0].farmaco)} ${quandoBreve(dosiOrd()[0].quando)}${dosiOrd()[0].chi ? " (" + esc(dosiOrd()[0].chi) + ")" : ""}.` : ""}</div>` : ""}
    ${prossimi.length ? `<div class="card"><b>📅 In arrivo</b>${prossimi.map(p => `<div class="slot" data-act="vai-salute" data-sez="${p.k.startsWith("bil") ? "bilanci" : "vaccini"}" style="cursor:pointer"><span>${esc(p.titolo.replace(/^\S+ Gioele: /, ""))}</span><span class="small">${dataBreve(p.data)}</span></div>`).join("")}</div>` : ""}
    ${ap ? `<div class="notice info small" data-act="tab" data-tab="visite" style="cursor:pointer">❓ ${ap} ${ap === 1 ? "domanda" : "domande"} da fare alla prossima visita.</div>` : ""}`;
}

/* azioni dei pulsanti (chiamata dal gestore principale) */
async function azioneSalute(act, b, e) {
  const id = b.dataset.id;
  if (await azionePasti(act, b)) return true;
  switch (act) {
    case "sez-salute": sezSalute = b.dataset.sez; ls.set("sezSalute", sezSalute); render(); return true;
    case "vai-salute": sezSalute = b.dataset.sez; ls.set("sezSalute", sezSalute); vai("salute"); return true;
    case "ind-crescita": ls.set("indCrescita", b.dataset.ind); render(); return true;
    case "nuova-misura": formMisura(); return true;
    case "apri-misura": formMisura(S.misure.find(x => x.id === id)); return true;
    case "apri-check": formCheck(b.dataset.k, b.dataset.tipo); return true;
    case "vaccini-tutti": ls.set("vacciniTutti", !ls.get("vacciniTutti", false)); render(); return true;
    case "nuova-visita-bil": formVisita({}, { tipo: "bilancio" }); return true;
    case "nuova-dose": formDose({}, b.dataset.farmaco ? { farmaco: b.dataset.farmaco } : {}); return true;
    case "apri-dose": formDose(S.dosi.find(x => x.id === id)); return true;
    case "farmaci-abituali": formFarmaciAbituali(); return true;
    case "nuova-febbre": formFebbre(); return true;
    case "apri-febbre": formFebbre(S.diario.find(x => x.id === id)); return true;
    case "apri-tappa": formTappa(b.dataset.k, id); return true;
    case "aggiungi-domanda": {
      const el = $("#nuovaDomanda"), t = el?.value.trim(); if (!t) { el?.focus(); return true; }
      S.domande.push({ id: uid(), testo: t, fatta: false, creato: Date.now(), updatedAt: Date.now() }); await salva(); $("#nuovaDomanda")?.focus(); return true;
    }
    case "domanda-fatta": { const d = S.domande.find(x => x.id === id); if (d) { d.fatta = true; d.updatedAt = Date.now(); setTimeout(() => salva(), 250); } return true; }
    case "apri-domanda": formDomanda(S.domande.find(x => x.id === id)); return true;
    case "nuova-spesa": formSpesa(); return true;
    case "apri-spesa": formSpesa(S.spese.find(x => x.id === id)); return true;
    case "spese-csv": esportaSpeseCsv(); return true;
    case "emergenza": e.preventDefault(); schedaEmergenza(); return true;
    case "emergenza-testo": condividi({ titolo: "Scheda emergenze Gioele", testo: testoEmergenza() }); return true;
    case "emergenza-pdf": b.disabled = true; try { await pdfEmergenza(); } catch (err) { toast(err.message, 4000); } finally { b.disabled = false; } return true;
    case "elimina-voce": {
      const col = b.dataset.col, x = S[col].find(v => v.id === id); if (!x) return true;
      if (!confirm("Eliminare questa voce?")) return true;
      Object.assign(x, { deleted: true, updatedAt: Date.now() });
      if (col === "farmaci") { await salva(); setTimeout(formFarmaciAbituali, 30); return true; }
      sheet.close(); await salva(); toast("Eliminato"); return true;
    }
  }
  return false;
}
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "nuovaDomanda") { e.preventDefault(); azioneSalute("aggiungi-domanda", e.target, e); } });
document.addEventListener("change", e => { if (e.target.id === "annoSpese") { ls.set("annoSpese", +e.target.value); render(); } });
