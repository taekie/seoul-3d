import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const HEIGHT_EXAGGERATION = 2.5;

// One family of painted, non-metallic materials throughout the miniature.
export const clay = (options = {}) => new THREE.MeshStandardMaterial({
  roughness: 0.88, metalness: 0, ...options,
});

// A small separable tilt-shift blur. The centre stays sharp; close inspection
// fades it out. It only processes the WebGL scene, never labels or controls.
export function miniatureFocus(renderer, scene, camera) {
  const shader = {
    uniforms: {
      tDiffuse: { value: null }, direction: { value: new THREE.Vector2() },
      strength: { value: 1 },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 direction;
      uniform float strength; varying vec2 vUv;
      void main() {
        float blur = smoothstep(0.20, 0.50, abs(vUv.y - 0.48)) * strength;
        vec2 d = direction * blur;
        vec4 c = texture2D(tDiffuse, vUv) * 0.227027;
        c += texture2D(tDiffuse, vUv + d * 1.384615) * 0.316216;
        c += texture2D(tDiffuse, vUv - d * 1.384615) * 0.316216;
        c += texture2D(tDiffuse, vUv + d * 3.230769) * 0.070270;
        c += texture2D(tDiffuse, vUv - d * 3.230769) * 0.070270;
        gl_FragColor = c;
      }`,
  };
  const composer = new EffectComposer(renderer);
  // Retain geometry edge smoothing when the scene is rendered offscreen.
  composer.renderTarget1.samples = composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(scene, camera));
  const horizontal = new ShaderPass(shader), vertical = new ShaderPass(shader);
  composer.addPass(horizontal); composer.addPass(vertical);
  composer.addPass(new OutputPass());
  return {
    composer,
    resize(w, h) {
      composer.setSize(w, h);
      horizontal.uniforms.direction.value.set(1.05 / w, 0);
      vertical.uniforms.direction.value.set(0, 1.05 / h);
    },
    render(distance) {
      const strength = THREE.MathUtils.smoothstep(distance, 1400, 8000);
      horizontal.uniforms.strength.value = vertical.uniforms.strength.value = strength;
      composer.render();
    },
  };
}

// Lookup uses the existing union mask, so vector-tile borders are not shorelines.
export function waterAt(city, x, y) {
  const t = city.terrain, m = t.mask;
  const i = Math.round((x - t.minX) * m.sx), j = Math.round((t.maxY - y) * m.sy);
  if (i < 0 || j < 0 || i >= m.W || j >= m.H) return null;
  const value = m.data[j * m.W + i];
  return value ? (value - 1) * 3 * HEIGHT_EXAGGERATION + (city.data.meta.sea && value === 1 ? 2 : 3) : null;
}

export function buildBanks(city) {
  const positions = [], t = city.terrain;
  const sample = Math.max(24, 1.8 / t.mask.sx);
  const width = city.data.meta.sea ? 10 : 13;
  const rings = [...city.data.water, ...(city.data.oceans ?? [])];
  for (const poly of rings) for (const ring of poly) {
    for (let i = 0; i < ring.length; i += 2) {
      const j = (i + 2) % ring.length;
      const ax = ring[i], ay = ring[i + 1], bx = ring[j], by = ring[j + 1];
      const length = Math.hypot(bx - ax, by - ay);
      if (length < 2) continue;
      const nx = -(by - ay) / length, ny = (bx - ax) / length;
      const steps = Math.ceil(length / 65);
      for (let s = 0; s < steps; s++) {
        const f = (s + .5) / steps, x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
        const left = waterAt(city, x + nx * sample, y + ny * sample);
        const right = waterAt(city, x - nx * sample, y - ny * sample);
        if ((left === null) === (right === null)) continue;
        const level = left ?? right, side = left === null ? 1 : -1;
        // Missing ocean coverage can look like land in the mask. Require real
        // raised ground behind the bank, rather than outlining an offshore seam.
        if (t.at(x + nx * sample * side, y + ny * sample * side) < Math.max(2, (level - 3) / HEIGHT_EXAGGERATION + 1)) continue;
        // Short ribbons, tucked just above the water, suggest a modelled bank.
        const x1 = ax + (bx - ax) * s / steps, y1 = ay + (by - ay) * s / steps;
        const x2 = ax + (bx - ax) * (s + 1) / steps, y2 = ay + (by - ay) * (s + 1) / steps;
        const ox = nx * width * side, oy = ny * width * side;
        const h = level + 3;
        positions.push(x1,h,-y1, x2,h,-y2, x2+ox,h+4,-(y2+oy),
          x1,h,-y1, x2+ox,h+4,-(y2+oy), x1+ox,h+4,-(y1+oy));
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, clay({ color: city.theme.bank, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  return mesh;
}
