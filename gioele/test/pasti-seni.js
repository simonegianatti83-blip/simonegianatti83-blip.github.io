const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(300);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-11-22'; await salva(false); });
  await p.click('[data-tab=salute]'); await p.click('[data-act=sez-salute][data-sez=pasti]');
  for (const [ini, fin, primo] of [['09:00', '09:24', 'sx'], ['13:10', '13:35', 'dx'], ['23:50', '00:15', 'sx']]) {
    await p.click('[data-act=nuovo-pasto]'); await p.selectOption('select[name=seno]', 'entrambi');
    console.log('campo cambio presente:', await p.locator('input[name=cambio]').count());
    await p.fill('input[name=inizio]', ini); await p.fill('input[name=fine]', fin); await p.selectOption('select[name=primo]', primo); await p.dispatchEvent('input[name=fine]', 'input');
    console.log(ini + '-' + fin, '→', await p.textContent('#durataPasto'));
    await p.click('button[value=ok]'); await p.waitForTimeout(120);
    console.log('   salvato:', await p.evaluate(() => { const x = pastiOrd().find(y => y.updatedAt === Math.max(...S.pasti.map(z => z.updatedAt))); return `sx ${x.minSx} dx ${x.minDx} primo ${x.primo} finito ${x.finito}`; }));
  }
  // cronometro con entrambi
  await p.click('[data-act=poppata-avvia][data-seno=dx]');
  await p.evaluate(() => { const x = ls.get('poppataInCorso'); const t0 = new Date(Date.now() - 20 * 60000); x.inizio = oraLocale(t0); x.dal = new Date(Date.now() - 8 * 60000).toISOString(); x.minDx = 12; x.primo = 'dx'; x.minPrimo = 12; x.seno = 'sx'; ls.set('poppataInCorso', x); render(); });
  await p.click('[data-act=poppata-fine]'); await p.waitForTimeout(120);
  console.log('cronometro:', await p.textContent('#durataPasto'));
  console.log('errori:', errs); await b.close();
})();
