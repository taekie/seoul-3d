import{chromium}from'playwright';import assert from'node:assert/strict';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8747/?city=korea&population=1');await p.waitForFunction(()=>city.population?.enabled&&!document.querySelector('#load'),null,{timeout:90000});await p.waitForTimeout(400);
 const visible=()=>p.evaluate(()=>[...poiLabels.visible].map(id=>{const p=poiLabels.nodes.get(id).p;return{name:p.name,regional:!!p.populationPlace,density:p.populationDensity,id:p.id};}));
 assert(!(await visible()).some(x=>x.regional));
 const heights=await p.evaluate(()=>Array.from(city.groups.population.instanceMatrix.array));
 await p.evaluate(()=>city.placeCamera(128.02,37.45,280000,1.1,-.12));await p.waitForTimeout(600);
 let labels=await visible();console.log('Regional:',labels);assert(labels.filter(x=>x.regional).length>=3);
 assert(await p.evaluate(()=>city.population.regional.every(p=>{const a=city.groups.population.instanceMatrix.array,k=p.populationCell*16;return Math.abs(p.pos.x-a[k+12])<.1&&Math.abs(p.pos.z-a[k+14])<.1&&Math.abs(p.pos.y-(a[k+13]+a[k+5]/2+2500))<1;})));
 assert(await p.evaluate(a=>a.every((v,i)=>v===city.groups.population.instanceMatrix.array[i]),heights),'Regional labels must not rescale or move population bars');
 await p.screenshot({path:'test/population-regions.png'});
 const entry=labels.find(x=>x.regional);await p.locator(`[data-poi-id="${entry.id}"]`).click();await p.waitForTimeout(1400);assert(p.url().includes('city=korea'));assert(await p.evaluate(()=>Number.isFinite(city.camera.position.length())));
 await p.click('[data-t=night]');await p.waitForTimeout(400);assert((await visible()).some(x=>x.regional));
 await p.click('[data-a=population]');await p.waitForTimeout(400);assert(!(await visible()).some(x=>x.regional));
 await p.click('[data-a=population]');await p.click('[data-a=home]');await p.waitForTimeout(2700);assert(!(await visible()).some(x=>x.regional));
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>city.placeCamera(127.8,37.9,220000,1.1,-.12));await p.waitForTimeout(500);assert((await visible()).some(x=>x.regional));await p.screenshot({path:'test/population-regions-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: unchanged overview, viewport regional names on bar tops, no density changes, click focus, theme rebuild, toggles and mobile');
}finally{await b.close()}
