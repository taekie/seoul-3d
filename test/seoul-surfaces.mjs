import{chromium}from'playwright';import assert from'node:assert/strict';
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8747/?city=seoul');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.getElementById('load'),null,{timeout:120000});
 console.log(await p.evaluate(()=>({rockPolygons:city.data.greens.filter(p=>p.t===6).length,coverSize:[city.surfaceCover.W,city.surfaceCover.H]})));
 assert(await p.evaluate(()=>{const a=city.groups.terrain.geometry.attributes.position.array,b=city.groups.greens.geometry.attributes.position.array;return a.length===b.length&&a.every((v,i)=>v===b[i])&&city.groups.greens.userData.terrainDraped;}),'Cover must use the exact terrain vertices, never span valleys');
 assert(await p.evaluate(()=>city.data.greens.some(p=>p.t===6)&&city.data.greens.some(p=>p.holes?.length)));
 assert(await p.evaluate(async()=>{const THREE=await import('three');const o=city.groups.landmarks.children.find(o=>o.userData.id==='seoulst');const b=new THREE.Box3().setFromObject(o),size=b.getSize(new THREE.Vector3());return size.z>size.x*2;}),'Old station long axis must run north–south');
 assert(await p.evaluate(async()=>{const {prepareSurfaceCover}=await import('./surface-cover.js');const cover=prepareSurfaceCover({terrain:{minX:0,maxX:10,minY:0,maxY:10},data:{greens:[{t:1,r:[0,0,10,0,10,10,0,10],holes:[[3,3,7,3,7,7,3,7]]},{t:6,r:[4,4,6,4,6,6,4,6]}]}});return cover.kindAt(1,1)===1&&cover.kindAt(3.5,3.5)===-1&&cover.kindAt(5,5)===6;}),'Polygon holes must remain empty and explicit bare rock must override forest');
 await p.evaluate(()=>city.flyTo(126.951,37.439,5200,.85,-.3,10));await p.waitForTimeout(700);await p.screenshot({path:'test/surfaces-gwanak.png'});
 await p.evaluate(()=>city.flyTo(126.979,37.658,4500,.85,-.3,10));await p.waitForTimeout(700);await p.screenshot({path:'test/surfaces-bukhansan.png'});
 const before=await p.evaluate(()=>city.renderer.info.memory.textures);
 await p.click('[data-t=night]');await p.waitForTimeout(400);await p.click('[data-t=day]');await p.waitForTimeout(400);
 assert(await p.evaluate(before=>city.renderer.info.memory.textures<=before+1,before),'Theme changes must dispose surface textures');
 await p.evaluate(()=>city.flyTo(126.972,37.556,2200,1.15,0,10));await p.waitForTimeout(700);await p.screenshot({path:'test/surfaces-station.png'});
 assert.deepEqual(errors,[]);console.log('PASS: terrain-conforming cover, rock polygons and holes, station orientation, theme disposal, no browser errors');
}finally{await b.close()}
