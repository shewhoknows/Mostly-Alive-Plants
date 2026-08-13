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

## 2026-08-09 — Neighborhood Week v1, content catalog

- Raised the content schema to save version 5 and expanded the catalog to sixteen species and twelve stable customer identities. New species are assigned across five unlock weeks instead of appearing as an unfiltered wall on day one.
- Added declarative Quick, Fair, and Boutique price bands; a Monday–Friday calendar; ten weekly objective types; customer archetypes, personal budget ranges, and returning dialogue; and exactly forty handcrafted brief templates.
- Brief templates combine readable framing with a viable Must have trait, an optional distinct Would love trait, and a position inside each neighbor’s budget range. Validation confirms that every referenced trait exists in the species catalog and all customer, species, objective, and brief IDs are unique.

## 2026-08-09 — Neighborhood Week v1, progression engine

- Added a deterministic five-day calendar and briefing engine that combines forty authored request frames with the customers, plants, and traits currently unlocked that week.
- Made customer budgets and supplier forecasting use the same visible Quick-price floor, including the full three-coin variation a delivered plant can roll. Existing migrated stock remains usable even when it comes from a later unlock week.
- Added persistent returning-customer visit context and ten rotating weekly objective types with bounded targets, concise progress labels, and reusable week-stat tracking.
- Upgraded supplier matching to reserve a distinct affordable plant for every visitor. Shops at 10–12 plants receive adaptive one- or two-plant top-ups, full viable inventories can skip ordering, and a zero-cash rescue route remains available when stock is insufficient.
- Validation covered days 1–25, 300 generated customer briefs, 300 supplier lots, 75 near/full-capacity cases, zero-cash recovery, migrated stock, deterministic repeatability, and every weekly objective metric. Module syntax and whitespace checks pass.

## 2026-08-09 — Neighborhood Week v1, playable week

- Connected the expanded catalog and progression engine to the playable shop. The top bar now reads **Week / weekday**, the daily card carries one concise weekly goal, and Friday replaces the ordinary close with a compact weekly sales, profit, and goal recap.
- Added physical color-coded price tags to every 3D pot plus a focused Quick / Fair / Boutique selector. The tag changes the exact checkout price; over-budget customers stay and explain the issue, stressed plants require a Quick markdown, and Boutique pricing requires a stronger condition or presentation fit.
- Rebuilt the customer panel around three readable decisions—**Must have**, **Would love**, and **Budget**—with archetype and visit context kept secondary. The game now persists visits, purchases, satisfaction, last species, and last price band, then uses those memories for returning dialogue.
- Wired all ten objective types into real play: profit, sales, perfect briefs, healthy displays, thirst rescues, price-band sales, species variety, helpful care, and delighted returning customers. Targets have long-run maxima; Boutique Week guarantees one honest premium-affordable brief and supplier route per weekday while keeping every customer inside their declared budget range.
- Hardened older saves by regenerating only unopened legacy briefs against the new unlock pool, retaining partial days, preserving later-unlock plants already owned, replacing stale supplier cards, and immediately saving the repaired version-5 state.
- Updated `README.md` and `GAMEPLAY_PLAN.md` to mark the commerce and Neighborhood Week v1 slices complete. The next bounded milestone is the care bench: root comfort, repotting, rehabilitation, and propagation.
- Browser validation covered a clean Monday supplier board, animated cartons, visible pricing, a rejected 23-coin offer against a 22-coin budget, successful retag and sale, the protected three-customer queue, relationship persistence, Tuesday returning dialogue, a Friday recap, Week 2 unlock announcements, and version-4 migration. Static simulation covered ordinary days, low-cash and 10–12-stock supplier routes, every objective metric, target bounds through Week 200, and 100 Boutique weekdays with 300 maximum-price-roll supplier routes.

## 2026-08-12 — Sustained shop systems, engine checkpoint

- Added a deterministic trade profile for each shop day. Week 1 keeps three visitors, Week 2 grows to four or five, and later weeks rotate between four and six visitors. A future shop-sign upgrade can add one more visitor.
- Added daily operating costs, stock targets, stock-pressure messages, and shipment guidance. These values react to the weekday, week, visitor count, inventory, and capacity.
- Added a save-safe care bench engine with Repot, Rehabilitate, and Propagate jobs. Jobs use coins and Bloom, take one or two mornings, reserve bench slots, preserve plants safely, and wait if a new propagated plant cannot fit in stock.
- Repotting improves root comfort and value. Rehabilitation restores health and adds short protection. Propagation creates a tracked juvenile plant that grows for three days before it becomes mature.
- Static validation covered Weeks 1–20, all generated visitor queues, operating-cost and stock bounds, repeated job starts, insufficient funds, full stock, missing plants, reload-safe jobs, and delayed propagation completion.

## 2026-08-12 — Sustained Shop v1, playable integration

- Raised the live save schema to version 6. Existing plants, customer memory, prices, slots, finances, and earlier upgrades migrate in place. New saves also track bench work, life stage, root age, daily shop costs, unpaid costs, and the new fixtures.
- Replaced the fixed three-sale ceiling after Week 1. Week 2 now has four or five visitors per day. Later weeks rotate between four and six, and the Shop Sign can add one more. The market strip shows demand, today’s operating cost, and stock against capacity before the player orders.
- Made supplier quantities respond to demand, ready stock, missing customer traits, and free space. Lots can grow to seven plants, current stock can replace an order when it covers the whole queue, and zero-cash rescue credit remains available. Bench plants and juvenile plants use capacity but cannot falsely satisfy a brief.
- Optimized supplier coverage with deterministic maximum matching and pruned assignment search. A prior worst case with 15 similar plants and seven briefs dropped from tens of seconds to a few milliseconds. Added direct tests for full stock, bench work, juveniles, a seven-visitor Shop Sign day, zero coins, near-capacity top-ups, and Boutique-price guarantees.
- Added daily business costs for rent, utilities, extra visitors, and carry-over stock care. The closing screen now reports net profit and signed Bloom change. One emergency neighborhood grant covers the first unpaid bill; later shortfalls carry forward with a recoverable 45-coin limit.
- Added a repeatable weekly shop-project system after long-run simulation showed that permanent upgrades alone could not absorb later coin and Bloom income. Weeks 1–2 stay unchanged. From Week 3, one of five projects rotates each week, starting at 60 coins and 15 Bloom and capping at 180 coins and 45 Bloom.
- Added visible Window Garland, Community Board, Hanging Garden, Painted Pots, and Plant Reading Corner models. A funded project stays in the room, and later stages make its model slightly larger. Lifetime Bloom now preserves the shop standing when current Bloom is spent.
- Added a two-coin closing care cost for each plant above the daily stock target from Week 4. This makes overstock a real choice without taxing the opening weeks.
- Reserved the current base shop cost and any unpaid balance before optional bench jobs, permanent fixtures, or weekly projects can spend coins. Nursery rescue routes stay available, but optional spending cannot force the emergency grant or erase costs at the debt limit.
- Added a visible Delivery Rack and increased the upgrade menu to five fixtures. Delivery Rack raises capacity from 12 to 16, Bench Shelf adds a second job slot, Shop Sign adds one later-week visitor, Rain Barrel slows drying, and Grow Lamp improves a display and gives useful automated care.
- Activated the Care Bench during preparation. Repot costs 10 coins and completes next morning. Rehabilitate costs 8 coins, restores a stressed rescue, and protects it for two shop days. Propagate costs 12 coins and 5 Bloom, takes two mornings, and creates a juvenile that grows for three more mornings.
- Made mature carry-over stock age toward Root-bound after four mornings. Root-bound plants stay alive but require Quick pricing until repotted. Bench jobs temporarily remove their plant from sale, and the game rejects a job that would make the remaining customer queue impossible.
- Kept the economy report honest by adding repot, rehabilitation, and propagation coin costs to the treated plant’s cost basis. Propagated juveniles retain stable parent and job IDs, and completed propagation waits safely if stock is full.
- Rebuilt the care-bench dialog and added clear plant, job, cost, remaining-time, and slot states. Long stock lists scroll inside the dialog, active controls stay visible, and all utility dialogs close cleanly before a customer transition or closing report.
- Rebuilt the delivery rack as a low open platform with no foliage-height rails, so tall and wide plant models cannot intersect its furniture. Moved the rain barrel and loose-stock points outside the platform clearance. Expanded loose-stock positions and animated carton capacity to 16 plants and seven cartons.
- Updated `README.md` and `GAMEPLAY_PLAN.md`. The care-bench and sustained-demand milestone is now complete. The next bounded slice is the species journal, exact customer follow-ups, one optional weekly order, small neighborhood events, and supplier relationships.
- Validation covers JavaScript syntax, whitespace, Weeks 1–20 trade profiles, Days 1–100 supplier routes, version-6 care-bench jobs, full-capacity recovery, root-bound recurrence, service limits, saved active jobs, and the complete fresh-browser flow from supplier choice through sales, closing, next-morning rehabilitation, upgrades, and reload. The browser console stayed free of errors and warnings.

## 2026-08-12 — Visible Care Bench and permanent shop growth

- Raised the live save schema to version 7. Version-6 plants, active Care Bench jobs, finances, customer memory, supplier progress, fixtures, and display positions migrate in place.
- Added a persistent Care Bench card to the main task panel. It explains the morning timing before it is ready, becomes visually prominent after the last carton opens, and shows active job counts and completion access during the rest of the day.
- Kept the full Care Bench dialog available for inspection outside preparation. New work still starts only after the daily shipment is chosen and every carton is open. The dialog explains why Repot, Rehabilitate, or Propagate is not available for a selected plant.
- Added six permanent shop expansions from Week 3 through Week 8: Display Shelves, Rare Nursery Membership, Checkout Bell, Ceramic Shop Sign, Scent Garden, and Wrapping Station. Each uses coins and Bloom, has a clear effect label, saves permanently, and adds a visible 3D object to the room.
- Display Shelves add four gated, light-aware plant positions and four stock spaces. They stack with Delivery Rack for a 20-plant maximum. Hidden shelf positions are not selectable before purchase, and extra loose-stock staging covers the larger limit without wrapping plants into the same location.
- Added Pink Princess Vine, Jewel Orchid, Spiral Aloe, and Blue Star Fern as four high-value specialist plants with unique procedural 3D forms and animated foliage pivots. Common nursery lots never contain them.
- Rare Nursery Membership adds one deterministic mixed supplier card. It includes one specialist specimen plus the common plants needed to keep today’s visitor queue covered. The card shows every identity and trait, and respects coins and capacity.
- Checkout Bell, Ceramic Shop Sign, Scent Garden, and Wrapping Station add bounded sale bonuses. All percentage effects use the original tag price, do not compound, and the combined maximum stays at 15% plus 3 coins.
- Updated `README.md` and `GAMEPLAY_PLAN.md` for the 20-plant catalog, 20-plant maximum capacity, visible Care Bench entry, rare supplier, and permanent growth branch.
- Validation covers all existing trade, supplier, progression, Care Bench, shop-project, and expansion tests; rare supplier determinism, ordinary five-visitor coverage, and access; save and syntax checks; the visible one-carton and ready Care Bench states; and starting a live Rehabilitate job from the main task-panel entry.

## 2026-08-12 — Working potting station and Community Board display

- Moved the four-slot Display Shelves from the right side of the room to the left wall. They now join the original shelves as one L-shaped plant display. Existing saved plants keep their slot numbers and move safely with the fixture.
- Moved the Community Board above the added shelves. Checked every one of the 20 plant models for wall, shelf, board, neighbor, and upper-shelf clearance. Moved two loose-stock positions away from the new fixture.
- Made the physical Care Bench a selectable 3D work station. Its action opens the existing Repot, Rehabilitate, and Propagate dialog. Plants with active jobs now sit at the bench, and a second active plant uses the added bench shelf.
- Made the physical watering can selectable. It remembers the last chosen plant, uses the same watering rules as the Water control and keyboard shortcut, flies to the plant, tilts, pours, and returns to the bench. Misting keeps its separate cloud animation.
- Replaced the grow lamp’s hidden automatic mist rule with saved Care Bench support. New lamp-assisted Repot jobs add 2 extra coins of value. Rehabilitate adds one protection day. Propagate plants mature in two mornings instead of three.
- Added a visible lamp bulb and pulse for active assisted jobs. The lamp is now selectable and opens the Care Bench. Upgrade, task-panel, job-card, help, README, and gameplay-plan text state the real effects.
- Raised the care-bench substate to version 2. Old jobs migrate with lamp support off. Lamp support remains correct after save and reload.
- Validation passed every existing `*.qa.mjs` suite, JavaScript syntax checks, and whitespace checks. Browser tests covered Q selection, the physical Care Bench dialog and focus path, a thirsty watering-can action from 57% to 100% soil hydration, visible grow-lamp purchase and guidance, and the shelf/Community Board room layout.

## 2026-08-12 — Neighborhood street and clearer rehabilitation

- Added a procedural exterior around the shop diorama. A muted grass base now supports an L-shaped pavement, two connected streets, curbs, dashed road marks, and a small crosswalk. The customer route remains clear.
- Added two public planters and one low-poly street tree. Their stems and foliage move with a slow layered breeze. The animation changes only three group rotations per frame and stops fully when reduced motion is active or the page is hidden.
- Widened the desktop orthographic view so the street is visible without hiding the shop. The original framing remains for viewports below the desktop threshold. Exterior objects stay decorative and do not enter pointer or keyboard selection.
- Split the Care Bench’s right column into `Work in progress` and `Start a new job`. Active work uses quiet non-interactive cards. Only Repot, Rehabilitate, and Propagate remain in the action group.
- Gave Rehabilitate one distinct job. Mystery Rescue plants now arrive with `nursery-stressed` condition and four coins of lost base value. Water fixes thirst, display movement fixes light, Repot fixes roots, and only Rehabilitate clears nursery stress and restores the lost value.
- Kept Quick sale as the immediate low-price option for nursery-stressed stock. Fair and Boutique sales require rehabilitation. The selected-plant text, nursery card, help, job copy, completion message, README, and gameplay plan explain the choice.
- Save migration gives existing plants a zero value-loss default, so older stressed stock does not receive an incorrect price gain. New rescue stock saves its exact recoverable loss. Reload and repeated-completion tests confirm that value is restored once.
- All six `*.qa.mjs` suites, JavaScript syntax checks, and whitespace checks passed. Browser checks covered the 1280×720 default and rotated street views, tree and planter clearance, the full Care Bench dialog, and clear active-work versus new-job grouping.

## 2026-08-12 — Plant health and the Retail Supply Shelf

- Added a three-morning nursery-age cycle for mature shop stock. Age advances once per completed morning and pauses for juveniles and active Care Bench work. A completed Rehabilitate job resets the age to zero.
- Expanded visible plant condition. Stress now blends foliage toward yellow and adds droop. Root-bound plants show overgrown roots. Mites and fungus add distinct markers. These effects ease away after the correct recovery action.
- Added deterministic health checks from Day 6. A scheduled morning can add mites or fungus to one eligible plant, with cooldowns that stop immediate repeat issues.
- Added Mite Medicine for mites and Leaf-Safe Fungicide for fungus. The wrong treatment is blocked, and each correct use consumes one saved supply unit.
- Added Gentle Fertilizer. It shortens juvenile growth by one morning or adds one bounded mature growth point and a same-day visible growth boost.
- Added reusable Clip Grow Lights. Each owned light supports one assigned plant and can be returned for another plant. It fixes only insufficient light and cannot reduce excess light.
- Added a separate physical Retail Supply Shelf and a desktop supply dialog for buying, restocking, assigning, and using Clip Grow Lights, fertilizer, treatments, and Potting Soil.
- Added optional customer purchases of Gentle Fertilizer, Leaf-Safe Fungicide, or Potting Soil. Available stock earns a small margin. Missing stock never blocks the plant sale.
- Kept the milestone save-safe with separate versioned `plant-health-system.js` and `shop-supply-system.js` modules, conservative migration, and direct QA suites for age, issues, treatments, fertilizer, reusable lights, purchases, stock limits, add-ons, and reload-safe state.
- Made the physical shelf show the real saved stock, kept health signs attached to moving leaves, preserved correct carried-plant scale after a clip lamp is removed, and released old 3D plant resources during rebuilds. Fertilizer and treatment costs now enter the treated plant's cost basis.
- Final validation passed every `*.qa.mjs` suite, JavaScript syntax checks, DOM and ARIA checks, and whitespace checks. Browser tests covered the live customer add-on, the stock-aware 3D shelf, the supply dialog, buying and using fertilizer, saved-state reload, and the desktop shop view.

## 2026-08-12 — Neighborhood commitments, Recovery Station, and catalog growth

- Raised the live save schema to version 8. Older saves keep their plants, health state, Care Bench jobs, customer memory, fixtures, and finances. New state stores the weekly event, optional order, Held stock, and nursery relationship.
- Added six standard plants with paced unlocks from Week 6 through Week 10: Bird's Nest Fern, Ponytail Palm, Silver Inch Plant, Braided Money Tree, Flamingo Flower, and Staghorn Fern. Each plant has distinct care data, traits, value, and a unique procedural 3D form. The full catalog now has 26 plants.
- Added one optional weekly neighborhood order from Week 2. It has a deposit, a Friday deadline, a two- or three-plant request, clear Held stock, safe release, collection rewards, and missed-order recovery. Held plants cannot satisfy or be sold to daily visitors.
- Added small positive or neutral weekly events. One readable trait demand can change without making the supplier route impossible. Returning neighbors can refer to the exact species and Quick, Fair, or Boutique price from their prior purchase.
- Added three nursery relationship levels. Paid nursery orders raise trust. Later levels reveal more Mystery Rescue information and add a Reliable Tray discount.
- Built a separate, marked Recovery Station for Rehabilitate jobs. It has a different aqua and plum design, an overhead `PLANT REHAB` sign, a glass screen, inspection light, two recovery positions, and a persistent room-status badge. Repot and Propagate jobs remain at the main Care Bench.
- Added an **Owned improvements** manager. The player can remove visible fixtures and shop expansions for half of their coin cost. Bloom is not returned, and each effect stops at once. Capacity and bench-slot checks include inventory, unopened cartons, display positions, and active jobs, so removal cannot corrupt the day.
- Added direct QA for all 26 plant records and models, the version-8 neighborhood state, deterministic events and orders, order expiry and completion, Held-stock filtering, supplier relationships, expansion resale, capacity safety, and older-save migration.
- Browser checks covered a fresh Week 2 event, supplier trust display, a two-plant order offer, deposit acceptance, the separate Recovery Station, the owned-improvement list, a Grow Lamp refund, and the removal of its visible model and effect.
- Hardened full-stock event days with a distinct-plant assignment check. An event is skipped when the same plant would be needed for two visitor notes, so the morning supplier board cannot trap the player with no valid choice.
- Replaced the expanded supplier catalog's combinatorial search with deterministic requirement-bitmask planning. The old worst QA pass was 964.3 ms. The optimized 300-pass final run had a 10.6 ms worst pass and a 2.06 ms mean.

## 2026-08-13 — Clear order stock and focused shop work areas

- Replaced the large, persistent Rehabilitation Station overlay with a compact station label. It appears only when the player selects the station and stays in the lower-left edge of the game view.
- Renamed the area to Recovery and Propagation Station. Both Rehabilitate plants and Propagate parent plants now use its two checked workstation positions. Repot plants remain at the main Care Bench.
- Rebuilt the weekly order stock panel. The order book now lists suitable shop plants inside the dialog. Each row has its own Hold action, a clear daily-demand warning when needed, and a separate Held for collection list with Release actions.
- Changed the Retail Supply Shelf to show one front-facing item per unit in each standard customer add-on pack. A successful add-on sale updates the 3D shelf at once, so fertilizer, fungicide, and potting-soil stock visibly falls with the saved count.
- Replaced the long morning forecast paragraph with four labeled cards for Visitors, Plant requests, Shop cost, and Stock plan. The supplier board now fits a 1280×720 browser window without clipping.
- Browser validation covered the compact station label, a live two-plant weekly order from available stock through completion readiness, a three-to-two fungicide shelf change during a customer sale, and the Week 2 morning supplier layout. All JavaScript, DOM, ARIA, supplier, neighborhood, plant, Care Bench, health, expansion, project, supply, and trade checks passed with no browser console errors.
