# McMaster-Carr 1.5" T-slotted framing: parts research and scoping

Checked on 2026-10-27. Scope: inch "1-1/2" series" (0.32" T-slot, 5/16"-18 fasteners), aimed at the first example (a 24" W × 36" L × 30" H cart on casters with optional shelves).

## How to read this

- **verified**: confirmed from the owner's screenshots, the owner's STEP files, or a McMaster page read on 2026-10-27.
- **web-summary**: read from a McMaster category page on 2026-10-27. The page text went through an automated summarizer, so part numbers are probably right but should be checked once on the live page before we ship them. **Treat these as unverified.**
- **archive-2019**: from a 19-page printout of mcmaster.com/t-slotted-framing dated 2019-02-04 (source S8). The part numbers were real then. **Its prices are seven years old**; they are only a rough guide and must not be shown as current prices.
- **guess**: my own estimate, labeled as one. Never use it as catalog data.
- A blank cell means unknown. I did not invent any part numbers or prices.

### Sources

| Id | Source | What it gave |
|---|---|---|
| S1 | Owner's screenshots (as relayed by the lead agent) | 4658N41 rail specs; 47065T845 bracket specs and $9.38 price |
| S2 | `reference/mcmaster/4658N49_T-Slotted_Framing_Rail.STEP`, `reference/mcmaster/47065T845_Silver_Corner_Bracket.STEP` | Measured geometry (bounding box, hole radii) |
| S3 | https://www.mcmaster.com/products/slotted-framing/t-slotted-framing-component~rail/ | Current rail tables (web-summary) |
| S4 | https://www.mcmaster.com/products/aluminum-extrusion-casters/ | Current caster tables (web-summary) |
| S5 | https://www.mcmaster.com/products/t-slotted-framing-feet/ | Current feet/caster/end-cap tables (web-summary) |
| S6 | https://www.mcmaster.com/products/t-slotted-framing-end-caps/ | Current end caps (web-summary) |
| S7 | https://www.mcmaster.com/products/t-slotted-framing-bases/ | Pre-built bases/shelves (web-summary) |
| S8 | https://downloads.psl.noaa.gov/Projects/MOSAiC/documents/purchases/T-slots/T-Slotted%20Framing%20_%20McMaster-Carr.pdf | 2019-02-04 printout of the whole T-slotted framing catalog page, with part numbers and 2019 prices (archive-2019) |
| S9 | https://www.mcmaster.com/termsandconditions/ | Terms of use (scraping, CAD, API) |
| S10 | https://www.mcmaster.com/robots.txt | Crawler rules |
| S11 | https://www.mcmaster.com/help/api/ | McMaster product/price API (approved customers) |
| S12 | https://github.com/mvernacc/solidworks2mcmaster (README) | "Order → Paste products and quantities" workflow |
| S13 | https://reprap.org/forum/read.php?1,31855 | Older community paste-list format (`qty partnumber` per line) |

Fetching notes: individual product pages (`mcmaster.com/<pn>/`) come back as an empty JavaScript shell with no data. Many category pages (`/products/...`) are pre-rendered and include part numbers and specs **but no prices**; the price cells are blank quantity boxes. Prices only appear when the page runs in a real browser.

---

## 1. Rails

### 1a. Facts measured from the owner's files (verified, S1/S2)

| Item | Value | Source |
|---|---|---|
| 4658N41 name | T-Slotted Framing Rail, Single Four Slot, Smooth, Silver, 1-1/2" High × 1-1/2" Wide | S1 |
| Lengths offered for 4658N41 | 1, 2, 3, 4, 5, 6, 8, 10 ft | S1 |
| T-slot width / depth | 0.32" / 0.484" | S1; S3 (the "0.32" x 0.484" T-slot" column) |
| Center hole | 0.262" (tap drill for 5/16"-18) | S1; S2 (circle radius 0.131") |
| Alloy | 6063-T6 | S1 |
| 4658N49 is the 10 ft length | **Verified**: the STEP model measures 1.500" × 1.500" × 120.000" | S2 |
| Construction | Hollow (S3 lists 4658N41 as "Smooth, Hollow, Silver Anodized") | S3 web-summary |

The other length part numbers in the 4658N4x family are **unknown**. They might run 4658N42…4658N49, but that is a guess and none of them should be used until it is checked. On the live page, hovering or clicking each length cell shows its part number.

### 1b. 1-1/2" × 1-1/2" single four-slot rails, fixed lengths (S3, web-summary)

The S3 length columns are 1/2, 1, 1-1/2, 2, 3, 4, 5, 6, 8 and 10 ft. The summarizer could not tie each length to its own part number, so only the row's base part number is listed.

| Base PN | Texture | Construction | Color | Lengths | Price | Notes |
|---|---|---|---|---|---|---|
| 4658N41 | Smooth | Hollow | Silver | 1–10 ft (S1) | | **This is the rail for our app** (owner's choice) |
| 47065T102 | Grooved | Hollow | Silver | 1/2–10 ft | | archive-2019 prices: 1 ft $7.18, 2 ft $13.98, 3 ft $20.30, 4 ft $25.25, 5 ft $31.32, 6 ft $36.99, 8 ft $48.42, 10 ft $57.82 |
| 47065T103 | Grooved | Solid | Silver | 1/2–10 ft | | archive-2019: 1 ft $10.30 … 10 ft $67.73 |
| 47065T507 | Grooved | Hollow | Black | | | archive-2019 lists it |
| 47065T399 | Grooved | Solid | Black | | | archive-2019 lists it |
| 4544N63 | Grooved | Solid | Yellow | | | |
| 47065T508 | Grooved | Hollow | Yellow | | | |
| 6651N11 | Smooth | Solid | Black fiberglass-reinforced polyurethane ("High-Strength") | 1/2–10 ft | | Plastic, not aluminum |
| 3136N72 | Smooth | Hollow | Silver | 1"–11" short pieces ("Sold per Inch") | | Pre-cut short lengths |

In 2019, McMaster used **one part number per profile** with a length column (e.g., 47065T102 for every length). The owner's screenshot shows a separate part number for each length. Which convention the 4658N family uses still needs to be checked.

### 1c. Cut-to-length rail (S3, web-summary; archive-2019 prices)

S3 says: "Order custom lengths of our most common rail, available in 1/8" increments." Prices are in two quantity tiers, "1-23" and "24-Up" pieces.

| PN | Texture | Construction | Color | Length range | Price per inch | Source |
|---|---|---|---|---|---|---|
| 47065T808 | Grooved | Hollow | Silver | 2"–240" | ($0.69/in in 2019) | S3, S8 |
| 47065T802 | Smooth (S3) | Solid | Silver | 1"–240" | ($1.00/in in 2019) | S3, S8 |
| 6575N365 | Grooved | Solid | Black | 3/4"–240" | | S3 |
| 47065T812 | Grooved | Hollow | Black | 2"–240" | ($0.87/in in 2019) | S3, S8 |
| 6575N366 | Grooved | Solid | Yellow | 3/4"–240" | | S3 |
| 47065T813 | Grooved | Hollow | Yellow | 2"–144" | ($1.19/in in 2019) | S3, S8 |
| 47065T984 / 47065T993 | Hollow / Solid | | Silver | sold per cm | ($0.27 / $0.39 per cm in 2019) | S8 (metric-length version) |

**Important: no smooth hollow cut-to-length version of 4658N41 was found.** The smooth cut-to-length rail (47065T802) is solid, which makes it heavier and more expensive per inch.

| Question | Answer |
|---|---|
| Cut increment | 1/8" (S3, web-summary) |
| Max length | 240" (20 ft) for most; 144" for yellow hollow (S3) |
| Cutting charge | **Unknown.** No cut fee is listed in S3 or S8. The 2019 price looks like a plain per-inch price; the live page should show whether a per-cut fee exists. |
| Length tolerance | **Unknown.** Not stated in S3. |
| Max length of a fixed-length rail | 10 ft |

### 1d. Rails with machined ends (S3, web-summary)

This is the "end tapping service" equivalent. McMaster sells these as separate rail products, not as an add-on to any rail. **All the ones found are grooved hollow rails; none are the smooth 4658N profile.**

| PN | Machining | Thread / hole | Depth | Lengths | Notes |
|---|---|---|---|---|---|
| 4601N37 | Tapped center hole, **one end** | **3/8"-16** | 1-1/4" | 1–5 ft columns seen | Matches the stem casters and leveling feet (3/8"-16) |
| 4601N31 | Tapped center holes, **both ends** | 5/16"-18 | 1" | | For end brackets / anchors |
| 4601N51 | Access hole, one end | 0.295" dia. | | | For anchor/concealed fasteners |
| 4601N64 | Access holes, both ends | 0.295" dia. | | | |
| 4601N17 | Bore hole, one end | 0.813" dia. | | | |
| 4601N11 | Bore holes, both ends | 0.813" dia. | | | |

S3 notes that if you need a shorter rail, you can cut down the end without the hole.

### 1e. 1-1/2" × 3" double six-slot rails (S3, web-summary)

McMaster lists these as "3" high × 1-1/2" wide." Six T-slots, 0.32" slot.

| Base PN | Texture | Construction | Color | Price |
|---|---|---|---|---|
| 4658N31 | Smooth | Hollow | Silver | |
| 47065T108 | Grooved | Hollow | Silver | |
| 47065T109 | Grooved | Solid | Silver | |
| 47065T882 | Grooved | Hollow | Black | |
| 47065T599 | Grooved | Solid | Black | |

A cut-to-length double six-slot section exists on S3, but the 1-1/2" × 3" rows were cut off in the fetched text, so they are unknown.

---

## 2. Brackets, joining plates and fasteners

**Prices.** Only 47065T845 has a current price ($9.38, S1). The 2019 price for the same bracket was $5.77, so today's prices are roughly 1.6× the 2019 figures for that item. Treat every "2019 $" below as stale.

**Part numbers.** Everything in this section except 47065T845 comes from the 2019 archive (S8). Each part number needs to be checked on the live site: some may have been replaced or discontinued.

### 2a. Corner brackets for single 1-1/2" rails (archive-2019 S8, unless noted)

All of these "connect rails without machining" and include mounting fasteners.

| Type | Leg length | Silver PN | Black PN | 2019 $ silver / black | Notes |
|---|---|---|---|---|---|
| Corner (2-hole) | 1-1/2" | **47065T845** | 47065T833 | 5.77 / 6.27 | **Current price $9.38 each (S1, verified).** 1.31" wide, 0.25" thick, 0.328" holes 0.75" from the end (S1, matches S2). Includes 2 end-feed 5/16"-18 flanged screw-and-nut sets, black (S1). |
| Extended corner (4-hole) | 3" | 47065T241 | 47065T312 | 6.26 / 10.70 | This is the "3" two-hole-per-leg" bracket |
| Gusset | 1-1/2" | 47065T679 | 47065T695 | 7.58 / 8.83 | Resists racking; good for cart frame corners |
| Extended gusset | 3" | 47065T762 | 47065T798 | 11.92 / 13.89 | |
| Outside corner (end bracket) | 1-1/2" | 47065T243 | | 7.84 | **Needs tapped rail ends** |
| Three-way outside corner | 1-1/2" | 47065T245 | | 10.78 | Needs tapped holes |

Inside-corner brackets: the current filters include "Open Gusset," "Adapter" and "Reducer" types, but no specific 1-1/2" inside-corner part number was found.

### 2b. Surface brackets (flat joining plates; archive-2019 S8)

All of these include fasteners and need no machining.

| Shape | Length | Silver PN | Black PN | 2019 $ |
|---|---|---|---|---|
| Straight | 3" | 47065T256 | 47065T834 | 6.39 / 6.84 |
| Extended straight | 6" | 47065T261 | 47065T314 | 6.66 / 11.06 |
| Corner (L) | 4-1/2" | 47065T271 | 47065T318 | 8.77 / 14.36 |
| Tee | 4-1/2" | 47065T279 | 47065T316 | 9.16 / 15.23 |
| 30° | 3-1/2" | 47065T32 | 47065T393 | 11.57 / 12.61 |
| 45° | 4-1/2" | 47065T309 | 47065T447 | 11.99 / 13.12 |
| 60° | 4-1/2" | 47065T366 | 47065T467 | 11.99 / 13.34 |
| Reducer, 1" to 1-1/2", straight | 2-1/2" | 47065T298 | | 6.39 |
| Reducer, 1" to 1-1/2", offset | 2-1/2" | 47065T228 | | 7.25 |

### 2c. Braces (archive-2019 S8)

All include fasteners.

| Type | Length | Silver PN | Black PN | 2019 $ |
|---|---|---|---|---|
| Corner brace (1-1/2", 40 mm) | 2" | 5537T51 | | 7.98 |
| Diagonal | 6" | 47065T12 | 47065T455 | 16.00 / 21.57 |
| Diagonal | 12" | 47065T27 | 47065T456 | 19.91 / 27.87 |
| Diagonal | 18" | 47065T702 | 47065T457 | 20.84 / 28.42 |
| Diagonal | 24" | 47065T704 | 47065T458 | 22.77 / 33.49 |
| Diagonal brace ends (pack of 2; you supply the connecting rail) | | 47065T332 | | 19.77 / pk |

### 2d. Hidden connectors (archive-2019 S8)

All of these list "Mounting fasteners included: Yes."

| Type | Machining needed | PN | 2019 $ |
|---|---|---|---|
| Straight (slides in the slot) | None | 5537T294 (1-1/2", 40 mm) | 6.30 |
| L-shaped (slides in the slot) | None | 5537T316 (1-1/2", 30 mm, 40 mm) | 3.56 |
| Tee (threads into the slot) | None | 47065T339 | 10.55 |
| Concealed | Tap 1 hole in the end + drill 1 access hole | 47065T156 | 1.91 |
| Anchor | Drill 1 hole in the rail face | 47065T154 | 3.89 |
| Double anchor (end-to-end) | Drill a hole in each rail | 5537T272 | 8.62 |

### 2e. Fasteners sold separately (archive-2019 S8)

All are 5/16"-18. A "Pkg" price is for the pack size shown.

| Type | PN | Material | Thread length | Pack | 2019 $ |
|---|---|---|---|---|---|
| End-feed single, flanged | 47065T97 | Black zinc-plated steel | 11/16" | 4 | 2.71 / pk |
| End-feed single | 47065T145 | 302 stainless | 5/8" | 4 | 4.51 / pk |
| End-feed compact head | 47065T215 | Black zinc-plated steel | 5/8" | 4 | 2.38 / pk |
| End-feed dual | 47065T149 | Black zinc-plated steel | 11/16" | 4 | 6.76 / pk |
| End-feed triple | 47065T99 | Black zinc-plated steel | 11/16" | 4 | 10.15 / pk |
| Drop-in with handle | 47065T152 | Zinc-plated steel | 11/16" | each | 2.48 |
| Drop-in spring-loaded ball | 47065T327 | Zinc-plated steel | 11/16" | each | 1.21 |
| Drop-in spring tab | 47065T229 | Zinc-plated steel | 11/16" | each | 1.46 |
| Drop-in with stud | 47065T234 | Zinc-plated steel | 31/32" | each | 1.58 |

Sold-separately T-nuts and plain bolts (nut only, screw only) appear as current filter options ("Fastener Type: Nut, Screw, Screw and Nut Set"; nut types such as Hammer, Spring Tab, etc.). No specific 1-1/2" part numbers were captured for them.

**Pack quantities matter for ordering.** Fasteners are often sold in packs of 4, so the order list must show **packs**, not pieces (see §5).

### 2f. Mounting plates (archive-2019 S8)

| Size (W × L × thickness) | PN | 2019 $ |
|---|---|---|
| 3" × 1-1/2" × 1/4" | 47065T853 | 12.14 |
| 4" × 1-1/2" × 1/4" | 47065T649 | 12.32 |
| 3" × 3" × 1/4" | 47065T854 | 12.56 |
| 4" × 4" × 1/4" | 47065T652 | 13.71 |

---

## 3. Casters for 1-1/2" rails (S4/S5 web-summary; S8 archive)

### 3a. How each type attaches

| Type | How it attaches | Machining | Source |
|---|---|---|---|
| Threaded-stem swivel | "Screw the stem of these casters into a tapped hole on the end of a vertical T-slotted rail." | **Needs a 3/8"-16 tapped center hole in the rail end.** The standard center hole is 0.262" (5/16"-18 tap drill), so it must be drilled out and tapped 3/8"-16. Alternatively, buy rail 4601N37, which comes pre-tapped 3/8"-16 at one end. Tap part number given: 2521A623 (its description was not checked). | S4, S3 |
| Plate caster (single rails) | "Sized to mount directly to T-slotted rails with the included fasteners." The 2019 text says plate casters for single rails need **no** tapping; only the 70 lb plate caster needed 2 tapped holes. | Probably none: they bolt with T-slot fasteners. Exactly which face and slot they bolt to is **unverified**. | S4, S8 |
| Side-mount swivel | "Install on the side of vertical T-slotted rails without needing to tap holes." Fasteners included. | None | S4 |
| Corner-mount plate caster | Fasteners included. Which caster size goes with which rail is unclear in S4. | | S4 |

### 3b. Caster tables (web-summary S4/S5)

Wheel sizes and capacities below are from S4/S5. **Mounting height (floor to mounting surface) is not on the category pages, so every one of those cells is blank.** It appears on each product's detail page or 2D PDF, which the owner can download.

**Threaded-stem swivel, wheel brake**

| PN | Wheel | Material | Capacity (lb) | Thread | Stem length | Mount height | 2019 $ |
|---|---|---|---|---|---|---|---|
| 47065T336 | 3" | Rubber | 125 | 3/8"-16 | 1-1/2" | | 10.65 |
| 47065T919 | 3" | Rubber | 200 | 3/8"-16 | 1-1/2" | | |

**Plate casters, standard, for single rails (fasteners included)**

| PN | Type | Wheel | Material | Capacity (lb) | Brake/lock | Mount height | 2019 $ |
|---|---|---|---|---|---|---|---|
| 4304N17 | Rigid | 3" | Rubber | 140 | — | | |
| 4304N14 | Rigid | 3" | Polyurethane | 140 | — | | |
| 4304N28 | Rigid | 4" | Rubber | 270 | — | | |
| 4304N25 | Rigid | 4" | Polyurethane | 240 | — | | |
| 5537T437 | Rigid | 4" | Polyurethane | 265 | — | | 38.40 |
| 4304N42 | Swivel | 3" | Rubber | 140 | Wheel brake | | |
| 4304N38 | Swivel | 3" | Polyurethane | 140 | Wheel brake | | |
| 4304N53 | Swivel | 4" | Rubber | 150 | Wheel brake | | |
| 4304N49 | Swivel | 4" | Polyurethane | 155 | Wheel brake | | |
| 5537T435 | Swivel | 4" | Polyurethane | 265 | Total lock (wheel and swivel) | | 53.78 |

**Easy-roll plate casters for single rails (fasteners included)**

| PN | Type | Wheel | Material | Capacity (lb) | Brake |
|---|---|---|---|---|---|
| 4304N22 | Rigid | 3" | Rubber | 270 | — |
| 4304N19 | Rigid | 3" | Polyurethane | 240 | — |
| 4304N33 | Rigid | 4" | Rubber | 270 | — |
| 4304N31 | Rigid | 4" | Polyurethane | 250 | — |
| 4304N46 | Swivel | 3" | Rubber | 270 | Wheel brake |
| 4304N44 | Swivel | 3" | Polyurethane | 240 | Wheel brake |
| 4304N57 | Swivel | 4" | Rubber | 270 | Wheel brake |
| 4304N55 | Swivel | 4" | Polyurethane | 250 | Wheel brake |

**Side-mount swivel casters (3" wheel, 140 lb, fasteners included)**

| PN | Material | Stem length | Brake |
|---|---|---|---|
| 4304N66 | Rubber | 1" | Wheel brake |
| 4304N73 | Rubber | 6-1/8" | — |
| 4304N63 | Polyurethane | 1" | Wheel brake |
| 4304N69 | Polyurethane | 6-1/8" | — |

**Corner-mount plate casters**: 4304N207 and 4304N208. Rubber, 250 lb, total lock, fasteners included. Which one fits 1-1/2" single rails is **unclear**.

**Guess (not data):** typical overall heights are about 4" for a 3" stem caster and about 5"–5-1/2" for a 4" plate caster. The app must not use these numbers. The build logic should take the caster's mounting height as an input until real values are recorded.

### 3c. Recommended default for the 24 × 36 × 30 cart

- **Recommendation:** four plate casters (e.g., 2 × 4304N53 swivel with brake + 2 × 4304N28 rigid, or 4 × swivel), bolted under the bottom frame with the included fasteners. This needs no machining, and the 140–270 lb ratings are ample.
- **Alternative:** stem casters (47065T336). They need the leg ends tapped 3/8"-16, which means drilling and tapping by the customer or buying 4601N37 (but that rail is grooved, not smooth). The stem caster's capacity is also lower (125 lb).
- **To keep the frame height correct**, the build logic needs, for each caster: `mountHeightIn` (floor to the surface the caster bolts to), `mount` ("plate" | "stem" | "side"), `thread`, and `requiresTap`. Leg length = 30" − mount height − any top-rail stack-up.

---

## 4. Feet, end caps, slot covers, panels and shelves

### 4a. Feet and leveling mounts (S5 web-summary; 2019 $ from S8)

| PN | Type | Size | Capacity | Attachment | 2019 $ |
|---|---|---|---|---|---|
| 47065T843 / 47065T713 | Fixed foot, silver / black | 5" long | | Bolts to the rail; fasteners included | 14.60 / 14.62 |
| 47065T869 / 47065T387 | Adjustable-height foot, silver / black | 4-3/4" long; adds 0–1-3/4" (S5) or 0–2" (S8) | | Fasteners included | — / 24.94 |
| 47065T342 | Leveling mount, antislip | 3" long, 2" stem | 2,800 lb | **3/8"-16 stem into a tapped rail end** | 7.89 |
| 47065T909 | Leveling mount, stay-put | 4-1/8" long, 3" stem | 5,000 lb | 3/8"-16 | |
| 47065T917 | Leveling mount, vibration-damping | 3-1/2" long, 2" stem | 200 lb | 3/8"-16 | |
| 3136N146 | Base plate | 5-3/8" long | | | |
| 47065T319 | Post base plate | 3-15/16" long | | | |
| 3136N517 | Locking collar | 3" × 3", 5/16"-18 tap | | | |

### 4b. End caps and slot covers

| PN | Item | Notes | Source |
|---|---|---|---|
| 3136N21 | End cap for single 1-1/2" rails | Push-in ABS; gray, black, yellow or blue | S6 |
| 3136N273 | End cap, radius two-slot single | Push-in, black | S6 |
| 3136N533 | End cap, low-profile one-slot | Push-in, black | S6 |
| 47065T87 | Snap-on end cap, 1-1/2", black | 2019 $1.50; may have been replaced by 3136N21 | S8 |
| 47065T4 | Dust (slot) cover, 6 ft | Cut with scissors and press into the slot. Several colors. Flipped over, it has a groove that holds a panel. 2019 $4.27 | S8 |
| 47065T837 / 47065T839 | UHMW wear strip, 3 ft / 6 ft | 2019 $33.22 / $58.20 | S8 |
| 47065T721 | Antislip cover, 6 ft | 2019 $17.88 | S8 |
| 5537T871 | Panel gasket, 78-3/4" | Holds panels in the slot and seals out liquid and dust. 2019 $8.68 | S8 |

### 4c. Panels and shelves

- **Panels that drop into the slot.** In 2019, McMaster sold 1/4"-thick acrylic and polycarbonate panels (e.g., 2 × 2 ft acrylic 47065T321, polycarbonate 47065T325), 1/8" perforated aluminum (47065T901…904) and 1/8"-wire steel mesh (47065T287…295) (S8).
- **Fit in the slot (calculated, not a McMaster statement).** The 0.32" slot opening means a 1/4" (0.25") panel slides into the slot with clearance. Thinner panels (1/8") are held with the panel gasket (5537T871) or the flipped dust cover (47065T4). S3/S5 list "Panel," "Panel Hanging Bracket" and "Shelf" components, but no current 1-1/2" panel part numbers were captured.
- **Panel hangers (S8, 2019):** 47065T196 (solid panels, aluminum, fasteners included), 47065T198 (mesh panels), 47065T252 (plastic, for panels up to 3/8" thick).
- **Pre-built shelves and bases (S7):** shelves 5001N201/202/203 (48/60/72" × 15", black, screw-on) are for workbench uprights, not our cart. Base kits 3136N502 (24 × 24 × 34") and 3136N503 (36 × 36 × 34") are useful as reference designs.
- **For the cart's intermediate shelves, the simplest buy is** a plywood or HDPE sheet cut by the customer, resting on the shelf-frame rails, or a 1/4" panel set into the slots. The app should list shelf panels as "customer-supplied, W × L × thickness" unless a McMaster panel size fits exactly.

---

## 5. Getting a parts list into a McMaster order

| Method | Status | Notes |
|---|---|---|
| Paste a list | **Exists** (S12 and S13, community sources). On mcmaster.com: **Order → "Paste products and quantities"** (S12). | One item per line. S13 (old) shows `qty partnumber`, e.g. `2 5972K501`. The current accepted formats (part number then quantity, tab or space separated) are **unverified**. The owner should paste a 3-line sample once and record what works. |
| CSV/Excel import | Not found | |
| URL that pre-fills a cart | Not found | No documented URL scheme. Building one from reverse-engineered internal endpoints would conflict with the terms (S9). |
| API (S11) | Approved business customers only: client certificate, subscription caps and daily limits. Apply via eprocurement@mcmaster.com. | Covers product info, prices and CAD. Ordering is not described. The terms make data **internal to your company only** and require written consent to share it with third parties, so it doesn't suit a free public app. |
| eProcurement / punchout | Exists for enterprise buyers (`/eprocurement` link) | Not relevant for individuals |

**Recommended export format.** A plain-text block with one line per part, `PARTNUMBER<TAB>QTY`, plus a "Copy for McMaster" button. Next to it, give the steps: open mcmaster.com → Order → Paste products and quantities. Also offer a CSV (`part_number,qty,unit,description,cut_length_in,notes`) for the customer's own records.

- **Quantity unit:** QTY must be in McMaster's selling unit: **packs** for fastener packs (a pack of 4 means 1 pack per 4 pieces, rounded up), **inches** for cut-to-length rail if that's how McMaster takes the quantity (unverified), and pieces otherwise.
- **Cut-to-length lines:** the length is entered on McMaster's page, not in the paste box (unverified). The UI should list cut lengths separately and tell the user to set them after pasting.
- **Line-format toggle:** keep the line format switchable (`PN<TAB>QTY` vs `QTY PN`) until the owner confirms which one works.

---

## 6. Scoping: what we can pull automatically and what needs the owner

### 6a. McMaster's terms and robots.txt (verified 2026-10-27, S9/S10)

These affect how the whole app is built.

- **robots.txt** opens with: "McMaster-Carr content may not be used to train or fine-tune artificial intelligence or machine-learning technology." It **disallows everything for `ClaudeBot`**, GPTBot and other AI crawlers. For other crawlers, `/products/` is allowed but many utility paths are disallowed (e.g. `/*/pdf`, `/orders`).
- **Terms, "Prohibited Uses" (S9):**
  - (i) no copying, mirroring or archiving of Content;
  - (ii) no commercial exploitation;
  - (iii) no scraping or harvesting unless the bot identifies itself as a "robot" or "bot" in its user agent, and **even then** no building of "a similar, competitive or replacement product, database, or service" and no external price comparison;
  - (iv) no use for training AI;
  - (xiii) no framing of their content.
- **CAD models (S9):** they are provided to help you decide whether to buy, and you "shall not reproduce, display, retain copies of, redistribute or make available the CAD Models" to third parties. **This means the two McMaster STEP files under `reference/mcmaster/` must not be committed to a public repo or served by the app.** Keep them local or gitignored, and draw our own simplified geometry from measured dimensions instead.
- **Linking (S9):** linking to the home page is allowed if it doesn't imply endorsement. Deep links aren't addressed. Linking to product pages is common practice, but it is not explicitly permitted.

**What this means for us.** A public app that ships a database of McMaster part numbers, specs and prices sits close to the "competitive … database" clause. These steps lower the risk:

1. Store only what the build needs: our own measured dimensions, the part number, the kind, the pack size, and a short name written by us (not copied descriptions).
2. **Don't store or show McMaster prices.** If we show cost at all, label it "approximate, owner-entered, check on McMaster" and let the user see the real price on McMaster after pasting.
3. No automated scraping. A person (the owner) checks each part number in a normal browser.
4. Add a "not affiliated with or endorsed by McMaster-Carr" line, as S12 does.
5. Optionally, email McMaster (eprocurement@mcmaster.com or customer service) to ask for written permission. This is cheap, and it settles the question.

I am not a lawyer; this is a plain reading of the terms.

### 6b. Who does what

| Data | Automatic? | How |
|---|---|---|
| Part numbers, slot sizes, wheel sizes, capacities, threads | Partly (done here, once) | Category pages pre-render this text. It is captured above. The owner should confirm each part number in a browser. |
| Per-length part numbers for 4658N4x | **No** | Owner: hover or click each length on the 4658N41 page and record the part number (8 values). |
| Current prices | **No** (not in the pre-rendered HTML; the API is off-limits for a public app) | Owner records them by hand if we decide to show estimates at all. |
| Cut-to-length cut fee and tolerance | **No** | Owner: add 47065T802 at, say, 24.5" to a cart and read the line item; or ask McMaster by phone or chat. |
| Caster mounting heights and plate bolt patterns | **No** | Owner: open each chosen caster's product page or 2D PDF and record "overall height" and the plate size/holes. Start with 4304N53, 4304N28, 4304N42, 4304N17 and 47065T336. |
| Geometry for drawings | From the STEP files we already have, measured locally (as done above) | Keep the STEP files private; ship only our own simplified profiles. |
| Paste format check | **No** | Owner pastes a 3-line test list into Order → Paste products and quantities once. |
| Claude controlling the owner's browser | Possible, but **not recommended for bulk collection**: it is still automated harvesting under (iii). For a handful of one-off checks with the owner watching, it's no different from the owner doing it, but keep it to the short list above. | |

### 6c. Open questions for the owner (in priority order)

1. Per-length part numbers for 4658N41 (1, 2, 3, 4, 5, 6, 8, 10 ft) and today's price for each.
2. Is there a cut-to-length **smooth hollow** rail matching 4658N41? Only smooth **solid** 47065T802 was found. What are its cut fee and tolerance?
3. Mounting height and plate dimensions/bolt holes for the plate casters we pick (4304N53, 4304N28 suggested). Which slot or face do they bolt to?
4. Does tap 2521A623 match 3/8"-16? Is 47065T336 still sold?
5. Confirm that 47065T241, 47065T679 and 47065T97 are still current, and their prices.
6. Current 1/4" panel part numbers in sizes near 24 × 36 (for shelves), if any.
7. The paste-list format that actually works.
8. Decide whether to keep the STEP files out of the repo (strongly recommended).
