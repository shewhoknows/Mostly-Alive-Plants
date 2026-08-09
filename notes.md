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
