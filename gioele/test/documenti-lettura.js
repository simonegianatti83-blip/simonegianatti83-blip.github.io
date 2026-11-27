const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(500);
  // profilo
  await p.click('[data-act=profilo]');
  await p.fill('input[name=nascita]', '2024-03-14'); await p.fill('input[name=allergie]'.replace('input','textarea'), 'Nessuna nota');
  await p.fill('textarea[name=perinatale]', 'Gravidanza fisiologica, parto spontaneo a termine'); await p.fill('input[name=pesoNascita]', '3.250 g');
  await p.click('button[value=ok]'); await p.waitForTimeout(200);
  async function carica(file, shot) {
    await p.click('[data-tab=documenti]'); await p.click('#fab');
    const t0 = Date.now();
    await p.setInputFiles('#inFile', file);
    await p.waitForFunction(() => document.querySelector('#boxAnalisi')?.textContent.includes('ha letto') || document.querySelector('#boxAnalisi')?.textContent.includes('Non sono riuscito'), null, { timeout: 120000 });
    const r = await p.evaluate(() => { const f = document.querySelector('#sheetForm').elements; return { cat: f.categoria.value, titolo: f.titolo.value, data: f.data.value, struttura: f.struttura.value, storico: !document.querySelector('#rigaStorico').classList.contains('hidden') && f.storico.checked, note: f.note.value }; });
    console.log(file, (Date.now()-t0)+'ms', JSON.stringify(r));
    console.log('  box:', (await p.textContent('#boxAnalisi')).replace(/\s+/g,' ').slice(0,300));
    await p.screenshot({ path: shot, fullPage: false });
    await p.click('button[value=ok]'); await p.waitForTimeout(400);
  }
  await carica('esami.pdf', 'a_esami.png');
  await carica('dimissione.pdf', 'a_dim.png');
  await carica('ps.jpg', 'a_ps.png');
  // festivi
  await p.click('[data-tab=pediatra]'); await p.click('[data-act=nuova-chiusura]');
  await p.fill('input[name=da]', '2026-12-28'); await p.fill('input[name=a]', '2026-12-31'); await p.fill('input[name=motivo]', 'Ferie natalizie');
  await p.click('button[value=ok]'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'a_ped.png', fullPage: true });
  console.log('controllo 8 dic:', await p.evaluate(() => controllaOrarioPediatra({ tipo: 'pediatra', data: '2026-12-08', ora: '10:00', luogo: LUOGHI[1] })));
  console.log('pasquetta 2027:', await p.evaluate(() => chiusura(new Date(2027, 2, 29))), '| 29/12:', await p.evaluate(() => chiusura(new Date(2026, 11, 29))));
  await p.click('[data-tab=visite]'); await p.selectOption('#quandoVis', 'tutte'); await p.screenshot({ path: 'a_vis.png', fullPage: true });
  // riepilogo
  await p.click('[data-tab=home]'); await p.click('[data-act=riepilogo]');
  await p.fill('textarea[name=note]', 'Tosse persistente da 10 giorni.');
  await p.check('input[name=allegati]');
  await p.click('#btnCreaRiep');
  await p.waitForFunction(() => /PDF pronto|Non sono riuscito/.test(document.querySelector('#boxRiepilogo').textContent), null, { timeout: 60000 });
  console.log('riepilogo:', (await p.textContent('#boxRiepilogo')).replace(/\s+/g, ' '));
  { const b64 = await p.evaluate(async () => { const a = new Uint8Array(await ultimoRiepilogo.arrayBuffer()); let s = ''; for (const x of a) s += String.fromCharCode(x); return btoa(s); }); require('fs').writeFileSync('riepilogo.pdf', Buffer.from(b64, 'base64')); }
  console.log('errori:', errs);
  await b.close();
})();
