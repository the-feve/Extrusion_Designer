# Extrusion Designer

Design carts, fixtures and tooling from McMaster-Carr 1-1/2" T-slotted aluminum framing, in the browser. Get a 3D view, a parts list, a cut list with a cutting plan, a printable 2D drawing, and a list to paste into McMaster's order form.

A Quiver Design Works app. Not affiliated with McMaster-Carr.

```
npm install
npm test        # build-logic tests
npm run dev     # http://localhost:4400
npm run build   # static site in dist/ (Cloudflare Pages: output dir dist)
```

How it works: [docs/BUILD-MAP.md](docs/BUILD-MAP.md). Status: [HANDOFF.md](HANDOFF.md).

## What it needs (for anyone setting it up or reviewing it)

Everything runs in the visitor's browser; there is no server, database or account.

| Kind | What | Why / notes |
|---|---|---|
| Runtime library | [three.js](https://threejs.org) 0.186.1 (MIT) | The 3D view. Copied into `dist/vendor/` at build time, so the live site loads nothing from a CDN. It's the only package the page uses. |
| Build / test tools | Node.js 22 and npm | `npm test` (Node's built-in test runner) and `npm run build` (a small copy script). No bundler, no other npm packages. |
| Optional, dev only | Playwright + Chromium | Only for taking screenshots; not needed to build, test or run the app. |
| Optional, dev only | Python 3 with `cadquery-ocp` and `numpy` | Only for `tools/step_extract.py`, which measures a McMaster STEP file you've downloaded yourself. |
| Fonts | Google Fonts (Barlow, Barlow Condensed) | Loaded by the page; it falls back to system fonts without them. |
| Hosting | Cloudflare Pages (free plan), project `extrusion-designer` | Builds `main` with `npm run build`, serves `dist/`. No secrets or environment variables. |
| Parts data | McMaster-Carr part numbers in `app/data/catalog.json`, checked by hand | No McMaster API or account. McMaster's API is for approved business customers only, and their terms don't allow scraping or redistributing their CAD files (details: `docs/research/mcmaster-1.5-series.md`). |

The engine (frame logic, checks, cut list, drawing) is plain JavaScript in `app/engine/` with no dependencies; it runs the same in Node (the tests) and the browser.
