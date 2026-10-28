# TODO

## Owner
- [ ] Check caster mounting height for 47065T336 / 47065T919 (guessed 4") and update `app/data/catalog.json`.
- [ ] Confirm rail part numbers per length (4658N41 family) and whether you want prices shown at all.
- [ ] Test-paste the McMaster list into *Order → Paste products and quantities*.
- [x] Cloudflare Pages project `extrusion-designer` (2026-10-27) and a Beta card in quiverdesignworks.net Apps (2026-10-27).
- [ ] A subdomain (e.g. `extrusions.quiverdesignworks.net`, a custom domain on the Pages project); then change the Apps card's `url` in quiverdesignworks-site and the links on fevergeon.com.
- [ ] Decide: email McMaster (eprocurement@mcmaster.com) for written OK to use part numbers in a public tool?

## Next in the build logic
- [ ] Check the 45° brace geometry (47065T12/27/702/704) against McMaster's drawing via the Parts library; set `verified` and real `width`/reach in `catalog.json`.
- [ ] Risers: a crossbar between two risers (top rail), risers braced across the cart (perpendicular to the rail), risers over a post, a mounting plate on top.
- [ ] Parts library: export/import the whole library as a file to move it between computers (numbers only, or with files for personal use).
- [ ] Plate casters (4304N series: bolt to the rails, no machining). Needs plate size and bolt pattern; bottom rails flush with the post ends, brackets then go on top, so the bottom deck needs notches around them or sits in the slots.
- [ ] Caster pattern: 2 swivel with brake + 2 rigid.
- [ ] Pre-tapped rail option (4601N37 is grooved, 3/8"-16 one end) and McMaster cut-to-length (47065T808 grooved hollow) as a buying option.
- [ ] Mid-span supports for long shelves (cross rail T-joint into the side rails; brackets lie flat, already supported by `autoBracket`).
- [ ] Decks that drop into the T-slots (1/4" panels) instead of sitting on top.
- [ ] Handle (push bar) accessory, end caps on open ends, leveling feet instead of casters.
- [ ] Two brackets per joint option for heavy loads; load/deflection estimate per shelf.
- [ ] More templates: workbench / fixture table, enclosure, 1.5 × 3 rails.

## Outputs
- [ ] Assembly steps sheet (order of rings, sliding the end-feed nuts in first).
- [ ] DXF export of the drawing; an exploded view on the drawing sheet.
- [ ] Hover a part in 3D → its mark and length.
