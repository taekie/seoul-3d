// 떠 있는 개발 서버(8747)의 실제 페이지를 한 번 띄워 여러 컷을 찍는다.
// 사용: node test/screenshot.mjs '<query>' '<name>:<camJs>' '<name>:<camJs>' ...
import { chromium } from 'playwright';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { readFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const [query, ...shots] = process.argv.slice(2);

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
               '.css':'text/css', '.json':'application/json', '.bin':'application/octet-stream' };
const server = createServer(async (req, res) => {
  const f = resolve(root, decodeURIComponent(req.url.split('?')[0]).slice(1));
  try {
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;

const browser = await chromium.launch({
  args: process.env.CITY_TEST_GPU === 'metal'
    ? ['--use-gl=angle', '--use-angle=metal']
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push('ERR: ' + m.text()); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', r => logs.push('REQFAIL: ' + r.url().slice(0, 110)));

  await page.goto(`http://localhost:${PORT}/index.html${query}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('load'), null, { timeout: 240000 });
  await page.waitForTimeout(2500);

  console.log(JSON.stringify(await page.evaluate(() => {
    const c = window.city, T = c.terrain;
    let hi = -1e9; for (let i = 0; i < T.data.length; i += 17) if (T.data[i] > hi) hi = T.data[i];
    return { city: c.cityId, unit: c.unit, scale: +c.scale.toFixed(2), hRef: T.hRef,
             buildings: c.groups.buildings.count, trees: c.groups.trees.count,
             landmarks: c.groups.landmarks.children.length, demMax: Math.round(hi),
             tris: c.renderer.info.render.triangles, errors: window.__err };
  })));

  for (const spec of shots) {
    const i = spec.indexOf(':');
    const name = spec.slice(0, i), js = spec.slice(i + 1);
    if (js.trim()) await page.evaluate(js);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: resolve(__dirname, `${name}.png`), timeout: 120000, animations: 'disabled' });
    console.log('saved', name);
  }
  if (logs.length) console.log('--- console ---\n' + [...new Set(logs)].slice(0, 12).join('\n'));
} finally {
  await browser.close();
  server.close();
}
