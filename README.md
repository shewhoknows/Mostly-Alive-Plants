# Mostly Alive Plants

A cozy, low-pressure 3D plant-shop game that runs entirely in the browser. Unpack a nursery delivery, give each plant a little attention, arrange the shop, and match odd neighbors with the greenery they need.

## Play

Open `index.html` through any static web server. There is no build step, package install, backend, or API key required at runtime.

```sh
python3 -m http.server 4173
```

Then visit `http://127.0.0.1:4173/`.

### Controls

- Mouse/touch: tap an object, use the large contextual action, drag to pan, and wheel/pinch to zoom.
- Keyboard: `Q` cycles shop objects, `E` acts, `1`/`2`/`3` use care tools, and arrow keys turn the view.

## The day loop

1. Unpack three mystery plants.
2. Read the soil condition: thirsty plants visibly droop and perk back up after watering.
3. Water the soil, mist the canopy, or prune at the care bench—each action has its own effect.
4. Arrange deliveries to complete a small daily display vignette.
5. Meet each customer’s required trait, then chase optional trait, care, and thriving bonuses for a perfect match.
6. Earn coins and Community Bloom, encounter the moon moth, and improve the shop with a grow lamp or rain barrel.

Progress, sound preference, living plant condition, and upgrades are stored locally in the browser.

## Technical notes

- Build-free HTML, CSS, and JavaScript ES modules.
- Three.js `0.179.1` is vendored under `vendor/` with its MIT license.
- Three botanical shop textures and six original customer cutouts were generated with OpenAI ImageGen using `gpt-image-2`-oriented production prompts, then optimized for web delivery.
- No copied models, characters, names, layouts, or artwork from the reference game are included.
- See `notes.md` for the chronological build log and asset prompt summary.
