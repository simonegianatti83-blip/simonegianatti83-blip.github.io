const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const prepara = async p => {
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
    await p.evaluate(async () => {
      ls.set('noBannerInstalla', true); Object.assign(S.profilo, { nascita: '2026-11-22', allergie: 'Nessuna nota', updatedAt: 1 });
      const o = oggiISO(), d = n => oggiISO(new Date(Date.now() + n * 864e5));
      S.visite.push({ id: 'v1', tipo: 'pediatra', data: d(1), ora: '10:00', stato: 'programmata', luogo: LUOGHI[0], medico: PEDIATRA.nome, motivo: 'Controllo', updatedAt: 1 },
        { id: 'v2', tipo: 'specialista', data: d(6), ora: '11:30', stato: 'programmata', luogo: 'Ospedale di Sondrio', medico: 'Oculistica', motivo: 'Visita oculistica', updatedAt: 1 },
        { id: 'v3', tipo: 'bilancio', data: d(12), ora: '16:00', stato: 'programmata', medico: PEDIATRA.nome, updatedAt: 1 },
        { id: 'v4', tipo: 'vaccino', data: d(58), ora: '09:00', stato: 'programmata', motivo: 'Esavalente', updatedAt: 1 });
      for (let i = 0; i < 5; i++) S.documenti.push({ id: 'd' + i, titolo: ['Esami del sangue', 'Lettera di dimissione', 'Ecografia anche', 'Visita oculistica', 'Certificato vaccinale'][i], categoria: ['esami', 'dimissione', 'imaging', 'visita', 'vaccini'][i], data: d(-i - 1), struttura: 'ASST Valtellina e Alto Lario', files: [], updatedAt: 1 });
      for (const [h, s, ml] of [['02:10', 'sx', 30], ['05:40', 'dx', 30], ['09:10', 'entrambi', 40], ['12:40', '', 40]]) S.pasti.push({ id: uid(), quando: o + 'T' + h, fine: s ? o + 'T' + h.replace(/:(\d)\d/, ':3$1') : '', seno: s, minuti: s ? 20 : null, ml, latte: 'artificiale', updatedAt: 1 });
      S.pannolini.push({ id: 'n1', quando: o + 'T08:00', pipi: true, cacca: true, colore: 'senape', updatedAt: 1 });
      S.domande.push({ id: 'q1', testo: 'Vitamina D fino a quando?', fatta: false, updatedAt: 1 });
      await salva(false);
    });
  };
  const pc = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); await prepara(pc);
  for (const [n, f] of [['home', () => vai('home')], ['visite', () => vai('visite')], ['pasti', () => { sezSalute = 'pasti'; vai('salute'); }], ['documenti', () => { filtroDoc.ambito = 'sanitari'; vai('documenti'); }], ['pediatra', () => vai('pediatra')], ['altro', () => vai('impostazioni')]]) {
    await pc.evaluate(f); await pc.waitForTimeout(200); await pc.screenshot({ path: `dk_${n}.png` });
  }
  await pc.evaluate(() => vai('visite')); await pc.click('[data-act=apri-visita] >> nth=0'); await pc.waitForTimeout(200); await pc.screenshot({ path: 'dk_modulo.png' });
  // telefono: deve restare come prima (barra in basso)
  const tel = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); await prepara(tel);
  await tel.evaluate(() => vai('home')); await tel.waitForTimeout(200);
  console.log('telefono: barra in basso =', await tel.evaluate(() => { const r = document.querySelector('nav.tabs').getBoundingClientRect(); return Math.round(r.bottom) === innerHeight && r.width === innerWidth; }), '| colonne home:', await tel.evaluate(() => getComputedStyle(document.querySelector('.col2')).display));
  console.log('computer: barra laterale =', await pc.evaluate(() => { const r = document.querySelector('nav.tabs').getBoundingClientRect(); return Math.round(r.width) + 'px di larghezza, a sinistra: ' + (r.left === 0); }));
  // iPad verticale (810) resta mobile, orizzontale (1080) diventa desktop
  for (const w of [810, 1080]) { const t = await (await b.newContext({ viewport: { width: w, height: 1000 } })).newPage(); await t.goto('http://localhost:8765/gioele/'); await t.waitForTimeout(300); console.log(`larghezza ${w}: barra`, await t.evaluate(() => getComputedStyle(document.querySelector('nav.tabs')).flexDirection === 'column' ? 'laterale' : 'in basso')); }
  console.log('errori:', errs); await b.close();
})();
