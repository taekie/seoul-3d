import * as THREE from 'three';
import { MapControls } from './map-controls.js';
import { installPanGesture } from './pan-gesture.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { landmarksOf, buildLandmark } from './landmarks.js';
import { clay, miniatureFocus, waterAt, buildBanks } from './miniature.js';
import { buildCityLife, detailSeed, inPlaza } from './city-life.js';

const R = 40075016.686;
const EXAG = 3;               // 지형·건물 공통 과장
const DEM_Z = 12;

const lon2x = (lon, z) => (lon + 180) / 360 * 2 ** z;
const lat2y = (lat, z) => (1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180)) / Math.PI) / 2 * 2 ** z;

export const THEMES = {
  day: {
    sky: '#f0f7f5', fog: '#eef7f1', fogNear: 46000, fogFar: 165000,
    ground: ['#f1efdf', '#deebce', '#bddda7', '#9aca87', '#7cb16b'],
    water: '#24aac3', bank: '#e1d5b6', road: '#fff9ec', rail: '#b5bbb5',
    cover: { wood: '#a6ce8e', grass: '#d0e6ac', golf: '#b6d98b', farm: '#e9dcac', site: '#e8e4d5' },
    tree: ['#4f9d70', '#69b47a', '#85c589', '#a5d186', '#bbdd98', '#60ac8b'],
    bld: ['#fff6e7', '#f5efdf', '#e1eee0', '#b7dcd2', '#8dc7ca'],
    sun: { color: '#ffffff', intensity: 2.6, pos: [-0.65, 1.3, 0.6] },
    hemi: { sky: '#ffffff', ground: '#e6eee0', intensity: 1.35 },
    amb: 0.35,
  },
  dusk: {
    sky: '#f2ddc6', fog: '#f4e2cd', fogNear: 38000, fogFar: 150000,
    ground: ['#f3e0cb', '#e8d3b6', '#cdbf9a', '#a9a884', '#8c9273'],
    water: '#8caeb1', bank: '#c9b49a', road: '#fff2e2', rail: '#b09c8c',
    cover: { wood: '#8b9670', grass: '#c9cda3', golf: '#b2bb8b', farm: '#dccfa6', site: '#d7ceb5' },
    tree: ['#3f5c40', '#4d6d48', '#5c7d52', '#6d8e5e', '#7d9c6b', '#3a5544'],
    bld: ['#fdefdc', '#f6e0c6', '#e6c3ab', '#c9a294', '#a8858a'],
    sun: { color: '#ffb46a', intensity: 2.4, pos: [-1, 0.35, 0.2] },
    hemi: { sky: '#ffd9b0', ground: '#8a7a68', intensity: 0.9 },
    amb: 0.3,
  },
  night: {
    sky: '#0d161c', fog: '#111d25', fogNear: 32000, fogFar: 130000,
    ground: ['#1b2229', '#1d262c', '#1e2a2b', '#20302c', '#22352e'],
    water: '#24464d', bank: '#4b5550', road: '#3d4a52', rail: '#2c363c',
    cover: { wood: '#1a2b21', grass: '#1d2c26', golf: '#20342a', farm: '#242a25', site: '#232b30' },
    tree: ['#182a20', '#1e3427', '#243d2e', '#2a4735', '#1a2f24', '#20382a'],
    bld: ['#1e2b33', '#26343d', '#2f414a', '#415a64', '#eed8a2'],
    sun: { color: '#8fb6d0', intensity: 0.9, pos: [-0.4, 0.8, 0.4] },
    hemi: { sky: '#25404f', ground: '#33414a', intensity: 1.3 },
    amb: 1.0,
  },
};

// ── 지형 ────────────────────────────────────────────────────────────────
class Terrain {
  constructor(kx, center, bbox, hRef, groundLo) {
    this.kx = kx; this.center = center; this.bbox = bbox;
    this.hRef = hRef || 420;             // 색 램프가 최상단 색에 닿는 표고
    this.groundLo = groundLo || 0;       // 램프에서 건너뛸 앞쪽 색 수 (섬은 크림색 바닥을 뺀다)
    this.carve = 16;                     // 수면 아래 지형을 파내는 깊이(m)
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
    // 해수면(best===1)은 깊게 판다. 해안선에서 지형이 해수면 판 높이를 얕게 스쳐
    // 지나가면 그 띠가 통째로 깊이 경합에 걸린다.
    const ci = Math.round((x - this.minX) * m.sx), cj = Math.round((this.maxY - y) * m.sy);
    let best = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= m.W || j >= m.H) continue;
      const v = m.data[j * m.W + i];
      if (v > best) best = v;          // 강이 정점 사이로 빠지지 않도록 이웃까지 본다
    }
    return best ? Math.min(h, (best - 1) * 3) - (best === 1 ? this.carve : 16) : h;
  }
  mesh(theme) {
    const spanX = this.maxX - this.minX, spanY = this.maxY - this.minY;
    // 서울(약 54km)에서 560이던 밀도를 폭에 맞춰 늘린다 — 세그먼트당 약 100m
    const SEG = Math.min(900, Math.max(400, Math.round(spanX / 98)));
    const g = new THREE.PlaneGeometry(spanX, spanY, SEG, Math.round(SEG * spanY / spanX));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const stops = theme.ground.slice(this.groundLo).map(c => new THREE.Color(c));
    const cx = (this.minX + this.maxX) / 2, cy = (this.minY + this.maxY) / 2;
    const tmp = new THREE.Color();
    let maxH = 0;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + cx, wy = -pos.getZ(i) + cy;
      const h = this.maskedAt(wx, wy);
      pos.setY(i, h * EXAG);
      if (h > maxH) maxH = h;
      const t = Math.max(0, Math.min(1, h / this.hRef)) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(t));
      tmp.copy(stops[k]).lerp(stops[k+1], t - k);
      col[i*3] = tmp.r; col[i*3+1] = tmp.g; col[i*3+2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, clay({ vertexColors: true }));
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
    this.restPixelRatio = Math.min(devicePixelRatio, 1.75);
    this.renderer.setPixelRatio(this.restPixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 20, 320000);
    this.controls = new MapControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.06,
      maxPolarAngle: Math.PI / 2 - 0.03, minDistance: 300, maxDistance: 110000,
      zoomSpeed: 0.9, rotateSpeed: 0.55, panSpeed: 0.8, screenSpacePanning: false,
    });
    this.interacting = false;
    this.interactionUntil = 0;
    this.fastRender = false;
    this.controls.addEventListener('start', () => {
      this.anim = null;
      this.interacting = true;
    });
    const endInteraction = () => {
      this.interacting = false;
      this.interactionUntil = performance.now() + 120;
    };
    this.controls.addEventListener('end', endInteraction);
    addEventListener('blur', endInteraction);
    installPanGesture(this,canvas);
    this.focus = miniatureFocus(this.renderer, this.scene, this.camera);
    this.groups = {};
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.focus.resize(w, h);
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
    this.cityId = city;
    this.landmarks = landmarksOf(city);
    this.plaza = city === 'seoul' ? {x:this.lonToX(126.9769),y:this.latToY(37.576)} : null;
    this.unit = meta.meta.unit ?? 1;      // bin 좌표 1단위 = unit 미터
    this.bld = new Int16Array(bldBuf);
    this.trees = new Int16Array(treeBuf);

    this.terrain = new Terrain(meta.meta.kx, meta.meta.center, meta.meta.bbox, meta.meta.hRef, meta.meta.groundLo);
    if (meta.meta.sea) this.terrain.carve = 90;
    await this.terrain.load(p => onProgress?.('지형을 빚는 중', 0.05 + p * 0.5));

    // 서울을 1로 둔 축척 — 안개·시야·그림자 범위를 여기에 맞춰 늘린다
    this.scale = Math.max(1, (this.terrain.maxX - this.terrain.minX) / 54000);
    this.sunDist = 20000 * this.scale;
    this.camera.far = 320000 * this.scale;
    // 깊이 분해능은 near에 반비례한다. 넓은 도시일수록 근평면을 밀어야 먼 해안이 떨지 않는다.
    this.camera.near = 20 * this.scale ** 2;
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = 110000 * this.scale;

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
    this.renderer.toneMappingExposure = name === 'night' ? 1.3 : .95;
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.fog, t.fogNear * this.scale, t.fogFar * this.scale);

    this.sun?.shadow.dispose();
    this.clearGroups();
    this.scene.clear();

    // 조명
    const hemi = new THREE.HemisphereLight(t.hemi.sky, t.hemi.ground, t.hemi.intensity);
    this.scene.add(hemi, new THREE.AmbientLight(0xffffff, t.amb));
    const sun = new THREE.DirectionalLight(t.sun.color, t.sun.intensity);
    sun.position.set(...t.sun.pos).multiplyScalar(this.sunDist);
    sun.castShadow = true;
    const k = Math.min(this.scale, 1.9);
    sun.shadow.mapSize.setScalar(this.scale > 1.4 ? 4096 : 2048);
    const S = 16000 * k;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 100, far: 60000 * this.scale });
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 2;
    sun.shadow.radius = 2.4;
    sun.shadow.intensity = 0.65;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.shadowTarget = new THREE.Vector3(Infinity, Infinity, Infinity);
    this.renderer.shadowMap.needsUpdate = true;

    if (!this.terrain.mask) this.buildWaterMask();
    this.groups.terrain = this.terrain.mesh(t);
    this.scene.add(this.groups.terrain);
    this.buildWater();
    this.groups.banks = buildBanks(this);
    this.scene.add(this.groups.banks);
    this.buildGreens();
    this.buildRoads();
    this.buildBuildings();
    this.buildTrees();
    this.buildLandmarks();
    this.life = buildCityLife(this);
    this.groups.life = this.life.group;
    this.scene.add(this.groups.life);
    if (this.labelsHidden) this.setLabels(false);
  }

  // 건물 ── 회전 사각형 박스 인스턴스 하나로 전부
  buildBuildings() {
    const t = this.theme;
    this.detailBuildings = [];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);                       // 바닥 기준
    const n = this.bld.length / 6;
    const U = this.unit;
    const skip = this.landmarks.filter(l => l.clear).map(l => ({
      x: this.lonToX(l.lon), y: this.latToY(l.lat), r2: l.clear * l.clear,
    }));
    const mesh = new THREE.InstancedMesh(geo,
      clay({ vertexColors: false }), n);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const stops = t.bld.map(c => new THREE.Color(c));
    const col = new THREE.Color();
    const bRef = this.data.meta.bRef ?? 165;      // 이 높이(m)에서 램프 끝 색
    let k = 0;
    for (let i = 0; i < n; i++) {
      const x = this.bld[i*6] * U, y = this.bld[i*6+1] * U, w = this.bld[i*6+2],
            d = this.bld[i*6+3], ang = this.bld[i*6+4], h = this.bld[i*6+5];
      if (inPlaza(this,x,y) || skip.some(sk => (x-sk.x)**2 + (y-sk.y)**2 < sk.r2)) continue;
      const gy = this.terrain.at(x, y) * EXAG;
      const seed = detailSeed(x,y);
      if (seed < .18) this.detailBuildings.push({x,y,w,d,h,gy,ang,seed});
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang * Math.PI / 180);
      v.set(x, gy - 6, -y);
      s.set(w, h * EXAG + 6, d);
      m.compose(v, q, s);
      mesh.setMatrixAt(k, m);
      const tt = Math.min(1, h / bRef) * (stops.length - 1);
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
    const group = new THREE.Group(), U = this.unit;
    const skip = this.landmarks.filter(l => l.clear).map(l => ({
      x: this.lonToX(l.lon), y: this.latToY(l.lat), r2: l.clear * l.clear,
    }));
    const rnd = (x, y, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    const buckets = [[], []];
    for (let i = 0; i < this.trees.length / 3; i++) {
      const x = this.trees[i*3] * U, y = this.trees[i*3+1] * U;
      // Keep about 38% of source trees: roughly 35% fewer than the previous view.
      if (rnd(x, y, 4) < .62 || inPlaza(this,x,y) || skip.some(sk => (x-sk.x)**2 + (y-sk.y)**2 < sk.r2)) continue;
      buckets[rnd(x, y, 3) < .68 ? 0 : 1].push(i);
    }
    const round = new THREE.IcosahedronGeometry(.5, 0);
    // Smooth normals give the low-poly crown a painted wooden-bead finish.
    const normals = round.attributes.normal, positions = round.attributes.position;
    const normal = new THREE.Vector3();
    for (let i = 0; i < normals.count; i++) {
      normal.fromBufferAttribute(positions, i).normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    round.translate(0, .66, 0);
    const cone = new THREE.ConeGeometry(.46, 1, 7);
    cone.translate(0, .68, 0);
    const trunkGeo = new THREE.CylinderGeometry(.07, .1, .45, 5);
    trunkGeo.translate(0, .225, 0);
    const total = buckets[0].length + buckets[1].length;
    const trunks = new THREE.InstancedMesh(trunkGeo, clay({ color: this.themeName === 'night' ? '#514c45' : '#ad9476' }), total);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const colors = this.theme.tree.map(c => new THREE.Color(c));
    let trunkIndex = 0;
    buckets.forEach((indices, kind) => {
      const mesh = new THREE.InstancedMesh(kind ? cone : round, clay(), indices.length);
      indices.forEach((i, k) => {
        const x = this.trees[i*3] * U, y = this.trees[i*3+1] * U, sc = this.trees[i*3+2] / 100;
        const r1 = rnd(x,y,1), r2 = rnd(x,y,2), r3 = rnd(x,y,3);
        const width = (kind ? 30 : 42) * sc * (.85 + r1 * .35);
        const height = (kind ? 65 : 49) * sc * (.85 + r2 * .4);
        position.set(x, this.terrain.at(x,y) * EXAG - 2, -y);
        scale.set(width, height, width);
        rotation.setFromAxisAngle(axis, r3 * Math.PI * 2);
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(k, matrix);
        trunks.setMatrixAt(trunkIndex++, matrix);
        col.copy(colors[Math.floor(r1 * colors.length)]).offsetHSL(0, 0, (r2-.5)*.035);
        mesh.setColorAt(k, col);
      });
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    });
    trunks.frustumCulled = false;
    trunks.instanceMatrix.needsUpdate = true;
    group.add(trunks);
    group.trunks = trunks;
    group.count = total;
    this.groups.trees = group;
    this.scene.add(group);
  }

  polyMesh(rings, color, lift, flatten) {
    const g = this.polyGeom(rings, lift, flatten);
    return g && new THREE.Mesh(g, clay({ color, side: THREE.DoubleSide }));
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
    // 마스크가 거칠면 그만큼 해안선이 안쪽으로 깎인다 — 한 픽셀 25m 아래로 잡는다
    const W = spanX > 60000 ? 4096 : 2048, H = Math.round(W * spanY / spanX);
    const ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const sx = W / spanX, sy = H / spanY;
    const paint = (rings, v) => {
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
    };
    if (this.data.meta.sea) {
      // 지형은 벡터타일 범위보다 넓게 받는다. 그 바깥엔 바다 폴리곤이 없어 해발 0m 땅으로
      // 남고, 수평선 위에 선반처럼 떠 보인다. 섬이면 타일 범위 밖은 통째로 바다로 친다.
      const [bw, bs, be, bn] = this.data.meta.bbox;
      const rx0 = (this.lonToX(bw) - T.minX) * sx, rx1 = (this.lonToX(be) - T.minX) * sx;
      const ry0 = (T.maxY - this.latToY(bn)) * sy, ry1 = (T.maxY - this.latToY(bs)) * sy;
      ctx.fillStyle = 'rgb(1,1,1)';
      ctx.fillRect(0, 0, W, Math.max(0, ry0));
      ctx.fillRect(0, Math.min(H, ry1), W, H);
      ctx.fillRect(0, 0, Math.max(0, rx0), H);
      ctx.fillRect(Math.min(W, rx1), 0, W, H);
    }
    for (const rings of this.data.oceans ?? []) paint(rings, 1);      // 바다는 해수면 0m
    this.waterLevel = new Map();
    this.data.water.forEach((rings, idx) => {
      let lo = Infinity;
      for (let i = 0; i < rings[0].length; i += 2) lo = Math.min(lo, T.at(rings[0][i], rings[0][i+1]));
      lo = Math.max(0, lo);                          // 하구는 DEM이 음수로 나온다
      this.waterLevel.set(idx, lo);
      paint(rings, Math.max(1, Math.min(255, Math.round(lo / 3) + 1)));
    });
    const d = ctx.getImageData(0, 0, W, H).data;
    const data = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) data[i] = d[i*4];
    T.mask = { W, H, data, sx, sy };
  }

  buildWater() {
    const group = new THREE.Group();
    const geos = [];
    // 수면은 폴리곤별로 평탄하게 — 강이 지형을 따라 울렁이지 않도록
    this.data.water.forEach((rings, idx) => {
      const lv = this.waterLevel.get(idx) ?? 0;
      // 항·포구·하구는 해수면 판이 이미 같은 색으로 덮는다. 겹쳐 그리면 z-fighting만 난다.
      if (this.data.meta.sea && lv < 4) return;
      const g = this.polyGeom([rings], 3, lv);
      if (g) geos.push(g);
    });
    if (geos.length) {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false),
        clay({ color: this.theme.water, roughness: 0.32, side: THREE.DoubleSide }));
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      geos.forEach(g => g.dispose());
      group.add(mesh);
    }
    // 섬이면 바다는 타일마다 쪼개진 폴리곤 대신 해수면 한 장으로 편다.
    // 타일 경계에서 겹친 사각형끼리 z-fighting 나는 걸 피하고 수평선까지 이어진다.
    if (this.data.meta.sea) {
      // 안개가 완전히 먹을 때까지 넓혀야 수평선이 직선으로 잘리지 않는다
      const T = this.terrain, pad = this.theme.fogFar * this.scale * 1.6;
      const g = new THREE.PlaneGeometry(T.maxX - T.minX + pad * 2, T.maxY - T.minY + pad * 2);
      g.rotateX(-Math.PI / 2);
      const sea = new THREE.Mesh(g, clay({ color: this.theme.water, roughness: 0.32 }));
      sea.position.set((T.minX + T.maxX) / 2, 2, -(T.minY + T.maxY) / 2);
      group.add(sea);          // 그림자는 받지 않는다 — 넓은 평면이라 얼룩만 진다
    }
    this.groups.water = group;
    this.scene.add(group);
  }

  // 피복을 종류별로 얇게 깐다. 나무만으로는 숲이 땅으로 읽히지 않는다.
  // 겹치는 일이 드물어 살짝 띄우는 것만으로 깊이 경합을 피한다 (도로는 +9라 그 아래).
  buildGreens() {
    const c = this.theme.cover;
    const group = new THREE.Group();
    [[1, 'wood'], [3, 'farm'], [4, 'site'], [0, 'grass'], [2, 'golf']].forEach(([kind, key], li) => {
      const polys = this.data.greens.filter(g => g.t === kind).map(g => [g.r]);
      const geos = [];
      for (let i = 0; i < polys.length; i += 40) {
        const g = this.polyGeom(polys.slice(i, i + 40), 3 + li);
        if (g) geos.push(g);
      }
      if (!geos.length) return;
      const mesh = new THREE.Mesh(mergeGeometries(geos, false),
        clay({ color: c[key], side: THREE.DoubleSide }));
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      geos.forEach(g => g.dispose());
      group.add(mesh);
    });
    this.groups.greens = group;
    this.scene.add(group);
  }

  buildRoads() {
    const t = this.theme, group = new THREE.Group(), fittings = [];
    this.bridgeRoutes = [];
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion(), axis = new THREE.Vector3(0,1,0);
    const supports = new Set();
    const beam = (x,y,z,w,h,d,angle=0) => {
      position.set(x,y,z); scale.set(w,h,d); rotation.setFromAxisAngle(axis,angle);
      fittings.push(matrix.compose(position,rotation,scale).clone());
    };
    for (const [rail, color] of [[0,t.road], [1,t.rail]]) {
      const verts = [];
      for (const r of this.data.roads) {
        if ((r.rail ? 1 : 0) !== rail) continue;
        const p = r.p, half = rail ? 9 : 6*r.w;
        const route = [];
        route.half = half;
        for (let i=0; i<p.length-2; i+=2) {
          const ax=p[i], ay=p[i+1], bx=p[i+2], by=p[i+3];
          const length=Math.hypot(bx-ax,by-ay);
          if (!length) continue;
          const nx=-(by-ay)/length*half, ny=(bx-ax)/length*half;
          const ah=this.terrain.at(ax,ay)*EXAG+9, bh=this.terrain.at(bx,by)*EXAG+9;
          const steps=Math.ceil(length/90);
          for(let j=0;j<steps;j++) {
            const f=j/steps, g=(j+1)/steps;
            const x1=ax+(bx-ax)*f, y1=ay+(by-ay)*f, x2=ax+(bx-ax)*g, y2=ay+(by-ay)*g;
            const cx=(x1+x2)/2, cy=(y1+y2)/2;
            const water=waterAt(this,cx,cy);
            const water1=waterAt(this,x1,y1), water2=waterAt(this,x2,y2);
            // Only add structural details well inside inland water, never at a
            // coast, tile border or a tiny ditch. Existing road paths are retained.
            const eligible=!this.data.meta.sea && (rail || r.w>=2);
            const bridge=eligible && water!==null;
            const h1=Math.max(ah+(bh-ah)*f, eligible && water1!==null ? water1+38 : -Infinity);
            const h2=Math.max(ah+(bh-ah)*g, eligible && water2!==null ? water2+38 : -Infinity);
            verts.push(x1+nx,h1,-(y1+ny), x2+nx,h2,-(y2+ny), x2-nx,h2,-(y2-ny),
              x1+nx,h1,-(y1+ny), x2-nx,h2,-(y2-ny), x1-nx,h1,-(y1-ny));
            if (!bridge || water1===null || water2===null) continue;
            if (!rail) route.push({a:[x1,h1+1,-y1],b:[x2,h2+1,-y2]});
            const len=length/steps, h=(h1+h2)/2, angle=Math.atan2(x2-x1,-(y2-y1));
            // Small pale side beams read as railings at the miniature scale.
            beam(cx+nx,h+4,-(cy+ny),3,7,len+1,angle);
            beam(cx-nx,h+4,-(cy-ny),3,7,len+1,angle);
            beam(cx,h-4,-cy,half*2,7,len+1,angle);
            const key=Math.round(cx/120)+','+Math.round(cy/120);
            if(!supports.has(key) && waterAt(this,cx+nx*2,cy+ny*2)!==null && waterAt(this,cx-nx*2,cy-ny*2)!==null) {
              supports.add(key);
              beam(cx,(h+water)/2-3,-cy,half*1.25,Math.max(4,h-water),9,angle);
            }
          }
        }
        if (route.length) this.bridgeRoutes.push(route);
      }
      if(!verts.length) continue;
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3)); geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,clay({color,side:THREE.DoubleSide}));
      mesh.receiveShadow=true; group.add(mesh);
    }
    if(fittings.length) {
      const details=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),clay({color:t.bank}),fittings.length);
      fittings.forEach((m,i)=>details.setMatrixAt(i,m));
      details.instanceMatrix.needsUpdate=true; details.castShadow=true; details.receiveShadow=true;
      group.add(details);
    }
    this.groups.roads=group; this.scene.add(group);
  }

  buildLandmarks() {
    const group = new THREE.Group();
    this.labelAnchors = [];
    for (const lm of this.landmarks) {
      const x = this.lonToX(lm.lon), y = this.latToY(lm.lat);
      const gy = this.groundAt(x, y, lm.foot) * EXAG + (lm.lift ?? 0);
      const obj = buildLandmark(lm, this.themeName);
      if (!obj) continue;
      const [sh, sv] = lm.s ?? [1.7, 2.6];
      obj.scale.set(sh, sv, sh);
      obj.position.set(x, gy, -y);
      obj.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
      group.add(obj);
      this.labelAnchors.push({ lm, pos: new THREE.Vector3(x, gy + (obj.userData.top ?? 200) * sv + (this.cityId==='chapelhill'?20:90), -y) });
    }
    this.groups.landmarks = group;
    this.scene.add(group);
  }

  // 봉우리째 덮는 모형(오름·바위)은 봉우리가 아니라 산기슭 높이에 앉힌다
  groundAt(x, y, foot) {
    if (!foot) return this.terrain.at(x, y);
    let lo = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      lo = Math.min(lo, this.terrain.at(x + Math.cos(a) * foot, y + Math.sin(a) * foot));
    }
    return lo;
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

  focusLandmark(lm, bearing = -.5) {
    const object = this.groups.landmarks.children.find(o => o.userData.id === lm.id);
    if (!object) return;
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const target = bounds.getCenter(new THREE.Vector3());
    const [preferredDistance, pitch] = lm.cam ?? [1900, .42];
    // Fit the whole model even on portrait displays; centre on its body, not its feet.
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const distance = Math.max(preferredDistance, size.length() * .56 / Math.sin(Math.min(verticalFov, horizontalFov) / 2));
    const pos = target.clone().add(new THREE.Vector3(
      Math.sin(bearing) * Math.cos(pitch), Math.sin(pitch), Math.cos(bearing) * Math.cos(pitch)
    ).multiplyScalar(distance));
    this.animateCamera(target, pos, 1800);
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
      this.controls.update();
      this.beforeFrame?.(now);
      const fast = this.interacting || this.sensorMoving || now < this.interactionUntil;
      if (fast !== this.fastRender) {
        this.fastRender = fast;
        this.renderer.setPixelRatio(fast ? Math.min(1, this.restPixelRatio) : this.restPixelRatio);
      }
      // 태양·그림자 카메라를 시야 중심에 붙여 그림자 해상도를 지킨다
      const c = this.controls.target;
      // Static miniatures only need a new shadow map when the light rig moves.
      if (!fast && this.shadowTarget.distanceToSquared(c) > 4) {
        this.shadowTarget.copy(c);
        this.sun.target.position.copy(c);
        this.sun.position.copy(c).add(new THREE.Vector3(...this.theme.sun.pos).multiplyScalar(this.sunDist));
        this.sun.target.updateMatrixWorld();
        this.renderer.shadowMap.needsUpdate = true;
      }
      const distance = this.camera.position.distanceTo(this.controls.target);
      // Trunks are subpixel at the overview scale; retain them for close viewing.
      this.groups.trees.trunks.visible = distance < 6500;
      this.life.update(now);
      // Skip the multisampled offscreen scene and blur passes while manipulating.
      if (fast) this.renderer.render(this.scene, this.camera);
      else this.focus.render(distance);
      this.onFrame?.();
    };
    requestAnimationFrame(loop);
  }
}
