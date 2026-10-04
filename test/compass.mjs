import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8747/?city=chapelhill');
 await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:180000});
 for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI]){
  await p.evaluate(a=>city.placeCamera(-79.07,35.968,2400,.8,a),angle);await p.waitForTimeout(150);
  const bearing=Number(await p.locator('#compass').getAttribute('data-bearing'));
  assert(Math.abs(Math.abs(bearing)-Math.abs(angle*180/Math.PI))<.1);
  const before=await p.evaluate(()=>({target:city.controls.target.toArray(),radius:city.camera.position.distanceTo(city.controls.target),polar:city.controls.getPolarAngle()}));
  await p.click('#compass');await p.waitForTimeout(250);
  assert(Math.abs((await p.evaluate(()=>city.camera.position.distanceTo(city.controls.target)))-before.radius)<.01);
  await p.waitForTimeout(550);
  const after=await p.evaluate(()=>({target:city.controls.target.toArray(),radius:city.camera.position.distanceTo(city.controls.target),polar:city.controls.getPolarAngle(),theta:city.controls.getAzimuthalAngle()}));
  assert(Math.abs(after.theta)<.001);assert(Math.abs(after.radius-before.radius)<.01);assert(Math.abs(after.polar-before.polar)<.001);
  after.target.forEach((v,i)=>assert(Math.abs(v-before.target[i])<.001));
 }
 await p.click('[data-t=night]');await p.setViewportSize({width:390,height:844});
 await p.emulateMedia({reducedMotion:'reduce'});
 await p.evaluate(()=>city.placeCamera(-79.07,35.968,2400,.8,1.2));
 await p.locator('#compass').focus();await p.keyboard.press('Enter');
 assert(Math.abs(await p.evaluate(()=>city.controls.getAzimuthalAngle()))<.001);
 const rect=await p.locator('#compass').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390&&rect.y+rect.height<=844);
 const toolbar=await p.locator('#tools').boundingBox();assert(rect.y+rect.height<toolbar.y,'Compass must not overlap mobile toolbar');
 await p.screenshot({path:'test/compass-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: cardinal bearings, north reset preserves target/zoom/tilt, keyboard, reduced motion, mobile/night; no runtime errors');
}finally{await browser.close()}
