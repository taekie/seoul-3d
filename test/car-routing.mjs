import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFile,mkdtemp} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
const fixture=JSON.parse(await readFile(new URL('./fixtures/seoul-car-route.json',import.meta.url),'utf8')),output=await mkdtemp(join(tmpdir(),'seoul-car-routing-'));
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));let requests=[],mode='ok';
 await p.route('https://routing.openstreetmap.de/**',async route=>{requests.push(route.request().url());if(mode==='slow')await new Promise(r=>setTimeout(r,1600));await route.fulfill({contentType:'application/json',body:JSON.stringify(mode==='none'?{code:'NoRoute'}:fixture)}).catch(()=>{});});
 await p.goto('http://127.0.0.1:8747/?city=seoul');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.querySelector('#load'),null,{timeout:150000});
 await p.click('#route-toggle');assert(await p.locator('#route-panel').isVisible());assert.equal(await p.evaluate(()=>carRouting.state.active),'origin');
 // Select places via the same callback used by visible POI labels.
 await p.evaluate(()=>{poiLabels.onSelect({name:'서울시청',lon:126.9784,lat:37.5666});poiLabels.onSelect({name:'예술의전당',lon:127.0138,lat:37.4793});});
 assert.equal(await p.inputValue('#route-origin'),'서울시청');await p.click('#route-search');await p.waitForFunction(()=>!!window.carRouting.state.route);
 assert.equal(requests.length,1);assert(requests[0].includes('/routed-car/route/v1/driving/126.9784000,37.5666000;127.0138000,37.4793000'));
 assert.match(await p.textContent('#route-summary'),/18\.1 km.*19분/);
 const info=await p.evaluate(()=>({root:carRouting.root.children.length,finite:carRouting.root.children.every(o=>o.position.toArray().every(Number.isFinite)),points:carRouting.state.route.geometry.coordinates.length}));assert.equal(info.root,3);assert(info.finite);assert(info.points>100);
 const pins=await p.evaluate(()=>carRouting.root.children.filter(o=>o.isSprite).map(o=>({slot:o.userData.slot,label:o.userData.label,fixed:!o.material.sizeAttenuation,tip:o.center.toArray()})));
 assert.deepEqual(pins,[{slot:'origin',label:'출발',fixed:true,tip:[.5,.05]},{slot:'destination',label:'도착',fixed:true,tip:[.5,.05]}]);
 await p.waitForTimeout(1200);await p.screenshot({path:join(output,'driving-route.png')});
 await p.click('[data-t=night]');assert.equal(await p.evaluate(()=>carRouting.root.children.length),3);await p.screenshot({path:join(output,'driving-route-night.png')});
 await p.click('#route-close');assert.equal(await p.evaluate(()=>carRouting.root.visible),false);await p.click('#route-toggle');assert.equal(await p.evaluate(()=>carRouting.root.visible),true);
 await p.click('#route-swap');assert.equal(await p.inputValue('#route-origin'),'예술의전당');assert.equal(await p.evaluate(()=>carRouting.state.route),null);
 await p.click('#route-clear');assert.equal(await p.evaluate(()=>carRouting.root.children.length),0);
 // Search dropdown names and surface NoRoute without a stuck loading state.
 await p.fill('#route-origin','서울역');await p.fill('#route-destination','예술의전당');mode='none';await p.click('#route-search');await p.waitForFunction(()=>document.querySelector('#route-status').textContent.includes('자동차 경로가 없습니다'));assert.equal(await p.locator('#route-search').isDisabled(),false);
 // A pending response cannot redraw a cleared route.
 await p.waitForTimeout(1150);mode='slow';await p.click('#route-search');await p.waitForFunction(()=>carRouting.state.busy);await p.click('#route-clear');await p.waitForTimeout(1800);assert.equal(await p.evaluate(()=>carRouting.state.route),null);assert.equal(await p.evaluate(()=>carRouting.root.children.length),0);
 // Picking on the canvas works, while dragging does not choose a point.
 await p.evaluate(()=>city.placeCamera(126.98,37.55,8500,.9,0));await p.mouse.move(650,560);await p.mouse.down();await p.mouse.move(700,560,{steps:4});await p.mouse.up();assert.equal(await p.evaluate(()=>carRouting.state.origin),null);
 await p.mouse.click(650,560);assert(await p.evaluate(()=>Number.isFinite(carRouting.state.origin?.lon)));assert.equal(await p.evaluate(()=>carRouting.state.active),'destination');
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);const bounds=await p.locator('#route-panel').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=391);await p.screenshot({path:join(output,'mobile-route-picker.png')});
 assert.deepEqual(errors,[]);console.log({pass:true,requests:requests.length,info,output});
}finally{await browser.close();}
