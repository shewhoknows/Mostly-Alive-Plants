import assert from "node:assert/strict";

import {
  BENCH_JOB_TYPES,
  advanceAndApplyBenchJobs,
  createDefaultBenchState,
  migrateBenchState,
  reconcileBenchInventory,
  startBenchJob,
} from "./care-bench-system.js";
import { SPECIES } from "./game-data.js";

const fern = SPECIES.find((species) => species.name === "Button Fern") || SPECIES[0];

function plant(id, overrides = {}) {
  return {
    id,
    speciesId: fern.id,
    species: fern.name,
    traits: [...fern.traits],
    price: fern.price,
    wholesaleCost: fern.wholesaleCost,
    acquisitionCost: fern.wholesaleCost,
    hydration: 82,
    care: { water: false, mist: false, prune: false },
    lifeStage: "mature",
    rootComfort: "comfortable",
    rootAgeDays: 0,
    benchStatus: null,
    slot: 0,
    ...overrides,
  };
}

let inventory = [plant("repot-me", { rootComfort: "cramped", rootAgeDays: 4, price: 18 })];
let benchState = createDefaultBenchState();
const repot = startBenchJob({
  type: BENCH_JOB_TYPES.REPOT,
  plantId: "repot-me",
  inventory,
  benchState,
  coins: 40,
  bloom: 12,
  day: 1,
  capacity: 12,
});
assert.equal(repot.ok, true);
assert.equal(repot.coins, 30);
assert.equal(repot.inventory[0].slot, null);
assert.equal(repot.inventory[0].benchStatus.type, BENCH_JOB_TYPES.REPOT);

const saved = JSON.parse(JSON.stringify({ inventory: repot.inventory, benchState: repot.benchState }));
const reconciled = reconcileBenchInventory(saved);
const repotDone = advanceAndApplyBenchJobs({
  ...reconciled,
  day: 2,
  capacity: 12,
});
assert.equal(repotDone.appliedJobs.length, 1);
assert.equal(repotDone.inventory[0].price, 22);
assert.equal(repotDone.inventory[0].rootComfort, "comfortable");
assert.equal(repotDone.inventory[0].rootAgeDays, 0);
assert.equal(repotDone.inventory[0].acquisitionCost, fern.wholesaleCost + 10);

inventory = [plant("rescue", { hydration: 33, needsRehabilitation: true, slot: null })];
const rehab = startBenchJob({
  type: BENCH_JOB_TYPES.REHABILITATE,
  plantId: "rescue",
  inventory,
  benchState: createDefaultBenchState(),
  coins: 20,
  bloom: 0,
  day: 4,
  capacity: 12,
  condition: "stressed",
});
assert.equal(rehab.ok, true);
const rehabDone = advanceAndApplyBenchJobs({
  benchState: rehab.benchState,
  inventory: rehab.inventory,
  day: 5,
  capacity: 12,
});
assert.equal(rehabDone.inventory[0].needsRehabilitation, false);
assert.equal(rehabDone.inventory[0].hydration, 88);
assert.equal(rehabDone.inventory[0].conditionProtectionUntilDay, 6);
assert.equal(rehabDone.inventory[0].acquisitionCost, fern.wholesaleCost + 8);

inventory = [plant("parent", { hydration: 92 })];
const propagation = startBenchJob({
  type: BENCH_JOB_TYPES.PROPAGATE,
  plantId: "parent",
  inventory,
  benchState: createDefaultBenchState(),
  coins: 30,
  bloom: 10,
  day: 7,
  capacity: 12,
  condition: "thriving",
});
assert.equal(propagation.ok, true);
assert.equal(propagation.bloom, 5);
const propagationDone = advanceAndApplyBenchJobs({
  benchState: propagation.benchState,
  inventory: propagation.inventory,
  day: 9,
  capacity: 12,
});
assert.equal(propagationDone.inventory.length, 2);
const child = propagationDone.inventory.find((entry) => entry.parentId === "parent");
assert.equal(child.lifeStage, "juvenile");
assert.equal(child.maturityDaysRemaining, 3);
assert.equal(child.acquisitionCost, 0);
assert.equal(propagationDone.inventory.find((entry) => entry.id === "parent").acquisitionCost, fern.wholesaleCost + 12);

const crowded = Array.from({ length: 11 }, (_, index) => plant(`stock-${index}`, { slot: null }));
const crowdedPropagation = startBenchJob({
  type: BENCH_JOB_TYPES.PROPAGATE,
  plantId: "stock-0",
  inventory: crowded,
  benchState: createDefaultBenchState(),
  coins: 30,
  bloom: 10,
  day: 10,
  capacity: 12,
  condition: "thriving",
});
assert.equal(crowdedPropagation.ok, true);
const filledBeforeCompletion = [...crowdedPropagation.inventory, plant("late-stock", { slot: null })];
const waiting = advanceAndApplyBenchJobs({
  benchState: crowdedPropagation.benchState,
  inventory: filledBeforeCompletion,
  day: 12,
  capacity: 12,
});
assert.equal(waiting.waitingJobs.length, 1);
assert.equal(waiting.inventory.length, 12);
const spaceMade = advanceAndApplyBenchJobs({
  benchState: waiting.benchState,
  inventory: waiting.inventory.slice(0, 11),
  day: 13,
  capacity: 12,
});
assert.equal(spaceMade.waitingJobs.length, 0);
assert.equal(spaceMade.inventory.length, 12);
assert.equal(migrateBenchState(spaceMade.benchState).jobs.length, 0);

console.log("care bench QA passed");
