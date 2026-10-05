// OpenFreeMap z14 벡터타일 → 경량 3D 씬 데이터
// 건물은 최소 회전 사각형(박스)으로 축약해 인스턴스 렌더에 바로 쓴다.
// 사용: node tools/build-city.mjs seoul
import { PbfReader as Pbf } from 'pbf';
import { VectorTile, classifyRings } from '@mapbox/vector-tile';
import { writeFileSync, mkdirSync } from 'fs';

const TILES = 'https://tiles.openfreemap.org/planet/20260830_080001_pt/{z}/{x}/{y}.pbf';
const Z = 14, EXTENT = 4096, R = 40075016.686;

// unit   좌표 저장 단위(m). 폭이 65km를 넘으면 Int16(±32767m)을 벗어나므로 2를 쓴다.
// tree   나무 격자 간격(m). 숲이 넓은 곳은 키워서 데이터를 줄인다.
// hRef   지형 색 램프가 최상단 색에 닿는 표고(m).
// gLo    램프에서 건너뛸 앞쪽 색 수. 섬은 1 — 도시 바닥용 크림색을 빼야 해안이 백사장이 안 된다.
// bRef   건물 색 램프가 끝 색에 닿는 높이(m). 저층 도시는 낮춰야 색이 퍼진다.
const CITIES = {
  seoul:   { center: [126.9880, 37.5450], bbox: [126.74, 37.41, 127.20, 37.70] },
  jeju:    { center: [126.5650, 33.3750], bbox: [126.14, 33.17, 126.99, 33.58], unit: 2, tree: 68, hRef: 460, gLo: 1, bRef: 60 },
  chapelhill: { center: [-79.055, 35.913], bbox: [-79.13, 35.865, -78.98, 35.995], tree: 48, hRef: 260, bRef: 45 },
  busan:   { center: [129.0403, 35.1180], bbox: [128.92, 35.05, 129.22, 35.27] },
  newyork: { center: [-73.9840, 40.7480], bbox: [-74.06, 40.66, -73.88, 40.84] },
  paris:   { center: [2.3400, 48.8600],   bbox: [2.22, 48.80, 2.47, 48.92] },
};

const lon2x = (lon, z) => (lon + 180) / 360 * 2 ** z;
const lat2y = (lat, z) => (1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180)) / Math.PI) / 2 * 2 ** z;

const ROAD_CLASS = { motorway: 3, trunk: 2.4, primary: 2, secondary: 1.5, tertiary: 1.1 };

// 피복 종류 — 0 잔디 · 1 숲 · 2 골프장 · 3 밭·과수원 · 4 부지 · 5 공원 · 6 암반
// 1과 5에는 나무를 심는다. 5(공원·국립공원)는 숲 폴리곤과 통째로 겹치므로 바닥을 깔지 않는다.
const SITE = new Set(['cemetery', 'school', 'university', 'theme_park', 'pitch', 'track', 'stadium', 'zoo']);

async function fetchTile(x, y) {
  const url = TILES.replace('{z}', Z).replace('{x}', x).replace('{y}', y);
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(r.status);
      return new VectorTile(new Pbf(new Uint8Array(await r.arrayBuffer())));
    } catch (e) {
      if (a === 2) { console.warn(`  타일 ${x}/${y} 실패: ${e.message}`); return null; }
      await new Promise(r => setTimeout(r, 400 * (a + 1)));
    }
  }
}

function inRing(r, px, py) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i+1], xj = r[j], yj = r[j+1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i+1] - r[i] * r[j+1];
  return Math.abs(a) / 2;
}

// 주축(PCA) 기준 외접 사각형 → [cx, cy, width, depth, angleDeg]
function orientedBox(r) {
  const n = r.length / 2;
  let mx = 0, my = 0;
  for (let i = 0; i < r.length; i += 2) { mx += r[i]; my += r[i+1]; }
  mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < r.length; i += 2) {
    const dx = r[i] - mx, dy = r[i+1] - my;
    sxx += dx*dx; syy += dy*dy; sxy += dx*dy;
  }
  const th = 0.5 * Math.atan2(2*sxy, sxx - syy);
  const c = Math.cos(th), s = Math.sin(th);
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (let i = 0; i < r.length; i += 2) {
    const dx = r[i] - mx, dy = r[i+1] - my;
    const u = dx*c + dy*s, v = -dx*s + dy*c;
    if (u < uMin) uMin = u; if (u > uMax) uMax = u;
    if (v < vMin) vMin = v; if (v > vMax) vMax = v;
  }
  const ou = (uMin + uMax) / 2, ov = (vMin + vMax) / 2;
  return [mx + ou*c - ov*s, my + ou*s + ov*c, uMax - uMin, vMax - vMin, th * 180 / Math.PI];
}

// 정점 간 최소 간격으로 라인/링 솎아내기
function thin(flat, minDist) {
  const out = [flat[0], flat[1]];
  const d2 = minDist * minDist;
  for (let i = 2; i < flat.length; i += 2) {
    const dx = flat[i] - out[out.length-2], dy = flat[i+1] - out[out.length-1];
    if (dx*dx + dy*dy >= d2) out.push(flat[i], flat[i+1]);
  }
  return out;
}

const city = process.argv[2] || 'seoul';
const conf = CITIES[city];
if (!conf) throw new Error(`unknown city: ${city}`);
const { center, bbox } = conf;
const UNIT = conf.unit ?? 1;                       // bin 좌표 1단위 = UNIT 미터
const TREE_GRID = conf.tree ?? 34;

const kx = R * Math.cos(center[1] * Math.PI / 180);
const cx = lon2x(center[0], Z), cy = lat2y(center[1], Z);
const toWorld = (tx, ty, px, py) => [
   ((tx + px / EXTENT) - cx) / 2 ** Z * kx,
  -((ty + py / EXTENT) - cy) / 2 ** Z * kx,
];

const x0 = Math.floor(lon2x(bbox[0], Z)), x1 = Math.floor(lon2x(bbox[2], Z));
const y0 = Math.floor(lat2y(bbox[3], Z)), y1 = Math.floor(lat2y(bbox[1], Z));
const jobs = [];
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
console.log(`${city}: z${Z} 타일 ${x1-x0+1}×${y1-y0+1} = ${jobs.length}개`);

const bld = [];            // [x, y, w, d, ang, h] 평탄 배열
const trees = [];          // [x, y, scale*100]
const water = [], oceans = [], greens = [], roads = [];
const seen = new Set();    // 타일 경계에서 잘린 같은 건물 중복 억제

function polysOf(feature, tx, ty) {
  return classifyRings(feature.loadGeometry()).map(poly =>
    poly.map(ring => {
      const flat = [];
      for (const p of ring) { const [wx, wy] = toWorld(tx, ty, p.x, p.y); flat.push(Math.round(wx), Math.round(wy)); }
      return flat;
    }));
}

let done = 0;
const CONC = 8;
await Promise.all(Array.from({ length: CONC }, async (_, w) => {
  for (let i = w; i < jobs.length; i += CONC) {
    const [tx, ty] = jobs[i];
    const tile = await fetchTile(tx, ty);
    if (++done % 50 === 0) console.log(`  ${done}/${jobs.length}`);
    if (!tile) continue;

    const b = tile.layers.building;
    if (b) for (let k = 0; k < b.length; k++) {
      const f = b.feature(k), p = f.properties;
      const h = Math.max(3, Math.round(p.render_height ?? 6));
      for (const poly of polysOf(f, tx, ty)) {
        const ring = poly[0];
        if (ring.length < 8) continue;
        if (ringArea(ring) < 60) continue;                 // 창고·간이건물은 생략
        const [bx, by, bw, bd, ang] = orientedBox(ring);
        if (bw < 4 || bd < 4) continue;
        const key = `${Math.round(bx)},${Math.round(by)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bld.push(Math.round(bx / UNIT), Math.round(by / UNIT), Math.round(bw), Math.round(bd), Math.round(ang), h);
      }
    }

    const wl = tile.layers.water;
    if (wl) for (let k = 0; k < wl.length; k++) {
      const f = wl.feature(k);
      if (f.properties.brunnel === 'tunnel') continue;
      const sea = f.properties.class === 'ocean';
      for (const poly of polysOf(f, tx, ty)) {
        const rings = poly.map(r => thin(r, sea ? 30 : 12)).filter(r => r.length >= 8);
        if (rings.length) (sea ? oceans : water).push(rings);
      }
    }

    for (const name of ['landcover', 'park', 'landuse']) {
      const lc = tile.layers[name];
      if (!lc) continue;
      for (let k = 0; k < lc.length; k++) {
        const f = lc.feature(k), cls = f.properties.class ?? 'park', sub = f.properties.subclass;
        let kind;
        if (name === 'park') kind = 5;
        else if (name === 'landuse') { if (!SITE.has(cls)) continue; kind = 4; }
        else if (cls === 'wood') kind = 1;
        else if (cls === 'rock') kind = 6;
        else if (sub === 'golf_course') kind = 2;      // class는 grass지만 색을 따로 준다
        else if (cls === 'grass') kind = 0;
        else if (cls === 'farmland') kind = 3;         // 밭·감귤과수원
        else continue;
        const treed = kind === 1 || kind === 5;
        for (const poly of polysOf(f, tx, ty)) {
          const ring = poly[0];
          const area = ringArea(ring);
          if (area < 2500) continue;
          const thinned = thin(ring, 15);
          if (thinned.length >= 8) greens.push({ t: kind, r: thinned, holes: poly.slice(1).map(r=>thin(r,15)) });
          if (!treed) continue;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (let m = 0; m < ring.length; m += 2) {
            if (ring[m] < minX) minX = ring[m]; if (ring[m] > maxX) maxX = ring[m];
            if (ring[m+1] < minY) minY = ring[m+1]; if (ring[m+1] > maxY) maxY = ring[m+1];
          }
          for (let gx = Math.ceil(minX/TREE_GRID)*TREE_GRID; gx < maxX; gx += TREE_GRID)
            for (let gy = Math.ceil(minY/TREE_GRID)*TREE_GRID; gy < maxY; gy += TREE_GRID) {
              const jx = gx + (Math.random()-.5)*TREE_GRID*.85, jy = gy + (Math.random()-.5)*TREE_GRID*.85;
              if (!inRing(ring, jx, jy)) continue;
              if (poly.length > 1 && poly.slice(1).some(h => inRing(h, jx, jy))) continue;
              trees.push(Math.round(jx / UNIT), Math.round(jy / UNIT), Math.round(70 + Math.random()*70));
            }
        }
      }
    }

    const tr = tile.layers.transportation;
    if (tr) for (let k = 0; k < tr.length; k++) {
      const f = tr.feature(k), cls = f.properties.class;
      const wgt = ROAD_CLASS[cls] ?? (cls === 'rail' && f.properties.subclass === 'rail' ? 1 : 0);
      if (!wgt) continue;
      for (const line of f.loadGeometry()) {
        const flat = [];
        for (const p of line) { const [wx, wy] = toWorld(tx, ty, p.x, p.y); flat.push(Math.round(wx), Math.round(wy)); }
        const t = flat.length >= 4 ? thin(flat, 10) : flat;
        if (t.length >= 4) roads.push({ w: wgt, rail: cls === 'rail' ? 1 : 0, p: t });
      }
    }
  }
}));

mkdirSync('data', { recursive: true });
const bin = (name, arr) => {
  const a = Int16Array.from(arr.map(v => Math.max(-32768, Math.min(32767, v))));
  writeFileSync(`data/${city}.${name}.bin`, Buffer.from(a.buffer));
  return a.byteLength;
};
const bb = bin('buildings', bld);
const tb = bin('trees', trees);
const meta = { city, center, bbox, z: Z, kx, unit: UNIT, hRef: conf.hRef ?? 420, groundLo: conf.gLo ?? 0, bRef: conf.bRef ?? 165, sea: oceans.length > 0,
               counts: { buildings: bld.length/6, trees: trees.length/3 } };
const payload = JSON.stringify({ meta, water, oceans, greens, roads });
writeFileSync(`data/${city}.json`, payload);

const mb = n => (n/1048576).toFixed(2);
console.log(`\ndata/${city}.buildings.bin  ${mb(bb)}MB  (${bld.length/6}동)`);
console.log(`data/${city}.trees.bin      ${mb(tb)}MB  (${trees.length/3}그루)`);
console.log(`data/${city}.json           ${mb(payload.length)}MB  (물 ${water.length} · 바다 ${oceans.length} · 녹지 ${greens.length} · 도로 ${roads.length})`);
