// Extract named neighbourhood POIs from the same immutable OpenFreeMap snapshot.
// Usage: node tools/build-pois.mjs seoul|jeju
import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { readFileSync, writeFileSync } from 'node:fs';
const city=process.argv[2];if(!['seoul','jeju','chapelhill'].includes(city))throw new Error('Expected seoul, jeju or chapelhill');
const {meta}=JSON.parse(readFileSync(new URL(`../data/${city}.json`,import.meta.url)));
const z=14,source='https://tiles.openfreemap.org/planet/20260830_080001_pt',jobs=[],found=new Map();
const tileX=lon=>(lon+180)/360*2**z;
const tileY=lat=>(1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*2**z;
const [west,south,east,north]=meta.bbox;
for(let x=Math.floor(tileX(west));x<=Math.floor(tileX(east));x++)for(let y=Math.floor(tileY(north));y<=Math.floor(tileY(south));y++)jobs.push([x,y]);
const classify=(p,layer)=>{
 const c=p.class,s=p.subclass;
 if(city==='chapelhill'){
  if(c==='school'&&s==='school')return 'school';
  if(s==='supermarket')return 'supermarket';
  if(s==='convenience')return 'convenience';
  if(c==='pharmacy'||s==='pharmacy')return 'pharmacy';
  if(c==='cafe'||s==='cafe')return 'cafe';
  if(c==='restaurant'||['restaurant','fast_food'].includes(s))return 'restaurant';
  if(c==='shop'||s==='mall')return 'shop';
 }
 if(c==='beach'||s==='beach')return 'beach';
 if(c==='lodging'&&s==='hotel')return 'hotel';
 if(s==='department_store')return 'department_store';
 if(layer==='mountain_peak'&&c==='peak')return 'mountain';
 if(c==='railway'&&['station','subway'].includes(s))return 'station';
 if(c==='college'&&['college','university'].includes(s))return 'university';
 if(c==='park'&&s==='park')return 'park';
 if(c==='museum'||c==='theatre'||(c==='art_gallery'&&s==='gallery')||(c==='library'&&s==='library'))return 'culture';
 if(c==='marketplace'||s==='marketplace')return 'market';
 if(c==='attraction'&&['attraction','viewpoint'].includes(s))return 'sight';
 return null;
};
let done=0;
await Promise.all(Array.from({length:6},async(_,worker)=>{
 for(let i=worker;i<jobs.length;i+=6){const [tx,ty]=jobs[i];let tile;
  for(let attempt=0;attempt<3;attempt++){
   try{const r=await fetch(`${source}/${z}/${tx}/${ty}.pbf`,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);tile=new VectorTile(new PbfReader(new Uint8Array(await r.arrayBuffer())));break;}
   catch(e){if(attempt===2)throw new Error(`Tile ${tx}/${ty}: ${e.message}`);await new Promise(r=>setTimeout(r,500*(attempt+1)));}
  }
  for(const layerName of ['poi','mountain_peak']){
   const layer=tile.layers[layerName];if(!layer)continue;
   for(let j=0;j<layer.length;j++){
    const f=layer.feature(j),p=f.properties,category=classify(p,layerName);
    let name=String(p['name:ko']||p.name||'').trim();
    if(!category||!name||name.length>65||/^(박물관|도서관|공원|전망대|시장|Museum|Library)$/i.test(name))continue;
    const point=f.loadGeometry()[0]?.[0];if(!point||point.x<0||point.y<0||point.x>=layer.extent||point.y>=layer.extent)continue;
    const lon=(tx+point.x/layer.extent)/2**z*360-180;
    const lat=Math.atan(Math.sinh(Math.PI*(1-2*(ty+point.y/layer.extent)/2**z)))*180/Math.PI;
    if(lon<west||lon>east||lat<south||lat>north)continue;
    if(category==='station'&&/[가-힣]/.test(name)&&!name.endsWith('역'))name+='역';
    const major=category==='beach'||category==='university'||category==='mountain'||(category==='park'&&/한강|서울숲|올림픽|월드컵|국립|대공원/.test(name));
    const minor=['hotel','convenience','pharmacy','cafe','restaurant','shop'].includes(category)||/어린이|소공원|문고|작은도서관/.test(name)||category==='sight'||p.subclass==='gallery';
    const tier=major?1:minor?3:2;
    const id=`${layerName}:${f.id??`${name}:${lon.toFixed(5)}:${lat.toFixed(5)}`}`;
    found.set(id,{id,name,category,lon:+lon.toFixed(6),lat:+lat.toFixed(6),tier});
   }
  }
  if(++done%100===0)console.log(`${city}: ${done}/${jobs.length}`);
 }
}));
if(city==='jeju'){
 const beaches=JSON.parse(readFileSync(new URL('../data/jeju.beaches.json',import.meta.url)));
 for(const p of beaches.pois)found.set(p.id,p);
}
if(city==='chapelhill'){
 const places=JSON.parse(readFileSync(new URL('../data/chapelhill.places.json',import.meta.url)));
 for(const p of places.pois)found.set(p.id,p);
}
// Station platforms and duplicated area/node labels should read as one place.
const result=[],byName=new Map();
for(const p of [...found.values()].sort((a,b)=>a.id.localeCompare(b.id))){
 const key=p.category+':'+p.name,previous=byName.get(key)||[];
 const duplicate=previous.some(q=>Math.hypot((p.lon-q.lon)*Math.cos(p.lat*Math.PI/180)*111320,(p.lat-q.lat)*111320)<(p.category==='station'?420:180));
 if(duplicate)continue;previous.push(p);byName.set(key,previous);result.push(p);
}
const payload={source:'OpenFreeMap / OpenMapTiles · © OpenStreetMap contributors',sourceUrl:source,snapshot:'2026-08-30',license:'ODbL',city,pois:result};
if(city==='jeju')payload.supplementarySource='해수욕장 위치: 제주관광공사 Visit Jeju (각 POI sourceUrl 참고)';
if(city==='chapelhill')payload.supplementarySource='Chapel Watch Village: official neighborhood map (POI sourceUrl)';
writeFileSync(new URL(`../data/${city}.pois.json`,import.meta.url),JSON.stringify(payload)+'\n');
console.log(city,result.length,Object.fromEntries([...new Set(result.map(p=>p.category))].map(c=>[c,result.filter(p=>p.category===c).length])));
