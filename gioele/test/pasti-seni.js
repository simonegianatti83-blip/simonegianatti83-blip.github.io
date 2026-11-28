// Poppata a mano: minuti del seno sinistro e del destro al posto dell'ora di fine
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(300);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-11-22'; await salva(false); });
  await p.click('[data-tab=salute]'); await p.click('[data-act=sez-salute][data-sez=pasti]');
  for (const [ini, sx, dx, primo] of [['09:00', '12', '15', 'dx'], ['13:10', '20', '', 'sx'], ['23:50', '', '18', 'sx']]) {
    await p.click('[data-act=nuovo-pasto]');
    console.log('campo ora di fine presente:', await p.locator('input[name=fine]').count());
    await p.fill('input[name=inizio]', ini); await p.fill('input[name=minSx]', sx); await p.fill('input[name=minDx]', dx);
    if (sx && dx) await p.selectOption('select[name=primo]', primo);
    console.log(ini, 'sx', sx || '-', 'dx', dx || '-', '→', await p.textContent('#durataPasto'), '| scelta primo seno visibile:', await p.isVisible('select[name=primo]'));
    await p.click('button[value=ok]'); await p.waitForTimeout(150);
    console.log('   salvato:', await p.evaluate(() => { const x = S.pasti.reduce((a, y) => y.updatedAt > a.updatedAt ? y : a); return `seno ${x.seno} sx ${x.minSx} dx ${x.minDx} primo ${x.primo || '-'} fine ${x.fine.slice(11)} orario ${orarioPasto(x)}`; }));
  }
  // riapertura di una poppata salvata: i minuti sono nei campi
  await p.evaluate(() => { const x = S.pasti.find(y => y.minSx === 12); formPasto(x); });
  console.log('riaperta: sx', await p.inputValue('input[name=minSx]'), 'dx', await p.inputValue('input[name=minDx]'));
  await p.click('button[value=annulla]');
  // cronometro: i minuti reali di ogni seno passano al modulo
  await p.click('[data-act=poppata-avvia][data-seno=dx]');
  await p.evaluate(() => { const x = ls.get('poppataInCorso'); const t0 = new Date(Date.now() - 20 * 60000); x.inizio = oraLocale(t0); x.dal = new Date(Date.now() - 8 * 60000).toISOString(); x.minDx = 12; x.primo = 'dx'; x.minPrimo = 12; x.seno = 'sx'; ls.set('poppataInCorso', x); render(); });
  await p.click('[data-act=poppata-fine]'); await p.waitForTimeout(120);
  console.log('cronometro: sx', await p.inputValue('input[name=minSx]'), 'dx', await p.inputValue('input[name=minDx]'), '| primo', await p.inputValue('select[name=primo]'));
  console.log('errori:', errs); await b.close();
})();
