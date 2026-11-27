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
    if ((mm = path.match(/\/events\/(\w+)\/instances$/))) { const ma = cal.events[mm[1]]; if (!ma) return j({ error: { message: 'not found' } }, 404); const items = [];
      for (let i = 2; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); const ymd = d.toISOString().slice(0, 10); const iid = mm[1] + '_' + ymd.replace(/-/g, '') + 'T080000Z'; const ov = cal.events[iid] || {};
        items.push({ id: iid, recurringEventId: mm[1], summary: ov.summary || ma.summary, reminders: ov.reminders || ma.reminders, originalStartTime: { dateTime: ymd + 'T09:00:00+01:00' }, start: { dateTime: ymd + 'T09:00:00+01:00' } }); }
      return j({ items }); }
    if (path.match(/\/events$/) && m === 'GET') { const f = u.searchParams.get('privateExtendedProperty'); const [k, v] = (f || '=').split('='); return j({ items: Object.entries(cal.events).filter(([, e]) => (!f || e.extendedProperties?.private?.[k] === v) && (u.searchParams.get('showDeleted') === 'true' || e.status !== 'cancelled')).map(([id, e]) => ({ id, ...e })) }); }
    if (path.match(/\/events$/) && m === 'POST') { const id = 'E' + (++cal.n); cal.events[id] = { ...JSON.parse(req.postData()), updated: new Date().toISOString(), status: 'confirmed' }; return j({ id, updated: cal.events[id].updated }); }
    if ((mm = path.match(/\/events\/(\w+)$/))) { if (m === 'DELETE') { cal.events[mm[1]].status = 'cancelled'; cal.events[mm[1]].updated = new Date().toISOString(); return r.fulfill({ status: 204 }); } cal.events[mm[1]] = { ...(m === 'PATCH' ? cal.events[mm[1]] : {}), ...JSON.parse(req.postData()), updated: new Date().toISOString(), status: 'confirmed', ...(mm[1].includes('_') ? { recurringEventId: mm[1].split('_')[0], start: { dateTime: '2026-01-01T09:00:00+01:00' } } : {}) }; return j({ id: mm[1], updated: cal.events[mm[1]].updated }); }
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
  cal.events['VITD'] = { summary: '💊 Vitamina D a Gioele', recurrence: ['RRULE:FREQ=DAILY'], start: { dateTime: '2026-11-26T09:00:00+01:00' }, end: { dateTime: '2026-11-26T09:05:00+01:00' }, reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] }, updated: '2026-11-26T08:00:00Z', status: 'confirmed' };
  const ist = async () => { const items = Object.entries(cal.events).filter(([k]) => k.startsWith('VITD_')).map(([k, e]) => `${k.slice(5, 13)}: ${e.summary} (notifiche ${e.reminders?.overrides?.length ?? '-'})`); return items.length ? items : ['nessuna modifica']; };
  await p1.click('[data-tab=home]'); await p1.waitForTimeout(200);
  await p1.click('[data-act=vitd-data]'); await p1.waitForTimeout(2800);
  console.log('1) vitamina D segnata:', await ist());
  console.log('   visite importate per errore:', await p1.evaluate(() => visiteAttive().length));
  // dose tolta nell'app -> torna promemoria
  await p1.evaluate(async () => { const d = attivi('dosi').find(x => /vitamina/i.test(x.farmaco)); d.deleted = true; d.updatedAt = Date.now(); await salva(); }); await p1.waitForTimeout(2800);
  console.log('2) dose tolta:', await ist());
  // seconda sincronizzazione: nessuna scrittura inutile
  const n0 = log.filter(l => l.includes('PATCH') && l.includes('VITD_')).length; await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(1500);
  console.log('3) modifiche in più alla sinc. successiva:', log.filter(l => l.includes('PATCH') && l.includes('VITD_')).length - n0);
  console.log('errori:', errs, log.filter(l => l.includes('unmocked')));
  await b.close();
})();
