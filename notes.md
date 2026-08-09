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
