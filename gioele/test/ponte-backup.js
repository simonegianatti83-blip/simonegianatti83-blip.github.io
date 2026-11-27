// Collegamento sempre attivo (ponte Apps Script simulato) + backup automatico settimanale
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
  const b = await chromium.launch(); const errs = [];
  const apri = async (email, conPonte) => {
    const c = await b.newContext({ ...devices['iPhone 13'] });
    await c.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: `window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,revoke(){},initTokenClient(o){return{requestAccessToken(){setTimeout(()=>o.callback({access_token:'tok',expires_in:3600}),10)}}}}}}` }));
    await c.route(/googleapis\.com/, r => { const q = r.request(); const x = google(email, q.method(), q.url(), q.postDataBuffer() || Buffer.alloc(0)); r.fulfill({ status: x.status, contentType: x.type, body: x.body }); });
    // finto Apps Script: controlla la chiave e inoltra a "Google" come Simone
    await c.route('https://script.google.com/macros/s/PONTE/exec', r => {
      const req = JSON.parse(r.request().postData());
      if (req.chiave !== 'CHIAVE-OK') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ errore: 'chiave non valida' }) });
      const x = google('ponte(simone)', req.metodo, req.url, Buffer.from(req.corpo || '', 'base64'));
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ stato: x.status, tipo: x.type, corpo: x.body.toString('base64') }) });
    });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(email + ' ' + e.message)); p.on('dialog', d => d.accept()); return p;
  };
  // 1) Simone collega Google normalmente: viene creato l'archivio e il primo backup
  const p1 = await apri('simone@x.it');
  await p1.goto('http://localhost:8765/gioele/#cid=123-abc.apps.googleusercontent.com'); await p1.waitForTimeout(300);
  await p1.evaluate(async () => { ls.set('noBannerInstalla', true); S.profilo.nascita = '2026-11-22'; await salva(false); });
  await p1.click('[data-act=collega]'); await p1.waitForTimeout(2000);
  const backup = () => Object.values(drive.files).filter(f => (f.name || '').startsWith('gioele-backup-') && !f.trashed).map(f => f.name);
  console.log('1) backup dopo il collegamento:', backup());
  await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(1500);
  console.log('   seconda sincronizzazione (nessun nuovo backup):', backup().length);
  // 2) l'accesso scade: senza ponte la sincronizzazione si ferma
  await p1.evaluate(() => { G.token = null; ls.del('tok'); }); await p1.evaluate(() => sincronizza(false)); await p1.waitForTimeout(600);
  console.log('2) token scaduto, stato:', await p1.evaluate(() => SY.stato));
  // 3) attiva il collegamento sempre attivo
  await p1.evaluate(() => vai('impostazioni')); await p1.click('[data-act=ponte-prepara]'); await p1.waitForTimeout(200);
  console.log('3) codice generato con cartella e calendario:', await p1.evaluate(() => { const c = document.querySelector('#ponteCodice textarea').value; return c.includes(S.config.folderId) && c.includes(S.config.calendarId); }));
  await p1.evaluate(() => ls.set('ponteChiave', 'CHIAVE-OK'));
  await p1.fill('#inPonteUrl', 'https://script.google.com/macros/s/PONTE/exec'); await p1.click('[data-act=ponte-attiva]'); await p1.waitForTimeout(2000);
  console.log('   attivato:', await p1.locator('.toast').textContent(), '| stato:', await p1.evaluate(() => SY.stato));
  const n0 = log.filter(l => l.startsWith('ponte')).length;
  await p1.evaluate(async () => { S.pasti.push({ id: 'pp1', quando: oggiISO() + 'T10:00', fine: oggiISO() + 'T10:20', seno: 'sx', minuti: 20, minSx: 20, updatedAt: Date.now() }); await salva(); }); await p1.waitForTimeout(2500);
  console.log('   pasto salvato passando dal ponte (senza token):', log.filter(l => l.startsWith('ponte')).length - n0 > 0, '| eventi pasto nel calendario:', Object.values(cal.events).filter(e => e.extendedProperties?.private?.gioele === 'pasto').length, '| token:', await p1.evaluate(() => G.token));
  // 4) Silvia apre il link con il ponte
  const link = await p1.evaluate(() => linkPonte());
  const p2 = await apri('silvia@x.it'); await p2.goto('http://localhost:8765/gioele/' + link.slice(link.indexOf('#'))); await p2.waitForTimeout(2500);
  console.log('4) Silvia con il link: stato', await p2.evaluate(() => SY.stato), '| vede il pasto:', await p2.evaluate(() => attivi('pasti').length), '| hash ripulito:', await p2.evaluate(() => location.hash === ''));
  // 5) chiave sbagliata
  await p2.evaluate(() => ls.set('ponte', { url: 'https://script.google.com/macros/s/PONTE/exec', chiave: 'SBAGLIATA' })); await p2.evaluate(() => sincronizza(false)); await p2.waitForTimeout(800);
  console.log('5) chiave sbagliata:', await p2.evaluate(() => SY.stato + ' – ' + SY.errore));
  console.log('errori:', errs, log.filter(l => l.includes('non simulato')));
  await b.close();
})();
