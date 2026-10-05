import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8747/?city=korea');await page.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:90000});
 await page.route('**/korea.rail.json',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.click('[data-a=rail]');await page.waitForFunction(()=>document.querySelector('#rail-status').textContent.includes('못했습니다'));
 assert(!(await page.locator('[data-a=rail]').isDisabled()));assert(await page.evaluate(()=>!city.rail.enabled));
 await page.unroute('**/korea.rail.json');
 let release,started;const gate=new Promise(r=>release=r),start=new Promise(r=>started=r);
 await page.route('**/korea.rail.json',async r=>{started();await gate;await r.continue();});
 await page.click('[data-a=rail]');await start;await page.click('#rail-close');release();
 await page.waitForFunction(()=>!document.querySelector('[data-a=rail]').disabled);
 assert(await page.evaluate(()=>!city.rail.enabled&&!city.rail.playing&&document.getElementById('rail-panel').hidden));
 await page.unroute('**/korea.rail.json');await page.click('[data-a=rail]');await page.waitForFunction(()=>city.rail.enabled);
 assert(await page.evaluate(()=>city.rail.active.length>0));assert.deepEqual(errors,[]);
 console.log('PASS: failed load retry and close during loading do not resurrect the rail layer');
}finally{await browser.close();}
