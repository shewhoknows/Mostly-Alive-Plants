import assert from "node:assert/strict";

import {
  HEALTH_ISSUE_INTERVAL_DAYS,
  HEALTH_ISSUE_START_DAY,
  ISSUE_TREATMENTS,
  LONG_STAY_VALUE_LOSS,
  MAX_GROWTH_POINTS,
  MAX_NEW_ISSUES_PER_MORNING,
  PLANT_HEALTH_STATE_VERSION,
  PLANT_ISSUE_TYPES,
  TREATMENT_IDS,
  advancePlantHealthInventoryMorning,
  advancePlantHealthMorning,
  applyPlantFertilizer,
  applyPlantTreatment,
  assignClipGrowLight,
  hasClipGrowLightSupport,
  hasFertilizerGrowthBoost,
  isHealthIssueMorning,
  markPlantRehabilitated,
  migratePlantHealth,
  migratePlantHealthInventory,
  removeClipGrowLight,
  treatmentForIssue,
  validateClipGrowLightAssignment,
  validatePlantFertilizer,
  validatePlantTreatment,
} from "./plant-health-system.js";

function plant(id, overrides = {}) {
  return {
    id,
    species: "Button Fern",
    arrivalDay: 1,
    lifeStage: "mature",
    maturityDaysRemaining: 0,
    rootAgeDays: 0,
    care: { water: false, mist: false, prune: false },
    ...overrides,
  };
}

// Old records gain safe defaults and retain unrelated data.
const old = { id: "old-save", species: "Button Fern", customField: "keep-me" };
const migrated = migratePlantHealth(old);
assert.notEqual(migrated, old);
assert.equal(migrated.plantHealthVersion, PLANT_HEALTH_STATE_VERSION);
assert.equal(migrated.customField, "keep-me");
assert.equal(migrated.nurseryAgeDays, 0);
assert.equal(migrated.needsRehabilitation, false);
assert.equal(migrated.rehabilitationReason, null);
assert.equal(migrated.healthIssue, null);
assert.equal(migrated.healthIssueDay, null);
assert.equal(migrated.healthIssueAgeDays, 0);
assert.equal(migrated.fertilizedDay, null);
assert.equal(migrated.growthPoints, 0);
assert.equal(migrated.clipGrowLightAssigned, false);
assert.deepEqual(migratePlantHealthInventory([old]).map((entry) => entry.id), ["old-save"]);
assert.deepEqual(migratePlantHealthInventory(null), []);
assert.equal(migratePlantHealth({ needsRehabilitation: true, rehabilitationValueLoss: 4 }).rehabilitationReason, "nursery");
assert.equal(migratePlantHealth({ needsRehabilitation: true, nurseryStressDay: 4 }).rehabilitationReason, "long-stay");

// Regular care does not stop age-based nursery stress.
let aging = plant("aging", { price: 18, care: { water: true, mist: true, prune: true } });
aging = advancePlantHealthMorning(aging, { day: 2 });
assert.equal(aging.nurseryAgeDays, 1);
assert.equal(aging.needsRehabilitation, false);
aging = advancePlantHealthMorning(aging, { day: 3 });
assert.equal(aging.nurseryAgeDays, 2);
assert.equal(aging.needsRehabilitation, false, "age 2 must not cause nursery stress");
const ageTwoSnapshot = aging;
aging = advancePlantHealthMorning(aging, { day: 4 });
assert.equal(aging.nurseryAgeDays, 3);
assert.equal(aging.needsRehabilitation, true, "age 3 must cause nursery stress");
assert.equal(aging.rehabilitationReason, "long-stay");
assert.equal(aging.rehabilitationValueLoss, LONG_STAY_VALUE_LOSS);
assert.equal(aging.price, 18 - LONG_STAY_VALUE_LOSS);
assert.equal(aging.nurseryStressDay, 4);
const sameMorning = advancePlantHealthMorning(aging, { day: 4 });
assert.equal(sameMorning.nurseryAgeDays, 3, "a morning must not advance twice");
assert.equal(ageTwoSnapshot.needsRehabilitation, false, "the input plant must not mutate");

const juvenileAgePaused = advancePlantHealthMorning(plant("age-paused-juvenile", {
  lifeStage: "juvenile",
  maturityDaysRemaining: 2,
  nurseryAgeDays: 2,
  lastHealthMorningDay: 3,
}), { day: 4 });
assert.equal(juvenileAgePaused.nurseryAgeDays, 2);
assert.equal(juvenileAgePaused.needsRehabilitation, false);
assert.equal(juvenileAgePaused.lastHealthMorningDay, 4);

const benchAgePaused = advancePlantHealthMorning(plant("age-paused-bench", {
  nurseryAgeDays: 2,
  lastHealthMorningDay: 3,
  benchStatus: { type: "repot", readyDay: 5 },
  healthIssue: PLANT_ISSUE_TYPES.MITES,
  healthIssueDay: 3,
  healthIssueAgeDays: 0,
}), { day: 4 });
assert.equal(benchAgePaused.nurseryAgeDays, 2);
assert.equal(benchAgePaused.needsRehabilitation, false);
assert.equal(benchAgePaused.lastHealthMorningDay, 4);
assert.equal(benchAgePaused.healthIssueAgeDays, 1, "an existing issue still ages while the plant is on the bench");

const rehabilitated = markPlantRehabilitated(aging, { day: 4 });
assert.equal(rehabilitated.nurseryAgeDays, 0);
assert.equal(rehabilitated.needsRehabilitation, false);
assert.equal(rehabilitated.rehabilitationReason, null);
assert.equal(rehabilitated.price, aging.price + LONG_STAY_VALUE_LOSS);
assert.equal(rehabilitated.rehabilitationValueLoss, 0);
assert.equal(rehabilitated.lastRehabilitatedDay, 4);
assert.equal(aging.needsRehabilitation, true);

const stressMorning = advancePlantHealthInventoryMorning([ageTwoSnapshot], { day: 4 });
assert.deepEqual(stressMorning.newlyStressed, ["aging"]);
assert.match(stressMorning.message, /needs rehabilitation/i);

// Issue mornings have a fixed early-game gate and interval.
for (let day = 1; day < HEALTH_ISSUE_START_DAY; day += 1) assert.equal(isHealthIssueMorning(day), false);
assert.equal(isHealthIssueMorning(HEALTH_ISSUE_START_DAY), true);
assert.equal(isHealthIssueMorning(HEALTH_ISSUE_START_DAY + 1), false);
assert.equal(isHealthIssueMorning(HEALTH_ISSUE_START_DAY + HEALTH_ISSUE_INTERVAL_DAYS), true);

// Issue generation is deterministic, bounded, and uses both issue types.
const issueTypesSeen = new Set();
let issueInventory = Array.from({ length: 12 }, (_, index) => migratePlantHealth(plant(`issue-${index}`, {
  nurseryAgeDays: 2,
  lastHealthMorningDay: 1,
})));
for (let day = 2; day <= 34; day += 1) {
  const before = JSON.parse(JSON.stringify(issueInventory));
  const first = advancePlantHealthInventoryMorning(issueInventory, { day });
  const replay = advancePlantHealthInventoryMorning(before, { day });
  assert.deepEqual(first, replay, `Day ${day} issue results must be deterministic`);
  assert.ok(first.newIssues.length <= MAX_NEW_ISSUES_PER_MORNING);
  if (!isHealthIssueMorning(day)) assert.equal(first.newIssues.length, 0);
  first.inventory.forEach((entry) => {
    assert.ok(!entry.healthIssue || Object.values(PLANT_ISSUE_TYPES).includes(entry.healthIssue));
  });
  first.newIssues.forEach((issue) => issueTypesSeen.add(issue.type));
  issueInventory = first.inventory;
  // Treat new issues so later scheduled mornings can exercise the full cycle.
  first.newIssues.forEach((issue) => {
    const index = issueInventory.findIndex((entry) => entry.id === issue.plantId);
    const treatment = treatmentForIssue(issue.type);
    issueInventory[index] = applyPlantTreatment({ plant: issueInventory[index], treatmentId: treatment, day }).plant;
  });
}
assert.deepEqual([...issueTypesSeen].sort(), Object.values(PLANT_ISSUE_TYPES).sort());

// Re-running the same morning cannot create another issue.
const scheduledDay = HEALTH_ISSUE_START_DAY;
const scheduledSource = [migratePlantHealth(plant("one", { nurseryAgeDays: 2, lastHealthMorningDay: scheduledDay - 1 }))];
const scheduledFirst = advancePlantHealthInventoryMorning(scheduledSource, { day: scheduledDay });
assert.equal(scheduledFirst.newIssues.length, 1);
const scheduledSecond = advancePlantHealthInventoryMorning(scheduledFirst.inventory, { day: scheduledDay });
assert.equal(scheduledSecond.newIssues.length, 0);
assert.equal(scheduledSecond.advanced, false);
assert.match(scheduledFirst.message, /mites|fungus/i);

const ineligibleIssueMorning = advancePlantHealthInventoryMorning([
  migratePlantHealth(plant("issue-paused-juvenile", {
    lifeStage: "juvenile",
    maturityDaysRemaining: 2,
    nurseryAgeDays: 2,
    lastHealthMorningDay: scheduledDay - 1,
  })),
  migratePlantHealth(plant("issue-paused-bench", {
    nurseryAgeDays: 2,
    lastHealthMorningDay: scheduledDay - 1,
    benchStatus: { type: "repot", readyDay: scheduledDay + 1 },
  })),
], { day: scheduledDay });
assert.equal(ineligibleIssueMorning.newIssues.length, 0);
assert.ok(ineligibleIssueMorning.inventory.every((entry) => entry.healthIssue === null));

// Existing issues advance by morning and stop at a bounded severity label.
let issueAging = migratePlantHealth(plant("issue-aging", {
  lastHealthMorningDay: 6,
  healthIssue: PLANT_ISSUE_TYPES.MITES,
  healthIssueDay: 6,
  healthIssueAgeDays: 0,
}));
issueAging = advancePlantHealthMorning(issueAging, { day: 7 });
assert.equal(issueAging.healthIssueAgeDays, 1);
assert.equal(issueAging.healthIssueSeverity, "mild");
issueAging = advancePlantHealthMorning(issueAging, { day: 8 });
assert.equal(issueAging.healthIssueAgeDays, 2);
assert.equal(issueAging.healthIssueSeverity, "established");
issueAging = advancePlantHealthMorning(issueAging, { day: 12 });
assert.equal(issueAging.healthIssueSeverity, "severe");

// Treatments must match and do not consume any external stock.
assert.equal(ISSUE_TREATMENTS.mites, TREATMENT_IDS.MITES);
assert.equal(ISSUE_TREATMENTS.fungus, TREATMENT_IDS.FUNGUS);
assert.equal(treatmentForIssue("unknown"), null);
const mitesPlant = migratePlantHealth(plant("mites", {
  healthIssue: PLANT_ISSUE_TYPES.MITES,
  healthIssueDay: 10,
  healthIssueAgeDays: 1,
}));
const mismatch = validatePlantTreatment({ plant: mitesPlant, treatmentId: TREATMENT_IDS.FUNGUS, day: 11 });
assert.equal(mismatch.ok, false);
assert.equal(mismatch.code, "treatment-mismatch");
assert.equal(mismatch.requiredTreatment, TREATMENT_IDS.MITES);
const mitesDone = applyPlantTreatment({ plant: mitesPlant, treatmentId: TREATMENT_IDS.MITES, day: 11 });
assert.equal(mitesDone.ok, true);
assert.equal(mitesDone.plant.healthIssue, null);
assert.equal(mitesDone.plant.lastTreatmentId, TREATMENT_IDS.MITES);
assert.equal(mitesDone.plant.lastIssueResolvedDay, 11);
assert.notEqual(mitesDone.plant, mitesPlant);
assert.notEqual(mitesPlant.healthIssue, null);

const fungusPlant = migratePlantHealth(plant("fungus", {
  healthIssue: PLANT_ISSUE_TYPES.FUNGUS,
  healthIssueDay: 10,
  healthIssueAgeDays: 1,
}));
assert.equal(validatePlantTreatment({ plant: fungusPlant, treatmentId: TREATMENT_IDS.FUNGUS, day: 11 }).ok, true);
assert.equal(applyPlantTreatment({ plant: fungusPlant, treatmentId: TREATMENT_IDS.FUNGUS, day: 11 }).plant.healthIssue, null);
assert.equal(validatePlantTreatment({ plant: plant("healthy"), treatmentId: TREATMENT_IDS.MITES, day: 11 }).code, "no-health-issue");

// Fertilizer advances juveniles, boosts mature growth, and cannot run twice.
const juvenile = plant("juvenile", { lifeStage: "juvenile", maturityDaysRemaining: 2 });
const juvenileFed = applyPlantFertilizer({ plant: juvenile, day: 12 });
assert.equal(juvenileFed.ok, true);
assert.equal(juvenileFed.effect, "juvenile-growth");
assert.equal(juvenileFed.plant.maturityDaysRemaining, 1);
assert.equal(juvenile.maturityDaysRemaining, 2);
assert.equal(validatePlantFertilizer({ plant: juvenileFed.plant, day: 12 }).code, "already-fertilized");
assert.equal(applyPlantFertilizer({ plant: juvenileFed.plant, day: 12 }).ok, false);
const juvenileMatured = applyPlantFertilizer({ plant: { ...juvenileFed.plant, fertilizedDay: 11 }, day: 13 });
assert.equal(juvenileMatured.effect, "juvenile-matured");
assert.equal(juvenileMatured.plant.lifeStage, "mature");
assert.equal(juvenileMatured.plant.maturityDaysRemaining, 0);

const matureFed = applyPlantFertilizer({ plant: plant("mature"), day: 14 });
assert.equal(matureFed.effect, "mature-vigor");
assert.equal(matureFed.plant.growthPoints, 1);
assert.equal(matureFed.plant.growthBoost, 1);
assert.equal(hasFertilizerGrowthBoost(matureFed.plant, { day: 14 }), true);
assert.equal(hasFertilizerGrowthBoost(matureFed.plant, { day: 15 }), false);
const cappedFed = applyPlantFertilizer({ plant: plant("capped", { growthPoints: MAX_GROWTH_POINTS }), day: 14 });
assert.equal(cappedFed.plant.growthPoints, MAX_GROWTH_POINTS);
assert.equal(validatePlantFertilizer({ plant: fungusPlant, day: 14 }).code, "treat-first");

// Clip grow-light helpers enforce assignment count but do not consume a light.
const lightPlant = plant("light-plant");
assert.equal(hasClipGrowLightSupport(lightPlant), false);
assert.equal(validateClipGrowLightAssignment({ plant: lightPlant, assignedCount: 1, maxAssignments: 1 }).code, "no-light-available");
const assigned = assignClipGrowLight({ plant: lightPlant, assignedCount: 0, maxAssignments: 1, day: 15 });
assert.equal(assigned.ok, true);
assert.equal(hasClipGrowLightSupport(assigned.plant), true);
assert.equal(assigned.plant.clipGrowLightAssignedDay, 15);
assert.equal(validateClipGrowLightAssignment({ plant: assigned.plant, assignedCount: 1, maxAssignments: 1 }).code, "already-assigned");
const removed = removeClipGrowLight(assigned.plant);
assert.equal(removed.ok, true);
assert.equal(hasClipGrowLightSupport(removed.plant), false);
assert.equal(removeClipGrowLight(removed.plant).code, "light-not-assigned");

console.log("plant health QA passed");
