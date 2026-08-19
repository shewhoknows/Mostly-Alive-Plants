import assert from "node:assert/strict";

import {
  CUSTOMER_ADD_ON_CHANCE_PERCENT,
  CUSTOMER_ADD_ON_START_DAY,
  SHOP_SUPPLY_STATE_VERSION,
  STARTER_SUPPLY_PACK,
  SUPPLY_CATALOG,
  assignClipGrowLight,
  assignedClipGrowLightCount,
  availableClipGrowLightCount,
  consumeSupply,
  createDefaultSupplyState,
  generateCustomerAddOnRequest,
  grantStarterSupplyPack,
  migrateSupplyState,
  plantHasClipGrowLight,
  purchaseSupply,
  releaseClipGrowLight,
  sellCustomerAddOn,
  supplyItemForId,
  validateSupplyPurchase,
} from "./shop-supply-system.js";

const EXPECTED_IDS = [
  "clip-grow-light",
  "fertilizer",
  "fungicide",
  "neem-spray",
  "potting-soil",
];

assert.deepEqual(SUPPLY_CATALOG.map(({ id }) => id), EXPECTED_IDS);
assert.equal(new Set(EXPECTED_IDS).size, SUPPLY_CATALOG.length);
SUPPLY_CATALOG.forEach((item) => {
  assert.equal(Object.isFrozen(item), true);
  assert.ok(item.buyPrice > 0 && item.restockPrice > 0);
  assert.ok(item.buyQuantity > 0 && item.restockQuantity > 0);
  assert.ok(item.maxStock >= item.buyQuantity);
  assert.ok(item.maxStock <= 16, "Stock limits stay small and bounded.");
  assert.equal(supplyItemForId(item.id), item);
});
assert.equal(Object.isFrozen(SUPPLY_CATALOG), true);
assert.equal(supplyItemForId("not-real"), null);
assert.deepEqual(
  SUPPLY_CATALOG.filter(({ customerAddOn }) => customerAddOn).map(({ id }) => id),
  ["fertilizer", "fungicide", "potting-soil"],
);

const empty = createDefaultSupplyState();
assert.deepEqual(empty, {
  version: SHOP_SUPPLY_STATE_VERSION,
  stock: {
    "clip-grow-light": 0,
    fertilizer: 0,
    fungicide: 0,
    "neem-spray": 0,
    "potting-soil": 0,
  },
  purchased: {},
  lightAssignments: {},
  starterPackGranted: false,
});
assert.deepEqual(migrateSupplyState(), empty);
assert.deepEqual(JSON.parse(JSON.stringify(empty)), empty);

const migrated = migrateSupplyState({
  version: 0,
  inventory: new Map([
    ["clip-grow-light", 1],
    ["fertilizer", { count: 999 }],
    ["fungicide", -5],
    ["not-real", 50],
  ]),
  unlockedIds: ["potting-soil", "not-real"],
  growLightAssignments: new Map([
    ["plant-z", true],
    ["plant-a", "legacy-light"],
    ["", true],
  ]),
});
assert.equal(migrated.version, SHOP_SUPPLY_STATE_VERSION);
assert.equal(migrated.stock["clip-grow-light"], 2, "Saved assignments restore enough owned lights.");
assert.equal(migrated.stock.fertilizer, supplyItemForId("fertilizer").maxStock);
assert.equal(migrated.stock.fungicide, 0);
assert.deepEqual(migrated.lightAssignments, {
  "plant-a": "clip-grow-light-1",
  "plant-z": "clip-grow-light-2",
});
assert.deepEqual(migrated.purchased, {
  "clip-grow-light": true,
  fertilizer: true,
  "potting-soil": true,
});
assert.deepEqual(migrateSupplyState(JSON.parse(JSON.stringify(migrated))), migrated);

const starter = grantStarterSupplyPack(empty);
assert.equal(starter.granted, true);
assert.equal(starter.supplyState.starterPackGranted, true);
Object.entries(STARTER_SUPPLY_PACK).forEach(([id, quantity]) => {
  assert.equal(starter.supplyState.stock[id], quantity);
});
assert.equal(grantStarterSupplyPack(starter.supplyState).granted, false);
assert.equal(generateCustomerAddOnRequest({ day: CUSTOMER_ADD_ON_START_DAY - 1, customerId: "early", plantId: "plant" }), null);

const readyFirst = validateSupplyPurchase({
  id: "fertilizer",
  supplyState: empty,
  coins: 50,
  reservedCoins: 20,
});
assert.equal(readyFirst.ok, true);
assert.equal(readyFirst.firstPurchase, true);
assert.equal(readyFirst.price, 18);
assert.equal(readyFirst.quantity, 3);
assert.equal(readyFirst.availableCoins, 30);

const fertilizerBought = purchaseSupply({
  id: "fertilizer",
  supplyState: empty,
  coins: 50,
  reservedCoins: 20,
});
assert.equal(fertilizerBought.ok, true);
assert.equal(fertilizerBought.code, "purchased");
assert.equal(fertilizerBought.coins, 32);
assert.equal(fertilizerBought.stockBefore, 0);
assert.equal(fertilizerBought.stockAfter, 3);
assert.equal(fertilizerBought.supplyState.stock.fertilizer, 3);
assert.deepEqual(empty, createDefaultSupplyState(), "Purchase does not change its input state.");

const fertilizerRestocked = purchaseSupply({
  id: "fertilizer",
  supplyState: fertilizerBought.supplyState,
  coins: fertilizerBought.coins,
  reservedCoins: 10,
});
assert.equal(fertilizerRestocked.ok, true);
assert.equal(fertilizerRestocked.code, "restocked");
assert.equal(fertilizerRestocked.firstPurchase, false);
assert.equal(fertilizerRestocked.price, 12);
assert.equal(fertilizerRestocked.coins, 20);
assert.equal(fertilizerRestocked.supplyState.stock.fertilizer, 6);

const reserved = validateSupplyPurchase({
  id: "fertilizer",
  supplyState: empty,
  coins: 30,
  reservedCoins: 13,
});
assert.equal(reserved.ok, false);
assert.equal(reserved.code, "reserved-coins");
assert.equal(reserved.availableCoins, 17);
assert.match(reserved.message, /1 more coin/);
assert.deepEqual(reserved.supplyState, empty);

const insufficient = validateSupplyPurchase({
  id: "fertilizer",
  supplyState: empty,
  coins: 10,
});
assert.equal(insufficient.ok, false);
assert.equal(insufficient.code, "insufficient-coins");
assert.equal(insufficient.coins, 10);

const unknown = validateSupplyPurchase({ id: "missing", supplyState: empty, coins: 999 });
assert.equal(unknown.ok, false);
assert.equal(unknown.code, "unknown-supply");

const fullFertilizer = migrateSupplyState({
  stock: { fertilizer: 12 },
  purchased: { fertilizer: true },
});
const atLimit = purchaseSupply({ id: "fertilizer", supplyState: fullFertilizer, coins: 999 });
assert.equal(atLimit.ok, false);
assert.equal(atLimit.code, "stock-limit");
assert.equal(atLimit.supplyState.stock.fertilizer, 12);

const miteBought = purchaseSupply({ id: "neem-spray", supplyState: empty, coins: 50 });
const miteUsed = consumeSupply({
  id: "neem-spray",
  supplyState: miteBought.supplyState,
  quantity: 2,
});
assert.equal(miteUsed.ok, true);
assert.equal(miteUsed.stockBefore, 3);
assert.equal(miteUsed.stockAfter, 1);
assert.equal(miteUsed.supplyState.stock["neem-spray"], 1);
assert.equal(miteBought.supplyState.stock["neem-spray"], 3, "Consumption does not mutate its input.");
const miteShort = consumeSupply({ id: "neem-spray", supplyState: miteUsed.supplyState, quantity: 2 });
assert.equal(miteShort.ok, false);
assert.equal(miteShort.code, "insufficient-stock");
const lightCannotBeConsumed = consumeSupply({ id: "clip-grow-light", supplyState: migrated });
assert.equal(lightCannotBeConsumed.ok, false);
assert.equal(lightCannotBeConsumed.code, "reusable-supply");

const lightBought = purchaseSupply({ id: "clip-grow-light", supplyState: empty, coins: 60 });
assert.equal(lightBought.supplyState.stock["clip-grow-light"], 1);
assert.equal(availableClipGrowLightCount(lightBought.supplyState), 1);
assert.equal(assignedClipGrowLightCount(lightBought.supplyState), 0);
const lightAssigned = assignClipGrowLight({ supplyState: lightBought.supplyState, plantId: "plant-one" });
assert.equal(lightAssigned.ok, true);
assert.equal(lightAssigned.code, "assigned");
assert.equal(lightAssigned.lightId, "clip-grow-light-1");
assert.equal(lightAssigned.availableCount, 0);
assert.equal(lightAssigned.totalOwned, 1);
assert.equal(lightAssigned.supplyState.stock["clip-grow-light"], 1, "Assignment does not consume ownership.");
assert.equal(plantHasClipGrowLight(lightAssigned.supplyState, "plant-one"), true);
const idempotentAssignment = assignClipGrowLight({ supplyState: lightAssigned.supplyState, plantId: "plant-one" });
assert.equal(idempotentAssignment.ok, true);
assert.equal(idempotentAssignment.code, "already-assigned");
assert.equal(idempotentAssignment.changed, false);
const noSecondLight = assignClipGrowLight({ supplyState: lightAssigned.supplyState, plantId: "plant-two" });
assert.equal(noSecondLight.ok, false);
assert.equal(noSecondLight.code, "no-light-available");
const lightReleased = releaseClipGrowLight({ supplyState: lightAssigned.supplyState, plantId: "plant-one" });
assert.equal(lightReleased.ok, true);
assert.equal(lightReleased.code, "released");
assert.equal(lightReleased.availableCount, 1);
assert.equal(lightReleased.supplyState.stock["clip-grow-light"], 1);
assert.equal(plantHasClipGrowLight(lightReleased.supplyState, "plant-one"), false);
const releaseAgain = releaseClipGrowLight({ supplyState: lightReleased.supplyState, plantId: "plant-one" });
assert.equal(releaseAgain.ok, true);
assert.equal(releaseAgain.code, "not-assigned");
assert.equal(releaseAgain.changed, false);

const generated = [];
for (let day = 1; day <= 500; day += 1) {
  generated.push(generateCustomerAddOnRequest({
    day,
    customer: { id: `customer-${day % 7}` },
    plant: { id: `plant-${day}` },
    saleIndex: day % 6,
  }));
}
const requests = generated.filter(Boolean);
assert.ok(requests.length >= 150 && requests.length <= 250, "The optional request rate stays balanced.");
assert.deepEqual(new Set(requests.map(({ itemId }) => itemId)), new Set(["fertilizer", "fungicide", "potting-soil"]));
requests.forEach((request) => {
  assert.equal(request.optional, true);
  assert.equal(request.blocksPlantSale, false);
  assert.ok(request.salePrice > request.costOfGoods);
  assert.equal(request.profit, request.salePrice - request.costOfGoods);
});
const deterministicOptions = { day: 37, customerId: "mina", plantId: "plant-a", saleIndex: 2 };
assert.deepEqual(generateCustomerAddOnRequest(deterministicOptions), generateCustomerAddOnRequest(deterministicOptions));
assert.equal(CUSTOMER_ADD_ON_CHANCE_PERCENT, 40);

const request = requests[0];
const outOfStock = sellCustomerAddOn({ request, supplyState: empty, coins: 25 });
assert.equal(outOfStock.ok, true);
assert.equal(outOfStock.code, "add-on-out-of-stock");
assert.equal(outOfStock.addOnSold, false);
assert.equal(outOfStock.plantSaleAllowed, true);
assert.equal(outOfStock.coins, 25);
assert.deepEqual(outOfStock.supplyState, empty);

const addOnStock = purchaseSupply({ id: request.itemId, supplyState: empty, coins: 100 });
const declined = sellCustomerAddOn({
  request,
  supplyState: addOnStock.supplyState,
  coins: addOnStock.coins,
  accepted: false,
});
assert.equal(declined.code, "declined");
assert.equal(declined.plantSaleAllowed, true);
assert.equal(declined.addOnSold, false);
assert.equal(declined.stockAfter, declined.stockBefore);

const addOnSold = sellCustomerAddOn({
  request,
  supplyState: addOnStock.supplyState,
  coins: addOnStock.coins,
});
const addOnItem = supplyItemForId(request.itemId);
assert.equal(addOnSold.ok, true);
assert.equal(addOnSold.code, "add-on-sold");
assert.equal(addOnSold.plantSaleAllowed, true);
assert.equal(addOnSold.addOnSold, true);
assert.equal(addOnSold.stockAfter, addOnSold.stockBefore - 1);
assert.equal(addOnSold.revenue, addOnItem.salePrice);
assert.equal(addOnSold.costOfGoods, addOnItem.unitCost);
assert.equal(addOnSold.profit, addOnItem.salePrice - addOnItem.unitCost);
assert.equal(addOnSold.coins, addOnStock.coins + addOnItem.salePrice);
assert.equal(addOnStock.supplyState.stock[request.itemId], addOnSold.stockBefore, "Sale does not mutate its input.");

const invalidAddOn = sellCustomerAddOn({
  request: { itemId: "neem-spray" },
  supplyState: miteBought.supplyState,
  coins: 10,
});
assert.equal(invalidAddOn.ok, false);
assert.equal(invalidAddOn.plantSaleAllowed, true);
assert.equal(invalidAddOn.addOnSold, false);
assert.equal(invalidAddOn.coins, 10);

console.log("shop supply QA passed");
