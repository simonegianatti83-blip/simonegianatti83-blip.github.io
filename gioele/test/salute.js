const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); ls.set('mioNome', 'Simone'); Object.assign(S.profilo, { nascita: '2024-03-14', allergie: 'Amoxicillina (orticaria)', genitori: 'Simone 333 1111111, Silvia 333 2222222', updatedAt: Date.now() }); await salva(false); });
  const shot = async n => { await p.waitForTimeout(150); await p.screenshot({ path: n }); };
  const sez = async k => { await p.click('[data-tab=salute]'); await p.click(`[data-act=sez-salute][data-sez=${k}]`); await p.waitForTimeout(150); };
  // vaccini: segna esavalente 1 fatto
  await sez('vaccini'); await shot('s_vaccini.png');
  await p.click('[data-act=apri-check][data-k=esa1]'); await p.fill('input[name=fatto]', '2024-05-15'); await p.fill('input[name=prodotto]', 'Hexyon lotto A1'); await p.click('button[value=ok]'); await p.waitForTimeout(150);
  console.log('esa1:', await p.locator('[data-k=esa1] .chip').textContent());
  // bilanci: visita bilancio nella finestra -> fatto da solo
  await p.evaluate(async () => { S.visite.push({ id: 'vb', tipo: 'bilancio', data: '2024-04-05', ora: '10:00', stato: 'fatta', medico: PEDIATRA.nome, updatedAt: Date.now() }); await salva(false); });
  await sez('bilanci'); console.log('bil1:', await p.locator('[data-k=bil1] .chip').textContent());
  // screening
  await sez('screening'); await p.click('[data-k=scr_anche]'); await p.selectOption('select[name=esito]', 'normale'); await p.fill('input[name=fatto]', '2024-05-02'); await p.click('button[value=ok]');
  // farmaci: dose abituale con intervallo 6h, poi dose troppo presto
  await sez('farmaci'); await p.click('[data-act=farmaci-abituali]');
  await p.fill('input[name=nome]', 'Tachipirina gocce'); await p.fill('input[name=dose]', '2,5 ml'); await p.fill('input[name=intervalloOre]', '6'); await p.fill('input[name=maxGiorno]', '4');
  await p.click('button[value=ok]'); await p.waitForTimeout(200); await p.click('button[value=annulla]');
  const ora = new Date(Date.now() - 2 * 36e5), q = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  await p.click('[data-act=nuova-dose] >> nth=0'); await p.fill('input[name=farmaco]', 'Tachipirina gocce'); await p.dispatchEvent('input[name=farmaco]', 'input');
  console.log('dose precompilata:', await p.inputValue('input[name=dose]')); await p.fill('input[name=quando]', q(ora)); await p.fill('input[name=chi]', 'Silvia'); await p.click('button[value=ok]'); await p.waitForTimeout(150);
  await p.click('[data-act=nuova-dose] >> nth=0'); await p.fill('input[name=farmaco]', 'Tachipirina gocce'); await p.dispatchEvent('input[name=farmaco]', 'input');
  console.log('avviso:', (await p.textContent('#avvisoDose')).replace(/\s+/g, ' ')); await p.click('button[value=annulla]');
  await shot('s_farmaci.png');
  // febbre
  await sez('febbre');
  for (const [h, t, sint] of [[30, '37,8', []], [20, '38,6', ['tosse']], [8, '39,1', ['tosse', 'raffreddore']], [1, '37,9', []]]) {
    await p.click('[data-act=nuova-febbre] >> nth=0'); await p.fill('input[name=quando]', q(new Date(Date.now() - h * 36e5))); await p.fill('input[name=temp]', t);
    for (const s of sint) await p.check(`input[name=sintomi][value="${s}"]`);
    await p.click('button[value=ok]'); await p.waitForTimeout(100);
  }
  await shot('s_febbre.png');
  // tappe
  await sez('tappe'); await p.click('[data-act=apri-tappa][data-k=sorriso]'); await p.fill('input[name=data]', '2024-05-01'); await p.fill('textarea[name=note]', 'Alla mamma!');
  await p.setInputFiles('#inFile', 'referto.jpg'); await p.waitForTimeout(300); await p.click('button[value=ok]'); await p.waitForTimeout(200); await shot('s_tappe.png');
  // domande
  await p.click('[data-tab=visite]'); await p.fill('#nuovaDomanda', 'Quanta vitamina D dare?'); await p.click('[data-act=aggiungi-domanda]'); await p.waitForTimeout(150);
  await p.fill('#nuovaDomanda', 'Quando iniziare lo svezzamento?'); await p.press('#nuovaDomanda', 'Enter'); await p.waitForTimeout(150);
  console.log('domande:', await p.evaluate(() => domandeAperte().map(d => d.testo).join(' | ')));
  await shot('s_visite.png');
  // spese con scontrino
  await p.click('[data-tab=documenti]'); await p.click('[data-act=doc-ambito][data-amb=spese]'); await p.click('#fab'); await p.setInputFiles('#inFile', 'scontrino.jpg');
  await p.waitForFunction(() => /Importo|non riuscito/.test(document.querySelector('#boxAnalisi')?.textContent || ''), null, { timeout: 60000 });
  console.log('spesa:', (await p.textContent('#boxAnalisi')).replace(/\s+/g, ' '), '|', await p.inputValue('input[name=importo]'), await p.inputValue('input[name=data]'), await p.inputValue('select[name=tipo]'));
  await p.click('button[value=ok]'); await p.waitForTimeout(200); await shot('s_spese.png');
  // home
  await p.click('[data-tab=home]'); await shot('s_home.png');
  // emergenze
  await p.click('[data-act=emergenza]'); await shot('s_emergenza.png');
  await p.click('[data-act=emergenza-pdf]'); await p.waitForTimeout(1500); console.log('pdf emergenze nel visualizzatore:', await p.evaluate(() => document.querySelector('#viewer').open)); await p.evaluate(() => { document.querySelector('#viewer').close(); document.querySelector('#sheet').close(); });
  // riepilogo
  await p.click('[data-act=riepilogo]'); await p.click('#btnCreaRiep');
  await p.waitForFunction(() => /PDF pronto|Non sono riuscito/.test(document.querySelector('#boxRiepilogo').textContent), null, { timeout: 60000 });
  console.log('riepilogo:', (await p.textContent('#boxRiepilogo')).replace(/\s+/g, ' ').slice(0, 120));
  { const b64 = await p.evaluate(async () => { const a = new Uint8Array(await ultimoRiepilogo.arrayBuffer()); let s = ''; for (const x of a) s += String.fromCharCode(x); return btoa(s); }); require('fs').writeFileSync('riep2.pdf', Buffer.from(b64, 'base64')); }
  console.log('errori:', errs); await b.close();
})();
