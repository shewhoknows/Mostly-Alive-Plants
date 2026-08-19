import assert from "node:assert/strict";

import { INVENTORY_CAPACITY, SPECIES } from "./game-data.js";
import {
  askingPrice,
  generateCustomerBriefs,
} from "./progression-system.js";
import {
  generateSupplierLots,
  inventoryCoversCustomers,
} from "./supplier-system.js";
import { dailyTradeProfile } from "./trade-system.js";
import { ORDER_STATUS, createDefaultNeighborhoodState } from "./neighborhood-system.js";

const speciesById = new Map(SPECIES.map((species) => [species.id, species]));

function plantRecord(species, index, extra = {}) {
  return {
    id: `qa-${species.id}-${index}`,
    speciesId: species.id,
    species: species.name,
    traits: species.traits,
    price: species.price + 3,
    ...extra,
  };
}

function previewInventory(lot) {
  return lot.speciesIds.map((speciesId, index) => {
    const species = speciesById.get(speciesId);
    return plantRecord(species, `preview-${index}`, {
      hydration: lot.deliveries?.[index]?.condition === "stressed" ? 30 : 80,
      rootComfort: "comfortable",
      needsRehabilitation: lot.deliveries?.[index]?.condition === "stressed",
    });
  });
}

const fern = speciesById.get("button-fern");
const succulent = speciesById.get("pocket-succulent");
const lushCustomer = { id: "qa-lush", need: "lush", budget: 99 };
const availableFern = plantRecord(fern, "available");
const benchFern = plantRecord(fern, "bench", {
  benchStatus: { jobType: "repot", readyDay: 8 },
});
const juvenileFern = plantRecord(fern, "juvenile", {
  lifeStage: "juvenile",
  maturityDaysRemaining: 2,
});

assert.equal(inventoryCoversCustomers([availableFern], [lushCustomer]), true);
assert.equal(inventoryCoversCustomers([benchFern], [lushCustomer]), false);
assert.equal(inventoryCoversCustomers([juvenileFern], [lushCustomer]), false);

const busyStock = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => (
  plantRecord(fern, `busy-${index}`, { benchStatus: { jobType: "rehabilitate", readyDay: 12 } })
));
const genericBriefs = generateCustomerBriefs({ day: 11, count: 5, inventory: [], capacity: INVENTORY_CAPACITY });
const busyStockBriefs = generateCustomerBriefs({
  day: 11,
  count: 5,
  inventory: busyStock,
  capacity: INVENTORY_CAPACITY,
});
assert.deepEqual(busyStockBriefs, genericBriefs, "Bench plants must not seed stock briefs.");
const juvenileStock = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => (
  plantRecord(fern, `juvenile-${index}`, { lifeStage: "juvenile", maturityDaysRemaining: 2 })
));
const juvenileStockBriefs = generateCustomerBriefs({
  day: 11,
  count: 5,
  inventory: juvenileStock,
  capacity: INVENTORY_CAPACITY,
});
assert.deepEqual(juvenileStockBriefs, genericBriefs, "Juvenile plants must not seed stock briefs.");

const nearCapacityInventory = Array.from({ length: 15 }, (_, index) => plantRecord(succulent, `near-${index}`));
const nearCapacityLots = generateSupplierLots({
  day: 20,
  customers: [lushCustomer],
  inventory: nearCapacityInventory,
  coins: 999,
  capacity: 16,
});
assert.equal(nearCapacityLots.length, 3);
nearCapacityLots.forEach((lot) => {
  assert.equal(lot.quantity, 1);
  assert.equal(lot.capacityAdjusted, true);
  assert.equal(lot.selectable, true);
  assert.equal(inventoryCoversCustomers([...nearCapacityInventory, ...previewInventory(lot)], [lushCustomer]), true);
});

const repeatedSpeciesInventory = Array.from({ length: 6 }, (_, index) => plantRecord(fern, `variety-${index}`));
const varietyCustomers = generateCustomerBriefs({
  day: 11,
  count: 5,
  inventory: repeatedSpeciesInventory,
  capacity: 16,
});
const varietyLots = generateSupplierLots({
  day: 11,
  customers: varietyCustomers,
  inventory: repeatedSpeciesInventory,
  coins: 999,
  capacity: 16,
}).slice(0, 3);
varietyLots.forEach((lot) => {
  assert.equal(lot.uniqueSpeciesCount, new Set(lot.speciesIds).size);
  assert.ok(lot.uniqueSpeciesCount >= Math.min(3, lot.quantity), `${lot.name} must provide a useful species range.`);
  assert.ok(lot.newSpeciesCount >= Math.min(3, lot.quantity), `${lot.name} must prefer species that are not already in stock.`);
});

const fullMissingInventory = Array.from({ length: 16 }, (_, index) => plantRecord(succulent, `full-${index}`));
const fullMissingLots = generateSupplierLots({
  day: 20,
  customers: [lushCustomer],
  inventory: fullMissingInventory,
  coins: 999,
  capacity: 16,
});
assert.equal(fullMissingLots.length, 3, "A full shop with no match must not offer Use Current Stock.");
fullMissingLots.forEach((lot) => {
  assert.equal(lot.quantity, 0);
  assert.equal(lot.selectable, false);
});

const fullCoveredInventory = [availableFern, ...fullMissingInventory.slice(1)];
const fullCoveredLots = generateSupplierLots({
  day: 20,
  customers: [lushCustomer],
  inventory: fullCoveredInventory,
  coins: 999,
  capacity: 16,
});
assert.equal(fullCoveredLots.at(-1).kind, "no-purchase");
assert.equal(fullCoveredLots.at(-1).selectable, true);

const fullBusyInventory = [benchFern, ...fullMissingInventory.slice(1)];
const fullBusyLots = generateSupplierLots({
  day: 20,
  customers: [lushCustomer],
  inventory: fullBusyInventory,
  coins: 999,
  capacity: 16,
});
assert.equal(fullBusyLots.length, 3, "A bench plant must not unlock Use Current Stock.");
fullBusyLots.forEach((lot) => assert.equal(lot.quantity, 0, "Bench work must still use inventory capacity."));

const fullJuvenileInventory = [juvenileFern, ...fullMissingInventory.slice(1)];
const fullJuvenileLots = generateSupplierLots({
  day: 20,
  customers: [lushCustomer],
  inventory: fullJuvenileInventory,
  coins: 999,
  capacity: 16,
});
assert.equal(fullJuvenileLots.length, 3, "A juvenile plant must not unlock Use Current Stock.");
fullJuvenileLots.forEach((lot) => assert.equal(lot.quantity, 0, "A juvenile plant must still use inventory capacity."));

const rescueDay = 10;
const rescueProfile = dailyTradeProfile({ day: rescueDay, inventoryCount: 0, capacity: 16 });
const rescueCustomers = generateCustomerBriefs({
  day: rescueDay,
  count: rescueProfile.visitorCount,
  inventory: [],
  capacity: 16,
});
const rescueLot = generateSupplierLots({
  day: rescueDay,
  customers: rescueCustomers,
  inventory: [],
  coins: 0,
  capacity: 16,
}).find((lot) => lot.supplierId === "mystery-rescue-lot");
assert.ok(rescueLot.nurseryCost > 0);
assert.equal(rescueLot.hardshipCredit, true);
assert.equal(rescueLot.cost, 0);
assert.equal(rescueLot.affordable, true);
assert.equal(rescueLot.coversRequests, true);
assert.equal(rescueLot.selectable, true);
assert.ok(rescueLot.stressedQuantity >= 2 && rescueLot.stressedQuantity <= 3);
assert.equal(rescueLot.deliveries.filter((delivery) => delivery.condition === "stressed").length, rescueLot.stressedQuantity);
assert.equal(rescueLot.deliveries.filter((delivery) => delivery.condition === "healthy").length, rescueLot.healthyQuantity);

const signDay = 15;
const signProfile = dailyTradeProfile({ day: signDay, inventoryCount: 0, capacity: 16, visitorBonus: 1 });
assert.equal(signProfile.visitorCount, 7);
const signCustomers = generateCustomerBriefs({
  day: signDay,
  count: signProfile.visitorCount,
  inventory: [],
  capacity: 16,
});
const signLots = generateSupplierLots({
  day: signDay,
  customers: signCustomers,
  inventory: [],
  coins: 0,
  capacity: 16,
});
const signRescue = signLots.find((lot) => lot.supplierId === "mystery-rescue-lot");
assert.equal(signRescue.quantity, 7);
assert.equal(signRescue.selectable, true);
assert.equal(inventoryCoversCustomers(previewInventory(signRescue), signCustomers), true);
assert.equal(signRescue.stressedQuantity, 3);
assert.equal(signRescue.healthyQuantity, 4);

const weekTwoOrder = createDefaultNeighborhoodState({ day: 6 }).order;
weekTwoOrder.status = ORDER_STATUS.ACTIVE;
weekTwoOrder.acceptedDay = 6;
for (let day = 7; day <= weekTwoOrder.deadlineDay; day += 1) {
  const profile = dailyTradeProfile({ day, inventoryCount: 0, capacity: 16 });
  const customers = generateCustomerBriefs({ day, count: profile.visitorCount, inventory: [], capacity: 16 });
  const lots = generateSupplierLots({
    day,
    customers,
    inventory: [],
    coins: 999,
    capacity: 16,
    weeklyOrder: weekTwoOrder,
  });
  const safeLot = lots.find((lot) => lot.selectable && lot.orderReady === true);
  assert.ok(safeLot, `Day ${day} must offer healthy stock for the accepted Friday order.`);
  const combinedNeeds = [
    ...customers,
    ...Array.from({ length: weekTwoOrder.quantity }, (_, index) => ({
      id: `order-${index}`,
      need: weekTwoOrder.requiredTrait,
      healthyOnly: true,
    })),
  ];
  assert.equal(
    inventoryCoversCustomers(previewInventory(safeLot), combinedNeeds),
    true,
    `Day ${day} order-ready lot must cover visitors and distinct healthy order stock.`,
  );
}

const curatedCarryStock = Array.from({ length: 10 }, (_, index) => plantRecord(SPECIES[index], `carry-${index}`));
const curatedCarryProfile = dailyTradeProfile({ day: 20, inventoryCount: curatedCarryStock.length, capacity: 20 });
const curatedCarryCustomers = generateCustomerBriefs({
  day: 20,
  count: curatedCarryProfile.visitorCount,
  inventory: curatedCarryStock,
  capacity: 20,
});
const curatedCarryLot = generateSupplierLots({
  day: 20,
  customers: curatedCarryCustomers,
  inventory: curatedCarryStock,
  coins: 999,
  capacity: 20,
}).find((lot) => lot.supplierId === "curated-pair");
assert.equal(
  curatedCarryLot.quantity,
  curatedCarryProfile.stockTarget - curatedCarryStock.length,
  "Curated stock must refill the full range target instead of draining one plant per day.",
);

const fullMixedStock = [
  ...Array.from({ length: 6 }, (_, index) => plantRecord(SPECIES[index % SPECIES.length], `ready-${index}`)),
  ...Array.from({ length: 4 }, (_, index) => plantRecord(fern, `young-${index}`, { lifeStage: "juvenile" })),
  ...Array.from({ length: 2 }, (_, index) => plantRecord(fern, `bench-mixed-${index}`, { benchStatus: { jobType: "repot" } })),
];
const serviceableProfile = dailyTradeProfile({
  day: 19,
  inventoryCount: fullMixedStock.length,
  capacity: 12,
  visitorBonus: 1,
  serviceableCapacity: 6,
});
assert.equal(serviceableProfile.visitorCount, 6);
const serviceableCustomers = generateCustomerBriefs({
  day: 19,
  count: serviceableProfile.visitorCount,
  inventory: fullMixedStock,
  capacity: 12,
});
const serviceableLots = generateSupplierLots({
  day: 19,
  customers: serviceableCustomers,
  inventory: fullMixedStock,
  coins: 999,
  capacity: 12,
});
assert.equal(serviceableLots.at(-1).kind, "no-purchase");
assert.equal(serviceableLots.at(-1).selectable, true);

const maxRollInventory = SPECIES.map((species, index) => plantRecord(species, `max-${index}`));
for (let day = 26; day <= 30; day += 1) {
  const profile = dailyTradeProfile({ day, inventoryCount: maxRollInventory.length, capacity: 16 });
  const customers = generateCustomerBriefs({
    day,
    count: profile.visitorCount,
    inventory: maxRollInventory,
    capacity: 16,
  });
  const boutiqueCustomers = customers.filter((customer) => customer.objectivePriceBand === "boutique");
  assert.equal(boutiqueCustomers.length, 1, `Day ${day} must include its Boutique brief.`);
  assert.equal(inventoryCoversCustomers(maxRollInventory, customers), true, `Day ${day} max-roll stock must cover all briefs.`);
  boutiqueCustomers.forEach((customer) => {
    const affordableMatch = maxRollInventory.some((plant) => (
      plant.traits.includes(customer.need)
      && askingPrice({ ...plant, priceBand: "boutique" }) <= customer.budget
    ));
    assert.equal(affordableMatch, true, `Day ${day} Boutique budget must cover a max-roll plant.`);
  });
}

let slowestSupplierGeneration = 0;
let slowestSupplierDay = 0;
let slowestSupplierPass = 0;
let totalSupplierGeneration = 0;
let measuredSupplierPasses = 0;
const repetitionsPerDay = 3;
for (let day = 1; day <= 100; day += 1) {
  const profile = dailyTradeProfile({ day, inventoryCount: 0, capacity: 16 });
  const customers = generateCustomerBriefs({
    day,
    count: profile.visitorCount,
    inventory: [],
    capacity: 16,
  });
  assert.equal(customers.length, profile.visitorCount, `Day ${day} must fill its visitor queue.`);

  let lots = null;
  for (let pass = 1; pass <= repetitionsPerDay; pass += 1) {
    const startedAt = performance.now();
    const generated = generateSupplierLots({ day, customers, inventory: [], coins: 999, capacity: 16 });
    const elapsed = performance.now() - startedAt;
    totalSupplierGeneration += elapsed;
    measuredSupplierPasses += 1;
    if (elapsed > slowestSupplierGeneration) {
      slowestSupplierGeneration = elapsed;
      slowestSupplierDay = day;
      slowestSupplierPass = pass;
    }
    assert.ok(elapsed < 250, `Day ${day}, pass ${pass} supplier generation took ${elapsed.toFixed(1)} ms.`);
    if (lots === null) lots = generated;
    else assert.deepEqual(generated, lots, `Day ${day} supplier lots must be deterministic on pass ${pass}.`);
  }

  assert.ok(lots.some((lot) => lot.kind === "supplier" && lot.selectable), `Day ${day} needs a valid supplier lot.`);
  lots.filter((lot) => lot.kind === "supplier").forEach((lot) => {
    assert.ok(lot.quantity >= 0 && lot.quantity <= 7);
    assert.ok(lot.quantity <= 16);
    if (lot.selectable) {
      assert.equal(inventoryCoversCustomers(previewInventory(lot), customers), true);
    }
  });
}

assert.ok(slowestSupplierGeneration < 250, `Supplier generation took ${slowestSupplierGeneration.toFixed(1)} ms.`);
console.log(
  `supplier/progression QA passed for Days 1-100; slowest supplier pass ${slowestSupplierGeneration.toFixed(1)} ms `
  + `(Day ${slowestSupplierDay}, pass ${slowestSupplierPass}); mean `
  + `${(totalSupplierGeneration / measuredSupplierPasses).toFixed(2)} ms across ${measuredSupplierPasses} passes`,
);
