# Sustained Gameplay Plan

## North star

Mostly Alive Plants should feel like running a tiny neighborhood plant shop, not clearing a queue of plant-shaped puzzles. The player should regularly decide what to buy, where to keep it, how much attention to give it, what price to ask, and who it suits. The systems should create light planning and satisfying recovery stories without timers, dead plants, debt spirals, or inventory spreadsheets.

Target session shape:

- A shop day lasts roughly 6–9 relaxed minutes.
- A five-day shop week lasts roughly 30–45 minutes.
- Unsold stock persists and becomes the player’s recognizable collection.
- Customers wait indefinitely; passing on a sale is neutral.
- Plants can become stressed, but never die or decay while the game is closed.

## Implemented foundation — Neighborhood Week v1, save version 5

The commerce-and-neighborhood slice from this plan and the attached 35-day campaign plan is now playable:

- deterministic morning customer forecast and three nursery lots;
- wholesale invoices, per-plant acquisition cost, 12-plant capacity, persistent unsold stock, and adaptive supplier top-ups when the shop lacks a required trait;
- preparation phase with animated cartons, species-specific care, arrangement mode, and atomic display/bench swaps;
- shade, indirect, and sun slots with readable ideal/tolerable/poor fit;
- visible Quick, Fair, and Boutique tags on every plant;
- 12 recurring 3D neighbors, 40 request briefs, and concise **Must have / Would love / Budget** cards;
- condition- and budget-aware acceptance, protected remaining-customer stock, and remembered visits, purchases, and satisfaction;
- a Monday-to-Friday calendar, rotating weekly objective and reward, and a dedicated Friday recap;
- 16 distinct plant species and paced plant, customer, and brief unlocks across the opening weeks;
- Bloom reputation standings and migration of older saves into version 5.

The combined direction remains: this repository plan supplies the light business spine, while the attached plan supplies the 35-day campaign, deeper plant growth, potting, journal, workshops, and finale. Matching plants to people stays the primary pleasure; commerce stays legible and light. Three customers remain the calm daily baseline, with a fourth reserved for a later fixture or event. Staff management is not part of the combined scope.

## The richer daily loop

1. **Plan the day.** Read the weekday, weekly objective, and customer briefs, then choose one nursery lot.
2. **Receive stock.** Pay wholesale, unpack the delivery, inspect condition, and choose display positions.
3. **Merchandise.** Place plants according to light needs and set each price to Quick, Fair, or Boutique.
4. **Serve neighbors.** Read each customer’s must-have, optional preference, and budget; recommend or decline a match.
5. **Care for stock.** Water, mist, or prune where it is genuinely beneficial and rescue drooping plants before opening.
6. **Close the shop.** Review gross profit and Bloom, advance the weekly objective, and see the expanded week recap on Friday.

The next bounded slice adds a true care bench between merchandising and opening: repotting, rehabilitation, and propagation without increasing the number of daily customers.

Three customers per day is the baseline. Later improvements can add a fourth visitor through an upgrade or special event.

## Core management systems

### 1. Nursery ordering and persistent inventory

The morning now offers three supplier cards:

- **Reliable tray:** three disclosed common plants with a predictable margin.
- **Curated pair:** two specific or uncommon plants with a higher cost and value.
- **Rescue lot:** three stressed, partly hidden plants; cheapest and closest to the current mystery-crate charm.

Each card shows quantity, known species or traits, wholesale price, and condition. Orders arrive for the preparation phase, and the selection logic adaptively covers missing must-have traits without erasing the differences between lots. Later supplier relationships can reveal more information, reduce cost, and introduce unusual stock.

Guardrails:

- Wholesale price averages 45–55% of fair retail value.
- Early daily purchasing choices cost roughly 18–32 coins.
- Starting capacity is 10–12 plants across displays and staging.
- A consignment tray appears when cash is low, preventing bankruptcy deadlocks.

### 2. Forgiving plant condition

The current plant-condition layer uses preferred light, species-specific hydration loss, and relevant water, mist, or prune actions. Plants visibly droop when thirsty, useful care improves them, and overwatering is blocked rather than becoming a hidden punishment.

The next layer adds root comfort while keeping the complete management model to three needs:

- preferred light: shade, bright indirect, or sun;
- water cadence: slow, normal, or thirsty;
- root comfort: comfortable or root-bound.

The UI should continue translating those into one readable state: **Thriving**, **Comfortable**, **Stressed**, or **Recovering**. It surfaces the most urgent need instead of exposing a wall of meters.

Rules:

- There is no offline decay and plants never disappear.
- Neglect is capped; a deeply stressed plant becomes Resting and loses premium value until rehabilitated.
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

This is the next recommended bounded slice. Turn the existing staging bench into a small work queue:

- **Repot:** costs a few coins, completes next morning, restores root comfort, and raises value.
- **Propagate:** uses a thriving mature plant, takes two days, and creates a lower-value juvenile.
- **Rehabilitate:** gives a stressed plant one protected day of accelerated recovery.

Root comfort is the new readable constraint: a root-bound plant remains alive but cannot justify its best condition or price until repotted. Soil, pots, fertilizer, and labor initially remain a single coin cost. Decorative pot stock can become a later optional layer once the core economy is proven.

### 6. Weekly orders and neighborhood events

A week has five shop days:

- Monday reveals one rotating shop objective and its coin-and-Bloom reward.
- Tuesday–Thursday carry progress forward alongside regular trade.
- Friday resolves the objective and opens a dedicated weekly recap.

The five-day shell, objective rotation, rewards, and Friday recap are implemented. Weekly customer orders remain a later extension: they can request two or three plants by Friday, allow stock to be marked Held, and pay a deposit plus profit and Bloom. Missing one should lose the opportunity, not money the player already earned.

Events create plans rather than punishments: sunny spell, apartment move-in week, café opening, plant swap, school fundraiser, rescue shipment, neighborhood workshop, or community market.

### 7. Physical upgrades

Useful upgrades should change what the player can do:

- propagation shelf: second bench slot;
- better grow lamp: converts one display to bright light;
- shop sign: adds one daily visitor;
- delivery rack: raises capacity;
- display plinth: improves Boutique tolerance;
- humidifier: handles one mist need;
- new shelf and floor modules: add meaningful display space.

Automation should come from readable fixtures such as the grow lamp or humidifier. Staff simulation is intentionally outside the combined scope.

## Economy targets

- Early normal net profit: 18–28 coins per day.
- Upgrades: 45–120 coins, or about two to five good days.
- Weekly order reward: about 1–1.5 normal days of net profit.
- Gentle operating costs begin after day three at roughly 5–7 coins per day.
- Closing report: revenue − wholesale stock cost − expenses = net profit.
- Tune around 70–85% normal customer conversion, not perfect daily sales.
- Unsold plants never incur disposal costs.

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

### Phase 3 — Growing inventory — next

- Add root comfort, repotting, propagation, juveniles, and rehabilitation.
- Add supplier tiers and pot/size value modifiers.
- Add a species journal and customer follow-ups.

### Phase 4 — Growing the business

- Add optional weekly orders and a small positive or neutral event pool.
- Add new shelf modules and movable display fixtures.
- Add upgrade branches that change the room and shop routine.
- Add seasonal demand, larger contracts, and a modest shop expansion.

## Recommended next implementation slice

Build the smallest useful care-bench loop without starting staff, workshops, or the larger campaign systems:

1. activate **root comfort** as a readable Comfortable / Root-bound state that affects condition and premium pricing;
2. add **Repot** as a short paid bench job that restores root comfort on the following morning;
3. add **Rehabilitate** as one protected day of accelerated recovery for a stressed plant;
4. add **Propagate** for thriving mature plants, producing a lower-value juvenile after two days;
5. persist the small bench queue, show its remaining time clearly, and migrate existing plants as Comfortable.

That extends the now-playable chain into:

**forecast and buy → place and care → price and recommend → work the bench → remember and plan tomorrow**

Pot inventory, fertilizer types, the journal, workshops, weekly orders, and the 35-day finale should follow only after this compact plant-growth loop is tuned.

## Save-data direction after version 5

Version 5 establishes stable species and customer IDs plus the calendar, weekly objective, price bands, relationship memory, and unlock pacing. The plant records already have safe defaults for life stage, root comfort, parent, and bench status so the next slice can activate those fields without replacing inventory.

Later save versions can extend that foundation with:

- calendar: forecast, event, and optional weekly order;
- plant: active root comfort, growth progress, pot modifiers, and timed bench work;
- shop: fixture unlocks, featured trait, and inventory capacity;
- commerce: supplier relationships, delayed deliveries, active order, held stock, and operating expenses;
- community: deeper relationship beats, species journal entries, and story flags;
- operations: upgrades, workshop schedule, and bench queue.

Existing saves continue to migrate by assigning current plants Mature and Comfortable, preserving hydration, defaulting missing tags to Fair, estimating missing acquisition cost, and preserving every slot and upgrade.
