# Sustained Gameplay Plan

## North star

Mostly Alive Plants should feel like running a tiny neighborhood plant shop, not clearing a queue of plant-shaped puzzles. The player should regularly decide what to buy, where to keep it, how much attention to give it, what price to ask, and who it suits. The systems should create light planning and satisfying recovery stories without timers, dead plants, debt spirals, or inventory spreadsheets.

Target session shape:

- A shop day lasts roughly 6–9 relaxed minutes.
- A five-day shop week lasts roughly 30–45 minutes.
- Unsold stock persists and becomes the player’s recognizable collection.
- Customers wait indefinitely; passing on a sale is neutral.
- Plants can become stressed, but never die or decay while the game is closed.

## Implemented foundation — Sustained Shop v2, save version 7

The commerce-and-neighborhood slice from this plan and the attached 35-day campaign plan is now playable:

- deterministic morning customer forecast, three nursery lots, and daily demand that grows from three visitors to four–six;
- wholesale invoices, per-plant acquisition cost, 12-plant starting capacity, persistent unsold stock, and adaptive shipments of up to seven plants;
- preparation phase with animated cartons, species-specific care, arrangement mode, and atomic display/bench swaps;
- shade, indirect, and sun slots with readable ideal/tolerable/poor fit;
- visible Quick, Fair, and Boutique tags on every plant;
- 12 recurring 3D neighbors, 40 request briefs, and concise **Must have / Would love / Budget** cards;
- condition- and budget-aware acceptance, protected remaining-customer stock, and remembered visits, purchases, and satisfaction;
- a Monday-to-Friday calendar, rotating weekly objective and reward, and a dedicated Friday recap;
- 20 distinct plant species, including four Rare Nursery specimens, plus paced common-plant, customer, and brief unlocks;
- daily operating costs, recoverable unpaid bills, a one-time emergency grant, and net-profit reporting;
- weekly shop projects from Week 3, with rising coin-and-Bloom costs and visible room improvements;
- extra closing care costs for stock above the daily target from Week 4;
- a Care Bench with persistent Repot, Rehabilitate, and Propagate jobs, root-bound stock, and juvenile plants;
- five utility fixtures plus six permanent shop expansions with visible 3D objects and sale, supplier, or capacity effects;
- a persistent main-panel Care Bench entry that shows timing, readiness, and active jobs;
- Bloom reputation standings and migration of older saves into version 7.

The combined direction remains: this repository plan supplies the light business spine, while the attached plan supplies the 35-day campaign, journal, workshops, relationships, and finale. Matching plants to people stays the primary pleasure. Week 1 uses three visitors per day. Week 2 uses four or five. Later weeks rotate between four and six, and the Shop Sign can add one more. Staff management is not part of the combined scope.

## The richer daily loop

1. **Plan the day.** Read the weekday, weekly objective, visitor count, daily cost, stock target, and customer briefs.
2. **Receive stock.** Choose a right-sized nursery lot, pay wholesale, unpack the delivery, and inspect condition.
3. **Work the bench.** Repot root-bound stock, rehabilitate a stressed rescue, or propagate a thriving mature plant.
4. **Merchandise.** Place plants by light need and set each price to Quick, Fair, or Boutique.
5. **Serve neighbors.** Read each customer’s must-have, optional preference, and budget; recommend or decline a match.
6. **Close the shop.** Review net profit, Bloom change, remaining stock, weekly progress, and any unpaid shop cost.

The daily loop now creates a real stock choice. A larger shipment gives more customer options, but it uses coins, capacity, and later plant care. Carry-over stock can become root-bound. Bench jobs also remove plants from sale for one or two mornings.

## Core management systems

### 1. Nursery ordering and persistent inventory

The morning offers three supplier cards:

- **Reliable tray:** disclosed common plants with a predictable margin.
- **Curated selection:** specific or uncommon plants with a higher cost and value.
- **Rescue lot:** stressed, partly hidden plants; cheapest and closest to the original mystery-carton charm.

Each card shows quantity, known species or traits, wholesale price, and condition. Orders arrive for the preparation phase. Quantities adapt to visitor demand, stock level, free space, and missing traits. Early lots stay small. Normal later lots can contain up to seven plants. The Rare Nursery collection can contain eight after a full sellout because it adds one specialist specimen to seven request matches. A no-purchase card appears when current ready stock can serve the full queue.

Guardrails:

- Wholesale price averages 45–55% of fair retail value.
- Early daily purchasing choices cost roughly 18–32 coins.
- Starting capacity is 12 plants. The Delivery Rack raises it to 16. Display Shelves add four display slots and can raise the combined capacity to 20.
- A consignment tray appears when cash is low, preventing bankruptcy deadlocks.

### 2. Forgiving plant condition

The current plant-condition layer uses preferred light, species-specific hydration loss, and relevant water, mist, or prune actions. Plants visibly droop when thirsty, useful care improves them, and overwatering is blocked rather than becoming a hidden punishment.

The active condition model uses three needs:

- preferred light: shade, bright indirect, or sun;
- water cadence: slow, normal, or thirsty;
- root comfort: comfortable or root-bound.

The UI translates those into one readable state: **Thriving**, **Comfortable**, **Stressed**, **Root-bound**, or **Growing**. It shows the most urgent need instead of a wall of meters.

Rules:

- There is no offline decay and plants never disappear.
- Neglect is capped. A stressed rescue loses premium value until rehabilitated.
- Correct care restores condition faster than neglect lowers it.
- Misting and pruning are valuable only for relevant species, not universal chores.
- Overwatering remains blocked instead of becoming a hidden punishment.
- The grow lamp improves a shelf’s light level; a later humidifier handles automatic misting.

### 3. Pricing and merchandising

Every plant has a simple three-position price tag:

- **Quick — 90%:** easiest to sell and useful for clearing space.
- **Fair — 100%:** normal acceptance and reputation.
- **Boutique — 120%:** works when condition, customer fit, and the customer’s budget justify it.

Tags are visible in the shop and can be changed before recommending a plant. Customers decline politely when condition or price makes a recommendation unacceptable, leaving room to retag or try another match. Display slots have a light level as well as a location, and the temporary halo reads ideal, tolerated, or poor fit. Later, two- or three-plant arrangements can reward complementary height, color, and growth habit.

### 4. Recurring neighborhood customers

The cast now contains 12 recurring, proportional 3D neighbors with lightweight archetypes, personal budget ranges, unlock weeks, and returning dialogue. A pool of 40 handcrafted brief templates combines those personalities with the traits available in the current week. The cast spans a beginner, decorator, small-space shopper, practical buyer, collector, sun-seeker, gift-giver, office keeper, maximalist, careful carer, bargain hunter, and connoisseur.

The customer card shows only three decisions: **Must have**, **Would love**, and **Budget**. Required-trait fit, condition, and price decide whether the customer accepts; the optional preference distinguishes an adequate match from a perfect one. Per-character visits, purchases, satisfaction, and returning dialogue create memory without adding another visible currency.

### 5. The care bench

The preparation bench now has a persistent work queue:

- **Repot:** costs 10 coins, completes next morning, restores root comfort, and raises plant value.
- **Rehabilitate:** costs 8 coins, completes next morning, restores a stressed rescue, and protects it for two shop days.
- **Propagate:** costs 12 coins and 5 Bloom, uses a thriving mature plant, takes two mornings, and creates a lower-value juvenile.

The bench starts with one job slot. The Bench Shelf adds a second. A juvenile uses stock capacity and grows for three mornings before it can be sold. A bench plant cannot serve a customer brief. The game checks the remaining visitor queue before it accepts a job, so bench work cannot make the current day impossible.

Root-bound plants remain alive, but they can sell only at Quick price until repotted. Repot and rehabilitation costs enter the plant’s cost basis, so later net profit stays honest.

### 6. Weekly orders and neighborhood events

A week has five shop days:

- Monday reveals one rotating shop objective and its coin-and-Bloom reward.
- Tuesday–Thursday carry progress forward alongside regular trade.
- Friday resolves the objective and opens a dedicated weekly recap.

The five-day shell, objective rotation, rewards, and Friday recap are implemented. Weekly customer orders remain a later extension: they can request two or three plants by Friday, allow stock to be marked Held, and pay a deposit plus profit and Bloom. Missing one should lose the opportunity, not money the player already earned.

Events create plans rather than punishments: sunny spell, apartment move-in week, café opening, plant swap, school fundraiser, rescue shipment, neighborhood workshop, or community market.

### 7. Physical upgrades

The current physical upgrades change what the player can do:

- **Grow Lamp:** improves display light and automates useful mist care.
- **Rain Barrel:** slows soil drying.
- **Delivery Rack:** raises stock capacity from 12 to 16.
- **Bench Shelf:** adds a second bench-job slot.
- **Shop Sign:** adds one daily visitor after Week 1.

The permanent shop-growth branch now adds:

- **Display Shelves:** four usable display slots and four stock spaces;
- **Rare Nursery Membership:** an extra deterministic mixed delivery with one Pink Princess Vine, Jewel Orchid, Spiral Aloe, or Blue Star Fern plus common stock that covers the day;
- **Checkout Bell:** 5% more coins from every sale;
- **Ceramic Shop Sign:** 10% more coins from Boutique sales;
- **Scent Garden:** 2 extra coins from Lovely or Perfect matches;
- **Wrapping Station:** 1 extra coin from every sale.

Percentage bonuses add together from the original price and stay bounded. The shop-growth objects appear in the room as soon as they are bought.

From Week 3, one rotating shop project also appears in the upgrade dialog. Window Garland, Community Board, Hanging Garden, Painted Pots, and Plant Reading Corner repeat on a five-week cycle. Costs start at 60 coins and 15 Bloom. They rise with the shop and stop at 180 coins and 45 Bloom. Repeated funding makes the same visible project a little richer.

Automation should come from readable fixtures such as the grow lamp or humidifier. Staff simulation is intentionally outside the combined scope.

## Economy targets

- Early normal net profit: 18–28 coins per day.
- Utility fixtures: 45–110 coins. Permanent shop growth: 120–220 coins and 25–55 Bloom.
- Weekly order reward: about 1–1.5 normal days of net profit.
- Daily operating costs grow with the week, visitors, utilities, and carry-over stock.
- Closing report: revenue − wholesale stock cost − expenses = net profit.
- Tune around 70–85% normal customer conversion, not perfect daily sales.
- Unsold plants never incur disposal costs.
- The first unpaid bill gets one emergency grant. Later unpaid costs carry forward, with a 45-coin safety limit.
- Current base costs and unpaid costs are reserved before optional bench work, fixtures, or projects can use coins.
- Repotting and propagation are repeatable coin sinks. Propagation also spends Bloom.
- Weekly projects are the main long-run resource sink. They keep Weeks 1–2 unchanged.
- From Week 4, each plant above the closing stock target costs 2 extra coins in stock care.

## Four shippable phases

### Phase 1 — Commerce and placement — complete

- Add species light needs and light-aware slots.
- Add morning supplier choice, wholesale costs, capacity, and persistent stock.
- Add Quick/Fair/Boutique price tags, customer budgets, and gross-profit reporting.
- Migrate existing saves without losing plants or upgrades.

This created the first complete management chain using the original room and care interactions.

### Phase 2 — Neighborhood Week v1 — complete

- Add the five-day calendar, rotating objective, reward, and Friday recap.
- Expand to 12 recurring customers with archetypes, visit history, purchase memory, satisfaction, and returning dialogue.
- Expand to 16 species and 40 briefs with paced week-based unlocks.
- Keep each request readable as Must have, Would love, and Budget, with condition- and price-aware acceptance.
- Adapt supplier selections when the current shop cannot cover all required traits.

### Phase 3 — Growing inventory and demand — complete

- Add root comfort, repotting, propagation, juveniles, and rehabilitation.
- Scale visitor demand and nursery shipment size across later weeks.
- Add operating costs, persistent unpaid costs, capacity pressure, and repeatable bench spend.
- Add physical capacity, bench, care, and visitor upgrades.
- Add repeatable weekly shop projects and closing overstock care.

### Phase 4 — Growing the business — started

- Add optional weekly orders and a small positive or neutral event pool.
- Add new shelf modules and movable display fixtures. The first four-slot shelf module is complete.
- Add upgrade branches that change the room and shop routine. The first six-item permanent branch is complete.
- Add seasonal demand, larger contracts, and a modest shop expansion.

## Recommended next implementation slice

Build the first campaign-and-community layer without adding staff:

1. add a species journal that records owned, sold, propagated, and rehabilitated plants;
2. add customer follow-ups that refer to the exact species and price band from an earlier sale;
3. add one optional weekly order with a deposit, a clear Friday deadline, and a Held stock state;
4. add a small positive or neutral event pool that changes demand for one trait;
5. add two supplier relationship levels that reveal more rescue stock and improve one lot type.

That extends the current chain into:

**forecast and buy → place and care → price and recommend → work the bench → remember → plan for the week**

Decorative pots, fertilizer types, workshops, movable fixtures, and the 35-day finale should follow after this community slice is tuned.

## Save-data direction after version 7

Version 7 adds permanent shop-expansion state, gated display slots, combined 20-plant capacity, rare supplier access, four specialist plant records, and bounded sale bonuses. Existing inventory, bench jobs, customer history, prices, and version-6 fixtures remain intact.

Later save versions can extend that foundation with:

- calendar: forecast, event, and optional weekly order;
- plant: decorative pot modifiers and journal records;
- shop: more fixture unlocks and a featured trait;
- commerce: supplier relationships, delayed deliveries, an active weekly order, and held stock;
- community: deeper relationship beats, species journal entries, and story flags;
- operations: workshop schedule and larger room upgrades.

Existing saves continue to migrate by assigning current plants Mature and Comfortable, preserving hydration, defaulting missing tags to Fair, estimating missing acquisition cost, and preserving every slot and earlier upgrade.
