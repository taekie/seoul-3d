import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const output=await mkdtemp(join(tmpdir(),'seoul-map-export-'));
const browser=await chromium.launch({args:process.env.CITY_TEST_GPU==='metal'?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const context=await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8747/?city=seoul');
 await page.waitForFunction(()=>window.city?.life&&!document.getElementById('load'),null,{timeout:180000});
 await page.waitForFunction(()=>!city.fastRender);
 await page.waitForFunction(()=>window.poiLabels?.stats.loaded);
 const poiStyle=await page.evaluate(()=>{
  const all=[...poiLabels.grid.values()].flat(),hotels=all.filter(p=>p.category==='hotel'),hospitals=all.filter(p=>p.category==='hospital');
  const mountain=all.find(p=>p.category==='mountain'),hotel=hotels[0];
  const m=poiLabels.node(mountain).el,h=poiLabels.node(hotel).el;
  return {hotels:hotels.length,hospitals:hospitals.length,verified:hotels.every(p=>p.stars===5&&p.validUntil>=new Date().toISOString().slice(0,10)),mountainIcon:!!m.querySelector('.mountain-icon'),hotelIcon:!!h.querySelector('svg,.poi-dot'),bullets:document.querySelectorAll('.poi-dot').length,background:getComputedStyle(h).backgroundColor,mountainFill:getComputedStyle(m.querySelector('svg')).fill,apartments:all.filter(p=>p.category==='apartment').length,stationLines:poiLabels.node(all.find(p=>p.name==='강남역')).el.querySelector('.station-lines').textContent};
 });
 assert.equal(poiStyle.hotels,35);assert.equal(poiStyle.hospitals,14);assert(poiStyle.verified);assert(poiStyle.mountainIcon);assert(!poiStyle.hotelIcon);assert.equal(poiStyle.bullets,0);assert(poiStyle.background.includes('0.35'));assert.equal(poiStyle.mountainFill,'rgb(85, 133, 71)');assert(poiStyle.apartments>=60);assert(poiStyle.stationLines.includes('2'));assert(poiStyle.stationLines.includes('신분당'));
 const scaling=await page.evaluate(async()=>{
  const {HEIGHT_EXAGGERATION}=await import('/miniature.js');
  const lm=city.landmarks[0],object=city.groups.landmarks.children[0],expected=lm.s??[1.7,2.6];
  const water=city.groups.water;
  const ground=city.groups.terrain.geometry.attributes.position;
  let terrainError=0;
  for(let i=0;i<ground.count;i+=Math.max(1,Math.floor(ground.count/50))){const x=ground.getX(i)+city.groups.terrain.position.x,y=-ground.getZ(i)-city.groups.terrain.position.z;terrainError=Math.max(terrainError,Math.abs(ground.getY(i)-city.terrain.maskedAt(x,y)*HEIGHT_EXAGGERATION));}
  // Sample actual building transforms against their source height and terrain.
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3();let buildings=0;
  const {landmarkClearings}=await import('/landmarks.js');
  const raw=city.bld,U=city.unit,skip=landmarkClearings(city.landmarks).map(l=>({x:city.lonToX(l.lon),y:city.latToY(l.lat),r:l.clear}));
  const {inPlaza}=await import('/city-life.js');
  for(let i=0;i<raw.length/6&&buildings<30;i++){
   const x=raw[i*6]*U,y=raw[i*6+1]*U,h=raw[i*6+5];if(inPlaza(city,x,y)||skip.some(s=>(x-s.x)**2+(y-s.y)**2<s.r**2))continue;
   city.groups.buildings.getMatrixAt(buildings,m);m.decompose(pos,q,scale);
   if(Math.abs(scale.y-(h*HEIGHT_EXAGGERATION+6))>.01||Math.abs(pos.y-(city.terrain.at(x,y)*HEIGHT_EXAGGERATION-6))>.01)throw Error('Building scaling mismatch');buildings++;
  }
  return {factor:HEIGHT_EXAGGERATION,landmark:[object.scale.x,object.scale.y],expected:[expected[0]*.81,expected[1]*2.5/3*.9],terrainError,buildings,water:!!water};
 });
 assert.equal(scaling.factor,2.5);scaling.landmark.forEach((v,i)=>assert(Math.abs(v-scaling.expected[i])<1e-6));assert(scaling.terrainError<.02);assert.equal(scaling.buildings,30);
 // A bright DOM overlay must not appear in the exported scene.
 await page.evaluate(()=>{const overlay=document.createElement('div');overlay.id='capture-test-overlay';overlay.style='position:fixed;inset:100px;z-index:4;background:rgb(255,0,255);pointer-events:none';document.body.append(overlay)});
 const before=await page.evaluate(()=>({position:city.camera.position.toArray(),target:city.controls.target.toArray(),width:city.renderer.domElement.width,height:city.renderer.domElement.height}));
 await page.click('#map-export-btn');await page.waitForFunction(()=>!document.getElementById('export-download').hidden);
 const snapshot=await page.evaluate(async()=>{
  const image=document.getElementById('export-preview');await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let magenta=0,min=255,max=0;
  for(let i=0;i<data.length;i+=400){if(data[i]>240&&data[i+1]<15&&data[i+2]>240)magenta++;min=Math.min(min,data[i]);max=Math.max(max,data[i]);}
  return {width:c.width,height:c.height,magenta,min,max,position:city.camera.position.toArray(),target:city.controls.target.toArray()};
 });
 assert.equal(snapshot.width,before.width);assert.equal(snapshot.height,before.height);assert.equal(snapshot.magenta,0);assert(snapshot.max-snapshot.min>100,'Capture must contain real rendered content');assert.deepEqual(snapshot.position,before.position);assert.deepEqual(snapshot.target,before.target);
 const downloaded=page.waitForEvent('download');await page.click('#export-download');const download=await downloaded;assert.match(download.suggestedFilename(),/^seoul-3d-\d{8}-\d{6}-\d{3}\.png$/);await download.saveAs(join(output,download.suggestedFilename()));const png=await readFile(join(output,download.suggestedFilename()));assert.equal(png.subarray(1,4).toString(),'PNG');assert(png.length>50000);
 await page.click('#export-copy');const prompt=await page.evaluate(()=>navigator.clipboard.readText());assert(prompt.includes('Artistic watercolor sky and clouds are welcome'));assert(prompt.includes('Preserve the exact camera angle'));
 await page.screenshot({path:join(output,'desktop.png')});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#map-export').evaluate(d=>d.open),false);await page.evaluate(()=>document.getElementById('capture-test-overlay').remove());
 // Clipboard denial must leave usable selected text; mobile controls stay in view.
 await page.setViewportSize({width:390,height:844});await page.click('[data-t=night]');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied')}}}));
 await page.click('#map-export-btn');await page.waitForFunction(()=>!document.getElementById('export-download').hidden);await page.click('#export-copy');
 assert.equal(await page.locator('#map-export details').evaluate(d=>d.open),true);
 assert(await page.locator('#export-prompt').evaluate(t=>t.selectionEnd-t.selectionStart===t.value.length));
 const rect=await page.locator('#map-export').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=391);assert(rect.height<=813);
 const button=await page.locator('#map-export-btn').boundingBox();assert(button.x>=0&&button.x+button.width<=390);
 await page.screenshot({path:join(output,'mobile.png')});await page.click('#export-close');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,scaling,capture:snapshot,downloadBytes:png.length,clipboard:true,fallback:true,mobile:true,output}));
} finally {await browser.close()}
