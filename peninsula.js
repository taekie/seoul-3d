import * as THREE from 'three';
import { clay } from './miniature.js';
import { PopulationLayer } from './population.js';
import { RainfallLayer } from './rainfall.js';
import { CroplandLayer } from './cropland.js';
import { RailLayer } from './rail.js';

const RELIEF=8, BASE_HEIGHT=4000;
const ELEVATIONS=[0,120,300,600,1000,1500,2000,2500];

// Coarse, prebuilt relief: no building instances, trees or remote DEM tiles.
class PeninsulaTerrain {
  constructor(meta, buffer) {
    Object.assign(this, meta.grid);
    this.W=this.width;this.H=this.height;this.data=new Int16Array(buffer);
    if(this.data.length!==this.W*this.H)throw new Error('한반도 지형 데이터 크기가 맞지 않습니다.');
    this.sx=(this.maxX-this.minX)/(this.W-1);this.sy=(this.maxY-this.minY)/(this.H-1);
    this.relief=meta.relief??RELIEF;
    // Smooth only land samples. Ocean sentinels must not drag coastlines downhill.
    // A light ~600m filter keeps sampling noise down without rounding off ridgelines.
    const kernel=Array.from({length:3},(_,i)=>Math.exp(-((i-1)**2)/(2*.65**2)));
    let field=Float32Array.from(this.data);
    for(const horizontal of [true,false]){
      const out=new Float32Array(field.length);
      for(let y=0;y<this.H;y++)for(let x=0;x<this.W;x++){
        const index=y*this.W+x;if(this.data[index]<0){out[index]=this.data[index];continue;}
        let sum=0,weight=0;
        for(let k=-1;k<=1;k++){
          const xx=x+(horizontal?k:0),yy=y+(horizontal?0:k);
          if(xx<0||xx>=this.W||yy<0||yy>=this.H||this.data[yy*this.W+xx]<0)continue;
          const w=kernel[k+1];sum+=field[yy*this.W+xx]*w;weight+=w;
        }
        out[index]=sum/weight;
      }
      field=out;
    }
    this.displayData=field;
    this.surface=Float32Array.from(field,h=>h<0?-3000:BASE_HEIGHT+this.relief*(h<200?200*(h/200)**1.4:h));
  }
  sample(d,x,y) {
    const fx=THREE.MathUtils.clamp((x-this.minX)/this.sx,0,this.W-1);
    const fy=THREE.MathUtils.clamp((this.maxY-y)/this.sy,0,this.H-1);
    const i=Math.min(this.W-2,Math.floor(fx)),j=Math.min(this.H-2,Math.floor(fy)),a=fx-i,b=fy-j;
    const k=j*this.W+i;
    return (d[k]*(1-a)+d[k+1]*a)*(1-b)+(d[k+this.W]*(1-a)+d[k+this.W+1]*a)*b;
  }
  at(x,y) {return this.sample(this.data,x,y);}
  visualAt(x,y) {return Math.max(0,this.sample(this.surface,x,y));}
  mesh(theme) {
    const g=new THREE.PlaneGeometry(this.maxX-this.minX,this.maxY-this.minY,this.W-1,this.H-1);
    g.rotateX(-Math.PI/2);
    const positions=g.attributes.position,colors=new Float32Array(positions.count*3),color=new THREE.Color();
    const stops=theme.ground.map(c=>new THREE.Color(c));
    for(let i=0;i<positions.count;i++){
      const h=Math.max(0,this.displayData[i]);positions.setY(i,this.surface[i]);
      let s=0;while(s<ELEVATIONS.length-2&&h>ELEVATIONS[s+1])s++;
      const t=THREE.MathUtils.clamp((h-ELEVATIONS[s])/(ELEVATIONS[s+1]-ELEVATIONS[s]),0,1);
      color.copy(stops[s]).lerp(stops[s+1],t);color.toArray(colors,i*3);
    }
    // Discard wholly ocean triangles. Keep crossing triangles under the water
    // to create a clean coastline without a huge flat rectangular terrain sheet.
    const indices=[],original=g.index.array;
    for(let i=0;i<original.length;i+=3){
      const a=original[i],b=original[i+1],c=original[i+2];
      if(this.data[a]>=0||this.data[b]>=0||this.data[c]>=0)indices.push(a,b,c);
    }
    g.setIndex(indices);g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,clay({vertexColors:true}));
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.position.set((this.minX+this.maxX)/2,0,-(this.minY+this.maxY)/2);
    return mesh;
  }
}

function rivers(city,major) {
  const vertices=[];
  for(const river of city.data.rivers){
    if(Boolean(river.major)!==major)continue;
    const line=[];
    river.points.forEach(([lon,lat],i)=>{
      const x=city.lonToX(lon),y=city.latToY(lat);
      if(i){
        const [a,b]=river.points[i-1],ax=city.lonToX(a),ay=city.latToY(b),steps=Math.ceil(Math.hypot(x-ax,y-ay)/600);
        for(let j=1;j<steps;j++)line.push([ax+(x-ax)*j/steps,ay+(y-ay)*j/steps]);
      }
      line.push([x,y]);
    });
    for(let i=1;i<line.length;i++){
      const [ax,ay]=line[i-1],[bx,by]=line[i],length=Math.hypot(bx-ax,by-ay);if(!length)continue;
      const width=major?650:350;
      const dx=-(by-ay)/length*width,dy=(bx-ax)/length*width;
      const h=(x,y)=>city.terrain.visualAt(x,y)+1000;
      const a=[ax+dx,h(ax+dx,ay+dy),-ay-dy],b=[ax-dx,h(ax-dx,ay-dy),-ay+dy];
      const c=[bx+dx,h(bx+dx,by+dy),-by-dy],d=[bx-dx,h(bx-dx,by-dy),-by+dy];
      vertices.push(...a,...b,...c,...b,...d,...c);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  return new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:city.themeName==='night'?'#538ca0':'#58afc6',side:THREE.DoubleSide}));
}

function build(city) {
  const t=city.terrain,theme=city.theme;
  city.sun.castShadow=true;
  city.sun.shadow.mapSize.setScalar(2048);
  Object.assign(city.sun.shadow.camera,{left:-850000,right:850000,top:850000,bottom:-850000,near:1000,far:4000000});
  city.sun.shadow.camera.updateProjectionMatrix();
  city.sun.shadow.bias=-.00004;city.sun.shadow.normalBias=250;city.sun.shadow.radius=3;
  city.groups.terrain=t.mesh(theme);city.scene.add(city.groups.terrain);
  const seaGeo=new THREE.PlaneGeometry(12000000,12000000);seaGeo.rotateX(-Math.PI/2);
  const sea=new THREE.Mesh(seaGeo,clay({color:theme.water,roughness:.6}));
  sea.receiveShadow=true;
  city.groups.water=sea;city.scene.add(sea);
  const waterways=new THREE.Group();waterways.add(rivers(city,true));
  waterways.minor=rivers(city,false);waterways.add(waterways.minor);
  city.groups.rivers=waterways;city.scene.add(waterways);
  const group=new THREE.Group();city.labelAnchors=[];
  for(const lm of city.landmarks){
    const x=city.lonToX(lm.lon),y=city.latToY(lm.lat),height=t.visualAt(x,y);
    if(lm.kind==='city'){
    const marker=new THREE.Group();marker.userData.id=lm.id;marker.position.set(x,height+1200,-y);
    const dot=new THREE.Mesh(new THREE.SphereGeometry(lm.detailCity?3000:1800,12,8),
      clay({color:lm.detailCity?'#e5ad66':'#f9f1d5',emissive:city.themeName==='night'?'#f2c77b':'#000000',emissiveIntensity:.7}));
    dot.scale.y=.55;marker.add(dot);group.add(marker);
    }
    city.labelAnchors.push({lm,pos:new THREE.Vector3(x,height+6500,-y)});
  }
  city.groups.landmarks=group;city.scene.add(group);
  city.life=null;
  city.cropland?.rebuild();
  city.population?.rebuild();
  city.rainfall?.attach();
  city.rail?.rebuild();
}

export async function loadPeninsula(city,onProgress) {
  const fetchChecked=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`${url}: ${r.status}`);return r;};
  const [data,buffer,features]=await Promise.all([
    fetchChecked('data/korea.json').then(r=>r.json()),fetchChecked('data/korea.terrain.bin').then(r=>r.arrayBuffer()),
    fetchChecked('data/korea.features.json').then(r=>r.json()),
  ]);
  onProgress?.('산맥과 해안선을 빚는 중',.65);
  city.cityId='korea';city.data={...data,rivers:features.rivers};
  city.landmarks=[...data.places.map(p=>({...p,showBelow:p.priority===3?4000000:1100000})),...features.features];city.labelAnchors=[];
  city.terrain=new PeninsulaTerrain(data.meta,buffer);city.scale=16;city.sunDist=800000;
  city.camera.near=1000;city.camera.far=12000000;city.camera.updateProjectionMatrix();
  city.controls.minDistance=100000;city.controls.maxDistance=4000000;city.controls.maxPolarAngle=1.35;
  city.restPixelRatio=Math.min(devicePixelRatio,1.5);city.renderer.setPixelRatio(city.restPixelRatio);
  city.overview={build,update:distance=>{city.groups.rivers.minor.visible=distance<1100000;city.rainfall?.update();city.rail?.update();},theme:(name,t)=>({
    ...t, fogNear:200000, fogFar:600000,
    ground: name==='night'
      ?['#304759','#395969','#466c6b','#536f57','#8b9462','#b09a68','#c3aca0','#e8ded1']
      :['#516d88','#608196','#648e8d','#6e956e','#a5ae6d','#c7b274','#bc9278','#eee5d6'],
    ...(name==='day'?{sky:'#efefec',fog:'#efefec',water:'#fefefa',sun:{...t.sun,intensity:2.25,pos:[-.8,1,.45]},hemi:{...t.hemi,intensity:.95},amb:.22}:{}),
    ...(name==='dusk'?{water:'#e5d8c9',sky:'#eadfd4',fog:'#eadfd4'}:{}),
    ...(name==='night'?{water:'#1d2933'}:{}),
  })};
  city.cropland=new CroplandLayer(city);
  city.population=new PopulationLayer(city);
  city.rainfall=new RainfallLayer(city);
  city.rail=new RailLayer(city);
  city.applyTheme('day',true);onProgress?.('마무리',1);
}
