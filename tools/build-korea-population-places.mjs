// OSM settlement anchors for regional population labels. Uses the overview tile cache.
import{readFileSync,readdirSync,writeFileSync}from'node:fs';import{join}from'node:path';import{tmpdir}from'node:os';import{PbfReader}from'pbf';import{VectorTile}from'@mapbox/vector-tile';
const source='https://tiles.openfreemap.org/planet/20260830_080001_pt',dir=join(tmpdir(),'korea-atlas-build/osm-z9');
const data=JSON.parse(readFileSync(new URL('../data/korea.json',import.meta.url))),{bbox,grid}=data.meta;
const raw=readFileSync(new URL('../data/korea.terrain.bin',import.meta.url));const heights=new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2);
const merc=lat=>Math.asinh(Math.tan(lat*Math.PI/180)),seen=new Map();
for(const file of readdirSync(dir).filter(f=>f.endsWith('.pbf')).sort()){
 const[x,y]=file.slice(0,-4).split('-').map(Number),tile=new VectorTile(new PbfReader(readFileSync(join(dir,file)))),l=tile.layers.place;if(!l)continue;
 for(let i=0;i<l.length;i++){const f=l.feature(i),p=f.properties;if(!['city','town','village'].includes(p.class))continue;const point=f.loadGeometry()[0][0];
  const lon=(x+point.x/l.extent)/512*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+point.y/l.extent)/512)))*180/Math.PI;
  if(lon<bbox[0]||lon>bbox[2]||lat<bbox[1]||lat>bbox[3])continue;
  const col=Math.round((lon-bbox[0])/(bbox[2]-bbox[0])*(grid.width-1)),row=Math.round((merc(bbox[3])-merc(lat))/(merc(bbox[3])-merc(bbox[1]))*(grid.height-1));
  if(heights[row*grid.width+col]<0)continue;
  const name=p['name:ko']||p.name;if(!name||!/[가-힣]/.test(name))continue;
  const id=String(f.id??`${name}:${lon.toFixed(3)}:${lat.toFixed(3)}`);seen.set(id,{id,name,kind:p.class,lon:+lon.toFixed(6),lat:+lat.toFixed(6)});
 }
}
const places=[...seen.values()];writeFileSync(new URL('../data/korea.population-places.json',import.meta.url),JSON.stringify({source,attribution:'© OpenStreetMap contributors · ODbL',mask:'Overview Korean land mask, approximately 900m',places})+'\n');
console.log(places.length,places.reduce((s,p)=>(s[p.kind]=(s[p.kind]||0)+1,s),{}));
