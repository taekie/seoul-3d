import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDMARKS, buildLandmark } from './landmarks.js';

const R = 40075016.686;
const EXAG = 3;               // 지형·건물 공통 과장
const DEM_Z = 12;

const lon2x = (lon, z) => (lon + 180) / 360 * 2 ** z;
const lat2y = (lat, z) => (1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180)) / Math.PI) / 2 * 2 ** z;

export const THEMES = {
  day: {
    sky: '#dfe7e2', fog: '#e4eae5', fogNear: 46000, fogFar: 165000,
    ground: ['#efece0', '#e2e4d2', '#c3d2b0', '#a2bd8c', '#87a874'],
    water: '#2ba7d8', road: '#fdfdfb', rail: '#c0b8ad', grass: '#cfe0b8',
    tree: ['#41703d', '#4f8347', '#5f9552', '#71a862', '#87b877', '#3d6b46'],
    bld: ['#f4f2e8', '#e7e9dd', '#cdd9d3', '#a9c1c3', '#8aabb0'],
    sun: { color: '#fffdf7', intensity: 1.35, pos: [-0.5, 1.05, 0.5] },
    hemi: { sky: '#ffffff', ground: '#e0dbc9', intensity: 1.9 },
    amb: 0.95,
  },
  dusk: {
    sky: '#f2ddc6', fog: '#f4e2cd', fogNear: 38000, fogFar: 150000,
    ground: ['#f3e0cb', '#e8d3b6', '#cdbf9a', '#a9a884', '#8c9273'],
    water: '#3f8fb8', road: '#fff2e2', rail: '#b09c8c', grass: '#c9cda3',
    tree: ['#3f5c40', '#4d6d48', '#5c7d52', '#6d8e5e', '#7d9c6b', '#3a5544'],
    bld: ['#fdefdc', '#f6e0c6', '#e6c3ab', '#c9a294', '#a8858a'],
    sun: { color: '#ffb46a', intensity: 2.4, pos: [-1, 0.35, 0.2] },
    hemi: { sky: '#ffd9b0', ground: '#8a7a68', intensity: 0.9 },
    amb: 0.3,
  },
  night: {
    sky: '#0d161c', fog: '#111d25', fogNear: 32000, fogFar: 130000,
    ground: ['#1b2229', '#1d262c', '#1e2a2b', '#20302c', '#22352e'],
    water: '#123244', road: '#3d4a52', rail: '#2c363c', grass: '#1d2c26',
    tree: ['#182a20', '#1e3427', '#243d2e', '#2a4735', '#1a2f24', '#20382a'],
    bld: ['#1e2b33', '#26343d', '#2f414a', '#415a64', '#eed8a2'],
    sun: { color: '#8fb6d0', intensity: 0.45, pos: [-0.4, 0.8, 0.4] },
    hemi: { sky: '#25404f', ground: '#0b1116', intensity: 0.5 },
    amb: 0.5,
  },
};

// ── 지형 ────────────────────────────────────────────────────────────────
class Terrain {
  constructor(kx, center, bbox) {
    this.kx = kx; this.center = center; this.bbox = bbox;
  }
  async load(onProgress) {
    const [w, s, e, n] = this.bbox;
    // 데이터 영역보다 넉넉히 (주변 산까지)
    const pad = 0.10;
    const bw = w - (e-w)*pad, be = e + (e-w)*pad, bs = s - (n-s)*pad, bn = n + (n-s)*pad;
    const tx0 = Math.floor(lon2x(bw, DEM_Z)), tx1 = Math.floor(lon2x(be, DEM_Z));
    const ty0 = Math.floor(lat2y(bn, DEM_Z)), ty1 = Math.floor(lat2y(bs, DEM_Z));
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
    const W = nx * 256, H = ny * 256;
    const data = new Float32Array(W * H);

    const cv = new OffscreenCanvas(256, 256);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const tiles = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) tiles.push([ix, iy]);

    let done = 0;
    const CONC = 10;
    await Promise.all(Array.from({ length: CONC }, async (_, k) => {
      for (let i = k; i < tiles.length; i += CONC) {
        const [ix, iy] = tiles[i];
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${DEM_Z}/${tx0+ix}/${ty0+iy}.png`;
        try {
          const bmp = await createImageBitmap(await (await fetch(url)).blob());
          ctx.clearRect(0, 0, 256, 256);
          ctx.drawImage(bmp, 0, 0);
          const px = ctx.getImageData(0, 0, 256, 256).data;
          for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
            const o = (y*256 + x) * 4;
            data[(iy*256 + y) * W + ix*256 + x] = px[o]*256 + px[o+1] + px[o+2]/256 - 32768;
          }
        } catch { /* 빈 타일은 0m */ }
        onProgress?.(++done / tiles.length);
      }
    }));

    this.W = W; this.H = H; this.data = data;
    this.sx = this.kx / 2 ** DEM_Z / 256;                 // 픽셀당 미터
    this.ox = (tx0 * 256 - lon2x(this.center[0], DEM_Z) * 256) * this.sx;  // 그리드 원점의 월드 X
    this.oy = -(ty0 * 256 - lat2y(this.center[1], DEM_Z) * 256) * this.sx; // 월드 Y(북+)
    // 월드 범위
    this.minX = this.ox; this.maxX = this.ox + (W-1) * this.sx;
    this.maxY = this.oy; this.minY = this.oy - (H-1) * this.sx;
    return this;
  }
  // 월드(x, y북+) → 표고(m, 과장 전)
  at(x, y) {
    const fx = (x - this.ox) / this.sx, fy = (this.oy - y) / this.sx;
    const i = Math.max(0, Math.min(this.W - 2, Math.floor(fx)));
    const j = Math.max(0, Math.min(this.H - 2, Math.floor(fy)));
    const tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
    const d = this.data, W = this.W;
    const a = d[j*W+i], b = d[j*W+i+1], c = d[(j+1)*W+i], e = d[(j+1)*W+i+1];
    return (a*(1-tx) + b*tx)*(1-ty) + (c*(1-tx) + e*tx)*ty;
  }
  // 물 아래 지형은 파낸다 — DEM 해상도로는 강바닥이 뭉개져 물이 묻히기 때문.
  // 마스크 값은 그 지점 수면 고도(m)를 3으로 나눈 것 +1, 0이면 물이 아니다.
  maskedAt(x, y) {
    const h = this.at(x, y);
    const m = this.mask;
    if (!m) return h;
    const ci = Math.round((x - this.minX) * m.sx), cj = Math.round((this.maxY - y) * m.sy);
    let best = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= m.W || j >= m.H) continue;
      const v = m.data[j * m.W + i];
      if (v > best) best = v;          // 강이 정점 사이로 빠지지 않도록 이웃까지 본다
    }
    return best ? Math.min(h, (best - 1) * 3) - 16 : h;
  }
  mesh(theme) {
    const SEG = 560;
    const spanX = this.maxX - this.minX, spanY = this.maxY - this.minY;
    const g = new THREE.PlaneGeometry(spanX, spanY, SEG, Math.round(SEG * spanY / spanX));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const stops = theme.ground.map(c => new THREE.Color(c));
    const cx = (this.minX + this.maxX) / 2, cy = (this.minY + this.maxY) / 2;
    const tmp = new THREE.Color();
    let maxH = 0;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + cx, wy = -pos.getZ(i) + cy;
      const h = this.maskedAt(wx, wy);
      pos.setY(i, h * EXAG);
      if (h > maxH) maxH = h;
      const t = Math.max(0, Math.min(1, h / 420)) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(t));
      tmp.copy(stops[k]).lerp(stops[k+1], t - k);
      col[i*3] = tmp.r; col[i*3+1] = tmp.g; col[i*3+2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.position.set(cx, 0, -cy);
    m.receiveShadow = true;
    m.userData.stops = stops;
    return m;
  }
}

// ── 씬 ──────────────────────────────────────────────────────────────────
export class City {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 20, 320000);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.06,
      maxPolarAngle: Math.PI / 2 - 0.03, minDistance: 300, maxDistance: 110000,
      zoomSpeed: 0.9, rotateSpeed: 0.55, panSpeed: 0.8, screenSpacePanning: false,
    });
    this.groups = {};
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  async load(city, onProgress) {
    const base = `data/${city}`;
    onProgress?.('지형을 빚는 중', 0.05);
    const [meta, bldBuf, treeBuf] = await Promise.all([
      fetch(`${base}.json`).then(r => r.json()),
      fetch(`${base}.buildings.bin`).then(r => r.arrayBuffer()),
      fetch(`${base}.trees.bin`).then(r => r.arrayBuffer()),
    ]);
    this.data = meta;
    this.bld = new Int16Array(bldBuf);
    this.trees = new Int16Array(treeBuf);

    this.terrain = new Terrain(meta.meta.kx, meta.meta.center, meta.meta.bbox);
    await this.terrain.load(p => onProgress?.('지형을 빚는 중', 0.05 + p * 0.5));

    onProgress?.('도시를 세우는 중', 0.6);
    this.applyTheme('day', true);
    onProgress?.('마무리', 0.97);
  }

  clearGroups() {
    for (const g of Object.values(this.groups)) {
      this.scene.remove(g);
      g.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
    }
    this.groups = {};
  }

  applyTheme(name, first = false) {
    const t = THEMES[name];
    this.theme = t;
    this.themeName = name;
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);

    this.clearGroups();
    this.scene.clear();

    // 조명
    const hemi = new THREE.HemisphereLight(t.hemi.sky, t.hemi.ground, t.hemi.intensity);
    this.scene.add(hemi, new THREE.AmbientLight(0xffffff, t.amb));
    const sun = new THREE.DirectionalLight(t.sun.color, t.sun.intensity);
    sun.position.set(...t.sun.pos).multiplyScalar(20000);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 16000;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 100, far: 60000 });
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 3;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    if (!this.terrain.mask) this.buildWaterMask();
    this.groups.terrain = this.terrain.mesh(t);
    this.scene.add(this.groups.terrain);
    this.buildWater();
    this.buildGreens();
    this.buildRoads();
    this.buildBuildings();
    this.buildTrees();
    this.buildLandmarks();
    if (this.labelsHidden) this.setLabels(false);
  }

  // 건물 ── 회전 사각형 박스 인스턴스 하나로 전부
  buildBuildings() {
    const t = this.theme;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);                       // 바닥 기준
    const n = this.bld.length / 6;
    const skip = LANDMARKS.filter(l => l.clear).map(l => ({
      x: this.lonToX(l.lon), y: this.latToY(l.lat), r2: l.clear * l.clear,
    }));
    const mesh = new THREE.InstancedMesh(geo,
      new THREE.MeshLambertMaterial({ vertexColors: false }), n);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const stops = t.bld.map(c => new THREE.Color(c));
    const col = new THREE.Color();
    let k = 0;
    for (let i = 0; i < n; i++) {
      const x = this.bld[i*6], y = this.bld[i*6+1], w = this.bld[i*6+2],
            d = this.bld[i*6+3], ang = this.bld[i*6+4], h = this.bld[i*6+5];
      if (skip.some(sk => (x-sk.x)**2 + (y-sk.y)**2 < sk.r2)) continue;
      const gy = this.terrain.at(x, y) * EXAG;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang * Math.PI / 180);
      v.set(x, gy - 6, -y);
      s.set(w, h * EXAG + 6, d);
      m.compose(v, q, s);
      mesh.setMatrixAt(k, m);
      const tt = Math.min(1, h / 165) * (stops.length - 1);
      const ki = Math.min(stops.length - 2, Math.floor(tt));
      col.copy(stops[ki]).lerp(stops[ki+1], tt - ki);
      // 같은 높이라도 미세한 색 편차를 줘 미니어처의 손맛을 낸다
      const jitter = 0.97 + ((x * 31 + y * 17) % 100) / 100 * 0.08;
      mesh.setColorAt(k, col.clone().multiplyScalar(jitter));
      k++;
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.groups.buildings = mesh;
    this.scene.add(mesh);
  }

  buildTrees() {
    const t = this.theme;
    const cone = new THREE.ConeGeometry(0.5, 1, 5);     // 오각뿔
    cone.translate(0, 0.5, 0);
    const n = this.trees.length / 3;
    const mesh = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial(), n);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const m = new THREE.Matrix4(), v = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const cols = t.tree.map(c => new THREE.Color(c));
    const col = new THREE.Color();
    // 위치에서 뽑은 의사난수 — 데이터를 늘리지 않고 그루마다 다르게
    const rnd = (x, y, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    let k = 0;
    for (let i = 0; i < n; i++) {
      const x = this.trees[i*3], y = this.trees[i*3+1], sc = this.trees[i*3+2] / 100;
      const gy = this.terrain.at(x, y) * EXAG;
      const r1 = rnd(x, y, 1), r2 = rnd(x, y, 2), r3 = rnd(x, y, 3), r4 = rnd(x, y, 4);
      if (r4 < 0.42) continue;                      // 솎아내 성기게
      v.set(x, gy - 2, -y);
      // 폭과 높이를 따로 흔들어 뾰족한 나무와 뭉툭한 나무를 섞는다
      const rw = 26 * sc * (0.6 + r1 * 0.95);
      s.set(rw, 72 * sc * (0.55 + r2 * 1.15), rw);
      q.setFromAxisAngle(axis, r3 * Math.PI * 2);
      m.compose(v, q, s);
      mesh.setMatrixAt(k, m);
      col.copy(cols[Math.floor(r1 * cols.length)]).offsetHSL((r2 - .5) * 0.05, (r3 - .5) * 0.14, (r4 - .5) * 0.10);
      mesh.setColorAt(k, col);
      k++;
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.groups.trees = mesh;
    this.scene.add(mesh);
  }

  polyMesh(rings, color, lift, flatten) {
    const g = this.polyGeom(rings, lift, flatten);
    return g && new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  }

  // 폴리곤 → 지형에 얹은 평면 지오메트리
  polyGeom(rings, lift, flatten) {
    const shapes = [];
    for (const poly of rings) {
      const pts = [];
      for (let i = 0; i < poly[0].length; i += 2) pts.push(new THREE.Vector2(poly[0][i], poly[0][i+1]));
      if (pts.length < 3) continue;
      const shape = new THREE.Shape(pts);
      for (let h = 1; h < poly.length; h++) {
        const hp = [];
        for (let i = 0; i < poly[h].length; i += 2) hp.push(new THREE.Vector2(poly[h][i], poly[h][i+1]));
        if (hp.length >= 3) shape.holes.push(new THREE.Path(hp));
      }
      shapes.push(shape);
    }
    if (!shapes.length) return null;
    const g = new THREE.ShapeGeometry(shapes, 6);
    g.rotateX(-Math.PI / 2);                   // XY평면 → XZ평면 (데이터 y북+ → 씬 z = -y)
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = -pos.getZ(i);
      pos.setY(i, (flatten ?? this.terrain.at(x, y)) * EXAG + lift);
    }
    g.computeVertexNormals();
    return g;
  }

  // 물 폴리곤을 래스터 마스크로 구워 지형 파기에 쓴다
  buildWaterMask() {
    const T = this.terrain;
    const spanX = T.maxX - T.minX, spanY = T.maxY - T.minY;
    const W = 2048, H = Math.round(W * spanY / spanX);
    const ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const sx = W / spanX, sy = H / spanY;
    this.waterLevel = new Map();
    this.data.water.forEach((rings, idx) => {
      let lo = Infinity;
      for (let i = 0; i < rings[0].length; i += 2) lo = Math.min(lo, T.at(rings[0][i], rings[0][i+1]));
      this.waterLevel.set(idx, lo);
      const v = Math.max(1, Math.min(255, Math.round(lo / 3) + 1));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 2) {
          const px = (ring[i] - T.minX) * sx, py = (T.maxY - ring[i+1]) * sy;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      ctx.fill('evenodd');
    });
    const d = ctx.getImageData(0, 0, W, H).data;
    const data = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) data[i] = d[i*4];
    T.mask = { W, H, data, sx, sy };
  }

  buildWater() {
    const geos = [];
    // 수면은 폴리곤별로 평탄하게 — 강이 지형을 따라 울렁이지 않도록
    this.data.water.forEach((rings, idx) => {
      const g = this.polyGeom([rings], 3, this.waterLevel.get(idx) ?? 0);
      if (g) geos.push(g);
    });
    const merged = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: this.theme.water, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    geos.forEach(g => g.dispose());
    this.groups.water = mesh;
    this.scene.add(mesh);
  }

  buildGreens() {
    // 잔디·공원 바닥만 얇게 깔고, 숲은 나무가 표현한다
    const grass = this.data.greens.filter(g => !g.t).map(g => [g.r]);
    const geos = [];
    for (let i = 0; i < grass.length; i += 40) {
      const g = this.polyGeom(grass.slice(i, i + 40), 3);
      if (g) geos.push(g);
    }
    if (!geos.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(geos, false),
      new THREE.MeshLambertMaterial({ color: this.theme.grass, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    geos.forEach(g => g.dispose());
    this.groups.greens = mesh;
    this.scene.add(mesh);
  }

  buildRoads() {
    const t = this.theme;
    const group = new THREE.Group();
    for (const [rail, color] of [[0, t.road], [1, t.rail]]) {
      const verts = [];
      for (const r of this.data.roads) {
        if ((r.rail ? 1 : 0) !== rail) continue;
        const p = r.p, half = (rail ? 9 : 6 * r.w);
        for (let i = 0; i < p.length - 2; i += 2) {
          const x1 = p[i], y1 = p[i+1], x2 = p[i+2], y2 = p[i+3];
          let dx = x2 - x1, dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len * half, ny = dx / len * half;
          const h1 = this.terrain.at(x1, y1) * EXAG + 9, h2 = this.terrain.at(x2, y2) * EXAG + 9;
          verts.push(
            x1+nx, h1, -(y1+ny),  x2+nx, h2, -(y2+ny),  x2-nx, h2, -(y2-ny),
            x1+nx, h1, -(y1+ny),  x2-nx, h2, -(y2-ny),  x1-nx, h1, -(y1-ny));
        }
      }
      if (!verts.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
    }
    this.groups.roads = group;
    this.scene.add(group);
  }

  buildLandmarks() {
    const group = new THREE.Group();
    this.labelAnchors = [];
    for (const lm of LANDMARKS) {
      const x = this.lonToX(lm.lon), y = this.latToY(lm.lat);
      const gy = this.terrain.at(x, y) * EXAG;
      const obj = buildLandmark(lm, this.themeName);
      if (!obj) continue;
      obj.scale.set(1.7, 2.6, 1.7);
      obj.position.set(x, gy, -y);
      obj.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
      group.add(obj);
      this.labelAnchors.push({ lm, pos: new THREE.Vector3(x, gy + (obj.userData.top ?? 200) * 2.6 + 90, -y) });
    }
    this.groups.landmarks = group;
    this.scene.add(group);
  }

  lonToX(lon) {
    const c = this.data.meta.center, kx = this.data.meta.kx;
    return (lon2x(lon, 14) - lon2x(c[0], 14)) / 2 ** 14 * kx;
  }
  latToY(lat) {
    const c = this.data.meta.center, kx = this.data.meta.kx;
    return -(lat2y(lat, 14) - lat2y(c[1], 14)) / 2 ** 14 * kx;
  }

  setLabels(on) { this.labelsHidden = !on; }

  placeCamera(lon, lat, dist, pitch, bearing) {
    const { target, pos } = this.shot(lon, lat, dist, pitch, bearing);
    this.anim = null;
    this.controls.target.copy(target);
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.controls.update();
  }

  shot(lon, lat, dist, pitch, bearing) {
    const x = this.lonToX(lon), y = this.latToY(lat);
    const gy = this.terrain.at(x, y) * EXAG;
    const target = new THREE.Vector3(x, gy, -y);
    const pos = target.clone().add(new THREE.Vector3(
      Math.sin(bearing) * Math.cos(pitch), Math.sin(pitch), Math.cos(bearing) * Math.cos(pitch)
    ).multiplyScalar(dist));
    return { target, pos };
  }

  flyTo(lon, lat, dist = 2600, pitch = 0.72, bearing = -0.5, ms = 2400) {
    const { target, pos } = this.shot(lon, lat, dist, pitch, bearing);
    this.animateCamera(target, pos, ms);
  }

  animateCamera(target, pos, ms) {
    const t0 = performance.now();
    const p0 = this.camera.position.clone(), c0 = this.controls.target.clone();
    const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
    this.anim = now => {
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      this.camera.position.lerpVectors(p0, pos, e);
      this.controls.target.lerpVectors(c0, target, e);
      if (k >= 1) this.anim = null;
    };
  }

  start() {
    this.resize();
    const loop = now => {
      requestAnimationFrame(loop);
      this.anim?.(now);
      // 태양·그림자 카메라를 시야 중심에 붙여 그림자 해상도를 지킨다
      const c = this.controls.target;
      this.sun.target.position.copy(c);
      this.sun.position.copy(c).add(new THREE.Vector3(...this.theme.sun.pos).multiplyScalar(20000));
      this.sun.target.updateMatrixWorld();
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.onFrame?.();
    };
    requestAnimationFrame(loop);
  }
}
