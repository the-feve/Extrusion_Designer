# Extrusion Designer: working rules

- Read `HANDOFF.md` first, then `TODO.md`. **Keep `docs/BUILD-MAP.md` (how the build logic works) up to date** whenever the logic changes, and keep HANDOFF/TODO current.
- A Quiver Design Works app (owner: Matthew Fevergeon). It will launch from quiverdesignworks.net like the other builders (the-feve/quiverdesignworks-site). Zero running cost: static files only, no server.
- Units are inches inside the engine. Parts data lives only in `app/data/catalog.json`; mark anything not checked on mcmaster.com `"verified": false`. Never invent part numbers or prices.
- **Never commit McMaster CAD files (STEP, 2D PDFs) or geometry copied from them**: their terms forbid redistribution and this repo is public. `reference/mcmaster/` and `app/data/geometry/` are git-ignored. Draw shapes from published dimensions (`app/shapes.js`).
- Don't scrape mcmaster.com automatically (their robots.txt and terms); the owner checks part numbers and prices by hand.
- Run `npm test` and `npm run build` before every push. Look at the page (`npm run dev`, http://localhost:4400) after UI changes.
- The owner's budget is tight: batch changes.
- **After a user-visible change ships** (new feature, restyle, new screenshots on quiverdesignworks.net), refresh its page on fevergeon.com: in the-feve/fevergeon-site run the `app-pages` skill (`npm run app-shots -- <app id>`, then fix the page text). New apps also get a trail on its homepage map.

## HANK (project status)

This project has a status card in the-feve/00_Hank_Projects: the `projects/*.json` file(s)
whose `repos` list this repo (format: `docs/card-format.md` there). Matt reads it at
fevergeon.com/hank/.

- When Matt says **park it**, or before you finish a session that changed anything:
  update HANDOFF.md, then the card: where it's at, the ONE next step, Matt's to-dos
  (keep his ticks), a fresh standalone prompt, this session's id, today's date.
  Follow `.claude/skills/hank/SKILL.md` → *park it* in that repo.
- Cloud session: attach it with `add_repo` (push), clone, pull right before editing (the page
  commits Matt's ticks any time), edit, `node check.mjs --fix`, commit to its `main`.
  On the PC: `C:\Users\matth\repos\00_Hank_Projects`.
- Keep it short and plain: Matt has ADHD and reads it on his phone.
