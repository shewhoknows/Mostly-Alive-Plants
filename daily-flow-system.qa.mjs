import assert from "node:assert/strict";

import {
  BATCH_UNPACK_START_DAY,
  CARE_BLOOM_DAILY_CAP,
  DISPLAY_GOAL_REWARD,
  PERFECT_DAY_BLOOM_REWARD,
  canBatchUnpack,
  careBloomReward,
  perfectDayBloomReward,
  plantSaleReadiness,
  saleBloomReward,
  sortKeyboardTargets,
} from "./daily-flow-system.js";

const species = { beneficialCare: ["water", "mist"] };
const readyPlant = {
  id: "plant-a",
  traits: ["lush"],
  slot: 1,
  lifeStage: "mature",
  care: { water: true, mist: true },
  hydration: 90,
};

assert.equal(BATCH_UNPACK_START_DAY, 6);
assert.equal(canBatchUnpack({ day: 5, crates: 6 }), false);
assert.equal(canBatchUnpack({ day: 6, crates: 1 }), false);
assert.equal(canBatchUnpack({ day: 6, crates: 2 }), true);
assert.equal(CARE_BLOOM_DAILY_CAP, 3);
assert.deepEqual(DISPLAY_GOAL_REWARD, { coins: 4, bloom: 1 });
assert.equal(careBloomReward(0), 1);
assert.equal(careBloomReward(2), 1);
assert.equal(careBloomReward(3), 0);
assert.deepEqual([0, 1, 2, 3].map(saleBloomReward), [1, 1, 2, 2]);
assert.equal(perfectDayBloomReward({ perfects: 4, visitorCount: 4, completedSales: 4 }), PERFECT_DAY_BLOOM_REWARD);
assert.equal(perfectDayBloomReward({ perfects: 3, visitorCount: 4, completedSales: 4 }), 0);
assert.equal(perfectDayBloomReward({ perfects: 4, visitorCount: 4, completedSales: 4, alreadyPaid: true }), 0);

const targets = [
  { entity: { kind: "station", id: "watering-can" } },
  { entity: { kind: "slot", id: 2 } },
  { entity: { kind: "plant", id: "plant-b" } },
  { entity: { kind: "customer", id: "customer" } },
  { entity: { kind: "plant", id: "plant-a" } },
  { entity: { kind: "crate", id: "cartons" } },
  { entity: { kind: "station", id: "care-bench" } },
];
assert.deepEqual(
  sortKeyboardTargets(targets, ["plant-a", "plant-b"]).map((target) => target.entity.kind === "station"
    ? target.entity.id
    : target.entity.id),
  ["plant-a", "plant-b", "cartons", "customer", "care-bench", "watering-can"],
);

const ready = plantSaleReadiness({
  plant: readyPlant,
  species,
  light: { level: "ideal", label: "ideal shade light" },
  conditionLabel: "thriving",
  customer: { need: "lush", budget: 24 },
  askingPrice: 20,
});
assert.equal(ready.status, "ready");
assert.equal(ready.checks.length, 7);

const unplaced = plantSaleReadiness({
  plant: { ...readyPlant, slot: null },
  species,
  light: { level: "unplaced", label: "light undecided" },
  conditionLabel: "comfortable",
});
assert.equal(unplaced.status, "blocked");
assert.match(unplaced.summary, /display/i);

const rescue = plantSaleReadiness({
  plant: readyPlant,
  species,
  light: { level: "ideal", label: "ideal shade light" },
  conditionLabel: "nursery-stressed",
});
assert.equal(rescue.status, "quick");
assert.match(rescue.summary, /Quick tag/i);

const held = plantSaleReadiness({
  plant: { ...readyPlant, held: true },
  species,
  light: { level: "ideal", label: "ideal shade light" },
  conditionLabel: "comfortable",
});
assert.equal(held.status, "blocked");
assert.match(held.summary, /weekly order/i);

const wrongCustomer = plantSaleReadiness({
  plant: readyPlant,
  species,
  light: { level: "ideal", label: "ideal shade light" },
  conditionLabel: "comfortable",
  customer: { need: "sunny", budget: 18 },
  askingPrice: 20,
});
assert.equal(wrongCustomer.status, "blocked");
assert.equal(wrongCustomer.checks.at(-1).state, "blocked");

const weakBoutique = plantSaleReadiness({
  plant: readyPlant,
  species,
  light: { level: "tolerable", label: "tolerable indirect light" },
  conditionLabel: "comfortable",
  customer: { need: "lush", budget: 40 },
  askingPrice: 24,
  priceBand: "boutique",
  boutiqueReady: false,
});
assert.equal(weakBoutique.status, "blocked");
assert.match(weakBoutique.summary, /Boutique/i);

console.log("Daily flow QA passed.");
