const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  let promptRisp = '1234'; p.on('dialog', d => d.type() === 'prompt' ? d.accept(promptRisp) : d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); ls.set('mioNome', 'Simone'); S.profilo.nascita = '2026-11-22';
    const o = oggiISO(); S.pasti.push({ id: 'p1', quando: o + 'T06:00', fine: o + 'T06:20', seno: 'sx', minuti: 20, minSx: 20, finito: 'sx', updatedAt: 1 }, { id: 'p2', quando: o + 'T09:30', seno: '', ml: 40, latte: 'artificiale', updatedAt: 1 }); await salva(false); vai('home'); });
  // modalità notte
  await p.tap('.top [data-act=notte-apri]'); await p.waitForTimeout(150);
  console.log('notte aperta:', await p.evaluate(() => !document.getElementById('notte').hidden), '| tema:', await p.evaluate(() => document.documentElement.dataset.theme));
  await p.screenshot({ path: 'x_notte.png' });
  const n0 = await p.evaluate(() => attivi('pannolini').length);
  await p.tap('#notte [data-act=notte-pann][data-tipo=pipi]'); await p.waitForTimeout(150);
  console.log('pipì con un tocco:', await p.evaluate(() => attivi('pannolini').length) - n0);
  await p.tap('#notte [data-act=notte-annulla]'); await p.waitForTimeout(150);
  console.log('dopo Annulla:', await p.evaluate(() => attivi('pannolini').length) - n0);
  await p.tap('#notte [data-act=notte-biberon]'); await p.waitForTimeout(150);
  console.log('biberon:', await p.evaluate(() => { const x = pastiOrd()[0]; return x.ml + ' ml ' + x.quando.slice(11); }));
  await p.tap('#notte [data-act=notte-ripeti]'); await p.waitForTimeout(150);
  console.log('ripeti ultimo:', await p.evaluate(() => attivi('pasti').length));
  await p.tap('#notte [data-act=notte-poppata][data-seno=dx]'); await p.waitForTimeout(100);
  await p.evaluate(() => { const x = ls.get('poppataInCorso'); x.dal = new Date(Date.now() - 12 * 60000).toISOString(); x.inizio = oraLocale(new Date(Date.now() - 12 * 60000)); ls.set('poppataInCorso', x); disegnaNotte(); });
  await p.tap('#notte [data-act=notte-fine-poppata]'); await p.waitForTimeout(150);
  console.log('poppata salvata senza modulo:', await p.evaluate(() => { const x = pastiOrd()[0]; return `${x.seno} ${x.minuti} min ${orarioPasto(x)}`; }), '| foglio aperto?', await p.evaluate(() => document.querySelector('#sheet').open));
  await p.tap('#notte [data-act=sonno-dorme]'); await p.waitForTimeout(150);
  console.log('sonno:', await p.evaluate(() => !!sonnoInCorso()));
  await p.tap('#notte [data-act=notte-chiudi]'); await p.waitForTimeout(150);
  console.log('notte chiusa, tema ripristinato:', await p.evaluate(() => document.getElementById('notte').hidden && document.documentElement.dataset.theme === (temaScuroAdesso() ? 'dark' : 'light')));
  // sonno: sveglio
  await p.evaluate(() => { const x = sonnoInCorso(); x.inizio = oraLocale(new Date(Date.now() - 95 * 60000)); });
  await p.evaluate(() => { sezSalute = 'sonno'; vai('salute'); }); await p.tap('[data-act=sonno-sveglio] >> nth=0'); await p.waitForTimeout(150);
  console.log('sveglio:', await p.locator('.toast').textContent());
  await p.screenshot({ path: 'x_sonno.png' });
  // statistiche pasti
  await p.evaluate(() => { sezSalute = 'pasti'; vai('salute'); });
  console.log('statistiche:', (await p.locator('.card', { hasText: 'Statistiche' }).textContent()).replace(/\s+/g, ' ').slice(0, 200));
  // primi giorni
  await p.evaluate(() => { sezSalute = 'pratiche'; vai('salute'); });
  await p.click('[data-act=pg-spunta][data-k=pg_cf]'); await p.waitForTimeout(150);
  console.log('primi giorni:', (await p.locator('.card b').first().textContent()), '| scadenza assegno:', (await p.locator('.item', { hasText: 'Assegno unico' }).textContent()).match(/entro il [^\s]+ [^\s]+ \d+/)?.[0]);
  await p.screenshot({ path: 'x_pratiche.png', fullPage: false });
  // link azione
  await p.evaluate(() => { location.hash = 'azione=cacca'; }); await p.waitForTimeout(400);
  console.log('link #azione=cacca:', await p.evaluate(() => pannoliniOrd()[0].cacca), '| hash ripulito:', await p.evaluate(() => location.hash === ''));
  // Face ID simulato
  const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true } });
  await p.evaluate(() => vai('impostazioni')); await p.click('[data-act=blocco-attiva]'); await p.waitForTimeout(800);
  console.log('blocco attivo:', await p.evaluate(() => ({ faceid: !!ls.get('bloccoCred'), codice: !!ls.get('bloccoPin') })));
  await p.reload(); await p.waitForTimeout(600);
  console.log('all\'apertura bloccata:', await p.locator('#blocco').count());
  await p.click('#sbloccaFace'); await p.waitForTimeout(800);
  console.log('sbloccata con Face ID:', await p.locator('#blocco').count() === 0);
  await p.reload(); await p.waitForTimeout(600);
  await p.fill('#sbloccaPin input', '9999'); await p.click('#sbloccaPin button'); await p.waitForTimeout(300);
  console.log('codice sbagliato:', await p.textContent('#bloccoErr'));
  await p.fill('#sbloccaPin input', '1234'); await p.click('#sbloccaPin button'); await p.waitForTimeout(300);
  console.log('sbloccata con codice:', await p.locator('#blocco').count() === 0);
  console.log('errori:', errs); await b.close();
})();
