# Mostly Alive Plants

A cozy, low-pressure 3D plant-shop game that runs entirely in the browser. Read the neighborhood forecast, buy and price a nursery lot, prepare the stock, then match recurring neighbors with the greenery they need across a five-day shop week.

## Play

Open `index.html` through any static web server. There is no build step, package install, backend, or API key required at runtime.

```sh
python3 -m http.server 4173
```

Then visit `http://127.0.0.1:4173/`.

### Controls

- Mouse/touch: tap an object, use the large contextual action, drag to pan, and wheel/pinch to zoom.
- Keyboard: `Q` cycles shop objects, `E` acts, `1`/`2`/`3` use care tools, `4`/`5`/`6` choose Quick/Fair/Boutique, and arrow keys turn the view.

## The day loop

1. Check the weekday, rotating weekly objective, and three customer briefs, then choose a Reliable Tray, Curated Pair, discounted Mystery Rescue Lot, or—when the shop is already prepared—use current stock. Supplier choices adaptively top up missing must-have traits so the day stays solvable.
2. Pay the nursery invoice, open the animated cartons, and watch each distinct plant move onto the care bench.
3. Read soil and species preferences: thirsty plants visibly droop, watering and misting have distinct effects, and only useful care earns Bloom.
4. Arrange or swap stock across shade, indirect, and sunny displays, then give every plant a visible Quick, Fair, or Boutique price tag. Colored rings show light fit while a separate pulse marks the daily display vignette.
5. Manually open the shop, then read each neighbor’s **Must have**, **Would love**, and **Budget**. A sale depends on the required trait, plant condition, and asking price; optional preferences reward a more thoughtful match.
6. Build relationships with 12 recurring neighbors, who remember earlier visits and purchases, while 40 brief templates keep their requests varied.
7. Close with a calm daily result, advance the weekly objective, earn its reward when completed, and review a fuller shop-week recap after Friday.

The current week and weekday, weekly objective, customer memory, unsold inventory, living plant condition, price tags, finances, sound preference, and upgrades are stored locally in the browser.

## Technical notes

- Build-free HTML, CSS, and JavaScript ES modules.
- Three.js `0.179.1` is vendored under `vendor/` with its MIT license.
- Three shop textures and four botanical foliage materials were generated with OpenAI ImageGen using `gpt-image-2` production prompts, then optimized for web delivery.
- The 12 recurring customers are proportional, articulated low-poly 3D characters with walk and carry poses. Each of the 16 plant varieties has a species-specific 3D silhouette and foliage construction; plants and neighbors unlock gradually across the opening weeks.
- No copied models, characters, names, layouts, or artwork from the reference game are included.
- See `notes.md` for the chronological build log and asset prompt summary, and `GAMEPLAY_PLAN.md` for the staged management-game roadmap.
