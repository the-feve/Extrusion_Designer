// Cart template. Coordinates: x across the width, y along the length, z up,
// origin at the floor under the front-left corner of the frame.
//
// Construction ("posts run through"): four posts run the full frame height.
// Every level is a ring of four rails that butt into the posts' faces:
// front/back rails (along x) are W - 2s long, side rails (along y) are
// L - 2s long, where s is the rail size. Each rail end gets a corner bracket,
// under the rail where the post continues below it, otherwise over it.
// Decks lie on top of a level's rails, notched around posts that pass
// through. Stem casters thread into the tapped bottom ends of the posts.

import { createDesign, addMember, addButtJoint, autoBracket, addStemCaster, addPanel, resetIds } from './frame.js';
import { parseLength } from './units.js';

export const CART_DEFAULTS = {
  width: 24,          // outside of frame, x
  length: 36,         // outside of frame, y
  height: 30,         // floor to top of frame (casters included)
  profile: '1515',
  caster: 'caster-placeholder', // null = frame stands on the post ends
  shelves: 0,         // intermediate shelves between bottom and top
  shelfHeights: null, // optional: floor to top of each shelf's rails, inches
  bottomLift: null,   // post below the bottom rails; null = one bracket leg, so its brackets go underneath
  decks: { top: true, shelves: true, bottom: true },
  deckThickness: 0.75,
  deckMaterial: '3/4" plywood',
  bracketsPerJoint: 1,
};

export function normalizeCartParams(input = {}) {
  const p = { ...CART_DEFAULTS, ...input, decks: { ...CART_DEFAULTS.decks, ...(input.decks || {}) } };
  for (const k of ['width', 'length', 'height', 'deckThickness']) p[k] = parseLength(p[k]);
  if (p.bottomLift !== null && p.bottomLift !== undefined && p.bottomLift !== '') p.bottomLift = parseLength(p.bottomLift);
  else p.bottomLift = null;
  p.shelves = Math.max(0, Math.min(8, Math.round(Number(p.shelves) || 0)));
  if (Array.isArray(p.shelfHeights)) p.shelfHeights = p.shelfHeights.map(parseLength).filter(Number.isFinite);
  else p.shelfHeights = null;
  if (p.shelfHeights && p.shelfHeights.length !== p.shelves) p.shelfHeights = null;
  return p;
}

// Rail-top heights (from the floor) for each intermediate shelf.
export function shelfTops(p, z0, s, bottomLift) {
  if (p.shelfHeights) return [...p.shelfHeights].sort((a, b) => a - b);
  const lo = z0 + bottomLift + s; // top of bottom rails
  const hi = p.height;           // top of top rails
  const out = [];
  // Even spacing, rounded to the nearest 1/2" so the heights are easy to mark.
  for (let i = 1; i <= p.shelves; i++) out.push(Math.round((lo + ((hi - lo) * i) / (p.shelves + 1)) * 2) / 2);
  return out;
}

export function buildCart(catalog, input = {}) {
  resetIds();
  const p = normalizeCartParams(input);
  const prof = catalog.profile(p.profile);
  const s = prof.section[0];
  const design = createDesign(catalog, { template: 'cart', params: p, title: `Cart ${p.width}" W x ${p.length}" L x ${p.height}" H` });
  const issues = design.issues;

  const caster = p.caster ? catalog.part(p.caster) : null;
  const z0 = caster ? caster.mountHeight : 0;
  const frameH = p.height - z0;
  const bracket = catalog.bracketFor(p.profile);
  const lift = p.bottomLift ?? bracket.legLength;
  design.meta.z0 = z0;
  design.meta.frameHeight = frameH;
  design.meta.bottomLift = lift;

  // Sizes that can't be built at all stop here with a clear message.
  const minW = 2 * s + 2 * bracket.legLength; // room for a bracket at each end of a cross rail
  if (!(p.width >= minW)) issues.push({ level: 'error', code: 'too-narrow', msg: `Width must be at least ${minW}" (two posts plus a bracket at each end of the rails).` });
  if (!(p.length >= minW)) issues.push({ level: 'error', code: 'too-short', msg: `Length must be at least ${minW}".` });
  if (!(frameH >= lift + 2 * s + 2 * bracket.legLength)) issues.push({ level: 'error', code: 'too-low', msg: `Height must be at least ${(z0 + lift + 2 * s + 2 * bracket.legLength).toFixed(2)}" with this caster.` });
  if (issues.some((i) => i.level === 'error')) return design;

  const W = p.width, L = p.length;

  // Posts
  const corners = [
    ['FL', 0, 0], ['FR', W - s, 0], ['BL', 0, L - s], ['BR', W - s, L - s],
  ];
  const posts = {};
  for (const [key, x, y] of corners) {
    posts[key] = addMember(design, { profile: p.profile, axis: 2, origin: [x, y, z0], length: frameH, role: 'post', level: null, name: `Post ${key}` });
  }

  // Levels, bottom to top. railBottom is the z of the rails' underside.
  const levels = [{ key: 'bottom', name: 'Bottom', railBottom: z0 + lift }];
  shelfTops(p, z0, s, lift).forEach((top, i) => levels.push({ key: `shelf${i + 1}`, name: `Shelf ${i + 1}`, railBottom: top - s }));
  levels.push({ key: 'top', name: 'Top', railBottom: p.height - s });
  design.levels = levels.map((l) => ({ ...l, railTop: l.railBottom + s }));

  // Shelf spacing: the level above hangs its brackets under its rails, so
  // it needs one bracket leg of clear space above the deck below it.
  const deckOn = (l) => (l.key === 'top' ? p.decks.top : l.key === 'bottom' ? p.decks.bottom : p.decks.shelves);
  for (let i = 1; i < levels.length; i++) {
    const below = levels[i - 1], here = levels[i];
    const need = s + (deckOn(below) ? p.deckThickness : 0) + bracket.legLength;
    const have = here.railBottom - below.railBottom;
    if (have < need - 1e-9) {
      issues.push({ level: 'error', code: 'levels-too-close', msg: `${here.name} is ${have.toFixed(2)}" above ${below.name}; it needs at least ${need.toFixed(2)}" (rail ${s}" + ${deckOn(below) ? `deck ${p.deckThickness}" + ` : ''}bracket ${bracket.legLength}").` });
    }
  }
  for (const l of levels) {
    if (l.railBottom < z0 - 1e-9 || l.railBottom + s > p.height + 1e-9) {
      issues.push({ level: 'error', code: 'level-outside', msg: `${l.name} is outside the posts (${z0}" to ${p.height}").` });
    }
  }
  if (issues.some((i) => i.code === 'level-outside')) return design;

  const rails = [];
  for (const l of levels) {
    const z = l.railBottom;
    const ring = {
      front: addMember(design, { profile: p.profile, axis: 0, origin: [s, 0, z], length: W - 2 * s, role: 'rail-x', level: l.key, name: `${l.name} front rail` }),
      back: addMember(design, { profile: p.profile, axis: 0, origin: [s, L - s, z], length: W - 2 * s, role: 'rail-x', level: l.key, name: `${l.name} back rail` }),
      left: addMember(design, { profile: p.profile, axis: 1, origin: [0, s, z], length: L - 2 * s, role: 'rail-y', level: l.key, name: `${l.name} left rail` }),
      right: addMember(design, { profile: p.profile, axis: 1, origin: [W - s, s, z], length: L - 2 * s, role: 'rail-y', level: l.key, name: `${l.name} right rail` }),
    };
    rails.push({ level: l, ring });
  }

  // Decks go in before brackets so a bracket never lands where a deck is.
  const t = p.deckThickness;
  for (const { level } of rails) {
    const want = level.key === 'top' ? p.decks.top : level.key === 'bottom' ? p.decks.bottom : p.decks.shelves;
    if (!want) continue;
    const z = level.railBottom + s;
    // Posts pass through every deck except where they end flush with it.
    const notched = z + 1e-9 < p.height;
    const boxes = notched
      ? [
          { min: [s, 0, z], max: [W - s, L, z + t] },
          { min: [0, s, z], max: [s, L - s, z + t] },
          { min: [W - s, s, z], max: [W, L - s, z + t] },
        ]
      : [{ min: [0, 0, z], max: [W, L, z + t] }];
    const outline = notched
      ? [[s, 0], [W - s, 0], [W - s, s], [W, s], [W, L - s], [W - s, L - s], [W - s, L], [s, L], [s, L - s], [0, L - s], [0, s], [s, s]]
      : [[0, 0], [W, 0], [W, L], [0, L]];
    addPanel(design, {
      name: `${level.name} deck`, level: level.key, boxes, outline, size: [W, L], thickness: t, material: p.deckMaterial,
      notches: notched ? { count: 4, size: [s, s] } : null,
    });
    if (level.key === 'top' && z + t > p.height + 1e-9) {
      design.notes.push(`The top deck adds ${t}" above the frame: overall height to the deck is ${(p.height + t).toFixed(3)}".`);
    }
  }

  // Joints: every rail end butts into the post beside it.
  for (const { ring } of rails) {
    const pairs = [
      [ring.front, 'start', posts.FL], [ring.front, 'end', posts.FR],
      [ring.back, 'start', posts.BL], [ring.back, 'end', posts.BR],
      [ring.left, 'start', posts.FL], [ring.left, 'end', posts.BL],
      [ring.right, 'start', posts.FR], [ring.right, 'end', posts.BR],
    ];
    for (const [rail, end, post] of pairs) {
      const j = addButtJoint(design, rail, end, post);
      autoBracket(design, j, { count: p.bracketsPerJoint, partId: bracket.id });
    }
  }

  if (caster) for (const key of ['FL', 'FR', 'BL', 'BR']) addStemCaster(design, posts[key], 'start', caster.id);

  return design;
}
