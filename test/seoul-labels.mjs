import{chromium}from'playwright';import assert from'node:assert/strict';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8747/?city=seoul');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.querySelector('#load'),null,{timeout:120000});await p.waitForTimeout(500);
 const state=()=>p.evaluate(()=>[...poiLabels.visible].map(id=>poiLabels.nodes.get(id).p).map(p=>({name:p.name,placeClass:p.placeClass,category:p.category,majorMountain:p.majorMountain})));
 const wide=await state();console.log('Wide:',wide.map(p=>p.name));assert(wide.filter(p=>p.majorMountain).length>=4);assert.equal(new Set(wide.filter(p=>p.majorMountain).map(p=>p.majorMountain)).size,wide.filter(p=>p.majorMountain).length);assert(wide.length>=10);assert(!await p.locator('#place').isVisible());await p.screenshot({path:'test/seoul-labels-after.png'});
 await p.evaluate(()=>city.placeCamera(127.025,37.50,6000,.85,-.2));await p.waitForTimeout(400);assert((await state()).some(p=>p.placeClass==='quarter'));assert(!(await state()).some(p=>p.placeClass==='borough'));assert(!(await state()).some(p=>p.category==='hotel'));
 await p.click('[data-a=labels]');assert.equal(await p.locator('.map-label[aria-hidden="false"]').count(),0);await p.click('[data-a=labels]');
 await p.setViewportSize({width:390,height:844});await p.click('[data-a=home]');await p.waitForTimeout(2700);assert((await state()).some(p=>p.majorMountain));await p.screenshot({path:'test/seoul-labels-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: major mountains at overview, neighbourhoods on zoom, detailed POIs remain gated, label toggle and mobile');
}finally{await b.close()}
