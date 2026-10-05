import * as THREE from 'three';

// Height above the relief, not above sea level. A shared scale makes the same
// colour correspond to the same density-height on every column.
const HEIGHT_SCALE=3.5; // Display metres per person/km², fixed across years.
// More colour range for urban densities instead of saturating at 10,000.
const COLOR_STOPS=[0,1000,5000,10000,15000,25000];
const RAMP=['#fff2cc','#ffd45a','#f89535','#ed5a53','#c73832','#851d20'];
function gradientMaterial(){
  const material=new THREE.MeshStandardMaterial({roughness:.85,metalness:0});
  material.customProgramCacheKey=()=> 'population-height-gradient-v2';
  material.onBeforeCompile=shader=>{
    shader.uniforms.populationColors={value:RAMP.map(c=>new THREE.Color(c))};
    shader.vertexShader='attribute float instanceDensity;\nvarying float vPopulationDensity;\nvarying float vBarFraction;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vPopulationDensity=instanceDensity;
      vBarFraction=position.y+0.5;
    `);
    const colourIntervals=COLOR_STOPS.slice(1).map((upper,i)=>
      `if(density<${upper.toFixed(1)})return mix(populationColors[${i}],populationColors[${i+1}],clamp((density-${COLOR_STOPS[i].toFixed(1)})/${(upper-COLOR_STOPS[i]).toFixed(1)},0.0,1.0));`
    ).join('\n');
    shader.fragmentShader=`uniform vec3 populationColors[${RAMP.length}];
      varying float vPopulationDensity;
      varying float vBarFraction;
      vec3 populationColor(float density) {
        ${colourIntervals}
        return populationColors[${RAMP.length-1}];
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      // Linear density -> height; every column uses the same vertical colour scale.
      diffuseColor.rgb*=populationColor(vPopulationDensity*clamp(vBarFraction,0.0,1.0));
    `);
  };
  return material;
}

// One draw call for all cells; the data is fetched only on first activation.
export class PopulationLayer {
  constructor(city){this.city=city;this.enabled=false;this.data=null;this.pending=null;this.labelAnchors=new Map();this.labelDensities=new Map();this.regional=[];}
  async toggle(){
    if(this.pending)return;
    if(!this.data){
      this.pending=Promise.all([fetch('data/korea.population.json?v=2025'),fetch('data/korea.population-places.json')]).then(async ([r,placesResponse])=>{
        if(!r.ok)throw new Error(`Population: ${r.status}`);
        const data=await r.json();
        if(data.meta?.year!==2025||!data.cells?.length||!data.cells.every(c=>c.length===3&&c.every(Number.isFinite)&&c[2]>=0))throw new Error('Invalid population data');
        if(!placesResponse.ok)throw new Error(`Population places: ${placesResponse.status}`);
        const names=await placesResponse.json();if(!Array.isArray(names.places))throw new Error('Invalid population places');
        this.data=data;this.places=names.places;
      });
      try{await this.pending;}finally{this.pending=null;}
    }
    this.enabled=!this.enabled;
    if(!this.city.groups.population)this.rebuild();
    this.city.groups.population.visible=this.enabled;
  }
  labelPosition(lm){
    return this.enabled&&lm.kind==='city'?this.labelAnchors.get(lm.id):null;
  }
  regionalLabels(distance){return this.enabled&&distance<900000?this.regional.filter(p=>p.settlementKind!=='village'||distance<350000):[];}
  rebuild(){
    if(!this.data)return;
    const city=this.city,step=this.data.meta.stepDegrees;
    const geometry=new THREE.BoxGeometry(1,1,1);
    geometry.setAttribute('instanceDensity',new THREE.InstancedBufferAttribute(Float32Array.from(this.data.cells,c=>c[2]),1));
    const mesh=new THREE.InstancedMesh(geometry,gradientMaterial(),this.data.cells.length);
    mesh.userData.heightScale=HEIGHT_SCALE;
    const dummy=new THREE.Object3D(),tops=[];
    this.labelAnchors.clear();this.labelDensities.clear();
    this.data.cells.forEach(([lon,lat,density],i)=>{
      const x=city.lonToX(lon),y=city.latToY(lat),height=density*HEIGHT_SCALE;
      const width=Math.abs(city.lonToX(lon+step)-x)*.48,depth=Math.abs(city.latToY(lat+step/2)-city.latToY(lat-step/2))*.48;
      dummy.position.set(x,city.terrain.visualAt(x,y)+height/2+150,-y);
      dummy.scale.set(width,height,depth);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      tops.push({x,z:-y,height,density,lon,lat,index:i,pos:new THREE.Vector3(x,dummy.position.y+height/2+2500,-y)});
    });
    // Representative city points are not necessarily inside the tallest cell.
    // Anchor to a nearby population peak, keeping the shift within ~one grid cell.
    const reserved=new Set();
    for(const lm of city.landmarks){
      if(lm.kind!=='city')continue;
      const x=city.lonToX(lm.lon),z=-city.latToY(lm.lat);
      let peak=null;
      for(const top of tops){
        if(Math.hypot(top.x-x,top.z-z)>7500)continue;
        if(!peak||top.height>peak.height)peak=top;
      }
      if(peak){this.labelAnchors.set(lm.id,peak.pos);this.labelDensities.set(lm.id,peak.density);reserved.add(peak.index);}
    }
    // Assign names to their actual population grid cell, not a distant metropolitan peak.
    const cellKey=(lon,lat)=>`${Math.floor(lon/step)},${Math.floor(lat/step)}`;
    const cells=new Map(tops.map(t=>[cellKey(t.lon,t.lat),t])),chosen=new Map();
    const normal=name=>name.replace(/(특별자치시|특별시|광역시|시|군|읍)$/,'');
    const known=new Set(city.landmarks.filter(p=>p.kind==='city').map(p=>normal(p.name)));
    for(const p of this.places||[]){
      if(known.has(normal(p.name)))continue;
      const top=cells.get(cellKey(p.lon,p.lat));if(!top||reserved.has(top.index))continue;
      const x=city.lonToX(p.lon),z=-city.latToY(p.lat),distance=Math.hypot(x-top.x,z-top.z);
      const rank=({city:3,town:2,village:1}[p.kind]||0)*10000-distance;
      if(!chosen.has(top.index)||rank>chosen.get(top.index).rank)chosen.set(top.index,{p,top,rank});
    }
    this.regional=[...chosen.values()].map(({p,top})=>({
      id:'population-place:'+p.id,name:p.name,category:'landmark',tier:0,populationPlace:true,settlementKind:p.kind,
      lon:p.lon,lat:p.lat,populationDensity:top.density,populationCell:top.index,pos:top.pos.clone(),
      lm:{id:'population-place:'+p.id,name:p.name,kind:'city',priority:0},
    }));
    mesh.computeBoundingSphere();mesh.visible=this.enabled;
    city.groups.population=mesh;city.scene.add(mesh);
  }
}
