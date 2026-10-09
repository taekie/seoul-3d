import {chromium} from 'playwright';import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const output=await mkdtemp(join(tmpdir(),'seoul-landmarks-')),ids=['gimpo','botanic','gyeongbok','changdeok','deoksu','peacegate','artscenter','snugate','lonetree','nationalmuseum','independence','childcoaster','elephanttrain','gwacheonscience','supremecourt','nationallibrary','expressbus','gocheokdome'];
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8747/test/landmark-gallery.html?city=seoul');await p.waitForFunction(()=>window.ready,null,{timeout:90000});
 const gallery=await p.evaluate(()=>report);assert.equal(gallery.length,31);for(const id of ids){const m=gallery.find(m=>m.id===id);assert(m?.valid);assert(m.meshes<14);assert(m.triangles<30000);}
 await p.screenshot({path:join(output,'gallery.png'),fullPage:true});
 await p.goto('http://127.0.0.1:8747/?city=seoul');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.querySelector('#load'),null,{timeout:150000});
 const geometry=await p.evaluate(async ids=>{
  const {landmarkClearings}=await import('/landmarks.js');
  const snapshots=[];
  for(const id of ids){const i=city.landmarks.findIndex(l=>l.id===id),l=city.landmarks[i],obj=city.groups.landmarks.children[i];
   const bound=new THREE.Box3().setFromObject(obj),size=bound.getSize(new THREE.Vector3());
   if(!Number.isFinite(size.length())||size.length()<=0)throw Error(id+' invalid bounds');
   if(Math.abs(obj.position.x-city.lonToX(l.lon))>.001||Math.abs(obj.position.z+city.latToY(l.lat))>.001)throw Error(id+' misplaced');
   const xy=new THREE.Vector3(),scale=new THREE.Vector3(),q=new THREE.Quaternion(),m=new THREE.Matrix4();
   for(let k=0;k<city.groups.buildings.count;k++){city.groups.buildings.getMatrixAt(k,m);m.decompose(xy,q,scale);if(landmarkClearings([l]).some(f=>(xy.x-city.lonToX(f.lon))**2+(-xy.z-city.latToY(f.lat))**2<f.clear**2))throw Error(id+' duplicate generic building');}
   snapshots.push({id,meshes:obj.children.length,size:size.toArray(),features:l.features?.length??0,aircraftCount:obj.userData.aircraftCount??0});
  }
  return snapshots;
 },ids);
 const gimpo=geometry.find(l=>l.id==='gimpo');assert.equal(gimpo.aircraftCount,1);assert(gimpo.size[0]>550&&gimpo.size[2]>550,'Runway airplane must read as an oversized landmark');console.log(geometry);
 for(const id of ['expressbus']){await p.evaluate(id=>{const l=city.landmarks.find(l=>l.id===id);city.focusLandmark(l,l.bearing??0);},id);await p.waitForTimeout(2100);if(id==='gimpo'){const visible=await p.evaluate(()=>{const airplane=city.groups.landmarks.children.find(o=>o.userData.id==='gimpo');const target=new THREE.Box3().setFromObject(airplane).getCenter(new THREE.Vector3());const ray=new THREE.Raycaster(city.camera.position.clone(),target.sub(city.camera.position).normalize());const jet=ray.intersectObject(airplane,true)[0],building=ray.intersectObject(city.groups.buildings,true)[0];return !!jet&&(!building||building.distance>jet.distance);});assert(visible,'Airplane must be visible, not inside or behind a generic terminal box');}await p.screenshot({path:join(output,id+'.png')});}
 await p.click('[data-t=night]');await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>city.groups.landmarks.children.length),31);await p.screenshot({path:join(output,'artscenter-night.png')});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,output,models:ids.length,dayAndNight:true}));
}finally{await b.close();}
