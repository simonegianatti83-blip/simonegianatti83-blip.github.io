// Visite dell'ostetrica a domicilio e del consultorio: modulo, elenco medici, riepilogo PDF
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13'], hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(400);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-11-22'; await salva(false); vai('visite'); });
  await p.tap('[data-act=nuova-visita-ost]');
  console.log('tipo:', await p.inputValue('select[name=tipo]'), '| luogo:', await p.inputValue('input[name=luogo]'), '| medico:', await p.inputValue('input[name=medico]'));
  const medici = await p.$$eval('#dlMedici option', o => o.map(x => x.value));
  console.log('elenco medici con ostetrica:', medici.includes('Ostetrica'));
  await p.fill('input[name=motivo]', 'Controllo peso e allattamento'); await p.fill('textarea[name=esito]', 'Peso ok, attacco al seno corretto');
  await p.tap('button[value=ok]'); await p.waitForTimeout(300);
  console.log('foglio chiuso:', !(await p.evaluate(() => sheet.open)));
  // consultorio scegliendo dal menu del tipo
  await p.evaluate(() => formVisita());
  await p.selectOption('select[name=tipo]', 'consultorio');
  console.log('consultorio luogo:', await p.inputValue('input[name=luogo]'), '| medico:', JSON.stringify(await p.inputValue('input[name=medico]')));
  await p.fill('input[name=motivo]', 'Corso massaggio neonatale'); await p.tap('button[value=ok]'); await p.waitForTimeout(300);
  console.log('elenco visite:', (await p.textContent('#vista')).includes('Ostetrica a domicilio'));
  console.log('dal calendario:', await p.evaluate(() => [tipoDaTesto('Ostetrica a casa'), tipoDaTesto('Consultorio Sondrio'), tipoDaTesto('Visita Lopez')].join(',')));
  const r = await p.evaluate(async () => { const R = datiRiepilogo('2026-11-01'); const x = await creaRiepilogoPdf({ da: '2026-11-01', allegati: false, note: '' }); return { n: R.nascita.length, ok: !!x }; });
  console.log('riepilogo: voci ostetrica/consultorio ' + r.n + ', PDF pronto: ' + r.ok);
  console.log('errori:', errs); await b.close();
})();
