import assert from "node:assert/strict";

import {
  BENCH_JOB_TYPES,
  CARE_BENCH_STATE_VERSION,
  GROW_LAMP_PROPAGATION_MATURITY_DAYS,
  GROW_LAMP_REHABILITATE_PROTECTION_DAYS,
  GROW_LAMP_REPOT_VALUE_BONUS,
  PROPAGATION_MATURITY_DAYS,
  REHABILITATE_PROTECTION_DAYS,
  REHABILITATE_VALUE_RESTORE,
  REPOT_VALUE_BONUS,
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
assert.equal(repot.job.lampAssisted, false);
assert.equal(repot.inventory[0].benchStatus.lampAssisted, false);

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

const legacyBench = migrateBenchState({
  version: 1,
  slotCount: 1,
  nextJobNumber: 2,
  jobs: [{
    id: "bench-001-repot",
    type: BENCH_JOB_TYPES.REPOT,
    plantId: "legacy-plant",
    status: "active",
    startDay: 2,
    readyDay: 3,
    previousSlot: 0,
    cost: { coins: 10, bloom: 0 },
  }],
});
assert.equal(legacyBench.version, CARE_BENCH_STATE_VERSION);
assert.equal(legacyBench.jobs[0].lampAssisted, false);

const thirstyNormal = startBenchJob({
  type: BENCH_JOB_TYPES.REHABILITATE,
  plantId: "thirsty-normal",
  inventory: [plant("thirsty-normal", { hydration: 30, needsRehabilitation: false, slot: null })],
  benchState: createDefaultBenchState(),
  coins: 20,
  bloom: 0,
  day: 4,
  capacity: 12,
  condition: "drooping",
});
assert.equal(thirstyNormal.ok, false);
assert.equal(thirstyNormal.code, "rehabilitation-not-needed");

inventory = [plant("rescue", {
  hydration: 100,
  needsRehabilitation: true,
  rehabilitationValueLoss: REHABILITATE_VALUE_RESTORE,
  price: fern.price - REHABILITATE_VALUE_RESTORE,
  slot: null,
})];
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
const savedRehab = JSON.parse(JSON.stringify({ benchState: rehab.benchState, inventory: rehab.inventory }));
const rehabDone = advanceAndApplyBenchJobs({
  benchState: savedRehab.benchState,
  inventory: savedRehab.inventory,
  day: 5,
  capacity: 12,
});
assert.equal(rehabDone.inventory[0].needsRehabilitation, false);
assert.equal(rehabDone.inventory[0].hydration, 100);
assert.equal(rehabDone.inventory[0].conditionProtectionUntilDay, 6);
assert.equal(rehabDone.inventory[0].acquisitionCost, fern.wholesaleCost + 8);
assert.equal(rehabDone.inventory[0].price, fern.price);
assert.equal(rehabDone.inventory[0].rehabilitationValueLoss, 0);
assert.equal(rehabDone.appliedJobs[0].restoredValue, REHABILITATE_VALUE_RESTORE);
const rehabAppliedAgain = advanceAndApplyBenchJobs({
  benchState: rehabDone.benchState,
  inventory: rehabDone.inventory,
  day: 6,
  capacity: 12,
});
assert.equal(rehabAppliedAgain.inventory[0].price, fern.price);
assert.equal(rehabAppliedAgain.appliedJobs.length, 0);

const legacyValueRehab = startBenchJob({
  type: BENCH_JOB_TYPES.REHABILITATE,
  plantId: "legacy-value-rescue",
  inventory: [plant("legacy-value-rescue", { hydration: 100, needsRehabilitation: true, slot: null })],
  benchState: createDefaultBenchState(),
  coins: 20,
  bloom: 0,
  day: 7,
  capacity: 12,
  condition: "nursery-stressed",
});
const legacyValueDone = advanceAndApplyBenchJobs({
  benchState: legacyValueRehab.benchState,
  inventory: legacyValueRehab.inventory,
  day: 8,
  capacity: 12,
});
assert.equal(legacyValueDone.inventory[0].price, fern.price);
assert.equal(legacyValueDone.appliedJobs[0].restoredValue, 0);

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

const assistedRepot = startBenchJob({
  type: BENCH_JOB_TYPES.REPOT,
  plantId: "lamp-repot",
  inventory: [plant("lamp-repot", { rootComfort: "cramped", rootAgeDays: 4, price: 18 })],
  benchState: createDefaultBenchState(),
  coins: 40,
  bloom: 12,
  day: 20,
  capacity: 12,
  lampAssisted: true,
});
assert.equal(assistedRepot.ok, true);
assert.equal(assistedRepot.job.lampAssisted, true);
assert.equal(assistedRepot.inventory[0].benchStatus.lampAssisted, true);
const restoredAssistedRepot = reconcileBenchInventory(JSON.parse(JSON.stringify({
  inventory: assistedRepot.inventory,
  benchState: assistedRepot.benchState,
})));
assert.equal(restoredAssistedRepot.benchState.jobs[0].lampAssisted, true);
assert.equal(restoredAssistedRepot.inventory[0].benchStatus.lampAssisted, true);
const assistedRepotDone = advanceAndApplyBenchJobs({
  ...restoredAssistedRepot,
  day: 21,
  capacity: 12,
});
assert.equal(assistedRepotDone.inventory[0].price, 18 + REPOT_VALUE_BONUS + GROW_LAMP_REPOT_VALUE_BONUS);
assert.equal(assistedRepotDone.inventory[0].repotValueBonus, REPOT_VALUE_BONUS + GROW_LAMP_REPOT_VALUE_BONUS);
assert.match(assistedRepotDone.message, /grow lamp added 2 more coins/i);

const assistedRehab = startBenchJob({
  type: BENCH_JOB_TYPES.REHABILITATE,
  plantId: "lamp-rehab",
  inventory: [plant("lamp-rehab", {
    hydration: 100,
    needsRehabilitation: true,
    rehabilitationValueLoss: REHABILITATE_VALUE_RESTORE,
    price: fern.price - REHABILITATE_VALUE_RESTORE,
    slot: null,
  })],
  benchState: createDefaultBenchState(),
  coins: 20,
  bloom: 0,
  day: 30,
  capacity: 12,
  condition: "stressed",
  lampAssisted: true,
});
const assistedRehabDone = advanceAndApplyBenchJobs({
  benchState: assistedRehab.benchState,
  inventory: assistedRehab.inventory,
  day: 31,
  capacity: 12,
});
assert.equal(
  assistedRehabDone.inventory[0].conditionProtectionUntilDay,
  31 + REHABILITATE_PROTECTION_DAYS + GROW_LAMP_REHABILITATE_PROTECTION_DAYS - 1,
);
assert.match(assistedRehabDone.message, /grow lamp added one protection day/i);
assert.equal(assistedRehabDone.inventory[0].price, fern.price);
assert.equal(assistedRehabDone.inventory[0].rehabilitationValueLoss, 0);

const assistedPropagation = startBenchJob({
  type: BENCH_JOB_TYPES.PROPAGATE,
  plantId: "lamp-parent",
  inventory: [plant("lamp-parent", { hydration: 92 })],
  benchState: createDefaultBenchState(),
  coins: 30,
  bloom: 10,
  day: 40,
  capacity: 12,
  condition: "thriving",
  lampAssisted: true,
});
const assistedPropagationDone = advanceAndApplyBenchJobs({
  benchState: assistedPropagation.benchState,
  inventory: assistedPropagation.inventory,
  day: 42,
  capacity: 12,
});
const assistedChild = assistedPropagationDone.inventory.find((entry) => entry.parentId === "lamp-parent");
assert.equal(assistedChild.maturityDaysRemaining, GROW_LAMP_PROPAGATION_MATURITY_DAYS);
assert.notEqual(assistedChild.maturityDaysRemaining, PROPAGATION_MATURITY_DAYS);
assert.match(assistedPropagationDone.message, /grow lamp shortened its growth time/i);

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
