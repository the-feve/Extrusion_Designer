# Extrusion Designer: Handoff

_Last updated: 2026-10-27 · Owner: Matthew Fevergeon_

The short current state. Read this first, then [TODO.md](TODO.md). Dated session notes: [docs/history.md](docs/history.md). How the build logic works: [docs/BUILD-MAP.md](docs/BUILD-MAP.md). McMaster parts research: [docs/research/mcmaster-1.5-series.md](docs/research/mcmaster-1.5-series.md).

## What this is

A free browser app for designing carts, fixtures and tooling from McMaster-Carr T-slotted aluminum framing (1-1/2" series first). It gives a 3D view, parts list, cut list with a cutting plan, a 2D drawing (SVG, printable to PDF) and a list to paste into McMaster's order form. Same pattern as the Coin Designer and the desk planner: everything runs in the browser, static hosting, no running cost.

## State (v0.1)

- **Cart template**: width, length, height (floor to top of frame, casters included), casters or none, 0–8 intermediate shelves (even or custom heights), decks on top / shelves / bottom, deck thickness, bottom-rail lift, saw kerf.
- **Build logic** (BUILD-MAP → *Cart template*): posts run through; every level is four rails butting into the post faces; one corner bracket per rail end, placed automatically on the first side that fits (under the rail by default); stem casters in the post ends. Checks prove no two parts overlap, every rail end sits flat on its post, every joint has a bracket whose holes land on T-slots, and the frame is one piece. 15 tests (`npm test`).
- **Default 24 × 36 × 30 cart**: 4 posts 26", 4 side rails 33", 4 front/back rails 21" (3 ten-foot sticks), 16 brackets 47065T845, 4 casters 47065T336.
- **Outputs**: parts list + CSV, cut list + CSV + cutting plan, 2D drawing (third-angle views, dimensions, balloons, tables, title block), McMaster paste list, save/open JSON, share link, autosave in the browser.
- **Live at https://extrusion-designer.pages.dev** (2026-10-27), deployed from `main`. Linked from quiverdesignworks.net Apps (Beta) and fevergeon.com `/cad-software/extrusion-designer/`.
- **Exploded view** in the 3D toolbar (BUILD-MAP → *Exploded view*).
- **Resizable layout** (`app/layout.js`): drag the bars between the settings panel, the 3D view and the tabs (double-click or Home resets, arrow keys nudge); **⧉ Float** pops the 3D view or the tabs into a window you drag by its title bar and resize from the corner, *Dock* puts it back. Sizes and windows are remembered per browser; phones keep the stacked layout.
- **Risers** (sidebar → Risers, *+ Add a riser*): vertical rails on any top rail, height and position set per riser, braced with McMaster 45° diagonal braces (6/12/18/24") on either or both sides; the top deck is cut around them; checks refuse risers off the rail, too short for their brace, or braces that run into a post or each other (BUILD-MAP → *Risers*). **Brace geometry is assumed** (1.5" section, outer edge = listed length) until checked against McMaster's drawing.
- **Parts library** tab: drop a McMaster STEP and/or 2D PDF; part number from the file name, overall size from the STEP, confirm against the drawing, save. Kept in that browser only (never uploaded: McMaster's terms). Saved casters appear in the caster list (this is how to replace the 4" guess), rail sticks as stock lengths. *Copy catalog entry* → paste into `catalog.json` to share. Tested with the owner's two STEP files: rail 1.5 × 1.5 × 120, bracket 1.31 × 1.5 × 1.5.
- **README → What it needs**: the packages and services the app uses (three.js only at runtime), for reviewers.
- **Cloudflare Pages project `extrusion-designer`** (created by the owner 2026-10-27), connected to this repo. Build command `npm run build`; the output directory `dist` comes from `wrangler.toml`; Node 22 from `.nvmrc`. No secrets. Each push to a branch makes a preview at `<branch>.extrusion-designer.pages.dev`.

## Things the owner needs to check (unverified data)

1. **Caster mounting height**: 47065T336 / 47065T919 are entered at a guessed 4" floor-to-rail-end. Read the real figure off the McMaster page or 2D PDF; it sets the post length.
2. **Caster stems are 3/8"-16**: the post's 0.262" center hole has to be drilled to 5/16" and tapped 3/8"-16 (the app lists this as end work), or use plate casters (TODO).
3. **Rail part numbers per length**: only 4658N49 = 10 ft is confirmed (from your STEP). The app buys 10 ft sticks.
4. **Paste format**: try a 3-line paste of the *Order from McMaster* tab into McMaster's *Paste products and quantities* box.
5. **Prices**: only the bracket's $9.38 (from your screenshot) is entered. McMaster's terms are strict about reusing their content (research doc → *Terms*), so showing prices is your call; the app works without them.

## McMaster files and terms (important)

McMaster's terms say their CAD models may not be reproduced, redistributed or made available, and their robots.txt blocks automated access. This repo is public, so **the STEP files are not committed** (`reference/mcmaster/` is git-ignored) and the app's rail and bracket shapes are drawn from published dimensions (`app/shapes.js`). A local STEP reader (`tools/step_extract.py`, OpenCascade) measured both parts: every published dimension matched within 0.001"; the rail is 0.880 in² (1.03 lb/ft in 6063). Put new STEP/PDF downloads in `reference/mcmaster/` on your machine.

## Working on it

- `npm install`, `npm test`, `npm run dev` (http://localhost:4400), `npm run build` (→ `dist/`).
- three.js 0.186.1 (same as the Coin Designer) is copied from `node_modules` into `dist/vendor/` by the build; no CDN.
- In the browser console, `extrusionDesigner.current` holds the last design, checks and BOM.
