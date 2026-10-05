import{chromium}from'playwright';import assert from'node:assert/strict';import{readFileSync,statSync}from'node:fs';
const meta=JSON.parse(readFileSync(new URL('../data/korea.cropland.json',import.meta.url)));
assert.equal(meta.year,2021);assert.equal(meta.class,40);assert.equal(meta.sources.length,11);assert(meta.validCells>800000);assert(statSync(new URL('../data/korea.cropland.png',import.meta.url)).size<1e6);
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 await p.goto('http://localhost:8747/?city=korea');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.querySelector('#load'),null,{timeout:90000});
 assert(!requests.some(u=>u.includes('korea.cropland')));
 await p.click('[data-a=cropland]');await p.waitForFunction(()=>city.cropland.enabled);await p.waitForTimeout(500);
 assert(await p.evaluate(()=>city.cropland.values.every(v=>v<=100||v===255)));
 assert(await p.evaluate(()=>{const a=city.groups.terrain.geometry.attributes.position.array,b=city.groups.cropland.geometry.attributes.position.array;return a.length===b.length&&a.every((v,i)=>v===b[i]);}));
 await p.screenshot({path:'test/cropland-alone.png'});
 await p.click('[data-a=population]');await p.waitForFunction(()=>city.population.enabled);
 const count=await p.evaluate(()=>city.groups.population.count);assert(await p.evaluate(()=>city.cropland.enabled&&city.population.enabled));
 await p.waitForTimeout(600);await p.screenshot({path:'test/cropland-population.png'});
 const textures=await p.evaluate(()=>city.renderer.info.memory.textures);
 await p.click('[data-t=night]');await p.waitForTimeout(400);assert(await p.evaluate(()=>city.cropland.enabled&&city.groups.cropland.visible&&city.population.enabled));
 await p.click('[data-t=day]');await p.waitForTimeout(400);assert(await p.evaluate(n=>city.renderer.info.memory.textures<=n+1,textures));
 await p.click('[data-a=cropland]');assert(await p.evaluate(n=>!city.cropland.enabled&&city.population.enabled&&city.groups.population.count===n,count));
 await p.click('[data-a=cropland]');await p.click('[data-a=population]');assert(await p.evaluate(()=>city.cropland.enabled&&!city.population.enabled));
 assert.equal(requests.filter(u=>u.endsWith('korea.cropland.png')).length,1,'Reactivation must reuse data');
 await p.setViewportSize({width:390,height:844});await p.goto('http://localhost:8747/?city=korea&cropland=1&population=1');
 await p.waitForFunction(()=>city.cropland?.enabled&&city.population?.enabled&&!document.querySelector('#load'),null,{timeout:90000});await p.waitForTimeout(500);
 await p.screenshot({path:'test/cropland-mobile.png'});
 assert(await p.evaluate(()=>{const c=document.querySelector('#crop-key').getBoundingClientRect(),p=document.querySelector('#population-key').getBoundingClientRect(),t=document.querySelector('#tools').getBoundingClientRect();return c.left>=0&&c.right<=innerWidth&&c.bottom<=t.top&&c.top>=p.bottom&&t.right<=innerWidth;}));
 assert.deepEqual(errors,[]);console.log('PASS: real fractions, lazy/cached load, exact terrain alignment, population co-display unchanged, themes and texture disposal, mobile controls and deep link');
}finally{await browser.close();}
