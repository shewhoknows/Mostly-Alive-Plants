import assert from "node:assert/strict";
import { PRICE_BANDS, SLOT_DATA, SPECIES } from "./game-data.js";
import { generateCustomerBriefs } from "./progression-system.js";
import { generateSupplierLots } from "./supplier-system.js";
import {
  ORDER_STATUS,
  acceptWeeklyOrder,
  applyNeighborhoodEventToBriefs,
  applySupplierRelationshipToLots,
  completeWeeklyOrder,
  createDefaultNeighborhoodState,
  declineWeeklyOrder,
  exactCustomerFollowUp,
  holdPlantForOrder,
  migrateNeighborhoodState,
  prepareNeighborhoodDay,
  recordSupplierOrder,
  releaseOrderPlant,
  supplierRelationship,
  validateOrderPlant,
} from "./neighborhood-system.js";

const plantFor = (id, trait) => ({ id, species: "QA Plant", traits: [trait], lifeStage: "mature", rootComfort: "comfortable", hydration: 80 });
const opening = createDefaultNeighborhoodState({ day: 1 });
assert.equal(opening.order, null);
assert.equal(opening.event.id, "quiet-opening");

for (let week = 2; week <= 100; week += 1) {
  const state = createDefaultNeighborhoodState({ day: (week - 1) * 5 + 1 });
  assert.equal(state.week, week);
  assert.ok(state.event.title && state.event.trait);
  assert.ok(SPECIES.some((species) => !species.special && species.unlockWeek <= week && species.traits.includes(state.event.trait)));
  assert.ok([2, 3].includes(state.order.quantity));
  assert.equal(state.order.deadlineDay, week * 5);
  const matchingSpecies = SPECIES.filter((species) => !species.special
    && species.unlockWeek <= week
    && species.traits.includes(state.order.requiredTrait));
  const highestQuick = Math.max(...matchingSpecies.map((species) => (
    Math.round((species.price + 3) * PRICE_BANDS.quick.multiplier)
  )));
  const lowestWholesale = Math.min(...matchingSpecies.map((species) => species.wholesaleCost));
  const fullPayment = state.order.deposit + state.order.rewardCoins;
  assert.ok(fullPayment >= state.order.quantity * (highestQuick + 5), `Week ${week} order must beat every eligible Quick sale.`);
  assert.ok(fullPayment > state.order.quantity * lowestWholesale, `Week ${week} order must be profitable at wholesale.`);
}

let state = createDefaultNeighborhoodState({ day: 6 });
const accepted = acceptWeeklyOrder({ state, day: 6, coins: 20 });
assert.equal(accepted.ok, true);
assert.equal(accepted.coins, 20 + accepted.deposit);
state = accepted.state;
const trait = state.order.requiredTrait;
const first = plantFor("one", trait);
const second = plantFor("two", trait);
const wrong = plantFor("wrong", "not-the-trait");
assert.equal(holdPlantForOrder({ state, plant: wrong, day: 6 }).code, "trait");
let held = holdPlantForOrder({ state, plant: first, day: 6 });
assert.equal(held.ok, true);
state = held.state;
held = holdPlantForOrder({ state, plant: second, day: 6 });
assert.equal(held.ok, true);
state = held.state;
const completed = completeWeeklyOrder({ state, day: 8, inventory: [first, second], coins: accepted.coins, bloom: 0 });
assert.equal(completed.ok, true);
assert.equal(completed.soldPlantIds.length, 2);
assert.equal(completed.state.order.status, ORDER_STATUS.COMPLETED);
assert.equal(completed.state.order.heldPlantIds.length, 0);
assert.equal(completed.state.order.fulfilledPlantIds.length, 2);
assert.ok(completed.coins > accepted.coins && completed.bloom > 0);

let conditionState = acceptWeeklyOrder({ state: createDefaultNeighborhoodState({ day: 6 }), day: 6 }).state;
const conditionTrait = conditionState.order.requiredTrait;
const dryPlant = { ...plantFor("dry", conditionTrait), hydration: 12 };
assert.equal(validateOrderPlant({ state: conditionState, plant: dryPlant, day: 6 }).code, "condition");
const conditionSpecies = SPECIES.find((species) => !species.special
  && species.unlockWeek <= conditionState.week
  && species.traits.includes(conditionTrait));
const poorSlot = SLOT_DATA.findIndex((slot) => slot.lightLevel !== conditionSpecies.preferredLight
  && !conditionSpecies.toleratedLight.includes(slot.lightLevel));
assert.ok(poorSlot >= 0);
const poorLightPlant = {
  ...plantFor("poor-light", conditionTrait),
  species: conditionSpecies.name,
  speciesId: conditionSpecies.id,
  slot: poorSlot,
};
assert.equal(validateOrderPlant({ state: conditionState, plant: poorLightPlant, day: 6 }).code, "condition");
const healthyA = plantFor("condition-a", conditionTrait);
const healthyB = plantFor("condition-b", conditionTrait);
conditionState = holdPlantForOrder({ state: conditionState, plant: healthyA, day: 6 }).state;
conditionState = holdPlantForOrder({ state: conditionState, plant: healthyB, day: 6 }).state;
const declinedAtCollection = completeWeeklyOrder({
  state: conditionState,
  day: 7,
  inventory: [{ ...healthyA, hydration: 10 }, healthyB],
});
assert.equal(declinedAtCollection.code, "not-ready");

let releaseState = acceptWeeklyOrder({ state: createDefaultNeighborhoodState({ day: 11 }), day: 11 }).state;
const releasePlant = plantFor("release", releaseState.order.requiredTrait);
releaseState = holdPlantForOrder({ state: releaseState, plant: releasePlant, day: 11 }).state;
const released = releaseOrderPlant({ state: releaseState, plantId: releasePlant.id, day: 11, inventory: [releasePlant] });
assert.equal(released.ok, true);
assert.equal(released.state.order.heldPlantIds.length, 0);

const declined = declineWeeklyOrder({ state: createDefaultNeighborhoodState({ day: 16 }), day: 16 });
assert.equal(declined.state.order.status, ORDER_STATUS.DECLINED);
const expiredBase = acceptWeeklyOrder({ state: createDefaultNeighborhoodState({ day: 21 }), day: 21 }).state;
const expired = prepareNeighborhoodDay({ state: expiredBase, day: 26, inventory: [] });
assert.equal(expired.state.week, 6);
assert.equal(expired.state.order.status, ORDER_STATUS.OFFERED);
assert.equal(expired.state.missedOrders, 1);

const eventState = createDefaultNeighborhoodState({ day: 6 });
const briefs = applyNeighborhoodEventToBriefs({ briefs: [{ id: "a", budget: 99, line: "Hello" }], event: eventState.event, week: 2 });
assert.equal(briefs[0].need, eventState.event.trait);
assert.equal(briefs[0].neighborhoodEventBonus, 2);
assert.match(exactCustomerFollowUp({}, { lastSpecies: "Fern", lastPriceBand: "fair" }), /Fern.*Fair/);
assert.match(exactCustomerFollowUp({}, {
  lastSpecies: "Fern",
  lastPriceBand: "fair",
  lastVisitDay: 9,
  lastOrderDay: 10,
  lastOrderTitle: "Mina's office collection",
}), /Mina's office collection/);
assert.match(exactCustomerFollowUp({}, {
  lastSpecies: "Fern",
  lastPriceBand: "fair",
  lastVisitDay: 9,
  lastEventDay: 11,
  lastEventTitle: "Sunny spell",
}), /Sunny spell/);

const canonicalWeekTwo = createDefaultNeighborhoodState({ day: 6 });
const migrationPlant = plantFor("kept", canonicalWeekTwo.order.requiredTrait);
const hardened = migrateNeighborhoodState({
  week: 2,
  event: { id: "hacked", title: "Hacked", trait: "not-real", bonusCoins: 1_000_000 },
  order: {
    ...canonicalWeekTwo.order,
    status: ORDER_STATUS.ACTIVE,
    customerName: "Hacker",
    requiredTrait: "not-real",
    quantity: 99,
    deposit: 1_000_000,
    rewardCoins: 1_000_000,
    deadlineDay: 999,
    heldPlantIds: ["kept", "kept", "missing"],
  },
}, { day: 6, inventory: [migrationPlant] });
assert.equal(hardened.order.customerName, canonicalWeekTwo.order.customerName);
assert.equal(hardened.order.requiredTrait, canonicalWeekTwo.order.requiredTrait);
assert.equal(hardened.order.quantity, canonicalWeekTwo.order.quantity);
assert.equal(hardened.order.deposit, canonicalWeekTwo.order.deposit);
assert.equal(hardened.order.rewardCoins, canonicalWeekTwo.order.rewardCoins);
assert.equal(hardened.order.deadlineDay, canonicalWeekTwo.order.deadlineDay);
assert.deepEqual(hardened.order.heldPlantIds, ["kept"]);
assert.deepEqual(hardened.event, canonicalWeekTwo.event);
const invalidStatus = migrateNeighborhoodState({
  week: 2,
  order: { ...canonicalWeekTwo.order, status: "paid-twice", heldPlantIds: ["kept"] },
}, { day: 6, inventory: [migrationPlant] });
assert.equal(invalidStatus.order.status, ORDER_STATUS.OFFERED);
assert.deepEqual(invalidStatus.order.heldPlantIds, []);

const dayTwelve = createDefaultNeighborhoodState({ day: 12 });
const heldEventPlant = { ...plantFor("held-event", dayTwelve.event.trait), held: true };
const fullInventory = [heldEventPlant, ...Array.from({ length: 11 }, (_, index) => plantFor(`other-${index}`, "other"))];
const lockedBriefs = applyNeighborhoodEventToBriefs({
  briefs: [{ id: "day-12", budget: 999, line: "Hello" }],
  event: dayTwelve.event,
  week: dayTwelve.week,
  inventory: fullInventory,
  capacity: 12,
});
assert.equal(lockedBriefs[0].neighborhoodEventId, undefined, "Day 12 cannot request event stock when the only match is held in a full shop.");
const feasibleBriefs = applyNeighborhoodEventToBriefs({
  briefs: [{ id: "day-12", budget: 999, line: "Hello" }],
  event: dayTwelve.event,
  week: dayTwelve.week,
  inventory: [{ ...heldEventPlant, held: false }, ...fullInventory.slice(1)],
  capacity: 12,
});
assert.equal(feasibleBriefs[0].neighborhoodEventId, dayTwelve.event.id);

const daySixEvent = createDefaultNeighborhoodState({ day: 6 }).event;
const stockRecord = (speciesId, index) => {
  const species = SPECIES.find((item) => item.id === speciesId);
  return {
    id: `${speciesId}-${index}`,
    speciesId,
    species: species.name,
    traits: [...species.traits],
    lifeStage: "mature",
    rootComfort: "comfortable",
    hydration: 80,
  };
};
const sharedMatchInventory = [
  ...Array.from({ length: 3 }, (_, index) => stockRecord("spoonflower-lily", index)),
  ...Array.from({ length: 4 }, (_, index) => stockRecord("coinleaf-pilea", index)),
  ...Array.from({ length: 2 }, (_, index) => stockRecord("pinstripe-calathea", index)),
  ...Array.from({ length: 2 }, (_, index) => stockRecord("little-monstera", index)),
  stockRecord("velvet-pothos", 0),
];
const sharedMatchBriefs = [
  { id: "dramatic", need: "dramatic", budget: 999, line: "Dramatic" },
  { id: "patterned", need: "patterned", budget: 999, line: "Patterned" },
  { id: "trailing", need: "trailing", budget: 999, line: "Trailing" },
  { id: "compact", need: "compact", budget: 999, line: "Compact" },
];
assert.equal(
  applyNeighborhoodEventToBriefs({
    briefs: sharedMatchBriefs,
    event: daySixEvent,
    week: 2,
    inventory: sharedMatchInventory,
    capacity: 12,
  })[0].need,
  "dramatic",
  "A full-shop event cannot reuse one plant for two distinct visitor notes.",
);

let relationshipState = migrateNeighborhoodState(null, { day: 6 });
for (let index = 0; index < 8; index += 1) relationshipState = recordSupplierOrder(relationshipState, "reliable-tray").state;
assert.equal(supplierRelationship(relationshipState).level, 3);
const improved = applySupplierRelationshipToLots([{ supplierId: "reliable-tray", cost: 20, quantity: 3, selectable: true }], relationshipState, 18);
assert.equal(improved[0].cost, 18);
assert.equal(improved[0].selectable, true);

const roundTrip = migrateNeighborhoodState(JSON.parse(JSON.stringify(relationshipState)), { day: 6, inventory: [] });
assert.equal(roundTrip.supplierOrders, 8);

for (let day = 6; day <= 150; day += 1) {
  const neighborhood = createDefaultNeighborhoodState({ day });
  const briefs = applyNeighborhoodEventToBriefs({
    briefs: generateCustomerBriefs({ day, count: 6, inventory: [], capacity: 20 }),
    event: neighborhood.event,
    week: neighborhood.week,
  });
  assert.equal(briefs.length, 6, `Day ${day} must keep six distinct briefs.`);
  const lots = generateSupplierLots({ day, customers: briefs, inventory: [], coins: 999, capacity: 20 });
  assert.ok(lots.some((lot) => lot.selectable), `Day ${day} event demand needs a selectable supplier route.`);
}
console.log("neighborhood order, event, follow-up, and supplier QA passed");
