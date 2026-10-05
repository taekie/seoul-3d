import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('data/korea.population.json'));
assert(data.cells.length>5000&&data.cells.length<15000);
assert.equal(data.meta.year,2025);
assert(data.meta.sources.every(s=>s.includes('/2025/')));
assert(data.meta.countryPopulation.kor>50e6&&data.meta.countryPopulation.prk>25e6);
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
p.on('console',m=>{if(m.type()==='error'&&/shader|validate|compile/i.test(m.text()))errors.push(m.text());});
await p.goto('http://localhost:8747/?city=korea');
await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:90000});
assert(!requests.some(u=>u.includes('korea.population.json')));
// Even a selected mountain must disappear in population mode.
await p.evaluate(()=>poiLabels.select('landmark:'+city.landmarks.find(l=>l.kind==='mountain').id));
const btn=p.locator('[data-a=population]');
await btn.click();await p.waitForFunction(()=>city.population.enabled);
assert.equal(await btn.getAttribute('aria-pressed'),'true');
assert(await p.evaluate(()=>city.groups.population.count===city.population.data.cells.length&&city.groups.population.visible));
await p.waitForTimeout(500);
assert(await p.evaluate(()=>{
 const m=city.groups.population,a=m.geometry.getAttribute('instanceDensity');
 const i=city.population.data.cells.findIndex(c=>c[2]>10000),density=city.population.data.cells[i][2];
 const scale=Math.hypot(m.instanceMatrix.array[i*16+4],m.instanceMatrix.array[i*16+5],m.instanceMatrix.array[i*16+6]);
 return m.userData.heightScale===3.5&&Math.abs(scale-density*3.5)<.1&&a.count===m.count&&m.instanceColor===null;
}),'Linear columns must retain density values for their vertical gradient');
assert(await p.evaluate(()=>{
 const m=city.groups.population;
 return city.population.data.cells.every((c,i)=>Math.abs(m.instanceMatrix.array[i*16+5]-c[2]*3.5)<.02);
}),'All column heights must be proportional to density, including low-density cells');
assert(await p.evaluate(()=>[...poiLabels.visible].every(id=>poiLabels.nodes.get(id).p.lm.kind==='city')));
assert(await p.evaluate(()=>{
 const cities=poiLabels.landmarks.filter(p=>p.lm.kind==='city');
 return cities.every(p=>{const anchor=city.population.labelPosition(p.lm);return anchor&&p.pos.distanceTo(anchor)<.01;})&&
 cities.some(p=>p.pos.y>50000);
}),'City labels should attach above nearby population column tops');
await p.screenshot({path:'test/population-desktop.png'});
await p.click('[data-t=night]');assert(await p.evaluate(()=>city.groups.population.visible&&city.population.enabled));
await btn.click();assert(await p.evaluate(()=>!city.groups.population.visible));
await p.waitForTimeout(200);
assert(await p.evaluate(()=>poiLabels.landmarks.every((p,i)=>p.pos.distanceTo(city.labelAnchors[i].pos)<.01)),'Original terrain anchors must return when population is off');
assert(await p.evaluate(()=>[...poiLabels.visible].some(id=>poiLabels.nodes.get(id).p.lm.kind==='mountain')));
await p.click('[data-t=day]');assert(await p.evaluate(()=>!city.groups.population.visible));
await btn.click();assert.equal(requests.filter(u=>u.includes('korea.population.json')).length,1);
await p.setViewportSize({width:390,height:844});await p.reload();
await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'));
await p.route('**/data/korea.population.json*',route=>route.fulfill({status:503,body:'Unavailable'}));
await btn.click();await p.waitForFunction(()=>document.getElementById('population-status').textContent.includes('못했습니다'));
assert.equal(await btn.getAttribute('aria-pressed'),'false');
await p.unroute('**/data/korea.population.json*');await btn.click();await p.waitForFunction(()=>city.population.enabled);
await p.waitForTimeout(200);
assert(await p.evaluate(()=>poiLabels.visible.size>=3&&[...poiLabels.visible].every(id=>poiLabels.nodes.get(id).p.lm.kind==='city')));
await p.screenshot({path:'test/population-mobile.png'});
assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
const bounds=await p.locator('#population-key').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);
assert.deepEqual(errors,[]);
console.log('PASS: density data, lazy loading, toggle, theme persistence, mobile, failed request retry');
}finally{await browser.close()}
