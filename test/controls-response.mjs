import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
try {
 const page=await browser.newPage({viewport:{width:1000,height:700},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://localhost:8747/');await page.waitForFunction(()=>window.city?.life&&!document.getElementById('load'),null,{timeout:180000});
 const state=()=>page.evaluate(()=>({target:city.controls.target.toArray(),offset:city.camera.position.clone().sub(city.controls.target).normalize().toArray(),pan:city.controls._panOffset.length(),fast:city.fastRender,ratio:city.renderer.getPixelRatio(),shadow:city.shadowTarget.toArray()}));
 const results=[];
 for(const mode of ['Space','Shift','right']) {
  await page.waitForTimeout(250);const before=await state();
  if(mode!=='right')await page.keyboard.down(mode);
  await page.mouse.move(390,360);await page.mouse.down({button:mode==='right'?'right':'left'});
  await page.mouse.move(480,390,{steps:4});await page.waitForFunction(()=>city.fastRender);
  const moved=await state();assert(distance(before.target,moved.target)>10);assert(distance(before.offset,moved.offset)<.00001);assert.equal(moved.pan,0);assert.equal(moved.ratio,1);assert(distance(before.shadow,moved.shadow)<.001,'Shadow rig must stay frozen while dragging');
  await page.mouse.up({button:mode==='right'?'right':'left'});if(mode!=='right')await page.keyboard.up(mode);
  await page.evaluate(()=>{for(let i=0;i<40;i++)city.controls.update()});const settled=await state();assert(distance(moved.target,settled.target)<.00001,'Pan must stop without trailing inertia');
  await page.waitForFunction(()=>!city.fastRender);assert.equal((await state()).ratio,1.75);
  results.push({mode,moved:Math.round(distance(before.target,moved.target)),residualPan:settled.pan});
 }
 await page.mouse.move(390,360);await page.mouse.down();await page.mouse.move(480,390,{steps:4});await page.mouse.up();
 const rotation=await page.evaluate(()=>{const before=city.camera.position.clone().sub(city.controls.target).normalize();city.controls.update();return before.distanceTo(city.camera.position.clone().sub(city.controls.target).normalize())});assert(rotation>1e-5,'Rotation must retain damping');
 await page.waitForFunction(()=>!city.fastRender);
 // Compare steady rendering with the interaction path on the same GPU/view.
 const fps=await page.evaluate(async()=>{
  const sample=()=>new Promise(resolve=>{let n=0,start;const frame=t=>{if(n===4)start=t;if(++n===25)resolve(Math.round(20000/(t-start)));else requestAnimationFrame(frame)};requestAnimationFrame(frame)});
  for(let i=0;i<160;i++)city.controls.update();const full=await sample();city.interacting=true;const drag=await sample();city.interacting=false;city.interactionUntil=0;return {full,drag};
 });
 await page.waitForFunction(()=>!city.fastRender);assert.deepEqual(errors,[]);console.log(JSON.stringify({results,rotationDamping:true,qualityRestored:true,fps,errors}));
} finally {await browser.close()}
