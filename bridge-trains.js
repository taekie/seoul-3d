import * as THREE from 'three';
import {clay,waterAt,HEIGHT_EXAGGERATION as EXAG} from './miniature.js';

// Four oversized coaches per bridge; these are decorative trains, not live service.
export function buildBridgeTrains(city,group) {
 const trains=[],deckParts=[],size=2.8,spacing=35*size,coaches=4,duration=24;
 const shell=new THREE.Shape();shell.moveTo(-6,2);shell.lineTo(-6,10);shell.quadraticCurveTo(-6,13,-3,13);shell.lineTo(3,13);shell.quadraticCurveTo(6,13,6,10);shell.lineTo(6,2);shell.closePath();
 const shellGeometry=new THREE.ExtrudeGeometry(shell,{depth:32,bevelEnabled:true,bevelSize:.4,bevelThickness:.5,bevelSegments:2,curveSegments:5});shellGeometry.translate(0,0,-16);shellGeometry.computeBoundingBox();
 const night=city.themeName==='night',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(const [index,route]of (city.bridgeTrains||[]).entries()) {
  const path=new THREE.CurvePath();
  for(let i=1;i<route.points.length;i++) {
   const a=route.points[i-1],b=route.points[i],ax=city.lonToX(a[0]),ay=city.latToY(a[1]),bx=city.lonToX(b[0]),by=city.latToY(b[1]);
   const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/45));
   const point=t=>{const x=ax+(bx-ax)*t,y=ay+(by-ay)*t,w=waterAt(city,x,y);return new THREE.Vector3(x,Math.max(city.terrain.at(x,y)*EXAG+11,w===null?-Infinity:w+40),-y);};
   for(let j=0;j<steps;j++)path.add(new THREE.LineCurve3(point(j/steps),point((j+1)/steps)));
  }
  // A bridge spans terrain and water-mask gaps; it must not follow riverbed dips.
  const deckHeight=Math.max(...path.curves.flatMap(c=>[c.v1.y,c.v2.y]));
  for(const curve of path.curves){curve.v1.y=deckHeight;curve.v2.y=deckHeight;curve.updateArcLengths();}
  const length=path.getLength();if(length<spacing*coaches)continue;
  // Some source tiles omit rail-only bridge decks. Draw the verified track span
  // as well, so the oversized coaches always have a visible bridge beneath them.
  const segments=Math.ceil(length/65);
  for(let j=0;j<segments;j++) {
   const a=path.getPoint(j/segments),b=path.getPoint((j+1)/segments),p=a.clone().add(b).multiplyScalar(.5),dir=b.clone().sub(a),angle=Math.atan2(-dir.x,-dir.z);
   deckParts.push({p:[p.x,p.y-3,p.z],s:[42,4,dir.length()+1],angle,color:'#c9d2c6'});
   for(const side of [-1,1])deckParts.push({p:[p.x+Math.cos(angle)*side*14,p.y-.5,p.z-Math.sin(angle)*side*14],s:[2,1,dir.length()+1],angle,color:'#8e9b91'});
   const water=waterAt(city,p.x,-p.z);
   if(j%3===1&&water!==null)deckParts.push({p:[p.x,(p.y+water)/2-3,p.z],s:[16,Math.max(4,p.y-water-6),10],angle,color:'#c3cdbf'});
  }
  const root=new THREE.Group();root.userData={kind:'bridge-train',bridge:route.name,line:route.line};group.add(root);
  const parts=[];
  const part=(p,s,color,lit=false,kind='box',cab=false)=>parts.push({p,s,color,lit,kind,cab});
  part([0,0,0],[1,1,1],'#b8c5c8',false,'shell');
  part([0,13.7,1],[8,1.5,9],'#7c898e');part([0,13.7,-9],[7,1.5,5],'#8c9799');
  part([0,1,0],[9,2,26],'#424b50');
  for(const z of [-10,10])part([0,1.4,z],[11,2.8,6],'#323b40');
  part([0,6,17],[5,6,2],'#323b40');
  for(const side of [-1,1]) {
   part([side*6.2,4.8,0],[.5,1.5,32],route.color);
   part([side*6.15,8.5,0],[.3,4.5,30],'#283b43');
   for(let z=-12;z<=12;z+=4)part([side*6.35,8.5,z],[.2,3.4,2.8],night?'#d9d1a6':'#496470',night);
   for(const z of [-10,0,10])for(const dz of [-1.4,0,1.4])part([side*6.5,7.2,z+dz],[.18,8,.18],'#aebdc0');
  }
  // Only the leading and trailing coaches have a broad dark driving cab.
  part([0,8,-16.65],[10.5,8.3,.6],'#18272f',false,'box',true);
  part([0,8.6,-17],[9,5,.2],'#405761',false,'box',true);
  part([0,3.5,-16.8],[11,2,.5],route.color,false,'box',true);
  for(const x of [-4,4])part([x,4,-17.1],[1.3,1,.2],night?'#fff1bd':'#eef0db',night,'box',true);
  const batches=[];
  for(const [lit,kind]of [[false,'shell'],[false,'box'],[true,'box']]) {
   const list=parts.filter(p=>p.lit===lit&&p.kind===kind);if(!list.length)continue;
   const mesh=new THREE.InstancedMesh(kind==='shell'?shellGeometry.clone():new THREE.BoxGeometry(1,1,1),clay({color:'#ffffff',emissive:lit?'#ffc47c':0,emissiveIntensity:1.3}),list.length*coaches);
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
   for(let c=0;c<coaches;c++)list.forEach((p,i)=>mesh.setColorAt(c*list.length+i,new THREE.Color(p.color)));
   root.add(mesh);batches.push({mesh,list});
  }
  trains.push({root,path,length,batches,route,deckHeight,period:50+index*6,phase:index*11,coaches,size,spacing,duration});
 }
 shellGeometry.dispose();
 if(deckParts.length) {
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),clay({color:'#ffffff'}),deckParts.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  deckParts.forEach((p,i)=>{m.compose(new THREE.Vector3(...p.p),q.setFromAxisAngle(axis,p.angle),new THREE.Vector3(...p.s));mesh.setMatrixAt(i,m);mesh.setColorAt(i,new THREE.Color(p.color));});mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.userData.kind='rail-bridge-decks';group.add(mesh);
 }
 const matrix=new THREE.Matrix4(),base=new THREE.Matrix4(),local=new THREE.Matrix4(),q=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),v=new THREE.Vector3(),s=new THREE.Vector3();
 const update=now=>{
  for(const train of trains) {
   const {root,path,length,batches,period,phase}=train;
   const elapsed=reduced?duration/2:((now*.001+phase)%period+period)%period;
   root.visible=elapsed<duration;if(!root.visible)continue;
   const reverse=Math.floor((now*.001+phase)/period)%2===1;
   const head=elapsed/duration*(length+spacing*coaches)-spacing/2;
   for(let c=0;c<coaches;c++) {
    const distance=head-c*spacing,visible=distance>=0&&distance<=length;
    const t=THREE.MathUtils.clamp(distance/length,0,1),progress=reverse?1-t:t;
    const p=path.getPoint(progress),dir=path.getTangent(progress);if(reverse)dir.negate();
    q.setFromAxisAngle(axis,Math.atan2(-dir.x,-dir.z));base.compose(p,q,s.setScalar(visible?size:0));
    for(const {mesh,list}of batches)list.forEach((part,i)=>{
     const isCab=!part.cab||c===0||c===coaches-1;
     local.makeScale(...part.s);local.setPosition(v.set(...part.p));
     if(part.cab&&c===coaches-1)local.premultiply(new THREE.Matrix4().makeRotationY(Math.PI));
     matrix.multiplyMatrices(base,local);if(!isCab)matrix.scale(s.setScalar(0));mesh.setMatrixAt(c*list.length+i,matrix);
    });
   }
   for(const {mesh}of batches)mesh.instanceMatrix.needsUpdate=true;
  }
 };
 return {trains,update};
}
