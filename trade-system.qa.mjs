import assert from "node:assert/strict";

import {
  closingOverstockCost,
  dailyTradeProfile,
  optionalSpendingBudget,
  weeklyObjectiveFeasibility,
  weeklyTradeProfile,
} from "./trade-system.js";

assert.equal(closingOverstockCost({ week: 3, inventoryCount: 16, stockTarget: 10 }), 0);
assert.equal(closingOverstockCost({ week: 4, inventoryCount: 10, stockTarget: 10 }), 0);
assert.equal(closingOverstockCost({ week: 4, inventoryCount: 13, stockTarget: 10 }), 6);
assert.equal(closingOverstockCost({ week: 20, inventoryCount: 16, stockTarget: 10 }), 12);
assert.deepEqual(optionalSpendingBudget({ coins: 100, outstandingCosts: 25, dailyOperatingCost: 12 }), { coins: 63, reserved: 37 });
assert.deepEqual(optionalSpendingBudget({ coins: 20, outstandingCosts: 25, dailyOperatingCost: 12 }), { coins: 0, reserved: 37 });
assert.deepEqual(optionalSpendingBudget({ coins: 20, outstandingCosts: 25, dailyOperatingCost: 12, dailyOperatingCostPaid: true }), { coins: 20, reserved: 0 });

for (let week = 1; week <= 20; week += 1) {
  const weekly = weeklyTradeProfile(week);
  assert.equal(weekly.days.length, 5, `Week ${week} must have five profiles.`);
  assert.ok(weekly.availableCustomerCount >= weekly.maximumDailyVisitors, `Week ${week} needs more unlocked customers.`);

  const distinctCounts = new Set();
  weekly.days.forEach((profile) => {
    const repeat = dailyTradeProfile({ day: profile.day, inventoryCount: 0 });
    assert.deepEqual(profile, repeat, `Day ${profile.day} must be deterministic.`);
    assert.equal(profile.visitorCount, profile.requestedVisitorCount, `Day ${profile.day} must not be roster-limited.`);
    assert.equal(profile.week, week);
    assert.ok(Number.isInteger(profile.operatingCost) && profile.operatingCost >= 0);
    assert.ok(profile.stockTarget >= profile.visitorCount);
    assert.ok(profile.stockTarget <= 12);
    assert.equal(profile.shipment.recommended, profile.stockTarget);
    assert.ok(profile.shipment.maximum >= profile.shipment.recommended);
    assert.ok(profile.pressureCopy.length > 20);
    distinctCounts.add(profile.visitorCount);
  });

  if (week === 1) {
    assert.deepEqual(weekly.days.map(({ visitorCount }) => visitorCount), [3, 3, 3, 3, 3]);
  } else {
    assert.ok(weekly.minimumDailyVisitors >= 4 && weekly.maximumDailyVisitors <= 6);
    assert.ok(distinctCounts.size >= 2, `Week ${week} needs weekday variation.`);
  }

  const feasibility = weeklyObjectiveFeasibility(week);
  assert.equal(feasibility.feasible, true, `Week ${week} objective is not feasible.`);
}

const fullShop = dailyTradeProfile({ day: 100, inventoryCount: 12, capacity: 12 });
assert.equal(fullShop.shipment.recommended, 0);
assert.equal(fullShop.shipment.maximum, 0);
assert.ok(["full", "overstock"].includes(fullShop.stockPressure));

const advertisedShop = dailyTradeProfile({ day: 11, visitorBonus: 1 });
assert.equal(advertisedShop.visitorCount, 5);
assert.equal(advertisedShop.visitorBonus, 1);
assert.equal(advertisedShop.operatingCostBreakdown.serviceCost, 4);

const overstockedShop = dailyTradeProfile({ day: 11, inventoryCount: 12 });
assert.ok(overstockedShop.operatingCostBreakdown.stockCareCost > 0);
assert.ok(overstockedShop.operatingCost > advertisedShop.operatingCost);

const serviceLimitedShop = dailyTradeProfile({ day: 15, visitorBonus: 1, serviceableCapacity: 4 });
assert.equal(serviceLimitedShop.visitorCount, 4);
assert.equal(serviceLimitedShop.serviceableCapacity, 4);

const legacyInput = dailyTradeProfile({ day: "bad", inventoryCount: -5, capacity: 0 });
assert.equal(legacyInput.day, 1);
assert.equal(legacyInput.visitorCount, 3);
assert.equal(legacyInput.shipment.freeCapacity, 12);

console.log("trade-system QA passed for Weeks 1-20");
