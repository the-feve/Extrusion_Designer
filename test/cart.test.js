// Build-logic tests for the cart: lengths mate, nothing intersects, every
// joint is bracketed, and the BOM, cut list and drawing agree with the frame.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeCatalog } from '../app/engine/catalog.js';
import { buildCart } from '../app/engine/cart.js';
import { validate } from '../app/engine/validate.js';
import { bom, planStock } from '../app/engine/bom.js';
import { drawingSvg } from '../app/engine/drawing.js';
import { mcmasterPaste, bomCsv, cutListCsv } from '../app/engine/export.js';
import { solids } from '../app/engine/frame.js';
import { clashes } from '../app/engine/geom.js';
import { parseLength, fracIn, ftIn } from '../app/engine/units.js';

const catalog = makeCatalog(JSON.parse(fs.readFileSync(new URL('../app/data/catalog.json', import.meta.url))));
const caster = catalog.part('caster-placeholder');

test('default cart: 24 x 36 x 30 builds with no errors', () => {
  const d = buildCart(catalog, {});
  const v = validate(d);
  assert.equal(v.errors, 0, v.issues.filter((i) => i.level === 'error').map((i) => i.msg).join('\n'));
  assert.equal(v.warnings, 0);
  assert.equal(d.members.length, 4 + 2 * 4); // 4 posts + bottom and top rings
});

test('cut lengths: posts = height - caster, rails = outside size - 2 x 1.5"', () => {
  const d = buildCart(catalog, { width: 24, length: 36, height: 30 });
  const posts = d.members.filter((m) => m.role === 'post');
  const xs = d.members.filter((m) => m.role === 'rail-x');
  const ys = d.members.filter((m) => m.role === 'rail-y');
  for (const p of posts) assert.equal(p.length, 30 - caster.mountHeight);
  for (const r of xs) assert.equal(r.length, 21);
  for (const r of ys) assert.equal(r.length, 33);
});

test('outside of the frame is exactly the asked size', () => {
  const d = buildCart(catalog, { width: 24, length: 36, height: 30, decks: { top: false, shelves: false, bottom: false } });
  const rails = solids(d).filter((s) => s.kind === 'rail');
  const min = [0, 1, 2].map((i) => Math.min(...rails.map((s) => s.box.min[i])));
  const max = [0, 1, 2].map((i) => Math.max(...rails.map((s) => s.box.max[i])));
  assert.deepEqual(min, [0, 0, caster.mountHeight]);
  assert.deepEqual(max, [24, 36, 30]);
  // Casters reach the floor.
  const c = solids(d).filter((s) => s.kind === 'caster');
  assert.equal(c.length, 4);
  for (const s of c) assert.equal(s.box.min[2], 0);
});

test('0 to 4 intermediate shelves, several sizes: no clashes, every joint bracketed and on a slot', () => {
  for (const [w, l, h] of [[24, 36, 30], [18, 24, 36], [30, 48, 42], [20, 20, 20]]) {
    for (let n = 0; n <= 4; n++) {
      const d = buildCart(catalog, { width: w, length: l, height: h, shelves: n });
      const v = validate(d);
      const errs = v.issues.filter((i) => i.level === 'error');
      if (n <= 2 || h >= 30) assert.equal(errs.length, 0, `${w}x${l}x${h} with ${n}: ${errs.map((i) => i.msg).join('; ')}`);
      if (errs.length) continue;
      assert.equal(d.joints.length, 8 * (n + 2));
      for (const j of d.joints) {
        assert.ok(j.contact, 'rail end sits on the post face');
        assert.equal(j.fasteners.length, 1);
      }
      // Independent brute-force clash check over every pair of solids.
      const all = solids(d);
      for (let i = 0; i < all.length; i++) for (let k = i + 1; k < all.length; k++) {
        if (all[i].owner !== all[k].owner) assert.ok(!clashes(all[i].box, all[k].box), `${all[i].name} vs ${all[k].name}`);
      }
    }
  }
});

test('brackets hang under every level when the post continues below it', () => {
  const d = buildCart(catalog, { shelves: 2 });
  for (const h of d.hardware.filter((x) => x.kind === 'corner-bracket')) assert.equal(h.side, '-z', h.name);
});

test('bottom rails flush with the post ends: brackets go on top, and a bottom deck can no longer fit', () => {
  const noDeck = buildCart(catalog, { bottomLift: 0, decks: { bottom: false } });
  assert.ok(validate(noDeck).ok);
  const bottom = noDeck.hardware.filter((h) => h.kind === 'corner-bracket' && h.name.startsWith('Bracket Bottom'));
  assert.equal(bottom.length, 8);
  for (const h of bottom) assert.equal(h.side, '+z');
  const withDeck = validate(buildCart(catalog, { bottomLift: 0 }));
  assert.ok(!withDeck.ok);
  assert.ok(withDeck.issues.some((i) => i.code === 'no-fastener' && /hits Bottom deck/.test(i.msg)));
});

test('shelves too close together are refused with the spacing needed', () => {
  const d = buildCart(catalog, { shelves: 1, shelfHeights: [10] });
  const v = validate(d);
  assert.ok(!v.ok);
  const msg = v.issues.find((i) => i.code === 'levels-too-close');
  assert.ok(msg, 'spacing message');
  assert.match(msg.msg, /needs at least 3\.75"/);
});

test('even shelf spacing rounds to 1/2" and stays between bottom and top', () => {
  const d = buildCart(catalog, { shelves: 3 });
  const tops = d.levels.map((l) => l.railTop);
  for (const t of tops.slice(1, -1)) assert.equal(t * 2, Math.round(t * 2));
  for (let i = 1; i < tops.length; i++) assert.ok(tops[i] > tops[i - 1]);
  assert.equal(tops[tops.length - 1], 30);
});

test('too small to build gives a clear error and no geometry', () => {
  const d = buildCart(catalog, { width: 5 });
  const v = validate(d);
  assert.ok(!v.ok);
  assert.equal(d.members.length, 0);
});

test('no casters: posts stand on the floor, full height', () => {
  const d = buildCart(catalog, { caster: null });
  assert.ok(validate(d).ok);
  for (const p of d.members.filter((m) => m.role === 'post')) { assert.equal(p.origin[2], 0); assert.equal(p.length, 30); }
  assert.equal(d.ops.length, 0);
});

test('BOM: brackets = 8 per level, casters 4, posts tapped', () => {
  const d = buildCart(catalog, { shelves: 1 });
  const b = bom(d);
  const br = b.lines.find((l) => l.pn === '47065T845');
  assert.equal(br.qty, 24);
  assert.equal(br.total, Math.round(24 * 9.38 * 100) / 100);
  assert.equal(b.lines.find((l) => l.kind === 'caster').qty, 4);
  const posts = b.cuts.find((c) => c.roles.includes('post'));
  assert.equal(posts.qty, 4);
  assert.match(posts.ops[0], /Tap bottom end/);
  // Total rail in the cut list = total member length.
  const cutTotal = b.cuts.reduce((a, c) => a + c.qty * c.length, 0);
  const memberTotal = d.members.reduce((a, m) => a + m.length, 0);
  assert.equal(cutTotal, memberTotal);
});

test('stock plan: every piece placed once, no stick over length, beats first-fit', () => {
  const cuts = [{ mark: 'A', length: 33, qty: 6, profile: '1515' }, { mark: 'B', length: 25, qty: 4, profile: '1515' }, { mark: 'C', length: 21, qty: 6, profile: '1515' }];
  const plan = planStock(cuts, 120, 0.125);
  assert.equal(plan.sticks.length, 4); // first-fit decreasing needs 5
  const placed = plan.sticks.flatMap((s) => s.cuts.map((c) => c.mark)).sort().join('');
  assert.equal(placed, 'AAAAAABBBBCCCCCC');
  for (const s of plan.sticks) assert.ok(s.used <= 120 + 1e-9);
  const tooLong = planStock([{ mark: 'X', length: 130, qty: 1, profile: '1515' }]);
  assert.equal(tooLong.tooLong.length, 1);
});

test('drawing: SVG with three views, a balloon per cut mark, title', () => {
  const d = buildCart(catalog, { shelves: 1 });
  const svg = drawingSvg(d, { date: '2026-10-27' });
  assert.match(svg, /^<svg/);
  for (const v of ['view-front', 'view-right', 'view-top']) assert.ok(svg.includes(v));
  for (const mark of ['A', 'B', 'C']) assert.ok(svg.includes(`>${mark}</text>`), mark);
  assert.ok(svg.includes('Cart 24&quot; W x 36&quot; L x 30&quot; H'));
  assert.ok(!svg.includes('NaN'));
});

test('exports: McMaster paste lists part numbers and flags parts without one', () => {
  const b = bom(buildCart(catalog, {}));
  const paste = mcmasterPaste(b);
  assert.match(paste.text, /^4658N49\t\d+$/m);
  assert.match(paste.text, /^47065T845\t16$/m);
  assert.equal(paste.missing.length, 1); // the placeholder caster
  assert.match(bomCsv(b), /47065T845,16,/);
  assert.match(cutListCsv(b), /^A,4,33\.0000/m);
});

test('units: parse and format', () => {
  assert.equal(parseLength('2\' 6"'), 30);
  assert.equal(parseLength('24 1/2'), 24.5);
  assert.equal(parseLength('24-1/2"'), 24.5);
  assert.ok(Math.abs(parseLength('609.6mm') - 24) < 1e-9);
  assert.equal(parseLength('3ft'), 36);
  assert.equal(fracIn(22.5), '22-1/2"');
  assert.equal(fracIn(0.75), '3/4"');
  assert.equal(ftIn(30), '2\' 6"');
});
