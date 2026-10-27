// Our own drawings of the parts, made from McMaster's published dimensions
// (not copied from their CAD files; see reference/README.md). Inches.

// 1-1/2" four-slot rail section, centred on the rail axis.
// Published: 1.500 square, slot opening 0.320, slot depth 0.484, 0.810
// behind the lips, center hole 0.262. Lip thickness 0.12 and the 45° slot
// floor are drawn to look right; they don't affect any fit the app checks.
export function railSection1515() {
  const h = 0.75, open = 0.16, lip = 0.12, cav = 0.405, depth = 0.484, chamferStart = 0.30;
  const floorHalf = cav - (depth - chamferStart);
  // One face's slot, as points along the +y face from left to right, in
  // (x, y). Then rotate for the other three faces.
  const slot = [
    [-open, h], [-open, h - lip], [-cav, h - lip], [-cav, h - chamferStart],
    [-floorHalf, h - depth], [floorHalf, h - depth], [cav, h - chamferStart], [cav, h - lip],
    [open, h - lip], [open, h],
  ];
  const r = 0.06; // corner radius
  const corner = (cx, cy, a0) => {
    const pts = [];
    for (let i = 0; i <= 4; i++) { const a = a0 + (i / 4) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  };
  const rot = (p, k) => { let [x, y] = p; for (let i = 0; i < k; i++) [x, y] = [-y, x]; return [x, y]; };
  // Counter-clockwise: start at the +x face, slot points run bottom to top.
  const outer = [];
  for (let k = 0; k < 4; k++) {
    // corner at (+h, +h) rotated k quarter turns, then the slot on the next face
    outer.push(...corner(h - r, h - r, 0).map((p) => rot(p, k)));
    // +y face slot runs from x=+ to x=- when going CCW, so reverse it
    outer.push(...[...slot].reverse().map((p) => rot(p, k)));
  }
  const hole = [];
  for (let i = 0; i < 24; i++) { const a = -(i / 24) * Math.PI * 2; hole.push([0.131 * Math.cos(a), 0.131 * Math.sin(a)]); }
  return { outer, holes: [hole] };
}

// Corner bracket side profile in its own frame: inside corner at the
// origin, leg A along +x, leg B along +y (the 3D view maps y to the bracket's
// leg B direction), outside faces at -t. Published: 1.500 legs from the
// outside face, 0.250 thick, inside fillet about 5/16.
export function bracketProfile({ legLength = 1.5, thickness = 0.25, fillet = 0.3125 } = {}) {
  const t = thickness, L = legLength - t;
  const pts = [[-t, -t], [L, -t], [L, 0]];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 - (i / 8) * (Math.PI / 2); // concave arc about (f, f) from (f, 0) to (0, f)
    pts.push([fillet + fillet * Math.cos(a), fillet + fillet * Math.sin(a)]);
  }
  pts.push([0, L], [-t, L]);
  return pts;
}
