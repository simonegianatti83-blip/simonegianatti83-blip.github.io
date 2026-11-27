const { chromium, devices } = require('playwright');
const drive = { files: {}, n: 0 }, cal = { events: {}, acl: [], n: 0 }; const log = [];
async function mock(ctx, email) {
  await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: `window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,revoke(){},initTokenClient(o){return{requestAccessToken(){setTimeout(()=>o.callback({access_token:'tok',expires_in:3600}),10)}}}}}}` }));
  await ctx.route(/googleapis\.com/, async r => {
    const req = r.request(), u = new URL(req.url()), m = req.method(), path = u.pathname;
    log.push(email + ' ' + m + ' ' + path);
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (path === '/oauth2/v3/userinfo') return j({ email });
    if (path === '/drive/v3/files' && m === 'GET') { const q = u.searchParams.get('q'); return j({ files: Object.values(drive.files).filter(f => q.includes(f.name) && f.acc[email]).map(f => ({ id: f.id, name: f.name })) }); }
    if (path === '/drive/v3/files' && m === 'POST') { const b = JSON.parse(req.postData()); const id = 'F' + (++drive.n); const par = drive.files[b.parents?.[0]]; drive.files[id] = { id, ...b, acc: par ? par.acc : { [email]: 'owner' } }; return j({ id }); }
    if (path.startsWith('/upload/drive/v3/files')) {
      const body = req.postDataBuffer().toString('latin1'); const parts = body.split(/--[-\w]+/).filter(x => x.includes('Content-Disposition'));
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].trim()); const content = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      if (m === 'POST') { const id = 'F' + (++drive.n); const par = drive.files[meta.parents?.[0]]; drive.files[id] = { id, ...meta, content, acc: par ? par.acc : { [email]: 'owner' } }; return j({ id }); }
      const id = path.split('/').pop(); if (drive.files[id].acc[email] === 'reader') return j({ error: { message: 'forbidden' } }, 403); drive.files[id].content = content; return j({ id });
    }
    let mm;
    if ((mm = path.match(/^\/drive\/v3\/files\/(\w+)\/permissions$/))) {
      if (m === 'POST') { const b = JSON.parse(req.postData()); drive.files[mm[1]].acc[b.emailAddress] = b.role; return j({}); }
      return j({ permissions: Object.entries(drive.files[mm[1]].acc).map(([e, role]) => ({ emailAddress: e, role })) });
    }
    if ((mm = path.match(/^\/drive\/v3\/files\/(\w+)$/))) { const f = drive.files[mm[1]]; if (!f || !f.acc[email]) return j({ error: { message: 'not found' } }, 404);
      if (u.searchParams.get('alt') === 'media') return r.fulfill({ status: 200, contentType: f.mimeType || 'application/octet-stream', body: f.content });
      if ((u.searchParams.get('fields') || '').includes('capabilities')) return j({ capabilities: { canEdit: f.acc[email] !== 'reader' } });
      return j({ id: f.id, trashed: false }); }
    if (path === '/calendar/v3/calendars' && m === 'POST') return j({ id: 'cal1@group' });
    if (path.includes('/acl')) { cal.acl.push(JSON.parse(req.postData())); return j({}); }
    if (path.includes('/calendarList')) return j({});
    if (path.match(/\/events$/) && m === 'POST') { const id = 'E' + (++cal.n); cal.events[id] = JSON.parse(req.postData()); return j({ id }); }
    if ((mm = path.match(/\/events\/(\w+)$/))) { if (m === 'DELETE') { delete cal.events[mm[1]]; return r.fulfill({ status: 204 }); } cal.events[mm[1]] = JSON.parse(req.postData()); return j({ id: mm[1] }); }
    return j({ error: { message: 'unmocked ' + path } }, 500);
  });
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const apri = async (email) => { const c = await b.newContext({ ...devices['iPhone 13'] }); await mock(c, email); const p = await c.newPage(); p.on('pageerror', e => errs.push(email + ' ' + e.message)); p.on('dialog', d => d.accept()); return p; };
  const p1 = await apri('simone@x.it');
  await p1.goto('http://localhost:8765/gioele/#cid=123-abc.apps.googleusercontent.com'); await p1.waitForTimeout(300);
  await p1.evaluate(async () => { ls.set('noBannerInstalla', true); Object.assign(S.profilo, { nascita: '2026-11-22', updatedAt: Date.now() }); await salva(false); });
  await p1.click('[data-act=collega]'); await p1.waitForTimeout(1500);
  console.log('Simone:', await p1.textContent('#btnSync'));
  console.log('promemoria nel calendario:', Object.values(cal.events).map(e => e.summary + ' ' + e.start.date).join(' | '));
  // Simone registra misura e dose
  await p1.evaluate(async () => { S.misure.push({ id: 'm1', data: '2026-11-22', peso: 3.4, lunghezza: 50, testa: 34.5, updatedAt: Date.now() }); S.dosi.push({ id: 'd1', farmaco: 'Vitamina D', dose: '1 goccia', quando: oraLocale(), chi: 'Simone', updatedAt: Date.now() }); await salva(); });
  await p1.waitForTimeout(2500);
  // condivide con Silvia (modifica) e nonna (lettura)
  await p1.click('[data-tab=impostazioni]'); await p1.fill('#inEmailSilvia', 'silvia@x.it'); await p1.click('[data-act=condividi-silvia]'); await p1.waitForTimeout(600);
  await p1.fill('#inEmailSilvia', 'nonna@x.it'); await p1.selectOption('#inRuolo', 'reader'); await p1.click('[data-act=condividi-silvia]'); await p1.waitForTimeout(600);
  console.log('acl calendario:', cal.acl.map(a => a.scope.value + '=' + a.role).join(', '));
  // Silvia
  const p2 = await apri('silvia@x.it'); await p2.goto('http://localhost:8765/gioele/#cid=123-abc.apps.googleusercontent.com'); await p2.waitForTimeout(300);
  await p2.click('[data-act=collega]'); await p2.waitForTimeout(1500);
  console.log('Silvia vede:', JSON.stringify(await p2.evaluate(() => ({ misure: attivi('misure').length, dosi: attivi('dosi').map(d => d.farmaco + ' ' + d.chi), sola: soloLettura() }))));
  await p2.evaluate(async () => { S.diario.push({ id: 'f1', quando: oraLocale(), temp: 37.2, sintomi: [], updatedAt: Date.now() }); await salva(); }); await p2.waitForTimeout(2500);
  await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(1500);
  console.log('Simone vede la febbre di Silvia:', await p1.evaluate(() => attivi('diario').length));
  // Nonna
  const p3 = await apri('nonna@x.it'); await p3.goto('http://localhost:8765/gioele/#cid=123-abc.apps.googleusercontent.com'); await p3.waitForTimeout(300);
  await p3.click('[data-act=collega]'); await p3.waitForTimeout(1500);
  await p3.click('[data-tab=home]'); await p3.waitForTimeout(200);
  console.log('Nonna:', JSON.stringify(await p3.evaluate(() => ({ sola: soloLettura(), misure: attivi('misure').length, fab: !document.querySelector('#fab').classList.contains('hidden'), banner: /sola lettura/.test(document.body.textContent) }))));
  await p3.click('[data-act=nuova-dose]'); await p3.waitForTimeout(200);
  console.log('Nonna prova ad aggiungere: foglio aperto =', await p3.evaluate(() => document.querySelector('#sheet').open));
  await p3.screenshot({ path: 's_nonna.png' });
  const scritture = log.filter(l => l.startsWith('nonna') && (l.includes(' PATCH ') || l.includes(' POST ') || l.includes(' PUT ') || l.includes(' DELETE ')));
  console.log('scritture della nonna:', scritture.length ? scritture : 'nessuna');
  console.log('errori:', errs, log.filter(l => l.includes('unmocked')));
  await b.close();
})();
