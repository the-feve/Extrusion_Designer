# Reference files (local only)

Put McMaster STEP files and 2D PDFs in `reference/mcmaster/`. That folder is
git-ignored: McMaster's terms don't allow reproducing or redistributing their
CAD models, and this repo is public. The app draws its own rail and bracket
shapes from McMaster's published dimensions (`app/shapes.js`).

`tools/step_extract.py` reads a local STEP file and writes measurements and a
section/mesh to `app/data/geometry/` (also ignored) so we can check our own
shapes against the real part. It needs `pip install cadquery-ocp numpy`.
