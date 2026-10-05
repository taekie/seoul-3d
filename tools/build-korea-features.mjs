// Named Korean rivers and representative peaks from the immutable OSM tile snapshot.
// Run before build-korea.py, or independently; the browser loads this small layer locally.
import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const z=9,source='https://tiles.openfreemap.org/planet/20260830_080001_pt';
const {meta}=JSON.parse(readFileSync(new URL('../data/korea.json',import.meta.url)));
const [west,south,east,north]=meta.bbox;
const tx=lon=>(lon+180)/360*2**z,ty=lat=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z;
const cache=join(tmpdir(),'korea-atlas-build','osm-z9');mkdirSync(cache,{recursive:true});
const jobs=[];for(let x=Math.floor(tx(west));x<=Math.floor(tx(east));x++)for(let y=Math.floor(ty(north));y<=Math.floor(ty(south));y++)jobs.push([x,y]);
const major=new Set(['한강','낙동강','금강','영산강','섬진강','대동강','압록강','두만강']);
const wanted=new Set([...major,'남한강','북한강','소양강','홍천강','임진강','한탄강','안성천','삽교천','만경강','동진강','탐진강','남강','금호강','태화강','형산강','청천강','예성강','재령강','대령강','성천강','장진강','허천강','충만강']);
// Bounds disambiguate repeated summit names (비로봉, 천왕봉, etc.).
const mountains=[
 ['백두산',/백두산|장군봉|Paektu|Changbai/i,[127.8,41.7,128.4,42.3],true],
 ['관모봉',/관모봉/,[129,41.3,129.8,42.0],true],
 ['묘향산',/묘향산|비로봉/,[126,39.7,126.6,40.3],true],
 ['금강산',/금강산|비로봉/,[127.9,38.4,128.4,39.0],true],
 ['설악산',/설악산|대청봉/,[128.2,37.9,128.8,38.4],true],
 ['지리산',/지리산|천왕봉/,[127.3,35.1,128,35.6],true],
 ['한라산',/한라산/,[126.3,33.2,126.8,33.6],true],
 ['낭림산',/낭림산|랑림산/,[126.9,40.1,127.7,40.7],false],
 ['칠보산',/칠보산|상매봉/,[129.2,40.8,130,41.5],false],
 ['구월산',/구월산|사황봉/,[125,38.3,125.5,38.8],false],
 ['북한산',/북한산|백운대/,[126.8,37.5,127.2,37.8],false],
 ['오대산',/오대산|비로봉/,[128.3,37.6,128.8,38.0],false],
 ['태백산',/태백산|장군봉/,[128.8,37.0,129.2,37.3],false],
 ['소백산',/소백산|비로봉/,[128.2,36.7,128.8,37.1],false],
 ['속리산',/속리산|천왕봉/,[127.6,36.4,128.1,36.8],false],
 ['덕유산',/덕유산|향적봉/,[127.5,35.5,128.1,36.1],false],
 ['계룡산',/계룡산|천황봉/,[127.0,36.2,127.4,36.6],false],
 ['팔공산',/팔공산|비로봉/,[128.5,35.9,128.9,36.2],false],
 ['무등산',/무등산|천왕봉/,[126.9,35,127.2,35.3],false],
 ['내장산',/내장산|신선봉/,[126.7,35.3,127.0,35.6],false],
 ['가야산',/가야산|상왕봉|칠불봉/,[128.0,35.6,128.3,36.0],false],
];
const inside=([x,y],b)=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3];
const lines=[],peaks=new Map(),availableRivers=new Set();let done=0;
// Clip buffer geometry to the owning tile to avoid doubled, overlapping river ribbons.
function clip(a,b,E){
 let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
 for(const [p,q] of [[-dx,a.x],[dx,E-a.x],[-dy,a.y],[dy,E-a.y]]){
  if(!p){if(q<0)return null;continue;}const t=q/p;
  if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
 }
 return [[a.x+lo*dx,a.y+lo*dy],[a.x+hi*dx,a.y+hi*dy]];
}
await Promise.all(Array.from({length:6},async(_,worker)=>{
 for(let i=worker;i<jobs.length;i+=6){
  const [x,y]=jobs[i],file=join(cache,`${x}-${y}.pbf`);let bytes;
  if(existsSync(file))bytes=readFileSync(file);else{
   for(let attempt=0;attempt<3;attempt++)try{
    const r=await fetch(`${source}/${z}/${x}/${y}.pbf`,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    bytes=new Uint8Array(await r.arrayBuffer());writeFileSync(file,bytes);break;
   }catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,500));}
  }
  const tile=new VectorTile(new PbfReader(bytes));
  for(const type of ['waterway','mountain_peak']){
   const layer=tile.layers[type];if(!layer)continue;
   const E=layer.extent,toGeo=([px,py])=>[(x+px/E)/2**z*360-180,Math.atan(Math.sinh(Math.PI*(1-2*(y+py/E)/2**z)))*180/Math.PI];
   for(let j=0;j<layer.length;j++){
    const f=layer.feature(j),p=f.properties;let name=String(p['name:ko']||p.name||'').replace(/\s/g,'').replace('례성강','예성강');
    if(type==='waterway'){
     if(p.class!=='river')continue;availableRivers.add(name);if(!wanted.has(name))continue;
     for(const points of f.loadGeometry()){
      let current=[];
      const flush=()=>{if(current.length>1)lines.push({name,points:current});current=[];};
      for(let k=1;k<points.length;k++){
       const clipped=clip(points[k-1],points[k],E);if(!clipped){flush();continue;}
       const [a,b]=clipped.map(toGeo);
       if(!inside(a,meta.bbox)&&!inside(b,meta.bbox)){flush();continue;}
       if(!current.length)current.push(a);else if(Math.hypot(current.at(-1)[0]-a[0],current.at(-1)[1]-a[1])>1e-6){flush();current.push(a);}
       current.push(b);
      }flush();
     }
    }else{
     if(!['peak','volcano'].includes(p.class))continue;
     const point=f.loadGeometry()[0]?.[0];if(!point||point.x<0||point.y<0||point.x>=E||point.y>=E)continue;
     const coord=toGeo([point.x,point.y]);
     for(const [label,match,bounds,main] of mountains){
      if(!inside(coord,bounds)||!match.test(name+' '+(p['name:en']||'')))continue;
      const old=peaks.get(label);if(old&&old.elevation>=Number(p.ele))continue;
      peaks.set(label,{id:'mountain:'+label,name:label,sourceName:p['name:ko']||p.name,kind:'mountain',lon:+coord[0].toFixed(5),lat:+coord[1].toFixed(5),elevation:Number(p.ele)||0,priority:main?3:1,showBelow:main?4000000:900000,cam:[180000,1.05]});
     }
    }
   }
  }
  if(++done%40===0)console.log(`Tiles ${done}/${jobs.length}`);
 }
}));
// The z9 source omits Baegundae; retain its surveyed OSM node from our z14 Seoul extraction.
const seoul=JSON.parse(readFileSync(new URL('../data/seoul.pois.json',import.meta.url)));
const bukhansan=seoul.pois.find(p=>p.category==='mountain'&&p.name==='북한산(백운대)');
if(bukhansan)peaks.set('북한산',{id:'mountain:북한산',name:'북한산',sourceName:bukhansan.name,sourceId:bukhansan.id,kind:'mountain',lon:bukhansan.lon,lat:bukhansan.lat,priority:1,showBelow:900000,cam:[180000,1.05]});
for(const name of ['백두산','한라산'])if(peaks.has(name))peaks.get(name).priority=4;
// Stitch tile/OSM-way endpoints; do not invent connections across reservoirs or gaps.
const key=p=>p.map(v=>v.toFixed(4)).join(',');
const grouped=new Map();for(const l of lines){if(!grouped.has(l.name))grouped.set(l.name,[]);grouped.get(l.name).push(l.points);}
const distance=(a,b)=>Math.hypot((a[0]-b[0])*88000,(a[1]-b[1])*111320);
function simplify(points,tolerance=220){
 if(points.length<=2)return points;
 const a=points[0],b=points.at(-1),dx=(b[0]-a[0])*88000,dy=(b[1]-a[1])*111320,d2=dx*dx+dy*dy;
 let best=tolerance,index=-1;
 for(let i=1;i<points.length-1;i++){
  const x=(points[i][0]-a[0])*88000,y=(points[i][1]-a[1])*111320,t=d2?Math.max(0,Math.min(1,(x*dx+y*dy)/d2)):0;
  const d=Math.hypot(x-t*dx,y-t*dy);if(d>best){best=d;index=i;}
 }
 return index<0?[a,b]:[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)];
}
const rivers=[],labels=[];
for(const [name,parts] of [...grouped].sort((a,b)=>a[0].localeCompare(b[0]))){
 parts.sort((a,b)=>key(a[0]).localeCompare(key(b[0])));
 const seen=new Set(),unique=[];
 for(const part of parts){const k=part.map(key).join('|'),r=[...part].reverse().map(key).join('|');if(seen.has(k)||seen.has(r))continue;seen.add(k);unique.push(part);}
 for(let changed=true;changed;){changed=false;
  outer:for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
   let a=unique[i],b=unique[j];
   if(key(a.at(-1))===key(b[0])){}else if(key(a.at(-1))===key(b.at(-1)))b=[...b].reverse();
   else if(key(a[0])===key(b.at(-1)))[a,b]=[b,a];
   else if(key(a[0])===key(b[0]))a=[...a].reverse();else continue;
   unique[i]=[...a,...b.slice(1)];unique.splice(j,1);changed=true;break outer;
  }
 }
 const length=p=>p.slice(1).reduce((n,b,i)=>n+distance(p[i],b),0);
 unique.sort((a,b)=>length(b)-length(a));
 const longest=unique[0];if(!longest||length(longest)<3000)continue;
 const half=length(longest)*.5;let walked=0,anchor=longest[0];
 for(let i=1;i<longest.length;i++){walked+=distance(longest[i-1],longest[i]);if(walked>=half){anchor=longest[i];break;}}
 labels.push({id:'river:'+name,name,kind:'river',lon:+anchor[0].toFixed(5),lat:+anchor[1].toFixed(5),priority:major.has(name)?3:1,showBelow:major.has(name)?4000000:1000000,cam:[230000,1.1]});
 for(const points of unique){if(length(points)<800)continue;rivers.push({name,major:major.has(name),points:simplify(points).map(p=>p.map(v=>+v.toFixed(5)))});}
}
const features=[...labels.sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name)),...[...peaks.values()].sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name))].map(p=>({...p,en:p.kind==='river'?'RIVER':'MOUNTAIN',desc:p.kind==='river'?'강줄기를 따라 주변 지형을 둘러보세요.':`${p.sourceName} 부근의 지형을 둘러보세요. (개괄 지형 모형)`}));
const output={source:'OpenFreeMap / OpenMapTiles · © OpenStreetMap contributors',sourceUrl:source,snapshot:'2026-08-30',license:'ODbL',features,rivers};
writeFileSync(new URL('../data/korea.features.json',import.meta.url),JSON.stringify(output)+'\n');
console.log(JSON.stringify({rivers:labels.map(p=>p.name),mountains:[...peaks.keys()],missingRivers:[...wanted].filter(n=>!labels.some(p=>p.name===n)),missingMountains:mountains.filter(m=>!peaks.has(m[0])).map(m=>m[0]),bytes:Buffer.byteLength(JSON.stringify(output)),lines:rivers.length},null,2));
writeFileSync(join(cache,'available-rivers.json'),JSON.stringify([...availableRivers].sort()));
