const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13'], hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  await p.evaluate(() => { ls.set('noBannerInstalla', true); vai('pediatra'); });
  await p.tap('[data-act=nuova-chiusura]'); await p.waitForTimeout(200);
  console.log('foglio aperto:', await p.evaluate(() => document.querySelector('#sheet').open), await p.textContent('#sheetTitolo'));
  await p.fill('input[name=da]', '2026-12-28'); await p.fill('input[name=a]', '2026-12-31'); await p.tap('button[value=ok]'); await p.waitForTimeout(200);
  console.log('salvato:', await p.evaluate(() => S.chiusure.length), 'foglio aperto:', await p.evaluate(() => document.querySelector('#sheet').open));
  // visualizzatore: foto e PDF
  const fs = require('fs');
  const pdf = fs.readFileSync('esami.pdf').toString('base64'), jpg = fs.readFileSync('referto.jpg').toString('base64');
  await p.evaluate(async ([a, c]) => { const bl = (x, t) => new Blob([Uint8Array.from(atob(x), ch => ch.charCodeAt(0))], { type: t }); await fileSet('fpdf', bl(a, 'application/pdf')); await fileSet('fjpg', bl(c, 'image/jpeg'));
    S.documenti.push({ id: 'dx', titolo: 'Esami', categoria: 'esami', data: oggiISO(), files: [{ fid: 'fpdf', nome: 'esami.pdf', mime: 'application/pdf' }, { fid: 'fjpg', nome: 'foto.jpg', mime: 'image/jpeg' }], updatedAt: 1 }); await salva(false); }, [pdf, jpg]);
  await p.evaluate(() => { filtroDoc.ambito = 'sanitari'; vai('documenti'); });
  await p.tap('[data-act=apri-doc][data-id=dx]'); await p.waitForTimeout(300);
  await p.tap('#bozzaFiles [data-act=apri-file][data-i="0"]'); await p.waitForTimeout(1500);
  console.log('PDF: visualizzatore aperto', await p.evaluate(() => document.querySelector('#viewer').open), '| pagine disegnate:', await p.locator('#viewerBody canvas').count(), '|', await p.textContent('#viewerStato'));
  await p.screenshot({ path: 'c6_pdf.png' });
  await p.tap('#viewerChiudi'); await p.waitForTimeout(150);
  console.log('dopo chiusura: modulo documento ancora aperto', await p.evaluate(() => document.querySelector('#sheet').open));
  await p.tap('#bozzaFiles [data-act=apri-file][data-i="1"]'); await p.waitForTimeout(400);
  console.log('foto: immagine mostrata', await p.locator('#viewerBody img').count());
  await p.tap('#viewerChiudi'); await p.evaluate(() => document.querySelector('#sheet').close());
  // riepilogo -> Apri
  await p.evaluate(() => vai('home')); await p.tap('[data-act=riepilogo]'); await p.tap('#btnCreaRiep');
  await p.waitForFunction(() => /PDF pronto|Non sono riuscito/.test(document.querySelector('#boxRiepilogo').textContent), null, { timeout: 60000 });
  await p.tap('[data-act=riepilogo-apri]'); await p.waitForTimeout(1500);
  console.log('riepilogo nel visualizzatore: pagine', await p.locator('#viewerBody canvas').count());
  console.log('errori:', errs); await b.close();
})();
