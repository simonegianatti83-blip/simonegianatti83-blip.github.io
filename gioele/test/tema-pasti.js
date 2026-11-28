// Tema automatico con alba e tramonto (o scelto a mano) e conteggi separati seno / formula
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const apri = async (ora) => {
    const c = await b.newContext({ ...devices['iPhone 13'], colorScheme: 'light', timezoneId: 'Europe/Rome' });
    if (ora) await c.addInitScript(`(() => { const T = new Date('${ora}').getTime(), D = Date, d0 = D.now(); window.Date = class extends D { constructor(...a) { super(...(a.length ? a : [T + (D.now() - d0)])); } static now() { return T + (D.now() - d0); } }; })()`);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); return p;
  };
  const p = await apri('2026-11-28T12:00:00+01:00');
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  const at = await p.evaluate(() => { const x = albaTramonto(new Date('2026-11-28T12:00:00+01:00')); return oraBreve(x.alba) + ' ' + oraBreve(x.tramonto); });
  console.log('Sondrio 28 nov alba/tramonto:', at);
  console.log('a mezzogiorno tema:', await p.evaluate(() => document.documentElement.dataset.theme));
  const p2 = await apri('2026-11-28T21:00:00+01:00'); await p2.goto('http://localhost:8765/gioele/'); await p2.waitForTimeout(400);
  console.log('alle 21 tema:', await p2.evaluate(() => document.documentElement.dataset.theme));
  // scelta manuale da Altro
  await p2.evaluate(() => { ls.set('noBannerInstalla', true); vai('impostazioni'); });
  await p2.click('[data-act=tema][data-tema=chiaro]'); console.log('scelto sempre chiaro alle 21:', await p2.evaluate(() => document.documentElement.dataset.theme + ' ' + ls.get('tema')));
  await p2.click('[data-act=tema][data-tema=scuro]'); console.log('scelto sempre scuro:', await p2.evaluate(() => document.documentElement.dataset.theme));
  await p2.click('[data-act=tema][data-tema=sistema]'); console.log('come il telefono:', await p2.evaluate(() => String(document.documentElement.dataset.theme)));
  await p2.click('[data-act=tema][data-tema=sole]');
  // modalità notte e poi chiusura: torna il tema automatico
  await p2.evaluate(() => { apriNotte(); applicaTema(); }); console.log('notte aperta:', await p2.evaluate(() => document.documentElement.dataset.theme));
  await p2.evaluate(() => chiudiNotte()); console.log('notte chiusa alle 21:', await p2.evaluate(() => document.documentElement.dataset.theme));
  // pasti: 4 biberon pieni + 2 poppate, poi poca integrazione
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-11-22';
    const h = ['01:00', '04:30', '08:00', '11:00']; h.forEach((o, i) => S.pasti.push({ id: 'b' + i, quando: '2026-11-28T' + o, ml: 60, latte: 'artificiale', updatedAt: 1 }));
    S.pasti.push({ id: 's1', quando: '2026-11-28T02:30', seno: 'sx', minSx: 15, minuti: 15, updatedAt: 1 }, { id: 's2', quando: '2026-11-28T09:30', seno: 'entrambi', minSx: 10, minDx: 8, minuti: 18, updatedAt: 1 });
    await salva(false); sezSalute = 'pasti'; vai('salute'); });
  console.log('ultime24:', JSON.stringify(await p.evaluate(() => ultime24())));
  const t = (await p.textContent('#vista')).replace(/\s+/g, ' ');
  console.log('formula:', /Formula · ultime 24 ore\s*4 biberon · 240 ml meno di 6/.test(t), '| seno:', /Seno · ultime 24 ore\s*2 poppate · 33 min/.test(t));
  await p.evaluate(async () => { S.pasti = S.pasti.filter(x => !x.id.startsWith('b')); S.pasti.push({ id: 'b9', quando: '2026-11-28T11:00', ml: 20, latte: 'artificiale', updatedAt: 1 }); await salva(false); });
  console.log('poca integrazione → poppate indicate:', await p.evaluate(() => ultime24().poppateIndicate));
  await p.evaluate(async () => { for (let i = 0; i < 6; i++) S.pasti.push({ id: 'c' + i, quando: '2026-11-27T' + (14 + i * 1.5 | 0) + ':00', ml: 60, latte: 'artificiale', updatedAt: 1 }); await salva(false); });
  console.log('integrazione piena → poppate indicate:', await p.evaluate(() => ultime24().poppateIndicate));
  // tema scuro: i numeri scritti nel modulo del pasto devono vedersi (testo chiaro su fondo scuro)
  await p2.click('[data-act=tema][data-tema=scuro]');
  await p2.evaluate(() => formPasto()); await p2.fill('input[name=ml]', '70'); await p2.fill('input[name=minSx]', '12');
  const col = await p2.evaluate(() => ['ml', 'minSx', 'chi'].map(n => { const st = getComputedStyle(document.querySelector(`[name=${n}]`)); return n + ' ' + st.color + ' su ' + st.backgroundColor; }));
  console.log('colori campi (scuro):', col.join(' | '));
  const lum = c => { const [r, g, bb] = c.match(/\d+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * bb) / 255; };
  console.log('numeri leggibili in scuro:', col.every(x => { const [t, f] = x.split(' su '); return lum(t.replace(/^\S+ /, '')) - lum(f) > 0.5; }));
  await p2.click('button[value=annulla]');
  // prossimo pasto: 4 ore dopo l'inizio dell'ultimo
  console.log('intervallo pasti:', await p.evaluate(() => regolaPasti().intervalloMin));
  await p.evaluate(async () => { S.config.pasti = { ...(S.config.pasti || {}), intervalloMin: 210 }; await salva(false); });
  console.log('vecchio 3h30 salvato → ora:', await p.evaluate(() => regolaPasti().intervalloMin));
  console.log('errori:', errs); await b.close();
})();
