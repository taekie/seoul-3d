import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.CITY_TEST_URL||'http://localhost:8747/')+'?city=chapelhill');
 await p.waitForFunction(()=>window.city&&!document.querySelector('#load'),null,{timeout:90000});
 await p.click('[data-a=labels]');
 const cdp=await p.context().newCDPSession(p);
 const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id}))});
 const state=()=>p.evaluate(()=>({target:city.controls.target.toArray(),theta:city.controls.getAzimuthalAngle(),phi:city.controls.getPolarAngle(),radius:city.camera.position.distanceTo(city.controls.target),active:city.interacting}));
 const near=(a,b,eps=.0001)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
 const sameTarget=(a,b)=>a.target.forEach((v,i)=>near(v,b.target[i],.01));
 const gesture=async(from,to)=>{await send('touchStart',from);const a=await state();await send('touchMove',to);await send('touchEnd',[]);await p.waitForTimeout(150);return[a,await state()];};
 let [a,b]=await gesture([[150,350,1]],[[200,390,1]]);assert.notDeepEqual(a.target,b.target);near(a.theta,b.theta);near(a.phi,b.phi);near(a.radius,b.radius,.01);
 [a,b]=await gesture([[130,350,1],[250,350,2]],[[130,410,1],[250,410,2]]);assert(b.phi<a.phi-.1);near(a.theta,b.theta);near(a.radius,b.radius,.01);sameTarget(a,b);
 [a,b]=await gesture([[130,410,1],[250,410,2]],[[130,350,1],[250,350,2]]);assert(b.phi>a.phi+.1);near(a.theta,b.theta);
 [a,b]=await gesture([[130,370,1],[250,370,2]],[[148,328,1],[232,412,2]]);assert(b.theta>a.theta+.6);near(a.phi,b.phi);sameTarget(a,b);
 [a,b]=await gesture([[150,370,1],[230,370,2]],[[110,370,1],[270,370,2]]);assert(b.radius<a.radius*.6);near(a.theta,b.theta);near(a.phi,b.phi);sameTarget(a,b);
 [a,b]=await gesture([[110,370,1],[270,370,2]],[[150,370,1],[230,370,2]]);assert(b.radius>a.radius*1.5);near(a.theta,b.theta);near(a.phi,b.phi);
 [a,b]=await gesture([[130,350,1],[250,350,2]],[[155,350,1],[275,350,2]]);near(a.theta,b.theta);near(a.phi,b.phi);sameTarget(a,b);
 await send('touchStart',[[130,350,1],[250,350,2]]);a=await state();
 await p.evaluate(()=>{const [id]=city.controls._pointers;document.querySelector('#c').dispatchEvent(new PointerEvent('pointerup',{pointerId:id,pointerType:'touch',bubbles:true}));});
 b=await state();sameTarget(a,b);near(a.theta,b.theta);near(a.phi,b.phi);
 await p.evaluate(()=>{const id=city.controls._pointers[0],pos=city.controls._pointerPositions[id];document.querySelector('#c').dispatchEvent(new PointerEvent('pointermove',{pointerId:id,pointerType:'touch',clientX:pos.x+20,clientY:pos.y+30,bubbles:true}));});
 assert.notDeepEqual(b.target,(await state()).target);await send('touchCancel',[]);assert(!(await state()).active);
 // Google Maps quick zoom: double tap and keep the second touch down.
 for(const dy of [70,-70]){
   await p.waitForTimeout(400);await send('touchStart',[[180,370,1]]);await send('touchEnd',[]);
   await send('touchStart',[[180,370,1]]);a=await state();await send('touchMove',[[180,370+dy,1]]);await send('touchEnd',[]);b=await state();
   assert(dy>0?b.radius<a.radius:b.radius>a.radius);sameTarget(a,b);near(a.theta,b.theta);near(a.phi,b.phi);
 }
 await p.waitForTimeout(400);await send('touchStart',[[180,370,1]]);await send('touchEnd',[]);a=await state();await send('touchStart',[[180,370,1]]);await send('touchEnd',[]);assert((await state()).radius<a.radius*.7);
 const stopped=await state();await p.waitForTimeout(400);b=await state();sameTarget(stopped,b);near(stopped.theta,b.theta);near(stopped.phi,b.phi);
 assert.deepEqual(errors,[]);console.log('PASS: one finger pan; two finger vertical pitch, twist, pinch in/out; no horizontal orbit; finger transition, cancel and no drift; double-tap hold zoom in/out');
}finally{await browser.close();}
