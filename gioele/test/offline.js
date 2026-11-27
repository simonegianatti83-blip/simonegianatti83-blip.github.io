const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/gioele/'); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
  await p.reload(); await p.waitForTimeout(800);
  await p.goto('http://localhost:8765/gioele/privacy.html'); await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.goto('http://localhost:8765/gioele/'); await p.waitForTimeout(800);
  console.log('offline, apro l\'app → titolo:', await p.title(), '| sezioni:', await p.locator('nav.tabs button').count());
  await p.goto('http://localhost:8765/gioele/privacy.html'); await p.waitForTimeout(500);
  console.log('offline, pagina privacy → titolo:', await p.title());
  await ctx.setOffline(false);
  // rete lentissima: la pagina deve arrivare dalla copia salvata entro pochi secondi
  await ctx.route('**/gioele/', async r => { await new Promise(x => setTimeout(x, 15000)); r.continue(); });
  const t0 = Date.now(); await p.goto('http://localhost:8765/gioele/', { timeout: 30000 }); 
  console.log('rete lentissima: app aperta in', ((Date.now() - t0) / 1000).toFixed(1), 's, titolo:', await p.title());
  console.log('errori:', errs); await b.close();
})();
