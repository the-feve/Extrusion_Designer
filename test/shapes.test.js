import { test } from 'node:test';
import assert from 'node:assert/strict';
import { railSection1515, bracketProfile } from '../app/shapes.js';

const area = (pts) => pts.reduce((a, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return a + x * y2 - x2 * y; }, 0) / 2;

test('rail section: inside the 1.5" square, outer CCW, hole CW, slots 0.32" open', () => {
  const s = railSection1515();
  for (const [x, y] of s.outer) assert.ok(Math.abs(x) <= 0.75 + 1e-9 && Math.abs(y) <= 0.75 + 1e-9);
  assert.ok(area(s.outer) > 0);
  assert.ok(area(s.holes[0]) < 0);
  const lips = s.outer.filter(([x, y]) => Math.abs(y - 0.75) < 1e-9 && Math.abs(Math.abs(x) - 0.16) < 1e-9);
  assert.equal(lips.length, 2);
  // Area close to the measured 0.880 in2 (ours is a simplified drawing).
  const a = area(s.outer) + area(s.holes[0]);
  assert.ok(a > 0.7 && a < 1.2, `area ${a}`);
});

test('bracket profile: CCW, legs reach 1.5" from the outside faces', () => {
  const p = bracketProfile();
  assert.ok(area(p) > 0);
  assert.equal(Math.max(...p.map(([x]) => x)) + 0.25, 1.5);
  assert.equal(Math.max(...p.map(([, y]) => y)) + 0.25, 1.5);
});
