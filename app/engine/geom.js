// Axis-aligned boxes: the whole frame is built from them. Members, bracket
// legs, caster bodies and deck panels are each one or more boxes, which is
// exact for straight rails and close enough (a little conservative) for
// brackets and casters. Touching is fine; any overlap thicker than TOL is a
// clash.

export const AXES = ['x', 'y', 'z'];
export const TOL = 1e-3; // inches: overlaps thinner than this are "touching"

export function box(min, max) {
  return { min: [...min], max: [...max] };
}

// Box from an origin (min corner) along `axis` with `length`, and the
// section sizes on the other two axes.
export function memberBox(m) {
  const min = [...m.origin];
  const max = [...m.origin];
  for (let i = 0; i < 3; i++) max[i] = min[i] + (i === m.axis ? m.length : m.section[i]);
  return { min, max };
}

export function overlap1(aMin, aMax, bMin, bMax) {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

// Thickness of the overlap on each axis (negative = gap).
export function overlaps(a, b) {
  return [0, 1, 2].map((i) => overlap1(a.min[i], a.max[i], b.min[i], b.max[i]));
}

export function clashes(a, b, tol = TOL) {
  return overlaps(a, b).every((d) => d > tol);
}

export function contains(outer, inner, tol = TOL) {
  for (let i = 0; i < 3; i++) {
    if (inner.min[i] < outer.min[i] - tol || inner.max[i] > outer.max[i] + tol) return false;
  }
  return true;
}

export function center(b) {
  return [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2);
}

export function size(b) {
  return [0, 1, 2].map((i) => b.max[i] - b.min[i]);
}

export function union(boxes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i]);
      max[i] = Math.max(max[i], b.max[i]);
    }
  }
  return { min, max };
}

// Box spanning two values on each axis, in any order.
export function span(a, b) {
  return {
    min: [0, 1, 2].map((i) => Math.min(a[i], b[i])),
    max: [0, 1, 2].map((i) => Math.max(a[i], b[i])),
  };
}

// A flat rectangle (zero thickness on `axis` at `at`) lies on a face of box
// `b` when the face is in that plane and covers the rectangle.
export function rectOnFace(rect, axis, at, b, tol = TOL) {
  const onPlane = Math.abs(b.min[axis] - at) <= tol || Math.abs(b.max[axis] - at) <= tol;
  if (!onPlane) return false;
  for (let i = 0; i < 3; i++) {
    if (i === axis) continue;
    if (rect.min[i] < b.min[i] - tol || rect.max[i] > b.max[i] + tol) return false;
  }
  return true;
}

export function fmtPoint(p, digits = 3) {
  return `(${p.map((v) => v.toFixed(digits)).join(', ')})`;
}
