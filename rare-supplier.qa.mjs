import assert from "node:assert/strict";

import { CUSTOMERS, PRICE_BANDS, SPECIES } from "./game-data.js";
import { generateSupplierLots } from "./supplier-system.js";

const speciesById = new Map(SPECIES.map((species) => [species.id, species]));
const specialSpecies = SPECIES.filter((species) => species.special === true);
const rareCustomer = { id: "rare-collector", need: "rare", budget: 999 };
const collectibleCustomer = { id: "plant-collector", need: "collectible", budget: 999 };
const commonSpecies = SPECIES.find((species) => species.special !== true);

function commonPlant(index) {
  return {
    id: `common-${index}`,
    speciesId: commonSpecies.id,
    species: commonSpecies.name,
    traits: commonSpecies.traits,
    price: commonSpecies.price,
  };
}

function rareLot(options = {}) {
  return generateSupplierLots({
    day: 24,
    customers: [rareCustomer, collectibleCustomer],
    inventory: [],
    coins: 999,
    capacity: 16,
    rareNursery: true,
    ...options,
  }).find((lot) => lot.supplierId === "rare-nursery-collection");
}

assert.ok(specialSpecies.length >= 4, "The rare nursery needs a useful special-species pool.");

const defaultLots = generateSupplierLots({
  day: 24,
  customers: [rareCustomer],
  inventory: [],
  coins: 999,
  capacity: 16,
});
const explicitDefaultLots = generateSupplierLots({
  day: 24,
  customers: [rareCustomer],
  inventory: [],
  coins: 999,
  capacity: 16,
  rareNursery: false,
});
assert.deepEqual(defaultLots, explicitDefaultLots, "The default supplier output must stay unchanged.");
assert.equal(defaultLots.some((lot) => lot.supplierId === "rare-nursery-collection"), false);

const available = rareLot();
assert.ok(available, "Rare Nursery Membership must add its supplier card.");
assert.equal(available.name, "Rare Nursery Collection");
assert.ok(available.quantity >= 3 && available.quantity <= 8);
assert.equal(available.reveal.level, "species-and-traits");
assert.equal(available.rareCollection, true);
assert.equal(available.rareSpeciesCount, 1);
assert.equal(available.selectable, true);
assert.ok(available.cost > available.speciesIds.reduce(
  (total, speciesId) => total + speciesById.get(speciesId).wholesaleCost,
  0,
), "Specialist stock must include a fair premium above wholesale cost.");
assert.equal(available.speciesIds.filter((speciesId) => speciesById.get(speciesId).special).length, 1);

assert.deepEqual(available, rareLot(), "The rare collection must be deterministic.");

const unaffordable = rareLot({ coins: 0 });
assert.equal(unaffordable.affordable, false);
assert.equal(unaffordable.selectable, false);
assert.equal(unaffordable.speciesIds.join(","), available.speciesIds.join(","));

const fullInventory = Array.from({ length: 16 }, (_, index) => commonPlant(index));
const noCapacity = rareLot({
  customers: [rareCustomer],
  inventory: fullInventory,
});
assert.equal(noCapacity.quantity, 0);
assert.equal(noCapacity.fitsCapacity, true);
assert.equal(noCapacity.selectable, false);
assert.equal(noCapacity.capacityAdjusted, true);

const commonCoverage = rareLot({
  customers: [{ id: "lush-only", need: "lush", budget: 999 }],
});
assert.equal(commonCoverage.coversRequests, true);
assert.equal(commonCoverage.selectable, true);
assert.ok(commonCoverage.speciesIds.some((speciesId) => speciesById.get(speciesId).special !== true));

const oneOpenSpace = rareLot({
  customers: [rareCustomer],
  inventory: Array.from({ length: 15 }, (_, index) => commonPlant(`near-${index}`)),
});
assert.equal(oneOpenSpace.quantity, 1);
assert.equal(oneOpenSpace.fitsCapacity, true);
assert.equal(oneOpenSpace.coversRequests, true);
assert.equal(oneOpenSpace.selectable, true);

const ordinaryQueue = [
  { id: "visitor-1", need: "lush", budget: 999 },
  { id: "visitor-2", need: "upright", budget: 999 },
  { id: "visitor-3", need: "sunny", budget: 999 },
  { id: "visitor-4", need: "compact", budget: 999 },
  { id: "visitor-5", need: "graceful", budget: 999 },
];
const mismatchedStock = Array.from({ length: 4 }, (_, index) => commonPlant(`mismatch-${index}`));
const mixedCoverage = rareLot({ customers: ordinaryQueue, inventory: mismatchedStock, capacity: 16 });
assert.equal(mixedCoverage.selectable, true, "A mixed rare collection must keep an ordinary visitor queue playable.");
assert.equal(mixedCoverage.coversRequests, true);
assert.equal(mixedCoverage.rareSpeciesCount, 1);
assert.ok(mixedCoverage.speciesIds.some((speciesId) => speciesById.get(speciesId).special !== true));

const sevenVisitorQueue = ["lush", "upright", "sunny", "compact", "graceful", "patterned", "sculptural"]
  .map((need, index) => ({ id: `busy-${index}`, need, budget: 999 }));
const selloutCollection = rareLot({ customers: sevenVisitorQueue, inventory: [], capacity: 16 });
assert.equal(selloutCollection.quantity, 8, "A full sellout can receive seven request matches plus one rare specimen.");
assert.equal(selloutCollection.selectable, true);

const maximumCustomerBudget = Math.max(...CUSTOMERS.flatMap((customer) => customer.budgetRange));
specialSpecies.forEach((species) => {
  const maximumQuickRoll = Math.round((species.price + 3) * PRICE_BANDS.quick.multiplier);
  assert.ok(maximumQuickRoll <= maximumCustomerBudget, `${species.name} needs an attainable Quick-price buyer.`);
});

console.log("rare nursery supplier QA passed");
