import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const partial=process.argv.includes('--partial');
for(const mode of ['mean','max']){
 const meta=JSON.parse(fs.readFileSync(`data/korea.snow.2025-26.${mode}.json`));
 assert.equal(meta.unit,'cm');assert.equal(meta.weeks[0].start,'2025-11-01');assert.equal(meta.weeks.at(-1).end,partial?'2026-01-03':'2026-03-31');
 assert.equal(meta.complete,!partial);
 assert.equal(meta.weeks.reduce((s,w)=>s+w.days,0),partial?64:151);
 assert.equal(fs.statSync(`data/korea.snow.2025-26.${mode}.bin`).size,meta.cellCount*meta.frameCount*2);
 assert.equal(meta.source.obs,mode==='mean'?'sd_tot':'sd_24h');
 assert.equal(meta.source.sampleTime,'09:00 KST daily');
}
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 p.on('console',m=>{if(m.type()==='error'&&/shader|compile|validate/i.test(m.text()))errors.push(m.text());});
 await p.goto('http://localhost:8747/?city=korea');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:90000});
 assert(!requests.some(u=>u.includes('korea.snow.')));
 await p.click('[data-a=rain]');await p.waitForFunction(()=>city.rainfall.enabled);
 const choose=async metric=>{await p.selectOption('#rain-metric',metric);await p.waitForFunction(m=>city.rainfall.metric===m&&!document.getElementById('rain-metric').disabled,metric);};
 await p.route('**/data/korea.snow.2025-26.mean.json',r=>r.fulfill({status:503,body:'Unavailable'}));
 await p.selectOption('#rain-metric','snow-mean');await p.waitForFunction(()=>document.getElementById('rain-status').textContent.includes('못했습니다'));
 assert.equal(await p.locator('#rain-metric').inputValue(),'rain');
 await p.unroute('**/data/korea.snow.2025-26.mean.json');await choose('snow-mean');
 assert(await p.locator('#rain-year').isHidden());assert.equal(await p.locator('.month-tick').count(),partial?3:5);
 assert((await p.locator('#rain-chart-value').textContent()).includes('cm'));
 assert((await p.locator('#rain-method').textContent()).includes('09시'));
 if(partial){assert((await p.locator('#rain-through').textContent()).includes('일부 기간'));assert((await p.locator('#rain-method').textContent()).includes('수집 미완료'));}
 assert(await p.evaluate(()=>{
  const r=city.rainfall,mesh=city.groups.rainfall;
  return r.profile.heightScale===1200&&mesh.visible&&r.cells.every((_,i)=>{
   const raw=r.values[r.week*r.data.cellCount+i];return Math.abs(mesh.instanceMatrix.array[i*16+5]-(raw===65535?0:raw*.1*1200))<.1;
  });
 }),'Snow height must be linear in cm, with missing cells hidden');
 await p.screenshot({path:'test/snow-desktop.png'});
 await p.locator('#rain-week').fill('8');await choose('snow-max');
 assert.equal(await p.evaluate(()=>city.rainfall.week),8);
 assert((await p.locator('#rain-method').textContent()).includes('신적설 누계 아님'));
 await choose('snow-mean');assert.equal(await p.evaluate(()=>city.rainfall.week),8);
 await p.click('[data-t=night]');assert(await p.evaluate(()=>city.groups.rainfall.visible&&city.rainfall.metric==='snow-mean'));
 await p.click('#rain-play');await p.waitForFunction(()=>city.rainfall.week>8);await p.click('#rain-play');
 await choose('rain');assert.equal(await p.evaluate(()=>city.rainfall.profile.heightScale),120);
 assert(await p.locator('#rain-year').isVisible());
 await choose('snow-mean');assert.equal(requests.filter(u=>u.endsWith('korea.snow.2025-26.mean.bin')).length,1);
 await p.click('[data-a=population]');await p.waitForFunction(()=>city.population.enabled);
 assert(await p.evaluate(()=>!city.rainfall.enabled&&!city.groups.rainfall.visible));
 await p.click('[data-a=rain]');await p.waitForFunction(()=>city.rainfall.enabled);
 assert.equal(await p.evaluate(()=>city.rainfall.metric),'snow-mean');
 await p.click('[data-t=day]');await p.setViewportSize({width:390,height:844});await p.reload();
 await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'));
 await p.click('[data-a=rain]');await p.waitForFunction(()=>city.rainfall.enabled);await choose('snow-max');
 await p.screenshot({path:'test/snow-mobile.png'});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
 const panel=await p.locator('#rain-panel').boundingBox(),tools=await p.locator('#tools').boundingBox();assert(panel.y+panel.height<tools.y);
 assert(!requests.some(u=>u.includes('apihub.kma.go.kr')));assert.deepEqual(errors,[]);
 console.log('PASS: winter date coverage, cm columns, cross-year month ticks, metrics, matched weeks, replay, themes, layers, cache, retries and mobile');
}finally{await browser.close();}
