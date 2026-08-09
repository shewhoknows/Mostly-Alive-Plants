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
