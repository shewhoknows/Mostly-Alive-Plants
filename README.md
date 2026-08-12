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
4. Read soil and species preferences. Thirsty and unhealthy plants visibly droop and yellow. Root-bound plants show overgrown roots, and treated plants recover on screen. Watering and misting have distinct effects.
5. Use the physical Care Bench during preparation. Select it in the 3D room to open Repot, Rehabilitate, and Propagate jobs. A mature plant needs Rehabilitate after three completed shop mornings; the job resets its nursery age. Repot fixes roots. Rehabilitate also clears nursery stress and restores a rescue plant’s lost sale value.
6. Arrange or swap stock across shade, indirect, and sunny displays, then give every plant a visible Quick, Fair, or Boutique price tag. Colored rings show light fit while a separate pulse marks the daily display vignette.
7. Manually open the shop, then read each neighbor’s **Must have**, **Would love**, and **Budget**. A sale depends on the required trait, plant condition, root comfort, and asking price. Some customers also request optional fertilizer, fungicide, or potting soil. Missing an add-on never blocks the plant sale.
8. Balance stock range against daily costs. Unsold plants stay in the shop, use capacity, and slowly become root-bound. The Delivery Rack raises capacity from 12 to 16 plants. Display Shelves extend the original display along the Community Board wall, add four real display spots, and raise the combined maximum to 20.
9. Close with net profit, stock, and Bloom change. The first unpaid shop bill gets one neighborhood grant. Later unpaid costs carry forward, up to a safe 45-coin limit. The game sets bill money aside before it permits optional bench work, upgrades, or projects.
10. From Week 3, fund one rotating shop project each week. Also buy permanent shop growth: Display Shelves, Rare Nursery Membership, Checkout Bell, Ceramic Shop Sign, Scent Garden, and Wrapping Station. These upgrades add space, special stock, and bounded sale bonuses. Overstock above the daily target needs extra care from Week 4.
11. From Week 2, accept one optional neighborhood order. Hold two or three suitable plants for Friday collection. A deposit helps you prepare the stock, but held plants cannot be sold to daily visitors.
12. Read one small weekly neighborhood event. It changes demand for one trait without blocking the day. Returning customers can refer to the exact species and price level from their last purchase.
13. Improve the nursery relationship with each paid shipment. Later levels reveal more Mystery Rescue information and give the Reliable Tray a discount.
14. Build relationships with 12 recurring neighbors, advance the weekly objective, and review a fuller shop-week recap after Friday.

The watering can is a working 3D tool. Select a plant, then select the can and act. Its pour animation uses the same watering rules as the Water control. The grow lamp also has a real Care Bench effect. It adds 2 more coins of Repot value, adds one Rehabilitate protection day, and reduces propagated-plant growth from three mornings to two.

The separate physical Retail Supply Shelf sells reusable Clip Grow Lights, Gentle Fertilizer, Leaf-Safe Fungicide, Mite Medicine, and Potting Soil. From Day 6, deterministic morning checks can give one eligible plant mites or fungus. Use the matching treatment. Fertilizer speeds juvenile growth or adds bounded mature growth. A Clip Grow Light can move between plants and fixes only an insufficient-light placement; it cannot reduce excess light.

The shop sits inside a small neighborhood diorama. The desktop view includes a pavement, curb, road markings, public planters, a street tree, and gentle greenery movement. Reduced-motion mode keeps the exterior still.

The Recovery Station is separate from the main Care Bench. It has its own sign, light, glass screen, two recovery positions, and a status badge. Rehabilitate jobs appear there. Repot and Propagate work stays at the main Care Bench.

The **Owned improvements** section lets you remove a purchased visible fixture. You receive half of its coin cost. Bloom is not returned, and the effect stops at once. Capacity fixtures cannot be removed when plants or unopened cartons need their space. The Bench Shelf cannot be removed while its second job slot is in use.

The current week and weekday, weekly event, optional order, held plants, supplier relationship, weekly objective, customer memory, unsold inventory, nursery age, plant issues, treatments, fertilizer growth, Clip Grow Light assignments, retail stock, root comfort, bench jobs, juveniles, price tags, shop projects, finances, sound preference, and upgrades are stored locally in the browser.

## Technical notes

- Build-free HTML, CSS, and JavaScript ES modules.
- Plant health and retail supply logic use separate versioned modules with migration and direct QA suites.
- Three.js `0.179.1` is vendored under `vendor/` with its MIT license.
- Three shop textures and four botanical foliage materials were generated with OpenAI ImageGen using `gpt-image-2` production prompts, then optimized for web delivery.
- The 12 recurring customers are proportional, articulated low-poly 3D characters with walk and carry poses. Each of the 26 plant varieties has a species-specific 3D silhouette and foliage construction. Four specialist plants are available only through Rare Nursery Membership.
- No copied models, characters, names, layouts, or artwork from the reference game are included.
- See `notes.md` for the chronological build log and asset prompt summary, and `GAMEPLAY_PLAN.md` for the staged management-game roadmap.
