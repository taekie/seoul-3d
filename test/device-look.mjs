import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
   window.sensorPermission='granted';window.mockAngle=0;window.sensorPose={alpha:0,beta:60,gamma:0};
   window.DeviceOrientationEvent={requestPermission:()=>{window.permissionHadGesture=navigator.userActivation.isActive;return window.sensorPermission==='pending'?new Promise(r=>window.resolvePermission=r):Promise.resolve(window.sensorPermission);}};
   Object.defineProperty(screen.orientation,'angle',{configurable:true,get:()=>window.mockAngle});
   window.emitSensor=()=>{const e=new Event('deviceorientation');Object.assign(e,window.sensorPose);window.dispatchEvent(e);};
   window.sensorInterval=setInterval(emitSensor,50);
 });
 await p.goto((process.env.CITY_TEST_URL||'http://localhost:8747/')+'?city=chapelhill');
 await p.waitForFunction(()=>window.deviceLook&&!document.querySelector('#load'),null,{timeout:180000});
 const state=()=>p.evaluate(()=>({enabled:deviceLook.enabled,pending:deviceLook.pending,phi:city.controls.getPolarAngle(),target:city.controls.target.toArray(),radius:city.camera.position.distanceTo(city.controls.target)}));
 const hold=async selector=>{const r=await p.locator(selector).boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.waitForTimeout(150);};
 assert(await p.locator('#motion-look').isVisible());assert(await p.locator('#motion-move').isVisible());
 assert.equal(await p.locator('#tools [data-a=motion],#tools [data-a=tour]').count(),0);
 const initial=await state();await hold('#motion-look');assert((await state()).enabled);assert(await p.evaluate(()=>permissionHadGesture));
 await p.evaluate(()=>sensorPose.beta=40);await p.waitForTimeout(500);assert((await state()).phi<initial.phi-.1);
 await p.mouse.up();const stopped=await state();assert(!stopped.enabled);
 await p.evaluate(()=>sensorPose.beta=80);await p.waitForTimeout(250);assert.equal((await state()).phi,stopped.phi);
 assert(await p.locator('#motion-panel').isHidden());
 await hold('#motion-move');const before=await state();await p.evaluate(()=>sensorPose={alpha:0,beta:65,gamma:15});await p.waitForTimeout(500);
 const after=await state();assert(after.radius<before.radius);assert.notDeepEqual(after.target,before.target);assert(Math.abs(after.phi-before.phi)<.001);
 await p.mouse.up();assert(!(await state()).enabled);
 await hold('#motion-look');
 // Isolate each physical sensor axis: the former combined-motion test missed cross-talk.
 const axisResults=await p.evaluate(()=>{
   const results=[];clearInterval(sensorInterval);
   for(const angle of [0,90,-90,180])for(const action of ['right','left','down','up','heading']){
     mockAngle=angle;sensorPose={alpha:125,beta:45,gamma:10};emitSensor();deviceLook.beginMove();
     const target=city.controls.target.clone(),offset=city.camera.position.clone().sub(target),radius=offset.length();
     const right=city.camera.matrix.elements.slice(0,3);right[1]=0;
     const poses={0:{right:[0,15],down:[-15,0]},90:{right:[15,0],down:[0,15]},'-90':{right:[-15,0],down:[0,-15]},180:{right:[0,-15],down:[15,0]}};
     let delta=poses[angle][action==='left'?'right':action==='up'?'down':action]||[0,0];
     if(action==='left'||action==='up')delta=delta.map(x=>-x);
     sensorPose={alpha:action==='heading'?205:125,beta:45+delta[0],gamma:10+delta[1]};emitSensor();
     for(let i=0;i<20;i++){deviceLook.lastFrame=performance.now()-50;deviceLook.update(performance.now());}
     const shift=city.controls.target.clone().sub(target);
     results.push({angle,action,pan:shift.length(),right:shift.x*right[0]+shift.z*right[2],zoom:city.camera.position.distanceTo(city.controls.target)/radius});
     deviceLook.releaseMove();
   }
   mockAngle=0;sensorPose={alpha:0,beta:60,gamma:0};emitSensor();deviceLook.calibrate();sensorInterval=setInterval(emitSensor,100);
   return results;
 });
 for(const r of axisResults){
   if(r.action==='right'||r.action==='left'){assert(Math.abs(r.zoom-1)<1e-6,JSON.stringify(r));assert(r.action==='right'?r.right>1:r.right< -1,JSON.stringify(r));}
   else {assert(r.pan<.001,JSON.stringify(r));if(r.action==='down')assert(r.zoom<.95,JSON.stringify(r));else if(r.action==='up')assert(r.zoom>1.05,JSON.stringify(r));else assert(Math.abs(r.zoom-1)<1e-6,JSON.stringify(r));}
 }
 console.log('PASS: isolated left/right, up/down and compass heading at 0/90/-90/180 screen angles');

 await p.mouse.up();
 await hold('#motion-move');await p.evaluate(()=>document.querySelector('#motion-move').dispatchEvent(new Event('pointercancel')));assert(!(await state()).enabled);await p.mouse.up();
 await p.locator('#motion-look').focus();await p.keyboard.down('Space');await p.waitForTimeout(100);assert((await state()).enabled);await p.keyboard.up('Space');assert(!(await state()).enabled);
 await p.evaluate(()=>sensorPermission='pending');await hold('#motion-look');assert((await state()).pending);await p.mouse.up();await p.evaluate(()=>resolvePermission('granted'));await p.waitForTimeout(100);assert(!(await state()).enabled,'Permission resolving after release must not latch mode');
 await p.evaluate(()=>sensorPermission='denied');await hold('#motion-move');assert(!(await state()).enabled);await p.mouse.up();
 await p.evaluate(()=>sensorPermission='granted');await hold('#motion-look');await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert(!(await state()).enabled);await p.mouse.up();
 const cdp=await p.context().newCDPSession(p),touchRect=await p.locator('#motion-look').boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchRect.x+20,y:touchRect.y+20}]});await p.waitForTimeout(100);assert((await state()).enabled);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(!(await state()).enabled);
 await p.click('#lm-btn');assert(await p.locator('#panel [data-a=tour]').isVisible());await p.click('#panel [data-a=tour]');assert.equal(await p.locator('[data-a=tour]').getAttribute('aria-pressed'),'true');await p.click('#panel [data-a=tour]');assert.equal(await p.locator('[data-a=tour]').getAttribute('aria-pressed'),'false');
 await p.click('#lm-btn');
 const rects=await p.locator('#motion-controls,#compass,#tools').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
 for(const a of rects)assert(a.left>=0&&a.right<=390);
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert(!(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));}
 await p.screenshot({path:'test/device-look-mobile.png'});assert.deepEqual(errors,[]);
 console.log('PASS: hold look/move, release/cancel/blur, keyboard, permission race/denial, independent axes, popup tour, mobile layout');
}finally{await b.close();}
