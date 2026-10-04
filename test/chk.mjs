import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage({ viewport:{width:900,height:600} });
  const bad = [];
  p.on('pageerror', e => bad.push('PAGEERROR ' + e.message));
  p.on('response', r => { if (r.status() >= 400) bad.push('HTTP ' + r.status() + ' ' + r.url().slice(0,80)); });
  const t0 = Date.now();
  await p.goto(url, { waitUntil:'load', timeout:30000 });
  await p.waitForFunction(()=>!document.getElementById('load'), null, { timeout:180000 });
  const d = await p.evaluate(()=>{
    const c = window.city, n = {};
    for (const g of c.data.greens) n[g.t] = (n[g.t]||0)+1;
    return { city:c.cityId, 건물:c.groups.buildings.count, 나무:c.groups.trees.count,
             피복레이어:c.groups.greens.children.length, 피복폴리곤:n, err:c.data && window.__err };
  });
  console.log(url.replace('http://localhost:8747',''), '=>', ((Date.now()-t0)/1000).toFixed(1)+'초', JSON.stringify(d));
  if (bad.length) console.log('  문제:', [...new Set(bad)].slice(0,5).join(' | '));
} catch (e) { console.log(url, '실패:', e.message.split('\n')[0]); }
finally { await b.close(); }
