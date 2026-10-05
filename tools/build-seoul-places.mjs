// Reuse the immutable z14 tiles downloaded by build-seoul-surfaces.mjs.
import{readFileSync,readdirSync,writeFileSync}from'node:fs';import{join}from'node:path';import{tmpdir}from'node:os';import{VectorTile}from'@mapbox/vector-tile';import{PbfReader}from'pbf';
const {meta}=JSON.parse(readFileSync(new URL('../data/seoul.json',import.meta.url))),[w,s,e,n]=meta.bbox,pois=new Map(),dir=join(tmpdir(),'seoul-surface-tiles');
for(const file of readdirSync(dir).filter(f=>f.endsWith('.pbf')).sort()){
 const[x,y]=file.slice(0,-4).split('-').map(Number),tile=new VectorTile(new PbfReader(readFileSync(join(dir,file)))),layer=tile.layers.place;if(!layer)continue;
 for(let i=0;i<layer.length;i++){const f=layer.feature(i),p=f.properties;if(!['borough','quarter','suburb','neighbourhood'].includes(p.class))continue;
  const pt=f.loadGeometry()[0][0],lon=(x+pt.x/layer.extent)/2**14*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+pt.y/layer.extent)/2**14)))*180/Math.PI;
  if(lon<w||lon>e||lat<s||lat>n)continue;
  const name=p['name:ko']||p.name,id=`place:${f.id??name+':'+lon.toFixed(3)+':'+lat.toFixed(3)}`;
  pois.set(id,{id,name,category:'neighborhood',placeClass:p.class,tier:p.class==='borough'?1:2,lon:+lon.toFixed(6),lat:+lat.toFixed(6)});
 }
}
writeFileSync(new URL('../data/seoul.places.json',import.meta.url),JSON.stringify({source:'https://tiles.openfreemap.org/planet/20260830_080001_pt',attribution:'© OpenStreetMap contributors · ODbL',pois:[...pois.values()]})+'\n');console.log(`${pois.size} district and neighbourhood names`);
