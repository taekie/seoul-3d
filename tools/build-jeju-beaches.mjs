// Official beach map anchors omitted from the vector tile POI layer.
// Only names and coordinates are retained; no descriptions or images are copied.
import {writeFileSync} from 'node:fs';
const ids=['CONT_000000000500697','CONT_000000000500693','CONT_000000000500083',
  'CONT_000000000500604','CNTS_000000000001196','CONT_000000000500079',
  'CNTS_200000000007344','CONT_000000000500496','CONT_000000000500301'];
const pois=[];
for(const id of ids){
  const sourceUrl=`https://www.visitjeju.net/kr/detail/view?contentsid=${id}`;
  const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`${id}: HTTP ${response.status}`);
  const html=await response.text();
  const match=html.match(/id="__NUXT_DATA__">([\s\S]*?)<\/script>/);
  if(!match)throw new Error(`${id}: missing page data`);
  let place;
  const walk=value=>{
    if(!value||typeof value!=='object')return;
    if(value.contentsid===id&&value.latitude&&value.longitude&&value.title)place=value;
    for(const child of Object.values(value))walk(child);
  };
  for(const value of JSON.parse(match[1])){
    if(typeof value!=='string'||!value.includes('latitude'))continue;
    try{walk(JSON.parse(value));}catch{}
  }
  if(!place||!place.title.includes('해수욕장'))throw new Error(`${id}: beach coordinates not found`);
  pois.push({id:`visitjeju:${id}`,name:place.title,category:'beach',lon:place.longitude,lat:place.latitude,tier:1,sourceUrl});
}
writeFileSync(new URL('../data/jeju.beaches.json',import.meta.url),JSON.stringify({source:'제주관광공사 Visit Jeju',retrievedAt:new Date().toISOString().slice(0,10),pois},null,2)+'\n');
console.log(pois.map(p=>[p.name,p.lon,p.lat]));
