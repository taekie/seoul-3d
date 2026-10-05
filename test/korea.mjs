import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:['--use-gl=angle',process.env.CITY_TEST_GPU==='metal'?'--use-angle=metal':'--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 await p.goto('http://localhost:8747/?city=korea');
 await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:90000});
 await p.waitForTimeout(1200);
 console.log(await p.evaluate(()=>({landmarks:city.landmarks.length,terrainTriangles:city.groups.terrain.geometry.index.count/3,dem:city.terrain.data.byteLength,labels:poiLabels.visible.size,errors:__err})));
 await p.screenshot({path:'test/korea-desktop.png'});
 assert(!requests.some(u=>/terrarium|korea\.buildings|korea\.trees|korea\.pois/.test(u)),'Overview must not fetch city-scale layers or external DEM tiles');
 assert(await p.evaluate(()=>city.terrain.W===769&&city.terrain.data.byteLength<2100000));
 assert(await p.evaluate(()=>{
  const t=city.terrain;let raw=0,smooth=0;
  for(let y=1;y<t.H-1;y++)for(let x=1;x<t.W-1;x++){
   const i=y*t.W+x;if(t.data[i]<0||t.data[i+1]<0)continue;
   raw+=(t.data[i+1]-t.data[i])**2;smooth+=(t.displayData[i+1]-t.displayData[i])**2;
  }
  return t.relief===8&&smooth<raw*.95&&smooth>raw*.15&&t.displayData!==t.data&&t.surface.every(Number.isFinite);
 }),'Relief must retain raw elevations and lightly smooth land gradients without losing ridge detail');
 assert(await p.evaluate(()=>city.groups.terrain.geometry.index.count/3<700000));
 assert(await p.evaluate(()=>poiLabels.visible.size>=5));
 for(const kind of ['river','mountain','city'])assert(await p.locator(`.map-label[data-category="${kind}"][aria-hidden="false"]`).count()>=2,`${kind} labels must be visible`);
 assert(await p.evaluate(()=>city.landmarks.filter(p=>p.kind==='river').length===31&&city.landmarks.filter(p=>p.kind==='mountain').length===21));
 assert(await p.evaluate(()=>!city.groups.rivers.minor.visible),'Secondary waterways hidden at overview');
 await p.click('[data-a=labels]');assert.equal(await p.locator('.map-label[aria-hidden="false"]').count(),0);await p.click('[data-a=labels]');
 await p.click('#lm-btn');await p.locator('#landmarks button').filter({has:p.getByText('금강',{exact:true})}).click();await p.waitForTimeout(1700);
 assert.equal(await p.locator('#place-name').textContent(),'금강');assert(await p.evaluate(()=>city.groups.rivers.minor.visible));
 await p.locator('#landmarks button').filter({has:p.getByText('설악산',{exact:true})}).click();await p.waitForTimeout(1700);
 assert.equal(await p.locator('#place-name').textContent(),'설악산');
 await p.click('#lm-btn');await p.click('[data-a=home]');await p.waitForTimeout(2600);
 await p.click('#info-btn');assert.equal(await p.locator('#city-switch a').count(),4);await p.click('#about .close');
 await p.click('#lm-btn');await p.locator('#landmarks button').filter({hasText:'부산'}).click();await p.waitForTimeout(1700);
 assert(await p.evaluate(()=>city.camera.position.distanceTo(city.controls.target)<250000));
 await p.click('#lm-btn');await p.screenshot({path:'test/korea-busan.png'});
 await p.click('[data-a=home]');await p.waitForTimeout(2600);
 await p.click('[data-t=night]');await p.waitForTimeout(500);await p.screenshot({path:'test/korea-night.png'});
 await p.click('[data-a=tour]');await p.waitForTimeout(1700);assert(p.url().includes('city=korea'),'Tour must stay on overview when passing Seoul/Jeju');await p.click('[data-a=tour]');
 await p.setViewportSize({width:390,height:844});await p.reload();await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'));await p.waitForTimeout(500);
 await p.screenshot({path:'test/korea-mobile.png'});
 assert(await p.evaluate(()=>poiLabels.visible.size>=4));
 for(const kind of ['river','mountain','city'])assert(await p.locator(`.map-label[data-category="${kind}"][aria-hidden="false"]`).count()>=2,`Mobile ${kind} labels must be visible`);
 await p.click('#lm-btn');await p.locator('#landmarks button').filter({hasText:'서울'}).click();await p.waitForURL('**/?city=seoul');
 assert.deepEqual(errors,[]);
 console.log('PASS: compact local relief, no live DEM/city layers, desktop/mobile labels, themes, regional zoom, tour, city switch and Seoul detail link');
}finally{await browser.close()}
