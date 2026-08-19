# Sustained Gameplay Plan

## North star

Mostly Alive Plants should feel like running a tiny neighborhood plant shop, not clearing a queue of plant-shaped puzzles. The player should regularly decide what to buy, where to keep it, how much attention to give it, what price to ask, and who it suits. The systems should create light planning and satisfying recovery stories without timers, dead plants, debt spirals, or inventory spreadsheets.

Target session shape:

- A shop day lasts roughly 6–9 relaxed minutes.
- A five-day shop week lasts roughly 30–45 minutes.
- Unsold stock persists and becomes the player’s recognizable collection.
- Customers wait indefinitely; passing on a sale is neutral.
- Plants can become stressed, but never die or decay while the game is closed.

## Implemented foundation — Sustained Shop v3, save version 8

The commerce-and-neighborhood slice from this plan and the attached 35-day campaign plan is now playable:

- deterministic morning customer forecast, three nursery lots, and daily demand that grows from three visitors to four–six;
- wholesale invoices, per-plant acquisition cost, 12-plant starting capacity, persistent unsold stock, capacity-scaled range targets, and adaptive shipments of up to seven plants;
- preparation phase with animated cartons, species-specific care, arrangement mode, and atomic display/bench swaps;
- shade, indirect, and sun slots with readable ideal/tolerable/poor fit;
- visible Quick, Fair, and Boutique tags on every plant;
- 12 recurring 3D neighbors, 40 request briefs, and concise **Must have / Would love / Budget** cards;
- condition- and budget-aware acceptance, protected remaining-customer stock, and remembered visits, purchases, and satisfaction;
- a Monday-to-Friday calendar, rotating weekly objective and reward, and a dedicated Friday recap;
- 26 distinct plant species, including four Rare Nursery specimens, plus paced common-plant, customer, and brief unlocks;
- daily operating costs, recoverable unpaid bills, a one-time emergency grant, and net-profit reporting;
- weekly shop projects from Week 3, with rising coin-and-Bloom costs and visible room improvements;
- extra closing care costs for stock above the daily target from Week 4;
- separate job capacity: Repot and Propagate share the Care Bench, while Rehabilitation has two Recovery Station places and an optional third-place trolley;
- three-morning nursery age, visible plant-health decline and recovery, and deterministic mites or fungus from Day 6;
- a physical Retail Supply Shelf with reusable Clip Grow Lights, fertilizer, issue treatments, potting soil, and optional customer add-ons;
- six utility fixtures plus six permanent shop expansions with visible 3D objects and sale, supplier, or capacity effects;
- a persistent main-panel Care Bench entry that shows timing, readiness, and active jobs;
- a separate marked Recovery and Propagation Work Area with independent Recovery capacity and a cutting rack;
- one optional weekly order, Held stock, small neighborhood events, exact return visits, and nursery relationship levels;
- safe resale of visible shop improvements for half of their coin cost;
- Bloom reputation standings and migration of older saves into version 8.

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
- **Rescue lot:** two or three stressed, partly hidden rescue plants plus healthy request-covering stock; cheapest and closest to the original mystery-carton charm.

Each card shows quantity, known species or traits, wholesale price, and condition. Orders arrive for the preparation phase. Quantities adapt to visitor demand, stock level, free space, and missing traits. Early lots stay small. Normal later lots can contain up to seven plants. The Rare Nursery collection can contain eight after a full sellout because it adds one specialist specimen to seven request matches. A no-purchase card appears when current ready stock can serve the full queue.

Guardrails:

- Wholesale price averages 45–55% of fair retail value.
- Early daily purchasing choices cost roughly 18–32 coins.
- Starting capacity is 12 plants. The Delivery Rack raises it to 16. Display Shelves add four display slots and can raise the combined capacity to 20.
- From Week 4, the planned carry-over range is six plants at capacity 12, eight at capacity 16, and ten at capacity 20. The Curated Selection restores this target instead of slowly draining stock.
- A consignment tray appears when cash is low, preventing bankruptcy deadlocks.

### 2. Forgiving plant condition

The current plant-condition layer uses preferred light, species-specific hydration loss, nursery age, root comfort, and visible health issues. Plants droop and yellow under stress. Root-bound stock shows overgrown roots. Correct care and treatment restore the model on screen.

The active condition model uses five needs:

- preferred light: shade, bright indirect, or sun;
- water cadence: slow, normal, or thirsty;
- nursery age: mature stock needs Rehabilitate after three completed shop mornings;
- root comfort: comfortable or root-bound;
- health issue: deterministic mites or fungus can appear from Day 6.

The UI translates those into one readable urgent state, such as **Thriving**, **Nursery-stressed**, **Root-bound**, **Mite-infested**, **Fungal**, or **Growing**.

Rules:

- There is no offline decay and plants never disappear.
- Neglect is capped. A stressed rescue loses premium value until rehabilitated.
- Correct care restores condition faster than neglect lowers it.
- Misting and pruning are valuable only for relevant species, not universal chores.
- Overwatering remains blocked instead of becoming a hidden punishment.
- At most one eligible plant receives a new deterministic issue on a scheduled morning. Mite Medicine treats mites. Leaf-Safe Fungicide treats fungus.
- Gentle Fertilizer shortens juvenile growth by one morning or adds one bounded mature growth point and a same-day visible growth boost.
- A reusable Clip Grow Light can correct too little light. It cannot make an over-bright display suitable.
- The grow lamp improves new Care Bench jobs. It adds Repot value, extends Rehabilitate protection, and speeds juvenile growth after Propagate. Misting stays a separate, visible care action.
- Nursery-stressed rescue stock has a visible four-coin value loss. Water, mist, and prune do not remove that travel stress. Rehabilitate clears it, resets nursery age, restores the lost value, and protects the plant for later shop days.

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

Repot and Propagate share one Care Bench place. The Bench Shelf adds a second. Rehabilitation has two separate Recovery Station places by default. The Recovery trolley adds a third. A juvenile uses stock capacity and grows for three mornings before it can be sold. A plant in any job cannot serve a customer brief. The game checks the remaining visitor queue before it accepts a job, so plant work cannot make the current day impossible.

Root-bound plants remain alive, but they can sell only at Quick price until repotted. Repot and rehabilitation costs enter the plant’s cost basis, so later net profit stays honest. Rehabilitate also resets the three-morning nursery-age clock.

### 6. Retail supplies and plant health

The physical Retail Supply Shelf sells five save-safe items:

- **Clip Grow Light:** reusable support for one plant with too little light;
- **Gentle Fertilizer:** juvenile growth or bounded mature growth;
- **Leaf-Safe Fungicide:** treatment for fungus and an optional customer add-on;
- **Mite Medicine:** treatment for mites;
- **Potting Soil:** an optional customer add-on.

Fertilizer, fungicide, and potting soil can appear as optional purchase requests. Stock earns a small margin when available. Missing stock never blocks the plant sale. Retail inventory and Clip Grow Light assignments migrate independently from older saves.

### 7. Weekly orders and neighborhood events

A week has five shop days:

- Monday reveals one rotating shop objective and its coin-and-Bloom reward.
- Tuesday–Thursday carry progress forward alongside regular trade.
- Friday resolves the objective and opens a dedicated weekly recap.

The five-day shell, objective rotation, rewards, Friday recap, and one optional weekly customer order are implemented. An order requests two or three plants by Friday, lets stock be marked Held, and pays a deposit plus profit and Bloom. Missing one loses the opportunity, not money the player already earned.

Events create plans rather than punishments: sunny spell, apartment move-in week, café opening, plant swap, school fundraiser, rescue shipment, neighborhood workshop, or community market.

### 8. Physical upgrades

The current physical upgrades change what the player can do:

- **Grow Lamp:** improves all new Care Bench jobs and pulses while it supports active work.
- **Rain Barrel:** slows soil drying.
- **Delivery Rack:** raises stock capacity from 12 to 16.
- **Bench Shelf:** adds a second shared Repot or Propagate place.
- **Recovery Trolley:** adds a third Rehabilitation place without consuming Care Bench capacity.
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

### Phase 4 — Growing the business — in progress

- **Plant-health and Retail Supply Shelf milestone — complete:** three-morning nursery age, visible stress and recovery, deterministic mites and fungus, treatments, fertilizer growth, reusable Clip Grow Lights, and optional supply add-ons.
- **Neighborhood commitments milestone — complete:** exact sale follow-ups, one optional weekly order, Held stock, small positive or neutral events, and three supplier relationship levels.
- **Catalog expansion — complete:** six later-week standard plants bring the catalog to 26 distinct species.
- **Stock-flow and specialist-capacity milestone — complete:** shelf capacity now preserves a larger sale range, Curated deliveries refill it, Rescue deliveries limit nursery stress to two or three plants, and Rehabilitation has its own two-to-three-place capacity.
- **Daily Flow and Clarity milestone — complete:** plant-first keyboard selection, a direct sale-readiness checklist, explicit soil and customer blockers, Day-6 batch carton opening with a delivery overview, supplier novelty and variety targets, a clear Rehabilitation Bloom reward, and saved-day title copy.
- Add new shelf modules and movable display fixtures. The first four-slot shelf module is complete.
- Add upgrade branches that change the room and shop routine. The first six-item permanent branch is complete.
- Add seasonal demand, larger contracts, and a modest shop expansion.

## Recommended next implementation slice

The next bounded step remains a species journal and custom presentation. It should start only after a second black-box test confirms that Day 10 is clear and that the current economy targets still create useful choices:

1. add a journal that records each owned and sold species, its care facts, and its best sale result;
2. add a small set of decorative pots with clear coin costs and bounded presentation bonuses;
3. let the player move selected small fixtures between safe marked room zones;
4. add one weekly workshop that uses a plant, a supply item, and a short customer group;
5. connect journal discoveries and workshops to one new weekly objective and two customer follow-ups.

That extends the current chain into:

**forecast and buy → place and care → price and recommend → work the bench → remember → plan for the week → collect and present**

Seasonal demand, larger contracts, the back-room expansion, and the 35-day finale should follow after this slice is tuned.

## Save-data direction after version 8

Version 8 adds weekly events, optional orders, Held stock, supplier relationship progress, exact returning-customer follow-ups, improvement resale safety, and six standard plant records. Existing inventory, bench jobs, health state, customer history, prices, fixtures, and version-7 shop expansions remain intact.

The plant-health and retail-supply modules add their own versioned migration. Missing health fields receive safe defaults. Retail stock and Clip Grow Light assignments migrate without changing older inventory, finances, or shop upgrades.

Later save versions can extend that foundation with:

- calendar: seasonal forecast, workshops, and larger contracts;
- plant: decorative pot modifiers and journal records;
- shop: more fixture unlocks and a featured trait;
- commerce: delayed deliveries, bulk orders, and workshop bookings;
- community: deeper relationship beats, species journal entries, and story flags;
- operations: workshop schedule and larger room upgrades.

Existing saves continue to migrate by assigning current plants Mature and Comfortable, preserving hydration, defaulting missing tags to Fair, estimating missing acquisition cost, and preserving every slot and earlier upgrade.
