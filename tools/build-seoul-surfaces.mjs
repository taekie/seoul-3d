// Restore full landcover rings (including holes and bare rock) from the city tile snapshot.
import{PbfReader}from'pbf';import{VectorTile,classifyRings}from'@mapbox/vector-tile';
import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
const source='https://tiles.openfreemap.org/planet/20260830_080001_pt',z=14;
const {meta}=JSON.parse(readFileSync(new URL('../data/seoul.json',import.meta.url)));
const tx=lon=>(lon+180)/360*2**z,ty=lat=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z;
const [w,s,e,n]=meta.bbox,jobs=[],polygons=[];const cache=join(tmpdir(),'seoul-surface-tiles');mkdirSync(cache,{recursive:true});
for(let x=Math.floor(tx(w));x<=Math.floor(tx(e));x++)for(let y=Math.floor(ty(n));y<=Math.floor(ty(s));y++)jobs.push([x,y]);
await Promise.all(Array.from({length:8},async(_,worker)=>{
 for(let i=worker;i<jobs.length;i+=8){const[x,y]=jobs[i],file=join(cache,`${x}-${y}.pbf`);let bytes;
  if(existsSync(file))bytes=readFileSync(file);else{const r=await fetch(`${source}/${z}/${x}/${y}.pbf`,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Tile ${x}/${y}: ${r.status}`);bytes=new Uint8Array(await r.arrayBuffer());writeFileSync(file,bytes);}
  const tile=new VectorTile(new PbfReader(bytes)),l=tile.layers.landcover;if(!l)continue;
  for(let k=0;k<l.length;k++){const f=l.feature(k),p=f.properties;let kind=p.class==='wood'?1:p.class==='rock'?6:p.subclass==='golf_course'?2:p.class==='grass'?0:p.class==='farmland'?3:null;if(kind===null)continue;
   for(const poly of classifyRings(f.loadGeometry())){const rings=poly.map(r=>r.flatMap(pt=>[Math.round(((x+pt.x/l.extent)-tx(meta.center[0]))/2**z*meta.kx),Math.round(-((y+pt.y/l.extent)-ty(meta.center[1]))/2**z*meta.kx)]));polygons.push({t:kind,r:rings[0],holes:rings.slice(1)});}
  }
 }
}));
polygons.sort((a,b)=>a.t-b.t||a.r[0]-b.r[0]||a.r[1]-b.r[1]);
writeFileSync(new URL('../data/seoul.surfaces.json',import.meta.url),JSON.stringify({source,attribution:'© OpenStreetMap contributors · ODbL',polygons})+'\n');
console.log(`${jobs.length} tiles, ${polygons.length} surfaces, ${polygons.filter(p=>p.t===6).length} rock polygons`);
