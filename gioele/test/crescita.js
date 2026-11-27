const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(500);
  // controlli numerici (OMS, maschi)
  console.log(await p.evaluate(() => [
    ['peso nascita 3,3464 kg', percentile('peso', 0, 3.3464).testo],
    ['peso nascita 2,5 kg (atteso ~3°)', percentile('peso', 0, 2.5).testo],
    ['peso 12 mesi 9,6479 (atteso 50°)', percentile('peso', 365, 9.6479).testo],
    ['lunghezza nascita 49,88 (50°)', percentile('lunghezza', 0, 49.8842).testo],
    ['testa nascita 34,46 (50°)', percentile('testa', 0, 34.4618).testo],
    ['P97 peso 6 mesi (atteso ~9,7 kg)', valoreAZ(lmsAl('peso', 183), 1.881).toFixed(2)],
  ].map(x => x.join(': ')).join('\n')));
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-05-10'; S.profilo.updatedAt = Date.now(); await salva(false); });
  await p.evaluate(() => { sezSalute = 'crescita'; vai('salute'); }); await p.waitForTimeout(200);
  for (const [d, peso, l, t] of [['2026-05-10', '3450', '50,5', '34,8'], ['2026-06-12', '4,6', '55', '37,5'], ['2026-08-20', '6,4', '62', '40,5'], ['2026-11-10', '7,9', '68', '43']]) {
    await p.click('[data-act=nuova-misura]'); await p.fill('input[name=data]', d); await p.fill('input[name=peso]', peso); await p.fill('input[name=lunghezza]', l); await p.fill('input[name=testa]', t);
    if (d === '2026-11-10') console.log('anteprima:', (await p.textContent('#anteprimaPerc')).replace(/\s+/g, ' '));
    await p.click('button[value=ok]'); await p.waitForTimeout(150);
  }
  await p.screenshot({ path: 's_crescita.png', fullPage: true });
  console.log('errori:', errs); await b.close();
})();
