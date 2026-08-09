# Mostly Alive Plants

A cozy, low-pressure 3D plant-shop game that runs entirely in the browser. Read the neighborhood forecast, buy a nursery lot, prepare and arrange the stock, then match odd neighbors with the greenery they need.

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

1. Read three customer needs in the morning forecast and choose a Reliable Tray, Curated Pair, discounted Mystery Rescue Lot, or—when the shop is already prepared—use current stock.
2. Pay the nursery invoice, open the animated cartons, and watch each distinct plant move onto the care bench.
3. Read soil and species preferences: thirsty plants visibly droop, watering and misting have distinct effects, and only useful care earns Bloom.
4. Arrange or swap stock across shade, indirect, and sunny displays. Colored rings show light fit while a separate pulse marks the daily display vignette.
5. Manually open the shop, then meet each customer’s required trait without using a plant that the remaining queue still needs.
6. Chase optional trait, care, and thriving bonuses, build Bloom reputation, and review revenue, sold-stock cost, gross profit, nursery spend, and ending inventory at close.

The current phase, unsold inventory, living plant condition, finances, sound preference, and upgrades are stored locally in the browser.

## Technical notes

- Build-free HTML, CSS, and JavaScript ES modules.
- Three.js `0.179.1` is vendored under `vendor/` with its MIT license.
- Three shop textures and four botanical foliage materials were generated with OpenAI ImageGen using `gpt-image-2` production prompts, then optimized for web delivery.
- Customers are proportional, articulated low-poly 3D characters with walk and carry poses. Each of the seven plant varieties has a species-specific 3D silhouette and foliage construction.
- No copied models, characters, names, layouts, or artwork from the reference game are included.
- See `notes.md` for the chronological build log and asset prompt summary, and `GAMEPLAY_PLAN.md` for the staged management-game roadmap.
