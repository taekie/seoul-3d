import * as THREE from 'three';
import { HEIGHT_EXAGGERATION } from './miniature.js';

// New models use physical horizontal dimensions. Existing Seoul landmark shrink is
// compensated in the authored scale; heights still receive the common 2.5x and 10% reduction.
const scale=[1/.81,3];
const feature=(name,lon,lat,height,clear,sourceUrl)=>({name,lon,lat,height,clear,sourceUrl});
export const EXTRA_SEOUL_LANDMARKS=[
 {id:'gocheokdome',name:'고척스카이돔',en:'Gocheok Sky Dome',aliases:['고척돔'],lon:126.8670719,lat:37.4981653,s:scale,clear:115,cam:[1150,.8],bearing:.5,desc:'은빛 타원형 돔 지붕과 둘레의 유리 입면',sourceUrl:'https://www.sisul.or.kr/open_content/skydome/',features:[feature('돔구장',126.8670719,37.4981653,62,115,'https://www.openstreetmap.org/way/258637347')]},
 {id:'supremecourt',name:'대법원',en:'Supreme Court of Korea',lon:127.0053182,lat:37.4922812,s:scale,clear:105,cam:[1000,.88],bearing:1.8,desc:'중앙부가 높고 양옆으로 펼쳐진 대칭 청사',sourceUrl:'https://www.g.scourt.go.kr/supreme/building/map/index.html',features:[feature('대법원 청사',127.0053182,37.4922812,45,105,'https://www.openstreetmap.org/relation/4042541')]},
 {id:'nationallibrary',name:'국립중앙도서관',en:'National Library of Korea',aliases:['국립중앙도서관 본관'],lon:127.0028344,lat:37.4974973,s:scale,clear:85,cam:[950,.88],bearing:1.8,desc:'긴 석재 기둥과 유리창이 이어지는 본관',sourceUrl:'https://books.nl.go.kr/NL/contents/N50106010100.do',features:[feature('본관',127.0028344,37.4974973,30,85,'https://www.openstreetmap.org/way/256787242')]},
 {id:'expressbus',name:'서울고속버스터미널',en:'Seoul Express Bus Terminal',aliases:['고속터미널','고속버스터미널'],lon:127.0066855,lat:37.50541865,s:scale,clear:175,cam:[1450,.88],bearing:1.3,desc:'삼각형 옆면과 경사진 지붕, 넓은 주차장의 고속버스',sourceUrl:'https://www.openstreetmap.org/way/309352819',features:[feature('경부·영동선 터미널',127.0066855,37.50541865,36,175,'https://www.openstreetmap.org/way/309352819')]},
 {id:'gimpo',name:'김포공항',en:'Gimpo Airport',lon:126.7924136,lat:37.5594572,s:[21,15],cam:[1800,.82],bearing:-2.1,desc:'활주로 위, 크게 과장한 여객기 한 대',sourceUrl:'https://www.openstreetmap.org/way/228870160',features:[]},
 {id:'botanic',name:'서울식물원',en:'Seoul Botanic Park',lon:126.8350241,lat:37.5693849,s:scale,cam:[700,.84],bearing:-.4,desc:'가운데가 오목한 유리 온실',sourceUrl:'https://botanicpark.seoul.go.kr/front/wbook/upload/12_SBP.pdf',features:[feature('온실',126.8350241,37.5693849,25,53,'https://www.openstreetmap.org/way/643248046'),feature('식물문화센터',126.8350394,37.570075,12,43,'https://www.openstreetmap.org/way/643248047')]},
 {id:'gyeongbok',name:'경복궁',en:'Gyeongbokgung Palace',lon:126.9769542,lat:37.5785275,s:scale,cam:[900,.95],bearing:Math.PI,desc:'근정전의 겹지붕과 연못 위의 경회루',sourceUrl:'https://royal.khs.go.kr/',features:[feature('근정전',126.9769542,37.5785275,24,37,'https://www.openstreetmap.org/way/170199428'),feature('경회루',126.9759243,37.5797172,21,36,'https://www.openstreetmap.org/way/170199469')]},
 {id:'changdeok',name:'창덕궁',en:'Changdeokgung Palace',lon:126.9911051,lat:37.5794629,s:scale,cam:[750,.95],bearing:-2.4,desc:'숲 곁의 인정전과 마당을 둘러싼 행각',sourceUrl:'https://royal.khs.go.kr/',features:[feature('인정전',126.9911051,37.5794629,24,35,'https://www.openstreetmap.org/way/380863259'),feature('서행각',126.990716,37.578971,6,22,'https://www.openstreetmap.org/way/894611017'),feature('동행각',126.9915649,37.5790426,6,22,'https://www.openstreetmap.org/way/894611029')]},
 {id:'deoksu',name:'덕수궁',en:'Deoksugung Palace',lon:126.9748209,lat:37.5658067,s:scale,cam:[700,.95],bearing:2.8,desc:'중화전의 기와지붕과 석조전의 흰 열주',sourceUrl:'https://royal.khs.go.kr/',features:[feature('중화전',126.9748209,37.5658067,14,28,'https://www.openstreetmap.org/way/181574577'),feature('석조전',126.9742399,37.5663551,18,37,'https://www.openstreetmap.org/relation/19357693')]},
 {id:'peacegate',name:'세계평화의문',en:'World Peace Gate',lon:127.1153937,lat:37.5183131,s:scale,cam:[550,.78],bearing:-.72,desc:'올림픽공원 입구의 날개처럼 펼친 문',sourceUrl:'https://www.ksponco.or.kr/olympicpark/',features:[feature('세계평화의문',127.1153937,37.5183131,24,38,'https://www.openstreetmap.org/relation/16563734')]},
 {id:'artscenter',name:'예술의전당',en:'Seoul Arts Center',aliases:['예술의 전당'],lon:127.0137685,lat:37.4792506,s:scale,cam:[950,.88],bearing:3.0,desc:'우면산 아래, 갓 모양 지붕의 오페라하우스',sourceUrl:'https://www.sac.or.kr/',features:[feature('오페라하우스',127.0137685,37.4792506,30,57,'https://www.openstreetmap.org/relation/8439129'),feature('음악당',127.0117345,37.4791618,22,57,'https://www.openstreetmap.org/way/303947127')]},
 {id:'snugate',name:'서울대학교 정문',en:'SNU Main Gate',aliases:['서울대 정문','샤 조형물'],lon:126.94837432,lat:37.46636894,s:[6,6.5],clear:35,cam:[800,.85],bearing:0,desc:'서울대 입구의 은빛 샤 조형물',sourceUrl:'https://snu.ac.kr/about/history/history_record?bbsidx=134457&md=v',features:[]},
 {id:'lonetree',name:'올림픽공원 나홀로 나무',en:'Olympic Park Lone Tree',aliases:['나홀로나무','나홀로 나무'],lon:127.120378,lat:37.522742,s:[4,5],cam:[650,.9],bearing:-.4,desc:'몽촌토성 잔디 언덕 위의 나무 한 그루',sourceUrl:'https://www.ksponco.or.kr/olympicpark/',features:[]},
 {id:'nationalmuseum',name:'국립중앙박물관',en:'National Museum of Korea',lon:126.980318,lat:37.523954,s:scale,cam:[1400,.9],bearing:0,clear:100,desc:'가운데 열린마당과 앞쪽 거울못',sourceUrl:'https://www.museum.go.kr/MUSEUM/contents/M0103040000.do',features:[feature('서관',126.9789,37.523954,43,115,'https://www.openstreetmap.org/node/1683648002'),feature('동관',126.98165,37.523954,43,115,'https://www.openstreetmap.org/node/1683648002')]},
 {id:'independence',name:'독립문',en:'Independence Gate',lon:126.95953549,lat:37.5724021,s:[5,8],clear:35,cam:[650,.85],bearing:Math.PI,desc:'돌기둥 사이로 열린 독립공원의 아치',sourceUrl:'https://www.openstreetmap.org/relation/10776430',features:[]},
 {id:'childcoaster',name:'어린이대공원',en:'Children’s Grand Park',aliases:['서울어린이대공원','패밀리코스터'],lon:127.08385018,lat:37.55123117,s:[2.4,3],cam:[1300,.8],bearing:0,desc:'노란 레일과 파란 기둥, 매달린 빨간 좌석의 패밀리코스터',sourceUrl:'https://www.openstreetmap.org/way/417133466',features:[]},
 {id:'elephanttrain',name:'서울대공원',en:'Seoul Grand Park',aliases:['서울대공원 코끼리열차'],lon:127.011859,lat:37.434469,s:[4,5],cam:[1000,.85],bearing:2.6,desc:'큰 귀와 긴 코의 기관차에 이어진 코끼리열차',sourceUrl:'https://www.openstreetmap.org/way/383397003',features:[feature('종합안내소',127.01120415,37.43377897,12,35,'https://www.openstreetmap.org/way/40790908')]},
 {id:'gwacheonscience',name:'국립과천과학관',en:'Gwacheon National Science Museum',aliases:['과천과학관'],lon:127.00531773,lat:37.43920721,s:[2.8,4],cam:[1000,.85],bearing:0,desc:'은색 천체투영관과 옆에 세운 흰 나로호 모형',sourceUrl:'https://www.openstreetmap.org/way/279271031',features:[feature('천체투영관',127.00531773,37.43920721,25,32,'https://www.openstreetmap.org/way/279271031')]},
];

export function createSeoulBuilders({box,cyl,sphere,hipRoof,rod,group,mat,C}) {
 const tileRoof=(...args)=>{const roof=hipRoof(...args);const ridge=roof.children[1];ridge.scale.y=.22;ridge.position.y-=1.3;return roof;};
 const byId=new Map(EXTRA_SEOUL_LANDMARKS.map(l=>[l.id,l]));
 const mercator=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
 const place=(g,obj,l,f,city)=>{
  const k=city?.data.meta.kx??31774477.874757443;
  const x=(f.lon-l.lon)/360*k,z=-(mercator(f.lat)-mercator(l.lat))/(2*Math.PI)*k;
  let y=0;if(city)y=(city.terrain.at(city.lonToX(f.lon),city.latToY(f.lat))-city.terrain.at(city.lonToX(l.lon),city.latToY(l.lat)))*HEIGHT_EXAGGERATION/(HEIGHT_EXAGGERATION*.9);
  obj.position.set(x,y,z);g.add(obj);return obj;
 };
 const palaceHall=(w,d,double=true,open=false,night=false)=>{
  const g=group(box(w+8,2.5,d+8,C.stone));
  if(!open)g.add(box(w,7,d,C.woodRed,2.5));
  for(const side of [-1,1])for(let i=0;i<7;i++)g.add(cyl(.55,.65,8,C.woodRed,2.5,8).translateX((i-3)*w/6).translateZ(side*d/2));
  g.add(tileRoof(w+13,d+12,6.5,C.roofTile,10.5),box(w+4,1.2,d+4,C.jade,9.7));
  if(double)g.add(box(w*.75,4,d*.72,C.woodRed,15),tileRoof(w*.75+12,d*.72+10,6,C.roofTile,19));
  for(const x of [-w*.3,0,w*.3])if(!open)g.add(box(3.5,4,.35,night?0xe4be66:C.glassDark,4.5,night?0x493418:0).translateX(x).translateZ(d/2+.3));
  for(let i=0;i<4;i++)g.add(box(11+i*2,.5,2,C.stone,2-i*.5).translateZ(d/2+5+i*2));
  return g;
 };
 return {
  gocheokdome(night){
   const g=group(),base=cyl(78,82,18,C.concrete,0,64);base.scale.z=1.23;g.add(base);
   const roof=new THREE.Mesh(new THREE.SphereGeometry(1,48,18,0,Math.PI*2,0,Math.PI/2),mat(0xc5cecf));roof.scale.set(79,44,98);roof.position.y=18;g.add(roof);
   const crown=new THREE.Mesh(new THREE.SphereGeometry(1,48,10,0,Math.PI*2,0,.62),mat(0xe5e9e6));crown.scale.set(79.2,44.2,98.2);crown.position.y=18;g.add(crown);
   for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2,points=[];
    for(let j=0;j<=18;j++){const t=j/18*Math.PI/2;points.push(new THREE.Vector3(79.3*Math.sin(t)*Math.cos(a),18+44.3*Math.cos(t),98.3*Math.sin(t)*Math.sin(a)));}
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.28,4,false),mat(0x9eacb0)));
   }
   for(let i=0;i<48;i++){
    const a=i/48*Math.PI*2,glass=box(7,7,.8,C.glassBlue,7,night?0x344c4f:0);glass.position.x=Math.sin(a)*79;glass.position.z=Math.cos(a)*98;glass.rotation.y=a;g.add(glass);
    const pillar=box(1.2,17,2,C.silver,0);pillar.position.x=Math.sin(a)*81;pillar.position.z=Math.cos(a)*99;pillar.rotation.y=a;g.add(pillar);
   }
   g.add(box(42,8,13,C.concrete,0).translateZ(98),box(46,1.5,18,C.white,8).translateZ(101),box(32,6,.6,C.glassDark,1,night?0x344c4f:0).translateZ(105));
   for(let i=0;i<4;i++)g.add(box(48+i*4,.45,3,C.stone,1.5-i*.45).translateZ(109+i*3));
   return g;
  },
  supremecourt(night){
   const g=group(box(170,2,100,C.stone));
   for(const x of [-53,53])g.add(box(66,23,64,C.concrete,2).translateX(x),box(68,1.6,66,C.white,25).translateX(x));
   g.add(box(46,39,66,C.concrete,2),box(50,2,70,C.white,41),box(26,7,50,C.concrete,43));
   for(const x of [-77,-65,-53,-41,-29,29,41,53,65,77])for(const y of [7,14,21])g.add(box(5,3.5,.6,C.glassDark,y,night?0x5b4932:0).translateX(x).translateZ(32.4));
   for(const x of [-15,-5,5,15])for(const y of [10,18,26,34])g.add(box(4,5,.6,C.glassDark,y,night?0x5b4932:0).translateX(x).translateZ(33.4));
   g.add(box(35,2,14,C.white,8).translateZ(38),box(22,7,1,C.glassBlue,2,night?0x5b4932:0).translateZ(34));
   for(let i=0;i<4;i++)g.add(box(32+i*4,.5,3,C.stone,2-i*.5).translateZ(43+i*3));
   const lawn=cyl(13,13,.6,0x69966a,0,24);lawn.scale.z=.7;lawn.position.z=64;g.add(lawn);
   g.add(rod([-5,0,64],[0,11,64],1.5,C.steel),rod([0,11,64],[5,0,64],1.5,C.steel));g.rotation.y=1.05;return g;
  },
  nationallibrary(night){
   const g=group(box(100,2,83,C.stone),box(92,26,72,C.concrete,2),box(98,3,78,C.stone,28));
   g.add(box(77,22,1,C.glassBlue,4,night?0x4e5140:0).translateZ(36.5));
   for(let x=-40;x<=40;x+=10)g.add(box(2.3,24,3,C.stone,3).translateX(x).translateZ(38));
   for(let y=8;y<=24;y+=5)g.add(box(80,.5,1,C.white,y).translateZ(37.2));
   g.add(box(100,1.5,8,C.stone,27).translateZ(38),box(28,6,1,C.glassDark,2,night?0x51432e:0).translateZ(38.5));
   for(let i=0;i<5;i++)g.add(box(54+i*5,.4,3,C.stone,2-i*.4).translateZ(43+i*3));
   g.add(box(88,.4,26,0x76a773,.1).translateZ(71),box(12,.5,27,C.stone,.2).translateZ(71));g.rotation.y=1.05;return g;
  },
  expressbus(night){
   const g=group(box(244,2,78,C.stone));
   // Extrude the triangular side section along the building's long axis.
   const section=new THREE.Shape();section.moveTo(-36,0);section.lineTo(36,0);section.lineTo(-36,36);section.closePath();
   const geometry=new THREE.ExtrudeGeometry(section,{depth:236,bevelEnabled:false});geometry.rotateY(Math.PI/2);geometry.translate(-118,2,0);
   g.add(new THREE.Mesh(geometry,mat(0xb1a394)));
   const roof=box(242,1.5,Math.hypot(72,36)+3,C.white);roof.rotation.x=-Math.atan(.5);roof.position.y=20;g.add(roof);
   for(let y=8;y<=29;y+=7){
    g.add(box(225,3,.6,C.glassDark,y,night?0x584c36:0).translateZ(36.4),box(240,1.2,2,C.white,y+3.5).translateZ(36.4));
    const start=2*(y+1)-36,length=36-start;
    for(const x of [-118.4,118.4])g.add(box(.6,2,length,C.glassDark,y,night?0x584c36:0).translateX(x).translateZ((start+36)/2));
   }
   // The broad bus parking apron is northeast of the building (OSM way 1173093432).
   g.add(box(116,.7,68,C.stone,.1).translateZ(130));
   const colors=[0x418c88,0xc77060,0x648caf,0x418c88];
   for(let i=0;i<4;i++){
    const coach=group(box(9,7,27,C.white,2),box(8,4,26,C.glassDark,9,night?0x584c36:0),box(9.2,1.5,28,colors[i],7));
    for(const xx of [-4.6,4.6])for(const z of [-8,8]){const wheel=cyl(2,2,1.2,C.steel,0,8);wheel.rotation.z=Math.PI/2;wheel.position.set(xx,2,z);coach.add(wheel);}
    coach.scale.setScalar(1.7);coach.position.set((i-1.5)*27,.8,130);g.add(coach);
   }
   g.rotation.y=.36+Math.PI/2;g.userData.busCount=4;return g;
  },
  childcoaster(){
   const g=group(),points=[];
   for(let i=0;i<16;i++){const a=i/16*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*(50+8*Math.sin(a*2)),24+13*(1+Math.sin(a)),Math.sin(a)*36));}
   const curve=new THREE.CatmullRomCurve3(points,true,'centripetal');
   for(const side of [-1,1]){const rail=[];for(let i=0;i<100;i++){const t=i/100,p=curve.getPoint(t),d=curve.getTangent(t);rail.push(p.add(new THREE.Vector3(-d.z,0,d.x).normalize().multiplyScalar(side*2)));}g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail,true),150,1.1,6,true),mat(0xf4d642)));}
   for(let i=0;i<16;i++){const p=curve.getPoint(i/16);g.add(cyl(1.7,2.2,p.y,0x438dc1,0,10).translateX(p.x).translateZ(p.z));}
   for(let i=0;i<40;i++){const t=i/40,p=curve.getPoint(t),d=curve.getTangent(t),tie=box(5,.8,1,0xf4d642);tie.position.copy(p);tie.rotation.y=Math.atan2(-d.x,-d.z);g.add(tie);}
   for(let i=0;i<10;i++){const t=.15+i*.016,p=curve.getPoint(t),d=curve.getTangent(t);const car=group(box(5,1,3,0x444b50),box(4,4,1,0xc74e4d,0).translateZ(1),box(4,1,3,0xc74e4d,-1),rod([0,0,0],[0,7,0],.5,C.steel));car.position.copy(p).add(new THREE.Vector3(0,-8,0));car.rotation.y=Math.atan2(-d.x,-d.z);g.add(car);}
   return g;
  },
  elephanttrain(){
   const g=group(),engine=group(box(13,6,18,0x6599ae,2),box(12,1.5,12,0xe8c75b,14).translateZ(3));
   const head=sphere(5.8,0xa0aba8,8);head.scale.set(1,.9,1);head.position.z=-12;engine.add(head);
   for(const side of [-1,1]){const ear=sphere(4,0x9ea8a4,9);ear.scale.set(.4,1,.7);ear.position.set(side*5.5,9,-11);engine.add(ear,sphere(.6,0x38464b,10).translateX(side*2.3).translateZ(-17));}
   const trunk=new THREE.CatmullRomCurve3([new THREE.Vector3(0,7,-17),new THREE.Vector3(0,3,-19),new THREE.Vector3(0,2,-23),new THREE.Vector3(0,5,-24)]);engine.add(new THREE.Mesh(new THREE.TubeGeometry(trunk,16,1.5,8,false),mat(0xa0aba8)));
   for(const x of [-5,5])engine.add(rod([x,6,7],[x,14,7],.55,C.steel));g.add(engine);
   for(let i=0;i<2;i++){const z=25+i*25,car=group(box(13,4,20,i?0xe1bb51:0x83b2a0,3),box(15,2,22,i?0xe79b65:0xe2c45a,14),box(10,2,15,C.white,7));car.position.z=z;for(const x of [-6,6])for(const dz of [-8,8])car.add(rod([x,6,dz],[x,14,dz],.5,C.steel));g.add(car,rod([0,3,z-15],[0,3,z-10],.8,C.steel));}
   for(const z of [-5,6,18,32,43,57])for(const x of [-6,6]){const wheel=cyl(2.4,2.4,1.5,0x435253,0,10);wheel.rotation.z=Math.PI/2;wheel.position.set(x,2.4,z);g.add(wheel);}
   g.rotation.y=-.55;return g;
  },
  gwacheonscience(night){
   const dome=sphere(23,C.silver,5,Math.PI*2,Math.PI/2);dome.material.flatShading=true;
   const g=group(cyl(23,24,5,C.stone),dome,box(15,6,8,C.glassDark,0,night?0x3e4533:0).translateZ(23));
   // Panel seams make the silver hemisphere legible at miniature scale.
   for(let i=0;i<8;i++){const a=i/8*Math.PI*2,pts=[];for(let j=0;j<=14;j++){const t=j/14*Math.PI/2;pts.push(new THREE.Vector3(Math.sin(t)*23.15*Math.cos(a),5+Math.cos(t)*23.15,Math.sin(t)*23.15*Math.sin(a)));}g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.15,4,false),mat(0x9eaaa9)));}
   const rocket=group(cyl(3,3,35,C.white,2,24),cyl(3,2.4,5,C.white,37,24),new THREE.Mesh(new THREE.ConeGeometry(2.4,8,24),mat(C.white)).translateY(46),cyl(3.1,3.1,1.1,C.silver,12,24),cyl(3.1,3.1,1.1,C.silver,31,24),cyl(4.2,4.2,2,C.stone,0,24));
   rocket.add(box(1,40,1,0xd35d4a,0).translateX(4.2),box(4,1,3,0x6298aa,37).translateX(4.2),box(.3,24,.4,0x58676b,10).translateX(-3));rocket.position.set(-40,0,3);g.add(rocket);return g;
  },
  snugate(){
   // Reference: low triangular opening joins the much taller right pillar.
   const g=group(box(27,.6,6,C.stone));
   const beam=(a,b,w=1.7)=>{const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));const m=box(w,v.length(),2,C.silver);m.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());g.add(m);};
   beam([-12,.6,0],[-1,14,0],2);beam([-1,14,0],[10,.6,0],2);
   beam([10,.6,0],[10,25,0],2);
   // The leftward top cap is a horizontal open frame, not another triangle stroke.
   for(const z of [-1.7,1.7])g.add(box(6,.8,.6,C.silver,24.2).translateX(8).translateZ(z));
   for(const x of [5.3,10.7])g.add(box(.6,.8,4,C.silver,24.2).translateX(x));
   for(const y of [18,21])g.add(box(2.8,1.5,2,C.silver,y).translateX(12));
   g.rotation.y=Math.PI-.15;return g;
  },
  lonetree(){
   const g=group(cyl(1.2,1.8,8,C.woodRed,0,10));
   for(const [x,y,z,r]of[[0,14,0,7],[-5,11,1,5.5],[5,12,0,5.5],[0,11,4,5]]){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat(0x54894f));crown.position.set(x,y,z);crown.scale.y=1.1;g.add(crown);}
   for(const x of [-4,4])g.add(rod([0,5,0],[x,11,0],.6,C.woodRed));return g;
  },
  nationalmuseum(night){
   const g=group(),glass=night?0x6a6a4a:0;
   for(const [x,w]of[[-113,160],[109,152]]){g.add(box(w,31,85,C.concrete).translateX(x),box(w+4,3,89,C.stone,31).translateX(x));for(let y=7;y<=23;y+=8)g.add(box(w-10,3,1,C.glassDark,y,glass).translateX(x).translateZ(43));}
   // A raised bridge leaves the central courtyard visibly open.
   g.add(box(68,10,85,C.concrete,24),box(70,2,89,C.stone,34));
   for(const x of [-30,30])g.add(box(5,24,85,C.stone).translateX(x));
   g.add(box(100,1,45,C.stone).translateZ(65));
   const pond=cyl(50,50,.5,C.glassBlue,.2,40);pond.scale.z=.6;pond.position.z=115;g.add(pond);
   const bank=new THREE.Mesh(new THREE.TorusGeometry(51,1,5,40),mat(C.stone));bank.rotation.x=Math.PI/2;bank.scale.y=.6;bank.position.set(0,.8,115);g.add(bank);return g;
  },
  independence(){
   const shape=new THREE.Shape();shape.moveTo(-7,0);shape.lineTo(-7,12);shape.lineTo(7,12);shape.lineTo(7,0);shape.lineTo(3,0);shape.lineTo(3,5);shape.absarc(0,5,3,0,Math.PI,false);shape.lineTo(-3,0);shape.closePath();
   const geo=new THREE.ExtrudeGeometry(shape,{depth:6,bevelEnabled:false});geo.translate(0,0,-3);
   const g=group(new THREE.Mesh(geo,mat(C.stone)),box(15,1,7,C.concrete,12),box(16,1,8,C.stone,13));
   for(const x of [-5,5]){g.add(box(4,1,8,C.stone).translateX(x),box(2.3,9,.7,C.concrete,1).translateX(x).translateZ(3.3));}
   for(const z of [-3.1,3.1]){g.add(box(4,.8,.3,C.white,10).translateZ(z));for(let y=2;y<=8;y+=2)for(const x of [-5,5])g.add(box(3,.12,.15,0xaaa596,y).translateX(x).translateZ(z));}g.rotation.y=.2;return g;
  },
  gimpo(night){
   // Oversized landmark symbol aligned with the existing 14L–32R runway.
   const body=new THREE.Mesh(new THREE.CapsuleGeometry(2.25,30,6,14),mat(C.white));body.rotation.x=Math.PI/2;body.position.y=4.5;
   const g=group(body);const shape=new THREE.Shape();shape.moveTo(-2,9);shape.lineTo(-17,15);shape.lineTo(-17,12);shape.lineTo(-2,-5);shape.lineTo(2,-5);shape.lineTo(17,12);shape.lineTo(17,15);shape.lineTo(2,9);shape.closePath();
   const wing=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.7,bevelEnabled:false}),mat(C.silver));wing.rotation.x=Math.PI/2;wing.position.y=4.2;g.add(wing);
   g.add(box(13,.6,4,C.white,5).translateZ(14),box(.7,5.5,5,0x6794aa,5).translateZ(13));
   for(const x of [-7,7]){const engine=cyl(1.3,1.3,4,C.silver,0,12);engine.rotation.x=Math.PI/2;engine.position.set(x,3,2);g.add(engine);}
   for(const x of [-2,2])g.add(cyl(.5,.5,2,C.steel,0,8).translateX(x).translateZ(5));
   g.add(cyl(.5,.5,2,C.steel,0,8).translateZ(-12));
   for(let z=-10;z<=11;z+=2)for(const x of [-2.15,2.15])g.add(box(.2,.65,.8,C.glassDark,4.5).translateX(x).translateZ(z));
   g.rotation.y=5*Math.PI/4;g.userData.aircraftCount=1;return g;
  },
  botanic(night,city){
   const l=byId.get('botanic'),g=group(),r=49;
   const greenhouse=group(cyl(r,r,17,C.glassBlue,0,60,night?0x244735:0));
   // Official greenhouse profile is a concave dish, not a convex dome.
   const roof=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0,18),new THREE.Vector2(14,18.5),new THREE.Vector2(32,21),new THREE.Vector2(r,25)],60),mat(0xb7d6d5,night?0x304431:0));roof.material.side=THREE.DoubleSide;greenhouse.add(roof);
   const yAt=q=>18+7*(q/r)**2;
   for(let i=0;i<24;i++){const a=i/24*Math.PI*2;greenhouse.add(rod([r*Math.cos(a),0,r*Math.sin(a)],[r*Math.cos(a),25,r*Math.sin(a)],.35,C.white));for(let j=0;j<4;j++){const a0=j*r/4,a1=(j+1)*r/4;greenhouse.add(rod([a0*Math.cos(a),yAt(a0),a0*Math.sin(a)],[a1*Math.cos(a),yAt(a1),a1*Math.sin(a)],.3,C.white));}}
   for(const rr of [16,32,49]){const ring=new THREE.Mesh(new THREE.TorusGeometry(rr,.35,5,60),mat(C.white));ring.rotation.x=Math.PI/2;ring.position.y=yAt(rr);greenhouse.add(ring);}
   place(g,greenhouse,l,l.features[0],city);
   const center=group(box(70,11,36,C.concrete),box(74,1.5,40,C.white,11));for(let x=-28;x<=28;x+=8)center.add(box(5,6,.5,C.glassBlue,3,night?0x493b26:0).translateX(x).translateZ(18));place(g,center,l,l.features[1],city);return g;
  },
  gyeongbok(night,city){const l=byId.get('gyeongbok'),g=group();place(g,palaceHall(38,28,true,false,night),l,l.features[0],city);place(g,palaceHall(40,29,false,true,night),l,l.features[1],city);return g;},
  changdeok(night,city){const l=byId.get('changdeok'),g=group();place(g,palaceHall(33,25,true,false,night),l,l.features[0],city);for(const f of l.features.slice(1))place(g,group(box(8,4,37,C.woodRed),tileRoof(12,42,3.5,C.roofTile,4)),l,f,city);return g;},
  deoksu(night,city){
   const l=byId.get('deoksu'),g=group();place(g,palaceHall(25,20,false,false,night),l,l.features[0],city);
   const stone=group(box(53,3,31,C.stone),box(48,13,27,C.concrete,3),box(56,1.5,33,C.white,16));
   for(const x of [-20,-12,-4,4,12,20])stone.add(cyl(.9,1,12,C.white,4,10).translateX(x).translateZ(16));
   const pediment=new THREE.Shape();pediment.moveTo(-16,0);pediment.lineTo(16,0);pediment.lineTo(0,5);pediment.closePath();const ped=new THREE.Mesh(new THREE.ExtrudeGeometry(pediment,{depth:2,bevelEnabled:false}),mat(C.white));ped.position.set(0,17.5,14);stone.add(ped);
   for(const x of [-16,-8,0,8,16])for(const y of [6,12])stone.add(box(3,3,.4,C.glassDark,y,night?0x59452a:0).translateX(x).translateZ(13.8));
   place(g,stone,l,l.features[1],city);return g;
  },
  peacegate(){
   const g=group();for(const x of [-17,17])g.add(box(7,18,10,C.concrete).translateX(x));
   // Wide upturned wings, clear space between the two piers, colored soffit.
   const profile=new THREE.Shape();profile.moveTo(-31,24);profile.lineTo(-15,20.5);profile.lineTo(15,20.5);profile.lineTo(31,24);profile.lineTo(29,20);profile.lineTo(14,18.2);profile.lineTo(-14,18.2);profile.lineTo(-29,20);profile.closePath();
   const geo=new THREE.ExtrudeGeometry(profile,{depth:25,bevelEnabled:false});geo.translate(0,0,-12.5);g.add(new THREE.Mesh(geo,mat(C.concrete)));
   for(const [x,c]of[[-14,0x8fb29e],[-7,0xcf9b7f],[0,0xd1b36e],[7,0x859fae],[14,0x9fa787]])g.add(box(6,.4,22,c,18).translateX(x));
   g.add(cyl(1,1,3,C.steel,0,12),sphere(1.2,C.gold,3));g.rotation.y=-.72;return g;
  },
  artscenter(night,city){
   const l=byId.get('artscenter'),g=group();
   const opera=group(cyl(43,47,15,C.brick,0,48),cyl(50,50,2,C.stone,15,48),cyl(27,34,14,C.concrete,17,48),cyl(29,29,1.5,C.roofTile,31,48));
   for(let i=0;i<36;i++){const a=i/36*Math.PI*2;opera.add(cyl(.6,.6,12,C.white,2,8).translateX(Math.cos(a)*44).translateZ(Math.sin(a)*44));}
   for(let i=0;i<24;i++){const a=i/24*Math.PI*2;opera.add(rod([34*Math.cos(a),17,34*Math.sin(a)],[27*Math.cos(a),31,27*Math.sin(a)],.5,C.stone));}
   for(const x of [-12,0,12])opera.add(box(8,8,1,C.glassBlue,2,night?0x665436:0).translateX(x).translateZ(44));
   place(g,opera,l,l.features[0],city);
   const music=group(box(72,20,70,C.brick),box(78,2,76,C.concrete,20));for(let x=-30;x<=30;x+=10)music.add(box(6,12,.6,C.glassBlue,3,night?0x665436:0).translateX(x).translateZ(35));music.rotation.y=.13;place(g,music,l,l.features[1],city);return g;
  },
 };
}
