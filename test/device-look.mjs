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
 await p.goto('http://localhost:8747/?city=chapelhill');
 await p.waitForFunction(()=>window.deviceLook&&!document.getElementById('load'),null,{timeout:180000});
 const state=()=>p.evaluate(()=>({enabled:deviceLook.enabled,theta:city.controls.getAzimuthalAngle(),phi:city.controls.getPolarAngle(),target:city.controls.target.toArray(),radius:city.camera.position.distanceTo(city.controls.target),offset:city.camera.position.clone().sub(city.controls.target).normalize().toArray(),touch:city.controls.touches.ONE}));
 await p.click('[data-a=motion]');assert.equal((await state()).enabled,false);
 assert.match(await p.locator('#motion-status').textContent(),/허용되지/);
 assert(await p.evaluate(()=>permissionHadGesture));
 await p.evaluate(()=>sensorPermission='granted');const initial=await state();
 await p.click('[data-a=motion]');await p.waitForTimeout(250);assert((await state()).enabled);
 assert.equal(await p.locator('[data-a=motion]').getAttribute('aria-pressed'),'true');
 assert(distance(initial.offset,(await state()).offset)<.001,'Enable should preserve the current view');
 await p.evaluate(()=>sensorPose={alpha:0,beta:73,gamma:18});await p.waitForTimeout(650);
 const tilted=await state();assert(distance(initial.offset,tilted.offset)>.04,'Tilt should change viewing angle');
 assert(distance(initial.target,tilted.target)<.001);assert(Math.abs(initial.radius-tilted.radius)<.01);
 assert(Math.abs(tilted.theta-initial.theta)<=Math.PI/6+.01);assert(Math.abs(tilted.phi-initial.phi)<=Math.PI/10+.01);
 await p.click('#motion-recenter');await p.waitForTimeout(250);
 assert(distance(tilted.offset,(await state()).offset)<.004,'Recenter must not snap the camera');
 await p.click('[data-a=labels]');
 const cdp=await p.context().newCDPSession(p),beforePan=await state();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:370}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:235,y:420}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(650);
 const afterPan=await state();assert(distance(beforePan.target,afterPan.target)>10,'Single touch must pan while gyro is enabled');
 assert(distance(beforePan.offset,afterPan.offset)<.001);
 const beforePinch=await state();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:370},{x:240,y:370}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:370},{x:280,y:370}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(650);
 assert((await state()).radius<beforePinch.radius,'Pinch should zoom');
 const beforeLandscape=await state();await p.evaluate(()=>{mockAngle=90;window.dispatchEvent(new Event('orientationchange'));});await p.waitForTimeout(250);
 assert(distance(beforeLandscape.offset,(await state()).offset)<.003,'Screen rotation should recalibrate without jumping');
 await p.click('#compass');await p.waitForTimeout(1000);assert(Math.abs((await state()).theta)<.001,'North-up must not fight gyro');
 await p.click('[data-t=night]');await p.screenshot({path:'test/device-look-mobile.png'});
 const rects=await p.locator('#motion-panel,#tools,#compass').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
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
