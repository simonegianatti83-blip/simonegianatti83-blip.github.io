// Esplorazione automatica: ogni sezione, ogni pulsante, ogni modulo (apri e salva) -> raccoglie errori
const { chromium, devices } = require('playwright');
const ESCLUSI = new Set(['scollega', 'cambia-cid', 'esporta', 'importa', 'link-silvia', 'sync', 'collega', 'salva-cid', 'condividi-silvia', 'spese-csv',
  'emergenza-pdf', 'emergenza-testo', 'condividi-visita', 'condividi-doc', 'condividi-doc-pronto', 'condividi-riepilogo', 'riepilogo-drive', 'apri-file', 'scatta', 'scegli',
  'scatta-nuovo', 'pdf-nuovo', 'importa-cal', 'chiudi-installa', 'poppata-annulla']);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true });
  await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  const p = await ctx.newPage();
  const errori = []; let dove = '';
  p.on('pageerror', e => errori.push(`[${dove}] ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errori.push(`[${dove}] console: ${m.text()}`); });
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(500);
  // dati realistici
  await p.evaluate(async () => {
    ls.set('noBannerInstalla', true); ls.set('mioNome', 'Simone');
    Object.assign(S.profilo, { nascita: '2026-11-22', cf: 'RSSGLE26S22I829P', allergie: 'Nessuna nota', genitori: 'Simone 333 1, Silvia 333 2', updatedAt: Date.now() });
    const o = oggiISO(), ie = oggiISO(new Date(Date.now() - 864e5)), dom = oggiISO(new Date(Date.now() + 864e5));
    S.visite.push({ id: 'v1', tipo: 'pediatra', data: dom, ora: '10:00', durata: 30, stato: 'programmata', luogo: LUOGHI[0], medico: PEDIATRA.nome, motivo: 'Controllo', updatedAt: 1 },
      { id: 'v2', tipo: 'bilancio', data: ie, ora: '15:30', durata: 30, stato: 'fatta', medico: PEDIATRA.nome, updatedAt: 1 });
    S.documenti.push({ id: 'd1', titolo: 'Esami del sangue', categoria: 'esami', data: ie, files: [], analisi: { esami: [{ nome: 'Hb', valore: '10', unita: 'g/dL', rif: '11-14', fuori: true }] }, updatedAt: 1 },
      { id: 'd2', ambito: 'personale', titolo: 'Tessera sanitaria', categoria: 'tessera', numero: 'X', scadenza: '2032-11-22', files: [], updatedAt: 1 });
    S.misure.push({ id: 'm1', data: '2026-11-22', peso: 3.4, lunghezza: 50, testa: 34.5, updatedAt: 1 });
    S.pasti.push({ id: 'p1', quando: o + 'T08:00', fine: o + 'T08:20', seno: 'sx', minuti: 20, minSx: 20, ml: 30, latte: 'artificiale', updatedAt: 1 });
    S.pannolini.push({ id: 'n1', quando: o + 'T08:30', pipi: true, cacca: true, colore: 'senape', updatedAt: 1 });
    S.dosi.push({ id: 'ds1', farmaco: 'Vitamina D', dose: '1 gtt', quando: o + 'T09:00', chi: 'Silvia', updatedAt: 1 });
    S.farmaci.push({ id: 'f1', nome: 'Tachipirina gocce', dose: '2 ml', intervalloOre: 6, maxGiorno: 4, updatedAt: 1 });
    S.diario.push({ id: 'di1', quando: o + 'T07:00', temp: 37.4, sintomi: ['raffreddore'], updatedAt: 1 });
    S.tappe.push({ id: 't1', chiave: 'sorriso', titolo: 'Primo sorriso', data: o, files: [], updatedAt: 1 });
    S.domande.push({ id: 'q1', testo: 'Vitamina D fino a quando?', fatta: false, updatedAt: 1 });
    S.spese.push({ id: 's1', data: o, importo: 12.5, tipo: 'farmaci', descrizione: 'Vitamina D', tracciabile: true, files: [], updatedAt: 1 });
    S.chiusure.push({ id: 'c1', da: '2026-12-28', a: '2026-12-31', motivo: 'Ferie', updatedAt: 1 });
    S.check.push({ id: 'scr_udito', esito: 'normale', fatto: '2026-11-23', tipo: 'screening', updatedAt: 1 });
    await salva(false);
  });
  const viste = [];
  for (const t of ['home', 'visite', 'pediatra', 'impostazioni']) viste.push({ nome: t, vai: async () => { await p.evaluate(x => vai(x), t); } });
  for (const s of ['pasti', 'crescita', 'vaccini', 'bilanci', 'screening', 'farmaci', 'febbre', 'tappe']) viste.push({ nome: 'salute/' + s, vai: async () => { await p.evaluate(x => { sezSalute = x; vai('salute'); }, s); } });
  for (const a of ['sanitari', 'personali', 'spese']) viste.push({ nome: 'documenti/' + a, vai: async () => { await p.evaluate(x => { filtroDoc.ambito = x; vai('documenti'); }, a); } });
  const provati = new Set(); let moduliSalvati = 0, moduliErrore = [];
  for (const v of viste) {
    dove = v.nome; await v.vai(); await p.waitForTimeout(80);
    const azioni = await p.evaluate(() => [...document.querySelectorAll('#vista [data-act]')].map((el, i) => ({ i, act: el.dataset.act, sel: el.dataset.id || el.dataset.k || el.dataset.tab || el.dataset.sez || el.dataset.tipo || el.dataset.amb || el.dataset.seno || el.dataset.ind || '' })));
    for (const a of azioni) {
      const chiave = a.act + ':' + a.sel; if (ESCLUSI.has(a.act) || provati.has(chiave)) continue; provati.add(chiave);
      dove = `${v.nome} → ${a.act}${a.sel ? '(' + a.sel + ')' : ''}`;
      await v.vai(); await p.waitForTimeout(40);
      const el = p.locator('#vista [data-act]').nth(a.i);
      /* dopo i salvataggi l'elenco può cambiare: se il pulsante non c'è più si salta */
      try { await el.evaluate(x => x.click(), undefined, { timeout: 3000 }); } catch (e) { continue; }
      await p.waitForTimeout(120);
      const aperto = await p.evaluate(() => document.querySelector('#sheet').open);
      if (aperto) {
        // prova i pulsanti interni non distruttivi del foglio
        const interni = await p.evaluate(() => [...document.querySelectorAll('#sheet [data-act]')].map(x => x.dataset.act).filter(x => !/elimina|togli|condividi|scatta|scegli|apri-file|emergenza-pdf|emergenza-testo|riepilogo-drive|analizza|passa-personale|profilo|tab|nuova-|nuovo-|doc-per/.test(x)));
        for (const ia of [...new Set(interni)]) { dove = `${v.nome} → ${a.act} → ${ia}`; try { await p.evaluate(x => document.querySelector(`#sheet [data-act="${x}"]`).click(), ia); await p.waitForTimeout(60); } catch (e) {} if (!(await p.evaluate(() => document.querySelector('#sheet').open))) break; }
        dove = `${v.nome} → ${a.act} → Salva`;
        if (await p.evaluate(() => document.querySelector('#sheet').open)) {
          const haSalva = await p.locator('#sheet button[value=ok]').count();
          if (haSalva) {
            await p.evaluate(() => document.querySelector('#sheet button[value=ok]').click()); await p.waitForTimeout(250);
            const ancora = await p.evaluate(() => document.querySelector('#sheet').open);
            const msg = ancora ? await p.evaluate(() => document.querySelector('#sheetErrore')?.textContent || document.querySelector('#boxRiepilogo')?.textContent || '') : '';
            if (ancora && msg) moduliErrore.push(`${dove}: ${msg.trim().slice(0, 90)}`); else if (!ancora) moduliSalvati++;
          }
          await p.evaluate(() => { const s = document.querySelector('#sheet'); if (s.open) s.close(); });
        }
      }
    }
  }
  console.log('azioni provate:', provati.size, '| moduli salvati:', moduliSalvati);
  console.log('moduli che chiedono dati (normale se manca un campo obbligatorio):\n  ' + moduliErrore.join('\n  '));
  console.log('ERRORI:', errori.length ? '\n  ' + [...new Set(errori)].join('\n  ') : 'nessuno');
  await b.close();
})();
