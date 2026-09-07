import * as THREE from 'three';

// 랜드마크는 실측 복원이 아니라 캐리커쳐다. 특징만 남기고 크게 과장한다.
// clear: 이 반경(m) 안의 일반 건물 박스는 지운다.

export const LANDMARKS = [
  { id:'namsan',   name:'N서울타워',      en:'N Seoul Tower',      lon:126.98825, lat:37.55130, clear:220, desc:'남산 위에 선 도시의 바늘' },
  { id:'lotte',    name:'롯데월드타워',    en:'Lotte World Tower',  lon:127.10250, lat:37.51250, clear:260, desc:'555m, 서울에서 가장 높은 곳' },
  { id:'63',       name:'63빌딩',         en:'63 Building',        lon:126.94010, lat:37.51970, clear:220, desc:'한강가에 세운 황금 렌즈' },
  { id:'gwangh',   name:'광화문',         en:'Gwanghwamun',        lon:126.97690, lat:37.57600, clear:260, desc:'경복궁 앞, 도심의 축이 시작되는 문' },
  { id:'assembly', name:'국회의사당',      en:'National Assembly',  lon:126.91430, lat:37.53200, clear:300, desc:'여의도의 청록 돔' },
  { id:'ddp',      name:'DDP',           en:'Dongdaemun DP',      lon:126.99920, lat:37.56680, clear:230, desc:'이음매 없는 은빛 곡면' },
  { id:'seoulst',  name:'서울역',         en:'Seoul Station',      lon:126.97250, lat:37.55590, clear:200, desc:'붉은 벽돌의 옛 역사' },
  { id:'sungnye',  name:'숭례문',         en:'Sungnyemun',         lon:126.97530, lat:37.55990, clear:170, desc:'남대문, 도성의 정문' },
  { id:'jamsil',   name:'잠실주경기장',    en:'Jamsil Stadium',     lon:127.07200, lat:37.51520, clear:320, desc:'1988년 올림픽의 무대' },
  { id:'coex',     name:'무역센터',       en:'Trade Tower',        lon:127.05920, lat:37.51100, clear:210, desc:'코엑스 위로 솟은 사각 기둥' },
  { id:'worldcup', name:'서울월드컵경기장', en:'Seoul World Cup Stadium', lon:126.89740, lat:37.56830, clear:320, desc:'방패연을 펼친 지붕' },
  { id:'parkone',  name:'파크원',         en:'Parc.1',             lon:126.92680, lat:37.52530, clear:190, desc:'여의도의 붉은 기둥' },
  { id:'magic',    name:'매직아일랜드',    en:'Magic Island',       lon:127.09830, lat:37.51100, clear:170, desc:'석촌호수 위의 작은 성' },
];

const C = {
  concrete: 0xd9d7cc, steel: 0xbfc7c8, glassDark: 0x5d7078, glassBlue: 0x87a8bc,
  gold: 0xd8b25e, brick: 0xa8624a, roofTile: 0x4a4a4f, woodRed: 0xa8503c,
  jade: 0x6fa89a, silver: 0xd2d6d6, white: 0xf2f1ea, stone: 0xc3bdae,
  green: 0x5c8f6f, magenta: 0xc26b8a,
};

const mat = (color, emissive = 0) => new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: 0.9 });

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
// 기와지붕: 넓은 처마의 사각뿔대
const hipRoof = (w, d, h, color, y = 0) => {
  const g = new THREE.CylinderGeometry(0.62, 1, h, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(w / 2, 1, d / 2);
  const m = new THREE.Mesh(g, mat(color));
  m.position.y = y + h / 2;
  return m;
};

function group(...children) {
  const g = new THREE.Group();
  g.add(...children.filter(Boolean));
  return g;
}

const BUILDERS = {
  // 남산타워 — 기둥 + 전망대 + 안테나
  namsan(night) {
    const g = group(
      cyl(60, 96, 44, C.stone, 0, 20),                       // 산정 데크
      cyl(15, 27, 250, C.concrete, 40),
      cyl(46, 40, 34, C.white, 262, 24, night ? 0x3a2a10 : 0),
      cyl(38, 46, 30, C.white, 296, 24, night ? 0x3a2a10 : 0),
      cyl(26, 34, 26, C.steel, 326),
      cyl(4, 9, 190, C.steel, 352),
      sphere(9, night ? 0xff6b5a : 0xd0554a, 552, Math.PI*2, Math.PI, night ? 0x882018 : 0),
    );
    g.userData.top = 570;
    return g;
  },

  // 롯데월드타워 — 위로 갈수록 가늘어지는 사각 기둥, 꼭대기가 갈라진다
  lotte(night) {
    const shaft = new THREE.CylinderGeometry(26, 74, 880, 4, 1);
    shaft.rotateY(Math.PI / 4);
    shaft.scale(1, 1, 0.92);
    const m = new THREE.Mesh(shaft, mat(night ? 0x93b7c9 : 0xc6d5da, night ? 0x27424f : 0));
    m.position.y = 440;
    const crownA = box(14, 130, 42, C.steel, 880).translateX(-16);
    const crownB = box(14, 100, 42, C.steel, 880).translateX(16);
    const g = group(box(150, 40, 150, C.concrete, 0), m, crownA, crownB);
    g.userData.top = 1030;
    return g;
  },

  // 63빌딩 — 황금 렌즈
  '63'(night) {
    const s = new THREE.Shape();
    s.moveTo(-70, 0); s.quadraticCurveTo(0, 34, 70, 0); s.quadraticCurveTo(0, -34, -70, 0);
    const g0 = new THREE.ExtrudeGeometry(s, { depth: 430, bevelEnabled: false, curveSegments: 14 });
    g0.rotateX(-Math.PI / 2);
    g0.scale(1, 1, 1);
    const m = new THREE.Mesh(g0, mat(C.gold, night ? 0x6a4c12 : 0));
    const g = group(box(190, 26, 110, C.concrete, 0), m);
    g.userData.top = 450;
    return g;
  },

  // 광화문 — 석축 위 2층 문루
  gwangh() {
    const g = group(
      box(230, 46, 86, C.stone, 0),
      box(190, 34, 66, C.woodRed, 46),
      hipRoof(250, 108, 40, C.roofTile, 80),
      box(150, 30, 56, C.woodRed, 118),
      hipRoof(210, 92, 40, C.roofTile, 148),
      box(300, 22, 22, C.stone, 0).translateZ(-70),          // 좌우로 이어지는 궁장
      box(300, 22, 22, C.stone, 0).translateZ(70),
    );
    g.userData.top = 200;
    return g;
  },

  // 국회의사당 — 화강암 본관 + 청록 돔
  assembly(night) {
    const g = group(
      box(300, 34, 220, C.stone, 0),
      box(250, 96, 180, 0xd6cfc0, 34),
      sphere(66, C.jade, 130, Math.PI * 2, Math.PI / 2, night ? 0x123c34 : 0),
      cyl(66, 76, 22, 0xcac2b2, 118),
    );
    g.userData.top = 210;
    return g;
  },

  // DDP — 눌린 은빛 곡면
  ddp(night) {
    const s = sphere(150, C.silver, 34, Math.PI * 2, Math.PI / 2, night ? 0x2c3a42 : 0);
    s.scale.set(1.5, 0.42, 0.85);
    const s2 = sphere(96, C.silver, 30, Math.PI * 2, Math.PI / 2);
    s2.scale.set(1.2, 0.3, 0.7);
    s2.position.set(150, 30, 60);
    const g = group(box(420, 12, 260, 0xb9bcbb, 22), s, s2);
    g.userData.top = 110;
    return g;
  },

  seoulst(night) {
    const g = group(
      box(230, 66, 110, C.brick, 0),
      box(90, 34, 90, 0xb87055, 66),
      sphere(46, C.jade, 100, Math.PI * 2, Math.PI / 2, night ? 0x123c34 : 0),
      box(70, 46, 70, C.brick, 0).translateX(-130),
      box(70, 46, 70, C.brick, 0).translateX(130),
    );
    g.userData.top = 170;
    return g;
  },

  sungnye() {
    const g = group(
      box(170, 56, 90, C.stone, 0),
      box(140, 30, 66, C.woodRed, 56),
      hipRoof(190, 100, 34, C.roofTile, 86),
      box(112, 26, 54, C.woodRed, 120),
      hipRoof(160, 86, 32, C.roofTile, 146),
    );
    g.userData.top = 190;
    return g;
  },

  jamsil(night) {
    const bowl = cyl(230, 180, 96, 0xe4e0d4, 0, 40, 0, true);
    bowl.material.side = THREE.DoubleSide;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(232, 16, 10, 44), mat(C.white, night ? 0x33302a : 0));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 100;
    const field = cyl(176, 176, 6, C.green, 8, 40);
    const g = group(bowl, rim, field);
    g.userData.top = 130;
    return g;
  },

  coex(night) {
    const g = group(
      box(280, 40, 220, 0xcfd3cf, 0),
      box(96, 420, 96, night ? 0x8fb0c0 : C.glassDark, 40, night ? 0x24404c : 0),
      box(150, 90, 110, 0xdcdcd2, 40).translateX(-150),
    );
    g.userData.top = 470;
    return g;
  },

  worldcup(night) {
    const ring = cyl(250, 210, 70, 0xe8e6dc, 0, 40, 0, true);
    ring.material.side = THREE.DoubleSide;
    const roof = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const sail = new THREE.Mesh(new THREE.ConeGeometry(120, 90, 4), mat(C.white, night ? 0x2e3a3e : 0));
      sail.position.set(Math.cos(i * Math.PI/2) * 150, 108, Math.sin(i * Math.PI/2) * 150);
      sail.rotation.y = i * Math.PI / 2 + Math.PI / 4;
      roof.add(sail);
    }
    const g = group(ring, roof, cyl(190, 190, 6, C.green, 6, 40));
    g.userData.top = 170;
    return g;
  },

  parkone(night) {
    const col = (x, z, h) => box(30, h, 30, night ? 0xd06a5a : 0xb8503f, 0, night ? 0x4a1810 : 0).translateX(x).translateZ(z);
    const g = group(
      box(160, 300, 90, night ? 0x8fb0c0 : C.glassBlue, 0, night ? 0x24404c : 0),
      col(-80, -50, 330), col(-80, 50, 330), col(80, -50, 330), col(80, 50, 330),
      box(180, 16, 110, 0xd8d4c8, 330),
    );
    g.userData.top = 350;
    return g;
  },

  magic(night) {
    const spire = (x, z, r, h, color) => {
      const t = new THREE.Group();
      t.add(cyl(r, r * 1.1, h, C.white, 0), new THREE.Mesh(new THREE.ConeGeometry(r * 1.5, h * 0.75, 10), mat(color, night ? 0x40182c : 0)).translateY(h + h * 0.375));
      t.position.set(x, 0, z);
      return t;
    };
    const g = group(
      cyl(80, 96, 40, C.stone, 0, 12),
      spire(0, 0, 26, 130, C.magenta),
      spire(-52, 30, 15, 78, C.magenta),
      spire(52, 30, 15, 78, C.magenta),
      spire(0, -56, 17, 92, C.magenta),
    );
    g.userData.top = 260;
    return g;
  },
};

export function buildLandmark(lm, themeName) {
  const b = BUILDERS[lm.id];
  if (!b) return null;
  const obj = b(themeName === 'night');
  obj.userData.id = lm.id;
  return obj;
}
