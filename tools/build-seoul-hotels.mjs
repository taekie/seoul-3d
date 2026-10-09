// Refresh the official, currently valid Seoul five-star hotel list; no API key needed.
import {writeFileSync} from 'node:fs';
const api='https://www.hotelrating.or.kr/api';
const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`HTTP ${r.status}`);const j=await r.json();if(!j.success)throw Error(j.message);return j.data;};
const list=(await get(`${api}/hotel?lastGrade=5&hotelAreaCode=SIDO0001&size=100&page=0`)).hotelList;
if(list.totalElements>list.content.length)throw Error('Hotel list requires pagination');
const aliases={352:'웨스틴 조선 서울',347:'롯데호텔 서울',348:'서울신라호텔',1330:'조선 팰리스 서울 강남',929:'시그니엘 서울'};
const today=new Date().toISOString().slice(0,10),pois=[];
for(const hotel of list.content){
 const d=await get(`${api}/hotel/${hotel.hotelSno}?applySno=${hotel.applySno}`);
 if(d.lastGrade!==5||d.lastGradeStatus!=='1'||d.lastGradeEndDate<today)continue;
 const lon=Number(d.hotelCoordinateX),lat=Number(d.hotelCoordinateY);
 if(!(lon>126&&lon<128&&lat>37&&lat<38))throw Error(`Invalid location: ${d.hotelName}`);
 pois.push({id:`hotelrating:${d.hotelSno}`,name:aliases[d.hotelSno]||d.hotelName.replace(/\(주\)|SK 네트웍스|호텔롯데|서부티엔디/g,'').trim(),category:'hotel',lon,lat,tier:2,stars:5,officialName:d.hotelName,validUntil:d.lastGradeEndDate,sourceUrl:`https://www.hotelrating.or.kr/hotel/${d.hotelSno}?applySno=${hotel.applySno}`});
}
if(!pois.length)throw Error('No verified hotels; refusing to overwrite');
writeFileSync(new URL('../data/seoul.hotels.json',import.meta.url),JSON.stringify({source:'한국관광협회중앙회 호텔업등급관리국',sourceUrl:'https://www.hotelrating.or.kr/hotel?lastGrade=5&hotelAreaCode=SIDO0001',checkedAt:today,criteria:'서울, 유효한 공식 5성 등급',pois},null,2)+'\n');
console.log(`Verified ${pois.length} five-star Seoul hotels`);
