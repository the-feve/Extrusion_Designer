# Extrusion Designer: working rules

- Read `HANDOFF.md` first, then `TODO.md`. **Keep `docs/BUILD-MAP.md` (how the build logic works) up to date** whenever the logic changes, and keep HANDOFF/TODO current.
- A Quiver Design Works app (owner: Matthew Fevergeon). It will launch from quiverdesignworks.net like the other builders (the-feve/quiverdesignworks-site). Zero running cost: static files only, no server.
- Units are inches inside the engine. Parts data lives only in `app/data/catalog.json`; mark anything not checked on mcmaster.com `"verified": false`. Never invent part numbers or prices.
- **Never commit McMaster CAD files (STEP, 2D PDFs) or geometry copied from them**: their terms forbid redistribution and this repo is public. `reference/mcmaster/` and `app/data/geometry/` are git-ignored. Draw shapes from published dimensions (`app/shapes.js`).
- Don't scrape mcmaster.com automatically (their robots.txt and terms); the owner checks part numbers and prices by hand.
- Run `npm test` and `npm run build` before every push. Look at the page (`npm run dev`, http://localhost:4400) after UI changes.
- The owner's budget is tight: batch changes.
- **After a user-visible change ships** (new feature, restyle, new screenshots on quiverdesignworks.net), refresh its page on fevergeon.com: in the-feve/fevergeon-site run the `app-pages` skill (`npm run app-shots -- <app id>`, then fix the page text). New apps also get a trail on its homepage map.
