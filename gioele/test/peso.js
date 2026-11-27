const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13'], hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-11-22';
    S.misure.push({ id: 'n', data: '2026-11-22', peso: 3.45, lunghezza: 50, testa: 34.5, updatedAt: 1 }, { id: 'a', data: '2026-11-24', peso: 3.21, updatedAt: 1 }); await salva(false); sezSalute = 'crescita'; vai('salute'); });
  await p.tap('[data-act=nuova-misura] >> nth=0'); await p.fill('input[name=data]', '2026-11-27'); await p.fill('input[name=peso]', '3290'); await p.dispatchEvent('input[name=peso]', 'input');
  console.log('ANTEPRIMA:', (await p.textContent('#anteprimaPerc')).replace(/\s+/g, ' ').trim());
  await p.tap('button[value=ok]'); await p.waitForTimeout(250);
  console.log('MESSAGGIO:', await p.locator('.toast').textContent());
  console.log('RIQUADRO:', (await p.locator('.card').first().textContent()).replace(/\s+/g, ' ').trim());
  console.log('TABELLA:', (await p.locator('table.tab tbody').textContent()).replace(/\s+/g, ' ').trim());
  await p.screenshot({ path: 'w1.png' });
  // calo oltre il 10%
  await p.evaluate(async () => { S.misure.push({ id: 'z', data: '2026-11-28', peso: 3.05, updatedAt: 1 }); await salva(false); });
  console.log('OLTRE 10%:', (await p.locator('.card').first().textContent()).replace(/\s+/g, ' ').trim().slice(0, 260));
  console.log('errori:', errs); await b.close();
})();
