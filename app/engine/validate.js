// Checks a design and returns issues: { level: 'error'|'warn'|'info', code, msg, ids }.
// Errors mean it can't be built as drawn. The rules are listed in
// docs/BUILD-MAP.md → "Checks".

import { solids, endRect, memberById, bracketFits, onSlot } from './frame.js';
import { clashes, overlaps, rectOnFace, TOL } from './geom.js';
import { fracIn } from './units.js';

export function validate(design, { maxStockIn = 120 } = {}) {
  const issues = [...design.issues];
  if (issues.some((i) => i.level === 'error') && !design.members.length) return summarize(issues);
  const add = (level, code, msg, ids = []) => issues.push({ level, code, msg, ids });

  // 1. Nothing may pass through anything else.
  const all = solids(design);
  for (let i = 0; i < all.length; i++) {
    for (let k = i + 1; k < all.length; k++) {
      const a = all[i], b = all[k];
      if (a.owner === b.owner) continue;
      if (clashes(a.box, b.box)) {
        const d = overlaps(a.box, b.box).map((v) => Math.max(0, v));
        add('error', 'clash', `${a.name} and ${b.name} overlap by ${d.map((v) => fracIn(v)).join(' x ')}.`, [a.owner, b.owner]);
      }
    }
  }

  // 2. Members: sane lengths.
  for (const m of design.members) {
    if (!(m.length > TOL)) add('error', 'length', `${m.name} has no length.`, [m.id]);
    else if (m.length > maxStockIn + TOL) add('error', 'too-long', `${m.name} is ${fracIn(m.length)}, longer than the ${maxStockIn / 12} ft stock.`, [m.id]);
  }

  // 3. Joints: the rail end must sit fully on the other member's face, with
  //    at least one fastener whose legs and holes line up.
  for (const j of design.joints) {
    const rail = memberById(design, j.rail), onto = memberById(design, j.onto);
    if (!j.contact) add('error', 'no-contact', `${rail.name} doesn't sit flat on ${onto.name}.`, [rail.id, onto.id]);
    if (!j.fasteners.length) {
      const why = j.tried && j.tried.length ? ` Tried: ${j.tried.join('; ')}.` : '';
      add('error', 'no-fastener', `No room for a bracket where ${rail.name} meets ${onto.name}.${why}`, [rail.id, onto.id]);
    }
    for (const hid of j.fasteners) {
      const h = design.hardware.find((x) => x.id === hid);
      const fit = bracketFits(rail, onto, h.geometry);
      if (!fit.ok) add('error', 'bracket-fit', `${h.name}: ${fit.why}.`, [h.id]);
    }
  }

  // 4. Every member end is accounted for: joined, carrying a caster or foot,
  //    or open (fine, but it wants an end cap). An end that merely touches
  //    something without a joint is flagged: it isn't fastened.
  for (const m of design.members) {
    for (const end of ['start', 'end']) {
      const joined = design.joints.some((j) => j.rail === m.id && j.end === end);
      const mounted = design.hardware.some((h) => h.member === m.id && h.end === end);
      if (joined && mounted) add('error', 'end-twice', `${m.name}'s ${end} end is both joined and carrying a ${design.hardware.find((h) => h.member === m.id && h.end === end).kind}.`, [m.id]);
      if (joined || mounted) continue;
      const r = endRect(m, end);
      const toucher = design.members.find((o) => o.id !== m.id && rectOnFace(r, m.axis, r.at, o.box));
      const covered = design.panels.find((pn) => pn.boxes.some((b) => rectOnFace(r, m.axis, r.at, b)));
      if (toucher) add('warn', 'unfastened', `${m.name} touches ${toucher.name} but isn't fastened to it.`, [m.id, toucher.id]);
      else if (covered) add('info', 'covered-end', `${m.name}'s ${end === 'start' ? lowEnd(m) : highEnd(m)} end is under the ${covered.name}.`, [m.id]);
      else add('info', 'open-end', `${m.name} has an open ${end === 'start' ? lowEnd(m) : highEnd(m)} end (add an end cap if you like).`, [m.id]);
    }
  }

  // 5. Bracket holes must land on T-slots (checked at placement; re-checked
  //    here so hand-edited designs are covered).
  for (const h of design.hardware) {
    if (h.kind !== 'corner-bracket') continue;
    for (const hole of h.geometry.holes) {
      const m = memberById(design, hole.member);
      if (!onSlot(m, hole.point, hole.faceAxis)) add('error', 'hole-off-slot', `${h.name}: a hole misses the T-slot on ${m.name}.`, [h.id]);
    }
  }

  // 6. One piece: every member connects to every other through joints.
  const groups = connectedGroups(design);
  if (groups.length > 1) {
    add('error', 'loose-parts', `The frame is in ${groups.length} separate pieces.`, groups.slice(1).flat());
  }

  return summarize(issues);
}

function lowEnd(m) {
  return m.axis === 2 ? 'bottom' : m.axis === 0 ? 'left' : 'front';
}
function highEnd(m) {
  return m.axis === 2 ? 'top' : m.axis === 0 ? 'right' : 'back';
}

export function connectedGroups(design) {
  const parent = new Map(design.members.map((m) => [m.id, m.id]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  for (const j of design.joints) if (j.contact && j.fasteners.length) parent.set(find(j.rail), find(j.onto));
  const groups = new Map();
  for (const m of design.members) {
    const r = find(m.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(m.id);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

function summarize(issues) {
  const count = (l) => issues.filter((i) => i.level === l).length;
  return { ok: count('error') === 0, errors: count('error'), warnings: count('warn'), infos: count('info'), issues };
}

