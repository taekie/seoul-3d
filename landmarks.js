import * as THREE from 'three';
import { EXTRA_SEOUL_LANDMARKS, createSeoulBuilders } from './seoul-landmarks.js';
import { clay } from './miniature.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 랜드마크는 실측 복원이 아니라 캐리커쳐다. 특징만 남기고 크게 과장한다.
// clear: 이 반경(m) 안의 일반 건물 박스는 지운다.
// s:    [가로, 세로] 배율. 기본 [1.7, 2.6].
// cam:  [거리, 올려본각] 날아갈 때의 시점. 기본 [1900, 0.42].
// foot: 이 반경(m)의 지형 최저점에 앉힌다 — 오름·바위처럼 봉우리를 통째로 덮는 모형용.

const SEOUL = [
  { id:'namsan',   name:'N서울타워',      en:'N Seoul Tower',      lon:126.98825, lat:37.55130, clear:220, desc:'남산 위에 선 도시의 바늘' },
  { id:'lotte',    name:'롯데월드타워',    en:'Lotte World Tower',  lon:127.10250, lat:37.51250, clear:260, desc:'555m, 서울에서 가장 높은 곳' },
  { id:'63',       name:'63빌딩',         en:'63 Building',        lon:126.94010, lat:37.51970, clear:220, desc:'한강가에 세운 황금 렌즈' },
  { id:'gwangh',   name:'광화문',         en:'Gwanghwamun',        lon:126.97690, lat:37.57600, clear:390, cam:[1900,0.60], desc:'경복궁 앞, 도심의 축이 시작되는 문' },
  { id:'assembly', name:'국회의사당',      en:'National Assembly',  lon:126.91430, lat:37.53200, clear:350, cam:[2200,0.58], desc:'여의도의 청록 돔' },
  { id:'ddp',      name:'DDP',           en:'Dongdaemun DP',      lon:126.99920, lat:37.56680, clear:420, desc:'이음매 없는 은빛 곡면' },
  { id:'seoulst',  name:'서울역',         en:'Seoul Station',      lon:126.97164, lat:37.55589, yaw:90, clear:330, desc:'붉은 벽돌의 옛 역사' },
  { id:'sungnye',  name:'숭례문',         en:'Sungnyemun',         lon:126.97530, lat:37.55990, clear:320, cam:[1700,0.60], desc:'남대문, 도성의 정문' },
  { id:'jamsil',   name:'잠실주경기장',    en:'Jamsil Stadium',     lon:127.07200, lat:37.51520, clear:510, desc:'1988년 올림픽의 무대' },
  { id:'coex',     name:'무역센터',       en:'Trade Tower',        lon:127.05920, lat:37.51100, clear:420, desc:'코엑스 위로 솟은 사각 기둥' },
  { id:'worldcup', name:'서울월드컵경기장', en:'Seoul World Cup Stadium', lon:126.89740, lat:37.56830, clear:490, desc:'방패연을 펼친 지붕' },
  { id:'parkone',  name:'파크원',         en:'Parc.1',             lon:126.92680, lat:37.52530, clear:260, desc:'여의도의 붉은 기둥' },
  { id:'magic',    name:'매직아일랜드',    en:'Magic Island',       lon:127.09830, lat:37.51100, clear:210, desc:'석촌호수 위의 작은 성' },
  ...EXTRA_SEOUL_LANDMARKS,
];

// 제주는 랜드마크 절반이 지형이다. 오름·바위는 지형 위에 덧대는 것이라
// 3배 과장(EXAG)을 이미 반영한 치수로 만들고 s:[1,1]로 놓는다.
const JEJU = [
  { id:'hallasan', name:'백록담',         en:'Baengnokdam',        lon:126.53320, lat:33.36170, s:[1,1],       cam:[13000, 0.50], desc:'한라산 꼭대기에 고인 분화구' },
  { id:'seongsan', name:'성산일출봉',      en:'Seongsan Ilchulbong',lon:126.94250, lat:33.45800, s:[1,1], foot:520, clear:520, cam:[2900, 0.38], desc:'바다에서 솟은 응회구' },
  { id:'sanbang',  name:'산방산',         en:'Sanbangsan',         lon:126.31330, lat:33.23640, s:[1,1], foot:700, clear:640, cam:[3400, 0.40], desc:'종을 엎어놓은 용암돔' },
  { id:'jusang',   name:'주상절리대',      en:'Jusangjeolli Cliff', lon:126.42620, lat:33.23780, s:[1.4,1.4], clear:280, cam:[1500, 0.34], desc:'대포동 바다에 늘어선 육각 기둥' },
  { id:'cheonji',  name:'천지연폭포',      en:'Cheonjiyeon Falls',  lon:126.55430, lat:33.24640, s:[1.1,1.5], clear:190, desc:'검은 절벽에 걸린 흰 물줄기' },
  { id:'oedol',    name:'외돌개',         en:'Oedolgae',           lon:126.54050, lat:33.23890, s:[0.9,1.3], clear:130, desc:'바다에 홀로 선 현무암 기둥' },
  { id:'yongdu',   name:'용두암',         en:'Yongduam',           lon:126.51220, lat:33.51530, s:[1.1,1.5], clear:150, desc:'바다로 머리를 든 용' },
  { id:'harubang', name:'돌하르방',        en:'Dol Hareubang',      lon:126.52160, lat:33.51380, s:[1.0,1.4], clear:130, desc:'제주목 관아 앞을 지키는 돌 할아버지' },
  { id:'airport',  name:'제주국제공항',    en:'Jeju Intl Airport',  lon:126.49300, lat:33.50700, s:[1.6,2.4], clear:460, cam:[3000, 0.44], desc:'섬으로 드나드는 단 하나의 문' },
  { id:'manjang',  name:'만장굴',         en:'Manjanggul Cave',    lon:126.77140, lat:33.52850, s:[1.6,2.2], clear:220, desc:'용암이 빠져나간 자리, 7.4km 굴' },
  { id:'udo',      name:'우도등대',       en:'Udo Lighthouse',     lon:126.95780, lat:33.49880, s:[1.5,2.2], clear:140, desc:'소가 누운 섬, 그 이마의 등대' },
  { id:'seopji',   name:'섭지코지',       en:'Seopjikoji',         lon:126.92960, lat:33.42400, s:[1.2,1.4], foot:260, clear:240, desc:'바다로 내민 붉은 언덕' },
  { id:'seongeup', name:'성읍민속마을',    en:'Seongeup Village',   lon:126.79850, lat:33.38680, s:[1.7,2.6], clear:280, cam:[2000, 0.44], desc:'돌담 안에 모여 앉은 초가' },
];

const CHAPELHILL = [
  {id:'oldwell',name:'올드 웰',en:'Old Well',lon:-79.051239,lat:35.912054,clear:40,s:[1.5,2],cam:[750,.55],desc:'UNC의 상징, 흰 기둥과 둥근 지붕의 작은 우물'},
  {id:'uncbell',name:'모어헤드–패터슨 종탑',en:'Morehead-Patterson Bell Tower',lon:-79.049217,lat:35.908609,clear:45,s:[1.4,2],cam:[900,.55],desc:'캠퍼스 위로 솟은 붉은 벽돌 종탑'},
  {id:'wilson',name:'윌슨 도서관',en:'Louis Round Wilson Library',lon:-79.04971,lat:35.909439,clear:70,s:[1,1.8],cam:[1000,.6],desc:'열주와 돔이 돋보이는 캠퍼스 도서관'},
  {id:'morehead',name:'모어헤드 천문관',en:'Morehead Planetarium',lon:-79.050424,lat:35.913914,clear:70,s:[1,1.8],cam:[1000,.6],desc:'프랭클린 스트리트 곁의 별을 만나는 공간'},
  {id:'uncfarm',name:'The Farm 테니스 클럽',en:'The Farm · UNC Recreation',lon:-79.00565,lat:35.89368,lift:8,clear:140,s:[1,1.5],cam:[1000,.72],desc:'숲속에 모인 테니스 코트와 클럽하우스'},
  {id:'chapelballet',name:'채플힐 발레스쿨',en:'Ballet School of Chapel Hill',lon:-79.031741,lat:35.934168,clear:38,s:[1.2,1.8],cam:[700,.6],desc:'1603 E. Franklin Street의 댄스 스튜디오'},
  {id:'chapellibrary',name:'채플힐 공공도서관',en:'Chapel Hill Public Library',lon:-79.035752,lat:35.932099,clear:85,s:[1,1.8],cam:[950,.65],desc:'프리처드 공원 숲속의 도서관, 유리창 너머 책이 있는 곳'},
  {id:'deansmith',name:'딘 스미스 센터 · 다이빙',en:'Dean Smith Center · Koury Natatorium',aliases:['Dean Smith Center','Koury Natatorium'],lon:-79.043976,lat:35.899446,clear:160,s:[1,1.6],cam:[1300,.72],desc:'딘 돔과 옆의 쿠리 수영장 · 다이빙 풀을 펼쳐 보인 모형'},
  {id:'morrisgrove',name:'모리스그로브 초등학교',en:'Morris Grove Elementary School',lon:-79.102276,lat:35.966549,lift:8,clear:95,s:[1,1.8],cam:[1000,.65],desc:'Eubanks Road의 학교 · 낮은 교실동과 작은 운동장'},
];
export const LANDMARKS_BY_CITY = { seoul: SEOUL, jeju: JEJU, chapelhill: CHAPELHILL };
export const landmarksOf = city => LANDMARKS_BY_CITY[city] ?? [];
export const landmarkClearings = list => list.flatMap(l=>[...(l.clear?[{lon:l.lon,lat:l.lat,clear:l.clear}]:[]),...(l.features||[]).filter(f=>f.clear)]);

const C = {
  concrete: 0xeee7d8, steel: 0xd3dfda, glassDark: 0x548d99, glassBlue: 0x8bc5d5,
  gold: 0xe4be66, brick: 0xcd8e71, roofTile: 0x656d69, woodRed: 0xb57b65,
  jade: 0x7abda3, silver: 0xd2d6d6, white: 0xf2f1ea, stone: 0xc3bdae,
  green: 0x78b889, magenta: 0xdb8fab,
  basalt: 0x4c4e50, basaltLite: 0x74767a, tuff: 0x8e8478, thatch: 0xc9b083,
  lawn: 0xa1ce82, scoria: 0x8a6350,
};

const mat = (color, emissive = 0) => clay({ color, emissive, emissiveIntensity: 0.9 });

const box = (w, h, d, color, y = 0, em = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, em));
  m.position.y = y + h / 2;
  return m;
};
const cyl = (rt, rb, h, color, y = 0, seg = 24, em = 0, open = false) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat(color, em));
  m.position.y = y + h / 2;
  return m;
};
const sphere = (r, color, y = 0, phi = Math.PI * 2, thetaLen = Math.PI, em = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18, 0, phi, 0, thetaLen), mat(color, em));
  m.position.y = y;
  return m;
};
// Curved eaves, a long ridge and a thin lip give the gate roofs a toy-tile silhouette.
const hipRoof = (w, d, h, color, y = 0) => {
  const vertices = [], indices = [];
  const levels = [[1, .08], [.87, 0], [.65, .36], [.38, .78], [.08, 1]];
  levels.forEach(([r, t]) => {
    const x = w * (.25 + .25*r), z = d*.5*r;
    vertices.push(-x,y+h*t,-z, x,y+h*t,-z, x,y+h*t,z, -x,y+h*t,z);
  });
  for(let k=0;k<levels.length-1;k++) for(let j=0;j<4;j++) {
    const a=k*4+j,b=k*4+(j+1)%4,c=b+4,e=a+4;
    indices.push(a,c,b,a,e,c);
  }
  indices.push(16,18,17,16,19,18);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geo.setIndex(indices); geo.computeVertexNormals();
  const roof = new THREE.Mesh(geo,mat(color)); roof.material.side=THREE.DoubleSide;
  return group(roof,box(w*.57,4,5,C.steel,y+h-1));
};

const ring = (radius, tube, color, y, sx=1, sz=1) => {
  const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,6,48),mat(color));
  m.rotation.x=Math.PI/2; m.position.y=y; m.scale.set(sx,sz,1); return m;
};
const rod = (a,b,r,color) => {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),mat(color));
  m.position.copy(start.add(end).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return m;
};
const facade = (g,w,d,y,h,rows,cols,night) => {
  const glass=night?0xeac884:C.glassDark;
  for(let side of [-1,1]) for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
    const win=box(w/(cols+1)*.48,h/(rows+1)*.45,2,glass,y+(row+.55)*h/(rows+1),night?0x594019:0);
    win.position.x=(col-(cols-1)/2)*w/(cols+1);win.position.z=side*(d/2+1);g.add(win);
  }
};
// A real opening through the stone base, rather than a black rectangle on it.
const gateBase = (w,h,d,centres) => {
  const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h);shape.lineTo(-w/2,h);shape.closePath();
  centres.forEach(x=>{
    const r=centres.length===1?21:16, spring=h*.38;
    const hole=new THREE.Path();hole.moveTo(x-r,.1);hole.lineTo(x-r,spring);
    hole.absarc(x,spring,r,Math.PI,0,true);hole.lineTo(x+r,.1);hole.closePath();shape.holes.push(hole);
  });
  const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,curveSegments:12});geo.translate(0,0,-d/2);
  return new THREE.Mesh(geo,mat(C.stone));
};
const gateDetails = (g,w,d,y,h,columns) => {
  for(let side of [-1,1]) {
    for(let i=0;i<columns;i++) g.add(box(5,h,5,C.woodRed,y).translateX((i-(columns-1)/2)*w/(columns-1)).translateZ(side*d/2));
    g.add(box(w+10,5,6,C.jade,y+h-8).translateZ(side*(d/2+1)));
    g.add(box(w+8,4,7,C.gold,y+h-3).translateZ(side*(d/2+2)));
  }
};

function group(...children) {
  const g = new THREE.Group();
  const objects = children.filter(Boolean);
  if (objects.length) g.add(...objects);
  return g;
}

const BUILDERS = {
  ...createSeoulBuilders({box,cyl,sphere,hipRoof,rod,group,mat,C}),
  morrisgrove(night) {
    const g=group(box(130,2,110,0xc6ccb2));
    const wing=(w,d)=>group(box(w,11,d,0xd3a185,2),box(w+3,1.5,d+3,C.concrete,13));
    g.add(wing(94,27));
    for(const x of [-36,36]){const side=wing(22,48);side.position.set(x,0,25);g.add(side);}
    const hall=wing(38,33);hall.position.z=-24;g.add(hall);
    for(let x=-42;x<=42;x+=7)for(const z of [-13.8,13.8])g.add(box(3.6,5,.5,C.glassBlue,6,night?0x6d633d:0).translateX(x).translateZ(z));
    for(const x of [-47.5,47.5])for(let z=10;z<=43;z+=8)g.add(box(.5,5,4,C.glassBlue,6,night?0x6d633d:0).translateX(x).translateZ(z));
    g.add(box(15,9,1,C.glassDark,2).translateZ(-41),box(24,1.5,12,0x82b9cb,12).translateZ(-45));
    for(const x of [-10,10])g.add(cyl(.6,.6,10,C.white,2,8).translateX(x).translateZ(-49));
    g.add(box(35,.3,25,0x8fbd83,2).translateZ(35));
    for(const [x,color] of [[-10,0xe5bc70],[0,0x83b7cf],[10,0xcd9a8e]])g.add(box(5,3,5,color,2.4).translateX(x).translateZ(36));
    return g;
  },
  uncfarm(night) {
    const g=group(box(230,2,145,0xa1bf8c));
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const court=new THREE.Group(),x=-48+col*39,z=-46+row*43;
      court.add(box(35,1,39,0x719f83,2),box(24,.3,32,0x739eae,3));
      for(const dz of [-16,16,-9,9])court.add(box(24,.2,.4,C.white,3.4).translateZ(dz));
      for(const dx of [-12,12,-9,9])court.add(box(.4,.2,32,C.white,3.4).translateX(dx));
      court.add(box(.35,.2,18,C.white,3.4),box(26,1.8,.3,C.roofTile,3.4));
      for(const dx of [-13,13])court.add(cyl(.35,.35,2.5,C.white,3,6).translateX(dx));
      court.position.set(x,0,z);g.add(court);
    }
    const clubhouse=group(box(34,12,55,C.concrete,2),box(40,3,60,C.roofTile,14));clubhouse.position.x=-94;
    for(let z=-18;z<=18;z+=9)clubhouse.add(box(.4,5,5,C.glassBlue,6,night?0x725d36:0).translateX(17.3).translateZ(z));
    g.add(clubhouse);return g;
  },
  chapelballet(night) {
    const g=group(box(44,2,32,C.stone),box(40,15,28,0xd1a088,2),box(45,2,33,C.roofTile,17));
    for(const x of [-14,-7,0,7,14]){
      g.add(box(5,8,.5,C.glassBlue,7,night?0x796342:0).translateX(x).translateZ(14.3));
      g.add(box(5,.35,.6,C.woodRed,10).translateX(x).translateZ(14.7));
    }
    g.add(box(8,9,.6,C.glassDark,2).translateZ(14.4),box(14,1,5,C.concrete,12).translateZ(16));
    // A small blush sign distinguishes the studio without inventing a logo.
    g.add(box(17,3,.5,0xe2b0b1,14).translateZ(14.4));return g;
  },
  chapellibrary(night) {
    const g=group(box(110,3,75,C.stone),box(82,14,56,C.brick,3),box(88,3,62,C.roofTile,17));
    const reading=group(box(105,15,21,C.glassBlue,3,night?0x635739:0),box(114,2,28,C.concrete,18));reading.position.z=32;
    for(let x=-50;x<=50;x+=7)reading.add(box(1,15,1,C.woodRed,3).translateX(x).translateZ(10.7));
    g.add(reading);
    const entrance=group(box(40,13,18,C.glassBlue,3),box(49,2,25,C.concrete,16));entrance.position.z=-33;g.add(entrance);
    for(let x=-36;x<=36;x+=12)g.add(box(7,1,13,0xaac7cd,20).translateX(x));
    for(const x of [-42,42])g.add(box(10,2,4,C.woodRed,3).translateX(x).translateZ(-49));return g;
  },
  deansmith(night) {
    const arena=group(cyl(68,71,4,C.stone,0,32),cyl(65,68,23,C.brick,4,32),cyl(69,69,3,C.concrete,27,32));
    const roof=sphere(69,0xd3e0df,30,Math.PI*2,Math.PI/2);roof.scale.y=.2;arena.add(roof);
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,entry=box(9,12,3,C.glassBlue,10,night?0x56676d:0);
      entry.position.x=Math.sin(a)*66;entry.position.z=Math.cos(a)*66;entry.rotation.y=a;arena.add(entry);
    }
    const pool=group(box(65,3,85,C.stone),box(60,2,80,C.concrete,3),box(24,.5,51,0x61b9ce,5));
    for(let x=-10;x<=10;x+=3)pool.add(box(.3,.15,48,0xeaf5e6,5.6).translateX(x));
    pool.add(box(23,.5,18,0x65b8cc,5).translateZ(-32));
    for(const x of [-8,2]){
      pool.add(box(2,7,2,C.concrete,5).translateX(x).translateZ(-44));
      pool.add(box(3,.6,9,C.white,12).translateX(x).translateZ(-41));
    }
    for(const x of [-29,29])pool.add(box(2,15,80,C.brick,3).translateX(x));
    pool.add(box(60,15,2,C.brick,3).translateZ(39));
    for(let i=0;i<3;i++)pool.add(box(7,2+i*2,57,0x8fc4df,5).translateX(17+i*3));
    // Open roof is an intentional miniature cutaway showing swimming/diving.
    pool.position.set(105,0,-13);
    return group(arena,pool);
  },
  oldwell() {
    const g=group(cyl(15,17,2,C.stone),cyl(13,15,2,C.white,2));
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,col=cyl(1,1.3,15,C.white,4,12);col.position.x=Math.cos(a)*10;col.position.z=Math.sin(a)*10;g.add(col);
    }
    g.add(cyl(14,14,2,C.white,19));
    const roof=sphere(14,0x7897a5,21,Math.PI*2,Math.PI/2);roof.scale.y=.45;g.add(roof,cyl(2,3,5,C.stone,4));
    return g;
  },
  uncbell(night) {
    const g=group(box(17,4,17,C.stone),box(12,35,12,C.brick,4),box(16,2,16,C.concrete,39),box(12,10,12,C.brick,41));
    for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const detail=new THREE.Group();
      const slit=box(4,7,.5,C.glassDark,42,night?0xd5b16c:0);slit.position.z=6.2;detail.add(slit);
      const face=cyl(2.2,2.2,.5,C.white,0,24);face.rotation.x=Math.PI/2;face.position.set(0,35,6.3);detail.add(face);
      const hand=box(.35,1.6,.3,C.roofTile,34.8);hand.position.z=6.7;detail.add(hand);detail.rotation.y=angle;g.add(detail);
    }
    g.add(cyl(0,11,12,C.roofTile,51,4));return g;
  },
  wilson() {
    const g=group(box(80,4,48,C.stone),box(74,21,42,C.concrete,4),box(80,3,48,C.white,25));
    for(let x=-25;x<=25;x+=10){const col=cyl(1.4,1.7,19,C.white,5,12);col.position.set(x,14.5,27);g.add(col);}
    const portico=box(60,3,12,C.white,24);portico.position.z=25;g.add(portico);
    g.add(cyl(13,13,7,C.concrete,28));const dome=sphere(15,0x8aa59e,35,Math.PI*2,Math.PI/2);dome.scale.y=.65;g.add(dome);
    for(let x=-30;x<=30;x+=10){const win=box(3,9,.6,C.glassDark,10);win.position.set(x,14.5,21.3);g.add(win);}
    return g;
  },
  morehead() {
    const g=group(box(82,3,42,C.stone),box(78,17,38,C.brick,3),box(82,3,42,C.white,20),cyl(18,18,7,C.concrete,23));
    const dome=sphere(19,0xa9b8b5,30,Math.PI*2,Math.PI/2);dome.scale.y=.65;g.add(dome);
    for(let x=-15;x<=15;x+=6){const col=cyl(1.1,1.4,15,C.white,4,12);col.position.x=x;col.position.z=23;g.add(col);}
    const roof=box(40,3,12,C.white,19);roof.position.z=22;g.add(roof);return g;
  },
  namsan(night) {
    const g=group(cyl(78,96,16,C.stone),cyl(58,78,16,C.white,16),
      cyl(12,23,238,C.white,30),cyl(34,16,14,C.concrete,256),
      cyl(47,39,10,C.white,270),cyl(44,44,25,C.glassDark,280,40,night?0x38516b:0),
      cyl(39,47,12,C.white,305),cyl(28,36,18,C.white,317),
      cyl(5,9,128,C.white,335),cyl(2,5,72,C.steel,463),
      sphere(5,0xef8b72,538,Math.PI*2,Math.PI,night?0x882018:0));
    [279,305,320].forEach(y=>g.add(ring(y===320?33:45,2.5,C.white,y)));
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2;g.add(cyl(1.2,1.2,25,C.white,280,5).translateX(Math.cos(a)*44.5).translateZ(Math.sin(a)*44.5));}
    [367,394,421,448].forEach(y=>g.add(ring(7,1.7,C.brick,y)));
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;g.add(cyl(1,1,8,C.steel,32,5).translateX(Math.cos(a)*58).translateZ(Math.sin(a)*58));}
    g.add(ring(59,1.5,C.steel,40)); return g;
  },

  lotte(night) {
    const vertices=[],indices=[],sides=32,levels=32;
    const point=(j,k)=>{
      const t=k/levels,a=j/sides*Math.PI*2;
      const r=70*(1-.72*Math.pow(t,1.42));
      const x=Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.55)*r;
      const z=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.55)*r*.82;
      return [x,30+t*850,z];
    };
    for(let k=0;k<=levels;k++)for(let j=0;j<sides;j++)vertices.push(...point(j,k));
    for(let k=0;k<levels;k++)for(let j=0;j<sides;j++){const a=k*sides+j,b=k*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
    const shell=new THREE.Mesh(geo,mat(C.glassBlue,night?0x1b3949:0));shell.material.side=THREE.DoubleSide;
    const g=group(box(160,15,135,C.stone),box(140,18,115,C.white,15),shell);
    for(let j=0;j<sides;j+=2)for(let k=0;k<levels;k++)g.add(rod(point(j,k),point(j,k+1),.85,C.white));
    for(let k=3;k<levels;k+=3)for(let j=0;j<sides;j++)g.add(rod(point(j,k),point((j+1)%sides,k),.65,C.steel));
    for(let side of [-1,1]) {
      const shape=new THREE.Shape();shape.moveTo(side*3,875);shape.lineTo(side*20,875);shape.lineTo(side*13,965);shape.lineTo(side*5,998);shape.closePath();
      const crown=new THREE.ExtrudeGeometry(shape,{depth:27,bevelEnabled:false});crown.translate(0,0,-13.5);g.add(new THREE.Mesh(crown,mat(C.white)));
    }
    return g;
  },

  '63'(night) {
    const shape=new THREE.Shape();shape.moveTo(-70,0);shape.quadraticCurveTo(0,34,70,0);shape.quadraticCurveTo(0,-34,-70,0);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:430,bevelEnabled:true,bevelSize:2,bevelThickness:2,bevelSegments:2,curveSegments:18});geo.rotateX(-Math.PI/2);
    const g=group(box(190,13,110,C.stone),box(170,14,90,C.white,13),new THREE.Mesh(geo,mat(C.gold,night?0x6a4c12:0)));
    const outline=shape.getPoints(36).map(p=>{const n=new THREE.Vector2(p.x/(70*70),p.y/(17*17)).normalize();return p.clone().addScaledVector(n,2.6);});
    for(let y=38;y<425;y+=16)for(let i=0;i<outline.length-1;i++)g.add(rod([outline[i].x,y,-outline[i].y],[outline[i+1].x,y,-outline[i+1].y],1,0xb28b3f));
    for(let x=-56;x<=56;x+=14){const z=17*(1-(x/70)**2);for(let side of [-1,1])g.add(box(1.1,409,1.1,0xffdf96,18).translateX(x).translateZ(side*(z+2.6)));}
    g.add(box(68,9,17,C.gold,430));return g;
  },

  gwangh() {
    const g=group(gateBase(230,46,86,[-66,0,66]),box(190,34,60,C.glassDark,46),
      hipRoof(250,108,40,C.roofTile,80),box(150,30,50,C.glassDark,118),hipRoof(210,92,40,C.roofTile,148));
    gateDetails(g,184,66,46,34,9);gateDetails(g,146,56,118,30,7);
    for(let side of [-1,1]){g.add(box(92,24,38,C.stone).translateX(side*157));g.add(box(95,5,42,C.roofTile,24).translateX(side*157));}
    g.add(box(33,12,3,C.roofTile,64).translateZ(35));return g;
  },

  assembly(night) {
    const g=group(box(300,10,220,C.stone),box(285,10,208,C.white,10),box(250,96,174,C.concrete,24),
      box(274,10,194,C.white,114),cyl(64,73,16,C.white,122),sphere(66,C.jade,138,Math.PI*2,Math.PI/2,night?0x123c34:0));
    for(let side of [-1,1])for(let i=0;i<12;i++)g.add(box(9,78,9,C.white,36).translateX((i-5.5)*22).translateZ(side*95));
    for(let side of [-1,1])for(let i=0;i<7;i++)g.add(box(9,78,9,C.white,36).translateX(side*132).translateZ((i-3)*25));
    for(let i=0;i<16;i++){const a=i*Math.PI/8;for(let j=0;j<10;j++){const p=j*Math.PI/20,q=(j+1)*Math.PI/20;g.add(rod([66*Math.sin(p)*Math.cos(a),138+66*Math.cos(p),66*Math.sin(p)*Math.sin(a)],[66*Math.sin(q)*Math.cos(a),138+66*Math.cos(q),66*Math.sin(q)*Math.sin(a)],1.1,0x5a9c87));}}
    for(let i=0;i<5;i++)g.add(box(115+i*10,3,15,C.white,15-i*3).translateZ(112+i*9));return g;
  },

  ddp(night) {
    const g=group(box(430,9,265,C.stone));
    for(const [x,z,r,sx,sy,sz] of [[-35,-8,146,1.35,.44,.83],[145,45,94,1.15,.4,.74],[-130,76,73,1.25,.35,.8]]) {
      const shell=sphere(r,C.silver,20,Math.PI*2,Math.PI/2,night?0x243842:0);shell.scale.set(sx,sy,sz);shell.position.x=x;shell.position.z=z;g.add(shell);
      const skirt=cyl(r,r,10,C.glassDark,10,48,night?0x253b47:0);skirt.scale.set(sx,1,sz);skirt.position.x=x;skirt.position.z=z;g.add(skirt);
      for(let i=1;i<6;i++){const a=i*Math.PI/12;const band=ring(r*Math.sin(a),.65,C.steel,20+r*Math.cos(a)*sy,sx,sz);band.position.x=x;band.position.z=z;g.add(band);}
    }
    return g;
  },

  seoulst(night) {
    const g=group(box(245,8,130,C.stone),box(230,60,110,C.brick,8),box(88,32,86,C.brick,68),
      sphere(43,C.jade,106,Math.PI*2,Math.PI/2,night?0x123c34:0),cyl(43,48,8,C.white,98),cyl(5,9,16,C.jade,147),
      box(68,48,96,C.brick,8).translateX(-139),box(68,48,96,C.brick,8).translateX(139));
    for(let side of [-1,1]){g.add(box(74,8,104,C.roofTile,56).translateX(side*139));g.add(box(78,6,114,C.white,66).translateX(side*77));}
    facade(g,220,110,12,50,2,11,night);
    for(let side of [-1,1]){
      const clock=cyl(10,10,2,C.white,0,24);clock.rotation.x=Math.PI/2;clock.position.set(0,84,side*45);g.add(clock);
      g.add(box(1.5,7,2,C.roofTile,80).translateZ(side*47));g.add(box(6,1.5,2,C.roofTile,83).translateX(2).translateZ(side*47));
      g.add(box(24,27,3,C.glassDark,8).translateZ(side*57));
    }return g;
  },

  sungnye() {
    const g=group(gateBase(170,56,90,[0]),box(140,30,60,C.glassDark,56),hipRoof(190,100,34,C.roofTile,86),
      box(112,26,48,C.glassDark,120),hipRoof(160,86,32,C.roofTile,146));
    gateDetails(g,136,66,56,30,7);gateDetails(g,108,54,120,26,5);
    for(let side of [-1,1])g.add(box(82,25,45,C.stone).translateX(side*119));return g;
  },

  jamsil(night) {
    const g=group(cyl(230,190,70,C.concrete,0,48,0,true));
    g.children[0].material.side=THREE.DoubleSide;
    for(let i=0;i<5;i++)g.add(ring(181+i*10,5,i%2?C.white:C.glassBlue,18+i*11,1.2,.85));
    g.add(ring(232,13,C.white,78,1.2,.85));
    const track=cyl(177,177,5,C.brick,8,48);track.scale.set(1.2,1,.85);g.add(track);
    const field=box(198,3,104,C.green,13);g.add(field);
    for(let z of [-49,49])g.add(box(188,.8,1.4,C.white,16).translateZ(z));
    for(let x of [-94,0,94])g.add(box(1.4,.8,99,C.white,16).translateX(x));
    g.add(ring(18,.8,C.white,17));g.children[0].scale.set(1.2,1,.85);return g;
  },

  coex(night) {
    const g=group(box(280,22,220,C.white),box(120,16,112,C.stone,22));
    for(let i=0;i<5;i++){const h=350+i*18;g.add(box(19,h,96,C.glassBlue,38,night?0x24404c:0).translateX((i-2)*19));}
    for(let y=65;y<380;y+=20)g.add(box(98,2,99,C.white,y));
    for(let x=-38;x<=38;x+=19)for(let side of [-1,1])g.add(box(2,340,2,C.steel,38).translateX(x).translateZ(side*49));
    g.add(box(150,70,110,C.concrete,22).translateX(-150));return g;
  },

  worldcup(night) {
    const g=group(box(440,10,350,C.stone),box(210,4,135,C.green,12));
    for(let side of [-1,1]) {
      g.add(box(350,55,38,C.concrete,10).translateZ(side*144));
      g.add(box(40,55,270,C.concrete,10).translateX(side*200));
      for(let i=0;i<7;i++) {
        const sail=new THREE.Mesh(new THREE.ConeGeometry(47,30,4),mat(C.white,night?0x27363b:0));
        sail.scale.set(1.15,1,.7);sail.rotation.y=Math.PI/4;sail.position.set((i-3)*55,90,side*139);g.add(sail);
      }
      for(let i=0;i<4;i++) {
        const x=(i-1.5)*109,z=side*178;g.add(cyl(2,3,115,C.steel,10,8).translateX(x).translateZ(z));
        g.add(rod([x,125,z],[x-38,84,side*117],1,C.white),rod([x,125,z],[x+38,84,side*117],1,C.white));
      }
    }
    for(let z of [-64,64])g.add(box(202,1,1.5,C.white,17).translateZ(z));
    for(let x of [-101,0,101])g.add(box(1.5,1,130,C.white,17).translateX(x));g.add(ring(20,1,C.white,17));return g;
  },

  parkone(night) {
    const g=group(box(260,20,155,C.white));
    for(const [x,h,w] of [[-58,330,98],[88,265,74]]) {
      g.add(box(w,h,72,C.glassBlue,20,night?0x24404c:0).translateX(x));
      for(let side of [-1,1])for(let back of [-1,1])g.add(box(8,h+10,8,0xd56c55,20).translateX(x+side*(w/2+2)).translateZ(back*39));
      [95,190,h+20].filter(y=>y<=h+20).forEach(y=>g.add(box(w+14,7,88,0xd56c55,y).translateX(x)));
      for(let y=44;y<h+15;y+=17)g.add(box(w+1,1.3,74,C.white,y).translateX(x));
    }return g;
  },

  magic(night) {
    const g=group(cyl(95,106,18,C.stone,0,20),box(98,72,66,C.white,18));
    for(const [x,z,r,h] of [[0,-12,26,142],[-53,31,15,84],[53,31,15,84],[-38,-41,14,100],[38,-41,14,100]]) {
      g.add(cyl(r,r*1.08,h,C.white,18,16).translateX(x).translateZ(z));
      const roof=new THREE.Mesh(new THREE.ConeGeometry(r*1.5,h*.5,16),mat(C.magenta,night?0x40182c:0));roof.position.set(x,18+h+h*.25,z);g.add(roof);
      const trim=ring(r*1.45,2,C.white,18+h);trim.position.x=x;trim.position.z=z;g.add(trim);
      g.add(box(2,18,2,C.gold,18+h*1.5).translateX(x).translateZ(z));
      g.add(box(13,7,1,C.magenta,28+h*1.5).translateX(x+6).translateZ(z));
    }
    facade(g,85,66,23,55,2,5,night);return g;
  },

  // ── 제주 ──────────────────────────────────────────────────────────────

  // 백록담 — 정상을 두른 분화구 테와 그 안의 물
  hallasan() {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(320, 105, 8, 28), mat(0x9d9683));
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1, 1, 0.5);
    rim.position.y = 46;
    const g = group(
      cyl(360, 470, 70, 0x86886f, -50, 30),
      rim,
      cyl(205, 205, 10, 0x5f909b, 4, 26),
    );
    g.userData.top = 150;
    return g;
  },

  // 성산일출봉 — 바다에서 솟은 응회구. 테두리에 바위 이빨이 둘린다.
  seongsan() {
    const cone = cyl(265, 500, 500, C.tuff, 0, 26, 0, true);
    cone.material.side = THREE.DoubleSide;
    const teeth = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, h = 70 + (i % 3) * 60;
      const t = new THREE.Mesh(new THREE.ConeGeometry(52, h, 5), mat(i % 2 ? C.tuff : 0x9f9488));
      t.position.set(Math.cos(a) * 258, 496 + h / 2, Math.sin(a) * 258);
      t.rotation.y = a;
      teeth.add(t);
    }
    const g = group(cyl(500, 560, 44, 0x7c756b, -34, 26), cone, teeth,
                    cyl(240, 240, 12, C.lawn, 372, 26));
    g.userData.top = 680;
    return g;
  },

  // 산방산 — 깎아지른 바위벽에 숲을 인 용암돔
  sanbang() {
    const rock = cyl(468, 600, 700, 0x857e72, 0, 15);   // 바위벽
    rock.material.flatShading = true;                  // 면을 갈라 주상절리 벽처럼
    const cap = sphere(470, 0x6d7a5c, 690, Math.PI * 2, Math.PI / 2);
    cap.scale.set(1, 0.5, 1);
    const g = group(
      cyl(615, 720, 95, 0x87976d, -70, 34),      // 산자락
      rock,
      cap,
    );
    g.userData.top = 935;
    return g;
  },

  // 주상절리대 — 육각 기둥이 벼랑을 이룬다
  jusang() {
    const cols = new THREE.Group();
    for (let i = 0; i < 44; i++) {
      const r = 9 + (i % 3) * 2.5, h = 42 + ((i * 5) % 6) * 13;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat(i % 3 ? C.basalt : C.basaltLite));
      c.position.set((i % 11) * 25 - 138, h / 2, Math.floor(i / 11) * 23 - 34);
      c.rotation.y = (i % 6) * 0.3;
      cols.add(c);
    }
    const g = group(box(330, 22, 122, C.basaltLite, -18), cols);
    g.userData.top = 112;
    return g;
  },

  // 천지연폭포 — 검은 절벽에 걸린 흰 물줄기
  cheonji(night) {
    // 남쪽으로 얼굴을 연 반원 벼랑. 그 얼굴을 타고 물이 떨어져 못에 고인다.
    const arc = (rt, rb, h, color, y) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(rt, rb, h, 20, 1, false, Math.PI / 2, Math.PI), mat(color));
      m.position.y = y + h / 2;
      return m;
    };
    const g = group(
      arc(116, 130, 70, C.basalt, 0),
      box(248, 70, 12, C.basalt, 0),                                   // 벼랑의 얼굴
      box(46, 66, 14, C.white, 2, night ? 0x2a3a44 : 0).translateZ(9), // 떨어지는 물
      cyl(26, 20, 9, 0xeef6f7, 0, 18).translateZ(24),
      cyl(72, 72, 12, night ? 0x143c4c : 0x3fa6c4, -8, 26).translateZ(76),
      arc(108, 116, 18, C.green, 70),                                  // 벼랑 위 숲
      box(232, 18, 12, C.green, 70),
    );
    g.userData.top = 96;
    return g;
  },

  // 외돌개 — 바다에 홀로 선 현무암 기둥
  oedol() {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(26, 46, 190, 7), mat(C.basalt));
    stack.position.y = 95;
    const g = group(
      cyl(80, 108, 28, C.basaltLite, -18, 9),
      stack,
      new THREE.Mesh(new THREE.ConeGeometry(31, 36, 7), mat(C.green)).translateY(202),
    );
    g.userData.top = 235;
    return g;
  },

  // 용두암 — 바다로 머리를 든 현무암 용
  yongdu() {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(32, 60, 100, 7), mat(C.basalt));
    neck.position.set(0, 48, 26);
    neck.rotation.x = 0.44;                          // 목은 뒤로 젖혔다가
    const head = new THREE.Mesh(new THREE.CylinderGeometry(15, 42, 100, 6), mat(C.basalt));
    head.position.set(0, 104, -34);
    head.rotation.x = -Math.PI / 2 + 0.16;           // 주둥이는 바다(북)를 문다
    const brow = new THREE.Mesh(new THREE.ConeGeometry(20, 34, 5), mat(C.basalt));
    brow.position.set(0, 128, 4);
    const jaw = new THREE.Mesh(new THREE.CylinderGeometry(10, 26, 62, 6), mat(C.basaltLite));
    jaw.position.set(0, 82, -40);
    jaw.rotation.x = -Math.PI / 2 + 0.34;
    const g = group(cyl(76, 110, 28, C.basaltLite, -20, 9), neck, head, brow, jaw);
    g.rotation.y = -0.85;                            // 뭍에서도 옆모습이 보이게 북서로 튼다
    g.userData.top = 150;
    return g;
  },

  // 돌하르방 — 벙거지, 부릅뜬 눈, 배 위에 얹은 두 손
  harubang() {
    const eye = x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 10), mat(0x55524c));
      e.position.set(x, 104, 30); return e;
    };
    const hand = x => {
      const h = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 10), mat(0x8e897f));
      h.scale.set(1, 0.65, 0.8); h.position.set(x, 46, 30); return h;
    };
    const nose = new THREE.Mesh(new THREE.ConeGeometry(12, 38, 8), mat(0xa39d92));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 90, 30);
    const g = group(
      cyl(54, 66, 16, C.basaltLite, -12, 16),
      cyl(30, 42, 70, 0x928d83, 0, 14),
      cyl(35, 30, 54, 0x9c978c, 70, 14),
      cyl(42, 35, 20, 0x87827a, 118, 14),
      nose, eye(-16), eye(16), hand(-15), hand(15),
    );
    g.userData.top = 148;
    return g;
  },

  // 제주국제공항 — 활주로, 관제탑, 막 세운 여객기
  airport(night) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(11, 76, 6, 12), mat(C.white));
    body.rotation.z = Math.PI / 2;
    body.position.y = 24;
    const jet = group(body, box(26, 5, 88, C.white, 21), box(22, 26, 5, 0xcfd6d2, 26).translateX(-42));
    jet.position.set(-160, 0, 64);
    const tower = group(
      cyl(19, 27, 112, 0xdad8cc, 0),
      cyl(34, 28, 30, night ? 0x9fc6d6 : C.glassBlue, 124, 16, night ? 0x2a4a58 : 0),
      cyl(3, 3, 34, C.steel, 142, 8),
    );
    tower.position.set(162, 0, 150);
    const term = box(310, 50, 100, 0xe3e2d8, 0, night ? 0x2a2f33 : 0);
    term.position.set(-24, 25, 156);
    const g = group(box(640, 10, 84, 0x83877f, -4), term, tower, jet);
    g.userData.top = 200;
    return g;
  },

  // 만장굴 — 잔디 언덕에 뚫린 용암동굴 입구와 용암석주
  manjang() {
    const mound = sphere(175, 0x86a566, 0, Math.PI * 2, Math.PI / 2);
    mound.scale.set(1.25, 0.46, 1);
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(58, 44, 72, 18, 1, true), mat(0x11181a));
    pit.material.side = THREE.DoubleSide;         // 입구는 천장이 무너져 내린 구덩이다
    pit.position.set(12, 46, 26);
    const floor = cyl(44, 44, 6, 0x0d1112, 8, 18);
    floor.position.set(12, 14, 26);
    const g = group(cyl(215, 240, 16, 0x9aa87f, -14, 26), mound, pit, floor,
                    cyl(19, 34, 88, C.basalt, 0, 8).translateX(152).translateZ(28));
    g.userData.top = 112;
    return g;
  },

  // 우도등대 — 우도봉 이마에 선 흰 탑
  udo(night) {
    const g = group(
      cyl(74, 98, 28, C.lawn, 0, 20),
      cyl(16, 22, 66, C.white, 28),
      cyl(20, 20, 14, night ? 0xffd98a : 0xd8574a, 94, 16, night ? 0x9a5510 : 0),
      new THREE.Mesh(new THREE.ConeGeometry(23, 22, 12), mat(C.basalt)).translateY(119),
    );
    g.userData.top = 132;
    return g;
  },

  // 섭지코지 — 바다로 내민 붉은 언덕과 흰 등대
  seopji(night) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(150, 96, 22), mat(0x8f9a63));
    hill.position.y = 48;
    const scoria = new THREE.Mesh(new THREE.ConeGeometry(74, 46, 20), mat(C.scoria));
    scoria.position.y = 96;                          // 정상만 붉은 송이(scoria)
    const g = group(
      cyl(128, 158, 24, C.lawn, -12, 22),
      hill, scoria,
      cyl(13, 18, 70, C.white, 128),
      cyl(17, 17, 12, night ? 0xffd98a : 0xd8574a, 198, 14, night ? 0x9a5510 : 0),
    );
    g.userData.top = 216;
    return g;
  },

  // 성읍민속마을 — 돌담 안에 모여 앉은 초가
  seongeup() {
    const houses = new THREE.Group();
    for (const [x, z, k] of [[0,0,1],[-88,-54,0.8],[82,-46,0.85],[-62,70,0.8],[74,76,0.9],[6,-112,0.75]]) {
      const roof = sphere(46 * k, C.thatch, 20 * k, Math.PI * 2, Math.PI / 2);
      roof.scale.set(1.06, 0.46, 0.84);
      const h = group(box(66 * k, 22 * k, 48 * k, 0xd9d2c2, 0), roof);
      h.position.set(x, 0, z);
      h.rotation.y = (x + z) * 0.004;
      houses.add(h);
    }
    const wall = new THREE.Mesh(new THREE.TorusGeometry(168, 7, 6, 26), mat(0x5f6260));
    wall.rotation.x = Math.PI / 2;
    wall.position.y = 10;
    const g = group(cyl(186, 202, 14, 0xcfc9b4, -10, 24), wall, houses);
    g.userData.top = 66;
    return g;
  },
};

export function buildLandmark(lm, themeName, city) {
  const b = BUILDERS[lm.id];
  if (!b) return null;
  const obj = b(themeName === 'night', city);
  // yaw turns local +Z (south) toward east; Seoul's old station faces its eastern plaza.
  obj.rotation.y+=(lm.yaw??0)*Math.PI/180;
  obj.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(obj);
  const batches=new Map();
  obj.traverse(mesh=>{
    if(!mesh.isMesh) return;
    const m=mesh.material;
    const key=[m.color.getHex(),m.emissive.getHex(),m.emissiveIntensity,m.side,m.flatShading].join(':');
    if(!batches.has(key))batches.set(key,{material:m.clone(),geometries:[]});
    const baked=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const geo=baked.index?baked.toNonIndexed():baked;
    if(geo!==baked)baked.dispose();
    geo.deleteAttribute('uv');
    batches.get(key).geometries.push(geo);
  });
  const packed=new THREE.Group();
  for(const {material,geometries} of batches.values()) {
    packed.add(new THREE.Mesh(mergeGeometries(geometries,false),material));
    geometries.forEach(g=>g.dispose());
  }
  obj.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});
  packed.userData={...obj.userData,id:lm.id,top:bounds.max.y};
  return packed;
}
