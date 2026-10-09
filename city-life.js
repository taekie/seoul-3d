import * as THREE from 'three';
import { clay, waterAt, HEIGHT_EXAGGERATION as EXAG } from './miniature.js';
import {buildBridgeTrains} from './bridge-trains.js';

export const detailSeed = (x,y) => {
  const n=Math.sin(x*12.9898+y*78.233)*43758.5453;return n-Math.floor(n);
};
export function inPlaza(city,x,y) {
  const p=city.plaza;
  return p && Math.abs(x-p.x)<158 && y<p.y-78 && y>p.y-900;
}
const boxGeo=new THREE.BoxGeometry(1,1,1);
function boxes(items, material=clay()) {
  const mesh=new THREE.InstancedMesh(boxGeo.clone(),material,items.length);
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  items.forEach((v,i)=>{
    q.setFromAxisAngle(axis,v.angle??0);
    m.compose(new THREE.Vector3(...v.p),q,new THREE.Vector3(...v.s));mesh.setMatrixAt(i,m);
    if(v.color)mesh.setColorAt(i,new THREE.Color(v.color));
  });
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.receiveShadow=true;return mesh;
}
const part=(g,p,s,color,emissive=0)=>{
  const m=new THREE.Mesh(boxGeo.clone(),clay({color,emissive,emissiveIntensity:1.5}));
  m.position.set(...p);m.scale.set(...s);g.add(m);return m;
};
let glowTexture;
function glow() {
  if(glowTexture)return glowTexture;
  const canvas=new OffscreenCanvas(64,64),ctx=canvas.getContext('2d');
  const grad=ctx.createRadialGradient(32,32,0,32,32,32);
  grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.18,'rgba(255,232,175,.65)');grad.addColorStop(1,'rgba(255,215,150,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);glowTexture=new THREE.CanvasTexture(canvas);return glowTexture;
}
function buildingDetails(city,group,night) {
  const roofItems=[],gardens=[],windows=[],gableItems=[];
  for(const b of city.detailBuildings) {
    const {x,y,w,d,h,gy,ang,seed}=b,angle=-ang*Math.PI/180,top=gy+h*EXAG;
    const local=(lx,ly,lz)=>[x+Math.cos(angle)*lx+Math.sin(angle)*lz,ly,-y-Math.sin(angle)*lx+Math.cos(angle)*lz];
    if(h<30&&w<70&&d<70&&seed<.09) {
      gableItems.push({p:[x,top,-y],s:[w*1.05,Math.min(16,Math.min(w,d)*.42),d*1.05],angle,color:night?'#48565b':['#dc9e85','#84bdb5','#e1c18c'][Math.floor(seed*1000)%3]});
    } else if(w>19&&d>17&&h<120&&seed<.13) {
      roofItems.push({p:[x,top+1.5,-y],s:[w*.93,3,d*.93],angle,color:night?'#475658':'#fff3dd'});
      gardens.push({p:[x,top+3.4,-y],s:[w*.68,1.2,d*.64],angle,color:night?'#32594a':'#8fc883'});
      roofItems.push({p:local(w*.29,top+5,d*.2),s:[w*.2,6,d*.22],angle,color:night?'#58656a':'#dce7df'});
    } else if(h>=30&&w>10&&d>10) {
      roofItems.push({p:[x,top+4,-y],s:[w*.42,8,d*.35],angle,color:night?'#465b65':'#d4e5dd'});
    }
    if(!night||h<9||w<9||d<9)continue;
    const rows=Math.min(5,Math.max(1,Math.floor(h/8))),cols=Math.min(3,Math.max(1,Math.floor(w/12)));
    for(let side of [-1,1])for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
      if(detailSeed(x+row*31+side*13,y+col*17)>.42)continue;
      const lx=(col-(cols-1)/2)*w/(cols+1),ly=gy+7+(row+.5)*(h*EXAG-12)/rows;
      windows.push({p:local(lx,ly,side*(d*.5+.7)),s:[Math.min(5,w/(cols+1)*.45),Math.min(7,h*1.1/rows),.6],angle,color:row%3?'#ffd58c':'#ffeab8'});
    }
  }
  // Triangular prism with a ridge along its length; bottom is at the original roof.
  const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,1);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});geo.translate(0,0,-.5);
  const roofs=boxes(gableItems);roofs.geometry.dispose();roofs.geometry=geo;roofs.castShadow=true;group.add(roofs);
  const flat=boxes(roofItems);flat.castShadow=true;group.add(flat,boxes(gardens));
  if(windows.length) group.add(boxes(windows,clay({color:'#fff6de',emissive:'#ffbf62',emissiveIntensity:2.6,roughness:.8})));
  return {gable:gableItems.length,garden:gardens.length,roofStructures:roofItems.length,windows:windows.length};
}
function plaza(city,group,lamps) {
  if(!city.plaza)return;
  const {x,y}=city.plaza,items=[];
  const height=(dx,dz)=>city.terrain.at(x+dx,y-dz)*EXAG+5;
  for(let i=0;i<24;i++) {
    const dz=100+i*32;
    items.push({p:[x,height(0,dz),-y+dz],s:[265,4,31.6],color:i%3?'#e8e2d3':'#faf4e8'});
    for(let side of [-1,1])items.push({p:[x+side*139,height(side*139,dz)+1,-y+dz],s:[9,5,32],color:'#bbd4b2'});
  }
  for(let i=0;i<9;i++)for(let side of [-1,1]) {
    const dx=side*112,dz=140+i*80,h=height(dx,dz);
    items.push({p:[x+dx,h+7,-y+dz],s:[11,5,26],color:'#c39166'});
    items.push({p:[x+dx+side*5,h+13,-y+dz],s:[3,10,26],color:'#c39166'});
    if(i%2===0)lamps.push([x+side*144,h,-y+dz]);
  }
  // A quiet fountain pool and a small central monument, deliberately schematic.
  const dz=530,h=height(0,dz);
  items.push({p:[x,h+2,-y+dz],s:[68,6,104],color:'#f4efe2'},
    {p:[x,h+5.5,-y+dz],s:[57,1,91],color:'#5fc5d1'},
    {p:[x,height(0,325)+8,-y+325],s:[28,16,28],color:'#f5e9cf'},
    {p:[x,height(0,325)+24,-y+325],s:[12,20,12],color:'#ba9b56'});
  const mesh=boxes(items);mesh.castShadow=true;group.add(mesh);
}
function streetLights(group,lamps,night) {
  const poles=[],bulbs=[],positions=[],pools=[];
  for(const [x,y,z] of lamps) {
    poles.push({p:[x,y+16,z],s:[2,32,2],color:night?'#617477':'#8ca6a2'}, {p:[x+4,y+32,z],s:[10,2,2],color:'#8ca6a2'});
    bulbs.push({p:[x+8,y+30,z],s:[5,3,5],color:night?'#ffe3a1':'#fff6df'});
    positions.push(x+8,y+30,z);pools.push({p:[x+8,y+1,z],s:[35,.15,35]});
  }
  group.add(boxes(poles),boxes(bulbs,clay({color:'#ffe9bc',emissive:night?'#ffc56c':'#000000',emissiveIntensity:2})));
  if(!night)return;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  group.add(new THREE.Points(geo,new THREE.PointsMaterial({map:glow(),color:'#ffca7a',size:46,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending})));
  const geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
  const lights=boxes(pools,new THREE.MeshBasicMaterial({map:glow(),color:'#ffd68a',transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending}));
  lights.geometry.dispose();lights.geometry=geometry;group.add(lights);
}
function vehicle(bus,color,night,type=bus?'bus':'sedan') {
  const g=new THREE.Group(),length={sedan:21,suv:25,bus:40,truck:36}[type];
  const cabinY=type==='sedan'?10:type==='suv'?12:15;
  part(g,[0,5,0],[9,7,length],color);
  if(type==='truck') {
    part(g,[0,11,-11],[10,12,11],color);
    part(g,[0,13,6],[11,17,23],'#e7e4d9');
    part(g,[0,14,-16.6],[8,4,.7],'#43757e');
  } else {
    part(g,[0,cabinY,type==='bus'?0:-1],[type==='bus'?9:8,type==='bus'?12:type==='suv'?7:5,length*(type==='bus'?1:.64)],type==='bus'?color:'#eff7ef');
    part(g,[0,cabinY,type==='bus'?-length*.5-.3:-length*.33],[type==='bus'?8:7,type==='bus'?7:3,type==='bus'?.5:1],'#43757e');
    if(type==='bus') {
      part(g,[0,6,-length*.5-.3],[8,1,.5],'#45565b');
      part(g,[0,22,3],[7,2,8],'#e5eee9');
    }
  }
  for(let side of [-1,1]) {
    if(type==='bus')for(let z=-15;z<=15;z+=6)part(g,[side*4.6,16,z],[.4,5,4],'#467c88');
    else if(type!=='truck')part(g,[side*4.1,cabinY,0],[.7,3,length*.5],'#467c88');
    for(let z of [-length*.3,length*.3])part(g,[side*4.8,2.5,z],[2,4,4],'#495657');
    if(night)part(g,[side*2.8,5,-length*.51],[2,2,1],'#fff1b5','#ffce72');
  }
  return g;
}
function traffic(city,group,lamps) {
  const paths=[];
  // Use the same sampled deck vertices as the roads, so cars sit on the deck.
  for(const road of city.bridgeRoutes) {
    let run=[];
    const flush=()=>{if(run.length>1){const curve=new THREE.CurvePath();for(let i=1;i<run.length;i++)curve.add(new THREE.LineCurve3(run[i-1],run[i]));if(curve.getLength()>210){curve.half=road.half;paths.push(curve);}}run=[];};
    for(const s of road){const a=new THREE.Vector3(...s.a),b=new THREE.Vector3(...s.b);if(run.length&&run.at(-1).distanceTo(a)>3)flush();if(!run.length)run.push(a);run.push(b);}flush();
  }
  paths.sort((a,b)=>b.getLength()-a.getLength());
  const used=new Set(),moving=[];
  const selected=city.cityId==='seoul'?(city.roadBridgeLabels||[]).flatMap(bridge=>{
    const x=city.lonToX(bridge.lon),z=-city.latToY(bridge.lat);
    const candidates=paths.map(path=>({path,distance:Math.hypot(path.getPoint(.5).x-x,path.getPoint(.5).z-z)})).filter(p=>p.distance<450&&p.path.getLength()>400);
    candidates.sort((a,b)=>a.distance-b.distance);return candidates.length?[{path:candidates[0].path,name:bridge.name}]:[];
  }):paths.slice(0,12).map(path=>({path}));
  for(const [index,{path,name}]of selected.entries()) {
    const mid=path.getPoint(.5),key=Math.round(mid.x/450)+','+Math.round(mid.z/450);
    if(used.has(key))continue;used.add(key);
    for(let j=0;j<2;j++) {
      const object=new THREE.Object3D();object.scale.setScalar(2.1);
      moving.push({object,path,type:['sedan','suv','bus','truck'][moving.length%4],bridgeName:name,offset:j*.5+detailSeed(mid.x,mid.z),speed:20+j*4,lane:(j?1:-1)*Math.min(10,path.half*.55),reverse:j===1,period:55+(index%5)*6,phase:index*9+j*19,duration:24});
    }
    for(let j=1;j<4;j++){const p=path.getPoint(j/4),dir=path.getTangent(j/4);lamps.push([p.x-dir.z*(path.half-1),p.y,p.z+dir.x*(path.half-1)]);}
  }
  return {actors:moving,update:packVehicles(group,moving,city.themeName==='night','bridge-traffic')};
}
function packVehicles(group,actors,night,kind) {
  const parts=[];
  actors.forEach((actor,index)=>{
    const prototype=vehicle(false,['#f6bf55','#e98979','#75bbd5','#f1eee5','#91b49a'][index%5],night,actor.type);prototype.updateMatrixWorld(true);
    for(const p of prototype.children){parts.push({actor,local:p.matrix.clone(),color:p.material.color.clone(),lit:p.material.emissive.getHex()!==0});p.geometry.dispose();p.material.dispose();}
  });
  const batches=[];
  for(const lit of [false,true]) {
    const list=parts.filter(p=>p.lit===lit);if(!list.length)continue;
    const mesh=new THREE.InstancedMesh(boxGeo.clone(),clay({color:'#ffffff',emissive:lit?'#ffce72':0,emissiveIntensity:1.5}),list.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.userData.kind=kind;
    list.forEach((p,i)=>mesh.setColorAt(i,p.color));group.add(mesh);batches.push({mesh,list});
  }
  const matrix=new THREE.Matrix4(),zero=new THREE.Vector3(0,0,0);
  return ()=>{for(const actor of actors)actor.object.updateMatrix();for(const {mesh,list}of batches){list.forEach((p,i)=>{matrix.multiplyMatrices(p.actor.object.matrix,p.local);if(!p.actor.object.visible)matrix.scale(zero);mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;}};
}
function boat(night) {
  const g=new THREE.Group();
  const shape=new THREE.Shape();shape.moveTo(-14,35);shape.lineTo(-15,-23);shape.quadraticCurveTo(0,-56,15,-23);shape.lineTo(14,35);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:7,bevelEnabled:true,bevelSize:2,bevelThickness:1,bevelSegments:1});geo.rotateX(Math.PI/2);geo.translate(0,8,0);
  g.add(new THREE.Mesh(geo,clay({color:'#fff5dc'})));
  part(g,[0,10,2],[24,5,47],'#dd836c');part(g,[0,15,3],[21,8,39],'#f9f9ee');
  part(g,[0,20,3],[25,3,44],'#ffffff');
  for(let side of [-1,1])for(let i=0;i<5;i++)part(g,[side*10.8,15,-12+i*7],[.8,4,4],night?'#ffe4a3':'#609cab',night?'#ffc47c':0);
  part(g,[0,24,4],[2,7,2],'#d5a66c');
  const wakeGeo=new THREE.BufferGeometry();wakeGeo.setAttribute('position',new THREE.Float32BufferAttribute([-13,.5,38,-24,.5,78,-16,.5,72, 13,.5,38,16,.5,72,24,.5,78],3));
  g.add(new THREE.Mesh(wakeGeo,new THREE.MeshBasicMaterial({color:'#e9ffff',transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false})));
  g.scale.set(2,1.7,2);g.userData.kind='cruise';return g;
}
function riverTraffic(city,group) {
  if(city.cityId!=='seoul')return {actors:[],update:()=>{},counts:{}};
  const actors=[],parts=[],counts={},seen={},night=city.themeName==='night';
  for(const road of city.riverTraffic||[]) {
    const path=new THREE.CurvePath();
    for(let i=1;i<road.points.length;i++) {
      const a=road.points[i-1],b=road.points[i],ax=city.lonToX(a[0]),ay=city.latToY(a[1]),bx=city.lonToX(b[0]),by=city.latToY(b[1]);
      const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/45));
      const point=t=>{const x=ax+(bx-ax)*t,y=ay+(by-ay)*t,w=waterAt(city,x,y);return new THREE.Vector3(x,Math.max(city.terrain.at(x,y)*EXAG+10,w===null?-Infinity:w+39),-y);};
      for(let j=0;j<steps;j++)path.add(new THREE.LineCurve3(point(j/steps),point((j+1)/steps)));
    }
    const length=path.getLength();if(length<100)continue;
    const n=Math.max(1,Math.round(length/280));
    for(let j=0;j<n;j++) {
      seen[road.name]=(seen[road.name]||0)+1;
      if(seen[road.name]%2)continue;
      const object=new THREE.Object3D();object.scale.setScalar(2.1);
      const type=['sedan','suv','sedan','bus','sedan','truck','suv','sedan'][actors.length%8];
      const actor={object,path,offset:(j+.3)/n,speed:30+(actors.length%4)*3,roadName:road.name,type};actors.push(actor);counts[road.name]=(counts[road.name]||0)+1;
      const prototype=vehicle(false,['#f6bf55','#e98979','#75bbd5','#f1eee5','#91b49a'][actors.length%5],night,type);prototype.updateMatrixWorld(true);
      for(const p of prototype.children){parts.push({actor,local:p.matrix.clone(),color:p.material.color.clone(),lit:p.material.emissive.getHex()!==0});p.geometry.dispose();p.material.dispose();}
    }
  }
  const batches=[];
  for(const lit of [false,true]) {
    const list=parts.filter(p=>p.lit===lit);if(!list.length)continue;
    const mesh=new THREE.InstancedMesh(boxGeo.clone(),clay({color:'#ffffff',emissive:lit?'#ffce72':0,emissiveIntensity:1.5}),list.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.userData.kind='river-traffic';
    list.forEach((p,i)=>mesh.setColorAt(i,p.color));group.add(mesh);batches.push({mesh,list});
  }
  const matrix=new THREE.Matrix4();
  return {actors,counts,update:()=>{for(const {mesh,list}of batches){list.forEach((p,i)=>{p.actor.object.updateMatrix();matrix.multiplyMatrices(p.actor.object.matrix,p.local);mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;}}};
}
function boats(city,group) {
  if(city.cityId!=='seoul')return [];
  const result=[];
  for(const [lon,lat] of [[126.949,37.529],[126.991,37.516]]) {
    const cx=city.lonToX(lon),cy=city.latToY(lat);let path;
    search:for(let r=0;r<=700;r+=140)for(let a=0;a<8;a++) {
      const x=cx+Math.cos(a*Math.PI/4)*r,y=cy+Math.sin(a*Math.PI/4)*r;
      const points=[];
      for(let k=0;k<=16;k++) {
        const dx=(k/16-.5)*700,dy=-dx*.35,level=waterAt(city,x+dx,y+dy);
        if(level===null||waterAt(city,x+dx+65,y+dy+65)===null||waterAt(city,x+dx-65,y+dy-65)===null)break;
        points.push(new THREE.Vector3(x+dx,level+1,-y-dy));
      }
      if(points.length===17){path=new THREE.CurvePath();for(let k=1;k<points.length;k++)path.add(new THREE.LineCurve3(points[k-1],points[k]));break search;}
    }
    if(path){const object=boat(city.themeName==='night');group.add(object);result.push({object,path,offset:result.length*.47,speed:8});}
  }
  return result;
}
export function buildCityLife(city) {
  const group=new THREE.Group(),night=city.themeName==='night',lamps=[];
  const stats=buildingDetails(city,group,night);plaza(city,group,lamps);
  const bridge=traffic(city,group,lamps),vehicles=bridge.actors,ships=boats(city,group);streetLights(group,lamps,night);
  const river=riverTraffic(city,group);
  const railway=buildBridgeTrains(city,group);
  const actors=[...vehicles,...ships,...river.actors],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const update=now=>{
    for(const actor of actors) {
      const t=((reduced?0:now*.001)*actor.speed/actor.path.getLength()+actor.offset)%1;
      let progress=actor.reverse?1-t:t;
      if(actor.duration){const elapsed=reduced?actor.duration/2:((now*.001+actor.phase)%actor.period+actor.period)%actor.period;actor.object.visible=elapsed<actor.duration;if(!actor.object.visible)continue;progress=elapsed/actor.duration;if(actor.reverse)progress=1-progress;}
      const p=actor.path.getPoint(progress),dir=actor.path.getTangent(progress);
      if(actor.lane){p.x-=dir.z*actor.lane;p.z+=dir.x*actor.lane;}
      if(actor.reverse)dir.negate();
      actor.object.position.copy(p);actor.object.rotation.y=Math.atan2(-dir.x,-dir.z);
    }
    river.update();
    bridge.update();
    railway.update(now);
  };
  update(0);
  return {group,update,bridgeActors:vehicles,riverActors:river.actors,trains:railway.trains,stats:{...stats,vehicles:vehicles.length+river.actors.length,bridgeVehicles:vehicles.length,roadBridges:[...new Set(vehicles.map(a=>a.bridgeName).filter(Boolean))],riverVehicles:river.counts,boats:ships.length,trains:railway.trains.length,lamps:lamps.length,plaza:!!city.plaza}};
}
