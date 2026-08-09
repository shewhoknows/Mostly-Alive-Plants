# Sustained Gameplay Plan

## North star

Mostly Alive Plants should feel like running a tiny neighborhood plant shop, not clearing a queue of plant-shaped puzzles. The player should regularly decide what to buy, where to keep it, how much attention to give it, what price to ask, and who it suits. The systems should create light planning and satisfying recovery stories without timers, dead plants, debt spirals, or inventory spreadsheets.

Target session shape:

- A shop day lasts roughly 6–9 relaxed minutes.
- A five-day shop week lasts roughly 30–45 minutes.
- Unsold stock persists and becomes the player’s recognizable collection.
- Customers wait indefinitely; passing on a sale is neutral.
- Plants can become stressed, but never die or decay while the game is closed.

## The richer daily loop

1. **Plan the day.** Read a small weather and demand forecast, then choose one nursery lot.
2. **Receive stock.** Pay wholesale, unpack the delivery, inspect condition, and choose display positions.
3. **Merchandise.** Place plants according to light needs and set each price to Quick, Fair, or Boutique.
4. **Serve neighbors.** Read each customer’s must-have, optional preference, and budget; recommend or decline a match.
5. **Work the bench.** Between customers, repot, propagate, or rehabilitate one plant.
6. **Close the shop.** Review revenue, stock cost, operating cost, net profit, reputation, and weekly-order progress.

Four customers per day is the initial target. Later improvements can raise that to five or six.

## Core management systems

### 1. Nursery ordering and persistent inventory

Replace free automatic crates with three morning supplier cards:

- **Reliable tray:** three disclosed common plants with a predictable margin.
- **Curated pair:** two specific or uncommon plants with a higher cost and value.
- **Rescue lot:** three stressed, partly hidden plants; cheapest and closest to the current mystery-crate charm.

Each card shows quantity, known species or traits, wholesale price, and arrival time. Early orders arrive immediately; rare plants may arrive next morning. Supplier relationships gradually reveal more information, reduce cost, and unlock unusual species.

Guardrails:

- Wholesale price averages 45–55% of fair retail value.
- Early daily purchasing choices cost roughly 18–32 coins.
- Starting capacity is 10–12 plants across displays and staging.
- A consignment tray appears when cash is low, preventing bankruptcy deadlocks.

### 2. Forgiving plant condition

Each species has only three management needs:

- preferred light: shade, bright indirect, or sun;
- water cadence: slow, normal, or thirsty;
- root comfort: comfortable or root-bound.

The UI translates those into one readable state: **Thriving**, **Comfortable**, **Stressed**, or **Recovering**. It surfaces the most urgent need instead of exposing a wall of meters.

Rules:

- There is no offline decay and plants never disappear.
- Neglect is capped; a deeply stressed plant becomes Resting and loses premium value until rehabilitated.
- Correct care restores condition faster than neglect lowers it.
- Misting and pruning are valuable only for relevant species, not universal chores.
- Overwatering remains blocked instead of becoming a hidden punishment.
- The grow lamp improves a shelf’s light level; a later humidifier handles automatic misting.

### 3. Pricing and merchandising

Every plant has a simple three-position price tag:

- **Quick — 90%:** easier to sell and useful for clearing space.
- **Fair — 100%:** normal acceptance and reputation.
- **Boutique — 120%:** works when condition, customer fit, and presentation justify it.

Display slots gain a light level as well as a location. While carrying a plant, the player sees only a temporary “thrives here / tolerates / poor fit” halo. Window and counter displays improve visibility; weekly themes can feature a trait or silhouette. Later, two- or three-plant arrangements reward complementary height, color, and growth habit.

### 4. Recurring neighborhood customers

The existing named cast becomes a set of recurring neighbors with lightweight archetypes:

- Beginner: easy care and a modest price.
- Collector: rarity and excellent condition.
- Decorator: size, silhouette, or color.
- Gift buyer: occasion, presentation, and budget.
- Rescue adopter: welcomes recovering plants at a fair markdown.
- Regular client: returns with follow-up dialogue and occasional multi-plant orders.

The customer card shows only three chips: **Must have**, **Would love**, and **Budget**. Good matches, fair pricing, display goals, and orders raise Community Bloom. Per-character visits and satisfaction unlock small story beats without adding another visible currency.

### 5. The care bench

Turn the bench into a two-slot work queue:

- **Repot:** costs a few coins, completes next morning, restores root comfort, and raises value.
- **Propagate:** uses a thriving mature plant, takes two days, and creates a lower-value juvenile.
- **Rehabilitate:** gives a stressed plant one protected day of accelerated recovery.

Soil, pots, fertilizer, and labor initially remain a single coin cost. Decorative pot stock can become a later optional layer once the core economy is proven.

### 6. Weekly orders and neighborhood events

A week has five shop days:

- Monday reveals the week’s demand theme, likely weather, and one optional order.
- Tuesday–Thursday mix regular trade with one positive or neutral event.
- Friday hosts the order deadline or community market and a weekly report.

Only one order and one event are active at once. Orders request two or three plants by Friday, allow stock to be marked Held, and pay a deposit plus profit and Bloom. Missing one loses the opportunity, not money the player already earned.

Events create plans rather than punishments: sunny spell, apartment move-in week, café opening, plant swap, school fundraiser, rescue shipment, neighborhood workshop, or community market.

### 7. Physical upgrades and later staff

Useful upgrades should change what the player can do:

- propagation shelf: second bench slot;
- better grow lamp: converts one display to bright light;
- shop sign: adds one daily visitor;
- delivery rack: raises capacity;
- display plinth: improves Boutique tolerance;
- humidifier: handles one mist need;
- new shelf and floor modules: add meaningful display space.

Late in progression, one optional staff shift can be hired per day:

- caretaker handles the most urgent care need;
- buyer reveals or rerolls a supplier card;
- floor helper reveals one optional customer preference.

A daily wage of roughly 6–8 coins makes staff a strategic convenience rather than mandatory automation.

## Economy targets

- Early normal net profit: 18–28 coins per day.
- Upgrades: 45–120 coins, or about two to five good days.
- Weekly order reward: about 1–1.5 normal days of net profit.
- Gentle operating costs begin after day three at roughly 5–7 coins per day.
- Closing report: revenue − wholesale stock cost − expenses = net profit.
- Tune around 70–85% normal customer conversion, not perfect daily sales.
- Unsold plants never incur disposal costs.

## Four shippable phases

### Phase 1 — Commerce and placement

- Add species light needs and light-aware slots.
- Add morning supplier choice, wholesale costs, capacity, and persistent stock.
- Add Quick/Fair/Boutique price tags, customer budgets, and net-profit reporting.
- Migrate existing saves without losing plants or upgrades.

This is the first priority because it creates a complete management game using the current room and care interactions.

### Phase 2 — The neighborhood week

- Add the five-day calendar and demand forecast.
- Give each customer an archetype, visit history, and short returning story.
- Add one weekly order, a small event pool, and Friday report.
- Use Community Bloom to unlock suppliers, species, and fixtures.

### Phase 3 — Growing inventory

- Add root comfort, repotting, propagation, juveniles, and rehabilitation.
- Add supplier tiers and pot/size value modifiers.
- Add a species journal and customer follow-ups.

### Phase 4 — Growing the business

- Add new shelf modules and movable display fixtures.
- Add staff shifts and upgrade branches.
- Add seasonal demand, larger contracts, and a modest shop expansion.

## Recommended next implementation slice

Build these three systems together after the current character and plant art pass:

1. light-aware placement and forgiving condition;
2. supplier ordering with wholesale cost and persistent stock;
3. price bands with visible customer budgets and archetypes.

Together they create the game’s core decision chain:

**forecast and buy → place and care → price and recommend**

The required UI can stay small: one morning clipboard with three supplier cards, temporary light-fit halos while placing, and compact plant/customer cards. No permanent inventory spreadsheet is necessary.

## Save-data direction

A future version-4 save should add stable species IDs and the following state:

- calendar: week, weekday, seed, forecast, and event;
- plant: wholesale cost, price band, life stage, vitality, hydration, root comfort, pot, parent, bench status, and slot;
- shop: fixture unlocks, featured trait, and inventory capacity;
- commerce: supplier relationships, deliveries, active order, held stock, revenue, cost of goods, and expenses;
- community: Bloom, customer relationships, unlocked species, and story flags;
- operations: upgrades, today’s staff role, and bench queue.

Existing saves can migrate by assigning current plants Mature, deriving vitality from hydration, setting Fair pricing, estimating wholesale cost at 45% of current retail, and preserving every slot and upgrade.
