// The frame model: members (rails), joints between them, and the hardware
// that holds them (brackets, casters) plus deck panels. Templates (cart.js,
// later others) build a design with these functions; validate.js checks it;
// bom.js and drawing.js read it. See docs/BUILD-MAP.md for the rules.

import { memberBox, clashes, rectOnFace, center, TOL, AXES } from './geom.js';

export function createDesign(catalog, meta = {}) {
  return { meta, catalog, members: [], joints: [], hardware: [], panels: [], ops: [], notes: [], issues: [] };
}

let seq = 0;
function nextId(prefix) {
  seq += 1;
  return `${prefix}${seq}`;
}
export function resetIds() {
  seq = 0;
}

// axis: 0 = x, 1 = y, 2 = z. origin is the box's min corner.
export function addMember(design, { profile, axis, origin, length, role, level, name }) {
  const prof = design.catalog.profile(profile);
  const section = [0, 0, 0];
  const others = [0, 1, 2].filter((i) => i !== axis);
  // Section width goes on the first other axis, height on the second.
  // (Only matters for rectangular profiles like 1.5 x 3.)
  section[others[0]] = prof.section[0];
  section[others[1]] = prof.section[1];
  const m = { id: nextId('M'), kind: 'rail', profile, axis, origin: [...origin], length, section, role, level, name };
  m.box = memberBox(m);
  design.members.push(m);
  return m;
}

export function memberById(design, id) {
  return design.members.find((m) => m.id === id);
}

// Coordinate of a member end along its axis.
export function endCoord(m, end) {
  return end === 'start' ? m.origin[m.axis] : m.origin[m.axis] + m.length;
}

// The end face as a flat box (zero thickness along the member's axis).
export function endRect(m, end) {
  const c = endCoord(m, end);
  const min = [...m.box.min];
  const max = [...m.box.max];
  min[m.axis] = c;
  max[m.axis] = c;
  return { min, max, axis: m.axis, at: c };
}

// Slots on a face of this series run down the middle of every 1.5" of face
// width: at 0.75, 2.25, ... from the face edge.
export function slotPositions(m, alongAxis, pitch = 1.5) {
  const lo = m.box.min[alongAxis];
  const w = m.box.max[alongAxis] - lo;
  const out = [];
  for (let off = pitch / 2; off < w; off += pitch) out.push(lo + off);
  return out;
}

// Does a point on the face of member m (face normal `faceAxis`) sit on a
// T-slot centreline? Slots run along the member's axis.
export function onSlot(m, point, faceAxis, tol = 0.01) {
  if (faceAxis === m.axis) return false; // an end face has only the centre hole
  const q = [0, 1, 2].find((i) => i !== faceAxis && i !== m.axis);
  return slotPositions(m, q).some((s) => Math.abs(s - point[q]) <= tol);
}

// A butt joint: `rail`'s end `end` bears on a side face of `onto`.
export function addButtJoint(design, rail, end, onto) {
  const rect = endRect(rail, end);
  const j = { id: nextId('J'), type: 'butt', rail: rail.id, end, onto: onto.id, fasteners: [] };
  j.contact = rectOnFace(rect, rail.axis, rect.at, onto.box) && sideOk(rail, end, onto);
  design.joints.push(j);
  return j;
}

// `onto` must be on the far side of the end, not overlapping the rail.
function sideOk(rail, end, onto) {
  const c = endCoord(rail, end);
  const a = rail.axis;
  return end === 'start' ? Math.abs(onto.box.max[a] - c) <= TOL : Math.abs(onto.box.min[a] - c) <= TOL;
}

// Every solid in the design, for clash checks.
export function solids(design) {
  const out = [];
  for (const m of design.members) out.push({ owner: m.id, kind: 'rail', box: m.box, name: m.name });
  for (const h of design.hardware) for (const b of h.solids) out.push({ owner: h.id, kind: h.kind, box: b, name: h.name });
  for (const p of design.panels) for (const b of p.boxes) out.push({ owner: p.id, kind: 'panel', box: b, name: p.name });
  return out;
}

export function firstClash(design, boxes, ignoreOwner) {
  for (const s of solids(design)) {
    if (s.owner === ignoreOwner) continue;
    for (const b of boxes) if (clashes(s.box, b)) return s;
  }
  return null;
}

// Where a corner bracket would sit on a butt joint, with its legs against
// the rail's face whose outward normal is (k, s) and against `onto`'s face.
//   leg A lies on the rail, running away from the joint (direction u);
//   leg B lies on `onto`, running away from the rail (direction n).
export function bracketGeometry(rail, end, onto, k, s, part) {
  const a = rail.axis;
  if (k === a) return null;
  const j = [0, 1, 2].find((i) => i !== a && i !== k);
  const u = end === 'start' ? 1 : -1;
  const c = endCoord(rail, end);
  const f = s > 0 ? rail.box.max[k] : rail.box.min[k];
  const jc = (rail.box.min[j] + rail.box.max[j]) / 2;
  const L = part.legLength, t = part.thickness, w = part.width, h = part.holeFromCorner;

  const mk = (aRange, kRange) => {
    const min = [0, 0, 0], max = [0, 0, 0];
    min[a] = Math.min(...aRange); max[a] = Math.max(...aRange);
    min[k] = Math.min(...kRange); max[k] = Math.max(...kRange);
    min[j] = jc - w / 2; max[j] = jc + w / 2;
    return { min, max };
  };
  const legA = mk([c, c + u * L], [f, f + s * t]);
  const legB = mk([c, c + u * t], [f, f + s * L]);
  const seatA = mk([c, c + u * L], [f, f]);
  const seatB = mk([c, c], [f, f + s * L]);
  const pt = (av, kv) => { const p = [0, 0, 0]; p[a] = av; p[k] = kv; p[j] = jc; return p; };
  const holeA = pt(c + u * h, f);
  const holeB = pt(c, f + s * h);
  // Frame for drawing the mesh: corner point, leg A direction, leg B direction.
  const dirA = [0, 0, 0]; dirA[a] = u;
  const dirB = [0, 0, 0]; dirB[k] = s;
  return {
    legs: [legA, legB],
    seatA, seatB,
    holes: [
      { point: holeA, member: rail.id, faceAxis: k },
      { point: holeB, member: onto.id, faceAxis: a },
    ],
    frame: { corner: pt(c, f), dirA, dirB, widthAxis: j },
    side: `${s > 0 ? '+' : '-'}${AXES[k]}`,
    k, s, c, f,
  };
}

// Is this bracket position buildable? Leg B must sit fully on `onto`'s face
// and both holes must land on a T-slot.
export function bracketFits(rail, onto, g) {
  if (!rectOnFace(g.seatA, g.k, g.f, rail.box)) return { ok: false, why: 'leg runs past the end of the rail' };
  if (!rectOnFace(g.seatB, rail.axis, g.c, onto.box)) return { ok: false, why: 'leg would hang off the mating rail' };
  if (!onSlot(rail, g.holes[0].point, g.holes[0].faceAxis)) return { ok: false, why: 'hole misses the T-slot on the rail' };
  if (!onSlot(onto, g.holes[1].point, g.holes[1].faceAxis)) return { ok: false, why: 'hole misses the T-slot on the mating rail' };
  return { ok: true };
}

// Candidate sides for a bracket on a rail end, best first. Brackets go under
// a horizontal rail where they can (they carry the shelf load in bearing),
// then over it, then on its sides.
export function bracketSides(rail) {
  const others = [0, 1, 2].filter((i) => i !== rail.axis);
  const sides = [];
  if (others.includes(2)) sides.push([2, -1], [2, 1]);
  for (const k of others) if (k !== 2) sides.push([k, -1], [k, 1]);
  return sides;
}

// Put `count` brackets on a joint, on the first sides that fit and don't
// clash with anything already placed. Records why each side was refused.
export function autoBracket(design, joint, { count = 1, partId, sides } = {}) {
  const rail = memberById(design, joint.rail);
  const onto = memberById(design, joint.onto);
  const part = partId ? design.catalog.part(partId) : design.catalog.bracketFor(rail.profile);
  const tried = [];
  for (const [k, s] of sides || bracketSides(rail)) {
    if (joint.fasteners.length >= count) break;
    const g = bracketGeometry(rail, joint.end, onto, k, s, part);
    if (!g) continue;
    const fit = bracketFits(rail, onto, g);
    if (!fit.ok) { tried.push(`${g.side}: ${fit.why}`); continue; }
    const hit = firstClash(design, g.legs);
    if (hit) { tried.push(`${g.side}: hits ${hit.name}`); continue; }
    const h = {
      id: nextId('B'), kind: 'corner-bracket', part: part.id, pn: part.pn, joint: joint.id,
      name: `Bracket ${rail.name} → ${onto.name}`, solids: g.legs, geometry: g, side: g.side,
    };
    design.hardware.push(h);
    joint.fasteners.push(h.id);
  }
  joint.tried = tried;
  return joint.fasteners.length;
}

// A stem caster screwed into the tapped end of a vertical member.
export function addStemCaster(design, post, end, partId) {
  const part = design.catalog.part(partId);
  if (post.axis !== 2) throw new Error('Stem casters go on vertical members');
  const c = endCoord(post, end);
  const [cx, cy] = center(post.box);
  const [fx, fy] = part.footprint;
  const dir = end === 'start' ? -1 : 1;
  const z0 = c, z1 = c + dir * part.mountHeight;
  const body = { min: [cx - fx / 2, cy - fy / 2, Math.min(z0, z1)], max: [cx + fx / 2, cy + fy / 2, Math.max(z0, z1)] };
  const h = { id: nextId('C'), kind: 'caster', part: part.id, pn: part.pn, member: post.id, end, name: `Caster under ${post.name}`, solids: [body] };
  design.hardware.push(h);
  design.ops.push({ member: post.id, end, op: 'tap', text: `Tap ${end === 'start' ? 'bottom' : 'top'} end ${part.thread || '5/16"-18'} for caster stem` });
  return h;
}

// A flat panel lying on top of a level, notched around anything passing
// through it. `boxes` are its solid pieces; `outline` is its 2D shape.
export function addPanel(design, { name, level, boxes, outline, size, thickness, material, notches }) {
  const p = { id: nextId('P'), kind: 'panel', name, level, boxes, outline, size, thickness, material, notches };
  design.panels.push(p);
  return p;
}
