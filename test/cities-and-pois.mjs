import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const b=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:180000});
 const visible=category=>p.locator(`.map-label[data-category="${category}"][aria-hidden="false"]`);
 await p.goto('http://localhost:8747/?city=chapelhill');await ready();
 assert.equal(await p.title(),'채플힐 3D 아틀라스');
 assert.equal(await p.locator('#landmarks > button').count(),9);
 assert.equal(await p.evaluate(()=>city.groups.landmarks.children.length),9);
 await p.click('#lm-btn');
 for(let i=0;i<9;i++){
   await p.locator('#landmarks button').nth(i).click();await p.waitForTimeout(2100);
   assert.match(await p.locator('#place-coord').textContent(),/79\.\d+° W/);
   assert(await p.evaluate(()=>Number.isFinite(city.camera.position.length())));
 }
 await p.click('[data-t=night]');await p.waitForTimeout(500);
 assert.equal(await p.evaluate(()=>city.groups.landmarks.children.length),9);
 assert(await p.evaluate(()=>['uncfarm','chapelballet','chapellibrary','deansmith','morrisgrove'].every(id=>{
   const object=city.groups.landmarks.children.find(o=>o.userData.id===id);
   const size=new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
   return size.x>20&&size.y>10&&size.z>20;
 })));
 for(const [id,category,name] of [
   ['local:chapel-watch-village','neighborhood','Chapel Watch Village'],
   ['poi:442306042','supermarket','Harris Teeter'],
 ]){
   await p.locator(`[data-poi-shortcut="${id}"]`).click();await p.waitForTimeout(2700);
   assert.equal(await p.locator('#place-name').textContent(),name);
   assert((await visible(category).allTextContents()).includes(name));
   const bounds=await p.evaluate(()=>city.data.meta.bbox);assert(bounds[3]>35.98);
 }
 await p.click('#info-btn');assert.equal(await p.locator('#city-switch a').count(),4);
 await p.setViewportSize({width:390,height:844});
 const rect=await p.locator('#city-switch').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390);
 await p.locator('#city-switch a').filter({hasText:'제주'}).click();await ready();
 await p.setViewportSize({width:1440,height:900});
 await p.evaluate(()=>city.placeCamera(126.6690893,33.5427261,4000,.9,-.2));await p.waitForTimeout(500);
 assert((await visible('beach').allTextContents()).includes('함덕해수욕장'));
 assert.equal(await visible('hotel').count(),0,'Hotels should only appear close up');
 await p.evaluate(()=>city.placeCamera(126.6690893,33.5427261,1800,.9,-.2));await p.waitForTimeout(500);
 assert(await visible('hotel').count()>0);
 await visible('beach').filter({hasText:'함덕해수욕장'}).click();
 assert.equal(await p.locator('#place-desc').textContent(),'해변·해수욕장');
 await p.screenshot({path:'test/jeju-beach-hotels.png'});
 await p.click('#info-btn');await p.locator('#city-switch a').filter({hasText:'서울'}).click();await ready();
 await p.evaluate(()=>city.placeCamera(126.9818,37.565,2200,.9,-.2));await p.waitForTimeout(500);
 assert(await visible('department_store').count()>0);
 await visible('department_store').first().click();assert.equal(await p.locator('#place-desc').textContent(),'백화점');
 const jeju=JSON.parse(readFileSync(new URL('../data/jeju.pois.json',import.meta.url)));
 assert.equal(jeju.pois.filter(p=>p.category==='beach').length,9);
 assert.deepEqual(errors,[]);
 console.log('PASS: Chapel Hill geometry, landmarks, Morris Grove school, Chapel Watch Village, Harris Teeter, W coordinates, night, mobile city switch, Jeju beaches/hotel zoom, Seoul department stores; no runtime errors');
}finally{await b.close()}
