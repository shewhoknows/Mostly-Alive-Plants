import { CUSTOMERS, PRICE_BANDS, SLOT_DATA, SPECIES } from "./game-data.js";
import { inventoryCoversCustomers } from "./supplier-system.js";

export const NEIGHBORHOOD_STATE_VERSION = 1;
export const ORDER_STATUS = Object.freeze({
  OFFERED: "offered",
  ACTIVE: "active",
  COMPLETED: "completed",
  DECLINED: "declined",
  MISSED: "missed",
});

const EVENTS = Object.freeze([
  Object.freeze({ id: "apartment-move-ins", title: "New neighbors", trait: "easygoing", copy: "Apartment move-ins increase interest in easygoing plants.", bonusCoins: 2 }),
  Object.freeze({ id: "cafe-opening", title: "Café opening", trait: "lush", copy: "A new café wants lush plants for its tables.", bonusCoins: 2 }),
  Object.freeze({ id: "sunny-spell", title: "Sunny spell", trait: "sunny", copy: "Bright windows increase interest in sun-loving plants.", bonusCoins: 2 }),
  Object.freeze({ id: "bookshop-refresh", title: "Bookshop refresh", trait: "shade-loving", copy: "A bookshop display increases interest in shade-loving plants.", bonusCoins: 2 }),
  Object.freeze({ id: "hanging-basket-week", title: "Balcony week", trait: "trailing", copy: "Fresh balcony hooks increase interest in trailing plants.", bonusCoins: 2 }),
  Object.freeze({ id: "community-market", title: "Community market", trait: "colorful", copy: "Market stalls increase interest in colorful plants.", bonusCoins: 2 }),
]);

const VALID_ORDER_STATUSES = new Set(Object.values(ORDER_STATUS));
const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]));
const SPECIES_BY_NAME = new Map(SPECIES.map((species) => [species.name, species]));
const MIN_ORDER_BONUS_PER_PLANT = 5;

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function weekForDay(day) {
  return Math.floor((Math.max(1, integer(day, 1)) - 1) / 5) + 1;
}

function weekdayIndexForDay(day) {
  return (Math.max(1, integer(day, 1)) - 1) % 5;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function eventForWeek(week) {
  const safeWeek = Math.max(1, integer(week, 1));
  if (safeWeek < 2) return { id: "quiet-opening", title: "A quiet week", trait: null, copy: "Regular demand gives the new shop time to settle.", bonusCoins: 0 };
  const unlockedTraits = new Set(SPECIES.filter((species) => !species.special && (species.unlockWeek || 1) <= safeWeek).flatMap((species) => species.traits));
  const eligible = EVENTS.filter((event) => unlockedTraits.has(event.trait));
  return { ...(eligible[(safeWeek - 2) % eligible.length] || EVENTS[0]) };
}

function orderForWeek(week) {
  const safeWeek = Math.max(1, integer(week, 1));
  if (safeWeek < 2) return null;
  const unlockedSpecies = SPECIES.filter((species) => !species.special && (species.unlockWeek || 1) <= safeWeek);
  const customer = CUSTOMERS[hashText(`order-customer-${safeWeek}`) % CUSTOMERS.length];
  const species = unlockedSpecies[hashText(`order-species-${safeWeek}`) % unlockedSpecies.length] || SPECIES[0];
  const trait = species.traits[hashText(`order-trait-${safeWeek}`) % species.traits.length];
  const quantity = safeWeek >= 5 && safeWeek % 3 === 0 ? 3 : 2;
  const deposit = 5 + quantity * 2;
  const matchingSpecies = unlockedSpecies.filter((item) => item.traits.includes(trait));
  const highestQuickPrice = Math.max(...matchingSpecies.map((item) => (
    Math.round((item.price + 3) * PRICE_BANDS.quick.multiplier)
  )));
  // The full order always beats selling any eligible plant at its highest
  // possible Quick price. The deposit is part of that full payment.
  const fullPayment = quantity * (highestQuickPrice + MIN_ORDER_BONUS_PER_PLANT);
  const rewardCoins = Math.max(0, fullPayment - deposit);
  return {
    id: `week-${safeWeek}-order-${customer.id}-${trait}`,
    week: safeWeek,
    status: ORDER_STATUS.OFFERED,
    customerId: customer.id,
    customerName: customer.name,
    title: `${customer.name}'s ${trait} collection`,
    requiredTrait: trait,
    quantity,
    deposit,
    rewardCoins,
    rewardBloom: 3 + quantity,
    deadlineDay: safeWeek * 5,
    heldPlantIds: [],
    acceptedDay: null,
    completedDay: null,
  };
}

function nullableDay(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : null;
}

function stringIds(value, limit = Number.MAX_SAFE_INTEGER) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))]
    .slice(0, Math.max(0, integer(limit)));
}

function migrateOrder(sourceOrder, week, inventory) {
  const trusted = orderForWeek(week);
  if (!trusted) return null;
  if (!sourceOrder || typeof sourceOrder !== "object") return trusted;

  const status = VALID_ORDER_STATUSES.has(sourceOrder.status)
    ? sourceOrder.status
    : ORDER_STATUS.OFFERED;
  const inventoryIds = Array.isArray(inventory)
    ? new Set(inventory.map((plant) => plant?.id).filter(Boolean))
    : null;
  const heldPlantIds = status === ORDER_STATUS.ACTIVE
    ? stringIds(sourceOrder.heldPlantIds, trusted.quantity)
      .filter((id) => inventoryIds === null || inventoryIds.has(id))
    : [];

  return {
    ...trusted,
    status,
    heldPlantIds,
    acceptedDay: [ORDER_STATUS.ACTIVE, ORDER_STATUS.COMPLETED, ORDER_STATUS.MISSED].includes(status)
      ? nullableDay(sourceOrder.acceptedDay)
      : null,
    completedDay: status === ORDER_STATUS.COMPLETED
      ? nullableDay(sourceOrder.completedDay)
      : null,
    ...(status === ORDER_STATUS.COMPLETED
      ? { fulfilledPlantIds: stringIds(sourceOrder.fulfilledPlantIds, trusted.quantity) }
      : {}),
  };
}

export function createDefaultNeighborhoodState({ day = 1 } = {}) {
  const week = weekForDay(day);
  return {
    version: NEIGHBORHOOD_STATE_VERSION,
    week,
    event: eventForWeek(week),
    order: orderForWeek(week),
    supplierOrders: 0,
    completedOrders: 0,
    missedOrders: 0,
  };
}

export function migrateNeighborhoodState(value, { day = 1, inventory = null } = {}) {
  const base = createDefaultNeighborhoodState({ day });
  const source = value && typeof value === "object" ? value : {};
  const week = weekForDay(day);
  const sameWeek = integer(source.week) === week;
  const sourceOrder = sameWeek && source.order && typeof source.order === "object" ? source.order : null;
  const order = migrateOrder(sourceOrder, week, inventory);
  return {
    ...base,
    ...source,
    version: NEIGHBORHOOD_STATE_VERSION,
    week,
    // Event terms are deterministic. Never trust saved bonus or trait values.
    event: eventForWeek(week),
    order,
    supplierOrders: integer(source.supplierOrders),
    completedOrders: integer(source.completedOrders),
    missedOrders: integer(source.missedOrders),
  };
}

export function prepareNeighborhoodDay({ state, day, inventory = [] } = {}) {
  const previous = migrateNeighborhoodState(state, { day: Math.max(1, integer(day, 1) - 1), inventory });
  const currentWeek = weekForDay(day);
  let message = "";
  let releasedPlantIds = [];
  if (previous.order?.status === ORDER_STATUS.ACTIVE && Number(day) > previous.order.deadlineDay) {
    previous.order.status = ORDER_STATUS.MISSED;
    releasedPlantIds = [...previous.order.heldPlantIds];
    previous.order.heldPlantIds = [];
    previous.missedOrders += 1;
    message = `${previous.order.customerName}'s order expired. Held plants returned to normal stock.`;
  }
  if (previous.week !== currentWeek) {
    previous.week = currentWeek;
    previous.event = eventForWeek(currentWeek);
    previous.order = orderForWeek(currentWeek);
  }
  const next = migrateNeighborhoodState(previous, { day, inventory });
  return { state: next, event: next.event, order: next.order, releasedPlantIds, message };
}

function plantQuickPrice(plant) {
  const species = SPECIES_BY_ID.get(plant?.speciesId)
    || SPECIES_BY_NAME.get(plant?.species)
    || SPECIES_BY_NAME.get(plant?.speciesName);
  const base = Number.isFinite(Number(plant?.price)) ? Number(plant.price) : Number(species?.price) || 0;
  return Math.max(0, Math.round(base * PRICE_BANDS.quick.multiplier));
}

function orderPlantConditionProblem(plant) {
  if (plant?.benchStatus || plant?.lifeStage === "juvenile") return "This plant is not ready for collection.";
  if (plant?.healthIssue || plant?.needsRehabilitation || (plant?.rootComfort && plant.rootComfort !== "comfortable")) {
    return "Restore this plant before you hold it for an order.";
  }
  if (Number.isFinite(Number(plant?.hydration)) && Number(plant.hydration) < 42) {
    return "Water this drooping plant before you hold it for an order.";
  }
  const explicitLightState = String(
    plant?.lightFit ?? plant?.lightStatus ?? plant?.condition ?? plant?.healthStatus ?? "",
  ).toLowerCase();
  if (explicitLightState === "poor" || explicitLightState.includes("light-stressed")) {
    return "Move this plant to suitable light before you hold it for an order.";
  }

  const species = SPECIES_BY_ID.get(plant?.speciesId)
    || SPECIES_BY_NAME.get(plant?.species)
    || SPECIES_BY_NAME.get(plant?.speciesName);
  const slot = Number.isInteger(plant?.slot) ? SLOT_DATA[plant.slot] : null;
  if (!species || !slot?.lightLevel) return null;
  const actual = slot.lightLevel;
  const preferred = species.preferredLight;
  const clipCorrectsLight = plant.clipGrowLightAssigned === true
    && ((preferred === "indirect" && actual === "shade")
      || (preferred === "sun" && ["shade", "indirect"].includes(actual)));
  if (preferred !== actual && !clipCorrectsLight && !species.toleratedLight?.includes(actual)) {
    return "Move this plant to suitable light before you hold it for an order.";
  }
  return null;
}

export function applyNeighborhoodEventToBriefs({
  briefs = [],
  event,
  week = 1,
  inventory = null,
  capacity = null,
} = {}) {
  const output = (Array.isArray(briefs) ? briefs : []).map((brief) => ({ ...brief }));
  if (!event?.trait || !output.length) return output;
  const species = SPECIES.filter((item) => !item.special && (item.unlockWeek || 1) <= week && item.traits.includes(event.trait));
  if (!species.length) return output;
  const cheapest = Math.min(...species.map((item) => Math.round((item.price + 3) * PRICE_BANDS.quick.multiplier)));
  const safeInventory = Array.isArray(inventory) ? inventory : null;
  const safeCapacity = Number(capacity);
  const fullShop = safeInventory && Number.isFinite(safeCapacity) && safeInventory.length >= Math.max(0, safeCapacity);
  const availableEventPlants = fullShop
    ? safeInventory.filter((plant) => plant
      && !plant.held
      && !plant.benchStatus
      && plant.lifeStage !== "juvenile"
      && plant.traits?.includes(event.trait))
    : null;
  if (fullShop && !availableEventPlants.length) return output;
  const index = output.findIndex((brief) => !brief.objectivePriceBand
    && (!Number.isFinite(brief.budget) || brief.budget >= cheapest)
    && (!fullShop || availableEventPlants.some((plant) => (
      !Number.isFinite(brief.budget) || plantQuickPrice(plant) <= brief.budget
    ))));
  if (index < 0) return output;
  const eventBrief = {
    ...output[index],
    need: event.trait,
    neighborhoodEventId: event.id,
    neighborhoodEventBonus: integer(event.bonusCoins),
    line: `${output[index].line} The ${event.title.toLowerCase()} has me thinking about something ${event.trait}.`,
  };
  if (fullShop) {
    const candidate = output.map((brief, briefIndex) => briefIndex === index ? eventBrief : brief);
    if (!inventoryCoversCustomers(safeInventory, candidate)) return output;
    return candidate;
  }
  output[index] = eventBrief;
  return output;
}

export function exactCustomerFollowUp(person, memory) {
  if (!person || !memory) return null;
  const saleDay = nullableDay(memory.lastSaleDay ?? memory.lastVisitDay) || 0;
  const orderDay = memory.lastOrderTitle ? nullableDay(memory.lastOrderDay) || 0 : 0;
  const eventDay = memory.lastEventTitle ? nullableDay(memory.lastEventDay) || 0 : 0;
  if (orderDay >= saleDay && orderDay >= eventDay && orderDay > 0) {
    return `${memory.lastOrderTitle} worked out beautifully. I came back for another good match.`;
  }
  if (eventDay >= saleDay && eventDay > 0) {
    return `The ${memory.lastEventTitle} recommendation was a success. I came back for another good match.`;
  }
  if (!memory.lastSpecies || !memory.lastPriceBand) return null;
  const band = PRICE_BANDS[memory.lastPriceBand]?.label || memory.lastPriceBand;
  return `The ${memory.lastSpecies} I bought at the ${band} price is doing well. I came back for another good match.`;
}

export function acceptWeeklyOrder({ state, day, coins = 0 } = {}) {
  const next = migrateNeighborhoodState(state, { day });
  if (!next.order || next.order.status !== ORDER_STATUS.OFFERED) return { ok: false, code: "not-offered", message: "There is no new weekly order to accept.", state: next, coins };
  next.order.status = ORDER_STATUS.ACTIVE;
  next.order.acceptedDay = integer(day, 1);
  return { ok: true, code: "accepted", message: `${next.order.customerName} paid a ${next.order.deposit}-coin deposit.`, state: next, coins: integer(coins) + next.order.deposit, deposit: next.order.deposit };
}

export function declineWeeklyOrder({ state, day } = {}) {
  const next = migrateNeighborhoodState(state, { day });
  if (!next.order || next.order.status !== ORDER_STATUS.OFFERED) return { ok: false, code: "not-offered", message: "There is no new weekly order to decline.", state: next };
  next.order.status = ORDER_STATUS.DECLINED;
  return { ok: true, code: "declined", message: "The order was declined. Regular trade continues.", state: next };
}

export function validateOrderPlant({ state, plant, day } = {}) {
  const next = migrateNeighborhoodState(state, { day });
  const order = next.order;
  if (!order || order.status !== ORDER_STATUS.ACTIVE) return { ok: false, code: "inactive", message: "Accept the weekly order first." };
  if (!plant) return { ok: false, code: "missing-plant", message: "Choose a plant in the shop first." };
  if (plant.benchStatus || plant.lifeStage === "juvenile") return { ok: false, code: "unavailable", message: "This plant is not ready for collection." };
  const conditionProblem = orderPlantConditionProblem(plant);
  if (conditionProblem) return { ok: false, code: "condition", message: conditionProblem };
  if (!plant.traits?.includes(order.requiredTrait)) return { ok: false, code: "trait", message: `This order needs ${order.requiredTrait} plants.` };
  if (order.heldPlantIds.includes(plant.id)) return { ok: false, code: "already-held", message: "This plant is already held for the order." };
  if (order.heldPlantIds.length >= order.quantity) return { ok: false, code: "full", message: "The order already has enough held plants." };
  return { ok: true, code: "ready", message: `${plant.species} can be held for this order.` };
}

export function holdPlantForOrder({ state, plant, day } = {}) {
  const validation = validateOrderPlant({ state, plant, day });
  const next = migrateNeighborhoodState(state, { day });
  if (!validation.ok) return { ...validation, state: next };
  next.order.heldPlantIds.push(plant.id);
  return { ok: true, code: "held", message: `${plant.species} is held for ${next.order.customerName}.`, state: next };
}

export function releaseOrderPlant({ state, plantId, day, inventory = [] } = {}) {
  const next = migrateNeighborhoodState(state, { day, inventory });
  if (!next.order?.heldPlantIds.includes(plantId)) return { ok: false, code: "not-held", message: "This plant is not held.", state: next };
  next.order.heldPlantIds = next.order.heldPlantIds.filter((id) => id !== plantId);
  return { ok: true, code: "released", message: "The plant returned to normal shop stock.", state: next };
}

export function completeWeeklyOrder({ state, day, inventory = [], coins = 0, bloom = 0 } = {}) {
  const next = migrateNeighborhoodState(state, { day, inventory });
  const order = next.order;
  if (!order || order.status !== ORDER_STATUS.ACTIVE) return { ok: false, code: "inactive", message: "There is no active order.", state: next, coins, bloom };
  const held = order.heldPlantIds.filter((id) => inventory.some((plant) => plant.id === id));
  if (held.length < order.quantity) return { ok: false, code: "incomplete", message: `Hold ${order.quantity - held.length} more suitable ${order.quantity - held.length === 1 ? "plant" : "plants"}.`, state: next, coins, bloom };
  const notReady = inventory.filter((plant) => held.includes(plant.id)).find((plant) => (
    !plant.traits?.includes(order.requiredTrait) || orderPlantConditionProblem(plant)
  ));
  if (notReady) return { ok: false, code: "not-ready", message: `${notReady.species} needs care before collection.`, state: next, coins, bloom };
  order.status = ORDER_STATUS.COMPLETED;
  order.completedDay = integer(day, 1);
  order.fulfilledPlantIds = held.slice(0, order.quantity);
  order.heldPlantIds = [];
  next.completedOrders += 1;
  return {
    ok: true,
    code: "completed",
    message: `${order.customerName} collected the order.`,
    state: next,
    soldPlantIds: [...order.fulfilledPlantIds],
    payout: order.rewardCoins,
    bloomReward: order.rewardBloom,
    coins: integer(coins) + order.rewardCoins,
    bloom: integer(bloom) + order.rewardBloom,
  };
}

export function supplierRelationship(state) {
  const orders = integer(state?.supplierOrders);
  if (orders >= 8) return { level: 3, name: "Nursery Partner", orders, nextAt: null, perk: "10% off Reliable Trays and one rescue species is revealed." };
  if (orders >= 3) return { level: 2, name: "Trusted Buyer", orders, nextAt: 8, perk: "Mystery Rescue traits are revealed before purchase." };
  return { level: 1, name: "New Account", orders, nextAt: 3, perk: "Book nursery deliveries to build trust." };
}

export function recordSupplierOrder(state, supplierId) {
  const next = migrateNeighborhoodState(state, { day: Math.max(1, (state?.week || 1) * 5 - 4) });
  if (supplierId && supplierId !== "no-purchase") next.supplierOrders += 1;
  return { state: next, relationship: supplierRelationship(next) };
}

export function applySupplierRelationshipToLots(lots = [], state, coins = 0) {
  const relationship = supplierRelationship(state);
  return (Array.isArray(lots) ? lots : []).map((lot) => {
    const next = { ...lot, reveal: lot.reveal ? { ...lot.reveal } : lot.reveal };
    if (relationship.level >= 2 && next.supplierId === "mystery-rescue-lot") {
      next.reveal = { ...next.reveal, visibleTraits: [...new Set(next.speciesIds?.flatMap((id) => SPECIES.find((species) => species.id === id)?.traits || []) || [])] };
      next.relationshipClue = `Rescue traits: ${next.reveal.visibleTraits.join(", ")}`;
    }
    if (relationship.level >= 3 && next.supplierId === "mystery-rescue-lot" && next.speciesNames?.length) {
      next.relationshipClue = `Known rescue: ${next.speciesNames[0]}. ${next.relationshipClue || ""}`.trim();
    }
    if (relationship.level >= 3 && next.supplierId === "reliable-tray") {
      next.originalCost = next.cost;
      next.cost = Math.max(0, Math.floor(next.cost * 0.9));
      next.affordable = integer(coins) >= next.cost;
      next.selectable = (next.quantity ?? next.speciesNames?.length ?? 0) > 0
        && next.affordable
        && next.fitsCapacity !== false
        && next.coversRequests !== false;
      next.relationshipDiscount = next.originalCost - next.cost;
    }
    return next;
  });
}

export function eventSaleBonus(person, plant, event) {
  return person?.neighborhoodEventId === event?.id && plant?.traits?.includes(event.trait)
    ? integer(event.bonusCoins)
    : 0;
}

export function weekdayIndex(day) {
  return weekdayIndexForDay(day);
}
