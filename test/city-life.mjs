// Requires npm run serve; validates scenery, theme rebuilds and real mouse/keyboard input.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://localhost:8747/',{timeout:120000});await page.waitForFunction(()=>window.city?.life&&!document.getElementById('load'),null,{timeout:180000});
 const day=await page.evaluate(()=>city.life.stats);
 assert(day.plaza);assert(day.boats===2);assert(day.vehicles>0&&day.vehicles<=24);assert(day.gable>0&&day.garden>0);assert.equal(day.windows,0);
 const motion=await page.evaluate(()=>{const actors=city.life.group.children.filter(o=>o.isGroup);city.life.update(0);const before=actors.map(o=>o.position.clone());city.life.update(1000);return actors.every((o,i)=>o.position.distanceTo(before[i])>1)});assert(motion,'Vehicles and ships must advance along their paths');
 const state=()=>page.evaluate(()=>({target:city.controls.target.toArray(),offset:city.camera.position.clone().sub(city.controls.target).normalize().toArray(),left:city.controls.mouseButtons.LEFT,space:city.spacePan}));
 const difference=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 await page.waitForTimeout(800);const before=await state();
 await page.keyboard.down('Space');assert.equal((await state()).left,2);
 await page.mouse.move(420,340);await page.mouse.down();await page.mouse.move(510,380,{steps:8});await page.mouse.up();await page.keyboard.up('Space');await page.waitForTimeout(800);
 const pan=await state();assert(difference(before.target,pan.target)>10,'Space drag must move target');assert(difference(before.offset,pan.offset)<.005,'Space drag must preserve angle');assert.equal(pan.left,0);
 await page.mouse.move(420,340);await page.mouse.down();await page.mouse.move(510,380,{steps:8});await page.mouse.up();await page.waitForTimeout(800);
 const rotate=await state();assert(difference(pan.offset,rotate.offset)>.02,'Normal drag must rotate');
 await page.keyboard.down('Space');await page.evaluate(()=>dispatchEvent(new Event('blur')));assert.equal((await state()).space,false);assert.equal((await state()).left,0);await page.keyboard.up('Space');
 await page.click('[data-t=night]');const night=await page.evaluate(()=>city.life.stats);assert(night.windows>0);assert(night.lamps>0);assert.equal(night.boats,day.boats);
 await page.click('[data-t=day]');const again=await page.evaluate(()=>city.life.stats);assert.deepEqual(again,day);
 await page.keyboard.down('Space');assert.equal((await state()).left,2,'Space pan must also work after clicking UI');await page.keyboard.up('Space');assert.equal((await state()).left,0);
 await page.goto('http://localhost:8747/?city=jeju');await page.waitForFunction(()=>window.city?.life&&!document.getElementById('load'),null,{timeout:180000});
 const jeju=await page.evaluate(()=>city.life.stats);assert(!jeju.plaza);assert.equal(jeju.boats,0);assert(jeju.gable>0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({day,night,jeju,controls:'Space pan, release, normal rotation and blur reset passed',errors}));
} finally {await browser.close()}
