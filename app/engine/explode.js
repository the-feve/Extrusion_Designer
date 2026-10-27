// Exploded view: a direction per part (inches of travel per unit of
// "explode"), worked out from the frame itself so it suits any template.
//   members  move out from the frame's centre on their cross axes (not along
//            their own length, and not up or down): posts go out diagonally,
//            front/back rails out in y, side rails out in x;
//   risers   follow the rail they stand on and lift;
//   brackets and braces go halfway between the two members they join, so
//            they sit in the middle of the gap that opens at the joint;
//   casters  follow their member and drop;
//   decks    lift.

export function explodeOffsets(design) {
  const out = new Map();
  if (!design.members.length) return out;
  const lo = [0, 1, 2].map((i) => Math.min(...design.members.map((m) => m.box.min[i])));
  const hi = [0, 1, 2].map((i) => Math.max(...design.members.map((m) => m.box.max[i])));
  const mid = lo.map((v, i) => (v + hi[i]) / 2);
  const sign = (v) => (Math.abs(v) < 0.01 ? 0 : Math.sign(v));
  for (const m of design.members) {
    const c = [0, 1, 2].map((i) => (m.box.min[i] + m.box.max[i]) / 2);
    out.set(m.id, [0, 1].map((i) => (i === m.axis ? 0 : sign(c[i] - mid[i]))).concat(0));
  }
  // Risers move with the rail they stand on, and lift off it.
  for (const j of design.joints) {
    const m = design.members.find((x) => x.id === j.rail);
    if (m.role === 'riser') out.set(m.id, [...out.get(j.onto).slice(0, 2), 1]);
  }
  for (const h of design.hardware) {
    if (h.kind === 'corner-bracket') {
      const j = design.joints.find((x) => x.id === h.joint);
      const a = out.get(j.rail), b = out.get(j.onto);
      out.set(h.id, a.map((v, i) => (v + b[i]) / 2));
    } else if (h.kind === 'brace') {
      const [a, b] = h.members.map((id) => out.get(id));
      out.set(h.id, a.map((v, i) => (v + b[i]) / 2));
    } else if (h.member) {
      const a = out.get(h.member) || [0, 0, 0];
      out.set(h.id, [a[0], a[1], -1]);
    }
  }
  for (const p of design.panels) out.set(p.id, [0, 0, 1.25]);
  return out;
}
