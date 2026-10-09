import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try {
  const page = await browser.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(new URL(request.url())));
  // Simulate the stale unversioned module that caused the user's startup failure.
  await page.route('**/landmarks.js', route => route.fulfill({
    contentType:'text/javascript', body:'export const landmarksOf = () => [];'
  }));
  await page.goto('http://127.0.0.1:8747/?city=seoul');
  await page.waitForFunction(() => window.city?.landmarks?.length === 31 && !document.querySelector('#load'), null, {timeout:150000});
  for (const name of ['app','landmarks','seoul-landmarks','miniature','city-life','neighborhood-labels','map-export']) {
    const urls = requests.filter(url => url.pathname === `/${name}.js`);
    assert(urls.length, `${name} must load`);
    assert(urls.every(url => url.searchParams.get('v') === '20261009-terminal2'), `${name} must bypass stale cache`);
  }
  assert.deepEqual(errors, []);
  const broken = await browser.newPage();
  await broken.route('**/app.js?*', route => route.fulfill({contentType:'text/javascript',body:'export const stale = true;'}));
  await broken.goto('http://127.0.0.1:8747/?city=seoul');
  await broken.waitForFunction(() => document.querySelector('#load-msg')?.textContent.includes('새로고침'));
  console.log('PASS: stale module bypass, 31 landmarks, no console errors, startup failure message');
} finally {
  await browser.close();
}
