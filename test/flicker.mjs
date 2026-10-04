// 카메라를 아주 조금만 움직여 두 프레임을 찍고, 달라지는 픽셀을 모아 z-fighting 위치를 찾는다.
import { chromium } from 'playwright';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.bin':'application/octet-stream' };
const server = createServer(async (req,res)=>{ const f=resolve(root,decodeURIComponent(req.url.split('?')[0]).slice(1));
  try{ const b=await readFile(f); res.writeHead(200,{'Content-Type':MIME[extname(f)]??'application/octet-stream'}); res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,r));
const PORT = server.address().port;

const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport:{width:1440,height:900} });
  await page.goto(`http://localhost:${PORT}/index.html?city=jeju`, { waitUntil:'load', timeout:120000 });
  await page.waitForFunction(()=>!document.getElementById('load'), null, { timeout:240000 });
  await page.evaluate(`document.querySelectorAll('#panel,#place,#tools,#hint,#time,#info-btn,#title,#labels,#note,#fps').forEach(e=>e.style.display='none')`);

  console.log(JSON.stringify(await page.evaluate(() => {
    const c = window.city;
    const lv = [...c.waterLevel.values()];
    const near0 = lv.filter(v => v < 4).length;
    return {
      waterPolys: lv.length, 수면0m근처: near0,
      수면고도분포: [0,1,2,5,20,100].map(t => t + 'm+:' + lv.filter(v => v >= t).length),
      near: c.camera.near, far: Math.round(c.camera.far),
      해수면y: c.groups.water.children.at(-1)?.position.y,
      내수면lift: 3,
    };
  })));

  const shot = async (d) => {
    await page.evaluate(`city.placeCamera(126.545,33.335,${58000 + d},0.28,0.18)`);
    await page.waitForTimeout(1200);
    return page.screenshot();
  };
  const [a, b] = [await shot(0), await shot(6)];   // 6m만 당긴다 — 형상은 사실상 그대로
  const { writeFileSync } = await import('fs');
  writeFileSync(resolve(__dirname,'flick-a.png'), a);
  writeFileSync(resolve(__dirname,'flick-b.png'), b);
  console.log('frames saved');
} finally { await browser.close(); server.close(); }
