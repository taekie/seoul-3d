import{chromium}from'playwright';import assert from'node:assert/strict';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});try{
 const p=await b.newPage();await p.goto('http://localhost:8747/?city=korea');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.querySelector('#load'),null,{timeout:90000});
 await p.route('**/korea.cropland.json',r=>r.fulfill({status:503,body:'Unavailable'}));await p.click('[data-a=cropland]');await p.waitForFunction(()=>document.querySelector('#crop-status').textContent.includes('못했습니다'));assert(!await p.locator('[data-a=cropland]').isDisabled());assert(await p.evaluate(()=>!city.cropland.enabled));await p.unroute('**/korea.cropland.json');
 let release,start;const gate=new Promise(r=>release=r),ready=new Promise(r=>start=r);await p.route('**/korea.cropland.json',async r=>{start();await gate;await r.continue();});
 await p.click('[data-a=cropland]');await ready;await p.click('#crop-close');release();await p.waitForFunction(()=>!document.querySelector('[data-a=cropland]').disabled);assert(await p.evaluate(()=>!city.cropland.enabled&&document.querySelector('#crop-key').hidden));
 await p.unroute('**/korea.cropland.json');await p.click('[data-a=cropland]');await p.waitForFunction(()=>city.cropland.enabled);console.log('PASS: failed cropland load retry and close during loading');
}finally{await b.close()}
