import * as THREE from 'three';

export const RAIN_STOPS=[0,10,30,100,300,600];
export const RAIN_COLORS=['#edf8fc','#cceaf6','#81c6e5','#328fc8','#195298','#102958'];
const RAIN_PROFILE={id:'rain',unit:'mm',heightScale:120,stops:RAIN_STOPS,colors:RAIN_COLORS,meanKey:'meanMm'};
const SNOW_PROFILE={unit:'cm',heightScale:1200,stops:[0,1,5,10,30,60],colors:['#f0fcff','#d5f2f1','#9edddc','#59b9c3','#267f9c','#134766'],meanKey:'meanCm'};
const E=Math.sqrt(1-(1-1/298.257223563)**2),A=6378.137,rad=Math.PI/180;
const t=p=>Math.tan(Math.PI/4-p/2)/((1-E*Math.sin(p))/(1+E*Math.sin(p)))**(E/2);
const m=p=>Math.cos(p)/Math.sqrt(1-E*E*Math.sin(p)**2);
const N=Math.log(m(30*rad)/m(60*rad))/Math.log(t(30*rad)/t(60*rad));
const F=m(30*rad)/(N*t(30*rad)**N),R0=A*F*t(38*rad)**N;
export function rainGridPoint(lon,lat,grid){
  const rho=A*F*t(lat*rad)**N,theta=N*(lon-126)*rad;
  return [(rho*Math.sin(theta)+grid.originXKm)/grid.spacingKm,(R0-rho*Math.cos(theta)+grid.originYKm)/grid.spacingKm];
}
export function rainLonLat(gx,gy,grid){
  const x=gx*grid.spacingKm-grid.originXKm,y=gy*grid.spacingKm-grid.originYKm;
  const rho=Math.hypot(x,R0-y),q=(rho/(A*F))**(1/N);
  let phi=Math.PI/2-2*Math.atan(q);
  for(let i=0;i<8;i++)phi=Math.PI/2-2*Math.atan(q*((1-E*Math.sin(phi))/(1+E*Math.sin(phi)))**(E/2));
  return [126+Math.atan2(x,R0-y)/N/rad,phi/rad];
}
function rainMaterial(profile){
  const stops=profile.stops,colors=profile.colors;
  const material=new THREE.MeshStandardMaterial({roughness:.75,metalness:0});
  material.customProgramCacheKey=()=> 'kma-weather-columns-v2-'+profile.id;
  material.onBeforeCompile=shader=>{
    shader.uniforms.rainColors={value:colors.map(c=>new THREE.Color(c))};
    shader.vertexShader='attribute float instanceRain;\nvarying float vRain;\nvarying float vBarFraction;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRain=instanceRain;vBarFraction=position.y+0.5;');
    const intervals=stops.slice(1).map((upper,i)=>`if(mm<${upper.toFixed(1)})return mix(rainColors[${i}],rainColors[${i+1}],clamp((mm-${stops[i].toFixed(1)})/${(upper-stops[i]).toFixed(1)},0.0,1.0));`).join('\n');
    shader.fragmentShader=`uniform vec3 rainColors[${colors.length}];
      varying float vRain;varying float vBarFraction;
      vec3 rainColor(float mm){${intervals} return rainColors[${colors.length-1}];}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb*=rainColor(vRain*clamp(vBarFraction,0.0,1.0));
    `);
  };
  return material;
}
export class RainfallLayer {
  constructor(city){
    this.city=city;this.enabled=false;this.playing=false;this.week=0;this.data=null;this.pending=null;
    this.nextFrame=0;this.onChange=()=>{};this.year=2026;this.key=2026;this.metric='rain';this.profile=RAIN_PROFILE;this.years=new Map();
  }
  async load(key=this.key){
    if(this.data&&this.key===key)return;
    if(this.pending){await this.pending;return this.load(key);}
    this.pending=(async()=>{
      const snow=typeof key==='string'&&key.startsWith('snow-');
      const profile=snow?{...SNOW_PROFILE,id:key}:RAIN_PROFILE;
      const base=snow?`data/korea.snow.2025-26.${key.slice(5)}`:`data/korea.rain.${key}`;
      let bundle=this.years.get(key);
      if(!bundle){
        const get=async url=>{const r=await fetch(url);if(!r.ok)throw new Error('날씨 자료를 불러오지 못했습니다.');return r;};
        const meta=await get(key===2025?'data/korea.rain.json':`${base}.json`).then(r=>r.json());
        const [a,b]=await Promise.all([get('data/korea.rain.cells.bin').then(r=>r.arrayBuffer()),get(`${base}.bin`).then(r=>r.arrayBuffer())]);
        if((!snow&&meta.year!==key)||(snow&&meta.mode!==key.slice(5))||meta.unit!==(snow?'cm':'mm/week')||a.byteLength!==meta.cellCount*4||b.byteLength!==meta.cellCount*meta.frameCount*2||meta.weeks.length!==meta.frameCount)throw new Error('날씨 자료 형식이 맞지 않습니다.');
        const cells=new Uint32Array(a),values=new Uint16Array(b),size=meta.grid.width*meta.grid.height;
        if(cells.some((v,i)=>v>=size||(i&&v<=cells[i-1])))throw new Error('강수 격자 위치가 맞지 않습니다.');
        bundle={meta,cells,values,week:meta.weeks.reduce((best,w,i)=>w[profile.meanKey]>meta.weeks[best][profile.meanKey]?i:best,0)};
        this.years.set(key,bundle);
      }
      if(this.data)this.years.get(this.key).week=this.week;
      if(snow&&this.metric!=='rain')bundle.week=Math.min(this.week,bundle.meta.frameCount-1);
      this.data=bundle.meta;this.cells=bundle.cells;this.values=bundle.values;this.week=bundle.week;this.key=key;this.metric=profile.id;this.profile=profile;if(!snow)this.year=key;
      this.baseMatrices=null;this.bases=null;this.playing=false;
      const old=this.city.groups.rainfall;
      if(old){this.city.scene.remove(old);old.geometry.dispose();old.material.dispose();}
      this.attach();
    })();
    try{await this.pending;}finally{this.pending=null;}
  }
  setEnabled(enabled){
    this.enabled=enabled;
    if(this.city.groups.rainfall)this.city.groups.rainfall.visible=enabled;
    if(!enabled)this.playing=false;
    this.onChange();
  }
  setWeek(index){
    if(!this.data)return;
    this.week=Math.min(this.data.frameCount-1,Math.max(0,Math.round(index)));
    this.paint();this.onChange();
  }
  setPlaying(playing){
    if(!this.enabled||!this.data)return;
    if(playing&&this.week===this.data.frameCount-1)this.setWeek(0);
    this.playing=playing;this.nextFrame=performance.now()+900;this.onChange();
  }
  update(now=performance.now()){
    if(!this.playing||document.hidden||now<this.nextFrame)return;
    this.nextFrame=now+900;
    if(this.week>=this.data.frameCount-1){this.setPlaying(false);return;}
    this.setWeek(this.week+1);
  }
  paint(){
    const mesh=this.city.groups.rainfall,matrix=mesh.instanceMatrix.array,attribute=mesh.geometry.getAttribute('instanceRain'),offset=this.week*this.data.cellCount;
    for(let i=0;i<this.cells.length;i++){
      const raw=this.values[offset+i],mm=raw===this.data.nodata?0:raw*this.data.scale,h=mm*this.profile.heightScale,p=i*16;
      matrix.set(this.baseMatrices.subarray(p,p+16),p);
      if(mm===0){matrix[p]=matrix[p+2]=matrix[p+8]=matrix[p+10]=0;}
      matrix[p+5]=h;matrix[p+13]=this.bases[i]+h/2;
      attribute.array[i]=mm;
    }
    attribute.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  }
  attach(){
    if(!this.data)return;
    const city=this.city,grid=this.data.grid;
    if(!this.baseMatrices){
      this.baseMatrices=new Float32Array(this.cells.length*16);this.bases=new Float32Array(this.cells.length);
      const dummy=new THREE.Object3D();
      const world=(gx,gy)=>{const [lon,lat]=rainLonLat(gx,gy,grid);return [city.lonToX(lon),city.latToY(lat)];};
      for(let i=0;i<this.cells.length;i++){
        const gx=this.cells[i]%grid.width,gy=Math.floor(this.cells[i]/grid.width),[x,y]=world(gx,gy),[ex,ey]=world(gx+1,gy),[nx,ny]=world(gx,gy+1);
        this.bases[i]=city.terrain.visualAt(x,y)+150;
        dummy.position.set(x,this.bases[i],-y);dummy.rotation.y=Math.atan2(ey-y,ex-x);
        dummy.scale.set(Math.hypot(ex-x,ey-y)*.62,1,Math.hypot(nx-x,ny-y)*.62);dummy.updateMatrix();
        dummy.matrix.toArray(this.baseMatrices,i*16);
      }
    }
    const geometry=new THREE.BoxGeometry(1,1,1);
    geometry.setAttribute('instanceRain',new THREE.InstancedBufferAttribute(new Float32Array(this.cells.length),1));
    const mesh=new THREE.InstancedMesh(geometry,rainMaterial(this.profile),this.cells.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.userData.heightScale=this.profile.heightScale;mesh.visible=this.enabled;
    city.groups.rainfall=mesh;city.scene.add(mesh);this.paint();
  }
}
