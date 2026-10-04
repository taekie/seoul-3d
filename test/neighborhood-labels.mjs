import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8747/');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:180000});await p.waitForTimeout(400);
 const visible=()=>p.evaluate(()=>[...document.querySelectorAll('.map-label')].filter(e=>e.getAttribute('aria-hidden')==='false'&&+getComputedStyle(e).opacity>.9).map(e=>({name:e.textContent,id:e.dataset.poiId,category:e.dataset.category,rect:e.getBoundingClientRect().toJSON()})));
 assert.equal((await visible()).filter(x=>x.category!=='landmark').length,0,'Overview must not show local POIs');
 await p.evaluate(()=>city.placeCamera(127.042,37.545,3600,.78,-.2));await p.waitForTimeout(600);const seongsu=await visible();
 assert(seongsu.some(x=>x.category!=='landmark'));assert(seongsu.some(x=>/서울숲|뚝섬|성수/.test(x.name)));
 assert(seongsu.length<=20);
 for(let i=0;i<seongsu.length;i++)for(let j=i+1;j<seongsu.length;j++){const a=seongsu[i].rect,c=seongsu[j].rect;assert(!(a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top),'Visible labels must not overlap');}
 const chosen=seongsu.find(x=>x.category!=='landmark');await p.locator(`[data-poi-id="${chosen.id}"]`).click();assert.equal(await p.locator('#place-name').textContent(),chosen.name);
 await p.click('[data-t=night]');await p.waitForTimeout(2200);assert((await visible()).some(x=>x.category!=='landmark'));
 await p.click('[data-a=labels]');await p.waitForTimeout(250);assert.equal((await visible()).length,0);await p.click('[data-a=labels]');await p.waitForTimeout(350);assert((await visible()).length>0);
 await p.evaluate(()=>city.placeCamera(126.94,37.556,3600,.78,-.2));await p.waitForTimeout(500);const sinchon=await visible();assert(sinchon.some(x=>/연세|서강|신촌|이화|홍대|이대/.test(x.name)));assert(!sinchon.some(x=>x.id===chosen.id));
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(400);assert((await visible()).length<=9);
 await p.setViewportSize({width:1440,height:900});await p.goto('http://localhost:8747/?city=jeju');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:180000});await p.evaluate(()=>city.placeCamera(126.525968,33.512403,2500,.9,.1));await p.waitForTimeout(500);const jeju=await visible();assert(jeju.some(x=>x.category!=='landmark'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({seongsu:seongsu.map(x=>x.name),sinchon:sinchon.map(x=>x.name),jeju:jeju.map(x=>x.name),checks:'zoom levels, collision, click, theme, toggle, neighbourhood changes, mobile budget',errors}));
}finally{await b.close()}
