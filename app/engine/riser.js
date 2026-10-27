// Risers: vertical rails standing on a top rail, e.g. to carry a monitor,
// a light bar, a tool board or a fixture plate. Each riser's foot butts onto
// the rail's top face (corner bracket at the foot), and can be held by 45°
// diagonal braces (McMaster's ready-made braces, fasteners included) on
// either side, in the plane of the rail. The top deck is notched where the
// riser, its brackets and its braces land on the rail.
//
// Brace geometry (assumed until checked against McMaster's drawing; the
// catalog marks it unverified): a 1-1/2" square section at 45°, whose outer
// edge is the listed length L. Measured from the inside corner, it covers
// the band c0 <= u + v <= c1 with c1 = L / sqrt 2 and c0 = c1 - 1.5 sqrt 2,
// where u runs along the rail away from the riser and v up the riser. Its
// ends bolt into the slots of the riser's face (from c0 to c1 up) and of the
// rail's top face (from c0 to c1 along).

import { addMember, addButtJoint, autoBracket } from './frame.js';
import { rectOnFace, TOL } from './geom.js';

export const RISER_DEFAULT = { rail: 'back', at: null, height: 18, braces: 'both', brace: '47065T27' };
const SIDES = { both: ['start', 'end'], start: ['start'], end: ['end'], none: [] };
const RAIL_NAMES = { front: 'front', back: 'back', left: 'left', right: 'right' };

export function braceReach(part) {
  return part.lengthIn / Math.SQRT2; // c1
}

// Where each riser goes, before anything is built, so the top deck can be
// notched first. Returns { plans, issues }.
export function planRisers(catalog, risers, ring, { s, frameTop, bracketLeg }) {
  const plans = [], issues = [];
  (risers || []).forEach((r0, i) => {
    const r = { ...RISER_DEFAULT, ...r0 };
    const name = `Riser ${i + 1}`;
    const rail = ring[RAIL_NAMES[r.rail]];
    if (!rail) { issues.push({ level: 'error', code: 'riser-rail', msg: `${name}: no ${r.rail} rail.` }); return; }
    const a = rail.axis;
    const j = a === 0 ? 1 : 0;
    const lo = rail.box.min[a], hi = rail.box.max[a];
    const at = r.at == null || r.at === '' || !Number.isFinite(Number(r.at)) ? (lo + hi) / 2 : Number(r.at);
    const height = Number(r.height);
    const start = at - s / 2;
    let part = null;
    const sides = SIDES[r.braces] || [];
    if (sides.length) {
      try { part = catalog.part(r.brace); } catch { issues.push({ level: 'error', code: 'riser-brace', msg: `${name}: unknown brace ${r.brace}.` }); return; }
    }
    const reach = part ? braceReach(part) : 0;
    if (!(height > 0)) { issues.push({ level: 'error', code: 'riser-height', msg: `${name} needs a height above the frame.` }); return; }
    if (start < lo - TOL || start + s > hi + TOL) {
      issues.push({ level: 'error', code: 'riser-off-rail', msg: `${name} must stand on the ${r.rail} rail between the posts: its centre can be from ${(lo + s / 2).toFixed(2)}" to ${(hi - s / 2).toFixed(2)}" (it's at ${at.toFixed(2)}").` });
      return;
    }
    if (part && height < reach - TOL) {
      issues.push({ level: 'error', code: 'riser-short', msg: `${name} is ${height}" tall but a ${part.lengthIn}" brace reaches ${reach.toFixed(2)}" up it: make it taller or pick a shorter brace.` });
      return;
    }
    // Space the riser needs on the rail's top face, on each side.
    const need = (side) => Math.max(sides.includes(side) ? reach : 0, bracketLeg);
    const span = [start - need('start'), start + s + need('end')];
    const notch2d = { min: [0, 0], max: [0, 0] };
    notch2d.min[a] = Math.max(lo, span[0]); notch2d.max[a] = Math.min(hi, span[1]);
    notch2d.min[j] = rail.box.min[j]; notch2d.max[j] = rail.box.max[j];
    plans.push({ i, name, r, rail, a, j, start, height, sides, part, reach, notch2d, frameTop });
  });
  // Risers on the same rail must not share rail space.
  for (let x = 0; x < plans.length; x++) for (let y = x + 1; y < plans.length; y++) {
    const p = plans[x], q = plans[y];
    if (p.rail !== q.rail) continue;
    if (Math.min(p.notch2d.max[p.a], q.notch2d.max[p.a]) - Math.max(p.notch2d.min[p.a], q.notch2d.min[p.a]) > TOL) {
      issues.push({ level: 'warn', code: 'risers-close', msg: `${p.name} and ${q.name} are close together on the ${p.r.rail} rail: their braces or brackets may clash (see the checks).` });
    }
  }
  return { plans, issues };
}

export function addRisers(design, plans, { s, profile, bracketPart }) {
  for (const pl of plans) {
    const { rail, a, j, start, height, frameTop } = pl;
    const origin = [0, 0, frameTop];
    origin[a] = start;
    origin[j] = rail.box.min[j];
    const riser = addMember(design, { profile, axis: 2, origin, length: height, role: 'riser', level: 'riser', name: pl.name });
    const joint = addButtJoint(design, riser, 'start', rail);
    autoBracket(design, joint, { count: 1, partId: bracketPart });
    for (const side of pl.sides) addBrace(design, riser, rail, side, pl.part, s);
  }
}

// One diagonal brace between `riser` and `rail` on the given side.
export function braceGeometry(riser, rail, side, part, T = 1.5) {
  const a = rail.axis;
  const j = a === 0 ? 1 : 0;
  const dir = side === 'start' ? -1 : 1;
  const face = side === 'start' ? riser.box.min[a] : riser.box.max[a];
  const base = riser.box.min[2];
  const c1 = braceReach(part), c0 = Math.max(0, c1 - T * Math.SQRT2);
  const jc = (rail.box.min[j] + rail.box.max[j]) / 2;
  const w = part.width || T;
  // Stair-step boxes covering the band (a little generous, so the clash
  // check errs on the safe side).
  const steps = 10, solids = [];
  for (let k = 0; k < steps; k++) {
    const u0 = (c1 * k) / steps, u1 = (c1 * (k + 1)) / steps;
    const v0 = Math.max(0, c0 - u1), v1 = c1 - u0;
    const min = [0, 0, base + v0], max = [0, 0, base + v1];
    const p0 = face + dir * u0, p1 = face + dir * u1;
    min[a] = Math.min(p0, p1); max[a] = Math.max(p0, p1);
    min[j] = jc - w / 2; max[j] = jc + w / 2;
    solids.push({ min, max });
  }
  // Where its ends sit: on the riser's face and on the rail's top face.
  const onRiser = { min: [0, 0, base + c0], max: [0, 0, base + c1] };
  onRiser.min[a] = onRiser.max[a] = face;
  onRiser.min[j] = jc - w / 2; onRiser.max[j] = jc + w / 2;
  const onRail = { min: [0, 0, base], max: [0, 0, base] };
  const f0 = face + dir * c0, f1 = face + dir * c1;
  onRail.min[a] = Math.min(f0, f1); onRail.max[a] = Math.max(f0, f1);
  onRail.min[j] = jc - w / 2; onRail.max[j] = jc + w / 2;
  const dirU = [0, 0, 0]; dirU[a] = dir;
  const corner = [0, 0, base]; corner[a] = face; corner[j] = jc;
  return { solids, onRiser, onRail, band: { corner, dirU, c0, c1, width: w }, a };
}

export function braceFits(riser, rail, g) {
  if (!rectOnFace(g.onRiser, g.a, g.onRiser.min[g.a], riser.box)) return { ok: false, why: 'its top end runs past the top of the riser' };
  if (!rectOnFace(g.onRail, 2, g.onRail.min[2], rail.box)) return { ok: false, why: 'its foot runs past the end of the rail (into a post)' };
  return { ok: true };
}

function addBrace(design, riser, rail, side, part, s) {
  const g = braceGeometry(riser, rail, side, part, s);
  const fit = braceFits(riser, rail, g);
  const h = {
    id: `D${design.hardware.length + 1}${side[0]}${riser.id}`, kind: 'brace', part: part.id, pn: part.pn,
    members: [riser.id, rail.id], name: `${part.lengthIn}" brace, ${riser.name} ${side === 'start' ? (rail.axis === 0 ? 'left' : 'front') : (rail.axis === 0 ? 'right' : 'back')} side`,
    solids: g.solids, band: g.band, geometry: g, fit,
  };
  design.hardware.push(h);
  return h;
}

// Rectangle minus holes (all axis-aligned, 2D) -> rectangles. Grid split on
// every edge, keep the cells outside the holes, then merge each row's runs.
export function subtractRects(rect, holes) {
  const xs = [...new Set([rect.min[0], rect.max[0], ...holes.flatMap((h) => [h.min[0], h.max[0]])])].filter((x) => x >= rect.min[0] && x <= rect.max[0]).sort((p, q) => p - q);
  const ys = [...new Set([rect.min[1], rect.max[1], ...holes.flatMap((h) => [h.min[1], h.max[1]])])].filter((y) => y >= rect.min[1] && y <= rect.max[1]).sort((p, q) => p - q);
  const inHole = (x, y) => holes.some((h) => x > h.min[0] && x < h.max[0] && y > h.min[1] && y < h.max[1]);
  const out = [];
  for (let yi = 0; yi < ys.length - 1; yi++) {
    let run = null;
    for (let xi = 0; xi < xs.length - 1; xi++) {
      const cx = (xs[xi] + xs[xi + 1]) / 2, cy = (ys[yi] + ys[yi + 1]) / 2;
      if (inHole(cx, cy)) { if (run) { out.push(run); run = null; } continue; }
      if (run) run.max[0] = xs[xi + 1];
      else run = { min: [xs[xi], ys[yi]], max: [xs[xi + 1], ys[yi + 1]] };
    }
    if (run) out.push(run);
  }
  // Merge identical runs in neighbouring rows.
  const merged = [];
  for (const r of out) {
    const m = merged.find((q) => q.min[0] === r.min[0] && q.max[0] === r.max[0] && q.max[1] === r.min[1]);
    if (m) m.max[1] = r.max[1]; else merged.push({ min: [...r.min], max: [...r.max] });
  }
  return merged;
}
