#!/usr/bin/env python3
"""Extract lightweight geometry for Extrusion Designer from McMaster-Carr STEP files.

Produces, in app/data/geometry/:
  rail-1515.json / rail-1515.svg                 cross-section of 4658N49 (1.5" four-slot rail)
  bracket-47065T845.json / bracket-47065T845.svg low-poly mesh + holes of the corner bracket

Requirements (pip):  cadquery-ocp  numpy
  python3 -m venv venv && ./venv/bin/pip install cadquery-ocp numpy
  ./venv/bin/python -I tools/step_extract.py            (run from the repo root)

The STEP files are only read as data by OpenCascade's STEP reader.  OCCT converts
the files' inch units to millimetres on import; everything is scaled back to inches here.
"""
import json
import math
import os
import sys
from collections import Counter

import numpy as np
from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCP.GeomAbs import GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Line, GeomAbs_Circle
from OCP.GCPnts import GCPnts_QuasiUniformDeflection
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp
from OCP.BRepTools import BRepTools, BRepTools_WireExplorer
from OCP.TopAbs import TopAbs_WIRE
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.TopLoc import TopLoc_Location

MM = 25.4  # OCCT works in mm
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "reference", "mcmaster")
OUT = os.path.join(ROOT, "app", "data", "geometry")
RAIL_STEP = "4658N49_T-Slotted_Framing_Rail.STEP"
BRACKET_STEP = "47065T845_Silver_Corner_Bracket.STEP"
DENSITY_6063 = 0.0975  # lb/in^3
MESH_DEFLECTION = float(os.environ.get("MESH_DEFL", "0.01"))   # in, bracket chord tolerance
MESH_ANGLE = math.radians(float(os.environ.get("MESH_ANG", "30")))


def load(name):
    r = STEPControl_Reader()
    if r.ReadFile(os.path.join(REF, name)) != IFSelect_RetDone:
        sys.exit("cannot read " + name)
    r.TransferRoots()
    return r.OneShape()


def bbox_in(shape):
    b = Bnd_Box()
    BRepBndLib.Add_s(shape, b, False)
    return np.array(b.CornerMin().Coord()) / MM, np.array(b.CornerMax().Coord()) / MM


def faces(shape):
    ex = TopExp_Explorer(shape, TopAbs_FACE)
    while ex.More():
        yield TopoDS.Face(ex.Current())
        ex.Next()


def face_area(f):
    p = GProp_GProps()
    BRepGProp.SurfaceProperties_s(f, p)
    return p.Mass() / MM ** 2


def volume_in3(shape):
    p = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, p)
    return p.Mass() / MM ** 3


def r5(v):
    return round(float(v), 5)


# ---------------------------------------------------------------- rail section
SAGITTA = 0.0005          # in, max chord error for arcs
ARC_STEP = math.radians(7.5)  # angular step for larger arcs
# An arc gets ceil(span / max(ARC_STEP, sagitta-angle)) segments: big arcs every 7.5 deg,
# tiny fillets (r=0.0125") as coarse as the 0.0005" chord error allows.  ~560 points total.


def edge_points(edge, reversed_):
    """Points along an edge (inches, 3D) in wire-traversal order, excluding the last point."""
    c = BRepAdaptor_Curve(edge)
    u0, u1 = c.FirstParameter(), c.LastParameter()
    t = c.GetType()
    if t == GeomAbs_Line:
        us = [u0, u1]
    elif t == GeomAbs_Circle:
        rad = c.Circle().Radius() / MM
        step = max(ARC_STEP, 2 * math.acos(max(-1.0, 1 - SAGITTA / rad)))
        n = max(1, math.ceil((u1 - u0) / step - 1e-9))
        us = list(np.linspace(u0, u1, n + 1))
    else:  # generic fallback (none expected in these files)
        d = GCPnts_QuasiUniformDeflection(c, SAGITTA * MM)
        us = [d.Parameter(i) for i in range(1, d.NbPoints() + 1)]
    pts = [np.array(c.Value(u).Coord()) / MM for u in us]
    if reversed_:
        pts.reverse()
    return pts[:-1], t


def wire_loop(wire, face):
    pts, kinds = [], Counter()
    we = BRepTools_WireExplorer(wire, face)
    while we.More():
        e = we.Current()
        p, t = edge_points(e, e.Orientation() == TopAbs_REVERSED)
        kinds[str(t).split(".")[-1]] += 1
        pts += p
        we.Next()
    return pts, kinds


def shoelace(loop):
    a = np.array(loop)
    x, y = a[:, 0], a[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def rail():
    shape = load(RAIL_STEP)
    lo, hi = bbox_in(shape)
    ext = hi - lo
    axis = int(np.argmax(ext))
    length = float(ext[axis])
    vol = volume_in3(shape)

    # planar end face perpendicular to the long axis, at the + end
    end = None
    for f in faces(shape):
        s = BRepAdaptor_Surface(f)
        if s.GetType() != GeomAbs_Plane:
            continue
        n = np.array(s.Plane().Axis().Direction().Coord())
        o = np.array(s.Plane().Location().Coord()) / MM
        if abs(abs(n[axis]) - 1) < 1e-9 and abs(o[axis] - hi[axis]) < 1e-6:
            end = f
    assert end is not None, "no end face"
    end_area = face_area(end)

    others = [i for i in range(3) if i != axis]
    centre = (lo + hi) / 2
    outer_w = BRepTools.OuterWire_s(end)
    loops, kinds = [], Counter()
    outer_loop = None
    wex = TopExp_Explorer(end, TopAbs_WIRE)
    wires = []
    while wex.More():
        wires.append(TopoDS.Wire(wex.Current()))
        wex.Next()
    for w in wires:
        p3, k = wire_loop(w, end)
        kinds += k
        p2 = [[r5(p[others[0]] - centre[others[0]]), r5(p[others[1]] - centre[others[1]])] for p in p3]
        if w.IsSame(outer_w):
            outer_loop = p2
        else:
            loops.append(p2)
    # normalise winding: outer CCW, holes CW (three.js Shape/Path convention)
    if shoelace(outer_loop) < 0:
        outer_loop.reverse()
    for h in loops:
        if shoelace(h) > 0:
            h.reverse()
    loops.sort(key=lambda h: (round(-abs(shoelace(h)), 4), h[0]))
    area = shoelace(outer_loop) + sum(shoelace(h) for h in loops)

    # ---- measurements (slot on the +Y face; the profile is 4-fold symmetric)
    o = np.array(outer_loop)
    half = 0.75
    sl = o[(o[:, 1] > 0.2) & (np.abs(o[:, 0]) < 0.45)]          # slot cavity + lips
    # slot opening: gap between the lip tips (points above the lip undersides)
    tips = sl[(sl[:, 1] > 0.62) & (np.abs(sl[:, 0]) < 0.3)]
    opening = tips[tips[:, 0] > 0, 0].min() - tips[tips[:, 0] < 0, 0].max()
    depth = half - sl[np.abs(sl[:, 0]) < 0.2, 1].min()          # from the nominal 1.5" face
    under_lip = sl[:, 0].max() - sl[:, 0].min()                 # cavity width behind the lips
    lip_under = sl[(np.abs(sl[:, 0]) > 0.3) & (np.abs(sl[:, 0]) < 0.39), 1].max()
    lip_top = tips[:, 1].max()
    face = o[(o[:, 1] > 0.7)]
    lip_thk = lip_top - lip_under
    # center hole: loop that encloses the origin
    hole_info = []
    for h in loops:
        a = np.array(h)
        c = a.mean(axis=0)
        rr = np.hypot(a[:, 0] - c[0], a[:, 1] - c[1])
        hole_info.append({"centroid": [r5(c[0]), r5(c[1])], "area_in2": r5(-shoelace(h)),
                          "points": len(h), "bbox": [r5(a[:, 0].min()), r5(a[:, 1].min()),
                                                      r5(a[:, 0].max()), r5(a[:, 1].max())],
                          "round": bool(rr.max() - rr.min() < 1e-3)})
    centre_hole = min(loops, key=lambda h: np.hypot(*np.array(h).mean(axis=0)))
    ch = np.array(centre_hole)
    chr_ = np.hypot(ch[:, 0], ch[:, 1])
    ch_dia = 2 * chr_.min()          # bore diameter between the four lobes
    ch_lobe = 2 * chr_.max()         # across the lobes (diagonal)

    lbs_per_in = end_area * DENSITY_6063
    data = {
        "pn": "4658N49",
        "units": "in",
        "size": [r5(o[:, 0].max() - o[:, 0].min()), r5(o[:, 1].max() - o[:, 1].min())],
        "outer": outer_loop,
        "holes": loops,
        "area_in2": r5(end_area),
        "weight_lb_per_ft_6063": round(lbs_per_in * 12, 4),
        "polygon_area_in2": r5(area),
        "density_lb_in3": DENSITY_6063,
        "winding": "outer CCW, holes CW; section plane = STEP X/Y, rail axis = STEP Z",
        "measured": {
            "stick_length_in": r5(length),
            "extrusion_axis": "XYZ"[axis],
            "step_axis_range": [r5(lo[axis]), r5(hi[axis])],
            "section_area_from_end_face_in2": r5(end_area),
            "section_area_from_volume_in2": r5(vol / length),
            "stick_weight_lb_6063": round(vol * DENSITY_6063, 3),
            "slot_opening_in": r5(opening),
            "slot_depth_in": r5(depth),
            "width_under_lips_in": r5(under_lip),
            "lip_thickness_in": r5(lip_thk),
            "lip_top_y_in": r5(lip_top),
            "face_relief_at_slot_in": r5(half - lip_top),
            "face_max_y_in": r5(face[:, 1].max()),
            "center_hole_dia_in": r5(ch_dia),
            "center_hole_note": "centre bore is a 0.262 circle with four 0.09 dia lobes on the diagonals",
            "center_hole_max_dia_across_lobes_in": r5(ch_lobe),
            "edge_types_on_end_face": dict(kinds),
            "outer_points": len(outer_loop),
            "total_points": len(outer_loop) + sum(len(h) for h in loops),
            "holes": hole_info,
        },
        "published": {"size": [1.5, 1.5], "slot_opening_in": 0.32, "slot_depth_in": 0.484,
                      "between_lips_in": 0.81, "center_hole_dia_in": 0.262, "stick_length_in": 120,
                      "weight_lb_per_ft": None,
                      "weight_note": "not in the STEP file; not found in a quick web search - check the McMaster product page"},
        "source": "reference/mcmaster/" + RAIL_STEP,
    }
    with open(os.path.join(OUT, "rail-1515.json"), "w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    write_rail_svg(data)
    return data


def write_rail_svg(d):
    s = 300  # px per inch
    pad = 0.15
    w = (1.5 + 2 * pad) * s

    def path(loop):
        return "M" + " L".join(f"{(x + 0.75 + pad) * s:.2f},{(0.75 + pad - y) * s:.2f}" for x, y in loop) + " Z"

    m = d["measured"]
    body = path(d["outer"]) + " " + " ".join(path(h) for h in d["holes"])
    dots = "".join(f'<circle cx="{(x + 0.75 + pad) * s:.2f}" cy="{(0.75 + pad - y) * s:.2f}" r="1.2" fill="#c33"/>'
                   for x, y in d["outer"] + [p for h in d["holes"] for p in h])
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{w + 60:.0f}" viewBox="0 0 {w:.0f} {w + 60:.0f}">
<rect width="100%" height="100%" fill="#fff"/>
<path d="{body}" fill="#b8c2cc" fill-rule="evenodd" stroke="#234" stroke-width="1"/>
{dots}
<text x="10" y="{w + 22:.0f}" font-family="sans-serif" font-size="14">4658N49 section: area {d["area_in2"]:.4f} in² · {d["weight_lb_per_ft_6063"]:.3f} lb/ft (6063) · {m["total_points"]} pts</text>
<text x="10" y="{w + 44:.0f}" font-family="sans-serif" font-size="14">slot {m["slot_opening_in"]:.3f} open × {m["slot_depth_in"]:.3f} deep · {m["width_under_lips_in"]:.3f} under lips · centre hole Ø{m["center_hole_dia_in"]:.3f}</text>
</svg>
'''
    with open(os.path.join(OUT, "rail-1515.svg"), "w") as fh:
        fh.write(svg)


# ---------------------------------------------------------------- bracket
def bracket():
    shape = load(BRACKET_STEP)
    lo_s, hi_s = bbox_in(shape)

    # Identify the L from its four big planar faces (STEP frame, inches).
    planes = []
    cyls = []
    for f in faces(shape):
        s = BRepAdaptor_Surface(f)
        if s.GetType() == GeomAbs_Plane:
            n = np.array(s.Plane().Axis().Direction().Coord())
            if f.Orientation() == TopAbs_REVERSED:
                n = -n
            planes.append((n, np.array(s.Plane().Location().Coord()) / MM, face_area(f)))
        elif s.GetType() == GeomAbs_Cylinder:
            c = s.Cylinder()
            cyls.append((c.Radius() / MM, np.array(c.Axis().Direction().Coord()),
                         np.array(c.Axis().Location().Coord()) / MM, face_area(f), f))
    # Expected (verified on 47065T845): leg plates lie on STEP z in [-0.25,0] and y in [-0.75,-0.5];
    # width along STEP x.  Generic detection: the inside faces have normals +y/+z, outside -y/-z.
    def plane_at(nvec):
        cands = [p for p in planes if np.dot(p[0], nvec) > 0.999]
        return max(cands, key=lambda p: p[2])
    in_z = plane_at([0, 0, 1])[1][2]    # inside face of leg A (normal +Z)
    out_z = plane_at([0, 0, -1])[1][2]
    in_y = plane_at([0, 1, 0])[1][1]    # inside face of leg B (normal +Y)
    out_y = plane_at([0, -1, 0])[1][1]
    origin = np.array([0.0, in_y, in_z])  # inside corner (intersection of the inside planes), x centred
    # new X = STEP +Y (leg A direction), new Z = STEP +Z (leg B direction), new Y = Z x X = STEP -X
    R = np.array([[0, 1, 0],    # X' row
                  [-1, 0, 0],   # Y'
                  [0, 0, 1]])   # Z'

    def tf(p):
        return R @ (np.asarray(p) - origin)

    # mesh
    BRepMesh_IncrementalMesh(shape, MESH_DEFLECTION * MM, False, MESH_ANGLE, True)
    pos, idx, vmap = [], [], {}
    for f in faces(shape):
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(f, loc)
        if tri is None:
            continue
        trsf = loc.Transformation()
        base = []
        for i in range(1, tri.NbNodes() + 1):
            p = np.array(tri.Node(i).Transformed(trsf).Coord()) / MM
            q = tuple(round(float(v), 5) for v in tf(p))
            if q not in vmap:  # weld shared vertices across faces
                vmap[q] = len(pos)
                pos.append(q)
            base.append(vmap[q])
        rev = f.Orientation() == TopAbs_REVERSED
        for i in range(1, tri.NbTriangles() + 1):
            a, b, c = tri.Triangle(i).Get()
            t = [base[a - 1], base[b - 1], base[c - 1]]
            if len(set(t)) < 3:
                continue
            if rev:
                t[1], t[2] = t[2], t[1]
            idx.append(t)
    P = np.array(pos)
    # sanity: mesh volume (divergence theorem) should match the B-rep volume => outward winding
    tris = P[np.array(idx)]
    mvol = float(np.einsum("ij,ij->i", tris[:, 0], np.cross(tris[:, 1], tris[:, 2])).sum() / 6)
    bvol = volume_in3(shape)

    # holes: cylinders with an axis normal to a leg and radius ~ 0.16
    holes = []
    seen = set()
    for rad, d, loc, a, f in cyls:
        if rad < 0.1 or rad > 0.25:
            continue
        dn = R @ d
        c = tf(loc)
        if abs(abs(dn[2]) - 1) < 1e-6:     # through leg A (plate normal Z)
            leg, centre = "A", [c[0], c[1], (out_z - in_z) / 2]
        elif abs(abs(dn[0]) - 1) < 1e-6:   # through leg B (plate normal X)
            leg, centre = "B", [-(in_y - out_y) / 2, c[1], c[2]]
        else:
            continue
        key = (leg, round(centre[0], 4), round(centre[1], 4), round(centre[2], 4))
        if key in seen:
            continue
        seen.add(key)
        holes.append({"leg": leg, "center": [r5(v) for v in centre], "dia": r5(2 * rad),
                      "axis": [int(round(v)) for v in (abs(dn[0]), abs(dn[1]), abs(dn[2]))]})
    holes.sort(key=lambda h: h["leg"])

    # inside fillet: cylinder whose axis is along the width (new Y) at the inside corner
    ycyl = [(rad, tf(loc)) for rad, d, loc, a, f in cyls if abs(abs((R @ d)[1]) - 1) < 1e-6]
    fillet = [r5(rad) for rad, c in ycyl if c[0] > 0 and c[2] > 0 and abs(c[0] - rad) < 1e-6]
    outer_round = [r5(rad) for rad, c in ycyl if c[0] < 0 and c[2] < 0]
    tip_round = sorted({r5(rad) for rad, c in ycyl if max(c[0], c[2]) > 0.6 and rad > 0.1})
    bmin, bmax = P.min(axis=0), P.max(axis=0)
    thk_a = in_z - out_z
    thk_b = in_y - out_y
    data = {
        "pn": "47065T845",
        "units": "in",
        "frame": ("Origin at the inside corner of the L (intersection of the two inside leg faces; "
                  "the real corner is filled by the inside fillet). Leg A runs along +X and its plate "
                  "occupies Z in [-thickness, 0]; leg B runs along +Z and its plate occupies X in "
                  "[-thickness, 0]; width along Y, centred on 0. The outside faces (Z=-t and X=-t) "
                  "are the faces that bear on the rails. From the STEP frame (inches): "
                  f"p' = R*(p - o), o = (0, {r5(in_y)}, {r5(in_z)}), "
                  "R rows = [[0,1,0],[-1,0,0],[0,0,1]], i.e. X'=STEP Y, Y'=-STEP X, Z'=STEP Z."),
        "positions": [v for p in pos for v in p],
        "indices": [i for t in idx for i in t],
        "bbox": {"min": [r5(v) for v in bmin], "max": [r5(v) for v in bmax]},
        "holes": holes,
        "dims": {
            "thickness_legA": r5(thk_a),
            "thickness_legB": r5(thk_b),
            "width": r5(bmax[1] - bmin[1]),
            "legA_length_from_outside_face": r5(bmax[0] - bmin[0]),
            "legB_length_from_outside_face": r5(bmax[2] - bmin[2]),
            "legA_length_from_inside_corner": r5(bmax[0]),
            "legB_length_from_inside_corner": r5(bmax[2]),
            "hole_centre_from_outside_face": [r5(h["center"][0] + thk_b) if h["leg"] == "A"
                                              else r5(h["center"][2] + thk_a) for h in holes],
            "hole_centre_from_leg_end": [r5(bmax[0] - h["center"][0]) if h["leg"] == "A"
                                         else r5(bmax[2] - h["center"][2]) for h in holes],
            "inside_fillet_radius": fillet,
            "outside_corner_radius": outer_round,
            "leg_tip_inside_round_radius": tip_round,
            "edge_break_radius": 0.02,
            "volume_in3": r5(bvol),
            "mesh_volume_in3": r5(mvol),
            "weight_lb_if_aluminum": round(bvol * 0.0975, 4),
            "triangles": len(idx),
            "vertices": len(pos),
        },
        "published": {"leg": 1.5, "width": 1.31, "thickness": 0.25, "hole_dia": 0.328,
                      "hole_from_leg_end": 0.75},
        "source": "reference/mcmaster/" + BRACKET_STEP,
    }
    with open(os.path.join(OUT, "bracket-47065T845.json"), "w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    write_bracket_svg(P, np.array(idx), data)
    return data


def write_bracket_svg(P, T, d):
    """Three views (front X/Z, top X/Y, iso) as flat-shaded triangles, painter-sorted."""
    s = 160
    views = []
    eye = np.array([1.0, -1.6, 0.9])          # camera in front-right-above
    fwd = -eye / np.linalg.norm(eye)
    right = np.cross(fwd, [0, 0, 1]); right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    # rows: screen u (right), screen v (up), depth toward viewer
    views.append(("front (look +Y)", np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]])))
    views.append(("top (look -Z)", np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]])))
    views.append(("iso", np.array([right, up, -fwd])))
    light = np.array([0.3, 0.5, 0.8]); light /= np.linalg.norm(light)
    parts = []
    W = 0
    H = max(np.ptp((P @ M.T)[:, 1]) for _, M in views) * s + 80
    for k, (name, M) in enumerate(views):
        Q = P @ M.T
        off = np.array([-Q[:, 0].min() + 0.1, Q[:, 1].max() + 0.1])
        x0 = W
        tri = Q[T]
        nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        ln = np.linalg.norm(nrm, axis=1); ln[ln == 0] = 1
        nrm = nrm / ln[:, None]
        order = np.argsort(tri[:, :, 2].mean(axis=1))
        g = []
        for i in order:
            if nrm[i, 2] <= 0:
                continue
            sh = 0.35 + 0.65 * max(0.0, float(nrm[i] @ light))
            col = int(90 + 140 * sh)
            pts = " ".join(f"{x0 + (u + off[0]) * s:.1f},{(off[1] - v) * s + 20:.1f}" for u, v, _ in tri[i])
            g.append(f'<polygon points="{pts}" fill="rgb({col},{col},{min(255, col + 15)})" stroke="rgb({col},{col},{min(255, col + 15)})" stroke-width="0.4"/>')
        width = (Q[:, 0].max() - Q[:, 0].min() + 0.2) * s
        parts.append(f'<g>{"".join(g)}<text x="{x0 + 5:.0f}" y="14" font-family="sans-serif" font-size="12">{name}</text></g>')
        W += width + 20
    dm = d["dims"]
    txt = (f'47065T845: t={dm["thickness_legA"]:.3f}, width {dm["width"]:.3f}, legs {dm["legA_length_from_outside_face"]:.3f} '
           f'(outside), holes Ø{d["holes"][0]["dia"]:.3f} @ {dm["hole_centre_from_outside_face"][0]:.3f} from outside face, '
           f'{dm["triangles"]} tris')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" viewBox="0 0 {W:.0f} {H:.0f}">'
           f'<rect width="100%" height="100%" fill="#fff"/>{"".join(parts)}'
           f'<text x="10" y="{H - 12:.0f}" font-family="sans-serif" font-size="13">{txt}</text></svg>\n')
    with open(os.path.join(OUT, "bracket-47065T845.svg"), "w") as fh:
        fh.write(svg)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    r = rail()
    print("RAIL", json.dumps({k: v for k, v in r["measured"].items()}, indent=1),
          "area", r["area_in2"], "lb/ft", r["weight_lb_per_ft_6063"])
    b = bracket()
    print("BRACKET", json.dumps(b["dims"], indent=1), json.dumps(b["holes"]), json.dumps(b["bbox"]))
