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
- On small screens the interface reflows for portrait and short landscape play; every required action is touch-accessible.

## The day loop

1. Unpack three mystery plants.
2. Water, mist, or prune them at the care bench.
3. Place them on an open display.
4. Read each customer’s request and offer a matching plant.
5. Earn coins and Community Bloom, encounter the moon moth, and improve the shop.

Progress, sound preference, plants, and the grow-lamp upgrade are stored locally in the browser.

## Technical notes

- Build-free HTML, CSS, and JavaScript ES modules.
- Three.js `0.179.1` is vendored under `vendor/` with its MIT license.
- Three original botanical shop textures were generated with OpenAI ImageGen using `gpt-image-2`-oriented production prompts, then resized for mobile delivery.
- No copied models, characters, names, layouts, or artwork from the reference game are included.
- See `notes.md` for the chronological build log and asset prompt summary.
