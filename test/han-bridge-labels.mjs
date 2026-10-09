import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const output=await mkdtemp(join(tmpdir(),'seoul-bridge-labels-'));
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8747/?city=seoul');
 await page.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.querySelector('#load'),null,{timeout:150000});
 const bridges=await page.evaluate(()=>[...poiLabels.grid.values()].flat().filter(p=>p.category==='bridge').map(p=>({name:p.name,y:p.pos.y})));
 assert(bridges.length===28);assert.equal(new Set(bridges.map(p=>p.name)).size,bridges.length);
 for(const name of ['한강대교','반포대교·잠수교','성산대교','잠실대교','구리암사대교'])assert(bridges.some(p=>p.name===name),name);
 assert(bridges.every(p=>Number.isFinite(p.y)));
 await page.evaluate(()=>city.placeCamera(126.985,37.53,10500,.9,0));
 await page.waitForTimeout(800);
 const visible=await page.locator('[data-category=bridge]').evaluateAll(nodes=>nodes.filter(n=>n.getAttribute('aria-hidden')!=='true'&&Number(n.style.opacity)>0).map(n=>n.textContent));
 assert(visible.length>=3,`Bridge labels visible: ${visible}`);
 await page.screenshot({path:join(output,'han-bridge-names.png')});
 assert.deepEqual(errors,[]);console.log({pass:true,count:bridges.length,visible,output});
} finally {await browser.close();}
