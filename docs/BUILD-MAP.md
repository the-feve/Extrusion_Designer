# Build map: how Extrusion Designer works

_Keep this up to date whenever the build logic changes. Last updated 2026-10-27._

The app turns a few numbers (cart size, casters, shelves) into a frame made
of McMaster-Carr 1-1/2" T-slotted rail, proves it can be built, and produces a
3D view, a parts list (BOM), a cut list with a cutting plan, a 2D drawing and
a list to paste into McMaster's order form. Everything runs in the browser:
there is no server, so hosting is free (Cloudflare Pages, static files).

## Repo map

| Path | What it is |
|---|---|
| `app/index.html`, `app/styles.css` | The page (Trail & Workshop look, dark, like the other Quiver builders) |
| `app/main.js` | Form ↔ parameters, runs the engine on every change, fills the tabs, save/share/open |
| `app/view3d.js` | three.js view: rails, brackets, casters, decks; issue highlighting |
| `app/shapes.js` | **Our own** rail section and bracket profile, drawn from McMaster's published dimensions |
| `app/data/catalog.json` | Profiles and parts: part numbers, sizes, prices (only owner-checked ones), `verified` flags |
| `app/engine/units.js` | Inch formatting (fractions, ft-in, mm) and parsing what people type |
| `app/engine/geom.js` | Axis-aligned boxes: overlap, contact, "rectangle lies on a face" |
| `app/engine/frame.js` | The frame model: members, butt joints, bracket placement, stem casters, panels |
| `app/engine/cart.js` | Cart template: parameters → members, decks, joints, brackets, casters |
| `app/engine/validate.js` | The checks (below) |
| `app/engine/bom.js` | Cut list (marks A, B, C…), stock plan, hardware list, BOM lines |
| `app/engine/drawing.js` | The 2D drawing (SVG) |
| `app/engine/export.js` | CSVs, the McMaster paste list, design JSON |
| `test/cart.test.js` | Build-logic tests (`npm test`) |
| `scripts/build.mjs`, `scripts/serve.mjs` | Static build to `dist/`; local preview at :4400 |
| `tools/step_extract.py` | Reads a **local** McMaster STEP to measure it (output is git-ignored) |
| `docs/research/` | McMaster catalog research (part numbers, casters, ordering, terms) |
| `reference/` | Local-only McMaster files (git-ignored; see its README) |

## Coordinates and units

- Inches everywhere inside the engine. x = width, y = length, z = up; origin on
  the floor under the front-left corner of the frame.
- Every solid is an axis-aligned box (`{min, max}`). A rail is one box; a
  bracket is two (one per leg); a caster one; a deck one to three (notched).
  Boxes are exact for rails and a little generous for brackets and casters,
  so the clash check errs on the safe side.
- "Touching" is allowed; any overlap thicker than `TOL` = 0.001" is a clash.

## The frame model (frame.js)

- **Member**: a rail with `profile`, `axis`, `origin` (min corner), `length`,
  `role` (post, rail-x, rail-y), `level` and a `name`.
- **Butt joint**: rail R's end bears on a side face of member P. `contact` is
  true only when R's whole end face lies on P's face and P is beyond the end
  (so the rail stops at the face, never inside it).
- **Corner bracket** on a joint, on the rail face with outward normal (k, ±):
  - leg A lies on the rail, running away from the joint;
  - leg B lies on P's face, running away from the rail.
  - It **fits** only if leg A sits on the rail, leg B sits wholly on P's face
    (not hanging past P's edge or end), and both holes land on a T-slot
    centreline. Slots on this series run down the middle of every 1.5" of
    face width (0.75, 2.25, ...).
  - `autoBracket` tries sides best-first: under the rail (−z) then over it
    (+z), then the horizontal sides, and takes the first that fits and
    doesn't hit anything already placed (rails, decks, other brackets). Each
    refusal is recorded ("−z: leg would hang off the mating rail") so the
    checks can say why a joint has no bracket.
- **Stem caster**: screws into the tapped end of a vertical member; its body
  box runs from the end to the floor. Adds an end-work op to that member
  ("Drill and tap bottom end 3/8"-16").
- **Panel** (deck): one to three boxes plus a 2D outline.

## Cart template (cart.js)

Construction: **posts run through**.

1. Four posts run the full frame height. With casters, the frame starts at
   the caster's mounting height: `post length = height − caster mount height`.
2. Levels, bottom to top: Bottom, Shelf 1..n, Top. Each level is a ring of
   four rails that **butt into the post faces**:
   - front/back rails (along x): `width − 2 × 1.5"`
   - side rails (along y): `length − 2 × 1.5"`
   At a corner the x rail and the y rail meet different faces of the post, so
   they never touch each other.
3. Top rails are flush with the post tops (rail top = height).
4. Bottom rails sit `bottomLift` above the post ends, default **one bracket
   leg (1.5")**, so the post continues below them and their brackets can go
   underneath like every other level. With `bottomLift = 0` the brackets have
   to go on top of the bottom rails, and a bottom deck then can't fit (the
   checks say so).
5. Shelves: evenly spaced between the bottom and top rails, rounded to 1/2",
   or set by hand (floor to the top of each shelf's rails).
6. **Shelf spacing rule**: a level needs at least
   `rail 1.5" + deck thickness (if the level below has one) + bracket leg 1.5"`
   above the level below it (3.75" with 3/4" decks), because its brackets
   hang under its rails.
7. Decks sit on top of a level's rails, the full outside size. Below the top
   they're notched 1.5" square at the corners for the posts; the top deck is
   a plain rectangle sitting on the post tops and adds its thickness to the
   overall height (noted on the drawing).
8. Decks are placed **before** brackets, so a bracket never lands in a deck.
9. One bracket per rail end (8 per level). Casters: one per post.

Default cart: 24 × 36 × 30 in on 47065T336 stem casters → posts 26" (B),
side rails 33" (A), front/back rails 21" (C); 16 brackets; 3 ten-foot sticks.

## Checks (validate.js)

| Check | Level |
|---|---|
| Any two solids overlap (rail, bracket leg, caster, deck) | error |
| A member has no length, or is longer than a 10 ft stick | error |
| A rail end doesn't sit flat and fully on the member it butts into | error |
| A joint has no bracket (with the reasons each side was refused) | error |
| A bracket's legs or holes don't fit (re-checked) | error |
| A member end is both joined and carrying a caster | error |
| A member end touches another member without a joint | warning |
| An open end, or one under a deck | info |
| The frame is in more than one piece (joint graph) | error |
| Template-level: too small, levels too close, level outside the posts | error |

The tests build carts from 18 × 24 × 36 to 30 × 48 × 42 with 0 to 4 shelves
and re-check every pair of solids independently.

## Outputs (bom.js, drawing.js, export.js)

- **Cut list**: members grouped by profile, length (rounded to 1/32") and end
  work; marked A, B, C… longest first. The marks go onto the members so the
  drawing's balloons match.
- **Stock plan**: fills one stick at a time with the set of remaining pieces
  that uses the most of it (a subset-sum in 1/32" steps), n pieces taking
  n − 1 kerfs (default 1/8"). Beats first-fit (4 sticks instead of 5 on the
  one-shelf cart).
- **BOM**: rail sticks, then hardware grouped by part number (brackets include
  their fasteners), decks listed separately (not from McMaster). Prices only
  where known; the total says how many lines still need one.
- **Drawing**: one ANSI B sheet (17 × 11). Third-angle front, right side and
  top views (painter's order, decks dashed in the top view), overall
  dimensions from the frame (not caster footprints), a height column per
  level (floor to rail top), the caster mount height, balloons in columns
  beside the views (letters = cut marks, numbers = parts list), cut list,
  parts and deck tables, assembly notes, title block. Scale picked from
  1:1 … 1:48 to fit.
- **McMaster list**: `PARTNUMBER<TAB>QTY` per line for McMaster's
  *Order → Paste products and quantities* box. Lines without a part number
  are left out and listed under the box, never silently dropped.

## Lessons carried over from the other builders

- **Browser-only, no server cost** (Coin Designer): geometry in the browser,
  static hosting; the owner's budget aims at zero running costs.
- **One source of truth for parts** (quiverdesignworks-site `products.json`):
  part numbers and sizes live in `catalog.json`, never in the UI code.
- **Bounding-box clash checks + a parts list + save in the browser + share by
  link + export JSON** (desk-org-builder's planner).
- **Keep part names and marks stable** (desk builder): marks are recomputed
  from lengths, so the same design always gets the same marks.
- **CSV formula guard** (order desk): cells starting with = + - @ are quoted.
- **Measure, don't guess**: unverified catalog values are flagged in the data
  and shown as "(unverified)" in the parts list until the owner checks them.
- **Don't redistribute vendor CAD** (new here): McMaster's terms forbid it, so
  our shapes are drawn from published dimensions.

## Not built yet

See TODO.md: plate casters (no machining), cut-to-length and pre-tapped rail
options, mid-span supports, panels in the slots, more templates (fixture
table, workbench), DXF/PDF drawing export.
