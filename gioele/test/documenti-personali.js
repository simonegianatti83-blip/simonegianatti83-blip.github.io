const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  const attendi = () => p.waitForFunction(() => /ha letto|Non sono riuscito/.test(document.querySelector('#boxAnalisi')?.textContent || ''), null, { timeout: 90000 });
  const campi = () => p.evaluate(() => { const f = document.querySelector('#sheetForm').elements; return ['categoria','titolo','numero','data','scadenza','ente'].map(n => n + '=' + (f[n]?.value ?? '-')).join(' | '); });
  // 1) tessera dalla sezione personali
  await p.click('[data-tab=documenti]'); await p.click('[data-act=doc-ambito][data-amb=personali]');
  await p.click('#fab'); await p.setInputFiles('#inFile', 'tessera.jpg'); await attendi();
  console.log('tessera:', await campi()); await p.screenshot({ path: 'p_tess.png' });
  await p.click('button[value=ok]'); await p.waitForTimeout(500);
  // 2) atto di nascita caricato per sbaglio tra i sanitari
  await p.click('[data-act=doc-ambito][data-amb=sanitari]'); await p.click('#fab'); await p.setInputFiles('#inFile', 'nascita.pdf'); await attendi();
  await p.waitForTimeout(200);
  console.log('suggerimento:', await p.locator('[data-act=passa-personale]').count());
  await p.click('[data-act=passa-personale]'); await p.waitForTimeout(300);
  console.log('nascita:', await campi());
  await p.click('button[value=ok]'); await p.waitForTimeout(500);
  console.log('profilo:', JSON.stringify(await p.evaluate(() => ({ cf: S.profilo.cf, n: S.profilo.nascita, l: S.profilo.luogoNascita, sani: docSanitari().length, pers: docPersonali().length }))));
  await p.click('[data-tab=documenti]'); await p.screenshot({ path: 'p_lista.png', fullPage: true });
  // scadenza vicina per vedere l'avviso
  await p.evaluate(async () => { const d = docPersonali().find(x => x.categoria === 'tessera'); d.scadenza = oggiISO(new Date(Date.now() + 20 * 864e5)); d.updatedAt = Date.now(); await salva(false); });
  await p.click('[data-tab=home]'); await p.waitForTimeout(200);
  const h = await p.evaluate(() => { const el = [...document.querySelectorAll('h2')].find(x => x.textContent === 'Documenti personali'); el.scrollIntoView(); return el.nextElementSibling.textContent.replace(/\s+/g, ' '); });
  console.log('home:', h); await p.screenshot({ path: 'p_home.png' });
  console.log('errori:', errs); await b.close();
})();
