// Bill of materials, cut list and stock plan.
//
// Cut list: members grouped by profile, length (to 1/32") and end work
// (tapping), marked A, B, C... longest first. The marks are what the 2D
// drawing's balloons use.
// Stock plan: first-fit decreasing into sticks, with a saw kerf per cut.

import { roundTo, CUT_STEP } from './units.js';

export const DEFAULT_KERF = 0.125;

export function markName(i) {
  let s = '';
  i += 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

export function cutList(design) {
  const groups = new Map();
  for (const m of design.members) {
    const len = roundTo(m.length, CUT_STEP);
    const ops = design.ops.filter((o) => o.member === m.id).map((o) => o.text).sort();
    const key = `${m.profile}|${len.toFixed(5)}|${ops.join(';')}`;
    if (!groups.has(key)) groups.set(key, { profile: m.profile, length: len, ops, qty: 0, members: [], roles: new Set() });
    const g = groups.get(key);
    g.qty += 1;
    g.members.push(m.id);
    g.roles.add(m.role);
  }
  const list = [...groups.values()].sort((a, b) => b.length - a.length || a.ops.length - b.ops.length);
  list.forEach((g, i) => { g.mark = markName(i); g.roles = [...g.roles]; });
  // Write the mark back onto each member for the drawing.
  for (const g of list) for (const id of g.members) design.members.find((m) => m.id === id).mark = g.mark;
  return list;
}

// cuts: [{ mark, length, qty, profile }] -> { sticks: [{ stockLength, cuts, used, offcut }] }
// Fills one stick at a time with the set of remaining pieces that uses the
// most of it (a subset-sum in 1/32" steps), which beats first-fit on the
// small cut lists carts have. n pieces on a stick take n - 1 saw kerfs.
export function planStock(cuts, stockLength = 120, kerf = DEFAULT_KERF) {
  const U = 32; // units per inch
  let left = [];
  for (const c of cuts) for (let i = 0; i < c.qty; i++) left.push({ mark: c.mark, length: c.length, profile: c.profile });
  left.sort((a, b) => b.length - a.length);
  const tooLong = left.filter((pc) => pc.length > stockLength + 1e-9);
  left = left.filter((pc) => pc.length <= stockLength + 1e-9);
  const cap = Math.round((stockLength + kerf) * U);
  const sticks = [];
  while (left.length) {
    const w = left.map((pc) => Math.round((pc.length + kerf) * U));
    // 0/1 subset sum: from[v] = last piece used to reach total v (-1 = start,
    // -2 = unreachable), prev[v] = the total before it. v runs downwards so
    // each piece is used at most once.
    const from = new Int32Array(cap + 1).fill(-2);
    const prev = new Int32Array(cap + 1).fill(-1);
    from[0] = -1;
    for (let i = 0; i < left.length; i++) {
      for (let v = cap; v >= w[i]; v--) {
        if (from[v] === -2 && from[v - w[i]] !== -2) { from[v] = i; prev[v] = v - w[i]; }
      }
    }
    let v = cap;
    while (v > 0 && from[v] === -2) v--;
    const take = new Set();
    for (let x = v; x > 0; x = prev[x]) take.add(from[x]);
    const pieces = left.filter((_, i) => take.has(i));
    left = left.filter((_, i) => !take.has(i));
    const used = pieces.reduce((a, pc) => a + pc.length, 0) + kerf * Math.max(0, pieces.length - 1);
    sticks.push({ profile: pieces[0].profile, stockLength, cuts: pieces, used, offcut: Math.max(0, stockLength - used) });
  }
  sticks.sort((a, b) => a.offcut - b.offcut);
  return { sticks, tooLong, kerf, stockLength };
}

export function hardwareList(design) {
  const cat = design.catalog;
  const groups = new Map();
  for (const h of design.hardware) {
    if (!groups.has(h.part)) {
      const part = cat.part(h.part);
      groups.set(h.part, { part: h.part, pn: part.pn, name: part.name, kind: part.kind, unitPrice: part.priceUsd ?? null, qty: 0, includes: part.includes || [], verified: part.verified !== false, url: part.url || (part.pn ? `https://www.mcmaster.com/${part.pn}/` : null) });
    }
    groups.get(h.part).qty += 1;
  }
  return [...groups.values()];
}

export function panelList(design) {
  const groups = new Map();
  for (const p of design.panels) {
    const key = `${p.size.join('x')}|${p.thickness}|${p.material}|${p.notches ? 'n' : ''}`;
    if (!groups.has(key)) groups.set(key, { size: p.size, thickness: p.thickness, material: p.material, notches: p.notches, qty: 0, names: [] });
    const g = groups.get(key);
    g.qty += 1;
    g.names.push(p.name);
  }
  return [...groups.values()];
}

// Everything to buy. `purchase`: 'stock' buys whole sticks and you cut them;
// 'cut' asks McMaster to cut each piece (when the catalog has a
// cut-to-length part for the profile).
export function bom(design, { purchase = 'stock', stockLength = 120, kerf = DEFAULT_KERF } = {}) {
  const cat = design.catalog;
  const cuts = cutList(design);
  const lines = [];
  const plans = {};
  for (const profileId of [...new Set(cuts.map((c) => c.profile))]) {
    const prof = cat.profile(profileId);
    const mine = cuts.filter((c) => c.profile === profileId);
    const ctl = prof.cutToLength;
    if (purchase === 'cut' && ctl) {
      for (const c of mine) {
        lines.push({ kind: 'rail', pn: ctl.pn, name: `${prof.name}, cut to ${c.length}"`, qty: c.qty, unitPrice: ctl.priceFor ? null : null, note: `Cut list ${c.mark}${c.ops.length ? `; ${c.ops.join('; ')}` : ''}`, verified: ctl.verified !== false, mark: c.mark });
      }
    } else {
      const stock = prof.stock.find((s) => s.lengthIn === stockLength) || prof.stock[prof.stock.length - 1];
      const plan = planStock(mine, stock.lengthIn, kerf);
      plans[profileId] = plan;
      lines.push({ kind: 'rail', pn: stock.pn, name: `${prof.name}, ${stock.lengthIn / 12} ft`, qty: plan.sticks.length, unitPrice: stock.priceUsd ?? null, note: `Cut into ${mine.map((c) => `${c.qty} x ${c.mark}`).join(', ')}`, verified: stock.verified !== false, url: prof.url });
    }
  }
  for (const h of hardwareList(design)) {
    lines.push({ kind: h.kind, pn: h.pn, name: h.name, qty: h.qty, unitPrice: h.unitPrice, note: h.includes.map((i) => `includes ${i.qty} ${i.name} each`).join('; '), verified: h.verified, url: h.url });
  }
  for (const l of lines) l.total = l.unitPrice == null ? null : Math.round(l.unitPrice * l.qty * 100) / 100;
  const known = lines.filter((l) => l.total != null);
  const total = Math.round(known.reduce((a, l) => a + l.total, 0) * 100) / 100;
  const missingPrices = lines.filter((l) => l.total == null || !l.pn).length;
  return { lines, cuts, plans, panels: panelList(design), total, missingPrices, purchase };
}
