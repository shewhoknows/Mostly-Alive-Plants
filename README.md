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

1. Check the weekday, rotating weekly objective, and visitor forecast. Week 1 has three visitors per day. Week 2 grows to four or five, and later weeks rotate between four and six. The Shop Sign can add one more visitor.
2. Choose a Reliable Tray, Curated Pair, discounted Mystery Rescue Lot, or—when the shop is already prepared—use current stock. Normal shipments grow with demand and can contain up to seven plants. A Rare Nursery sellout collection can contain eight, with one specialist specimen and seven request matches. Supplier choices top up missing must-have traits while preserving useful carry-over stock.
3. Pay the nursery invoice, open the animated cartons, and watch each distinct plant move onto the preparation bench.
4. Read soil and species preferences. Thirsty plants visibly droop, watering and misting have distinct effects, and only useful care earns Bloom.
5. Use the physical Care Bench during preparation. Select it in the 3D room to open Repot, Rehabilitate, and Propagate jobs. The main task-panel card also shows timing and active jobs. Plants with active jobs now sit at the bench.
6. Arrange or swap stock across shade, indirect, and sunny displays, then give every plant a visible Quick, Fair, or Boutique price tag. Colored rings show light fit while a separate pulse marks the daily display vignette.
7. Manually open the shop, then read each neighbor’s **Must have**, **Would love**, and **Budget**. A sale depends on the required trait, plant condition, root comfort, and asking price. Optional preferences reward a more thoughtful match.
8. Balance stock range against daily costs. Unsold plants stay in the shop, use capacity, and slowly become root-bound. The Delivery Rack raises capacity from 12 to 16 plants. Display Shelves extend the original display along the Community Board wall, add four real display spots, and raise the combined maximum to 20.
9. Close with net profit, stock, and Bloom change. The first unpaid shop bill gets one neighborhood grant. Later unpaid costs carry forward, up to a safe 45-coin limit. The game sets bill money aside before it permits optional bench work, upgrades, or projects.
10. From Week 3, fund one rotating shop project each week. Also buy permanent shop growth: Display Shelves, Rare Nursery Membership, Checkout Bell, Ceramic Shop Sign, Scent Garden, and Wrapping Station. These upgrades add space, special stock, and bounded sale bonuses. Overstock above the daily target needs extra care from Week 4.
11. Build relationships with 12 recurring neighbors, advance the weekly objective, and review a fuller shop-week recap after Friday.

The watering can is a working 3D tool. Select a plant, then select the can and act. Its pour animation uses the same watering rules as the Water control. The grow lamp also has a real Care Bench effect. It adds 2 more coins of Repot value, adds one Rehabilitate protection day, and reduces propagated-plant growth from three mornings to two.

The current week and weekday, weekly objective, customer memory, unsold inventory, living plant condition, root comfort, bench jobs, juveniles, price tags, shop projects, finances, sound preference, and upgrades are stored locally in the browser.

## Technical notes

- Build-free HTML, CSS, and JavaScript ES modules.
- Three.js `0.179.1` is vendored under `vendor/` with its MIT license.
- Three shop textures and four botanical foliage materials were generated with OpenAI ImageGen using `gpt-image-2` production prompts, then optimized for web delivery.
- The 12 recurring customers are proportional, articulated low-poly 3D characters with walk and carry poses. Each of the 20 plant varieties has a species-specific 3D silhouette and foliage construction. Four specialist plants are available only through Rare Nursery Membership.
- No copied models, characters, names, layouts, or artwork from the reference game are included.
- See `notes.md` for the chronological build log and asset prompt summary, and `GAMEPLAY_PLAN.md` for the staged management-game roadmap.
