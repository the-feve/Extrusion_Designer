// 2D assembly drawing as an SVG string: third-angle front, right side and
// top views of the frame, overall and shelf-height dimensions, balloons
// keyed to the cut list (letters) and parts list (numbers), the tables, and
// a title block. One ANSI B sheet (17 x 11 in), drawn in paper hundredths.

import { fracIn, ftIn } from './units.js';
import { solids } from './frame.js';
import { bom as makeBom } from './bom.js';

const SHEET = { w: 1700, h: 1100, margin: 40 };
const SCALES = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 48];

const STYLE = {
  rail: { fill: '#dde1e6', stroke: '#22262b' },
  'corner-bracket': { fill: '#9aa4ae', stroke: '#22262b' },
  caster: { fill: '#5b6168', stroke: '#22262b' },
  panel: { fill: '#ecd9b0', stroke: '#6b5530' },
  brace: { fill: '#c3cad1', stroke: '#22262b' },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// View definitions: horizontal axis, vertical axis, depth axis and which way
// is towards the viewer (+1: larger values are nearer).
const VIEWS = {
  front: { h: 0, v: 2, d: 1, near: -1, hFlip: false, label: 'FRONT' },
  right: { h: 1, v: 2, d: 0, near: 1, hFlip: false, label: 'RIGHT SIDE' },
  top: { h: 0, v: 1, d: 2, near: 1, hFlip: false, label: 'TOP (decks shown as outlines)' },
};

export function drawingSvg(design, opts = {}) {
  const b = opts.bom || makeBom(design, opts.bomOptions);
  const all = solids(design);
  if (!all.length) return emptySheet(design);
  const ext = extent(all.map((s) => s.box));
  // Dimensions measure the frame and decks, not caster footprints.
  const fr = extent(all.filter((s) => s.kind === 'rail' || s.kind === 'panel').map((s) => s.box));
  const W = fr.max[0] - fr.min[0], L = fr.max[1] - fr.min[1], H = fr.max[2] - fr.min[2];
  const EW = ext.max[0] - ext.min[0], EL = ext.max[1] - ext.min[1], EH = ext.max[2] - ext.min[2];

  // Drawing area: left 64% of the sheet; tables on the right.
  const area = { x: SHEET.margin, y: SHEET.margin + 50, w: 1700 * 0.64 - 90, h: 1100 - 2 * SHEET.margin - 130 };
  const gap = 130; // paper hundredths between views (room for dimensions)
  const nLevels = (design.levels || []).length + new Set(design.members.filter((m) => m.role === 'riser').map((m) => m.box.max[2])).size;
  const sideRoom = 45 + nLevels * 40 + 60; // shelf dims + balloon column right of the side view
  const fits = (k) => 110 + (EW + EL) / k * 100 + gap + sideRoom <= area.w && (EH + EL) / k * 100 + gap + 75 <= area.h; // + room for the view labels
  const scale = SCALES.find(fits) || SCALES[SCALES.length - 1];
  const k = 100 / scale; // paper units per model inch

  // Third angle: top above front, right side to the right of front.
  const frontOrigin = { x: area.x + 110, y: area.y + EL * k + gap + EH * k }; // paper point of model (min x, min z)
  const rightOrigin = { x: frontOrigin.x + EW * k + gap, y: frontOrigin.y };
  const topOrigin = { x: frontOrigin.x, y: area.y + EL * k };

  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET.w} ${SHEET.h}" width="17in" height="11in" font-family="Arial, Helvetica, sans-serif" class="ed-drawing">`);
  out.push(`<rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}" fill="#fff"/>`);
  out.push(`<rect x="${SHEET.margin / 2}" y="${SHEET.margin / 2}" width="${SHEET.w - SHEET.margin}" height="${SHEET.h - SHEET.margin}" fill="none" stroke="#111" stroke-width="2"/>`);

  const view = (name, origin) => {
    const v = VIEWS[name];
    const P = (p) => ({ x: origin.x + (p[v.h] - ext.min[v.h]) * k, y: origin.y - (p[v.v] - ext.min[v.v]) * k });
    const items = all
      .map((s) => ({ ...s, depth: v.near > 0 ? s.box.max[v.d] : -s.box.min[v.d] }))
      .sort((a, c) => a.depth - c.depth);
    out.push(`<g class="view view-${name}">`);
    const braceDone = new Set();
    for (const s of items) {
      const st = STYLE[s.kind] || STYLE.rail;
      if (s.kind === 'brace') {
        if (braceDone.has(s.owner)) continue;
        braceDone.add(s.owner);
        const h = design.hardware.find((x) => x.id === s.owner);
        const pts = hull(braceCorners(h).map(P));
        out.push(`<polygon points="${pts.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}" fill="${STYLE.brace.fill}" stroke="${STYLE.brace.stroke}" stroke-width="1.2"/>`);
        continue;
      }
      const a = P(s.box.min), c = P(s.box.max);
      const x = Math.min(a.x, c.x), y = Math.min(a.y, c.y), w = Math.abs(c.x - a.x), h = Math.abs(c.y - a.y);
      const outline = name === 'top' && s.kind === 'panel';
      out.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${outline ? 'none' : st.fill}" stroke="${st.stroke}" stroke-width="${outline ? 1 : 1.2}"${outline ? ' stroke-dasharray="8 5"' : ''}/>`);
    }
    out.push('</g>');
    const lo = P(ext.min);
    out.push(text(lo.x + ((ext.max[v.h] - ext.min[v.h]) * k) / 2, origin.y + 115, v.label, 18, 'middle', 'bold'));
    return P;
  };

  const Pf = view('front', frontOrigin);
  const Pr = view('right', rightOrigin);
  const Pt = view('top', topOrigin);

  // Dimensions (frame extents)
  const f0 = Pf(fr.min), f1 = Pf(fr.max);
  const floorY = Pf([0, 0, 0]).y;
  out.push(dimH(f0.x, f1.x, floorY + 45, fmt(W)));
  out.push(dimV(f0.x - 45, floorY, f1.y, fmt(H), { ext: f0.x - 6 }));
  const r0 = Pr(fr.min), r1 = Pr(fr.max);
  out.push(dimH(r0.x, r1.x, floorY + 45, fmt(L)));
  const t0 = Pt(fr.min), t1 = Pt(fr.max);
  out.push(dimV(t0.x - 45, t0.y, t1.y, fmt(L), { ext: t0.x - 6 }));
  out.push(dimH(t0.x, t1.x, t1.y - 30, fmt(W)));

  // Shelf heights: floor to the top of each level's rails, one column each
  // on the right of the side view.
  // Riser tops get a height column too.
  const riserTops = [...new Set(design.members.filter((m) => m.role === 'riser').map((m) => m.box.max[2]))].map((top) => ({ railTop: top }));
  const levels = [...(design.levels || []), ...riserTops];
  const rightX = Pr(ext.max).x;
  levels.forEach((l, i) => {
    const y = Pr([0, 0, l.railTop]).y;
    out.push(dimV(rightX + 45 + i * 40, floorY, y, fmt(l.railTop), { ext: r1.x + 6 }));
  });
  if (design.meta.z0) {
    const y = Pf([0, 0, design.meta.z0]).y;
    out.push(dimV(Pf(ext.max).x + 40, floorY, y, fmt(design.meta.z0), { ext: f1.x + 6, small: true }));
  }

  // Balloons: one per cut mark, on a member that faces the viewer.
  const done = new Set();
  const balloons = [];
  for (const m of design.members) {
    if (!m.mark || done.has(m.mark)) continue;
    const name = m.axis === 1 ? 'right' : 'front';
    const P = name === 'right' ? Pr : Pf;
    const v = VIEWS[name];
    // Choose the instance nearest the viewer so the leader lands on it.
    const same = design.members.filter((o) => o.mark === m.mark);
    const pick = same.sort((a, c) => (v.near > 0 ? c.box.max[v.d] - a.box.max[v.d] : a.box.min[v.d] - c.box.min[v.d]))[0];
    const mid = [0, 1, 2].map((i) => (pick.box.min[i] + pick.box.max[i]) / 2);
    if (pick.axis === 2) mid[2] = pick.box.min[2] + pick.length * 0.62;
    const p = P(mid);
    balloons.push({ p, label: m.mark, view: name });
    done.add(m.mark);
  }
  const hwItems = b.lines.filter((l) => l.kind !== 'rail');
  hwItems.forEach((l, i) => {
    const h = design.hardware.find((x) => x.pn === l.pn || x.part === l.pn || (l.pn == null && design.catalog.part(x.part).pn == null && x.kind === l.kind));
    if (!h) return;
    const c = [0, 1, 2].map((ax) => (h.solids[0].min[ax] + h.solids[0].max[ax]) / 2);
    balloons.push({ p: Pf(c), label: String(i + 1), view: 'front' });
  });
  // Balloons sit in a column beside their view, sorted by height and spaced
  // so they never overlap; leaders run to the part.
  const columns = { front: f0.x - 100, right: rightX + 45 + levels.length * 40 + 30 };
  for (const name of ['front', 'right']) {
    const mine = balloons.filter((bl) => bl.view === name).sort((a, c) => a.p.y - c.p.y);
    let last = -Infinity;
    for (const bl of mine) {
      const by = Math.max(bl.p.y, last + 38);
      last = by;
      const bx = columns[name];
      out.push(`<line x1="${bl.p.x.toFixed(1)}" y1="${bl.p.y.toFixed(1)}" x2="${(bx + (bx < bl.p.x ? 15 : -15)).toFixed(1)}" y2="${by.toFixed(1)}" stroke="#111" stroke-width="1"/>`);
      out.push(`<circle cx="${bl.p.x.toFixed(1)}" cy="${bl.p.y.toFixed(1)}" r="2.5" fill="#111"/>`);
      out.push(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="15" fill="#fff" stroke="#111" stroke-width="1.4"/>`);
      out.push(text(bx, by + 6, bl.label, 16, 'middle', 'bold'));
    }
  }

  // Tables on the right.
  let ty = SHEET.margin + 10;
  const tx = 1700 * 0.64 + 10, tw = 1700 - SHEET.margin - tx;
  ty = table(out, tx, ty, tw, 'CUT LIST (1-1/2" rail)', ['MARK', 'QTY', 'LENGTH', 'NOTES'], [0.13, 0.1, 0.27, 0.5],
    b.cuts.map((c) => [c.mark, c.qty, `${fracIn(c.length)} (${(c.length * 25.4).toFixed(0)} mm)`, c.ops.join('; ') || c.roles.join(', ').replace('rail-x', 'front/back').replace('rail-y', 'sides').replace('riser', 'risers')]));
  ty = table(out, tx, ty + 20, tw, 'PARTS (McMaster-Carr)', ['ITEM', 'QTY', 'PART NO.', 'DESCRIPTION'], [0.08, 0.08, 0.17, 0.67],
    [...b.lines.filter((l) => l.kind === 'rail').map((l) => ['-', l.qty, l.pn || 'TBD', l.name]), ...hwItems.map((l, i) => [i + 1, l.qty, l.pn || 'TBD', l.name])]);
  if (b.panels.length) {
    ty = table(out, tx, ty + 20, tw, 'DECKS (cut from sheet)', ['QTY', 'SIZE', 'NOTES'], [0.08, 0.3, 0.62],
      b.panels.map((p) => [p.qty, `${fracIn(p.size[0])} x ${fracIn(p.size[1])} x ${fracIn(p.thickness)}`, `${p.material}${p.notches ? `; notch ${fracIn(p.notches.size[0])} sq. at 4 corners` : ''}${p.cutouts ? `; ${p.cutouts.length} edge cutout(s) for risers` : ''}`]));
  }
  const notes = assemblyNotes(design, b);
  out.push(text(tx, ty + 40, 'NOTES', 15, 'start', 'bold'));
  let ny = ty + 62;
  notes.forEach((n, i) => {
    wrap(n, 62).forEach((line, j) => {
      out.push(text(tx + (j ? 18 : 0), ny, esc(`${j ? '' : `${i + 1}. `}${line}`), 13));
      ny += 19;
    });
  });

  // Title block
  const bx = tx, by = SHEET.h - SHEET.margin / 2 - 110, bw = tw + SHEET.margin / 2 - 2;
  out.push(`<rect x="${bx}" y="${by}" width="${bw}" height="110" fill="#fff" stroke="#111" stroke-width="2"/>`);
  out.push(`<line x1="${bx}" y1="${by + 50}" x2="${bx + bw}" y2="${by + 50}" stroke="#111"/>`);
  out.push(`<line x1="${bx + bw * 0.5}" y1="${by + 50}" x2="${bx + bw * 0.5}" y2="${by + 110}" stroke="#111"/>`);
  out.push(text(bx + 12, by + 22, esc(design.meta.title || 'Frame'), 18, 'start', 'bold'));
  out.push(text(bx + 12, by + 42, 'Extrusion Designer · Quiver Design Works', 13));
  out.push(text(bx + 12, by + 72, `SCALE 1:${scale}   UNITS: INCHES`, 13));
  out.push(text(bx + 12, by + 94, `SHEET 1 OF 1   SIZE B`, 13));
  out.push(text(bx + bw * 0.5 + 12, by + 72, `DATE ${opts.date || new Date().toISOString().slice(0, 10)}`, 13));
  out.push(text(bx + bw * 0.5 + 12, by + 94, 'For reference: check fits before cutting', 12));
  out.push('</svg>');
  return out.join('\n');
}

export function assemblyNotes(design, b) {
  const n = [];
  n.push('All dimensions in inches. Heights are from the floor to the top of the rails.');
  const tap = design.ops.find((o) => o.op === 'tap');
  if (tap) n.push(`Caster stems: drill the post's 0.262" center hole out to 5/16" and tap ${tap.thread} at the bottom end, about 1-3/4" deep.`);
  if (design.hardware.some((h) => h.kind === 'corner-bracket')) n.push('Bracket fasteners are end-feed: slide the nuts into the slots from a rail end before closing each ring of rails.');
  n.push('Square each level before tightening; check diagonals match.');
  if (b.plans && Object.keys(b.plans).length) {
    const p = Object.values(b.plans)[0];
    n.push(`Cut from ${p.sticks.length} x ${p.stockLength / 12} ft sticks with a ${fracIn(p.kerf)} kerf allowance.`);
  }
  for (const t of design.notes) n.push(t);
  return n;
}

function wrap(s, width) {
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function table(out, x, y, w, title, head, cols, rows) {
  const rh = 24;
  out.push(text(x, y + 16, title, 15, 'start', 'bold'));
  y += 24;
  const xs = [x];
  for (const c of cols) xs.push(xs[xs.length - 1] + c * w);
  const all = [head, ...rows];
  all.forEach((r, i) => {
    const yy = y + i * rh;
    out.push(`<rect x="${x}" y="${yy}" width="${w}" height="${rh}" fill="${i === 0 ? '#eef0f2' : '#fff'}" stroke="#111" stroke-width="0.8"/>`);
    r.forEach((cell, ci) => {
      const maxChars = Math.floor((cols[ci] * w - 8) / 6.3);
      let s = String(cell);
      if (s.length > maxChars) s = s.slice(0, maxChars - 1) + '…';
      out.push(text(xs[ci] + 6, yy + 17, esc(s), 12.5, 'start', i === 0 ? 'bold' : 'normal'));
    });
    for (let ci = 1; ci < cols.length; ci++) out.push(`<line x1="${xs[ci]}" y1="${yy}" x2="${xs[ci]}" y2="${yy + rh}" stroke="#111" stroke-width="0.8"/>`);
  });
  return y + all.length * rh;
}

function fmt(v) {
  return v >= 24 ? `${fracIn(v)} (${ftIn(v)})` : fracIn(v);
}

function text(x, y, s, size = 14, anchor = 'start', weight = 'normal') {
  return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" fill="#111">${s}</text>`;
}

function arrow(x, y, dx, dy) {
  const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, s = 10, w = 4;
  return `<path d="M${x},${y} L${x - ux * s + uy * w},${y - uy * s - ux * w} L${x - ux * s - uy * w},${y - uy * s + ux * w} Z" fill="#111"/>`;
}

function dimH(x1, x2, y, label) {
  const g = [];
  g.push(`<g class="dim">`);
  g.push(`<line x1="${x1}" y1="${y - 38}" x2="${x1}" y2="${y + 6}" stroke="#111" stroke-width="0.7"/>`);
  g.push(`<line x1="${x2}" y1="${y - 38}" x2="${x2}" y2="${y + 6}" stroke="#111" stroke-width="0.7"/>`);
  g.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#111" stroke-width="0.9"/>`);
  g.push(arrow(x1, y, -1, 0), arrow(x2, y, 1, 0));
  g.push(text((x1 + x2) / 2, y - 6, esc(label), 15, 'middle'));
  g.push('</g>');
  return g.join('');
}

function dimV(x, y1, y2, label, o = {}) {
  const g = [];
  const ext = o.ext ?? x + 38;
  g.push(`<g class="dim">`);
  g.push(`<line x1="${ext}" y1="${y1}" x2="${x + (x < ext ? -6 : 6)}" y2="${y1}" stroke="#111" stroke-width="0.7"/>`);
  g.push(`<line x1="${ext}" y1="${y2}" x2="${x + (x < ext ? -6 : 6)}" y2="${y2}" stroke="#111" stroke-width="0.7"/>`);
  g.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#111" stroke-width="0.9"/>`);
  const dir = y2 < y1 ? -1 : 1;
  g.push(arrow(x, y1, 0, -dir), arrow(x, y2, 0, dir));
  const my = (y1 + y2) / 2;
  g.push(`<text x="${x - 8}" y="${my}" font-size="${o.small ? 13 : 15}" text-anchor="middle" fill="#111" transform="rotate(-90 ${x - 8} ${my})">${esc(label)}</text>`);
  g.push('</g>');
  return g.join('');
}

// The brace's 8 corners: its band (c0..c1) in the rail/riser plane, across its width.
function braceCorners(h) {
  const { corner, dirU, c0, c1, width } = h.band;
  const a = dirU.findIndex((v) => v !== 0), j = a === 0 ? 1 : 0;
  const pts = [];
  for (const [u, v] of [[0, c0], [0, c1], [c1, 0], [c0, 0]]) {
    for (const w of [-width / 2, width / 2]) {
      const p = [...corner];
      p[a] += dirU[a] * u; p[2] += v; p[j] += w;
      pts.push(p);
    }
  }
  return pts;
}

function hull(points) {
  const p = [...points].sort((m, n) => m.x - n.x || m.y - n.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function extent(boxes) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], b.min[i]); max[i] = Math.max(max[i], b.max[i]); }
  // Drawings measure from the floor.
  min[2] = Math.min(0, min[2]);
  return { min, max };
}

function emptySheet(design) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET.w} ${SHEET.h}"><rect width="100%" height="100%" fill="#fff"/><text x="850" y="550" font-size="28" text-anchor="middle">${esc(design.meta.title || 'Nothing to draw')}: fix the errors first</text></svg>`;
}
