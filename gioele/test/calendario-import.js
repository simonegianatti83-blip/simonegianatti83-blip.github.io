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
    if (path.match(/\/events$/) && m === 'GET') { const f = u.searchParams.get('privateExtendedProperty'); const [k, v] = (f || '=').split('='); return j({ items: Object.entries(cal.events).filter(([, e]) => (!f || e.extendedProperties?.private?.[k] === v) && (u.searchParams.get('showDeleted') === 'true' || e.status !== 'cancelled')).map(([id, e]) => ({ id, ...e })) }); }
    if (path.match(/\/events$/) && m === 'POST') { const id = 'E' + (++cal.n); cal.events[id] = { ...JSON.parse(req.postData()), updated: new Date().toISOString(), status: 'confirmed' }; return j({ id, updated: cal.events[id].updated }); }
    if ((mm = path.match(/\/events\/(\w+)$/))) { if (m === 'DELETE') { cal.events[mm[1]].status = 'cancelled'; cal.events[mm[1]].updated = new Date().toISOString(); return r.fulfill({ status: 204 }); } cal.events[mm[1]] = { ...(m === 'PATCH' ? cal.events[mm[1]] : {}), ...JSON.parse(req.postData()), updated: new Date().toISOString(), status: 'confirmed' }; return j({ id: mm[1], updated: cal.events[mm[1]].updated }); }
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
  const dom = new Date(Date.now() + 864e5), ds = d => d.toISOString().slice(0, 10);
  const fra60 = new Date(Date.now() + 60 * 864e5);
  // eventi inseriti a mano nel calendario Gioele
  cal.events['U1'] = { summary: 'Visita oculistica Gioele', location: 'Ospedale di Sondrio', start: { dateTime: ds(dom) + 'T10:00:00+01:00' }, end: { dateTime: ds(dom) + 'T10:30:00+01:00' }, updated: '2026-11-26T08:00:00Z', status: 'confirmed' };
  cal.events['U2'] = { summary: 'Vaccino esavalente', start: { date: ds(fra60) }, end: { date: ds(fra60) }, updated: '2026-11-26T08:00:00Z', status: 'confirmed' };
  cal.events['U3'] = { summary: '💊 Vitamina D a Gioele', recurrence: ['RRULE:FREQ=DAILY'], start: { dateTime: '2026-11-26T09:00:00+01:00' }, end: { dateTime: '2026-11-26T09:05:00+01:00' }, updated: '2026-11-26T08:00:00Z', status: 'confirmed' };
  await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(2000);
  const vis = () => p1.evaluate(() => visiteAttive().map(v => `${v.tipo}|${v.data}|${v.ora || '—'}|${v.motivo}|${v.luogo || ''}|${v.stato}`));
  console.log('dopo la 1a sinc.:', await vis());
  await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(2000);
  console.log('2a sinc. (niente doppioni):', (await vis()).length, 'visite; titolo evento U1:', cal.events['U1'].summary, '| U2 cancellato?', cal.events['U2'].status);
  // l'app crea una sua visita: non deve rientrare come importata
  await p1.evaluate(async (d) => { S.visite.push({ id: 'va', tipo: 'pediatra', data: d, ora: '16:00', durata: 30, stato: 'programmata', medico: PEDIATRA.nome, updatedAt: Date.now() }); await salva(); }, ds(fra60));
  await p1.waitForTimeout(2500); await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(2000);
  console.log('dopo visita creata nell\'app:', (await vis()).length, 'visite');
  // spostata nel calendario alle 11:00
  Object.assign(cal.events['U1'], { start: { dateTime: ds(dom) + 'T11:00:00+01:00' }, end: { dateTime: ds(dom) + 'T11:45:00+01:00' }, updated: new Date(Date.now() + 5000).toISOString() });
  await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(2000);
  console.log('dopo spostamento nel calendario:', (await vis()).filter(x => x.includes('oculistica')), '| titolo evento:', cal.events['U1'].summary);
  // cancellata nel calendario
  Object.assign(cal.events['U1'], { status: 'cancelled', updated: new Date(Date.now() + 9000).toISOString() });
  await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(2000);
  console.log('dopo cancellazione:', (await vis()).filter(x => x.includes('oculistica')));
  console.log('Silvia vede:', 'silvia');
  console.log('errori:', errs, log.filter(l => l.includes('unmocked')));
  await b.close();
})();
