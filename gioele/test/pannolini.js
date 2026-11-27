const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); ls.set('mioNome', 'Simone'); S.profilo.nascita = '2026-11-22'; S.profilo.updatedAt = Date.now();
    const ieri = oggiISO(new Date(Date.now() - 864e5));
    for (const h of ['01:00', '04:30', '08:10', '13:00']) S.pasti.push({ id: uid(), quando: ieri + 'T' + h, seno: 'sx', minSx: 12, ml: 30, latte: 'artificiale', updatedAt: Date.now() });
    for (const [h, pi, ca, col] of [['01:05', true, false, ''], ['04:35', true, true, 'verde'], ['13:05', true, false, '']]) S.pannolini.push({ id: uid(), quando: ieri + 'T' + h, pipi: pi, cacca: ca, colore: col, updatedAt: Date.now() });
    await salva(false); });
  await p.click('[data-tab=salute]'); await p.click('[data-act=sez-salute][data-sez=pasti]'); await p.waitForTimeout(150);
  await p.click('[data-act=pannolino-rapido][data-tipo=pipi]'); await p.click('button[value=ok]'); await p.waitForTimeout(150);
  await p.click('[data-act=pannolino-rapido][data-tipo=cacca]'); await p.click('button[value=ok]'); await p.waitForTimeout(150);
  // dettagli: apri l'ultima cacca e metti colore chiaro -> avviso
  await p.click('[data-act=apri-pannolino] >> nth=0'); await p.waitForTimeout(150);
  await p.selectOption('select[name=colore]', 'chiaro'); await p.dispatchEvent('select[name=colore]', 'change');
  console.log('avviso feci chiare:', (await p.textContent('#avvisoCacca')).slice(0, 80));
  await p.selectOption('select[name=colore]', 'senape'); await p.selectOption('select[name=consistenza]', 'molle'); await p.click('button[value=ok]'); await p.waitForTimeout(150);
  // modulo con dettagli: solo pipì -> dettagli cacca nascosti
  await p.click('[data-act=nuovo-pannolino]'); console.log('dettagli cacca nascosti con sola pipì:', await p.evaluate(() => document.querySelector('#dettagliCacca').classList.contains('hidden')));
  await p.click('button[value=annulla]');
  console.log('oggi:', JSON.stringify(await p.evaluate(() => pannoliniGiorno(oggiISO()))).replace(/"lista":\[.*?\],/, ''));
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(100);
  const box = await p.locator('text=🧷 Pannolini').first(); await box.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80));
  await p.screenshot({ path: 'd_box.png' });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 1700)); await p.screenshot({ path: 'd_lista.png' });
  await p.click('[data-tab=home]'); await p.waitForTimeout(150); await p.screenshot({ path: 'd_home.png' });
  await p.click('[data-act=riepilogo]'); await p.click('#btnCreaRiep');
  await p.waitForFunction(() => /PDF pronto|Non sono riuscito/.test(document.querySelector('#boxRiepilogo').textContent), null, { timeout: 60000 });
  { const b64 = await p.evaluate(async () => { const a = new Uint8Array(await ultimoRiepilogo.arrayBuffer()); let s = ''; for (const x of a) s += String.fromCharCode(x); return btoa(s); }); require('fs').writeFileSync('riep_pann.pdf', Buffer.from(b64, 'base64')); }
  console.log('errori:', errs); await b.close();
})();
