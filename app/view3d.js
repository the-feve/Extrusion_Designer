// 3D view (three.js). Model space is the engine's: inches, z up. Rails are
// our drawn 1-1/2" section extruded, brackets our drawn L profile
// (shapes.js); casters and decks are simple shapes.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { railSection1515, bracketProfile } from './shapes.js';
import { explodeOffsets } from './engine/explode.js';

const COLORS = { rail: 0xc9ced4, bracket: 0x9aa4ae, caster: 0x3a3d42, wheel: 0x1f2124, deck: 0xc9a56b, bad: 0xf08a6e, pick: 0xe0a93b };

export class View3D {
  constructor(el) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 2000);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a241c, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-40, -60, 90);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffe6c0, 0.6);
    fill.position.set(60, 40, 30);
    this.scene.add(fill);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.mats = {
      rail: new THREE.MeshStandardMaterial({ color: COLORS.rail, metalness: 0.55, roughness: 0.38 }),
      bracket: new THREE.MeshStandardMaterial({ color: COLORS.bracket, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }),
      caster: new THREE.MeshStandardMaterial({ color: COLORS.caster, metalness: 0.4, roughness: 0.5 }),
      wheel: new THREE.MeshStandardMaterial({ color: COLORS.wheel, roughness: 0.8 }),
      deck: new THREE.MeshStandardMaterial({ color: COLORS.deck, roughness: 0.85, transparent: true, opacity: 0.92 }),
      bad: new THREE.MeshStandardMaterial({ color: COLORS.bad, emissive: 0x5a1a0a, roughness: 0.5 }),
    };
    this.railGeom = railGeometry(railSection1515());
    this.bracketGeom = bracketGeometry(1.31);
    this.byOwner = new Map();
    this.showDecks = true;
    this.explode = 0; // 0 = assembled, 1 = fully exploded
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const tick = () => { this.controls.update(); this.renderer.render(this.scene, this.camera); requestAnimationFrame(tick); };
    tick();
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    for (const o of [...this.group.children]) { this.group.remove(o); o.traverse?.((c) => { if (c.geometry && c.geometry !== this.railGeom && c.geometry !== this.bracketGeom) c.geometry.dispose(); }); }
    this.byOwner.clear();
  }

  own(id, obj) {
    if (!this.byOwner.has(id)) this.byOwner.set(id, []);
    this.byOwner.get(id).push(obj);
    this.group.add(obj);
  }

  show(design, { fit = false } = {}) {
    this.clear();
    for (const m of design.members) {
      const mesh = new THREE.Mesh(this.railGeom, this.mats.rail);
      const c = m.box.min.map((v, i) => (v + m.box.max[i]) / 2);
      mesh.position.set(...c);
      if (m.axis === 0) mesh.rotation.y = Math.PI / 2;
      if (m.axis === 1) mesh.rotation.x = -Math.PI / 2;
      mesh.scale.z = m.length;
      mesh.userData.mat = 'rail';
      this.own(m.id, mesh);
    }
    for (const h of design.hardware) {
      if (h.kind === 'corner-bracket') this.own(h.id, this.bracket(h));
      else if (h.kind === 'caster') this.own(h.id, this.caster(h, design));
    }
    for (const p of design.panels) {
      const g = new THREE.Group();
      for (const b of p.boxes) {
        const s = b.max.map((v, i) => v - b.min[i]);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...s), this.mats.deck);
        mesh.position.set(...b.min.map((v, i) => v + s[i] / 2));
        mesh.userData.mat = 'deck';
        g.add(mesh);
      }
      g.visible = this.showDecks;
      g.userData.deck = true;
      this.own(p.id, g);
    }
    // Remember where each part sits assembled and which way it explodes.
    this.offsets = explodeOffsets(design);
    for (const [id, objs] of this.byOwner) {
      const dir = this.offsets.get(id) || [0, 0, 0];
      for (const o of objs) {
        o.userData.dir = new THREE.Vector3(...dir);
        if (o.matrixAutoUpdate) o.userData.base = o.position.clone();
        else o.userData.baseMatrix = o.matrix.clone();
      }
    }
    const span = new THREE.Box3().setFromObject(this.group).getSize(new THREE.Vector3());
    this.explodeTravel = Math.max(4, Math.min(12, Math.max(span.x, span.y) * 0.14));
    this.applyExplode();
    this.bounds = new THREE.Box3().setFromObject(this.group);
    if (fit || !this.fitted) { this.setView('iso'); this.fitted = true; }
  }

  setExplode(amount) {
    this.explode = amount;
    this.applyExplode();
  }

  applyExplode() {
    const e = this.explode * (this.explodeTravel || 6);
    for (const objs of this.byOwner.values()) {
      for (const o of objs) {
        const d = o.userData.dir;
        if (!d) continue;
        if (o.userData.base) o.position.copy(o.userData.base).addScaledVector(d, e);
        else if (o.userData.baseMatrix) {
          o.matrix.copy(o.userData.baseMatrix);
          const t = new THREE.Vector3().setFromMatrixPosition(o.matrix).addScaledVector(d, e);
          o.matrix.setPosition(t);
          o.matrixWorldNeedsUpdate = true;
        }
      }
    }
  }

  // Ease from the current amount to `to` over ~0.6 s.
  animateExplode(to) {
    const from = this.explode, t0 = performance.now(), dur = 600;
    cancelAnimationFrame(this.explodeRaf);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.setExplode(from + (to - from) * ease);
      if (k < 1) this.explodeRaf = requestAnimationFrame(step);
      else this.onExplode?.(to);
      this.refit();
    };
    this.explodeRaf = requestAnimationFrame(step);
  }

  // Keep the current viewing direction, but move in or out so everything fits.
  refit() {
    const box = new THREE.Box3().setFromObject(this.group);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const d = r / Math.sin((this.camera.fov * Math.PI) / 360) * 1.05;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(c);
    this.camera.position.copy(c).addScaledVector(dir, d);
    this.controls.update();
  }

  setDecksVisible(on) {
    this.showDecks = on;
    for (const o of this.group.children) if (o.userData.deck) o.visible = on;
  }

  highlight(ids = []) {
    const set = new Set(ids);
    for (const [id, objs] of this.byOwner) {
      for (const o of objs) o.traverse((c) => { if (c.isMesh) c.material = set.has(id) ? this.mats.bad : this.mats[c.userData.mat || 'rail']; });
    }
  }

  bracket(h) {
    const { corner, dirA, dirB } = h.geometry.frame;
    // Profile frame: inside corner at the origin, leg A along +x, leg B along
    // +y, outside faces at -t, width along z. World: corner + (x + t) dirA +
    // (y + t) dirB + z w, with w = dirA x dirB so the basis is right-handed.
    const A = new THREE.Vector3(...dirA), B = new THREE.Vector3(...dirB);
    const w = new THREE.Vector3().crossVectors(A, B);
    const t = 0.25;
    const origin = new THREE.Vector3(...corner).addScaledVector(A, t).addScaledVector(B, t);
    const m = new THREE.Matrix4().makeBasis(A, B, w).setPosition(origin);
    const mesh = new THREE.Mesh(this.bracketGeom, this.mats.bracket);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(m);
    mesh.userData.mat = 'bracket';
    return mesh;
  }

  caster(h, design) {
    const part = design.catalog.part(h.part);
    const b = h.solids[0];
    const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, top = b.max[2];
    const H = part.mountHeight, D = part.wheelDia || H * 0.7;
    const g = new THREE.Group();
    const add = (geom, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); m.rotation.x = rx; m.userData.mat = mat === this.mats.wheel ? 'wheel' : 'caster'; g.add(m); };
    const forkH = Math.max(0.3, H - D);
    add(new THREE.CylinderGeometry(0.9, 0.9, 0.35, 24), this.mats.caster, cx, cy, top - 0.18, Math.PI / 2);
    add(new THREE.BoxGeometry(1.4, 0.25, forkH + D / 2), this.mats.caster, cx, cy - 0.55, top - 0.35 - (forkH + D / 2) / 2 + 0.2);
    add(new THREE.BoxGeometry(1.4, 0.25, forkH + D / 2), this.mats.caster, cx, cy + 0.55, top - 0.35 - (forkH + D / 2) / 2 + 0.2);
    add(new THREE.CylinderGeometry(D / 2, D / 2, 0.9, 32), this.mats.wheel, cx, cy, D / 2, 0);
    return g;
  }

  setView(name) {
    const box = this.bounds && !this.bounds.isEmpty() ? this.bounds : new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(24, 36, 30));
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const d = r / Math.sin((this.camera.fov * Math.PI) / 360) * 1.05;
    const dirs = { iso: [-0.9, -1.3, 0.85], front: [0, -1, 0.001], side: [1, 0, 0.001], top: [0.0001, -0.0001, 1] };
    const v = new THREE.Vector3(...(dirs[name] || dirs.iso)).normalize().multiplyScalar(d);
    this.camera.position.copy(c).add(v);
    this.controls.target.copy(c);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
}

function railGeometry(sec) {
  const shape = new THREE.Shape(sec.outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of sec.holes || []) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -0.5);
  g.computeVertexNormals();
  return g;
}

function bracketGeometry(width) {
  const shape = new THREE.Shape(bracketProfile().map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -width / 2);
  g.computeVertexNormals();
  return g;
}
