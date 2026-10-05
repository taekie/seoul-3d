import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceAt,clockText} from '../rail-model.js';
import {chromium} from 'playwright';
const data=JSON.parse(readFileSync(new URL('../data/korea.rail.json',import.meta.url)));
assert.equal(data.trains.length,352);assert.equal(new Set(data.trains.map(t=>t.id)).size,data.trains.length);
const first=data.trains.find(t=>t.line==='gyeongbu'&&t.number===1);
assert.deepEqual(first.stops[0],['서울',313]);assert.deepEqual(first.stops.at(-1),['부산',470]);
assert.equal(serviceAt(first,312,0),null);assert.equal(serviceAt(first,470,0),null);
assert.equal(serviceAt(first,313,0).fraction,0);assert.equal(serviceAt(first,332,0).from,'광명');
for(const t of data.trains){assert(t.stops.length>1);assert(t.days.length);const p=data.paths[t.route];
 for(let i=1;i<t.stops.length;i++){assert(t.stops[i][1]>t.stops[i-1][1]);assert(p.includes(t.stops[i][0]));}
 const day=t.days[0],minute=(t.stops[0][1]+t.stops.at(-1)[1])/2;
 assert(serviceAt(t,minute%1440,(day+Math.floor(minute/1440))%7));
}
const overnight={days:[6],stops:[['서울',1410],['부산',1510]]};
assert.equal(serviceAt(overnight,30,0).fraction,.6);assert.equal(serviceAt(overnight,30,1),null);assert.equal(serviceAt(overnight,70,0),null);
assert.equal(clockText(1501),'01:01');
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://localhost:8747/?city=korea');
 await page.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:90000});
 assert(!requests.some(u=>u.endsWith('korea.rail.json')),'Rail must load on demand');
 await page.click('[data-a=rail]');await page.waitForFunction(()=>city.rail?.enabled);await page.waitForTimeout(2700);
 await page.click('#rail-play');
 assert(await page.evaluate(()=>city.rail.active.length>10));
 await page.screenshot({path:'test/rail-desktop.png'});
 await page.locator('#rail-time').fill('600');assert.equal(await page.locator('#rail-clock').textContent(),'10:00');
 await page.selectOption('#rail-line','gangneung');assert(await page.evaluate(()=>city.rail.active.every(x=>x.train.line==='gangneung')));
 await page.selectOption('#rail-day','5');assert(await page.evaluate(()=>city.rail.weekday===5));
 const id=await page.evaluate(()=>city.rail.active[0].train.id);await page.selectOption('#rail-train',id);
 assert(await page.evaluate(()=>city.rail.halo.visible));assert(!(await page.locator('#rail-focus').isDisabled()));
 await page.click('[data-t=night]');await page.waitForTimeout(400);
 assert(await page.evaluate(()=>city.groups.rail.visible&&city.rail.selected!==null&&city.rail.minute===600));
 await page.selectOption('#rail-line','all');await page.screenshot({path:'test/rail-night.png'});
 await page.click('#rail-play');const t=await page.evaluate(()=>city.rail.minute);await page.waitForTimeout(1100);assert(await page.evaluate(t=>city.rail.minute>t,t));
 await page.click('#rail-close');assert(await page.evaluate(()=>!city.rail.enabled&&!city.rail.playing&&!city.groups.rail.visible));
 await page.click('[data-a=population]');await page.waitForFunction(()=>city.population.enabled);
 await page.click('[data-a=rail]');await page.waitForFunction(()=>city.rail.enabled);assert(await page.evaluate(()=>!city.population.enabled));
 await page.click('[data-a=rain]');await page.waitForFunction(()=>city.rainfall.enabled,null,{timeout:90000});assert(await page.evaluate(()=>!city.rail.enabled));
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8747/?city=korea&rail=1');await page.waitForFunction(()=>city.rail?.enabled,null,{timeout:90000});await page.waitForTimeout(2700);
 await page.screenshot({path:'test/rail-mobile.png'});
 assert(await page.locator('#rail-panel').isVisible());
 assert(await page.evaluate(()=>{const a=document.querySelector('#rail-panel').getBoundingClientRect(),b=document.querySelector('#tools').getBoundingClientRect();return a.left>=0&&a.right<=innerWidth&&a.top>=0&&a.bottom<b.top&&b.right<=innerWidth;}));
 assert.deepEqual(errors,[]);
 console.log('PASS: 352 source records, day rules and overnight services, lazy load, timeline, playback, selection, themes, layer switching, deep link and mobile layout');
}finally{await browser.close();}
