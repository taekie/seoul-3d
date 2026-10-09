// Requires npm run serve; validates scenery, theme rebuilds and real mouse/keyboard input.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://localhost:8747/',{timeout:120000});await page.waitForFunction(()=>window.city?.life&&!document.getElementById('load'),null,{timeout:180000});
 const day=await page.evaluate(()=>city.life.stats);
 assert(day.plaza);assert(day.boats===2);assert(day.vehicles>24&&day.riverVehicles['강변북로']>30&&day.riverVehicles['올림픽대로']>30);assert(day.gable>0&&day.garden>0);assert.equal(day.windows,0);
 const river=await page.evaluate(()=>{const a=city.life.riverActors;city.life.update(0);const before=a.map(v=>v.object.position.clone());city.life.update(1000);const batches=city.life.group.children.filter(o=>o.userData.kind==='river-traffic');return {moving:a.every((v,i)=>v.object.position.distanceTo(before[i])>1),scale:a.every(v=>v.object.scale.x===2.1),types:[...new Set(a.map(v=>v.type))].sort(),batches:batches.length,finite:batches.every(m=>Array.from(m.instanceMatrix.array).every(Number.isFinite)),boats:city.life.group.children.filter(o=>o.userData.kind==='cruise').map(o=>o.scale.toArray())};});assert(river.moving&&river.scale&&river.finite);assert.equal(river.batches,1);assert.deepEqual(river.types,['bus','sedan','suv','truck']);assert.deepEqual(day.riverVehicles,{'강변북로':132,'올림픽대로':157});assert.deepEqual(river.boats,[[2,1.7,2],[2,1.7,2]]);
 assert.equal(day.trains,6);
 const bridges=await page.evaluate(()=>{const actors=city.life.bridgeActors;const samples=actors.map(a=>{city.life.update(((10-a.phase+a.period)%a.period)*1000);const active=a.object.visible,before=a.object.position.clone(),y=a.path.getPoint(a.reverse?1-10/a.duration:10/a.duration).y;city.life.update(((11-a.phase+a.period)%a.period)*1000);const moving=a.object.position.distanceTo(before)>1;city.life.update(((35-a.phase+a.period)%a.period)*1000);return {active,moving,hidden:!a.object.visible,height:Math.abs(before.y-y)<.01};});const batches=city.life.group.children.filter(o=>o.userData.kind==='bridge-traffic');return {samples,batches:batches.length,finite:batches.every(m=>Array.from(m.instanceMatrix.array).every(Number.isFinite)),paired:actors.every(a=>actors.some(b=>b!==a&&b.path===a.path&&b.reverse!==a.reverse)),rail:actors.some(a=>a.bridgeName?.includes('철교'))};});
 assert.equal(day.bridgeVehicles,34);assert.equal(day.roadBridges.length,17);assert(bridges.samples.every(a=>a.active&&a.moving&&a.hidden&&a.height));assert(bridges.paired&&bridges.finite&&!bridges.rail);assert.equal(bridges.batches,1);
 const trains=await page.evaluate(()=>city.life.trains.map(t=>{city.life.update(((12-t.phase+t.period)%t.period)*1000);const active=t.root.visible,finite=t.batches.every(b=>Array.from(b.mesh.instanceMatrix.array).every(Number.isFinite));const m=new THREE.Matrix4();t.batches[0].mesh.getMatrixAt(0,m);const size=new THREE.Vector3().setFromMatrixScale(m);city.life.update(((35-t.phase+t.period)%t.period)*1000);return {bridge:t.route.name,line:t.route.line,active,hidden:!t.root.visible,finite,width:size.x*(t.batches[0].mesh.geometry.boundingBox.max.x-t.batches[0].mesh.geometry.boundingBox.min.x),heightRange:Math.max(...t.path.curves.flatMap(c=>[c.v1.y,c.v2.y]))-Math.min(...t.path.curves.flatMap(c=>[c.v1.y,c.v2.y])),coaches:t.coaches};}));
 assert.equal(new Set(trains.map(t=>t.bridge)).size,6);assert.deepEqual(trains.map(t=>t.line).sort(),['1','2','2','3','4','7']);assert(trains.every(t=>t.active&&t.hidden&&t.finite&&t.coaches===4&&t.width>30&&t.heightRange<.01));
 const motion=await page.evaluate(()=>{const actors=city.life.group.children.filter(o=>o.isGroup&&o.userData.kind!=='bridge-train');city.life.update(0);const before=actors.map(o=>o.position.clone());city.life.update(1000);return actors.every((o,i)=>o.position.distanceTo(before[i])>1)});assert(motion,'Vehicles and ships must advance along their paths');
 const state=()=>page.evaluate(()=>({target:city.controls.target.toArray(),offset:city.camera.position.clone().sub(city.controls.target).normalize().toArray(),left:city.controls.mouseButtons.LEFT,space:city.spacePan}));
 const difference=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 await page.waitForTimeout(800);const before=await state();
 await page.keyboard.down('Space');assert.equal((await state()).left,2);
 await page.mouse.move(420,340);await page.mouse.down();await page.mouse.move(510,380,{steps:8});await page.mouse.up();await page.keyboard.up('Space');await page.waitForTimeout(800);
 const pan=await state();assert(difference(before.target,pan.target)>10,'Space drag must move target');assert(difference(before.offset,pan.offset)<.005,'Space drag must preserve angle');assert.equal(pan.left,0);
 await page.mouse.move(420,340);await page.mouse.down();await page.mouse.move(510,380,{steps:8});await page.mouse.up();await page.waitForTimeout(800);
 const rotate=await state();assert(difference(pan.offset,rotate.offset)>.02,'Normal drag must rotate');
 await page.keyboard.down('Space');await page.evaluate(()=>dispatchEvent(new Event('blur')));assert.equal((await state()).space,false);assert.equal((await state()).left,0);await page.keyboard.up('Space');
 await page.click('[data-t=night]');const night=await page.evaluate(()=>city.life.stats);assert(night.windows>0);assert(night.lamps>0);assert.equal(night.boats,day.boats);assert.equal(night.trains,6);
 await page.click('[data-t=day]');const again=await page.evaluate(()=>city.life.stats);assert.deepEqual(again,day);
 await page.keyboard.down('Space');assert.equal((await state()).left,2,'Space pan must also work after clicking UI');await page.keyboard.up('Space');assert.equal((await state()).left,0);
 await page.goto('http://localhost:8747/?city=jeju');await page.waitForFunction(()=>window.city?.life&&!document.getElementById('load'),null,{timeout:180000});
 const jeju=await page.evaluate(()=>city.life.stats);assert(!jeju.plaza);assert.equal(jeju.boats,0);assert(jeju.gable>0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({day,night,jeju,controls:'Space pan, release, normal rotation and blur reset passed',errors}));
} finally {await browser.close()}
