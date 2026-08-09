# Build Notes

## 2026-08-09 — Title screen baseline

- Connected the empty `Mostly-Alive-Plants` repository to the workspace.
- Added a responsive, mobile-safe `index.html` title screen.
- Established the visual direction: warm greenhouse paper tones, dark botanical ink, editorial serif type, playful imperfect shapes, and compact mono UI copy.
- Kept the first milestone intentionally dependency-free so GitHub Pages can display it immediately.
- Next: enable the opening interaction and replace the title backdrop with the playable 3D plant shop.

## 2026-08-09 — Original texture set

- Studied the reference's official Steam media and translated the transferable idea—cozy tactile curation in a cutaway shop—into an original botanical art direction.
- Generated three original square textures with the ImageGen workflow and prompts structured for `gpt-image-2`: handmade terracotta floor tile, cream botanical block-print plaster, and reclaimed honey-oak boards with fern-green paint.
- The shell did not expose `OPENAI_API_KEY`, so generation used the skill's authenticated built-in path instead of the fallback CLI. No model downgrade or third-party asset source was used.
- Downscaled each selected texture to 512×512 PNG for practical mobile download and GPU memory use. Final project paths are `assets/textures/terracotta-floor.png`, `assets/textures/botanical-plaster.png`, and `assets/textures/painted-oak.png`.
- Prompt constraints shared by all three: flat material view, uniform detail, seamless edges, neutral diffuse light, no text, logos, watermark, perspective, or strong focal marks.
- Next: build the Three.js cutaway shop and use these textures on the room and furniture.

## 2026-08-09 — Playable 3D vertical slice

- Rebuilt the title screen around a live, softly visible isometric shop scene and enabled **Open for the day** once local assets finish loading.
- Added a complete build-free Three.js game in `game.js`: textured cutaway room, warm lighting and shadows, low-poly furniture, seven plant species, animated foliage, customers, particles, and a procedural sound palette.
- Added the full day loop: unpack three deliveries, care for plants with water/mist/prune, place them on eight snap displays, read three customer requests, make forgiving trait matches, earn coins and Community Bloom, see a closing report, and open the next day.
- Added a first-sale moon-moth surprise, a visible secondhand grow-lamp upgrade, daily procedural requests, and `localStorage` persistence.
- Added mouse, keyboard, and touch input: raycast tap selection, contextual action button, drag-to-pan, wheel/pinch zoom, view rotation, Q/E keyboard navigation, and 1/2/3 care shortcuts.
- Vendored pinned Three.js `0.179.1` modules and its MIT license so the 3D engine does not depend on a runtime CDN. Texture load failures still degrade to solid-color materials.
- Reworked the HUD at desktop, 568×320, 480×320, 390×844, and 320×480 sizes. Fixed portrait overlay blocking, short-screen panel collisions, clipped controls, and compact title overlap.
- Improved accessibility with labelled dialogs, modal focus management, inert background controls, reduced-motion support, keyboard selection, live status copy, and visible care completion states.
- Validation: `node --check game.js`, `git diff --check`, local HTTP asset checks, real browser title/start/gameplay screenshots, keyboard/modal checks, and an end-to-end three-sale day run. No browser console errors or warnings in the tested build.
- Next: add installable mobile metadata, a concise README, then run final static-hosting and performance checks.

## 2026-08-09 — Shipping pass

- Added `README.md` with the game loop, desktop/touch/keyboard controls, local preview command, persistence behavior, and dependency/asset notes.
- Added a lightweight original SVG plant-pot icon and `manifest.webmanifest` for standalone mobile presentation, plus matching browser theme metadata.
- Vendored runtime and generated texture payload is about 2 MB before HTTP compression; the scene caps device pixel ratio on smaller screens and uses compact low-poly meshes.
- Added `.gitignore` entries for local work, generated output, and macOS metadata without hiding any runtime file.
- Revalidated the static entry point and every referenced local asset over HTTP, checked the module syntax and whitespace, and exercised the responsive UI at desktop plus four mobile viewport shapes.

## 2026-08-09 — Living shop and customer cast

- Generated six original full-body customer renders with the ImageGen workflow: Mina, Basil, Jo, Nori, Pip, and Sol. Each uses believable adult proportions, a warm tactile 3D finish, a distinct outfit/prop silhouette, and no borrowed reference-game art.
- Processed the flat-magenta generations into 512×768 transparent RGBA sprites with the skill’s chroma-key helper, soft matte, despill, and edge contraction. Corrected Nori’s lavender coat alpha separately and validated transparent corners and edge coverage for all six. The full cast adds about 1.37 MB.
- Replaced the procedural mannequin customers with camera-facing cutouts, contact shadows, matching HUD portraits, a slightly smaller real-world scene scale, unique daily casting, and concise mobile-friendly customer briefs.
- Fixed tall plants intersecting the upper shelf by measuring each generated plant model and dynamically fitting lower-shelf scale to its actual ceiling clearance. Automatic placement now prefers a roomier slot for especially tall plants.
- Added persistent living soil condition. Hydration falls only during visible, unpaused play, varies by species, never kills a plant, and drives a smooth leaf-droop pose. Every day’s first delivery is visibly thirsty so the recovery mechanic is discoverable; watering a drooping plant perks it up and awards a small rescue bonus.
- Split care feedback into genuinely different animations: an arcing stream of elongated blue droplets with a soil ripple for watering, a slow translucent canopy cloud for misting, and the existing leafy burst for pruning.
- Expanded the customer puzzle with one required trait plus optional second-trait, requested-care, and thriving bonuses. Perfect matches pay more, and three perfect briefs in a day award an extra Community Bloom bonus.
- Added procedural daily display vignettes tied to shelf, floor, window, or counter zones. Matching carried plants highlight the correct spot; completing the vignette pays coins and Bloom. Slot rings now include invisible full-disc touch targets so their decorative hollow centers remain easy to tap.
- Added a purchasable, visible rain-barrel upgrade that slows soil drying by 35%, alongside the existing grow lamp. Closing reports now include perfect briefs, thirst rescues, and display completion.
- Migrated existing local saves in place to save version 3, preserving inventory and upgrades while filling in hydration, new customer preferences, and new counters.
- Validation so far: syntax and whitespace checks; transparent PNG format/alpha checks; live browser tests of fresh and migrated saves; desktop and portrait rendering; touch placement; water, mist, recovery, perfect-match, and display-goal flows; no browser-console errors.
- Final responsive review widened the stacked portrait layout through 600px, separated the care and action rows at intermediate phone widths, and restored mobile access to both upgrades with a compact horizontal utility row.

## 2026-08-09 — Proportional 3D cast and distinct botanical models

- Replaced the scene’s camera-facing customer cutouts with six fully modeled low-poly cartoon neighbors. Each character has a distinct face, skin tone, hair silhouette, outfit, and palette; their validated heights are 2.63–2.69 shop units against a 1.4-unit counter and 5.8-unit wall.
- Added articulated shoulder, elbow, hip, and knee pivots plus walk, idle, turn, and two-handed carry posing. Customers now enter diagonally through the open storefront, turn toward the player at the counter, receive the plant, and walk out along the same route.
- Checkout now places a scaled clone of the exact sold species in the customer’s arms instead of substituting a generic prop. The plant handoff is timed before the exit gait and the next customer waits until the prior customer has cleared the shop.
- Removed all customer PNG loads from the live Three.js scene and replaced the customer-card portrait with a simple cast-color initial. The earlier generated PNGs remain in the repository history but are no longer runtime scene assets.
- Rebuilt every plant as a species-specific 3D asset in `plant-models.js`: feathered fern fronds, heart-leaf trailing pothos vines, broad pinstriped calathea leaves, a radial waxy succulent rosette, split and fenestrated monstera leaves, yellow-edged snake-plant blades, and a ribbed grafted moon cactus with crown and spines.
- Preserved per-leaf animation pivots on every model, so the existing live hydration system still drives gradual droop and watering recovery. All models keep their pot base at local y=0 and the existing measured ceiling-fit logic scales tall stock below shelf clearances.
- Generated four original 256×256 botanical surface maps with the authenticated ImageGen workflow and `gpt-image-2`: layered fern foliage, velvet-veined greenery, coral pinstripe leaf patterning, and waxy blue-green succulent skin. Prompts requested tileable, evenly lit, painterly material studies with no objects, text, logos, borders, or focal composition. The selected images were downscaled to `assets/textures/leaf-fern.png`, `leaf-velvet.png`, `leaf-pinstripe.png`, and `leaf-waxy.png`.
- Added `GAMEPLAY_PLAN.md`, a staged design for a sustainable plant-shop game: nursery purchasing and wholesale cost, persistent inventory, light-aware condition, three price bands, visible customer budgets and archetypes, repot/propagate/rehab bench work, a five-day neighborhood week, orders, events, fixtures, and optional staff.
- Recommended next implementation slice: connect light-aware placement, supplier purchasing, and price/budget decisions into the repeatable chain **forecast and buy → place and care → price and recommend**.
- Validation: syntax and whitespace checks; runtime construction of all six customers and seven species; bounding-box, foliage-pivot, and texture-dimension checks; full desktop WebGL inspection of the cast and species gallery; live shelf-clearance review; entry and opposing-limb walk frames; exact-plant handoff; carrying exit; next-customer transition; and a clean browser diagnostic log with no errors.
- Post-publish transition review removed the fixed checkout timer: the next customer or closing report is now triggered only when the carrying walk actually reaches its final animation frame, so low frame rates and background-tab throttling cannot cut the exit short. The wrapping state also remains authoritative across incidental UI refreshes, preventing the next customer’s brief from appearing early.
- Made sold-plant carry clones render-only by excluding the live foliage-pivot graph during cloning and clearing copied interaction/animation metadata. The customer still carries the exact visible species and condition, without serializing nested Object3D bookkeeping on every sale.

## 2026-08-09 — Friendlier faces, centered displays, and opening cartons

- Softened all six customer faces at the source-model level. Stark white target-like eyes became small warm bead eyes with subtle catchlights; heavy block brows became thin angled brows; pointed noses and rigid bar mouths became rounded noses and curved smiles; cheek marks and glasses were reduced; and hairlines were raised so dark hair no longer reads as a mask across the face.
- Corrected Basil’s beanie band and Nori’s side fringe so neither intersects the face. Preserved every character’s identity, outfit, rig pivots, carrying pose, and proportional 2.64–2.72-unit shop scale.
- Recomputed the shelf slots from the furniture geometry. Both shelf rows now use the center of each structural bay (`x -4.65/-2.85`, `z -4.32`) instead of sitting toward the front lip. The counter plant slot now uses the exact center of its top (`x 2.35`, `z 1.25`) rather than the far-left edge.
- Moved loose-delivery staging to four clear locations on the potting bench. The new points sit 0.81–1.89 world units from the watering can and stacked pots, so an unpacked plant no longer appears inside either prop.
- Replaced the solid delivery crates with openable cardboard cartons. Each carton has four independently hinged flaps, packing-paper scraps, a small compression settle, delayed paper reveal and burst, plant emergence, and a visible transfer to the bench. Interaction is locked only for the two-second reveal and reduced-motion mode resolves immediately.
- Reviewed the attached 35-day gameplay expansion against `GAMEPLAY_PLAN.md`. The plans are compatible: the attachment provides the campaign, relationships, growth, potting, journal, workshops, and finale, while the repository roadmap supplies the light shop-management economy, supplier decisions, persistent stock, and tuning guardrails. No expansion milestone was implemented in this visual-fix commit.
- Validation: module syntax and whitespace checks; full six-character front-view render; in-shop face inspection; multi-frame carton settle/flap/paper/emergence/transfer inspection; final staging clearance; upper-shelf centered placement; keyboard interaction; and clean browser diagnostic logs.

## 2026-08-09 — Morning supplier and preparation loop

- Added a persisted four-phase business day: **supplier clipboard → preparation → open shop → closing report**. Customers now stay outside while the player chooses stock, opens cartons, cares for arrivals, and manually flips the shop sign to open.
- Split stable gameplay content into `game-data.js` and deterministic supplier logic into `supplier-system.js`. Save version 4 migrates old inventory in place, repairs invalid duplicate display slots, preserves zero-coin saves, and adds future-ready plant fields for pots, soil, life stage, acquisition cost, and parentage without implementing those later systems yet.
- Added three distinct daily nursery choices: a disclosed Reliable Tray, a two-plant Curated Pair, and a concealed Mystery Rescue Lot. Existing inventory participates in forecast coverage, low-cash shops receive a pay-what-you-can rescue route, near-capacity shops get briefs covered by current stock, and a no-purchase route appears whenever current inventory can serve the day.
- Added lightweight but real stock accounting: 12-plant capacity, persistent unsold stock, wholesale invoices, lot cost allocated to individual plants, sold-stock cost, gross profit, nursery spend, and till change in the closing report.
- Added explicit arrangement mode. Displayed plants retain their saved slot until a move commits, empty spots accept moves, occupied spots support atomic swaps, and full displays expose colored light rings. Green means ideal light, amber tolerable, and coral poor; exact light now participates in the thriving customer bonus.
- Made care species-specific. Water remains a dynamic soil need; mist and prune only award Bloom and sale value for plants that benefit from them. Unhelpful care still animates with playful feedback, and the grow lamp now automates mist only for mist-loving displayed plants.
- Protected the three-customer queue with distinct-plant matching at supplier generation, before opening, and before every proposed sale, so an early valid-looking offer cannot consume the only plant needed by a later visitor.
- Added Bloom reputation standings to make longer-term progress legible while keeping the larger campaign systems deferred. The attached expansion remains the campaign/emotional spine; the repository plan remains the light business spine. This slice implements their shared morning/shop-management foundation only—growth, potting, propagation, relationships, workshops, and the 35-day finale remain later milestones.
- Browser validation covered a fresh save, all three selectable day-one lots, concealed rescue stock, animated carton opening, thirst recovery, ideal-light placement, reload during an uncommitted move, manual opening, three sequential sales with walking customers, cost-aware closing report, and day-two return to the supplier clipboard. No browser warnings or errors were reported.

## 2026-08-09 — Morning-loop hardening and plan handoff

- Kept Mystery Rescue identities and display clues concealed until the final carton opens, then generated a feasible vignette from the revealed stock.
- Added explicit care-bench swaps: a loose arrival can take an occupied display while the displaced plant moves visibly to staging. This keeps 10–12-plant shops playable even when every display is full.
- Hardened version-3 partial-day migration. Completed customers no longer block the remaining coverage check, completed days with leftover cartons reopen at the report, legacy sold-stock cost is labelled as an estimate, and the reconstructed till change covers the whole migrated day.
- Made poor light consistently produce light stress above the drooping threshold, changed the optional water preference to the attainable “well-watered” condition, fixed rapid consecutive mover snaps, and clarified title/report transitions as **Start the day**, **Open the shop**, and **Plan tomorrow**.
- Added keyboard focus loops to every modal, attached the closing results as the report dialog description, hid the redundant Arrange toggle during implicit preparation mode, and made tall four-choice supplier clipboards scroll from a safe top edge on short desktop screens.
- Updated `README.md` to describe the actual supplier/preparation/accounting loop and reconciled `GAMEPLAY_PLAN.md` with the attached campaign direction. The implemented save-v4 foundation is now marked complete; the next bounded recommendation is price bands and budgets, remembered customer archetypes, and a light five-day-week shell.
- Follow-up browser validation covered rescue-clue concealment, modal focus wrapping, loose-to-display bench swapping, full partial-day v3 recovery, completed-day v3 report recovery, and report accessibility metadata.

## 2026-08-09 — Calmer closing report

- Replaced the end-of-day wall of accounting prose with a short outcome sentence, three spacious result cards, and one warm highlight.
- Reduced the visible results to gross profit, Bloom earned, and plants ready for tomorrow. Revenue breakdowns, nursery spend, till change, care totals, light totals, and standing copy remain available to the game state but no longer compete for attention on the celebratory screen.
- Added semantic term/value markup for the three results and limited the dialog description to the human-readable outcome sentence, so assistive technology does not announce the entire report as one breathless block.
- Added a negative-profit color state without relying on color alone; every result retains an explicit label and signed value.
- Browser validation used an exact Day 10 fixture at 872×600: the 478px-tall card remained fully visible, the three results stayed on one relaxed row, the action retained focus, Tab and Shift+Tab remained trapped in the modal, and the browser reported no console errors or warnings.

## 2026-08-09 — Neighborhood Week v1, cast expansion

- Began the agreed content-and-progression milestone by expanding the recurring 3D cast from six neighbors to twelve.
- Added Avery, Talia, Ivo, Mae, Omar, and Rue with six new hair or headwear silhouettes, six geometry-specific outfits, varied proportions and skin tones, and small personal details such as freckles, glasses, earrings, pockets, and drawstrings. These are modeled additions rather than palette swaps.
- Preserved the existing friendly face language and the full shoulder, elbow, hip, knee, walk, carry, contact-shadow, and raycast contracts. All twelve characters instantiate and animate successfully at 2.59–2.71 shop units tall.

## 2026-08-09 — Neighborhood Week v1, plant model expansion

- Expanded the procedural 3D plant library with nine genuinely different silhouettes: String of Pearls, Coinleaf Pilea, Rubber Plant, Spoonflower Lily, Parlor Palm, Zanzibar Gem, Elephant Ear, Polka Dot Begonia, and Tiny Ficus.
- Modeled the new forms as hanging bead strands, round peltate leaves, a woody glossy tree, white spathes, feather palms, paired ZZ leaflets, shield leaves, spotted cane growth, and a pruned miniature canopy rather than recoloring the original seven plants.
- Connected every new foliage system to the existing hydration-droop pivots and reused the original botanical texture maps. Programmatic construction checks found nonzero animated foliage on all nine models, exact ground-level pot bases, and pre-slot heights from 0.77 to 2.35 shop units.
