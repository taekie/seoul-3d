import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
try{
 const p=await b.newPage({viewport:{width:1200,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8747/?city=chapelhill');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:180000});
 await p.click('[data-a=labels]');
 const state=()=>p.evaluate(()=>({pan:city.longPressPan,space:city.spacePan,cursor:city.renderer.domElement.style.cursor,target:city.controls.target.toArray(),offset:city.camera.position.clone().sub(city.controls.target).normalize().toArray()}));
 await p.mouse.move(550,450);await p.mouse.down();await p.waitForTimeout(600);assert.equal((await state()).pan,false);
 await p.waitForTimeout(600);assert.equal((await state()).pan,true);assert.equal((await state()).cursor,'grabbing');
 const before=await state();await p.mouse.move(650,470,{steps:5});const moved=await state();
 assert(distance(before.target,moved.target)>1);assert(distance(before.offset,moved.offset)<.00001,'Held gesture must pan, not rotate');
 await p.mouse.up();assert.equal((await state()).cursor,'grab');
 await p.waitForTimeout(1800);
 await p.mouse.down();await p.mouse.move(590,440,{steps:4});await p.mouse.up();
 await p.waitForTimeout(1800);assert.equal((await state()).pan,true,'A new drag must reset the idle timer');
 await p.waitForTimeout(1500);assert.equal((await state()).pan,false);assert.equal((await state()).cursor,'');
 const rotationBefore=await state();await p.mouse.down();await p.mouse.move(650,460,{steps:3});await p.waitForTimeout(1200);
 assert.equal((await state()).pan,false,'Movement cancels the long press');await p.mouse.up();
 assert(distance(rotationBefore.offset,(await state()).offset)>.001,'Rotation must return after timeout');
 await p.mouse.down();await p.waitForTimeout(200);await p.mouse.up();await p.waitForTimeout(1100);assert.equal((await state()).pan,false,'Short click must not activate later');
 await p.mouse.down();await p.waitForTimeout(1200);await p.mouse.up();
 await p.keyboard.down('Space');await p.keyboard.up('Space');assert.equal((await state()).pan,true,'Space release must preserve the timed pan mode');
 await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state()).pan,false);assert.equal((await state()).space,false);
 assert.deepEqual(errors,[]);console.log('PASS: 1s hold, continuous gesture pan, grab cursor, 3s idle and drag renewal, rotation restoration, movement/short-click cancellation, Space coexistence, blur reset');
}finally{await b.close()}
