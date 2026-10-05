import * as THREE from 'three';
import {serviceAt,routeDistance,clockText} from './rail-model.js';
export class RailLayer {
  constructor(city){
    this.city=city;this.enabled=false;this.playing=false;this.minute=540;this.weekday=0;this.speed=120;this.line='all';this.active=[];this.selected=null;this.last=0;this.lastUI=0;
    this.dummy=new THREE.Object3D();this.point=new THREE.Vector3();this.next=new THREE.Vector3();
    document.addEventListener('visibilitychange',()=>{this.last=0;});
  }
  async load(){
    if(this.data)return;
    const r=await fetch('data/korea.rail.json');if(!r.ok)throw new Error(`Rail data: ${r.status}`);
    const data=await r.json();if(!data.trains?.length||!data.paths)throw new Error('Invalid rail data');
    this.data=data;this.rebuild();
  }
  rebuild(){
    if(!this.data)return;
    const c=this.city,root=new THREE.Group();this.paths={};this.batches={};this.markers=[];
    c.groups.rail=root;c.scene.add(root);root.visible=this.enabled;
    const world=([lon,lat])=>{const x=c.lonToX(lon),y=c.latToY(lat);return new THREE.Vector3(x,c.terrain.visualAt(x,y)+2200,-y);};
    for(const [id,names] of Object.entries(this.data.paths)){
      const points=[],distances=[],stopDistances={},vertices=[];let distance=0;
      names.forEach((name,i)=>{
        const b=world(this.data.stations[name]);
        if(i){const a=world(this.data.stations[names[i-1]]),steps=Math.ceil(a.distanceTo(b)/1000);
          for(let j=1;j<=steps;j++){
            const p=a.clone().lerp(b,j/steps);p.y=c.terrain.visualAt(p.x,-p.z)+2200;
            const prev=points.at(-1);distance+=Math.hypot(p.x-prev.x,p.z-prev.z);points.push(p);distances.push(distance);
          }
        }else{points.push(b);distances.push(0);}
        stopDistances[name]=distance;
      });
      const line=id.split('-')[0],color=this.data.lines[line].color;
      // Slight lateral separation makes shared corridors readable without implying separate tracks.
      const shift=line==='honam'?1300:line==='gyeongbu'?-1300:0;
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz),nx=-dz/n,nz=dx/n;
        const v=(p,w)=>[p.x+nx*(shift+w),p.y,p.z+nz*(shift+w)];
        vertices.push(...v(a,-650),...v(a,650),...v(b,-650),...v(a,650),...v(b,650),...v(b,-650));
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));root.add(mesh);
      this.paths[id]={points,distances,stopDistances,line,shift,mesh};
    }
    for(const [line,info] of Object.entries(this.data.lines)){
      const n=this.data.trains.filter(t=>t.line===line).length*3;
      const body=new THREE.InstancedMesh(new THREE.BoxGeometry(1.8,1,1.5),new THREE.MeshStandardMaterial({color:'#fff7e7',roughness:.65}),n);
      const roof=new THREE.InstancedMesh(new THREE.BoxGeometry(1.5,.25,1.15),new THREE.MeshStandardMaterial({color:info.color,roughness:.65,emissive:info.color,emissiveIntensity:.35}),n);
      body.frustumCulled=roof.frustumCulled=false;body.count=roof.count=0;root.add(body,roof);this.batches[line]={body,roof};
    }
    const stationGeo=new THREE.SphereGeometry(1400,12,8),stationMat=new THREE.MeshBasicMaterial({color:'#fff4d7'});
    for(const [name,coord] of Object.entries(this.data.stations)){
      const marker=new THREE.Mesh(stationGeo,stationMat);marker.position.copy(world(coord));marker.position.y+=500;marker.scale.y=.4;root.add(marker);
      this.markers.push({name,marker,lines:Object.entries(this.data.paths).filter(([,p])=>p.includes(name)).map(([id])=>id.split('-')[0])});
    }
    this.halo=new THREE.Mesh(new THREE.RingGeometry(2200,2900,32),new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.85}));this.halo.rotation.x=-Math.PI/2;this.halo.renderOrder=5;root.add(this.halo);
    this.refresh();
  }
  setEnabled(value){this.enabled=value;this.playing=value;document.body.classList.toggle('rail-active',value);this.last=0;if(this.city.groups.rail)this.city.groups.rail.visible=value;this.refresh();}
  setTime(value){this.minute=Math.max(0,Math.min(1439.99,Number(value)));this.playing=false;this.refresh();}
  refresh(){if(this.data)this.render();this.onChange?.();}
  sample(path,distance,out){
    distance=Math.max(0,Math.min(path.distances.at(-1),distance));let lo=0,hi=path.distances.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(path.distances[mid]<=distance)lo=mid;else hi=mid;}
    const a=path.points[lo],b=path.points[hi],f=(distance-path.distances[lo])/(path.distances[hi]-path.distances[lo]||1);
    out.copy(a).lerp(b,f);const dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz)||1;
    out.x+=-dz/n*path.shift;out.z+=dx/n*path.shift;return out;
  }
  render(){
    const c=this.city,scale=THREE.MathUtils.clamp(c.camera.position.distanceTo(c.controls.target)*.0018,600,2200),counts={};this.active=[];
    for(const [key,batch] of Object.entries(this.batches)){counts[key]=0;batch.body.visible=batch.roof.visible=this.line==='all'||this.line===key;}
    for(const path of Object.values(this.paths))path.mesh.visible=this.line==='all'||path.line===this.line;
    for(const entry of this.markers)entry.marker.visible=this.line==='all'||entry.lines.includes(this.line);
    this.halo.visible=false;
    for(const train of this.data.trains){
      if(this.line!=='all'&&train.line!==this.line)continue;
      const state=serviceAt(train,this.minute,this.weekday);if(!state)continue;
      const path=this.paths[train.route],distance=routeDistance(path,path.stopDistances,state),direction=train.direction?-1:1;
      this.active.push({train,state,distance});
      for(let car=0;car<3;car++){
        const d=distance-direction*car*scale*1.8;
        this.sample(path,d,this.point);this.sample(path,d+direction*100,this.next);
        // At a terminal use the preceding segment to preserve heading.
        if(this.next.distanceToSquared(this.point)<1){this.sample(path,d-direction*100,this.next);this.next.sub(this.point).negate().add(this.point);}
        const angle=Math.atan2(this.next.x-this.point.x,this.next.z-this.point.z);
        this.dummy.position.copy(this.point);this.dummy.position.y+=scale*.65;this.dummy.rotation.set(0,angle,0);this.dummy.scale.setScalar(scale);this.dummy.updateMatrix();
        const batch=this.batches[train.line],index=counts[train.line]++;
        batch.body.setMatrixAt(index,this.dummy.matrix);this.dummy.position.y+=scale*.5;this.dummy.updateMatrix();batch.roof.setMatrixAt(index,this.dummy.matrix);
        if(car===0&&train.id===this.selected){this.halo.visible=true;this.halo.position.copy(this.point);this.halo.position.y+=scale;this.halo.scale.setScalar(scale/1000*1.3);}
      }
    }
    for(const [key,{body,roof}]of Object.entries(this.batches)){body.count=roof.count=counts[key];body.instanceMatrix.needsUpdate=roof.instanceMatrix.needsUpdate=true;}
  }
  update(now=performance.now()){
    if(!this.enabled||!this.data){this.last=0;return;}
    if(this.last&&this.playing&&!document.hidden){this.minute+=(Math.min((now-this.last)/1000,.25)*this.speed/60);if(this.minute>=1440){this.minute%=1440;this.weekday=(this.weekday+1)%7;}}
    this.last=now;this.render();if(now-this.lastUI>250){this.lastUI=now;this.onChange?.();}
  }
  focusSelected(){const entry=this.active.find(x=>x.train.id===this.selected);if(!entry)return;
    const path=this.paths[entry.train.route];this.sample(path,entry.distance,this.point);
    const {center,kx}=this.city.data.meta;
    const lon=center[0]+this.point.x/kx*360;
    const mercator=Math.asinh(Math.tan(center[1]*Math.PI/180))-this.point.z/kx*2*Math.PI;
    const lat=Math.atan(Math.sinh(mercator))*180/Math.PI;
    this.city.flyTo(lon,lat,220000,.85,-.12,1000);
  }
}

export function connectRailUI(city,onToggle){
 const rail=city.rail,$=id=>document.getElementById(id);let lastList='';
 $('rail-options').open=innerWidth>=640;
 rail.onChange=()=>{
  $('rail-panel').hidden=!rail.enabled;const button=document.querySelector('[data-a=rail]');button.classList.toggle('on',rail.enabled);button.setAttribute('aria-pressed',String(rail.enabled));
  if(!rail.data)return;
  $('rail-clock').textContent=clockText(rail.minute);$('rail-time').value=rail.minute;$('rail-time').setAttribute('aria-valuetext',clockText(rail.minute));$('rail-day').value=rail.weekday;
  $('rail-play').textContent=rail.playing?'일시정지':'재생';$('rail-play').setAttribute('aria-pressed',String(rail.playing));
  const total=rail.data.trains.filter(t=>t.days.includes(rail.weekday)&&(rail.line==='all'||t.line===rail.line)).length;
  $('rail-count').textContent=`운행 중 ${rail.active.length}편 / 당일 출발 ${total}편`;
  const signature=rail.active.map(x=>x.train.id).join(',');
  if(lastList!==signature){lastList=signature;
   $('rail-train').replaceChildren(new Option(rail.active.length?'열차 선택…':'현재 운행 없음',''),...rail.active.map(({train:t})=>new Option(`${t.type} ${t.number} · ${t.stops[0][0]} → ${t.stops.at(-1)[0]}`,t.id)));
   if(!rail.active.some(x=>x.train.id===rail.selected))rail.selected=null;
   $('rail-train').value=rail.selected||'';
  }
  const item=rail.active.find(x=>x.train.id===rail.selected);$('rail-focus').disabled=!item;
  $('rail-detail').textContent=item?`${item.state.from} → ${item.state.to} ${clockText(item.state.nextTime)} · 도착 ${clockText(item.train.stops.at(-1)[1])}`:'작은 열차는 각 편의 추정 위치를 나타냅니다.';
 };
 $('rail-close').onclick=()=>onToggle();
 $('rail-play').onclick=()=>{rail.playing=!rail.playing;rail.last=0;rail.onChange();};
 $('rail-time').oninput=e=>rail.setTime(e.target.value);
 $('rail-day').onchange=e=>{rail.weekday=Number(e.target.value);rail.refresh();};
 $('rail-speed').onchange=e=>{rail.speed=Number(e.target.value);};
 $('rail-line').onchange=e=>{rail.line=e.target.value;rail.refresh();};
 $('rail-train').onchange=e=>{rail.selected=e.target.value||null;rail.refresh();};
 $('rail-focus').onclick=()=>rail.focusSelected();
}
