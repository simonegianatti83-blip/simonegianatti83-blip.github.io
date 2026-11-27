// Rete instabile e foto su iPhone: un file che non parte non blocca la sincronizzazione; il token resta dopo la riapertura
const { chromium, devices } = require('playwright');
const drive = { files: {}, n: 0 }, cal = { events: {}, n: 0 }; const log = [];
function google(email, m, url, body) {   // finto Google Drive / Calendar: restituisce { status, type, body(Buffer) }
  const u = new URL(url), path = u.pathname;
  const j = (o, s = 200) => ({ status: s, type: 'application/json; charset=UTF-8', body: Buffer.from(JSON.stringify(o)) });
  log.push(`${email} ${m} ${path}`);
  if (path === '/oauth2/v3/userinfo') return j({ email });
  if (path === '/drive/v3/files' && m === 'GET') { const q = u.searchParams.get('q');
    return j({ files: Object.values(drive.files).filter(f => !f.trashed && (q.includes("name='gioele-dati.json'") ? f.name === 'gioele-dati.json' : q.includes('in parents') ? (f.parents || []).some(pp => q.includes(`'${pp}' in parents`)) && (!q.includes("name='") || q.includes(`name='${f.name}'`)) && (!q.includes('contains') || f.name.includes('gioele-backup-')) : false)).map(f => ({ id: f.id, name: f.name })) }); }
  if (path === '/drive/v3/files' && m === 'POST') { const b = JSON.parse(body.toString()); const id = 'F' + (++drive.n); drive.files[id] = { id, ...b }; return j({ id }); }
  if (path.startsWith('/upload/drive/v3/files')) {
    const t = body.toString('latin1'), parts = t.split(/--[-\w]+/).filter(x => x.includes('Content-Disposition'));
    const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].trim()), content = parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
    if (m === 'POST') { const id = 'F' + (++drive.n); drive.files[id] = { id, ...meta, content }; return j({ id }); }
    const id = path.split('/').pop(); drive.files[id].content = content; return j({ id });
  }
  let mm;
  if ((mm = path.match(/^\/drive\/v3\/files\/(\w+)\/permissions$/))) return j({ permissions: [] });
  if ((mm = path.match(/^\/drive\/v3\/files\/(\w+)$/))) { const f = drive.files[mm[1]]; if (!f) return j({ error: { message: 'not found' } }, 404);
    if (m === 'PATCH') { Object.assign(f, JSON.parse(body.toString())); return j({ id: f.id }); }
    if (u.searchParams.get('alt') === 'media') return { status: 200, type: 'application/octet-stream', body: Buffer.from(f.content, 'latin1') };
    if ((u.searchParams.get('fields') || '').includes('capabilities')) return j({ capabilities: { canEdit: true } });
    return j({ id: f.id, trashed: false }); }
  if (path === '/calendar/v3/calendars' && m === 'POST') return j({ id: 'cal1@group' });
  if (path.includes('/acl') || path.includes('/calendarList')) return j({});
  if (path.match(/\/instances$/)) return j({ items: [] });
  if (path.match(/\/events$/) && m === 'GET') return j({ items: Object.entries(cal.events).map(([id, e]) => ({ id, ...e })).filter(e => { const f = u.searchParams.get('privateExtendedProperty'); if (!f) return true; const [k, v] = f.split('='); return e.extendedProperties?.private?.[k] === v; }) });
  if (path.match(/\/events$/) && m === 'POST') { const id = 'E' + (++cal.n); cal.events[id] = { ...JSON.parse(body.toString()), updated: new Date().toISOString(), status: 'confirmed' }; return j({ id, updated: cal.events[id].updated }); }
  if ((mm = path.match(/\/events\/(\w+)$/))) { if (m === 'DELETE') { if (cal.events[mm[1]]) cal.events[mm[1]].status = 'cancelled'; return { status: 204, type: '', body: Buffer.alloc(0) }; }
    cal.events[mm[1]] = { ...(m === 'PATCH' ? cal.events[mm[1]] : {}), ...JSON.parse(body.toString()), updated: new Date().toISOString(), status: 'confirmed' }; return j({ id: mm[1], updated: cal.events[mm[1]].updated }); }
  return j({ error: { message: 'non simulato ' + path } }, 500);
}
(async () => {
  const b = await chromium.launch(); const errs = []; let rompi = 0;
  const c = await b.newContext({ ...devices['iPhone 13'] });
  await c.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: `window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,revoke(){},initTokenClient(o){return{requestAccessToken(){setTimeout(()=>o.callback({access_token:'tok',expires_in:3600}),10)}}}}}}` }));
  await c.route(/googleapis\.com/, r => { const q = r.request();
    if (rompi > 0 && q.url().includes('/upload/') && q.postDataBuffer()?.toString('latin1').includes('foto.jpg')) { rompi--; return r.abort('failed'); }
    const x = google('simone@x.it', q.method(), q.url(), q.postDataBuffer() || Buffer.alloc(0)); r.fulfill({ status: x.status, contentType: x.type, body: x.body }); });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/gioele/#cid=123-abc.apps.googleusercontent.com'); await p.waitForTimeout(300);
  await p.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-11-22'; await salva(false); });
  await p.click('[data-act=collega]'); await p.waitForTimeout(2000);
  // un documento con una foto, salvata come Blob alla vecchia maniera
  await p.evaluate(async () => {
    await idb('file', 'readwrite', s => s.put(new Blob(['FOTO-DI-PROVA'], { type: 'image/jpeg' }), 'fx1'));
    ls.del('fileConvertiti'); await convertiFileVecchi();
    S.documenti.push({ id: 'd1', titolo: 'Vaccinazioni', categoria: 'vaccini', data: '2026-11-25', files: [{ fid: 'fx1', nome: 'foto.jpg', mime: 'image/jpeg' }], updatedAt: Date.now() }); await salva(false);
  });
  console.log('vecchio file convertito:', await p.evaluate(async () => { const v = await idb('file', 'readonly', s => s.get('fx1')); return v.buf instanceof ArrayBuffer && (await (await fileGet('fx1')).text()); }));
  rompi = 2;   // la rete cade due volte di fila sul caricamento della foto
  await p.evaluate(() => sincronizza(true)); await p.waitForTimeout(4500);
  console.log('1) rete caduta, stato:', await p.evaluate(() => SY.stato), '| avviso:', await p.evaluate(() => SY.avvisoCal));
  console.log('   foto su Drive:', await p.evaluate(() => !!S.documenti.find(d => d.id === 'd1').files[0].driveId));
  rompi = 1;   // la rete cade una volta sola: il secondo tentativo riesce
  await p.evaluate(() => sincronizza(false)); await p.waitForTimeout(3500);
  console.log('2) dopo il nuovo tentativo, stato:', await p.evaluate(() => SY.stato), '| foto su Drive:', await p.evaluate(() => !!S.documenti.find(d => d.id === 'd1').files[0].driveId));
  console.log('   contenuto su Drive:', Object.values(drive.files).find(f => (f.name || '').endsWith('foto.jpg'))?.content);
  await p.reload(); await p.waitForTimeout(800);
  console.log('3) dopo la riapertura, accesso ancora valido:', await p.evaluate(() => tokenValido()), '| stato:', await p.evaluate(() => SY.stato));
  console.log('errori:', errs, log.filter(l => l.includes('non simulato')));
  await b.close();
})();
