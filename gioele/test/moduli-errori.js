const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13'], hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-11-22'; await salva(false); });
  await p.click('[data-tab=home]'); await p.tap('[data-act=nuovo-pasto] >> nth=0'); await p.waitForTimeout(200);
  // 1) salvo senza niente -> errore visibile sul campo ml
  await p.tap('button[value=ok]'); await p.waitForTimeout(300);
  const vis = await p.evaluate(() => { const t = document.querySelector('.toast'); const r = t.getBoundingClientRect(); const s = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return (s === t || t.contains(s)); });
  console.log('1) errore in cima:', await p.textContent('#sheetErrore'), '| messaggio visibile:', vis, '| campo evidenziato:', await p.evaluate(() => document.querySelector('.campo-errore')?.name));
  await p.screenshot({ path: 'b2_errore.png' });
  // 2) −10 / +10 e scrittura libera
  await p.tap('[data-act=pasto-ml-piu][data-d="10"]'); console.log('2) +10 da vuoto:', await p.inputValue('input[name=ml]'));
  await p.tap('[data-act=pasto-ml-piu][data-d="-10"]'); await p.tap('[data-act=pasto-ml-piu][data-d="-10"]'); console.log('   −10 −10:', await p.inputValue('input[name=ml]'));
  await p.tap('input[name=ml]'); await p.keyboard.press('Control+A'); await p.keyboard.type('55'); console.log('   scritto 55:', await p.inputValue('input[name=ml]'));
  // 3) Invio sulla tastiera: il modulo resta aperto e non salva
  await p.keyboard.press('Enter'); await p.waitForTimeout(200); console.log('3) dopo Invio foglio aperto:', await p.evaluate(() => document.querySelector('#sheet').open));
  // 4) salva solo biberon 55 ml -> si chiude
  await p.tap('button[value=ok]'); await p.waitForTimeout(300);
  console.log('4) dopo Salva foglio aperto:', await p.evaluate(() => document.querySelector('#sheet').open), '| salvato:', await p.evaluate(() => JSON.stringify(pastiOrd()[0] && { ml: pastiOrd()[0].ml, seno: pastiOrd()[0].seno })));
  // 5) poppata senza ora di fine -> errore sul campo fine, poi inserita -> salva
  await p.tap('[data-act=nuovo-pasto] >> nth=0'); await p.selectOption('select[name=seno]', 'sx'); await p.tap('button[value=ok]'); await p.waitForTimeout(300);
  console.log('5) errore:', await p.textContent('#sheetErrore'), '| campo:', await p.evaluate(() => document.querySelector('.campo-errore')?.name));
  await p.fill('input[name=inizio]', '10:00'); await p.fill('input[name=fine]', '10:18'); await p.tap('button[value=ok]'); await p.waitForTimeout(300);
  console.log('   dopo correzione foglio aperto:', await p.evaluate(() => document.querySelector('#sheet').open), '| ultimo:', await p.evaluate(() => orarioPasto(pastiOrd()[0])));
  console.log('errori:', errs); await b.close();
})();
