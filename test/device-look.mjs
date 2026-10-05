import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
try{
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
   window.sensorPermission='denied';window.sensorPose={alpha:0,beta:60,gamma:0};window.mockAngle=0;
   window.DeviceOrientationEvent={requestPermission:async()=>{
     window.permissionHadGesture=navigator.userActivation.isActive;
     if(window.sensorPermission==='throw')throw new Error('Blocked');
     return window.sensorPermission;
   }};
   Object.defineProperty(screen.orientation,'angle',{configurable:true,get:()=>window.mockAngle});
   window.emitSensor=()=>{
     const e=new Event('deviceorientation');Object.assign(e,window.sensorPose);window.dispatchEvent(e);
   };
   window.sensorInterval=setInterval(window.emitSensor,100);
 });
 await p.goto((process.env.CITY_TEST_URL||'http://localhost:8747/')+'?city=chapelhill');
 await p.click('#lm-btn');assert(await p.locator('#panel').isVisible());
 await p.click('#lm-btn');assert(!(await p.locator('#panel').isVisible()));
 await p.waitForFunction(()=>window.deviceLook&&!document.getElementById('load'),null,{timeout:180000});
 const state=()=>p.evaluate(()=>({enabled:deviceLook.enabled,theta:city.controls.getAzimuthalAngle(),phi:city.controls.getPolarAngle(),target:city.controls.target.toArray(),radius:city.camera.position.distanceTo(city.controls.target),offset:city.camera.position.clone().sub(city.controls.target).normalize().toArray(),touch:city.controls.touches.ONE}));
 await p.click('[data-a=motion]');assert.equal((await state()).enabled,false);
 assert.match(await p.locator('#motion-status').textContent(),/허용되지/);
 assert(await p.evaluate(()=>permissionHadGesture));
 await p.evaluate(()=>sensorPermission='granted');const initial=await state();
 await p.click('[data-a=motion]');await p.waitForTimeout(250);assert((await state()).enabled);
 assert.equal(await p.locator('[data-a=motion]').getAttribute('aria-pressed'),'true');
 assert(distance(initial.offset,(await state()).offset)<.001,'Enable should preserve the current view');
 await p.evaluate(()=>sensorPose={alpha:0,beta:40,gamma:0});await p.waitForTimeout(1200);
 assert((await state()).phi<initial.phi-.1,'Lowering the phone must produce a more overhead view');
 await p.evaluate(()=>sensorPose={alpha:0,beta:73,gamma:18});await p.waitForTimeout(1200);
 const tilted=await state();assert(distance(initial.offset,tilted.offset)>.04,'Tilt should change viewing angle');
 assert(tilted.phi>initial.phi+.05,'Raising the phone must produce a lower viewing angle');
 assert(distance(initial.target,tilted.target)<.001);assert(Math.abs(initial.radius-tilted.radius)<.01);
 assert(Math.abs(tilted.theta-initial.theta)<=Math.PI/6+.01);assert(Math.abs(tilted.phi-initial.phi)<=Math.PI/10+.01);
 assert(await p.locator('#motion-panel').isHidden());await p.evaluate(()=>deviceLook.calibrate());await p.waitForTimeout(250);
 assert(distance(tilted.offset,(await state()).offset)<.004,'Recenter must not snap the camera');
 const moveBox=await p.locator('#motion-move').boundingBox();
 assert(moveBox.y+moveBox.height< (await p.locator('#compass').boundingBox()).y);
 await p.mouse.move(moveBox.x+moveBox.width/2,moveBox.y+moveBox.height/2);await p.mouse.down();
 const beforeMove=await state();await p.evaluate(()=>sensorPose={alpha:0,beta:58,gamma:35});await p.waitForTimeout(1000);
 const moved=await state();assert(distance(beforeMove.target,moved.target)>10,'Held tilt must pan');
 assert(moved.radius<beforeMove.radius,'Held downward tilt must zoom in');
 assert(distance(beforeMove.offset,moved.offset)<.001,'Held mode must preserve view angle');
 await p.mouse.up();const released=await state();await p.waitForTimeout(400);
 assert(distance(released.target,(await state()).target)<.001,'Release must stop movement');
 assert(Math.abs(released.radius-(await state()).radius)<.01,'Release must stop zoom');
 assert(distance(released.offset,(await state()).offset)<.001,'Release must rebase without snapping');
 await p.mouse.down();await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await p.evaluate(()=>deviceLook.moving),false);await p.mouse.up();
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
 await p.click('[data-a=labels]');
 const cdp=await p.context().newCDPSession(p),beforePan=await state();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:370}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:235,y:420}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(1200);
 const afterPan=await state();assert(distance(beforePan.target,afterPan.target)>10,'Single touch must pan while gyro is enabled');
 assert(distance(beforePan.offset,afterPan.offset)<.001);
 const beforePinch=await state();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:370},{x:240,y:370}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:370},{x:280,y:370}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(1200);
 assert((await state()).radius<beforePinch.radius,'Pinch should zoom');
 const beforeLandscape=await state();await p.evaluate(()=>{mockAngle=90;window.dispatchEvent(new Event('orientationchange'));});await p.waitForTimeout(250);
 assert(distance(beforeLandscape.offset,(await state()).offset)<.003,'Screen rotation should recalibrate without jumping');
 await p.click('#compass');await p.waitForTimeout(1000);assert(Math.abs((await state()).theta)<.001,'North-up must not fight gyro');
 await p.click('[data-t=night]');await p.screenshot({path:'test/device-look-mobile.png'});
 const rects=await p.locator('#motion-move,#tools,#compass').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
 for(const a of rects){assert(a.left>=0&&a.right<=390);}
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert(!(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top),'Sensor UI must not overlap other controls');}
 await p.click('[data-a=motion]');assert.equal((await state()).touch,initial.touch);
 const stopped=await state();await p.evaluate(()=>sensorPose={alpha:200,beta:-80,gamma:80});await p.waitForTimeout(300);assert(distance(stopped.offset,(await state()).offset)<.001);
 await p.evaluate(()=>Object.defineProperty(window,'isSecureContext',{configurable:true,value:false}));await p.click('[data-a=motion]');assert.match(await p.locator('#motion-status').textContent(),/HTTPS/);
 await p.evaluate(()=>Object.defineProperty(window,'isSecureContext',{configurable:true,value:true}));
 await p.evaluate(()=>sensorPermission='throw');await p.click('[data-a=motion]');assert.equal((await state()).enabled,false);assert.match(await p.locator('#motion-status').textContent(),/접근하지 못/);
 await p.evaluate(()=>{sensorPermission='granted';clearInterval(sensorInterval);sensorPose={alpha:null,beta:null,gamma:null};});
 await p.click('[data-a=motion]');await p.evaluate(()=>emitSensor());await p.waitForTimeout(6300);assert.equal((await state()).enabled,false);assert.match(await p.locator('#motion-status').textContent(),/신호가 없/);
 assert.deepEqual(errors,[]);console.log('PASS: permission gesture/denial/error, HTTPS guidance, tilt bounds, no initial jump, pan/pinch, recalibration/screen rotation, compass, disable restoration, absent sensor timeout, mobile/night UI');
}finally{await browser.close()}
