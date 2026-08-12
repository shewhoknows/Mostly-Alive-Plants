import assert from "node:assert/strict";

import {
  SHOP_PROJECTS,
  SHOP_PROJECT_START_WEEK,
  createDefaultProjectState,
  fundWeeklyProject,
  migrateProjectState,
  projectForWeek,
  validateProjectFunding,
  weeklyProjectCost,
} from "./shop-project-system.js";

assert.equal(SHOP_PROJECT_START_WEEK, 3);
assert.equal(SHOP_PROJECTS.length, 5);
assert.equal(projectForWeek(1), null);
assert.equal(projectForWeek(2), null);
assert.equal(weeklyProjectCost(1), null);
assert.equal(weeklyProjectCost(2), null);

for (let week = SHOP_PROJECT_START_WEEK; week <= 200; week += 1) {
  const expectedIndex = (week - SHOP_PROJECT_START_WEEK) % SHOP_PROJECTS.length;
  const expectedCost = {
    coins: Math.min(180, 60 + 15 * (week - SHOP_PROJECT_START_WEEK)),
    bloom: Math.min(45, 15 + 3 * (week - SHOP_PROJECT_START_WEEK)),
  };
  const first = projectForWeek(week);
  const repeat = projectForWeek(week);

  assert.equal(first.id, SHOP_PROJECTS[expectedIndex].id, `Week ${week} has the wrong project.`);
  assert.deepEqual(first, repeat, `Week ${week} must be deterministic.`);
  assert.deepEqual(first.cost, expectedCost, `Week ${week} has the wrong cost.`);
  assert.deepEqual(weeklyProjectCost(week), expectedCost);
}

assert.deepEqual(weeklyProjectCost(200), { coins: 180, bloom: 45 });

const locked = validateProjectFunding({
  week: 2,
  projectState: createDefaultProjectState(),
  coins: 999,
  bloom: 999,
});
assert.equal(locked.ok, false);
assert.equal(locked.code, "locked");

const insufficient = validateProjectFunding({
  week: 3,
  projectState: createDefaultProjectState(),
  coins: 59,
  bloom: 14,
});
assert.equal(insufficient.ok, false);
assert.equal(insufficient.code, "insufficient-resources");
assert.equal(insufficient.coins, 59);
assert.equal(insufficient.bloom, 14);
assert.match(insufficient.message, /1 coins and 1 Bloom/);

const firstFunding = fundWeeklyProject({
  week: 3,
  projectState: createDefaultProjectState(),
  coins: 60,
  bloom: 15,
});
assert.equal(firstFunding.ok, true);
assert.equal(firstFunding.code, "funded");
assert.equal(firstFunding.coins, 0);
assert.equal(firstFunding.bloom, 0);
assert.deepEqual(firstFunding.projectState.fundedWeeks, [3]);
assert.equal(firstFunding.projectState.counts["window-garland"], 1);
assert.equal(firstFunding.projectState.total, 1);

const sameWeekAgain = fundWeeklyProject({
  week: 3,
  projectState: firstFunding.projectState,
  coins: 999,
  bloom: 999,
});
assert.equal(sameWeekAgain.ok, false);
assert.equal(sameWeekAgain.code, "already-funded");
assert.deepEqual(sameWeekAgain.projectState, firstFunding.projectState);
assert.equal(sameWeekAgain.coins, 999);
assert.equal(sameWeekAgain.bloom, 999);

const repeatProject = fundWeeklyProject({
  week: 8,
  projectState: firstFunding.projectState,
  coins: 999,
  bloom: 999,
});
assert.equal(repeatProject.ok, true);
assert.equal(repeatProject.project.id, "window-garland");
assert.equal(repeatProject.projectState.counts["window-garland"], 2);
assert.equal(repeatProject.projectState.total, 2);

let longState = createDefaultProjectState();
let coins = 1_000_000;
let bloom = 1_000_000;
for (let week = SHOP_PROJECT_START_WEEK; week <= 200; week += 1) {
  const result = fundWeeklyProject({ week, projectState: longState, coins, bloom });
  assert.equal(result.ok, true, `Week ${week} must be fundable with enough resources.`);
  longState = result.projectState;
  coins = result.coins;
  bloom = result.bloom;

  const duplicate = fundWeeklyProject({ week, projectState: longState, coins, bloom });
  assert.equal(duplicate.ok, false, `Week ${week} must only be funded once.`);
  assert.equal(duplicate.code, "already-funded");
}
assert.equal(longState.total, 198);
assert.equal(longState.fundedWeeks.length, 198);
assert.equal(Object.values(longState.counts).reduce((sum, count) => sum + count, 0), 198);

const migrated = migrateProjectState({
  version: 0,
  fundedWeek: "8",
  fundedWeeks: [3, "4", 4, 2, "bad"],
  projectCounts: new Map([
    ["window-garland", "1.9"],
    ["community-board", 1],
    ["unknown-project", 20],
    ["painted-pots", -2],
  ]),
  total: 99,
});
assert.deepEqual(migrated.fundedWeeks, [3, 4, 8]);
assert.deepEqual(migrated.counts, {
  "window-garland": 2,
  "community-board": 1,
});
assert.equal(migrated.total, 3);
assert.deepEqual(JSON.parse(JSON.stringify(migrated)), migrated);

const migratedEntries = migrateProjectState({
  counts: [["reading-corner", 2], ["hanging-garden", 3]],
});
assert.deepEqual(migratedEntries.counts, {
  "reading-corner": 2,
  "hanging-garden": 3,
});
assert.equal(migratedEntries.total, 5);

console.log("shop project QA passed for Weeks 1-200");
